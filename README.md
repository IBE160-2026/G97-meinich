# G97 — HackAIthon

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Medlemmer

- Christian Meinich

## Running Peerless locally

Requires Node 24.21.0 (see `.nvmrc`). pnpm 12.11.2 comes from `packageManager` in `package.json` through corepack; no API key, account or hosted service is needed.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm start            # http://localhost:3000
```

In v1 the app is an empty shell (header and footer). The local database (below) holds the roles, the schemas and the tables batch step 1 writes, empty until step 1 runs; the seed and analysis arrive in later stories.

Checks, as CI runs them on every pull request:

```sh
pnpm check:pins       # every dependency pinned exactly, no ^ or ~
pnpm check:env        # no NEXT_PUBLIC_ variable in source or config (AD-19)
pnpm lint
pnpm typecheck
pnpm test             # Vitest unit tests
pnpm exec playwright install chromium   # once
pnpm build && pnpm test:e2e             # Playwright against the built app, at 375 and 320 px
```

### Local database

Requires Docker. The Supabase CLI (2.120.0) is a pinned dev dependency, so no global install, account or API key is needed.

```sh
pnpm db:start         # local Postgres; applies supabase/roles.sql and supabase/migrations
pnpm db:roles         # creates .env from .env.example if missing, generates the role passwords into it, applies them
pnpm test:db          # grants and db:roles tests against the local database
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
```

`pnpm ingest` streams the register's bulk download (about 210 MB), then requests each company's key figures with a short pause between requests, so a full run takes a while. It prints a summary per industry code, names any code the register returned nothing for (an SN2007 code, for example), and names every filing it rejected or failed to write. Inside the container a local database host is reached as `host.docker.internal`.

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

## To-do

[docs/todo.md](docs/todo.md)

## Analysis: Industry Screening

[analysis/output/industry-screening.md](analysis/output/industry-screening.md)

## Analysis: OCR of Filed Accounts

- [analysis/output/filing-eras.md](analysis/output/filing-eras.md) — paper versus generated filings, by year
- [analysis/output/ocr-consistency.md](analysis/output/ocr-consistency.md) — how consistently the generated section reads, by era
