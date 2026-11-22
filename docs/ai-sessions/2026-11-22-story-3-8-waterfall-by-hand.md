# Story 3.8: Vannfallet kan regnes ut for hånd

**Date:** 2026-11-22
**Tool:** Claude Code (Opus 5.5), the `bmad-build` workflow, with two search subagents, an implementation subagent and three review subagents
**Story / issue:** #83, Story 3.8 (FR-60)
**Result:** commits on `story/3.8-vannfallet-for-hand` from `2896911`; no PR yet (not pushed)

## Goal
Make every column of the margin waterfall recomputable from what the page shows. The columns are the start, the four bars, a new sum row and the end. Nothing that reaches a peer's document line may reach the page.

## Prompts that mattered
- **The `/bmad-build` prompt** asked the session to stop at the checkpoint before code and present (a)–(j):
  - deferred work, including PR #82's `brreg_id`/`parseOre` entry;
  - every amount, with its function, its role and the formula its drill-down shows;
  - what the page can show without reaching a peer's line: an analysis of `ekskl` and a band switch, the decimals of Aₓ and M with the uncertainty they leave in kroner for demo A's P, and the same analysis for 3.7's "Vis fordelingen";
  - the formula, the residual and the largest remainder with a worked example;
  - how samlet was found;
  - filed values and data quality;
  - the payload scan and its growth;
  - data and tests, with an independent oracle;
  - UI and accessibility;
  - the new copy, verbatim.

  It also set 3.7's rules for tests, e2e and builds, and no push.
- **Meinich's answer (decisions 1–7).** The review session pointed out that the checkpoint's premise about demo A and the manifest was wrong.
  1. The comparison across URLs is accepted and written as an invariant: only a manifest peer enters P. A test covers it, and a new AI-log entry corrects 3.7's claim, with the analysis credited to the review session.
  2. Two decimals in the drill-down, plus the exact kroner line Aₓ × R − own line = bar. Aₓ × R is registered as `explanation`.
  3. A new row, "Sum av postene".
  4. The new data-quality line "Kontrollert mot registerets nøkkeltall", under 3.7's conditions for "Avstemt", with three guard tests.
  5. Samlet's read date as a range over P, shown as one date when every date is the same.
  6. The copy, with three wording changes.
  7. The spec is kept whole.
- **Meinich after review:**
  - the wording of the sum's sentence;
  - peer 5's exception kept, with two bounding checks;
  - e2e rerun one project at a time;
  - `notFound.coverageFailed` checked against the 3100 server.

## What came back, and what was done with it
- **Measured at the checkpoint by the BMAD session** (scratch scripts outside the repository, totals only). For demo A with the manifest gate opened in memory: the group has 396 peers and P has 274.
  - Excluding one peer, the 3.3 bars already give that peer's cost lines to a median of 0,22 %.
  - 3.7's "Vis fordelingen" gives its kundefordringer to 0,73 %.
  - All 274 members of P have their own waterfall with the gate open.
  - Across 871 subjects, no two have P differing by exactly one peer.
  - With the gate closed today, none of the 20 manifest subjects has a waterfall.
- **Corrected by the review session (via Meinich):** the BMAD session's first premise. That premise was "demo A gets no waterfall because it is not on the manifest".
  - Checked against the code: demo A (813235552) is indeed not on the manifest.
  - The orgnr the review session named, 885583822, is VISIONTECH AS, an OCR reference company that is on it.
  - The reason no subject has a waterfall locally is that the peers are not on the manifest. The spec's Spec Change Log records this.
- **Corrected by the BMAD session:** decision 1's "a peer's own page shows its lines" is structural only for the manifest part. It was written as an invariant with that caveat, and measured as 274 of 274.
- **Accepted:** the implementation in small commits: the engine, the data-quality kind, the copy, the views, the triggers, the payload scans with probes, the e2e oracle, and the docs.
  - The subagent removed each guard and showed its named test failing.
  - It added one phone fix the spec did not list: the drill-down row is kept within the screen inside the scrolling table.
- **Review pass 1** (Blind Hunter, Edge Case Hunter, Verification Gap; 15 rows in the spec's Review Triage Log). Patched:
  - the start column's inputs lacked `driftsresultat`;
  - the payload scan missed a negative share (U+2212) and could have met exponent notation;
  - the rounding note through the view, with a negative bar, had no test;
  - `waterfallFacts` with `ekskl` had no test;
  - the AI-log entry cited the 2-decimal row where the kroner lines expose Aₓ to about 1/R (B1), so it now cites the right measurement.

  Two findings went to Meinich: the sum's wording (B5, worded by Meinich) and peer 5's fixture coincidence (B6, accepted by Meinich, with checks that the exception is exactly two amounts and the nine other peers stay scanned). The rest were rejected with evidence.
- **Confirmed by Meinich (2026-11-22):** the boundary "never any peer's read date" means no read date per peer, and decision 5's range is allowed (Spec Change Log; B4 accepted).

## Verification (2026-11-22, after the review fixes)
- **Static and unit:** lint and typecheck are clean, and `pnpm test --maxWorkers=2` passed 2 086 tests.
- **Build:** the first `pnpm build` exited 1 and the rerun passed, consistent with #71. Only the tail of the failing output was captured, so its error class is not confirmed. No upgrade was run.
- **Routes:** `pnpm check:routes` is unchanged.
- **E2e** (one worker, one project at a time, the 3100 server started separately with its own log): chromium 197, db-down 7, synthetic `--no-deps` 31. `notFound.coverageFailed` appeared twice in Playwright's output and 0 times in the 3100 server's log, so it comes from the db-down server on 3101.
- **An earlier run** of build and e2e in one go was stopped by low memory and not restarted.
- **Database:** documents 2 785, columns 5 556, fingerprints 2 537, classification rows 10 371. No company is named SYNTETISK, and the manifest has 20 entries.
- **`pnpm test:db` (204) and `pnpm test:ingest` (392)** were run by the implementation subagent before the review fixes, which touch neither.

## Links
- Spec: `_bmad-output/implementation-artifacts/spec-3-8-vannfallet-kan-regnes-ut-for-hand.md` (decisions, Spec Change Log, Review Triage Log)
- AI log: the 2026-11-22 Story 3.8 entry in `docs/ai-log.md`
- Planning documents: PRD FR-60 and its memlog, `epics.md` (UX-DR29, Story 3.8), EXPERIENCE.md and the UX memlog, `docs/key-figures.md`, `deferred-work.md` (the 3.8 entry closed), `sprint-status.yaml`, `AGENTS.md`
