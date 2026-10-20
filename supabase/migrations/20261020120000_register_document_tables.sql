-- Story 2.1b: the filed documents batch step 1 reads by OCR (technical note
-- AD-1, AD-2, AD-9, AD-14, AD-15, AD-18). Step 1 runs as `ingest` and runs no
-- DDL; these tables exist only through this migration.
--
-- register.document         one row per filed document (orgnr, filing year):
--                           its layout, status, reporting unit and read date.
-- register.document_column  one row per figure column of a document that was
--                           read: this year's (`current`) and last year's
--                           (`prior`), each with the year it states, the four
--                           within-document checks and every figure as printed.
--
-- Stored as filed: a figure is the printed whole-unit amount times 100, in
-- øre, or NULL when it is absent or unreadable, never 0; a printed 0 is 0.
-- Stated totals are kept as printed. No ratio, distribution or derived amount
-- is stored here (AD-1, AD-15); derivation of a missing component lives only
-- in src/engine.
--
-- reader gets SELECT on both through the default privileges from
-- 20261010120000_register_and_app_schemas.sql. derive gets nothing.

-- One row per filed document. The filing year is the year in the register's
-- list of filed documents (`…/aarsregnskap/kopi/{orgnr}/aar`), used in the
-- document's path; the `år` query parameter is never sent.
CREATE TABLE register.document (
  orgnr       char(9)     NOT NULL REFERENCES register.company (orgnr),
  filing_year smallint    NOT NULL,
  -- The key-figures API filing of the same company and year, when there is
  -- exactly one SELSKAP filing for it; NULL otherwise (the API holds only the
  -- latest years, so 2021 and 2022 usually have none).
  brreg_id    bigint      REFERENCES register.filing (brreg_id) ON UPDATE CASCADE,
  -- Page 1's classification; NULL when Tesseract failed before a read.
  layout      text        CHECK (layout IN ('generated', 'paper', 'unknown')),
  -- extracted: read, with columns, not yet reconciled (Story 2.2 replaces it
  -- with reconciled or failed_reconciliation). Nothing is usable before then.
  status      text        NOT NULL
              CHECK (status IN ('extracted', 'reconciled', 'failed_reconciliation', 'not_extracted', 'paper')),
  -- Why a generated document has no columns.
  refusal     text        CHECK (refusal IN ('reporting_unit', 'year_header', 'year_mismatch', 'ocr_error')),
  -- The bare currency code of the "Beløp i:" header, when the figures were read.
  valuta      text,
  -- The "Beløp i:" header as read (the reporting unit), NULL if there was none.
  unit_text   text,
  read_at     timestamptz NOT NULL,
  -- Provenance only (AD-9): which dataset produced the row. Step 1 writes full.
  dataset     text        NOT NULL CHECK (dataset IN ('demo', 'full')),
  PRIMARY KEY (orgnr, filing_year),
  -- Status, layout and refusal agree. Written with coalesce, because a CHECK
  -- whose expression is NULL passes.
  CHECK (
    CASE status
      WHEN 'paper' THEN coalesce(layout, '') = 'paper' AND refusal IS NULL
      WHEN 'not_extracted' THEN
        (coalesce(layout, '') = 'unknown' AND refusal IS NULL)
        OR (coalesce(layout, '') = 'generated' AND coalesce(refusal, '') IN ('reporting_unit', 'year_header', 'year_mismatch'))
        OR (layout IS NULL AND coalesce(refusal, '') = 'ocr_error')
      ELSE coalesce(layout, '') = 'generated' AND refusal IS NULL AND valuta IS NOT NULL
    END
  )
);

COMMENT ON TABLE register.document IS
  'One filed annual-accounts document per company and filing year: layout, status, reporting unit and read date (AD-15). Written by batch step 1 (ingest).';
COMMENT ON COLUMN register.document.filing_year IS
  'The year in the register''s list of filed documents, used in the document path; never a requested år (AD-18).';
COMMENT ON COLUMN register.document.brreg_id IS
  'The key-figures API filing of the same orgnr and filing year (SELSKAP, exactly one), or NULL.';
