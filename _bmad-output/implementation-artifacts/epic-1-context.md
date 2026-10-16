# Epic 1 Context: Look up a company and see where it stands — API figures and the first gap in kroner (slice 0)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the first end-to-end slice of Peerless: organisation number → peer group → key figures → gap in kroner. A user (Kari or Anders) finds a company by name or orgnr, opens it, and sees its header, a peer group from funnel stages 1–3, and a table for the three API key figures (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) with median, beste fjerdedel and Plassering. The driftsmargin gap is in kroner and leads Oversikt as "Største gap i kroner". Stories 1.1–1.7 are done (toolchain/CI, local Supabase and grants, step-1 ingest, seed path, engine and formatter, search, URL module, analysis route states, peer funnel stages 1–3). What remains is the key-figure table (1.8), the Oversikt hero (1.9) and the per-IP rate limit (1.10).

## Stories

- Story 1.1: Toolchain and app shell from a fresh clone
- Story 1.2: Local Supabase with roles and grants — the read boundary
- Story 1.3a: Step 1 ingests register data for 62.100 and demo company C
- Story 1.3b: The seed path — export, load and CI
- Story 1.4: The engine calculates and formats correctly
- Story 1.5a: Step 1 stores what search shows — municipality and industry name
- Story 1.5b: Find a company by name or organisation number
- Story 1.6a: One module reads and writes the analysis URL
- Story 1.6b: Open an analysis in the right state
- Story 1.7: Peerless finds comparable companies, stages 1–3
- Story 1.8: The key-figure table with the three API figures and the margin in kroner
- Story 1.9: Oversikt shows the biggest gap first
- Story 1.10: The open route is rate-limited without storing anyone

## Requirements & Constraints

- **Peer group (built):** benchmark year is the subject's latest filing; stage 1 same `naeringskode1` and inclusive revenue band (0.5–2×, 0.33–3×, 0.25–4×) on exact øre; stage 2 six hard comparability fields plus calendar year only; stage 3 AS only. A subject with no positive revenue, or a non-calendar financial year, has no peers and is told why. `ekskl` peers leave every aggregate.
- **10-peer floor, per figure:** counted after peers with an undefined value for that figure are left out. Below it the row stays with the own value; comparison cells become "For få sammenlignbare (n av 10)" and there is no kroner amount. Each figure is gated independently.
- **Same basis:** a comparison (median, beste fjerdedel, Plassering, kroner) needs the figure for the subject and ≥10 peers from the same source. Withholding a comparison never withholds the subject's own figure.
- **Undefined is not zero:** zero/negative denominator or an underivable missing component makes a figure undefined; it drops that company from that figure's distribution only, and the count left out is shown ("{k} utelatt").
- **Distribution:** median and quartiles by linear interpolation (Excel `PERCENTILE.INC`). Beste fjerdedel is the upper quartile where higher is better, the lower where lower is better. Plassering = (worse + 0.5 × equal) / peers × 100 in the favourable direction, shown in whole percent. A figure with no direction (egenkapitalandel) gets no beste fjerdedel, no Plassering and no kroner.
- **Kroner:** only driftsmargin has a kroner translation among the three: (beste fjerdedel − own margin) × exact `sumDriftsinntekter` in øre, at full convergence, rounded once to whole kroner. At or above beste fjerdedel it is a strength with no amount. Totalkapitalrentabilitet has none ("Ingen kronebeløp"). The median is never the kroner target.
- **Hero = table:** the Oversikt hero amount must be byte-identical to the driftsmargin kroner cell for the same URL.
- **Non-small subject:** when a `smaaForetak`-false subject falls below the floor on any comparison, one State block says "Peerless sammenligner foreløpig bare små foretak" — not otherwise.
- **Rate limit:** every open surface limited per IP, no IP stored anywhere (logs, DB, files); over budget gives a refusal, never a partial analysis. Search and analysis have separate budgets. In-memory only, a documented v1 limitation; persistent limiting gates any public deployment.
- **Responsive:** no horizontal body scroll at 375 and 320 px; wide tables and plots scroll in their own container.
- **PR obligation:** each remaining story's PR states what could go wrong (kroner amount and rounding, payload exposure, limiter and logger) and records it in `docs/ai-log.md`.

## Technical Decisions

