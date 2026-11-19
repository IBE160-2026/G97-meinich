---
title: 'Story 3.2: The two decompositions'
type: 'feature'
created: '2026-11-18'
status: 'done'
baseline_commit: 'e7c04853820aa7d257d80d3d76e65baedd62b1f6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/docs/key-figures.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Nøkkeltall og gap table says how far totalkapitalrentabilitet and lønnskostnadsandel sit from the peers, but not which lever the gap sits on: margin or capital use, pay or productivity (FR-26, issue #70). The engine already holds total asset turnover as an exact fraction (`apiKeyFigureFractions`, `src/engine/key-figures.ts:128`), but nothing benchmarks it, and no fold-out exists.

**Approach:** The engine benchmarks total asset turnover as a derived factor with no direction, against its own median and its own 10-peer gate. The driftsmargin factor reuses the driftsmargin comparison. A pure view builder turns both factor pairs into strings and strip marks, with no best, Plassering or kroner field. A hand-written fold-out opens "Margin eller kapitalbruk?" under Totalkapitalrentabilitet and "Lønnsnivå eller produktivitet?" under Lønnskostnadsandel. In v1 the second shows Story 2.9's not-read-in-v1 state for both factors.

**Decisions (Meinich, 2026-11-18):**

1. **Component.** A hand-written `'use client'` fold-out, `src/components/analysis/fold-out.tsx`, with no new dependency. It is an `h3 > button` with `aria-expanded`, `aria-controls` and a ▸/▾ caret marked `aria-hidden`. The body uses `hidden` and sits on `bg-surface-foldout`. The native button gives Enter and Space.
   - Nothing in the code uses shadcn. Every planning statement that it does is corrected in this PR: epics.md (UX-DR19, Story 3.2 AC and any other mention), DESIGN.md, EXPERIENCE.md (including the stack line, :320 "shadcn 4.21"), and the technical note if it says so.
2. **Outside the demo seed.** "Lønnsnivå eller produktivitet?" shows the not-read-in-v1 state there too, as the story says. The engine gives `not_read_in_v1` for 7 and 8 on every basis. EXPERIENCE.md :220 is corrected.
3. **The driftsmargin factor** has the same fields as total asset turnover: own value, median, count, strip and direction text ("Bedre →"). Its beste fjerdedel, Plassering and kroner stay in the Driftsmargin row.
4. **Indent.** The fold-out body is indented 30 px on desktop and 16 px on the phone.
5. **Deferred work.** The `spec-2-1a` årsverk entry stays routed to stage 2. It gains one line saying that the v1 state is shown by Story 3.2 (fold-out, not read in v1). No other entry names this story.
6. **Copy** (approved verbatim; new keys, the subagent never rewords them):
   - `fig.tkOml` "Totalkapitalens omløpshastighet"
   - `keyFigures.foldout.margin` "Margin eller kapitalbruk?"
   - `keyFigures.foldout.pay` "Lønnsnivå eller produktivitet?"
   - Everything else reuses existing keys. The own value is labelled with the company name, as in the table head. EXPERIENCE gets the keys in the same commit as `nb.json`.
7. **The no-product test covers only the decomposition factors.** It must not catch legitimate arithmetic such as the capital kroner amounts for 9–11.
   - It scans `src/` for any multiplication (`multiply(`, `.times(`, `.mul(`, `*`) that involves the factors: `totalAssetTurnover`, the turnover benchmark and the factor views.
   - Any exception sits in an explicit allow-list in the test, each with its reason. The list starts empty.
   - The implementation report shows the test failing when a product of the factors is added.

## Boundaries & Constraints

**Always:**
- **One engine (AD-1, AD-8).** Every factor value, median and quartile comes from `src/engine`, as exact fractions divided once. Rounding happens only in `src/engine/format.ts`.
- **Each factor stands alone.** Each is compared with its own median, has its own strip and its own `MIN_PEERS` gate, and counts its own peers.
- **Copy.** All copy comes from `nb.json`. New copy is Meinich's approved wording, copied verbatim. `test/messages.test.ts` has a "Story 3.2" block asserting each new key verbatim. The subagent never rewrites approved text.
- **Payload (AD-4).** `'use client'` modules receive only strings, booleans and `StripMarks`. No øre, `Decimal`, `Fraction` or `bigint` crosses.
- **Phone.** Check 375 and 320 px during the build, not at the end.

