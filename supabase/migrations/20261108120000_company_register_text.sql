-- Story 2.6a: the register text Story 2.6 classifies on (FR-11).
--
-- Two columns of register.company that step 1 reads from Enhetsregisteret
-- with the search fields, so search_fields_read_at and one write path cover
-- them. The register delivers each as an array of lines; step 1 stores them
-- stripped and joined with one space, in array order. Both nullable: NULL
-- means the register gave no text (absent, null, an empty array or only blank
-- lines), or the fields have not been read since this migration. Never an
-- empty string.
--
-- No grant changes: ingest already holds UPDATE on register.company, and
-- reader and loader hold their table-level grants, which cover new columns.

ALTER TABLE register.company
  ADD COLUMN aktivitet              text,
  ADD COLUMN vedtektsfestet_formaal text;

COMMENT ON COLUMN register.company.aktivitet IS
  'Enhetsregisteret aktivitet: its lines stripped and joined with one space, in array order. NULL when the register gave no text.';
COMMENT ON COLUMN register.company.vedtektsfestet_formaal IS
  'Enhetsregisteret vedtektsfestetFormaal: its lines stripped and joined with one space, in array order. NULL when the register gave no text.';
COMMENT ON COLUMN register.company.search_fields_read_at IS
  'When step 1 read forretningsadresse_kommunenummer, forretningsadresse_kommune, naeringskode1_beskrivelse, aktivitet and vedtektsfestet_formaal from the register (AD-18). Equal to read_at after a normal run; the bulk read time after a companies-only run; NULL when never read.';
