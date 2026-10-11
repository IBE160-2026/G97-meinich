# Story 1.3a: batch step 1 ingests register data

**Date:** 2026-10-11
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #3, Story 1.3a
**Result:** branch `story/1.3a-step1-register-ingest`, commits `b35245f` (migration and grants test), `2e18f12` (`ingest/` and `seed/coverage.json`), `c2ed847` (step-1 tests), `f0a83b6` (`pnpm ingest`, `pnpm test:ingest`, industry-literal test, CI), then the docs commit. Not pushed: the human reviews the branch first.

## Goal

Batch step 1's register part: Enhetsregisteret data and key-figures API filings for every company whose primary industry is declared in `seed/coverage.json`, plus demo company C, stored as filed, in øre, as the `ingest` role, with no DDL and nothing fetched at query time.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-3a-step1-register-ingest.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
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

## Links

- AI log: "2026-10-11 — Story 1.3a: step 1 writes money columns, and where they can still go wrong"
- Spec: `_bmad-output/implementation-artifacts/spec-1-3a-step1-register-ingest.md`
- Documents updated: `README.md` (Batch step 1), `AGENTS.md` (Stack), `docs/ai-log.md`, `sprint-status.yaml`
