# Story 2.3: Measure OCR accuracy (SM-2)

**Date:** 2026-10-23
**Tool:** Claude Code (Opus 5.5), BMAD build session with an implementation subagent
**Story / issue:** Story 2.3 (FR-28, NFR25, NFR15); links issue #14 (the reference set). The story issue and the 2.3b issue are not opened yet.
**Result:** branch `story/2.3-ocr-accuracy-sm2`, not pushed; PR to come. Commits `4a3b3f0`…, listed below.

## Goal

Measure step 1's OCR against the hand-transcribed reference set, field by field, and re-measure the spike's consistency baseline with `read_document`, in one report: `analysis/output/ocr-sm2.md`.

## Prompts that mattered

The human's prompts are in `docs/ai-prompts.md`, verbatim; the review session adds them after merge. In short:

1. Implement `spec-2-3-ocr-accuracy-sm2.md`; the spec is the source of truth.
2. Mid-run: commit in logical steps (AGENTS.md "Git workflow"), no push and no remote operations, so no GitHub issue was opened.
3. Mid-run: restore the 1 947 Story 2.1b document rows from `.local/document-run-bd2ce3e.sql` only after the seed commit, and report the counts.

## What came back, and what was done with it

- **Accepted (implemented as specified):** `withReferenceOrgnrs` and the export reading `drawn.json`; `pnpm ingest:document-set --reference`; `scripts/ocr-sm2-compare.ts`, `scripts/ocr-sm2.ts` and every matrix row in `test/ocr-sm2.test.ts`; `analysis/ocr/consistency.py`; the seed with the reference rows; the report.
- **The data run.** `pnpm ingest --documents analysis/ocr-reference/document-run.json` read 97 documents of the 20 reference companies (83 reconciled, 14 failed_reconciliation) in 47 minutes. The seed now holds 97 documents and 194 columns. After the seed commit, the dump was restored: `register.document` 2 044 = 1 947 + 97, `register.document_column` 4 086 = 3 892 + 194.
- **Found by the build session, against the spec's decision:** the spec said the "SUM EGENKAPITAL OG GJELD" label is read and the bold figures fail. A probe of `read_document`'s own OCR on seven documents with the total NULL showed the bold "SUM" read as "50M" in all seven, so the folded label matches no target; the figures were mostly read. The corrections in `deferred-work.md`, `docs/data-sources-brreg.md`, `epic-2-context.md`, the 2.2 spec's change log and `docs/ai-log.md` describe what the probe showed. This needs the human's confirmation before the 2.3b issue is written.
- **Found by the build session in the result:** 5 of the 6 headline misreads look like transcription errors (995318733/2021: kundefordringer above total assets, sum eiendeler a krone off its own total; 917526729/2025: sum kortsiktig gjeld read equal to the register's API). `transcriptions.csv` was not edited (the spec forbids it); the human should recheck those cells against the PDFs.
- **Corrected in the build session's own code:** the "compares only drawn filings" test passed under a mutation that ignored the draw, because the undrawn year had only one column transcribed (`5b51e84`). The not-evaluable list printed raw keys (`76d7120`).
- **Baseline 156 → 157:** `epics.md` and `epic-2-context.md` corrected; the report explains the gap.

## Commits

`4a3b3f0` spec and planning, `b96b648` allow-list merge, `7c47031` `--reference`, `f7cc3e7` `analysis:sm2`, `cfecb1e` `consistency.py`, `76d7120` list format, `3b7e3dc` seed, `ca566fe` reports, `5b51e84` test fix, then the docs commit.

## Links

- `analysis/output/ocr-sm2.md`, `analysis/output/ocr-consistency-2026.json`
- `docs/ai-log.md`, "Story 2.3: SM-2, the reader measured against a hand transcription"
- `deferred-work.md`: the 2.3b entry and the dump entry (owner 5.4)
