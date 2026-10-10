---
title: 'Story 1.2: Local Supabase with roles and grants — the read boundary'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'a3e8af7e4c72a95278451db2d970380eb13e7794'
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
- [x] `scripts/check-no-public-env.ts`, `test/checks.test.ts`, fixtures -- fail on an `env` property in `next.config.{ts,js,mjs,cjs}` via the TS AST. Tests: property, shorthand, clean config, CLI exit code. **Own commit, first.**
- [x] `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` -- pins and scripts.
- [x] `supabase/config.toml` -- from `supabase init`; `project_id = "peerless"`, `api.schemas` without `register`, `[db.seed] enabled = false`.
- [x] `supabase/roles.sql` -- `CREATE ROLE reader|ingest|derive|loader LOGIN` with no password. Verify that CLI 2.120 runs it on start and reset; cite the source in Implementation Notes.
- [x] `supabase/migrations/<timestamp>_register_and_app_schemas.sql`:
  - create `register` and `app`;
  - revoke all on both from `public`, `anon`, `authenticated` and `service_role`;
  - grant `USAGE` on `register` to the four roles;
  - grant `SELECT` on all tables in `register` to `reader`, plus `ALTER DEFAULT PRIVILEGES FOR ROLE <migration role> IN SCHEMA register GRANT SELECT ON TABLES TO reader`;
  - give no role `CREATE`;
  - `ALTER DEFAULT PRIVILEGES FOR ROLE <migration role> REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`.
- [x] `scripts/set-role-passwords.ts` (`pnpm db:roles`) -- per the decision. Fixed list of four roles; statements built with `format('ALTER ROLE %I PASSWORD %L', …)`; output names roles only.
- [x] **First, before any DB test:** verify `SET ROLE` from the test connection role to `reader`, `anon`, `authenticated` and `service_role`; record the outcome in Implementation Notes.
- [x] `test/db/grants.test.ts` -- uses `SUPABASE_DB_URL` (CLI default when unset). Covers:
  - every grants row of the matrix, inside a rolled-back transaction, with the table and the function created via `SET ROLE <migration role>`;
  - `api.schemas` parsed from `config.toml`, and seeding disabled;
  - a loop over `pg_catalog.pg_tables` in `register`, so tables added later are covered;
  - the `reader` login through `READER_DATABASE_URL`.
- [x] `test/db/set-role-passwords.test.ts` -- the db:roles matrix rows, run in a temp git repo with a copy of `.env.example`:
  - first run fills and applies passwords;
  - second run leaves `.env` byte-identical, and logins still work;
  - stdout and stderr contain none of the passwords;
  - a non-ignored `.env` makes it refuse;
  - a non-local host in `SUPABASE_DB_URL` (e.g. `db.example.supabase.co`) makes it refuse, with `.env` untouched.
- [x] `test/no-ddl-outside-migrations.test.ts` -- DDL keywords (CREATE/ALTER/DROP of TABLE/SCHEMA/…) appear in `.sql` files only under `supabase/migrations/`; `roles.sql` holds only `CREATE ROLE`; no `PASSWORD` in either.
- [x] CI; README "Local database" commands; AGENTS.md Toolchain line; `docs/ai-log.md` entry on what could go wrong with these grants; `docs/ai-sessions/2026-10-10-story-1-2-supabase-roles-grants.md`; sprint-status `review`.

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

