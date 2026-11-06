# Story 2.5c: refuse a digit read as two, and cost lines that do not sum

**Date:** 2026-11-06
**Tool:** Claude Code (BMAD coordinator session and its implementation subagent, Opus 5.5)
**Story / issue:** Story 2.5c (FR-10, FR-28 batch part, NFR25), branch `story/2.5c-refuse-digit-read-as-two`, issue [#47](https://github.com/IBE160-2026/G97-meinich/issues/47)
**Result:** commits `e6c1cde` (probe), `e8f97b3` (spec ready for dev), `e87f166` (before seed copy), `2b88e3f` (R1, R4), `58c5b71` (R2, R3), `1b8337c` (derive counts), `57dd893` (document-run counts and the before counts), `a088bb2` (SM-2 section), and the docs and planning commits that follow them

## Goal

Implement `_bmad-output/implementation-artifacts/spec-2-5c-refuse-a-digit-read-as-two.md` up to the re-read: the before inputs, R1 and R4 in step 1, R2 and R3 in `src/engine`, the counts, the SM-2 section, the docs and the planning documents. The re-read (C2's nine steps) waits for Meinich's yes.

## Prompts that mattered

- "Read … spec-2-5c-refuse-a-digit-read-as-two.md fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start." With: commit in small logical steps on the story branch, no push, and no re-read, `pnpm ingest`, `pnpm seed`, `pnpm seed:export`, row deletion or long data run.

## What came back, and what was done with it

- **Accepted (built as the spec says):**
  - R1: `layout.MIN_DIGIT_WIDTH = 0.6` beside `LABEL_SIMILARITY`, and `layout.too_narrow`, called in `parse_number` in both passes, a "1" a full digit. R4: `"varer": "balanse"` in `TARGET_PAGES`.
  - R2: `cost_lines_short_of_total` in `fingerprintOf`, before the `negative_unexplained` check, only when the four main lines are read.
  - R3: `guardCurrentAssets(figures, role, sumOmloepsmidler)` in `src/engine/document-inputs.ts` and the absence `exceeds_api_subtotal` in `src/engine/types.ts`; `readValues` reads it as an empty line. `pnpm derive`, the seed fingerprint test and the SM-2 type totals apply it.
  - `pnpm derive` prints the R2 count, how many have `nedskrivninger` empty, and the figures R3 emptied. `pnpm analysis:document-run` writes the same from the engine (`engine`) and the stored `varer` against `.local/document-run-2.5b/` (`varer_against_dump`).
  - The SM-2 section "Before and after Story 2.5c".
- **Choices the spec left open, flagged for review:**
  - The digest of a fingerprint whose line R3 emptied is of the inputs the fingerprint read (the line as null), not of the stored figure. Both are deterministic from the stored figures and the subtotal; this one says what the categories were computed from.
  - The before counts (`document-run-counts-before-2.5c.json`) were written after the counts script gained the engine counts, not with the seed copy, so they carry R2 and R3 on the pre-re-read rows. Nothing in the local database changed in between.
  - The Story 2.5b section's "after" is now the before-2.5c copy, as the 2.3b section's became the 2.5b copy, so the 2.5c re-read does not move it. Only that section's sentence naming its inputs changed in the report.
  - `guardCurrentAssets` takes the column role, so "a prior column is unchanged" is a guard a test can remove.
- **Corrected during the session, and how it was caught:**
  - `test/derive.test.ts`'s `negative_balance_remainder` case used a `sum_omloepsmidler` of 1 øre. With R3 both asset lines are above it and are emptied, so the column got a fingerprint and the test failed. That is R3 working as decided; the case now keeps each line within the subtotal and the two together above it.
  - `test/db/derive.test.ts` "rebuilds exactly the rows the table held" fails on the local database (1 865 stored, 1 843 rebuilt), because the stored table predates R2 and R3. A rolled-back rebuild compared by key: 27 rows gone (R2), 5 added (no longer `negative_balance_remainder` once R3 empties the line), 3 with a new digest. It passes again after `pnpm derive` (C2); on the committed seed nothing changes (`test/fingerprint-seed.test.ts`).
  - A Python string edit of `scripts/ocr-sm2.ts` dropped the backslash before four apostrophes in single-quoted strings; caught by `pnpm typecheck` and fixed.
- **Verification:** `pnpm typecheck`, ESLint over `src`, `scripts` and `test` (`pnpm lint` also lints `.local/wt-5.1/`, a worktree outside this branch, and fails there), `pnpm test` (all files), `pnpm test:ingest` (303 passed), and `pnpm test:db` with the one local failure above. Each new test was run with its guard removed and failed. The regression check over the probe's 363 cached documents, on the host with no OCR, read by `e87f166` and by the new code: 77 figures refused (the probe's count at k = 0.6), c1–c4 unchanged in all 726 columns, `varer` changed in 21 columns.

## Not done here

- C2's nine steps, the after counts (`pnpm analysis:document-run after-2.5c`), `pnpm analysis:sm2` after the seed re-export, and a rerun of `analysis/ocr/cost_sum.py` from its cache: after Meinich's yes.
- The PR, its review and the merge.

## Links

- AI log: "2026-11-06 — Story 2.5c: refuse a digit read as two, cost lines short of their total, and two unguarded lines".
- Probe: `analysis/output/cost-sum-probe.md`.
- Planning documents: PRD open question 21 (answered) and FR-58, `.memlog.md`, `epics.md` Stories 2.5c and 3.1a, the technical note's fingerprint rules.
