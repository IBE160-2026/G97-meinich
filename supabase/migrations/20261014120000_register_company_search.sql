-- Story 1.5a: what company search shows, and the name-search index
-- (FR-1; technical note AD-2, AD-3).
--
-- Three columns of register.company that step 1 reads from Enhetsregisteret
-- and stores exactly as the register delivers them, and the time it read
-- them. All nullable: NULL means the register gave no value, or the fields
-- have never been read (search_fields_read_at NULL). An absent
-- forretningsadresse is NULL, never an empty string and never postadresse.
--
-- The name index sits on register.immutable_unaccent(lower(navn)).
-- unaccent(text) is STABLE (it depends on search_path and the dictionary),
-- and Postgres refuses a STABLE function in an index expression. The wrapper
-- names both the function and the dictionary by schema, so its result does
-- not depend on search_path; IMMUTABLE then holds for as long as the
-- `unaccent` dictionary's rules do not change. Story 1.5b's query must call
-- the same wrapper, or the index is not used.

-- Trigram matching and accent folding, from the Postgres contrib modules.
-- Both live in schema `extensions`, like Supabase's other extensions.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

ALTER TABLE register.company
  ADD COLUMN forretningsadresse_kommunenummer text,
  ADD COLUMN forretningsadresse_kommune       text,
  ADD COLUMN naeringskode1_beskrivelse        text,
  ADD COLUMN search_fields_read_at            timestamptz;

COMMENT ON COLUMN register.company.forretningsadresse_kommunenummer IS
  'Enhetsregisteret forretningsadresse.kommunenummer, as delivered. NULL when the unit has no forretningsadresse or no value.';
COMMENT ON COLUMN register.company.forretningsadresse_kommune IS
  'Enhetsregisteret forretningsadresse.kommune, as delivered. NULL when the unit has no forretningsadresse or no value.';
COMMENT ON COLUMN register.company.naeringskode1_beskrivelse IS
  'Enhetsregisteret naeringskode1.beskrivelse, as delivered.';
COMMENT ON COLUMN register.company.search_fields_read_at IS
  'When step 1 read forretningsadresse_kommunenummer, forretningsadresse_kommune and naeringskode1_beskrivelse from the register (AD-18). Equal to read_at after a normal run; the bulk read time after a companies-only run; NULL when never read.';

-- Function and dictionary both schema-qualified: the result does not depend
-- on search_path.
CREATE FUNCTION register.immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

COMMENT ON FUNCTION register.immutable_unaccent(text) IS
  'extensions.unaccent with the extensions.unaccent dictionary, independent of search_path, labelled IMMUTABLE so it can be indexed. Holds only while the unaccent dictionary does not change.';

CREATE INDEX company_navn_trgm ON register.company
  USING gin (register.immutable_unaccent(lower(navn)) extensions.gin_trgm_ops);

COMMENT ON INDEX register.company_navn_trgm IS
  'Trigram index for name search (FR-1) over register.immutable_unaccent(lower(navn)).';

-- PUBLIC has no EXECUTE on functions postgres creates (20261010120000), so
-- each caller is named. reader calls the wrapper in search. ingest and
-- loader do not call it, but Postgres evaluates an index expression as the
-- role that writes the row: without EXECUTE, every step-1 upsert and every
-- seed load into register.company is refused. derive writes no company and
-- gets nothing.
--
-- The wrapper's body is inlined or run as the caller, so the same three roles
-- need USAGE on schema extensions to reach extensions.unaccent and its
-- dictionary. USAGE creates nothing; it lets them call what is already
-- executable there.
GRANT EXECUTE ON FUNCTION register.immutable_unaccent(text) TO reader, ingest, loader;
GRANT USAGE ON SCHEMA extensions TO reader, ingest, loader;
