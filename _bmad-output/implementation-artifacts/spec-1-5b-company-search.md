---
title: 'Story 1.5b: Find a company by name or organisation number'
type: 'feature'
created: '2026-10-14'
status: 'draft'
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
| accents | `"aerlig"` vs `"Ærlig"`, `"sondre"` vs `"Søndre"` | matched through `unaccent` | — |

</frozen-after-approval>

## Code Map

To be re-checked when this spec is resumed, after 1.5a merges:
- `src/messages/index.ts` + `nb.json` -- `t(id)`, with no interpolation yet.
- `src/engine/format.ts:101` `formatOrgnr` -- there is no validator. Add `src/engine/orgnr.ts`, which the 1.6a URL module will import.
- `src/app/page.tsx` (empty `<main id="innhold">`), `layout.tsx`, `globals.css` `@theme` (Tailwind v4).
- `src/components/site-header.tsx`, `site-footer.tsx` -- "Kilder og lisens" becomes a link to `/slik-fungerer-peerless#kilder`.
- `eslint.config.mjs:9-26`, `eslint-rules/client-restricted-imports.mjs` -- already ban server imports in client modules.
- `test/no-hardcoded-copy.test.ts` (scans `.tsx` in `src/app`, `src/components`), `test/no-industry-literal.test.ts` (bans `62.100` in `src/`), `scripts/check-no-public-env.ts:109` `listRepositoryFiles` -- reuse it for a grep test scoped to `src/`, because scripts and `test/db` legitimately read the variable.
- `vitest.config.ts` -- node env, no jsdom or testing-library, so the combobox is tested in Playwright.
- `playwright.config.ts`, `e2e/shell.spec.ts:23-29` -- the scroll check. In CI the DB is seeded during e2e (`ci.yml:103-110`).
- `package.json` -- add `server-only` (exact pin).

## Tasks & Acceptance

**Execution:**
- [ ] `src/engine/orgnr.ts` + test -- strip spaces; digits-only with a length ≠ 9 → `length`; mod 11 with weights 3,2,7,6,5,4,3,2 → `checksum`.
- [ ] `src/messages/*` -- interpolation and all the copy.
- [ ] `src/server/db.ts`, `src/server/search.ts`.
- [ ] `src/app/api/sok/route.ts`.
- [ ] `src/components/search-field.tsx` (hero + compact).
- [ ] `src/app/page.tsx`, `src/demo-companies.ts`, the footer link.
- [ ] Tests:
  - API keys, limit and no-network;
  - `test/db/search.test.ts`;
  - read-types through the app client;
  - the reader-URL grep;
  - the route manifest after build;
  - `e2e/search.spec.ts`, plus the compact variant.
- [ ] Docs:
  - `AGENTS.md`;
  - `docs/ai-log.md`;
  - the session file;
  - the `deferred-work.md` entry pointing to 1.6b;
  - sprint-status.

**Acceptance Criteria:**
- Given issue #6's ACs, when `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm build && pnpm test:e2e` run on a seeded DB, then all pass.

## Design Notes

**Name match:** use `word_similarity` (`<%`) plus a `like '%q%'` on `register.immutable_unaccent(lower(navn))`. Order by similarity desc, then `navn`, then `orgnr`, with `limit 8`. Escape `%` and `_` in `q`. Typeahead queries are short prefixes of longer names, so plain `%` similarity misses them.

**Submit:** a valid orgnr makes an exact request, and one row navigates to it. A name opens the result list.
