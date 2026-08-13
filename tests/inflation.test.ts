import { describe, expect, it } from "vitest";
import { GROUP_IDS, yearOnYear } from "../src/lib/cpi.js";
import { OFFICIAL } from "../src/lib/baskets.js";
import type { Weights } from "../src/lib/baskets.js";
import {
  basketInflation,
  basketHistory,
  compare,
  publishedRate,
  reconstructionError,
} from "../src/lib/inflation.js";

const HOUSING = "CUUR0000SAH";
const APPAREL = "CUUR0000SAA";

/** A basket with all its weight on one group. */
function allOn(groupId: string): Weights {
  return Object.fromEntries(GROUP_IDS.map((id) => [id, id === groupId ? 100 : 0]));
}

describe("reconstructionError — the load-bearing check", () => {
  it("rebuilds the official index to within a tenth of a point", () => {
    const err = reconstructionError(OFFICIAL.weights);
    expect(err.monthsCompared).toBe(101);
    expect(err.meanAbsolutePp).toBeCloseTo(0.083, 2);
    expect(err.meanAbsolutePp).toBeLessThan(0.1);
    expect(err.goodEnough).toBe(true);
  });

  it("puts the worst month where re-weighting bites hardest (2021)", () => {
    // The rebuild drifts most where real spending patterns moved most — the
    // reopening, when one year's fixed weights fit worst. A satisfying error:
    // it has a reason.
    expect(reconstructionError(OFFICIAL.weights).worstMonth).toBe("2021-05");
  });

  it("can actually fail — a check that cannot fail verifies nothing", () => {
    // Put every cent on apparel, which barely moves, and the rebuild diverges
    // from the headline by ~2.7pp on average. If this passed, the reconstruction
    // guarantee would be decoration.
    const err = reconstructionError(allOn(APPAREL));
    expect(err.goodEnough).toBe(false);
    expect(err.meanAbsolutePp).toBeGreaterThan(1);
  });
});

describe("basketInflation", () => {
  it("with the official weights, tracks the published rate closely", () => {
    const rebuilt = basketInflation(OFFICIAL.weights, "2026-06");
    const published = publishedRate("2026-06");
    expect(rebuilt).not.toBeNull();
    expect(published).not.toBeNull();
    // Within the reconstruction tolerance (a tenth of a point).
    expect(Math.abs((rebuilt as number) - (published as number))).toBeLessThan(0.001);
  });

  it("a single-group basket is exactly that group's rate", () => {
    // The clean identity behind the whole method: weight everything on housing
    // and the basket rate IS the housing rate, nothing averaged in.
    const rate = basketInflation(allOn(HOUSING), "2026-06");
    expect(rate).toBeCloseTo(yearOnYear(HOUSING, "2026-06") as number, 10);
  });

  it("is null when a group can't be computed that month", () => {
    // 2017-01 has no year-earlier baseline for the groups.
    expect(basketInflation(OFFICIAL.weights, "2017-01")).toBeNull();
  });

  it("ignores the overall scale of the weights (only shares matter)", () => {
    const doubled = Object.fromEntries(
      GROUP_IDS.map((id) => [id, (OFFICIAL.weights[id] ?? 0) * 2]),
    );
    expect(basketInflation(doubled, "2026-06")).toBeCloseTo(
      basketInflation(OFFICIAL.weights, "2026-06") as number,
      12,
    );
  });
});

describe("basketHistory", () => {
  it("returns every comparable month, ascending", () => {
    const hist = basketHistory(OFFICIAL.weights);
    expect(hist).toHaveLength(101);
    expect(hist[0]?.month).toBe("2018-01");
    expect(hist.at(-1)?.month).toBe("2026-06");
    for (let i = 1; i < hist.length; i++) {
      expect(hist[i]!.month > hist[i - 1]!.month).toBe(true);
    }
  });
});

describe("compare", () => {
  it("a commuter basket runs hotter than the official one, and worst in the shock", () => {
    const commuter: Weights = {
      CUUR0000SAF: 14, CUUR0000SAH: 36, CUUR0000SAA: 2.5, CUUR0000SAT: 30,
      CUUR0000SAM: 7, CUUR0000SAR: 5, CUUR0000SAE: 4, CUUR0000SAG: 1.5,
    };
    const d = compare(commuter, OFFICIAL.weights);
    expect(d.months).toBe(101);
    // The oil-heavy basket's widest gap lands in the 2021-22 energy spike.
    expect(d.worstMonth?.startsWith("2022") || d.worstMonth?.startsWith("2021")).toBe(true);
    expect(d.worstGapPp).toBeGreaterThan(1.5);
  });

  it("a basket compared with itself has no gap and unit ratio", () => {
    const d = compare(OFFICIAL.weights, OFFICIAL.weights);
    expect(d.meanGapPp).toBeCloseTo(0, 10);
    expect(d.worstGapPp).toBeCloseTo(0, 10);
    expect(d.cumulativeRatio).toBeCloseTo(1, 10);
  });
});