COMMENT ON COLUMN register.document.unit_text IS 'The reporting unit: the "Beløp i:" header as read.';
COMMENT ON COLUMN register.document.read_at IS 'When step 1 fetched and read this document (AD-18).';
COMMENT ON COLUMN register.document.dataset IS 'The dataset that produced this row; provenance only (AD-9).';

-- One row per figure column of a read document. Columns are named after the
-- field of the generated layout with the suffix _ore (AD-14).
CREATE TABLE register.document_column (
  orgnr              char(9)  NOT NULL,
  filing_year        smallint NOT NULL,
  role               text     NOT NULL CHECK (role IN ('current', 'prior')),
  -- The year the column's header states, read from the document.
  stated_year        smallint NOT NULL,
  -- The four within-document checks of Story 2.1a, each within 5 kr:
  --   c1  sum_driftsinntekter - sum_driftskostnad = driftsresultat
  --   c2  driftsresultat + netto_finans           = ordinaert_resultat_foer_skattekostnad
  --   c3  sum_eiendeler                           = sum_egenkapital_gjeld
  --   c4  sum_egenkapital + sum_gjeld             = sum_egenkapital_gjeld
  c1                 text     NOT NULL CHECK (c1 IN ('pass', 'fail', 'not_evaluable')),
  c2                 text     NOT NULL CHECK (c2 IN ('pass', 'fail', 'not_evaluable')),
  c3                 text     NOT NULL CHECK (c3 IN ('pass', 'fail', 'not_evaluable')),
  c4                 text     NOT NULL CHECK (c4 IN ('pass', 'fail', 'not_evaluable')),
  -- Fields whose figure came from the digits-only pass.
  digits_pass_fields text[]   NOT NULL,
  salgsinntekt_ore                          bigint,
  sum_driftsinntekter_ore                   bigint,
  varekostnad_ore                           bigint,
  lonnskostnad_ore                          bigint,
  avskrivninger_ore                         bigint,
  nedskrivninger_ore                        bigint,
  annen_driftskostnad_ore                   bigint,
  sum_driftskostnad_ore                     bigint,
  driftsresultat_ore                        bigint,
  netto_finans_ore                          bigint,
  ordinaert_resultat_foer_skattekostnad_ore bigint,
  aarsresultat_ore                          bigint,
  sum_immaterielle_eiendeler_ore            bigint,
  sum_varige_driftsmidler_ore               bigint,
  varer_ore                                 bigint,
  kundefordringer_ore                       bigint,
  bankinnskudd_ore                          bigint,
  sum_eiendeler_ore                         bigint,
  sum_egenkapital_ore                       bigint,
  leverandorgjeld_ore                       bigint,
  sum_kortsiktig_gjeld_ore                  bigint,
  sum_gjeld_ore                             bigint,
  sum_egenkapital_gjeld_ore                 bigint,
  dataset            text     NOT NULL CHECK (dataset IN ('demo', 'full')),
  PRIMARY KEY (orgnr, filing_year, role),
  FOREIGN KEY (orgnr, filing_year) REFERENCES register.document (orgnr, filing_year),
  CHECK (
    (role = 'current' AND stated_year = filing_year)
    OR (role = 'prior' AND stated_year = filing_year - 1)
  ),
  CHECK (
    digits_pass_fields <@ ARRAY[
      'salgsinntekt', 'sum_driftsinntekter', 'varekostnad', 'lonnskostnad', 'avskrivninger',
      'nedskrivninger', 'annen_driftskostnad', 'sum_driftskostnad', 'driftsresultat', 'netto_finans',
      'ordinaert_resultat_foer_skattekostnad', 'aarsresultat', 'sum_immaterielle_eiendeler',
      'sum_varige_driftsmidler', 'varer', 'kundefordringer', 'bankinnskudd', 'sum_eiendeler',
      'sum_egenkapital', 'leverandorgjeld', 'sum_kortsiktig_gjeld', 'sum_gjeld', 'sum_egenkapital_gjeld'
    ]::text[]
  )
);

