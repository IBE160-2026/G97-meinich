# Epic 3 Context: See every gap in kroner and what closing it is worth

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn the three-figure slice from Epic 1 into the full analysis. Every key figure, document figures included, is computed exactly and shown with its gap in kroner. Both decompositions and the margin waterfall explain where a gap sits. Oversikt has all its cards. The Verdi tab lets the user choose how much of a gap is closable and apply their own EV/EBIT multiple. Every kroner amount, and finally every waterfall bar, can be traced back and recomputed by hand from what the page shows. Without this epic the product cannot say what the peer gaps are worth, which is its central promise. Tests, not convention, keep amounts from being counted twice. Stories 3.1a to 3.7 are done. Story 3.8 closes the gap that Story 3.7 left: the waterfall bars have no provenance.

## Stories

- Story 3.1a: The engine computes every key figure (done)
- Story 3.1b: The full key-figure table (done)
- Story 3.2: The two decompositions (done)
- Story 3.3: The margin waterfall (done)
- Story 3.4: The rest of Oversikt (done)
- Story 3.5: Verdi — how much is closable (done)
- Story 3.6: EV/EBIT — what the uplift is worth (done)
- Story 3.7: "Hvordan er dette regnet?" (done, PR #82)
- Story 3.8: Vannfallet kan regnes ut for hånd (next)

## Requirements & Constraints

- **Traceability.** Every kroner amount traces to its key figure and on to the filed values. A degraded filing is reported as unavailable with its reason, never estimated. Every figure and aggregate states its filing year and read date.
- **Waterfall bars must be recomputable by hand.** Each bar is (Aₓ − cₓ) × the subject's `sumDriftsinntekter`, where Aₓ is pooled over the common peer set P (Σ numerator / Σ revenue). The displayed bars are distributed by signed largest remainder.
  - Today "Vis tallene" shows per bar only the rounded own and pooled shares and the bar's kroner. It does not show the subject's revenue, the unrounded shares, P or the peers' numerators, so no bar can be recomputed from the page.
  - Story 3.8's spec decides what the page shows.
- **Peer document lines must never reach the page in any form.** This holds even for the waterfall. The payload scan fails on any peer document line in øre or kroner, on a document field name outside the provenance `<code data-provenance-field>` elements, and on a `cur_`/`pri_` column.
- **The waterfall is explanation, never an amount.** It is never scaled by the closable share, it is never added to profit uplift or any total, and a cost share has no kroner of its own.
  - The four exact bars sum exactly to (subject margin − M) × revenue, tested with `Decimal` equality.
  - The displayed bars sum to the displayed total, and start plus bars equals end.
  - With fewer than 10 peers in P, or a subject component missing, there is no waterfall and the reason is stated.
- **No double counting stays enforced.** Every new amount function is registered in `src/engine/amounts.ts`, and the registry test fails on a total that references a waterfall bar.
- **Phone width.** At 375 and 320 px the body never scrolls horizontally, and tables and charts sit in their own scroll container.
- **Every PR** says what could go wrong, records it in `docs/ai-log.md` and has a "Planning documents:" line.

## Technical Decisions

- **One engine.** All arithmetic is pure functions in `src/engine`. The waterfall lives in `src/engine/waterfall.ts` (`aggregateShares`, `displayWaterfall`), and its view in `src/analysis/waterfall-view.ts`.
- **Money and rounding.** Filed amounts are `bigint` øre and derived values are decimal.js values from `src/engine/decimal.ts`; `Number()` is never used for money. Rounding happens only at display, through `src/engine/format.ts`.
  - The waterfall total is rounded once, half away from zero.
  - The start bar is `driftsresultat` − the displayed total.
  - The bars are floored, then the remaining kroner go to the largest fractional parts.
- **The provenance pattern from 3.7.** The drill-down's view is built on `src/engine/provenance.ts` and `src/analysis/provenance.ts` and rendered on the server by `ProvenanceSteps`.
  - A formula line reads "≈" instead of "=" when its displayed numbers do not give its displayed result (`lineIsApproximate`).
  - Register field names reach the page only as `<code data-provenance-field>`.
  - The data-quality line is decided from stored status and the manifest, never inferred. A document amount is never "Avstemt".
- **Client boundary.** Exact values cross to the client only as `WireDecimal` strings, and everything else as finished strings. ESLint bans number formatting in `src/app` and `src/components`.
- **Copy.** All copy lives in `src/messages/nb.json`. New keys are added to EXPERIENCE.md in the same commit, and approved copy is asserted in `test/messages.test.ts`.

## UX & Interaction Patterns

- **Margin waterfall.** It runs from "Peer-gruppen samlet" (median fill) through the four bars to the company (navy-700).
  - The four bars are Varekostnad, Lønn, Andre driftskostnader and "Avskrivninger og øvrige poster". The last one is the residual, slate whatever its sign.
  - A favourable bar is petrol and an unfavourable one is amber, each with signed kroner, ▲/▼, a word and "own mot samlet" shares.
  - It leads with the tag "Mot peer-gruppen samlet: x %, ikke beste fjerdedel" and has the mandatory sentence "Dette forklarer avviket…" directly above the bars.
  - The chart is an SVG `role="img"` with a summary label, followed by a "Vis tallene" table: caption, `th scope="row"`, start, the four parts, end and the reference.
  - On phone it becomes vertical rows on a shared kroner scale.
- **Provenance drill-down.** "Hvordan er dette regnet?" is a `button` in `link` colour with `aria-expanded`/`aria-controls`, opening inline (in tables, as a full-width row).
  - It has numbered steps: Formel, Nøkkeltall, Innsendte verdier, Kilde.
  - Calculation chips sit on `surface`.
  - Opening moves focus to its heading, and "Lukk" or Esc returns focus to the trigger. Nothing is announced, and several drill-downs can be open at once.
  - Story 3.7 deliberately put no trigger on any waterfall bar. Whether 3.8 adds one, or extends "Vis tallene" instead, is the spec's decision.

## Cross-Story Dependencies

- **3.3 → 3.8.** 3.8 builds on the waterfall's engine, view, "Vis tallene" table and empty states, and must keep 3.3's exact-sum and rounding tests green.
- **3.7 → 3.8.** 3.8 reuses 3.7's provenance components, its "≈" rule and the payload scan's field allowlist. Its deferred-work entry, owned by Story 3.8, is in `deferred-work.md`.
- **Data.** Document rows need the restored document dump after `pnpm seed` (`pnpm restore:documents`); otherwise the waterfall reads "Ikke i demodataene". The e2e fixture `e2e/synthetic-documents.spec.ts` (a subject and ten peers with reconciled documents) is the committed way to reach a full waterfall.
- **Downstream.** Story 5.4 (demo seed) follows directly and owns the n = 0/1 wording of `waterfall.tooFew`.
