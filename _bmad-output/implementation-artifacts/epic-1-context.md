# Epic 1 Context: Look up a company and see where it stands — API figures and the first gap in kroner (slice 0)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the first end-to-end slice of Peerless: organisation number → peer group → key figures → gap in kroner. A user (Kari or Anders) searches by name or orgnr, opens a company, and sees its header, a peer group from funnel stages 1–3, and a table for the three API key figures (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) with median, beste fjerdedel and Plassering. The driftsmargin gap is already in kroner and leads Oversikt as "Største gap i kroner". The epic also lays every foundation later epics rely on: pinned toolchain and CI, local Supabase with role grants, step-1 register ingest and the deterministic seed path, the pure engine and the one formatter, the URL-state module, the uncovered / non-AS / no-filing / invalid states, the rate limit, source attribution, and phone-width layout from the first story.

## Stories

- Story 1.1: Toolchain and app shell from a fresh clone
- Story 1.2: Local Supabase with roles and grants — the read boundary
- Story 1.3a: Step 1 ingests register data for 62.100 and demo company C
- Story 1.3b: The seed path — export, load and CI
- Story 1.4: The engine calculates and formats correctly
- Story 1.5: Find a company by name or organisation number
- Story 1.6a: One module reads and writes the analysis URL
- Story 1.6b: Open an analysis in the right state
- Story 1.7: Peerless finds comparable companies, stages 1–3
- Story 1.8: The key-figure table with the three API figures and the margin in kroner
- Story 1.9: Oversikt shows the biggest gap first
- Story 1.10: The open route is rate-limited without storing anyone

## Requirements & Constraints

- **Money:** filed amounts are integer øre (`bigint`); ratios and derived amounts are exact decimals including intermediates; rounding happens once, at display. Never `Number()` on `int8`/`numeric`; values above 2^53 øre must survive.
- **Key figures (API):** driftsmargin = `driftsresultat / sumDriftsinntekter`; totalkapitalrentabilitet = `driftsresultat / sumEiendeler`; egenkapitalandel = `sumEgenkapital / sumEiendeler` (no direction: no beste fjerdedel, Plassering or kroner). Zero/negative denominator or an underivable missing component → undefined with a named reason, never 0. The register does deliver negative `sumEiendeler` (filing errors passed through, ~105 filings in 62.100 + C) — these must come out undefined, not as a sign-flipped ratio.
- **Statistics:** median and quartiles match Excel `PERCENTILE.INC`; Plassering = `(worse + 0.5 × equal) / n × 100`, shown whole percent. Below 10 peers with a defined value (counted per figure), no median, beste fjerdedel, Plassering or kroner. Subject and peers must have the figure from the same source.
- **Kroner gap:** (beste fjerdedel − own margin) × exact `sumDriftsinntekter` in øre, rounded once to whole kroner; at/above beste fjerdedel → "▲ Styrke", no amount. Totalkapitalrentabilitet has no kroner amount ("Ingen kronebeløp"). Hero amount must be byte-identical to the table cell.
- **Peer selection:** benchmark year = subject's latest filed year (no clock). Stage 1 = same `naeringskode1.kode` and revenue band (inclusive bounds 0.5–2× / 0.33–3× / 0.25–4×, exact decimals; never assets or employee count); stage 2 = hard match on `valuta`, `regnskapsregler`, `smaaForetak`, `avviklingsregnskap`, financial period, `regnskapstype`, calendar-year only — `valuta` is not always ISO 4217 (e.g. `EDT`), so an unknown code is not comparable and is never mapped to NOK; stage 3 = legal form `AS` only, per-criterion counts. Never select on a benchmarked measure. Assembly under 1 s.
- **No runtime fetching:** no register call, OCR or model call during a request (tested). Search reads only Peerless's own database.
- **Privacy:** nothing written per request (no tables, no browser storage); no IP, personal data or headers in logs. State lives only in the URL.
- **Runnability:** a fresh clone runs from the README on a local database with the committed seed, no keys. From Story 1.3b, CI migrates fresh and loads the demo seed on every PR.
- **Responsive and accessible:** no horizontal body scroll at 375 and 320 px, checked in every UI story; tables and lists in their own scroll containers; WCAG 2.2 AA; targets ≥24 px.
- **Copy:** all UI copy in Norwegian bokmål from `src/messages/nb.json` by dotted id; quoted strings in EXPERIENCE.md and the stories are authoritative.
- **Process:** one issue, branch `story/<id>-<slug>` and PR per story; each PR states what could go wrong (data access, money, auth) with the reasoning in `docs/ai-log.md` and the session in `docs/ai-sessions/`.