- **One engine:** statistics, gating, direction and kroner live in `src/engine` as pure functions; the server reads rows via `readerSql()` and hands plain figures over. Exact values reach the browser as decimal strings through `src/engine/wire.ts`, never `number`.
- **Money and rounding:** filed amounts are `bigint` øre; derived values exact decimals from the one configured decimal.js constructor; parse with `parseOre`/`parseDecimal`. Rounding happens only at display, in `src/engine/format.ts` (pinned characters: U+00A0 separators, decimal comma, U+2212 minus).
- **Read path / payload:** Next.js reads `register` server-side as SELECT-only `reader`; no service role. The page carries only this analysis's figures — every peer's value behind each shown figure, excluded rows included — and nothing else per peer.
- **URL is the state:** read/written only via `src/url/analysis-state.ts`; the server computes the group and distributions for the URL state. No model, register call or OCR in a request.
- **Request surface is closed:** only the listed routes and `/api/sok`, no server actions (`pnpm check:routes`).
- **Rate limiter:** one per-IP counter on `globalThis`, applied at the Next.js proxy for every surface including RSC payloads and soft navigations; budgets in one config module. One server logger writes structured logs with no IP, personal data or request headers. README runs `pnpm start`, not `next dev`.
- **Copy:** bokmål in `src/messages/nb.json` via `t()`; no hard-coded strings in `src/app`/`src/components`.

## UX & Interaction Patterns

- **Key-figure table (Nøkkeltall og gap):** a real `<table>` with caption; columns own, median, beste fjerdedel, Plassering ("bedre enn 61 %"), distribution strip, gap in kroner. Subline: direction · "{n} sammenlignbare brukt · {k} utelatt"; banded rows show "midtre halvdel x–y %" ("−6,3 til 9,1 %" when a bound is negative). Top note "Viser gap ved full tilnærming" (the "· Endre i Verdi" link arrives with Verdi in Epic 3 — no dead reference now).
- **Row states:** strength "▲ Styrke"; below floor one merged italic slate cell whose `headers` names every spanned column; undefined own value "Kan ikke beregnes" with "omsetningen er null eller negativ" / "en regnskapslinje mangler"; egenkapitalandel shows own, median, midtre halvdel, "Ingen retning", sr-only "ikke relevant – ingen retning" in inapplicable cells.
- **Distribution strip:** company dot in `signature` with 2px navy-900 outline, median tick, beste fjerdedel hollow downward triangle, midtre halvdel `band` on the divider track; lower-is-better mirrored with "Bedre →"; no-direction unmirrored, no label. `aria-hidden`, not focusable — the cells are its text alternative. No red/green; direction always arrow or word.
- **Scroll container:** `overflow-x: auto`, `tabindex="0"`, `role="region"`, `aria-label` "Nøkkeltall, kan rulles sideveis", visible focus, edge fade.
- **Phone table:** real three-column table (Nøkkeltall · own · Gap i kroner); row name is a `button` with `aria-expanded`/`aria-controls` opening a full-width expansion row with the remaining values; below-floor reads "For få (n av 10)"; no unshrinkable column widths.
- **Oversikt hero:** kicker "Største gap i kroner", direction tag, amount, "per år ved full tilnærming til beste fjerdedel", own vs beste fjerdedel, context line (median, Plassering, pp to beste fjerdedel), link "Se alle nøkkeltall". No-gap: "▲ Styrke" + "Driftsmarginen er på eller over beste fjerdedel. Det er ikke noe gap å regne om til kroner." Below floor: own value + "For få sammenlignbare (n av 10)". Phone: one column, hero first. The "Hvordan er dette regnet?" link is Epic 3.
- **Refusal:** `role="alert"` "Det er gjort mange oppslag fra denne adressen på kort tid. Vent litt, og prøv igjen." with no figures.

## Cross-Story Dependencies

- Build order: 1.8 → 1.9 → 1.10, on top of 1.1–1.7.
- 1.8 computes over 1.7's peer group (`src/engine/peers.ts`, excluded peers removed) and uses 1.4's engine and formatter and 1.6b's route states, header and State block.
- 1.9's hero reuses 1.8's driftsmargin result; its e2e test searches, opens a 62.100 company, lands on `/analyse/{orgnr}/oversikt` with focus on `h1`, and matches the engine output.
- 1.10 wraps every surface built so far, including the 1.8/1.9 pages and `/api/sok`.
- Epic 2 adds funnel counts, exclude/widen and OCR-backed stages 4–5; Epic 3 adds document-figure rows, the waterfall, Verdi (and the "Endre i Verdi" link) and the provenance drill-down. Demo A/B links stay placeholders until Story 5.4.
