---
title: 'Story 1.5b: Find a company by name or organisation number'
type: 'feature'
created: '2026-10-15'
status: 'done'
baseline_commit: 'fc6eeb1901cad9d59a128a4f47465ee36ba2d3df'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The front page is empty and nothing reads the database at request time. A user cannot reach a company by name or orgnr. There is no `reader` client, no search endpoint and no guard on the request surface.

**Approach:**
- A front page with a hero ARIA 1.2 combobox.
- `GET /api/sok` reading `register.company` through one server-only postgres.js client.
- A shared mod-11 orgnr validator in the engine.
- Grep and route-manifest tests.
- Story ACs: GitHub issue #6 and `epics.md` Story 1.5b (authoritative; `epics.md` wins on conflict).

**Why split (human, 2026-10-14):** Story 1.5 ran to about 2 700 tokens across the database, step 1, the API, the UI and tests. It is split 1.3a/1.3b-style:
- **Story 1.5a** (separate issue and PR) adds the municipality and industry-name columns, the companies-only refresh, the trigram index with its IMMUTABLE `unaccent` wrapper, and the re-exported seed.
- **This half** builds on them and adds no migration.

**Decisions (human, 2026-10-14):**
- **Demo links A and B:** placeholders until Story 5.4, held in one constant in `src/demo-companies.ts`. Both are real seed companies with a `SELSKAP` filing in NOK for 2025, and all three API figures are computable (`sumEiendeler` > 0, revenue > 0). A comment gives each one's orgnr, its name and why it was chosen, and says the links are temporary until 5.4. The PR says so too.
- **Companies without a municipality (human, 2026-10-14):** 504 of the 17 557 stored companies have no `forretningsadresse_kommune` in the seed from 1.5a: 491 `NUF` and 3 `FLI` without a Norwegian business address, and 10 not found in the bulk file. Search must still return them, and show the result line without a municipality: "orgnr · industry", with no empty separator and no placeholder. The same applies to a NULL `naeringskode1_beskrivelse`: show the code alone. A test covers both.
- **Front-page copy (human, 2026-10-15):** `h1` "Se hva gapet til sammenlignbare selskaper er verdt i kroner"; lead "Peerless dekker foreløpig {industry}." (never a count of industries, so it stays true as coverage grows); label "Navn eller organisasjonsnummer", no placeholder; button "Sammenlign"; step 1 "Søk opp selskapet" / "Skriv inn navn eller organisasjonsnummer. Vi bruker regnskapet selskapet har levert til Brønnøysundregistrene."; steps 2–3, the "Slik fungerer det" heading and the link "Les hvordan Peerless velger sammenlignbare selskaper og regner ut tallene" as in `mockups/messages-v1.nb.json`.
- **Industry name from the register (human, 2026-10-15):** `{industry}` is built from `register.covered_industry.code` and the register's `naeringskode1_beskrivelse` for that code: lead "62.100 Dataprogrammeringstjenester"; mid-sentence in the no-match and unknown-orgnr copy "dataprogrammeringstjenester (62.100)" (first letter lower-cased). No industry name or code is a literal in `src/`. The AC in `epics.md` Story 1.5b and issue #6 is corrected to say the name comes from the register.
- **Municipality casing (human, 2026-10-15):** shown title-cased at display only, through a pure formatter; the database keeps the register's value and names are shown as stored. Tested: `AURSKOG-HØLAND` → `Aurskog-Høland`, `PORSANGER - PORSÁŊGU - PORSANKI` → `Porsanger - Porsáŋgu - Porsanki`, `KÅFJORD - GÁIVUOTNA - KAIVUONO` → `Kåfjord - Gáivuotna - Kaivuono`.
- **Server-side validation (human, 2026-10-15):** `/api/sok` validates `q` itself: over 100 characters → 400 with no database query; nine digits (spaces stripped) failing mod 11 → 400 with no database query. Name text used in `LIKE` has `%`, `_` and `\` escaped; a test proves the search "%" does not return every company.
- **Header search:** `SearchField` gets a compact variant now, with its own test: it renders, has the label, and sends the same search. The header stays unchanged. Story 1.6b mounts the variant, and `epics.md` 1.6b says so. A `deferred-work.md` entry points to 1.6b.

## Boundaries & Constraints

**Always:**
- **The reader client.**
  - `READER_DATABASE_URL` is read only in `src/server/db.ts`.
  - That file starts with `import 'server-only'` and holds one client per process on `globalThis`.
  - `int8` and `numeric` stay strings. A read-types test goes through this client (deferred from 1.4).
- **`/api/sok`.**
  - It returns at most 8 rows of exactly `navn`, `orgnr`, `naeringskode1` (`{kode, beskrivelse}`), `kommune`.
  - Its query is parameterised and reads no financial column.
  - It makes no network call.
  - On a database error it returns 500 with no detail.
- Copy lives in `nb.json` and is read through `t()`, which gains `{name}` interpolation. The coverage code comes from `register.covered_industry` and is never a literal.
- No horizontal body scroll at 375 and 320 px. Targets are ≥ 24 px. No client import of `src/server` or `postgres`.

**Never:**
- No migration (1.5a).
- No analysis page and no `/slik-fungerer-peerless` page (1.6b). Links to them may 404 until then.
- No rate limit (1.10).
- No server action.
- No `NEXT_PUBLIC_` variable.
- No browser storage.
- No register call at request time.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error Handling |
|---|---|---|---|
| valid orgnr | spaces allowed, mod 11 ok | exact lookup | — |
| mistyped | nine digits failing mod 11 | "Ugyldig organisasjonsnummer" on submit/blur | border, glyph, `aria-invalid` |
| wrong length | 8 or 10 digits | "Organisasjonsnummeret må ha 9 siffer" | same |
| name w/ digits | `"1881 Media"` | name search | — |
| empty | `""` / spaces | "Skriv inn et navn eller et organisasjonsnummer", no request | — |
| typing | 300 ms pause, name ≥ 2 chars | one request, ≤ 8 options, "{n} treff" | no navigation on input |
| typing digits | fewer than 9 digits | no request, no error | — |
| exact submit | valid orgnr in DB | navigate `/analyse/{orgnr}` | — |
| unknown orgnr | valid, not in DB | not-in-database copy + demo links | — |
| no match | name, 0 rows | "Ingen treff på «{q}». …" + demo links | — |
| failure | 500 / network | `role="alert"` "Noe gikk galt. Prøv igjen om litt." | no partial list |
| too long | `q` > 100 chars | 400, no DB query | the field has `maxLength` 100 |
| bad orgnr at API | nine digits failing mod 11 | 400, no DB query | — |
| wildcards | `"%"`, `"_"` | escaped; matched literally, not all companies | — |
| accents | `"aerlig"` vs `"Ærlig"`, `"sondre"` vs `"Søndre"` | matched through `unaccent` | — |

</frozen-after-approval>

## Code Map

- `src/messages/index.ts` -- `t(id)`; add `t(id, vars)` replacing `{name}`; missing var throws.
- `src/messages/nb.json` -- three keys today; all new copy goes here.
- `src/engine/format.ts:101` `formatOrgnr` -- reuse for the 3-3-3 orgnr in options. New validator in `src/engine/orgnr.ts`.
- `src/app/page.tsx` -- empty `<main id="innhold">`; becomes a server component reading coverage at request time (`connection()` / dynamic), not prerendered.
- `src/app/layout.tsx`, `globals.css` -- tokens: `input-border`, `unfavourable`, `navy-700`, `surface`, `slate`, `front-hero-top(-phone)`, `target-min`; no new colours.
- `src/components/site-header.tsx` -- unchanged. `site-footer.tsx` -- append " · " + link `/slik-fungerer-peerless#kilder` ("Kilder og lisens").
- `supabase/migrations/20261014120000_register_company_search.sql` -- `register.immutable_unaccent(lower(navn))` GIN trgm index; orgnr is the PK (exact index). `register.covered_industry(code)`; industry name from `register.company.naeringskode1_beskrivelse`.
- `eslint.config.mjs`, `eslint-rules/client-restricted-imports.mjs` -- already ban `postgres`/`src/server` in engine and `'use client'`.
- `test/db/read-types.test.ts` -- opens its own client; add a case through `src/server/db.ts` (deferred from 1.4). `test/db/db-env.ts` `setting()`.
- `test/no-hardcoded-copy.test.ts`, `test/no-industry-literal.test.ts`, `scripts/check-no-public-env.ts:109` `listRepositoryFiles` -- reuse for the reader-URL grep (scope `src/`, `next.config.*`).
- `vitest.config.ts` -- node env, no jsdom: the combobox is tested in Playwright.
- `e2e/shell.spec.ts` -- scroll/viewport pattern; CI seeds before build/e2e (`ci.yml`), and `.env` from `db:roles` gives Next `READER_DATABASE_URL`.
- `.env.example` -- already documents `READER_DATABASE_URL` for `src/server/db.ts`.
- `package.json` -- add `server-only` (exact pin).