**Never:**
- A product of factors, computed or shown: neither the subject's margin × turnover nor median × median.
- Beste fjerdedel, Plassering, percentile or kroner for total asset turnover. It is never labelled as key figure 11, "Omløpshastighet driftseiendeler" or driftsmidlenes omløpshastighet.
- A median or strip for lønnskostnad or omsetning per årsverk in v1.
- An account wall, a dialog, or a fold-out nested inside a figure row.
- Classification, fingerprint or key figure per orgnr for the labelled set, or a test naming its companies.
- `pnpm classify`, deleting a dump, a migration, a change to an existing engine formula, or a push before Meinich says so.

## I/O & Edge-Case Matrix

"Fails if deleted" names the test that fails when the guard is removed. The implementation report shows each removal and the failing output. KT = `test/analysis/key-figure-table.test.ts`, DV = `test/analysis/decomposition-view.test.ts`, BT = `test/engine/benchmark.test.ts`.

| Scenario | Input / State | Expected | Fails if deleted |
|---|---|---|---|
| Turnover benchmarked | subject + ≥10 peers with `sumEiendeler` > 0 | median and quartiles of `sumDriftsinntekter/sumEiendeler`; `best` null | BT "total asset turnover: own median, no favourable quartile" |
| Own gate | 10 peers, one with `sumEiendeler` ≤ 0 | margin compared (10), turnover below floor (9 av 10) | BT "each factor has its own gate"; DV "each factor is gated on its own" |
| Never multiplied | any | no multiplication involving a decomposition factor in `src/` (allow-list with reasons, empty); the rendered fold-out holds neither product formatted | `test/analysis/never-multiplied.test.ts` "no product of factors is computed"; KT "the fold-out shows no product of factors" |
| Derived factor | compared turnover | view keys exactly label, own, median, counts, strip, direction; label `fig.tkOml`, not `fig.oml`, no "11", no "drift" | DV "turnover has no best, Plassering or kroner"; DV "turnover is never labelled key figure 11" |
| Below floor | n < 10 for a factor | subject's value + "For få sammenlignbare (n av 10)" | DV "a factor below the floor keeps its value" |
| Copy | `nb.json` | the three keys of decision 6, verbatim | `test/messages.test.ts` "Story 3.2 copy" |
| Pay, v1 | every basis (in dataset, outside, failed) | both factors "Ikke lest i denne versjonen" + notes text; no median, strip or count | DV "pay factors are not read in v1 and carry no median" |
| Component | rendered | `h3 > button` with `aria-expanded="false"`, `aria-controls` = body id; caret `aria-hidden`; body `hidden`, `bg-surface-foldout`, indented | `test/analysis/fold-out.test.ts` "closed by default, wired by id" |
| Placement | desktop / phone | desktop: its own `tr` right after the figure row; phone: its own `tbody` right after the row group, full width, never inside a figure row | KT "fold-outs sit under their row, and on phone below their group" |
| Outside the demo data | demo A (off the manifest) | margin fold-out compared; pay fold-out not read in v1 | `e2e/key-figures.spec.ts` "margin or capital: each factor against the engine" |
| Keyboard, phone | 1280, 375, 320 px | Enter and Space toggle; side by side ≥ md, stacked below; `scrollWidth ≤ innerWidth` | `e2e/key-figures.spec.ts` "fold-outs: keyboard and phone" |
| Below floor e2e | `floorSubject()` excluded to 9 | each factor "For få sammenlignbare (n av 10)" with the engine's n | `e2e/peer-adjust.spec.ts` "factors below the floor" |
| Payload | view, page | strings and strip marks only; existing øre scan passes on the tab | DV "decomposition view holds only strings and strip marks"; `e2e/key-figures.spec.ts` payload scan |

</frozen-after-approval>

## Code Map

