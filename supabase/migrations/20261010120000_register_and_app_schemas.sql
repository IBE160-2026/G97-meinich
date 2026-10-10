-- Story 1.2: the read boundary (technical note, AD-3, AD-4, AD-16).
--
-- register  public register data. Read by the request path as `reader`
--           (SELECT only); written by the batch roles once tables exist.
--           Never exposed through the Supabase Data API (config.toml
--           api.schemas), and closed to anon, authenticated and service_role
--           here as well, so a config change alone cannot open it.
-- app       user data from stage 2. Empty in v1.
--
-- The migrations run as `postgres`, the role the Supabase CLI connects as, so
-- the default privileges below name that role. test/db/grants.test.ts checks
-- that `postgres` owns `register` and that pg_default_acl holds these entries.

CREATE SCHEMA register;
CREATE SCHEMA app;

-- No implicit access for anyone. PUBLIC has no privilege on a new schema, but
-- the revokes state the boundary explicitly and survive a changed default.
REVOKE ALL ON SCHEMA register FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SCHEMA app FROM PUBLIC, anon, authenticated, service_role;

-- The four Peerless roles may look up objects in register. No role gets
-- CREATE: tables are created by migrations only.
GRANT USAGE ON SCHEMA register TO reader, ingest, derive, loader;

-- reader: SELECT on every table in register, now and later. Table write
-- grants for ingest, derive and loader arrive with each table (AD-2).
GRANT SELECT ON ALL TABLES IN SCHEMA register TO reader;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA register
  GRANT SELECT ON TABLES TO reader;

-- Postgres grants EXECUTE on every new function to PUBLIC. A schema-scoped
-- default cannot revoke a global default, so this is the global form: no
-- function created by postgres is executable by PUBLIC (and so by anon or
-- reader) unless a later migration grants EXECUTE explicitly. v1 has no
-- postgres-owned functions outside register and app that rely on PUBLIC.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Let the migration role switch to reader, so the grants test can attempt
-- reads and writes as reader in a rolled-back transaction. On Supabase's
-- Postgres, `postgres` is not a superuser: it holds ADMIN on the roles in
-- roles.sql but not SET, so `SET ROLE reader` is refused without this.
-- INHERIT FALSE: postgres gains no privilege from reader, and reader's
-- privileges are a subset of postgres's anyway.
GRANT reader TO postgres WITH INHERIT FALSE, SET TRUE;
