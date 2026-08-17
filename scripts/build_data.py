#!/usr/bin/env python3
"""Turn the raw BLS response into the compact payload the browser loads.

The site never calls BLS. The keyless BLS tier rate-limits hard: I hit the
daily cap while building the analysis this tool wraps, so depending on the API
at runtime would make the calculator unreproducible and dead on a bad day. The
raw response is committed under data/, and this script bakes it into a small
JSON the app imports directly, so the whole thing runs offline and the numbers
reproduce exactly.

Two traps in the BLS feed, handled the same way as the whose-inflation
analysis this borrows its data from:

  * a value can be the string "-", not null, not zero, a hyphen in a numeric
    field. Coerce it to 0 and you have an index level of zero, which reads as
    prices falling 100%% and recovering the next month. These are dropped and
    counted.
  * annual averages arrive tagged period "M13", sitting in the same array as
    the monthly rows. Treat one as a thirteenth month and every year is counted
    twice. These are dropped and counted.

Usage:  python3 scripts/build_data.py
Writes: src/data/cpi.json
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "cpi_u_groups_2017_2026.json"
OUT = ROOT / "src" / "data" / "cpi.json"

ANNUAL_AVERAGE = "M13"

# The eight CPI major groups (BLS series IDs) plus the published all-items
# index. Names mirror the whose-inflation analysis so the two stay in step.
GROUPS = {
    "CUUR0000SAF": "Food and beverages",
    "CUUR0000SAH": "Housing",
    "CUUR0000SAA": "Apparel",
    "CUUR0000SAT": "Transportation",
    "CUUR0000SAM": "Medical care",
    "CUUR0000SAR": "Recreation",
    "CUUR0000SAE": "Education and communication",
    "CUUR0000SAG": "Other goods and services",
}
ALL_ITEMS = "CUUR0000SA0"
WANTED = {ALL_ITEMS, *GROUPS}


def main() -> None:
    payload = json.loads(RAW.read_text())
    if payload.get("status") != "REQUEST_SUCCEEDED":
        raise SystemExit(f"BLS response not a success: {payload.get('status')}")

    # series_id -> { "YYYY-MM": level }
    levels: dict[str, dict[str, float]] = {}
    dropped_unavailable = 0
    dropped_annual = 0

    for block in payload.get("Results", {}).get("series", []):
        sid = block["seriesID"]
        if sid not in WANTED:
            continue
        by_month: dict[str, float] = {}
        for row in block.get("data", []):
            period = row.get("period", "")
            if period == ANNUAL_AVERAGE:
                dropped_annual += 1
                continue
            if not period.startswith("M"):
                continue
            try:
                value = float(row.get("value"))
            except (TypeError, ValueError):
                dropped_unavailable += 1
                continue
            by_month[f"{int(row['year'])}-{int(period[1:]):02d}"] = value
        levels[sid] = by_month

    missing = WANTED - set(levels)
    if missing:
        raise SystemExit(f"missing series in raw data: {sorted(missing)}")

    # The union of months across all series, sorted. Series arrays align to it,
    # with null where a series has no reading that month.
    months = sorted({m for s in levels.values() for m in s})
    series = {
        sid: [by_month.get(m) for m in months] for sid, by_month in levels.items()
    }

    out = {
        "source": (
            "US Bureau of Labor Statistics, CPI-U, US city average, not "
            "seasonally adjusted, public API v1. Relative importance weights "
            "from the CPI news release, December 2023."
        ),
        "allItems": ALL_ITEMS,
        "groups": GROUPS,
        "months": months,
        "levels": series,
        "provenance": {
            "monthsCovered": f"{months[0]} … {months[-1]}",
            "unavailableDropped": dropped_unavailable,
            "annualRowsDropped": dropped_annual,
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    kb = OUT.stat().st_size / 1024
    print(
        f"wrote {OUT.relative_to(ROOT)}, {len(months)} months, "
        f"{len(series)} series, {kb:.1f} KB "
        f"(dropped {dropped_unavailable} unavailable, {dropped_annual} annual)"
    )


if __name__ == "__main__":
    main()
