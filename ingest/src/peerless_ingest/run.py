"""Batch step 1: Enhetsregisteret data and key-figures API filings for every
company whose primary industry is declared in seed/coverage.json, plus demo
company C; and, only in documents mode, the filed 2021–2025 documents of the
listed companies, read by OCR (Story 2.1b). Everything is stored as filed,
in øre.

    python -m peerless_ingest                     (inside the image: `pnpm ingest`)
    python -m peerless_ingest --companies-only    (`pnpm ingest --companies-only`)
    python -m peerless_ingest --documents <file>  (`pnpm ingest --documents <file>`)

Prints a summary per industry code, or in documents mode per document status
and year. Stores no ratio, distribution or derived amount (AD-1, AD-15): the
only arithmetic is the two reconciliation rules (`reconcile`, Story 2.2) and
the × 100 to øre.

The normal run fetches no filed document (Meinich, 2026-10-20): reading
documents takes about 21 s each and runs only when asked for, with a list.

Documents mode (Story 2.1b) reads a JSON list of orgnrs and runs only the
document pass, for each listed orgnr that is a stored company with a covered
primary code. Any other listed orgnr is refused and reported, never fetched.
It fetches no bulk data and no key figures. For each year 2021–2025 in the
register's list of filed documents (`…/kopi/{orgnr}/aar`) that has no row
yet, it fetches the document by that year's path, reads it
(`documents.read_document`), reconciles it and commits the document and its
columns on their own. A rerun therefore skips every stored (orgnr, filing
year) and reads nothing twice; a refiled document is not picked up. A fetch,
OCR or write error costs only that document, or that company's documents.

Before that, for each listed company, every stored document that was read is
reconciled again from its stored figures under the configured rules (Story
2.2): no fetch and no OCR, so it is idempotent, and a changed tolerance in
ingest/config.toml takes effect on the next run, except for the digits-only
gate, which ran at read time under the bound then configured.

Companies-only mode (Story 1.5a) reads only the bulk download and fills the
fields search shows on the companies already in register.company. It adds
no company, deletes none, touches no filing and leaves every other column,
`navn` and `read_at` included, as it was.
"""

from __future__ import annotations

import http.client
import json
import os
import re
import sys
import time
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from pathlib import Path

import psycopg

from . import config as config_module
from . import documents, fetch, ocr, parse, reconcile, write

# Every filed document of these years is read (Story 2.1b): five years of
# development over time, each document also carrying the year before.
DOCUMENT_YEARS = range(2021, 2026)

# A stored document's status. `extracted` (read, not yet reconciled) is
# still a valid stored value, for rows restored from a dump made before Story
# 2.2, but a run never writes it and reconciles every such row it meets.
STATUSES = ("reconciled", "failed_reconciliation", "not_extracted", "paper")
RECONCILED_STATUSES = ("reconciled", "failed_reconciliation")


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
class DocumentSummary:
    """The document pass: what was written, per filing year and status."""

    written: Counter[tuple[int, str]] = field(default_factory=Counter)
    # Years already stored by an earlier run: neither fetched nor read.
    skipped_stored: int = 0
    # Years in the register's list outside DOCUMENT_YEARS: never fetched.
    outside_years: int = 0
    # Companies whose /aar list the register answered 404 or 410: no
    # filed document to read.
    no_document_list: list[str] = field(default_factory=list)
    # Documents passed to the reader, and the seconds spent reading them
    # (time, not money: a float is fine here).
    read_count: int = 0
    read_seconds: float = 0.0
    # OCR errors: stored as not_extracted with refusal ocr_error, and named.
    ocr_errors: list[Problem] = field(default_factory=list)
    # Stored documents reconciled again from their stored figures (Story
    # 2.2), per filing year and new status; no fetch and no OCR.
    rereconciled: Counter[tuple[int, str]] = field(default_factory=Counter)
    # Prior-year columns that failed their own checks, among those written or
    # reconciled again: they do not fail the filing.
    prior_failed: int = 0

    def lines(self) -> list[str]:
        out = ["  Documents (filed annual accounts, 2021–2025, read by OCR):"]
        if self.rereconciled:
            out.append("    stored documents reconciled again from stored figures (no fetch, no OCR):")
            for year in sorted({year for year, _ in self.rereconciled}):
                counts = ", ".join(f"{status} {self.rereconciled[(year, status)]}" for status in RECONCILED_STATUSES)
                out.append(f"      {year}: {counts}")
        out.append("    newly read and written:")
        for year in sorted({year for year, _ in self.written}):
            counts = ", ".join(f"{status} {self.written[(year, status)]}" for status in STATUSES)
            out.append(f"      {year}: {counts}")
        totals = ", ".join(
            f"{status} {sum(n for (_, written), n in self.written.items() if written == status)}" for status in STATUSES
        )
        out.append(f"    written: {totals}")
        out.append(f"    already stored, skipped: {self.skipped_stored}; listed years outside 2021–2025: {self.outside_years}")
        out.append(f"    companies with no list of filed documents (404 or 410): {len(self.no_document_list)}")
        for orgnr in self.no_document_list:
            out.append(f"    no list of filed documents: {orgnr}")
        out.append(f"    read: {self.read_count} documents in {self.read_seconds:.1f} s of reading")
        out.append(f"    prior-year columns failed_reconciliation (the filing's status is its current column's): {self.prior_failed}")
        for problem in self.ocr_errors:
            out.append(f"    OCR error, stored as not_extracted: {problem.orgnr} {problem.what}")
        return out


