-- Story 2.5, review pass 1 (spec change log, Meinich 2026-11-01, option a):
-- a fingerprint references its company, not its document column.
--
-- 20261101120000_fingerprint.sql made register.fingerprint reference the
-- current register.document_column row it was derived from. With the
-- licence gate open, a fingerprint of a company outside the allow-list
-- then needed that company's document column in the seed, which
-- seed:export refuses and the loader's FK check would reject: the gate
-- could never export what it opens for. The technical note asks for
-- "fingerprint results … never the document figures behind them".
--
-- So the fingerprint references register.company (orgnr) ON DELETE CASCADE
-- ON UPDATE CASCADE, and the role column, which existed only for the
-- composite FK, goes. A company deleted after 410 Gone still takes its
-- fingerprints with it (ingest/tests/test_run_record.py::
-- test_gone_unit_is_deleted_everywhere). A fingerprint no longer follows an
-- in-place change to its column; `pnpm ingest` therefore runs `pnpm derive`
-- after step 1 (scripts/run-ingest.ts), which rebuilds the whole table.
--
-- No grant changes: derive and loader keep SELECT, INSERT and TRUNCATE.

ALTER TABLE register.fingerprint
  DROP CONSTRAINT fingerprint_orgnr_filing_year_role_fkey,
  DROP COLUMN role,
  ADD CONSTRAINT fingerprint_orgnr_fkey
    FOREIGN KEY (orgnr) REFERENCES register.company (orgnr) ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE register.fingerprint IS
  'The business-model fingerprint of a company''s filing year (Story 2.5): five categories derived by batch step 2 (derive) from the reconciled current document column, with src/engine/fingerprint.ts. References the company, not the column, so it can be committed without the figures behind it. Rebuilt whole on every step-2 run.';
