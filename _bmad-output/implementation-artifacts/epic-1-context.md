# Epic 1 Context: Look up a company and see where it stands — API figures and the first gap in kroner (slice 0)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the first end-to-end slice of Peerless: organisation number → peer group → key figures → gap in kroner. A user (Kari or Anders) finds a company by name or orgnr, opens it, and sees its header, a peer group from funnel stages 1–3, and a table for the three API key figures (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) with median, beste fjerdedel and Plassering. The driftsmargin gap is already in kroner and leads Oversikt as "Største gap i kroner". The epic also lays the foundations later epics rely on: pinned toolchain and CI, local Supabase with role grants, step-1 register ingest and the deterministic seed path, the pure engine and the one formatter, search, the URL-state module, the uncovered / non-AS / no-filing / not-found / invalid states, the rate limit, source attribution, and phone-width layout from the first story. Stories 1.1–1.4 are done; 1.5 is next.

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

- **Search (FR-1):** one field for name or orgnr. Spaces stripped; exactly nine digits → exact orgnr match, anything else → fuzzy name match. Digits-only with a count ≠ 9 → "Organisasjonsnummeret må ha 9 siffer"; nine digits failing modulus 11 (weights 3,2,7,6,5,4,3,2) → "Ugyldig organisasjonsnummer"; a name containing digits is a name search. Searches Peerless's own database only, never the register live. Each result: name, orgnr, primary industry, municipality — nothing else, never filtered on a financial criterion. Choosing a result resolves on orgnr. Malformed input or no match gives a clear message, never an empty analysis.
- **Only an orgnr is needed (SM-8):** a complete analysis is reachable from nothing but an organisation number.
- **Front page (FR-61):** title "Peerless"; one `h1` headline plus one sentence that v1 covers 62.100; hero search; "Slik fungerer det" in three numbered steps; link to "Slik fungerer Peerless". No "Kom i gang" or SaaS buttons. Industry overviews are stage 3.
- **Money:** filed amounts integer øre (`bigint`); ratios/derived amounts exact decimals incl. intermediates; rounded once, at display. Never `Number()` on `int8`/`numeric`.
- **Key figures (API):** driftsmargin = `driftsresultat / sumDriftsinntekter`; totalkapitalrentabilitet = `driftsresultat / sumEiendeler` (no kroner: "Ingen kronebeløp"); egenkapitalandel = `sumEgenkapital / sumEiendeler` (no direction: no beste fjerdedel, Plassering or kroner). Zero/negative denominator or underivable component → undefined with a named reason, never 0.
- **Statistics:** quartiles as Excel `PERCENTILE.INC`; Plassering `(worse + 0.5 × equal)/n × 100`, whole percent. No aggregate below 10 peers with a defined value, counted per figure. Kroner gap = (beste fjerdedel − own margin) × exact revenue in øre, rounded once; at/above beste fjerdedel → "▲ Styrke". Hero amount byte-identical to the table cell.
- **Peer selection:** benchmark year = subject's latest filed year (no clock). Stage 1: same `naeringskode1.kode`, inclusive revenue bands 0.5–2× / 0.33–3× / 0.25–4× (never assets or employee count). Stage 2: hard match on `valuta`, `regnskapsregler`, `smaaForetak`, `avviklingsregnskap`, financial period, `regnskapstype`; calendar year only. Stage 3: `AS` only, per-criterion counts. Never select on a benchmarked measure. Assembly under 1 s.
- **No runtime fetching:** no register, OCR or model call in any request (no-network tests).
- **Privacy:** nothing written per request (no table, no browser storage); state lives only in the URL; no IP, personal data or headers in logs.
- **Responsive/accessible:** no horizontal body scroll at 375 and 320 px, checked in every UI story; overflowing tables/lists in their own scroll containers; WCAG 2.2 AA; targets ≥24 px (44 recommended on phone).
- **Copy:** Norwegian bokmål in `src/messages/nb.json` via `t()` by dotted id; quoted strings in the stories and EXPERIENCE.md are authoritative (mockups' orgnr-only search copy is superseded).
- **Process:** one issue, branch `story/<id>-<slug>` and PR per story; each PR states what could go wrong (for 1.5: the search endpoint's data access and what it may return), recorded in `docs/ai-log.md`, session in `docs/ai-sessions/`.

## Technical Decisions

- **Read path:** the `register` schema is not exposed via Supabase REST. Next.js reads it server-side through the SELECT-only `reader` role. `READER_DATABASE_URL` is read only in `src/server/db.ts`, which begins with `import 'server-only'` and holds one postgres.js client per process (Story 1.5 creates it, with a grep test enforcing both). No service role in any request. Pages embed only the figures of the shown analysis, incl. each peer value behind them.
- **Request surface (closed list):** `GET /`, `/slik-fungerer-peerless`, `/analyse/{orgnr}`, `/analyse/{orgnr}/{fane}` (with RSC payloads) and `GET /api/sok?q=` — the only JSON endpoint. Server actions banned. A route-manifest test over the built app fails on any other surface (introduced in 1.5).
- **`/api/sok`:** at most 8 rows of exactly name, orgnr, `naeringskode1`, municipality (test asserts response keys). Names matched with `pg_trgm` over an index on an IMMUTABLE `unaccent` wrapper function; orgnrs by an exact index. Sits behind the per-IP limit (added in 1.10).
- **Database conventions:** all DDL in `supabase/migrations` (Postgres 17, `pg_trgm` + `unaccent`); a function `reader` must call needs an explicit `GRANT EXECUTE`; the grants test covers every `register` relation automatically. A PR adding a migration re-exports the seed (`pnpm seed:export`) in the same PR, since the loader refuses an older migration id.
- **Config/secrets:** every env var server-only; no `NEXT_PUBLIC_` variable in v1 (CI fails on any); ESLint bans `src/server/**` and `postgres` in `'use client'` modules and `src/engine/**`. Request-path errors render the lookup-error state, never partial figures.
- **URL state:** `src/url/analysis-state.ts` alone exports `parse`/`serialize` and imports only from the engine; every link and navigation uses it. Grammar: `/analyse/{orgnr}/{fane}`, `fane` ∈ oversikt|peers|nokkeltall|verdi; covered `/analyse/{orgnr}` redirects to `oversikt`; for uncovered, non-AS or no-filing companies `/analyse/{orgnr}` is the result and any `{fane}` redirects there. Orgnr: spaces stripped, nine digits, mod 11 (same messages as search). `ekskl` sorted, de-duplicated, ≤20, within the stages 1–3 candidate pool; `band` 0|1|2; `andel` 0|25|50|75|100|median; `multippel` (0,50] step 0.1, point written, point or comma read. Defaults omitted; `serialize(parse(url))` canonical; invalid values fall back and raise one notice — nothing dropped silently.
- **Engine (`src/engine`):** pure TS, no DB/framework imports; the one configured decimal constructor (half away from zero); absence reasons named in types (undefined, below floor, not in dataset, failed reconciliation); `format.ts` is the only display formatter (U+00A0 thousands and before "kr"/"%", decimal comma, U+2212 minus). Dependency direction: engine depends on nothing; URL module only on the engine.
- **Coverage:** covered industries read from `register.covered_industry`, written only by the loader from `seed/coverage.json`; the literal `62.100` appears in no application code (test).
- **Dates:** filing year from stored `regnskapsperiode`; dates formatted on the server only, in `Europe/Oslo`.
- **Rate limit:** in-memory per-IP counters on `globalThis` at the Next.js proxy for every surface (incl. RSC and soft navigations); separate search and analysis budgets in one config module; README runs `pnpm start`.

## UX & Interaction Patterns

- **Shell:** `<html lang="nb">`; header with wordmark (→ `/`), compact search (hidden on the front page) and "Slik fungerer Peerless"; footer "Data fra Brønnøysundregistrene, bearbeidet av Peerless · Kilder og lisens", the latter linking to the sources section of `/slik-fungerer-peerless`. Light tokens only; Inter with `tabular-nums` for figures, Source Serif 4 for headings only; no red or green.
- **Search field:** hero 60 px (56 on phone) joined to a navy-700 submit; on phone field and a full-width 52 px button stack, steps stack. Visible label/hint "Navn eller organisasjonsnummer" in the accessible name. Validate on submit/blur only, never while typing; error = 2 px `unfavourable` border + glyph, `aria-invalid="true"`, `aria-describedby` to the message, message in the field's live region. Empty submit → "Skriv inn et navn eller et organisasjonsnummer", no request.
- **Combobox (ARIA 1.2):** 300 ms debounce, one request; input has `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; `listbox` of ≤8 `option`s (name in 600, then orgnr · industry · municipality in slate). Arrows move, Enter opens, Esc closes. Navigate only on Enter, click or submit — typing the ninth digit opens nothing; a submitted nine-digit exact match goes straight to the analysis. A polite live region, present empty from page load, announces "{n} treff" and is shared with the no-match message.
- **Search states:** no match → "Ingen treff på «{q}». Peerless har foreløpig bare selskaper i {industry}." + demo A/B links; valid orgnr not in database → "Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi {industry}." + demo A/B links (placeholders until Story 5.4, stated in the PR); {industry} is each covered code from `register.covered_industry` with the register's own `naeringskode1_beskrivelse` for it, first letter lower-cased — "dataprogrammeringstjenester (62.100)" for v1 — never a literal in `src/` (human decision 2026-10-15); loading → field read-only, button disabled, "Henter analysen …" announced once, spinner only without `prefers-reduced-motion`; failure → `role="alert"` "Noe gikk galt. Prøv igjen om litt.", no partial result.
- **Analysis:** tabs are links with `aria-current="page"` (three in Epic 1, no Verdi placeholder); title "{Selskap} – {Fane} – Peerless"; route change focuses `h1`, tab change the panel `h2`; header "Regnskapsår YYYY · hentet D. mon. YYYY". States use the State block (surface, 4 px navy-700 left accent). Table: real `<table>` with caption, `aria-hidden` distribution strip, scroll container with `role="region"`; on phone a three-column table with expandable rows. Oversikt: hero first; "Hvordan er dette regnet?" and "· Endre i Verdi" wait for Epic 3.

## Cross-Story Dependencies

- Build order: 1.1 → 1.2 → 1.3a → 1.3b → 1.4 → 1.5a → 1.5b → 1.6a → 1.6b → 1.7 → 1.8 → 1.9 → 1.10.
- **1.5 data gap, resolved by the split (2026-10-14):** Story 1.5a adds `forretningsadresse_kommunenummer`, `forretningsadresse_kommune` and `naeringskode1_beskrivelse` to `register.company` (migration, step-1 parse, companies-only refresh, seed re-export) and the name-search index; Story 1.5b builds `/api/sok` and the page on them.
- 1.5a introduces the name-search index migration; 1.5b introduces `src/server/db.ts`, `/api/sok`, the route-manifest test and the compact search variant (mounted in the header by 1.6b); 1.10 later puts `/api/sok` behind the limiter and 1.6b/1.7 reuse `db.ts`. Search navigates to `/analyse/{orgnr}`, whose states (not found, uncovered, no filing, invalid orgnr on the front page) are rendered by 1.6b; the orgnr mod-11 validator should be shared by search and the 1.6a URL module.
- 1.4's engine and formatter feed 1.7–1.9; 1.6a's URL module (tested before any Epic 2 control) feeds 1.6b and 1.7's `ekskl`/`band`; its `andel=median` predicate is caller-supplied until Story 3.5. 1.7's Peers list is the base for Epic 2's funnel, exclude and widen. 1.9's hero must match 1.8's cell byte for byte, and 1.9's e2e test starts from search.
- Demo A and B links stay placeholders until Story 5.4; demo C is chosen in 1.3a. The "Kilder og lisens" section from 1.6b is extended by Stories 5.4 and 5.6.