- `src/engine/key-figures.ts:118-130` -- `apiKeyFigureFractions` holds `totalAssetTurnover`. `computeApiKeyFigures` :138 returns only the three figures. Reuse `ratio()` and `toFigureResult`; change no formula.
- `src/engine/benchmark.ts:70-102` -- `benchmarkApiFigures`. Add `benchmarkTotalAssetTurnover(subject, peers)` → `{ comparison }`, with no `gap` field, through `compareFigure(…, 'none')` (`src/engine/statistics.ts:57-108`; `none` gives `best: null`).
- `src/engine/types.ts:86-153` -- `FigureResult`, `Comparison` (`subject_absent` | `below_floor` | `compared`), `MIN_PEERS` :110.
- `src/engine/document-absence.ts:85` -- 7 and 8 are `not_read_in_v1` / `notes` on every basis. The pay factors read these comparisons from `benchmarkDocumentFigures`.
- `src/analysis/shown-group.ts:96-100` -- call the turnover benchmark beside `benchmarkApiFigures`, over the same peers (group less `ekskl`).
- `src/analysis/key-figure-rows.ts` -- `stripMarks` :256, `middleHalfText` :244, `benchmarkOf` :390, `keyFigureTableView` :416, `StripMarks` :128. Add `decompositions: { margin, pay }` to the view, or put it in a new `src/analysis/decomposition-view.ts` that it calls. `FactorView` has no best, placement or gap field.
- `src/analysis/absence-state.ts:120-130`, `src/analysis/figure-text.ts` -- not-read-in-v1 words.
- `src/components/analysis/key-figure-table.tsx` -- server component. Desktop `DesktopRow` :98-145, groups :289-302 (`<tbody data-group>`); phone :306-332, `PhoneRow` :156-206. Insert the fold-outs here. Ids must not start with `kf-p-exp-` (`e2e/key-figures.spec.ts` ORDER test :283).
- `src/components/analysis/phone-row-toggle.tsx` -- the pattern to follow (button, caret span `aria-hidden`, `hidden` body). `distribution-strip.tsx` -- reuse for each factor's strip, at fluid width.
- `src/app/globals.css:21` -- `bg-surface-foldout` exists. DESIGN.md `indent-group` is 30 px.
- `src/messages/nb.json` -- `fig.*` :203-217, `keyFigures.*` :144-190, `analysis.figures.notReadInV1` (+`.notes`).
- `e2e/seed.ts` -- `A`, `expectedBenchmark` :224, `floorSubject()` :293-318, `noSidewaysScroll` :210. `e2e/key-figures.spec.ts`, `e2e/peer-adjust.spec.ts:180-206` (the 9-of-10 pattern), `e2e/payload.ts`.
- `test/engine/identities.test.ts:48-60` -- the only legitimate multiply of the factors (the identity, in `test/`). The never-multiplied scan covers `src/` only, and only the decomposition factors (decision 7).

## Tasks & Acceptance

**Execution:**
- [x] `src/engine/benchmark.ts` + `test/engine/benchmark.test.ts` -- turnover benchmark, its own gate.
- [x] `src/analysis/decomposition-view.ts` + DV, `test/analysis/never-multiplied.test.ts` -- factor views, payload boundary, label and absent-field tests.
- [x] `src/analysis/shown-group.ts`, `key-figure-rows.ts` -- wire the views into the table view.
- [x] `src/messages/nb.json`, `test/messages.test.ts`, EXPERIENCE.md -- approved keys verbatim, in one commit.
- [x] `src/components/analysis/fold-out.tsx`, `factor-pair.tsx`, `key-figure-table.tsx` + `test/analysis/fold-out.test.ts`, KT -- the component, placement and the factor pair.
- [x] `e2e/key-figures.spec.ts`, `e2e/peer-adjust.spec.ts` -- compared, keyboard, phone, below the floor.
- [x] `docs/ai-log.md` (what can go wrong with factors side by side), `deferred-work.md` (decision 5), epics.md / DESIGN.md / EXPERIENCE.md / technical note (decisions 1, 2: every current-state shadcn mention, EXPERIENCE :220 and :320; dated reviews and memlogs are records and stay), PRD if FR-26 or a shadcn mention is affected.

