---
title: 'Story 1.3a: Step 1 ingests register data for 62.100 and demo company C'
type: 'feature'
created: '2026-10-11'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/data-sources-brreg.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no data. Batch step 1 must fetch Enhetsregisteret data and Regnskapsregisteret key figures for every company whose primary industry is listed in `seed/coverage.json`, plus demo company C. It must store them as filed, in øre, with the filing year from the response and a read date. It must never fetch at query time.

**Approach:**
- A Python 3.14 project in `ingest/`, managed by `uv` with a committed `uv.lock`, running in a Docker image pinned by tag.
- It writes as `ingest` through `INGEST_DATABASE_URL` and runs no DDL.
- One migration creates the three tables step 1 writes, with their grants, and the Story 1.2 grants test is extended to cover them.
- Fixture tests replay recorded responses with no network, and a contract test runs the writer on 979607008/2025 against a freshly migrated database.
- Story ACs: GitHub issue #3 (authoritative; `epics.md` wins on conflict).

**Decisions (human, 2026-10-11):**
- **Reporting unit:** a fixed label, `api_whole_units`, on every API filing. Step 1 never guesses a unit. If precision is needed later, for example when reconciling against a document in Epic 2, it is computed there and not stored as a register fact. The criterion is corrected in `epics.md`, issue #3, `docs/data-sources-brreg.md` and AD-14.
- **Amounts:** parsed as whole numbers, never through a float (`json.loads(..., parse_float=Decimal)`), and multiplied by 100. A non-whole amount is rejected: that filing is not written, and the run summary names it.
- **Demo company C:** KANTALL AS, 967 534 579.
- **Filing key:** the primary key of `register.filing` is (`orgnr`, `regnskapstype`, `periode_fra`, `periode_til`), so company and group accounts for the same period never collide. The register's own `id` is kept as `brreg_id bigint NOT NULL UNIQUE`, and `key_figures` references it with `ON UPDATE CASCADE`. Step 1 upserts on the composite key, so a filing the register reissues under a new `id` for the same period updates the existing row.
- **One transaction per filing:** a filing and its `key_figures` row are written in one transaction, both or neither. A failure writing `key_figures` leaves no `filing` row behind, and the run continues with the next filing and names the failure in the summary.
- **Python pins are tested:** a test fails if any dependency in `ingest/pyproject.toml` is not pinned with `==` to an exact version. That covers `[project].dependencies`, every `[dependency-groups]` and `[project.optional-dependencies]` list, and `[build-system].requires`. `check:pins` reads only `package.json`.
- **Spec length:** kept whole, about 3,000 tokens.
- **No push and no PR** until the human has seen the branch.

## Boundaries & Constraints

**Always:**
- Branch `story/1.3a-step1-register-ingest`. Small commits.
- **No push and no PR until the human has reviewed the branch.**
- Filing year comes from the returned `regnskapsperiode`, never the request.
- Empty elements (`{}`, `null`, a missing key, `<x/>`) are stored as NULL; stated totals are stored as filed.
- Companies are keyed on orgnr only.
- The misspelled field names `sumInnskuttEgenkaptial` and `regnkapsprinsipper` are read as they are spelled.
- Amounts are converted with `Decimal`, never `float`.
- The industry is selected on `naeringskode1.kode` only.
- Every Python dependency and the uv version are pinned exactly.

