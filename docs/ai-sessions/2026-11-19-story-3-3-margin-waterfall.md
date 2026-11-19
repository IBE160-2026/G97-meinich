# Story 3.3: the margin waterfall

**Date:** 2026-11-19
**Tool:** Claude Code (Opus 5.5), running `bmad-build`.
- **Subagents dispatched by the BMAD session:** one recompiled the epic context, investigators read the demo pools and the fixture, and one implemented the story and the first set of review fixes. The three review layers ran as subagents too.
- **Prompts:** the prompts headed "Fra meg" were written by the review session, a separate Claude session, and pasted in by Meinich. What they added beyond the BMAD session's checkpoint recommendations is credited to the review session below. Every decision is Meinich's.

**Story / issue:** #73, Story 3.3 (FR-22, FR-26, FR-30)
**Result:**
- **Spec:** `c315dd5`. In progress at `f72a280`; in review, story in review, at `a93f7a1`.
- **Implementation:** `6b9b8e8` to `8a48c8a`, with the implementation run's own review fix `19940fd`.
- **Review triage:** `595fa76`. Change log and deferred entry: `3783c4c`.
- **Review fixes:** `8e9e4bb` (the nine patch findings) and `4eb68d1` (the exclusion e2e test).
- **PR:** [#74](https://github.com/IBE160-2026/G97-meinich/pull/74), opened when Meinich said so.

## Goal

Explain the driftsmargin gap in kroner. "Hva forklarer marginavviket?" opens under Driftsmargin and decomposes (subject margin − peer group's samlet margin) × the subject's revenue into four bars: varekostnad, lønn, andre driftskostnader and a residual, against the peer group as a whole (revenue-weighted, over the common peer set *P* of at least 10 peers with all five figures from a reconciled benchmark-year document). The bars are never scaled by the closable share and never added to a total (FR-30). Cost-share rows link to the fold-out.

## Prompts that mattered

- **The opening prompt** asked for a checkpoint before any code change, on eleven points: (a) deferred work, (b) sources, (c) where it shows, (d) a subject without its components, (e) rounding, (f) FR-30, (g) the chart, (h) placement and the link, (i) NOK and outside the seed, (j) the payload, (k) copy. Its rules were Story 3.2's, plus: `technology.md` is the lecturer's reference and is not touched.
- **Meinich's checkpoint decisions** (decisions 1–9 in the spec, then 10 and 11):
  1. All five figures from the one reconciled column, the subject's included.
  2. Derived lines and derived revenue count; R2 applies to *P* and the subject, and a subject failing R2 gets its own reason.
  3. Peers not in the demo data give N1, "… er ikke i demodataene".
  4. A subject without a component gets its Varekostnadsandel row's words; R2 its own.
  5. Not NOK: no waterfall.
  6. A hand-written SVG; every Recharts mention corrected except `technology.md` and historical records.
  7. The FR-30 registry test finds amount functions itself; `workingCapitalReleased` is not shown in 3.3; the AC lines for 3.4 and 3.5 approved.
  8. Copy N2–N6 approved, N1 with the correction in 3.
  9. No deferred entry taken in.
  10. The waterfall's "margin {m}" shows the document's margin, with two tests and the deviation in ai-log.
  11. The R2 copy, with the year.

  The review session's prompts added, beyond the BMAD session's recommendations:
  - a test that the waterfall's margin reads as the Driftsmargin row, and a stop if the two can differ (which led to decision 10);
  - "demodataene" in N1 and R2's own reason with the year;
  - that the registry test finds the amount functions with the compiler, not from a list, and must be shown failing on an unregistered function and on a total that references a bar;
  - seeing the R2 copy before it went into `nb.json`.
- **Meinich's review decisions** (2026-11-19), each from a review-session prompt:
  - Accept the exclusion e2e test, but make it definite: assert the band holds seed companies outside the demo data (`outside.length > 0`) and that they and the peer fit under `MAX_EKSKL`, expect N1 with no condition, and correct the matrix row in the Spec Change Log.
  - The too-few copy stays as approved; n = 0 and n = 1 go to `deferred-work.md` with Story 5.4 as owner.
  - The zero-bar findings are rejected.
  - Try to reproduce the test:db failures right after `pnpm seed` (see Verification).

## What came back, and what was done with it

- **Accepted.** The engine builds *P*, the revenue-weighted aggregate and four exact bars as fractions of øre, and rounds for display once (total half away from zero, bars by signed largest remainder in exact bigint arithmetic, ties in bar order). R2 is one shared predicate for the fingerprint and the waterfall. `src/engine/amounts.ts` registers every kroner amount, and `test/engine/no-double-counting.test.ts` finds them through the compiler. Each matrix row's guard was removed in turn and its named test failed (implementation report).
- **Caught by the implementation run itself.** The forced-colours e2e test first passed with its CSS removed, because Chromium keeps an SVG's own fills; it now requires the bars' system outlines (`19940fd`).
- **Corrected by review** (spec, Review Triage Log, pass 1):
  - **Bar geometry untested** (Verification Gap). Positions are now asserted level by level.
  - **Private helpers bypass the FR-30 walk** (Verification Gap). The walk now follows non-exported engine functions, with a probe that reaches `marginWaterfall` through two of them.
  - **The "Vis tallene" table read ▲/▼ aloud** (Blind Hunter). The glyph is now `aria-hidden`.
  - **Smaller, patched:** the fourth "not the median" combination, the derived-revenue bound and the absence order are tested; UX memlog line; `key-figures.md` marks the strength case as v1's until Story 3.5; PRD FR-30 includes not-NOK; `MAIN_COST_LINES` re-export removed.
  - **The matrix row on one excluded peer** (the implementation run, raised by the BMAD session). Meinich accepted the test and had it made definite (`4eb68d1`, Spec Change Log).
- **Rejected, and why** (rows 10–18): zero and sub-krone bars (rare, and a fix needs a fourth bar kind); a null-word glyph (cannot happen at 40 digits); a null `valuta` (same rule as the other kroner gaps); the subject's year (built from the same filing year); a visible total (the matrix sets the table's rows); the too-few copy (approved; n = 0 and 1 deferred); session file and ai-log Outcome (written in step 5); `workingCapitalReleased` without a caller (decision 7); the not-NOK wording and missing e2e (decision 4, covered by view tests).
- **Not done, as decided:** `architecture/technology.md` was not edited; `pnpm classify` was not run; no dump was deleted.

## Verification (2026-11-19, after the review fixes)

- **Checks:** `check:pins`, `check:env`, `lint` and `typecheck` are clean. `pnpm test`: 1735 passed.
- **Seed:** `pnpm seed`, then `test:db` and `test:ingest` (392 passed). In that first run `test:db` had 28 failures in one test file and 172 passes; the output was cut to its last lines, so the file and the error were not kept. A rerun of `test:db` alone passed 200. To reproduce, Meinich asked for `pnpm seed` followed directly by `test:db`, the order CI uses: 200 passed. **Not reproduced**; the file and the error are unknown.
- **`pnpm restore:documents`** after the last seed: documents 2785, columns 5556, fingerprints 2537, classification rows 10371.
- **`pnpm build`:** stopped once on Next.js's security-advisory check (`SecurityFatalError`, issue [#71](https://github.com/IBE160-2026/G97-meinich/issues/71)) and passed on retry. `check:routes` is clean.
- **`pnpm test:e2e`:** the first run after the review fixes was stopped by Claude Code because the machine ran low on memory, before any test finished; it was not restarted until Meinich said so. After the exclusion test was made definite (`4eb68d1`) and `restore:documents` had run, Meinich asked for a rerun: 180 passed with 1 worker (5.5 min).
- **Afterwards:** 0 synthetic companies remain, and the manifest holds no synthetic orgnr.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-3-3-the-margin-waterfall.md`.
- AI log: `docs/ai-log.md`, 2026-11-19, Story 3.3 (the decomposition, its rounding and double counting).
- Planning documents updated: epics.md (Story 3.3 AC; the amount-registry AC lines in 3.4 and 3.5; Recharts mentions), PRD FR-30 with its `.memlog.md` line, the technical note, DESIGN.md, EXPERIENCE.md, the UX `.memlog.md`, `docs/key-figures.md`, AGENTS.md, `deferred-work.md`.
