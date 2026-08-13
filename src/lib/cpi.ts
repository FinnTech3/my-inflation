/**
 * CPI index levels, and the year-on-year arithmetic that turns them into a
 * rate. Ported from the Python that this tool's data comes from — see the
 * whose-inflation analysis — with the same two rules that keep the numbers
 * honest.
 *
 * A price index is not a price. It starts at 100 in some reference period and
 * moves with the cost of a fixed basket, so a single level means nothing; only
 * the ratio between two dates does. Everything here works in ratios and never
 * subtracts one level from another.
 *
 * **Year-on-year, never month-on-month.** The published index is not
 * seasonally adjusted, so comparing consecutive months mostly measures the
 * seasons — heating in January, airfares in July — rather than inflation.
 * Every rate here is against the same month a year earlier.
 *
 * The data is baked into the bundle at build time (see scripts/build_data.py),
 * so this module never touches the network and the results reproduce exactly.
 */

import payload from "../data/cpi.json";

/** A year and month, e.g. "2024-03". The keys of the baked payload. */
export type MonthKey = string;

export interface Cpi {
  /** Series id of the published all-items index ("what the news reports"). */
  readonly allItems: string;
  /** The eight major-group series ids, mapped to readable names. */
  readonly groups: Readonly<Record<string, string>>;
  /** Every month covered, ascending. */
  readonly months: readonly MonthKey[];
  /** series id → level per month, aligned to `months` (null where missing). */
  readonly levels: Readonly<Record<string, readonly (number | null)[]>>;
  readonly source: string;
  readonly provenance: {
    readonly monthsCovered: string;
    readonly unavailableDropped: number;
    readonly annualRowsDropped: number;
  };
}

export const CPI: Cpi = payload as Cpi;

/** The ordered list of the eight group series ids. */
export const GROUP_IDS: readonly string[] = Object.keys(CPI.groups);

/** Shift a month key back one year: "2024-03" → "2023-03". */
export function aYearEarlier(month: MonthKey): MonthKey {
  const [y, m] = month.split("-");
  return `${Number(y) - 1}-${m}`;
}

/** Index of a month key, or -1. Built once for O(1) lookups. */
const monthIndex: ReadonlyMap<MonthKey, number> = new Map(
  CPI.months.map((m, i) => [m, i]),
);

/** The index level of one series in one month, or null if unavailable. */
export function level(seriesId: string, month: MonthKey): number | null {
  const i = monthIndex.get(month);
  if (i === undefined) return null;
  const series = CPI.levels[seriesId];
  if (series === undefined) return null;
  return series[i] ?? null;
}

/**
 * Year-on-year change of one series in one month, as a fraction (0.03 = 3%),
 * or null if either endpoint is missing. Same month a year earlier,
 * deliberately — see the module note on seasonality.
 */
export function yearOnYear(seriesId: string, month: MonthKey): number | null {
  const now = level(seriesId, month);
  const then = level(seriesId, aYearEarlier(month));
  if (now === null || then === null || then === 0) return null;
  return now / then - 1;
}

/** The months for which a year-on-year rate can be computed at all (i.e. the
 *  months whose year-earlier counterpart exists in the data). Ascending. */
export function comparableMonths(): MonthKey[] {
  return CPI.months.filter((m) => monthIndex.has(aYearEarlier(m)));
}

/** The most recent comparable month — the "latest reading" the UI leads with. */
export function latestMonth(): MonthKey {
  const comparable = comparableMonths();
  const last = comparable[comparable.length - 1];
  if (last === undefined) throw new Error("no comparable months in CPI data");
  return last;
}
