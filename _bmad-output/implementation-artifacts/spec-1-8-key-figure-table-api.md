---
title: 'Story 1.8: The key-figure table with the three API figures and the margin in kroner'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: '7253ec76a44609d6dfa02bba380ed18d4beb90ff'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/key-figures.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A covered company's Nøkkeltall og gap tab is empty. 1.7 built the peer group, but nothing compares the subject with it. The driftsmargin gap, which is the product's first kroner amount, is not computed anywhere.

**Approach:**
- Read each candidate's seven API key-figure inputs in the existing candidate query.
- A pure engine function benchmarks the three API figures against the shown group (`compareFigure`, already built) and translates the driftsmargin gap to kroner.
- A server-rendered table shows the result, with an `aria-hidden` SVG strip on each row. On a phone it becomes a three-column table with expansion rows.
- ACs: issue #10 and `epics.md` Story 1.8. `epics.md` wins on a conflict.

**Decisions (agent, open to change at approval):**
- **Kroner:** `driftsmarginGap(comparison, revenueOre)` returns `{ kind: 'amount', ore: Decimal }`, the exact non-integer øre, when the subject is worse than beste fjerdedel. It returns `{ kind: 'strength' }` when own ≥ beste fjerdedel. It returns `{ kind: 'none' }` when there is no comparison. The revenue is the resolved (stated or derived) `sumDriftsinntekter` behind the subject's margin. The one rounding happens in a new `formatKronerExact(oreDecimal)` in `format.ts`. 1.9's hero will call the same two functions.
- **Payload (AD-4):** the browser gets only formatted strings and the strip's mark positions. No peer value, orgnr or filing id is sent. AD-4 allows each peer's value behind a shown figure; v1's strip draws no peer dots (DESIGN: strip = track, band, median, triangle, company), so none is needed. 1.9's beeswarm may send them.
- **Strip scale:** see the human decision on clipping below. A mirrored (lower-is-better) strip flips the scale and shows "Bedre →". None of the three API figures is lower-is-better, so mirroring is exercised by a component fixture only. Column head: "Fordeling · bedre →".
- **Desktop columns:** Nøkkeltall · {company name} · Median · Beste fjerdedel · Plassering · Fordeling · Gap i kroner. The midtre halvdel text sits under the strip in the same cell.
- **Egenkapitalandel:**
  - The Beste fjerdedel, Plassering and kroner cells show a visible "–" and carry sr-only "ikke relevant – ingen retning".
  - The midtre halvdel text reads "Midtre halvdel: x–y %", and the subline starts "Ingen retning".
- **Below floor:** one merged `<td colSpan={5}>` across Median through Gap i kroner. Its `headers` attribute names those five column ids.
- **Undefined own value:** the own cell shows "Kan ikke beregnes" with the reason (reusing the `analysis.figures.reason.*` ids). The comparison cells merge as in the below-floor case but stay empty, with sr-only "ikke relevant".
- **Non-small notice:** shown when `filing.smaaForetak === false` and at least one row's comparison is `below_floor`.
- **Phone (< md):**
  - A second table, with only one of the two displayed at a time (`hidden md:table` / `md:hidden`), so assistive technology sees one.
  - The row-name `button` lives in a small client component that receives the expansion as server-rendered children. Ids are unique across both tables.
  - The phone Gap cell shows "For få (n av 10)" below the floor and "Ingen kronebeløp" for totalkapitalrentabilitet.
- **Edge fade:** a CSS-only scroll shadow (`background-attachment: local`) in one `.scroll-region` class, which the Peers list adopts too. This closes the 1.7 deferred UX-DR37 entry.
- **Peers tab and Oversikt** are otherwise unchanged. Oversikt is 1.9.

**Decisions (human, 2026-10-16, at approval):**
- **Kroner only in NOK (closes the 1.3a/1.4 deferred entry on currency and negative assets):**
  - The driftsmargin Gap i kroner shows an amount only when the subject's filing `valuta` is `NOK`.
  - Otherwise, the cell that would hold an amount reads `keyFigures.notInKroner` ("Beløpet er ikke i kroner"), on desktop and in the phone expansion. "▲ Styrke" has no amount and is unchanged.
  - Stage 2 makes every peer's `valuta` equal to the subject's. Negative `sumEiendeler` is already undefined in the engine.
  - The check lives in the engine: `driftsmarginGap` takes `valuta` and returns `{ kind: 'not_nok' }`.
  - Tested in a component test (compared + USD) and in an e2e test on a USD company from the seed (no "kr" amount in its table).