@dataclass
class Summary:
    codes: dict[str, CodeSummary]
    demo_orgnr: str
    demo_navn: str | None = None
    demo_found: bool = False
    demo_filings_written: int = 0
    rejected: list[Problem] = field(default_factory=list)
    failed: list[Problem] = field(default_factory=list)
    wall_seconds: float = 0.0

    def needs_operator(self) -> bool:
        """True when anything in the run needs a person to look at it."""
        return bool(
            self.failed
            or self.rejected
            or not self.demo_found
            or self.demo_filings_written == 0
            or self.codes_returning_nothing()
        )

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
            out.append(f"  failed, not written: {problem.orgnr} {problem.what}")
        out.append(f"  Wall time: {self.wall_seconds:.0f} s")
        out.append("  No filed document fetched (documents mode reads them: --documents <file>).")
        out.append("  Stored as filed: no ratio, distribution or derived amount was written.")
        return out


@dataclass
class DocumentsOnlySummary:
    """Documents mode: the document pass for the listed orgnrs only."""

    listed: int
    # Listed but not a stored company with a covered primary code: refused,
    # never fetched.
    refused: list[Problem] = field(default_factory=list)
    companies: int = 0
    failed: list[Problem] = field(default_factory=list)
    documents: DocumentSummary = field(default_factory=DocumentSummary)
    wall_seconds: float = 0.0
    # Rows of register.document still `extracted` after the run, in the
    # whole table: read but not reconciled, because their company was not
    # in this list (Story 2.2). None if the count could not be read.
    still_extracted: int | None = None

    def needs_operator(self) -> bool:
        # An OCR error is stored for good (a rerun skips it), so it needs a
        # person even though the run went on.
        return bool(self.failed or self.refused or self.documents.ocr_errors)

    def lines(self) -> list[str]:
        out = [
            "Step 1 summary, documents only (filed documents of the listed companies)",
            f"  {self.listed} orgnrs listed: {self.companies} companies read, {len(self.refused)} refused",
        ]
        for problem in self.refused:
            out.append(f"  refused, not fetched: {problem.orgnr} {problem.what}")
        for problem in self.failed:
            out.append(f"  failed, not written: {problem.orgnr} {problem.what}")
        out.extend(self.documents.lines())
        shown = "unknown (count failed)" if self.still_extracted is None else str(self.still_extracted)
        out.append(f"  documents still extracted (not reconciled; not in this list): {shown}")
        out.append(f"  Wall time: {self.wall_seconds:.0f} s")
        out.append("  No bulk download and no key figures fetched; stored as filed.")
        return out


