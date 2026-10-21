"""Writes step 1's rows as the `ingest` role (INGEST_DATABASE_URL).

Upserts and column updates, no DDL and no DELETE: the tables come from
supabase/migrations, and `ingest` holds SELECT, INSERT and UPDATE on them and
nothing else. A filing and its key figures are written in one transaction,
both or neither; so is a filed document and its figure columns (Story 2.1b).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime

import psycopg
from psycopg import sql

from .documents import FIELDS, Column, DocumentRead
from .parse import KEY_FIGURE_COLUMNS, Company, Filing
from .reconcile import SHARED_FIELDS, Reconciliation, Role, Rules, document_status, reconcile_column

# What search shows (Story 1.5a) and when it was read. A normal run writes
# them with the rest of the company; companies-only mode writes only these.
SEARCH_FIELD_COLUMNS = (
    "forretningsadresse_kommunenummer",
    "forretningsadresse_kommune",
    "naeringskode1_beskrivelse",
    "search_fields_read_at",
)

COMPANY_COLUMNS = (
    "orgnr",
    "navn",
    "organisasjonsform",
    "naeringskode1",
    "naeringskode2",
    "naeringskode3",
    "konkurs",
    "under_avvikling",
    "under_tvangsavvikling",
    "read_at",
    *SEARCH_FIELD_COLUMNS,
)

FILING_COLUMNS = (
    "orgnr",
    "regnskapstype",
    "periode_fra",
    "periode_til",
    "brreg_id",
    "journalnr",
    "filing_year",
    "valuta",
    "regnskapsregler",
    "smaa_foretak",
    "avviklingsregnskap",
    "oppstillingsplan",
    "reporting_unit",
    "status",
    "read_at",
)
# The filing's identity: company and group accounts for the same period are
# two filings. The register's own id may change when it reissues a filing.
FILING_KEY = ("orgnr", "regnskapstype", "periode_fra", "periode_til")


def connect(url: str) -> psycopg.Connection:
    # Autocommit: each `conn.transaction()` below is a real transaction. In
    # the tests the same calls run inside an outer transaction, where they
    # become savepoints, and the outer transaction is rolled back.
    return psycopg.connect(url, autocommit=True)


def _upsert(table: str, columns: tuple[str, ...], key: tuple[str, ...]) -> sql.Composed:
    updates = [column for column in columns if column not in key]
    return sql.SQL("INSERT INTO register.{table} ({columns}) VALUES ({values}) ON CONFLICT ({key}) DO UPDATE SET {updates}").format(
        table=sql.Identifier(table),
        columns=sql.SQL(", ").join(map(sql.Identifier, columns)),
        values=sql.SQL(", ").join(sql.Placeholder(column) for column in columns),
        key=sql.SQL(", ").join(map(sql.Identifier, key)),
        updates=sql.SQL(", ").join(
            sql.SQL("{column} = EXCLUDED.{column}").format(column=sql.Identifier(column)) for column in updates
        ),
    )


UPSERT_COMPANY = _upsert("company", COMPANY_COLUMNS, ("orgnr",))
UPSERT_FILING = _upsert("filing", FILING_COLUMNS, FILING_KEY)
UPSERT_KEY_FIGURES = _upsert("key_figures", ("brreg_id", *KEY_FIGURE_COLUMNS), ("brreg_id",))
UPDATE_SEARCH_FIELDS = sql.SQL("UPDATE register.company SET {updates} WHERE orgnr = {orgnr}").format(
    updates=sql.SQL(", ").join(
        sql.SQL("{column} = {value}").format(column=sql.Identifier(column), value=sql.Placeholder(column))
        for column in SEARCH_FIELD_COLUMNS
    ),
    orgnr=sql.Placeholder("orgnr"),
)


def write_company(conn: psycopg.Connection, company: Company) -> None:
    """Keyed on orgnr only: a company that changed its name is one row,
    holding the name the register gives now."""
    with conn.transaction():
        conn.execute(UPSERT_COMPANY, {column: getattr(company, column) for column in COMPANY_COLUMNS})


def update_company_search_fields(conn: psycopg.Connection, company: Company, read_at: datetime) -> bool:
    """Companies-only mode: sets the three search fields of an existing
    company, and `search_fields_read_at` to `read_at`, the time of the bulk
    read. Touches no other column (`navn` and `read_at` stay as they were)
    and inserts nothing. Returns whether a row with the orgnr exists."""
    values = {column: getattr(company, column) for column in SEARCH_FIELD_COLUMNS}
    values["search_fields_read_at"] = read_at
    with conn.transaction():
        cursor = conn.execute(UPDATE_SEARCH_FIELDS, {**values, "orgnr": company.orgnr})
        return cursor.rowcount == 1


def write_filing(conn: psycopg.Connection, filing: Filing) -> None:
    """The filing and its key figures, in one transaction. A reissued filing
    (same orgnr, type and period, new register id) updates the existing row;
    `key_figures` follows the new id through ON UPDATE CASCADE."""
    with conn.transaction():
        conn.execute(UPSERT_FILING, {column: getattr(filing, column) for column in FILING_COLUMNS})
        conn.execute(UPSERT_KEY_FIGURES, {"brreg_id": filing.brreg_id, **filing.key_figures})


# --- Filed documents (Story 2.1b) ---------------------------------------------------

# Step 1 writes the full dataset; `demo` rows exist only in a seed (AD-9).
# The tag is provenance only.
DATASET = "full"

DOCUMENT_COLUMNS = (
    "orgnr",
    "filing_year",
    "brreg_id",
    "layout",
    "status",
    "refusal",
    "valuta",
    "unit_text",
    "read_at",
    "dataset",
)
DOCUMENT_KEY = ("orgnr", "filing_year")
FIGURE_COLUMNS = tuple(f"{field}_ore" for field in FIELDS)
DOCUMENT_COLUMN_COLUMNS = (
    "orgnr",
    "filing_year",
    "role",
    "stated_year",
    "c1",
    "c2",
    "c3",
    "c4",
    "c5",
    "digits_pass_fields",
    *FIGURE_COLUMNS,
    "dataset",
    "status",
    "api_check",
    "api_fail_fields",
)
DOCUMENT_COLUMN_KEY = ("orgnr", "filing_year", "role")

UPSERT_DOCUMENT = _upsert("document", DOCUMENT_COLUMNS, DOCUMENT_KEY)
UPSERT_DOCUMENT_COLUMN = _upsert("document_column", DOCUMENT_COLUMN_COLUMNS, DOCUMENT_COLUMN_KEY)


def to_ore(whole: int | None) -> int | None:
    """A figure as printed, in whole currency units, to øre: times 100 on an
    int, never through a float (AD-14). None (absent or unreadable) stays
    None, never 0; a printed 0 is 0. Step 1's one unit conversion (AD-1)."""
    if whole is None:
        return None
    if type(whole) is not int:
        raise TypeError(f"a figure must be an int of whole units, got {type(whole).__name__}")
    return whole * 100


