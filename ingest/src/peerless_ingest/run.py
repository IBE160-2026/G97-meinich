"""Batch step 1, register part: Enhetsregisteret data and key-figures API
filings for every company whose primary industry is declared in
seed/coverage.json, plus demo company C, stored as filed, in øre.

    python -m peerless_ingest           (inside the image: `pnpm ingest`)

Prints a summary per industry code. Fetches no document and runs no OCR;
stores no ratio, distribution or derived amount (AD-1, AD-15).
"""

from __future__ import annotations

import os
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import psycopg

from . import config as config_module
from . import fetch, parse, write


@dataclass
class CodeSummary:
    code: str
    companies: int = 0
    companies_with_filings: int = 0
    filings_written: int = 0


@dataclass
class Problem:
    orgnr: str
    what: str


@dataclass
class Summary:
    codes: dict[str, CodeSummary]
    demo_orgnr: str
    demo_navn: str | None = None
    demo_found: bool = False
    demo_filings_written: int = 0
    rejected: list[Problem] = field(default_factory=list)
    failed: list[Problem] = field(default_factory=list)

    def codes_returning_nothing(self) -> list[str]:
        return [code for code, summary in self.codes.items() if summary.companies == 0]

    def lines(self) -> list[str]:
        out = ["Step 1 summary (register data and key-figures API filings)"]
        for summary in self.codes.values():
            if summary.companies == 0:
                out.append(
                    f"  {summary.code}: the register returned nothing: no unit has it as naeringskode1"
                    " (an SN2007 code, or no such industry). Not covered."
                )
            else:
                out.append(
                    f"  {summary.code}: {summary.companies} companies, {summary.companies_with_filings} with filings,"
                    f" {summary.filings_written} filings written"
                )
        if self.demo_found:
            out.append(
                f"  demo company C {self.demo_orgnr} ({self.demo_navn}): {self.demo_filings_written} filings written"
            )
        else:
            out.append(f"  demo company C {self.demo_orgnr}: not found in Enhetsregisteret")
        for problem in self.rejected:
            out.append(f"  rejected filing, not written: {problem.orgnr} {problem.what}")
        for problem in self.failed:
            out.append(f"  failed write, rolled back: {problem.orgnr} {problem.what}")
        out.append("  Stored as filed: no ratio, distribution or derived amount was written.")
        return out


def _now() -> datetime:
    return datetime.now(UTC)


def _load_company(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    base_url: str,
    company: parse.Company,
    summary: Summary,
    now: Callable[[], datetime],
) -> int:
    """Writes the company and each of its filings. Returns filings written."""
    try:
        write.write_company(conn, company)
    except psycopg.Error as error:
        summary.failed.append(Problem(company.orgnr, f"company: {error.__class__.__name__}: {error}".strip()))
        return 0
    raw_filings = fetch.fetch_filings(transport, base_url, company.orgnr)
    read_at = now()
    written = 0
    for raw in raw_filings:
        try:
            filing = parse.parse_filing(raw, company.orgnr, read_at)
        except parse.RejectedFiling as rejected:
            summary.rejected.append(Problem(rejected.orgnr, f"field {rejected.field}: {rejected.reason}"))
            continue
        try:
            write.write_filing(conn, filing)
        except psycopg.Error as error:
            summary.failed.append(
                Problem(
                    filing.orgnr,
                    f"filing {filing.brreg_id} ({filing.regnskapstype} {filing.filing_year}):"
                    f" {error.__class__.__name__}: {str(error).strip()}",
                )
            )
            continue
        written += 1
    return written


def run(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    cfg: config_module.Config,
    codes: list[str],
    now: Callable[[], datetime] = _now,
    progress: Callable[[str], None] = lambda _message: None,
) -> Summary:
    summary = Summary(codes={code: CodeSummary(code) for code in codes}, demo_orgnr=cfg.demo_company_c.orgnr)

    # 1. The bulk download, filtered on the primary code while streaming.
    # Collected before any key-figures request, so the long download is not
    # held open across thousands of calls.
    bulk_read_at = now()
    selected: list[tuple[str, parse.Company]] = []
    for code, unit in parse.select_covered(fetch.iter_bulk_units(transport, cfg.base_url), codes):
        selected.append((code, parse.parse_company(unit, bulk_read_at)))
    progress(f"bulk download: {len(selected)} units with a covered primary code")

    # 2. Each covered company and its filings.
    for index, (code, company) in enumerate(selected, start=1):
        code_summary = summary.codes[code]
        code_summary.companies += 1
        written = _load_company(conn, transport, cfg.base_url, company, summary, now)
        code_summary.filings_written += written
        if written:
            code_summary.companies_with_filings += 1
        if index % 500 == 0:
            progress(f"{index} of {len(selected)} companies")

    # 3. Demo company C, by orgnr, whatever its industry.
    unit = fetch.fetch_unit(transport, cfg.base_url, cfg.demo_company_c.orgnr)
    if unit is not None:
        company = parse.parse_company(unit, now())
        summary.demo_found = True
        summary.demo_navn = company.navn
        summary.demo_filings_written = _load_company(conn, transport, cfg.base_url, company, summary, now)
    return summary


def main() -> int:
    config_path = Path(os.environ.get("PEERLESS_INGEST_CONFIG", config_module.DEFAULT_CONFIG))
    coverage_path = Path(os.environ.get("PEERLESS_COVERAGE", config_module.DEFAULT_COVERAGE))
    cfg = config_module.load_config(config_path)
    codes = config_module.load_coverage(coverage_path)
    transport = fetch.UrllibTransport(cfg.user_agent, cfg.request_pause_seconds)
    with write.connect(config_module.database_url()) as conn:
        summary = run(conn, transport, cfg, codes, progress=lambda message: print(message, file=sys.stderr, flush=True))
    for line in summary.lines():
        print(line)
    return 1 if summary.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
