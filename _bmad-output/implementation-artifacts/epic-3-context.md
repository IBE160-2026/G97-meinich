# Epic 3 Context: See every gap in kroner and what closing it is worth

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn the three-figure slice from Epic 1 into the full analysis. Every key figure in `docs/key-figures.md`, document figures included, is computed exactly and shown with its gap in kroner. Both decompositions and the margin waterfall explain where a gap sits. Oversikt has all its cards. A fourth tab, Verdi, lets the user choose how much of a gap is closable and, optionally, apply an EV/EBIT multiple. Every kroner amount traces back to its formula, its filed values and its source. Without this epic the product cannot say what the peer gaps are worth, which is its central promise. No-double-counting is enforced by tests, not by convention.

## Stories

- Story 3.1a: The engine computes every key figure (done)
- Story 3.1b: The full key-figure table (done)
- Story 3.2: The two decompositions (done)
- Story 3.3: The margin waterfall (done)
- Story 3.4: The rest of Oversikt (done, PR #76)
- Story 3.5: Verdi — how much is closable (next)
- Story 3.6: EV/EBIT — what the uplift is worth
- Story 3.7: "Hvordan er dette regnet?"

## Requirements & Constraints

- **Formulas are exactly `docs/key-figures.md`.** A formula changes in the document and the code in the same commit. Undefined is never zero; every absence has one reason from Story 2.9's closed set; the 10-peer floor applies per figure and per source.
- **Target is beste fjerdedel (T) at every share s.** s scales the gap: s = 0 gives no kroner, s = 1 is full convergence. The median is context and a marker on the control, never the target.
  - Profit (1): (T − r) × `sumDriftsinntekter` × s, annual ("per år"). Capital (9) receivable days, (10) payable days, (11) operating-asset turnover: one-off ("engangsbeløp"), each × s. All only when `valuta` is NOK (`not_nok` otherwise). (11) has no amount when T ≤ 0. At or beyond T: a strength, no amount.
  - EV = exact annual profit uplift at the current share × a user-entered multiple; no default, placeholder, suggestion or code path that produces a multiple.
- **"Til medianen" step.** s_med = (M − r)/(T − r) on driftsmargin, computed exactly by the server, shown in whole percent; amounts use the exact s_med, never the rounded label (test: amounts at the median step differ from those at the rounded share). Exists only where r < M < T. It is defined on driftsmargin only and labelled so.
- **No double counting (FR-30).** Cost shares (3–5) never yield kroner; no total adds a waterfall bar. Working capital released = (9)+(10) only; (11) is shown beside it, never added (its base already contains `kundefordringer`). The three Verdi cards (profit, working capital, operating-asset capital), plus EV later, are four amounts, never one total — a test asserts no displayed total adds any two cards. Every new amount function is classified in `src/engine/amounts.ts`; the registry test finds unclassified ones via the TypeScript compiler.
- **Open decision owned by 3.5:** `workingCapitalReleased` gives no total unless both (9) and (10) are amounts, so a part that is a strength blocks the total although the docs tie the total to both parts clearing the floor. 3.5 decides whether a strength counts as 0 or is left out, and changes the function, its cluster-2 test and `docs/key-figures.md` together (deferred-work entry).
- **Other deferred work owned by 3.5:** `medianStepExists` gets its real implementation (callers pass a predicate returning false until now); and the peer-change provider must keep `andel=median` across exclude/restore/band change by parsing its base URL with the same median-step context as the server (Epic 2 retro B6; a test fails if it falls back to 50 %).
- **Invalid `andel`** (including `median` where no step exists) falls back to 50 % with the one invalid-settings notice.
- **Phone width:** 375 px and 320 px, no horizontal body scroll; targets at least 24 × 24 px.
- **Every PR** states what could go wrong (for 3.5: in-browser scaling of money and the wire codec), recorded in `docs/ai-log.md`, and carries a "Planning documents:" line.

## Technical Decisions

- **One engine (AD-1).** All arithmetic in `src/engine` as pure functions. The browser runs only share and EV scaling, through the same engine function the server uses.
- **Money (AD-8).** Filed amounts are `bigint` øre; derived amounts are decimal.js through `src/engine/decimal.ts`; never `Number()` for money. Rounding only at display in `src/engine/format.ts` (kroner whole, ties away from zero; "Til medianen" whole percent; multiple up to one decimal with comma).
- **URL is the only request state (AD-5).** `src/url/analysis-state.ts` alone parses and serializes; `fane` includes `verdi`. `andel` ∈ {0, 25, 50, 75, 100, `median`}, default 50 and omitted when default; the server resolves `median` to exact s_med, and where none exists the token is invalid. `multippel` in (0, 50] step 0.1, written with a point, read with point or comma; client validators import the same bounds. `parse` reads `band` before `ekskl`.
- **Where recalculation runs (AD-6).** The server computes the group, distributions, full-convergence amounts and exact s_med. Share and EV are scaled in the browser and written with `window.history.replaceState` (never `router.replace`) through one URL hook that serializes a single state object; client components read them with `useSearchParams`. Every later link and navigation builds on the current URL, so `andel` and `multippel` survive tab changes and peer changes. Peer changes stay `router.push` via the `[orgnr]` layout's provider.
- **Wire codec (AD-6), new in 3.5.** `src/engine/wire.ts` (does not exist yet) is the one codec for exact values sent to the browser: full-precision decimal strings, never pre-rounded, never `number`, under a branded `WireDecimal` type so a `number` for money or a ratio in client props is a type error (type test). The server renders its own scaled amounts through the same round trip. An identity test asserts byte-identical formatted output in Node and in a real browser engine (Vitest Browser Mode with Playwright).
- **Read path (AD-4).** `'use client'` modules receive only strings, booleans and display structures; no øre, `Decimal`, `Fraction` or `bigint` crosses except as `WireDecimal`. ESLint bans `src/engine/digest.ts`, `src/server` and `postgres` in client modules, and `toFixed`/`toLocaleString`/`Intl.NumberFormat` in `src/app`/`src/components`.
- **Settled earlier in the epic:** Oversikt's top note and cards compute at s = 1; `largestCapitalGap` is a registered `choice` that sums only through `workingCapitalReleased`; the waterfall (`src/engine/waterfall.ts`) is never scaled by the share; charts are hand-written SVG, no chart library; `fold-out.tsx` is the one fold-out (no shadcn, no modal in v1).
- **Copy** lives in `src/messages/nb.json`; approved copy goes in verbatim, is asserted in `test/messages.test.ts`, and EXPERIENCE gets new keys in the same commit.

## UX & Interaction Patterns

- **Tabs.** Four link tabs — Oversikt, Peers, Nøkkeltall og gap, Verdi — `aria-current="page"`, wrapping on phone, no scroll strip. Tab change pushes history and moves focus to the panel h2. "Viser gap ved full tilnærming" gains "· Endre i Verdi" (link to Verdi) on the key-figure table, the Oversikt hero and the Oversikt capital card (test over all three).
- **Closable-share control.** Segmented `radiogroup`, roving tabindex, arrow keys; steps 0/25/50/75/100 % with "Til medianen for driftsmargin (n %)" in its ordered place; starts at 50 %. Unavailable → `aria-disabled="true"`, still focusable and reachable by arrows, `aria-describedby` → "{Selskap} ligger allerede over medianen. Medianen gjelder driftsmargin."; disabled step on `surface` in `disabled-text`. Available → "Median nås ved n % av gapet. Medianen gjelder driftsmargin." A median line with a 2×12 px tick and "Medianen gjelder driftsmargin." always shows. Fixed steps, never a slider. Phone: full-width grid wrapping to two rows.
- **Amount cards (three, always, never summed).** Kicker, value in the `amount` type style, slate per-line, own median line ("Median nås ved x %" / "Median: allerede over"), separation note where needed.
  - "Økt driftsresultat per år": "585 000 kr av 1 170 000 kr per år" (scaled of full; the second figure is the hero's).
  - "Frigjort arbeidskapital": receivable-days and payable-days lines (`table` size) above a total only when both clear the floor; otherwise "Ingen sum – én del mangler grunnlag".
  - "Frigjort kapital i driftseiendeler", beside, never added. Capital amounts say "engangsbeløp" and state the share.
  - No target → "Ikke beregnet – for få sammenlignbare på …". Driftsmargin a strength → profit card "▲ Styrke. Driftsmarginen er på eller over beste fjerdedel, så det er ikke noe økt driftsresultat å regne ut." and "Til medianen" disabled. Outside the demo seed: profit as normal, both capital cards "Ikke i demodataene". Stacked on phone.
- **Behaviour on share change.** Only the Verdi cards move; table, hero and Oversikt cards stay at full convergence. A live region (present empty from load) announces once "Økt driftsresultat per år: {a} av {full}."; focus stays on the step. Share and multiple replace history; never stored in browser storage.
- **Later in the epic:** EV field (90 px, comma or point, validated on Enter/blur, no default) in 3.6; inline drill-down "Hvordan er dette regnet?" with the share factor shown only when opened from Verdi in 3.7.

## Cross-Story Dependencies

- **3.3 / 3.4 → 3.5:** 3.5 builds its cards on the amount registry, `workingCapitalReleased` and the FR-30 tests, and adds "· Endre i Verdi" that 3.4 left out.
- **3.5 → 3.6:** EV depends on 3.5's share, URL hook and wire codec (same scaling function, `multippel` via `replaceState`).
- **3.5 → 3.7:** the drill-down shows the share factor from Verdi cards and owns two deferred entries (benchmark-filing order in three places; document lines no check covers).
- **From Epic 1/2:** Story 1.6a's `medianStepExists` predicate input; Story 2.8's peer-change provider (must keep `andel=median`); Story 2.9's absence model; the v1 funnel (`group` = `pool`). Document rows need the restored document dump after `pnpm seed`, otherwise they read "Ikke i demodataene" until Story 5.4.