@dataclass(frozen=True)
class OutcomeColumn:
    """One column as read, with its reconciliation (Story 2.2)."""

    role: Role
    column: Column
    reconciliation: Reconciliation


@dataclass(frozen=True)
class DocumentOutcome:
    """What is stored for one filed document: its row and its columns."""

    layout: str | None
    status: str
    refusal: str | None
    valuta: str | None
    unit_text: str | None
    columns: tuple[OutcomeColumn, ...]  # current, then prior


# Tesseract failed (ocr.OcrError): nothing was read, not even the layout.
OCR_FAILED = DocumentOutcome(None, "not_extracted", "ocr_error", None, None, ())

ApiFigures = Mapping[str, int | None]


def figures_ore(column: Column) -> dict[str, int | None]:
    """A read column's figures in øre, keyed by field name."""
    return {field: to_ore(column.figures[field]) for field in FIELDS}


def document_outcome(
    filing_year: int,
    read: DocumentRead,
    api_by_year: Mapping[int, ApiFigures | None],
    rules: Rules,
) -> DocumentOutcome:
    """The status of a read:

    - `paper`: a paper filing, never read beyond page 1's top;
    - `not_extracted`: an unknown layout, a refusal from the read
      (`reporting_unit`, `year_header`), or a current column whose stated
      year is not `filing_year` (`year_mismatch`, no columns);
    - `reconciled` or `failed_reconciliation`: read, with both columns, each
      reconciled (Story 2.2) against the API figures of its stated year in
      `api_by_year` (missing or None: no API filing). The document's status
      is its current column's.
    """
    if read.layout == "paper":
        return DocumentOutcome("paper", "paper", None, None, None, ())
    if read.layout == "unknown":
        return DocumentOutcome("unknown", "not_extracted", None, None, None, ())
    if read.refusal is not None:
        return DocumentOutcome("generated", "not_extracted", read.refusal, read.valuta, read.unit_text, ())
    if read.current is None or read.prior is None:
        raise ValueError("a generated read with no refusal must have both columns")
    if read.current.year != filing_year:
        return DocumentOutcome("generated", "not_extracted", "year_mismatch", read.valuta, read.unit_text, ())
    roles: tuple[tuple[Role, Column], ...] = (("current", read.current), ("prior", read.prior))
    columns = tuple(
        OutcomeColumn(role, column, reconcile_column(role, figures_ore(column), api_by_year.get(column.year), rules))
        for role, column in roles
    )
    status = document_status([(c.role, c.reconciliation) for c in columns])
    return DocumentOutcome("generated", status, None, read.valuta, read.unit_text, columns)


