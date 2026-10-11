-- Story 1.3b: the seed path (technical note AD-2, AD-3, AD-16).
--
-- register.dataset          the manifest of the loaded seed, one row.
-- register.covered_industry the industries Peerless covers, written by the
--                           loader from seed/coverage.json. No batch step
--                           writes either table (AD-2).
--
-- reader gets SELECT on both through the default privileges from
-- 20261010120000_register_and_app_schemas.sql. ingest and derive get nothing
-- on them.

-- One dataset at a time (AD-9): the id is always 1.
CREATE TABLE register.dataset (
  id             smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dataset        text     NOT NULL CHECK (dataset IN ('demo', 'full')),
  format_version int      NOT NULL,
  -- The latest file name in supabase/migrations when the seed was exported,
  -- without the .sql extension.
  migration_id   text     NOT NULL,
  manifest       jsonb    NOT NULL
);

COMMENT ON TABLE register.dataset IS
  'The manifest of the loaded seed (AD-16). One row. Written only by the seed loader.';

-- One row per entry in seed/coverage.json. A report path and its checksum
-- are present exactly when the industry is measured (FR-3).
CREATE TABLE register.covered_industry (
  code     text     PRIMARY KEY CHECK (code ~ '^\d{2}\.\d{3}$'),
  measured boolean  NOT NULL,
  report   text,
  sha256   char(64),
  CHECK (
    (measured AND report IS NOT NULL AND sha256 IS NOT NULL)
    OR (NOT measured AND report IS NULL AND sha256 IS NULL)
  )
);

COMMENT ON TABLE register.covered_industry IS
  'Industries Peerless covers, from seed/coverage.json (AD-2, AD-16). Written only by the seed loader.';
COMMENT ON COLUMN register.covered_industry.report IS 'Path of the measurement report under analysis/output/, when measured.';
COMMENT ON COLUMN register.covered_industry.sha256 IS 'SHA-256 of the report file, lower-case hex, when measured.';

-- The loader truncates and replaces every register table in one
-- transaction. COPY FROM needs INSERT; SELECT lets the round-trip test
-- export inside the loader's own uncommitted transaction, and adds nothing
-- reader cannot already read. No UPDATE or DELETE.
GRANT SELECT, INSERT, TRUNCATE ON
  register.company, register.filing, register.key_figures,
  register.dataset, register.covered_industry
TO loader;
