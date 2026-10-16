# Story 1.8: The key-figure table with the three API figures and the margin in kroner

**Date:** 2026-10-16
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #10, Story 1.8
**Result:** branch `story/1.8-key-figure-table-api` (PR to follow).

## Goal

The Nøkkeltall og gap tab: the three API figures against the shown peer group, each with own value, median, beste fjerdedel, Plassering, a distribution strip and the gap in kroner. The driftsmargin gap is the product's first kroner amount.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-8-key-figure-table-api.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human's decisions recorded in the spec's frozen section (2026-10-16): kroner only in NOK (`not_nok` from the engine), the display rounding bans in ESLint with AGENTS.md updated, and a strip domain of [P5, P95] with an out-of-range marker.

## What came back, and what was done with it

- **Accepted:**
  - `src/engine/benchmark.ts`:
    - `benchmarkApiFigures(subject, peers, valuta)`: per figure, its direction, the comparison and the kroner gap.
    - `driftsmarginGap(comparison, revenueOre, valuta)`: `amount` (exact non-integer øre), `strength`, `not_nok` or `none`.
    - `stripPosition(value, comparison, direction)`: `{ at, clipped }` on [P5, P95], mirrored where lower is better, the centre when P5 = P95.
  - Engine and formatter: `compared` gains `p5`/`p95`. `format.ts` gains `formatKronerExact` (decimal øre → whole kroner, the one rounding) and `formatPercentNumber` (a band bound, no unit).
  - The candidate read: `CANDIDATES_SQL` reads each candidate's seven key-figure columns as `Candidate.keyFigures`; the AD-4 comment is rewritten.
  - The page: `ShownGroup` carries the benchmark, computed on the same group the Peers tab lists (pool at the band, minus `ekskl`). The Nøkkeltall tab renders `KeyFigureTable`.
  - Components:
    - `key-figure-table.tsx`: the top note, the non-small State block, a desktop table in a `.scroll-region`, and a phone table. Every row state from the matrix is covered, and a merged cell's `headers` names the five spanned columns and the row header.
    - `distribution-strip.tsx`: `aria-hidden`, `focusable="false"`, theme tokens only.
    - `phone-row-toggle.tsx`: `'use client'`, `aria-expanded`/`aria-controls`, toggles `hidden`, imports no engine module.
  - `.scroll-region` in `globals.css`: overflow, focus style and a CSS-only edge fade (`background-attachment: local`). The Peers list now uses it too.
  - ESLint bans `toFixed`, `toDecimalPlaces`/`toDP`, `toSignificantDigits` and `toLocaleString` in `src/app/**` and `src/components/**`. A third block covers a `*format*` file there, which gets both lists. AGENTS.md's sentence is updated, and there is a lint fixture test.
  - Tests:
    - `test/engine/benchmark.test.ts`: the reference case and the rounded-revenue contrast, a derived revenue, strength at equality, `not_nok`, `none` for tkr/ek, below the floor and an undefined own value, per-figure gating, and the strip domain with one extreme peer, mirroring, and P5 = P95.
    - `format.test.ts` and `statistics.test.ts` (P5/P95).
    - `test/analysis/key-figure-table.test.ts`: every matrix row, `headers`, the sr-only cells, the three non-small cases, the strip's markup, the phone buttons, unique ids, and the CSS rule.
    - `test/db/peers.test.ts`: the candidates carry their key figures, and demo A's three figures are compared.
    - The e2e block "the key-figure table (Story 1.8)":
      - demo A's cells against the engine run on the seed CSVs;
      - the region's attributes and focus style;
      - a non-small subject below the floor at band 0 (merged cell, notice) and compared at band 2;
      - `ekskl` below the floor;
      - a USD subject with no kroner amount;
      - the phone toggle and no sideways scroll at 375 and 320 px;
      - no pool orgnr or pool revenue in the HTML or the RSC payload.
- **Decided in implementation, for review:**
  - `benchmarkApiFigures` takes a third argument, `valuta`, beyond the Code Map's two. The human's NOK decision puts the currency check in `driftsmarginGap`, and `benchmarkApiFigures` computes that gap.
  - `KronerGap` has four kinds. Totalkapitalrentabilitet and egenkapitalandel get `none`; the table tells "Ingen kronebeløp" (tkr) from "–" (ek, no direction) by figure and direction.
  - The amount cell shows "1 170 000 kr" with a slate subline "per år" (DESIGN.md: "slate subline for unit"). The amount is in its own element, so 1.9's hero can match it byte for byte.
  - The four midtre halvdel messages put U+00A0 before "%", as the formatter does elsewhere. A labelled negative variant (`middleHalfLabelledNegative`) was added for egenkapitalandel, which can have a negative lower bound (negative equity).
  - `stripPosition`'s `clipped` names the side of the domain the value fell outside, not the side it is drawn on. The chevron points outwards from whichever edge the dot is on.
  - When P5 = P95, every mark sits at the centre, with no chevron, even for an own value that differs. This follows the spec's words, "every mark sits at the centre".
  - The phone expansion for a below-floor row shows "For få sammenlignbare (n av 10)" as a line of its own above the direction and count.
  - The e2e `ekskl` case uses a small non-small subject at band 2, because the URL module keeps at most 20 `ekskl` items (`MAX_EKSKL`), and demo A has 391 peers.
- **Corrected while running it:**
  - The first lint config spread the rounding list with `slice(1)`, which kept the severity string and duplicated the Intl entry. ESLint refused the config, and `test/lint.test.ts` caught it. The restrictions are now named constants.
  - The first e2e `ekskl` test excluded 382 of demo A's peers. The URL module drops everything past 20, so the page stayed compared, and the test failed. It was rewritten as described above.
  - The phone table split "Totalkapitalrentabilitet" mid-word at 320 px. The label now uses `hyphens: auto` (the page is `lang="nb"`).

## Review fixes (2026-10-16)

From the coordinator's review of the implementation:
- The AD-4 payload e2e test now scans the Nøkkeltall page for every non-null key-figure amount of every pool peer (amounts under six digits skipped as collision-prone), not only revenue.
- The page's group-and-benchmark assembly moved out of the component into the pure `src/analysis/shown-group.ts`, with `test/analysis/shown-group.test.ts`: a compared USD subject worse than beste fjerdedel gets `not_nok`, the same in NOK an amount. The USD e2e test was found vacuous for this (every covered USD AS in the seed has an empty pool); its comment now says it only checks that no "kr" amount is written.
- The AI-log entry was reworded on three points: what verifies the NOK check; that strip positions do let P5/P95 be recovered from the median and quartile texts (no single peer's figure); and that the ESLint ban covers the four listed methods, not Decimal's `round`/`toNearest`/`toPrecision` or `Math.round`.
- `docs/key-figures.md` now records the NOK condition, the resolved revenue and the single rounding in "From gap to kroner", and the strip's [P5, P95] domain under the distribution rules.
- A desktop row whose own value is undefined showed five blank columns; the merged cell now shows a visible aria-hidden "–" beside the sr-only "ikke relevant", as the phone row does.
- A test now checks that the out-of-range chevron points outwards at both edges.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-1-8-key-figure-table-api.md`
- AI log: "Story 1.8: the first kroner amount, its rounding, and what the key-figure page sends"
- Documents updated:
  - `AGENTS.md` (the ESLint sentence);
  - `deferred-work.md` (the edge-fade, currency/negative-assets and ESLint-bans entries removed);
  - `sprint-status.yaml` (1.8 → review).