- **roles.sql is applied by the CLI.** Observed with CLI 2.120.0: `supabase db start` and `supabase db reset` both print "Seeding globals from roles.sql..." before "Applying migration …". The Go binary bundled in `@supabase/cli-*` also contains the path `roles.sql`. A fresh volume (`supabase stop --no-backup`, then `db start`) creates the four roles with `rolpassword` NULL. `db reset` also leaves all four with `rolpassword` NULL (verified in review: corrected from an earlier note saying it kept them), so `pnpm db:roles` must run again after a reset; it re-applies the passwords already in `.env`.
- **Migration role = `postgres`.** `SELECT nspowner::regrole FROM pg_namespace WHERE nspname = 'register'` returns `postgres`; the CLI's `SUPABASE_DB_URL` connects as `postgres`. The default-privilege statements name `FOR ROLE postgres`; the test reads the owner from the catalog and asserts that `pg_default_acl` names it.
- **SET ROLE, verified before the tests.** Connected as `postgres` (not a superuser on Supabase's image; `rolsuper = f`): `SET ROLE anon`, `authenticated` and `service_role` succeed (membership with SET, granted by `supabase_admin`). `SET ROLE reader` fails: "permission denied to set role" — `postgres` holds ADMIN on the roles from `roles.sql` but `set_option = f`, `inherit_option = f`. Chosen: the migration runs `GRANT reader TO postgres WITH INHERIT FALSE, SET TRUE`. Trade-off: anyone who can log in as `postgres` can become `reader`, which grants nothing new (reader's privileges are a subset, and INHERIT FALSE leaves `postgres`'s own privileges unchanged); the alternative, connecting the tests as `supabase_admin`, would have needed a second, CLI-internal superuser URL and would bypass every permission check except the ones under `SET ROLE`. `ingest`, `derive` and `loader` are not granted; their tests arrive with their tables.
- **No allowBuilds entry.** The `supabase` npm package ships its binaries as optional per-platform dependencies (`@supabase/cli-linux-x64` etc. are in the lockfile); no install script runs, so `pnpm-workspace.yaml` is unchanged.
- **db:roles details.** A missing role URL in an existing `.env` (one of the four) is appended from `.env.example`; `SUPABASE_DB_URL` is never appended. A rerun leaves `.env` byte-identical and the effective passwords unchanged; the stored SCRAM verifier gets a fresh salt each run. `SUPABASE_DB_URL` is taken from the process environment, then `.env`, then `.env.example`, then the CLI default; its host is checked before `.env` is written or the database is touched. The `ALTER ROLE` statement is built by `format('ALTER ROLE %I PASSWORD %L', …)` with a SCRAM-SHA-256 verifier computed in Node as the literal, so the password never reaches the server as text.
- **Order inside test:db.** Vitest orders files by previous duration, so `set-role-passwords.test.ts` may run first; its `afterAll` re-runs `db:roles` in the repository root to restore the root `.env` passwords. The grants test's reader login needs `pnpm db:roles` to have run (CI does).
- **Verification run (local, Docker 29.7.2, Windows 11):** `check:pins`, `check:env`, `lint`, `typecheck`, `test` (68 tests) pass; `db:start` → `db:roles` → `test:db` (28 tests) pass; `db:reset` → `db:roles` → `test:db` pass; `supabase stop --no-backup` → `db:start` → `db:roles` → `test:db` pass. Regression check: granting USAGE on `register` to `anon`, default INSERT to `reader`, EXECUTE on functions to PUBLIC and CREATE on `app` to `reader` by hand made nine grants tests fail; revoked afterwards. CI not run (nothing pushed).

## Spec Change Log

## Review Triage Log

Pass 1 (blind-hunter BH, edge-case-hunter EC, verification-gap VG):

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 1 | VG: db:roles on an existing `.env` with blank `VAR=` lines or missing role lines never tested on a success path | medium | All success tests start from no `.env`; the user's own pre-1.2 `.env` took exactly this path | patch |
| 2 | EC/BH/VG: `findLine` takes the first `VAR=` line, `parseEnv` the last; `export`, spaces, inline `#` comments parsed differently | medium | A duplicate or commented line makes db:roles apply a password the app does not read, or writes a percent-encoded comment into the URL | patch (refuse duplicates and non-plain role lines) |
| 3 | EC/BH: `register` loop uses `pg_tables`, so views, matviews, foreign tables escape | low | `pg_tables` = relkind r/p only; direct query change | patch |
| 4 | BH: no test pins `INHERIT FALSE` on `GRANT reader TO postgres` | low | The safety argument rests on it; one catalog assertion | patch |
| 5 | EC/BH: `check:env` misses `config.env = …` / `config['env'] = …` | low | Object-literal scan only; direct AST case | patch |
| 6 | EC: computed key from a const (`[k]`) | low | Contrived; needs type checker | reject |
| 7 | BH: docs claim function EXECUTE closed "in any schema" | low | Verified `pg_default_acl`: `postgres` grants EXECUTE (and table rights) to anon/authenticated/service_role in `public` and `storage`; claim true for `register`/`app` only | patch (migration comment, ai-log) |
| 8 | BH: Implementation Notes say `db reset` keeps passwords | low | Verified: after `db:reset` all four `rolpassword` are NULL; README is right | patch (notes) |
| 9 | BH: Notes say any missing variable is appended | low | Only the four role URLs are appended | patch (notes) |
| 10 | BH/EC: "running it again changes nothing" | low | Each run re-sends a verifier with a fresh salt; `.env` and the effective passwords are unchanged | patch (wording) |
| 11 | BH: `src/server/db.ts` with `server-only` missing | false | Spec Never excludes it; epics put it in Story 1.5 (`epics.md:813`). The Story 1.1 ai-log entry named 1.2 wrongly | patch (ai-log correction) |
| 12 | BH: `postgres` in `dependencies` unused at runtime | low | Becomes the request-path client in Story 1.5; spec placed it there | reject |
| 13 | BH: `auto_expose_new_tables` default true | low | Concerns `public`, outside this story's boundary (`register`); v1 creates nothing in `public` | reject (noted) |
| 14 | BH: migration fails on hosted Supabase (roles.sql is local-only) | low | `db push` does not apply roles.sql; stage 2 | patch (ai-log known gap) |
| 15 | BH: DDL test misses GRANT/REVOKE and DDL in code; AGENTS.md says "every other DDL is a migration" | low | Fix edits AGENTS.md wording | defer |
| 16 | BH: missing `git` reported as "not gitignored" | low | Rare; adds a branch | reject |
| 17 | BH/EC: `afterEach` `rmSync(repo)` masks a `beforeEach` failure | low | Direct guard | patch |
| 18 | BH: test `afterAll` may generate passwords in the developer's `.env` | low | Same effect as the README's own `db:roles` step | reject |
| 19 | EC claim: refuses "before reading or writing anything" but reads `.env` first | low | Reading `.env` is needed to find `SUPABASE_DB_URL`; nothing is written or altered before the check. Fix would edit the spec | reject (reported to human) |
| 20 | BH: spec `in-review` vs sprint `review` | false | Separate vocabularies | reject |
| 21 | BH: session file omits a commit and a "rejected" line | low | Docs | patch (orchestrator) |
