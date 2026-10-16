---
title: 'Story 1.9: Oversikt shows the biggest gap first'
type: 'feature'
created: '2026-10-16'
status: 'in-progress'
baseline_commit: '5d4b520852321c9f5881745b9e5b05bfd30cf8bb'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/key-figures.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Oversikt tab renders only its heading. The driftsmargin gap in kroner, computed for the Nøkkeltall og gap table in 1.8, is the product's most important number and is not the first thing a user sees.

**Approach:** A server-rendered hero card on Oversikt built from the same `group.benchmark.driftsmargin` that the table uses, with the amount produced by one shared function so the two cannot differ. ACs: issue #11 and `epics.md` Story 1.9; `epics.md` wins on a conflict.

**Decisions (agent, open to change at approval):**
- **Context line copy:** the mockup's `ov.hero.ctx` hard-codes "Over medianen", which is wrong when the subject is below it (the EXPERIENCE.md climax company is). The line is three parts: "{Over|Under|På} medianen på {med}" · "bedre enn {v} %" · "{pp} {under|over} beste fjerdedel" (or "på beste fjerdedel" at equality). Which word applies comes from the engine, not a component comparison.
- **pp:** a new pure engine function `heroContext(comparison)` returns the subject's side of the median and of beste fjerdedel and the non-negative distance to beste fjerdedel as a fraction. `formatPercentagePoints` formats it.
- **One amount function:** `kronerAmountText(gap)` (wrapping `formatKronerExact`) is called by both the table's gap cell and the hero, so byte identity holds by construction and is still tested.
- **States not named by the ACs:** not in NOK → "Beløpet er ikke i kroner" in place of the amount, with vs and context line. Own value undefined → own cell text "Kan ikke beregnes: {reason}" (reusing the table's text) and no amount, vs or context line.
- **Top note** "Viser gap ved full tilnærming" shows only when the hero has a comparison (amount, strength or not in NOK).
- **Markup:** `<section aria-labelledby>` whose kicker is an `h3`. The name "Driftsmargin" with a soft tag "↑ Høyere er bedre". "Se alle nøkkeltall" links to `serialize({ ...state, fane: 'nokkeltall' })`, keeping every setting.
- **Layout:** a 12-column grid from `md`, hero spanning 5 (the rest of the grid arrives in Epic 3); one column below `md`. The amount is `hero-amount` (52 px) from `md`; on the phone it scales down with the card, at most 40 px, so a nine-digit amount fits at 320 px without wrapping its non-breaking spaces.

**Decisions (human, 2026-10-16, at approval):**
- **An empty group says why, as on Peers:** when the shown group is empty because `emptyReason` is set (`subject_non_calendar`, `subject_no_revenue`), the hero shows the same sentence as the Peers tab (the one `emptyText` in `peer-list.tsx`, shared, not copied), not "For få sammenlignbare (0 av 10)". The own value stays (or "Kan ikke beregnes: …" when undefined); no amount, vs, context line or top note. Tested with a non-calendar-year subject from the seed, in a component test and in e2e.

## Boundaries & Constraints

**Always:**
- The hero reads the same shown group and benchmark as the table for the same URL; nothing is recomputed in the component.
- Every number through `format.ts`, every word through `t()`. No peer value, orgnr or filing id in the payload (AD-4).
- Money stays Decimal/`bigint` øre; one rounding at display (AD-8).
- No body scroll at 375 px and 320 px.

**Never:**
- The "Hvordan er dette regnet?" link, "· Endre i Verdi", the beeswarm or small cards (Epic 3).
- A new route, migration, dependency, or `'use client'` module.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Gap | compared, own < beste fjerdedel, NOK | kicker, name + tag, amount = table cell, "per år ved full tilnærming til beste fjerdedel", "{own} mot {best} i beste fjerdedel", context line, top note, link |
| Below median | own −4,9 %, median −3,2 %, best 9,1 % | "Under medianen på −3,2 % · bedre enn … · 14,0 pp under beste fjerdedel" |
| Strength | own ≥ beste fjerdedel | "▲ Styrke", vs, context line ("… over beste fjerdedel" / "på beste fjerdedel"), the no-gap sentence; no amount |
| Below floor | 9 peers | own value, "For få sammenlignbare (9 av 10)"; no amount, vs, context or top note |
| Not NOK | compared, USD, worse | "Beløpet er ikke i kroner"; vs and context line |
| Undefined own | revenue 0 | "Kan ikke beregnes: omsetningen er null eller negativ"; nothing else |
| Empty group, reason set | non-calendar year (`subject_non_calendar`) | own value + the Peers tab's `peers.nonCalendar` sentence; not "(0 av 10)"; no amount |
| Empty group, no revenue | `subject_no_revenue` | "Kan ikke beregnes: …" + the Peers tab's `peers.noRevenue` sentence |

</frozen-after-approval>

## Code Map

- `src/components/analysis/analysis-page.tsx` — `Covered`: render `<OversiktHero>` when `view.fane === 'oversikt'` (remove the "Story 1.9" comment); pass `group.benchmark.driftsmargin`, `state`.
- `src/components/analysis/key-figure-table.tsx` — `gapCell` uses the new `kronerAmountText`; `undefinedText` and `FIGURES` come from `./api-figures`.
- `src/engine/benchmark.ts` — add `heroContext`; `KronerGap`, `driftsmarginGap` unchanged.
- `src/engine/format.ts` — `formatKronerExact`, `formatPercent`, `formatPercentagePoints`, `formatWholePercent` exist; no change expected.
- `src/messages/nb.json` — new `hero.*` ids (kicker, perYear, vs, ctx parts, noGap, link). Reuse `keyFigures.dir.higher`, `keyFigures.strength`, `keyFigures.belowFloor`, `keyFigures.notInKroner`, `keyFigures.topNote`, `keyFigures.placement`, `fig.driftsmargin`.
- `src/app/globals.css` — `hero-amount` sizes if not already tokens (DESIGN.md typography `hero-amount`, `figure-pair`).
- `e2e/analysis.spec.ts` — reuse `expectedBenchmark(A.orgnr, 0)`, `A`, `region`, `cell`; search helpers as in `e2e/search.spec.ts` (`combobox`, option list).
- Focus on `h1` after a search is `focus-manager.tsx`'s existing route-change behaviour; no change expected.

## Tasks & Acceptance

**Execution:**
- [ ] `src/engine/benchmark.ts` + `test/engine/benchmark.test.ts` — `heroContext` for below/at/above median and beste fjerdedel, the −4,9/−3,2/9,1 case giving 14,0 pp.
- [ ] `src/components/analysis/{oversikt-hero,key-figure-table}.tsx`, `analysis-page.tsx`, `nb.json`, `globals.css` + `test/analysis/oversikt-hero.test.ts` — every matrix row; the hero amount string equals the table's gap cell for the same benchmark; the link keeps the query; no hex red or green.
- [ ] `e2e/analysis.spec.ts` — search for demo A by name, choose it, land on `/analyse/{orgnr}/oversikt` with `h1` focused, hero amount = engine output; the hero amount equals the Nøkkeltall table cell for the same URL; 375 px and 320 px: hero first, no body scroll, the amount not overflowing its card; "Se alle nøkkeltall" opens the table.
- [ ] Docs — `docs/ai-log.md` (what could go wrong: hero ≠ table, rounding twice, a subject below median told "over"); session file; `sprint-status.yaml`.

**Acceptance Criteria:**
- Given issue #11's ACs and the matrix, when `pnpm lint && pnpm typecheck && pnpm test` run, then all pass.
- Given a seeded database, when `pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e` run, then all pass.
- Given the work, when it is committed, then it lands as several logical commits (engine, UI and copy, e2e, review fixes, docs), never one commit for the story.

## Implementation Notes

- **Focus after a search needed a change** (Code Map assumed none): the redirect from the bare path to `/oversikt` reached `FocusManager` as a same-orgnr change and was treated as a tab change, focusing the h2. Only a change between two tabs is a tab change now (`focus-manager.tsx`).
- **The amount's size is capped by container units** (`.hero-amount`: `min(40px, 12cqi)`, `min(52px, 12cqi)` from `md`; the card is `@container`), so it fits the narrow five-of-twelve column just above `md` as well as 320 px. 52 px at 1280 px.
- `kronerAmountText` lives in `src/components/analysis/kroner-amount.ts`; `emptyText` (peer-list) and `DIRECTION_WORDS` (key-figure-table) are exported for the hero.
- The top note sits above the grid; "Se alle nøkkeltall" shows in every state.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` — pass
- `pnpm db:start && pnpm db:roles && pnpm seed && pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e` — pass
