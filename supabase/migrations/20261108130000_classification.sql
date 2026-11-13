-- Story 2.6: stored classifications (funnel stage 5; FR-11, FR-12; technical
-- note AD-2, AD-7, AD-13) and step 2's run record.
--
-- 1. register.classification holds one row per AS in a covered industry,
--    written by `pnpm classify` as `derive`. Any other form never has a row
--    (Meinich, 2026-11-08). The request path only reads it.
--
--    A row is `classified` with a type, or `classified` with no type when the
--    model answered `uklart` (no fifth type: a missing signal, like the
--    fingerprint's null); `no_text` when there is nothing to classify on;
--    `failed` when the answer was unusable; `pending` while its batch runs.
--
--    `sample` marks a row from a sample run. Sample rows never reach the seed
--    and a full run classifies them again.
--
-- 2. run.step2 has one row per step-2 run, written only by `derive` (AD-2):
--    fingerprints from `pnpm derive`, classifications from `pnpm classify`.

CREATE TABLE register.classification (
  orgnr         text        PRIMARY KEY
                            REFERENCES register.company (orgnr) ON DELETE CASCADE ON UPDATE CASCADE,
  status        text        NOT NULL CHECK (status IN ('classified', 'no_text', 'failed', 'pending')),
  business_type text        CHECK (business_type IN ('produkt', 'konsulent', 'forhandler', 'annet')),
  text_digest   text        NOT NULL CHECK (text_digest ~ '^[0-9a-f]{64}$'),
  model_id      text,
  prompt_hash   text        CHECK (prompt_hash ~ '^[0-9a-f]{64}$'),
  sample        boolean     NOT NULL DEFAULT false,
  batch_id      text,
  classified_at timestamptz NOT NULL,
  -- Only a classified row can carry a type.
  CHECK (business_type IS NULL OR status = 'classified'),
  -- A row the model answered, or is about to answer, names model and prompt.
  CHECK (status = 'no_text' OR (model_id IS NOT NULL AND prompt_hash IS NOT NULL)),
  CHECK ((status = 'pending') = (batch_id IS NOT NULL))
);

COMMENT ON TABLE register.classification IS
  'What kind of business an AS in a covered industry is, judged by the model from its register text (Story 2.6). Written by batch step 2 (pnpm classify, as derive); read in the request path by funnel stage 5.';
COMMENT ON COLUMN register.classification.business_type IS
  'One of BUSINESS_TYPES (src/engine/fingerprint.ts). NULL on a classified row means the model answered uklart: a missing signal, counted apart in run.step2.';
COMMENT ON COLUMN register.classification.text_digest IS
  'Digest of the request''s fields as sent (src/engine/digest.ts). Unchanged text makes no model call.';
COMMENT ON COLUMN register.classification.prompt_hash IS
  'Digest of the prompt, schema and request settings. A row with another hash is stale and is reclassified only with --reclassify-stale.';
COMMENT ON COLUMN register.classification.sample IS
  'From a sample run: never exported to the seed, and classified again by a full run.';

REVOKE ALL ON register.classification FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON register.classification TO reader;
GRANT SELECT, INSERT, UPDATE ON register.classification TO derive;
GRANT SELECT, INSERT, TRUNCATE ON register.classification TO loader;
-- What pnpm classify reads to build a request.
GRANT SELECT ON register.company TO derive;

GRANT USAGE ON SCHEMA run TO derive;

CREATE TABLE run.step2 (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- fingerprints: pnpm derive; classify: pnpm classify.
  mode        text        NOT NULL CHECK (mode IN ('fingerprints', 'classify')),
  started_at  timestamptz NOT NULL,
  -- NULL only while the run is going, or if the process was killed.
  ended_at    timestamptz CHECK (ended_at IS NULL OR ended_at >= started_at),
  -- NULL for a run that calls no model.
  model_id    text,
  prompt_hash text,
  counts      jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(counts) = 'object'),
  -- Every failure: [{"orgnr": …, "reason": …}, …].
  failures    jsonb       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(failures) = 'array'),
  -- The exception that ended the run, as "Class: message"; NULL otherwise.
  error       text
);

COMMENT ON TABLE run.step2 IS
  'One record per step-2 run in any mode, written only by derive (Story 2.6; AD-2).';

REVOKE ALL ON run.step2 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON run.step2 TO derive;
REVOKE ALL ON SEQUENCE run.step2_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SEQUENCE run.step2_id_seq TO derive;
