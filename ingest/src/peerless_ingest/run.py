"""Batch step 1: Enhetsregisteret data and key-figures API filings for every
company whose primary industry is declared in seed/coverage.json, plus demo
company C; and, only in documents mode, the filed 2021–2025 documents of the
listed companies, read by OCR (Story 2.1b). Everything is stored as filed,
in øre.

    python -m peerless_ingest                     (inside the image: `pnpm ingest`)
    python -m peerless_ingest --companies-only    (`pnpm ingest --companies-only`)
    python -m peerless_ingest --documents <file>  (`pnpm ingest --documents <file>`)
    python -m peerless_ingest --reread <file>     (`pnpm ingest --reread <file>`)

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

Every document written carries the reader version that read it,
`reader_commit` (Story 2.3b): the full commit of the last change to ingest/,
passed in PEERLESS_READER_COMMIT. Documents and re-read mode refuse to start
without a well-formed one.

Re-read mode (Story 2.3b) takes the same orgnr list and refusals as
documents mode. For each stored document of those companies whose reader
version is not the current one, it fetches the document by its year's path,
reads, reconciles and replaces it in one transaction with the current
version. A document already at the current version is not fetched, so an
interrupted re-read resumes where it stopped. A re-read that gives fewer
columns than are stored (a refusal, a year mismatch), that turns a
reconciled column into failed_reconciliation, an OCR error or a failed fetch
replaces nothing: the document keeps its old figures and version, is named
as not replaced, and the run exits 1. A figure that a column still
reconciled no longer holds is replaced, and listed per document.

Companies-only mode (Story 1.5a) reads only the bulk download and fills the
fields search shows on the companies already in register.company. It adds
no company, deletes none (only a plain run deletes), touches no filing and
leaves every other column, `navn` and `read_at` included, as it was.

Withdrawn companies (Story 2.4). A plain run reads the stored orgnrs before
the bulk download, and after loading asks the register's unit endpoint
about each stored orgnr that is absent from the whole bulk file. Only an
explicit 410 Gone deletes it (`write.delete_company`), and every register row
that references it goes with it. 404, a 5xx, a timeout, a body that is not
JSON, or a live unit deletes nothing and is a failure. If more than
`[withdrawal] max_absent_share` of the stored companies are absent, the
bulk file is taken to be truncated: no unit is asked about and nothing is
deleted (D5). No other mode deletes.

The run record (Story 2.4). Every mode's run is recorded in run.step1:
inserted when it starts, updated when it ends with its counts per outcome
and every failure, also when it ends in an exception, whose class and
message are recorded before it is raised again. Each deleted orgnr is
appended in the deleting transaction.
"""

from __future__ import annotations

import http.client
import json
import os
import re
import sys
import time
from collections import Counter
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import UTC, date, datetime
from fractions import Fraction
from pathlib import Path
from typing import Protocol

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


# The stage of every failure the withdrawal check records (Story 2.4).
WITHDRAWAL = "withdrawal"
# How a failure fetching demo company C's unit is named in Summary.failed.
DEMO_PREFIX = "demo company C: "


