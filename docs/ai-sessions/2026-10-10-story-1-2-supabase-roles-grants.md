# Story 1.2: local Supabase with roles and grants

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session, one implementation subagent working from the frozen spec, three review subagents
**Story / issue:** #2, Story 1.2
**Result:** branch `story/1.2-supabase-roles-grants`, commits `44ab41a` (check:env `env` key), `ecf07ba` (CLI, roles, migration), `0298f7c` (db:roles), `9925b99` (tests), `9eaa9e4` (CI and docs), `9f8096d` (notes, AI log, this file), review fixes `7c0fe76`, `40aa01b`, `1778c3a`, `88cdab1`, and the final records commit; not pushed, no PR yet (the human reviews first)

## Goal

Enforce the read boundary (AD-3, AD-4) with Postgres grants before any data exists: the four roles, schemas `register` and `app` closed to the Supabase API roles, a grants test in CI, and local role passwords that are generated, never committed and never printed. Separately, close the PR #15 finding that `check:env` missed the `env` key in `next.config.ts`.

## Prompts that mattered

- `/bmad-build Story 1.2 (local Supabase with roles and grants)`, with two additions: "`check:env` must also fail if `next.config.ts` has an `env` key … Add a test for it", and "Do not push the branch and do not open a PR before I have reviewed the code."
- On the plan: "Put the env-key check on the Story 1.2 branch, as its own commit, separate from the roles and grants work."
- On the spec, password option "(c)", plus: default privileges must name the migration role and the test must create its table as that role; `service_role` in the access tests; `db:roles` never overwrites or prints a password, uses hex from `crypto.randomBytes`, refuses unless `.env` is gitignored, and is idempotent; `reader` cannot CREATE in any schema.
- Before approval: `db:roles` refuses any host but `127.0.0.1`/`localhost`; revoke PUBLIC's default EXECUTE on functions; verify `SET ROLE` from the test connection first.
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

**Planning correction:** the human asked for `ALTER DEFAULT PRIVILEGES … IN SCHEMA` to revoke function EXECUTE from PUBLIC. A schema-scoped default cannot revoke a global one in Postgres, so the spec uses the global `FOR ROLE <migration role>` form; the test proves a later function in `register` is not executable by `anon` or `reader`.

**Review** (21 findings from three reviewers, verdicts in the spec's Review Triage Log):
- **Fixed:**
  - `db:roles` read `.env` differently from dotenv (first versus last duplicate, `export`, inline comments) and now refuses ambiguous role lines.
  - The upgrade path from a pre-1.2 `.env` (blank `VAR=` lines, a missing role line) had no success test; it has one now. This is the path the human's own `.env` took.
  - The register loop now covers views, materialized views and foreign tables.
  - `GRANT reader TO postgres`'s `INHERIT FALSE` is pinned by a test.
  - `check:env` also catches `config.env = …`.
  - The docs no longer claim function EXECUTE is closed "in any schema": Supabase's defaults still grant it to the API roles in `public` and `storage` (verified in `pg_default_acl`).
  - The Implementation Notes wrongly said `db reset` keeps passwords; verified that it clears them.
- **Rejected, and why:**
  - `postgres` stays in `dependencies`, because it becomes the request-path client in Story 1.5.
  - `auto_expose_new_tables` concerns `public`, outside this story.
  - The const-computed `env` key is contrived.
  - A missing `git` binary gets the same message as a non-ignored `.env`; rare.
  - The script reads `.env` before the host check. That is needed to find the URL, and nothing is written before the check.
- **Deferred:** aligning AGENTS.md's "every other DDL is a migration" with what the DDL-placement test checks (`deferred-work.md`).
- **Corrected elsewhere:** the Story 1.1 AI-log entry said `src/server/db.ts` arrives in Story 1.2; it is Story 1.5. A correction entry was appended.

## Links

- AI log: "2026-10-10 — Story 1.2: the read boundary in grants, and where it can still leak"
- Spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-roles-grants.md` (Implementation Notes)
