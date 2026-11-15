# Epic 3 Context: See every gap in kroner and what closing it is worth

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn the three-figure slice from Epic 1 into the full analysis. Every key figure in `docs/key-figures.md`, document figures included, is computed exactly and shown with its gap in kroner. Both decompositions and the margin waterfall explain where a gap sits. Oversikt gets its remaining cards. A fourth tab, Verdi, lets the user choose how much of a gap is closable and, optionally, apply an EV/EBIT multiple. Every kroner amount traces back to its formula, its filed values and its source. Without this epic the product cannot say what the peer gaps are worth, and that is its central promise. No-double-counting is enforced by tests, not by convention.

## Stories

- Story 3.1a: The engine computes every key figure
- Story 3.1b: The full key-figure table
- Story 3.2: The two decompositions
- Story 3.3: The margin waterfall
- Story 3.4: The rest of Oversikt
- Story 3.5: Verdi — how much is closable
- Story 3.6: EV/EBIT — what the uplift is worth
- Story 3.7: "Hvordan er dette regnet?"

## Requirements & Constraints

- **Formulas are exactly `docs/key-figures.md`.** That covers figures 1–14 and cash share. A formula changes in that document and in the code in the same commit. Each figure has a test against a hand-calculated value from real filed accounts. The reference cases include negative equity, zero revenue and a missing component. A non-calendar year is excluded by funnel stage 2, never adjusted.
- **Identities hold exactly.** ROA = margin × (`sumDriftsinntekter`/`sumEiendeler`), and personnel share = cost per FTE ÷ revenue per FTE. Both are asserted with `Decimal` equality and no tolerance, on the reference cases and on generated øre inputs.
- **Undefined is never zero.** A missing component is derived from stated totals, one level deep and in the engine only. It is checked before the denominator's sign. A derived denominator of 5 kr or less counts as not positive, and that applies to a derived document `sumDriftsinntekter` too.
- **Empty document cost lines** are derived from the column's stated `sumDriftskostnad` (remainder = total − stated lines): within ±5 kr every empty line is 0; exactly one empty line with a remainder above +5 kr is that remainder; otherwise each empty line is undefined. Every derived line is marked derived, and a denominator with a derived part is a derived denominator. Balance lines, `salgsinntekt` and `driftsresultat` are never derived.
- **The 10-peer floor applies per figure and per source.** Below it the subject's own value stays, the row reads "n av 10", and there is no comparison and no kroner.
- **Every absence has exactly one reason**, from the closed set in Story 2.9. The basis order is decided in `document-inputs.ts`. R3 applies: a current `kundefordringer` or `bankinnskudd` above the API `sumOmloepsmidler` + max(5 kr, 0.001 %) is absent as `exceeds_api_subtotal`, so figures 9 and 11 are undefined for that company.
- **Direction rules:**
  - Figures 6, 8, 13, 14 and cash share have no beste fjerdedel, no Plassering and no kroner.
  - Total cost share (6) is a check row.
  - Cash share is a diagnostic. It is never ranked or sorted, and it is never eligible for Største styrke.
  - Figures 7 and 8 are absent in v1 because `aarsverk` is not read.
  - Revenue growth (14) uses the prior-year column of the same document. It is undefined (component missing) when that column is missing or did not reconcile, and undefined as a line not read safely when the prior column's `sum_driftsinntekter` fails the register check. A prior column with no register filing to check against (`not_evaluable`) is used, and that path is unguarded.
- **Kroner, with target T = beste fjerdedel at every share s:**
  - Profit (1): (T−r)·`sumDriftsinntekter`·s. This amount is annual, and it is produced only when `valuta` is NOK.
  - Figure 9: (r−T)/365·`salgsinntekt`·s.
  - Figure 10: (T−r)/365·(`varekostnad`+`annenDriftskostnad`)·s.
  - Figure 11: ((`sumEiendeler`−`bankinnskudd`) − `sumDriftsinntekter`/T)·s.
  - Figures 9–11 are one-off amounts ("engangsbeløp"), computed at s = 1 in the engine from the subject's exact figure, and produced only when `valuta` is NOK (otherwise the reason `not_nok`, as for profit).
  - Figure 11 has no amount when T is zero or negative (`target_not_positive`).
  - At or beyond T there is no amount, only a strength.
  - Cost shares (3–5) never yield kroner of their own.