## Technical Decisions

- **Stack (pinned exactly, no `^`/`~`, CI-checked):** Node 24.21.0, pnpm 12.11.2, Next.js 16.4.0 App Router (bump to the patched 16.4.x once the security release announced for 2026-10-14 ships) with `cacheComponents: false`, React 19.3.0, TypeScript 6.0.3 strict (no `any`), Tailwind 4.3.3; later shadcn 4.21.4, Recharts 3.10.1, postgres.js 3.4.9 (no ORM), decimal.js 10.6.0. Vitest for unit tests, Playwright against `pnpm build && pnpm start` for pages, GitHub Actions CI. Supabase CLI 2.120.0, Postgres 17 with `pg_trgm` + `unaccent`. Step 1: Python 3.14 via `uv` with committed `uv.lock`, deps pinned `==`, in a Docker image pinned by tag.
- **Engine (`src/engine`):** pure TS, imports nothing from DB, Next.js, React or `src/server`. Exports the one configured `Decimal.clone` (half away from zero: −2.5 → −3). Result types name absence reasons (undefined, below floor, not in dataset, failed reconciliation). Dependency direction: engine depends on nothing; URL module only on the engine.
- **Formatter (`src/engine/format.ts`):** the only display formatter; takes decimal strings; U+00A0 thousands separator and before "kr"/"%", decimal comma, U+2212 minus; no `Intl.NumberFormat`. ESLint bans `Math.round`/`toFixed` in engine and formatting code.
- **Database:** all DDL in `supabase/migrations`; `CREATE ROLE` only in `supabase/roles.sql` (no passwords). Roles `reader` (SELECT only), `ingest` (step 1), `derive` (step 2, no grants yet), `loader` (seed), each via `<ROLE>_DATABASE_URL`. Public data in schema `register`, excluded from Supabase REST; `anon`/`authenticated` have no `USAGE`; `app` empty in v1. The grants test loops over every `register` relation, so each new migration is covered automatically.
- **Step 1 writes as filed:** company, key-figure and per-filing tables only; NULL for empty elements, stated totals kept, filing year from returned `regnskapsperiode`, `read_at timestamptz`, status, comparability fields, `organisasjonsform`. Amounts are `bigint` `<field>_ore` with a unit comment; each parsed as a whole number (never a float, non-whole rejected) × 100. `reporting_unit` is the fixed label `api_whole_units` — the API returns whole currency units and has no unit field. Filter on `naeringskode1.kode` (secondary codes do not count); SN2007 codes return nothing and are never treated as covered. Misspelled API fields (`sumInnskuttEgenkaptial`, `regnkapsprinsipper`) are read as-is. Companies keyed on orgnr only.
- **Coverage declaration:** `seed/coverage.json` (only hand-edited seed file) lists `{code, measured}` entries, plus `report` (under `analysis/output/`) and `sha256` only when `measured` is true. Step 1 reads it to decide what to fetch; the loader alone writes `register.covered_industry` and `register.dataset`. The literal `62.100` appears in no application code. Demo company C (real 69.202 AS, small, unremarkable, not Statement AS 979 607 008) is recorded in step 1's committed config file.
- **Seed:** `pnpm seed:export` is deterministic with a manifest (format version, migration id, dataset, fetched codes, document-figure orgnrs, read-date range, checksums) and writes `seed/allow-list.json` (empty for now); `pnpm seed` truncates and replaces, is idempotent, refuses any mismatch, a declared code not among fetched codes, or a `measured: true` entry without a matching report.
- **Request path:** `READER_DATABASE_URL` is read only in `src/server/db.ts` (`import 'server-only'`, one postgres.js client). No `NEXT_PUBLIC_` variables; no service-role key in v1; `'use client'` and engine code may not import `src/server/**` or `postgres`. Surfaces are exactly `GET /`, `/slik-fungerer-peerless`, `/analyse/{orgnr}`, `/analyse/{orgnr}/{fane}` and `GET /api/sok` (max 8 rows, identification fields only); no server actions (route-manifest test). Pages embed only the figures of the shown analysis, including each peer value behind them.
- **URL state:** `src/url/analysis-state.ts` alone exports `parse`/`serialize`; `fane` ∈ oversikt|peers|nokkeltall|verdi, `ekskl` (sorted, ≤20, mod-11 valid), `band` 0|1|2, `andel`, `multippel`; defaults omitted, canonical round-trip, invalid values fall back and set a notice flag.
- **Dates:** formatted on the server only, `Europe/Oslo`.
- **Rate limit:** in-memory per-IP counters on `globalThis` at the Next.js proxy for every surface (incl. RSC and soft navigations), separate search and analysis budgets in one config module; README uses `pnpm start`.

