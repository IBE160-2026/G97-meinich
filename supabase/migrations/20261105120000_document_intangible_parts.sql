-- Story 2.5b: the four printed parts of intangible assets (Meinich,
-- 2026-11-01, Q1; F2 at the probe checkpoint, 2026-11-05).
--
-- Step 1 reads them from the balance sheet of a filed document as fields of
-- their own, beside sum_immaterielle_eiendeler, which includes them all:
-- forskning og utvikling, konsesjoner og patenter, goodwill and utsatt
-- skattefordel. Like every figure column, each is the figure as printed, in
-- øre, NULL when absent or unreadable, never 0 for an absence (AD-14,
-- AD-15). A parts-sum gate (the four against sum_immaterielle_eiendeler,
-- 5 kr) may admit one from the digits-only pass, so digits_pass_fields
-- gains the four names; the CHECK of
-- 20261020120000_register_document_tables.sql is dropped and re-added with
-- them, its other names unchanged.
--
-- The columns are nullable and have no default: rows read before this
-- migration hold NULL in them until a re-read (`pnpm ingest --reread`), and
-- a dump taken before it still restores when the copy names its columns
-- from the dump's own header (README, "Seed"; test/db/restore-old-dump.test.ts).
--
-- No grant changes: ingest, loader and derive hold their table grants, and
-- reader reads through the schema's default privileges. The fingerprint
-- (Story 2.5, D1) does not read these columns.

ALTER TABLE register.document_column
  ADD COLUMN forskning_og_utvikling_ore bigint,
  ADD COLUMN konsesjoner_patenter_ore   bigint,
  ADD COLUMN goodwill_ore               bigint,
  ADD COLUMN utsatt_skattefordel_ore    bigint;

ALTER TABLE register.document_column
  DROP CONSTRAINT document_column_digits_pass_fields_check,
  ADD CONSTRAINT document_column_digits_pass_fields_check CHECK (
    digits_pass_fields <@ ARRAY[
      'salgsinntekt', 'sum_driftsinntekter', 'varekostnad', 'lonnskostnad', 'avskrivninger',
      'nedskrivninger', 'annen_driftskostnad', 'sum_driftskostnad', 'driftsresultat', 'netto_finans',
      'ordinaert_resultat_foer_skattekostnad', 'aarsresultat', 'forskning_og_utvikling',
      'konsesjoner_patenter', 'goodwill', 'utsatt_skattefordel', 'sum_immaterielle_eiendeler',
      'sum_varige_driftsmidler', 'varer', 'kundefordringer', 'bankinnskudd', 'sum_eiendeler',
      'sum_egenkapital', 'leverandorgjeld', 'sum_kortsiktig_gjeld', 'sum_gjeld', 'sum_egenkapital_gjeld'
    ]::text[]
  );

COMMENT ON COLUMN register.document_column.forskning_og_utvikling_ore IS
  'øre (hundredths of document.valuta, NOK in every filing seen); Forskning og utvikling (also printed "Utvikling"), a part of sum_immaterielle_eiendeler, as printed (Story 2.5b)';
COMMENT ON COLUMN register.document_column.konsesjoner_patenter_ore IS
  'øre (hundredths of document.valuta, NOK in every filing seen); Konsesjoner, patenter, lisenser, varemerker o.l., a part of sum_immaterielle_eiendeler, as printed (Story 2.5b)';
COMMENT ON COLUMN register.document_column.goodwill_ore IS
  'øre (hundredths of document.valuta, NOK in every filing seen); Goodwill, a part of sum_immaterielle_eiendeler, as printed (Story 2.5b)';
COMMENT ON COLUMN register.document_column.utsatt_skattefordel_ore IS
  'øre (hundredths of document.valuta, NOK in every filing seen); Utsatt skattefordel, a part of sum_immaterielle_eiendeler, as printed (Story 2.5b)';
