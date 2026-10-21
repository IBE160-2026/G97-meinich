---
title: 'Story 2.2: Accept only figures that reconcile'
type: 'feature'
created: '2026-10-21'
status: 'in-review'
baseline_commit: 'e1178b0bd724f3159990a0bf98cfb48a82bd5829'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.1b stores 1 947 read documents as `extracted`: they have been read but not reconciled, so none of their figures may be used. The within-document bound is a code constant (`TOLERANCE_KR = 5`). Nothing compares a document with the key-figures API, and no filing is marked `reconciled` or `failed_reconciliation` (FR-57, FR-58).

**Approach:** Step 1's documents mode reconciles each generated document under two rules, each set once in `ingest/config.toml`. Within a document, the four column checks c1–c4 hold within an absolute bound in kroner. Between sources, each figure the API also holds is compared under a proportional tolerance. The mode stores every check's result and the status of each column and filing, and it re-reconciles stored documents from their stored figures, without fetching or OCR. The ACs are in `epics.md` Story 2.2, which wins on a conflict.

**Decisions (human, Meinich, 2026-10-21):**
- **The spec is kept whole** (about 2 600 tokens).
- **Between-source tolerance = max(5 kr, 0.001 % of the register's figure).** It is not 0.1 %.
  - Measured by the review session on the 2.1b data: 8 234 current-column figures were compared with the register.
    - 8 230 are within 5 kr.
    - None lies between 5 kr and 0.1 %.
    - Coarse proportional slack only admits low-digit errors. Example: 911701251 has 114 120 459 against 114 210 458, swapped digits.
  - 2.1a refuses scaled reporting units (`reporting_unit`), so the old reason for a coarse proportional tolerance ("reporting in thousands or millions") no longer applies to documents.
  - The 0.001 % term still admits 923609016's millions rounding: 1 000 000 on 127 220 000 000 is 0.00079 %.
  - AGENTS.md ("Reconcile with two rules"), `docs/data-sources-brreg.md`, the technical note's "Document extraction" section and PRD FR-58 are corrected in place.
- **A failed prior-year column does not fail the filing, and the prior column is not compared with the register for its status.**
  - The filing's status is its current column's status.
  - The prior column is accepted only on c1–c4.
  - Its deviation from the register is stored as information (`api_check`, `api_fail_fields`). It never changes a status, and it never overrides that year's own document.
  - Measured on the 2.1b data: 173 of 5 447 prior-column figures deviate from the register, often consistently across several sums. For example, 924830972 is +56 007 in both sum eiendeler and sum gjeld. These are restated comparatives, not OCR errors.
- **The blocking rule lives in the engine.** It is the pure function `documentFigures(column)` in `src/engine/document-inputs.ts`. It returns values only for an accepted column. Otherwise every figure is an absence with reason `failed_reconciliation` (`types.ts:34`). Story 2.9 consumes it.
- **A column with no reconciliation status does not throw** (approval, 2026-10-21). For example, a restored `extracted` row that has not been checked again. `documentFigures` gives every figure as an absence with the new reason `not_reconciled`. That keeps it visible, not silent, and one such row never gives a whole analysis page a 500. This is tested.

**Decisions (agent, open to change at approval):**
- **Configuration.** `[reconciliation]` holds three values, each validated by `load_config`:
  - `within_document_bound_kr = 5`
  - `between_sources_floor_kr = 5`
  - `between_sources_tolerance = "0.00001"`, a decimal string parsed as an exact `Fraction`, never a float.

  The two rules have separate keys and separate functions, never one shared value. The within-document bound also gates 2.1a's digits-only pass, whose rules are otherwise unchanged.
- **Between-source check, per column.**
  - Each column is compared with the single SELSKAP API filing for the same orgnr and the column's `stated_year`, reusing `filing_brreg_id`.
  - It covers the 11 fields that the document and `register.key_figures` share by name, wherever both values are non-NULL.
  - A figure passes when `|doc − api| ≤ max(floor, tol × |api|)`, in exact integer/`Fraction` arithmetic on øre.
  - The result is `pass` when every compared figure passes, `fail` when any one fails, and `not_evaluable` when there is no API filing or no shared non-NULL pair (as in 2021–2022).
- **Column status.**
  - A current column is `reconciled` when none of c1–c4 or `api_check` fails, and both core checks were evaluable: c1 (income statement) and c3 (balance).
  - A prior column uses the same rule without `api_check`.
  - Otherwise the column is `failed_reconciliation`.
- **Stored.** One migration adds three columns to `register.document_column`:
  - `status`: `reconciled` or `failed_reconciliation`, or NULL while the document is `extracted`;
  - `api_check`: `pass`, `fail` or `not_evaluable`;
  - `api_fail_fields text[]`.
  c1–c4 are rewritten under the configured bound. `register.document.status` keeps `extracted` as an allowed value, because the data-only dumps under `.local/` hold `extracted` rows and must still restore. The data-quality flag is the document's `status`.
- **When it runs.** Every `--documents` run first re-reconciles every stored generated document of the listed companies. This is pure arithmetic over the stored øre figures, so it is idempotent, and a changed tolerance takes effect on the next run. A newly read document is reconciled before it is written, in the same transaction. No new CLI argument is added.
- **Flag never from confidence.** No reconciliation function takes a confidence. A test rewrites every `conf` value in the recorded TSVs, then reads and reconciles again, and gets the same flag and status.

## Boundaries & Constraints

**Always:** Python's only arithmetic is the `× 100` conversion and these checks (AD-1). Each of the two rules is one function with one configured value, and the two are never combined. A NULL is never treated as 0. The new migration re-exports the seed in the same PR. Both values and their reasons go into `docs/data-sources-brreg.md`. AD-15 and the reading-rules section are updated.

**Never:** derive or store a missing component. Change 2.1a's reading rules beyond where the bound comes from. Re-OCR a stored document. Write `register.filing.status`. Add the sub-total checks (`deferred-work.md:62`) or the flag for API-internal mismatches (`:20`); both stay open. Edit `analysis/output/**`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | What fails if the guard is deleted |
|---|---|---|---|
| Krone rounding | 979607008/2025 read, API 6984522 | both columns `reconciled`, `api_check` pass | `test_reconcile.py::test_contract_979607008_2025_reconciles` |
| Split / merge | `722 632 310` for 72 632 310; `8 335 514` for 833 514 | column `failed_reconciliation` | `test_reconcile.py::test_split_merge_fails` |
| Rules not collapsed | within-doc deviation of 100 kr on a sum of 72 632 310 (inside any proportional tolerance) | c1 fail | `test_reconcile.py::test_absolute_bound_rejects_what_proportional_admits` |
| Millions reporter | doc 127 220 000 000 vs API 127 221 000 000 | api pass | `test_reconcile.py::test_millions_rounding_passes` |
| Floor | doc 300 vs API 304; 300 vs 306 | pass; fail | `test_reconcile.py::test_floor_five_kroner` |
| Swapped digits | 911701251: 114 120 459 vs API 114 210 458 | api fail | `test_reconcile.py::test_swapped_digits_fail` |
| Factor 10 | doc = 10 × API | api fail, field named in `api_fail_fields` | `test_reconcile.py::test_factor_ten_fails` |
| No API filing | 2022 column | api `not_evaluable`; reconciled if c1–c4 pass | `test_reconcile.py::test_no_api_filing_not_evaluable` |
| Core not evaluable | c3 `not_evaluable`, rest pass | `failed_reconciliation` | `test_reconcile.py::test_core_check_must_be_evaluable` |
| Prior fails | current passes, prior c1 fails | document `reconciled`; prior column `failed_reconciliation` | `test_reconcile.py::test_prior_failure_does_not_fail_filing` |
| Restated prior | prior c1–c4 pass, +56 007 against the register in two sums | prior `reconciled`, `api_check` fail with both fields stored | `test_reconcile.py::test_prior_register_deviation_is_information` |
| Confidence | every TSV `conf` changed | same flag and status | `test_reconcile.py::test_flag_ignores_confidence` |
| Re-reconcile | stored `extracted` rows, no fetch served | statuses set, no PDF fetched, no OCR | `test_documents_run.py::test_stored_documents_reconciled_without_ocr` |
| Config | missing or non-decimal tolerance, negative bound | `ConfigError` | `test_config.py::test_reconciliation_config_validated` |
| Blocking | a `failed_reconciliation` column; a column with status NULL (not yet reconciled) | failed: every figure absent, reason `failed_reconciliation`. NULL status: every figure absent, reason `not_reconciled` (no throw). `reconciled`: its values; a NULL figure stays `null` (its reason is 2.9's) | `test/engine/document-inputs.test.ts` "a failed column passes no value", "an unreconciled column is absent as not_reconciled" |

</frozen-after-approval>

## Code Map

- `ingest/src/peerless_ingest/documents.py:56-165`:
  - `TOLERANCE_KR` (:63) becomes a parameter from config.
  - `checks` (:122-129) and `_close` (:108-111) are the within-document rule; reuse them.
  - The digits gate is `combine` (:135-159).
  - Thread the bound through `read_document(pdf, bound)` (:226).
- `ingest/src/peerless_ingest/reconcile.py` (new):
  - `api_check(figures, api, floor, tol)` and `column_status(role, c1..c4, api)`, all pure.
  - `SHARED_FIELDS` are the 11 shared names.
  - No confidence parameter anywhere.
- `ingest/src/peerless_ingest/config.py:34-63`: `Config` gains three fields: `within_document_bound_kr: int`, `between_sources_floor_kr: int` and `between_sources_tolerance: Fraction`. `ingest/config.toml` gains `[reconciliation]`.
- `src/engine/document-inputs.ts` (new):
  - `documentFigures(column)` maps a stored column (status plus the 23 `_ore` strings) to values or absences.
  - It parses figures with `parseOre` (`src/engine/inputs.ts`) and uses the `failed_reconciliation` reason in `src/engine/types.ts:34-35`.
  - Test file: `test/engine/document-inputs.test.ts`.
- `ingest/src/peerless_ingest/write.py`:
  - `document_outcome` (:191-211; "extracted" is hard-coded at :211) takes the reconciled columns.
  - `DOCUMENT_COLUMN_COLUMNS` (:145-157) gains the three columns.
  - `filing_brreg_id` (:221-231) is reused per `stated_year`.
  - Add `stored_generated_documents(conn, orgnr)` and `update_reconciliation(...)`. API figures come from `register.key_figures` (øre, keyed by `brreg_id`).
- `ingest/src/peerless_ingest/run.py`:
  - `STATUSES` (:59) becomes `reconciled, failed_reconciliation, not_extracted, paper`. Update the summary lines (:95-111).
  - `run_documents` (:422-455) re-reconciles stored documents per listed company before `_load_documents` (:301-366).
- `supabase/migrations/<ts>_document_reconciliation.sql` (new): the columns, the CHECKs and the comments. The grants are unchanged, because `ingest` already has UPDATE.
- Tests that assert `"extracted"` and must change:
  - `test_documents_write.py:108`, `:178`
  - `test_documents_run.py:131`, `:140`
  - `test_documents.py:46` (`test_check_bound_is_five_kroner` reads config).
- Fixtures:
  - `ingest/tests/fixtures/documents/*` and `document_fakes.py:26`
  - the API recording `ingest/tests/fixtures/recorded/regnskap_979607008_2025.json`
- Seed: `scripts/seed-format.ts` column lists if they are hard-coded; re-export with `pnpm seed:export`.
- Docs:
  - `docs/data-sources-brreg.md:126-128`, `:201`, `:211`, `:297`; add a reconciliation section with the values, their reasons and the two measurements
  - `technical-note-architecture.md:215-216` (AD-15) and `:343`
  - PRD FR-58 (`prd.md:802-809`): the reason for the tolerance
  - `AGENTS.md`:
    - the stack paragraph ("until then a read document is `extracted`")
    - Known API traps, "Reconcile with two rules"
  - `README` (the ingest notes)
  - `docs/ai-log.md` (money)
  - the session file

## Tasks & Acceptance

**Execution:**
- [x] The migration and its DB test (`test/db/documents.test.ts`: column status, `api_check` values), then re-export the seed.
- [x] Config, `reconcile.py` and `documents.py` (the bound as a parameter), with `test_reconcile.py` and `test_config.py` covering every matrix row.
- [x] `write.py` and `run.py`: reconcile on write and re-reconcile stored documents; update `test_documents_{write,run}.py`.
- [x] `src/engine/document-inputs.ts` and `test/engine/document-inputs.test.ts`.
- [ ] Docs, `ai-log.md` (what could go wrong with the tolerances and the blocking rule), the session file, `sprint-status.yaml`.
- [ ] Acceptance run, last, after review, the fixes and the full suite, on the local DB with the 2.1b rows present. Check the dump is intact first. Run `pnpm ingest --documents seed/document-run.json`. Record the counts per status and year in the PR. Take a new data-only dump, and keep the old one.

**Acceptance Criteria:** `epics.md` Story 2.2 and the matrix above. In addition: given the acceptance run, when it ends, then no stored document is still `extracted`, and no PDF was read for a document that was already stored.

## Spec Change Log

- **2026-10-21, Meinich (after implementation, on the real data): a fifth within-document check, c5, and the balance check is evaluable when c3 or c5 passes.**
  - **The change.** c5 compares sum eiendeler with sum egenkapital + sum gjeld, under the same `within_document_bound_kr` (5 kr). This amends the Decision "both core checks were evaluable: c1 and c3". The rule is now: c1 passes, c3 or c5 passes, and no check among c1–c5 fails, plus `api_check` for the current column.
  - **AD-15.** The sum is formed only inside the check and is never stored.
  - **Migration.** `document_column` gains `c5`.
  - **Why.** `sum_egenkapital_gjeld` is NULL in 836 of 1 946 stored current columns, because 2.1a misses the "SUM EGENKAPITAL OG GJELD" label. c3 and c4 both need it, so 913 filings would have failed with no misread figure. In 802 of the 836, the other three balance figures agree within 5 kr. Example: 919062223, 2021–2023.
  - **Effect.** Measured on the stored rows, before the API check, the current columns that reconcile go from 1 033 to 1 803 of 1 946.
  - **The label fix belongs to Story 2.3** (`deferred-work.md`): a hit rate before and after, and a new reading of the ~836 documents.
  - **Tests:**
    - `test_reconcile.py::test_c5_balances_without_total` (the 919062223 pattern: total NULL, c3 and c4 `not_evaluable`, c5 pass, `reconciled`);
    - `test_reconcile.py::test_c5_fails_on_one_misread_figure` (each of sum eiendeler, sum egenkapital and sum gjeld misread in turn → c5 fail → `failed_reconciliation`).
  - **KEEP:** the two rules' values, the prior-column rule and `documentFigures`, unchanged.

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | verif V1 | A newly read document's API comparison in `_load_documents` is never asserted on the run path; `api_by_year = {}` or dropping `year - 1` keeps every test green | medium | `test_links_brreg_id_by_year` asserts only `(year, brreg_id, status)`; `test_contract_979607008_2025_db` builds `api_by_year` itself | patch |
| 2 | verif V2 | No test writes `api_check = fail` with non-empty `api_fail_fields` through `write_document` or `update_reconciliation` | medium | every writer-path row in `ingest/tests` has `[]`; non-empty only in hand-written SQL in `test/db/documents.test.ts` | patch |
| 3 | verif V3; blind B11 | `_rereconcile`'s error branches (`ValueError` from `document_status`, `rowcount != 1`) are untested; deleting either keeps tests green | medium | "not reconciled" and "reconciliation not written" appear in no test | patch |
| 4 | verif V4 | `DOCUMENT_FIGURE_COLUMNS` is never compared with the table's columns; a misspelt value round-trips through the fixture | medium | the test checks count, distinctness and `_ore` shape only | patch |
| 5 | edge E1; verif other 1 | In `_rereconcile`, a `psycopg.Error` from `api_figures` or `stored_generated_documents` escapes per-document handling, unlike `_load_documents` | low | the first `try` (run.py:359) catches only `ValueError`; a direct correction to the except tuple | patch |
| 6 | edge E4; blind B10 | Stored `extracted` rows of unlisted companies stay `extracted` and the summary says nothing; the AC's "no stored document is still `extracted`" has no signal | medium | `run_documents` re-reconciles only listed companies; no count of remaining `extracted` rows. Summary cosmetics in B10 (no totals line, header when empty) are rejected as cosmetic | patch: summary line with the count of `extracted` documents left in `register.document` |
| 7 | blind B9 | Re-reconciling does not refresh `document.brreg_id`, so it can stay NULL while `api_check` compared against a filing loaded later by a plain `pnpm ingest` | low | `update_reconciliation` sets no `brreg_id`; `api_figures` looks it up each run. One column in the UPDATE | patch |
| 8 | blind B2; edge E6, E7 | README, `config.toml`, the technical note's AD-15 table bullet, `data-sources-brreg.md` "What is stored", the `document-inputs.ts` header and the migration header still say four checks (c1–c4) | low | grep; direct correction | patch |
| 9 | blind B1 | AGENTS.md says "the two values in `[reconciliation]`"; there are three keys | low | AGENTS.md:26. The workflow routes agent-context edits to defer, but AGENTS.md requires it to match the code in the same change, and this PR introduced the sentence | patch |
| 10 | blind B3 | The first Story 2.2 `ai-log.md` entry says a column with c3 not evaluable is never reconciled; c5 changed that | low | the log forbids editing entries; the c5 entry must say it corrects item 4 | patch |
| 11 | blind B7 | "A changed value takes effect on the next run" overstates: the digits-only gate ran at read time under the old bound and is not redone | low | `_rereconcile` recomputes c1–c5 from stored figures only. Direct correction to README/docs wording | patch |
| 12 | blind B8 | c5 can fail by 6–10 kr of legitimate rounding while c3 and c4 pass (each allows 5 kr) | low | real in arithmetic; 0 such columns among the 3 892 stored. Changing the rule is the human's; recorded as a limit in the c5 `ai-log.md` risk list | patch (docs only) |
| 13 | blind B6 | `documentFigures` ignores role, so a reconciled prior column with `api_check = fail` (a restated comparative) passes values; 2.9 could use it as that year's data | low | no consumer yet; which column 2.9 picks for a year is selection, not this function's values | defer (2.9 obligation) |
| 14 | edge E2; blind B5 | The database does not tie `document.status` to the current column's status | low | one writer, both written in one transaction in Python; a constraint trigger adds complexity for a state no writer produces (2.1b triage row 13) | reject |
| 15 | edge E3; blind B12 | The tolerance and bound have no upper limit (`"5"` = 500 % loads) | low | a human-set value in a committed file, reviewed in its PR; a cap is a new guard for a state not demonstrated | reject |
| 16 | edge E5 | "Reconciled before it is written, in the same transaction": `api_figures` is read before the write transaction | false | no concurrent writer: documents mode writes no key figures, and step 1 is the only writer of `key_figures` | reject |
| 17 | blind B13 | `api_fail_fields` CHECK allows duplicates and any order | low | the only writer writes `SHARED_FIELDS` order once each | reject |
| 18 | blind B4 | `sprint-status.yaml` says `in-progress` while the spec is `in-review`; the docs task box is unchecked | low | tracking bookkeeping; corrected by the build session | patch (session) |
| 19 | blind B14 | The I/O matrix has no c5 rows | low | the fix edits this build's spec; c5's tests are named in the Spec Change Log | reject |
| 20 | verif other 2 | `prior_failed` on the written path and its summary line are unasserted | low | summary output only; folded into the run-path test of #1 at no extra cost | patch (with #1) |

## Verification

**Commands:**
- `pnpm test:ingest`: passes against the seeded DB, with no Tesseract on the host.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db`: passes.
- `pnpm seed && pnpm seed && pnpm seed:export`: `git diff --exit-code seed/` after the re-export commit.
- `pnpm build && pnpm check:routes && pnpm test:e2e`: passes.
