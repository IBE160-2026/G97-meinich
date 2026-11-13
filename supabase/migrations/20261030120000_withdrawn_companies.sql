-- Story 2.4: withdrawn companies disappear, and step 1 records every run
-- (technical note AD-2, AD-3; docs/data-sources-brreg.md, "Withdrawn
-- entities must be dropped").
--
-- 1. A company the register answers 410 Gone for is deleted by step 1 with
--    one `DELETE FROM register.company WHERE orgnr = …`, and every register
--    row that references it goes with it. document and document_column
--    already cascade from company (20261020120000). filing and key_figures
--    are re-created here with ON DELETE CASCADE, keeping ON UPDATE CASCADE
--    on key_figures (a reissued filing's new register id is still followed).
--    document.brreg_id stays NO ACTION: it is checked at the end of the
--    statement, after the cascade from company has removed the document.
--
-- 2. ingest gets DELETE on register.company and on no other table. The
--    cascades run as the owner of each referencing table, so ingest needs
--    no DELETE on them, and reader, derive and loader get no DELETE
--    anywhere (test/db/grants.test.ts).
--
-- 3. Schema `run` holds each batch step's run record, outside register: it
--    is never seeded or loaded, and the loader's table set (register only)
--    does not see it. run.step1 has one row per step-1 run in any mode,
--    inserted when the run starts and updated when it ends, also when it
--    ends in an exception. Only ingest may read and write it; derive and
--    loader have nothing, and reader has nothing, not even USAGE on the
--    schema, since nothing on the request path needs it yet
--    (test/db/run-grants.test.ts). Story 2.6 adds run.step2.

ALTER TABLE register.filing
  DROP CONSTRAINT filing_orgnr_fkey,
  ADD CONSTRAINT filing_orgnr_fkey
    FOREIGN KEY (orgnr) REFERENCES register.company (orgnr) ON DELETE CASCADE;

ALTER TABLE register.key_figures
  DROP CONSTRAINT key_figures_brreg_id_fkey,
  ADD CONSTRAINT key_figures_brreg_id_fkey
    FOREIGN KEY (brreg_id) REFERENCES register.filing (brreg_id) ON UPDATE CASCADE ON DELETE CASCADE;

GRANT DELETE ON register.company TO ingest;

CREATE SCHEMA run;

REVOKE ALL ON SCHEMA run FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA run TO ingest;

CREATE TABLE run.step1 (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- plain: `pnpm ingest`; companies_only: --companies-only;
  -- documents: --documents <file>; reread: --reread <file>.
  mode       text        NOT NULL CHECK (mode IN ('plain', 'companies_only', 'documents', 'reread')),
  started_at timestamptz NOT NULL,
  -- NULL only while the run is going, or if the process was killed.
  ended_at   timestamptz CHECK (ended_at IS NULL OR ended_at >= started_at),
  -- Counts per outcome, as the mode's summary gives them.
  counts     jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(counts) = 'object'),
  -- Every failure: [{"orgnr": …, "stage": …, "reason": …}, …].
  failures   jsonb       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(failures) = 'array'),
  -- Every orgnr deleted after a 410, appended in the deleting transaction.
  deleted    text[]      NOT NULL DEFAULT '{}',
  -- The exception that ended the run, as "Class: message"; NULL otherwise.
  error      text
);

COMMENT ON SCHEMA run IS
  'Batch run records (Story 2.4): one table per step, written only by that step''s role. Never seeded or loaded.';
COMMENT ON TABLE run.step1 IS
  'One row per step-1 run in any mode: started, ended, counts, failures, deleted orgnrs and the error that ended it. Written only by ingest.';

REVOKE ALL ON run.step1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON run.step1 TO ingest;
REVOKE ALL ON SEQUENCE run.step1_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SEQUENCE run.step1_id_seq TO ingest;
