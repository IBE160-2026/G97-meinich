# Epic 1 Context: Look up a company and see where it stands — API figures and the first gap in kroner (slice 0)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the first end-to-end slice: organisation number → peer group → key figures and gap in kroner. A user searches by name or orgnr, opens an analysis, and sees the company header, a peer group from funnel stages 1–3 (rules only), and a key-figure table for the three API-sourced figures (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) with median, beste fjerdedel and Plassering. The driftsmargin gap is already in kroner and leads the Oversikt hero card. The epic also lays the foundation everything else rests on: pinned toolchain, CI, local Supabase with grant-enforced read boundary, step-1 register ingest, the deterministic seed path, the pure engine and formatter, the URL-as-state module, all non-happy-path states, rate limiting, and phone-width layout from the first story.

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

- **Money:** filed amounts are `bigint` øre; derived values exact decimals; rounding only at display, half away from zero (−2.5 → −3). Never `Number()` on `int8`/`numeric`; values above 2^53 øre must survive.
- **Key figures (API):** margin = `driftsresultat / sumDriftsinntekter`; ROA = `driftsresultat / sumEiendeler`; equity ratio = `sumEgenkapital / sumEiendeler`. Zero/negative denominator or underivable missing component → undefined with a named reason, never zero. Equity ratio has no direction: no beste fjerdedel, no Plassering, no kroner. ROA has no kroner amount.
- **Distribution:** median/quartiles as Excel `PERCENTILE.INC`; beste fjerdedel is direction-aware; Plassering = `(worse + 0.5 × equal) / n × 100`, shown whole percent.
- **Ten-peer floor per figure** (counted after undefined peers leave): below it, own value only, "For få sammenlignbare (n av 10)", no aggregates or kroner. Comparison only when subject and peers share the source.
- **Driftsmargin kroner:** (beste fjerdedel − own) × exact `sumDriftsinntekter`, rounded once to whole kroner; at/above target → "▲ Styrke", no amount. Hero and table amounts must be byte-identical.
- **Funnel stages 1–3:** primary industry `naeringskode1.kode` + revenue band from the benchmark-year filing (0.5–2× / 0.33–3× / 0.25–4×, bounds inclusive, exact); hard comparability exclusion on `valuta`, `regnskapsregler`, `smaaForetak`, `avviklingsregnskap`, financial period, `regnskapstype`, calendar year only; legal form `AS` only, no geography. Never select on `sumEiendeler`, employee count or any benchmarked measure. Benchmark year = subject's latest filing; peers without it are excluded.
- **Performance:** peer group under 1 s from stored data; no document fetch, OCR, register or model call in any request (asserted by test).
- **Privacy/state:** nothing written to any table or browser storage on a request; all visitor state in the URL. Rate limit per IP in memory, no IP in logs, DB or files.
- **Runs without keys:** fresh clone + README + local DB + committed seed; CI migrates fresh and loads the seed on every PR from Story 1.3b.
- **Copy:** Norwegian bokmål UI from message files keyed by dotted ids; English code/docs; register field names untranslated (incl. misspelled `sumInnskuttEgenkaptial`, `regnkapsprinsipper`).
- **Process:** every story is one issue, branch `story/<id>-<slug>`, one PR; PRs touching data access, money or auth state what could go wrong, recorded in `docs/ai-log.md`; session file in `docs/ai-sessions/`.

## Technical Decisions