@dataclass
class WithdrawalSummary:
    """The withdrawal check of a plain run (Story 2.4): the stored orgnrs
    absent from the bulk file, and what the register's unit endpoint
    answered for each."""

    # Companies stored when the run started; how many of them the bulk file
    # did not hold and have no stored slettedato (the D5 share's count), and
    # how many it did not hold but are already stored as dissolved, which
    # are not looked up again (Q5a).
    stored: int = 0
    absent: int = 0
    absent_already_dissolved: int = 0
    # Absent orgnrs asked about at the unit endpoint.
    checked: int = 0
    # Deleted after 410 Gone, with every row referencing them.
    deleted: list[str] = field(default_factory=list)
    # Answered 200 with a slettedato, now stored: dissolved, not withdrawn,
    # and not a failure (Q4a).
    dissolved: list[str] = field(default_factory=list)
    # Not deleted, and why: 404, a live unit, a fetch error, a malformed
    # slettedato, a failed write, or the whole check skipped for a
    # truncated bulk file. All are in the run record.
    failures: list[write.Failure] = field(default_factory=list)
    # True when the check did not finish (Q6): the D5 guard, a failed
    # delete or write, or a lookup that did not complete. Only this makes
    # the run exit 1; 404 and a live unit are failures that do not.
    incomplete: bool = False

    def fail(self, failure: write.Failure, *, incomplete: bool) -> None:
        self.failures.append(failure)
        self.incomplete = self.incomplete or incomplete

    def lines(self) -> list[str]:
        out = [
            f"  Withdrawn companies: {self.stored} stored, {self.absent} absent from the bulk file"
            f" (and {self.absent_already_dissolved} already stored as dissolved), {self.checked} asked about,"
            f" {len(self.deleted)} deleted (410 Gone), {len(self.dissolved)} dissolved (slettedato stored),"
            f" {len(self.failures)} failures"
        ]
        for orgnr in self.deleted:
            out.append(f"  deleted (410 Gone), with every row referencing it: {orgnr}")
        for orgnr in self.dissolved:
            out.append(f"  dissolved (200 with slettedato), kept: {orgnr}")
        for failure in self.failures:
            out.append(f"  not deleted: {failure.orgnr or '-'} {failure.reason}")
        if self.incomplete:
            out.append("  The withdrawal check did not finish: a person must look at the failures above.")
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
    withdrawal: WithdrawalSummary = field(default_factory=WithdrawalSummary)
    wall_seconds: float = 0.0

    def needs_operator(self) -> bool:
        """True when anything in the run needs a person to look at it."""
        return bool(
            self.failed
            or self.rejected
            or not self.demo_found
            or self.demo_filings_written == 0
            or self.codes_returning_nothing()
            or self.withdrawal.incomplete
        )

    def record_counts(self) -> dict[str, object]:
        """The run record's counts per outcome."""
        return {
            "codes": {
                code: {
                    "companies": s.companies,
                    "companies_with_filings": s.companies_with_filings,
                    "filings_written": s.filings_written,
                }
                for code, s in self.codes.items()
            },
            "demo_found": self.demo_found,
            "demo_filings_written": self.demo_filings_written,
            "rejected": len(self.rejected),
            "failed": len(self.failed),
            "stored": self.withdrawal.stored,
            "absent_from_bulk": self.withdrawal.absent,
            "absent_already_dissolved": self.withdrawal.absent_already_dissolved,
            "unit_checked": self.withdrawal.checked,
            "deleted": len(self.withdrawal.deleted),
            "dissolved": len(self.withdrawal.dissolved),
            "withdrawal_failures": len(self.withdrawal.failures),
            "withdrawal_incomplete": self.withdrawal.incomplete,
        }

    def record_failures(self, finished: bool = True) -> list[write.Failure]:
        """Every failure, as the run record lists it, each once: those that
        make `needs_operator` true, and the withdrawal check's 404 and live
        answers, which do not."""
        out = [
            write.Failure(p.orgnr, "demo_company_c" if p.what.startswith(DEMO_PREFIX) else "load", p.what)
            for p in self.failed
        ]
        out += [write.Failure(p.orgnr, "filing_rejected", p.what) for p in self.rejected]
        demo_named = any(p.orgnr == self.demo_orgnr and p.what.startswith(DEMO_PREFIX) for p in self.failed)
        # The demo and coverage checks judge a finished run: a run that
        # raised before reaching them did not find them missing.
        if finished:
            if not self.demo_found:
                if not demo_named:
                    out.append(write.Failure(self.demo_orgnr, "demo_company_c", "not found in Enhetsregisteret"))
            elif self.demo_filings_written == 0:
                out.append(write.Failure(self.demo_orgnr, "demo_company_c", "no filing written"))
            out += [
                write.Failure(None, "coverage", f"{code}: no unit has it as naeringskode1")
                for code in self.codes_returning_nothing()
            ]
        return out + list(self.withdrawal.failures)

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
        out.extend(self.withdrawal.lines())
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

    def record_counts(self) -> dict[str, object]:
        d = self.documents
        return {
            "listed": self.listed,
            "companies": self.companies,
            "refused": len(self.refused),
            "failed": len(self.failed),
            "written": {status: sum(n for (_, s), n in d.written.items() if s == status) for status in STATUSES},
            "rereconciled": {
                status: sum(n for (_, s), n in d.rereconciled.items() if s == status) for status in RECONCILED_STATUSES
            },
            "skipped_stored": d.skipped_stored,
            "outside_years": d.outside_years,
            "no_document_list": len(d.no_document_list),
            "read": d.read_count,
            "ocr_errors": len(d.ocr_errors),
            "prior_failed": d.prior_failed,
            "still_extracted": self.still_extracted,
        }

    def record_failures(self, finished: bool = True) -> list[write.Failure]:
        return (
            [write.Failure(p.orgnr, "refused", p.what) for p in self.refused]
            + [write.Failure(p.orgnr, "documents", p.what) for p in self.failed]
            + [write.Failure(p.orgnr, "ocr", p.what) for p in self.documents.ocr_errors]
        )

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
class RereadSummary:
    """Re-read mode (Story 2.3b): the stored documents of the listed
    companies, re-read by the current reader version."""

    listed: int
    reader_commit: str
    # Listed but not a stored company with a covered primary code: refused,
    # never fetched.
    refused: list[Problem] = field(default_factory=list)
    companies: int = 0
    # Re-read and replaced, per filing year and new status.
    replaced: Counter[tuple[int, str]] = field(default_factory=Counter)
    # Already read by the current version: not fetched (a resumed run).
    current: int = 0
    # Not replaced, with the reason: they keep their figures and old version.
    not_replaced: list[Problem] = field(default_factory=list)
    # Replaced, but a column reconciled before and after lost a figure: the
    # fields, per document and column (Meinich, 2026-10-25).
    lost_figures: list[Problem] = field(default_factory=list)
    # A company whose stored documents could not be read: named, nothing
    # re-read for it. A database error on one document is not replaced.
    failed: list[Problem] = field(default_factory=list)
    read_count: int = 0
    read_seconds: float = 0.0
    prior_failed: int = 0
    wall_seconds: float = 0.0

    def needs_operator(self) -> bool:
        # A document not replaced still holds another version's figures.
        return bool(self.failed or self.refused or self.not_replaced)

    def record_counts(self) -> dict[str, object]:
        return {
            "listed": self.listed,
            "companies": self.companies,
            "refused": len(self.refused),
            "replaced": {status: sum(n for (_, s), n in self.replaced.items() if s == status) for status in STATUSES},
            "current": self.current,
            "not_replaced": len(self.not_replaced),
            "lost_figures": len(self.lost_figures),
            "failed": len(self.failed),
            "read": self.read_count,
            "prior_failed": self.prior_failed,
        }

    def record_failures(self, finished: bool = True) -> list[write.Failure]:
        return (
            [write.Failure(p.orgnr, "refused", p.what) for p in self.refused]
            + [write.Failure(p.orgnr, "not_replaced", p.what) for p in self.not_replaced]
            + [write.Failure(p.orgnr, "reread", p.what) for p in self.failed]
        )

    def lines(self) -> list[str]:
        out = [
            "Step 1 summary, re-read (stored documents of the listed companies, by the current reader version)",
            f"  reader version: {self.reader_commit}",
            f"  {self.listed} orgnrs listed: {self.companies} companies read, {len(self.refused)} refused",
        ]
        for problem in self.refused:
            out.append(f"  refused, not fetched: {problem.orgnr} {problem.what}")
        out.append("  replaced:")
        for year in sorted({year for year, _ in self.replaced}):
            counts = ", ".join(f"{status} {self.replaced[(year, status)]}" for status in STATUSES)
            out.append(f"    {year}: {counts}")
        out.append(
            f"  replaced {sum(self.replaced.values())}; already current, not fetched {self.current};"
            f" not replaced {len(self.not_replaced)}"
        )
        for problem in self.not_replaced:
            out.append(f"  not replaced, keeps its old figures and version: {problem.orgnr} {problem.what}")
        out.append(f"  replaced with a figure lost from a column still reconciled: {len(self.lost_figures)} documents")
        for problem in self.lost_figures:
            out.append(f"  figure lost, now NULL: {problem.orgnr} {problem.what}")
        for problem in self.failed:
            out.append(f"  failed, not written: {problem.orgnr} {problem.what}")
        out.append(f"  read: {self.read_count} documents in {self.read_seconds:.1f} s of reading")
        out.append(f"  prior-year columns failed_reconciliation (the filing's status is its current column's): {self.prior_failed}")
        out.append(f"  Wall time: {self.wall_seconds:.0f} s")
        out.append("  No bulk download and no key figures fetched; stored as filed.")
        return out


