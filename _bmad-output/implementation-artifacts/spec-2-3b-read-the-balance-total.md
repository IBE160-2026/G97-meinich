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

- **2026-10-25, Meinich: the reference run's backfilled version is `901a78d`, not `cfecb1e`.** The reader version is defined as the last commit that changed `ingest/`. `cfecb1e` is the commit the reference run's image was built at, but it changed only `analysis/ocr/`; the last `ingest/` change before that run (read 2026-10-23 10:35–11:22 UTC) is `901a78d`. The approval addition, the I/O matrix row "Backfill" and the Code Map now say `901a78d`; the migration, `test/db/reader-commit-backfill.test.ts` and the 97 local rows were corrected to match.

## Review Triage Log

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
