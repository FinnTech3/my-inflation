/**
 * The one screen. Move eight sliders to your own budget and watch your
 * inflation rate pull away from the headline — the same reconstruction that
 * rebuilds the official number to within a tenth of a point, asked on behalf of
 * you instead of a statistical composite.
 *
 * All the economics live in ../lib (basketInflation, publishedHistory,
 * reconstructionError, compare). This file is inputs and presentation only. The
 * design language matches rent-or-buy deliberately: warm paper, a serif display
 * voice, one accent, honest charts — a portfolio that reads as one hand.
 */
import { useEffect, useMemo, useState } from "react";

import { CPI, GROUP_IDS, comparableMonths, latestMonth } from "../lib/cpi.js";
import { ALL_BASKETS, OFFICIAL, share, total } from "../lib/baskets.js";
import type { Basket, Weights } from "../lib/baskets.js";
import {
  basketHistory,
  basketInflation,
  compare,
  publishedHistory,
  publishedRate,
  reconstructionError,
} from "../lib/inflation.js";
import { decode, encode, officialWeights } from "./urlState.js";

// ─────────────────────────── helpers ──────────────────────────────────────

const pct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits)}%`;
const signedPp = (pp: number, digits = 1): string =>
  `${pp >= 0 ? "+" : "−"}${Math.abs(pp).toFixed(digits)}pp`;

/** Which preset (if any) the current weights match, within rounding. */
function matchingPreset(weights: Weights): Basket | null {
  for (const b of ALL_BASKETS) {
    if (GROUP_IDS.every((id) => Math.abs((weights[id] ?? 0) - (b.weights[id] ?? 0)) < 0.05)) {
      return b;
    }
  }
  return null;
}

// ─────────────────────────────── app ──────────────────────────────────────

const RECON = reconstructionError(OFFICIAL.weights);
const PUBLISHED = publishedHistory();
const LATEST = latestMonth();
const MONTHS = comparableMonths();

export function App(): JSX.Element {
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    typeof window === "undefined" ? officialWeights() : decode(window.location.hash),
  );

  useEffect(() => {
    const q = encode(weights);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${q}`);
  }, [weights]);

  const setWeight = (id: string, value: number): void =>
    setWeights((w) => ({ ...w, [id]: value }));

  const mine = useMemo(() => basketHistory(weights), [weights]);
  const preset = matchingPreset(weights);

  const myLatest = basketInflation(weights, LATEST);
  const headline = publishedRate(LATEST);
  const gapPp = myLatest !== null && headline !== null ? (myLatest - headline) * 100 : null;
  const drift = useMemo(() => compare(weights, OFFICIAL.weights), [weights]);

  return (
    <>
      <Tokens />
      <div className="mi-page">
        <div className="mi-shell">
          <header className="mi-header">
            <div className="mi-header-top">
              <h1 className="mi-wordmark">my&nbsp;inflation</h1>
              <div className="mi-header-actions">
                <CopyLink />
                <button className="mi-ghost-btn" onClick={() => setWeights(officialWeights())}>Reset</button>
              </div>
            </div>
            <p className="mi-tagline">
              The headline rate is an average of a basket nobody actually buys.
              Set the eight shares to your own budget and see the rate you’re
              really living — and how far it drifts from the number in the news.
            </p>
          </header>

          <div className="mi-grid">
            <BasketPanel weights={weights} setWeight={setWeight} />

            <main className="mi-answer">
              <PresetRow weights={weights} onPick={setWeights} activeName={preset?.name ?? null} />
              <Headline myLatest={myLatest} headline={headline} gapPp={gapPp} presetName={preset?.name ?? null} />
              <TimeChart mine={mine} />
              <DriftCard drift={drift} />
              <HonestNote />
            </main>
          </div>

          <footer className="mi-footer">
            The eight price series are the real published CPI components; the
            reconstruction rebuilds the official all-items rate to a mean error
            of {RECON.meanAbsolutePp.toFixed(3)}pp across {RECON.monthsCompared} months,
            which is the reason to trust everything after it. The weights are
            yours. Data: {CPI.provenance.monthsCovered}, US BLS CPI-U, baked in
            at build time — no network calls.
          </footer>
        </div>
      </div>
    </>
  );
}

// ───────────────────────────── basket panel ───────────────────────────────

