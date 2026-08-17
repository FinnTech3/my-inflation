/**
 * Basket ⇄ URL. The whole scenario is eight weights, so it fits in a short
 * hash: `#b=17.5,52,3,14,3.5,5,3.5,1.5` in GROUP_IDS order. Any basket is
 * therefore a shareable link - tweak the sliders, copy the URL, send someone
 * your exact budget. Pure functions, no DOM, so the round-trip is unit-tested.
 *
 * Decoding is deliberately forgiving: a missing, short, or garbled payload
 * falls back to the official weights rather than throwing, because a bad link
 * should still open to a working calculator.
 */

import { GROUP_IDS } from "../lib/cpi.js";
import { OFFICIAL } from "../lib/baskets.js";
import type { Weights } from "../lib/baskets.js";

const KEY = "b";
/** Weights are shares in [0,100]; anything past this is a broken payload. */
const MAX_WEIGHT = 100;

export function officialWeights(): Record<string, number> {
  // A fresh mutable copy, so the app can edit without touching the constant.
  return Object.fromEntries(GROUP_IDS.map((id) => [id, OFFICIAL.weights[id] ?? 0]));
}

export function encode(weights: Weights): string {
  const parts = GROUP_IDS.map((id) => round2(weights[id] ?? 0));
  const params = new URLSearchParams();
  params.set(KEY, parts.join(","));
  return params.toString();
}

export function decode(hash: string): Record<string, number> {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const raw = params.get(KEY);
  if (raw === null) return officialWeights();

  const parts = raw.split(",");
  if (parts.length !== GROUP_IDS.length) return officialWeights();

  const out: Record<string, number> = {};
  for (let i = 0; i < GROUP_IDS.length; i++) {
    const id = GROUP_IDS[i];
    const n = Number(parts[i]);
    // Any invalid entry invalidates the whole payload - a partially parsed
    // basket is worse than a clean fallback to the official one.
    if (id === undefined || !Number.isFinite(n) || n < 0 || n > MAX_WEIGHT) {
      return officialWeights();
    }
    out[id] = n;
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