- **ESLint display bans (closes the 1.4 deferred entry):**
  - `toFixed`, `toDP`/`toDecimalPlaces`, `toSignificantDigits` and `toLocaleString` are banned in `src/app/**` and `src/components/**`, with a lint fixture test.
  - AGENTS.md's ESLint sentence is updated in the same commit.
- **Clipped strip scale:**
  - The strip's domain is [P5, P95] of the peer values used (`percentileInc`, 0,05 and 0,95). Median, quartiles and beste fjerdedel always fall inside it.
  - A subject value outside the domain is drawn at the edge with an out-of-range marker (a small outward chevron), so one extreme peer cannot squeeze the rest.
  - If P5 = P95, every mark sits at the centre. `compared` gains `p5`/`p95` (not `min`/`max`).
  - Tested with a group holding one extreme value: its domain is not stretched to that value, and an extreme own value is clamped with the marker.

## Boundaries & Constraints

**Always:**
- Statistics, the gap, the strip domain and direction live in `src/engine` and are pure.
- Every displayed number goes through `format.ts`. All copy goes through `t()`.
- Money is `bigint` øre or Decimal, never `Number()`. Strip coordinates may use `Decimal.toNumber()`: they are geometry, not figures.
- The figures use the same shown group as the Peers tab: the pool at the URL's band, minus `ekskl`.
- No red or green, and direction is shown as an arrow or a word.
- The body never scrolls horizontally at 375 px or 320 px.

**Never:**
- The Oversikt hero, "Endre i Verdi", the closable share or document-figure rows.
- A new route, migration, dependency or `'use client'` module that imports the engine's statistics.
- Peer dots on the strip, a "Vis tallene" toggle, or tooltips.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected |
|---|---|---|
| Kroner, exact revenue | r = 351 000 / 16 714 286 kr, T = 0,091 | "1 170 000 kr"; revenue rounded to 16,7 mill. gives 1 169 000 kr and is not shown |
| Strength | own = T; own > T | "▲ Styrke", no amount |
| Totalkapitalrentabilitet | compared | kroner cell "Ingen kronebeløp" (desktop and phone expansion) |
| Below floor | 9 defined peers | own value kept; merged italic cell "For få sammenlignbare (9 av 10)"; subline keeps n and k; phone "For få (9 av 10)" |
| Undefined own | revenue 0 | "Kan ikke beregnes: omsetningen er null eller negativ"; subline keeps the count |
| Negative band bound | Q1 −0,063, Q3 0,091 | "midtre halvdel −6,3 til 9,1 %" |
| Non-small notice | smaaForetak false + any below floor / true + below floor / false + all clear | shown once / not shown / not shown |
| Mirrored strip | lower-is-better fixture | marks flipped, "Bedre →" |
| One extreme peer | 19 peers in 0–10 %, one at 400 % | domain [P5, P95], not stretched to 400 %; an own value of 400 % is clamped at the edge with the marker |
| Non-NOK subject | compared, `valuta` USD, worse than T | "Beløpet er ikke i kroner", no amount |

</frozen-after-approval>

## Code Map

- `src/server/analysis.ts`: `CANDIDATES_SQL` and `toCandidate` add the six other key-figure columns (`k.*_ore`, as in `SUBJECT_SQL`). `Candidate` gains `keyFigures: SubjectKeyFigures`. Update the AD-4 comment, which currently says "no figure but revenue".
- `src/engine/statistics.ts` / `types.ts`: `compared` gains `p5` and `p95` (`percentileInc` over the peer values used).
- `src/engine/benchmark.ts` (new, exported from `index.ts`):
  - `benchmarkApiFigures(subject: ApiInputs, peers: readonly ApiInputs[])` returns, per figure, `{ direction, comparison, gap }`, using `computeApiKeyFigures`, `API_FIGURE_DIRECTIONS` and `compareFigure`.
  - `driftsmarginGap`.
  - `stripPosition(value, comparison, direction)` returns `{ at: Decimal in [0, 1], clipped: 'low' | 'high' | null }`.
