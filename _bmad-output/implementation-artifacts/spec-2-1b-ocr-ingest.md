---
title: 'Story 2.1b: Store the filed accounts (OCR ingest)'
type: 'feature'
created: '2026-10-20'
status: 'done'
baseline_commit: 'cf512ebc1d6160cc263501c320c1c1484058d4a3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.1a can read a filed document, but nothing fetches the documents or stores what is read. Twelve key figures and revenue growth therefore have no input, and FR-59 requires every document figure to be pre-warmed before anyone asks for it.

**Approach:** Step 1 fetches every filed 2021–2025 document of every covered company. Each one goes through `read_document`. Step 1 then stores one row per document and one row per figure column, as filed, in øre. This happens in the existing full run, through `INGEST_DATABASE_URL`, with no DDL. The work also adds one migration, its grants, the seed decision and re-export, a contract test against the database, and the "Kilder og lisens" copy. The acceptance criteria are in `epics.md` Story 2.1b, which wins on a conflict.

**Decisions (human, Meinich, 2026-10-20):**
- **The spec is kept whole** (about 2 300 tokens).
- **Status `extracted`.**
  - A generated document read with columns is stored `extracted`, meaning read and not yet reconciled.
  - AD-15 and the status CHECK gain the value. Story 2.2 replaces it with `reconciled` or `failed_reconciliation`.
  - Until then, nothing is marked usable.
- **Every year 2021–2025,** as the AC says, not every other year.
- **A limited run.**
  - Step 1's document pass can be limited to a given set of orgnrs.
  - The acceptance run is demo companies A, B and C plus their peer groups in the standard band (about 500 companies), not all of 62.100.
  - The committed seed has the new tables empty until 2.3's allow-list.
  - The full-industry run is a `deferred-work.md` entry with its estimated time.
- **Measured first** (2026-10-20, the step-1 image on the development machine with 16 logical cores, 20 cached 2021–2025 filings):
  - `read_document` takes a median of 21.1 s per document, with a mean of 22.8 s and a maximum of 38.5 s.
  - Two or three documents at once give 19.1 and 21.5 s per document, because one document already fills the CPU.
  - Estimate: 500 companies × about 4 documents ≈ 2 000 documents ≈ 12 h.
  - The full industry is about 33 000 documents ≈ 190 h ≈ 8 days.
- **Approval conditions (2026-10-20).**
  - **Order.** The acceptance run (about 12 h) starts only after:
    - review;
    - the review fixes;
    - the full test suite.
  - It runs on the image built from the last commit, never earlier, as in 1.3a. The PR and the session file name that commit's full hash.
  - **Resumable.** The run can be stopped and started again without redoing stored documents:
    - each document is committed on its own;
    - a rerun skips every stored `(orgnr, filing_year)`.
  - This is tested.
  - The agent tells the human before starting the run, so the machine can be kept awake.

**Decisions (agent, open to change at approval):**
- **How the run is limited.**
  - `pnpm ingest --documents <file>` is a second mode alongside `--companies-only`. The file is a JSON list of orgnrs, mounted read-only.
  - It fetches no bulk data and no key figures. For each listed orgnr that is a stored covered company, it runs only the document pass.
  - A listed orgnr that is not stored or not covered is refused and reported, never fetched.
  - The full run (no argument) also runs the document pass for every covered company.
  - AGENTS.md's "the only argument it accepts" is updated in the same commit.
- **The acceptance set** is computed in Node, not Python, because peer selection is `src/engine` only:
  - `pnpm ingest:document-set` writes `seed/document-run.json`, the committed acceptance set: A, B and C, plus each one's stage-1–3 pool at the standard band.
  - It uses `src/engine/peers.ts` against the seeded DB.
  - The file is input to the run, not seed data. `seed:export` and `seed` ignore it.
