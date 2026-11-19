# Story 3.5: Verdi, how much is closable

**Date:** 2026-11-19
**Tool:** Claude Code (Opus 5.5), running `bmad-build`.
- **Subagents dispatched by the BMAD session:**
  - one recompiled the epic context;
  - one implemented the story and, re-engaged, the review fixes;
  - the three review layers ran as subagents too.
- **Prompts:** the prompts headed "Fra meg" were written by the review session, a separate Claude session, and pasted in by Meinich. What they added beyond the BMAD session's checkpoint recommendations is credited to the review session below. Every decision is Meinich's.

**Story / issue:** [#77](https://github.com/IBE160-2026/G97-meinich/issues/77), Story 3.5 (FR-30, FR-31, FR-62; Epic 2 retro B6)
**Result:**
- **Spec:** written at the checkpoint, ready for dev at `142b8d6`, in progress at `2ef6c0c`, the report's contents at `29be22d`; in review with the story in review at `743a8b9`. The spec stays `in-review` until the PR is merged.
- **Implementation:** `1986694` to `28a3e86` (11 commits).
- **Review triage:** `2201e12`; outcomes and the B6 retro item closed, `7eebf64`.
- **Review fixes:** `1930f9d` and `f8e0cae`.
- **Copy approved after review, and the deferred notice:** `c0b1307`.
- **Planning:** the epic context `060d88e`; the planning documents `4b519ff`.
- **PR:** not opened; it waits for Meinich.

## Goal

Open the Verdi tab:
- a closable-share control, a `radiogroup` of 0 / 25 / 50 / 75 / 100 % and "Til medianen for driftsmargin (n %)";
- three amount cards that are never summed: "Økt driftsresultat per år", "Frigjort arbeidskapital", "Frigjort kapital i driftseiendeler";
- the share scaled in the browser through `src/engine` from exact values that cross the wire as strings, and written to the URL with `history.replaceState` (AD-6);
- `andel=median` kept across a peer change (Epic 2 retro B6).

## Prompts that mattered

- **The opening prompt** asked for a checkpoint before any code change, on ten points:
  - (a) deferred work;
  - (b) s_med;
  - (c) the median lines;
  - (d) the cards;
  - (e) the wire and the payload;
  - (f) the URL hook and the links;
  - (g) the identity test;
  - (h) rounding and sums;
  - (i) phone width and accessibility;
  - (j) new copy.

  Its rules added to Story 3.4's:
  - the browser computes only through `src/engine`, never `Number()` on money;
  - new dependencies pinned exactly and named in the PR;
  - the subagent never rewrites approved copy, and a test checks it verbatim;
  - the PR says what can go wrong with in-browser scaling and the wire codec.
- **Meinich's checkpoint decisions** (spec, decisions 1–8):
  1. A strength counts as 0 in working capital released.
  2. The profit at the median step is (M − r) × revenue, on a condition: a real case where full × s_med rounds to another krone, with a test that fails without the guard.
  3. The step's order, labels and disabled reasons (N1–N5).
  4. Each card's median line is its own figure's, with N12 "Median: allerede nådd" for capital, and EXPERIENCE :238 corrected.
  5. The wire set, with a scan, and what can be derived from it written down.
  6. `useAnalysisUrl` and `AnalysisLink`.
  7. The identity test in Playwright on a vite bundle, with no new dependency.
  8. N1–N12 approved.
- **The review session's prompts added,** beyond the BMAD session's recommendations:
  - **Decision 2:** the BMAD session's half-krone example was wrong; the product rounds back to exactly 150 øre. The review session asked for a real case or a statement in the spec. The BMAD session then searched and found one: 1 000 000 kr revenue, r = −0,049, M = −0,0480005, T = −0,04798593. The exact (M − r) × revenue is 999,50 kr, written "1 000 kr"; full × s_med is 999,4999… kr, written "999 kr".
  - **Decision 3:** where the subject's own driftsmargin is missing, the disabled step uses the same words as the table row.
  - **Decision 5:** saying in the AI log and the PR that T can be derived from the profit uplift, M from s_med, and that M can be one peer's exact margin when the count is odd.
  - **Decision 6:** keeping the provider's base (the change in flight, or the last good URL) for `ekskl` and `band`, taking only `andel` and `multippel` from the live URL, keeping the rejected-ekskl test green and adding the B6 test.
  - **The implementation report's list:** the 999 kr failure, the B6 failure, the wire scan, the identity test, the NDC probe, the restore counts and the payload totals.
  - **After review:** the approval of N13–N15; keeping the invalid-settings notice in v1, with a notice of its own deferred to Story 5.4; and the `--maxWorkers=2` fallback should `pnpm test` stop on memory again.

## What came back, and what was done with it

- **Accepted** (the implementation report removed each matrix row's guard; each named test failed):
  - The rounding test fails with "999 kr" instead of "1 000 kr" when `profitAtMedian` is full × s_med.
  - The B6 test (`test/analysis/peer-change-href.test.ts` "keeps andel=median") fails when the base is parsed with no median step. The rejected-ekskl test stays green.
  - The Verdi wire scan fails when the subject's exact margin is added to the wire. `git diff 29be22d -- e2e/oversikt.spec.ts` is empty.
  - The identity test fails when one side's formatting changes.
  - NDC "a scale sums nothing" fails on its probe.
  - Payload, demo A: Verdi is 25 481 B HTML and 11 598 B RSC, against Oversikt's 268 997 B and 148 642 B.
- **Caught by the implementation run itself:**
  - The `replaceState` count saw two calls, one of them Next.js's own sync. It now counts only the page's calls.
  - The synthetic subject's test assumed a median step. Its group holds seven seed companies besides the ten synthetic peers, and its margin is above their median. The test now asserts `above_median` first.
- **Copy from the implementation, not in N1–N12:** `verdi.share.under` "under 1", `verdi.share.over` "over 99" and `verdi.step.medianNone` "Til medianen for driftsmargin". The BMAD session held them for Meinich, who approved them after review (spec N13–N15; `test/messages.test.ts`).
- **Corrected by review** (spec, Review Triage Log, 21 rows):
  - **The median step was decided twice, with no check that the two agree** (Verification Gap; also Edge Case Hunter and Blind Hunter). `test/analysis/shown-group.test.ts` now asserts that `driftsmarginComparison` equals `shownGroup`'s comparison, with and without an exclusion that removes the step.
  - **A card whose median equals its beste fjerdedel read "over 99 %"** (Edge Case Hunter, Blind Hunter). It now reads "Median nås ved 100 %". The BMAD session reran the mutation: without the guard the test gets "Median nås ved over 99 %".
  - **An unreachable empty-string fallback for the control's line** (Edge Case Hunter, Blind Hunter): the branch is gone.
  - **Two tests that could pass vacuously or promised more than they did** (Blind Hunter):
    - the no-sum test now asserts two parsed amounts per card;
    - the identity fixture now holds a half krone of each sign.
  - **Missing tests** (Blind Hunter):
    - the keyboard: wrap-around, roving tabindex, and the arrows reaching the disabled step;
    - a reload after a share change, with no console error.
- **Rejected, and why:**
  - **The notice when a peer change removes the median step** (E2/B2): it is signalled, as the no-silent-fallbacks rule asks. Meinich kept it for v1; a notice of its own is in `deferred-work.md`, owned by Story 5.4.
  - **The notice staying after `replaceShare`:** it stays true.
  - **(11) with a non-positive target having no median line:** deliberate.
  - **`applies` decided by a suffix test:** developer-only, and the texts are pinned.
  - **The announcement leaving out the capital cards:** it is the approved text.
  - **A strength part with no median line:** decision 4.
  - **The control active outside NOK:** decision 3.
- **Not done, as decided:**
  - no Next.js upgrade (#71);
  - `architecture/technology.md` not edited;
  - `pnpm classify` not run;
  - no dump deleted.

## Verification (2026-11-19, after the review fixes)

- **A first full run was stopped by Claude Code on low memory** during `pnpm test`, after lint and typecheck had passed. It was not restarted; Meinich asked for the steps one at a time.
- **Checks:** lint and typecheck clean. `pnpm test`: 1874 passed, with the default worker count (the `--maxWorkers=2` fallback was not needed).
- **Seed:** `pnpm seed`, then `test:db` (200 passed) and `test:ingest` (392 passed).
- **`pnpm restore:documents` after the last seed:** documents 2785, columns 5556, fingerprints 2537, classification rows 10371.
- **`pnpm build`:** stopped with `SecurityFatalError` ("Your version of Next.js is affected by a known security vulnerability.") on the first try and passed on the rerun; the implementation run saw the same twice. No upgrade (#71). `check:routes` is clean.
- **E2e, one worker, one project at a time:**
  - `chromium`: 175 passed;
  - `db-down`: 7 passed;
  - `synthetic` (`--no-deps`), last: 24 passed.
- **Afterwards:** 0 SYNTETISK companies in the database; the manifest has 20 entries, none of them synthetic.
- **Phone width:** the implementation run's e2e checks Verdi at 375 and 320 px (control in 3 × 2, cards stacked, no sideways scroll, four tabs wrapping), and screenshots of demo A at 1280, 375 and 320 px.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-3-5-verdi-how-much-is-closable.md`.
- AI log: `docs/ai-log.md`, 2026-11-19, Story 3.5 (money scaled in the browser, and the wire codec).
- Planning documents updated:
  - EXPERIENCE.md: the Closable-share control, Amount card, Small card, Above median and Status messages rows; :238 corrected per decision 4;
  - the UX `.memlog.md`;
  - the technical note: :322 (the identity test in Playwright) and AD-6 (what was built);
  - `docs/key-figures.md`: decisions 1 and 2;
  - AGENTS.md: the Verdi clause and the working-capital rule;
  - `deferred-work.md`: two entries resolved, one added for Story 5.4;
  - `sprint-status.yaml`: the B6 retro item closed.
- Not affected: the PRD (FR-31's wording holds) and epics.md.
