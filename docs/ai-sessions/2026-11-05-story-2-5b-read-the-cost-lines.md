# Story 2.5b: read the cost lines and the parts of intangible assets

**Date:** 2026-11-01 to 2026-11-06
**Tool:** Claude Code (BMAD coordinator session and its implementation subagent, Opus 5.5)
**Story / issue:** Story 2.5b (FR-10, FR-28 batch part, NFR25), branch `story/2.5b-read-cost-lines`, issue [#45](https://github.com/IBE160-2026/G97-meinich/issues/45); PR not yet opened
**Result:** commits `a7fc2ee`, `2fea93b`, `e9444da` (before inputs and the transcription template), `6978bde` (watchdog), `bb9d4f4` (probe), `281f134`, `8c85ca8`, `bd94b80` (F1–F3), `b11b38b`, `4c6a1dc`, `9e60be3` (migration, DB tests, README restore), `5d2aad9` (SM-2 section), `9069710` and `2c2445c` (planning documents and docs), `5cf12f5`, `5af1fb6`, `ff6ece6`, `37947ee` (the two additions), `3d32823` (the transcription check), `6978bde`, `60b5af3`, `89f45f7`, `19b541b` (the fetch deadline and the stop after three), review fixes `901f859`, `26c074d`, `e652570`, `b496b30`; acceptance run `bb10497` (2.1b counts after), `970d572` (README restore), `3d1a03d` (deferred misread), `9b82409` (seed re-export), `27a9743`, `a696c6a` (SM-2 report)

## Goal

Implement `_bmad-output/implementation-artifacts/spec-2-5b-read-the-cost-lines-and-intangible-parts.md` up to the acceptance run: the before inputs, the transcription template, the watchdog, the probe, the fixes approved at the probe checkpoint, the four new stored fields, and the report section. The acceptance run (C2) and the measurement wait for Meinich's yes.

## Prompts that mattered

- "Read … spec-2-5b-read-the-cost-lines-and-intangible-parts.md fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start." The subagent stopped at the first Wait (Meinich transcribes the parts).
- After the probe checkpoint: "Do, in order, one commit per step or smaller: 1. The F1–F3 fixes … Include the regression check from the change log … 2. The migration … 3. The ocr-sm2 'Before and after Story 2.5b' section code and its tests. Do NOT generate or commit the measured report … 4. The docs and planning-document tasks …", with hard rules: do not touch `transcriptions.csv`, stage files by name, no push, no `pnpm seed` or `seed:export`, the migration only with `supabase migration up`, no re-read, no fingerprint result for any orgnr.

## What came back, and what was done with it

- **Accepted (built as the spec and its change log say):**
  - `scripts/document-run-counts.ts` counts the stored fingerprints by type, totals only; the before inputs are committed before any re-read.
  - F1–F3 in `layout.py` and `documents.py`, with the tests the I/O matrix names and the probe-specific ones (spec, Implementation Notes).
  - Migration `20261105120000_document_intangible_parts.sql`, applied with `supabase migration up`: the 2 044 local documents and 4 086 columns kept, the new columns NULL.
  - The README restore names the columns from the dump's header, so `.local/document-run-2.4/` still restores; `test/db/restore-old-dump.test.ts`.
  - The report's section "Before and after Story 2.5b"; the Story 2.3b section's "after" is now the copy taken before Story 2.5b, so later re-reads do not move it.
- **Choices the spec left open, flagged for review:**
  - A label beyond F2's list, "Utvikling", for `forskning_og_utvikling`: the contract fixture 979607008/2025 and three probe documents print the first part that way. Checked against the fixture PDF. **Kept by Meinich** (2026-11-05, Spec Change Log).
  - A label printed with no figure is no candidate row, so it counts as 0 in a sum gate ("a line with no matching row"). The probe's 2.1b `nedskrivninger` rows are all of this kind; treating them as matched would leave the cost gate not evaluable in those documents. **Accepted by Meinich with two additions:** (a) a test built on the probe's 994176021/2021 `lonnskostnad` row (`test_blank_printed_line_lets_the_gate_admit_nothing_unless_the_sum_holds`); (b) the report gives, as totals, the figures each gate admitted and how many rested on an operand counted as 0 (`scripts/sum-gates.ts`). In the real document that blank row is 0 (the other lines sum exactly to sum kostnader), so the test sets a printed figure there.
  - The parts are the last four fields of `TARGETS`, so `FIELDS` follows the table's column order (`test_documents_write.py::test_figure_columns_match_the_reading_library`).
  - An export from before the migration reads the parts as null, and the report says so (`lacksPartColumns`).
- **Corrected during the session, and how it was caught:**
  - "Lønnskostnad ll, 2, 3" turned out to match already at the later-variant stage, by the fuzzy rule against the plural; the first `fold_notes` test therefore passed with the fold removed. Caught by running the test with its guard removed; the test now uses "Varekostnad ll, 3".
  - The first not-evaluable test case also passed with its guard removed (the unread line was non-zero, so the sum failed anyway); it now uses an unread printed 0.
  - A README edit was first staged with CRLF line ends, which showed the whole file as changed; caught in `git diff --cached --stat` and rewritten with LF.

## Transcription check after the probe (no correction)

The probe showed two cells where both OCR passes agree with each other but not with the transcription. Meinich checked both against the PDF on 2026-11-05. The check was not blind, because the probe had shown the OCR value. The transcription is right in both, and nothing is corrected (`analysis/ocr-reference/README.md`, "Check after the Story 2.5b probe", `3d32823`; not in the corrections table):

- **922184534/2025, the 2024 column, `lonnskostnad`: 31 286 483.** The cost lines sum to 104 938 509 against "Sum kostnader" 104 938 508, which is 1 kr of rounding.
- **927533235/2023, the 2023 column, `lonnskostnad`: 1 448 646.** The cost lines sum exactly to 2 280 576.

OCR read a 6 as a 5 in both. With the OCR figure, the sum would be 999 kr and 100 kr off, so the cost-line gate would refuse both.

## Acceptance run (C2), 2026-11-05 to 2026-11-06

Meinich ran keep-awake and both re-reads in their own PowerShell windows, after Claude Code's background shells were killed when memory ran low. The reference container ran on, so `pnpm derive` ran once, at the end of the 2.1b re-read.

- **The two runs.** `run.step1` 650 (the reference set) read 20 companies and replaced 97 documents. Record 651 (2.1b) listed 412 companies, 407 of them with documents, and replaced 1 947. Neither run left a document not replaced, lost a figure, failed, hit a deadline or stopped. All 2 044 documents are read by `19b541b`.
- **The review session's check, against `.local/document-run-2.4/`.** No figure was lost or changed, and 2 941 figures were added, not counting the four parts.
- **The 2.1b fingerprints**, totals only. There are 1 791 → 1 779 of them, and those without a type fell from 893 to 751 (49,9 % → 42,2 %).
- **The sum gates.** The cost-lines gate admitted 321 current and 305 prior figures; 306 and 295 of them rested on an operand counted as 0. Almost all of that is `nedskrivninger` absent: only 92 and 80 had another line empty. The parts gate admitted 97 and 113 figures, all of them with another part absent. These were checked by hand with psql against `pnpm analysis:document-run after-2.5b`.
- **A misread found after the re-read.** It was found by the review session's check and diagnosed by the BMAD session in one PDF. Tesseract reads the leading "2" of a 7-digit depreciation figure in the last-year column as "23", in both passes, so the figure is 21 000 000 kr too high. Of 1 291 reconciled columns with new `avskrivninger` and the four main lines, 48 do not sum within 5 kr. 27 of them are over the total, so derive gives them no fingerprint. 21 are under, and all 17 current ones among those have a fingerprint. The review session counted 36 columns in 25 companies over the total; the BMAD session's count, with the definition in the entry, is 27 in 19. The fix is deferred without changing `ingest/` (`deferred-work.md`, `3d1a03d`) and stated in the report.
- **Steps 3–9.**
  - The dumps are `.local/document-run-2.5b/` (1 947 documents and 3 892 columns, the restore source) and `.local/document-tables-after-2.5b-reread/` (2 044 documents, 4 086 columns and 1 865 fingerprints). Both are copied to `peerless-backups`, with equal sha256.
  - The rows outside the allow-list were deleted in one transaction that checked 97 documents and 194 columns before COMMIT. Derive then wrote 86 fingerprints.
  - The seed was re-exported in `9b82409`. It was loaded twice, and the re-export had no diff.
  - After the restore, the database holds 2 044 documents and 4 086 columns. Derive wrote 1 865 fingerprints, equal by row and `input_digest` to the dump taken after the re-read.
- **Corrected during the run.** `test/db/seed.test.ts` hard-coded 85 seed fingerprints; the re-read makes 86 (`27a9743`).

## Open

- The PR, Meinich's GitHub review and merge. Nothing is pushed yet.
- The misread fix (`deferred-work.md`) needs a story or a PRD open question (AGENTS.md, "A decision travels upstream"); Meinich decides which.
