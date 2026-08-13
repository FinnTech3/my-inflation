import { describe, expect, it } from "vitest";
import { GROUP_IDS } from "../src/lib/cpi.js";
import { OFFICIAL } from "../src/lib/baskets.js";
import { decode, encode, officialWeights } from "../src/app/urlState.js";

describe("basket ⇄ URL round-trip", () => {
  it("recovers a custom basket through encode → decode", () => {
    const basket: Record<string, number> = {
      CUUR0000SAF: 17.5, CUUR0000SAH: 52, CUUR0000SAA: 3, CUUR0000SAT: 14,
      CUUR0000SAM: 3.5, CUUR0000SAR: 5, CUUR0000SAE: 3.5, CUUR0000SAG: 1.5,
    };
    const back = decode(`#${encode(basket)}`);
    for (const id of GROUP_IDS) {
      expect(back[id]).toBeCloseTo(basket[id]!, 2);
    }
  });

  it("tolerates a leading hash or a bare query", () => {
    const q = encode(officialWeights());
    expect(decode(q)).toEqual(decode(`#${q}`));
  });

  it("rounds to two decimals but keeps the basket faithful", () => {
    const basket = Object.fromEntries(GROUP_IDS.map((id, i) => [id, 10 + i * 1.2345]));
    const back = decode(`#${encode(basket)}`);
    for (const id of GROUP_IDS) {
      expect(back[id]).toBeCloseTo(basket[id]!, 1);
    }
  });
});

describe("decode falls back to the official basket on bad input", () => {
  it("empty hash → official", () => {
    expect(decode("")).toEqual(officialWeights());
    expect(decode("#")).toEqual(officialWeights());
  });

  it("wrong number of entries → official", () => {
    expect(decode("#b=1,2,3")).toEqual(officialWeights());
  });

  it("a non-numeric or out-of-range entry invalidates the whole payload", () => {
    expect(decode("#b=17,52,3,x,3,5,3,1")).toEqual(officialWeights());
    expect(decode("#b=17,52,3,-4,3,5,3,1")).toEqual(officialWeights());
    expect(decode("#b=17,52,3,9000,3,5,3,1")).toEqual(officialWeights());
  });

  it("officialWeights matches the OFFICIAL basket constant", () => {
    const w = officialWeights();
    for (const id of GROUP_IDS) expect(w[id]).toBeCloseTo(OFFICIAL.weights[id]!, 6);
  });
});
