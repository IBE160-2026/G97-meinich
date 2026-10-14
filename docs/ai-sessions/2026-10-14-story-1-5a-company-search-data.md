# Story 1.5a: step 1 stores what search shows

**Date:** 2026-10-14
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #20, Story 1.5a
**Result:** branch `story/1.5a-company-search-data`, implemented, reviewed and verified locally; PR to follow.

## Goal

Store the business municipality (number and name) and the primary industry's name in `register.company`, with the time they were read, add the name-search index, and fill the three fields on the companies already stored, so Story 1.5b can build search on them.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-5a-company-search-data.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human decisions frozen in the spec: values stored as delivered; companies-only mode touches only the three fields on existing companies; a fourth column `search_fields_read_at` so `read_at` never describes values read later; the wrapper qualifies both function and dictionary by schema.

## What came back, and what was done with it

- **Accepted:**
  - Migration `20261014120000_register_company_search.sql`: `pg_trgm` and `unaccent` in `extensions`, the four nullable columns with comments, `register.immutable_unaccent(text)` (SQL, IMMUTABLE, PARALLEL SAFE, STRICT), and the GIN index `company_navn_trgm`. `EXPLAIN` showed a bitmap index scan for `register.immutable_unaccent(lower(navn)) % '…'`.
  - Step 1: `parse_company` reads the three fields through a nested-field helper; an absent object, an absent field or an empty string is `None`, and `postadresse` is never read. `search_fields_read_at` is `read_at` in a normal run. `write.update_company_search_fields` is an `UPDATE … WHERE orgnr` of four columns. `run.run_companies_only` reads the stored orgnrs, streams the bulk file without the code filter, and updates only those; its summary names every company not found. `main` takes no argument or exactly `--companies-only` (exit 2 otherwise).
  - `scripts/run-ingest.ts` forwards only `--companies-only`, after the image name, and refuses anything else before building the image.
- **Corrected against the spec, and how it was caught:**
  - "GRANT EXECUTE on the wrapper to `reader` only" was tried in a rolled-back transaction before the migration was written: as `ingest` and `loader`, writing `register.company` failed with "permission denied for function immutable_unaccent", because Postgres evaluates an index expression as the writer; and as `reader` the call failed with "permission denied for schema extensions". The migration grants EXECUTE and USAGE on `extensions` to `reader`, `ingest` and `loader`. This departs from a frozen line of the spec and needs the human's agreement at review.
  - The spec suggests adding a fixture unit without `forretningsadresse`. The recorded fixtures are byte-for-byte register responses, so the tests instead delete `forretningsadresse` from a copy of 919951834, which keeps its `postadresse`.
- **Found in the data:** 920768695 (KIRKEBY GÅRDSDRIFT, `ENK`) is stored with `naeringskode1` 62.100, but the register now names its primary industry "Produksjon av møbler"; companies-only mode stored that description next to the old code, as specified.

## Review

Three review layers ran on the diff: blind hunter, edge-case hunter and verification gap. `seed/demo/company.csv` was left out; the seed round trip checks it. 16 findings, logged with their verdicts in the spec's Review Triage Log:
- **The human decided** to keep the wider grant: EXECUTE on the wrapper and USAGE on `extensions` for `reader`, `ingest` and `loader`. The frozen spec line is amended to say so.
- **Six patched:**
  - a test of `main()` in `scripts/run-ingest.ts` — forwarding, and exit 2 without docker;
  - USAGE on `extensions` asserted per role;
  - companies-only summary names companies whose bulk primary code differs from the stored one (920768695);
  - an update matching no row is a failure, not "not found in bulk file";
  - companies-only mode no longer reads `seed/coverage.json`;
  - the refusal test proves nothing connects.
- **One deferred to Story 1.5b** (`deferred-work.md`): ENK municipality privacy, description versus stored code, and an `EXPLAIN` test that the name query uses the index.
- **Eight rejected,** with reasons.

## Verification

- `pnpm exec supabase migration up` on the loaded 1.3a database (no reset; a `pg_dump` of `register` was taken first).
- `pnpm ingest --companies-only`, exit 0: 17 557 companies in the database, updated 17 547, not found in bulk file 10 (832178802, 837060362, 917870926, 928807991, 931725610, 931987054, 933544087, 934799607, 936492835, 938378096). 17 053 companies have a municipality; the other 494 updated have no Norwegian business municipality (491 `NUF`, 3 `FLI`).
- `pnpm seed:export`; the first ten columns of `company.csv` are identical to the previous seed row for row, and `filing.csv` and `key_figures.csv` are unchanged. Then `pnpm seed` twice and `pnpm seed:export` again: byte-identical.
- `pnpm check:pins`, `check:env`, `lint`, `typecheck`, `pnpm test` (246), `pnpm test:db` (71), `pnpm test:ingest` (77, on the seeded database), `pnpm build`, `pnpm test:e2e` (3).

## Links

- AI log: "2026-10-14 — Story 1.5a: the search fields, the unaccent wrapper's grants, and where the data can still mislead".
- Updated: `docs/data-sources-brreg.md` (the stored Enhetsregisteret fields), `README.md` (`pnpm ingest --companies-only`), `AGENTS.md` (companies-only mode; functions in index expressions need EXECUTE for writers), sprint status.