def stored_document_years(conn: psycopg.Connection, orgnr: str) -> set[int]:
    """The filing years of `orgnr` that already have a document row. A rerun
    skips them: neither fetched nor read again."""
    rows = conn.execute("SELECT filing_year FROM register.document WHERE orgnr = %s", (orgnr,)).fetchall()
    return {int(row[0]) for row in rows}


def filing_brreg_id(conn: psycopg.Connection, orgnr: str, filing_year: int) -> int | None:
    """The register id of the key-figures API filing for the same orgnr and
    year, when exactly one SELSKAP filing matches; None otherwise (the API
    holds only the latest years, and two periods ending in one year are not
    guessed between)."""
    rows = conn.execute(
        """SELECT brreg_id FROM register.filing
           WHERE orgnr = %s AND filing_year = %s AND regnskapstype = 'SELSKAP'""",
        (orgnr, filing_year),
    ).fetchall()
    return int(rows[0][0]) if len(rows) == 1 else None


def write_document(
    conn: psycopg.Connection,
    orgnr: str,
    filing_year: int,
    outcome: DocumentOutcome,
    brreg_id: int | None,
    read_at: datetime,
) -> None:
    """The document row and its columns, in one transaction: committed on its
    own, so a run stopped after it does not redo it. Figures go in as printed,
    times 100; nothing is derived (AD-15)."""
    with conn.transaction():
        conn.execute(
            UPSERT_DOCUMENT,
            {
                "orgnr": orgnr,
                "filing_year": filing_year,
                "brreg_id": brreg_id,
                "layout": outcome.layout,
                "status": outcome.status,
                "refusal": outcome.refusal,
                "valuta": outcome.valuta,
                "unit_text": outcome.unit_text,
                "read_at": read_at,
                "dataset": DATASET,
            },
        )
        for item in outcome.columns:
            column, rec = item.column, item.reconciliation
            values: dict[str, object] = {
                "orgnr": orgnr,
                "filing_year": filing_year,
                "role": item.role,
                "stated_year": column.year,
                "c1": rec.c1,
                "c2": rec.c2,
                "c3": rec.c3,
                "c4": rec.c4,
                "c5": rec.c5,
                "digits_pass_fields": list(column.digits_pass_fields),
                "dataset": DATASET,
                "status": rec.status,
                "api_check": rec.api.check,
                "api_fail_fields": list(rec.api.fail_fields),
            }
            for field in FIELDS:
                values[f"{field}_ore"] = to_ore(column.figures[field])
            conn.execute(UPSERT_DOCUMENT_COLUMN, values)


# --- Reconciling stored documents (Story 2.2) ---------------------------------------

# The statuses of a stored document that was read, before Story 2.2
# (`extracted`) or since. Only these have columns to reconcile.
READ_STATUSES = ("extracted", "reconciled", "failed_reconciliation")