- **Two tables** (AD-15 names none):
  - `register.document`, keyed `(orgnr, filing_year)`. Columns:
    - `brreg_id`: nullable, references `register.filing (brreg_id) ON UPDATE CASCADE`. Set when an API filing has the same orgnr and `filing_year`. 2021–2022 have none.
    - `layout`, `status`, `refusal`
    - `valuta`, `unit_text` (the reporting unit)
    - `read_at`, `dataset`
  - `register.document_column`, keyed `(orgnr, filing_year, role)`, where `role` is `current` or `prior`. Columns:
    - `stated_year`, with a CHECK that it equals `filing_year` for current and `filing_year − 1` for prior
    - `c1`…`c4`, each `pass`, `fail` or `not_evaluable`
    - `digits_pass_fields text[]`
    - the 23 `FIELDS` as `<field>_ore bigint`, each with a unit comment
    - `dataset`
  - `register.filing.status` is left alone (no `src` reader).
- **Filing year.**
  - It is the year as the register's `/aar` list returns it, used in the path. The `år` query parameter is never sent.
  - A generated document whose current-column year differs from that year is stored `not_extracted` with `refusal = 'year_mismatch'`, and no column rows.
- **Status in 2.1b:**
  - `paper` for a paper filing, which is never read.
  - `not_extracted` for `unknown`, a refusal, or an `OcrError`. The `OcrError` is logged with its page and the first stderr line (deferred-work).
  - `extracted` for a read with columns.
- **Whole kroner to øre** is `× 100` on an `int`, never a float. None stays NULL.
- **Dataset tag.** `text NOT NULL CHECK (dataset IN ('demo','full'))`. Step 1 writes `full`. It is provenance only.
- **Re-runs.**
  - A stored `(orgnr, filing_year)` is not fetched again. A refiled document is not picked up; that is recorded as a limit.
  - A company that fails (fetch or OCR) costs only its own documents, like the register errors today.
- **Seed.**
  - Both tables go into `SEED_TABLES`, after `filing`.
  - `document_figure_orgnrs` and `unlistedDocumentFigures` read `register.document_column` instead of `filing.status`.

## Boundaries & Constraints

**Always:**
- Match on orgnr only.
- A figure is NULL when it is absent or unreadable, and never 0. A printed 0 is 0.
- The only Python arithmetic is the `× 100` unit conversion and 2.1a's checks (AD-1).
- `ingest` gets SELECT, INSERT and UPDATE on the new tables, `loader` gets SELECT, INSERT and TRUNCATE, and `reader` gets SELECT through the default privileges.
- The new migration re-exports the seed in the same PR.

**Never:**
- Fetch or OCR in `src/` or in a request.
- Derive or store a missing component.
- Change the reading rules in 2.1a.
- Add a CLI argument beyond `--documents <file>`.
- Compute the peer set in Python.
- Set `reconciled` or `failed_reconciliation` from an API comparison. That is Story 2.2.
- Edit `analysis/output/**`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | What fails if the guard is deleted |
|---|---|---|---|
| Contract | the 979607008/2025 read written to a migrated DB | both columns' øre equal hand-checked values; `annen_driftskostnad` 2025, `leverandorgjeld` and `varer` NULL; `nedskrivninger_ore` 2025 = 0 | `test_documents_write.py::test_contract_979607008_2025_db` |
| Year list | `/aar` has 2019–2025 | only 2021–2025 fetched; no URL carries `år=` | `test_documents_run.py::test_fetches_only_2021_2025_from_year_list` |
| Year mismatch | path 2024, document header 2025 | `not_extracted`, `year_mismatch`, no columns | `test_documents_run.py::test_year_mismatch_is_refused` |
| Paper | the 2011 paper fixture's read | `paper`, no columns, OCR of figure pages never called | `test_documents_run.py::test_paper_never_read` |
| Refusal / OcrError | `reporting_unit`; tesseract fails | `not_extracted` with its refusal; the run continues | `test_documents_run.py::test_refusal_and_ocr_error_store_not_extracted` |
| Interrupted run | the transport raises `KeyboardInterrupt` after the 2nd of 4 documents; then a rerun | the first 2 committed; the rerun fetches only the other 2 and reads nothing twice | `test_documents_run.py::test_interrupted_run_resumes_without_redoing` |
| Already stored | `(orgnr, 2025)` in DB | no fetch for it | `test_documents_run.py::test_stored_document_not_refetched` |
| API link | API filing 2025 exists / not for 2022 | `brreg_id` set / NULL | `test_documents_write.py::test_links_brreg_id_by_year` |
| No float | figure 72632310 | 7263231000, type `int` | `test_documents_write.py::test_ore_is_int_times_100` |
| Unlisted export | a `document_column` row for an orgnr not on the allow-list | `seed:export` refuses | `test/seed-format.test.ts` "refuses document figures not on the allow-list" |
| Limited run | `--documents` with 2 stored covered orgnrs and 1 unknown | documents only for the 2; the unknown refused and reported; no bulk download, no key-figures URL | `test_documents_run.py::test_documents_mode_only_listed_orgnrs` |
| Bad argument | `--documents` with no file, or a file that is not a JSON list of 9-digit strings | exit 2, nothing fetched | `test_documents_run.py::test_documents_mode_rejects_bad_file` |
| Status value | an `extracted` row | accepted by the CHECK; a value outside the five is refused | `test/db/documents.test.ts` "status accepts exactly the five values" |
| Query time | an analysis | no outbound request | `test/db/peers.test.ts` "makes no outbound request…" (unchanged) |