@dataclass
class CompaniesOnlySummary:
    in_database: int
    updated: int = 0
    # In register.company but absent from the bulk download: withdrawn units
    # (deleting them is Story 2.4) or, in a test database, units outside it.
    not_found: list[str] = field(default_factory=list)
    failed: list[Problem] = field(default_factory=list)
    # (orgnr, stored naeringskode1, bulk naeringskode1) where the register's
    # primary code has changed since the company was stored. The bulk
    # description names the new code, not the stored one, so it is stored
    # as NULL; the municipality is stored as delivered. Reported, not an
    # error: the next full run stores code and description together.
    code_differs: list[tuple[str, str | None, str | None]] = field(default_factory=list)

    def needs_operator(self) -> bool:
        """Only a failed write needs a person: a company not found in the
        bulk file is expected and left untouched, and a changed code is
        reported for the next full run."""
        return bool(self.failed)

    def lines(self) -> list[str]:
        out = [
            "Step 1 summary, companies only (search fields of companies already stored)",
            f"  {self.in_database} companies in the database: updated {self.updated},"
            f" not found in bulk file {len(self.not_found)}",
        ]
        for orgnr in self.not_found:
            out.append(f"  not found in bulk file, left untouched: {orgnr}")
        out.append(f"  code differs from stored naeringskode1, description stored as NULL: {len(self.code_differs)}")
        for orgnr, stored_code, bulk_code in self.code_differs:
            out.append(f"  code differs: {orgnr} stored {stored_code} bulk {bulk_code}")
        for problem in self.failed:
            out.append(f"  failed write, rolled back: {problem.orgnr} {problem.what}")
        out.append("  No company added or deleted, no filing touched, navn and read_at unchanged.")
        return out


class ConnectionLost(Exception):
    """The database connection closed: every later write would fail too."""


# Errors from the register that end one company's fetch, not the run:
# OSError covers URLError and timeouts, ValueError a body that is not JSON,
# HTTPException e.g. IncompleteRead.
FETCH_ERRORS = (OSError, ValueError, http.client.HTTPException)


def _write_failed(conn: psycopg.Connection, failed: list[Problem], problem: Problem, error: psycopg.Error) -> None:
    failed.append(problem)
    if conn.closed:
        raise ConnectionLost(f"database connection closed after: {problem.orgnr} {problem.what}") from error


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
        _write_failed(conn, summary.failed, Problem(company.orgnr, f"company: {error.__class__.__name__}: {error}".strip()), error)
        return 0
    try:
        raw_filings = fetch.fetch_filings(transport, base_url, company.orgnr)
    except FETCH_ERRORS as error:
        # A register error that outlasted the retries, or a body that is not
        # the expected JSON: name it and go on with the next company.
        summary.failed.append(Problem(company.orgnr, f"key figures: {error.__class__.__name__}: {error}"))
        return 0
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
            problem = Problem(
                filing.orgnr,
                f"filing {filing.brreg_id} ({filing.regnskapstype} {filing.filing_year}):"
                f" {error.__class__.__name__}: {str(error).strip()}",
            )
            _write_failed(conn, summary.failed, problem, error)
            continue
        written += 1
    return written


def rules_of(cfg: config_module.Config) -> reconcile.Rules:
    """The reconciliation rules configured in [reconciliation]."""
    return reconcile.Rules(
        within_document_bound_kr=cfg.within_document_bound_kr,
        between_sources_floor_kr=cfg.between_sources_floor_kr,
        between_sources_tolerance=cfg.between_sources_tolerance,
    )


def _count_prior_failed(columns: Sequence[tuple[str, reconcile.Reconciliation]], summary: DocumentSummary) -> None:
    summary.prior_failed += sum(1 for role, rec in columns if role == "prior" and rec.status == "failed_reconciliation")


def _rereconcile(
    conn: psycopg.Connection,
    orgnr: str,
    rules: reconcile.Rules,
    summary: DocumentSummary,
    failed: list[Problem],
) -> None:
    """Reconciles every stored document of `orgnr` that was read, from its
    stored figures: no fetch, no OCR. Each document is updated in its own
    transaction. A document that cannot be reconciled or written is named
    in `failed` and the others go on."""
    try:
        stored = write.stored_generated_documents(conn, orgnr)
    except psycopg.Error as error:
        problem = Problem(orgnr, f"stored documents not read: {error.__class__.__name__}: {str(error).strip()}")
        _write_failed(conn, failed, problem, error)
        return
    for document in stored:
        year = document.filing_year
        try:
            columns = tuple(
                (
                    column.role,
                    reconcile.reconcile_column(
                        column.role, column.figures_ore, write.api_figures(conn, orgnr, column.stated_year), rules
                    ),
                )
                for column in document.columns
            )
            status = reconcile.document_status(columns)
        except ValueError as error:
            failed.append(Problem(orgnr, f"document {year}: not reconciled: {error}"))
            continue
        except psycopg.Error as error:
            problem = Problem(orgnr, f"document {year}: API figures not read: {error.__class__.__name__}: {str(error).strip()}")
            _write_failed(conn, failed, problem, error)
            continue
        try:
            write.update_reconciliation(conn, orgnr, year, status, columns)
        except (psycopg.Error, ValueError) as error:
            problem = Problem(orgnr, f"document {year}: reconciliation not written: {error.__class__.__name__}: {str(error).strip()}")
            if isinstance(error, psycopg.Error):
                _write_failed(conn, failed, problem, error)
            else:
                failed.append(problem)
            continue
        summary.rereconciled[(year, status)] += 1
        _count_prior_failed(columns, summary)


