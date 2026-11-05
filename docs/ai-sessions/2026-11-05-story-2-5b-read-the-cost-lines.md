# Story 2.5b: read the cost lines and the parts of intangible assets

**Date:** 2026-11-01 to 2026-11-05 (in progress)
**Tool:** Claude Code (BMAD coordinator session and its implementation subagent, Opus 5.5)
**Story / issue:** Story 2.5b (FR-10, FR-28 batch part, NFR25), branch `story/2.5b-read-cost-lines`, issue [#45](https://github.com/IBE160-2026/G97-meinich/issues/45); PR not yet opened
**Result:** commits `a7fc2ee`, `2fea93b`, `e9444da` (before inputs and the transcription template), `6978bde` (watchdog), `bb9d4f4` (probe), `281f134`, `8c85ca8`, `bd94b80` (F1–F3), `b11b38b`, `4c6a1dc`, `9e60be3` (migration, DB tests, README restore), `5d2aad9` (SM-2 section), and the docs commit

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
  - A label beyond F2's list, "Utvikling", for `forskning_og_utvikling`: the contract fixture 979607008/2025 and three probe documents print the first part that way. Checked against the fixture PDF; for Meinich to confirm or reject.
  - A label printed with no figure is no candidate row, so it counts as 0 in a sum gate ("a line with no matching row"). The probe's 2.1b `nedskrivninger` rows are all of this kind; treating them as matched would leave the cost gate not evaluable in those documents.
  - The parts are the last four fields of `TARGETS`, so `FIELDS` follows the table's column order (`test_documents_write.py::test_figure_columns_match_the_reading_library`).
  - An export from before the migration reads the parts as null, and the report says so (`lacksPartColumns`).
- **Corrected during the session, and how it was caught:**
  - "Lønnskostnad ll, 2, 3" turned out to match already at the later-variant stage, by the fuzzy rule against the plural; the first `fold_notes` test therefore passed with the fold removed. Caught by running the test with its guard removed; the test now uses "Varekostnad ll, 3".
  - The first not-evaluable test case also passed with its guard removed (the unread line was non-zero, so the sum failed anyway); it now uses an unread printed 0.
  - A README edit was first staged with CRLF line ends, which showed the whole file as changed; caught in `git diff --cached --stat` and rewritten with LF.

## Open

- Meinich checks two transcription cells (922184534/2025 prior and 927533235/2023 current, `lonnskostnad`) before the measurement.
- Review, then C2's nine steps after Meinich's yes; `pnpm analysis:document-run after-2.5b` between steps 2 and 4; `pnpm analysis:sm2` after step 6.
- Expected failures until then: the seed checks (the manifest names the previous migration) and the committed SM-2 report test.