**Acceptance Criteria:**
- Given the PR, then it states what could go wrong with factors of money figures shown side by side, and with multiplying them, with the reasoning in `docs/ai-log.md`. It credits the review session's contributions and has a "Planning documents:" line.
- Given a final `pnpm seed` → `pnpm restore:documents`, then the four counts are reported, and `pnpm lint`, `typecheck`, `test`, `test:db`, `test:ingest` and e2e (one worker) all pass.

## Implementation Notes

## Spec Change Log

- **2026-11-19, Meinich: each compared factor also shows its midtre halvdel as text** (review pass 1, triage row 2, found by the Blind Hunter review layer).
  - Decision 3 and the matrix row "Derived factor" fixed a compared factor's fields as label, own, median, counts, strip and direction.
  - The strip draws the midtre halvdel band but is `aria-hidden`, and no text gave the quartiles. EXPERIENCE "Distribution strip" hides strips only because the cells carry that text.
  - Each compared factor now has one more field, `middleHalf`, with the existing labelled text: "Midtre halvdel: {lo}–{hi} %" for driftsmargin and "Midtre halvdel: {lo}–{hi}" for total asset turnover, from `middleHalfText`. There is no new wording.
  - Still absent: beste fjerdedel, Plassering and kroner.
  - KEEP: everything else in the factor views.
- **2026-11-19, Meinich: the driftsmargin factor's direction text is "↑ Høyere er bedre", not "Bedre →"** (review pass 1, triage row 3, found by the Edge Case Hunter review layer).
  - Decision 3 wrote "direction text ("Bedre →")", a wording taken over from the BMAD session's checkpoint summary.
  - "Bedre →" is drawn only on a mirrored strip, that is, where lower is better. Driftsmargin is not mirrored.
  - The code shows the table's direction words, and Meinich accepted it: "↑ Høyere er bedre" for driftsmargin and "Ingen retning" for total asset turnover. The code does not change.
- **2026-11-19, Meinich: `_bmad-output/planning-artifacts/architecture/technology.md` is out of scope.**
  - It is the course lecturer's (Bård Pettersen's) reference for the architecture work, added in `151d56a`, and stays untouched.
  - It is removed from the docs task. Before this, that task listed it as a planning document to correct.

## Review Triage Log

