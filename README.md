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
- The address is the rightmost `X-Forwarded-For` entry. With no proxy in front, `next start` fills that header from the socket only when the client sent none, so a client can choose its own key. **A client that sends a new value with every request gets a fresh budget every time, so locally the limit does not stop anyone from harvesting the open pages.** It cannot lift the limit for anyone else, and an exhausted address stays refused. Each covered analysis also reads its industry's whole candidate pool, uncached. This is accepted for the local v1 run; the deployment gate below closes it.
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

Step 1 fetches Enhetsregisteret data and the key-figures API filings for every company whose primary industry is declared in `seed/coverage.json`, plus demo company C (`ingest/config.toml`), and stores them as filed, in øre, as the `ingest` role. Filed annual-accounts documents are read by OCR only in a separate run for a given list of companies (`pnpm ingest --documents <file>`, below). It is a manual batch run; the app never calls the register and never reads a document. The register is free and needs no key.

Requires Docker, and [uv](https://docs.astral.sh/uv/) 0.12.10 for the tests (uv installs Python 3.14 from `ingest/.python-version`).

```sh
pnpm db:start && pnpm db:roles   # the database and INGEST_DATABASE_URL in .env
pnpm test:ingest      # fixture and contract tests: recorded responses, no network; database tests roll back
pnpm ingest           # builds ingest/Dockerfile and runs it once against the local database
pnpm ingest --companies-only   # refreshes only the search fields of companies already stored
pnpm ingest:document-set       # writes seed/document-run.json from the loaded seed (demo A and B and their peer pools)
pnpm ingest --documents seed/document-run.json   # reads only the filed documents of the listed companies
```

**The OCR reference run (Story 2.3).** The hand-transcribed reference set in `analysis/ocr-reference/` (issue #14) is read by the same document pass:

```sh
pnpm ingest:document-set --reference   # writes analysis/ocr-reference/document-run.json from drawn.json (no database)
pnpm ingest --documents analysis/ocr-reference/document-run.json   # its 20 companies, every 2021–2025 year (97 documents)
pnpm seed:export                       # commits their document rows; the reference orgnrs are on the allow-list
```

`pnpm ingest --companies-only` streams the bulk download and fills the business municipality (number and name) and the primary industry's name on the companies already in `register.company`. The name is stored only when the register's primary code still equals the stored one; otherwise it is NULL, and the company is named in the summary. It adds and deletes no company, touches no filing, and leaves every other column, `navn` and `read_at` included, unchanged; `search_fields_read_at` records when the three were read. Its summary gives the number updated and names every stored company not found in the bulk file, which it leaves untouched. It accepts no other argument.

`pnpm ingest` streams the register's bulk download (about 210 MB), then requests each company's key figures with a short pause between requests. It fetches no filed document. It prints a summary per industry code, names any code the register returned nothing for (an SN2007 code, for example), and names every filing it rejected or failed to write. Inside the container a local database host is reached as `host.docker.internal`.

**Filed documents.** Only `pnpm ingest --documents <file>` reads them: for each listed company, the years in the register's list of documents, 2021–2025 only, each fetched by the year in its path and read in the container (`register.document`, `register.document_column`). Reading takes about 21 s per document, so a run over all of 62.100 (about 33 000 documents) would take days; the summary counts the documents per filing year and status (`reconciled`, `failed_reconciliation`, `not_extracted`, `paper`). Each document and its two figure columns are committed on their own, so a run can be stopped (Ctrl-C) and started again: a rerun skips every stored company and year and reads nothing twice. A refiled document is therefore not picked up. A paper filing is stored as `paper` and never read; a document the reading library refuses, whose year differs from its path, or on which Tesseract fails is stored as `not_extracted` with the reason. Each read document is reconciled before it is written: the five checks within the document (c1–c5) hold within 5 kr, and this year's figures agree with the key-figures API within max(5 kr, 0.001 %), all set in `[reconciliation]` of `ingest/config.toml` (`docs/data-sources-brreg.md`, "Reconciliation"). Every documents run also reconciles again, from the stored figures and without fetching or reading anything, the documents already stored for the listed companies, so a changed value takes effect on the next run (except for the digits-only gate, which ran at read time under the bound then configured and is not redone from stored figures) and rows restored from an older dump (`extracted`) get their status. Only a reconciled column's figures may reach the engine; none is used by the app yet (Story 2.9).

`pnpm ingest --documents <file>` runs only that document pass, for the orgnrs in `<file>`, a JSON list of nine-digit strings, mounted read-only into the container. It fetches no bulk data and no key figures; an orgnr that is not a stored company with a covered primary code is refused and named, never fetched. `pnpm ingest:document-set` writes the committed list `seed/document-run.json` from the loaded seed: demo companies A and B and each one's peer pool at the standard size band, assembled by `src/engine` (demo company C is uncovered, so it has no documents to read). The list is input to the run, not seed data; `pnpm seed` and `pnpm seed:export` ignore it. Its document rows are not in the committed seed: those orgnrs wait for Story 5.4's allow-list (below, "Document rows of the acceptance run").

The step-1 image also carries Tesseract 5.5 and, at build time, downloads the pinned Norwegian model (`nor.traineddata` from `tessdata_best`, checked against its SHA-256), for reading the filed documents. The OCR tests in `pnpm test:ingest` need no Tesseract on the host; to check the image itself, as CI does:

```sh
docker build --tag peerless-ingest:local ingest
docker run --rm --mount "type=bind,src=$PWD/ingest/tests/fixtures/documents,dst=/fixtures,ro"   --entrypoint /app/.venv/bin/python peerless-ingest:local -m peerless_ingest.image_check /fixtures
```

### Seed

The demo seed is the register data from a step-1 run, committed in `seed/demo/`: one CSV file per table (`company.csv`, `filing.csv`, `key_figures.csv`, and `document.csv` and `document_column.csv`, which hold only the OCR reference set's documents) and `manifest.json`, which records the seed-format version, the latest migration, the dataset, the industry codes fetched, the orgnrs with document figures, the read-date range and each file's SHA-256. `seed/coverage.json` declares the covered industries and is the only hand-edited file under `seed/`; `seed/allow-list.json` is written by the export, and names the orgnrs whose document figures the seed may hold, each with its reason.

```sh
pnpm db:start && pnpm db:roles   # the database and LOADER_DATABASE_URL in .env
pnpm seed             # check everything, then truncate and replace every register table, as loader
```

`pnpm seed` checks the manifest version, that the manifest's migration is the latest file in `supabase/migrations`, that every file in `seed/demo/` is listed with a matching checksum, the shape of `seed/coverage.json`, that every declared industry was fetched, and that a `measured: true` entry cites an existing report under `analysis/output/` with a matching SHA-256. Any failure exits non-zero, names the entry and the check, and loads nothing. Then it loads in one transaction, writes `register.covered_industry` from `seed/coverage.json` and stores the manifest in `register.dataset`. Running it twice leaves the same state. CI runs it twice on a freshly migrated database on every pull request.

**Exporting.** After a step-1 run, `pnpm seed:export` writes `seed/demo/` and `seed/allow-list.json` from the local database as `reader`. It is deterministic: rows in primary-key order with `COLLATE "C"`, so the bytes never depend on the database's collation, and dates and `read_at` in UTC ISO form. Running it twice on the same database gives byte-identical files. It never writes `seed/coverage.json`. It refuses, before writing anything, when `register.document_column` holds a figure for an orgnr not on `seed/allow-list.json`. It writes the allow-list back as it read it, plus each orgnr of the committed OCR reference draw (`analysis/ocr-reference/drawn.json`) not already listed, with the reason "OCR-referansesett"; the refusal checks that merged list. Before exporting after the acceptance run, `pnpm seed` restores the committed state.

**Document rows of the acceptance run are not in the seed.** `pnpm seed` truncates every `register` table and `pnpm db:reset` recreates the database, so both delete the rows a `pnpm ingest --documents` run wrote to `register.document` and `register.document_column`. The committed seed holds only the OCR reference set's documents (Story 2.3); the acceptance run's 407 companies (`seed/document-run.json`) are not on the allow-list, and wait for Story 5.4, which lists the demo companies and their peers. Until then, keep that run's rows in a local, gitignored dump (data only) and restore it after a reset or a seed load:

```sh
# after a documents run: dump the rows of every orgnr NOT on seed/allow-list.json (the seed holds the listed ones) under .local/ (gitignored)
LISTED=$(node -e 'const l = JSON.parse(require("fs").readFileSync("seed/allow-list.json", "utf8")); console.log(l.map((e) => `'"'"'${e.orgnr}'"'"'`).join(",") || "'"''"'")')
mkdir -p .local/document-run-<commit>
for t in document document_column; do
  docker exec supabase_db_peerless psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "\copy (select * from register.$t where orgnr not in ($LISTED)) to stdout with (format csv, header)" > .local/document-run-<commit>/$t.csv
done
# after pnpm seed or pnpm db:reset (+ pnpm db:roles, pnpm seed): restore them, documents before their columns
for t in document document_column; do
  docker exec -i supabase_db_peerless psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "\copy register.$t from stdin with (format csv, header)" < .local/document-run-<commit>/$t.csv
done
```

`supabase_db_peerless` is the local database container (`project_id` in `supabase/config.toml`); `<commit>` is the commit the step-1 image was built from. Restore only onto the seed the run was made against: each document row references its company, and its `brreg_id` a key-figures filing. While the rows are present, `pnpm seed:export` refuses (they are not on the allow-list); run `pnpm seed` first. The dump holds only rows the seed does not: the allow-listed orgnrs' rows are in the seed already, and restoring them again would fail on their keys. The existing dump, `.local/document-run-bd2ce3e.sql` (a pg_dump of both tables, taken before the reference rows were seeded), holds only the acceptance run's 407 orgnrs, which are disjoint from the 20 reference orgnrs, so it still restores onto this seed with `docker exec -i supabase_db_peerless psql -U postgres -d postgres -v ON_ERROR_STOP=1 < .local/document-run-bd2ce3e.sql`.

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
- [analysis/output/ocr-consistency.md](analysis/output/ocr-consistency.md) — how consistently the generated section reads, by era (the spike's baseline)
- [analysis/output/ocr-sm2.md](analysis/output/ocr-sm2.md) — SM-2: step 1's OCR against the hand-transcribed reference set, and the spike's baseline re-measured (Story 2.3)

To regenerate the SM-2 report: `uv run analysis/ocr/consistency.py` (reads the spike's 2021–2025 filings again in the step-1 image, about 30 minutes, and writes `analysis/output/ocr-consistency-2026.json`), then `pnpm analysis:sm2`, which reads only committed files and rewrites `analysis/output/ocr-sm2.md`.
