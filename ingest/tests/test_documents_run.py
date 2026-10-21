"""The document pass of step 1 (Story 2.1b): which documents are fetched,
what is stored for each read, resuming an interrupted run, and documents
mode (`--documents <file>`).

Recorded and hand-built Tesseract output stands in for Tesseract
(`document_fakes.FakeRecognise`); every request goes through
`FixtureTransport`, which fails the test on any URL it was not given. Each
test runs inside a transaction that is rolled back (conftest `db`).
"""

from __future__ import annotations

import dataclasses
import json
from datetime import UTC, datetime
from pathlib import Path

import psycopg
import pytest

from conftest import BASE_URL, BOUND_KR, RULES, FixtureTransport, aar_url, enhet_url, ingest_database_url, kopi_url, recorded, regnskap_url
from document_fakes import DOCUMENTS, FakeRecognise, Recognised, generated, paper_top, pdf, recorded_979607008_2025
from peerless_ingest import documents, ocr, parse, run, write
from peerless_ingest.config import Config
from test_write import company, count

READ_AT = datetime(2026, 10, 20, 9, 0, tzinfo=UTC)
ORGNR = "979607008"
CODES = ["69.202"]  # the primary code test_write.company() stores


def documents_of(conn: psycopg.Connection, orgnr: str) -> list[tuple]:
    return conn.execute(
        """select filing_year, layout, status, refusal,
                  (select count(*) from register.document_column c
                    where c.orgnr = d.orgnr and c.filing_year = d.filing_year)
           from register.document d where orgnr = %s order by filing_year""",
        (orgnr,),
    ).fetchall()


def kopi_requests(transport: FixtureTransport) -> list[str]:
    return [url for url in transport.requested if "/aarsregnskap/kopi/" in url and not url.endswith("/aar")]


@pytest.fixture
def stored(db: psycopg.Connection) -> psycopg.Connection:
    """979607008 stored as a company of the covered code CODES."""
    write.write_company(db, company(ORGNR, "STATEMENT AS"))
    return db


def test_fetches_only_2021_2025_from_year_list(stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    years = range(2019, 2026)
    reader = FakeRecognise(monkeypatch, {pdf(str(y)): generated(y) for y in years})
    responses: dict[str, bytes | None] = {aar_url(ORGNR): json.dumps([str(y) for y in years]).encode()}
    responses |= {kopi_url(ORGNR, y): pdf(str(y)) for y in years}
    transport = FixtureTransport(responses)

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)

    assert kopi_requests(transport) == [kopi_url(ORGNR, y) for y in range(2021, 2026)]
    assert reader.calls == [pdf(str(y)) for y in range(2021, 2026)]
    # The year is in the path, never a query parameter (the register ignores år).
    assert not any("?" in url or "r=" in url for url in transport.requested)
    assert summary.documents.outside_years == 2
    assert [row[0] for row in documents_of(stored, ORGNR)] == [2021, 2022, 2023, 2024, 2025]


def test_year_mismatch_is_refused(stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    # The path says 2024; the document's header says 2025 (and 2024).
    FakeRecognise(monkeypatch, {pdf("2024"): recorded_979607008_2025()})
    transport = FixtureTransport({aar_url(ORGNR): b'["2024"]', kopi_url(ORGNR, 2024): pdf("2024")})

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)

    assert documents_of(stored, ORGNR) == [(2024, "generated", "not_extracted", "year_mismatch", 0)]
    assert summary.documents.written == {(2024, "not_extracted"): 1}


def test_paper_never_read(stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    # The committed 2011 paper filing, served under 2021. The real recognise
    # runs; only Tesseract is replaced: page 1's top reads as the cover form.
    body = (DOCUMENTS / "979607008-2011.pdf").read_bytes()
    tops: list[bytes] = []

    def top(pdf_bytes: bytes, workdir: Path) -> list[ocr.Word]:
        tops.append(pdf_bytes)
        return paper_top()

    def figure_pages(pdf_bytes: bytes, workdir: Path) -> list[ocr.PageWords]:
        raise AssertionError("a paper filing's figure pages must never be read")

    monkeypatch.setattr(ocr, "ocr_top", top)
    monkeypatch.setattr(ocr, "ocr_figure_pages", figure_pages)
    transport = FixtureTransport({aar_url(ORGNR): b'["2021"]', kopi_url(ORGNR, 2021): body})

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)

    assert tops == [body]
    assert documents_of(stored, ORGNR) == [(2021, "paper", "paper", None, 0)]
    assert summary.documents.written == {(2021, "paper"): 1}
    assert summary.failed == []


