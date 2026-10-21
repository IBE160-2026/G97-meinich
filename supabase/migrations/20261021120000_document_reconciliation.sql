-- Story 2.2: reconciliation of the filed documents (FR-57, FR-58; technical
-- note AD-1, AD-15). Batch step 1 reconciles each read document under two
-- rules, each set once in ingest/config.toml ([reconciliation]):
--
--   within a document  c1-c5 each hold within an absolute bound in kroner;
--   between sources    each figure the key-figures API also holds agrees
--                      within max(floor, tolerance x |API figure|).
--
-- Per column it stores a fifth within-document check, c5, the status and the
-- API comparison; c1-c4 are rewritten under the configured bound. A
-- document's status is its current column's.
--
-- c5 (Meinich, 2026-10-21): sum_eiendeler = sum_egenkapital + sum_gjeld,
-- within the same bound. It shows the balance holds when the stated total
-- sum_egenkapital_gjeld was not read (c3 and c4 then not evaluable). The sum
-- exists only inside the check; nothing derived is stored (AD-15).
--
-- register.document.status keeps `extracted` as an allowed value: the
-- data-only dumps of the Story 2.1b run hold `extracted` rows and must still
-- restore. Their columns then have no status (NULL) until step 1 reconciles
-- them again from their stored figures; the engine treats a column with no
-- status as not reconciled (src/engine/document-inputs.ts).
--
-- No grant changes: `ingest` already holds UPDATE on both tables, and the
-- loader copies every column.

ALTER TABLE register.document_column
  ADD COLUMN c5 text CHECK (c5 IN ('pass', 'fail', 'not_evaluable')),
  ADD COLUMN status text CHECK (status IN ('reconciled', 'failed_reconciliation')),
  ADD COLUMN api_check text CHECK (api_check IN ('pass', 'fail', 'not_evaluable')),
  ADD COLUMN api_fail_fields text[];

-- c5 and the three are written together: all NULL (read, not yet
-- reconciled) or all set. api_fail_fields names exactly the failing figures, so it is
-- non-empty exactly when api_check is fail, and holds only the eleven names
-- the document and register.key_figures share.
ALTER TABLE register.document_column
  ADD CONSTRAINT document_column_reconciliation_written_together CHECK (
    (c5 IS NULL AND status IS NULL AND api_check IS NULL AND api_fail_fields IS NULL)
    OR (
      c5 IS NOT NULL AND status IS NOT NULL AND api_check IS NOT NULL AND api_fail_fields IS NOT NULL
      AND (api_check = 'fail') = (cardinality(api_fail_fields) > 0)
    )
  ),
  ADD CONSTRAINT document_column_api_fail_fields_shared CHECK (
    api_fail_fields <@ ARRAY[
      'sum_driftsinntekter', 'sum_driftskostnad', 'driftsresultat', 'netto_finans',
      'ordinaert_resultat_foer_skattekostnad', 'aarsresultat', 'sum_eiendeler', 'sum_egenkapital',
      'sum_kortsiktig_gjeld', 'sum_gjeld', 'sum_egenkapital_gjeld'
    ]::text[]
  ),
  -- The status rule, mirrored from ingest/src/peerless_ingest/reconcile.py
  -- (`column_status`): reconciled exactly when no check among c1-c5 fails,
  -- c1 (income statement) passed, the balance passed by c3 or c5, and, for
  -- the current column only, the API comparison did not fail. A prior
  -- column's API comparison is information and never decides its status.
  ADD CONSTRAINT document_column_status_follows_checks CHECK (
    status IS NULL
    OR (status = 'reconciled') = (
      c1 = 'pass' AND (c3 = 'pass' OR c5 = 'pass')
      AND c2 <> 'fail' AND c3 <> 'fail' AND c4 <> 'fail' AND c5 <> 'fail'
      AND (role = 'prior' OR api_check <> 'fail')
    )
  );

COMMENT ON COLUMN register.document_column.c1 IS
  'Within-document check: sum_driftsinntekter - sum_driftskostnad = driftsresultat, within reconciliation.within_document_bound_kr (ingest/config.toml).';
COMMENT ON COLUMN register.document_column.c2 IS
  'Within-document check: driftsresultat + netto_finans = ordinaert_resultat_foer_skattekostnad, within reconciliation.within_document_bound_kr.';
COMMENT ON COLUMN register.document_column.c3 IS
  'Within-document check: sum_eiendeler = sum_egenkapital_gjeld, within reconciliation.within_document_bound_kr.';
COMMENT ON COLUMN register.document_column.c4 IS
  'Within-document check: sum_egenkapital + sum_gjeld = sum_egenkapital_gjeld, within reconciliation.within_document_bound_kr.';
COMMENT ON COLUMN register.document_column.c5 IS
  'Within-document check (Story 2.2): sum_eiendeler = sum_egenkapital + sum_gjeld, within reconciliation.within_document_bound_kr; the sum is never stored. NULL while the document is extracted.';
COMMENT ON COLUMN register.document_column.status IS
  'reconciled or failed_reconciliation (Story 2.2); NULL while the document is extracted (read, not yet reconciled). Only a reconciled column''s figures reach the engine.';
COMMENT ON COLUMN register.document_column.api_check IS
  'The column against the key-figures API filing of its stated year: pass, fail, or not_evaluable (no such filing, or no figure both hold). For a prior column, information only.';
COMMENT ON COLUMN register.document_column.api_fail_fields IS
  'The figures that failed the between-sources check (field names without _ore); empty unless api_check is fail.';
COMMENT ON COLUMN register.document.status IS
  'reconciled or failed_reconciliation (the current column''s status), not_extracted, paper; extracted only for a row read before Story 2.2 and not yet reconciled again.';
