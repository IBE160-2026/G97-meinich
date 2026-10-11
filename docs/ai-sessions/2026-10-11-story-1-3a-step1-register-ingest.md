# Story 1.3a: batch step 1 ingests register data

**Date:** 2026-10-11
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #3, Story 1.3a
**Result:** branch `story/1.3a-step1-register-ingest`. Implementation: `b35245f` (migration and grants test), `2e18f12` (`ingest/` and `seed/coverage.json`), `c2ed847` (step-1 tests), `f0a83b6` (`pnpm ingest`, `pnpm test:ingest`, industry-literal test, CI), `1d490ea` (docs), `60c1f11` (a key-figures fetch error names the company and the run continues). Review fixes: `9773124` (fetch retries), `38cf6ba` (run names every problem, stops on a lost connection, exit code), `78e17c7` (empty coverage), `9a5207e` and `1f98702` (network-guard wording, fixtures README; `1f98702` also carries the spec's Review Triage Log and the deferred item), `3691971` (`dockerRunArgs` unit test), `562de5b` (grants test as `reader`), `79cde8e` (CI image smoke import). Then the commit recording the acceptance run. Not pushed: the human reviews the branch first.

## Goal

Batch step 1's register part: Enhetsregisteret data and key-figures API filings for every company whose primary industry is declared in `seed/coverage.json`, plus demo company C, stored as filed, in øre, as the `ingest` role, with no DDL and nothing fetched at query time.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-3a-step1-register-ingest.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The patch dispatch after review, to the same subagent: "Review of your implementation found problems. Fix each one below with the smallest change that does the job. Run only the tests that cover the files you edit — nothing wider."
- The human decisions frozen in the spec: the reporting unit is the fixed label `api_whole_units` and never guessed; amounts are parsed with `parse_float=Decimal`, and a non-whole amount rejects the filing; demo company C is KANTALL AS (967 534 579); the filing key is (`orgnr`, `regnskapstype`, `periode_fra`, `periode_til`) with the register id kept as `brreg_id` and followed `ON UPDATE CASCADE`; one transaction per filing; a pin test over all four requirement lists in `pyproject.toml`; no push and no PR before the human has seen the branch.

## What came back, and what was done with it

- **Verified before building on it:**
  - The bulk download (`/enhetsregisteret/api/enheter/lastned`) returns a 210 MB gzip of one pretty-printed JSON array, in the same unit shape as the single-unit endpoint.
  - The key-figures API returns 2023–2025 for each test company, and `SELSKAP` and `KONSERN` for 923 609 016 (USD). KANTALL AS still meets every demo-C criterion on 2026-10-11; the evidence is in `ingest/config.toml`.
  - `python:3.14.7-slim-trixie`, `ghcr.io/astral-sh/uv:0.12.10`, `uv_build==0.12.10` and `astral-sh/setup-uv@v10.2.0` exist; psycopg 3.3.6 and pytest 9.1.1 were chosen as releases more than three weeks old.
- **Accepted:**
  - A stdlib streaming reader for the bulk array (`parse.iter_json_array`) instead of a new dependency; the download is collected before any key-figures request so it is not held open for the whole run.
  - Database tests run as the real `ingest` login inside one outer transaction that is always rolled back; the writer's own `conn.transaction()` blocks become savepoints there. `ingest` therefore never needs DELETE, even in tests.
  - Outbound network is blocked in `conftest.py` for every non-loopback host; a test asserts that a request to the register fails.
  - The atomic-write case uses a natural failure: an amount of 10^17 kroner overflows `bigint` once in øre, so the `filing` insert succeeds and the `key_figures` insert fails.
- **Corrected while building:** the streaming reader decoded a number cut at a chunk boundary as complete (`-6` of `-6.5e3`). Caught by the chunk-size test at sizes 1, 2 and 7; it now reads on until a character that cannot continue a number.

## Review

Three independent reviewers (blind diff review, edge-case hunter against the spec, verification gap) raised 27 findings; the verdicts are in the spec's Review Triage Log. Sixteen were patched by the implementation subagent, one deferred, ten rejected.

- **Patched, the ones that mattered:** a body-read error (`http.client.IncompleteRead`, a reset mid-body) was not retried and is not an `OSError`, so it escaped and would have aborted a multi-hour run; the bulk download's opening request was not retried; demo company C and one malformed bulk unit ran unguarded and could lose the whole summary; a dropped database connection made every later write fail one at a time, and the run now stops with `ConnectionLost`; the exit code was 0 even when filings were rejected or demo C got no filings, and it now follows `Summary.needs_operator()`; an empty `seed/coverage.json` downloaded 210 MB and reported success. Missing tests were added for `UrllibTransport`, a covered company without filings, demo C not found, `pnpm ingest`'s docker argv, and writes as `reader`; CI now starts the built image once.
- **Deferred** (`deferred-work.md`): a company reclassified out of the covered code keeps its stale rows; no run revisits it.
- **Rejected:** among others `Retry-After` on 429, two same-key filings in one response, and a claimed disagreement between the overflow comments (10^17 kr × 100 = 10^19 øre; they agree).
- **Not covered by a test:** the `ConnectionLost` path. When fetching demo C itself errors, the summary prints both the failure line and "not found in Enhetsregisteret", which is slightly misleading.

## The acceptance run

- The first full `pnpm ingest` was started before review, on the code before the fixes. With the human's agreement it was stopped at about 2 980 companies, the review fixes were finished, and the human approved the plan: "Ja, kjør det slik, med reset i steg 5". The fixes were confirmed to change `fetch.py`, `run.py` and `config.py` only, never `parse.py` or `write.py`; every check was run; the database was reset with `pnpm db:reset && pnpm db:roles`, which wiped the first run's rows. That run is not used anywhere.
- The human rejected adding a `--limit` option to shorten the run.
- The final run, on the image built from `79cde8e`, ran 2026-10-11 10:09–13:36 UTC and exited 0: 17 556 companies with `naeringskode1` 62.100, 8 441 of them with filings, 22 351 filings written, and demo company C (KANTALL AS) with 3 filings. No filing was rejected and no fetch or write failed. The database counts agree, including KANTALL's company row and filings, with no filing lacking key figures and no orphan key figures.
- Claude Code's background shells following the container were killed twice for low memory while the container ran on. The final summary and exit code were captured from `docker logs -f` and `docker wait` before the container removed itself.
- The human checked the counts against the database and found two things in the data, which were then confirmed against the live API. First, 105 filings have a negative `sumEiendeler` (930115746, 2025: −6 186 121), and in 86 of them `sumEgenkapitalGjeld` is the same negative amount. Second, `valuta` `EDT`, which is not an ISO code, appears on 920835252 for 2023 and 2024. Both are recorded as verified findings in `docs/data-sources-brreg.md`. A `deferred-work.md` item asks Stories 1.4 and 1.7 to handle them explicitly, and the PR lists them under known limitations.
- Verification at `79cde8e`: `check:pins`, `check:env`, lint, typecheck, `pnpm test` (79), `test:ingest` (65, none skipped), `test:db` (37), build and e2e (3).

## Links

- AI log: "2026-10-11 — Story 1.3a: step 1 writes money columns, and where they can still go wrong"
- Spec: `_bmad-output/implementation-artifacts/spec-1-3a-step1-register-ingest.md`
- Documents updated: `README.md` (Batch step 1), `AGENTS.md` (Stack), `docs/ai-log.md`, `sprint-status.yaml`, `deferred-work.md`