@dataclass
class CompaniesOnlySummary:
    in_database: int
    updated: int = 0
    # In register.company but absent from the bulk download: withdrawn units
    # (only a plain run deletes one, after 410 Gone) or, in a test database,
    # units outside it.
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

    def record_counts(self) -> dict[str, object]:
        return {
            "in_database": self.in_database,
            "updated": self.updated,
            "not_found_in_bulk": len(self.not_found),
            "code_differs": len(self.code_differs),
            "failed": len(self.failed),
        }

    def record_failures(self, finished: bool = True) -> list[write.Failure]:
        return [write.Failure(p.orgnr, "search_fields", p.what) for p in self.failed]

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


# A run's summary, as the run record reads it (Story 2.4).
RecordedSummary = Summary | CompaniesOnlySummary | DocumentsOnlySummary | RereadSummary


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


class NotRead(Exception):
    """A document that was not fetched or not read, and why. Nothing is
    stored for it, so a later run tries it again."""


class _Timed(Protocol):
    read_count: int
    read_seconds: float


def _fetch_and_read(
    transport: fetch.Transport,
    base_url: str,
    rules: reconcile.Rules,
    orgnr: str,
    year: int,
    unserved: str,
    timing: _Timed,
    now: Callable[[], datetime],
    clock: Callable[[], float],
) -> tuple[documents.DocumentRead | ocr.OcrError, datetime]:
    """Fetches the document of `orgnr` for `year` by the year in its path
    and reads it (`documents.read_document`): the read, or the OcrError when
    Tesseract failed, and when it was read. Raises NotRead for a fetch
    error, a document not served (`unserved` says why that is a problem)
    and any other failure of the read. KeyboardInterrupt is not an
    Exception and still stops the run."""
    try:
        pdf = fetch.fetch_document(transport, base_url, orgnr, year)
    except FETCH_ERRORS as error:
        raise NotRead(f"{error.__class__.__name__}: {error}") from error
    if pdf is None:
        raise NotRead(unserved)
    read_at = now()
    started = clock()
    try:
        return documents.read_document(pdf, rules.within_document_bound_kr), read_at
    except ocr.OcrError as error:
        return error, read_at
    except Exception as error:
        # A PDF PyMuPDF cannot open, a bug: named, and the run goes on.
        raise NotRead(f"read failed: {error.__class__.__name__}: {error}") from error
    finally:
        timing.read_count += 1
        timing.read_seconds += clock() - started


