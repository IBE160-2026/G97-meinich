# AGENTS.md

Project instructions for Peerless. Read this before writing code. `CLAUDE.md` imports this file, so Claude Code picks it up automatically.

## What this is

Peerless benchmarks a Norwegian company against genuinely comparable peers using public accounts data. The user enters an organisation number; the app assembles a peer group, computes ratios, converts every deviation into kroner, and lets the user explore what closing each gap would be worth.


**Read alongside this file:**
- `_bmad-output/planning-artifacts/briefs/brief-Peerless-2026-09-17/brief.md` — what the product is and who it serves
- `_bmad-output/planning-artifacts/technical-note-architecture.md` — architecture, test strategy, schedule
- `docs/data-sources-brreg.md` — data sources, verified field sets, API pitfalls
- `docs/key-figures.md` — every key figure's formula, source, direction and kroner translation

**These four are hand-written and authoritative.** They were not produced by a BMAD workflow, but they sit where BMAD expects its own output, so its skills read and update them instead of creating rivals.

The brief in particular occupies a canonical run folder — `brief-Peerless-2026-09-17/` holding `brief.md` with frontmatter and a seeded `.memlog.md`, matching `{planning_artifacts}/briefs/brief-{project_name}-{date}`. `bmad-product-brief` in **Update** or **Validate** intent therefore targets it directly. The same folder holds `addendum.md`: detail moved out of the brief to keep it short. It is kept, not authoritative — where it disagrees with the brief or the other three documents, they win. Do not invoke it with **Create** intent: that opens a second run folder and leaves two briefs that do not know about each other. If a workflow does produce a parallel artifact anyway, fold anything worth keeping back into the document above and delete the generated one rather than maintaining both.

The same applies to changes: when a finding or decision makes one of these wrong, edit it. Do not append a correction elsewhere and leave the original standing.

## Stack

**The application:** Next.js (App Router) + TypeScript. Supabase for Postgres, auth and row-level security. v1 runs locally from the README; Vercel and hosted Supabase come with stage 2. No request-serving backend service — all server-side code a user can reach lives in the Next.js app.

**The ingestion pipeline, in two batch steps.** Step 1 is Python 3.14 in `ingest/`, managed with `uv` 0.12.10 and a committed `uv.lock`, with every dependency pinned `==` (`ingest/tests/test_pins.py`), and run in a Docker image pinned by tag (`pnpm ingest`; tests `pnpm test:ingest`). It is containerised because Tesseract needs a system binary: it bulk-loads register data, OCRs and reconciles the filed documents, and writes raw figures as filed, in øre, as the `ingest` role through `INGEST_DATABASE_URL`. It runs no DDL, and the industries it fetches come from `seed/coverage.json`, never from code. `pnpm ingest --companies-only` (the only argument it accepts) reads just the bulk download and refreshes the search fields — business municipality and primary-industry name, with `search_fields_read_at` — on companies already stored, adding, deleting and otherwise changing nothing. Step 2 is Node scripts in this repository: it uses `src/engine` to compute fingerprints and default analyses, calls the model for classification and explanation, and runs the figure-validation test against the same engine. Both write to Postgres directly, are never in a user's request path, and nothing a user can reach may depend on either being up.

Keep that boundary. Python earns its place on OCR and document processing only and never computes a ratio — there is one engine, `src/engine`. Next.js reads public data server-side as a SELECT-only role; from stage 2, user data is reached through Next.js with the user's own token under row-level security. The binding decisions are AD-1 to AD-19 in the technical note's "Architecture invariants".

Use TypeScript strictly. Types are how we keep financial data from drifting; do not reach for `any`.

