# Epic 3 Context: See every gap in kroner and what closing it is worth

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn the three-figure slice from Epic 1 into the full analysis. Every key figure in `docs/key-figures.md`, document figures included, is computed exactly and shown with its gap in kroner. Both decompositions and the margin waterfall explain where a gap sits. Oversikt gets its remaining cards. A fourth tab, Verdi, lets the user choose how much of a gap is closable and, optionally, apply an EV/EBIT multiple. Every kroner amount traces back to its formula, its filed values and its source. Without this epic the product cannot say what the peer gaps are worth, which is its central promise. No-double-counting is enforced by tests, not by convention.

## Stories

- Story 3.1a: The engine computes every key figure (done)
- Story 3.1b: The full key-figure table (done)
- Story 3.2: The two decompositions (done, PR #72)
- Story 3.3: The margin waterfall (done, PR #74)
- Story 3.4: The rest of Oversikt
- Story 3.5: Verdi — how much is closable
- Story 3.6: EV/EBIT — what the uplift is worth
- Story 3.7: "Hvordan er dette regnet?"

## Requirements & Constraints

- **Formulas are exactly `docs/key-figures.md`** (figures 1–14 and cash share). A formula changes in the document and the code in the same commit. Each figure is tested against a hand-calculated value from real filed accounts.
- **Exactness.** Identities (ROA = margin × turnover; personnel share = cost per FTE ÷ revenue per FTE) hold with `Decimal` equality, no tolerance.
- **Undefined is never zero.** Missing components are derived from stated totals, one level deep, in the engine only. Empty document cost lines are derived from the column's `sumDriftskostnad` (within ±5 kr every empty line is 0; exactly one empty line with a remainder above +5 kr takes it; otherwise undefined), and are marked derived. A derived denominator of 5 kr or less is not positive.
- **10-peer floor per figure and per source.** Below it: the subject's value, "n av 10", no comparison, no kroner. Every absence has exactly one reason from Story 2.9's closed set.
- **Direction rules.** Figures 6, 8, 13, 14 and cash share have no beste fjerdedel, Plassering or kroner. 6 is a check row. Cash share is never ranked. 7 and 8 are absent in v1 (`aarsverk` not read).
- **Kroner, target T = beste fjerdedel at every share s.** Profit (1) is annual; 9, 10, 11 are one-off ("engangsbeløp"), computed at s = 1. All are produced only when `valuta` is NOK (`not_nok` otherwise). 11 has no amount when T ≤ 0. At or beyond T: a strength, no amount. Cost shares (3–5) never yield kroner of their own.
- **Margin waterfall (Story 3.3).**
  - Common peer set *P*: peers whose `driftsresultat`, `varekostnad`, `lonnskostnad` and `annenDriftskostnad` all come from the same reconciled benchmark-year filing, with `sumDriftsinntekter` > 0. One set for every bar. Under 10 in *P*, or a subject component missing → no waterfall, count stated (test at 9 and 10).
  - The cost lines are document (OCR) figures. The fourth bar, "Avskrivninger og øvrige poster", is the residual, so margin = 1 − the four shares exactly.
  - Peer-gruppen samlet is revenue-weighted (Σnum/Σrevenue), never a mean of ratios. Bar = (Aₓ − cₓ) × subject revenue; the exact bars sum to (margin − M) × revenue (`Decimal` equality).
  - Display: the total `driftsresultat` − M × revenue is rounded once (half away from zero); start = `driftsresultat` − displayed total; bars by signed largest remainder (floor, then the leftover kroner to the largest fractions). Tests cover negative bars, ties and a residual of either sign.
  - Never scaled by the share (test over every `andel`), never added to any total.
- **When there is no waterfall** the fold-out says why: too few in *P*; "regnskapstallene til de sammenlignbare er ikke i demodataene" when *P* plus the group's peers outside the demo data reach 10; the subject's Varekostnadsandel absence words when its components are missing; its own R2 sentence when its cost lines fall short of sum driftskostnader; "Beløpet er ikke i kroner" when not NOK.
- **No double counting (FR-30), owned by 3.3, inherited by 3.4 and 3.5.** Cluster 1: no cost share yields kroner, and no total (profit uplift, EV, any card) includes a waterfall bar. Cluster 2: working capital released is (9)+(10) only, totalled only when both clear the floor; (11) is never summed with either. Both run against the engine's amount functions. Every new amount function in 3.4 and 3.5 is classified in `src/engine/amounts.ts`; the registry test finds unclassified ones itself via the TypeScript compiler.
- **Working-capital total with a strength:** today `workingCapitalReleased` gives no total unless both (9) and (10) are amounts, so a part that is a strength blocks the total. Story 3.5 decides whether a strength counts as 0 and changes the function, its test and `docs/key-figures.md` together.
- **EV** = exact annual profit uplift × a user-entered multiple. No default, placeholder, suggestion or code path that produces a multiple.
- **Provenance tells the truth.** The data-quality line comes from the stored per-filing status and the manifest, never inferred. A degraded filing is unavailable, never estimated.
- **Phone width:** 375 px and 320 px, no horizontal body scroll; tables and charts in their own scroll containers.
- **Every PR** states what could go wrong (recorded in `docs/ai-log.md`) and has a "Planning documents:" line.

## Technical Decisions

- **One engine (AD-1).** All arithmetic in `src/engine` as pure functions. The browser runs only share and EV scaling, through the same engine function the server uses.
- **Money (AD-8).** Filed amounts are `bigint` øre; derived amounts are decimal.js via `src/engine/decimal.ts`; figures as exact fractions divided once. Rounding only in `src/engine/format.ts` (% 1 dp, days and kroner whole, ties away from zero; percentile whole percent). Quartiles use `PERCENTILE.INC`.
- **Read path (AD-4).** Pages embed only this analysis's figures. `'use client'` modules receive only strings, booleans and `StripMarks`; no øre, `Decimal`, `Fraction` or `bigint` crosses.
- **URL state (AD-5, AD-6).** `src/url/analysis-state.ts` alone reads and writes `andel` (0/25/50/75/100/`median`) and `multippel` ((0, 50], step 0.1). The server resolves `median` to the exact s_med = (M−r)/(T−r), only where r < M < T. Share and EV are written with `window.history.replaceState` through one URL hook and read with `useSearchParams`. Exact values cross as `WireDecimal` strings (`src/engine/wire.ts`), with a Node-vs-browser byte-identity test.
- **Stored as filed (AD-15).** Only a reconciled column reaches the engine (`documentFigures` → `guardCurrentAssets`, R3).
- **Data time (AD-18).** Every figure shows its filing year and read date, formatted server-side in Europe/Oslo.
- **Settled in 3.1a:** the fingerprint reads only a stated `sumDriftsinntekter`; one shared fragment (`DOCUMENT_FILING_JOIN`) decides the filing a document belongs to; fingerprint bounds against an API subtotal take max(5 kr, 0.001 %). Every figure result carries its formula inputs with column and derived flag.
- **Settled in 3.1b:** `src/analysis/key-figure-rows.ts` is the one pure view builder for the table; `shownGroup` runs the document benchmark beside the API one over the group less `ekskl`; no sorting; the "Mer om dette" popover is hand-written; the `synthetic` e2e project holds a subject with 10 reconciled-document peers, the fixture for full document rows and the øre payload scan.
- **Settled in 3.2:**
  - `src/components/analysis/fold-out.tsx` is the one hand-written fold-out (no shadcn anywhere): `h3 > button`, `aria-expanded`/`aria-controls`, `aria-hidden` caret, body `hidden` on `surface-foldout`, indented 30 px desktop / 16 px phone. On desktop it is its own row right after its figure; on phone its own row group after that figure's group.
  - `src/components/analysis/factor-pair.tsx` shows each factor with own, median, strip, "Midtre halvdel" text, direction words and counts, never beste fjerdedel, Plassering or kroner.
  - A source scan forbids any multiplication of decomposition factors in `src/`, with an allow-list that starts empty.
- **Settled in 3.3:** `src/engine/waterfall.ts` builds *P*, *M*, *Aₓ*, the bars and their display rounding; `src/analysis/waterfall-view.ts` turns them into strings and bar geometry. All five waterfall figures (subject and peers) come from the one reconciled current column of the benchmark year's document, derived lines and revenue included; R2 shares one predicate with the fingerprint. The end bar and tag show the document's margin, which can read 0,1 pp from the API-based Driftsmargin row on a rounding boundary. Charts are hand-written SVG; no chart library (Recharts is out).
- **Copy** lives in `src/messages/nb.json`. Approved copy goes in verbatim, is asserted in `test/messages.test.ts`, and is never reworded by a subagent; EXPERIENCE gets new keys in the same commit.

## UX & Interaction Patterns

- **Key-figure table.** Grouped as in `docs/key-figures.md`. Cost shares sit indented under Driftsmargin in their own `<tbody>` headed `th scope="rowgroup"` "Forklarer marginavviket – summeres ikke". Their kroner cell "Se forklaring av marginen" is a link that opens the waterfall fold-out and moves focus to its heading. Phone: Story 1.8's three-column row with an expansion row.
- **Outside the demo seed.** Document rows read "Ikke i demodataene" with a "Mer om dette" popover, explained once by a State block above the table. "Margin eller kapitalbruk?" still shows (API factors); the waterfall fold-out reads "Ikke i demodataene"; the pay-level fold-out shows the not-read-in-v1 state.
- **Waterfall ("Hva forklarer marginavviket?" under Driftsmargin).**
  - Desktop: six columns from "Peer-gruppen samlet" (`median` fill) through Varekostnad, Lønn, Andre driftskostnader, Avskrivninger og øvrige poster to the company (`navy-700`). Favourable bars petrol, unfavourable amber, the residual slate whatever its sign. Each bar has signed kroner, ▲/▼ plus a word and "own mot samlet" shares; "Mot peer-gruppen samlet, ikke medianen" is added where the row and the bar disagree. Thin `connector` lines; rounded data end. The legend names all three bar kinds, the residual included.
  - It leads with the tag "Mot peer-gruppen samlet: x %, ikke beste fjerdedel", then, directly above the bars, "Dette forklarer avviket. Det er ikke et gap som skal lukkes, og det legges aldri til økt driftsresultat."
  - Empty: "Ingen forklaring av marginen: bare {n} sammenlignbare har alle kostnadslinjene (av 10 som trengs)."
  - Phone: vertical rows (name and signed value, subline, a 10 px floating bar on a shared kroner scale), then the tag and the sentence.
- **Charts.** Non-focusable SVG `role="img"` with a summary `aria-label`; a "Vis tallene"/"Skjul tallene" toggle opens a table (caption, `th scope="row"`; for the waterfall: start, four parts, end, reference); bars and markers distinguishable under `forced-colors: active`.
- **Oversikt (3.4).** 12-column grid: hero 5, beeswarm and list 7, three small cards of 4 that keep their place when empty; one column on phone. Driftsmargin values byte-identical across the compact list, "Vis tallene" and Peers. "Største kapitalgap" carries "Ikke per år, og legges ikke til resultatet."
- **Verdi (3.5, 3.6).** Segmented `radiogroup` with roving tabindex, default 50 %, "Til medianen" `aria-disabled` but focusable when unavailable. Three amount cards, never summed, are the only things that move with the share. EV: a 90 px input accepting comma or point, validated on Enter or blur. Targets at least 24 × 24 px.
- **Drill-down (3.7).** Inline: formula, quartile derivation with "Vis fordelingen", filed fields in monospace with year and read date, source. Focus to its heading; "Lukk" or Esc returns it.

## Cross-Story Dependencies

- **Build order:** 3.1a → 3.1b → 3.2 → 3.3 (all done) → 3.4 → 3.5 → 3.6 → 3.7. Story 5.4 (demo seed) follows; Epic 4's explanation row builds on 3.1a's output.
- **3.3 → 3.4 / 3.5:** 3.4's "Største kapitalgap" and 3.5's cards build on 3.3's amount registry and `workingCapitalReleased`; both inherit the FR-30 tests. Hand-written SVG and the "Vis tallene" pattern from 3.3 carry over to the beeswarm.
- **3.4 / 3.5:** 3.4 leaves out "· Endre i Verdi"; 3.5 adds it to the table, hero and cards, makes `verdi` a real tab, and makes the peer-change provider keep `andel=median`. 3.5 also gives `medianStepExists` its real implementation (until then callers pass a predicate returning false).
- **3.6** depends on 3.5's share and URL hook. **3.7** adds the hero's "Hvordan er dette regnet?" link and owns two deferred entries (benchmark-filing order in three places; document lines no check covers).
- **From Epic 2:** Story 2.9's absence model, 2.1b's prior-year columns, 2.5c's R3 guard, the v1 funnel (`group` = `pool`), and the document dump restored after `pnpm seed`; without it document rows show "Ikke i demodataene" until Story 5.4. Story 5.4 also owns the waterfall's too-few wording for n = 0 and n = 1.