def _outcome(
    conn: psycopg.Connection,
    orgnr: str,
    year: int,
    read: documents.DocumentRead | ocr.OcrError,
    rules: reconcile.Rules,
) -> write.DocumentOutcome:
    """What is stored for a read: reconciled before it is written, against
    the API filings of both stated years (Story 2.2). An OCR error is stored
    as not_extracted. Raises ValueError for a read the outcome cannot take."""
    if isinstance(read, ocr.OcrError):
        return write.OCR_FAILED
    api_by_year = {y: write.api_figures(conn, orgnr, y) for y in (year, year - 1)}
    return write.document_outcome(year, read, api_by_year, rules)


def _load_documents(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    base_url: str,
    rules: reconcile.Rules,
    orgnr: str,
    reader_commit: str,
    summary: DocumentSummary,
    failed: list[Problem],
    now: Callable[[], datetime],
    clock: Callable[[], float],
    progress: Callable[[str], None],
) -> None:
    """Fetches, reads and stores every filed 2021–2025 document of `orgnr`
    that has no row yet, each committed on its own with `reader_commit`."""
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
            read, read_at = _fetch_and_read(
                transport, base_url, rules, orgnr, year, "listed in /aar but not served (404 or 410)", summary, now, clock
            )
        except NotRead as error:
            failed.append(Problem(orgnr, f"document {year}: {error}"))
            continue
        if isinstance(read, ocr.OcrError):
            # Tesseract failed: stored as not_extracted, so a rerun does not
            # retry it (a re-read does), and named with its page and first
            # stderr line.
            summary.ocr_errors.append(Problem(orgnr, f"document {year}: {read}"))
            progress(f"OCR error {orgnr}/{year}: {read}")
        try:
            try:
                outcome = _outcome(conn, orgnr, year, read, rules)
            except ValueError as error:
                # A read the outcome cannot take: named, nothing stored, so
                # a rerun tries it again.
                failed.append(Problem(orgnr, f"document {year}: not reconciled: {error}"))
                continue
            brreg_id = write.filing_brreg_id(conn, orgnr, year)
            write.write_document(conn, orgnr, year, outcome, brreg_id, read_at, reader_commit)
        except psycopg.Error as error:
            problem = Problem(orgnr, f"document {year}: {error.__class__.__name__}: {str(error).strip()}")
            _write_failed(conn, failed, problem, error)
            continue
        summary.written[(year, outcome.status)] += 1
        _count_prior_failed([(c.role, c.reconciliation) for c in outcome.columns], summary)
        refusal = f" ({outcome.refusal})" if outcome.refusal else ""
        progress(f"document {orgnr}/{year}: {outcome.status}{refusal}")


def _downgraded_roles(document: write.StoredVersion, outcome: write.DocumentOutcome) -> list[str]:
    """The roles of the stored columns that are reconciled and that the
    re-read would make failed_reconciliation. Such a re-read is not replaced
    (Meinich, 2026-10-25): the same principle as fewer columns."""
    now = {c.role: c.reconciliation.status for c in outcome.columns}
    return [c.role for c in document.columns if c.status == "reconciled" and now.get(c.role) == "failed_reconciliation"]


def _lost_figures(document: write.StoredVersion, outcome: write.DocumentOutcome) -> list[str]:
    """Per column reconciled both as stored and as re-read, the fields that
    held a figure and are NULL now, as "role: field, field"."""
    now = {c.role: c for c in outcome.columns}
    lost: list[str] = []
    for stored in document.columns:
        column = now.get(stored.role)
        if stored.status != "reconciled" or column is None or column.reconciliation.status != "reconciled":
            continue
        fields = [f for f in documents.FIELDS if f in stored.present and column.column.figures[f] is None]
        if fields:
            lost.append(f"{stored.role}: {', '.join(fields)}")
    return lost


