"""Writes step 1's rows as the `ingest` role (INGEST_DATABASE_URL).

Upserts and one column update, no DDL and no DELETE: the tables come from
supabase/migrations, and `ingest` holds SELECT, INSERT and UPDATE on them and
nothing else. A filing and its key figures are written in one transaction,
both or neither.
"""

from __future__ import annotations

from datetime import datetime

import psycopg
from psycopg import sql

from .parse import KEY_FIGURE_COLUMNS, Company, Filing

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
