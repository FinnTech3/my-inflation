import { describe, expect, it } from "vitest";
import {
  CPI,
  GROUP_IDS,
  aYearEarlier,
  comparableMonths,
  latestMonth,
  level,
  yearOnYear,
} from "../src/lib/cpi.js";

const HOUSING = "CUUR0000SAH";

describe("the baked payload", () => {
  it("carries the nine series and a decade of months", () => {
    expect(GROUP_IDS).toHaveLength(8);
    expect(CPI.allItems).toBe("CUUR0000SA0");
    expect(CPI.months[0]).toBe("2017-01");
    expect(CPI.months.at(-1)).toBe("2026-06");
  });

  it("counts the BLS quirks it dropped rather than hiding them", () => {
    // The nine "-" values whose-inflation documents; zero M13 annual rows
    // because the raw pull was monthly only.
    expect(CPI.provenance.unavailableDropped).toBe(9);
    expect(CPI.provenance.annualRowsDropped).toBe(0);
  });
});

describe("aYearEarlier", () => {
  it("steps the year back and keeps the month", () => {
    expect(aYearEarlier("2024-03")).toBe("2023-03");
    expect(aYearEarlier("2020-12")).toBe("2019-12");
  });
});

describe("level", () => {
  it("returns the published index level for a real month", () => {
    // 2026-06 all-items index level, straight from the BLS pull.
    expect(level(CPI.allItems, "2026-06")).toBeCloseTo(333.952, 3);
  });

  it("is null off the edges of the data", () => {
    expect(level(CPI.allItems, "1999-01")).toBeNull();
    expect(level("NOT_A_SERIES", "2026-06")).toBeNull();
  });
});

describe("yearOnYear", () => {
  it("matches the published headline rate", () => {
    // BLS-published CPI-U all-items YoY: 3.53% in 2026-06, 8.54% in the shock.
    expect(yearOnYear(CPI.allItems, "2026-06")).toBeCloseTo(0.035314, 5);
    expect(yearOnYear(CPI.allItems, "2022-03")).toBeCloseTo(0.085425, 5);
    expect(yearOnYear(CPI.allItems, "2020-05")).toBeCloseTo(0.001179, 5);
  });

  it("matches a published group rate", () => {
    expect(yearOnYear(HOUSING, "2026-06")).toBeCloseTo(0.033361, 5);
  });

  it("is null when the year-earlier endpoint is missing", () => {
    // 2017-01 has no 2016-01 in the data.
    expect(yearOnYear(CPI.allItems, "2017-01")).toBeNull();
  });
});

describe("comparableMonths / latestMonth", () => {
  it("drops the first twelve months (no year-earlier baseline)", () => {
    const comparable = comparableMonths();
    expect(comparable[0]).toBe("2018-01");
    expect(comparable).toHaveLength(101);
  });

  it("leads with the most recent reading", () => {
    expect(latestMonth()).toBe("2026-06");
  });
});
