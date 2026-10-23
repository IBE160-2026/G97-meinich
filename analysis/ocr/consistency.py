# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Re-measure the spike's consistency baseline with step 1's reader (Story 2.3, SM-2).

The spike (`ocr_accuracy.py`, report `analysis/output/ocr-consistency.md`)
read 89 generated filings for 2021-2025 with Tesseract 5 and its own parser.
This reads the same filings again with step 1's `read_document`
(Tesseract 5.5, `nor` from `tessdata_best`) and reconciles each column with
step 1's own code (`write.document_outcome`, `reconcile.within_document_checks`
and `column_status`), under the bound in `ingest/config.toml`.

- The filings: the companies in `filing-eras.md` (as `ocr_accuracy.py` lists
  them) x the years 2021-2025 in each one's `-aar.json`. PDFs come from
  `analysis/.cache/ocr/` (gitignored) and are fetched, with
  `Accept: application/octet-stream`, only when missing. The spike's old
  Tesseract TSVs are never read.
- Nothing is stored in the database: the 89 filings are not on the
  allow-list, and their figures are not written anywhere. The output holds
  the checks and statuses only.
- No API comparison: there is no key-figures filing at hand for these
  columns, so each column's status is `column_status` with the API check
  `not_evaluable` (within-document checks c1-c5 only).

Writes `analysis/output/ocr-consistency-2026.json`, which
`pnpm analysis:sm2` (`scripts/ocr-sm2.ts`) turns into the report.

Run (host, from the repository root, after `docker build --tag peerless-ingest:local ingest`):
    uv run analysis/ocr/consistency.py
It runs itself inside the image with `--in-image`; that mode is not for
direct use.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CACHE = ROOT / ".cache" / "ocr"
OUTPUT = ROOT / "output"
OUT_FILE = OUTPUT / "ocr-consistency-2026.json"

KOPI = "https://data.brreg.no/regnskapsregisteret/regnskap/aarsregnskap/kopi"
USER_AGENT = "Peerless student project (IBE160, Hogskolen i Molde)"
YEARS = range(2021, 2026)
IMAGE = "peerless-ingest:local"  # step 1's image (ingest/Dockerfile)
TODO = "consistency_todo.json"


# --- Host ------------------------------------------------------------------------


def fetch(url: str, target: Path) -> bool:
    """The document at `url` into `target`, unless cached. The register
    refuses `Accept: application/pdf` (406); it serves octet-stream."""
    if target.exists():
        return target.stat().st_size > 0
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/octet-stream"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                target.write_bytes(response.read())
            time.sleep(0.2)
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


def companies_from_era_report() -> list[str]:
    """The spike's companies, exactly as `ocr_accuracy.py` reads them."""
    text = (OUTPUT / "filing-eras.md").read_text(encoding="utf-8")
    return sorted(set(re.findall(r"^\| \d{5} \| (\d{9}) \|", text, re.M)))


def filings() -> list[tuple[str, int]]:
    """(orgnr, year) for each spike company and each 2021-2025 year in its
    cached `-aar.json`, with the PDF in the cache."""
    out: list[tuple[str, int]] = []
    for orgnr in companies_from_era_report():
        years_file = CACHE / f"{orgnr}-aar.json"
        if not years_file.exists():
            raise SystemExit(f"{years_file} is missing: run analysis/ocr/era_screening.py first")
        years = set(json.loads(years_file.read_bytes() or b"[]"))
        for year in YEARS:
            if str(year) in years and fetch(f"{KOPI}/{orgnr}/{year}", CACHE / f"{orgnr}-{year}.pdf"):
                out.append((orgnr, year))
    return out


def host() -> None:
    todo = [{"orgnr": orgnr, "year": year} for orgnr, year in filings()]
    print(f"{len(todo)} filings; reading them in {IMAGE}", file=sys.stderr)
    (CACHE / TODO).write_text(json.dumps(todo) + "\n", encoding="utf-8", newline="\n")
    result = subprocess.run(
        [
            "docker", "run", "--rm",
            "--mount", f"type=bind,source={CACHE},target=/work,readonly",
            "--mount", f"type=bind,source={HERE},target=/scripts,readonly",
            "--entrypoint", "/app/.venv/bin/python",
            IMAGE, "/scripts/consistency.py", "--in-image", f"/work/{TODO}",
        ],
        check=True,
        stdout=subprocess.PIPE,
    )  # fmt: skip
    report = json.loads(result.stdout)
    report["generated"] = date.today().isoformat()
    OUT_FILE.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT_FILE.relative_to(ROOT.parent)}", file=sys.stderr)


# --- In the image --------------------------------------------------------------------


def in_image(todo_file: str) -> None:
    import os

    from peerless_ingest import config, documents, ocr, write
    from peerless_ingest.run import rules_of

    cfg = config.load_config(Path(os.environ.get("PEERLESS_INGEST_CONFIG", config.DEFAULT_CONFIG)))
    rules = rules_of(cfg)
    tesseract = subprocess.run(["tesseract", "--version"], capture_output=True, text=True, check=True)
    todo = json.loads(Path(todo_file).read_text(encoding="utf-8"))
    out: list[dict[str, object]] = []
    for index, item in enumerate(sorted(todo, key=lambda t: (t["orgnr"], t["year"])), start=1):
        orgnr, year = item["orgnr"], item["year"]
        pdf = (Path(todo_file).parent / f"{orgnr}-{year}.pdf").read_bytes()
        try:
            read = documents.read_document(pdf, rules.within_document_bound_kr)
        except ocr.OcrError as error:
            out.append({"orgnr": orgnr, "filing_year": year, "layout": None, "status": "not_extracted",
                        "refusal": f"ocr_error: {error}", "columns": []})  # fmt: skip
            continue
        # Step 1's own outcome, with no API filing: the status is decided by
        # the within-document checks alone.
        outcome = write.document_outcome(year, read, {}, rules)
        columns = []
        for c in outcome.columns:
            rec = c.reconciliation
            columns.append({
                "role": c.role, "stated_year": c.column.year,
                "c1": rec.c1, "c2": rec.c2, "c3": rec.c3, "c4": rec.c4, "c5": rec.c5,
                "column_status": rec.status,
            })  # fmt: skip
        out.append({"orgnr": orgnr, "filing_year": year, "layout": outcome.layout, "status": outcome.status,
                    "refusal": outcome.refusal, "columns": columns})  # fmt: skip
        print(f"{index}/{len(todo)} {orgnr}/{year}: {outcome.status}", file=sys.stderr, flush=True)
    json.dump(
        {
            "script": "analysis/ocr/consistency.py",
            "image": IMAGE,
            "tesseract": (tesseract.stdout or tesseract.stderr).splitlines()[0],
            "within_document_bound_kr": rules.within_document_bound_kr,
            "api_check": "not_evaluable",
            "filings": out,
        },
        sys.stdout,
    )


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--in-image":
        in_image(sys.argv[2])
    elif len(sys.argv) == 1:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
        host()
    else:
        raise SystemExit("usage: uv run analysis/ocr/consistency.py")
