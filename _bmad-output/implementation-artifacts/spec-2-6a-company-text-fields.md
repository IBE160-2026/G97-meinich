---
title: 'Story 2.6a: The register text classification reads'
type: 'feature'
created: '2026-11-08'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9d43524bf1d3a036d6cc4861f25e389aceb48586'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.6 classifies on the company's business description and statement of purpose, but step 1 stores neither, so `register.company` has nothing to classify on.

**Approach:** Step 1 stores `aktivitet` and `vedtektsfestetFormaal` with the search fields, in a plain run and in `--companies-only`. Meinich runs `--companies-only`; the seed is then re-exported.

## Boundaries & Constraints

**Always:**
- Two nullable text columns on `register.company`, `aktivitet` and `vedtektsfestet_formaal`, added to `SEARCH_FIELD_COLUMNS`, so one read timestamp and one write path cover them. Absent, `null`, an empty array or only blank lines is NULL, never an empty string.
- The register delivers each as an array of lines; store them stripped and joined with one space, in array order.
- AS only (Meinich, 2026-11-08): any other organisational form, in the unit or in the stored row, has NULL in both columns, also when it had text from before, and is counted as `register_text_skipped_not_as` in `run.step1`.
- No silent fallback: a value that is not an array, or an element that is not a string, raises `ValueError` in `parse_company` and is reported through the existing "bulk unit not loaded" failure.
- Commit in small logical steps, each type-checking: migration, parser and writer with tests, docs. Review fixes are separate commits. No orgnr in commit messages.
- A migration is applied locally only with `pnpm exec supabase migration up`, which keeps the data.

**Never:**
- Do not run `pnpm ingest` in any mode, `pnpm seed`, `pnpm seed:export`, `pnpm db:reset`, or anything that truncates a `register` table: the local database holds document rows that a seed would remove. Do not delete anything under `.local/`.
- No model call. Do not open `labels.csv` or `labels-blind.csv`, or anything under `analysis/labelled-set/`.
- No print of text per company against the real database, in logs or in commits; fixtures use invented text.
- Nothing else about the company changes: a companies-only run still updates only `SEARCH_FIELD_COLUMNS`.

## I/O & Edge-Case Matrix

Every row names the test that fails if its code is removed.

| Scenario | Input / State | Expected Output / Behavior | Test that fails without it |
|----------|--------------|---------------------------|----------------|
| Lines joined | `aktivitet: [" Utvikling av", "programvare "]` | `"Utvikling av programvare"` | `ingest/tests/test_parse.py::test_register_text_lines_are_joined` |
| Both fields read | unit with both | each in its own field | `ingest/tests/test_parse.py::test_parse_company_reads_both_register_texts` |
| Nothing there | absent, `null`, `[]`, `["", " "]` | `None` | `ingest/tests/test_parse.py::test_absent_or_blank_register_text_is_none` |
| Wrong shape | a string, or `[1]` | `ValueError` naming the field | `ingest/tests/test_parse.py::test_register_text_of_the_wrong_shape_refused` |
| Plain run writes | a run over a unit | both columns stored | `ingest/tests/test_write.py::test_run_stores_the_register_text` |
| Companies-only writes | stored company, bulk has text | both columns set, `search_fields_read_at` moved, other columns unchanged | `ingest/tests/test_write.py::test_companies_only_updates_the_search_fields_and_nothing_else` (extended) |
| Wrong shape in a run | one malformed unit | that orgnr in the summary's `failed`, the others written | `ingest/tests/test_write.py::test_companies_only_reports_malformed_register_text` |
| Not an AS, unit | form ENK with text | not read, both `None` | `ingest/tests/test_parse.py::test_register_text_is_not_read_for_another_form` |
| No longer AS, plain run | stored text, register says ENK | cleared, counted | `ingest/tests/test_write.py::test_plain_run_clears_the_text_of_a_company_no_longer_as` |
| Another form, companies-only | register or stored row says ENK | cleared, counted | `ingest/tests/test_write.py::test_companies_only_clears_and_counts_the_text_of_another_form` |
| Columns exist | migration applied | both `text`, nullable | `test/db/company-search.test.ts` (extended column list) |