## Tasks & Acceptance

**Execution:**
- [x] `src/engine/format.ts` `formatKommune` + tests -- title-case per word, after spaces and hyphens, `toLocaleLowerCase('nb')`.
- [x] `src/engine/orgnr.ts` + `test/engine/orgnr.test.ts` -- `classifySearchInput(raw)` → `empty | name | orgnr | length | checksum`; spaces stripped; mod 11 (weights 3,2,7,6,5,4,3,2; remainder 0 → check 0, 1 → invalid).
- [x] `src/messages/index.ts`, `nb.json` + test -- interpolation and all copy.
- [x] `src/server/db.ts` -- `import 'server-only'`; one `postgres` client on `globalThis`; throws if unset.
- [x] `src/server/search.ts` -- `searchCompanies(q)`, `coveredIndustries()`; parameterised, selects only the four fields.
- [x] `src/app/api/sok/route.ts` -- GET only; empty/1-char `q` → `[]`; error → 500 `{}`.
- [x] `src/components/search-field.tsx` (`'use client'`, `variant: 'hero' | 'compact'`), `src/demo-companies.ts`, `src/app/page.tsx`, `site-footer.tsx`.
- [x] Tests: `test/api-sok.test.ts` (mocks `src/server/search`, asserts keys, ≤ 8, no `fetch`); `test/db/search.test.ts` (accents, prefix, orgnr, NULL kommune/beskrivelse, `%`/`_` escaping, limit, plan uses index on an `enable_seqscan=off` check); read-types via app client; `test/reader-url.test.ts`; `scripts/check-routes.ts` + `pnpm check:routes`, run in CI right after `pnpm build` (reads the `.next` route and server-reference manifests; fails when unbuilt), with a unit test of its matcher; `e2e/search.spec.ts` (combobox keys, live region, errors, empty, no match, unknown orgnr, failure via `page.route`, 375/320 px, 24 px targets); compact variant per Design Notes.
- [x] `epics.md` Story 1.5b + issue #6 -- industry name in the no-match/unknown-orgnr AC comes from the register.
- [x] Docs: `AGENTS.md`, `docs/ai-log.md`, session file, `deferred-work.md` → 1.6b, sprint-status.

