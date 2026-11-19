---
title: 'Story 3.4: The rest of Oversikt'
type: 'feature'
created: '2026-11-19'
status: 'done'
baseline_commit: 'bb3f9326adafdd57066cf9c0d94df7038d85637c'
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

**Problem:** Oversikt shows only the hero. The page has no picture of where the company sits among its peers. It also has no largest capital gap, no largest strength, and nothing saying which figures lack a basis (FR-27, FR-29, issue #75).

**Approach:** Build the DESIGN card grid on Oversikt:
- the hero (5 columns);
- a hand-written SVG beeswarm of driftsmargin with a compact list of the nearest peers (7 columns);
- three small cards of 4 columns each, chosen by pure functions.

The capital card's choice is an engine function, registered in `src/engine/amounts.ts`, that compares exact `Decimal` amounts and sums nothing. The view builders hand the client only strings, booleans and geometry.

**Decisions (Meinich, 2026-11-19):**

1. **Capital card.**
   - **Candidates:**
     - the working-capital total (`workingCapitalReleased`), when both (9) and (10) are amounts;
     - otherwise the one of (9) and (10) that is an amount, shown alone under its own label and with no total (`docs/key-figures.md:164`);
     - (11).
   - **Choice:** the largest exact `Decimal` in øre wins, compared before any rounding. On a tie, the lower figure number wins: working capital before (11).
   - **`largestCapitalGap`** lives in `src/engine/benchmark.ts`. It is registered in `src/engine/amounts.ts` under a new role, `'choice'`.
   - **NDC "a choice sums nothing"** fails on any `.plus`/`.add` in a `choice` other than through `workingCapitalReleased`. It includes a probe that adds (11) to (9) and must fail.
   - **When there is no amount,** the first that applies:
     1. the subject's document basis is not `read`: that basis's absence words, as on the rows ("Ikke i demodataene", …);
     2. any of the three is `not_nok`: "Beløpet er ikke i kroner";
     3. all three are compared strengths: "Ingen kapitalgap: ingen av kapitalnøkkeltallene ligger under beste fjerdedel.";
     4. otherwise: K2.
2. **Strength.**
   - **Ranking:** on the whole percent the table shows, rounded by `formatWholePercent`'s rule, through one exported value in `src/engine/format.ts`. On a tie, the lower figure number wins.
   - **Qualifying:** direction ≠ none, compared, and own value at or beyond beste fjerdedel.
   - **Never qualifying:** 6, 8, 13, 14 and kontantandel.
3. **Missing basis.**
   - **Counts:** a row whose comparison is `subject_absent` (any absence, `not_read_in_v1` included, so 7 and 8 count) or `below_floor`.
   - **Order:** the table's order (`KEY_FIGURE_ROWS`). No reason ranks above another.
   - The empty state is unreachable in v1 and is tested in unit tests only.
4. **Beeswarm domain:** P5–P95 (option B). The geometry is set in Design Notes, "Beeswarm geometry".
5. **Five nearest.**
   - **Nearest:** by |peer − company| in exact driftsmargin. Ties follow the Peers list's order (revenue descending, then orgnr), on the server only.
   - **Shown:** sorted by driftsmargin, highest first, with the company's own row in its place and marked.
6. **No driftsmargin.**
   - Such a peer is not in the plot. It is last in "Vis tallene", with the Peers list's absence words.
   - A slate line under the plot says how many: K7.
7. **The explanation row** is not rendered, and there is no placeholder.
8. **Copy** (approved, new keys, never reworded):
   - Verbatim from the story and EXPERIENCE:
     - "Største kapitalgap", "Største styrke", "Mangler grunnlag";
     - "Viser gap ved full tilnærming", "Ikke per år, og legges ikke til resultatet.";
     - "Ingen kapitalgap: ingen av kapitalnøkkeltallene ligger under beste fjerdedel.";
     - "Ingen nøkkeltall ligger på eller over beste fjerdedel.";
     - "Alle nøkkeltall har grunnlag for sammenligning.";
     - "og {n} til", "Se alle {n}", "(valgt selskap)".
   - New:
     - C1: "Frigjort kapital: {belop} (engangsbeløp)"
     - C2: "Arbeidskapital (kundefordringsdager og leverandørgjeldsdager)"
     - K2: "Ingen kapitalgap blant kapitalnøkkeltallene som har grunnlag for sammenligning."
     - C4: "Driftsmargin blant sammenlignbare"
     - C5: "Driftsmargin for {n} sammenlignbare. {selskap} {own}, median {median}, beste fjerdedel {best}, bedre enn {plassering}."
     - C6: "{selskap} {v}", "Median {v}", "Beste fjerdedel {v}"
     - K7: "{k} uten driftsmargin er ikke med i plottet."
     - C8: "Nærmeste i driftsmargin"
     - C9: "Driftsmargin for sammenlignbare selskaper"
     - C10: "Omsetning {v}"
     - C11: "‹ {k}", "{k} ›", "Prikkene ved kantene ligger utenfor skalaen."
   - Reused: `hero.vs`, `keyFigures.placement`, `fig.*`, `keyFigures.notInKroner`, `chart.showNumbers`/`hideNumbers`, `peers.col.*`.
9. **Deferred work.** No entry is taken in.
   - The `copyIn` entry (`deferred-work.md:185`) gets the owner Story 5.7, and an evidence line saying that Story 3.3 had 28 failures in one file right after `pnpm seed` (2026-11-19). The file is not confirmed; `test/db/seed.test.ts` has 28 tests.
   - :234 stays with Story 3.5, because rule 1 gives the same amount whether 3.5 counts a strength as 0 or leaves it out. :29 stays with 3.5. :226 stays with 4.4.
10. **One image at a time, and the report's totals.**
    - The layout not shown has `display: none`, so a screen reader gets one `role="img"` at a time. E2E "one beeswarm image at each width" checks that exactly one `img` with an `aria-label` in the beeswarm card is accessible at 1280, 375 and 320 px.
    - The implementation report gives, as totals only:
      - demo A's and B's actual radius and swarm height in each layout;
      - how many bytes the beeswarm adds to the Oversikt payload.

## Boundaries & Constraints

**Always:**
- **One engine (AD-1, AD-8).** The capital choice compares exact `Decimal` øre before any rounding. Amounts are rounded once, by `formatKronerExact`, via `capitalAmountText`.
- **FR-30.** The card never adds (11) to (9), to (10) or to their total. The only sum it shows is `workingCapitalReleased`. A cost share never qualifies, and the card is never compared with the hero's profit gap.
- **One string per peer value.** Driftsmargin and Omsetning come from one exported helper in `src/analysis/peer-rows.ts`. The compact list, "Vis tallene" and the Peers list all call it.
- **Payload (AD-4).** `'use client'` modules receive strings, booleans and plot coordinates only. No orgnr, øre, `Decimal` or exact margin reaches the client.
- **Copy.** Approved copy goes in verbatim, with a "Story 3.4 copy" block in `test/messages.test.ts`. EXPERIENCE gets the new keys in the same commit. The subagent never rewords approved text.
- **Phone.** Check at 375 and 320 px while building.
- **Fixtures.** Every test states its fixture's state first and has no data-dependent branch.

**Never:**
- A chart library or a new dependency. A new route or a server action (`check:routes`).
- Kroner on the strength card. A rounded amount compared, or an amount added in the card.
- "· Endre i Verdi" or a link to Verdi (Story 3.5). The explanation row or a placeholder for it (Epic 4).
- A classification, fingerprint or key figure per orgnr for the labelled set. A test that names its companies.
- `pnpm classify`. Deleting a dump. A migration. Touching `architecture/technology.md`. A push before Meinich says so.

## I/O & Edge-Case Matrix

The last column names the test that fails when the guard is removed. The implementation report shows each removal and the failure it caused.

Abbreviations:
- OC = `test/engine/oversikt-cards.test.ts`
- OV = `test/analysis/oversikt-view.test.ts`
- BS = `test/analysis/beeswarm.test.ts`
- NDC = `test/engine/no-double-counting.test.ts`
- E2E = `e2e/oversikt.spec.ts`
- SD = `e2e/synthetic-documents.spec.ts`

| Scenario | Input / State | Expected | Fails if deleted |
|---|---|---|---|
| Capital: 11 largest | (9)+(10) and 11 all amounts, 11 larger | 11, with its label | OC "the largest amount wins, compared exactly" |
| Capital: one part only | (9) amount, (10) strength or below floor | (9) alone, labelled as (9), no total | OC "one of 9 and 10 alone is shown as that part" |
| Capital: tie | equal `Decimal` amounts | the lower figure number (working capital) | OC "a tie goes to the lower figure number" |
| Capital: near-tie | amounts that differ below 1 kr | the larger exact amount | OC "compared before rounding" |
| No sum with 11 | registry | the choice is registered and sums nothing | NDC "a choice sums nothing" (with a probe that adds 11) |
| Not the hero | any profit gap | card unchanged | OC "the capital card never reads the profit gap" |
| Cost shares | 3–5 worse than T | never chosen | OC "cost shares never qualify" |
| Capital states | not_in_dataset / not NOK / all strengths / mixed | decision 1's order; K2 for mixed | OC "capital card states, in order" |
| Strength | equal whole percent with different exact percentiles; no-direction rows; kontant | decision 2; 6, 8, 13, 14 and kontant never chosen | OC "strength: …" cases |
| Missing basis | rows in table order; 7 and 8 only; none | decision 3; the empty sentence only in the unit fixture | OC "missing basis: …" cases |
| Beeswarm packing | seeded random groups, ≥ 1 000 cases, both layouts | no two dots closer than 2r + gap; same input gives same output; input order does not matter | BS "packing: …" |
| Swarm too tall | 2 000 equal values | radius steps down to its minimum, then the swarm grows past the max height; no overlap, no dot dropped | BS "a swarm too tall shrinks, then grows" |
| Outside P5–P95 | peers and company beyond either end | peers in the edge column with "‹ {k}" / "{k} ›"; company marker at the domain edge with the outward chevron; legend and label carry the true value | BS "clipped peers and company" |
| Group drawn | `ekskl`, peers without a margin | group minus `ekskl`; no-margin peers out of the plot, last in the table, K7 | OV "the plot draws the group less ekskl" |
| Nearest five | equal distances | decision 5 | OV "nearest five, ties …" |
| Byte-identical | same URL | same Driftsmargin string in the list, the table and Peers | OV "one margin string per peer"; E2E "Driftsmargin reads the same in the list, the table and Peers" |
| Outside demo data | demo A | hero and beeswarm normal; capital "Ikke i demodataene" | E2E "demo A: the cards outside the demo data" |
| Capital amount shown | synthetic subject (fixture state stated first) | the engine's chosen amount, "Ikke per år, og legges ikke til resultatet." | SD "the capital card shows the engine's largest amount" |
| Grid | 1280 / 375 / 320 | 12 columns; one column in the order hero, plot and list, cards; `scrollWidth ≤ innerWidth` | E2E "the grid at three widths" |
| Chart a11y | rendered | non-focusable `svg role="img"`, summary label, children hidden, "Vis tallene" table in a scroll region, forced colours | E2E "the beeswarm is an image with a table" |
| Tooltip | touch at 375 | one open at a time, above the plot, leader line | E2E "tooltip on touch" |
| Payload | Oversikt, demo A and synthetic | no peer orgnr, øre or exact margin; no document field | E2E payload test extended; SD payload test on Oversikt |
| Copy | `nb.json` | every approved key verbatim | `test/messages.test.ts` "Story 3.4 copy" |

</frozen-after-approval>

## Code Map

- `src/engine/benchmark.ts` -- `capitalGap` :183 and `CapitalGap` :157, `workingCapitalReleased` :227, `driftsmarginGap` :52 (strength check :55, :193). Add `largestCapitalGap(kfd, lgd, oml)`, which returns the chosen figure and its exact `ore` or a reason. Add `atOrBeyondBest(comparison, direction)`.
- `src/engine/amounts.ts:29,37` -- `AmountRole`. Add `'choice'` for the new function. NDC :176 `forbiddenInTotals` applies only to `total`. Add a check that a `choice` makes no `.plus`/`.add` call except through `workingCapitalReleased`.
- `src/engine/statistics.ts:37` -- `percentileRank` (exact). `src/engine/format.ts:101` -- `formatWholePercent`. Add an exported whole-percent value for ranking here; this file is the one place that rounds.
- `src/engine/document-key-figures.ts:39,59` -- directions and `DOCUMENT_FIGURE_RANKABLE`. `key-figures.ts:17` -- API directions.
- `src/analysis/key-figure-rows.ts:65` -- `KEY_FIGURE_ROWS`, the order. Rows carry `own.text` and the comparison text; reuse them for "Mangler grunnlag". `capitalCell` :225.
- `src/analysis/peer-rows.ts:55` -- private `marginText`. Export one helper per peer value (margin, revenue).
- `src/analysis/shown-group.ts` -- `peers` = the group less `ekskl`. Peer order is in `peers.ts:398`.
- `src/analysis/strip-marks.ts:32` and `waterfall-view.ts:146` -- the geometry precedent: exact positions, then `toNumber` in `src/analysis`.
- `src/components/analysis/oversikt-hero.tsx:160-164` -- the grid wrapper now lives in the hero. Move it to a new `oversikt.tsx`, and keep the hero as the 5-column card.
- `src/components/analysis/analysis-page.tsx:204` -- where Oversikt renders. `show-numbers.tsx`, `distribution-strip.tsx`, `waterfall-chart.tsx` -- patterns to follow. `info-popover.tsx` -- the only popover.
- `src/app/globals.css` -- tokens `peer-dot`, `median`, `gridline`, `slate`, `.scroll-region`, the forced-colours rules.
- `src/url/analysis-state.ts:268` -- `serialize({...state, fane})` for "Se alle {n}" and "og {n} til".
- `e2e/payload.ts:110` -- `expectNoPeerFields`; the Oversikt `inUrl` holds only `ekskl`. Extend it with the exact margins. `e2e/oversikt.spec.ts`, `e2e/synthetic-documents.spec.ts`, `e2e/synthetic.ts:350-384` (in the fixture's own words, the subject is worse on 9, 10 and 11).

## Tasks & Acceptance

**Execution:**
- [ ] `src/engine/benchmark.ts`, `amounts.ts` + OC, NDC -- the capital choice and the strength predicate.
- [ ] `src/engine/format.ts` -- the whole-percent value for ranking.
- [ ] `src/analysis/oversikt-cards.ts`, `beeswarm.ts`, `peer-rows.ts` + OV, BS -- the card views, packing, nearest five, the shared strings.
- [ ] `src/messages/nb.json`, `test/messages.test.ts`, EXPERIENCE.md -- the approved keys verbatim, in one commit.
- [ ] `src/components/analysis/oversikt.tsx`, `beeswarm-chart.tsx`, `beeswarm-tooltip.tsx`, `small-card.tsx`, `oversikt-hero.tsx`, `analysis-page.tsx`.
- [ ] `e2e/oversikt.spec.ts`, `e2e/synthetic-documents.spec.ts`, `e2e/payload.ts`.
- [ ] `docs/ai-log.md` (the capital choice, the risk of reading it as annual), `docs/key-figures.md` (the card rules), `deferred-work.md` (Q9), the PRD and epics if a decision changes them.

**Acceptance Criteria:**
- Given the PR, then it states what could go wrong (which capital amount is chosen, and being read as annual), with the reasoning in `docs/ai-log.md`. It credits the review session and has a "Planning documents:" line.
- Given a final `pnpm seed` → `pnpm restore:documents`, then the four counts are reported, and lint, typecheck, test, test:db, test:ingest, check:routes and e2e (one worker) pass. No synthetic rows remain.

## Implementation Notes

Choices the spec left open, made in the implementation run (2026-11-19):

- **Top note.** "Viser gap ved full tilnærming" stays in the hero card (`keyFigures.topNote`, at the top of the card when driftsmargin is compared) and is the capital card's first slate line when it shows an amount (the same key; review fix: a second key with the same text was removed). The grid itself has none; the strength and missing-basis cards have no amount to qualify.
- **No comparison.** When the group is empty for the subject's own reason, or driftsmargin is below the floor or undefined, the beeswarm card shows one slate sentence (the hero's empty-group sentence, "For få sammenlignbare (n av 10)" or the absence's words) and no plot, list or table: P5–P95 and the nearest five need a comparison.
- **Geometry not in the Design Notes.** The swarm area is at least 48 units tall (`MIN_SWARM`), so a small spread-out group has room for the median tick and the company's line; the SVG's height is 28 + that + 24. Axis gridlines and labels sit at round values inside P5–P95 (at most 5 on the desktop, 3 on the phone), none within 28 units of an axis end, where the edge counts are. "Bedre →" sits at the right of the HTML legend row, not in the SVG, so it never meets the company's name. The name is anchored start, middle or end by where the marker lies. Coordinates reach the page rounded to 0.01 units; the packing and its tests use the exact offsets.
- **Strength.** The five figures that never qualify are an explicit set (`NEVER_STRENGTH`), although each also has no direction in the engine, so the rule holds if a direction is added; the card's value is the Plassering and its line "{own} mot {best} i beste fjerdedel" (`hero.vs`).
- **Mangler grunnlag.** The value is the row's own cell (its value, or its absence's words); the line is "For få sammenlignbare (n av 10)" for a figure below the floor, or the absence's explanation where it has one (7 and 8: the notes).
- **Payload.** Demo A's Oversikt (396 peers) went from 22,6 KB HTML / 12,4 KB RSC before the story to 585,6 KB / 266,3 KB with the first version of the beeswarm; one `<g>` carrying the dots' look and the table's styles set once on the table brought it to 267,6 KB / 147,9 KB (demo B: 22,7 / 12,5 KB → 269,2 / 148,8 KB), the same order as the Peers tab (491 KB / 260 KB).
- **Demo A and B (totals only).** Desktop: radius 3.5 units (stepped down once from 4), swarm 230.5 (A) and 218.0 (B) units, SVG 282.5 and 270. Phone: radius 2 (the minimum), swarm 168.5 and 168.0 units, SVG 220.5 and 220.

## Spec Change Log

## Review Triage Log

Review pass 1 (2026-11-19): Blind Hunter (BH), Edge Case Hunter (ECH) and Verification Gap (VG), each run by the BMAD session on the diff since `bb3f932`, with the spec, sprint status and epic context left out. ECH alone got the spec as its claims file.

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | VG, BH | The beeswarm's absent states have no test: an empty group's sentence, below the floor, and the subject's margin absent. | medium | Every `groupBeeswarm`/`beeswarmView` call in the tests passes `empty: null` and a compared comparison, and no e2e test reads `beeswarm-absent`. | patch (tests) |
| 2 | VG, BH | `capitalCard`'s not-read branch is tested only for `not_in_dataset`. | medium | "capital card states, in order" uses `not_in_dataset` and `read` only. With the gate narrowed, a failed subject would read K2. | patch (tests) |
| 3 | VG | The desktop hover tooltip is never exercised. | low | "tooltip on touch" taps the phone layout only. | patch (one e2e test) |
| 4 | VG, BH, ECH | Oversikt renders nothing, with no error, when a covered subject has no filing. | low | `analysis-page.tsx:204` guards on `subject.filing !== null`, while `peersShown` (:169) throws on the same state as a bug. | patch |
| 5 | VG, BH | `oversikt.topNote` duplicates `keyFigures.topNote`, and the e2e `getByText(nb['keyFigures.topNote'])` checks also match the capital card. | low | Same string under two keys. The checks at `e2e/oversikt.spec.ts` :93 and :179 hold only because demo A has no capital amount. | patch |
| 6 | BH | The demo A strength assertion takes its expected value from `oversiktCards` and branches on it. | medium | Lines 227–245 accept either `shown` or `empty`. That breaks the story rule that no test picks its expected value from the data. | patch (test) |
| 7 | BH | The Oversikt øre scan adds only the chosen amount, floored. | medium | "no document øre reaches Oversikt" leaves out (9), (10), (11), the working-capital total and the unfloored value. | patch (test) |
| 8 | ECH, BH | `groupBeeswarm` passes `absent: ''` for any other comparison kind, which shows a blank sentence. | low | Unreachable today (a compared driftsmargin has a beste fjerdedel), but it is a silent fallback (AGENTS.md). | patch (throw) |
| 9 | ECH | `ticks()` can return no tick when the first step that fits has every tick inside `TICK_CLEARANCE`. | low | The loop returns `out` even when it is empty, so a narrow [P5, P95] would get an axis with no labels. | patch (`continue`) |
| 10 | ECH | The compact list's React key `${name}-${selected}` repeats when two peers share a name. | low | `oversikt.tsx:86`. Names are not unique in the register. | patch (index key) |
| 11 | BH | Every mouse move sets a new state object, re-rendering about 400 dots twice and re-adding listeners. | low | `onPointerMove` calls `setOpen(pick(event))` with a fresh object each time. | patch |
| 12 | BH | Each peer's exact margin is computed twice in `beeswarmView`. | low | `withMargin` and `without` both call `exactMargin`. | patch |
| 13 | BH | 768–1023 px (12 columns, the phone plot, cards about 230 px wide) is untested. | low | The grid test covers 1280, 375 and 320 only. | patch (800 px) |
| 14 | BH | EXPERIENCE's Small card row keeps the old capital example and "each with the top note", contradicting the approved copy. | low | The row was appended to, not edited (AGENTS.md: edit the original). | patch (docs) |
| 15 | BH | AGENTS.md's description of the registry does not mention the `choice` role or "a choice sums nothing". | low | AGENTS.md: "This file must match the code". The project rule overrides the workflow's defer route for agent-context files. | patch (docs) |
| 16 | ECH | With P5 = P95, outliers and the company are drawn at the centre, with no edge column or chevron. | low | Real in `stripPosition` :323, but it needs at least 90 % of a group of 10 or more on one exact margin, and the fix needs a new clipping branch. | reject |
| 17 | ECH | A subject whose stated revenue is null reads "Ikke i kroner" in its own row. | false | Stage 1 needs a stated revenue, so such a subject has an empty group and the card shows its sentence, never the table. | reject |
| 18 | ECH | A long company name is cut off at the SVG edges. | low | Needs a name over about 45 characters on the phone layout. The fix (measuring or truncating) adds complexity, and the legend and table carry the name. | reject |
| 19 | ECH | `strengthCard` throws "a strength is compared" for omsArsverk. | false | `row()` (`key-figure-rows.ts:275`) maps a compared benchmark to a compared row in every case. omsArsverk is always absent in v1. | reject |
| 20 | BH | Plot coordinates at 0.01 units imply a peer's margin finer than 0.1 pp. | low | Public register data that the page already shows to 0.1 pp. No øre and no figure beyond this analysis's. | reject |
| 21 | BH | The strength tie rule depends on the key order of `KEY_FIGURE_ROWS`. | low | That order is figure order for every figure that can qualify (commented). Ties between 2 and 11 and between 9 and 2 are tested. | reject |
| 22 | BH | `data-selected` is written differently in the compact list and the table. | low | Cosmetic. The e2e selectors are written for each. | reject |
| 23 | BH | Counts are written with `String(n)`, not through `format.ts`. | false | The existing convention for counts (`peer-list.tsx:213, 315`). The format rule covers figures and amounts. | reject |
| 24 | Verification (BMAD session, e2e `synthetic`) | The compact list's `table` was not in a scroll container of its own. | medium | `e2e/failed-subject.spec.ts` "at 1280 px … each table has its own scroll container" failed on `oversikt` (`inRegion && regionOwn` false). AGENTS.md: tables get their own `overflow-x: auto` container. | patch: `role="region"` `.scroll-region` named by its caption |
| 25 | Review session (CI trace, PR #76) | `e2e/analysis-states.spec.ts` "a route change to another company focuses its h1" failed on CI, also on retry: the test searched from the header before demo A's streamed page was put in place, and the client navigation left demo A's Suspense segment hidden in the document (`<div hidden id="S:0">`), so `main h1` matched twice. | medium (test) | The review session read the trace from the CI artefact. React 19.3 batches the reveal of finished boundaries; Story 3.4 made demo A's Oversikt about 245 KB heavier, so the window is longer on CI. Users see nothing, since the segment is hidden. | patch (`860b874`): `companyShown` in `e2e/seed.ts` waits for the company's h1, visible, with its name. Used in that test and in four more that act right after `goto` (the 404 client navigation, the header search twice and on the same company, the tabs' width, the header texts in `e2e/peers.spec.ts`). The other analysis `goto`s wait already: assertions retry, clicks wait for visibility, and the banner is outside the segment |

## Design Notes

**Beeswarm geometry** (decision 4). The server computes two layouts. CSS shows one per breakpoint: the desktop layout from `lg` (1024 px), the phone layout below it. Between 768 and 1023 px the 7-column card is about 350–500 px wide, closer to a phone than to the desktop card. Each is an SVG with a fixed viewBox that scales to its card. Positions come from `stripPosition` over [P5, P95] of the peers' driftsmargin (not mirrored), converted to numbers in `src/analysis`.

| | Desktop | Phone |
|---|---|---|
| viewBox width | 640 (axis 16–624; edge columns at x 8 and 632) | 320 (axis 12–308; edge columns at x 6 and 314) |
| Plot width shown | ≈ 651 px at 1280 (7 of 12 columns, minus padding) | ≈ 311 px at 375, ≈ 256 px at 320 |
| Dot radius | 4 units ≈ 4.1 px at 1280 | 3.5 units ≈ 3.4 px at 375, 2.8 px at 320 |
| Gap between dots | 1 unit | 1 unit |
| Swarm max height | 240 units ≈ 244 px | 200 units ≈ 194 px at 375, 160 px at 320 |
| Above / below the swarm | 28 (company label, "Bedre →") / 24 (axis ticks) | same |
| Largest SVG height (swarm at its max) | 292 units ≈ 297 px at 1280 | 252 units ≈ 245 px at 375, 202 px at 320 |

- **Packing.** Dots are taken in exact driftsmargin order, then orgnr, on the server only. Each takes the smallest vertical offset in the sequence 0, +s, −s, +2s, … (s = 0.5 unit) at which its centre is at least 2r + gap from every placed dot. Edge columns pack the same way. The result is pure and deterministic.
- **Too tall.** If the swarm exceeds the max height, it is packed again with the radius 0.5 unit smaller, down to 2 units. If it still does not fit at 2 units, the swarm grows past the max height. No dot overlaps, none is dropped, and the SVG's height follows the swarm. The implementation report gives demo A's and B's radius and height (totals only).
- **Outside P5–P95.** A peer below P5 or above P95 is a dot in the edge column. The column's count, "‹ {k}" or "{k} ›" (C11), sits under it, and the legend line "Prikkene ved kantene ligger utenfor skalaen." appears only when a column is non-empty.
- **Company marker.** A signature circle (r 5, 2 px `navy-900` stroke, `background` halo) on the axis line under the swarm, with a 1.5 px `navy-900` line up through the swarm and the company name above it (600, white halo).
  - When the company is outside P5–P95, the marker sits at the axis end (x 16 or 624; phone 12 or 308), between the axis and the edge column. It carries the strip's outward chevron.
  - Its legend entry and the `aria-label` give the true value. The tooltip never covers it: on phone the tooltip opens above the plot, with a leader line to the dot.
- **Median and beste fjerdedel.** The median tick spans the swarm. The beste fjerdedel marker is the hollow downward triangle on the axis. Both are clamped like the company marker if they lie outside the domain (they cannot, since both lie within P5–P95).
- **Tap and hover.** A pointer or tap picks the nearest dot centre within 12 px on screen, so the 2.8 px dots at 320 px stay reachable. One tooltip is open at a time; tapping elsewhere closes it.

## Verification

**How to work:** small commits that type-check, no push. For each matrix row, the report shows the guard removed and the failing test's output. If something stops on memory, report it and do not restart.

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- green.
- `pnpm seed && pnpm test:db && pnpm test:ingest` -- green.
- `pnpm restore:documents` -- report the four counts.
- `pnpm build && pnpm check:routes && pnpm test:e2e` -- green, `workers: 1`, then 0 synthetic rows.

**Manual checks:** at 1280, 375 and 320 px: grid order, no sideways scroll, tooltip above the plot on phone, forced colours.
