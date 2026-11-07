# Story 2.5c: refuse a digit read as two, and cost lines that do not sum

**Date:** 2026-11-06
**Tool:** Claude Code (BMAD coordinator session and its implementation subagent, Opus 5.5)
**Story / issue:** Story 2.5c (FR-10, FR-28 batch part, NFR25), branch `story/2.5c-refuse-digit-read-as-two`, issue [#47](https://github.com/IBE160-2026/G97-meinich/issues/47)
**Result:** commits `e6c1cde` (probe), `e8f97b3` (spec ready for dev), `e87f166` (before seed copy), `2b88e3f` (R1, R4), `58c5b71` (R2, R3), `1b8337c` (derive counts), `57dd893` (document-run counts and the before counts), `a088bb2` (SM-2 section), the docs and planning commits that follow them, and after the re-read `6ee327b` (Story 2.5d), `29bf5fc` (seed), `02163fa` (R4 count), `105dbb7` (reports) and `46ae913` (README Seed)

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
- **Review fixes (the coordinator's review, 2026-11-06):** R1 described as checking every token, with the merged digits-pass token wide and kept out by the gates and checks; the regression check committed as `analysis/ocr/reader_regression.py` with `analysis/output/reader-regression-2.5c.md`, including where each changed `varer` came from (19 of 21 from the income statement's row, none from a balance row); counts stated with their scope (the probe's 344 documents, 20 reference and 324 2.1b, against all 363 cached); R3 said to empty a line when either the line or the subtotal is wrong, with its limits (prior column, the two lines together); the SM-2 errors reaching the engine apply R3; `costSumCounts` uses the engine's bound and main lines and skips no-revenue columns; R3 counted by absence reason; acceptance criteria for R1's bound and R4 in `epics.md`, and Story 3.1a's absence shown with Story 2.9's copy; FR-58's limit retitled; the deferred entry marked "fixed in code; re-read pending". A second AI-log entry records what the first overstated.
- **Verification:** `pnpm typecheck`, ESLint over `src`, `scripts` and `test` (`pnpm lint` also lints `.local/wt-5.1/`, a worktree outside this branch, and fails there), `pnpm test` (all files), `pnpm test:ingest` (303 passed), and `pnpm test:db` with the one local failure above. Each new test was run with its guard removed and failed. The regression check (`analysis/ocr/reader_regression.py`, on the host with no OCR, `e87f166` against the new reader): in the probe's 344 documents (20 reference, 324 2.1b) 77 figures refused, all in 2.1b documents, the probe's count at k = 0.6; c1–c4 unchanged in every column; `varer` changed in 21 columns; all 363 cached documents give the same counts.

## After review pass 1: Meinich's decisions, the re-read and the seed (2026-11-06 to 2026-11-07)

- **Meinich's answers to the two findings put to them (spec change log):**
  - R1 counts a leading minus. The BMAD session measured it first on the 363 cached words files, with no OCR, as Meinich asked: 0 figures and 0 c1–c4 results change, and the reference set loses 0 correct figures. Adopted with a "-23" test (`test_negative_digit_read_as_two_refused`).
  - R3 uses the between-sources rule, max(5 kr, 0.001 % of `sumOmloepsmidler`), set once in `src/engine` with `test/engine/between-sources-tolerance.test.ts` against `[reconciliation]` in `ingest/config.toml`.
- **The `test:db` timeouts, found rather than rerun (Meinich):** `test/db/seed.test.ts:304` left the loader transaction open after the deliberate foreign-key error in `copyIn`, so the next nine seed tests waited 60 s each. The cause predates this story; it is deferred (`deferred-work.md`, `a7465b5`).
- **The re-read (C2), with Meinich's yes on 2026-11-06.** The BMAD session took step 1: the dump `.local/document-tables-before-2.5c-reread/`, with the same rows as after Story 2.5b, and a backup with equal sha256. Meinich ran step 2 in their own PowerShell windows:
  - the reference set (run 782): 38 min 20 s;
  - the 2.1b rows (run 783): 11 h 31 min 37 s, about 12 hours in all;
  - in both runs 0 not replaced and 0 failures, and all 2 044 documents have reader commit `b57aaba`.
- **The review session's check of the re-read** (Meinich's separate review session, against the step-1 dump):
  - no column went from reconciled to not reconciled;
  - 139 figures were emptied: 130 above their own total, 6 exactly 21 000 000 kr over the cost total, and the rest `varer` read from the income statement;
  - the only figure that may have been correct is in a prior column, and no figure other than `varer` changed.
- **The review session's finding for the PR:** in one company-year the stock is now unknown, because R4 found no `varer` on the balance, while the next filing year's document prints about 3.6 million kr as its prior-year figure. That is an empty field, not a wrong figure. The BMAD session made it a count rather than a sentence: `emptied_current_held_by_next_prior` in `scripts/document-run-counts.ts` (with a test), shown in the SM-2 report's R4 subsection. It measures 1 (`02163fa`, `105dbb7`).
- **Steps 3–9, with Meinich's yes on 2026-11-07:**
  - the new dump `.local/document-run-2.5c/` and the three tables in full in `.local/document-tables-after-2.5c-reread/`, each copied to `C:\Users\cmein\peerless-backups\` with equal sha256;
  - the delete in one transaction, checked before COMMIT;
  - derive;
  - the seed re-export, on its own (`29bf5fc`);
  - two loads, and a re-export that came out unchanged;
  - the restore;
  - derive.

  The counts are in the spec's implementation notes.
- **Corrected after the review session's check of steps 3–9** (the finding is the review session's): `29bf5fc`'s message says the seed lost three figures in the reference set's prior columns (`salgsinntekt`, `varekostnad`, `sum_kortsiktig_gjeld`) and no current column changed. The diff shows `salgsinntekt` in a reconciled prior column, `varekostnad` in a prior column that does not reconcile, and `leverandorgjeld` in a reconciled current column, all three above their own total; `leverandorgjeld` is not a fingerprint input. The BMAD session had split the CSV lines on commas, which shifts every field after a quoted `digits_pass_fields` value; a `csv` parse gives the review session's result. The spec's step 6 is corrected; the commit message is wrong on this point and is not rewritten. README "Seed" now names `.local/document-run-2.5c/` (`46ae913`). No dump was deleted.
- **Story 2.5d added to `epics.md`** (Meinich, proposed by the review session; `6ee327b`): the labelled set's document run, with a local OCR word cache keyed on the PDF's sha256, the Tesseract version, the traineddata sha256 and the render settings. A miss is reported, the PDF is still fetched on a re-read, and the cache stays local until Story 5.4. Three re-reads have cost about 12 hours each, every fix was after OCR, and after the labelled set a re-read would take more than 35 hours. The BMAD session added the options of both Tesseract passes to the key, because they change the words too.
- **Verification after step 9:**
  - pins, env, typecheck, `pnpm test` (982), `pnpm test:db` (167, the derive test included), `pnpm test:ingest` (304), build and `check:routes` all pass.
  - ESLint passes on the repository. `pnpm lint` also lints `.local/wt-5.1/`, another branch's worktree, and fails there.
  - e2e: 109 passed and 7 failed in `e2e/analysis.spec.ts`, on peer counts and medians. Those expectations are computed from `seed/demo/`, while the local database also holds the 2.1b fingerprints. CI runs e2e on the seed alone.

## Not done here

- A rerun of `analysis/ocr/cost_sum.py` from its cache: it reads the cached words, not the database, so the re-read does not change it.
- The PR, its review and the merge.

## Links

- AI log: "2026-11-06 — Story 2.5c: refuse a digit read as two, cost lines short of their total, and two unguarded lines".
- Probe: `analysis/output/cost-sum-probe.md`.
- Planning documents: PRD open question 21 (answered) and FR-58, `.memlog.md`, `epics.md` Stories 2.5c and 3.1a, the technical note's fingerprint rules.
