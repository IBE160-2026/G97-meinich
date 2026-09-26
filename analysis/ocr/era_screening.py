# /// script
# requires-python = ">=3.12"
# dependencies = ["pymupdf"]
# ///
"""Which filing era does each year belong to?

The filed documents come in two kinds:

- **generated**: filed electronically. The first pages are a Brreg-generated
  section in a fixed monospace layout ("ÅRSREGNSKAP FOR REGNSKAPSÅRET ... -
  GENERELL INFORMASJON"), identical for every company. This is the layout the
  extraction pipeline is calibrated for.
- **paper**: filed on paper. A scanned cover form ("VEDLEGG TIL ÅRSREGNSKAP")
  followed by the company's own accounts in whatever layout its accountant
  used. There is no fixed layout to calibrate against.

For a sample of companies from the covered industries, this script fetches the
filings around the transition, OCRs the top of page 1 with Tesseract (Norwegian
model, in Docker) and classifies each year. The answer decides how many years
of history the fixed-layout pipeline can reach without handling paper filings.

Run:  uv run analysis/ocr/era_screening.py
Needs: Docker running, and the image built from analysis/ocr/Dockerfile:
       docker build -t peerless-tesseract analysis/ocr
"""

from __future__ import annotations

import csv
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

import pymupdf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CACHE = ROOT / ".cache" / "ocr"
OUTPUT = ROOT / "output"

BASE = "https://data.brreg.no/regnskapsregisteret/regnskap/aarsregnskap/kopi"
USER_AGENT = "Peerless student project (IBE160, Hogskolen i Molde)"
PAUSE_SECONDS = 0.2

INDUSTRIES = ["62100", "69202"]
COMPANIES_PER_INDUSTRY = 15  # the screening sample is already random (seed 160)
YEARS = list(range(2011, 2017))  # the register serves at most 15 years; 2011 is the earliest
RENDER_DPI = 150
TOP_FRACTION = 0.3  # page 1's heading sits in the top third


def fetch(url: str, target: Path) -> bool:
    """Download once; the cache means a rerun costs no API calls."""
    if target.exists():
        return target.stat().st_size > 0
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                target.write_bytes(response.read())
            time.sleep(PAUSE_SECONDS)
            return True
        except urllib.error.HTTPError as error:
            if error.code == 404:
                target.write_bytes(b"")
                return False
            if attempt < 3:
                time.sleep(2**attempt)
                continue
            raise
    return False


def years_available(orgnr: str) -> list[str]:
    target = CACHE / f"{orgnr}-aar.json"
    if not target.exists():
        fetch(f"{BASE}/{orgnr}/aar", target)
    raw = target.read_bytes()
    return sorted(json.loads(raw)) if raw else []


def render_top_of_first_page(pdf: Path) -> Path:
    png = pdf.with_suffix(".p1top.png")
    if not png.exists():
        doc = pymupdf.open(pdf)
        page = doc[0]
        clip = pymupdf.Rect(0, 0, page.rect.width, page.rect.height * TOP_FRACTION)
        page.get_pixmap(dpi=RENDER_DPI, clip=clip).save(png)
    return png


def ocr_batch(pngs: list[Path]) -> None:
    """One container run for the whole batch; starting Docker per page is slow."""
    todo = [p for p in pngs if not p.with_suffix(".txt").exists()]
    if not todo:
        return
    names = " ".join(p.name for p in todo)
    script = f'for f in {names}; do tesseract "$f" "${{f%.png}}" -l nor --psm 6 >/dev/null 2>&1; done'
    subprocess.run(
        ["docker", "run", "--rm", "-v", f"{CACHE}:/work", "--entrypoint", "sh",
         "peerless-tesseract", "-c", script],
        check=True,
    )


def classify(text: str) -> str:
    t = text.upper()
    # The paper cover form also says "regnskapsåret" ("endringer dette
    # regnskapsåret"), so only the generated section's own heading counts.
    if "GENERELL INFORMASJON" in t:
        return "generated"
    if "VEDLEGG TIL" in t:
        return "paper"
    return "unknown"