**Never:**
- No ratio, distribution, derived component or amount is stored (AD-1, AD-15).
- No DDL from Python.
- No document or OCR fetch.
- No 410 deletion (Story 2.4).
- No seed export or loader (Story 1.3b).
- The literal `62.100` appears in no application code (`ingest/src`, `src/`, `scripts/`).
- No grants to `derive` or `loader`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| contract | fixture 979607008/2025 written to a fresh DB | stored `_ore` columns equal hand-checked values (e.g. `sum_driftsinntekter_ore` = 7263231000, `sum_eiendeler_ore` = 3107354400) | — |
| year trap | response for a requested earlier year carries the 2025 `regnskapsperiode`/`id` | filing stored as 2025 | — |
| empty element | `langsiktigGjeld` is `{}` | `sum_langsiktig_gjeld_ore` NULL; `sum_gjeld_ore` as filed | — |
| two names | same orgnr, two names | one company row | — |
| secondary code | unit with the covered code only as `naeringskode2`/`3` | not loaded | — |
| SN2007 code | fixture coverage `62.010`, recorded empty register | no company; run summary names `62.010` as returning nothing | — |
| reporting unit | any API filing, including a millions-reporter (923609016-shaped fixture) | amounts ×100 as recorded; `reporting_unit` = `api_whole_units` | — |
| non-whole amount | a fixture amount `1234.5` | that filing is not written; the run summary names orgnr and field | other filings still written |
| float-free | `72632310.0` in JSON | parsed via `Decimal`, stored 7263231000 | — |
| SELSKAP + KONSERN | same orgnr and period, both `regnskapstype` | two filing rows, two key-figure rows | — |
| atomic write | `key_figures` insert fails (e.g. the test makes it violate a constraint) | no `filing` row for that filing remains; summary names it; the next filing is written | rolled back |
| python pins | `ingest/pyproject.toml` with `httpx>=0.27` (fixture) or the real file | fixture fails the pin test with the package named; real file passes | — |
| reissued filing | same orgnr/type/period, new `id` | one row; `brreg_id` updated | — |
| misspelled | `sumInnskuttEgenkaptial`, `regnkapsprinsipper` | read; `smaa_foretak`, `regnskapsregler` stored | — |

</frozen-after-approval>

## Code Map

- `analysis/industry_screening.py:173-348` -- `fetch_json` (urllib, User-Agent, backoff on 429/5xx), primary-code filter, `check_filing` (`regnkapsprinsipper`, calendar year), `to_int` via `Decimal`. Mirror these; do not import from `analysis/`.
- `analysis/.cache/c696f8694d337da2dcb31f5fa8f4d36c.json` (gitignored) -- the recorded 979607008 response. Copy it into a committed fixture; the register data is NLOD.
- **Key-figure JSON paths:**
  - `resultatregnskapResultat.driftsresultat.{driftsresultat, driftsinntekter.sumDriftsinntekter, driftskostnad.sumDriftskostnad}`
  - `resultatregnskapResultat.finansresultat.{nettoFinans, finansinntekt.sumFinansinntekter, finanskostnad.sumFinanskostnad}`
  - `resultatregnskapResultat.{ordinaertResultatFoerSkattekostnad, aarsresultat, totalresultat}`
  - `eiendeler.{sumEiendeler, omloepsmidler.sumOmloepsmidler, anleggsmidler.sumAnleggsmidler}`
  - `egenkapitalGjeld.{sumEgenkapitalGjeld, egenkapital.sumEgenkapital, egenkapital.opptjentEgenkapital.sumOpptjentEgenkapital, egenkapital.innskuttEgenkapital.sumInnskuttEgenkaptial, gjeldOversikt.sumGjeld, gjeldOversikt.kortsiktigGjeld.sumKortsiktigGjeld, gjeldOversikt.langsiktigGjeld.sumLangsiktigGjeld}`
  - **Metadata:** `id`, `journalnr`, `regnskapstype`, `regnskapsperiode.{fraDato,tilDato}`, `valuta`, `avviklingsregnskap`, `oppstillingsplan`, `regnkapsprinsipper.{smaaForetak,regnskapsregler}`.
- **Endpoints:**
  - `GET {BRREG_API_BASE_URL}/regnskapsregisteret/regnskap/{orgnr}` with `Accept: application/json` returns a JSON array. It now holds several years (2023–2025, seen live) and both `SELSKAP` and `KONSERN`; store each filing.
  - Enhetsregisteret: the paged search caps at 10 000 results and `62.100` matches 17 636 units (including secondary codes), so use the bulk download instead. `GET {base}/enhetsregisteret/api/enheter/lastned` with `Accept: application/vnd.brreg.enhetsregisteret.enhet.v2+gzip;charset=UTF-8` (210 MB gzip, refreshed daily). Stream-parse it and keep units whose `naeringskode1.kode` is covered.
  - For C: `GET {base}/enhetsregisteret/api/enheter/{orgnr}`.
