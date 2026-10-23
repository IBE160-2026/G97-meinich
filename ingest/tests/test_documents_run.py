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
from datetime import UTC, date, datetime
from pathlib import Path

import psycopg
import pytest

from conftest import BASE_URL, BOUND_KR, OLDER_READER_COMMIT, READER_COMMIT, RULES, FixtureTransport, aar_url, enhet_url, ingest_database_url, kopi_url, recorded, regnskap_url
from document_fakes import DOCUMENTS, FakeRecognise, Recognised, generated, paper_top, pdf, recorded_979607008_2025
from peerless_ingest import documents, ocr, parse, run, write
from peerless_ingest.config import Config
from peerless_ingest.reconcile import SHARED_FIELDS
from tsv_builder import BASE_ROWS, document, replace_row
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

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)

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

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)

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

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)

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

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)

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
        run.run_documents(stored, first, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)
    assert [row[0] for row in documents_of(stored, ORGNR)] == [2022, 2023]
    assert count(stored, "select count(*) from register.document_column where orgnr = %s", ORGNR) == 4

    # The rerun fetches and reads only the other two.
    second = FixtureTransport(responses)
    summary = run.run_documents(stored, second, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)
    assert kopi_requests(second) == [kopi_url(ORGNR, 2024), kopi_url(ORGNR, 2025)]
    assert summary.documents.skipped_stored == 2
    assert reader.calls == [pdf(str(y)) for y in years]  # each document read once
    assert [row[0] for row in documents_of(stored, ORGNR)] == [2022, 2023, 2024, 2025]


def test_stored_document_not_refetched(stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    outcome = write.document_outcome(2025, documents.read_words(*recorded_979607008_2025(), BOUND_KR), {}, RULES)
    write.write_document(stored, ORGNR, 2025, outcome, None, READ_AT, READER_COMMIT)
    reader = FakeRecognise(monkeypatch, {})
    # No kopi URL for 2025: a request for it would fail the test.
    transport = FixtureTransport({aar_url(ORGNR): b'["2025"]'})

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)

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
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)
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
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)
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
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)
    assert [p.what for p in summary.failed] == ["document 2024: read failed: ValueError: something unexpected"]
    assert summary.needs_operator()
    # 2024 is not stored, so a rerun retries it.
    assert [row[0] for row in documents_of(stored, ORGNR)] == [2025]


def test_a_malformed_year_list_costs_that_company_only(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    reader = FakeRecognise(monkeypatch, {})
    transport = FixtureTransport({aar_url(ORGNR): b'{"years": ["2025"]}'})
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)
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
    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)
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

    summary = run.run_documents(db, transport, cfg, CODES, [ORGNR, unknown, other, uncovered], reader_commit=READER_COMMIT, now=lambda: READ_AT)

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
    `extracted`, its columns with no reconciliation (c5 included), and
    c1-c4 as some earlier bound left them."""
    conn.execute(
        """update register.document_column set c5 = null, status = null, api_check = null, api_fail_fields = null, c1 = 'fail'
            where orgnr = %s and filing_year = %s""",
        (orgnr, year),
    )
    conn.execute("update register.document set status = 'extracted' where orgnr = %s and filing_year = %s", (orgnr, year))


def column_reconciliation(conn: psycopg.Connection, orgnr: str) -> list[tuple]:
    return conn.execute(
        """select filing_year, role, c1, c2, c3, c4, c5, status, api_check, api_fail_fields
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
        write.write_document(stored, ORGNR, year, outcome, None, READ_AT, READER_COMMIT)
        as_extracted(stored, ORGNR, year)
    reader = FakeRecognise(monkeypatch, {})
    transport = FixtureTransport({aar_url(ORGNR): b'["2022", "2025"]'})

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)

    assert kopi_requests(transport) == [] and reader.calls == []  # no PDF fetched, no OCR
    assert summary.failed == []
    assert [row[:3] for row in documents_of(stored, ORGNR)] == [(2022, "generated", "reconciled"), (2025, "generated", "reconciled")]
    # brreg_id is refreshed to the API filing compared with (stored as None).
    assert stored.execute(
        "select filing_year, brreg_id from register.document where orgnr = %s order by 1", (ORGNR,)
    ).fetchall() == [(2022, None), (2025, 6984522)]
    assert column_reconciliation(stored, ORGNR) == [
        (2022, "current", "pass", "pass", "pass", "pass", "pass", "reconciled", "not_evaluable", []),
        (2022, "prior", "pass", "pass", "pass", "pass", "pass", "reconciled", "not_evaluable", []),
        (2025, "current", "pass", "pass", "pass", "pass", "pass", "reconciled", "pass", []),
        (2025, "prior", "pass", "pass", "pass", "pass", "pass", "reconciled", "not_evaluable", []),
    ]
    assert summary.documents.rereconciled == {(2022, "reconciled"): 1, (2025, "reconciled"): 1}
    assert summary.documents.written == {}
    assert "      2025: reconciled 1, failed_reconciliation 0" in summary.lines()

    # Idempotent: a second run gives the same rows.
    before = column_reconciliation(stored, ORGNR)
    run.run_documents(stored, FixtureTransport({aar_url(ORGNR): b'["2022", "2025"]'}), cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)
    assert column_reconciliation(stored, ORGNR) == before

    # A changed bound takes effect on the next run, from the stored figures:
    # at 0 kr the 2024 column of 979607008/2025, whose c2 is one krone off,
    # fails; the filing keeps its current column's status.
    tight = dataclasses.replace(cfg, within_document_bound_kr=0)
    transport = FixtureTransport({aar_url(ORGNR): b'["2022", "2025"]'})
    summary = run.run_documents(stored, transport, tight, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)
    assert reader.calls == []
    assert [row[2] for row in documents_of(stored, ORGNR)] == ["reconciled", "reconciled"]
    assert column_reconciliation(stored, ORGNR)[3] == (
        2025, "prior", "pass", "fail", "pass", "pass", "pass", "failed_reconciliation", "not_evaluable", []
    )
    # 2022's hand-built prior column copies those 2024 figures: it fails too.
    assert column_reconciliation(stored, ORGNR)[1][7] == "failed_reconciliation"
    assert summary.documents.prior_failed == 2


