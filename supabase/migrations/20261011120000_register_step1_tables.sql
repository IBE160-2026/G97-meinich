-- Story 1.3a: the three tables batch step 1 writes (technical note AD-2,
-- AD-14, AD-15, AD-18). Step 1 runs as `ingest` and runs no DDL; these
-- tables exist only through this migration.
--
-- Stored as filed: an empty element in the register is NULL, never 0, and
-- stated totals are kept as the register states them. No ratio,
-- distribution or derived amount is stored here (AD-1); derivation of a
-- missing component lives only in src/engine.
--
-- reader gets SELECT on all three through the default privileges from
-- 20261010120000_register_and_app_schemas.sql. derive and loader get
-- nothing in this story.

-- One row per organisation number. Companies are keyed on orgnr only: a
-- company that changes its name stays one row.
CREATE TABLE register.company (
  orgnr                 char(9)     PRIMARY KEY CHECK (orgnr ~ '^[0-9]{9}$'),
  navn                  text,
  organisasjonsform     text,
  -- SN2025 industry codes. The primary one, naeringskode1, is the one
  -- Peerless selects on.
  naeringskode1         text,
  naeringskode2         text,
  naeringskode3         text,
  konkurs               boolean,
  under_avvikling       boolean,
  -- underTvangsavviklingEllerTvangsopplosning in the register.
  under_tvangsavvikling boolean,
  read_at               timestamptz NOT NULL
);

COMMENT ON TABLE register.company IS
  'Enhetsregisteret data for covered companies and demo company C, as returned. Written by batch step 1 (ingest).';
COMMENT ON COLUMN register.company.read_at IS 'When step 1 read this record from the register (AD-18).';

