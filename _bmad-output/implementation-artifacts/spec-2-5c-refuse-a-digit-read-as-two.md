---
title: 'Story 2.5c: Refuse a digit read as two, and cost lines that do not sum'
type: 'bugfix'
created: '2026-11-06'
status: 'in-review'
baseline_commit: 'e6c1cdeacac341fc91d735af2a3576fb8a87e68d'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-5b-read-the-cost-lines-and-intangible-parts.md'
  - '{project-root}/analysis/output/cost-sum-probe.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- Tesseract adds a digit to a figure's leading group, and both passes agree: printed "2 375 956" is read as 23 375 956, "12 847 287" as 123 847 287, "9 094 303" as 94 094 303. The column still reconciles, because no within-document check covers the line (issue #47; `deferred-work.md`, `3d1a03d`).
- A cost line can be read with one digit replaced by another of the same width (8→3, 6→5), so the lines miss `sum_driftskostnad`. Derive skips a column over the total; one under it gets a fingerprint.
- The income statement's inventory-change row ("…ferdig tilvirkede varer") is stored as the balance field `varer`, a fingerprint input.
- A misread `kundefordringer` or `bankinnskudd` can enter the fingerprint (PRD open question 21).

**Approach:** refuse the narrow token in step 1, read `varer` from balance pages only, and re-read every stored document after a separate yes; in `src/engine`, without a re-read, keep a column whose cost lines miss the total out of the fingerprint, and empty a current asset line above the API's `sumOmloepsmidler`, each with a named reason.

**Probe (`analysis/output/cost-sum-probe.md`, `e6c1cde`; read-only, totals):**
- Under the total, 21 columns (17 current): 15 current and 3 prior are one digit substituted in a cost line, the total right (seen on the page images: 8→3, 6→5, 18→15); 1 is a printed write-down line refused in plain ("l 649 988") and misread in the digits pass; 1 has its total read only in the digits pass; 1 prior is unexplained. Most misses are 500, 1 000, 100 or 10 kr. All 27 reconciled current columns under the total have a fingerprint, and none has `nedskrivninger` read.
- Over the total, 27 columns: about half a digit read as two (2→23, 12→123, 17→172); the rest genuine negative cost rows outside the five lines (inventory change, capitalised development, gains), which derive already skips.
- Width ratio (token width ÷ digits × `Edges.pitch`): correct tokens ≥ 0.76 for a lone "1", ≥ 0.84 (2 digits) and ≥ 0.91 (3 digits) at the 1st percentile; the misreads 0.34–0.36.
- Per threshold, correct reference figures lost / 2.1b figures refused (344 documents): k = 0.5: 0 / 25; k = 0.6: 0 / 77; k = 0.7: 45 / 692; k = 0.8: 167 / 3 775. At k = 0.6 every changed figure is a refusal of the leading-group pattern; no c1–c4 changes. It catches all 7 columns exactly 21 000 000 kr over, 10 of 11 and 37 of 45 confirmed `salgsinntekt` errors (current, prior), against 3 and 3 at k = 0.5.
- `salgsinntekt` > `sum_driftsinntekter` + 5 kr in 56 current 2.1b columns (45 companies): 40 genuine (a negative "Annen driftsinntekt"), 11 confirmed and 4 uncertain misreads, 1 other. `kundefordringer` > the API's `sumOmloepsmidler`: 8 current columns, 6 a digit read as two, 2 API-side; `bankinnskudd`: none. Reference set: no misread or phantom in the four lines.
- The prior column reaches no engine code today (`DERIVE_SQL` reads `role = 'current'`); it is first used by Story 3.1a.

**Decisions (Meinich, 2026-11-06):**
- **D1 (Story 2.5) is unchanged:** band edges, the 5 % threshold, the type rule, `FINGERPRINT_FIELDS`.
- **R1, the width rule:** a digit token narrower than 0.6 × its digit count × `Edges.pitch`, a "1" counted as a full digit, is refused. Grounds: the probe's numbers above. A refused token leaves the field empty, never repaired. Tests use "23 375 956" and the "123" cases from the probe, and a correct figure with many "1"s that is not refused.
- **R2, the cost-sum rule in `src/engine`:** when the cost lines are read and fall short of `sum_driftskostnad` by more than 5 kr, the column gets no fingerprint, with the reason `cost_lines_short_of_total`. The reason is counted by derive; a company whose column has no fingerprint stays in the group, as today.
  - **R2 applies only when the four main lines are read** (`varekostnad`, `lonnskostnad`, `avskrivninger`, `annen_driftskostnad`). `nedskrivninger` may be read or NULL, NULL counted as 0, as Story 2.5b's gates count a line with no row (Open Question answer (a), Meinich 2026-11-06). A column without `varekostnad` or another main line follows the interval rule, as today.
  - **The cost, from the probe:** one printed write-down that was not read (1 649 988 kr) loses its fingerprint, where today it gets an interval.
  - **Lines over the total keep `negative_unexplained`**, unchanged, so the existing counts stay comparable.
  - **The report after the re-read counts** the columns `cost_lines_short_of_total` applies to, and how many of them have `nedskrivninger` NULL.
- **R3, the unguarded lines.** In `src/engine`, without a re-read, a current column's `kundefordringer` or `bankinnskudd` above the filing's API `sumOmloepsmidler` + 5 kr is empty with a named reason. `salgsinntekt` and `leverandorgjeld` get only R1: 40 of 56 current cases where `salgsinntekt` exceeds the total are genuine, so a rule that a part cannot exceed its sum does not fit `salgsinntekt`. PRD open question 21 and Story 3.1a in `epics.md` are corrected in this PR, with a `.memlog.md` line.
- **R4, `varer` from balance pages only.** The review session finds 18 current columns with a negative `varer`; 10 have a fingerprint, all with inventory = false, so the error reaches the fingerprint today. The report counts, before and after, the columns whose `varer` was read from the income statement, positive values included: the columns whose `varer` the re-read empties or changes, from the 2.5b dump against the rows after (approved, Meinich 2026-11-06).
- **The re-read starts only after a separate yes**, is timed, and follows Story 2.5b's nine steps (C2), from the rows of `.local/document-run-2.5b/`. No dump is deleted. The labelled-set document run is not part of this story.
- **No fingerprint result is tied to an orgnr of the labelled set**, in output, chat, tests, commits or PR text. Totals only.

## Boundaries & Constraints

**Always:**
- A figure is the digits as printed, or None. R1 refuses; it never repairs, and it adds no confidence.
- R1 lives in `layout.parse_number`, both passes, one constant beside `LABEL_SIMILARITY`. A refused plain figure may still enter only through today's gates.
- R2 and R3 are engine rules on stored figures: no re-read, no change to `column_status`, the reconciliation rules or `ingest/config.toml`'s values.
- The re-read follows 2.3b/2.5b: one transaction per document, a new `reader_commit`, "not replaced" when columns are fewer or a reconciled column would fail.
- The "before" inputs are committed before the re-read.

**Never:**
- Change D1's thresholds, rule or fingerprint inputs; R2 is a reason to skip a column, not a change to the type rule.
- Start the re-read, `pnpm seed`, a deletion of 2.1b rows or the labelled-set run without its own yes.
- Run `seed:export` with rows outside the allow-list in the database. Delete any dump in `.local/`. Read at query time.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails if deleted |
|---|---|---|---|
| Digit read as two | plain tokens "23", "375", "956", "23" 28 px at pitch 39 | figure None; the digits pass offers 23375956, no gate admits it | `ingest/tests/test_layout.py::test_digit_read_as_two_refused`; `test_documents.py::test_digit_read_as_two_not_admitted_by_gate` |
| "123" for "12" | "123" one-and-a-half characters wide | None | `test_layout.py::test_digit_read_as_two_refused` (parametrised) |
| Many "1"s | "11 111 111" at its printed width | read | `test_layout.py::test_ones_not_refused` |
| `varer` | the inventory-change row on the income statement, "Varer" on the balance | `varer` from the balance only | `test_layout.py::test_varer_balance_only` |
| R2 under the total | four main lines read, `nedskrivninger` NULL, 500 kr under | skip `cost_lines_short_of_total` | `test/engine/fingerprint.test.ts` "cost lines short of the total" |
| R2 within 5 kr | lines 5 kr under | fingerprint | same file, boundary case |
| R2 a main line empty | `lonnskostnad` NULL, the rest under the total | fingerprint by the interval rule, as today | same file, "a main line empty keeps the interval rule" |
| R2 over the total | lines over by more than 5 kr | skip `negative_unexplained`, as today | existing `fingerprint.test.ts` case |
| R3 | current `kundefordringer` above API `sumOmloepsmidler` + 5 kr | empty, named reason; fingerprint treats it as empty | `test/engine/document-inputs.test.ts` "a current asset line above the API subtotal is empty" |
| R3 no API figure | `sumOmloepsmidler` NULL, or the prior column | unchanged | same file |
| Derive counts | rows hitting R2 and R3 | printed totals per reason | `test/derive.test.ts` |

</frozen-after-approval>

## Code Map

- `ingest/src/peerless_ingest/layout.py`: `parse_number` (:212) gets R1 after the digit check; a constant `MIN_DIGIT_WIDTH = 0.6` beside `LABEL_SIMILARITY` (:377); `TARGET_PAGES` (:353) gets `"varer": "balanse"`. Docstring and module notes follow.
- `ingest/src/peerless_ingest/documents.py`: no change of rule; its docstring names R1 where it describes refusals.
- `ingest/tests/test_layout.py`, `test_documents.py`: the I/O rows, with `tsv_builder` and the probe's token widths.
- `src/engine/types.ts` `Absence`: a new per-figure reason, `exceeds_api_subtotal` (R3).
- `src/engine/document-inputs.ts`: a function applying R3 to a current column's figures given the API `sumOmloepsmidler`; derive calls it after `documentFigures`.
- `src/engine/fingerprint.ts`: `readValues` treats R3's absence as an empty line; `SkipReason` gets `cost_lines_short_of_total` (R2), placed before `negative_unexplained`'s check, which is unchanged for lines over the total.
- `scripts/derive.ts`: `SKIP_REASONS` and the printed counts (R2), and a count of figures emptied by R3.
- `scripts/document-run-counts.ts`: the R2/R3 counts (R2's with how many have `nedskrivninger` NULL), and "`varer` read from the income statement" (R4) as the columns whose `varer` the re-read empties or changes, from the before dump against the after rows.
- `scripts/ocr-sm2.ts`/`ocr-sm2-compare.ts`: a "Before and after Story 2.5c" section like 2.5b's: class counts, misreads and phantoms reaching the engine, the columns that do not sum, before and after, totals only; before copy in `analysis/output/ocr-sm2-before-2.5c/`.
- No migration: no stored column changes. The seed is re-exported after the re-read (new `reader_commit`).
- Reuse: `analysis/ocr/cost_sum.py` reruns from the cache for the after counts on its 344 documents.

## Tasks & Acceptance

**Execution** (branch `story/2.5c-refuse-digit-read-as-two`, issue #47; small commits; stop at the re-read for Meinich's yes):
- [x] Before inputs committed: `analysis/output/ocr-sm2-before-2.5c/`, `document-run-counts-before-2.5c.json`
- [x] R1 and R4 in `layout.py`, with their tests
- [x] R2 and R3 in `src/engine`, derive counts, with their tests
- [x] Counts and the SM-2 2.5c section, with tests
- [x] Docs: `AGENTS.md`, `data-sources-brreg.md`, `key-figures.md` (R3's reason), `ai-log.md`, the session file, `deferred-work.md` (close the 2.5b entry)
- [x] Planning documents: PRD open question 21 and Story 3.1a in `epics.md`, `.memlog.md` `(change)` lines; the technical note if R2/R3 change what it says; the PR line "Planning documents:"
- [x] After review and Meinich's yes: C2's nine steps from 2.5b, timed; `pnpm analysis:document-run after-2.5c` between steps 2 and 4; `pnpm analysis:sm2` after step 6. Done 2026-11-07 (Meinich's yes to the re-read on 2026-11-06; Meinich ran step 2 in their own windows; yes to steps 3–9 on 2026-11-07). The rows after the re-read are dumped to `.local/document-run-2.5c/`, which README "Seed" names (`46ae913`); the seed re-export is `29bf5fc`; the counts and the report are `105dbb7`.

**Acceptance Criteria:**
- Given every stored document re-read, when `pnpm analysis:sm2` runs, then misreads and phantoms reaching the engine on the reference set are no more than before, and the columns that do not sum are counted before and after, as totals.
- Given the re-read, when the counts run, then every document has the current `reader_commit` or is listed as not replaced with its reason.
- Given C2 step 8, when the row counts are queried, then they equal the new dump's, and `pnpm derive` succeeds.
- Given any committed file or PR text, then no fingerprint result is tied to an orgnr of the labelled set.

## Implementation Notes

- **As built** (`e87f166`, `2b88e3f`, `58c5b71`, `1b8337c`, `57dd893`, `a088bb2`, `8ffffd9`, `31594ff`).
  - R1: `layout.too_narrow`, called in `parse_number` after the digit check and in the digits-only pass's one-token branch, so both passes refuse; the same rule as the probe's (`analysis/ocr/cost_sum.py`, `narrow_rule`, k = 0.6, one = 1.0).
  - R3: `guardCurrentAssets(figures, role, sumOmloepsmidler)` takes the column role, so the prior-column case is a guard a test removes. `pnpm derive`, `test/fingerprint-seed.test.ts` and the SM-2 type totals call it after `documentFigures`. The digest of a fingerprint whose line R3 emptied is of the inputs the fingerprint read (that line null), not the stored figure: **for Meinich to confirm or reject** in review.
  - The before counts were written after `scripts/document-run-counts.ts` gained the engine counts (`57dd893`), still before any re-read; the local database did not change after the seed copy (`e87f166`).
  - The Story 2.5b section's "after" is now `analysis/output/ocr-sm2-before-2.5c/`, as the 2.3b section's became the 2.5b copy, so the re-read does not move it.
- **Regression check (one-off, on the host, no OCR).** The 363 documents cached by the probe (`analysis/.cache/ocr/probe/*.words.json`, 726 columns), read by `e87f166` and by the new code: 77 figures refused (salgsinntekt 55, avskrivninger 13, varekostnad 6, forskning_og_utvikling 3), the probe's count at k = 0.6; c1–c4 unchanged in every column; `varer` changed in 21 columns (14 negative before); nothing else differs.
- **On the local data, before the re-read** (`document-run-counts-before-2.5c.json`, totals): R2 27 current columns, all 27 with `nedskrivninger` empty; R3 `kundefordringer` 8, `bankinnskudd` 0; 18 current and 15 prior columns with a negative `varer`. A rolled-back rebuild of `register.fingerprint`: 1 865 → 1 843 (27 gone, 5 added that were `negative_balance_remainder` before R3 emptied the line, 3 with a new digest). `test/db/derive.test.ts` "rebuilds exactly the rows the table held" fails locally until `pnpm derive` runs (C2 step 5); the committed seed is unchanged by R2 and R3.
- **The re-read (C2, 2026-11-06 to 2026-11-07, totals only).** Step 1's dump `.local/document-tables-before-2.5c-reread/` held the same rows as after Story 2.5b. Step 2, run by Meinich: the reference set (run 782) took 38 min 20 s, 97 documents read, 0 not replaced, 0 failures; the 2.1b rows (run 783) took 11 h 31 min 37 s, 1 947 read, 0 not replaced, 0 failures. Every one of the 2 044 documents has reader commit `b57aaba`. The review session checked the run against the step-1 dump: no column went from reconciled to not reconciled; 139 figures were emptied (130 above their own total, 6 exactly 21 000 000 kr over the cost total, the rest `varer` read from the income statement); the only one that may have been correct is in a prior column; no figure other than `varer` changed. No column is now exactly 21 000 000 kr over its cost total (10 before). Step 3: `.local/document-run-2.5c/` (1 947 / 3 892) and the three tables in full in `.local/document-tables-after-2.5c-reread/`, each copied to `C:\Users\cmein\peerless-backups\` with equal sha256. Step 4 deleted 3 892 columns and 1 947 documents in one transaction, checked before COMMIT. Step 5: 86 fingerprints of the seed's 97 current columns. Step 6 (`29bf5fc`): the seed changed only in `reader_commit` and three emptied figures, each above its own total: `salgsinntekt` in a reconciled prior column, `varekostnad` in a prior column that does not reconcile, and `leverandorgjeld` in a reconciled current column, which the fingerprint does not read; its fingerprints did not change. Corrected after the review session's check of steps 3–9: `29bf5fc`'s message says three prior-column figures (`salgsinntekt`, `varekostnad`, `sum_kortsiktig_gjeld`) and no current column changed, because the BMAD session split the CSV lines on commas, which shifts the fields after a quoted `digits_pass_fields`; the message is wrong on this point and is not rewritten. Step 7: loaded twice, re-export unchanged. Step 8: 2 044 documents and 4 086 columns, one reader commit. Step 9: 1 856 fingerprints of 2 043 current columns, the same rows as the table held after the re-read; skipped `not_reconciled` 119, `no_revenue` 11, `cost_lines_short_of_total` 27 (all 27 with `nedskrivninger` empty), `negative_unexplained` 26, `negative_balance_remainder` 4; R3 emptied `kundefordringer` 8, `bankinnskudd` 0.
- **R4 leaves one stock unknown** (found by the review session after the re-read; totals only): in one company-year R4 found no `varer` on the balance, so the stock is now empty, while the next filing year's document prints about 3.6 million kr as its prior-year figure. An empty field, not a wrong figure. `pnpm analysis:document-run` counts such columns (`emptied_current_held_by_next_prior`, `02163fa`), and the SM-2 report's R4 subsection gives the total: 1.
- **e2e locally after step 9:** 109 passed, 7 failed in `e2e/analysis.spec.ts` (peer counts and medians). Its expectations are computed from `seed/demo/`, which holds fingerprints only for allow-listed companies, while the local database also holds the 2.1b rows' fingerprints, so stage 4 removes peers the test does not expect. CI runs e2e on the seed alone.
- **Tests changed:** `test/derive.test.ts`'s `negative_balance_remainder` case keeps each asset line within `sum_omloepsmidler` (a 1-øre subtotal now makes R3 empty both lines).

## Spec Change Log

- **2026-11-06, Meinich (review pass 1, triage 1): R1 counts a leading minus as a character.** This supersedes "its digit count" in R1 above.
  - **The finding.** The minus glyph is inside the token's box but was not counted, so a narrow negative misread ("-23") had about one pitch of slack.
  - **Measured first, as Meinich asked**, on the 363 cached words files (`analysis/.cache/ocr/probe/`), with no OCR, by the BMAD session (scratch script, recorded in the session file): counting the minus changes 0 figures and 0 c1–c4 results; the reference set loses 0 correct figures. Correct negative tokens, minus counted: at least 0.80 (one digit), 0.89 (two), 0.67 (three; 0.94 at the 1st percentile). A misread "-23" is about 0.5.
  - **The amendment.** A token with a leading minus needs 0.6 × (its digits + 1) × pitch. A test covers "-23" for "-2 375 956".
  - **KEEP:** R1's bound (0.6), a "1" as a full digit, both passes.

- **2026-11-06, Meinich (review pass 1, triage 19): R3 uses the between-sources rule.** This supersedes "+ 5 kr" in R3 and its I/O row.
  - **The finding.** R3 compares a document figure with an API figure. AGENTS.md requires the between-sources rule for that, max(5 kr, 0.001 % of the API figure), never collapsed with the within-document bound. At 5 kr, a line equal to nearly all current assets could exceed a rounded API total and be emptied.
  - **The amendment.** R3 empties a current `kundefordringer` or `bankinnskudd` only above `sumOmloepsmidler` + max(5 kr, 0.001 % of `sumOmloepsmidler`). The two values are set once in `src/engine`, with a test that fails if they differ from `[reconciliation]` in `ingest/config.toml`.
  - **KEEP:** R3's reason `exceeds_api_subtotal`, the current column only, `salgsinntekt` and `leverandorgjeld` unchecked.

## Review Triage Log

Pass 1, 2026-11-06. The diff ran from `e6c1cde` to `c4cf8f4`, without the copied seed CSVs, the counts JSON, the regenerated `ocr-sm2.md` and this spec (the probe and its output were committed in `e6c1cde` and shown at the checkpoint). Three layers ran: blind hunter (BH), edge-case hunter (EC) and verification gap (VG).

| # | Finding (layer) | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | A narrow negative misread ("-23") passes R1: the box includes the minus glyph, the count excludes it (EC, BH) | low | `too_narrow` uses `len(t.text.lstrip("-"))` against `t.width`; the font is monospaced, so the minus takes about one pitch and gives the misread that much slack. Negative cost lines are rare (inventory change, gains). | reject (the fix changes R1's frozen definition, "its digit count"); put to Meinich at the presentation |
| 2 | R1 is said to refuse the misread "in both passes"; the digits pass merges the groups into one wide token that R1 never refuses (BH, EC) | low | Confirmed: "23375956" spans the printed width, ratio about 0.9. `test_digit_read_as_two_not_admitted_by_gate` shows the gate keeps it out. The docs overclaim; the code is as decided. | patch (wording in `layout.py`, `documents.py`, AGENTS.md, `data-sources-brreg.md`, PRD) |
| 3 | An inflated pitch could refuse correct figures silently (EC) | low | Pre-existing reliance on `Edges.pitch` (the gap check); the probe found no correct reference figure lost at 0.6 on 20 documents and 77 refusals, all of the misread pattern, on 344. | reject |
| 4 | `varer` on a page classified otherwise (combined page, a balance continuation) is now never read, and the dump count cannot tell a removed inventory-change row from lost stock (EC, BH) | maybe-false | The regression over the cached words changed `varer` in 21 columns; whether any was real balance stock is not shown. | patch: split the 21 by where the old value came from, report it, and name the risk in the AI log |
| 5 | `parseVarerDump` accepts a malformed year; duplicate keys overwrite silently (EC) | false | The dump is written by `COPY` from a table whose primary key is (orgnr, filing_year, role); a malformed year cannot occur. | reject |
| 6 | The reviewed diff leaves out the probe and other evidence (BH) | false | Excluded by design and listed above; the probe was committed and shown to Meinich at the checkpoint. | reject |
| 7 | Document counts disagree: "344 2.1b documents" includes the 20 reference documents; elsewhere 363 (BH) | low | Confirmed: 344 = 20 + 44 + 180 + 100; 363 is every cached words file, the 2.5b probe's included. | patch (wording) |
| 8 | R3 is described as always a misread; 2 of the 8 cases were the API's (BH) | low | Confirmed in `types.ts` and `key-figures.md`; the data-sources note says 2 of 8 are API-side. | patch (wording: the figure or the subtotal is wrong; AI-log risk) |
| 9 | The SM-2 2.5c section shows an "After" for the reference set equal to "Before" before any re-read (BH) | low | The section is regenerated after C2 step 6, before merge (Tasks). | reject |
| 10 | The SM-2 "errors reaching the engine" ignore R3 although the section says the engine rules apply (BH) | low | Confirmed: `misreadsReachingEngine` filters on column status only (`ocr-sm2-compare.ts:587`). R3 empties no reference figure today. | patch: apply `guardCurrentAssets` there |
| 11 | `costSumCounts` keeps its own 5 kr and main-line list, tied to neither the engine nor the config; it also ignores `no_revenue` (VG, BH) | medium | Confirmed (`ocr-sm2-compare.ts:883-909`). | patch: import `ROUNDING_TOLERANCE_ORE` and `MAIN_COST_LINES`, and count "under" only where the engine would reach R2 |
| 12 | R4 and R1's bound have no acceptance criterion in `epics.md` (BH) | low | Confirmed: the new criteria cover R2 and R3. | patch |
| 13 | R3's limits are not written down: the prior column, and the two lines together above the subtotal (BH) | low | True as limits; the prior column reaches no engine code today. | patch (one sentence in FR-58, the technical note, the AI log) |
| 14 | `exceeds_api_subtotal` has no planned user-facing reason (BH) | low | Story 3.1a's new criterion names no copy; AGENTS.md's no-silent-fallback rule. | patch (Story 3.1a criterion: the reason is shown, Story 2.9) |
| 15 | `deferred-work.md` closes the entry before the re-read (BH) | low | Confirmed. | patch ("fixed in code; re-read pending") |
| 16 | R3's emptied count compares object identity (BH) | low | Confirmed in `derive.ts` and `currentAssetsEmptied`; correct today. | patch (compare kind and reason) |
| 17 | FR-58's "Known limit, not yet guarded" heading and the memlog's "the four unguarded lines get the width rule" no longer match (BH) | low | Confirmed (`prd.md:834`, `.memlog.md`). | patch (wording; R1 applies to every figure) |
| 18 | The regression check behind R1 (77 refused, c1–c4 unchanged, `varer` in 21) rests on a scratch run (BH) | medium | AGENTS.md: a claim in the AI log names what backs it. | patch: commit it as a mode of `analysis/ocr/cost_sum.py` with its recorded output |
| 19 | R3 compares a document figure with an API figure at 5 kr; AGENTS.md's between-sources rule is max(5 kr, 0.001 % of the API figure) (VG) | low | Real: a line equal to all current assets could exceed a rounded API total by up to 0.001 % and be emptied. The frozen R3 says "+ 5 kr"; changing it edits the frozen intent. | reject (spec edit); put to Meinich at the presentation |
| 20 | `pnpm test:db`: nine seed-export tests time out at 60 s in the full run (the build session's own run) | false | `test/db/seed.test.ts` passes alone in 0.4 s; the full run is rerun after the patches. | reject, rerun |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:ingest` -- all green
- C2 step 7: `pnpm seed` twice, `pnpm seed:export && git diff --exit-code seed/` -- no diff
- `pnpm analysis:sm2 && git diff analysis/output/ocr-sm2.md` -- generation date only, after the acceptance run