- `.env.example` -- `BRREG_API_BASE_URL` and `INGEST_DATABASE_URL` already exist.
- `test/db/grants.test.ts` (Story 1.2) -- its relation loop already covers `reader` on the new tables. Add the `ingest`/`derive`/`loader` grant assertions for these three tables.
- `docs/data-sources-brreg.md:269` -- the open question on bulk-download URLs. Answer it in this story; the doc is authoritative.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/<ts>_register_step1_tables.sql`:
  - `register.company`: `orgnr char(9)` PK, `navn`, `organisasjonsform`, `naeringskode1`, `naeringskode2`, `naeringskode3`, `konkurs`, `under_avvikling`, `under_tvangsavvikling`, `read_at timestamptz`.
  - `register.filing`: PK (`orgnr`, `regnskapstype`, `periode_fra`, `periode_til`); `brreg_id bigint NOT NULL UNIQUE`; `orgnr` FK; `journalnr`; `filing_year` (from `regnskapsperiode.tilDato`), `periode_fra`, `periode_til`, `valuta`, `regnskapsregler`, `smaa_foretak`, `avviklingsregnskap`, `oppstillingsplan`, `reporting_unit` (CHECK = `api_whole_units`), `status` CHECK in the four values (`not_extracted` for API filings), `read_at timestamptz`.
  - `register.key_figures`: `brreg_id` PK, FK to `filing(brreg_id)` `ON UPDATE CASCADE`, plus one `bigint` `<snake_case register field>_ore` column per key-figure path, each with `COMMENT … 'øre'`.
  - `ingest` gets SELECT/INSERT/UPDATE on the three; `derive` and `loader` get nothing.
- [ ] `ingest/` -- `pyproject.toml`, `uv.lock`, `.python-version` (3.14), `Dockerfile` (python and uv images pinned by exact tag), `src/peerless_ingest/` (`config`, `fetch` with an injectable transport, `parse` with pure functions, `write` with psycopg as `ingest` and upserts, `run` printing a per-code summary), `config.toml` (demo company C = KANTALL AS, 967534579, with the evidence for each criterion as checked on 2026-10-11; no industry code).
- [ ] `seed/coverage.json` -- `[{"code": "62.100", "measured": false}]`.
- [ ] `ingest/tests/` with recorded fixtures -- every I/O matrix row; parse tests run without a DB; the contract and write tests use `INGEST_DATABASE_URL` (skipped with a clear message when it is unset locally, required in CI). Assert no outbound network in the tests.
- [ ] `ingest/tests/test_pins.py` -- reads `ingest/pyproject.toml` with `tomllib`; every requirement in the four places matches `name==X.Y.Z` (extras allowed); a fixture with `>=` fails.
- [ ] `test/no-industry-literal.test.ts` -- `62.100` absent from `src/`, `scripts/`, `ingest/src/`, `ingest/config.toml`.
- [ ] `test/db/grants.test.ts` -- the new tables' grants.
- [ ] `package.json` scripts `ingest` (build and run the image; reaches the local DB on Linux and Docker Desktop) and `test:ingest`.
- [ ] CI: `astral-sh/setup-uv` pinned, `uv sync --frozen`, `pytest` after `db:roles`, `docker build ingest`.
- [ ] Docs (the reporting-unit criterion and the bulk URL are already corrected in `epics.md`, issue #3, `docs/data-sources-brreg.md` and AD-14): README "Batch step 1", `AGENTS.md` Stack line, `docs/ai-log.md` (what could go wrong with money columns and writes), session file, sprint-status.

**Acceptance Criteria:**
- Given a migrated DB and `db:roles`, when `pnpm test:ingest` and `pnpm test:db` run, then all pass with no network access.
- Given `pnpm ingest` run once by hand, when it finishes, then the summary lists the 62.100 company and filing counts and demo C, and no derived value is stored.

## Design Notes

`_ore` = `int(d) * 100`, where `d` is the `Decimal` from `parse_float=Decimal` and must satisfy `d == d.to_integral_value()`; otherwise the filing is rejected. The tests run Python in CI through `uv` directly. The image is built in CI to prove it builds; inside the image the DB host may need to be `host.docker.internal`. The real `pnpm ingest` is run once locally, not in CI; the API is free, so a full run is about 10k+ requests at a 0.15 s pause.

## Verification

**Commands:**
- `pnpm check:pins && pnpm check:env && pnpm lint && pnpm typecheck && pnpm test` -- pass
- `pnpm db:reset && pnpm db:roles && pnpm test:db && pnpm test:ingest` -- pass
- `docker build ingest` -- succeeds; `git ls-remote origin story/1.3a-step1-register-ingest` -- empty

## Implementation Notes

## Spec Change Log

## Review Triage Log