**Acceptance Criteria:**
- Given issue #6's ACs and the decisions above, when `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e` run on a seeded DB, then all pass.

## Design Notes

**Name match:** `where register.immutable_unaccent(lower(navn)) like '%' || $esc || '%' or $q <% register.immutable_unaccent(lower(navn))`, order by `word_similarity` desc, `navn`, `orgnr`, `limit 8`; `q` folded by the same wrapper. Typeahead prefixes are short, so plain `%` similarity misses them.

**Submit:** valid orgnr → `/api/sok?q=<orgnr>`; one exact row navigates; none → unknown-orgnr copy. A name opens the list.

**Compact variant test:** no extra route is allowed, so the variant is covered by a server-rendered markup test (`react-dom/server` `renderToStaticMarkup`: label, combobox role, same `/api/sok` endpoint constant) rather than in the browser; 1.6b's e2e covers it mounted.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- pass
- `pnpm db:start && pnpm db:roles && pnpm seed && pnpm test:db` -- pass
- `pnpm build && pnpm check:routes && pnpm test:e2e` -- pass

## Implementation Notes

- Implementation subagent decisions: CI loads the seed before `pnpm test:db`; `/api/sok` answers 400 for any digits-only length ≠ 9; ENK municipalities returned (risk in ai-log); option line shows "code name"; typing a valid orgnr shows its row but never navigates; compact variant has a visually hidden label.
- Human (2026-10-15): the first e2e "%" test passed for the wrong reason (one character returns `[]` before any query); now "%%" and "_%".

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | edge | Enter during debounce opens `results[active]` from the previous query | medium | `onChange` keeps `active`; `onSubmit` opens `results[active]` while expanded | patch |
| 2 | edge | onSubmit uses stale results for a changed value | medium | same root cause as 1 | patch (with 1) |
| 3 | edge | Listbox opens after blur when a debounced search lands | low | `showResults` sets `expanded` with no focus check; tab away within 300 ms | patch |
| 4 | edge | `busy` never cleared if the field stays mounted after `router.push` | maybe-false | Hero unmounts on navigation; matters when 1.6b mounts the compact variant in the persistent header | defer (1.6b) |
| 5 | edge/blind/gap | One-character submit shows "Ingen treff" without a request | low | Real, but the API defines one character as `[]`; one-character company names are not met in use; fix needs new copy | reject |
| 6 | edge/blind | Front page errors if the DB is down | low | Every v1 surface needs the seeded DB (README); Next shows its error page | reject |
| 7 | edge/blind | Empty `covered_industry` renders "bare selskaper i ." | low | Only on an unseeded DB, where nothing works | reject |
| 8 | edge | NUL in `q` gives 500 | low | Only by a hand-made request; one fixed log line | reject |
| 9 | edge/blind | `lowerFirst` would give "iT-…" for an acronym | low | The only covered industry has no acronym; hypothetical | reject |
| 10 | edge | No-break-space test passes no no-break space | low | `test/engine/orgnr.test.ts:47-50` | patch |
| 11 | edge | Industry name literal in a `format.ts` comment | low | `lowerFirst` doc comment; decision says no literal in `src/` | patch |
| 12 | blind | ENK count 6 287 vs 6 258 | false | Current seed: 6 287 `ENK` of 17 557; 6 258 is 1.5a's earlier count | reject |
| 13 | blind | ai-log says "Two-to-eight digits" get 400 | low | Route returns 400 for any digits-only length ≠ 9 | patch |
| 14 | blind | ai-log "Problem: None found" omits corrected AI output | medium | Session file lists the invalid orgnr and similarity-matched wildcard tests; the human found the "%" e2e test passing for the wrong reason | patch |
| 15 | blind | `q=5` → 400 but `q=a` → `[]` | false | Intended: digits only are never a name (FR-1) | reject |
| 16 | blind | No `statement_timeout` on the open endpoint | medium | `src/server/db.ts` sets none; slow queries can hold all 5 connections until 1.10 | patch |
| 17 | blind | Listbox `aria-labelledby` points at the input | medium | `search-field.tsx:343`; a referenced input contributes its value, not its label | patch |
| 18 | blind | Ordering by similarity/navn/orgnr untested | low | Only determinism tested | reject |
| 19 | blind | `parseResults` malformed-200 untested | low | Defensive path; no server emits it | reject |
| 20 | blind | Demo-company comment claims margin signs untested | low | Comment only; 5.4 replaces | reject |
| 21 | blind | New links 404 without README warning | low | README names only `/analyse`; a grader clicks the footer | patch |
| 22 | blind | Spec `created` date rewritten | low | Fix edits this spec | reject |
| 23 | blind | Spec `in-review` vs sprint `review` | false | Different vocabularies by design | reject |
| 24 | blind | Session file "PR to follow" | false | Filled when the PR opens | reject |
| 25 | blind | Text casing in `src/engine/format.ts` | false | `format.ts` is the display module (`formatOrgnr`); Code Map put it there | reject |
| 26 | blind | e2e exact pixel heights, fixed waits | low | Heights are DESIGN.md values; waits prove absence of a request | reject |
| 27 | blind | api-sok fixture uses invalid orgnrs | low | Route does not validate rows; no harm | reject |
| 28 | gap | NULL `beskrivelse` display never rendered in a test | medium | Decision says a test covers both; only NULL kommune is rendered | patch |
| 29 | gap | `joinList` untested | low | Lead depends on it as coverage grows; direct unit test | patch |
| 30 | gap | Nothing asserts `/` is not prerendered | medium | Removing `connection()` passes every check | patch |
