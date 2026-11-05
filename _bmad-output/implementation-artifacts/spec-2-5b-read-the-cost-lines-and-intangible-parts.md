---
title: 'Story 2.5b: Read the cost lines and the parts of intangible assets'
type: 'bugfix'
created: '2026-11-01'
status: 'in-review'
baseline_commit: 'db72a90382b3ccc8c6cfb37c2d2a2639789c1a67'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/data-sources-brreg.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-3b-read-the-balance-total.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- Half of the fingerprints are undetermined (Story 2.5, local 2.1b rows: 937 of 1 876; 196 of 421 companies at their newest year). Mostly an empty `lonnskostnad` or another empty cost line leaves the personnel band spanning low to high. `lonnskostnad` is empty in 531 of 1 920 reconciled columns. On the reference set, the cost lines are not read in 34 cases (`avskrivninger` 17, `lonnskostnad` 5, `annen_driftskostnad` 5, `varekostnad` 2), and `sum_immaterielle_eiendeler` in 10.
- The cost lines are in no within-document check, so the digits pass can never fill one (`documents.combine`).
- `sum_immaterielle_eiendeler` includes the deferred tax asset and goodwill. Story 5.2 cannot consider a rule that counts only capitalised own development, because the parts are not read (`deferred-work.md`, the two Story 2.5 entries).

**Approach:**
- **Probe first, as in 2.3.** Find out why the lines come out empty, with evidence from the documents, before anything is fixed.
- Fix what the probe shows, on labels and gates only.
- Read the printed parts of intangible assets as new stored fields.
- Measure before and after on the reference set.
- After a separate yes, re-read the stored documents.

**Decisions (Meinich, 2026-11-01):**
- **D1 (Story 2.5) is locked.** No change to band edges, the 5 % threshold, the type rule or `FINGERPRINT_FIELDS`. The new parts are stored and reach `documentFigures`, but the fingerprint does not read them.
- **The report gives before and after on the reference set:**
  - every class count per field;
  - the misread figures and the phantoms that reach the engine, with each new one listed;
  - the share of fingerprints and companies without a type, as totals.
  - More figures read must not be paid for with new errors.
- **No fingerprint result is shown for an orgnr in the labelled set** (`analysis/labelled-set/drawn.json`, branch `story/5.1-labelled-set`), in output, chat, tests or commits. Eight reference-set companies are in it, so fingerprint results are totals only.
- **Re-read and the labelled-set document run start only after a separate yes from Meinich.** Each is asked for on its own.
- **Q1, all four parts.** The fields are `forskning_og_utvikling`, `konsesjoner_patenter`, `goodwill` and `utsatt_skattefordel`. A parts-sum check (the four against `sum_immaterielle_eiendeler`, 5 kr) is a digits-pass gate for them, in `combine` only.
- **Q2, Meinich transcribes the parts.** The columns are added to `transcriptions.csv` for every reference column with a non-blank `sum_immaterielle_eiendeler` (blank elsewhere, meaning not printed). The parts are measured like every other field, headline included. Before the transcription is committed, the 2.5b section is not generated.
- **Q3, the cost-line sum gate is decided at the probe checkpoint.** It is built only if the probe shows refused figure tokens as a cause.
- **Q4, the labelled-set document run is not in this story.** It follows the merge as its own step, after its own yes. This PR's acceptance run is the re-read of the reference set and of the 2.1b rows.

**Approval changes (Meinich, 2026-11-01):**
- **C1, the transcription comes before the probe.**
  - The template is made first, from the transcribed `sum_immaterielle_eiendeler` only. It shows Meinich no OCR value.
  - Meinich transcribes the parts, and the review session checks that they sum to the total.
  - The probe's result is shown to Meinich only after the transcription is committed.
