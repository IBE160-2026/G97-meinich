# Epic 1 Context: Look up a company and see where it stands — API figures and the first gap in kroner (slice 0)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the first end-to-end slice of Peerless: organisation number → peer group → key figures → gap in kroner. A user (Kari or Anders) finds a company by name or orgnr, opens it, and sees its header, a peer group from funnel stages 1–3, and a table for the three API key figures (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) with median, beste fjerdedel and Plassering; the driftsmargin gap is in kroner and leads Oversikt as "Største gap i kroner". Stories 1.1–1.6b are done (toolchain/CI, local Supabase and grants, step-1 ingest, seed path, engine and formatter, search, URL module, analysis route states). Story 1.7, the peer funnel stages 1–3, is current; it is the base that Epic 2's funnel counts, "Hvorfor med", exclude and widen build on.

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

- **Benchmark year:** the subject's latest filed year from stored data (`regnskapsperiode`), never a clock. A candidate without a filing for that year is excluded.
- **Stage 1 (coarse, rules):** same `naeringskode1.kode` as the subject (primary code only) and `sumDriftsinntekter` from the benchmark-year filing inside the size band around the subject's revenue from the same filing. `band=0` (default) [0.5×, 2×], `band=1` [0.33×, 3×], `band=2` [0.25×, 4×] — both bounds inclusive, computed exactly in decimals on øre (tests at exactly the bound and one øre outside, at every step). Never `sumEiendeler`, never the register's employee count (it is today's figure, not the accounting year's).
- **Stage 2 (comparability, rules):** hard-exclude any candidate differing from the subject on `valuta`, `regnskapsregler`, `smaaForetak`, `avviklingsregnskap`, financial period or `regnskapstype`; only calendar-year filings pass. None of these is ever loosenable. `smaaForetak`/`regnskapsregler` come from the misspelled `regnkapsprinsipper` object. `valuta` is not always an ISO code (e.g. `EDT` observed): never map an unknown value to NOK; an unknown currency cannot be compared. One test per field with a candidate differing on that field alone.
- **Stage 3 (segmentation, rules):** v1 is legal form only — `AS`. No second size step, no geography for 62.100. The engine returns a count per stage-3 criterion separately (one criterion in v1), so a later criterion adds a count, not a code path. The "AS only" wording in the funnel UI is Epic 2.
- **Non-AS subject in a covered industry:** no peer group, median, beste fjerdedel, Plassering or kroner computed or shown; its own state (see UX); any `/{fane}` redirects to `/analyse/{orgnr}`.
- **Never select on a benchmarked measure** (no margin, return or productivity in selection). Stages 1–3 use only industry, revenue size and accounting basis.
- **`ekskl`:** excluded orgnrs leave the group used for every aggregate. The candidate pool is stages 1–3 at the current band step; an `ekskl` orgnr outside it is dropped and raises the one invalid-settings notice (the URL module's tests cover this with a supplied pool). Sorted, de-duplicated, ≤20.
- **Performance / no runtime fetch:** assembly from stored key figures under 1 s on the seeded 62.100 dataset (timed test). No document fetch, OCR, register call or model call in a request; a test asserts no outbound request to the register or a model host during an analysis.
- **Statistics downstream (1.8/1.9):** quartiles as Excel `PERCENTILE.INC`; no aggregate below 10 peers with a defined value, counted per figure; kroner gap = (beste fjerdedel − own margin) × exact revenue in øre, rounded once.
- **Money:** amounts in integer øre (`bigint`), ratios as exact decimals via the one decimal constructor; parse `int8`/`numeric` with `parseOre`/`parseDecimal`, never `Number()`; displayed numbers only through `src/engine/format.ts`.
- **PR obligation (1.7):** state what could go wrong — the data the request path reads, the peers the payload exposes, selection on the wrong basis — and record it in `docs/ai-log.md`.

## Technical Decisions

- **One engine (AD-1):** all funnel logic and every derived figure lives in `src/engine`, pure TypeScript with no DB/framework imports. The server reads rows through `readerSql()` and hands plain figures to the engine; Python never computes.
- **Read path (AD-4):** Next.js reads `register` server-side as the SELECT-only `reader` role (read-only transactions); no service role. The browser receives only the figures of the analysis it shows — every peer's value behind each shown figure, excluded rows included — and no other field per peer than the list and figures need (no candidate data beyond that).
- **URL is the only state (AD-5):** `band` and `ekskl` are read only through `parse`/`parseSegments` in `src/url/analysis-state.ts`; links built only via `serialize`. Defaults omitted; invalid values fall back and set `invalidSettings`. "Default peer group" is a predicate on parsed state.
- **Recalculation (AD-6):** the server computes the peer group and distributions for the URL state. Peer changes (Epic 2) are soft navigations to a serialized URL rendered on the server; exact values to the browser travel through `src/engine/wire.ts` as decimal strings, never `number`.
- **No model in a request (AD-7):** classification and explanation are batch step 2 only; stages 4–5 do not exist yet and stages 1–3 must not depend on them.
- **Funnel shape:** five stages total (4 fingerprint, 5 classification in Epic 2). In v1 the size band is the only loosenable criterion. Later stages report per-stage counts, so stages 1–3 should expose counts per stage/criterion.
- **Coverage:** covered industries come from `register.covered_industry`; the literal `62.100` appears in no application code. Industry names in copy come from the register's `naeringskode1_beskrivelse`.
- **Request surface stays closed:** only `GET /`, `/slik-fungerer-peerless`, `/analyse/{orgnr}`, `/analyse/{orgnr}/{fane}`, `GET /api/sok`; no server actions (`pnpm check:routes`). Subject lookup, 404s and redirects happen before any Suspense boundary renders.
- **Schema changes:** DDL only in `supabase/migrations`; a new `register` relation needs grants and a seed-table entry, and a PR adding a migration re-exports the seed.

## UX & Interaction Patterns

- **Analysis header:** when a peer group exists, it shows the number of comparable companies ("{n} sammenlignbare" in running text).
- **Peers tab (1.7 scope):** panel `h2`; the stages 1–3 peer group, one row per peer with name, revenue ("x mill. kr" from benchmark-year `sumDriftsinntekter`, via the one formatter) and municipality, sorted by revenue, plus the peer count. Funnel counts, "Hvorfor med", "Grunnlag for treff", exclude/restore and the size-band control are Epic 2.
- **Scroll container (UX-DR37):** the list sits in `overflow-x: auto`, `tabindex="0"`, `role="region"`, descriptive `aria-label`, visible focus, edge-fade cue.
- **Reflow (UX-DR68):** no horizontal body scroll at 375 and 320 px (checked in tests); on phone one entry per row/card; no fixed column widths that cannot shrink.
- **Number formatting (UX-DR78):** nb-NO via the one formatter — millions one decimal "mill. kr", U+00A0 before units and as thousands separator, decimal comma, true minus `−`, percent one decimal, Plassering whole percent, orgnr grouped 3-3-3.
- **Non-AS state:** company header, no tabs; State block kicker "Peerless sammenligner foreløpig bare aksjeselskaper" with "Her er selskapets egne nøkkeltall fra Brønnøysundregistrene."; the three API figures from the latest filing with filing year and read date (no filing → the 1.6b no-filing state); "Uten sammenlignbare selskaper viser vi ingen median, plassering eller kroner."; link "Søk på et annet selskap". Mirrors the uncovered-industry state from 1.6b.
- **Later peer states (Epic 2, for orientation):** fewer than 10 → "Peer-gruppen har bare {n} sammenlignbare. Med under 10 viser vi ingen median eller kroner." with "Utvid størrelsesintervallet"; zero → "Fant ingen sammenlignbare selskaper."; widened band tagged "Utvidet".
- **Copy:** Norwegian bokmål in `src/messages/nb.json` via `t()`; no hard-coded strings in `src/app` or `src/components`. Tab label "Peers" may carry `lang="en"`.

## Cross-Story Dependencies

- Build order: 1.1 → 1.2 → 1.3a → 1.3b → 1.4 → 1.5a → 1.5b → 1.6a → 1.6b → 1.7 → 1.8 → 1.9 → 1.10.
- 1.7 reuses 1.6a's URL module (`band`, `ekskl`, supplied candidate pool), 1.6b's route states, header and State block, `src/server/db.ts`, and 1.4's engine and formatter.
- 1.8 computes median, beste fjerdedel, Plassering and the driftsmargin kroner over 1.7's peer group (excluded peers removed); 1.9's hero must match 1.8's cell byte for byte.
- Epic 2 extends 1.7's list: OCR-backed fingerprint (stage 4), classification (stage 5), funnel counts and "AS only" wording (2.7), exclude/restore and widen (2.8). Story 5.2 measures stages 1–3 alone against the labelled set, so stages 1–3 must be callable on their own.
- 1.10 puts every surface behind the per-IP limiter afterwards. Demo A/B links stay placeholders until Story 5.4.