**Toolchain.** Node from `.nvmrc`, pnpm from `packageManager` (via corepack), every dependency pinned exactly — `pnpm check:pins` fails on `^` or `~`. Unit tests run in Vitest (`test/**/*.test.ts`), rendered-page tests in Playwright (`e2e/`, against `pnpm build && pnpm start`). CI is GitHub Actions (`.github/workflows/ci.yml`): pins, `pnpm check:env` (no `NEXT_PUBLIC_` variable and no `env` key in `next.config.*`; AD-19), lint, typecheck, unit tests, local Postgres (`pnpm db:start`, `pnpm db:roles`), the committed demo seed loaded twice (`pnpm seed`) and re-exported unchanged (`pnpm seed:export`), the database tests against that loaded database (`pnpm test:db`, `test/db/`, kept out of `pnpm test`; the search tests need the seed), the step-1 tests against that loaded database (`pnpm test:ingest`; they pass on an empty or a seeded database) and the image, build, `pnpm check:routes` (the built route manifests hold only `GET /`, `/slik-fungerer-peerless`, `/analyse/{orgnr}`, `/analyse/{orgnr}/{fane}` and `GET /api/sok`, and no server action), e2e. Seed files are written only by `pnpm seed:export` and read only by `pnpm seed` (AD-16); a PR that adds a migration re-exports the seed in the same PR (README, "Seed"), and `.gitattributes` keeps `seed/**` and `analysis/output/**` byte-exact (`-text`) because they are checksummed. The Supabase CLI is the pinned dev dependency `supabase`; In `.sql` files, `CREATE`/`ALTER`/`DROP` statements live only in `supabase/migrations`, and `supabase/roles.sql` holds only `CREATE ROLE`, both without passwords (`test/no-ddl-outside-migrations.test.ts` checks exactly this). Outside `.sql` files, `pnpm db:roles` may only run `ALTER ROLE … PASSWORD`, and only against a local database; it writes the local role passwords into the gitignored `.env`. The database tests also create objects, but only inside transactions they roll back. `test/db/grants.test.ts` loops over every relation in `register`: a migration adding one is covered without editing the test, a new table must be granted SELECT, INSERT and TRUNCATE to `loader` and added to `SEED_TABLES` or `LOADER_TABLES` in `scripts/seed-format.ts` (or `pnpm seed` refuses), and a function `reader` must call needs an explicit `GRANT EXECUTE`. A function in an index expression is also called by every role that writes the table — Postgres evaluates the expression as the writer — so `register.immutable_unaccent` is granted to `reader`, `ingest` and `loader`, with USAGE on schema `extensions`, where `pg_trgm` and `unaccent` live (`test/db/company-search.test.ts`). ESLint bans `Intl.NumberFormat` in `src/**` and `scripts/**`, `Math.round`/`toFixed` (and `Intl.NumberFormat`) in `src/engine/**` and `*format*` files, `toFixed`, `toDecimalPlaces`/`toDP`, `toSignificantDigits` and `toLocaleString` in `src/app/**` and `src/components/**` (`test/lint.test.ts`), and imports of `src/server` or `postgres` from the engine and from `'use client'` modules. Every displayed number goes through `src/engine/format.ts`. Decimals come from decimal.js `10.6.0` through the one configured constructor in `src/engine/decimal.ts` (precision 40, half away from zero); no other module imports decimal.js or calls `clone`/`config`/`set` on it, and no second decimal library is added (`test/no-other-decimal.test.ts`). postgres.js returns `int8` and `numeric` as strings; parse them with `parseOre`/`parseDecimal` in `src/engine/inputs.ts`, never `Number()`. The request path's one database client is `readerSql()` in `src/server/db.ts`, the only file that reads `READER_DATABASE_URL`, and it connects with `default_transaction_read_only` on; every module in `src/server` begins with `import 'server-only'` (`test/reader-url.test.ts`), and the database tests alias that package to its server entry (`vitest.db.config.ts`). No request-path file (`src/app`, `src/server`, the proxy) names `SUPABASE_SERVICE_ROLE_KEY` or the service role, and `.env.example` has that variable only commented out (`test/service-role.test.ts`). The orgnr rules (spaces stripped, nine digits, modulus 11) live once, in `src/engine/orgnr.ts`. The analysis URL is read and written only by `parse`, `parseSegments` (route segments as a page receives them) and `serialize` in `src/url/analysis-state.ts`, which imports only from `src/engine`; no other file in `src/` contains the `/analyse/` path, `parse` reads `band` before `ekskl` and asks `ParseContext.isCandidate(peer, band)` — the candidate pool (funnel stages 1–3, `src/engine/peers.ts`) depends on the band, and a caller cannot close over a band `parse` has not read yet — a rejected `ekskl` item is dropped, an unknown tab becomes `oversikt`, and any other invalid value falls back to its default, each setting one `invalidSettings` flag; unknown query parameters are ignored without it (`test/url/analysis-state.test.ts`, `test/url-module-boundary.test.ts`). Which state an analysis URL opens in is decided by the pure `analysisView` in `src/analysis/view.ts` (precedence: no filing, uncovered, not an AS, covered); the subject lookup, the one candidate read for a covered AS (`lookupCandidates`, needed because an `ekskl` outside the pool sets the notice), every 404 and every redirect happen before any Suspense boundary renders, because once a fallback renders the response is a streamed 200 — so the analysis loading state is a Suspense boundary inside the page, not a `loading.tsx`. A failed subject or candidate read, or a failed coverage read for an uncovered company (also read before the boundary), throws an error with a fixed message (the log line names only its class and SQLSTATE): Next.js answers 500 and `src/app/analyse/error.tsx` shows the `role="alert"` lookup-error state and no error detail (`e2e/db-down.spec.ts`, against a second server whose database is unreachable); `src/app/global-error.tsx` shows the same state for an error the root layout throws, and for the front page's failed coverage read, which throws a fixed message the same way. Every request except `_next/static` and `_next/image` passes `src/proxy.ts`, which counts it per client address against the search (`GET /api/sok`) or the analysis budget set once in `src/rate-limit/budgets.ts` — in memory on `globalThis`, keyed by a salted hash, never stored — and answers one over budget itself with 429 and the refusal, before any page or query runs (AD-10); the e2e specs import `test` from `e2e/fixtures.ts`, which gives each test its own `X-Forwarded-For`. `src/logger.ts` is the only module in `src` that calls `console`: one JSON line per event with a closed set of fields and no address, header or path (`test/logger.test.ts`). User-facing copy lives in `src/messages/nb.json`, read through `t(id, vars)` by dotted id, its `{name}` placeholders filled from `vars` (a missing one throws); a test fails on hard-coded strings in `src/app` and `src/components`. Industry codes and names in copy come from `register.covered_industry` and the register's `naeringskode1_beskrivelse` (`src/messages/industry.ts`), never from a literal.

