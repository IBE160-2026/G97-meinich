# Epic 3 Context: See every gap in kroner and what closing it is worth

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn the three-figure slice from Epic 1 into the full analysis. Every key figure in `docs/key-figures.md`, document figures included, is computed exactly and shown with its gap in kroner. Both decompositions and the margin waterfall explain where a gap sits. Oversikt has all its cards. A fourth tab, Verdi, lets the user choose how much of a gap is closable and, if they choose, apply their own EV/EBIT multiple. Every kroner amount traces back to its formula, its filed values and its source. Without this epic the product cannot say what the peer gaps are worth, which is its central promise. Tests, not convention, keep amounts from being counted twice.

## Stories

- Story 3.1a: The engine computes every key figure (done)
- Story 3.1b: The full key-figure table (done)
- Story 3.2: The two decompositions (done)
- Story 3.3: The margin waterfall (done)
- Story 3.4: The rest of Oversikt (done)
- Story 3.5: Verdi — how much is closable (done, PR #78)
- Story 3.6: EV/EBIT — what the uplift is worth (next)
- Story 3.7: "Hvordan er dette regnet?"

## Requirements & Constraints

- **Formulas are exactly as `docs/key-figures.md` defines them.** A formula changes in the document and the code in the same commit. Undefined is never zero. Every absence has one reason from Story 2.9's closed set. The 10-peer floor applies per figure and per source.
- **The target is beste fjerdedel (T) at every share s**, and s scales the gap to it. The median is context only. Profit (1) is annual ("per år"). Capital (9), (10) and (11) are one-off amounts ("engangsbeløp"). Amounts exist only in NOK. At or beyond T a figure is a strength and has no amount.
- **Valuation with a user-set multiple.** Implied enterprise value ("Økt selskapsverdi") = round(exact annual profit uplift at the current share × m). It uses EBIT (`driftsresultat`, which comes from the API) and has no OCR dependency.
  - There is no default multiple, no placeholder value, no range and no suggestion. No code path looks up, infers or produces a multiple (test).
  - Until a multiple is entered, no value is shown. Annual profit uplift and working capital show without one.
- **Multiple bounds:** (0, 50] in steps of 0.1, entered with a decimal comma or a point. Anything else shows an inline error and no value.
- **No double counting.** Cost shares never yield kroner. No total includes a waterfall bar. Working capital released is (9)+(10) only; a part that is a strength counts as 0, and a part below the floor or not in NOK gives no total. (11) is never added to (9), (10) or their total. The Verdi cards and EV are separate amounts, never summed. Every new amount function is registered in `src/engine/amounts.ts`; the registry test finds unregistered ones via the TypeScript compiler.
- **Provenance (3.7).** Every kroner amount reaches its key figure, the filed values behind it and its source. The data-quality line is decided from the stored per-filing status and the manifest, never inferred. A degraded filing is reported as unavailable with its reason, never estimated or substituted. Every figure shows its filing year and read date.
- **Phone width:** 375 px and 320 px with no horizontal body scroll. Tables and charts sit in their own scroll container. Targets are at least 24 × 24 px.
- **Every PR** states what could go wrong, records it in `docs/ai-log.md`, and carries a "Planning documents:" line. For 3.6 that is a user-entered multiple applied to money; for 3.7, what the drill-down exposes and a reconciliation claim that is not true.

## Technical Decisions

- **One engine.** All arithmetic lives in `src/engine` as pure functions. The browser does only share and EV scaling, through the same engine function the server uses.
- **Money.** Filed amounts are `bigint` øre. Derived amounts are decimal.js values from `src/engine/decimal.ts`. Never use `Number()` for money. Rounding happens only at display, in `src/engine/format.ts`: kroner to whole kroner, ties away from zero; the multiple to at most one decimal, shown with a comma.
- **The URL is the only request state.** Only `src/url/analysis-state.ts` parses and serializes it.
  - `multippel` is written with a point and read with a point or a comma. The client field's validator imports the same bounds from the URL module.
  - An invalid value falls back to its default and raises the one invalid-settings notice.
- **Where recalculation runs.** The server computes the group, the distributions, the full-convergence amounts and the exact s_med. Share and EV are scaled in the browser.
  - The one URL hook is `useAnalysisUrl()` in `src/components/analysis/analysis-url.tsx`. Its writes are the only `history.replaceState` in `src/`, and `router.replace` is never used.
  - Every analysis link and every peer change (`peerChangeHref`) takes `andel` and `multippel` from the live URL, so both survive tab changes and peer changes.
- **Wire codec.** Exact values cross to client components only as `WireDecimal` strings from `src/engine/wire.ts`, and a `number` for money is a type error. Every other value crosses as a finished string, built by `verdiWire`/`verdiCards` in `src/analysis/verdi-view.ts`. `e2e/wire-identity.spec.ts` asserts byte-identical texts in Node and Chromium; extend it for EV.
- **Read path.** Client modules receive only strings, booleans and display structures. ESLint bans `src/server`, `postgres` and `digest.ts` in client modules, and `toFixed`, `toLocaleString` and `Intl.NumberFormat` in `src/app` and `src/components`.
- **Data time.** Filing year comes from `regnskapsperiode`, and the read date is the stored `read_at`. Dates are formatted on the server only, in `Europe/Oslo`. The engine has no clock.
- **Copy** lives in `src/messages/nb.json`. Approved copy goes in verbatim, is asserted in `test/messages.test.ts`, and any new key is added to EXPERIENCE.md in the same commit.

## UX & Interaction Patterns

- **Multiple field (3.6).** Labelled "EV/EBIT-multippel", a 90 px numeric input, empty by default. It is validated on Enter or blur, not per keystroke.
  - Error: "Skriv inn et tall større enn 0 og høyst 50, for eksempel 6 eller 6,5", tied to the field with `aria-invalid` and `aria-describedby`. The error state looks like the search field's.
  - Empty card: "Verdi beregnes når du legger inn en multippel. Peerless foreslår ingen multippel."
  - "Økt selskapsverdi" card: a visible product line built from the displayed uplift, prefixed "≈" when that product differs from the result. It rescales with the current share.
  - Announcement: "Økt selskapsverdi: {v}." once, on Enter or blur. Focus stays in the field.
  - When driftsmargin is at or beyond beste fjerdedel, the field is disabled with the profit card's strength reason.
- **Verdi (built in 3.5).** The closable share is a segmented radiogroup with the steps 0, 25, 50, 75 and 100 % and "Til medianen". There are three amount cards, never summed. Only the Verdi cards move with the share; the table, the hero and the Oversikt cards stay at full convergence.
- **Provenance drill-down (3.7).** "Hvordan er dette regnet?" sits on every kroner amount, including the hero. It opens inline under the amount, with numbered steps:
  1. The formula. The share factor appears only when the drill-down is opened from Verdi.
  2. The key figure and how beste fjerdedel was derived: quartile, n, and the PERCENTILE.INC-style linear interpolation, with a "Vis fordelingen" link.
  3. The filed values, with register field names in monospace slate, their filing year and their read date.
  4. The source and the data-quality line: "Avstemt mot innsendt årsregnskap", "Ikke avstemt – årsregnskapet er ikke i demodataene" or "Avvik ved avstemming: {felt}".

  Each calculation sits in a `surface` chip. Opening moves focus to the drill-down's heading, and "Lukk" or Esc returns focus to the trigger. The link colour is `link`.

## Cross-Story Dependencies

- **3.5 → 3.6:** EV builds on 3.5's share, `useAnalysisUrl()`, the wire set and `verdi-view.ts`. `multippel` is already parsed and kept across links; 3.6 adds its write via `replaceState`, the field and the card.
- **3.5/3.6 → 3.7:** the drill-down covers every kroner amount in the table, the hero, the Oversikt cards, the Verdi cards and EV, and shows the share factor from Verdi. Every value it shows must equal the engine's output for that URL, through the one formatter.
- **3.7 owns two deferred-work entries:** the benchmark-filing order, written in three places, and the document lines that no check covers.
- **From Epics 1 and 2:** Story 2.9's absence model and Story 2.8's peer-change provider. Document rows need the restored document dump after `pnpm seed` (`pnpm restore:documents`); until Story 5.4 they read "Ikke i demodataene" otherwise.
