# Story 3.4: the rest of Oversikt

**Date:** 2026-11-19
**Tool:** Claude Code (Opus 5.5), running `bmad-build`.
- **Subagents dispatched by the BMAD session:**
  - one recompiled the epic context;
  - three investigators read the Oversikt UI, the engine's amounts and ranking, and the UX copy and e2e fixtures;
  - one implemented the story and the review fixes;
  - the three review layers ran as subagents too.
- **Prompts:** the prompts headed "Fra meg" were written by the review session, a separate Claude session, and pasted in by Meinich. What they added beyond the BMAD session's checkpoint recommendations is credited to the review session below. Every decision is Meinich's.

**Story / issue:** #75, Story 3.4 (FR-27, FR-29, FR-30)
**Result:**
- **Spec:** written at the checkpoint; in progress at `dfb8eb2`; in review, story in review, at `6d5c2ea`. The spec stays `in-review` until the PR is merged.
- **Implementation:** `518b2ef` to `f2cc4ff`. That range includes the implementation run's own fixes: `409fa18` and `22ae2d6` for two tests that passed with their guard removed, and `3a282f1` for the payload trim.
- **Review triage:** `4cd6803`.
- **Review fixes:** `7575bb7` and `df3c9df` (the fifteen patch findings), and `a231239` (the compact list's scroll region, found by the BMAD session's e2e run).
- **Planning:** the epic context `55be9e8`, the UX memlog `af50f93`.
- **PR:** [#76](https://github.com/IBE160-2026/G97-meinich/pull/76), opened when Meinich said so.
- **CI fix:** `860b874` (an e2e race, found by the review session; see below).

## Goal

Finish Oversikt as DESIGN's 12-column card grid:
- **the hero** (5 columns);
- **a hand-written SVG beeswarm of driftsmargin** with the five nearest peers and "Vis tallene" (7 columns);
- **three small cards** (4 columns each):
  - "Største kapitalgap": the largest one-off capital amount, never added to anything and never ranked against the hero;
  - "Største styrke";
  - "Mangler grunnlag".

## Prompts that mattered

- **The opening prompt** asked for a checkpoint before any code change, on eleven points:
  - (a) deferred work;
  - (b) the capital card's candidates, ties, exact comparison, NOK, and the tests for 11 + 9, cost shares and the hero;
  - (c) where the card shows figures;
  - (d) the strength ranking;
  - (e) what counts as missing a basis;
  - (f) the beeswarm's packing, group and tooltip, and the five nearest;
  - (g) byte-identical margins;
  - (h) the grid at 375 and 320 px;
  - (i) the payload;
  - (j) new copy;
  - (k) an owner for the `test:db` failure seen in 3.3.

  Its rules were Story 3.3's, plus:
  - no test picks its expected value from the data with a condition;
  - the PR names the risk of reading the capital amount as annual.
- **Meinich's checkpoint decisions** (spec, decisions 1–9):
  1. The capital rule as recommended, with the role `choice` and a probe that adds 11 to 9.
  2. Strength ranked on the shown whole percent, ties to the lower number.
  3. 7 and 8 count as missing a basis; the empty state is tested in unit tests only.
  4. The beeswarm over P5–P95, with its geometry shown before implementation.
  5. The nearest-five rule as recommended.
  6. The no-margin rule as recommended.
  7. No explanation row.
  8. The copy approved, with K2 reworded.
  9. Story 5.7 owns the `copyIn` entry.

  Decision 10 followed the geometry: the hidden layout has `display: none`, an e2e test checks one image per width, and the report gives radius, height and payload as totals.
- **The review session's prompts added,** beyond the BMAD session's recommendations:
  - the probe that adds 11 to 9;
  - leaning towards ranking on the whole percent the user sees;
  - asking for the radius, the maximum height at three widths, the overflow behaviour and the clipped company marker before implementation;
  - `display: none` with the one-image e2e test;
  - K2's wording, "Ingen kapitalgap blant kapitalnøkkeltallene som har grunnlag for sammenligning.";
  - the evidence line for the 3.3 `test:db` failure;
  - running e2e one Playwright project at a time, `synthetic` last with `--no-deps`, then counting synthetic companies and manifest entries;
  - the comment on issue #71 and naming the build error as a CI risk in the PR.

## What came back, and what was done with it

- **Measured at the checkpoint (BMAD session, totals only).** Demo A has 396 peers and demo B 398, not the example's 23. That made the beeswarm's domain and overflow a decision (decision 4). Both are outside the demo data in the seed and locally after the restore, because neither is on the manifest's list. So their capital card reads "Ikke i demodataene".
- **Accepted.**
  - `largestCapitalGap` compares exact Decimal øre and sums nothing but `workingCapitalReleased`.
  - The NDC test "a choice sums nothing" fails on any `.plus` or `.add` in a `choice`.
  - The strength card ranks on `wholePercent`, the value `formatWholePercent` writes.
  - The beeswarm is packed on the server in two layouts.
  - Each matrix row's guard was removed in turn and its named test failed (implementation report).
- **Caught by the implementation run itself.**
  - "the capital card never reads the profit gap" first passed with its guard removed, because it called a function with no access to the profit gap. It now goes through `oversiktCards`.
  - The synthetic capital e2e test took its expected value from the engine's own choice. It now writes the choice out itself.
  - The beeswarm first took demo A's Oversikt payload to 585,6 KB HTML. Trimmed to 267,6 KB HTML and 147,9 KB RSC, about +245 KB / +135 KB, the order of the Peers tab. Meinich approved it.
- **Corrected by review** (spec, Review Triage Log, pass 1, 24 rows):
  - **The demo A strength test chose its expected value from the code under test and accepted either outcome** (Blind Hunter). It now asserts the fixture's state, then expects the empty sentence with no condition.
  - **The Oversikt øre scan held only the chosen amount, floored** (Blind Hunter). It now holds (9), (10), (11) and the total, exact.
  - **Untested states** (Verification Gap, Blind Hunter): the beeswarm's absent states, the capital card's other unread bases and the desktop hover now have tests.
  - **Silent fallbacks** (all three layers): an Oversikt with no filing, and a blank beeswarm sentence, now throw.
  - **One top-note key, and EXPERIENCE edited in place** (Verification Gap, Blind Hunter): the Small card row, and the Capital amount row by the BMAD session.
  - **Smaller, patched:** ticks that could vanish on a narrow domain; duplicate React keys; a re-render on every mouse move; a margin computed twice; the grid at 800 px; AGENTS.md's registry clause.
  - **The compact list's table had no scroll container of its own** (the BMAD session's e2e run). `e2e/failed-subject.spec.ts` failed on `oversikt` until it got one (`a231239`).