*The stack may change as the course progresses. If it does, update this file.*

## Non-negotiable rules

**Money is never a float.** Store and compute in integer øre, or use a decimal library. `0.1 + 0.2 !== 0.3` and the error compounds across periods. This applies to every monetary value, including intermediate results.

**Authorisation lives in the database.** Every table with user-scoped data gets row-level security policies. Never rely on the application layer filtering correctly — assume it will eventually fail and make that insufficient to leak data. Do not write an endpoint whose security depends on remembering to add a `where user_id = ...`. Anonymous visitors are Supabase anonymous users and hold the `authenticated` role — a policy that only checks for an authenticated user lets them in. Every policy on saved or user-entered data must also require `is_anonymous` to be false.

**The model never calculates.** The LLM is used for exactly two things: classifying what a company does, and writing explanatory text about figures the engine already computed. Any number appearing in generated text must exist in the calculation output. This is to be enforced by an automated test that rejects generated text containing figures absent from the engine's output — not by instructing the model and hoping. Once that test exists, do not weaken it.

**Rules before model.** If something can be solved deterministically, solve it deterministically and give the model only what is left over. Both layers are measured separately; that measurement is the project's main result.

**Never select peers on a measure that is benchmarked.** Peer matching may use what kind of business a company is — cost composition, inventory, capitalised intangibles, asset intensity — never how well it performs. Selecting on margin or return makes every gap in that measure close to zero. Any measure used in selection enters only in coarse bands — today cost of goods share and personnel cost share — and is benchmarked within its band.

**Peerless runs without our keys.** A fresh clone must run from the README on a local database with seed data — no API key, paid account, email or hosted service. Anything that calls a model or the register at runtime needs a test mode backed by stored output.

**Secrets never reach the client.** API keys, service-role credentials and database connection strings stay server-side. `.env` is gitignored from commit one.