- **No double counting (FR-30), in two clusters:**
  - Cluster 1: no total includes a waterfall bar or a cost-share amount.
  - Cluster 2: working capital released is (9)+(10) only. A total is shown only when both clear the floor. Figure 11 is never summed with either.
  - Both clusters are tested against the engine's amount functions.
- **EV** = exact annual profit uplift × a user-entered multiple, based on API `driftsresultat`. There is no default, no placeholder and no suggestion, and no code path that produces a multiple.
- **Provenance tells the truth.** The data-quality line comes from the stored per-filing status and the manifest, never inferred. A degraded filing is reported unavailable, never estimated.
- **Phone width:** layouts work at 375 px and 320 px, and the body never scrolls horizontally. Tables and charts get their own scroll containers.
- **Every PR** states what could go wrong, which `docs/ai-log.md` records. It also has a "Planning documents:" line.

## Technical Decisions

- **One engine (AD-1).** All arithmetic lives in `src/engine`, as pure functions. The browser runs only share and EV scaling, through the same engine function the server uses.
- **Money (AD-8).**
  - Filed amounts are `bigint` øre. Derived amounts are decimal.js through `src/engine/decimal.ts`.
  - Database strings are parsed with `parseOre`/`parseDecimal`. A `number` never holds money.
  - Rounding happens once, in `src/engine/format.ts`: % to 1 dp, days whole, kroner whole, ties away from zero. The percentile is shown in whole percent.
  - Quartiles and the median use `PERCENTILE.INC` with linear interpolation. The strip spans P5–P95 and is mirrored for lower-is-better figures.
- **Margin waterfall.**
  - The common peer set *P* is the peers with all four lines from the same reconciled benchmark filing and revenue > 0. It needs at least 10.
  - The peer reference is revenue-weighted (Σnum/Σrevenue), never a mean of ratios. The fourth bar, "Avskrivninger og øvrige poster", is the residual.
  - Exact bars sum to (margin − M)·revenue. The total is rounded once. The start is `driftsresultat` − the displayed total.
  - Bars are rounded by signed largest remainder: floor each bar, then hand out the remaining kroner by largest fraction.
  - The waterfall is never scaled by the share.
- **Decompositions.** The factors are compared each against its own median and never multiplied. Total asset turnover is a derived factor with no beste fjerdedel, no Plassering and no kroner, and it is never labelled as figure 11.
- **Read path (AD-4).** Server-rendered pages embed only this analysis's figures, including every peer value behind each shown figure.
- **URL state (AD-5).** `src/url/analysis-state.ts` is the only reader and writer of `andel` (0, 25, 50, 75, 100 or `median`) and `multippel` ((0, 50], step 0.1). The server resolves `median` to the exact s_med = (M−r)/(T−r), which exists only where r < M < T. The amounts use the exact s_med, never the rounded label. The `medianStepExists` placeholder (always false today) gets its real implementation in 3.5.
- **Recalculation (AD-6).**
  - Share and EV are written via `window.history.replaceState` through one URL hook, never `router.replace`. They are read with `useSearchParams`.
  - Every link and navigation keeps `andel` and `multippel`.
  - Exact values cross the server/client boundary through `src/engine/wire.ts` as `WireDecimal` strings.
  - A test checks that Node and a real browser give byte-identical output from the same wire values.
- **Stored as filed (AD-15).** Only a reconciled column's figures reach the engine, via `documentFigures` → `guardCurrentAssets`. The status and absence reasons are as defined in Story 2.9.
- **Data time (AD-18).** Every figure shows its filing year and its read date. Dates are formatted server-side in Europe/Oslo. The engine has no clock.
- **Settled in 3.1a (keep them):**
  - The fingerprint reads only a stated `sumDriftsinntekter`, never a derived one.
  - The filing a document belongs to has one source: `pnpm derive` and the request path join it through one shared fragment, so R3 uses the same `sumOmloepsmidler` in both.
  - A fingerprint bound computed from an API subtotal takes the between-sources rule, max(5 kr, 0.001 %); bounds within one document keep 5 kr, which lives once in the engine.
- **Provenance inputs exist.** Every figure result carries each formula input with its column and whether it was derived, so the drill-down can show derived numerators as well as derived denominators.
- **Copy** lives in `src/messages/nb.json` under `fig.*` and Story 2.9's absence copy. No hard-coded strings.

## UX & Interaction Patterns

