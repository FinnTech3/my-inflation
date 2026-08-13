import { describe, expect, it } from "vitest";
import { comparableMonths } from "../src/lib/cpi.js";
import { HOUSEHOLDS, OFFICIAL } from "../src/lib/baskets.js";
import { basketInflation, publishedRate } from "../src/lib/inflation.js";

/**
 * The finding, guarded. whose-inflation's result is that households don't live
 * at persistently different rates — they diverge in a shock, roughly three
 * times as much when headline inflation is high as when it is calm. This test
 * reproduces that ordering, and in doing so guards the one bug that would make
 * the whole tool say nothing: the baskets quietly becoming identical. Every
 * other test would still pass if they did; this one would not.
 */

/** Max − min household rate in a month: how far apart real budgets land. */
function spread(month: string): number | null {
  const rates = HOUSEHOLDS.map((b) => basketInflation(b.weights, month));
  if (rates.some((r) => r === null)) return null;
  const nums = rates as number[];
  return Math.max(...nums) - Math.min(...nums);
}

function meanSpreadWhere(pred: (headline: number) => boolean): number {
  const spreads: number[] = [];
  for (const month of comparableMonths()) {
    const headline = publishedRate(month);
    const s = spread(month);
    if (headline === null || s === null) continue;
    if (pred(headline)) spreads.push(s);
  }
  return spreads.reduce((a, b) => a + b, 0) / spreads.length;
}

describe("household spread widens with inflation", () => {
  const calm = meanSpreadWhere((h) => h < 0.03);
  const hot = meanSpreadWhere((h) => h >= 0.05);

  it("is much wider in a shock than in calm times", () => {
    expect(hot).toBeGreaterThan(calm);
    // The headline is least representative exactly when it's quoted hardest.
    // A factor of two is a conservative floor for the ~3x whose-inflation found.
    expect(hot).toBeGreaterThan(calm * 2);
  });

  it("the baskets are genuinely different, not a degenerate range", () => {
    // If the presets ever collapsed to identical weights, every spread would be
    // zero and the tool would be inert. Pin a real, positive spread in the
    // shock month where the commuter and student pull hardest apart.
    const shock = spread("2022-03");
    expect(shock).not.toBeNull();
    expect(shock as number).toBeGreaterThan(0.02); // > 2 percentage points
  });
});

describe("the households straddle the official line", () => {
  it("at least one runs hotter and one cooler than the headline in the shock", () => {
    const headline = basketInflation(OFFICIAL.weights, "2022-03") as number;
    const rates = HOUSEHOLDS.map((b) => basketInflation(b.weights, "2022-03") as number);
    expect(Math.max(...rates)).toBeGreaterThan(headline);
    expect(Math.min(...rates)).toBeLessThan(headline);
  });
});