</frozen-after-approval>

## Code Map

- `supabase/migrations/` -- new file after `20261105120000`, with comments in the style of `20261014120000_register_company_search.sql`, which added the search fields. Grants follow the table's existing ones.
- `ingest/src/peerless_ingest/parse.py:94-115,183` -- `Company`, `parse_company`; `_search_field` is the neighbouring pattern.
- `ingest/src/peerless_ingest/write.py:30` -- `SEARCH_FIELD_COLUMNS`; `UPSERT_COMPANY` and `UPDATE_SEARCH_FIELDS` derive from it, so no new SQL.
- `ingest/src/peerless_ingest/run.py:1445` -- `run_companies_only` docstring names the fields; its parse failure path already records "bulk unit not loaded".
- `ingest/tests/test_write.py:39` -- `Company` fixture needs the new fields; `:289` `search_fields`, `:351`.
- `test/db/company-search.test.ts:13,146` -- column lists.
- `docs/data-sources-brreg.md:23`, `README.md:76,108`, `AGENTS.md` (the `--companies-only` sentence) -- say what the mode now fills.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261108120000_company_register_text.sql` -- add the two columns with comments -- Story 2.6 reads them.
- [x] `ingest/src/peerless_ingest/parse.py` -- add the fields and a strict `_register_text` -- the register delivers arrays of lines.
- [x] `ingest/src/peerless_ingest/write.py` -- extend `SEARCH_FIELD_COLUMNS`, update its comment -- one write path.
- [x] `ingest/src/peerless_ingest/run.py` -- update the docstring -- it names the fields.
- [x] `ingest/tests/test_parse.py`, `ingest/tests/test_write.py`, `test/db/company-search.test.ts` -- the matrix's tests.
- [x] `docs/data-sources-brreg.md`, `README.md`, `AGENTS.md` -- what the mode fills.

**Acceptance Criteria:**
- Given the migration applied with `supabase migration up`, when the step-1 and database tests run, then they pass and no `register` row has changed.
- Given the committed seed from before this migration, when the suite runs before the re-export, then any failure caused only by the seed lacking the two columns is listed in the report and left for the re-export, not worked around.

## Implementation Notes

- **The seed sequence, after Meinich's `--companies-only` (run 1708, 2026-11-08), totals only.** Run 1708: 17 802 updated, 81 not in the bulk file, 7 475 without text because not an AS, 0 failed, `code_differs` 29. Steps 3-9 of Story 2.5b/2.5c's C2 (no re-read was needed).
  - Dump and backup first: `.local/document-tables-before-2.6a-seed/` (six tables) copied to `C:\Users\cmein\peerless-backups\` with equal sha256. `.local/document-run-2.5d/` equals the database's rows outside the allow-list: 2 688 documents and 5 362 columns, row for row.
  - One transaction, counts checked before COMMIT: 5 362 columns and 2 688 documents deleted, 97 and 194 left. `pnpm derive`: 86 fingerprints of 97 columns. `seed:export`, committed alone (`c6d990e`).
  - `seed/demo/company.csv` against the committed file, column by column, same 17 883 orgnrs in the same order: `aktivitet` and `vedtektsfestet_formaal` added (10 327 AS with both, 0 other forms); `search_fields_read_at` on 17 802 rows; municipality number and name on the same 28 rows; `naeringskode1_beskrivelse` emptied on 28. Nothing else changed. The 28 and 28 are off the allow-list (the 17 802 include its 20). `code_differs` is 29 and 28 emptied: the 29th was already empty. File 2.62 MB to 5.28 MB. `manifest.json` changed in the migration id and the file's sha256 only.
  - `pnpm seed` twice, the re-export unchanged. Restored from the 2.5d dump, `pnpm derive`: 2 785 documents, 5 556 columns, 2 537 fingerprints, 10 327 AS with text; all six tables row for row equal to the dump taken before the deletion.
- **An empty `naeringskode1_beskrivelse` in search:** `test/db/search.test.ts` "returns a company without an industry name, beskrivelse null" and `e2e/search.spec.ts` "a result without an industry name shows the code alone".
- **A test only the re-export could reach:** `test/db/seed.test.ts` "refuses a file whose header does not match the table columns" expected the column list to end on `slettedato`; fixed in `c023e7c`.
- **`reader_commit`** moves from `df34a2d` to `ab27ed0`, the last commit changing `ingest/`. `pnpm analysis:seed-documents` shows 97 and 194 rows equal, 0 differing, and exits 1 on "97 documents not read by the current reader commit" until the next re-read. No figure reading changed, so no re-read is needed.

## Spec Change Log

- 2026-11-08, Meinich: AS only, after review pass 1 raised sole proprietors' text in the seed. Added to the frozen block by the human's decision: the rule, its count and three matrix rows. The seed sequence (Story 2.5c's steps 3-9) runs after Meinich's `--companies-only`, because a re-export before it would hold NULL text.

## Review Triage Log

Review pass 1, 2026-11-08. Layers: Blind Hunter (BH), Edge Case Hunter (ECH), Verification Gap (VG).

| Finding | Layer | Verdict | Evidence and route |
|---|---|---|---|
| CI fails until the seed is re-exported | BH, VG | medium | Real and expected (second AC). Merge blocker: the re-export lands in this PR after Meinich's run. No code change. |
| The seed publishes free text for sole proprietors | BH | medium | Real: about 6 300 `ENK` rows. Classification reads AS only. Intent gap, put to Meinich before the run. |
| `search_fields_read_at` set while the text was never read; NULL is ambiguous | BH, ECH | medium | Real until the run. Frozen: one read timestamp. Deferred: Story 2.6 refuses to classify when no covered AS has text. |
| Blank line between lines not pinned | VG, BH | low | Patched, `e5295f5`, with a test. |
| Internal whitespace survives | ECH, BH | low | Patched, `e5295f5`, with a test. |
| NULL assertion in the companies-only test is vacuous | BH | medium | Patched, `e5295f5`: the row holds text before the run. |
| Docs: demo C's failure path; plain run not named; docstring unwrapped | BH | low | Patched, `e5295f5`. |
| Lone surrogate aborts the run | ECH | false | Not shown reachable: 0 wrong-shape values in the bulk file of 2026-11-08, and an encode error fails loudly. |
| A malformed text loses the whole unit | BH | false | The spec's decision (frozen); 0 such values among the stored companies in the bulk file of 2026-11-08. |
| Plain-run wrong shape has no own test | BH | low | Rejected: the shared `except ValueError` path is tested (`test_write.py`, generic case; VG confirms). |
| Text kept when the primary code differs | BH | false | The text describes the company, not the stored code; `naeringskode1_beskrivelse` is cleared because it names a code. |
| No totals for text coverage | BH | low | Rejected: a count query after the run answers it, totals only. |
| Second field not in the blank parameters | BH | low | Rejected: one function, the field name is its only difference. |
| "Search fields" names now cover text | BH | low | Rejected: the frozen spec extends `SEARCH_FIELD_COLUMNS`; a rename adds churn. |
| Empty Implementation Notes, no session file | BH | low | Handled before the PR. |

## Verification

**Commands:**
- `pnpm exec supabase migration up` -- expected: the one new migration applied.
- `pnpm check:pins; pnpm lint; pnpm typecheck; pnpm test; pnpm test:db; pnpm test:ingest` -- expected: pass, apart from what the second acceptance criterion names.