- **Key-figure table.**
  - Rows are grouped as in `docs/key-figures.md`.
  - Cost shares sit indented under Driftsmargin, in their own `<tbody>` with the `th scope="rowgroup"` heading "Forklarer marginavviket – summeres ikke". Their kroner cell reads "Se forklaring av marginen", which becomes a link to the waterfall in 3.3.
  - Rows with no direction show "Midtre halvdel" and "Ingen retning".
  - Figures 9–11 show "engangsbeløp", "▲ Styrke", or "Ingen kronebeløp".
  - On phone the table follows Story 1.8's pattern: three columns and a row button that opens an expansion row.
- **Outside the demo seed.** Document rows read "Ikke i demodataene" with a "Mer om dette" Popover button. One State block above the table explains it, and every such cell points to it with `aria-describedby`.
- **Subject whose own filing failed (FR-71).** Document rows read "Regnskapet for {år} kunne ikke leses sikkert". The API rows keep their full comparison.
- **Fold-outs.** A shadcn `Collapsible`, closed by default, with a `button` trigger, `aria-expanded`/`aria-controls` and an `aria-hidden` caret. The body sits on `surface-foldout`, indented 30 px. On phone it opens full width below its row group.
- **Waterfall.**
  - Colours: the start bar uses the median fill, the end bar navy-700, favourable bars petrol, unfavourable bars amber, and the residual slate. Each bar has a sign, ▲/▼ and a word.
  - It carries a reference tag and the sentence that the bars explain the gap and are never added to profit.
- **Charts.** SVG `role="img"`, not focusable, with a summary `aria-label`. A "Vis tallene" toggle opens a table, and charts work under `forced-colors`.
- **Oversikt layout.** A 12-column grid: hero 5, beeswarm and list 7, three small cards of 4. The explanation row is left for Epic 4. On phone it is one column.
- **Oversikt content.**
  - The beeswarm has a hover/tap tooltip, which is a convenience only.
  - The compact list shows the five nearest peers.
  - Driftsmargin values are byte-identical across the compact list, the "Vis tallene" table and the Peers list.
- **Oversikt cards.** Each card keeps its place in the grid when empty.
  - Største kapitalgap carries "Ikke per år, og legges ikke til resultatet."
  - Største styrke shows the highest Plassering, with ties broken by figure number.
  - Mangler grunnlag shows the first figure without a comparison, plus "og {n} til".
- **Verdi.**
  - The share control is a segmented `radiogroup` with roving tabindex: 0, 25, 50, 75 and 100 %, plus "Til medianen". It defaults to 50 %. When disabled, the median step is `aria-disabled` but still focusable, with its reason.
  - Three amount cards are never summed. Only they move with the share. The table and the Oversikt cards stay at full convergence.
  - Each change is announced once, and focus stays on the step.
  - Every target is at least 24 × 24 px.
- **EV field.** A 90 px numeric input that accepts a comma or a point. It is validated on Enter or blur, with an inline error using `aria-invalid` and `aria-describedby`. A "≈" prefix appears when the displayed product differs from the result.
- **Drill-down.** It shows the formula, the quartile derivation (n and method) with "Vis fordelingen", the filed fields in monospace with their year and read date, and the source. Focus moves to its heading. "Lukk" or Esc returns focus.

## Cross-Story Dependencies

- **Build order:** 3.1a (done) → 3.1b → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7. Epic 3 starts after Epic 2 and Story 5.2. Story 5.4 (the demo seed) follows directly, and Epic 4's explanation row and its digest build on 3.1a's engine output.
- **3.1a** (done) supplies every figure and amount that 3.1b–3.7 render. **3.3** turns 3.1b's cost-share cells into links, and it holds the FR-30 tests that 3.5 inherits.
- **3.4's cards and 3.5's note.** 3.4 leaves out "· Endre i Verdi". 3.5 adds that link to the table, the hero and the cards, makes `verdi` a real tab, and fixes the peer-change provider so it keeps `andel=median` (B6).
- **3.6** depends on 3.5's share and on the URL hook. **3.7** adds the hero's "Hvordan er dette regnet?" link, which Story 1.9 left out.
- **From Epic 2** this epic relies on:
  - Story 2.9's absence model.
  - Story 2.1b's prior-year columns.
  - Story 2.5c's R3 guard.
  - The v1 funnel, in which `group` = `pool` and stages 4 and 5 are off.
  - The document dump restored locally after `pnpm seed`. Without it, document rows show "Ikke i demodataene" until Story 5.4.