def _load_documents(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    base_url: str,
    rules: reconcile.Rules,
    orgnr: str,
    summary: DocumentSummary,
    failed: list[Problem],
    now: Callable[[], datetime],
    clock: Callable[[], float],
    progress: Callable[[str], None],
) -> None:
    """Fetches, reads and stores every filed 2021–2025 document of `orgnr`
    that has no row yet, each committed on its own."""
    try:
        years = fetch.fetch_document_years(transport, base_url, orgnr)
    except FETCH_ERRORS as error:
        failed.append(Problem(orgnr, f"document years: {error.__class__.__name__}: {error}"))
        return
    if years is None:
        summary.no_document_list.append(orgnr)
        return
    stored = write.stored_document_years(conn, orgnr)
    for year in years:
        if year not in DOCUMENT_YEARS:
            summary.outside_years += 1
            continue
        if year in stored:
            summary.skipped_stored += 1
            continue
        try:
            pdf = fetch.fetch_document(transport, base_url, orgnr, year)
        except FETCH_ERRORS as error:
            failed.append(Problem(orgnr, f"document {year}: {error.__class__.__name__}: {error}"))
            continue
        if pdf is None:
            failed.append(Problem(orgnr, f"document {year}: listed in /aar but not served (404 or 410)"))
            continue
        read_at = now()
        started = clock()
        try:
            read = documents.read_document(pdf, rules.within_document_bound_kr)
        except ocr.OcrError as error:
            # Tesseract failed: stored as not_extracted, so a rerun does not
            # retry it, and named with its page and first stderr line.
            summary.ocr_errors.append(Problem(orgnr, f"document {year}: {error}"))
            progress(f"OCR error {orgnr}/{year}: {error}")
            read = None
        except Exception as error:
            # Any other failure of the read (a PDF PyMuPDF cannot open, a
            # bug): named, nothing stored, so a rerun tries it again, and
            # the run goes on. KeyboardInterrupt is not an Exception and
            # still stops the run.
            failed.append(Problem(orgnr, f"document {year}: read failed: {error.__class__.__name__}: {error}"))
            continue
        finally:
            summary.read_count += 1
            summary.read_seconds += clock() - started
        try:
            if read is None:
                outcome = write.OCR_FAILED
            else:
                # Reconciled before it is written, against the API filings of
                # both stated years, and written with its status in one
                # transaction (Story 2.2).
                api_by_year = {y: write.api_figures(conn, orgnr, y) for y in (year, year - 1)}
                try:
                    outcome = write.document_outcome(year, read, api_by_year, rules)
                except ValueError as error:
                    # A read the outcome cannot take: named, nothing stored,
                    # so a rerun tries it again.
                    failed.append(Problem(orgnr, f"document {year}: not reconciled: {error}"))
                    continue
            write.write_document(conn, orgnr, year, outcome, write.filing_brreg_id(conn, orgnr, year), read_at)
        except psycopg.Error as error:
            problem = Problem(orgnr, f"document {year}: {error.__class__.__name__}: {str(error).strip()}")
            _write_failed(conn, failed, problem, error)
            continue
        summary.written[(year, outcome.status)] += 1
        _count_prior_failed([(c.role, c.reconciliation) for c in outcome.columns], summary)
        refusal = f" ({outcome.refusal})" if outcome.refusal else ""
        progress(f"document {orgnr}/{year}: {outcome.status}{refusal}")


