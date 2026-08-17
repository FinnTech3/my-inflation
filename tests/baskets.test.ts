import { describe, expect, it } from "vitest";
import { GROUP_IDS } from "../src/lib/cpi.js";
import { ALL_BASKETS, HOUSEHOLDS, OFFICIAL, share, total } from "../src/lib/baskets.js";

describe("basket integrity", () => {
  it("every basket carries a weight for all eight groups", () => {
    for (const basket of ALL_BASKETS) {
      for (const id of GROUP_IDS) {
        expect(typeof basket.weights[id]).toBe("number");
        expect(basket.weights[id]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("only the official basket is flagged official", () => {
    expect(OFFICIAL.official).toBe(true);
    for (const h of HOUSEHOLDS) expect(h.official).toBeUndefined();
  });

  it("every basket states a rationale, a weight without a reason is just a number", () => {
    for (const basket of ALL_BASKETS) {
      expect(basket.rationale.length).toBeGreaterThan(20);
    }
  });
});

describe("share / total", () => {
  it("the official weights sum to 100", () => {
    expect(total(OFFICIAL.weights)).toBeCloseTo(100, 6);
  });

  it("shares normalise and sum to 1", () => {
    const sum = GROUP_IDS.reduce((s, id) => s + share(OFFICIAL.weights, id), 0);
    expect(sum).toBeCloseTo(1, 12);
  });

  it("normalises even when the basket doesn't sum to 100", () => {
    const half = Object.fromEntries(GROUP_IDS.map((id) => [id, (OFFICIAL.weights[id] ?? 0) / 2]));
    for (const id of GROUP_IDS) {
      expect(share(half, id)).toBeCloseTo(share(OFFICIAL.weights, id), 12);
    }
  });

  it("an all-zero draft yields zero shares instead of dividing by zero", () => {
    const zero = Object.fromEntries(GROUP_IDS.map((id) => [id, 0]));
    expect(total(zero)).toBe(0);
    expect(share(zero, GROUP_IDS[0]!)).toBe(0);
  });
});