- **C2, the seed and the re-read follow 2.5's order.** Nothing below runs without Meinich's yes: no `pnpm seed`, no deletion of 2.1b rows. `seed:export` cannot run while the 2.1b rows are in the database. After the yes, in this order, stopping at any deviation:
  1. dump and back up;
  2. `--reread` every stored document (the reference set's and the 2.1b rows);
  3. a new dump;
  4. delete the rows outside the allow-list in one controlled transaction, with the counts checked before COMMIT;
  5. `pnpm derive`;
  6. `pnpm seed:export`, committed on its own;
  7. `pnpm seed` twice, then export again, unchanged;
  8. restore from the new dump and confirm the row counts;
  9. `pnpm derive`.
  - **Restoring a dump without the new columns** (`.local/document-run-2.4/`) still works after the migration, before the re-read. This is tested.
  - README "Seed" names the dump that applies.
- **C3, a time limit per document (watchdog) is part of this story** (`deferred-work.md`, the hanging-fetch entry).
  - It has a test, lands in its own commit, and comes before the re-read, because about 40 hours of OCR lie ahead.
  - When the limit expires, the document is listed as not fetched (not replaced, on a re-read) and the run goes on.

## Boundaries & Constraints

**Always:**
- **The probe comes before any fix.** It is read-only and runs in the step-1 image. It names, per empty line, the cause, with the OCR words as evidence. Its result is shown to Meinich, with the proposed fix, before `layout.py` or `documents.py` changes.
- A figure is still the digits as printed, or None. A new gate admits a digits-pass figure only through a check that passes with a plain-pass figure among its other operands, as `combine` does today.
- The fold and the matching that work today still match everything they match today.
- A re-read follows 2.3b's rules: one transaction per document, a new `reader_commit`, and "not replaced" when columns are fewer or a reconciled column would fail.
- The "before" inputs are committed before any re-read.
- **The watchdog is enforced outside the network call.**
  - The fetch runs where the run can stop waiting for it; `urlopen`'s socket timeout alone did not fire in 2.3b.
  - The limit is one value in `ingest/config.toml`.
  - An expired document is a failure in the run record (stage `documents` or `reread`, reason naming the limit), so the run exits 1 at the end and a rerun resumes.

**Never:**
- Repair a figure token, or use OCR confidence.
- Change `column_status`, the reconciliation rules or their values in `ingest/config.toml`.
- Change D1's thresholds, rule or fingerprint inputs.
- Start a re-read, `pnpm seed`, a deletion of 2.1b rows, or the labelled-set document run, without its own yes.
- Run `seed:export` with rows outside the allow-list in the database.
- Read at query time.
- Delete any dump in `.local/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails if deleted |
|---|---|---|---|
| Intangible parts | a balance with "Forskning og utvikling", "Konsesjoner, patenter…", "Goodwill", "Utsatt skattefordel" rows | each part stored; `sum_immaterielle_eiendeler` unchanged | `ingest/tests/test_layout.py::test_intangible_parts_read` |
| Part vs total | "Sum immaterielle eiendeler" beside its parts | no part matches the sum row, nor the sum a part | `test_layout.py::test_intangible_part_not_sum` |
| Parts gate | a part refused in plain, read in digits; the four parts sum to a plain `sum_immaterielle_eiendeler` | kept from the digits pass; if the sum fails or an operand is absent, it stays absent | `test_documents.py::test_intangible_part_recovered_only_through_gate` |
| Cost gate (only if approved at the checkpoint, Q3) | a cost line refused in plain, read in digits; lines sum to `sum_driftskostnad` with a plain figure among them | kept; otherwise absent | `test_documents.py::test_cost_line_recovered_through_gate` |
| Probe-specific fixes | one test per cause the probe names, chosen with the fix | as the fix decided | named in the Spec Change Log when the fix is approved |
| New columns | migration on a database with rows | NULL in old rows; the `digits_pass_fields` CHECK admits the new names | `test/db/grants.test.ts` (the new columns), `test/db/document-columns.test.ts` |
| Seed | the committed seed after re-export | loads, re-exports unchanged | CI `pnpm seed` + `git diff --exit-code seed/` |
| Watchdog | a fetch that never returns (fake transport blocking past the limit), then a normal document | the first listed as not fetched with the limit as reason; the second read and written; exit 1 | `ingest/tests/test_documents_run.py::test_hung_fetch_is_abandoned_and_run_goes_on` |
| Watchdog on re-read | the same hang during `--reread` | listed as not replaced; stored figures and version unchanged | `test_documents_run.py::test_hung_fetch_on_reread_not_replaced` |
| Old dump restores | CSV rows with the pre-2.5b header, copied into the migrated tables with the column list read from the header | rows loaded, new columns NULL | `test/db/restore-old-dump.test.ts` (rolled back) |
| Fingerprint unchanged | new parts present in figures | the digest and categories are unchanged | `test/engine/fingerprint.test.ts` "the intangible parts do not enter the fingerprint" |

</frozen-after-approval>

## Code Map

- **The probe.** A committed, read-only probe, `analysis/ocr/empty_lines.py`. It is run like `consistency.py` (on the host with `uv run`, re-launched in `peerless-ingest:local` with `--in-image`).
  - For given (orgnr, year) pairs, it runs `documents.recognise` and both `parse_pages` passes.
  - Per target line, it records: no row matched (the nearest folded labels), matched but `parse_number` refused (the tokens), or read.
  - Its input is the reference set's not-read cells (from `ocr-sm2-compare`) plus a seeded draw of empty `lonnskostnad` columns from the local 2.1b rows.
  - Its output, `analysis/output/empty-lines-probe.md`, holds causes and OCR tokens, with no fingerprints.
- `ingest/src/peerless_ingest/layout.py`:
  - `TARGETS` (:275) gets the parts.
  - `avskrivninger` and `nedskrivninger` (:280-281) are long whole-label variants that a wrap past `JOIN_LINES` (:302) or a split row cannot match. The probe will say whether they are the cause.
  - `parse_number` (:182-208) is where tokens are refused.
  - Matching is in `_candidates` (:327) and `_match` (:348).
- `ingest/src/peerless_ingest/documents.py`:
  - `CHECK_FIELDS` (:71-76) and `checks` (:120) hold c1-c4.
  - The parts-sum gate check (and the cost-sum gate, if approved at the checkpoint) is added for `combine` (:138) only.
  - `reconcile.within_document_checks` and `column_status` are unchanged.
- `FIELDS` follows `TARGETS`, and so does `write.py`. Mind the column order of the SELECT at `write.py:431`.
- **New migration** after `20261101130000_fingerprint_references_company.sql`:
  - one `bigint` `<field>_ore` column per part, with a COMMENT;
  - drop and re-add the `digits_pass_fields` CHECK from `20261020120000_register_document_tables.sql:120-128`.
  - Apply it with `supabase migration up` only.
- `src/engine/document-inputs.ts:29-53` `DOCUMENT_FIGURE_COLUMNS` gets the parts. `derive.ts`, `fingerprint-spread.ts` and `document-run-counts.ts` follow it. `fingerprint.ts` `FINGERPRINT_FIELDS` (:105) is not touched.
- `scripts/ocr-sm2-compare.ts:15-38` `SM2_FIELDS` gets the four parts (Q2); `parseTranscriptions` then requires their columns. Add a "Before and after Story 2.5b" section, with the 2.3b section as the pattern. The undetermined share comes from `fingerprintOf` + `businessType` on the seed's reference columns, as totals.
- **Test fixtures:**
  - `ingest/tests/fixtures/documents/expected-979607008-{2025,2011}.json`;
  - `test_documents_write.py:38-70`;
  - `test/fixtures/seed/document-column-with-figure.csv`;
  - `test/engine/document-inputs.test.ts:27` and `test/derive.test.ts:20`.
- **Watchdog.** `fetch.fetch_document` (:182) and `UrllibTransport.get` (:80, `timeout=60` per socket operation). The deadline wraps the per-document fetch in `run.py`'s document and re-read loops (`_load_documents`, `_reread_documents`): a worker thread with a bounded wait, abandoned (daemon) on expiry. A new `[documents] fetch_deadline_s` in `ingest/config.toml`, read by `config.py`.
- **README "Seed".** The restore command names the columns from the dump's own header line, so a dump taken before a nullable column was added still restores. The text names `.local/document-run-2.4/` before the re-read and the new dump after it.
- **Reuse:** `tsv_builder.replace_row`, `document_fakes.FakeRecognise`, `conftest` `db`, and 2.3b's `--reread` path. `scripts/document-run-counts.ts` gives the 2.1b before and after.

## Tasks & Acceptance

**Execution** (branch `story/2.5b-read-cost-lines`, issue #45; one commit per bullet or smaller, as the work proceeds; **stop and report at each Wait or Checkpoint**, and at the acceptance run, which needs Meinich's yes):
- [x] Story 2.5b section in `epics.md`, `sprint-status.yaml` entry, GitHub issue
- [x] Before inputs committed: `analysis/output/ocr-sm2-before-2.5b/` and `document-run-counts-before-2.5b.json`, with the undetermined totals
- [x] Transcription template (C1): the four part columns in `transcriptions.csv`, the rows to fill named from the transcribed total only, no OCR value shown. **Wait: Meinich transcribes; the review session checks the sums; committed on its own**
- [x] Watchdog and its tests, its own commit (C3)
- [x] Probe script and its output, shown only after the transcription commit. **Checkpoint: Meinich approves the fix** (Spec Change Log)
- [x] `layout.py`/`documents.py` fixes and tests; the four parts in `TARGETS`, the parts-sum gate, `test_layout.py`/`test_documents.py`
- [x] Migration (applied with `supabase migration up`, 2.1b rows kept), `DOCUMENT_FIGURE_COLUMNS`, fixtures, DB tests; the old-dump restore test and README restore command
- [x] `ocr-sm2` before/after 2.5b section and tests
- [x] Docs: `AGENTS.md`, `data-sources-brreg.md`, `key-figures.md` if a field is named there, `ai-log.md`, the session file, `deferred-work.md` (close both entries)
- [x] Planning documents (AGENTS.md, "A decision travels upstream in the PR that makes it"): every decision of this story that makes the PRD, the technical note or `epics.md` wrong is written there in this PR, with a `(change)` line in the PRD's `.memlog.md` (the four new stored fields, the parts-sum gate, the per-document time limit, and whatever the probe checkpoint decides). The PR description has the line "Planning documents:" naming them, or "none affected"
- [ ] After review and Meinich's yes: C2's nine steps; `pnpm analysis:document-run after-2.5b` runs between steps 2 and 4, because it reads the 2.1b rows in the local database. `pnpm analysis:sm2` runs after step 6, because it reads the committed seed.

**Acceptance Criteria:**
- Given every stored document re-read, when `pnpm analysis:sm2` runs, then the 2.5b section gives, before and after, the class counts per field, the misreads and phantoms reaching the engine with each new one listed, and the undetermined share as totals.
- Given the re-read, when the counts run, then every document has the current `reader_commit` or is listed as not replaced with its reason.
- Given C2 step 8, when the row counts are queried, then they equal the new dump's line counts, and `pnpm derive` then succeeds.
- Given any committed file or PR text, then no fingerprint result is tied to an orgnr of the labelled set.

## Implementation Notes

- **F1–F3 as built** (`281f134`, `8c85ca8`).
  - `layout.extract` runs in stages, each filling only a field no earlier stage matched: `TARGETS` under `fold`, then `fold_mixed` (unchanged); then the cost lines' `LATER_VARIANTS` with their old variants, on income-statement pages only, under `fold` and `fold_mixed`; then every variant under `fold_notes`. The parts match on balance pages only, in every stage. The old variants of `avskrivninger` and `nedskrivninger` keep matching on any statement page, as before, so nothing matched today can move.
  - The gates are `documents.SUM_GATES` and `gate_admits`, called from `combine` only. "Matched" is a field some row with a number matched in either pass. A label printed with no figure in either column is no candidate row, so it counts as 0 in the gate (the probe's 2.1b `nedskrivninger` rows are all of this kind). A failing c1–c4 still drops every digits-only figure of the column, gated ones included.
- **One label beyond F2's list: "Utvikling".** 979607008/2025 (the contract fixture) prints the first part as "Utvikling" under the heading "Immaterielle eiendeler", and so do at least three probe documents. The probe's label table missed it because it listed only labels folding to "forskning". `utvikling` is a variant of `forskning_og_utvikling`, balance pages only. Hand-checked against the fixture PDF on 2026-11-05: Utvikling 6 986 262 / 953 319, Konsesjoner 36 250 / 60 417, Utsatt skattefordel 190 261 / 100 560, Goodwill 9 000 472 / 13 500 708, Sum 16 213 245 / 14 615 003. Goodwill 2024 is refused in the plain pass and enters through the parts-sum gate. **For Meinich to confirm or reject** in review.
- **Regression check (F1 condition).** All 40 documents cached by the probe (`analysis/.cache/ocr/probe/*.words.json`), read with the code at `68cffbb` (from `git archive`) and with the new code, on the host, no OCR:
  - `layout.extract`, plain and digits pass: 1 486 field matches by the old code, 1 486 with the same value in the new;
  - `read_words`: every figure the old read gave is the same in the new, and c1–c4 are unchanged in every column. 0 differences.
  - Figures the new read adds (totals over the 40 documents, both columns): avskrivninger 31, utsatt_skattefordel 26 (2 through the gate), lonnskostnad 17 (6 through the gate), annen_driftskostnad 12 (5 through the gate), forskning_og_utvikling 11 (1), konsesjoner_patenter 11 (1), goodwill 8, varekostnad 1 (through the gate).
  - Of the probe's three wrongly grouped tokens, none is admitted. Every gate-admitted figure in a reference cell equals the transcription; the measurement itself waits for Meinich's two cells.
- **Tests.** The I/O rows: `test_layout.py::test_intangible_parts_read`, `::test_intangible_part_not_sum`, `test_documents.py::test_intangible_part_recovered_only_through_gate`, `::test_cost_line_recovered_through_gate`. Probe-specific: `test_layout.py::test_depreciation_wordings`, `::test_depreciation_row_never_intangibles`, `::test_balance_row_never_depreciation` (F1's condition, both ways), `::test_plural_cost_lines`, `::test_note_reference_fold`, `::test_earlier_match_stands`. Each was run with its guard removed and failed: the gate in `combine`, `len(from_digits) != 1`, the not-evaluable branch for a matched unread row, a plain-only total, `TARGET_PAGES`, `LATER_PAGES`, the `fold_notes` stage, and the `utvikling` variant.
- **"Lønnskostnad ll, 2, 3"** is matched at stage 3 already, by the fuzzy rule against the plural "lonnskostnader" (one character off), before `fold_notes`. The value is the same; `test_note_reference_fold` uses "Varekostnad ll, 3", which only `fold_notes` matches.

- **The two additions of the change log entry "after F1–F3 were built"** (`5cf12f5`, `5af1fb6`, `ff6ece6`).
  - (a) `ingest/tests/test_documents.py::test_blank_printed_line_lets_the_gate_admit_nothing_unless_the_sum_holds`, built with `tsv_builder` on 994176021/2021's cost lines. In the cached words the lines there sum to sum kostnader without the blank `lonnskostnad` row, so it is 0 in fact; the test sets that row's figure to 2 000 000, missing from both passes, and a right digits-pass annen driftskostnad is then refused. It also admits one digits operand when the blank row is 0 and refuses two. It fails with the sum check removed, and with the at-most-one rule removed.
  - (b) `scripts/sum-gates.ts` counts, from stored columns, per gate, the figures admitted (a `digits_pass_fields` entry that is a gate operand) and those whose column holds another operand of the gate as NULL, "an operand counted as 0 (a blank row or no row)". The SM-2 section and `pnpm analysis:document-run` give them as totals; `test/sum-gates.test.ts` checks the TS mirror of the operands against `documents.py`. The before counts of the 2.1b rows predate the gates and show "no gate then"; nothing was regenerated.

## Spec Change Log

- **2026-11-05, Meinich (probe checkpoint): F1–F3 approved, with conditions.**
  - **Evidence:** the probe's report is `analysis/output/empty-lines-probe.md` (`bb9d4f4`). Its causes:
    - **Refused figure tokens** (Q3: yes, a cause). Reference set 11 of 18 empty cost cells; 2.1b draw 5 of 20 empty `lonnskostnad`. Examples: bold "1" read as "l" (`l4 481 267`), a junk prefix (`H5 260 438`), wrong grouping (`8 605 8349`). The digits pass is wrong by an order of magnitude in 3 of the 11.
    - **The depreciation wording.** "Avskrivning av / driftsmidler og / immaterielle eiendeler", or "Avskrivning", against the target "… på varige …": 17 of 17 reference cells.
    - **Note references read as letters.** "Lønnskostnad ll, 2, 3".
    - **Plurals.** "Lønnskostnader", "Andre driftskostnader".
    - **Not fixed.** The bold total "Sum immaterielle eiendeler" with 0 read as `Ö` (10 of 10 reference cells, all transcribed 0), and lines with no similar row (probably not printed).
  - **F1, labels.**
    - New variants for `avskrivninger`, `nedskrivninger`, `lonnskostnad` and `annen_driftskostnad`.
    - A third label fold, tried after `fold` and `fold_mixed` and never instead of them, drops trailing note-reference tokens (`l`, `ll`, digits, with a comma).
    - **Condition:** the wrapped depreciation label ("Avskrivning på varige driftsmidler og / immaterielle eiendeler", and the "av" and short forms) matches only as a continuation on an income-statement page. Tested both ways: the depreciation row is never read as intangible assets in the balance, and a balance intangibles row is never read as depreciation.
    - **Condition:** today's matching still matches everything it matches today, with the same value. Checked by the existing tests and by re-extracting every document cached by the probe (`analysis/.cache/ocr/probe/*.words.json`): each field the old extract found gives the same value. The result is recorded in the Implementation Notes.
  - **F2, the four parts** are new targets, written from the probe's labels: "Forskning og utvikling"; "Konsesjoner, patenter o.l." and its wrapped form; "Goodwill"; "Utsatt skattefordel". Balance pages only. The English layout is not read.
  - **F3, two sum gates** for the digits pass, in `combine` only, never in `column_status`:
    - the five cost lines against `sum_driftskostnad`;
    - the four parts against `sum_immaterielle_eiendeler`.
  - **When a gate admits a digits-pass figure.** All of these must hold:
    - every operand is present (a line with no matching row in the document counts as 0, in the gate only, and is never stored as 0);
    - the total is read in the plain pass;
    - at most one operand comes from the digits pass;
    - the sum holds within the configured 5 kr.
  - **A row that matched but whose figure was not read leaves the gate not evaluable.**
  - **Tests use the probe's cases.** `l4 481 267` (digits pass 4 481 267, correct 14 481 267), `8 605 8349` and `3 804 3836` are each refused, and one correct case is admitted.
  - **No figure is repaired.** `Ö` is never read as 0, and the line stays empty.
  - **The measurement waits.** Meinich checks two transcription cells against the PDF, not blind, because the probe showed the OCR value: 922184534/2025 prior `lonnskostnad` and 927533235/2023 current `lonnskostnad`. The before/after measurement is not run until that is settled.

- **2026-11-05, Meinich (after F1–F3 were built): "Utvikling" kept; a blank row counts as 0 in the gates, with two additions.**
  - **"Utvikling"** is kept as a variant of `forskning_og_utvikling`, on balance pages only. 979607008/2025 and at least three probe documents print the first part that way. The probe missed it because it listed only labels that fold to "forskning".
  - **A label printed with no figure in either pass** (for example a blank `nedskrivninger` row) counts as "no row", that is 0 in the gate only.
    - **The risk:** a figure that is printed but that OCR did not see at all. The probe found one such row: 994176021/2021 `lonnskostnad`.
    - **Addition (a):** a test built on that case shows that the gate admits nothing when a printed line is missing.
    - **Addition (b):** the report after the re-read gives, as totals, how many figures the gates admitted, and how many of those rested on an operand counted as 0.

## Review Triage Log

Pass 1, 2026-11-05. The diff ran from the merge base with `main` (`f9249a6`) to `7b3907e`, without the copied seed CSVs and the probe's raw JSON. Three layers ran: blind hunter (BH), edge-case hunter (EC) and verification gap (VG).

| # | Finding (layer) | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | The fuzzy pass lets one row fill two fields: an unwrapped depreciation row is `similar()` to the write-down variants (≈0.95), and the reverse (EC) | high | Confirmed with `layout.similar` on "Avskrivning av driftsmidler og immaterielle eiendeler" against the new `nedskrivningav…` variant and the 2.3 `nedskrivningavvarige…` one. None of the 40 cached probe documents trips it (the one shared value, 929481151/2022, is two rows each printed 0). | patch |
| 2 | An abandoned fetch thread keeps running: concurrent requests to the register, no cap, and a stalled network turns every remaining document into a 600 s failure (BH, EC) | medium | `_fetch_within` starts a daemon thread per document and never joins an expired one; the run goes on to the next fetch. | decision for Meinich (the frozen rule says the run goes on) |
| 3 | `_seconds` accepts `nan`/`inf` (BH, EC) | low | `nan <= 0` is False; `Thread.join(inf)` raises OverflowError. | patch |
| 4 | The deadline comment claims a legitimate fetch takes "at most five attempts of 60 s", but 60 s bounds a socket operation (BH, EC) | low | `ingest/config.toml` [documents] comment; `UrllibTransport.get` also sleeps inside the deadline. | patch (comment) |
| 5 | `combine(..., matched=None)` defaults to semantics production never uses (BH) | low | `read_words` always passes the set; a test or caller that omits it gets "every field matched". | patch |
| 6 | A row printed in one column and blank in the other is "matched", so the gate is not evaluable for the blank column; not documented (BH, VG other) | low | `read_words` builds `matched` per document. This is conservative and consistent with Meinich's rule for a row whose figure was not read. | patch (docstring, data-sources note) |
| 7 | The AI-log entry is stale and missing the watchdog risk; two claims rest on one-off runs (BH) | low | The Outcome still waits on the two cells (settled, `3d32823`); five commits are missing; the 1 486/1 486 and 2 044/4 086 claims name no test. | patch |
| 8 | `epic-2-context.md` omits Story 2.5b and dropped constraints that later stories rely on (BH) | medium | The recompile (`d365404`) removed the batch-OCR, reconciliation, deletion and banding rules. | patch, `b496b30` |
| 9 | The watchdog tests do not assert the `run.step1` row (BH) | low | Expired fetches go into `summary.failed`/`not_replaced`, which `record_failures` writes under stages `documents`/`reread`, a path `test_run_record.py` already covers. | reject |
| 10 | The gate trusts a plain total that no check confirmed (BH) | low | It needs the sum to hold within 5 kr against that total; a misread total is wrong by orders of magnitude, so the sum cannot hold unless an offered figure compensates exactly. Meinich's conditions did not require a passing c1. The fix would edit this spec's Design Notes. | reject |
| 11 | The regression check proves the old matches unchanged, not the new ones right (BH) | low | That is what the after measurement on the reference set measures (Story 2.5b section). | reject |
| 12 | Spec metadata is stale (`fetch_deadline_s`, the notes' commit list) (BH) | low | The fix edits this spec. | reject |
| 13 | The PR adds a migration without the seed re-export; the README names a dump that does not exist yet (BH) | false | Planned: C2 step 6 exports the seed in this PR before merge, and step 3 takes the dump, as in Story 2.5 (D4). | reject |
| 14 | "5 kr" is repeated in the docs rather than naming the config key (BH) | low | AGENTS.md and the docs give the value throughout; changing it is a wider docs change. | reject |
| 15 | A slow but healthy download is abandoned at 600 s on every rerun (EC) | low | 600 s for a PDF of a few MB; no fetch in the 2.1b or 2.3b runs came near it. | reject |
| 16 | `parseKeyFigureSubtotals` overwrites a duplicate or blank `brreg_id` silently (EC) | false | `brreg_id` is the primary key of `register.key_figures`, and `seed:export` writes it from that table. | reject |
| 17 | The TS gate counts and the Python gate could diverge (EC) | low | `test/sum-gates.test.ts` checks the TS operand list against `SUM_GATES` and `layout.PARTS`. | reject |
| 18 | The SQL in `document-run-counts.ts` `main` (fingerprints, `digits_pass_fields`) is never run by a test (VG) | medium | Only the pure functions and the committed JSON are tested. | defer |
| 19 | `restore-old-dump.test.ts` does not run the README's shell line (VG other) | low | Checked by hand on 2026-11-05: the README line, with its column list from `.local/document-run-2.4/`'s header, copied 1 947 documents and 3 892 columns into a rolled-back temp table shaped like today's. Recorded in the session file. | reject |


## Design Notes

**Why the gate and not a looser token rule.** A cost line refused in plain (for example a bold "l" or a split group) can only be trusted through arithmetic. The lines and `sum_driftskostnad` are all printed, and c1 already confirms `sum_driftskostnad`. A sum check with a 5 kr bound admits the right digits and catches a misread, which is wrong by orders of magnitude. It stays out of `column_status`, so no column changes status because of it.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:ingest` -- all green
- Before C2: no `pnpm seed`, no `seed:export` (the 2.1b rows are in the database). CI's seed steps fail until C2 step 6, as in 2.5.
- C2 step 7: `pnpm seed` twice, `pnpm seed:export && git diff --exit-code seed/` -- no diff
- C2 step 8: restored row counts equal the new dump's
- `pnpm analysis:sm2 && git diff analysis/output/ocr-sm2.md` -- generation date only, after the acceptance run
