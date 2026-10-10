# Story 1.2: local Supabase with roles and grants

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #2, Story 1.2
**Result:** branch `story/1.2-supabase-roles-grants`, commits `44ab41a` (check:env `env` key), `ecf07ba` (CLI, roles, migration), `0298f7c` (db:roles), `9925b99` (tests), `9eaa9e4` (CI and docs); not pushed, no PR yet

## Goal

Enforce the read boundary (AD-3, AD-4) with Postgres grants before any data exists: the four roles, schemas `register` and `app` closed to the Supabase API roles, a grants test in CI, and local role passwords that are generated, never committed and never printed. Separately, close the PR #15 finding that `check:env` missed the `env` key in `next.config.ts`.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-2-supabase-roles-grants.md` fully and implement it — the spec is the sole source of truth."
- The human decisions frozen in the spec: password option (c) for `pnpm db:roles`, default privileges naming the migration role, `service_role` tested, local host only, no EXECUTE for PUBLIC on functions, SET ROLE verified before the tests, `reader` without CREATE anywhere.

## What came back, and what was done with it

- **Verified before building on it:**
  - The CLI 2.120.0 applies `supabase/roles.sql` on `db start` and `db reset` ("Seeding globals from roles.sql..."), then the migrations.
  - Migrations run as `postgres` (`nspowner` of `register`).
  - `postgres` is not a superuser on Supabase's image. It could `SET ROLE` to `anon`, `authenticated` and `service_role`, but not to `reader` (ADMIN without SET). Chosen fix: `GRANT reader TO postgres WITH INHERIT FALSE, SET TRUE` in the migration, rather than connecting the tests as `supabase_admin`, so the tests and `db:roles` use the one URL `supabase status` prints.
  - Docker's port mapping reaches Postgres from the bridge network, where `pg_hba` demands SCRAM, so the role passwords matter locally: on a fresh volume `reader` has no password and the login test fails until `pnpm db:roles` runs.
- **Accepted:**
  - `check:env` uses the TypeScript compiler API to find `env` as a property, quoted, computed, method or shorthand key in `next.config.{ts,js,mjs,cjs}`.
  - `db:roles` sends a SCRAM-SHA-256 verifier computed in Node instead of the password, so not even a server statement log holds it.
  - DB tests live in `test/db/` with `vitest.db.config.ts`, run one file at a time, and are excluded from `pnpm test`.
- **Corrected while building:**
  - A test passed `undefined` to mean "no SUPABASE_DB_URL", which a JavaScript default parameter turned back into the local URL; the script then ran instead of refusing. Changed to `null`.
  - The grants tests were checked against hand-made regressions (USAGE to `anon`, default INSERT for `reader`, EXECUTE to PUBLIC, CREATE on `app`), which failed nine tests until revoked.

## Links

- AI log: "2026-10-10 — Story 1.2: the read boundary in grants, and where it can still leak"
- Spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-roles-grants.md` (Implementation Notes)