</frozen-after-approval>

## Code Map

- `ingest/src/peerless_ingest/run.py:155-244`:
  - `_load_company` and `run` are where the document pass goes. It runs after each company's filings and only for covered companies.
  - Keep the per-company error scope (`FETCH_ERRORS`, `run.py:142`) and the `needs_operator` exit code.
  - Update the module docstring (:8, "Fetches no document").
- `ingest/src/peerless_ingest/fetch.py:32-101`:
  - Add `fetch_document_years(orgnr)` (`…/aarsregnskap/kopi/{orgnr}/aar`) and `fetch_document(orgnr, year)` (`…/kopi/{orgnr}/{year}`), both through the `Transport`.
  - 404/410 → None.
- `ingest/src/peerless_ingest/write.py:60-120`:
  - Add `write_document(conn, orgnr, year, read, brreg_id, read_at)`, using `_upsert`.
  - The document row and its columns go in one transaction.
  - Add `stored_document_years(conn, orgnr)`.
- `ingest/src/peerless_ingest/documents.py:82-102, 226`:
  - Read `DocumentRead` and `Column` only. Do not change the reading rules.
  - `ocr.py` `_run`: put the page and the first stderr line into `OcrError` (deferred-work :82).
- `ingest/tests/conftest.py:97-167`:
  - `FixtureTransport` gains the `kopi` URLs.
  - The `db` fixture rolls back.
  - The figure tests monkeypatch `recognise` so the TSVs feed `read_words`, and no Tesseract runs on the host.
- `supabase/migrations/20261020120000_register_document_tables.sql` (new). Follow `20261011120000_register_step1_tables.sql`: text CHECKs, per-column `COMMENT … 'øre; …'`, and explicit grants.
- `scripts/run-ingest.ts:36-41, 61-116`: argument allow-list and mounts; add `--documents <file>`.
- `src/engine/peers.ts` and the candidate read used by `test/db/peers.test.ts` (`groupForDemoA`): reuse it for the acceptance set; do not reimplement stages 1–3.
- `scripts/seed-format.ts`: `SEED_TABLES` (:41-53), `unlistedDocumentFigures` (:439-457).
- `scripts/seed-export.ts:127-129`: `document_figure_orgnrs`.
- Tests that hard-code table lists, and must change with the code:
  - `test/db/grants.test.ts` :358, :409-416
  - `test/seed-format.test.ts` :89-91
  - `test/allow-list.test.ts` :21-23
  - `test/db/seed.test.ts` :103