- **Rejected, and why** (rows 16–23):
  - P5 = P95: needs most of a group on one exact margin.
  - A null stated revenue: such a subject has no group.
  - Long names in the SVG: the legend and table carry them.
  - The omsArsverk throw: compared rows stay compared.
  - Coordinate precision: public data, already shown to 0,1 pp.
  - The tie order: documented and tested.
  - `data-selected`: cosmetic.
  - Counts through `format.ts`: the existing convention writes counts with `String`.
- **Not done, as decided:**
  - No Next.js upgrade (issue #71, commented).
  - `architecture/technology.md` not edited.
  - `pnpm classify` not run.
  - No dump deleted.
  - The `copyIn` failure not fixed: owner Story 5.7.

## Verification (2026-11-19, after the review fixes)

- **Checks:** lint and typecheck clean. `pnpm test`: 1795 passed.
- **Seed:** `pnpm seed`, then `test:db` (200 passed) and `test:ingest` (392 passed).
- **`pnpm restore:documents` after the last seed:** documents 2785, columns 5556, fingerprints 2537, classification rows 10371.
- **`pnpm build`:** stopped with `SecurityFatalError` ("Your version of Next.js is affected by a known security vulnerability.") on the first try twice in the verification run and twice in the implementation run, and passed each time on retry. It is noted on [#71](https://github.com/IBE160-2026/G97-meinich/issues/71#issuecomment-7010989638). `check:routes` is clean.
- **E2e, one worker, one project at a time:**
  - The implementation run's full `playwright test` was stopped by Claude Code on low memory after 59 passed. It was not restarted.
  - Meinich asked for one project at a time:
    - `chromium`: 160 passed;
    - `db-down`: 7 passed;
    - `synthetic` (`--no-deps`): 1 failed, the compact list's scroll region. After the fix (`a231239`) and a rebuild, `oversikt.spec.ts` passed 18 and `synthetic` passed 22;
    - `chromium` again on the final build: 160 passed.
- **Afterwards:** 0 synthetic companies remain. The manifest holds no synthetic orgnr (20 entries). The restore counts are unchanged.
- **Measurements (totals only):**
  - Radius and swarm height:

    | | Desktop | Phone |
    |---|---|---|
    | Demo A | r 3,5, swarm 230,5 units | r 2, swarm 168,5 units |
    | Demo B | r 3,5, swarm 218 units | r 2, swarm 168 units |

  - Payload: about +245 KB HTML and +135 KB RSC on demo A's Oversikt.

## CI on PR #76

CI failed in `e2e/analysis-states.spec.ts` "a route change to another company focuses its h1", also on retry.

**The review session found the cause** by reading the trace from the CI artefact:
- After the navigation, `main h1` existed twice. The old one (ADMMIT AS) sat in `<div hidden id="S:0">`, the React streaming Suspense segment of demo A's Oversikt, which was never put in place.
- React 19.3 batches the reveal of finished boundaries. The test searched from the header before demo A's page was shown, and the client navigation left the segment detached.
- Story 3.4 made demo A's Oversikt about 245 KB heavier, so the window is longer on CI.
- Users see nothing, because the segment is hidden. The fault is in the test.

**The fix** (`860b874`, Meinich's instruction):
- `companyShown` in `e2e/seed.ts` waits for the company's h1, visible, with its name, before a test acts on the page. The main h1 and focus checks stay as they were.
- The BMAD session searched every analysis `goto` in `e2e/` and applied the same wait in four more places:
  - the client navigation to a 404, which asserts one h1;
  - the header search used twice;
  - the header search used on the same company;
  - the tabs' width measured with `evaluate`, and the header texts read with `allTextContents` in `e2e/peers.spec.ts`. Neither of those reads waits for visible content.
- The others need no change: their assertions retry, their clicks wait for a visible element, or they read the banner, which is outside the segment.

**Run locally after the fix,** one worker:
- `e2e/analysis-states.spec.ts`: 35 passed;
- `e2e/peers.spec.ts`: 24 passed.

Spec, Review Triage Log, row 25.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-3-4-the-rest-of-oversikt.md`.
- AI log: `docs/ai-log.md`, 2026-11-19, Story 3.4 (which capital amount is chosen, and reading it as annual).
- Planning documents updated:
  - EXPERIENCE.md: the Small card, Beeswarm and Capital amount rows, and the copy keys;
  - the UX `.memlog.md`;
  - `docs/key-figures.md`: the card rules;
  - AGENTS.md: the `choice` clause;
  - `deferred-work.md`: the `copyIn` owner and evidence.
- Not affected: the PRD (FR-30 already keeps (11) beside working capital, never inside it), epics.md and the technical note.

## Merge

CI first failed on `5fdccb6` (run 44548667979) in `e2e/analysis-states.spec.ts` "a route change to another company focuses its h1", also on retry; the run before it was cancelled by the next push. The review session downloaded the Playwright report and read the trace: demo A's streamed Suspense segment was left hidden in the document (`<div hidden id="S:0">`) after the client navigation, so `main h1` matched twice. The fix (`860b874`) and its documentation (`674796c`) are described above. CI was green on `674796c` (run 44552215688, 10 min 56 s). Before merging, the review session checked the capital card's choice and its `choice` registration with the probe that adds (11) to (9), the strength ranking on the shown whole percent, `display: none` on the hidden beeswarm layout with the e2e check of one accessible image at 1280, 375 and 320 px, K2's wording, the restored row counts (2 785, 5 556, 2 537, 10 371) with no synthetic company left and 20 manifest entries, the statuses, the `copyIn` deferred entry's owner, and the PR text's credits. At Meinich's request (`post review`), the review session posted the GitHub review with six line comments and nothing to fix ([review 5978812040](https://github.com/IBE160-2026/G97-meinich/pull/76#pullrequestreview-5978812040)). The PR was merged at 16:13 UTC on 2026-11-19 as `bbee937`, closing issue #75.
