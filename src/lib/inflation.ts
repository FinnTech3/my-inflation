/**
 * Rebuilding the headline number, then asking it a different question.
 *
 * Two jobs, and the order matters.
 *
 * **First, reproduce the official figure.** Weight the eight published group
 * rates by the published relative importances and check the result against the
 * published all-items rate. If that reconstruction is right, every re-weighting
 * after it inherits the credibility; if it is wrong, nothing downstream is
 * worth reading. It reproduces to a mean absolute error of about 0.08
 * percentage points across the decade — see `reconstructionError`, and the
 * test that pins it.
 *
 * **Then, change only the weights.** Same eight price series, same arithmetic,
 * a different budget. Whatever moves is attributable to whose spending is being
 * described, because nothing else was touched.
 */

import { CPI, GROUP_IDS, comparableMonths, yearOnYear } from "./cpi.js";
import type { MonthKey } from "./cpi.js";
import { share } from "./baskets.js";
import type { Weights } from "./baskets.js";

/** One basket's year-on-year inflation in one month. */
export interface Reading {
  readonly month: MonthKey;
  readonly rate: number;
}

/**
 * Year-on-year inflation for one basket in one month: a weighted sum of the
 * groups' own year-on-year rates. This approximates a properly chained index,
 * and closely, because the weights barely move inside a twelve-month window;
 * over longer spans the two diverge and the chained calculation is correct. The
 * size of the approximation is exactly what `reconstructionError` measures.
 *
 * Returns null if any group is missing either endpoint, rather than silently
 * averaging over a smaller basket and calling it the same thing.
 */
export function basketInflation(weights: Weights, month: MonthKey): number | null {
  let totalRate = 0;
  for (const groupId of GROUP_IDS) {
    const rate = yearOnYear(groupId, month);
    if (rate === null) return null;
    totalRate += share(weights, groupId) * rate;
  }
  return totalRate;
}

/** Every month where the basket can be computed in full, ascending. */
export function basketHistory(weights: Weights): Reading[] {
  const out: Reading[] = [];
  for (const month of comparableMonths()) {
    const rate = basketInflation(weights, month);
    if (rate !== null) out.push({ month, rate });
  }
  return out;
}

/** The published all-items rate in one month, straight from the index. */
export function publishedRate(month: MonthKey): number | null {
  return yearOnYear(CPI.allItems, month);
}

/** The published all-items history, ascending — the line every basket is
 *  measured against. */
export function publishedHistory(): Reading[] {
  const out: Reading[] = [];
  for (const month of comparableMonths()) {
    const rate = publishedRate(month);
    if (rate !== null) out.push({ month, rate });
  }
  return out;
}

/** How closely a rebuilt index tracks the published one. */
export interface ReconstructionError {
  readonly monthsCompared: number;
  readonly meanAbsolutePp: number;
  readonly worstPp: number;
  readonly worstMonth: MonthKey | null;
  /** Within a tenth of a point on average — smaller than the precision BLS
   *  publishes the headline to, so a fair bar for "the machinery works". */
  readonly goodEnough: boolean;
}

/**
 * Compare a rebuilt all-items rate (using `weights`) against the published one.
 * The single check the whole tool rests on: run it with the official weights
 * before believing any household comparison, because they are the same
 * arithmetic with one table changed.
 */
export function reconstructionError(weights: Weights): ReconstructionError {
  let count = 0;
  let sumAbs = 0;
  let worstPp = 0;
  let worstMonth: MonthKey | null = null;

  for (const month of comparableMonths()) {
    const official = publishedRate(month);
    const rebuilt = basketInflation(weights, month);
    if (official === null || rebuilt === null) continue;
    const errPp = Math.abs(rebuilt - official) * 100;
    count++;
    sumAbs += errPp;
    if (errPp > worstPp) {
      worstPp = errPp;
      worstMonth = month;
    }
  }

  const meanAbsolutePp = count > 0 ? sumAbs / count : 0;
  return {
    monthsCompared: count,
    meanAbsolutePp,
    worstPp,
    worstMonth,
    goodEnough: meanAbsolutePp < 0.1,
  };
}

/** How far a basket drifts from a reference, and when. */
export interface Divergence {
  readonly months: number;
  readonly meanGapPp: number;
  readonly worstGapPp: number;
  readonly worstMonth: MonthKey | null;
  /** Price level of the basket relative to the reference after compounding
   *  each December reading — the cumulative "extra cost" over the period. */
  readonly cumulativeRatio: number;
}

/**
 * Measure one basket against a reference over the full shared history.
 *
 * The cumulative ratio compounds each side's own December reading only. A
 * year-on-year rate already covers twelve months; compounding all twelve
 * monthly readings would count every price change a dozen times.
 */
export function compare(weights: Weights, referenceWeights: Weights): Divergence {
  const mine = new Map(basketHistory(weights).map((r) => [r.month, r.rate]));
  const theirs = new Map(
    basketHistory(referenceWeights).map((r) => [r.month, r.rate]),
  );
  const shared = [...mine.keys()].filter((m) => theirs.has(m)).sort();
  if (shared.length === 0) {
    return { months: 0, meanGapPp: 0, worstGapPp: 0, worstMonth: null, cumulativeRatio: 1 };
  }

  let sumGap = 0;
  let worstGapPp = 0;
  let worstAbs = -1;
  let worstMonth: MonthKey | null = null;
  for (const month of shared) {
    const gapPp = ((mine.get(month) ?? 0) - (theirs.get(month) ?? 0)) * 100;
    sumGap += gapPp;
    if (Math.abs(gapPp) > worstAbs) {
      worstAbs = Math.abs(gapPp);
      worstGapPp = gapPp;
      worstMonth = month;
    }
  }

  let mineLevel = 1;
  let theirsLevel = 1;
  for (const month of shared) {
    if (month.endsWith("-12")) {
      mineLevel *= 1 + (mine.get(month) ?? 0);
      theirsLevel *= 1 + (theirs.get(month) ?? 0);
    }
  }

  return {
    months: shared.length,
    meanGapPp: sumGap / shared.length,
    worstGapPp,
    worstMonth,
    cumulativeRatio: theirsLevel !== 0 ? mineLevel / theirsLevel : 1,
  };
}