def sample_companies() -> list[tuple[str, str, str]]:
    out = []
    for code in INDUSTRIES:
        path = OUTPUT / f"sample-accounts-{code}.csv"
        with open(path, encoding="utf-8-sig") as f:
            rows = [r for r in csv.DictReader(f, delimiter=";") if r["har_regnskap"] == "True"]
        out += [(code, r["orgnr"], r["navn"]) for r in rows[:COMPANIES_PER_INDUSTRY]]
    return out


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    CACHE.mkdir(parents=True, exist_ok=True)
    companies = sample_companies()

    targets: list[tuple[str, str, str, str, Path]] = []
    for code, orgnr, name in companies:
        available = set(years_available(orgnr))
        for year in YEARS:
            if str(year) not in available:
                continue
            pdf = CACHE / f"{orgnr}-{year}.pdf"
            if fetch(f"{BASE}/{orgnr}/{year}", pdf):
                targets.append((code, orgnr, name, str(year), pdf))
    print(f"{len(targets)} filings across {len(companies)} companies")

    pngs = [render_top_of_first_page(t[4]) for t in targets]
    ocr_batch(pngs)

    results = []
    for (code, orgnr, name, year, pdf), png in zip(targets, pngs):
        txt = png.with_suffix(".txt")
        text = txt.read_text(encoding="utf-8", errors="replace") if txt.exists() else ""
        results.append({"industry": code, "orgnr": orgnr, "name": name, "year": int(year),
                        "era": classify(text)})

    write_report(companies, results)


def write_report(companies, results) -> None:
    by_year: dict[int, Counter] = {y: Counter() for y in YEARS}
    for r in results:
        by_year[r["year"]][r["era"]] += 1

    first_generated: dict[str, int | None] = {}
    last_paper: dict[str, int | None] = {}
    for _, orgnr, _ in companies:
        mine = [r for r in results if r["orgnr"] == orgnr]
        gen = [r["year"] for r in mine if r["era"] == "generated"]
        pap = [r["year"] for r in mine if r["era"] == "paper"]
        first_generated[orgnr] = min(gen) if gen else None
        last_paper[orgnr] = max(pap) if pap else None
    mixed = [o for o in first_generated
             if first_generated[o] and last_paper[o] and last_paper[o] > first_generated[o]]
    transitions = Counter(v for v in first_generated.values() if v)

    lines = [
        "# Filing eras — paper versus generated",
        "",
        f"Generated {date.today().isoformat()} by `analysis/ocr/era_screening.py`. "
        f"{len(companies)} companies ({COMPANIES_PER_INDUSTRY} each from "
        f"{', '.join(INDUSTRIES)}, taken in order from the screening sample), filings "
        f"{YEARS[0]}–{YEARS[-1]}, top of page 1 OCR'd with Tesseract 5 (Norwegian model).",
        "",
        "## By year",
        "",
        "| Year | Generated | Paper | Unknown |",
        "|---|---|---|---|",
    ]
    for y in YEARS:
        c = by_year[y]
        lines.append(f"| {y} | {c['generated']} | {c['paper']} | {c['unknown']} |")
    lines += [
        "",
        "## First generated filing per company",
        "",
        "| First generated year | Companies |",
        "|---|---|",
    ]
    for y, n in sorted(transitions.items()):
        lines.append(f"| {y} | {n} |")
    no_generated = sum(1 for v in first_generated.values() if v is None)
    lines += [
        f"| none in window | {no_generated} |",
        "",
        f"Companies that went back to paper after a generated filing: {len(mixed)}.",
        "",
        "## Per filing",
        "",
        "| Industry | Orgnr | Year | Era |",
        "|---|---|---|---|",
    ]
    for r in sorted(results, key=lambda r: (r["industry"], r["orgnr"], r["year"])):
        lines.append(f"| {r['industry']} | {r['orgnr']} | {r['year']} | {r['era']} |")
    out = OUTPUT / "filing-eras.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Report written to {out.relative_to(ROOT.parent)}")
    for y in YEARS:
        print(y, dict(by_year[y]))
    print("first generated:", dict(sorted(transitions.items())), "none:", no_generated)


if __name__ == "__main__":
    main()