**This file must match the code.** When a change makes something here wrong — the stack, a rule, a filename — update this file in the same commit. A stale instruction file is worse than none, because it is trusted.

## Known API traps

These are verified behaviours of the Brønnøysund API, not guesses. Full detail in `docs/data-sources-brreg.md`.

**The `år` parameter is silently ignored.** Requesting an earlier year returns the current filing with status 200 and no error. Never trust the requested year — always match on the returned `id` or `regnskapsperiode`.

**An empty XML element is not zero.** `<langsiktigGjeld/>` can come back empty while the real amount is recoverable from the difference against its stated sum. Derive missing components — in `src/engine` only; step 1 stores figures as filed (AD-15) — and do not default to zero.

**The filed documents contain no text layer — every page is an image.** Verified on 264 pages across all 15 available years for the test company. There is no rule-based parsing path; document figures require OCR. And note: a Chromium browser will show you selectable, searchable text anyway, because it runs its own OCR as an accessibility feature. That text is not in the file. Never verify a text layer in a browser.

**Never trust an OCR digit.** Observed substitutions include `이` and `o` for `0`, `l` for `1`, a Cyrillic `Р` inside `RESULTATREGNSKAP`, and lost Norwegian diacritics. The expensive errors were worse: figures split or merged wrongly, giving `722 632 310` for `72 632 310` and `8 335 514` for `833 514`. Nothing crashes; the number is just wrong. Recognition confidence does not help — a generic engine averaged 0.974 while producing all of these.

**Reconcile with two rules, and neither is exact equality.** *Between* sources — document against API — a proportional tolerance, because reporting in thousands or millions introduces scaling error. *Within* a document, a tight absolute bound of a few kroner. Do not demand exactness: the register prints whole kroner rounded from øre, so a stated subtotal can legitimately be a krone off its components. Verified — in the 2025 filing for 979607008, `Sum inntekter`, `Årsresultat` and `Sum gjeld` are each one krone off, while `Sum kostnader` and `Sum kortsiktig gjeld` are exact. A few kroner of absolute slack admits that rounding and still catches recognition errors, which are wrong by orders of magnitude.

**Match companies on organisation number only.** Names change over time — the same orgnr can be a different company name in an older filing.

**Two field names are misspelled in the API.** `sumInnskuttEgenkaptial`, and the object `regnkapsprinsipper` that holds `smaaForetak` and `regnskapsregler`. Do not "fix" either in the parser.

**Industry codes are SN2025, and the filter matches secondary codes.** Old SN2007 codes return nothing. The search API's `naeringskode` filter also matches `naeringskode2` and `naeringskode3`; filter on `naeringskode1.kode` when the primary industry is what you mean.

**Filter for comparability before comparing.** Currency, accounting framework, `smaaForetak`, `avviklingsregnskap`, financial period and `regnskapstype` must match the subject. All are exposed as fields.

## Code conventions

Keep the calculation engine as pure functions — figures in, figures out, no database or framework imports. It must be testable in isolation and readable by someone checking the accounting.

**Key figures are implemented exactly as defined in `docs/key-figures.md`.** A formula changes in the document and the code in the same commit. Cost shares have no kroner amount of their own: they are explained through the margin decomposition against the peer group as a whole, which is never scaled by the closable share or added to the profit uplift.

**The interface is Norwegian (bokmål); everything else is English.** All user-facing copy is written in Norwegian. Documentation, code identifiers and comments are in English, except register field names, which keep the register's own Norwegian.

Name domain concepts in Norwegian where the register does (`driftsresultat`, `sumEgenkapital`), and everything else in English. Do not translate register field names.

Prefer explicit over clever. This code will be read by a sensor who is checking whether the arithmetic is right.

**The site must be responsive.** It has to work down to phone width (~375px), not only on desktop. This is a course requirement, not a preference. The hard part here is that this is a data-dense product — ratio tables with four columns, distribution plots, a peer group list. Let the page reflow and stack to one column when narrow; give tables and charts their own `overflow-x: auto` container so they can be wider than the screen. The page body itself must never scroll horizontally. Check at phone width as you build, not at the end — retrofitting a fixed-width table layout is far more work than designing for reflow from the start.

