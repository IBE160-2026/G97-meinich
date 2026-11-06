---
title: 'Story 2.5c: Refuse a digit read as two, and cost lines that do not sum'
type: 'bugfix'
created: '2026-11-06'
status: 'ready-for-dev'
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
- [ ] Before inputs committed: `analysis/output/ocr-sm2-before-2.5c/`, `document-run-counts-before-2.5c.json`
- [ ] R1 and R4 in `layout.py`, with their tests
- [ ] R2 and R3 in `src/engine`, derive counts, with their tests
- [ ] Counts and the SM-2 2.5c section, with tests
- [ ] Docs: `AGENTS.md`, `data-sources-brreg.md`, `key-figures.md` (R3's reason), `ai-log.md`, the session file, `deferred-work.md` (close the 2.5b entry)
- [ ] Planning documents: PRD open question 21 and Story 3.1a in `epics.md`, `.memlog.md` `(change)` lines; the technical note if R2/R3 change what it says; the PR line "Planning documents:"
- [ ] After review and Meinich's yes: C2's nine steps from 2.5b, timed; `pnpm analysis:document-run after-2.5c` between steps 2 and 4; `pnpm analysis:sm2` after step 6

**Acceptance Criteria:**
- Given every stored document re-read, when `pnpm analysis:sm2` runs, then misreads and phantoms reaching the engine on the reference set are no more than before, and the columns that do not sum are counted before and after, as totals.
- Given the re-read, when the counts run, then every document has the current `reader_commit` or is listed as not replaced with its reason.
- Given C2 step 8, when the row counts are queried, then they equal the new dump's, and `pnpm derive` succeeds.
- Given any committed file or PR text, then no fingerprint result is tied to an orgnr of the labelled set.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:ingest` -- all green
- C2 step 7: `pnpm seed` twice, `pnpm seed:export && git diff --exit-code seed/` -- no diff
- `pnpm analysis:sm2 && git diff analysis/output/ocr-sm2.md` -- generation date only, after the acceptance run
