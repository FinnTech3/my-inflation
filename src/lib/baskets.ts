/**
 * Whose shopping the index is actually measuring.
 *
 * The CPI is a weighted average, and the weights are the whole argument. BLS
 * surveys what households spend and sets each group's share accordingly, so the
 * headline number describes a statistical composite: a household that allocates
 * ~45% of its budget to housing, ~17% to transport, ~8% to medical care, all at
 * once. Almost nobody spends like that.
 *
 * A basket re-weights the same eight official price series. Nothing about the
 * underlying prices changes — only whose budget is being weighted. That is the
 * point: the divergence is not a different measurement, it is the same
 * measurement asked on behalf of someone else.
 *
 * The official weights are sourced and exact (BLS relative importance, December
 * 2023). The household variants are illustrative — built by shifting shares in
 * the directions the Consumer Expenditure Survey documents, and labelled as
 * assumptions rather than dressed up as statistics. This mirrors the
 * whose-inflation analysis exactly; the browser tool just lets you edit them.
 */

import { GROUP_IDS } from "./cpi.js";

/** Weights over the eight group series ids. Need not sum to 100 — `share`
 *  normalises — so a half-finished edit still computes something sensible. */
export type Weights = Readonly<Record<string, number>>;

export interface Basket {
  readonly name: string;
  /** Why this basket looks the way it does. Shown in the UI, because a weight
   *  without a stated reason is just a number somebody picked. */
  readonly rationale: string;
  readonly weights: Weights;
  /** True only for the official BLS relative importances. */
  readonly official?: boolean;
}

/** Sum of a basket's raw weights. */
export function total(weights: Weights): number {
  return GROUP_IDS.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
}

/** Normalised share of one group, so baskets that don't sum to 100 still work.
 *  Returns 0 if the basket sums to nothing (an all-zero draft). */
export function share(weights: Weights, groupId: string): number {
  const t = total(weights);
  if (t <= 0) return 0;
  return (weights[groupId] ?? 0) / t;
}

// BLS relative importance of the eight major groups, CPI-U, US city average,
// December 2023. The real weights behind the real number.
export const OFFICIAL: Basket = {
  name: "official CPI-U",
  rationale: "BLS relative importance, December 2023. The published number.",
  official: true,
  weights: {
    CUUR0000SAF: 14.263,
    CUUR0000SAH: 44.998,
    CUUR0000SAA: 2.512,
    CUUR0000SAT: 16.686,
    CUUR0000SAM: 8.058,
    CUUR0000SAR: 5.294,
    CUUR0000SAE: 5.759,
    CUUR0000SAG: 2.43,
  },
};

const RENTER: Basket = {
  name: "renter, early career",
  rationale:
    "Rent takes a larger bite than average — no mortgage fixed years ago, " +
    "and no house whose imputed rent counts as housing without being paid. " +
    "Little on medical care; more of what's left on food.",
  weights: {
    CUUR0000SAF: 17.5,
    CUUR0000SAH: 52.0,
    CUUR0000SAA: 3.0,
    CUUR0000SAT: 14.0,
    CUUR0000SAM: 3.5,
    CUUR0000SAR: 5.0,
    CUUR0000SAE: 3.5,
    CUUR0000SAG: 1.5,
  },
};

const RETIRED: Basket = {
  name: "retired, owns outright",
  rationale:
    "The mortgage is gone, so housing falls sharply as a share. Medical care " +
    "rises to roughly double the average — the pattern BLS's experimental " +
    "elderly index (CPI-E) is built to capture.",
  weights: {
    CUUR0000SAF: 15.0,
    CUUR0000SAH: 36.0,
    CUUR0000SAA: 2.0,
    CUUR0000SAT: 13.0,
    CUUR0000SAM: 17.0,
    CUUR0000SAR: 6.5,
    CUUR0000SAE: 4.0,
    CUUR0000SAG: 6.5,
  },
};

const COMMUTER: Basket = {
  name: "car-dependent commuter",
  rationale:
    "Two cars, a long drive, fuel bought weekly. Transport takes close to a " +
    "third of the budget, which makes this basket a leveraged bet on the oil " +
    "price whether the household thinks of it that way or not.",
  weights: {
    CUUR0000SAF: 14.0,
    CUUR0000SAH: 36.0,
    CUUR0000SAA: 2.5,
    CUUR0000SAT: 30.0,
    CUUR0000SAM: 7.0,
    CUUR0000SAR: 5.0,
    CUUR0000SAE: 4.0,
    CUUR0000SAG: 1.5,
  },
};

const STUDENT: Basket = {
  name: "student",
  rationale:
    "Tuition and a phone contract dominate a category the average household " +
    "barely notices. Shared housing, almost no car, and medical care that is " +
    "someone else's problem for now.",
  weights: {
    CUUR0000SAF: 18.0,
    CUUR0000SAH: 42.0,
    CUUR0000SAA: 4.0,
    CUUR0000SAT: 10.0,
    CUUR0000SAM: 2.5,
    CUUR0000SAR: 7.0,
    CUUR0000SAE: 14.0,
    CUUR0000SAG: 2.5,
  },
};

/** The illustrative household baskets, in the order the UI offers them. */
export const HOUSEHOLDS: readonly Basket[] = [RENTER, RETIRED, COMMUTER, STUDENT];

/** Official first, then the households — everything the presets row shows. */
export const ALL_BASKETS: readonly Basket[] = [OFFICIAL, ...HOUSEHOLDS];