-- One row per filing in the key-figures API. Company and group accounts for
-- the same period are two filings, so the key includes regnskapstype. The
-- register's own id is kept; a filing the register reissues under a new id
-- for the same period updates the existing row.
CREATE TABLE register.filing (
  orgnr              char(9)     NOT NULL REFERENCES register.company (orgnr),
  regnskapstype      text        NOT NULL,
  periode_fra        date        NOT NULL,
  periode_til        date        NOT NULL,
  brreg_id           bigint      NOT NULL UNIQUE,
  journalnr          text,
  -- From the returned regnskapsperiode.tilDato, never from a requested
  -- year: the register ignores the year parameter.
  filing_year        smallint    NOT NULL,
  valuta             text,
  -- From regnkapsprinsipper (the register's spelling).
  regnskapsregler    text,
  smaa_foretak       boolean,
  avviklingsregnskap boolean,
  oppstillingsplan   text,
  -- The key-figures API returns whole currency units and says nothing of
  -- the unit the company reported in; step 1 never guesses one (AD-14).
  reporting_unit     text        NOT NULL CHECK (reporting_unit = 'api_whole_units'),
  status             text        NOT NULL
                     CHECK (status IN ('reconciled', 'failed_reconciliation', 'not_extracted', 'paper')),
  read_at            timestamptz NOT NULL,
  PRIMARY KEY (orgnr, regnskapstype, periode_fra, periode_til),
  CHECK (periode_fra <= periode_til),
  CHECK (filing_year = extract(year FROM periode_til))
);

COMMENT ON TABLE register.filing IS
  'One filing per company, accounts type and period, with its comparability fields, read date and status (AD-15). Written by batch step 1 (ingest).';
COMMENT ON COLUMN register.filing.brreg_id IS 'The register''s own filing id.';
COMMENT ON COLUMN register.filing.filing_year IS 'Year of regnskapsperiode.tilDato as returned by the register (AD-18).';
COMMENT ON COLUMN register.filing.read_at IS 'When step 1 read this filing from the register (AD-18).';

-- The key-figures API amounts of one filing, as filed, in øre: the whole
-- currency unit times 100, in the filing's own valuta. Columns are named
-- after the register field in snake_case with the suffix _ore, keeping the
-- register's misspelling sumInnskuttEgenkaptial (AD-14). NULL is an empty
-- element, not zero.
CREATE TABLE register.key_figures (
  brreg_id                                  bigint PRIMARY KEY
                                            REFERENCES register.filing (brreg_id) ON UPDATE CASCADE,
  driftsresultat_ore                        bigint,
  sum_driftsinntekter_ore                   bigint,
  sum_driftskostnad_ore                     bigint,
  netto_finans_ore                          bigint,
  sum_finansinntekter_ore                   bigint,
  sum_finanskostnad_ore                     bigint,
  ordinaert_resultat_foer_skattekostnad_ore bigint,
  aarsresultat_ore                          bigint,
  totalresultat_ore                         bigint,
  sum_eiendeler_ore                         bigint,
  sum_omloepsmidler_ore                     bigint,
  sum_anleggsmidler_ore                     bigint,
  sum_egenkapital_gjeld_ore                 bigint,
  sum_egenkapital_ore                       bigint,
  sum_opptjent_egenkapital_ore              bigint,
  sum_innskutt_egenkaptial_ore              bigint,
  sum_gjeld_ore                             bigint,
  sum_kortsiktig_gjeld_ore                  bigint,
  sum_langsiktig_gjeld_ore                  bigint
);

COMMENT ON TABLE register.key_figures IS
  'Key-figures API amounts per filing, as filed, in øre (AD-14). Written by batch step 1 (ingest).';
COMMENT ON COLUMN register.key_figures.driftsresultat_ore IS 'øre; resultatregnskapResultat.driftsresultat.driftsresultat';
COMMENT ON COLUMN register.key_figures.sum_driftsinntekter_ore IS 'øre; resultatregnskapResultat.driftsresultat.driftsinntekter.sumDriftsinntekter';
COMMENT ON COLUMN register.key_figures.sum_driftskostnad_ore IS 'øre; resultatregnskapResultat.driftsresultat.driftskostnad.sumDriftskostnad';
COMMENT ON COLUMN register.key_figures.netto_finans_ore IS 'øre; resultatregnskapResultat.finansresultat.nettoFinans';
COMMENT ON COLUMN register.key_figures.sum_finansinntekter_ore IS 'øre; resultatregnskapResultat.finansresultat.finansinntekt.sumFinansinntekter';
COMMENT ON COLUMN register.key_figures.sum_finanskostnad_ore IS 'øre; resultatregnskapResultat.finansresultat.finanskostnad.sumFinanskostnad';
COMMENT ON COLUMN register.key_figures.ordinaert_resultat_foer_skattekostnad_ore IS 'øre; resultatregnskapResultat.ordinaertResultatFoerSkattekostnad';
COMMENT ON COLUMN register.key_figures.aarsresultat_ore IS 'øre; resultatregnskapResultat.aarsresultat';
COMMENT ON COLUMN register.key_figures.totalresultat_ore IS 'øre; resultatregnskapResultat.totalresultat';
COMMENT ON COLUMN register.key_figures.sum_eiendeler_ore IS 'øre; eiendeler.sumEiendeler';
COMMENT ON COLUMN register.key_figures.sum_omloepsmidler_ore IS 'øre; eiendeler.omloepsmidler.sumOmloepsmidler';
COMMENT ON COLUMN register.key_figures.sum_anleggsmidler_ore IS 'øre; eiendeler.anleggsmidler.sumAnleggsmidler';
COMMENT ON COLUMN register.key_figures.sum_egenkapital_gjeld_ore IS 'øre; egenkapitalGjeld.sumEgenkapitalGjeld';
COMMENT ON COLUMN register.key_figures.sum_egenkapital_ore IS 'øre; egenkapitalGjeld.egenkapital.sumEgenkapital';
COMMENT ON COLUMN register.key_figures.sum_opptjent_egenkapital_ore IS 'øre; egenkapitalGjeld.egenkapital.opptjentEgenkapital.sumOpptjentEgenkapital';
COMMENT ON COLUMN register.key_figures.sum_innskutt_egenkaptial_ore IS 'øre; egenkapitalGjeld.egenkapital.innskuttEgenkapital.sumInnskuttEgenkaptial (register spelling)';
COMMENT ON COLUMN register.key_figures.sum_gjeld_ore IS 'øre; egenkapitalGjeld.gjeldOversikt.sumGjeld';
COMMENT ON COLUMN register.key_figures.sum_kortsiktig_gjeld_ore IS 'øre; egenkapitalGjeld.gjeldOversikt.kortsiktigGjeld.sumKortsiktigGjeld';
COMMENT ON COLUMN register.key_figures.sum_langsiktig_gjeld_ore IS 'øre; egenkapitalGjeld.gjeldOversikt.langsiktigGjeld.sumLangsiktigGjeld';

-- Step 1 is the one writer of these tables (AD-2). Upserts need SELECT,
-- INSERT and UPDATE; no DELETE or TRUNCATE (withdrawn companies are
-- Story 2.4's).
GRANT SELECT, INSERT, UPDATE ON register.company, register.filing, register.key_figures TO ingest;