- **Stack (exact pins, no `^`/`~`, CI-checked):** Node 24.21.0, pnpm 12.11.2, Next.js 16.4.0 App Router (`cacheComponents: false`; bump to patched 16.4.x if the 2026-10-14 advisory shipped), React 19.3.0, TypeScript 6.0.3 strict (no `any`), Tailwind 4.3.3; later shadcn 4.21.4, recharts 3.10.1, postgres.js 3.4.9 (no ORM), decimal.js 10.6.0; Supabase CLI 2.120.0; Postgres 17 with `pg_trgm` + `unaccent`. Step 1: Python 3.14, `uv` + committed `uv.lock`, Docker pinned by tag.
- **Engine:** `src/engine` is pure TS, imports nothing from DB/Next/React/`src/server`; exports one configured `Decimal.clone`; all derived arithmetic lives there (Python never computes a ratio). `src/engine/format.ts` is the only formatter: takes decimal strings, no `Intl.NumberFormat`, U+00A0 thousands and before "kr"/"%", decimal comma, U+2212 minus. ESLint bans `Math.round`/`toFixed` in engine and formatting.
- **Database:** all DDL in `supabase/migrations`; roles `reader`, `ingest`, `derive`, `loader` in `supabase/roles.sql` (no passwords); public data in schema `register`, not in `api.schemas`, no `USAGE` for `anon`/`authenticated`; `app` schema empty in v1. One writer per table: step 1 (`ingest`) writes company, key-figure and per-filing tables; `loader` truncates/replaces and alone writes `register.dataset` and `register.covered_industry`. Amount columns `<field>_ore` with unit comment; filings store year (from returned `regnskapsperiode`, never requested `år`), `read_at timestamptz`, reporting unit, status, comparability fields; empty elements stored NULL, totals as filed; companies keyed on orgnr only.
- **Coverage:** `seed/coverage.json` (`{"code": "62.100", "measured": false}`) is the only hand-edited seed file and the single source of covered industries; the literal `62.100` appears in no application code. Loader validates shape, refuses codes not fetched, and accepts `measured: true` only with a matching `report`/`sha256` under `analysis/output/`.
- **Seed:** `pnpm seed:export` deterministic with manifest (format version, migration id, dataset, fetched codes, read-date range, checksums) and `seed/allow-list.json`; `pnpm seed` idempotent, refuses on any mismatch and loads nothing; CLI auto-seed off.
- **Request path:** `READER_DATABASE_URL` read only in `src/server/db.ts` (`import 'server-only'`, one client); no `NEXT_PUBLIC_` vars; service-role key never referenced in request code. Surfaces are exactly `GET /`, `/slik-fungerer-peerless`, `/analyse/{orgnr}`, `/analyse/{orgnr}/{fane}`, `GET /api/sok` (≤8 rows, identification fields only); server actions banned; route-manifest test. Pages embed only the shown analysis's figures and the peer values behind them.
- **URL:** `src/url/analysis-state.ts` alone exports `parse`/`serialize`, imports only the engine; `fane` ∈ `oversikt|peers|nokkeltall|verdi`, `ekskl` (sorted, deduped, ≤20, mod-11 valid), `band` 0|1|2, `andel` 0|25|50|75|100|median (median existence is a caller-supplied predicate), `multippel` (0,50] step 0.1; defaults omitted; invalid → default + invalid-settings flag.
- **Rate limit:** per-IP counters on `globalThis` at the Next.js proxy, separate search and analysis budgets in one config module; README uses `pnpm start`.
- **Dates:** formatted server-side in `Europe/Oslo`; no clock in the engine.

## UX & Interaction Patterns

- Light-mode tokens only (no red/green; direction always arrow or word; `signature` only for the company marker with navy-900 outline). Inter with `tabular-nums` for all figures, Source Serif 4 for headings only.
- Header (wordmark, compact search hidden on front page, "Slik fungerer Peerless"), footer source line "Data fra Brønnøysundregistrene, bearbeidet av Peerless · Kilder og lisens". `<html lang="nb">`.
- Front page: one headline + 62.100 sentence, hero search, three "Slik fungerer det" steps, no SaaS buttons. Search is an ARIA 1.2 combobox, 300 ms debounce, validated on submit/blur only (mod-11 weights 3,2,7,6,5,4,3,2); exact messages for empty, wrong length, bad check digit, no match, unknown orgnr.
- Analysis: tabs are links (`aria-current="page"`), three in Epic 1 (Oversikt, Peers, Nøkkeltall og gap) — no Verdi tab or placeholder; `verdi` renders Oversikt. Focus to `h1` on route change, panel `h2` on tab change.
- States with exact copy: uncovered industry (demo C, no tabs, three API figures), no filing in seed, non-AS subject, unknown orgnr, invalid URL notice, below floor, own value undefined, non-small subject below floor, loading (`aria-busy` + Skeleton), lookup error, rate-limit refusal. State block (4px navy-700 accent) is the only banner-like component.
- Table: real `<table>` with caption; distribution strip `aria-hidden` (table cells are its text alternative); lower-is-better mirrored with "Bedre →"; merged below-floor cell uses `headers`, not `colspan`. Top note "Viser gap ved full tilnærming" without "· Endre i Verdi" until Epic 3.
- Responsive: designed at 1200 and 375, no body horizontal scroll down to 320 (checked in every UI story); tables/lists in focusable `role="region"` scroll containers; phone table is three columns with an expandable row; targets ≥24 px; honour `prefers-reduced-motion`.

## Cross-Story Dependencies

- Strict order: 1.1 → 1.2 → 1.3a → 1.3b → 1.4 → 1.5 → 1.6a → 1.6b → 1.7 → 1.8 → 1.9 → 1.10. Story 1.1 must leave no database or DB client; 1.2 adds Supabase with no data tables; the grants test from 1.2 is extended by each later migration.
- Demo company C is chosen in 1.3a (recorded in step 1's config file); demo A and B are chosen only in Story 5.4, so their links in 1.5/1.6b are placeholders and the PRs say so.
- 1.6b builds on the URL module (1.6a); `ekskl` pool validation is wired in 1.7. Verdi tab, "· Endre i Verdi", provenance drill-down and the rest of the table/Oversikt come in Epic 3; funnel counts, match basis, exclude/widen controls in Epic 2 (built on 1.7's peer list); the remaining "Slik fungerer Peerless" sections in Epic 5.
- Run-record printing by `pnpm seed` waits for Story 2.6; the allow-list starts empty and is filled by Stories 2.3 and 5.4. Story 5.1 (labelled set) and the OCR reference set (issue #14) run in parallel from week 1.