## Testing

Write the authorisation test suite as soon as user-scoped data exists (stage 2), before any feature that stores it. It attempts every forbidden access pattern — reading another user's data, reaching another workspace, an anonymous session reading or writing saved data, a viewer writing, calling an endpoint unauthenticated — and asserts rejection.

The engine is tested against hand-calculated reference cases built from real filed accounts, including edge cases: negative equity, zero revenue, missing components, non-calendar financial year.

Peer classification is measured as precision and recall against a labelled set, compared to what industry code alone achieves.

## Things not to do

Do not add features that are listed as out of scope in the brief. Scope discipline is part of what is being graded. Do not start stage 2 or stage 3 until v1 runs from a fresh clone.

Do not introduce a second request-serving service, a message queue, or an ORM abstraction layer. The ingestion pipeline is the exception: two batch steps, Python step 1 and Node step 2 (AD-2), and neither is a service — keep it that way.

Do not use browser storage for anything that matters. State that must survive belongs in Postgres.

Do not OCR or fetch documents at query time. OCR takes seconds to tens of seconds per filing; extraction is pre-warmed by the batch job and stored — see the technical note.

## Git workflow

**Planning and documentation may go straight to `main`.** The brief, PRD, technical note, `docs/`, analysis reports and memlogs are committed on `main` with descriptive messages.

**Code goes through issue → branch → pull request, one story at a time.**
- Every story has a GitHub issue that names the story and the FRs it implements.
- Work happens on a branch named `story/<story-id>-<short-slug>`, never directly on `main`.
- The pull request links the issue (`Closes #n`), lists the FRs, says how it was tested, and links the AI session file in `docs/ai-sessions/`.
- Review before merging: read the diff, run the tests, and record in the PR what was found and corrected in AI-generated code. The review comments are part of what is graded.
- **Commit in logical steps, not once per story.** A story lands as several small commits, each a coherent step that type-checks on its own, with a message that says what and why: typically the engine and its tests, then the server and queries, the UI and copy, the e2e tests, the review fixes (always a separate commit), and the docs. The full suite runs before the first push. Never one commit for a whole story: the grading guide counts large commits against the process criterion, and the human reviews the PR one commit at a time.

**AI sessions are saved.** Each working session that produces or changes code or a planning decision gets a file in `docs/ai-sessions/`, following the README there: the goal, the prompts that mattered, what was accepted, rejected or corrected, and links to the issue, PR or commits. `docs/ai-log.md` records the lessons; `docs/ai-sessions/` records the sessions themselves.

**Prompts are saved verbatim.** The human's prompts — to the BMAD session and to the separate review session that checks its output — go into `docs/ai-prompts.md`, each with what it changed and the commit or PR it landed in. The review session adds a section on `main` when the human asks: after a story's PR is merged, or after planning or documentation work committed straight to `main`, where the section links the commits instead of a PR; the BMAD session never edits `docs/ai-prompts.md` and keeps writing its own session file. The prompts are extracted from the Claude Code transcripts, not retyped, and checked for secrets and personal data before commit. When a decision or correction came from the review session, the session file says so; do not credit it to the human's own reading.

## What is graded

The course grades the repository against seven criteria: process and AI steering (30 %), functionality and scope (20 %), quality assurance and testing (15 %), design and UX (10 %), code quality and architecture (10 %), README and runnability (10 %), and repository tidiness (5 %). In practice this means:
- The path from plan to code must be traceable: stories, issues, PRs, small commits, saved prompts, and concrete examples of AI output that was corrected or rejected.
- Review happens in the PR, before merging, and says what was checked and found.
- A grader follows the README on a clean machine for about 15–20 minutes; a step that is missing or fails counts against the README.
- No secrets, build artefacts, stray files or dead code from abandoned attempts in the repository.

## Working style

When you propose a change touching auth, data access or money handling, say what could go wrong with it. That reasoning goes into the project's AI log, `docs/ai-log.md`, following the rules at the top of that file.

If a request conflicts with something in this file, say so rather than following it silently.


