-- Story 2.4, review pass 1 (Meinich, 2026-10-30, Q4a): a dissolved company.
--
-- An ordinarily dissolved unit is not withdrawn: Enhetsregisteret answers
-- GET /enhetsregisteret/api/enheter/{orgnr} with 200 and a `slettedato`
-- (verified 2026-10-30 on 930663530, 974676125 and 936651437). Only a unit
-- removed from the register ("fjernet") answers 410 Gone, and only that
-- deletes (20261030120000_withdrawn_companies.sql).
--
-- Step 1's withdrawal check stores the register's slettedato, as given, on a
-- stored company absent from the bulk file whose unit answers 200 with one,
-- and does not look that company up again; the D5 share counts only absent
-- companies without a stored slettedato. NULL: not known to be dissolved.
-- Whether a dissolved company leaves the peer pool is not decided here
-- (deferred-work.md).
--
-- No grant changes: ingest already holds UPDATE on register.company, reader
-- SELECT, and the loader copies every column.

ALTER TABLE register.company
  ADD COLUMN slettedato date;

COMMENT ON COLUMN register.company.slettedato IS
  'The register''s slettedato, as given, for a unit answering 200 with one while absent from the bulk download (Story 2.4): dissolved, not withdrawn. Written by batch step 1 (ingest).';