def _reread_documents(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    base_url: str,
    rules: reconcile.Rules,
    orgnr: str,
    reader_commit: str,
    summary: RereadSummary,
    now: Callable[[], datetime],
    clock: Callable[[], float],
    progress: Callable[[str], None],
) -> None:
    """Re-reads every stored document of `orgnr` whose reader version is not
    `reader_commit` (Story 2.3b), through the same fetch, read, reconcile
    and write as a new document, each replaced in its own transaction. A
    document already at `reader_commit` is not fetched, so an interrupted
    re-read resumes where it stopped. A document is not replaced, and keeps
    its old figures and version, when the re-read gives fewer columns than
    are stored (a refusal, a year mismatch), when it turns a reconciled
    column into failed_reconciliation, when Tesseract fails, or when it is
    not fetched or not read; each is named in `summary.not_replaced`. A
    document replaced although a column reconciled before and after lost a
    figure is named in `summary.lost_figures`."""
    try:
        stored = write.stored_document_versions(conn, orgnr)
    except psycopg.Error as error:
        problem = Problem(orgnr, f"stored documents not read: {error.__class__.__name__}: {str(error).strip()}")
        _write_failed(conn, summary.failed, problem, error)
        return
    for document in stored:
        year = document.filing_year
        if document.reader_commit == reader_commit:
            summary.current += 1
            continue
        try:
            read, read_at = _fetch_and_read(
                transport, base_url, rules, orgnr, year, "stored, but not served now (404 or 410)", summary, now, clock
            )
        except NotRead as error:
            summary.not_replaced.append(Problem(orgnr, f"document {year}: {error}"))
            continue
        if isinstance(read, ocr.OcrError):
            # Not replaced, so the next re-read tries it again.
            summary.not_replaced.append(Problem(orgnr, f"document {year}: OCR error: {read}"))
            progress(f"OCR error {orgnr}/{year}: {read}")
            continue
        try:
            try:
                outcome = _outcome(conn, orgnr, year, read, rules)
            except ValueError as error:
                summary.not_replaced.append(Problem(orgnr, f"document {year}: not reconciled: {error}"))
                continue
            if len(outcome.columns) < len(document.columns):
                refusal = f", {outcome.refusal}" if outcome.refusal else ""
                summary.not_replaced.append(
                    Problem(
                        orgnr,
                        f"document {year}: fewer columns: {len(outcome.columns)} read ({outcome.status}{refusal}),"
                        f" {len(document.columns)} stored",
                    )
                )
                continue
            downgraded = _downgraded_roles(document, outcome)
            if downgraded:
                summary.not_replaced.append(
                    Problem(orgnr, f"document {year}: reconciled column would fail reconciliation: {', '.join(downgraded)}")
                )
                continue
            brreg_id = write.filing_brreg_id(conn, orgnr, year)
            write.write_document(conn, orgnr, year, outcome, brreg_id, read_at, reader_commit)
        except psycopg.Error as error:
            # Nothing written: the document keeps its figures and version.
            problem = Problem(orgnr, f"document {year}: {error.__class__.__name__}: {str(error).strip()}")
            _write_failed(conn, summary.not_replaced, problem, error)
            continue
        summary.replaced[(year, outcome.status)] += 1
        lost =_lost_figures(document, outcome)
        if lost:
            summary.lost_figures.append(Problem(orgnr, f"document {year}: {'; '.join(lost)}"))
        summary.prior_failed += sum(
            1 for c in outcome.columns if c.role == "prior" and c.reconciliation.status == "failed_reconciliation"
        )
        refusal = f" ({outcome.refusal})" if outcome.refusal else ""
        progress(f"re-read {orgnr}/{year}: {outcome.status}{refusal}")


def _percent(share: Fraction) -> str:
    """A share as a percentage for the summary and run record, formatted
    from the exact fraction."""
    return f"{share * 100:.2f} %"


def _check_withdrawn(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    cfg: config_module.Config,
    stored: Mapping[str, date | None],
    seen: set[str],
    summary: WithdrawalSummary,
    run_id: int | None,
    progress: Callable[[str], None],
) -> None:
    """Asks the register's unit endpoint about every orgnr in `stored` (orgnr
    to stored slettedato) that the bulk file did not hold (`seen`) and that
    is not already stored as dissolved, and acts on the answer (Story 2.4):

    - 410 Gone: the company is deleted, with every row referencing it;
    - 200 with a slettedato: dissolved, its slettedato stored (Q4a);
    - 404, or 200 without a slettedato: a failure, nothing changed;
    - a lookup that did not complete, a malformed slettedato or a failed
      write: a failure that leaves the check incomplete (Q6).

    If the share of absent companies without a stored slettedato exceeds
    `cfg.max_absent_share`, nothing is asked and nothing is changed: a
    truncated bulk file would otherwise make thousands of companies look
    withdrawn (D5, Q5a)."""
    missing = sorted(set(stored) - seen)
    absent = [orgnr for orgnr in missing if stored[orgnr] is None]
    summary.stored = len(stored)
    summary.absent = len(absent)
    summary.absent_already_dissolved = len(missing) - len(absent)
    if not absent:
        return
    share = Fraction(len(absent), len(stored))
    if share > cfg.max_absent_share:
        summary.fail(
            write.Failure(
                None,
                WITHDRAWAL,
                f"bulk_absent_share_exceeded: {len(absent)} of {len(stored)} stored companies absent from the bulk file"
                f" ({_percent(share)}, limit {_percent(cfg.max_absent_share)}); no unit asked about, nothing deleted",
            ),
            incomplete=True,
        )
        progress(f"withdrawal check skipped: {len(absent)} of {len(stored)} stored companies absent from the bulk file")
        return
    progress(f"withdrawal check: {len(absent)} stored companies absent from the bulk file")
    for orgnr in absent:
        summary.checked += 1
        try:
            unit = fetch.fetch_unit(transport, cfg.base_url, orgnr)
        except fetch.Gone:
            _delete_withdrawn(conn, orgnr, summary, run_id, progress)
            continue
        except FETCH_ERRORS as error:
            summary.fail(write.Failure(orgnr, WITHDRAWAL, f"{error.__class__.__name__}: {error}"), incomplete=True)
            continue
        if unit is None:
            summary.fail(write.Failure(orgnr, WITHDRAWAL, "unit_not_found"), incomplete=False)
        elif "slettedato" in unit:
            _store_dissolved(conn, orgnr, unit["slettedato"], summary, progress)
        else:
            summary.fail(write.Failure(orgnr, WITHDRAWAL, "absent_from_bulk_but_live"), incomplete=False)


