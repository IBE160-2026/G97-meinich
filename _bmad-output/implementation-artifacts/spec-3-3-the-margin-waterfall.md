---
title: 'Story 3.3: The margin waterfall'
type: 'feature'
created: '2026-11-19'
status: 'in-progress'
baseline_commit: 'c315dd5f65c7d0e5ec09b3530329d98dd00c29a9'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/docs/key-figures.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The cost-share rows say "Se forklaring av marginen", but nothing explains the margin gap yet. No engine code builds the common peer set *P*, the revenue-weighted peer group as a whole, or the four bars. Their display rounding does not exist, and no test guards against counting a bar twice (FR-29, FR-30, issue #73).

**Approach:** A pure engine module builds *P*, the aggregate *M* and *Aₓ*, and the four exact bars. It also rounds them once for display, so start + bars = end in whole kroner. The FR-30 tests run against a registry of every engine amount function, so Stories 3.4 and 3.5 inherit them. A view builder turns the result into strings and bar geometry. The fold-out "Hva forklarer marginavviket?" opens under Driftsmargin with a hand-written SVG waterfall, "Vis tallene" and phone rows. "Se forklaring av marginen" becomes a link to it.

**Decisions (Meinich, 2026-11-19):**

1. **Source.** All five figures, for the subject and for every peer, come from the one reconciled current column of the benchmark year's document (basis `read`, `d.filing_year` = the benchmark year).
   - The end value can differ from the API `driftsresultat` by up to the tolerance between sources, max(5 kr, 0.001 %). `docs/ai-log.md` says so.
   - A test asserts that the subject's margin shown in the waterfall reads the same as the Driftsmargin row (see decision 10).
2. **Derived figures and R2.**
   - Lines derived by Story 3.1a's rule (`documentCostLines`) and derived revenue (`documentRevenue`) count, as in rows 3–5.
   - R2 (`cost_lines_short_of_total`: the four main lines read and, with an empty `nedskrivninger` counted as 0, short of `sumDriftskostnad` by more than 5 kr) applies to *P* and to the subject. It uses one shared predicate with the fingerprint's, and fingerprint behaviour is unchanged.
   - A subject excluded by R2 gets its own reason (copy R2 in decision 8), never "en regnskapslinje mangler".
3. **Not loaded.** If *P* < 10 and *P* plus the group's `not_in_dataset` peers ≥ 10, the fold-out reads N1: "Ingen forklaring av marginen: regnskapstallene til de sammenlignbare er ikke i demodataene."
   - Otherwise below 10 it reads the story's sentence with *n* = |*P*|.
   - A subject that is itself `not_in_dataset` (demo A, demo B) reads "Ikke i demodataene".
4. **Subject without its components.** The fold-out shows the same absence words as the subject's Varekostnadsandel row (Stories 2.9 and 3.1a), except for R2 (decision 2). *P* is not computed.
5. **Not NOK.** No waterfall. The fold-out reads the existing "Beløpet er ikke i kroner".
6. **Chart.** A hand-written SVG, with no new dependency.
   - Every current-state Recharts mention is corrected: EXPERIENCE :23 and :290, DESIGN :3, the technical note :320, and epics :181, :326 (UX-DR71) and :466.
   - `architecture/technology.md` and dated records stay.
7. **FR-30 registry.** The registry test finds the engine's amount functions itself, with no hand-kept list. It uses the TypeScript compiler on the return types of every function exported from `src/engine`, taking any that returns a kroner-amount type.
   - It fails when such a function is not classified in `src/engine/amounts.ts`, and when a function classified as a total references a waterfall bar or cost-share amount.
   - The implementation report shows both failures.
   - The pure engine function `workingCapitalReleased(kfd, lgd)` (9 + 10; none unless both exist) is added for cluster 2. It is not shown in 3.3.
   - epics.md Stories 3.4 and 3.5 each get the AC line: "every new amount function is registered in `src/engine/amounts.ts` and passes the FR-30 tests".
8. **Copy** (approved verbatim; new keys, the subagent never rewords them):
   - **Verbatim from Story 3.3 / EXPERIENCE:**
     - "Hva forklarer marginavviket?"
     - "Peer-gruppen samlet"
     - "Varekostnad", "Lønn", "Andre driftskostnader", "Avskrivninger og øvrige poster"
     - "Mot peer-gruppen samlet: {x}, ikke beste fjerdedel"
     - "Dette forklarer avviket. Det er ikke et gap som skal lukkes, og det legges aldri til økt driftsresultat."
     - "Mot peer-gruppen samlet, ikke medianen"
     - "Ingen forklaring av marginen: bare {n} sammenlignbare har alle kostnadslinjene (av 10 som trengs)."
     - "Vis tallene", "Skjul tallene"
     - "margin {m}", "{own} mot {all}", "lavere enn samlet"
     - "Fra {start} (peer-gruppen samlet) til {end}, fire poster, sum {sum}"
   - **New:**
     - N1: "Ingen forklaring av marginen: regnskapstallene til de sammenlignbare er ikke i demodataene."
     - N2: "høyere enn samlet"
     - N3 (legend): "Hever marginen mot samlet", "Senker marginen mot samlet", "Restpost, uten retning"
     - N4 (table caption): "Marginavviket mot peer-gruppen samlet, i kroner"
     - N5 (column heads): "Post", {company name}, "Samlet", "Kroner"
     - N6 (last row head): "Referanse"
     - R2: decision 11.
   - EXPERIENCE gets the keys in the same commit as `nb.json`.
9. **Deferred work.** No entry is taken in. `medianStepExists` stays with Story 3.5.
10. **The waterfall's margin text is the document's.** The end bar's and the tag's "margin {m}" show the document's margin, the one the bars sum to. Two tests cover it:
    - when document and API agree to the øre, the text reads exactly as the Driftsmargin row (WV "the waterfall's margin reads as its row");
    - on a rounding boundary within the tolerance between sources, the two can read 0,1 pp apart, and the waterfall keeps the document's (WV "on a rounding boundary the waterfall keeps the document's margin").

    `docs/ai-log.md` records the possible difference.
11. **R2 copy** (approved): "Ingen forklaring av marginen: kostnadslinjene i regnskapet for {aar} summerer ikke til sum driftskostnader."
    - The placeholder is `{aar}`, as in `analysis.documentFailed`, filled with the benchmark filing's year. Meinich approved it written as "{år}".

## Boundaries & Constraints

**Always:**
- **One engine (AD-1, AD-8).** *P*, *M*, *Aₓ*, every bar and the display rounding live in `src/engine`, in `Decimal` or exact fractions, never `Number`.
- **Exact identities.** The exact bars sum to (subject margin − M) × `sumDriftsinntekter` (`Decimal` equality). The displayed bars sum to the displayed total. Start + bars = end.
- **Not a target.** The waterfall is never scaled by the closable share and never added to any total (FR-30). The FR-30 tests run against the engine's amount functions.
- **Copy.** All copy comes from `nb.json`. New copy is Meinich's approved wording, copied verbatim. `test/messages.test.ts` has a "Story 3.3 copy" block asserting each new key verbatim. The subagent never rewrites approved text.
- **Payload (AD-4).** `'use client'` modules receive only strings, booleans and bar geometry. No øre, `Decimal` or `bigint` crosses, whether the subject's, a peer's or an aggregate's.
- **Phone.** Check 375 and 320 px during the build, not at the end.

**Never:**
- A mean of ratios as the aggregate. A median as the waterfall's reference. A named peer.
- Kroner of a cost share's own. A waterfall bar in a total.
- A new route or a server action (`check:routes`). A new dependency (Recharts stays out unless decided otherwise).
- Classification, fingerprint or key figure per orgnr for the labelled set, or a test naming its companies.
- `pnpm classify`, deleting a dump, a migration, a change to an existing engine formula, touching `architecture/technology.md`, or a push before Meinich says so.

## I/O & Edge-Case Matrix

"Fails if deleted" names the test that fails when the guard is removed. The implementation report shows each removal and its failure. WF = `test/engine/waterfall.test.ts`, WV = `test/analysis/waterfall-view.test.ts`, NDC = `test/engine/no-double-counting.test.ts`, KT = `test/analysis/key-figure-table.test.ts`.

| Scenario | Input / State | Expected | Fails if deleted |
|---|---|---|---|
| *P* at 10 | 10 peers with all five figures, reconciled, same year | decomposition computed over exactly those 10 | WF "P of 10 gives a decomposition" |
| *P* at 9 | one of them lacks a line | no decomposition; `{ kind: 'too_few', n: 9 }` | WF "P of 9 gives none, with n" |
| Who enters *P* | failed / not reconciled / no document / line missing / revenue ≤ 0 / another year | left out, each case | WF "who enters P" |
| Revenue-weighted | peers of very different size | Aₓ = Σ numerator / Σ revenue, not a mean of ratios | WF "the aggregate is revenue-weighted" |
| Exact identity | any *P*, residual of either sign | Σ four bars = (m − M) × S exactly; margin = 1 − four shares for every company | WF "bars sum exactly to the margin gap" |
| Rounding | negative bars, ties, residual ±, øre in driftsresultat | total half away from zero once; bars floor + signed largest remainder, ties in bar order; 0 ≤ remainder ≤ 4; Σ shown = total, start + bars = end | WF "display rounding: …" cases + property test (≥ 1 000 random cases, seeded) |
| Subject lacks a component | its document absent, failed, or a line missing | no decomposition; the fold-out shows that absence's existing words | WV "a subject without its lines says why" |
| Subject fails R2 | its lines short of `sumDriftskostnad` by > 5 kr | no decomposition; the R2 words, not "en regnskapslinje mangler" | WV "a subject failing R2 has its own reason"; WF "R2 leaves a peer out of P" |
| Not loaded | *P* < 10, *P* + `not_in_dataset` peers ≥ 10 | N1, not the too-few sentence | WV "peers not in the demo data: N1" |
| Margin text | document = API to the øre / on a rounding boundary | reads as the Driftsmargin row / keeps the document's margin | WV "the waterfall's margin reads as its row"; WV "on a rounding boundary the waterfall keeps the document's margin" |
| Not NOK | `valuta` ≠ NOK | no waterfall; existing words | WV "not in kroner: no waterfall" |
| Outside the demo data | subject `not_in_dataset` (demo A, demo B) | "Ikke i demodataene"; no chart | WV "outside the demo data"; `e2e/key-figures.spec.ts` "the waterfall is not in the demo data" |
| Fold-out | full *P* | tag, never-added sentence, five steps with sign, ▲/▼, word, own mot samlet; residual slate; legend of three kinds; subline where row and bar disagree | WV "bars carry sign, glyph, word and shares"; KT "the waterfall fold-out" |
| Never scaled | every `andel` in `ANDELER` | identical waterfall strings | WV "identical at every andel" |
| FR-30 cluster 1 | engine exports found by the compiler | no cost share yields kroner; no total takes a waterfall bar; every exported amount function is classified | NDC "cluster 1 …", NDC "every amount function is registered" (fails on an unregistered new function and on a total referencing a bar) |
| FR-30 cluster 2 | registry | working capital released = 9 + 10 only, none without both; 11 never summed with 9 or the total | NDC "cluster 2 …" |
| Link | cost-share row | `a` that opens the fold-out and focuses its heading; no route | `e2e/synthetic-documents.spec.ts` "Se forklaring av marginen opens the waterfall"; `pnpm check:routes` |
| Chart a11y | rendered | non-focusable `svg role="img"` with summary `aria-label`; "Vis tallene"/"Skjul tallene" table (caption, `th scope="row"`, start, four, end, reference); bars distinguishable under `forced-colors: active` | KT "the chart is an image with a summary and a table"; `e2e/synthetic-documents.spec.ts` "forced colours keep the bars apart" |
| Full waterfall e2e | synthetic subject + 10 peers | bars and total equal the engine's over the fixture; at 9 (one excluded) the too-few words | `e2e/synthetic-documents.spec.ts` "the waterfall against the engine", "excluding one peer leaves no waterfall" |
| Phone | 375, 320 px | vertical rows, 10 px bars on one kroner scale, tag then sentence; `scrollWidth ≤ innerWidth` | `e2e/synthetic-documents.spec.ts` "phone: the waterfall as rows" |
| Payload | view, page | strings and geometry only; no subject, peer or aggregate øre | WV "waterfall view holds only strings and geometry"; `e2e/synthetic-documents.spec.ts` "no document øre reaches the page" |
| Copy | `nb.json` | every approved key verbatim | `test/messages.test.ts` "Story 3.3 copy" |

</frozen-after-approval>

## Code Map

- `src/engine/document-inputs.ts` -- `documentFigures` :136, `documentRevenue` :229 (derived = driftsresultat + sumDriftskostnad), `documentCostLines` :286-320 (3.1a rule, `derived`), `DocumentBasis` :358-379, `documentBasis` :399-428 (fixed order; R3 :423). Reuse; change nothing.
- `src/engine/fingerprint.ts:55-58, 175, 302-305` -- R2 `cost_lines_short_of_total`. Extract a shared predicate if Q2 is approved, without changing fingerprint behaviour (`test/fingerprint-seed.test.ts`).
- `src/engine/document-key-figures.ts:114-187` -- `quotient` and the cost shares. The waterfall shares must equal rows 3–5 for the subject.
- `src/engine/benchmark.ts` -- `driftsmarginGap` :52, `capitalGap` :183. Register both in `AMOUNT_FUNCTIONS`.
- `src/engine/decimal.ts:27-32` -- `roundHalfAwayFromZero`, documented "called only by format.ts". The waterfall's display rounding is the second caller, so amend the comment. Floor via `Decimal.floor()`.
- `src/url/analysis-state.ts:36-40` -- `ANDELER = [0, 25, 50, 75, 100, 'median']`.
- `src/analysis/shown-group.ts`, `src/analysis/key-figure-rows.ts` -- `DECOMPOSITION_UNDER` :326 (add `driftsmargin: 'waterfall'`), the cost-share kroner :231.
- `src/components/analysis/fold-out.tsx` -- add an optional heading id and an open-and-focus trigger, so the link can open it with no URL state. `key-figure-table.tsx` -- `DesktopFoldOut` :248, `PhoneFoldOuts` :269, `Gap`/`Text` :51-70.
- `src/components/analysis/distribution-strip.tsx` -- the SVG pattern (CSS-variable colours, `focusable="false"`).
- `src/app/globals.css:14-32` -- `favourable` #1f6f8b, `unfavourable` #b45309, `slate`, `median`, `navy-700`, `connector`.
- `e2e/synthetic.ts` (`SYNTHETIC_DOCUMENTS`: all 11 have every line, nothing derived; *P* = 10 exactly), `e2e/synthetic-documents.spec.ts` (the 9-of-10 exclusion), `e2e/key-figures.spec.ts` (demo A), `e2e/payload.ts`.
- `scripts/check-routes.ts` -- unchanged. A same-page link and a client trigger add no route.

## Tasks & Acceptance

**Execution:**
- [ ] `src/engine/waterfall.ts` + WF -- *P*, *M*/*Aₓ*, exact bars, display rounding, property test.
- [ ] `src/engine/amounts.ts` (+ `workingCapitalReleased` if approved) + NDC.
- [ ] `src/analysis/waterfall-view.ts` + WV, `shown-group.ts`, `key-figure-rows.ts` -- view, states, the link.
- [ ] `src/messages/nb.json`, `test/messages.test.ts`, EXPERIENCE.md -- approved keys verbatim, in one commit.
- [ ] `src/components/analysis/waterfall-chart.tsx`, `waterfall-rows.tsx` (phone), `show-numbers.tsx`, `fold-out.tsx`, `key-figure-table.tsx` + KT.
- [ ] `e2e/synthetic-documents.spec.ts`, `e2e/key-figures.spec.ts`, `e2e/payload.ts`.
- [ ] `docs/ai-log.md` (decomposition, rounding, double counting), `docs/key-figures.md` (rounding details if refined), epics.md / DESIGN / EXPERIENCE / technical note (Recharts, Q6; 3.4/3.5 AC lines, Q7), `deferred-work.md` if anything is deferred.

**Acceptance Criteria:**
- Given the PR, then it states what could go wrong with the decomposition, its rounding and double counting, with the reasoning in `docs/ai-log.md`. It credits the review session's contributions and has a "Planning documents:" line.
- Given a final `pnpm seed` → `pnpm restore:documents`, then the four counts are reported, and `pnpm lint`, `typecheck`, `test`, `test:db`, `test:ingest`, `check:routes` and e2e (one worker) all pass. No synthetic rows remain afterwards.

## Implementation Notes

Implementation run, 2026-11-19 (subagent). Where the code differs from the Code Map's hints, or a matrix row needed reading:

- **Display rounding is exact bigint arithmetic, not `roundHalfAwayFromZero` and `Decimal.floor()`.** `displayWaterfall` puts the four bars over one common denominator and floors, rounds and compares with bigints. A 40-digit Decimal of 1 000 000/3 keeps fewer decimals than one of 1/3, so two exactly equal fractional parts could compare unequal and a tie would not go in bar order (WF "display rounding: ties go in bar order" uses that case). `decimal.ts`'s comment ("called only by format.ts") stays true and is unchanged.
- **"At 9 (one excluded) the too-few words" (matrix, Full waterfall e2e).** The synthetic subject's band holds seed companies outside the demo data, so with one synthetic peer excluded *P* is 9 and *P* + `not_in_dataset` ≥ 10: decision 3 gives N1 there. `e2e/synthetic-documents.spec.ts` "excluding one peer leaves no waterfall" checks N1 for that exclusion, then excludes those seed companies too and checks the too-few words with n = 9.
- **Focus.** The link moves focus to the fold-out heading's button (inside the `h3`), so Enter and Space work at once; the `h3` carries the link's target id, so without script the link still jumps to it. The click is handled in the page: no route, no query, no hash.
- **Page ids.** A bar is named on the page by its cost share's key (`vare`, `lonn`, `andre`) or `residual`: the e2e payload scan refuses `annenDriftskostnad`, an engine field name.
- **"Vis tallene" table.** It sits in its own scroll region labelled by its caption (EXPERIENCE "Scroll container"), so at 320 px its four columns scroll inside it and the body does not.
- **Phone order.** Tag, sentence, then the rows, as on the desktop: the never-added sentence stays directly above the bars at both widths.
- **A bar of exactly 0 kr** (own share = samlet's) shows "0 kr" with no glyph and no word; no approved copy says "equal".
- **`workingCapitalReleased`** gives no total when either part is a strength; whether a strength counts as 0 is left to Story 3.5 (`deferred-work.md`).
- **The forced-colours e2e test** first passed with the `.wf-bar` rules removed (Chromium keeps an SVG's author fill under forced colours). It now also requires every bar's system outline, and fails without the rules (review-fix commit `19940fd`).

## Spec Change Log

## Review Triage Log

## Design Notes

**Rounding bound.** Let T be the exact total, D = round(T) half away from zero, and fᵢ the fractional part of bar i. Then the remainder R = D − Σ⌊barᵢ⌋ = (D − T) + Σfᵢ lies in (−0.5, 0.5 + k), where k is the number of bars with fᵢ > 0. Since R is an integer, 0 ≤ R ≤ k ≤ 4. So the remainder is never negative, and each unit goes to a different bar with a nonzero fraction. Ties go in bar order: varekostnad, lønn, andre, residual. Display: E = round(driftsresultat) half away from zero, start = E − D. Then start + Σ bars = E exactly in whole kroner, even when `driftsresultat` has øre.

## Verification

**How to work:**
- Commit in small logical steps, each type-checking on its own. No push.
- For each matrix row, the report shows the guard removed and the failing test's output.
- After the last `pnpm seed`, run `pnpm restore:documents` and report its four counts. Run e2e with one worker, one thing at a time. If something stops on memory, report it; do not restart.

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- green.
- `pnpm seed && pnpm test:db && pnpm test:ingest` -- green.
- `pnpm restore:documents` -- four counts.
- `pnpm build && pnpm check:routes && pnpm test:e2e` -- green, `workers: 1`, then 0 synthetic rows.

**Manual checks:**
- At 1280, 375 and 320 px: the waterfall readable, no sideways body scroll, forced colours emulated.