## UX & Interaction Patterns

- **Shell:** `<html lang="nb">`; header with wordmark, compact search (hidden on front page) and "Slik fungerer Peerless"; footer "Data fra Brønnøysundregistrene, bearbeidet av Peerless · Kilder og lisens". Light-mode tokens only; Inter with `tabular-nums` for figures, Source Serif 4 for headings only; no red or green, direction always by arrow or word.
- **Search:** ARIA 1.2 combobox, 300 ms debounce, ≤8 results, validation on submit/blur only (spaces stripped, 9 digits, mod-11), navigation only on Enter/click/submit.
- **Analysis:** tabs are links with `aria-current` (three tabs in Epic 1; no Verdi placeholder); title "{Selskap} – {Fane} – Peerless"; route change focuses `h1`, tab change focuses the panel `h2`. Header shows "Regnskapsår YYYY · hentet D. mon. YYYY".
- **States:** uncovered industry (demo C), non-AS subject, no filing, orgnr not in database, invalid URL notice, below-floor merged cell "For få sammenlignbare (n av 10)", "Kan ikke beregnes", non-small subject notice, loading (`aria-busy` + Skeleton), lookup error and rate-limit refusal (`role="alert"`, no partial figures). State block = surface with 4px navy-700 left accent.
- **Table:** real `<table>` with caption, distribution strip (`aria-hidden`, lower-is-better mirrored), scroll container with `role="region"`; on phone a three-column table whose row-name button opens an expansion row.
- **Oversikt:** hero card first, one column on phone; "Hvordan er dette regnet?" and "· Endre i Verdi" are not added until Epic 3.

## Cross-Story Dependencies

- Build order: 1.1 → 1.2 → 1.3a → 1.3b → 1.4 → 1.5 → 1.6a → 1.6b → 1.7 → 1.8 → 1.9 → 1.10.
- 1.2's grants test is extended by every later migration (1.3a, 1.3b). 1.3b's loader depends on 1.3a's tables and `seed/coverage.json`; printing run records waits for Story 2.6.
- 1.4's engine and formatter feed 1.7, 1.8 and 1.9; 1.6a's URL module (tested before any Epic 2 control) feeds 1.6b and 1.7's `ekskl`/`band` handling. Its `andel=median` predicate is caller-supplied until Story 3.5.
- 1.5 introduces `src/server/db.ts` and the route-manifest test. 1.7's Peers list is the base for Epic 2's funnel counts, exclude and widen. 1.9's hero must match 1.8's cell byte for byte.
- Demo C is chosen in 1.3a and only confirmed in 5.4; demo A and B links stay placeholders until Story 5.4. The "Kilder og lisens" section from 1.6b is extended by Stories 5.4 and 5.6.