def _delete_withdrawn(
    conn: psycopg.Connection,
    orgnr: str,
    summary: WithdrawalSummary,
    run_id: int | None,
    progress: Callable[[str], None],
) -> None:
    """Deletes a company the register answered 410 Gone for. A failed delete
    leaves the check incomplete; a closed connection ends the run."""
    try:
        deleted = write.delete_company(conn, orgnr, run_id)
    except (psycopg.Error, ValueError) as error:
        summary.fail(
            write.Failure(orgnr, WITHDRAWAL, f"delete_failed: {error.__class__.__name__}: {str(error).strip()}"),
            incomplete=True,
        )
        if conn.closed:
            raise ConnectionLost(f"database connection closed after deleting: {orgnr}") from error
        return
    if deleted:
        summary.deleted.append(orgnr)
        progress(f"deleted (410 Gone): {orgnr}")
    else:
        # Stored when the run started, gone now: nothing to delete.
        summary.fail(write.Failure(orgnr, WITHDRAWAL, "gone_but_no_row_to_delete"), incomplete=False)


SLETTEDATO = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")


def _store_dissolved(
    conn: psycopg.Connection,
    orgnr: str,
    value: object,
    summary: WithdrawalSummary,
    progress: Callable[[str], None],
) -> None:
    """A unit answering 200 with a slettedato is dissolved (Q4a): the date is
    stored as the register gives it. A value that is not an ISO date is a
    failure, never guessed at."""
    slettedato: date | None = None
    if isinstance(value, str) and SLETTEDATO.fullmatch(value):
        try:
            slettedato = date.fromisoformat(value)
        except ValueError:
            slettedato = None
    if slettedato is None:
        summary.fail(write.Failure(orgnr, WITHDRAWAL, f"malformed_slettedato: {value!r}"), incomplete=True)
        return
    try:
        updated = write.store_slettedato(conn, orgnr, slettedato)
    except psycopg.Error as error:
        summary.fail(
            write.Failure(orgnr, WITHDRAWAL, f"slettedato_not_stored: {error.__class__.__name__}: {str(error).strip()}"),
            incomplete=True,
        )
        if conn.closed:
            raise ConnectionLost(f"database connection closed after: {orgnr}") from error
        return
    if not updated:
        summary.fail(write.Failure(orgnr, WITHDRAWAL, "dissolved_but_no_row_to_update"), incomplete=False)
        return
    summary.dissolved.append(orgnr)
    progress(f"dissolved (slettedato {slettedato.isoformat()}): {orgnr}")


def _stored_orgnrs(conn: psycopg.Connection) -> dict[str, date | None]:
    """Every stored orgnr, with its stored slettedato (NULL: not known to be
    dissolved)."""
    return {str(row[0]): row[1] for row in conn.execute("SELECT orgnr, slettedato FROM register.company").fetchall()}


def run(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    cfg: config_module.Config,
    codes: list[str],
    now: Callable[[], datetime] = _now,
    progress: Callable[[str], None] = lambda _message: None,
    clock: Callable[[], float] = time.monotonic,
    run_id: int | None = None,
    on_summary: Callable[[RecordedSummary], None] = lambda _summary: None,
) -> Summary:
    """The plain run: the bulk download, each covered company and its
    filings, demo company C, then the withdrawal check (Story 2.4).
    `run_id` is this run's record in run.step1, to which each deleted orgnr
    is appended in the deleting transaction; None only in tests that do
    not look at the record."""
    started = clock()
    summary = Summary(codes={code: CodeSummary(code) for code in codes}, demo_orgnr=cfg.demo_company_c.orgnr)
    on_summary(summary)

    # The companies stored before this run, read before the bulk download:
    # each one the whole bulk file does not hold is checked in step 4.
    stored = _stored_orgnrs(conn)
    seen: set[str] = set()

    def marking_seen(units: Iterator[dict]) -> Iterator[dict]:
        for unit in units:
            orgnr = unit.get("organisasjonsnummer")
            if isinstance(orgnr, str):
                seen.add(orgnr)
            yield unit

    # 1. The bulk download, filtered on the primary code while streaming.
    # Collected before any key-figures request, so the long download is not
    # held open across thousands of calls. Every unit's orgnr is marked
    # seen, whatever its primary code.
    bulk_read_at = now()
    selected: list[tuple[str, parse.Company]] = []
    for code, unit in parse.select_covered(marking_seen(fetch.iter_bulk_units(transport, cfg.base_url)), codes):
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
    except fetch.Gone:
        # Withdrawn: not loaded. Step 4 deletes it if it is stored and absent
        # from the bulk file.
        summary.failed.append(Problem(demo_orgnr, f"{DEMO_PREFIX}withdrawn (410 Gone)"))
        company = None
    except FETCH_ERRORS as error:
        summary.failed.append(Problem(demo_orgnr, f"{DEMO_PREFIX}{error.__class__.__name__}: {error}"))
        company = None
    if company is not None:
        summary.demo_found = True
        summary.demo_navn = company.navn
        summary.demo_filings_written = _load_company(conn, transport, cfg.base_url, company, summary, now)

    # 4. Withdrawn companies: only a 410 Gone from the unit endpoint deletes.
    _check_withdrawn(conn, transport, cfg, stored, seen, summary.withdrawal, run_id, progress)
    summary.wall_seconds = clock() - started
    return summary