def test_refusal_and_ocr_error_store_not_extracted(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    def tesseract_fails() -> Recognised:
        raise ocr.OcrError("tesseract failed (digits pass, exit 123)", ["p3.png"], "Error, could not read image p3.png")

    FakeRecognise(
        monkeypatch,
        {
            pdf("2023"): generated(2023, unit_line="Beløp i: NOK 1000"),
            pdf("2024"): tesseract_fails,
            pdf("2025"): recorded_979607008_2025(),
        },
    )
    responses: dict[str, bytes | None] = {aar_url(ORGNR): b'["2023", "2024", "2025"]'}
    responses |= {kopi_url(ORGNR, y): pdf(str(y)) for y in (2023, 2024, 2025)}
    transport = FixtureTransport(responses)

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)

    # The scaled unit is refused, the OCR error is stored and named, and the
    # run goes on to 2025.
    assert documents_of(stored, ORGNR) == [
        (2023, "generated", "not_extracted", "reporting_unit", 0),
        (2024, None, "not_extracted", "ocr_error", 0),
        (2025, "generated", "reconciled", None, 2),
    ]
    assert [p.what for p in summary.documents.ocr_errors] == [
        "document 2024: tesseract failed (digits pass, exit 123) on p3.png: Error, could not read image p3.png"
    ]
    assert summary.failed == []
    assert summary.needs_operator()  # stored for good: a person must look at it
    text = "\n".join(summary.lines())
    assert "OCR error, stored as not_extracted: 979607008 document 2024" in text
    assert "    written: reconciled 1, failed_reconciliation 0, not_extracted 2, paper 0" in text


class InterruptingTransport(FixtureTransport):
    """Raises KeyboardInterrupt (the operator's Ctrl-C) on one URL, once."""

    def __init__(self, responses: dict[str, bytes | None], interrupt_at: str) -> None:
        super().__init__(responses)
        self.interrupt_at: str | None = interrupt_at

    def get(self, url: str, accept: str) -> bytes | None:
        if url == self.interrupt_at:
            self.interrupt_at = None
            self.requested.append(url)
            raise KeyboardInterrupt
        return super().get(url, accept)


