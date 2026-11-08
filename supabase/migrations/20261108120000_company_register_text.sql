-- Story 2.6a: the register text Story 2.6 classifies on (FR-11).
--
-- Two columns of register.company that step 1 reads from Enhetsregisteret
-- with the search fields, for an AS only (Meinich, 2026-11-08: classification
-- reads nothing else, and a sole proprietor's text is public in the register
-- but not something Peerless collects unused), so search_fields_read_at and
-- one write path cover them. The register delivers each as an array of lines; step 1 stores them
-- stripped and joined with one space, in array order. Both nullable: NULL
-- means the company is not an AS, the register gave no text (absent, null, an
-- empty array or only blank lines), or the fields have not been read since
-- this migration. Never an
-- empty string.
--
-- No grant changes: ingest already holds UPDATE on register.company, and
-- reader and loader hold their table-level grants, which cover new columns.

ALTER TABLE register.company
  ADD COLUMN aktivitet              text,
  ADD COLUMN vedtektsfestet_formaal text;

COMMENT ON COLUMN register.company.aktivitet IS
  'Enhetsregisteret aktivitet, for an AS only: its lines joined with one space, in array order, whitespace normalised. NULL when the company is not an AS or the register gave no text.';
COMMENT ON COLUMN register.company.vedtektsfestet_formaal IS
  'Enhetsregisteret vedtektsfestetFormaal, for an AS only: its lines joined with one space, in array order, whitespace normalised. NULL when the company is not an AS or the register gave no text.';
COMMENT ON COLUMN register.company.search_fields_read_at IS
  'When step 1 read forretningsadresse_kommunenummer, forretningsadresse_kommune, naeringskode1_beskrivelse, aktivitet and vedtektsfestet_formaal from the register (AD-18). Equal to read_at after a normal run; the bulk read time after a companies-only run; NULL when never read.';