def filing_for(base: parse.Filing, year: int, brreg_id: int, shared_ore: dict[str, int | None]) -> parse.Filing:
    """A SELSKAP key-figures filing for `year`, holding `shared_ore` (by
    field name) and nothing else."""
    figures: dict[str, int | None] = dict.fromkeys(parse.KEY_FIGURE_COLUMNS)
    figures |= {f"{field}_ore": value for field, value in shared_ore.items()}
    return dataclasses.replace(
        base,
        brreg_id=brreg_id,
        journalnr=str(brreg_id),
        filing_year=year,
        periode_fra=date(year, 1, 1),
        periode_til=date(year, 12, 31),
        key_figures=figures,
    )


def shared_of(words: Recognised, role: str) -> dict[str, int | None]:
    """The shared figures of one column of a read, in øre, as an API filing
    holding exactly them would state them."""
    read = documents.read_words(*words, BOUND_KR)
    column = read.current if role == "current" else read.prior
    assert column is not None
    figures = write.figures_ore(column)
    return {field: figures[field] for field in SHARED_FIELDS}


def api_columns(conn: psycopg.Connection, orgnr: str) -> list[tuple]:
    return conn.execute(
        """select filing_year, role, api_check, api_fail_fields, status
             from register.document_column where orgnr = %s order by filing_year, role""",
        (orgnr,),
    ).fetchall()


