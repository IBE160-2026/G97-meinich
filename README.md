# G97 — HackAIthon

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Medlemmer

- Christian Meinich

## Running Peerless locally

Requires Node 24.21.0 (see `.nvmrc`). pnpm 12.11.2 comes from `packageManager` in `package.json` through corepack; no API key, account or hosted service is needed.

The app reads the local database, so Docker must be running (see "Local database" below).

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm db:start         # local Postgres with the roles, schemas and register tables
pnpm db:roles         # writes the role passwords, READER_DATABASE_URL among them, into .env
pnpm seed             # loads the committed demo seed
pnpm build
pnpm start            # http://localhost:3000
```

The front page searches the companies in the local database by name or organisation number; it never calls the register. Choosing a company opens `/analyse/{orgnr}`, the analysis; `/slik-fungerer-peerless` explains the method and the sources.

Run the production build with `pnpm start`, as above, not `next dev`: the rate limit below and every test assume the built app.

**Rate limit.** Every request the server answers (pages, their RSC payloads and prefetches, 404s and `GET /api/sok`) is counted per client address in `src/proxy.ts`: 60 analysis and 60 search requests a minute (`src/rate-limit/budgets.ts`). Over budget, a page answers 429 with "Det er gjort mange oppslag fra denne adressen på kort tid. Vent litt, og prøv igjen." and no figures, and the search field shows the same text. No address is stored: the counters hold salted hashes in memory only, and the logs (one JSON line per event, `src/logger.ts`) carry no address, header or path. Known v1 limitations:

- The counters live in the one `next start` process. They are not shared between processes or serverless instances and are lost on restart.
- The window is fixed, not sliding: one address can send a full budget at the end of one window and another at the start of the next, up to twice the budget within a minute.
- The address is the rightmost `X-Forwarded-For` entry. With no proxy in front, `next start` fills that header from the socket only when the client sent none, so a client can choose its own key. That buys it a budget of its own, but it cannot lift the limit for anyone else.
- **Persistent rate limiting is a gate before any public deployment** (technical note, AD-10): the limit must be shared across instances; the client address must be read from what the hosting platform sets, not from a header the client can send, with a test that a client-set `X-Forwarded-For` does not lift anyone else's limit; and an IPv6 address must be keyed by its /64 prefix, since one client usually holds a whole /64.

Checks, as CI runs them on every pull request:

```sh
pnpm check:pins       # every dependency pinned exactly, no ^ or ~
pnpm check:env        # no NEXT_PUBLIC_ variable in source or config (AD-19)
pnpm lint
pnpm typecheck
pnpm test             # Vitest unit tests
pnpm exec playwright install chromium   # once
pnpm build && pnpm check:routes         # the built app serves only the allowed routes, no server action
pnpm test:e2e                           # Playwright against the built app and the seeded database, at 375 and 320 px
```

### Local database

Requires Docker. The Supabase CLI (2.120.0) is a pinned dev dependency, so no global install, account or API key is needed.

```sh
pnpm db:start         # local Postgres; applies supabase/roles.sql and supabase/migrations
pnpm db:roles         # creates .env from .env.example if missing, generates the role passwords into it, applies them
pnpm seed             # load the committed demo seed (see "Seed" below)
pnpm test:db          # grants, db:roles, seed and search tests against the seeded database (all rolled back)
pnpm db:reset         # recreate the database from the migrations; run pnpm db:roles again afterwards
pnpm db:stop
```

`pnpm db:roles` never prints a password, never overwrites one already in `.env`, refuses unless `.env` is gitignored, and refuses any database host other than `127.0.0.1` or `localhost`. Running it again leaves `.env` and the passwords unchanged.

### Batch step 1: register data

Step 1 fetches Enhetsregisteret data and the key-figures API filings for every company whose primary industry is declared in `seed/coverage.json`, plus demo company C (`ingest/config.toml`), and stores them as filed, in øre, as the `ingest` role. It is a manual batch run; the app never calls the register. The register is free and needs no key.

Requires Docker, and [uv](https://docs.astral.sh/uv/) 0.12.10 for the tests (uv installs Python 3.14 from `ingest/.python-version`).

```sh
pnpm db:start && pnpm db:roles   # the database and INGEST_DATABASE_URL in .env
pnpm test:ingest      # fixture and contract tests: recorded responses, no network; database tests roll back
pnpm ingest           # builds ingest/Dockerfile and runs it once against the local database
pnpm ingest --companies-only   # refreshes only the search fields of companies already stored
```

`pnpm ingest --companies-only` streams the bulk download and fills the business municipality (number and name) and the primary industry's name on the companies already in `register.company`. The name is stored only when the register's primary code still equals the stored one; otherwise it is NULL, and the company is named in the summary. It adds and deletes no company, touches no filing, and leaves every other column, `navn` and `read_at` included, unchanged; `search_fields_read_at` records when the three were read. Its summary gives the number updated and names every stored company not found in the bulk file, which it leaves untouched. It accepts no other argument.

`pnpm ingest` streams the register's bulk download (about 210 MB), then requests each company's key figures with a short pause between requests, so a full run takes a while. It prints a summary per industry code, names any code the register returned nothing for (an SN2007 code, for example), and names every filing it rejected or failed to write. Inside the container a local database host is reached as `host.docker.internal`.

### Seed

The demo seed is the register data from a step-1 run, committed in `seed/demo/`: one CSV file per table (`company.csv`, `filing.csv`, `key_figures.csv`) and `manifest.json`, which records the seed-format version, the latest migration, the dataset, the industry codes fetched, the orgnrs with document figures, the read-date range and each file's SHA-256. `seed/coverage.json` declares the covered industries and is the only hand-edited file under `seed/`; `seed/allow-list.json` is written by the export.

```sh
pnpm db:start && pnpm db:roles   # the database and LOADER_DATABASE_URL in .env
pnpm seed             # check everything, then truncate and replace every register table, as loader
```

`pnpm seed` checks the manifest version, that the manifest's migration is the latest file in `supabase/migrations`, that every file in `seed/demo/` is listed with a matching checksum, the shape of `seed/coverage.json`, that every declared industry was fetched, and that a `measured: true` entry cites an existing report under `analysis/output/` with a matching SHA-256. Any failure exits non-zero, names the entry and the check, and loads nothing. Then it loads in one transaction, writes `register.covered_industry` from `seed/coverage.json` and stores the manifest in `register.dataset`. Running it twice leaves the same state. CI runs it twice on a freshly migrated database on every pull request.

**Exporting.** After a step-1 run, `pnpm seed:export` writes `seed/demo/` and `seed/allow-list.json` from the local database as `reader`. It is deterministic: rows in primary-key order with `COLLATE "C"`, so the bytes never depend on the database's collation, and dates and `read_at` in UTC ISO form. Running it twice on the same database gives byte-identical files. It never writes `seed/coverage.json`.

**A new migration invalidates the seed.** The seed records the latest migration, and `pnpm seed` refuses a seed exported under an older one. The pull request that adds a migration therefore re-exports the seed in the same pull request, on a loaded database and without a reset:

```sh
pnpm exec supabase migration up   # apply the new migration; the loaded data stays
pnpm seed:export                  # commit the changed seed/demo/ with the migration
```

**Recovering an empty local database without a new step-1 run.** If the seed matches the latest migration, `pnpm seed` restores the data. If a new migration is already in the tree and the seed has not been re-exported, load the old seed with the old loader on the old schema, then migrate and export:

```sh
git worktree add ../peerless-seed <last commit whose seed matched>
cp .env ../peerless-seed/.env
cd ../peerless-seed && pnpm install && pnpm db:reset && pnpm db:roles && pnpm seed
cd -   # back in the main tree
pnpm exec supabase migration up
pnpm seed:export
git worktree remove ../peerless-seed
```

Never run `pnpm db:reset` on the only database holding data that is not yet exported and committed.

If your Node install blocks the `pnpm` shim that `corepack enable` writes, prefix each command with `corepack` instead (`corepack pnpm install …`).

## Product Brief

[_bmad-output/planning-artifacts/briefs/brief-Peerless-2026-09-17/brief.md](_bmad-output/planning-artifacts/briefs/brief-Peerless-2026-09-17/brief.md)

## Technical Note: Architecture

[_bmad-output/planning-artifacts/technical-note-architecture.md](_bmad-output/planning-artifacts/technical-note-architecture.md)

## Data Sources: Brønnøysundregistrene

[docs/data-sources-brreg.md](docs/data-sources-brreg.md)

## Key Figures

[docs/key-figures.md](docs/key-figures.md)

## AI Log

[docs/ai-log.md](docs/ai-log.md)

## AI Sessions

[docs/ai-sessions/](docs/ai-sessions/) — one file per working session with an AI tool, linked from the pull request or commit it produced

[docs/ai-prompts.md](docs/ai-prompts.md) — the prompts sent to the AI, verbatim, and what each one changed

## To-do

[docs/todo.md](docs/todo.md)

## Analysis: Industry Screening

[analysis/output/industry-screening.md](analysis/output/industry-screening.md)

## Analysis: OCR of Filed Accounts

- [analysis/output/filing-eras.md](analysis/output/filing-eras.md) — paper versus generated filings, by year
- [analysis/output/ocr-consistency.md](analysis/output/ocr-consistency.md) — how consistently the generated section reads, by era
