/**
 * Headless report — the calculator's numbers without the browser, useful for
 * verifying the engine end to end and for capturing figures. Mirrors the
 * whose-inflation CLI: the reconstruction check comes first, on purpose,
 * because everything after it is the same arithmetic re-weighted.
 *
 *   npm run report            # latest month
 *   npm run report 2022-03    # a specific month (the shock is the fun one)
 */
import { comparableMonths, latestMonth } from "../lib/cpi.js";
import { ALL_BASKETS, HOUSEHOLDS, OFFICIAL, share } from "../lib/baskets.js";
import { CPI, GROUP_IDS } from "../lib/cpi.js";
import {
  basketInflation,
  compare,
  publishedRate,
  reconstructionError,
} from "../lib/inflation.js";

const pct = (x: number | null): string =>
  x === null ? "  n/a" : `${(x * 100).toFixed(2)}%`.padStart(6);

function main(): void {
  const month = process.argv[2] ?? latestMonth();
  if (!comparableMonths().includes(month)) {
    console.error(`no comparable reading for ${month}; latest is ${latestMonth()}`);
    process.exit(2);
  }

  console.log(`\n  MY-INFLATION — reading for ${month}\n`);

  // 1. The check the whole thing rests on.
  const err = reconstructionError(OFFICIAL.weights);
  console.log("  Reconstruction of the official index");
  console.log(`    months compared    ${err.monthsCompared}`);
  console.log(`    mean abs error     ${err.meanAbsolutePp.toFixed(3)} pp`);
  console.log(`    worst month        ${err.worstPp.toFixed(2)} pp (${err.worstMonth})`);
  console.log(`    good enough        ${err.goodEnough ? "yes (< 0.1pp)" : "NO"}\n`);

  // 2. Each basket against the headline this month.
  const headline = publishedRate(month);
  console.log(`  Published headline   ${pct(headline)}\n`);
  console.log("  This month, by basket");
  for (const basket of ALL_BASKETS) {
    const rate = basketInflation(basket.weights, month);
    const tag = basket.official ? "  (rebuilt)" : "";
    console.log(`    ${basket.name.padEnd(26)} ${pct(rate)}${tag}`);
  }

  // 3. The finding: households diverge most in a shock.
  const spreads = { calm: [] as number[], mid: [] as number[], hot: [] as number[] };
  for (const m of comparableMonths()) {
    const h = publishedRate(m);
    const rates = HOUSEHOLDS.map((b) => basketInflation(b.weights, m));
    if (h === null || rates.some((r) => r === null)) continue;
    const nums = rates as number[];
    const s = Math.max(...nums) - Math.min(...nums);
    if (h < 0.03) spreads.calm.push(s);
    else if (h < 0.05) spreads.mid.push(s);
    else spreads.hot.push(s);
  }
  const mean = (xs: number[]): string =>
    xs.length ? `${(xs.reduce((a, b) => a + b, 0) / xs.length * 100).toFixed(2)}pp` : "n/a";
  console.log("\n  Household spread by regime (max − min across the four)");
  console.log(`    headline below 3%     ${spreads.calm.length} months   ${mean(spreads.calm)}`);
  console.log(`    headline 3% to 5%     ${spreads.mid.length} months   ${mean(spreads.mid)}`);
  console.log(`    headline 5% and up    ${spreads.hot.length} months   ${mean(spreads.hot)}`);

  // 4. Cumulative drift of the households over the decade.
  console.log("\n  Cumulative cost vs the official basket, whole period");
  for (const basket of HOUSEHOLDS) {
    const d = compare(basket.weights, OFFICIAL.weights);
    const extra = (d.cumulativeRatio - 1) * 100;
    console.log(`    ${basket.name.padEnd(26)} ${extra >= 0 ? "+" : ""}${extra.toFixed(1)}%`);
  }

  // 5. What the official basket assumes, for reference.
  console.log("\n  Official basket shares (BLS relative importance, Dec 2023)");
  for (const id of GROUP_IDS) {
    console.log(`    ${(CPI.groups[id] ?? id).padEnd(28)} ${(share(OFFICIAL.weights, id) * 100).toFixed(1)}%`);
  }
  console.log("");
}

main();
