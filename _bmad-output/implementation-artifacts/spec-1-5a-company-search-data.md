---
title: 'Story 1.5a: Step 1 stores what search shows — municipality and industry name'
type: 'feature'
created: '2026-10-14'
status: 'done'
baseline_commit: 'a5ccd6d935da0afcd06aed04b046dae8d7d4d0f8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/data-sources-brreg.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `register.company` holds `navn` and the `naeringskode1` code only. Search (FR-1, Story 1.5b) must show the municipality, and the uncovered state (Story 1.6b) needs the industry name. Step 1 reads both from the bulk file and drops them. There is also no name-search index.

**Approach:** One migration adds three nullable columns, their read timestamp and the trigram index on an IMMUTABLE `unaccent` wrapper. Step 1 stores the three fields, and a companies-only mode fills them on the existing rows. The seed is re-exported in the same PR. Story ACs: `epics.md` Story 1.5a (authoritative) and GitHub issue #20.

**Why split (human, 2026-10-14):** Story 1.5 ran to about 2 700 tokens across the database, step 1, the API, the UI and tests, so it was split 1.3a/1.3b-style. This half is the data change, which goes first. Story 1.5b (issue #6, `spec-1-5b-company-search.md`) builds the API and the page on it and adds no migration.

**Decisions (human, 2026-10-14):**
- The values are stored exactly as the register delivers them:
  - `forretningsadresse.kommunenummer` → `forretningsadresse_kommunenummer`;
  - `forretningsadresse.kommune` → `forretningsadresse_kommune`;
  - `naeringskode1.beskrivelse` → `naeringskode1_beskrivelse`.
- **Companies-only mode** fills only these three columns, and only on companies already in `register.company`.
  - It adds no company and deletes none, so the company set still matches the 1.3a filings.
  - It leaves every other column unchanged, including `navn` and `read_at`, and touches no filing.
  - Its summary says how many companies it updated and how many were not found in the bulk file.
- **`read_at` never describes values read later** (human, at approval). A fourth nullable column, `search_fields_read_at timestamptz`, records when the three fields were read.
  - Companies-only mode sets it to the time of its bulk read.
  - A normal step-1 run sets it equal to `read_at`.
  - NULL means the three fields have never been read.
  - The name covers all three fields; the human's example was `location_read_at`, but `naeringskode1_beskrivelse` is not a location.
- **The wrapper qualifies both the function and the dictionary by schema** (human, at approval), so its result does not depend on `search_path`: `extensions.unaccent('extensions.unaccent'::regdictionary, $1)`.
- The migration's seed re-export ships in the same PR (README, "Seed").

## Boundaries & Constraints

**Always:**
- Step 1 runs no DDL and never DELETEs (AD-2). The migration is the only DDL.
- An absent `forretningsadresse` or an absent field → NULL. Never an empty string, and never `postadresse`.
- **The function and index:**
  - extensions go in schema `extensions`;
  - the function and index go in `register` (schema `app` must hold no relations);
  - `GRANT EXECUTE` on the wrapper, and USAGE on schema `extensions`, to `reader`, `ingest` and `loader` only. This was amended by the human at review on 2026-10-14. The approved text said `reader` only, which fails: Postgres evaluates an index expression as the role that writes the row.
- `pnpm seed` loads the new seed twice, and `pnpm seed:export` reproduces it byte-identically.

**Never:**
- No API route, server code or UI (1.5b).
- No re-fetch of filings.
- No full step-1 re-run to refresh the local database.
- No reset of the local database: it holds the 1.3a data.
- No change to `filing` or `key_figures`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error Handling |
|---|---|---|---|
| normal run | unit with `forretningsadresse` and `naeringskode1.beskrivelse` | the three columns stored verbatim; `search_fields_read_at` = `read_at` | — |
| no business address | unit without `forretningsadresse` (only `postadresse`) | the two kommune columns NULL | — |
| companies-only, match | DB orgnr present in bulk | the three columns and `search_fields_read_at` (the bulk read time) updated; `navn`, `read_at` and the filings unchanged | — |
| companies-only, missing | DB orgnr absent from bulk (e.g. deleted unit, or demo C outside the filter) | row untouched (`search_fields_read_at` stays as it was); counted and named in the summary | needs-operator exit only if a write fails |
| companies-only, extra | bulk unit with a covered code, not in DB | not inserted | — |
| accents | `immutable_unaccent(lower('Ærlig Søndre'))` as `reader` | `'aerlig sondre'` | — |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261011120000_register_step1_tables.sql:16-30,127` -- the `register.company` definition. `ingest` holds SELECT, INSERT and UPDATE. Do not edit; add the new migration `20261014120000_register_company_search.sql`.
- `test/db/grants.test.ts:172,237-248,515-531` -- `app` has no relations, PUBLIC has no EXECUTE, and an ungranted register function is closed to `reader`. Add the positive test that `reader` can call `register.immutable_unaccent` in a new `test/db/company-search.test.ts`. That file also checks the index exists and uses the expression.
- `ingest/src/peerless_ingest/parse.py:95-106,161-177` -- add the three fields to `Company` and to `parse_company`, with a nested-dict helper like `_code`.
- `ingest/src/peerless_ingest/write.py:16-27,76-80` -- add the three to `COMPANY_COLUMNS`, which also drives the normal upsert. Add `search_fields_read_at` to `Company` and `COMPANY_COLUMNS` (`parse_company` sets it to `read_at`). Add `update_company_search_fields(conn, company, read_at) -> bool`: an `UPDATE … SET <three>, search_fields_read_at WHERE orgnr = %s` that returns whether a row matched. Keep the module's no-DELETE rule.
- `ingest/src/peerless_ingest/run.py:154-215` -- `run()` stays as it is. Add `run_companies_only(conn, transport, cfg)`:
  - read the existing orgnrs (`SELECT orgnr FROM register.company`);
  - stream `fetch.iter_bulk_units` without the code filter;
  - for each unit in the set, parse it and update it.
  
  Demo C is in the bulk file like any unit. Its summary class prints "updated n, not found in bulk file m" plus the not-found orgnrs. `main()` selects the mode from `sys.argv` (`--companies-only`).
- `scripts/run-ingest.ts` -- `dockerRunArgs` passes no arguments to the container. Forward `process.argv.slice(2)` after the image name, allowing only `--companies-only`. Its test lives in `test/`, next to the existing run-ingest test, if one exists.
- `ingest/tests/test_parse.py:214`, `test_write.py:26,129,223-320`, fixtures `recorded/enheter_lastned.json` and `enhet_967534579.json` (the latter has `forretningsadresse.kommune` "LILLEHAMMER" and `naeringskode1.beskrivelse`) -- extend these. Add one fixture unit without `forretningsadresse` if none exists.
- `scripts/seed-format.ts:41,110,285`, `seed-load.ts:77-88` -- the loader checks CSV headers against the catalog, and `latestMigrationId` against the manifest. No code change: run `pnpm exec supabase migration up`, then `pnpm ingest --companies-only`, then `pnpm seed:export`, and commit `seed/demo/*` and the manifest.
- `docs/data-sources-brreg.md` -- name the three stored fields under the Enhetsregisteret fields. `README` "Seed" -- mention `pnpm ingest --companies-only` if it lists step-1 commands.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261014120000_register_company_search.sql` -- the following, each with a `COMMENT` naming its source:
  - `create extension if not exists pg_trgm with schema extensions`, and the same for `unaccent`;
  - the three columns and `search_fields_read_at timestamptz`, all nullable;
  - `register.immutable_unaccent(text) returns text language sql immutable parallel safe strict`, as `select extensions.unaccent('extensions.unaccent'::regdictionary, $1)`;
  - `GRANT EXECUTE … TO reader, ingest, loader` and `GRANT USAGE ON SCHEMA extensions` to the same three (amended at review);
  - `create index company_navn_trgm on register.company using gin (register.immutable_unaccent(lower(navn)) extensions.gin_trgm_ops)`.
- [x] `test/db/company-search.test.ts` -- as `reader`:
  - `immutable_unaccent` returns `'aerlig sondre'`;
  - the function is IMMUTABLE;
  - the index exists, with the expression above;
  - the four columns exist and are nullable;
  - the wrapper's body names `extensions.unaccent` and the dictionary `extensions.unaccent`;
  - the wrapper returns the same result under `set search_path = ''`;
  - `reader` cannot UPDATE them.
- [x] `ingest/src/peerless_ingest/{parse,write,run}.py` + tests -- every row of the I/O matrix. The companies-only run against recorded fixtures leaves `navn`, `read_at` and a filing's `read_at` unchanged and sets `search_fields_read_at` to the run's time; a normal run sets it equal to `read_at` (the existing `written_by_run`-style helpers).
- [x] `scripts/run-ingest.ts` + test -- argv passthrough, allowing only `--companies-only`.
- [x] The local refresh, then `seed/` re-exported and committed (not in CI). Record the summary counts in the PR and the session file.
- [x] Docs:
  - `docs/data-sources-brreg.md`;
  - `AGENTS.md` (step 1's companies-only mode, in the Stack paragraph);
  - `docs/ai-log.md` (what could go wrong);
  - the `docs/ai-sessions/` file;
  - sprint-status.

**Acceptance Criteria:**
- Given the PR, when CI runs, then pins, lint, typecheck, `pnpm test`, `pnpm test:db`, both seed loads, the unchanged re-export, `pnpm test:ingest`, the build and e2e all pass.
- Given the refreshed seed, when `seed/demo/company.csv` is inspected, then the 62.100 companies with a business address have a municipality, and the not-found count matches the run's summary.
- Given the PR, then it states what could go wrong, and `docs/ai-log.md` records it. At least:
  - a municipality left stale while the name is refreshed by a later full run;
  - a sole proprietor's municipality made searchable — public in the register, but a person's;
  - the wrapper's IMMUTABLE label holding only while the `unaccent` dictionary does not change.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Pass 1 — blind hunter (BH), edge-case hunter (EC) and verification gap (VG). `seed/demo/company.csv` was left out of the reviewed diff: it is 35 116 lines of generated rows. The seed is checked by the export → load twice → re-export round trip, and by comparing its first ten columns with the previous seed.

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 1 | BH/EC: the migration grants EXECUTE and USAGE on `extensions` to `reader`, `ingest` and `loader`, while the frozen spec said `reader` only | medium | Granting `reader` alone was tried in a rolled-back transaction. Every write by `ingest` or `loader` failed, because the index expression is evaluated as the writer | intent_gap. The human accepted the wider grant at review, and the frozen line now says so. The code is kept |
| 2 | VG: `main()` in `scripts/run-ingest.ts` is never tested. A dropped `checked.args` would turn `--companies-only` into a full ingest run | medium | `test/run-ingest.test.ts` imports only the helpers; no `main(` | patch: mock `spawnSync`; assert forwarding, and exit 2 with no docker call |
| 3 | BH/EC: USAGE on `extensions` is untested, although AGENTS.md says the test covers it | medium | `company-search.test.ts` checks only EXECUTE on the wrapper | patch: assert USAGE holders |
| 4 | BH: a bulk `naeringskode1.kode` that differs from the stored code goes unreported (920768695) | medium | `run_companies_only` stores the description without comparing codes | patch: the summary counts and names mismatches |
| 5 | BH/EC: an UPDATE that matches no row is reported as "not found in bulk file" | low | the `matched == False` branch falls into `stored - accounted` | patch: record a `Problem` |
| 6 | BH/EC: companies-only mode loads `seed/coverage.json`, which it never uses | low | `main` calls `load_coverage` before choosing the mode | patch: load it only for a normal run |
| 7 | BH: `test_main_refuses_other_arguments` does not show that nothing connects | low | the test only checks the exit code | patch: make `connect` fail |
| 8 | BH: the warnings for 1.5b (ENK municipality privacy, description vs stored code, an EXPLAIN check of index use) are not where 1.5b will see them | low | they are only in the ai-log and data-sources prose | defer: deferred-work entry for 1.5b |
| 9 | BH: no regression write as `ingest`/`loader` | low | CI covers it: `test:ingest` writes as `ingest` on the seeded database, and `pnpm seed` writes as `loader` | reject |
| 10 | BH: the manifest's `read_at` range ignores `search_fields_read_at` | low | true. The analysis shows filing read dates, and widening the manifest changes the seed format | reject (low, the fix is not a direct correction) |
| 11 | BH/EC: `pnpm ingest -- --companies-only` may pass a literal `--` | low | the documented form `pnpm ingest --companies-only` works. Accepting `--` adds a branch | reject |
| 12 | BH: the session file is unfinished; the `last_updated` timestamp | false | the PR and commit links are added when they exist; the timestamp is refreshed at finalisation | reject |
| 13 | BH: spec `in-review` vs sprint `review` | false | two vocabularies by design (Story 1.4 triage #16) | reject |
| 14 | EC: an unhashable `organisasjonsnummer` in the bulk file | low | the register always sends a string; a type error would fail loudly | reject |
| 15 | EC: the bulk stream fails mid-download → a traceback, not a summary | false | a loud failure with a non-zero exit, as in `run()`; nothing is half-reported | reject |
| 16 | EC: the same orgnr twice in the bulk file, one copy failing to parse | low | never observed; the bulk file has one unit per orgnr | reject |

## Design Notes

**Why a wrapper:** `unaccent(text)` is STABLE, because it depends on the search path and the dictionary, and Postgres refuses STABLE functions in an index expression. The wrapper names both the function and the dictionary with their schema. That makes IMMUTABLE true in practice, so the index and 1.5b's query must both call the same wrapper.

**Not-found companies** (in the database but absent from the bulk file) are expected: Story 2.4 deletes withdrawn units, and this refresh does not. They are reported and left untouched.

## Verification

**Commands:**
- `pnpm exec supabase migration up && pnpm test:db` -- expected: pass.
- `pnpm test:ingest` -- expected: pass.
- `pnpm check:pins && pnpm check:env && pnpm lint && pnpm typecheck && pnpm test` -- expected: pass.
- `pnpm seed && pnpm seed && pnpm seed:export && git diff --exit-code seed/` -- expected: pass, after the refreshed export is committed.
