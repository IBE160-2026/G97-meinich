---
title: 'Story 1.2: Local Supabase with roles and grants — the read boundary'
type: 'feature'
created: '2026-10-10'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no database yet. Before any data exists, the read boundary (AD-3, AD-4) must be enforced by Postgres grants, not by code. Separately, review of PR #15 found that `check:env` misses the `env` key in `next.config.ts`, which Next.js inlines into the client bundle whatever the variable is called.

**Approach:** Add the Supabase CLI 2.120.0 as a pinned dev dependency, `supabase/config.toml`, `supabase/roles.sql` with the four roles, and one migration creating `register` and `app` with grants. Add a grants test that runs against local Postgres in CI, and `pnpm db:roles`, which generates and applies local role passwords. As a separate first commit, extend `check:env` to fail on an `env` key in `next.config.*`, with a test. Story ACs: GitHub issue #2 (authoritative; `epics.md` wins on conflict).

**Decisions (human, 2026-10-10):**
- **Passwords — option (c).** `pnpm db:roles` creates `.env` from `.env.example` if it is missing. For each of the four roles whose URL has no password, it generates one as hex from `crypto.randomBytes` (URL-safe), writes it into `.env`, and applies it with `ALTER ROLE`. It must:
  - never overwrite a password already in `.env`;
  - never print a password to stdout, stderr or a log;
  - refuse to write unless `git check-ignore .env` confirms `.env` is ignored.

  Running it twice changes nothing, and a test proves that.
- **Default privileges name the migration role.** `ALTER DEFAULT PRIVILEGES` names the role that actually runs the migrations (`FOR ROLE <migration role>`; verify which role the CLI uses). The test creates its later-added table as that same role, and asserts that `pg_default_acl` holds the reader grant for that role. Otherwise the "tables added later" test proves nothing.
- **`service_role` is tested too:** like `anon` and `authenticated`, it has no access to `register`.
- **Local host only.** `db:roles` refuses, before reading or writing anything, unless the host in `SUPABASE_DB_URL` is `127.0.0.1` or `localhost`. A hosted database (stage 2) must never get its passwords changed by this script.
- **No EXECUTE for PUBLIC on functions in `register` and `app`.** Postgres grants EXECUTE on new functions to PUBLIC by default, and a schema-scoped `ALTER DEFAULT PRIVILEGES … IN SCHEMA` cannot revoke a global default. So the migration uses the global form, `ALTER DEFAULT PRIVILEGES FOR ROLE <migration role> REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`, which also covers that role's functions in other schemas (v1 has none). The test creates a function in `register` as the migration role and asserts that neither `anon` nor `reader` can execute it. A later story that needs `reader` to call a function, such as Story 1.5's `unaccent` wrapper, must `GRANT EXECUTE` explicitly.
- **SET ROLE verified first.** Before writing the tests, verify that the role the tests connect as can `SET ROLE` to `reader`, `anon`, `authenticated` and `service_role` in Supabase's local Postgres, where `postgres` is not a true superuser. Record the result and the chosen solution in Implementation Notes, for example connecting as `supabase_admin`, or a migration `GRANT reader TO postgres`, with the trade-off.
- **`reader` cannot `CREATE` in any schema:** `register`, `app` and `public` by name, and every other non-system schema in the database.
- **Spec length:** kept whole, about 3,000 tokens; the human accepted the size.

## Boundaries & Constraints

**Always:**
- Branch `story/1.2-supabase-roles-grants`. Commit the `env`-key check first, separately from the database work. Small commits.
- **No push and no PR.** Stop at ready-for-review, as the user instructed.
- Exact pins: `supabase` 2.120.0 and `postgres` 3.4.9.
- All DDL in `supabase/migrations`, except `CREATE ROLE` in `supabase/roles.sql`. Neither file contains a password.
- Grants are tested by querying the catalog and by attempting the forbidden actions as the role, not by reading SQL text.

**Never:**
- No data tables in `register` or `app`, no `src/server/db.ts`, no RLS policies, no service-role key.
- Never expose `register` through `api.schemas`.
- No table write grants for `ingest`, `derive` or `loader`: no tables exist yet (AD-2 grants arrive with each table).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| env key | `next.config.*` has `env: {…}` or shorthand `env` in an object literal | `check:env` exits 1 with file:line | CI fails |
| no env key | `next.config.ts` without `env` | passes | — |
| later table | the migration role creates a table in `register` after the migration (rolled back) | `reader` has SELECT through `pg_default_acl` for that role | — |
| reader writes | that table, `SET ROLE reader`, INSERT/UPDATE/DELETE/TRUNCATE | each raises permission denied | test asserts the error |
| API roles | `anon`, `authenticated`, `service_role` | no USAGE on `register`; no privilege on that table; a SELECT as each fails | — |
| reader DDL | `reader` CREATE in `register`, `app`, `public` and every other non-system schema | `has_schema_privilege(…,'CREATE')` false; an attempted CREATE TABLE raises | — |
| db:roles first run | no `.env`, or empty passwords | `.env` created and filled with hex passwords; roles altered; nothing printed; `reader` logs in | — |
| db:roles rerun | passwords already in `.env` (also after `db:reset` recreated the roles) | `.env` byte-identical; the existing passwords are re-applied, never regenerated; logins work | — |
| db:roles remote host | `SUPABASE_DB_URL` host other than `127.0.0.1`/`localhost` | exits 1 before touching `.env` or the database | — |
| later function | the migration role creates a function in `register` after the migration (rolled back) | `has_function_privilege` false for `anon` and `reader`; calling it as each raises | — |
| db:roles unsafe | `.env` not gitignored, or a role/URL outside the four | exits 1; writes and alters nothing | — |