def _listed_companies(conn: psycopg.Connection, codes: list[str], orgnrs: list[str], refused: list[Problem]) -> set[str]:
    """The listed orgnrs that are stored companies with a covered primary
    code (`codes`, from seed/coverage.json). Each other one is named in
    `refused`, and nothing is fetched for it."""
    stored: dict[str, str | None] = {
        row[0]: row[1]
        for row in conn.execute(
            "SELECT orgnr, naeringskode1 FROM register.company WHERE orgnr = ANY(%s)", (list(orgnrs),)
        ).fetchall()
    }
    accepted: set[str] = set()
    for orgnr in orgnrs:
        if orgnr not in stored:
            refused.append(Problem(orgnr, "not a stored company (register.company)"))
        elif stored[orgnr] not in codes:
            refused.append(Problem(orgnr, f"primary code {stored[orgnr]} is not covered (seed/coverage.json)"))
        else:
            accepted.add(orgnr)
    return accepted


def run_documents(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    cfg: config_module.Config,
    codes: list[str],
    orgnrs: list[str],
    *,
    reader_commit: str,
    now: Callable[[], datetime] = _now,
    progress: Callable[[str], None] = lambda _message: None,
    clock: Callable[[], float] = time.monotonic,
    on_summary: Callable[[RecordedSummary], None] = lambda _summary: None,
) -> DocumentsOnlySummary:
    """The document pass for each listed orgnr that is a stored company whose
    primary code is declared in seed/coverage.json (`codes`): first its stored
    documents are reconciled again, then its unstored ones are fetched, read
    and reconciled. Any other listed orgnr is refused and named, and nothing
    is fetched for it."""
    started = clock()
    rules = rules_of(cfg)
    summary = DocumentsOnlySummary(listed=len(orgnrs))
    on_summary(summary)
    accepted = _listed_companies(conn, codes, orgnrs, summary.refused)
    for index, orgnr in enumerate(orgnrs, start=1):
        if orgnr not in accepted:
            continue
        summary.companies += 1
        _rereconcile(conn, orgnr, rules, summary.documents, summary.failed)
        _load_documents(
            conn, transport, cfg.base_url, rules, orgnr, reader_commit, summary.documents, summary.failed, now, clock, progress
        )
        if index % 25 == 0:
            progress(f"{index} of {len(orgnrs)} listed orgnrs")
    try:
        summary.still_extracted = write.count_extracted_documents(conn)
    except psycopg.Error as error:
        _write_failed(conn, summary.failed, Problem("-", f"extracted count: {error.__class__.__name__}"), error)
    summary.wall_seconds = clock() - started
    return summary


def run_reread(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    cfg: config_module.Config,
    codes: list[str],
    orgnrs: list[str],
    *,
    reader_commit: str,
    now: Callable[[], datetime] = _now,
    progress: Callable[[str], None] = lambda _message: None,
    clock: Callable[[], float] = time.monotonic,
    on_summary: Callable[[RecordedSummary], None] = lambda _summary: None,
) -> RereadSummary:
    """Re-read mode (Story 2.3b): for each listed orgnr that is a stored
    company with a covered primary code, every stored document whose
    reader version is not `reader_commit` is fetched, read, reconciled and
    replaced (`_reread_documents`). No year without a stored document is
    fetched. Any other listed orgnr is refused and named."""
    started = clock()
    rules = rules_of(cfg)
    summary = RereadSummary(listed=len(orgnrs), reader_commit=reader_commit)
    on_summary(summary)
    accepted = _listed_companies(conn, codes, orgnrs, summary.refused)
    for index, orgnr in enumerate(orgnrs, start=1):
        if orgnr not in accepted:
            continue
        summary.companies += 1
        _reread_documents(conn, transport, cfg.base_url, rules, orgnr, reader_commit, summary, now, clock, progress)
        if index % 25 == 0:
            progress(f"{index} of {len(orgnrs)} listed orgnrs")
    summary.wall_seconds = clock() - started
    return summary