def run(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    cfg: config_module.Config,
    codes: list[str],
    now: Callable[[], datetime] = _now,
    progress: Callable[[str], None] = lambda _message: None,
    clock: Callable[[], float] = time.monotonic,
) -> Summary:
    started = clock()
    summary = Summary(codes={code: CodeSummary(code) for code in codes}, demo_orgnr=cfg.demo_company_c.orgnr)

    # 1. The bulk download, filtered on the primary code while streaming.
    # Collected before any key-figures request, so the long download is not
    # held open across thousands of calls.
    bulk_read_at = now()
    selected: list[tuple[str, parse.Company]] = []
    for code, unit in parse.select_covered(fetch.iter_bulk_units(transport, cfg.base_url), codes):
        try:
            selected.append((code, parse.parse_company(unit, bulk_read_at)))
        except ValueError as error:
            orgnr = unit.get("organisasjonsnummer")
            summary.failed.append(Problem(str(orgnr), f"bulk unit not loaded: {error}"))
    progress(f"bulk download: {len(selected)} units with a covered primary code")

    # 2. Each covered company and its filings. No filed document: those are
    # read only in documents mode.
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
    demo_orgnr = cfg.demo_company_c.orgnr
    try:
        unit = fetch.fetch_unit(transport, cfg.base_url, demo_orgnr)
        company = parse.parse_company(unit, now()) if unit is not None else None
    except FETCH_ERRORS as error:
        summary.failed.append(Problem(demo_orgnr, f"demo company C: {error.__class__.__name__}: {error}"))
        company = None
    if company is not None:
        summary.demo_found = True
        summary.demo_navn = company.navn
        summary.demo_filings_written = _load_company(conn, transport, cfg.base_url, company, summary, now)
    summary.wall_seconds = clock() - started
    return summary


def run_documents(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    cfg: config_module.Config,
    codes: list[str],
    orgnrs: list[str],
    now: Callable[[], datetime] = _now,
    progress: Callable[[str], None] = lambda _message: None,
    clock: Callable[[], float] = time.monotonic,
) -> DocumentsOnlySummary:
    """The document pass for each listed orgnr that is a stored company whose
    primary code is declared in seed/coverage.json (`codes`): first its stored
    documents are reconciled again, then its unstored ones are fetched, read
    and reconciled. Any other listed orgnr is refused and named, and nothing
    is fetched for it."""
    started = clock()
    rules = rules_of(cfg)
    summary = DocumentsOnlySummary(listed=len(orgnrs))
    stored: dict[str, str | None] = {
        row[0]: row[1]
        for row in conn.execute(
            "SELECT orgnr, naeringskode1 FROM register.company WHERE orgnr = ANY(%s)", (list(orgnrs),)
        ).fetchall()
    }
    for index, orgnr in enumerate(orgnrs, start=1):
        if orgnr not in stored:
            summary.refused.append(Problem(orgnr, "not a stored company (register.company)"))
            continue
        if stored[orgnr] not in codes:
            summary.refused.append(Problem(orgnr, f"primary code {stored[orgnr]} is not covered (seed/coverage.json)"))
            continue
        summary.companies += 1
        _rereconcile(conn, orgnr, rules, summary.documents, summary.failed)
        _load_documents(conn, transport, cfg.base_url, rules, orgnr, summary.documents, summary.failed, now, clock, progress)
        if index % 25 == 0:
            progress(f"{index} of {len(orgnrs)} listed orgnrs")
    try:
        summary.still_extracted = write.count_extracted_documents(conn)
    except psycopg.Error as error:
        _write_failed(conn, summary.failed, Problem("-", f"extracted count: {error.__class__.__name__}"), error)
    summary.wall_seconds = clock() - started
    return summary