COMMENT ON TABLE register.document_column IS
  'The figure columns of a read document, as printed, in øre (AD-14, AD-15): this year''s and the prior year''s, each with its own stated year and check results. Written by batch step 1 (ingest).';
COMMENT ON COLUMN register.document_column.stated_year IS 'The year the column header states, read from the document.';
COMMENT ON COLUMN register.document_column.digits_pass_fields IS 'Fields whose figure came from the digits-only pass (Story 2.1a gate).';
COMMENT ON COLUMN register.document_column.dataset IS 'The dataset that produced this row; provenance only (AD-9).';
COMMENT ON COLUMN register.document_column.salgsinntekt_ore IS 'øre; Salgsinntekt(er), as printed';
COMMENT ON COLUMN register.document_column.sum_driftsinntekter_ore IS 'øre; Sum inntekter / Sum driftsinntekter, as printed';
COMMENT ON COLUMN register.document_column.varekostnad_ore IS 'øre; Varekostnad, as printed';
COMMENT ON COLUMN register.document_column.lonnskostnad_ore IS 'øre; Lønnskostnad, as printed';
COMMENT ON COLUMN register.document_column.avskrivninger_ore IS 'øre; Avskrivning på varige driftsmidler og immaterielle eiendeler, as printed';
COMMENT ON COLUMN register.document_column.nedskrivninger_ore IS 'øre; Nedskrivning av varige driftsmidler og immaterielle eiendeler, as printed';
COMMENT ON COLUMN register.document_column.annen_driftskostnad_ore IS 'øre; Annen driftskostnad, as printed';
COMMENT ON COLUMN register.document_column.sum_driftskostnad_ore IS 'øre; Sum kostnader / Sum driftskostnader, as printed';
COMMENT ON COLUMN register.document_column.driftsresultat_ore IS 'øre; Driftsresultat, as printed';
COMMENT ON COLUMN register.document_column.netto_finans_ore IS 'øre; Netto finans, as printed';
COMMENT ON COLUMN register.document_column.ordinaert_resultat_foer_skattekostnad_ore IS 'øre; (Ordinært) resultat før skattekostnad, as printed';
COMMENT ON COLUMN register.document_column.aarsresultat_ore IS 'øre; Årsresultat, as printed';
COMMENT ON COLUMN register.document_column.sum_immaterielle_eiendeler_ore IS 'øre; Sum immaterielle eiendeler, as printed';
COMMENT ON COLUMN register.document_column.sum_varige_driftsmidler_ore IS 'øre; Sum varige driftsmidler, as printed';
COMMENT ON COLUMN register.document_column.varer_ore IS 'øre; Varer, as printed';
COMMENT ON COLUMN register.document_column.kundefordringer_ore IS 'øre; Kundefordringer, as printed';
COMMENT ON COLUMN register.document_column.bankinnskudd_ore IS 'øre; Sum bankinnskudd, kontanter og lignende, as printed';
COMMENT ON COLUMN register.document_column.sum_eiendeler_ore IS 'øre; Sum eiendeler, as printed';
COMMENT ON COLUMN register.document_column.sum_egenkapital_ore IS 'øre; Sum egenkapital, as printed';
COMMENT ON COLUMN register.document_column.leverandorgjeld_ore IS 'øre; Leverandørgjeld, as printed';
COMMENT ON COLUMN register.document_column.sum_kortsiktig_gjeld_ore IS 'øre; Sum kortsiktig gjeld, as printed';
COMMENT ON COLUMN register.document_column.sum_gjeld_ore IS 'øre; Sum gjeld, as printed';
COMMENT ON COLUMN register.document_column.sum_egenkapital_gjeld_ore IS 'øre; Sum egenkapital og gjeld, as printed';

-- Step 1 is the one writer (AD-2): upserts need SELECT, INSERT and UPDATE; no
-- DELETE or TRUNCATE. The seed loader truncates and replaces them (SELECT,
-- INSERT, TRUNCATE), as every register table.
GRANT SELECT, INSERT, UPDATE ON register.document, register.document_column TO ingest;
GRANT SELECT, INSERT, TRUNCATE ON register.document, register.document_column TO loader;
