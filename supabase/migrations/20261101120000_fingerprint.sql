-- Story 2.5: the business-model fingerprint (FR-10, FR-13; technical note
-- AD-1, AD-2, AD-9, AD-13). Batch step 2 (`pnpm derive`, the `derive`
-- role) derives one fingerprint per (orgnr, filing year) from the reconciled
-- current column of the filed document, with src/engine/fingerprint.ts, and
-- rebuilds the whole table in one transaction (TRUNCATE, then INSERT). The
-- request path reads it as reader for funnel stage 4. The seed loader
-- truncates and replaces it, as every register table.
--
-- Five categories, mirroring the Fingerprint type:
--
--   cost_of_goods_lo/_hi     varekostnad / sum_driftsinntekter, banded
--   personnel_cost_lo/_hi    lonnskostnad / sum_driftsinntekter, banded
--   asset_intensity_lo/_hi   sum_varige_driftsmidler / sum_driftsinntekter, banded
--   inventory                varer > 0; NULL when unknown
--   capitalised_intangibles  sum_immaterielle_eiendeler >= 5 % of revenue; NULL when unknown
--
-- A band is a range: an empty line lies in an interval that can span bands,
-- so each banded category stores its lowest and highest possible band
-- (known when they are equal). The business type is derived from these in
-- the request and never stored. No share, ratio or amount is stored (AD-1):
-- benchmarked shares leave the engine only as band ids.
--
-- input_digest is the digest (src/engine/digest.ts) of the raw inputs the
-- fingerprint was derived from: the document figures it reads and the two
-- key-figures API subtotals of the filing the document belongs to. CI
-- recomputes it from the committed seed (test/fingerprint-seed.test.ts).
--
-- A fingerprint belongs to its current document column and goes with it:
-- ON DELETE CASCADE (a company deleted after 410 Gone takes its documents,
-- and their fingerprints, with it; Story 2.4's deletion test covers this)
-- and ON UPDATE CASCADE.
--
-- Grants: derive reads the step-1 tables it derives from (document_column,
-- document, and key_figures for the subtotals, joined through
-- document.brreg_id) and writes only this table, by TRUNCATE and INSERT:
-- no UPDATE, no DELETE. loader gets SELECT, INSERT and TRUNCATE, as on
-- every register table. reader gets SELECT through the default privileges
-- of 20261010120000_register_and_app_schemas.sql.

CREATE TABLE register.fingerprint (
  orgnr                   char(9)  NOT NULL,
  filing_year             smallint NOT NULL,
  -- Only the current column of a filing year is fingerprinted.
  role                    text     NOT NULL CHECK (role = 'current'),
  cost_of_goods_lo        text     NOT NULL CHECK (cost_of_goods_lo IN ('low', 'mid', 'high')),
  cost_of_goods_hi        text     NOT NULL CHECK (cost_of_goods_hi IN ('low', 'mid', 'high')),
  personnel_cost_lo       text     NOT NULL CHECK (personnel_cost_lo IN ('low', 'mid', 'high')),
  personnel_cost_hi       text     NOT NULL CHECK (personnel_cost_hi IN ('low', 'mid', 'high')),
  asset_intensity_lo      text     NOT NULL CHECK (asset_intensity_lo IN ('low', 'mid', 'high')),
  asset_intensity_hi      text     NOT NULL CHECK (asset_intensity_hi IN ('low', 'mid', 'high')),
  inventory               boolean,
  capitalised_intangibles boolean,
  input_digest            char(64) NOT NULL CHECK (input_digest ~ '^[0-9a-f]{64}$'),
  -- Provenance only (AD-9): copied from the document column.
  dataset                 text     NOT NULL CHECK (dataset IN ('demo', 'full')),
  PRIMARY KEY (orgnr, filing_year),
  FOREIGN KEY (orgnr, filing_year, role)
    REFERENCES register.document_column (orgnr, filing_year, role) ON DELETE CASCADE ON UPDATE CASCADE,
  -- lo <= hi in band order.
  CHECK (array_position(ARRAY['low', 'mid', 'high'], cost_of_goods_lo)
         <= array_position(ARRAY['low', 'mid', 'high'], cost_of_goods_hi)),
  CHECK (array_position(ARRAY['low', 'mid', 'high'], personnel_cost_lo)
         <= array_position(ARRAY['low', 'mid', 'high'], personnel_cost_hi)),
  CHECK (array_position(ARRAY['low', 'mid', 'high'], asset_intensity_lo)
         <= array_position(ARRAY['low', 'mid', 'high'], asset_intensity_hi))
);

COMMENT ON TABLE register.fingerprint IS
  'The business-model fingerprint of a filing year (Story 2.5): five categories derived by batch step 2 (derive) from the reconciled current document column, with src/engine/fingerprint.ts. Rebuilt whole on every step-2 run.';
COMMENT ON COLUMN register.fingerprint.cost_of_goods_lo IS
  'Lowest possible band of varekostnad / sum_driftsinntekter: low < 10 %, mid < 40 %, high; equal to _hi when known.';
COMMENT ON COLUMN register.fingerprint.personnel_cost_lo IS
  'Lowest possible band of lonnskostnad / sum_driftsinntekter: low < 30 %, mid < 60 %, high; equal to _hi when known.';
COMMENT ON COLUMN register.fingerprint.asset_intensity_lo IS
  'Lowest possible band of sum_varige_driftsmidler / sum_driftsinntekter: low < 10 %, mid < 50 %, high; equal to _hi when known.';
COMMENT ON COLUMN register.fingerprint.inventory IS 'varer > 0; NULL when an empty line leaves it unknown.';
COMMENT ON COLUMN register.fingerprint.capitalised_intangibles IS
  'sum_immaterielle_eiendeler >= 5 % of sum_driftsinntekter; NULL when an empty line leaves it unknown.';
COMMENT ON COLUMN register.fingerprint.input_digest IS
  'sha256 of the canonical JSON of the raw inputs (src/engine/digest.ts): the document figures read and the API subtotals.';
COMMENT ON COLUMN register.fingerprint.dataset IS 'The dataset of the document column it was derived from; provenance only (AD-9).';

GRANT SELECT ON register.document, register.document_column, register.key_figures TO derive;
GRANT SELECT, INSERT, TRUNCATE ON register.fingerprint TO derive;
GRANT SELECT, INSERT, TRUNCATE ON register.fingerprint TO loader;