function BasketPanel(props: {
  weights: Record<string, number>;
  setWeight: (id: string, value: number) => void;
}): JSX.Element {
  const { weights, setWeight } = props;
  const raw = total(weights);
  const off100 = Math.abs(raw - 100) > 0.5;

  return (
    <aside className="mi-inputs">
      <div className="mi-group-title">Your monthly budget, by share</div>
      <div className="mi-sliders">
        {GROUP_IDS.map((id) => (
          <SliderRow
            key={id}
            label={CPI.groups[id] ?? id}
            weight={weights[id] ?? 0}
            sharePct={share(weights, id) * 100}
            official={(OFFICIAL.weights[id] ?? 0)}
            onChange={(v) => setWeight(id, v)}
          />
        ))}
      </div>
      <div className={`mi-total ${off100 ? "mi-total-off" : ""}`}>
        <span>Weights total</span>
        <span>{raw.toFixed(0)}</span>
      </div>
      <p className="mi-total-note">
        Shares are normalised, so the total need not be exactly 100 — only the
        relative sizes matter. The grey number next to each is the official
        BLS share, for comparison.
      </p>
    </aside>
  );
}

function SliderRow(props: {
  label: string;
  weight: number;
  sharePct: number;
  official: number;
  onChange: (v: number) => void;
}): JSX.Element {
  const { label, weight, sharePct, official, onChange } = props;
  return (
    <div className="mi-field">
      <div className="mi-field-head">
        <span className="mi-field-label">{label}</span>
        <span className="mi-field-value">
          {sharePct.toFixed(1)}%
          <span className="mi-field-official"> vs {official.toFixed(1)}</span>
        </span>
      </div>
      <input
        className="mi-range"
        type="range"
        min={0}
        max={60}
        step={0.5}
        value={weight}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

// ───────────────────────────── presets ────────────────────────────────────

function PresetRow(props: {
  weights: Record<string, number>;
  activeName: string | null;
  onPick: (w: Record<string, number>) => void;
}): JSX.Element {
  return (
    <div className="mi-presets">
      <span className="mi-presets-label">Start from</span>
      <div className="mi-presets-chips">
        {ALL_BASKETS.map((b) => (
          <button
            key={b.name}
            className={`mi-chip ${props.activeName === b.name ? "mi-chip-on" : ""}`}
            title={b.rationale}
            onClick={() => props.onPick(Object.fromEntries(GROUP_IDS.map((id) => [id, b.weights[id] ?? 0])))}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── headline stat ──────────────────────────────

function Headline(props: {
  myLatest: number | null;
  headline: number | null;
  gapPp: number | null;
  presetName: string | null;
}): JSX.Element {
  const { myLatest, headline, gapPp, presetName } = props;
  const hotter = gapPp !== null && gapPp > 0.05;
  const cooler = gapPp !== null && gapPp < -0.05;
  const word = hotter ? "higher than" : cooler ? "lower than" : "about the same as";

  return (
    <section className="mi-verdict">
      <div className="mi-verdict-kicker">Your inflation · {LATEST}</div>
      <div className="mi-verdict-row">
        <div className="mi-verdict-word" style={{ color: hotter ? "var(--hot)" : cooler ? "var(--cool)" : "var(--ink)" }}>
          {myLatest !== null ? pct(myLatest, 1) : "—"}
        </div>
        <div className="mi-verdict-gap">
          {gapPp !== null ? (
            <>
              <b style={{ color: hotter ? "var(--hot)" : cooler ? "var(--cool)" : "var(--ink)" }}>{signedPp(gapPp)}</b>
              <span> {word} the headline</span>
            </>
          ) : null}
        </div>
      </div>
      <p className="mi-verdict-sentence">
        {presetName && presetName !== "official CPI-U"
          ? `The “${presetName}” basket `
          : "Your basket "}
        would have felt <b>{myLatest !== null ? pct(myLatest, 1) : "—"}</b> inflation
        this month, against the <b>{headline !== null ? pct(headline, 1) : "—"}</b> the
        news reported. Same prices, a different shopping list.
      </p>
      <div className="mi-verdict-stats">
        <Stat label="Your rate" value={myLatest !== null ? pct(myLatest, 1) : "—"} />
        <Stat label="Published headline" value={headline !== null ? pct(headline, 1) : "—"} />
        <Stat label="Gap this month" value={gapPp !== null ? signedPp(gapPp) : "—"} />
      </div>
    </section>
  );
}

function Stat(props: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="mi-stat-label">{props.label}</div>
      <div className="mi-stat-value">{props.value}</div>
    </div>
  );
}

// ───────────────────────────── time chart ─────────────────────────────────

const CW = 720;
const CH = 300;
const PAD = { top: 16, right: 16, bottom: 26, left: 40 };

function TimeChart(props: { mine: { month: string; rate: number }[] }): JSX.Element {
  const mineByMonth = new Map(props.mine.map((r) => [r.month, r.rate]));
  const pubByMonth = new Map(PUBLISHED.map((r) => [r.month, r.rate]));
  const months = MONTHS.filter((m) => mineByMonth.has(m) && pubByMonth.has(m));

  const values = months.flatMap((m) => [mineByMonth.get(m)!, pubByMonth.get(m)!]);
  const yMax = Math.max(0.1, Math.ceil((Math.max(...values) * 100) / 3) * 3 / 100);
  const yMin = Math.min(0, Math.floor((Math.min(...values) * 100) / 3) * 3 / 100);

  const iw = CW - PAD.left - PAD.right;
  const ih = CH - PAD.top - PAD.bottom;
  const x = (i: number): number => PAD.left + (months.length <= 1 ? 0 : (i / (months.length - 1)) * iw);
  const y = (v: number): number => PAD.top + ih - ((v - yMin) / (yMax - yMin)) * ih;

  const line = (get: (m: string) => number): string =>
    months.map((m, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(get(m)).toFixed(1)}`).join(" ");
  const band =
    months.map((m, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(mineByMonth.get(m)!).toFixed(1)}`).join(" ") +
    " " +
    [...months].reverse().map((m) => `L${x(months.indexOf(m)).toFixed(1)},${y(pubByMonth.get(m)!).toFixed(1)}`).join(" ") +
    " Z";

  // Y gridlines every 3 points.
  const gridVals: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += 0.03) gridVals.push(Math.round(v * 1000) / 1000);
  // X ticks at each January.
  const yearTicks = months
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.endsWith("-01"));

  const lastMonth = months.at(-1)!;
  const myLast = mineByMonth.get(lastMonth)!;
  const pubLast = pubByMonth.get(lastMonth)!;

  return (
    <div className="mi-card">
      <div className="mi-card-title">Your basket against the headline, year on year</div>
      <div className="mi-card-sub">
        The shaded band is the gap between what you’d have felt and what was
        reported. Notice it: it’s thin in calm years and opens up in the
        2021–22 shock — the moment the one national number describes people
        least, and the moment it gets quoted hardest.
      </div>
      <svg className="mi-chart-svg" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="Year-on-year inflation: your basket versus the published CPI.">
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={CW - PAD.right} y1={y(v)} y2={y(v)} className={v === 0 ? "mi-axis-zero" : "mi-grid"} />
            <text x={PAD.left - 6} y={y(v) + 3} className="mi-axis-label" textAnchor="end">{(v * 100).toFixed(0)}%</text>
          </g>
        ))}
        {yearTicks.map(({ m, i }) => (
          <text key={m} x={x(i)} y={CH - 8} className="mi-axis-label" textAnchor="middle">{m.slice(0, 4)}</text>
        ))}
        <path d={band} className="mi-band" />
        <path d={line((m) => pubByMonth.get(m)!)} className="mi-line-pub" />
        <path d={line((m) => mineByMonth.get(m)!)} className="mi-line-mine" />
        <circle cx={x(months.length - 1)} cy={y(myLast)} r={3.5} className="mi-dot-mine" />
        <circle cx={x(months.length - 1)} cy={y(pubLast)} r={3} className="mi-dot-pub" />
      </svg>
      <div className="mi-legend">
        <span><i className="mi-sw-mine" />Your basket</span>
        <span><i className="mi-sw-pub" />Published CPI-U</span>
      </div>
    </div>
  );
}

// ───────────────────────────── drift card ─────────────────────────────────

function DriftCard(props: { drift: { cumulativeRatio: number; worstGapPp: number; worstMonth: string | null; meanGapPp: number } }): JSX.Element {
  const { drift } = props;
  const extra = (drift.cumulativeRatio - 1) * 100;
  return (
    <div className="mi-card">
      <div className="mi-card-title">Over the whole decade</div>
      <div className="mi-drift-stats">
        <Stat label="Cumulative vs official" value={`${extra >= 0 ? "+" : "−"}${Math.abs(extra).toFixed(1)}%`} />
        <Stat label="Average monthly gap" value={signedPp(drift.meanGapPp, 2)} />
        <Stat label="Widest gap" value={`${signedPp(drift.worstGapPp)}${drift.worstMonth ? ` · ${drift.worstMonth}` : ""}`} />
      </div>
      <p className="mi-drift-note">
        Averaged over ten years the households land within about a point of each
        other — on a long view the headline is a decent summary of most people.
        The disagreement isn’t persistent; it’s concentrated in the shock, which
        is exactly where the chart above pulls apart.
      </p>
    </div>
  );
}

// ───────────────────────────── honest note ────────────────────────────────

function HonestNote(): JSX.Element {
  return (
    <details className="mi-disclose">
      <summary>What this is, and what it isn’t</summary>
      <ul>
        <li>
          <b>The weights are your assumption, not a measurement.</b> The price
          data is the real, published CPI. The shares are yours to guess; the
          preset households are illustrative, built from documented spending
          patterns, not measured from your receipts.
        </li>
        <li>
          <b>Eight major groups, not the full detail.</b> Real gaps concentrate
          in specific items — petrol rather than “transport”, rent rather than
          “housing”. Eight groups is the level at which the reconstruction can
          be verified against the published number, so it’s where this stays
          honest rather than sharper-but-unchecked.
        </li>
        <li>
          <b>A weighted sum of group rates, not a chained index.</b> Over a
          twelve-month window these agree closely; over longer spans the chained
          calculation is the correct one. The size of that approximation is the{" "}
          {RECON.meanAbsolutePp.toFixed(3)}pp reconstruction error, measured, not
          hand-waved.
        </li>
        <li>
          <b>One year’s weights across the decade.</b> BLS re-estimates shares
          annually; this uses the December 2023 set throughout, which is most of
          why the rebuild drifts most in {RECON.worstMonth}.
        </li>
      </ul>
    </details>
  );
}

// ───────────────────────────── copy link ──────────────────────────────────

function CopyLink(): JSX.Element {
  const [done, setDone] = useState(false);
  return (
    <button
      className="mi-ghost-btn"
      onClick={() => {
        void navigator.clipboard?.writeText(window.location.href).then(
          () => { setDone(true); setTimeout(() => setDone(false), 1400); },
          () => {},
        );
      }}
    >
      {done ? "Copied ✓" : "Copy link"}
    </button>
  );
}

// ───────────────────────────── tokens ─────────────────────────────────────

function Tokens(): JSX.Element {
  return (
    <style>{`
      :root {
        --bg:#faf9f7; --panel:#ffffff; --panel-2:#f4f2ee; --line:#e7e3dd; --line-2:#d6d1c8;
        --ink:#1a1d1f; --text:#3c4043; --dim:#6b7075; --dim-2:#9a9ea3;
        --accent:#1f6f78; --accent-soft:rgba(31,111,120,0.14);
        --hot:#b5673f; --cool:#2f7d55;
        --serif: Georgia, 'Times New Roman', 'Iowan Old Style', serif;
        --sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme="light"]) {
          --bg:#14171a; --panel:#1b1f23; --panel-2:#20252a; --line:#2a2f34; --line-2:#39414a;
          --ink:#eef1f3; --text:#c3c8cc; --dim:#868d93; --dim-2:#5f676d;
          --accent:#4fb3bf; --accent-soft:rgba(79,179,191,0.16);
          --hot:#cc8a63; --cool:#5aa87a;
        }
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); }
      .mi-page { min-height: 100vh; background: var(--bg); color: var(--text);
        font-family: var(--sans); font-size: 14px; line-height: 1.5;
        font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
      .mi-shell { max-width: 1180px; margin: 0 auto; padding: 40px 24px 64px; }
      .mi-header { margin-bottom: 28px; }
      .mi-header-top { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .mi-header-actions { display: flex; gap: 8px; }
      .mi-ghost-btn { font: inherit; font-size: 12px; color: var(--accent); background: transparent;
        border: 1px solid var(--line-2); border-radius: 6px; padding: 5px 10px; cursor: pointer; }
      .mi-ghost-btn:hover { border-color: var(--accent); background: var(--accent-soft); }
      .mi-wordmark { font-family: var(--serif); font-weight: 700; color: var(--ink);
        font-size: 38px; letter-spacing: -0.01em; margin: 0 0 8px; }
      .mi-tagline { font-size: 16px; color: var(--dim); margin: 8px 0 0; max-width: 60ch; }

      .mi-grid { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 28px; align-items: start; }
      @media (max-width: 900px) { .mi-grid { grid-template-columns: minmax(0,1fr); } }

      /* basket panel */
      .mi-inputs { display: flex; flex-direction: column; gap: 14px;
        background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 18px; }
      .mi-group-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
        color: var(--dim); font-weight: 600; }
      .mi-sliders { display: flex; flex-direction: column; gap: 14px; }
      .mi-field { display: flex; flex-direction: column; gap: 5px; }
      .mi-field-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
      .mi-field-label { font-size: 13px; color: var(--text); }
      .mi-field-value { font-size: 13px; color: var(--ink); font-weight: 600; }
      .mi-field-official { color: var(--dim-2); font-weight: 400; font-size: 11px; }
      .mi-range { width: 100%; accent-color: var(--accent); }
      .mi-total { display: flex; justify-content: space-between; font-size: 12px; color: var(--dim);
        border-top: 1px solid var(--line); padding-top: 10px; }
      .mi-total-off span:last-child { color: var(--hot); font-weight: 600; }
      .mi-total-note { font-size: 11px; color: var(--dim-2); margin: 0; }

      /* answer column */
      .mi-answer { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
      .mi-presets { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .mi-presets-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); }
      .mi-presets-chips { display: flex; gap: 8px; flex-wrap: wrap; }
      .mi-chip { font: inherit; font-size: 12px; color: var(--text); background: var(--panel);
        border: 1px solid var(--line-2); border-radius: 999px; padding: 5px 12px; cursor: pointer; }
      .mi-chip:hover { border-color: var(--accent); color: var(--ink); }
      .mi-chip-on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: 600; }

      .mi-card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 20px; }
      .mi-card-title { font-family: var(--serif); font-size: 18px; color: var(--ink); margin: 0 0 4px; font-weight: 600; }
      .mi-card-sub { font-size: 13px; color: var(--dim); margin: 0 0 16px; max-width: 66ch; }

      .mi-verdict { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 24px; }
      .mi-verdict-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--dim); }
      .mi-verdict-row { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; margin-top: 6px; }
      .mi-verdict-word { font-family: var(--serif); font-weight: 700; font-size: 52px; line-height: 1; letter-spacing: -0.01em; }
      .mi-verdict-gap { font-size: 15px; color: var(--dim); }
      .mi-verdict-gap b { font-size: 18px; }
      .mi-verdict-sentence { font-size: 15px; color: var(--text); margin: 16px 0 20px; max-width: 64ch; }
      .mi-verdict-sentence b { color: var(--ink); }
      .mi-verdict-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; border-top: 1px solid var(--line); padding-top: 16px; }
      @media (max-width: 560px) { .mi-verdict-stats { grid-template-columns: repeat(3, 1fr); } }
      .mi-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); }
      .mi-stat-value { font-family: var(--serif); font-size: 22px; color: var(--ink); margin-top: 3px; }

      /* chart */
      .mi-chart-svg { width: 100%; height: auto; display: block; }
      .mi-grid { stroke: var(--line); stroke-width: 1; }
      .mi-axis-zero { stroke: var(--line-2); stroke-width: 1.4; }
      .mi-axis-label { fill: var(--dim); font-size: 11px; font-family: var(--sans); }
      .mi-band { fill: var(--accent-soft); stroke: none; }
      .mi-line-mine { fill: none; stroke: var(--accent); stroke-width: 2.2; stroke-linejoin: round; }
      .mi-line-pub { fill: none; stroke: var(--dim); stroke-width: 1.6; stroke-dasharray: 4 3; stroke-linejoin: round; }
      .mi-dot-mine { fill: var(--accent); }
      .mi-dot-pub { fill: var(--dim); }
      .mi-legend { display: flex; gap: 18px; margin-top: 10px; font-size: 12px; color: var(--text); }
      .mi-legend i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
      .mi-sw-mine { background: var(--accent); }
      .mi-sw-pub { background: var(--dim); }

      .mi-drift-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      @media (max-width: 560px) { .mi-drift-stats { grid-template-columns: 1fr; } }
      .mi-drift-note { font-size: 13px; color: var(--text); margin: 16px 0 0; padding-top: 14px; border-top: 1px solid var(--line); max-width: 66ch; }

      .mi-disclose { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px 20px; }
      .mi-disclose summary { cursor: pointer; font-size: 13px; color: var(--accent); font-weight: 600; }
      .mi-disclose ul { margin: 12px 0 2px; padding-left: 18px; color: var(--text); font-size: 13px; }
      .mi-disclose li { margin-bottom: 8px; }
      .mi-disclose b { color: var(--ink); }

      .mi-footer { margin-top: 40px; font-size: 12px; color: var(--dim-2); max-width: 76ch; }
    `}</style>
  );
}