@dataclass(frozen=True)
class StoredColumn:
    role: Role
    stated_year: int
    figures_ore: dict[str, int | None]  # keyed by field name, as stored


@dataclass(frozen=True)
class StoredDocument:
    filing_year: int
    status: str
    columns: tuple[StoredColumn, ...]  # current first


def api_figures(conn: psycopg.Connection, orgnr: str, year: int) -> dict[str, int | None] | None:
    """The SHARED_FIELDS of the key-figures API filing of `orgnr` for `year`
    (the one SELSKAP filing `filing_brreg_id` finds), in øre, keyed by field
    name; None when there is no such filing."""
    brreg_id = filing_brreg_id(conn, orgnr, year)
    if brreg_id is None:
        return None
    query = sql.SQL("SELECT {columns} FROM register.key_figures WHERE brreg_id = %s").format(
        columns=sql.SQL(", ").join(sql.Identifier(f"{field}_ore") for field in SHARED_FIELDS)
    )
    row = conn.execute(query, (brreg_id,)).fetchone()
    if row is None:
        return None
    return {field: (None if value is None else int(value)) for field, value in zip(SHARED_FIELDS, row, strict=True)}


def stored_generated_documents(conn: psycopg.Connection, orgnr: str) -> list[StoredDocument]:
    """Every stored document of `orgnr` that was read (READ_STATUSES), with
    its columns' figures as stored. Nothing is fetched or read again."""
    rows = conn.execute(
        """SELECT filing_year, status FROM register.document
            WHERE orgnr = %s AND status = ANY(%s) ORDER BY filing_year""",
        (orgnr, list(READ_STATUSES)),
    ).fetchall()
    query = sql.SQL(
        """SELECT filing_year, role, stated_year, {figures} FROM register.document_column
            WHERE orgnr = %s ORDER BY filing_year, role"""
    ).format(figures=sql.SQL(", ").join(map(sql.Identifier, FIGURE_COLUMNS)))
    columns: dict[int, list[StoredColumn]] = {}
    for row in conn.execute(query, (orgnr,)).fetchall():
        figures = {field: (None if value is None else int(value)) for field, value in zip(FIELDS, row[3:], strict=True)}
        columns.setdefault(int(row[0]), []).append(StoredColumn(row[1], int(row[2]), figures))
    return [
        StoredDocument(
            int(year), status, tuple(sorted(columns.get(int(year), []), key=lambda c: 0 if c.role == "current" else 1))
        )
        for year, status in rows
    ]


UPDATE_COLUMN_RECONCILIATION = """UPDATE register.document_column
   SET c1 = %(c1)s, c2 = %(c2)s, c3 = %(c3)s, c4 = %(c4)s, c5 = %(c5)s,
       status = %(status)s, api_check = %(api_check)s, api_fail_fields = %(api_fail_fields)s
 WHERE orgnr = %(orgnr)s AND filing_year = %(filing_year)s AND role = %(role)s"""


def update_reconciliation(
    conn: psycopg.Connection,
    orgnr: str,
    filing_year: int,
    status: str,
    columns: tuple[tuple[str, Reconciliation], ...],
) -> None:
    """A stored document's status and its columns' check results, in one
    transaction. No figure is touched."""
    with conn.transaction():
        for role, rec in columns:
            cursor = conn.execute(
                UPDATE_COLUMN_RECONCILIATION,
                {
                    "orgnr": orgnr,
                    "filing_year": filing_year,
                    "role": role,
                    "c1": rec.c1,
                    "c2": rec.c2,
                    "c3": rec.c3,
                    "c4": rec.c4,
                    "c5": rec.c5,
                    "status": rec.status,
                    "api_check": rec.api.check,
                    "api_fail_fields": list(rec.api.fail_fields),
                },
            )
            if cursor.rowcount != 1:
                raise ValueError(f"document {orgnr}/{filing_year}: no {role} column to update")
        cursor = conn.execute(
            "UPDATE register.document SET status = %s WHERE orgnr = %s AND filing_year = %s",
            (status, orgnr, filing_year),
        )
        if cursor.rowcount != 1:
            raise ValueError(f"document {orgnr}/{filing_year}: no row to update")