</frozen-after-approval>

## Code Map

- `package.json` -- add `supabase` (devDependency) and `postgres` (dependency); scripts `db:start`, `db:stop`, `db:reset`, `db:roles`, `test:db`. The `supabase` binary may need `allowBuilds: supabase: true` in `pnpm-workspace.yaml` (Story 1.1 denied `unrs-resolver` there).
- `scripts/check-no-public-env.ts`, `test/checks.test.ts`, `test/fixtures/public-env/` -- extend with the `env`-key rule using the TypeScript compiler API (`typescript` 6.0.3). Tests build the prefix string at runtime, as Story 1.1 did.
- `.env.example` -- the four `*_DATABASE_URL` values become CLI-default URLs with an empty password, e.g. `postgresql://reader:@127.0.0.1:54322/postgres`. Add `SUPABASE_DB_URL` (the CLI's local superuser URL, printed by `supabase status`, used only by `db:roles` and `test:db`). The two commented `NEXT_PUBLIC_` lines stay as they are.
- `.gitignore` -- already ignores `.env`; `db:roles` checks this with `git check-ignore`.
- `.github/workflows/ci.yml` -- add `pnpm exec supabase db start` (Postgres only; verify that it applies `roles.sql` and the migrations), then `pnpm db:roles` and `pnpm test:db`.
- `vitest.config.ts` -- `pnpm test` must not run DB tests: put them under `test/db/` with their own config.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/check-no-public-env.ts`, `test/checks.test.ts`, fixtures -- fail on an `env` property in `next.config.{ts,js,mjs,cjs}` via the TS AST. Tests: property, shorthand, clean config, CLI exit code. **Own commit, first.**
- [ ] `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` -- pins and scripts.
- [ ] `supabase/config.toml` -- from `supabase init`; `project_id = "peerless"`, `api.schemas` without `register`, `[db.seed] enabled = false`.
- [ ] `supabase/roles.sql` -- `CREATE ROLE reader|ingest|derive|loader LOGIN` with no password. Verify that CLI 2.120 runs it on start and reset; cite the source in Implementation Notes.
- [ ] `supabase/migrations/<timestamp>_register_and_app_schemas.sql`:
  - create `register` and `app`;
  - revoke all on both from `public`, `anon`, `authenticated` and `service_role`;
  - grant `USAGE` on `register` to the four roles;
  - grant `SELECT` on all tables in `register` to `reader`, plus `ALTER DEFAULT PRIVILEGES FOR ROLE <migration role> IN SCHEMA register GRANT SELECT ON TABLES TO reader`;
  - give no role `CREATE`;
  - `ALTER DEFAULT PRIVILEGES FOR ROLE <migration role> REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`.
- [ ] `scripts/set-role-passwords.ts` (`pnpm db:roles`) -- per the decision. Fixed list of four roles; statements built with `format('ALTER ROLE %I PASSWORD %L', …)`; output names roles only.
- [ ] **First, before any DB test:** verify `SET ROLE` from the test connection role to `reader`, `anon`, `authenticated` and `service_role`; record the outcome in Implementation Notes.
- [ ] `test/db/grants.test.ts` -- uses `SUPABASE_DB_URL` (CLI default when unset). Covers:
  - every grants row of the matrix, inside a rolled-back transaction, with the table and the function created via `SET ROLE <migration role>`;
  - `api.schemas` parsed from `config.toml`, and seeding disabled;
  - a loop over `pg_catalog.pg_tables` in `register`, so tables added later are covered;
  - the `reader` login through `READER_DATABASE_URL`.
- [ ] `test/db/set-role-passwords.test.ts` -- the db:roles matrix rows, run in a temp git repo with a copy of `.env.example`:
  - first run fills and applies passwords;
  - second run leaves `.env` byte-identical, and logins still work;
  - stdout and stderr contain none of the passwords;
  - a non-ignored `.env` makes it refuse;
  - a non-local host in `SUPABASE_DB_URL` (e.g. `db.example.supabase.co`) makes it refuse, with `.env` untouched.
- [ ] `test/no-ddl-outside-migrations.test.ts` -- DDL keywords (CREATE/ALTER/DROP of TABLE/SCHEMA/…) appear in `.sql` files only under `supabase/migrations/`; `roles.sql` holds only `CREATE ROLE`; no `PASSWORD` in either.
- [ ] CI; README "Local database" commands; AGENTS.md Toolchain line; `docs/ai-log.md` entry on what could go wrong with these grants; `docs/ai-sessions/2026-10-10-story-1-2-supabase-roles-grants.md`; sprint-status `review`.

**Acceptance Criteria:**
- Given a fresh clone with Docker, when `pnpm install`, `pnpm db:start`, `pnpm db:roles` and `pnpm test:db` run, then all pass with no API key, account or hand-written password.
- Given the branch, when inspected, then nothing is pushed and no PR exists.

## Design Notes

DB tests run as the local superuser and use `SET ROLE` inside a transaction, so CI needs no role passwords for the grants checks and rollback leaves nothing behind. Determine the migration role with `SELECT nspowner::regrole FROM pg_namespace WHERE nspname = 'register'`; the test asserts it equals the role named in `pg_default_acl`. `information_schema` hides objects the session cannot see, so the table loop uses `pg_catalog`.

## Verification

**Commands:**
- `pnpm check:pins && pnpm check:env && pnpm lint && pnpm typecheck && pnpm test` -- pass
- `pnpm db:start && pnpm db:roles && pnpm test:db` -- pass; then `pnpm db:reset && pnpm db:roles && pnpm test:db` -- pass again
- `git ls-remote origin story/1.2-supabase-roles-grants` -- empty

## Implementation Notes

## Spec Change Log

## Review Triage Log
