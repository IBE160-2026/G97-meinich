# /// script
# requires-python = ">=3.12"
# dependencies = ["psycopg[binary]==3.3.6"]
# ///
"""Draw the OCR reference set (issue #14). The rules are in README.md.

Reads the population from the local database (the committed demo seed loaded),
as the read-only `reader` role, and asks the register's `/aar` list which years
each candidate has a filed document for. Writes drawn.json and downloads each
drawn PDF to .local/ocr-reference/ (gitignored). Same seed and same register
answers give the same draw.

Run from the repository root:  uv run analysis/ocr-reference/draw.py
"""

from __future__ import annotations

import json
import random
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import psycopg

SEED = 20261022
YEARS = (2021, 2022, 2023, 2024, 2025)
# Size bands on 2023 sumDriftsinntekter, in øre: [low, high).
BANDS = {
    "A": (1, 1_000_000 * 100),
    "B": (1_000_000 * 100, 10_000_000 * 100),
    "C": (10_000_000 * 100, 50_000_000 * 100),
    "D": (50_000_000 * 100, None),
}
BASE = "https://data.brreg.no/regnskapsregisteret/regnskap/aarsregnskap/kopi"
USER_AGENT = "Peerless student project (IBE160, Hogskolen i Molde)"
PAUSE_S = 0.5

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "analysis" / "ocr-reference" / "drawn.json"
PDF_DIR = ROOT / ".local" / "ocr-reference"


def reader_url() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("READER_DATABASE_URL="):
            return line.split("=", 1)[1].strip()
    sys.exit("READER_DATABASE_URL is not set in .env (run pnpm db:roles)")


def population() -> dict[str, list[str]]:
    """Orgnrs per band, sorted, excluding the demo document set."""
    excluded = set(json.loads((ROOT / "seed" / "document-run.json").read_text(encoding="utf-8")))
    query = """
        SELECT f.orgnr, k.sum_driftsinntekter_ore
        FROM register.filing f
        JOIN register.key_figures k USING (brreg_id)
        JOIN register.company c USING (orgnr)
        WHERE c.naeringskode1 = '62.100' AND f.regnskapstype = 'SELSKAP'
          AND f.filing_year = 2023 AND k.sum_driftsinntekter_ore > 0
        ORDER BY f.orgnr
    """
    bands: dict[str, list[str]] = {b: [] for b in BANDS}
    with psycopg.connect(reader_url()) as conn:
        rows = conn.execute(query).fetchall()
    for orgnr, revenue in rows:
        orgnr = orgnr.strip()
        if orgnr in excluded:
            continue
        for band, (low, high) in BANDS.items():
            if revenue >= low and (high is None or revenue < high):
                bands[band].append(orgnr)
    return bands


def get(url: str, accept: str) -> bytes | None:
    request = urllib.request.Request(url, headers={"Accept": accept, "User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                time.sleep(PAUSE_S)
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code in (404, 410):
                return None
            if error.code != 429 and error.code < 500:
                raise
        time.sleep(2**attempt)
    raise RuntimeError(f"no answer from {url}")


def filed_years(orgnr: str) -> set[int]:
    body = get(f"{BASE}/{orgnr}/aar", "application/json")
    return {int(year) for year in json.loads(body)} if body else set()


def main() -> None:
    bands = population()
    rng = random.Random(SEED)
    order = {band: rng.sample(orgnrs, len(orgnrs)) for band, orgnrs in bands.items()}
    used: set[str] = set()
    years_cache: dict[str, set[int]] = {}
    cells = []
    for year in YEARS:
        for band in BANDS:
            skipped = []
            for orgnr in order[band]:
                if orgnr in used:
                    continue
                if orgnr not in years_cache:
                    years_cache[orgnr] = filed_years(orgnr)
                if year in years_cache[orgnr]:
                    used.add(orgnr)
                    cells.append({"year": year, "band": band, "orgnr": orgnr, "skipped_no_document": skipped})
                    print(f"{year} {band}: {orgnr} (skipped {len(skipped)})")
                    break
                skipped.append(orgnr)
            else:
                sys.exit(f"cell {year} {band}: no candidate left")
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    for cell in cells:
        pdf = get(f"{BASE}/{cell['orgnr']}/{cell['year']}", "application/octet-stream")
        if pdf is None or not pdf.startswith(b"%PDF-"):
            sys.exit(f"{cell['orgnr']}/{cell['year']}: listed in /aar but no PDF")
        (PDF_DIR / f"{cell['orgnr']}-{cell['year']}.pdf").write_bytes(pdf)
    OUT.write_text(
        json.dumps(
            {
                "seed": SEED,
                "population": {band: len(orgnrs) for band, orgnrs in bands.items()},
                "cells": cells,
                "replacements": [],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.relative_to(ROOT)} and {len(cells)} PDFs to {PDF_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