def test_new_reads_are_compared_with_the_api_of_both_years(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    # 2025: the recorded document, its API filing, and a 2024 filing that
    # differs from the prior column in sum eiendeler (a restated
    # comparative: information only). 2023: a statement whose prior column
    # fails c1, with a 2023 filing that differs in sum eiendeler.
    [api_2025] = [parse.parse_filing(raw, ORGNR, READ_AT) for raw in parse.load_filings_json(recorded("regnskap_979607008_2025.json"))]
    words_2023 = document(replace_row(BASE_ROWS, "Sum inntekter", prior="69 051 106"), years=("2023", "2022"))
    shared_2024 = shared_of(recorded_979607008_2025(), "prior")
    shared_2024["sum_eiendeler"] += 5_600_700  # type: ignore[operator]
    shared_2023 = shared_of(words_2023, "current")
    shared_2023["sum_eiendeler"] *= 10  # type: ignore[operator]
    write.write_filing(stored, api_2025)
    write.write_filing(stored, filing_for(api_2025, 2024, 9_000_024, shared_2024))
    write.write_filing(stored, filing_for(api_2025, 2023, 9_000_023, shared_2023))
    FakeRecognise(monkeypatch, {pdf("2023"): words_2023, pdf("2025"): recorded_979607008_2025()})
    responses: dict[str, bytes | None] = {aar_url(ORGNR): b'["2023", "2025"]'}
    responses |= {kopi_url(ORGNR, y): pdf(str(y)) for y in (2023, 2025)}

    summary = run.run_documents(stored, FixtureTransport(responses), cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)

    assert summary.failed == []
    assert api_columns(stored, ORGNR) == [
        (2023, "current", "fail", ["sum_eiendeler"], "failed_reconciliation"),
        (2023, "prior", "not_evaluable", [], "failed_reconciliation"),
        (2025, "current", "pass", [], "reconciled"),
        (2025, "prior", "fail", ["sum_eiendeler"], "reconciled"),
    ]
    assert [row[2] for row in documents_of(stored, ORGNR)] == ["failed_reconciliation", "reconciled"]
    assert summary.documents.written == {(2023, "failed_reconciliation"): 1, (2025, "reconciled"): 1}
    assert summary.documents.prior_failed == 1
    assert (
        "    prior-year columns failed_reconciliation (the filing's status is its current column's): 1" in summary.lines()
    )

    # The register's 2025 figure changes: the next run reconciles the stored
    # document again and its current column fails, naming the field.
    stored.execute("update register.key_figures set sum_gjeld_ore = sum_gjeld_ore + 100000 where brreg_id = 6984522")
    summary = run.run_documents(
        stored, FixtureTransport({aar_url(ORGNR): b'["2023", "2025"]'}), cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT
    )
    assert summary.failed == []
    assert api_columns(stored, ORGNR)[2] == (2025, "current", "fail", ["sum_gjeld"], "failed_reconciliation")
    assert [row[2] for row in documents_of(stored, ORGNR)] == ["failed_reconciliation", "failed_reconciliation"]


def test_a_stored_document_that_cannot_be_reconciled_is_named_and_the_run_goes_on(
    stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    # 2021 stored with no current column; 2023 whose API read fails; 2025 as
    # it should be. The first two are named, 2025 is reconciled.
    for year in (2021, 2023, 2025):
        outcome = write.document_outcome(year, documents.read_words(*generated(year), BOUND_KR), {}, RULES)
        if year == 2021:
            outcome = dataclasses.replace(outcome, columns=outcome.columns[1:])
        write.write_document(stored, ORGNR, year, outcome, None, READ_AT, READER_COMMIT)
        as_extracted(stored, ORGNR, year)
    real_api_figures = write.api_figures

    def api_figures(conn: psycopg.Connection, orgnr: str, year: int) -> dict[str, int | None] | None:
        if year == 2023:
            raise psycopg.OperationalError("simulated")
        return real_api_figures(conn, orgnr, year)

    monkeypatch.setattr(write, "api_figures", api_figures)
    FakeRecognise(monkeypatch, {})
    transport = FixtureTransport({aar_url(ORGNR): b'["2021", "2023", "2025"]'})

    summary = run.run_documents(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)

    assert [p.what for p in summary.failed] == [
        "document 2021: not reconciled: a read document must have exactly one current column, got 0",
        "document 2023: API figures not read: OperationalError: simulated",
    ]
    assert summary.needs_operator()
    assert [row[2] for row in documents_of(stored, ORGNR)] == ["extracted", "extracted", "reconciled"]
    assert summary.documents.rereconciled == {(2025, "reconciled"): 1}


def test_documents_still_extracted_are_counted(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    # An `extracted` row of a company not in the list stays so, and is
    # counted in the summary; the listed company's rows are reconciled.
    before = write.count_extracted_documents(db)
    other = "919951834"
    for orgnr in (ORGNR, other):
        write.write_company(db, company(orgnr, "TEST AS"))
        outcome = write.document_outcome(2025, documents.read_words(*generated(2025), BOUND_KR), {}, RULES)
        write.write_document(db, orgnr, 2025, outcome, None, READ_AT, READER_COMMIT)
        as_extracted(db, orgnr, 2025)
    FakeRecognise(monkeypatch, {})

    summary = run.run_documents(db, FixtureTransport({aar_url(ORGNR): b'["2025"]'}), cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: READ_AT)

    assert summary.still_extracted == before + 1
    assert f"  documents still extracted (not reconciled; not in this list): {before + 1}" in summary.lines()
    assert documents_of(db, other)[0][2] == "extracted"


# --- Re-read mode (Story 2.3b) -----------------------------------------------------

REREAD_AT = datetime(2026, 10, 24, 9, 0, tzinfo=UTC)

# The check rows with the bold total read as Tesseract reads it ("50M"), and
# the same statement as a reader before Story 2.3b stored it: no total row
# matched, so sum egenkapital og gjeld absent.
BOLD_ROWS = [("50M EGENKAPITAL OG GJELD", row[1], row[2]) if row[0] == "SUM EGENKAPITAL OG GJELD" else row for row in BASE_ROWS]
NO_TOTAL_ROWS = [row for row in BASE_ROWS if row[0] != "SUM EGENKAPITAL OG GJELD"]


def store_older(conn: psycopg.Connection, year: int) -> None:
    """A document of ORGNR for `year` as an older reader version stored it."""
    words = document(NO_TOTAL_ROWS, years=(str(year), str(year - 1)))
    outcome = write.document_outcome(year, documents.read_words(*words, BOUND_KR), {}, RULES)
    write.write_document(conn, ORGNR, year, outcome, None, READ_AT, OLDER_READER_COMMIT)


def stored_rows(conn: psycopg.Connection, orgnr: str) -> list[tuple]:
    """Each document's row and its columns' figures, as stored."""
    figures = ", ".join(f"c.{column}" for column in write.FIGURE_COLUMNS)
    return conn.execute(
        f"""select d.filing_year, d.status, d.refusal, d.reader_commit, d.read_at, c.role, c.status, {figures}
              from register.document d left join register.document_column c
                on c.orgnr = d.orgnr and c.filing_year = d.filing_year
             where d.orgnr = %s order by d.filing_year, c.role""",
        (orgnr,),
    ).fetchall()


def test_reread_replaces_older_version(stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    store_older(stored, 2025)
    assert [row[3] for row in stored_rows(stored, ORGNR)] == [OLDER_READER_COMMIT] * 2
    total = 7 + write.FIGURE_COLUMNS.index("sum_egenkapital_gjeld_ore")
    assert [row[total] for row in stored_rows(stored, ORGNR)] == [None, None]
    reader = FakeRecognise(monkeypatch, {pdf("2025"): document(BOLD_ROWS)})
    # Only the stored year's document, by its path: no /aar list.
    transport = FixtureTransport({kopi_url(ORGNR, 2025): pdf("2025")})

    summary = run.run_reread(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: REREAD_AT)

    assert transport.requested == [kopi_url(ORGNR, 2025)]
    assert reader.calls == [pdf("2025")]
    assert summary.replaced == {(2025, "reconciled"): 1}
    assert (summary.current, summary.not_replaced, summary.failed) == (0, [], [])
    assert not summary.needs_operator()
    rows = stored_rows(stored, ORGNR)
    # Replaced: the current version, the new read time, and the total read.
    assert [row[:7] for row in rows] == [
        (2025, "reconciled", None, READER_COMMIT, REREAD_AT, "current", "reconciled"),
        (2025, "reconciled", None, READER_COMMIT, REREAD_AT, "prior", "reconciled"),
    ]
    assert [row[total] for row in rows] == [3_107_354_400, 3_561_502_500]
    # Reconciled with the configured rules: c3 and c4 now evaluable.
    assert column_reconciliation(stored, ORGNR)[0][2:7] == ("pass", "pass", "pass", "pass", "pass")
    assert "  replaced 1; already current, not fetched 0; not replaced 0" in summary.lines()


def test_reread_skips_current_version(stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    # 2024 was re-read before the run was stopped; 2025 was not. The resumed
    # run fetches and reads only 2025.
    store_older(stored, 2024)
    store_older(stored, 2025)
    stored.execute(
        "update register.document set reader_commit = %s where orgnr = %s and filing_year = 2024", (READER_COMMIT, ORGNR)
    )
    before_2024 = [row for row in stored_rows(stored, ORGNR) if row[0] == 2024]
    reader = FakeRecognise(monkeypatch, {pdf("2025"): document(BOLD_ROWS)})
    transport = FixtureTransport({kopi_url(ORGNR, 2025): pdf("2025")})

    summary = run.run_reread(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: REREAD_AT)

    assert transport.requested == [kopi_url(ORGNR, 2025)]
    assert reader.calls == [pdf("2025")]
    assert (summary.current, sum(summary.replaced.values())) == (1, 1)
    assert [row for row in stored_rows(stored, ORGNR) if row[0] == 2024] == before_2024
    # A second run finds both current and fetches nothing.
    again = FixtureTransport({})
    summary = run.run_reread(stored, again, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: REREAD_AT)
    assert again.requested == []
    assert (summary.current, summary.replaced) == (2, {})


def test_reread_fewer_columns_not_replaced(stored: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    # 2023: the re-read refuses (a scaled unit, no columns); 2024: Tesseract
    # fails; 2025: not served. Each keeps its two stored columns, figures and
    # old version, and is named. 2022, a paper filing stored with no
    # columns, re-reads as paper: as many columns as stored, so replaced.
    for year in (2023, 2024, 2025):
        store_older(stored, year)
    paper = write.DocumentOutcome("paper", "paper", None, None, None, ())
    write.write_document(stored, ORGNR, 2022, paper, None, READ_AT, OLDER_READER_COMMIT)
    before = [row for row in stored_rows(stored, ORGNR) if row[0] != 2022]

    def tesseract_fails() -> Recognised:
        raise ocr.OcrError("tesseract failed (plain pass, exit 1)", ["p2.png"], "Error in pixReadStream")

    reader = FakeRecognise(
        monkeypatch,
        {
            pdf("2022"): (paper_top(), []),
            pdf("2023"): generated(2023, unit_line="Beløp i: NOK 1000"),
            pdf("2024"): tesseract_fails,
        },
    )
    responses: dict[str, bytes | None] = {kopi_url(ORGNR, y): pdf(str(y)) for y in (2022, 2023, 2024)}
    responses[kopi_url(ORGNR, 2025)] = None
    transport = FixtureTransport(responses)

    summary = run.run_reread(stored, transport, cfg, CODES, [ORGNR], reader_commit=READER_COMMIT, now=lambda: REREAD_AT)

    assert len(reader.calls) == 3
    assert [row for row in stored_rows(stored, ORGNR) if row[0] != 2022] == before
    assert [p.what for p in summary.not_replaced] == [
        "document 2023: fewer columns: 0 read (not_extracted, reporting_unit), 2 stored",
        "document 2024: OCR error: tesseract failed (plain pass, exit 1) on p2.png: Error in pixReadStream",
        "document 2025: stored, but not served now (404 or 410)",
    ]
    assert summary.replaced == {(2022, "paper"): 1}
    assert stored_rows(stored, ORGNR)[0][:5] == (2022, "paper", None, READER_COMMIT, REREAD_AT)
    assert summary.failed == []
    assert summary.needs_operator()  # main exits 1
    text = "\n".join(summary.lines())
    assert "  replaced 1; already current, not fetched 0; not replaced 3" in text
    assert f"  not replaced, keeps its old figures and version: {ORGNR} document 2023: fewer columns" in text


@pytest.mark.parametrize("mode", ["--documents", "--reread"])
@pytest.mark.parametrize(
    "commit",
    [None, "", "e09a413", "E09A41345826D3B7DCBAE3A6D8E586E63E6F7D8D", "e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d\n"],
)
def test_reader_version_required(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, mode: str, commit: str | None) -> None:
    # Documents and re-read mode refuse, before any request or connection,
    # without a full 40-hex reader version.
    def no_network(*args: object, **kwargs: object) -> None:
        raise AssertionError("nothing may be fetched without a reader version")

    def no_database(*args: object, **kwargs: object) -> None:
        raise AssertionError("no connection without a reader version")

    monkeypatch.setattr(run.fetch, "UrllibTransport", no_network)
    monkeypatch.setattr(run.write, "connect", no_database)
    if commit is None:
        monkeypatch.delenv(run.READER_COMMIT_ENV, raising=False)
    else:
        monkeypatch.setenv(run.READER_COMMIT_ENV, commit)
    file = tmp_path / "documents.json"
    file.write_text(f'["{ORGNR}"]', encoding="utf-8")
    assert run.main([mode, str(file)]) == 2
    assert run.reader_commit_of({run.READER_COMMIT_ENV: READER_COMMIT}) == READER_COMMIT


def test_reread_mode_rejects_other_arguments(tmp_path: Path) -> None:
    assert run.main(["--reread"]) == 2
    assert run.main(["--reread", "a.json", "b.json"]) == 2
    assert run.main(["--reread", "a.json", "--documents", "b.json"]) == 2
    assert run.main(["--reread", str(tmp_path / "absent.json")]) == 2
