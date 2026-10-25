---
title: 'Story 2.3b: Read the balance total (SUM EGENKAPITAL OG GJELD)'
type: 'bugfix'
created: '2026-10-23'
status: 'in-progress'
baseline_commit: 'dcff3ab66372d203d1b27836e05894fe6968993c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/data-sources-brreg.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Step 1's reader leaves `sum_egenkapital_gjeld` NULL in 836 of 1 946 current columns of the 2.1b run.
- The bold "SUM" reads as "50M". `layout.fold` drops digits, so the label folds to `megenkapitaloggjeld` and matches no target.
- Because the row is missed, `ends_balance` never closes the balance sheet.
- Bold figures can read "1" as "l". Every sum line is bold.
- A stored document is never read again, and no row records which reader read it (issue #38).

**Approach:**
- Fold labels so that a word mixing letters and digits ("50M") can still match.
- Record on every document the reader version that read it.
- Add a re-read mode that replaces each stored document read by another version, reconciled before it is written.
- Re-read every stored document.
- Report before and after.

**Decisions (Meinich, 2026-10-23):**
- **Re-read every stored document.** That is the 2.1b run's 1 947 and the reference set's 97. "1" → "l" affects every bold figure, not only the total.
- **Every document row carries its reader version.**
  - The version is the commit of the step-1 image that read the row.
  - The re-read selects documents whose version is not the current one, so an interrupted run resumes where it stopped.
- **When the run happens.** It runs on the final code after review, as in 2.1b. A dump and a backup are taken before and after it.
- **A re-read with fewer columns than are stored is not replaced.** That covers a refusal and an OCR error.
  - Such a document keeps its old figures and its old reader version.
  - It is counted as "not replaced" in the run summary, and the run exits 1.
  - The PR and the session file give how many were not replaced in the acceptance run, and why.
- **The report gives before and after for three data sets:**
  - the reference set;
  - the spike's 89 filings;
  - the 2.1b run, marked as local data that cannot be reproduced until Story 5.4.
- **The report also gives, before and after on the reference set, the misread figures that reach the engine (2.3's headline).** More figures read must not be paid for with new misreads.

- **Approval additions (Meinich, 2026-10-23):**
  - The acceptance criteria state that phantoms and misreads reaching the engine are reported before and after on the reference set. More fields read must not be paid for with new errors.
  - The `reader_commit` backfill is checked. A check shows every row gets a version, with 1 947 rows at `e09a413` and 97 at `901a78d`.
  - The old dumps (`e09a413`, `bd2ce3e`) are kept. The new dump is placed beside them, including in `peerless-backups`.

## Boundaries & Constraints

**Always:**
- Only labels and headings change. A figure is still the digits as printed, or None.
- "l" gets no new rule. Such a figure enters only through the existing gated digits-only pass (`documents.combine`). A sum line in no check therefore stays absent, and the report counts that.
- The fold that drops digits still matches everything it matches today. The new fold is tried as well, never instead.
- The reader version is a full 40-hex commit.
  - It is the last commit that touched `ingest/`.
  - A document or re-read run refuses, before any request, when `ingest/` has uncommitted changes, or when the version is missing or malformed.
- A re-read is one transaction per document, reconciled with the configured rules.
- The "before" inputs are committed before any re-read runs.

**Never:**
- Repair a figure token.
- Use OCR confidence.
- Change the reconciliation rules or their values.
- Grant `ingest` DELETE.
- Read at query time.
- Delete the 2.1b dumps.
- Add the 407 acceptance-run orgnrs to the allow-list.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails if deleted |
|---|---|---|---|
| Bold SUM | "50M EGENKAPITAL OG GJELD 33 855 462 …" | `sum_egenkapital_gjeld` read | `ingest/tests/test_layout.py::test_bold_sum_misread_matches_total` |
| Old fuzzy kept | "S5O0M EGENKAPITAL OG GJELD" | still matches | `test_layout.py::test_digit_dropping_fold_still_matches` |
| Balance closes | the "50M" row, then a page with no year header | that page is `other` and has no rows | `test_layout.py::test_bold_sum_closes_balance` |
| Note number | "Sum eiendeler 5" | still `sum_eiendeler` | `test_layout.py::test_note_number_not_folded_into_label` |
| "l", confirmed | plain "l4 066 151", digits pass "14066151", c3 passes against a plain sum eiendeler | kept, from the digits pass | `test_documents.py::test_bold_one_recovered_only_through_gate` |
| "l", unconfirmed | as above, but sum eiendeler absent; or a sum line in no check | absent | same test, other cases |
| Re-read replaces | stored document of an older version | rows replaced, current version, reconciled | `test_documents_run.py::test_reread_replaces_older_version` |
| Resume | some documents already at the current version | not fetched | `test_documents_run.py::test_reread_skips_current_version` |
| Fewer columns | stored has columns, the re-read refuses or hits an OCR error | unchanged, old version, counted, exit 1 | `test_documents_run.py::test_reread_fewer_columns_not_replaced` |
| Reconciled column would fail (change log 2026-10-25) | a stored reconciled column, current or prior, re-reads as failed_reconciliation | unchanged, old version, counted, exit 1; failed → reconciled is replaced | `test_documents_run.py::test_reread_reconciled_column_failing_not_replaced` |
| Figure lost (change log 2026-10-25) | a column reconciled before and after, a stored figure now NULL | replaced, listed per document with column and field | `test_documents_run.py::test_reread_lost_figure_replaced_and_listed` |
| Dirty tree | `ingest/` modified | refused before any request | `test/run-ingest.test.ts` "refuses a dirty ingest tree" |
| Version recorded | a new document | carries the current version | `test_documents_write.py::test_document_records_reader_version` |
| Backfill | local rows before the migration | every row has a version: 1 947 `e09a413…`, 97 `901a78d…`, none NULL | `test/db/reader-commit-backfill.test.ts` (rolled-back insert of rows on both sides of the boundary) + the recorded count query in the session file |
| Reader version malformed | not 40-hex | exit 2 | `test_documents_run.py::test_reader_version_required` |

</frozen-after-approval>

## Code Map

- `ingest/src/peerless_ingest/layout.py`:
  - Touch `fold` (58), `similar` (277), `ends_balance` (287) and `extract` (294).
  - Add a second label fold that reads 0→o, 1→l and 5→s, inside words that hold both letters and digits.
  - Exact matching, fuzzy matching and `ends_balance` accept either fold.
  - `TARGETS` is unchanged.
- `documents.py:138` `combine`: unchanged. It is the gate for "l".
- New migration: `register.document.reader_commit text`, CHECK `^[0-9a-f]{40}$`, NOT NULL.
  - Backfill existing rows by `read_at`:
    - before 2026-10-22 (the 2.1b run) → `e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d`;
    - otherwise (the reference run) → `901a78dbee3081c1708f8d140b4e769e6e764abd`.
  - On CI's empty database this is a no-op.
  - Columns inherit the version, because `write_document` always writes them in the document's transaction.
  - Re-export the seed in the same PR.
  - Apply the migration locally without a reset (`supabase migration up`), so the 2.1b rows are kept and backfilled.
  - The older dumps restore only onto the schema before this migration. That is why a new dump is taken.
- `write.py`: `write_document` (280) writes `reader_commit`; `stored_document_years` (249) gains a sibling that returns stored documents with their version.
- `run.py`:
  - `main` (666) accepts `--reread <file>`, alone. The file is the same orgnr list as `--documents`, read by `read_document_list`.
  - The run re-reads every stored document of those orgnrs whose `reader_commit` is not the current one, through the existing fetch → `read_document` → reconcile → write path (`_load_documents`, 393).
  - It reads the version from `PEERLESS_READER_COMMIT`.
  - The summary gains replaced, current and not replaced, with reasons.
- `scripts/run-ingest.ts` `stepArgs`:
  - accept `--reread <file>`, mounted read-only like `--documents`;
  - refuse a dirty `ingest/` (`git status --porcelain -- ingest/`);
  - pass `-e PEERLESS_READER_COMMIT=$(git log -1 --format=%H -- ingest/)`.
- `scripts/document-run-counts.ts` (new, `pnpm analysis:document-run <label>`):
  - Reads the local database as reader.
  - Per role: documents, columns, non-NULL count per field, `column_status`, and reader versions.
  - Writes `analysis/output/document-run-counts-<label>.json`.
- Before inputs (committed first):
  - `analysis/output/ocr-sm2-before-2.3b/`: a copy of 2.3's `document.csv`, `document_column.csv` and `ocr-consistency-2026.json`;
  - `document-run-counts-before-2.3b.json`.
- `scripts/ocr-sm2.ts` and `ocr-sm2-compare.ts`: a new section "Before and after Story 2.3b".
  - It runs the same classification on the before copy and on the current seed.
  - Per field and in total: correct, not read, misread and phantom, plus the headline.
  - Spike: evaluable and passing.
  - 2.1b: NULL counts from the two JSON files, marked local.
- Reuse in tests: `tsv_builder.replace_row`, `document_fakes.FakeRecognise`, `conftest` (`db`, `FixtureTransport`).
- Do not change: `reconcile.py`, `config.toml` and `src/engine`.

## Tasks & Acceptance

**Execution:**
- [ ] `layout.py` + `test_layout.py`; `test_documents.py` for the "l" cases
- [ ] Probe: in the image, read the seven 2.3 probe documents with the new fold, to confirm the fix on real Tesseract output (no write)
- [ ] Migration, `write.py`, `run.py`, `run-ingest.ts` and tests; re-export the seed (backfilled versions)
- [ ] `document-run-counts.ts` + test; commit the before inputs
- [ ] `ocr-sm2.ts` before/after section + tests
- [ ] Docs:
  - `epics.md` gets a Story 2.3b section with the ACs below;
  - `AGENTS.md` (`--reread`, `reader_commit`) and the README (re-read and dump);
  - `data-sources-brreg.md`, `ai-log.md`, the session file and `sprint-status.yaml`;
  - `deferred-work.md`: close the 2.3b entry, and narrow the refiling entry.
- [ ] After review, on the final code:
  1. Dump and back up.
  2. Run `--reread` on the reference set; run `seed:export`.
  3. Run `consistency.py`.
  4. Run `--reread` on `seed/document-run.json`.
  5. Run the counts "after"; regenerate the report.
  6. Dump and back up again. The new dump goes beside the old ones (`e09a413`, `bd2ce3e`), which are kept, also in `peerless-backups`.
  7. Record "not replaced" in the PR and the session file.

**Acceptance Criteria:**
- Given every stored document re-read, when the report is generated, then it gives, before and after:
  - the `sum_egenkapital_gjeld` hit rate per data set;
  - every class count on the reference set;
  - the misreads and the phantoms in reconciled columns (reaching the engine), with every new one listed. More fields read must not be paid for with new errors.
- Given the re-read is complete, when the local database is queried, then every document has a 40-hex `reader_commit`, and each one that differs from the current version is listed as "not replaced" with its reason.
- Given a fresh clone with the seed loaded, when `pnpm analysis:sm2` runs, then it rewrites `ocr-sm2.md` byte for byte, apart from the generation date.

## Implementation Notes

## Spec Change Log

- **2026-10-25, Meinich (review decision D2): a re-read that turns a reconciled column into `failed_reconciliation` is not replaced.** The document keeps its figures and reader version and is counted as "not replaced", the same principle as "fewer columns". Figures that go from a value to NULL in a column that is still reconciled are replaced, but listed per document in the summary, and their number is given in the PR. Both are tested (the two new I/O matrix rows). The review found that the column-count guard alone let a re-read take figures away from the engine unseen (B4, E1, E9 in the Review Triage Log).

- **2026-10-25, Meinich: the reference run's backfilled version is `901a78d`, not `cfecb1e`.** The reader version is defined as the last commit that changed `ingest/`. `cfecb1e` is the commit the reference run's image was built at, but it changed only `analysis/ocr/`; the last `ingest/` change before that run (read 2026-10-23 10:35–11:22 UTC) is `901a78d`. The approval addition, the I/O matrix row "Backfill" and the Code Map now say `901a78d`; the migration, `test/db/reader-commit-backfill.test.ts` and the 97 local rows were corrected to match.

## Review Triage Log

Review pass 1, 2026-10-25. Four layers ran on the diff since `dcff3ab` (without the three byte-identical copies in `analysis/output/ocr-sm2-before-2.3b/`): blind (B), edge case (E), verification gap (V) and acceptance auditor (A).

| # | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| B7, A1 | The migration lands without a seed re-export, so `seed-format.test.ts`, `test/db/seed.test.ts` and CI's `pnpm seed` fail | high | The manifest names `20261021120000`; `seed/demo/document.csv` has no `reader_commit` column, which is NOT NULL. The export needs the 2.1b rows deleted and restored. | decision: export now, or only in the acceptance run |
| B4, E1, E9 | A re-read with as many columns as are stored replaces the document even when a reconciled column comes back `failed_reconciliation` or a stored figure comes back NULL; the summary does not show it | medium | `_reread_documents` guards only `len(outcome.columns) < document.columns` (`run.py:641`). `RereadSummary.replaced` counts by (year, new status). The 2.1b counts are per-field totals, where gains hide losses. | decision |
| B1 | The committed report's "After" columns for the reference set and the spike equal "before", with no sign that the re-read has not run | medium | `analysis/output/ocr-sm2.md`: "49 of 97 → 49 of 97", "None." new errors. Only the 2.1b rows say "not yet counted". | decision |
| V2, B2 | No test runs `main` with `--reread` past validation; dropping the `REREAD` branch sends `--reread` to `run_documents`, which re-reads nothing and exits 0 | medium | Every `run.main` call with a list expects exit 2 (`test_documents_run.py`). | patch |
| V3, B6 | The re-read's error paths have no test: `ValueError` from `_outcome`, a psycopg error on write, a fetch exception | medium | The three re-read tests cover a refusal, an OCR error, a 404 and a replace. | patch |
| V1 | `fold_mixed`'s "1" → "l" is never exercised | medium | Every tested mixed word holds only 5 and 0; deleting `"1": "l"` fails no test. | patch |
| E7, A2 | A field misread before and misread to another value after is not listed as new | medium | `resultKey` (`ocr-sm2-compare.ts:696`) omits `readOre`. | patch |
| A5 | A database error during a re-read is listed under "failed", not "not replaced" (AC 2) | low | `run.py:653-656` passes `summary.failed` to `_write_failed`. | patch |
| B3, A6 | The session file's recorded backfill output still shows `cfecb1e` | low | The matrix row "Backfill" names that output as evidence; the recount at `901a78d` is prose only. | patch |
| A8 | `epic-2-context.md` still says a stored document is never read again, and "2.3b is next" | low | Lines 7 and 59, in the diff that adds `--reread`. | patch |
| A7b, B12 | `sprint-status.yaml` `last_updated` changed format and lost its time | low | `23-10-2026 12:20` → `2026-10-23`; `generated` keeps `DD-MM-YYYY HH:MM`. | patch |
| B15 | AGENTS.md names only some not-replaced causes (not "read failed" or "not reconciled") | low | `_reread_documents` adds both to `not_replaced`. The fix edits AGENTS.md. | defer |
| E2 | A malformed `reader_commit` raises `ValueError` mid-run | false | `main` validates it before any request (`reader_commit_of`); the only other callers are tests. | reject |
| E3 | A gitignored file under `ingest/` reaches the image unseen by the dirty check | low | The image copies only `src` and `config.toml`, `__pycache__` is in `.dockerignore`; the fix must filter `.venv` and the like. Unlikely. | reject |
| E4, B16 | The backfill labels any row read from 2026-10-22 with the reference run's version, on any database | false | On the only populated database, the 97 rows from that date are the reference run's; CI and a fresh clone migrate an empty table and load the seed after. | reject |
| E5 | `document-run-counts.ts` reads its orgnr file outside the try | false | A missing file fails loudly; the file is written by `pnpm ingest:document-set`. | reject |
| E6 | `spikeAll` assumes two columns per filing | false | All 89 filings in the consistency file have two columns. | reject |
| E8 | `ends_balance` under `fold_mixed` can close the balance earlier and drop later rows | false | `fold_mixed` equals `fold` on a label without a mixed word, so only a mixed-word row matching the total closes newly. | reject |
| B5 | `write_document` can leave columns of another reader under a new version | false | Its callers are `_load_documents` (unstored years only) and `_reread_documents` (guarded on column count). | reject |
| B8 | `reader_commit` may not resolve after a squash merge | false | PRs merge with merge commits (#39, #36, #34); `901a78d` and `e09a413` are on `main`. | reject |
| B9 | `deferred-work.md` closes the 2.3b entries before the re-read has run | low | The closures describe the merged state, which follows the acceptance run. | reject |
| B10 | The README does not name the new dump | false | The dumps are gitignored local data a grader never has; the path is in the session file. | reject |
| B11, A7a, A9 | Spec status `in-progress`; the Code Map says `-e NAME=value` where the code passes `--env NAME` | — | The fix edits the spec under review; the status is set when this review ends, and the `--env` choice is in the session file. | reject |
| B13 | The counts script reads documents and columns in two snapshots | low | It runs after the re-read exits, by the documented order; the fix adds a transaction. | reject |
| B14 | `?? counts` in the per-field table is a silent fallback | false | `classesByField` maps `SM2_FIELDS` in one order for both lists, so it is unreachable. | reject |
| A3 | A wrong fuzzy match under `fold` blocks an exact match under `fold_mixed` | false | The spec requires it: the new fold is "tried as well, never instead". | reject |
| A4 | An OCR error on a re-read is never written, even over a stored `ocr_error` row | — | Chosen so the next re-read retries it, recorded in the session file; the fix edits the spec. | reject |

## Design Notes

**Why a second fold rather than a broader variant.**
- **A broad variant is unsafe.** A variant `egenkapitaloggjeld` would also match the heading "Balanse - egenkapital og gjeld" when the years sit on its line. In the digits pass, a year (`2025`) parses as a one-token figure.
- **The second fold touches only mixed words.** It changes only words that hold both letters and digits, so a note number such as "5" is still dropped.
- **The length rule then admits the bold total.** `similar` accepts "somegenkapitaloggjeld" for "sumegenkapitaloggjeld".
- **It applies to every label.** Every sum line is bold, so the same fault can hit any of them. The reference set's before and after measures whether that adds a misread or a phantom.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:ingest` -- all green
- `pnpm seed && pnpm seed:export && git diff --exit-code seed/` -- no diff
- `pnpm analysis:sm2 && git diff analysis/output/ocr-sm2.md` -- the generation date only