def run_companies_only(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    cfg: config_module.Config,
    now: Callable[[], datetime] = _now,
    progress: Callable[[str], None] = lambda _message: None,
) -> CompaniesOnlySummary:
    """Fills forretningsadresse_kommunenummer, forretningsadresse_kommune,
    naeringskode1_beskrivelse and search_fields_read_at from the bulk
    download, for every company already in register.company. The bulk file
    is read without the industry filter: demo company C, or a company whose
    primary code has changed since it was stored, is in it like any unit.

    naeringskode1_beskrivelse is stored only when the bulk naeringskode1
    equals the stored one; otherwise it describes a code this row does not
    hold, and NULL is stored and the company named in the summary."""
    stored_codes: dict[str, str | None] = {
        row[0]: row[1] for row in conn.execute("SELECT orgnr, naeringskode1 FROM register.company").fetchall()
    }
    stored = set(stored_codes)
    summary = CompaniesOnlySummary(in_database=len(stored))

    # Collected before any write, so the long download is not held open
    # across the updates.
    bulk_read_at = now()
    selected: list[parse.Company] = []
    for unit in fetch.iter_bulk_units(transport, cfg.base_url):
        orgnr = unit.get("organisasjonsnummer")
        if orgnr not in stored:
            continue
        try:
            company = parse.parse_company(unit, bulk_read_at)
        except ValueError as error:
            summary.failed.append(Problem(str(orgnr), f"bulk unit not loaded: {error}"))
            continue
        if company.naeringskode1 != stored_codes[company.orgnr]:
            summary.code_differs.append((company.orgnr, stored_codes[company.orgnr], company.naeringskode1))
            company = replace(company, naeringskode1_beskrivelse=None)
        selected.append(company)
    progress(f"bulk download: {len(selected)} of {len(stored)} stored companies found")

    seen: set[str] = set()
    for index, company in enumerate(selected, start=1):
        try:
            matched = write.update_company_search_fields(conn, company, bulk_read_at)
        except psycopg.Error as error:
            summary.failed.append(Problem(company.orgnr, f"search fields: {error.__class__.__name__}: {error}".strip()))
            if conn.closed:
                raise ConnectionLost(f"database connection closed after: {company.orgnr}") from error
            continue
        if not matched:
            # Stored at the start of the run, gone now: step 1 never deletes,
            # so something else did. Not the same as absent from the bulk file.
            summary.failed.append(Problem(company.orgnr, "no row to update"))
            continue
        if company.orgnr not in seen:
            summary.updated += 1
            seen.add(company.orgnr)
        if index % 5000 == 0:
            progress(f"{index} of {len(selected)} companies")
    # A unit that failed to parse or write is reported there, not here.
    accounted = seen | {problem.orgnr for problem in summary.failed}
    summary.not_found = sorted(stored - accounted)
    return summary


def _progress(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


ORGNR = re.compile(r"[0-9]{9}")
USAGE = "usage: python -m peerless_ingest [--companies-only | --documents <file>]"


class BadDocumentList(Exception):
    pass


def read_document_list(path: Path) -> list[str]:
    """The orgnrs of a `--documents` file: a JSON list of distinct
    nine-digit strings. Anything else raises BadDocumentList."""
    try:
        orgnrs = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise BadDocumentList(f"{path}: cannot be read as JSON ({error.__class__.__name__}: {error})") from error
    if not isinstance(orgnrs, list) or not all(isinstance(o, str) and ORGNR.fullmatch(o) for o in orgnrs):
        raise BadDocumentList(f"{path}: must be a JSON list of nine-digit orgnr strings")
    if len(set(orgnrs)) != len(orgnrs):
        raise BadDocumentList(f"{path}: an orgnr is listed twice")
    return orgnrs


def main(argv: Sequence[str] | None = None) -> int:
    """`argv` is the command line after the program name (sys.argv[1:] when
    None, as from the `peerless-ingest` script): empty for a normal run,
    exactly `--companies-only`, or `--documents <file>`. Anything else, or a
    file that is not a JSON list of nine-digit strings, exits 2 before any
    request or connection."""
    args = list(sys.argv[1:] if argv is None else argv)
    document_list: list[str] | None = None
    if len(args) == 2 and args[0] == "--documents":
        try:
            document_list = read_document_list(Path(args[1]))
        except BadDocumentList as error:
            print(f"{USAGE}; {error}", file=sys.stderr)
            return 2
    elif args not in ([], ["--companies-only"]):
        print(f"{USAGE}; got {' '.join(args)}", file=sys.stderr)
        return 2
    companies_only = args == ["--companies-only"]
    config_path = Path(os.environ.get("PEERLESS_INGEST_CONFIG", config_module.DEFAULT_CONFIG))
    coverage_path = Path(os.environ.get("PEERLESS_COVERAGE", config_module.DEFAULT_COVERAGE))
    cfg = config_module.load_config(config_path)
    # Companies-only mode fetches no industry: it never reads coverage.json.
    codes = [] if companies_only else config_module.load_coverage(coverage_path)
    transport = fetch.UrllibTransport(cfg.user_agent, cfg.request_pause_seconds)
    summary: Summary | CompaniesOnlySummary | DocumentsOnlySummary
    with write.connect(config_module.database_url()) as conn:
        if companies_only:
            summary = run_companies_only(conn, transport, cfg, progress=_progress)
        elif document_list is not None:
            summary = run_documents(conn, transport, cfg, codes, document_list, progress=_progress)
        else:
            summary = run(conn, transport, cfg, codes, progress=_progress)
    for line in summary.lines():
        print(line)
    return 1 if summary.needs_operator() else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