def test_interrupted_run_resumes_without_redoing(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    years = (2022, 2023, 2024, 2025)
    reader = FakeRecognise(monkeypatch, {pdf(str(y)): generated(y) for y in years})
    responses: dict[str, bytes | None] = {aar_url(ORGNR): json.dumps([str(y) for y in years]).encode()}
    responses |= {kopi_url(ORGNR, y): pdf(str(y)) for y in years}

    # Stopped while fetching the third document: the first two are committed.
    first = InterruptingTransport(responses, interrupt_at=kopi_url(ORGNR, 2024))
    with pytest.raises(KeyboardInterrupt):
        run.run_documents(stored, first, cfg, CODES, [ORGNR], now=lambda: READ_AT)
    assert [row[0] for row in documents_of(stored, ORGNR)] == [2022, 2023]
    assert count(stored, "select count(*) from register.document_column where orgnr = %s", ORGNR) == 4

    # The rerun fetches and reads only the other two.
    second = FixtureTransport(responses)
    summary = run.run_documents(stored, second, cfg, CODES, [ORGNR], now=lambda: READ_AT)
    assert kopi_requests(second) == [kopi_url(ORGNR, 2024), kopi_url(ORGNR, 2025)]
    assert summary.documents.skipped_stored == 2
    assert reader.calls == [pdf(str(y)) for y in years]  # each document read once
    assert [row[0] for row in documents_of(stored, ORGNR)] == [2022, 2023, 2024, 2025]


def test_stored_document_not_refetched(stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    outcome = write.document_outcome(2025, documents.read_words(*recorded_979607008_2025(), BOUND_KR), {}, RULES)
    write.write_document(stored, ORGNR, 2025, outcome, None, READ_AT)
    reader = FakeRecognise(monkeypatch, {})
    # No kopi URL for 2025: a request for it would fail the test.
    transport = FixtureTransport({aar_url(ORGNR): b'["2025"]'})

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)

    assert transport.requested == [aar_url(ORGNR)]
    assert reader.calls == []
    assert summary.documents.skipped_stored == 1
    assert summary.documents.written == {}


def test_normal_run_fetches_no_document(db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    # Meinich, 2026-10-20: a plain `pnpm ingest` is the register and API run
    # as before; filed documents are read only with --documents <file>. The
    # covered company's document list and PDF are served, so a run that asked
    # for them would get them: the assertions, not the transport, catch it.
    reader = FakeRecognise(monkeypatch, {pdf("2025"): generated(2025)})
    responses: dict[str, bytes | None] = {
        regnskap_url("919951834"): recorded("regnskap_919951834.json"),
        enhet_url("967534579"): recorded("enhet_967534579.json"),
        regnskap_url("967534579"): recorded("regnskap_967534579.json"),
        aar_url("919951834"): b'["2025"]',
        kopi_url("919951834", 2025): pdf("2025"),
    }
    transport = FixtureTransport(responses, bulk=recorded("enheter_lastned.json"))

    summary = run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert summary.codes["62.100"].filings_written == 3
    assert [url for url in transport.requested if "/aarsregnskap/kopi/" in url] == []
    assert reader.calls == []
    assert documents_of(db, "919951834") == []
    assert "  No filed document fetched (documents mode reads them: --documents <file>)." in summary.lines()

def test_a_failed_document_fetch_costs_only_that_document(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    FakeRecognise(monkeypatch, {pdf("2025"): generated(2025)})
    transport = FixtureTransport(
        {
            aar_url(ORGNR): b'["2024", "2025"]',
            kopi_url(ORGNR, 2024): b"<html>not a pdf</html>",
            kopi_url(ORGNR, 2025): pdf("2025"),
        }
    )
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)
    assert [p.what for p in summary.failed] == ["document 2024: ValueError: document 979607008/2024: the body is not a PDF"]
    assert summary.needs_operator()
    # 2024 is not stored, so a rerun tries it again; 2025 is.
    assert [row[0] for row in documents_of(stored, ORGNR)] == [2025]


def test_a_listed_year_not_served_is_named_and_the_next_is_stored(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    FakeRecognise(monkeypatch, {pdf("2025"): generated(2025)})
    transport = FixtureTransport(
        {aar_url(ORGNR): b'["2024", "2025"]', kopi_url(ORGNR, 2024): None, kopi_url(ORGNR, 2025): pdf("2025")}
    )
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)
    assert [p.what for p in summary.failed] == ["document 2024: listed in /aar but not served (404 or 410)"]
    assert summary.needs_operator()
    assert [row[0] for row in documents_of(stored, ORGNR)] == [2025]


def test_a_read_that_fails_otherwise_is_named_not_stored_and_the_run_goes_on(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken() -> Recognised:
        raise ValueError("something unexpected")

    FakeRecognise(monkeypatch, {pdf("2024"): broken, pdf("2025"): generated(2025)})
    transport = FixtureTransport(
        {aar_url(ORGNR): b'["2024", "2025"]', kopi_url(ORGNR, 2024): pdf("2024"), kopi_url(ORGNR, 2025): pdf("2025")}
    )
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)
    assert [p.what for p in summary.failed] == ["document 2024: read failed: ValueError: something unexpected"]
    assert summary.needs_operator()
    # 2024 is not stored, so a rerun retries it.
    assert [row[0] for row in documents_of(stored, ORGNR)] == [2025]


def test_a_malformed_year_list_costs_that_company_only(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    reader = FakeRecognise(monkeypatch, {})
    transport = FixtureTransport({aar_url(ORGNR): b'{"years": ["2025"]}'})
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)
    assert [(p.orgnr, p.what) for p in summary.failed] == [
        (ORGNR, f"document years: ValueError: document years {ORGNR}: expected a JSON list of four-digit year strings")
    ]
    assert transport.requested == [aar_url(ORGNR)]
    assert reader.calls == []
    assert documents_of(stored, ORGNR) == []


def test_a_company_with_no_document_list_is_counted_and_named(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    FakeRecognise(monkeypatch, {})
    transport = FixtureTransport({aar_url(ORGNR): None})
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)
    assert summary.documents.no_document_list == [ORGNR]
    assert summary.failed == []
    lines = summary.lines()
    assert "    companies with no list of filed documents (404 or 410): 1" in lines
    assert f"    no list of filed documents: {ORGNR}" in lines


def test_connect_commits_each_transaction(db: psycopg.Connection) -> None:
    # The `db` fixture runs every test inside one outer transaction, so the
    # resume test cannot see real commits. What makes them real in a run is
    # this: `write.connect` returns an autocommit connection, on which each
    # document's `conn.transaction()` is its own committed transaction.
    url = ingest_database_url()
    assert url is not None
    conn = write.connect(url)
    try:
        assert conn.autocommit is True
    finally:
        conn.close()


def test_documents_mode_only_listed_orgnrs(db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    other = "919951834"
    uncovered = "967534579"
    unknown = "000000019"
    assert count(db, "select count(*) from register.company where orgnr = %s", unknown) == 0
    write.write_company(db, company(ORGNR, "STATEMENT AS"))
    write.write_company(db, company(other, "OTHER AS"))
    write.write_company(db, dataclasses.replace(company(uncovered, "KANTALL AS"), naeringskode1="62.100"))
    reader = FakeRecognise(monkeypatch, {pdf("a"): generated(2025), pdf("b"): generated(2025)})
    transport = FixtureTransport(
        {
            aar_url(ORGNR): b'["2025"]',
            kopi_url(ORGNR, 2025): pdf("a"),
            aar_url(other): b'["2025"]',
            kopi_url(other, 2025): pdf("b"),
        }
    )

    summary = run.run_documents(db, transport, cfg, CODES, [ORGNR, unknown, other, uncovered], now=lambda: READ_AT)

    assert len(reader.calls) == 2
    assert summary.companies == 2
    assert [(p.orgnr, p.what) for p in summary.refused] == [
        (unknown, "not a stored company (register.company)"),
        (uncovered, "primary code 62.100 is not covered (seed/coverage.json)"),
    ]
    assert summary.needs_operator()
    # No bulk download, no key figures, nothing for the refused orgnrs.
    assert not any("lastned" in url for url in transport.requested)
    assert regnskap_url(ORGNR) not in transport.requested and regnskap_url(other) not in transport.requested
    assert not any(unknown in url or uncovered in url for url in transport.requested)
    assert all(url.startswith(f"{BASE_URL}/regnskapsregisteret/regnskap/aarsregnskap/kopi/") for url in transport.requested)
    text = "\n".join(summary.lines())
    assert f"refused, not fetched: {unknown}" in text


@pytest.mark.parametrize(
    "content",
    [
        None,  # --documents with no file
        "not json",
        '{"orgnr": "979607008"}',
        "[979607008]",
        '["97960700"]',
        '["979607008 "]',
        '["979607008\\n"]',  # `$` would accept a trailing newline; fullmatch does not
        '["979607008", "979607008"]',
    ],
)
def test_documents_mode_rejects_bad_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, content: str | None) -> None:
    def no_network(*args: object, **kwargs: object) -> None:
        raise AssertionError("nothing may be fetched for a bad --documents argument")

    def no_database(*args: object, **kwargs: object) -> None:
        raise AssertionError("no connection for a bad --documents argument")

    monkeypatch.setattr(run.fetch, "UrllibTransport", no_network)
    monkeypatch.setattr(run.write, "connect", no_database)
    if content is None:
        argv = ["--documents"]
    else:
        file = tmp_path / "documents.json"
        file.write_text(content, encoding="utf-8")
        argv = ["--documents", str(file)]
    assert run.main(argv) == 2


def test_documents_mode_rejects_a_missing_file_and_other_arguments(tmp_path: Path) -> None:
    assert run.main(["--documents", str(tmp_path / "absent.json")]) == 2
    assert run.main(["--documents", "a.json", "b.json"]) == 2
    assert run.main(["--companies-only", "--documents", "a.json"]) == 2


def test_read_document_list_accepts_distinct_orgnrs(tmp_path: Path) -> None:
    file = tmp_path / "documents.json"
    file.write_text('["979607008", "919951834"]', encoding="utf-8")
    assert run.read_document_list(file) == ["979607008", "919951834"]


def as_extracted(conn: psycopg.Connection, orgnr: str, year: int) -> None:
    """A stored document as a dump made before Story 2.2 restores it: status
    `extracted`, its columns with no reconciliation, and c1-c4 as some
    earlier bound left them."""
    conn.execute(
        """update register.document_column set status = null, api_check = null, api_fail_fields = null, c1 = 'fail'
            where orgnr = %s and filing_year = %s""",
        (orgnr, year),
    )
    conn.execute("update register.document set status = 'extracted' where orgnr = %s and filing_year = %s", (orgnr, year))


def column_reconciliation(conn: psycopg.Connection, orgnr: str) -> list[tuple]:
    return conn.execute(
        """select filing_year, role, c1, c2, c3, c4, status, api_check, api_fail_fields
             from register.document_column where orgnr = %s order by filing_year, role""",
        (orgnr,),
    ).fetchall()


def test_stored_documents_reconciled_without_ocr(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    # 2025 (with its API filing) and 2022 (none) stored as `extracted`; the
    # register lists only those years, and no kopi URL is served.
    [filing] = [parse.parse_filing(raw, ORGNR, READ_AT) for raw in parse.load_filings_json(recorded("regnskap_979607008_2025.json"))]
    write.write_filing(stored, filing)
    for year, words in ((2025, recorded_979607008_2025()), (2022, generated(2022))):
        outcome = write.document_outcome(year, documents.read_words(*words, BOUND_KR), {}, RULES)
        write.write_document(stored, ORGNR, year, outcome, None, READ_AT)
        as_extracted(stored, ORGNR, year)
    reader = FakeRecognise(monkeypatch, {})
    transport = FixtureTransport({aar_url(ORGNR): b'["2022", "2025"]'})

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], now=lambda: READ_AT)

    assert kopi_requests(transport) == [] and reader.calls == []  # no PDF fetched, no OCR
    assert summary.failed == []
    assert [row[:3] for row in documents_of(stored, ORGNR)] == [(2022, "generated", "reconciled"), (2025, "generated", "reconciled")]
    assert column_reconciliation(stored, ORGNR) == [
        (2022, "current", "pass", "pass", "pass", "pass", "reconciled", "not_evaluable", []),
        (2022, "prior", "pass", "pass", "pass", "pass", "reconciled", "not_evaluable", []),
        (2025, "current", "pass", "pass", "pass", "pass", "reconciled", "pass", []),
        (2025, "prior", "pass", "pass", "pass", "pass", "reconciled", "not_evaluable", []),
    ]
    assert summary.documents.rereconciled == {(2022, "reconciled"): 1, (2025, "reconciled"): 1}
    assert summary.documents.written == {}
    assert "      2025: reconciled 1, failed_reconciliation 0" in summary.lines()

    # Idempotent: a second run gives the same rows.
    before = column_reconciliation(stored, ORGNR)
    run.run_documents(stored, FixtureTransport({aar_url(ORGNR): b'["2022", "2025"]'}), cfg, CODES, [ORGNR], now=lambda: READ_AT)
    assert column_reconciliation(stored, ORGNR) == before

    # A changed bound takes effect on the next run, from the stored figures:
    # at 0 kr the 2024 column of 979607008/2025, whose c2 is one krone off,
    # fails; the filing keeps its current column's status.
    tight = dataclasses.replace(cfg, within_document_bound_kr=0)
    transport = FixtureTransport({aar_url(ORGNR): b'["2022", "2025"]'})
    summary = run.run_documents(stored, transport, tight, CODES, [ORGNR], now=lambda: READ_AT)
    assert reader.calls == []
    assert [row[2] for row in documents_of(stored, ORGNR)] == ["reconciled", "reconciled"]
    assert column_reconciliation(stored, ORGNR)[3] == (
        2025, "prior", "pass", "fail", "pass", "pass", "failed_reconciliation", "not_evaluable", []
    )
    # 2022's hand-built prior column copies those 2024 figures: it fails too.
    assert column_reconciliation(stored, ORGNR)[1][6] == "failed_reconciliation"
    assert summary.documents.prior_failed == 2
