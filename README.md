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

In v1 the app is an empty shell (header and footer); the database, seed data and analysis arrive in later stories.

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
