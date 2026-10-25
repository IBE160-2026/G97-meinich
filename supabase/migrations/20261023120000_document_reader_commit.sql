-- Story 2.3b: every filed document records the reader version that read it
-- (issue #38). The version is the full 40-hex commit of the last change to
-- ingest/ when the step-1 image read the document (`git log -1 --format=%H --
-- ingest/`, passed in by scripts/run-ingest.ts as PEERLESS_READER_COMMIT).
-- `pnpm ingest --reread <file>` re-reads every stored document of the listed
-- companies whose reader_commit is not the current one, so an interrupted
-- re-read resumes where it stopped.
--
-- The columns of a document inherit its version: step 1 writes a document
-- and its columns in one transaction (write.write_document), so a column is
-- never read by another version than its document row.
--
-- Backfill (Meinich, 2026-10-23), by read_at, of the rows read before this
-- column existed. On CI's freshly migrated database the table is empty here
-- and this is a no-op; the seed then loads its rows with their version.
--
--   before 2026-10-22 UTC   the Story 2.1b acceptance run, e09a413
--   from 2026-10-22 UTC     the Story 2.3 OCR reference run, 901a78d
--
-- Each is the last commit that changed ingest/ before its run, the same
-- definition new rows use. The reference run's image was built at cfecb1e,
-- which changed only analysis/ocr/ (corrected 2026-10-25, Meinich).
--
-- test/db/reader-commit-backfill.test.ts runs this file again on rows on
-- both sides of the boundary, in a transaction it rolls back.
--
-- No grant changes: `ingest` already holds INSERT and UPDATE on the table,
-- and the loader copies every column.

ALTER TABLE register.document
  ADD COLUMN reader_commit text;

UPDATE register.document
   SET reader_commit = CASE
     WHEN read_at < timestamptz '2026-10-22 00:00:00+00' THEN 'e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d'
     ELSE '901a78dbee3081c1708f8d140b4e769e6e764abd'
   END;

ALTER TABLE register.document
  ALTER COLUMN reader_commit SET NOT NULL,
  ADD CONSTRAINT document_reader_commit_is_a_commit CHECK (reader_commit ~ '^[0-9a-f]{40}$');

COMMENT ON COLUMN register.document.reader_commit IS
  'The reader version that read this document and its columns (Story 2.3b): the full commit of the last change to ingest/ in the step-1 image. A re-read (pnpm ingest --reread) replaces a document read by another version.';