- `eslint.config.*` + `test/lint.test.ts` + a fixture under `test/fixtures/lint/`: the display bans in `src/app/**` and `src/components/**`. AGENTS.md: the ESLint sentence.
- `src/engine/format.ts`: add `formatKronerExact(oreDecimal)` and `formatPercentNumber(fraction)` ("18,4", with no unit, for the band text).
- `src/components/analysis/key-figure-table.tsx` (new, server): the top note, the non-small State block, the scroll region with the desktop table, and the phone table.
- `src/components/analysis/distribution-strip.tsx` (new, server): an SVG matching the DESIGN markers (`signature` dot with 2px `navy-900` outline, median tick, hollow triangle, `band` on the `divider` track).
- `src/components/analysis/phone-row-toggle.tsx` (new, `'use client'`): the button with `aria-expanded`/`aria-controls`, which toggles the `hidden` attribute of the expansion row. It imports no engine module.
- `src/components/analysis/analysis-page.tsx`: `ShownGroup` gains the benchmark result. `Covered` renders `KeyFigureTable` when `fane === 'nokkeltall'`.
- `src/app/globals.css`: the `.scroll-region` fade and focus style. `peer-list.tsx` uses it.
- `src/messages/nb.json`: `keyFigures.*` (caption, topNote, column heads, direction words, counts, placement, middleHalf / middleHalfNegative / middleHalfLabelled, strength, noKroner, belowFloor / belowFloorShort, notApplicable, regionLabel, nonSmall, betterRight). Reuse `fig.*` and `analysis.figures.reason.*`.
- Reuse: `StateBlock`, the scroll-region pattern of `peer-list.tsx`, and `apiInputsFromRow`.

## Tasks & Acceptance

**Execution:**
- [x] `src/engine/{benchmark,statistics,types,format}.ts` + `test/engine/benchmark.test.ts`, `format.test.ts`: the kroner reference case and the rounded-revenue contrast, strength at equality, `none` for tkr/ek and for below floor, a derived revenue, the strip domain (including min = max), mirroring, and the two band formats.
- [x] `src/server/analysis.ts` + `test/db/peers.test.ts`: the candidates carry key figures. The timing test still passes.
- [x] Components + `nb.json` + `test/analysis/key-figure-table.test.ts`: every matrix row; `headers` on the merged cell; strip `aria-hidden` with no focusable element; egenkapitalandel's sr-only cells; the three non-small cases; the phone table's `aria-expanded`/`aria-controls`; no hex red or green in the strip.
- [x] `e2e/analysis.spec.ts` on a seed subject with ≥ 10 peers (and one below the floor, at band 0 or by `ekskl`):
  - the table's values match the engine run on the seed;
  - the region's attributes;
  - no body scroll at 375 px and 320 px, plus a phone expansion toggle;
  - the HTML and RSC payload contain no peer orgnr and no peer revenue.
- [x] Docs:
  - `docs/ai-log.md`: what could go wrong with the kroner amount, its rounding and the payload;
  - `deferred-work.md`: remove the edge-fade, currency/negative-assets and ESLint-bans entries;
  - the session file and `sprint-status.yaml`.

**Acceptance Criteria:**
- Given issue #10's ACs and the matrix, when `pnpm lint && pnpm typecheck && pnpm test` run, then all pass.
- Given a seeded database, when `pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e` run, then all pass.

## Implementation Notes