- `src/messages/nb.json:113` `about.sources.origin`: name "årsregnskapene som er sendt inn til Regnskapsregisteret".
- Docs:
  - `technical-note-architecture.md`: AD-15 table names, and Q1's answer.
  - `docs/data-sources-brreg.md`: the documents step.
  - `AGENTS.md` stack paragraph: step 1 fetches documents.
  - `README` ("Ingest").
  - `docs/ai-log.md`
  - `deferred-work.md`: close :36, :70 and :82.

## Tasks & Acceptance

**Execution:**
- [x] Migration, grants, then `scripts/seed-format.ts` and `seed-export.ts` and their TS tests. `pnpm seed:export` gives the re-exported seed.
- [x] `fetch.py`, `write.py`, `run.py` and `ocr.py`, plus `ingest/tests/test_documents_{write,run}.py`: every matrix row.
- [x] `nb.json` copy, and its e2e/unit assertion if one exists.
- [x] `scripts/document-set.ts` (`pnpm ingest:document-set`), `scripts/run-ingest.ts` (`--documents <file>`, mounted read-only) and their Vitest tests; commit `seed/document-run.json`.
- [x] Acceptance run, last, after review, fixes and the full suite, on the image built from the final commit (hash in PR and session file); tell the human before starting: `pnpm ingest --documents seed/document-run.json` on the local DB. Record the counts per status and year, the wall time and the seconds per document in the PR and the session file.
- [x] `deferred-work.md`: the full-62.100 run, about 33 000 documents and about 190 h at 21 s per document, with how the estimate was made.
- [x] Docs, the session file and `sprint-status.yaml`.

**Acceptance Criteria:** `epics.md` Story 2.1b and the matrix above. In addition: given CI, when `pnpm test:ingest` runs against the seeded database, then the contract test runs there and is not skipped.

## Implementation Notes

Recorded by the implementation subagent, 2026-10-20. Choices open to the reviewer and the human:

- **Demo company C is not in `seed/document-run.json`.** The Decisions say the acceptance run is "demo companies A, B and C plus their peer groups", but C (967534579, KANTALL AS) is in an uncovered industry: it has no peer group, `ingest/config.toml` says step 1 never fetches its documents, and the spec's own documents mode refuses a listed orgnr that is not covered. The set is therefore A and B and their standard-band pools: 407 orgnrs (`test/document-set.test.ts` asserts C is absent). If C's documents are wanted, documents mode would need an exception for it; that is a human decision.
- **Accept header.** The register refuses `Accept: application/pdf` on the document endpoint with 406; step 1 sends `application/octet-stream` (found by a one-company run against the register before review; `test_fetch.py::test_document_is_requested_as_octet_stream`). The run's database rows were removed by `pnpm seed` afterwards.
- **`write_document` takes a `DocumentOutcome`, not the raw read.** `document_outcome(year, read)` decides status, refusal and columns (paper, unknown, refusal, year mismatch, extracted) and is pure; `OCR_FAILED` is the outcome for an `OcrError`. The Code Map's signature `write_document(conn, orgnr, year, read, brreg_id, read_at)` is otherwise kept.
- **`layout` is nullable** and NULL only for an `OcrError`, with `refusal = 'ocr_error'`: a Tesseract failure can happen before page 1 is classified. The refusal values are `reporting_unit`, `year_header`, `year_mismatch` and `ocr_error`. A CHECK keeps status, layout and refusal consistent, written with `coalesce` because a CHECK whose expression is NULL passes.
- **A PDF that PyMuPDF cannot open** (`RuntimeError`, e.g. `FileDataError`) or a body that is not a PDF is a failure of that document: named in the summary, not stored, retried by the next run. Only an `OcrError` is stored as `not_extracted`, as the spec says. OCR errors do not by themselves make the run exit 1; failures and refusals do.
- **`brreg_id`** links to the key-figures filing only when exactly one SELSKAP filing has the same orgnr and filing year.
- **The export keeps the allow-list.** Refusing unlisted document figures while still writing `[]` would erase an entry the export had just accepted, so `seed:export` writes the allow-list back as it read it (`stableJson`). That also closes the Story 1.3b ledger entry assigned to 2.3; 2.3 still adds the reference filings to the list.
- **The acceptance set runs through Vite's module runner** (`scripts/document-set.ts` → `scripts/document-set-compute.ts`), because `src/` imports JSON without an import attribute and `src/server` begins with `import 'server-only'`; plain Node cannot load either. `test/db/document-set.test.ts` recomputes the set against the loaded seed and compares the committed file.
- **Summary figures.** The run prints counts per filing year and status, documents read, seconds spent reading and wall time; seconds per document is read from those two numbers, not computed in Python.