def run_companies_only(
    conn: psycopg.Connection,
    transport: fetch.Transport,
    cfg: config_module.Config,
    now: Callable[[], datetime] = _now,
    progress: Callable[[str], None] = lambda _message: None,
    on_summary: Callable[[RecordedSummary], None] = lambda _summary: None,
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
    on_summary(summary)

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
            # Stored at the start of the run, gone now: this mode deletes
            # nothing, so another run or something else did. Not the same as
            # absent from the bulk file.
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
USAGE = "usage: python -m peerless_ingest [--companies-only | --documents <file> | --reread <file>]"
DOCUMENTS = "--documents"
REREAD = "--reread"
# The reader version, set by scripts/run-ingest.ts from `git log -1
# --format=%H -- ingest/` (Story 2.3b). Required by documents and re-read mode.
READER_COMMIT_ENV = "PEERLESS_READER_COMMIT"


def reader_commit_of(env: Mapping[str, str]) -> str:
    """The reader version from PEERLESS_READER_COMMIT, a full 40-hex commit.
    Missing or malformed raises BadDocumentList, before any request."""
    value = env.get(READER_COMMIT_ENV)
    if value is None or not write.READER_COMMIT.fullmatch(value):
        raise BadDocumentList(f"{READER_COMMIT_ENV} must be a full 40-hex commit, got {value!r}")
    return value


class BadDocumentList(Exception):
    """A bad --documents or --reread argument, or no reader version."""


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


def _end_run_after_error(
    conn: psycopg.Connection, run_id: int, error: BaseException, partial: RecordedSummary | None
) -> None:
    """Ends the run record of a run that raised, with the exception's class
    and message, and the counts and failures its summary held when it
    raised (`partial`; None if it raised before making one). If even that
    write fails (the connection is gone), says so on stderr; the caller
    raises the run's own exception either way."""
    counts: Mapping[str, object] = {} if partial is None else partial.record_counts()
    failures: list[write.Failure] = [] if partial is None else partial.record_failures(finished=False)
    try:
        write.end_run(conn, run_id, _now(), counts, failures, f"{error.__class__.__name__}: {error}")
    except (psycopg.Error, ValueError) as record_error:
        print(
            f"run record {run_id} not ended: {record_error.__class__.__name__}: {record_error}",
            file=sys.stderr,
            flush=True,
        )


def main(argv: Sequence[str] | None = None) -> int:
    """`argv` is the command line after the program name (sys.argv[1:] when
    None, as from the `peerless-ingest` script): empty for a normal run,
    exactly `--companies-only`, `--documents <file>` or `--reread <file>`.
    Anything else, a file that is not a JSON list of nine-digit strings, or,
    for the last two, a missing or malformed PEERLESS_READER_COMMIT, exits 2
    before any request or connection."""
    args = list(sys.argv[1:] if argv is None else argv)
    document_list: list[str] | None = None
    reader_commit = ""
    if len(args) == 2 and args[0] in (DOCUMENTS, REREAD):
        try:
            document_list = read_document_list(Path(args[1]))
            reader_commit = reader_commit_of(os.environ)
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
    if companies_only:
        mode = "companies_only"
    elif document_list is not None:
        mode = "reread" if args[0] == REREAD else "documents"
    else:
        mode = "plain"
    summary: Summary | CompaniesOnlySummary | DocumentsOnlySummary | RereadSummary
    with write.connect(config_module.database_url()) as conn:
        # The run record (Story 2.4): inserted now, ended below, also when
        # the run ends in an exception.
        run_id = write.start_run(conn, mode, _now())
        print(f"run record: run.step1 id {run_id} ({mode})", file=sys.stderr, flush=True)
        # The summary as the run builds it, so a run that raises still
        # records the counts and failures collected before the exception.
        partial: list[RecordedSummary] = []
        try:
            if mode == "companies_only":
                summary = run_companies_only(conn, transport, cfg, progress=_progress, on_summary=partial.append)
            elif mode == "reread" and document_list is not None:
                summary = run_reread(
                    conn, transport, cfg, codes, document_list,
                    reader_commit=reader_commit, progress=_progress, on_summary=partial.append,
                )
            elif mode == "documents" and document_list is not None:
                summary = run_documents(
                    conn, transport, cfg, codes, document_list,
                    reader_commit=reader_commit, progress=_progress, on_summary=partial.append,
                )
            else:
                summary = run(conn, transport, cfg, codes, progress=_progress, run_id=run_id, on_summary=partial.append)
        except BaseException as error:
            _end_run_after_error(conn, run_id, error, partial[0] if partial else None)
            raise
        write.end_run(conn, run_id, _now(), summary.record_counts(), summary.record_failures(), None)
    for line in summary.lines():
        print(line)
    return 1 if summary.needs_operator() else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
