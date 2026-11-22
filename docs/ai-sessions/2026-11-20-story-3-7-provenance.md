# Story 3.7: "Hvordan er dette regnet?"

**Date:** 2026-11-20 to 2026-11-22
**Tool:** Claude Code (Opus 5.5), the `bmad-build` workflow, with an implementation subagent and three review subagents
**Story / issue:** #81, Story 3.7 (FR-57, FR-60, FR-64)
**Result:** PR #82 (https://github.com/IBE160-2026/G97-meinich/pull/82), commits on `story/3.7-provenance` from `cd50547`

## Goal
Give every displayed kroner amount a drill-down that a sensor can recompute by hand (formula, key figure and beste fjerdedel, filed values with their names, dates and source, and a data-quality line decided from stored states), and choose the subject's benchmark filing in the engine (D2).

## Prompts that mattered
- The `/bmad-build` prompt: stop at the checkpoint before code and present (a)–(k): deferred work, every amount, beste fjerdedel, filed values, the data-quality truth table, the source line, the payload scan, Verdi and the wire, D2, UI and accessibility, and the new copy; with rules for tests (each matrix row names the test that fails with its guard removed; no expected value chosen by a condition; every read after a change waits), for e2e (one worker, one project at a time, synthetic last), for builds (#71) and no push.
- Meinich's second answer (decisions 1–10): the waterfall stays out, with an owner; n = `Comparison.count`; "Vis fordelingen" a fold-out with T marked; the truth table and the equation form of {felt}.
- Meinich's third answer: Story 3.8 as the waterfall's owner; the T line's "=", "≈" and f = 0 forms; the ±5 kr zero form; the report's contents.
- Meinich on decision 4 (proposed by the review session, which checked the stored columns): "Avvik ved avstemming" only where something differed; a failed column with only unread lines reads "Ikke avstemt – {felt} kunne ikke leses i regnskapet for {aar}". Also: remove `tmp-shot.mjs` from history without squashing.
- Meinich after the review: overrule the rejection of B1 ("Avstemt" only against the filing the page shows), measure the payload raw and gzip, and run the verification in parts.

## What came back, and what was done with it
- **Accepted:** the spec (decisions 1–11, the I/O matrix), and the implementation from it in small commits: D2 (`subjectBenchmarkFiling`), `src/engine/provenance.ts`, the view, the trigger and body, the payload scan's field-name marker with probes, the planning documents.
- **Corrected by the BMAD session's own verification (step 3):** e2e and unit tests that chose their expected value from the data with a condition (nine places, fixed to assert the fixture's state and one fixed value; one more, from Story 3.4, found by the subagent's search); e2e-only matrix rows with no guard removed (each now removed and shown failing); a redundant CSS rule that failed nothing when removed (deleted, and a test for the longest field name at 320 px added).
- **Corrected by Meinich, proposed by the review session:** the implementation's own reading of decision 4 wrote "Avvik ved avstemming: driftsresultat" for a column where nothing differed. Split into `lines_not_read` with its own copy (Spec Change Log, 2026-11-20).
- **Review pass 1** (Blind Hunter, Edge Case Hunter, Verification Gap; triage in the spec's Review Triage Log, 21 rows): six patched — a drill-down reopening on another company's page, three untested lines (the "Vis fordelingen" line, "Det største av …" with a strength as 0, Verdi's share lines on the page), a negative T without parentheses, EXPERIENCE's "one of" three lines. The rest rejected with evidence.
- **Overruled after review:** B1, rejected by the BMAD session as unlikely, was overruled by the review session and decided by Meinich: "Avstemt" now requires the document's `brreg_id` to be the chosen filing's. The payload rejection stands, with measured figures.
- **Rejected:** a CSS-only probe for long names (the rule was redundant), a new stored id for B1 (step 1's `d.brreg_id` already settles it).
- **Found in the final verification:** the D2 comparison over every company timed out at 60 s under the full `pnpm test:db` (47 s alone); it has its own limit.
- **A mistake of the BMAD session:** at the start it had a subagent regenerate the existing `epic-3-context.md`, missed by a truncated `ls`; restored from git and disclosed.

## Verification (2026-11-22, in parts)
lint and typecheck clean; `pnpm test --maxWorkers=2` 2 035 passed; `pnpm seed` twice and `pnpm seed:export` unchanged; `pnpm test:db` 204 passed; `pnpm test:ingest` 392 passed; `pnpm build` stopped once on `SecurityFatalError` and passed on the rerun (#71), no upgrade; `pnpm check:routes` unchanged; e2e one worker: chromium 197, db-down 7, synthetic `--no-deps` 28 passed; `pnpm restore:documents`: documents 2 785, columns 5 556, fingerprints 2 537, classification rows 10 371; 0 companies named SYNTETISK; 20 entries in the manifest's `document_figure_orgnrs`. An earlier full run in one go was stopped by low memory and not restarted.

## Links
- Spec: `_bmad-output/implementation-artifacts/spec-3-7-hvordan-er-dette-regnet.md` (decisions, Spec Change Log, Review Triage Log)
- AI log: the four 2026-11-20 and 2026-11-22 Story 3.7 entries in `docs/ai-log.md`
- Planning documents: `epics.md` (Story 3.8, UX-DR29, Story 3.7's AC), PRD FR-60 and FR-71, EXPERIENCE.md, `docs/key-figures.md`, the technical note (AD-15, AD-18), `deferred-work.md` (D2 and B9 closed, the waterfall entry for Story 3.8), `AGENTS.md`

## Merge

CI ran twice on the PR. The run on `c041cda` was cancelled by the next push, and the run on `2d31b4c` was green (run 45011678732, 10 min). The first full verification after review pass 1 stopped on low memory. On the review session's recommendation, it was rerun step by step with `pnpm test --maxWorkers=2`. Before merging, the review session checked the following:
- B1 (`93bcd94`): "Avstemt" requires the document's `brreg_id` to be the filing `subjectBenchmarkFiling` chose, and both tests assert the fixture's state before one fixed text. In the local database the fix changes nothing today: every document with a stored SELSKAP filing carries that filing's `brreg_id`, the 776 without one are from 2021–2022, where no filing is stored, and no year has more than one SELSKAP filing;
- the unread-lines wording: 141 of the 164 current `failed_reconciliation` columns have no `fail` check and empty `api_fail_fields`, every one lacks a line a required check needs, and none reaches the throw in `failure`;
- `tmp-shot.mjs` absent from the branch's history;
- D2, the payload scan's field-name marker and its probes;
- the payload growth after gzip (Verdi +16,5 kB, Nøkkeltall +14,8 kB, Oversikt +12,7 kB), under the 30 kB limit it set for Verdi;
- the planning documents against the diff: Story 3.8 in `epics.md`, sprint status and FR-60's coverage-map row, PRD FR-60 and FR-71, the memlogs, and `deferred-work.md` with D2 and B9 closed;
- the statuses;
- the restored row counts (2 785, 5 556, 2 537, 10 371), with no synthetic company left and 20 manifest entries, and the seed unchanged against main;
- the PR text's credits.

At Meinich's request (`post review`), the review session posted the GitHub review with eight line comments and nothing blocking the merge ([review 6011741432](https://github.com/IBE160-2026/G97-meinich/pull/82#pullrequestreview-6011741432)). It noted two things for later. A `failed_reconciliation` column is not tied to `brreg_id`, so "Avvik ved avstemming" could name a deviation from another filing than the one shown; that errs on the side of warning, and no local company is in that state. And `d.brreg_id` is read with `parseOre`, which gives the right bigint under a misleading name. Both are in `deferred-work.md`, owned by Story 5.4. Meinich merged the PR at 10:45 UTC on 2026-11-22 as `959b0c2`, closing issue #81.
