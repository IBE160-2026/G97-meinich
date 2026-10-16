# Story 1.9: Oversikt shows the biggest gap first

**Date:** 2026-10-16
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** [#11](https://github.com/IBE160-2026/G97-meinich/issues/11), Story 1.9
**Result:** branch `story/1.9-oversikt-hero` (PR to follow): commits `6cd8595` (engine), `a6c1808` (shared amount function and copy), `c83ce88` (hero, copy, CSS, component test), `72a0066` (e2e), `ed59bf3` (focus fix found by e2e), `08a5bb0` (a self-check of the tests: the amount's container sizing), the docs commit, and the review-fix commit.

## Goal

The Oversikt tab leads with the driftsmargin gap in kroner, the product's most important number, in a hero card whose amount is byte-identical to the Nøkkeltall og gap table's cell for the same URL.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-9-oversikt-hero.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human's approval of the spec (2026-10-16), given in Norwegian, with one change: when the shown group is empty because `emptyReason` is set, the hero shows the Peers tab's sentence (the one `emptyText`, shared, not copied), not "For få sammenlignbare (0 av 10)", tested with a non-calendar-year company from the seed. The approval is paraphrased here from the spec's frozen section; its verbatim text is extracted from the transcript into `docs/ai-prompts.md` by the review session.

## What came back, and what was done with it

- **Accepted:**
  - `heroContext(comparison)` in `src/engine/benchmark.ts`: the subject's side of the median and of beste fjerdedel (`above`/`at`/`below`, exact Decimals) and the non-negative distance to beste fjerdedel. Tested on EXPERIENCE.md's climax (−4,9 % against −3,2 % and 9,1 % gives "Under" and 14,0 pp), above, at and beyond beste fjerdedel, and null without a comparison or a direction.
  - `kronerAmountText(gap)` in `src/components/analysis/kroner-amount.ts`, wrapping `formatKronerExact`; the table's gap cell and the hero both call it.
  - `src/components/analysis/oversikt-hero.tsx`: a server component. A `<section aria-labelledby>` whose kicker "Største gap i kroner" is an `h3`; "Driftsmargin" with the soft tag "↑ Høyere er bedre"; the amount, "per år ved full tilnærming til beste fjerdedel", own vs beste fjerdedel, the context line in three parts, and "Se alle nøkkeltall" written by `serialize({ ...state, fane: 'nokkeltall' })`. The top note "Viser gap ved full tilnærming" shows only with a comparison. Strength, below the floor, not in NOK, undefined own value and an empty group with a reason follow the spec's matrix.
  - Copy: `hero.*` ids in `nb.json`, reusing `keyFigures.*` and `fig.driftsmargin`. The context line is `{median} · {plassering} · {best}`, with "Over/Under/På medianen på {med}" and "{pp} over/under beste fjerdedel" or "på beste fjerdedel".
  - Layout: a 12-column grid from `md` with the hero spanning 5, one column below. `.hero-amount` in `globals.css` is 52 px from `md` and 40 px below it, each capped at 12 % of the card's width (`12cqi`, the card is `@container`).
  - Tests: `test/engine/benchmark.test.ts` (heroContext), `test/analysis/oversikt-hero.test.ts` (every matrix row, hero = table for three benchmarks, the link keeps the query, no red/green/hex), and the e2e block "the Oversikt hero (Story 1.9)": search for demo A by name, Oversikt with h1 focused and the engine's amount and context line; hero = table cell at the default URL and with `ekskl`/`band=1`; the link; 375 and 320 px (hero first, the amount on one line inside its card, no body scroll); 800 px and 1280 px sizing; the non-calendar subject from the seed; no pool orgnr in the HTML or RSC payload.
- **Decided in implementation, for review:**
  - The amount's size is capped by container units, not only by the breakpoint. Just above `md` the five-of-twelve column is about 230 px wide inside its padding, too narrow for 52 px, so the amount shrinks there rather than overflow. At 1280 px it is 52 px, at 375 px 40 px, at 320 px about 31 px.
  - The top note sits above the grid, as the table's does above the table.
  - "Se alle nøkkeltall" is shown in every state, including below the floor and an undefined own value: it is navigation, not a figure.
  - An undefined own value with an empty group (`subject_no_revenue`) shows "Kan ikke beregnes: …" and the Peers tab's sentence; the empty-group reason takes precedence over the plain undefined state.
  - The e2e seed pickers for subjects without peers moved to module scope, so the hero tests reuse the non-calendar subject.
- **Corrected while running it:**
  - The focus manager. The spec said no change was expected, but the new e2e test failed: after a search, focus landed on the panel's h2, not the h1. A search opens the bare path, the server redirects to Oversikt, and `usePathname` reports that as a second change with the same orgnr, which `isTabChange` treated as a tab change. Only a change between two tabs is a tab change now (`ed59bf3`).
  - Two test strings had a plain space where the formatter writes U+00A0; the e2e context line is now built from the message ids and the engine instead of a regex.
  - A comment in `focus-manager.tsx` named the analysis path, which `test/url-module-boundary.test.ts` forbids outside the URL module; it was reworded.
- **Self-check before review (`08a5bb0`):** the container-unit cap falls back to viewport units if the card is not a size container, and at 1280, 375 and 320 px that fallback gives the same sizes, so the first tests could not tell. The e2e test now asserts the card's `container-type` and checks the amount at 800 px.

- **Review fixes** (the review step's blind, edge-case and verification-gap layers; one commit):
  - Impossible compared states in `oversikt-hero.tsx` (no beste fjerdedel, or a `none` gap) rendered silently as the undefined state or with no lead line; they now throw a fixed message, and `main` has no `null`.
  - The hero imported `DIRECTION_WORDS` from the table component; it now lives in `api-figures.tsx`, imported by both.
  - The half-krone component case only compared hero with table; it now also asserts the exact string (499,50 kr gives "500 kr"), as do the other two cases.
  - The Oversikt payload e2e test scanned peer orgnrs at band 0 only; it now also scans every non-null peer key-figure amount, as Story 1.8's test does, and covers `?ekskl=…&band=1` with that band's pool.
  - `pool[0]?.orgnr ?? ''` could build `?ekskl=&band=1`; the test now throws if demo A's pool is empty.
  - This session file: the issue link, the human's approval prompt, and these fixes credited to the review step, not to the self-check above.

## Links

- `docs/ai-log.md`: "2026-10-16 — Story 1.9: the hero amount, its rounding, the context line's words, and a focus bug".
- Spec: `_bmad-output/implementation-artifacts/spec-1-9-oversikt-hero.md`.