Review pass 1 (2026-11-18): Blind Hunter (BH), Edge Case Hunter (ECH) and Verification Gap (VG), all run by the BMAD session. Row 18 (S) is from the BMAD session's own check of the review-fix commit.

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | VG | The driftsmargin factor's text when the margin cannot be computed is untested, and its denominator id is duplicated from the row. | low | "an undefined factor reads its reason" sets only `sumEiendeler: 0n`. Nothing puts driftsmargin in `subject_absent` and reads the fold-out. | patch (test) |
| 2 | BH | A compared factor's strip draws the midtre halvdel band, is `aria-hidden`, and no text gives the quartiles. | medium | EXPERIENCE "Distribution strip" hides the strip only because the cells carry the midtre halvdel text. The factor view has no such field. Decision 3 and the matrix fix the fields, so adding one renegotiates the frozen block. | patch (Meinich, 2026-11-19: option A; Spec Change Log) |
| 3 | ECH | Decision 3 says direction text "Bedre →"; the driftsmargin factor shows "↑ Høyere er bedre". | low | "Bedre →" is drawn only on a mirrored strip (`distribution-strip.tsx:98`), and driftsmargin is not mirrored, so the code follows the table's words. The frozen wording came from the checkpoint summary. | accept code (Meinich, 2026-11-19; Spec Change Log) |
| 4 | BH | UX-DR22 in epics.md still says the pay pair uses UX-DR21's pattern and gating. | low | Decision 2: in v1 both pay factors are not read, with no median, strip or count. | patch (docs) |
| 5 | BH | DESIGN.md "Factor pair" still describes bordered boxes with "Fjordkode x · median y". | low | The code has no border and uses a `<dl>`. | patch (docs) |
| 6 | BH | The pay fold-out sits inside the cost-share `<tbody>`, under its row-group heading. | low | This is matrix row "Placement": desktop, its own `tr` right after the figure row. A fix edits the frozen spec. | reject |
| 7 | BH, ECH | `payFactorView` throws (500 for the tab), and the guard has no test. | low | No input reaches it: 7 and 8 are `not_read_in_v1` on every basis (`document-absence.ts:85`). A loud failure on an unreachable state is correct, but AGENTS.md wants a test for every guard. | patch (test) |
| 8 | BH, ECH | The no-product scan reads only `src/` and matches names, not data flow. | low | `scripts/` names no factor today. Adding `scripts/` is one entry. The name-based limit is stated in the ai-log, not in the test header. | patch (scan `scripts/`, note the limit) |
| 9 | BH | The e2e no-product check formats only as a percent. | low | The unit test also checks `formatTurnover`. | patch |
| 10 | BH | No e2e test covers the fold-outs for a subject in the demo data. | low | Unit fixtures cover every basis. One assertion in `e2e/synthetic-documents.spec.ts` adds the in-dataset case. | patch |
| 11 | BH | `turnoverBenchmark` sits in `DOCUMENT_SERVER_FIELDS`, though it is an API figure. | low | Both lists are scanned on every tab (`e2e/payload.ts:95`, :133), so nothing leaks, but the name misleads. | patch (move to `SERVER_FIELDS`) |
| 12 | BH | No session file, no end hash in the ai-log Outcome, and no tracking for `architecture/technology.md`. | low | The session file and PR come at the end. The Outcome names no end hash. `technology.md` is the course lecturer's (Bård Pettersen's) reference for the architecture work, added in `151d56a`. It stays untouched, and nothing tracks it for removal (Meinich, 2026-11-19). | patch (Outcome); session file at presentation; technology.md: reject |
| 13 | BH, ECH | Desktop and phone fold-outs keep separate open state. | low | This is the same two-table pattern as 3.1b's phone rows. It matters only when the viewport crosses `md`, and the fix lifts state across a server component. | reject |
| 14 | BH | The fluid strip scales up to 1.5× at 240 px, so the track is thicker than the table's. | low | `max-w-60` against a 160 px viewBox. Capping at 160 px (`max-w-40`) is a direct correction. | patch |
| 15 | BH | The keyboard e2e uses Enter only to open and Space only to close. | low | `e2e/key-figures.spec.ts:400-424`. | patch (both keys both ways) |
| 16 | ECH | `floorSubject` with 30 peers needs 21 exclusions, more than `MAX_EKSKL`. | false | The test throws with a clear message in that case (`peer-adjust.spec.ts:494-501`). It is not misleading, and the seeded subject passed. | reject |
| 17 | ECH | The turnover factor's `subject_absent` branch in "factors below the floor" is never taken. | low | It is a defensive branch for a seed state that does not occur. The unit test covers the absent text. | reject |
| 18 | S | The review fix for row 2 made `decomposition-view.ts` import `middleHalfText` from `key-figure-rows.ts`, which imports `decomposition-view.ts`: an import cycle. | low | The BMAD session found it in its own check of the review-fix commit. `middleHalfText` and `Unit` moved to `src/analysis/middle-half.ts`, which both modules import. | patch |

## Design Notes

**Why no product.** Median margin × median turnover is not the median return on assets, and a peer chosen to show both would be a named benchmark (docs/key-figures.md, "Decompositions"). The fold-out answers "which lever?" by placing each factor against its own distribution. The guard is twofold: a source scan forbids any multiplication involving a decomposition factor in `src/` (decision 7, with an allow-list that starts empty), and the rendered fold-out is checked for both products formatted.

## Verification

**How to work:**
- Commit in small logical steps, each type-checking on its own (engine, view, copy, component, e2e, docs). No push.
- For each matrix row, the report shows the guard removed and the failing test's output, then restores the guard.
- After the last `pnpm seed`, run `pnpm restore:documents` and report its four counts.
- Run e2e with one worker, one thing at a time. If something stops on memory, report it; do not restart.

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- green.
- `pnpm seed && pnpm test:db && pnpm test:ingest` -- green.
- `pnpm restore:documents` -- four counts printed.
- `pnpm build && pnpm test:e2e` -- green, `workers: 1`.

**Manual checks:**
- The Nøkkeltall og gap tab at 1280, 375 and 320 px: both fold-outs closed by default; open, they show the factors side by side, or stacked on phone; no sideways body scroll.