## Spec Change Log

- **2026-10-20, Meinich (review, finding #21): the acceptance set is A and B and their pools, without C.** Demo company C is in an uncovered industry and uses no document figure. Why: the Decisions named "A, B and C", but documents mode refuses an uncovered company under the same spec, so the two could not both hold. `seed/document-run.json` holds A, B and their standard-band pools, 407 orgnrs (`test/document-set.test.ts` asserts C is absent). KEEP: documents mode refuses any listed orgnr that is not a stored company with a covered primary code.
- **2026-10-20, Meinich (review, finding #10): a plain `pnpm ingest` reads no document.** This corrects the Decision "The full run (no argument) also runs the document pass for every covered company". The human decided that document reading can be limited, not that a plain `pnpm ingest` reads documents. `pnpm ingest` does the register and key-figures run as before, and filed documents are read only with `--documents <file>`. Why: with the pass inline, the first plain run over 62.100 would take about 8 days, and no mode would refresh the register data alone. Triage row 10 had rejected the finding as a frozen decision; the human overruled it. Test: `ingest/tests/test_documents_run.py::test_normal_run_fetches_no_document`. The PDF and the year list are served, and the test asserts that neither is requested, that nothing is read and that no document row exists; it fails with the pass put back. README, AGENTS.md, `docs/data-sources-brreg.md`, `scripts/run-ingest.ts` and the deferred full-industry entry are updated. KEEP: documents mode, resumability and every status rule unchanged.

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | verif V1; blind B13 | The export's write-back of the allow-list (no longer `[]`) and the manifest's `document_figure_orgnrs` from `document_column` are untested with a non-empty list | medium | Every `exportSeed` call in `test/db/seed.test.ts` uses the committed `[]`; restoring `'[]
'` or the old `filing.status` query keeps every test green. | patch |
| 2 | verif V2; blind B5, B6; edge E1, E2, E13 | Only `OcrError` and `RuntimeError` are contained around the read. Any other exception from `read_document`/`document_outcome` aborts the run, and because stored documents are skipped, every rerun crashes on the same document. `except RuntimeError` also mislabels unrelated errors. The not-served, `/aar`-error and unreadable branches have no test. | medium | `run.py` `_load_documents`: the try catches `ocr.OcrError` and `RuntimeError` only; `document_outcome` raises `ValueError`. grep `not served`, `document years:`, `unreadable PDF` in `ingest/tests`: none. | patch |
| 3 | verif V3 | The resume test runs under the `db` fixture's outer transaction, so it cannot see whether each document is really committed | medium | `conftest.py` `db` yields inside `conn.transaction()`; inner transactions are savepoints. The human's approval requires resumability to be tested. | patch: assert `write.connect` gives an autocommit connection; live stop/restart check before the acceptance run |
| 4 | verif other; blind B8; edge E4 | A covered company whose `/aar` answers 404/410 is neither counted nor named | low | `_load_documents`: `if years is None: return`. Direct correction. | patch |
| 5 | blind B7; edge E6 | An OCR error is stored for good, never retried, and leaves the exit status 0 | medium | `needs_operator()` ignores `documents.ocr_errors`; `test_refusal_and_ocr_error_store_not_extracted` asserts it is false. "No silent fallbacks" asks for a signal the exit status carries. | patch |
| 6 | blind B1; edge E11 | The new tables reference `company` and `document` with NO ACTION, but Story 2.4's AC deletes a 410 company with its document figures through `ON DELETE CASCADE` | medium | `epics.md` Story 2.4 AC: "every row referencing it in `register` goes with it through `ON DELETE CASCADE` (key figures, filings, document figures)". The tables are new in this migration, so the fix is two words. | patch |
| 7 | blind B2 | The copy names the filed accounts before any document figure is shown, next to the NLOD line | false | The AC requires it "when document figures are stored". The separate document-figure licence paragraph is Story 5.4 (human decision, 2026-10-16, `deferred-work.md`). | reject |
| 8 | blind B3 | `docs/data-sources-brreg.md:299` and PRD FR-28 (`prd.md:508`) still say history is fetched every other year | low | grep. AGENTS.md: edit the original. Direct correction. | patch |
| 9 | blind B4 | `epic-2-context.md:63` still lists the "Kilder og lisens" item as open | low | grep. Direct correction. | patch |
| 10 | blind B9 | A plain `pnpm ingest` now runs the document pass inline, so its first run over 62.100 takes days and no mode refreshes register data alone | medium | It is the approved decision ("The full run (no argument) also runs the document pass"). After the first full pass, a rerun skips stored documents and costs one `/aar` request per company. A register-only mode would change the frozen intent. | reject (frozen decision); raised with the human |
| 11 | blind B10 | `DOCUMENT_YEARS = range(2021, 2026)` is a constant in code | low | The AC fixes 2021–2025; moving the window is a later decision, not a defect. | reject |
| 12 | blind B11 | `seed/document-run.json` sits in `seed/` though seed files are written only by the export | false | It is not a seed file: the export never writes it and the loader never reads it (AGENTS.md, README); its path is the approved decision. | reject |
| 13 | blind B12; edge E10 | The database accepts column rows under a `paper`/`not_extracted` document | low | `write_document` writes columns only for `extracted`; a trigger adds complexity for a state no writer produces. | reject |
| 14 | blind B14 | The session file lacks the human's prompts and the PR link | low | Filled in before merge, as the AGENTS.md checklist requires. | patch (docs, at PR) |
| 15 | edge E5 | `brreg_id` stays NULL if a document was stored before its filing | low | The full run writes filings before documents; documents mode runs on stored filings. | reject |
| 16 | edge E7 | The manifest's read-date range ignores `register.document` | low | `seed-export.ts:146-147` unions only company and filing. Direct correction. | patch |
| 17 | edge E8 | `document.csv` rows are not checked against the allow-list | false | A document row holds no figure; the allow-list governs document figures (AD-9), which live in `document_column`. | reject |
| 18 | edge E9, E12 | A malformed allow-list or a failed `runnerImport` gives a raw exception | low | Both fail loudly and write nothing. | reject |
| 19 | edge E3 | A database error in `stored_document_years` ends the run | low | A failing SELECT means the database is unavailable; ending the run is the existing `ConnectionLost` behaviour. | reject |
| 20 | blind (valuta) | A non-NOK document is stored ×100 in columns whose comment says "øre" | low | `valuta` is stored per document; the comments overstate. Direct correction to the comments. | patch |
| 21 | edge E14 | The acceptance set leaves out demo C, which the frozen Decisions name | medium | C (967534579) is uncovered; documents mode refuses it, by the same spec. The two decisions cannot both hold. | intent_gap: human decision at presentation, no revert (the code is right under either reading except the one list entry) |

## Design Notes

Hand-checked øre for the contract test: `expected-979607008-2025.json` × 100. For example:
- `sum_driftsinntekter` 2025 is 7 263 231 000 øre.
- `sum_egenkapital` 2024 is 930 519 800 øre.
- Every value in the test is written as a literal, not computed from the JSON.

## Verification

**Commands:**
- `pnpm test:ingest`: passes against the seeded DB, with no Tesseract on the host.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db`: passes.
- `pnpm seed && pnpm seed && pnpm seed:export`: `git diff --exit-code seed/`.
- `pnpm build && pnpm check:routes && pnpm test:e2e`: passes.