- `benchmarkApiFigures(subject, peers, valuta)` takes the subject's `valuta` as a third argument: the human's NOK decision puts the check in `driftsmarginGap`, which `benchmarkApiFigures` calls. `KronerGap` is `amount | strength | not_nok | none`; tkr and ek always get `none`, and the table tells "Ingen kronebeløp" from "–" by figure and direction.
- `stripPosition`'s `clipped` names the side of the domain the value fell outside ('low' below P5), not the side it is drawn on; the chevron points outwards from the edge the dot sits on. At P5 = P95 every mark is at the centre with no chevron.
- The amount cell is "1 170 000 kr" with a slate subline "per år"; the amount has its own element for 1.9's byte-identical hero.
- The midtre halvdel messages use U+00A0 before "%"; `keyFigures.middleHalfLabelledNegative` covers a negative bound on egenkapitalandel.
- A merged cell's `headers` names the five spanned column ids and the row header's id.
- The e2e `ekskl` case runs on a small non-small subject at band 2, because `MAX_EKSKL` is 20.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | edge/blind | P5 = P95 puts an outlying own value on the median with no chevron | low | Real, but P5 = P95 needs about 90 % of ≥ 10 peers sharing one ratio value; the cells carry the true value; the frozen decision says "every mark sits at the centre" | reject |
| 2 | edge | Non-small notice is not shown for a `subject_absent` figure with < 10 peers | false | The AC ties the notice to a comparison below the floor, and the frozen decision says `below_floor`; a `subject_absent` row has no comparison | reject |
| 3 | edge/blind | The ESLint display ban misses `round`, `toNearest`, `toPrecision`, `floor` and others; AI-log item (10) says "no component can round a second time" | low | The ban is exactly the human's list and AGENTS.md states it accurately; the overclaim is in the AI-log wording only | patch (wording) |
| 4 | edge/blind | `gapCell` returns null silently for a compared driftsmargin with `gap.kind === 'none'` | low | Unreachable: `driftsmarginGap` returns `none` only when it is not compared or has no beste fjerdedel, and driftsmargin always has a direction | reject |
| 5 | edge/blind | `driftsmarginGap`'s RangeError can 500 every tab | false | A compared driftsmargin needs a `value` from `ratio`, which needs a non-null resolved `sumDriftsinntekter` (`key-figures.ts` `ratio`); the throw is unreachable | reject |
| 6 | edge/blind | The AD-4 payload scan misses the six newly read per-peer inputs (and names on Nøkkeltall) | medium | `e2e/analysis.spec.ts` scans orgnrs and `sumDriftsinntekter` only; the story adds six øre columns per peer | patch |
| 7 | edge | The desktop switch hides the region div rather than the table | false | Same effect, one table exposed to assistive technology at a time; wording only | reject |
| 8 | blind | A gap under 0,5 kr shows "0 kr per år" | low | Needs (T − r) × revenue < 0,5 kr on exact Decimals, which does not happen in everyday use, and the fix is a new rule | reject |
| 9 | blind/vgap | The USD e2e test passes whatever currency `shownGroup` passes in | medium | Verified on the seed: all 15 covered USD AS subjects have an empty pool at band 0, so `not_nok` never renders; no test covers the page wiring | patch |
| 10 | blind | AI-log item (8) says a mark position "cannot be turned back into a peer's figure" | low | Median and quartiles are shown as text beside their x positions, which fixes the scale, so P5/P95 can be recovered | patch (wording) |
| 11 | blind | `docs/key-figures.md` lacks the NOK rule, the resolved revenue, the single rounding and the P5/P95 strip domain | medium | AGENTS.md: authoritative docs change with the decision; these exist only in the spec and session file | patch |
| 12 | blind | The phone expansion needs JavaScript | low | Real only before hydration or with JS off; `<details>` cannot wrap table rows, so the fix is a redesign | reject |
| 13 | blind | A `subject_absent` row is visually blank on desktop, while the phone row shows "–" | low | The merged cell holds only sr-only text; the fix is a visible `aria-hidden` dash, as on the phone | patch |
| 14 | blind | "Fordeling · bedre →" is wrong for a no-direction row and repeats the mirrored row's label | false | DESIGN.md specifies exactly this column head and the "Bedre →" label on mirrored rows | reject |
| 15 | blind | The e2e test skips the no-direction cells and `subject_absent` against the seed | low | Covered by component tests; the e2e test checks the wiring | reject |
| 16 | blind | `FIGURES` is exported from a component file; the phone `kf-p-col-*` ids are unused | low | No caller diverges today; the unused ids are harmless | reject |
| 17 | vgap | No test checks which way the out-of-range chevron points | low | Inverting the sign keeps every test green; the fix is two assertions | patch |
| 18 | vgap | The AI log and session file cite the USD e2e test as evidence for the NOK check | low | Same root as 9; the wording overstates it | patch (with 9) |


## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test`: pass
- `pnpm db:start && pnpm db:roles && pnpm seed && pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e`: pass
