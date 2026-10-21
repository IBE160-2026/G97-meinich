# Story 2.2: Accept only figures that reconcile

**Date:** 2026-10-21
**Tool:** Claude Code (Opus 5.5), `bmad-build`. The build session ran planning, triage and verification; subagents did the investigation, the implementation and the three review layers.
**Story / issue:** #35, Story 2.2 (FR-57, FR-58)
**Result:** PR #36, branch `story/2.2-reconciliation`, commits `fc24a3a`…`bd2ce3e` plus the acceptance-run commit

## Goal

Turn the 1 946 read documents of Story 2.1b from `extracted` into `reconciled` or `failed_reconciliation`, under two configured rules, and make sure no unreconciled figure can reach the engine.

## Prompts that mattered

The human's prompts are in `docs/ai-prompts.md`, verbatim; the review session adds them after merge. In short:

1. `/bmad-build Story 2.2`.
2. The answers to the spec's three open questions. These came from the human, and the measurements behind them came from the separate review session:
   - **Tolerance.** Not 0.1 %, but max(5 kr, 0.001 % of the register's figure). The review session measured 8 230 of 8 234 current-column figures within 5 kr and none between 5 kr and 0.1 %. Coarse proportional slack only admits low-digit errors (911701251: swapped digits).
   - **Prior column.** It is judged on its own checks and is not compared with the register for its status (173 of 5 447 prior figures deviate, e.g. 924830972 +56 007, which are restated comparatives).
   - **Blocking rule.** `documentFigures` in the engine.
3. At approval: a column with no reconciliation status gives `not_reconciled` and does not throw.
4. "Do you commit several times, as AGENTS.md says?" The implementation subagent had not been told to commit. It was told to, mid-run, and split the work into logical commits.
5. Choice B for the missing balance total: c5, with a Spec Change Log entry, and the label fix owned by Story 2.3.
6. Start the acceptance run, OCR nothing new, report the per-check failures, dump next to the old one, then PR.

## What came back, and what was done with it

- **Accepted:**
  - the two rules in `reconcile.py`, set in `[reconciliation]` of `ingest/config.toml`, with no float anywhere;
  - per-column `status`, `api_check`, `api_fail_fields` and `c5`;
  - the re-check of stored documents from their stored figures, with no fetch or OCR;
  - `documentFigures` with `failed_reconciliation` and `not_reconciled`.
- **Corrected by the human, from the review session's measurements:** the build session had recommended 0.1 % and a prior column compared with the register. Both were replaced, as above.
- **Corrected by the human at approval:** the build session's choice that `documentFigures` throws on a NULL status. One restored row would have turned an analysis page into a 500.
- **Found by the implementation subagent on the real data, and decided by the human:** under the approved rule (c1 and c3 required), 913 of 1 946 filings would have failed. 836 current columns have no `sum_egenkapital_gjeld`, because 2.1a misses its label. The build session checked this in the database: in 802 of those columns, the other three balance figures agree within 5 kr. The human chose c5 (sum eiendeler against sum egenkapital + sum gjeld) and gave the label fix to Story 2.3 (`deferred-work.md`).
- **Review (blind, edge-case and verification-gap layers): 20 findings, triaged by the build session in the spec's Review Triage Log.**
  - 13 were patched in `43fe2a1` and `901a78d`. Four were tests whose guard could be deleted with every test still green: the API comparison on the run path, a failed comparison written through either writer, `_rereconcile`'s error branches, and the engine's column map against the table. The others were psycopg errors in the re-check, a count of rows still `extracted`, `brreg_id` refreshed, and six places still saying "four checks". Also AGENTS.md's "two values" (there are three) and the ai-log entry made wrong by c5.
  - 6 were rejected. Examples: a DB trigger tying the document status to its column (one writer, as in 2.1b), and an upper limit on the configured values.
  - 1 was deferred to Story 2.9: pick a year's own column, never a restated prior column.
- **Rejected:** nothing else.

## Acceptance run

**The run.** `pnpm ingest --documents seed/document-run.json` ran on 2026-10-21 against the local database, with the 2.1b rows restored from `.local/document-run-e09a413.sql`. The step-1 image was built from the clean tree at `bd2ce3e2054a5363e76a7e97e4f7d4e6d84370bd`.
- Exit 0, wall time 224 s.
- 407 companies read, none refused.
- Read: 0 documents in 0.0 s of reading, so nothing new was OCR'd (the human had required this). 1 947 were already stored and skipped.
- Documents still `extracted` afterwards: 0. Documents whose status differs from their current column's status: 0.

**Current column per filing year (= the filing's status):**

| Year | reconciled | failed_reconciliation |
|---|---|---|
| 2021 | 319 | 40 |
| 2022 | 350 | 30 |
| 2023 | 367 | 29 |
| 2024 | 379 | 25 |
| 2025 | 386 | 21 |
| **All** | **1 801** | **145** |

**Why the 145 current columns failed.** A column can count under more than one row.

| Cause | Columns |
|---|---|
| c1 fail | 7 |
| c2 fail | 4 |
| c3 fail | 2 |
| c4 fail | 1 |
| c5 fail | 5 |
| register comparison fail | 6 |
| c1 not evaluable | 65 |
| balance neither by c3 nor by c5 | 78 |
| no failing check, only a core check not evaluable | 128 |

So 17 columns fail on a misread figure caught within the document or against the register, and 128 because a figure needed by a core check was not read.

- **Against the estimate.** The estimate was 1 803 of 1 946, measured before the register comparison. The run gives 1 801. The difference is the 2 columns that pass every check within the document and fail only against the register.
- **c5 alone.** 770 of the reconciled current columns pass the balance by c5 alone, because their "Sum egenkapital og gjeld" was not read. That is the label Story 2.3 now owns.
- **Prior columns.** 236 prior-year columns are `failed_reconciliation` on their own checks. By the human's decision, none of them fails its filing.

**Dumps.**
- New: `.local/document-run-bd2ce3e.sql`, the reconciled rows.
- Old, kept: `.local/document-run-e09a413.sql`.
- Both are also in `C:\Users\cmein\peerless-backups\`, byte-identical to the local copies (`cmp`).

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-2-reconciliation.md` (Decisions, Spec Change Log, Review Triage Log)
- `docs/ai-log.md`: the two Story 2.2 entries (tolerances, blocking rule, c5)
- `docs/data-sources-brreg.md`, "Reconciliation"
- `deferred-work.md`: the label fix (Story 2.3) and the column selection (Story 2.9)
