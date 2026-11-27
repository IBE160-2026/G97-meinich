-- Story 4.1: stored explanations of each covered AS's default analysis
-- (FR-52; technical note AD-7, AD-9, AD-13), and `explain` as a mode of
-- step 2's run record.
--
-- 1. register.explanation holds at most one row per company: the text the
--    model wrote for its default peer group, written by `pnpm explain` as
--    `derive`. The request path only reads it (Story 4.4, which reads only
--    rows with `not sample`).
--
--    A row is `explained` with its template and the slot ids it uses;
--    `failed` when the response was unusable (the reason is in run.step2);
--    `pending` while its batch runs. The template holds `{{id}}` slot
--    references and no digit outside them; the slots are filled from the
--    request path's own output, and only while `analysis_digest` equals the
--    current engine's digest of the company's default analysis (AD-13).
--
--    `dataset` is provenance only (AD-9): the loaded dataset the analysis
--    was computed against. `sample` marks a row from a sample run: never
--    exported to the seed, and explained again by a full run.
--
-- 2. run.step2's mode gains `explain`.

CREATE TABLE register.explanation (
  orgnr           text        PRIMARY KEY
                              REFERENCES register.company (orgnr) ON DELETE CASCADE ON UPDATE CASCADE,
  status          text        NOT NULL CHECK (status IN ('explained', 'failed', 'pending')),
  template        text,
  slot_ids        text[],
  filing_year     smallint    NOT NULL,
  analysis_digest text        NOT NULL CHECK (analysis_digest ~ '^[0-9a-f]{64}$'),
  prompt_hash     text        NOT NULL CHECK (prompt_hash ~ '^[0-9a-f]{64}$'),
  model_id        text        NOT NULL,
  dataset         text        NOT NULL CHECK (dataset IN ('demo', 'full')),
  sample          boolean     NOT NULL DEFAULT false,
  batch_id        text,
  generated_at    timestamptz NOT NULL,
  -- Only an explained row holds a text, and every explained row holds one.
  CHECK ((status = 'explained') = (template IS NOT NULL)),
  CHECK ((template IS NULL) = (slot_ids IS NULL)),
  CHECK ((status = 'pending') = (batch_id IS NOT NULL))
);

COMMENT ON TABLE register.explanation IS
  'The model''s explanation of a covered AS''s default analysis (Story 4.1, FR-52). Written by batch step 2 (pnpm explain, as derive); read by the request path only where the digest matches (AD-13).';
COMMENT ON COLUMN register.explanation.template IS
  'Text with {{slot id}} references and no digit outside them (parseTemplate in scripts/explain/request.ts).';
COMMENT ON COLUMN register.explanation.slot_ids IS
  'The distinct slot ids the template uses, in the order they first appear.';
COMMENT ON COLUMN register.explanation.analysis_digest IS
  'digest() of the wire-encoded default analysis (src/analysis/explanation-payload.ts): subject, year, band, peers and every slot.';
COMMENT ON COLUMN register.explanation.prompt_hash IS
  'Digest of the system prompt and the request settings (scripts/explain/request.ts).';
COMMENT ON COLUMN register.explanation.dataset IS
  'The loaded dataset the analysis was computed against; provenance only (AD-9).';
COMMENT ON COLUMN register.explanation.sample IS
  'From a sample run: never exported to the seed, never shown, and explained again by a full run.';

REVOKE ALL ON register.explanation FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON register.explanation TO reader;
GRANT SELECT, INSERT, UPDATE ON register.explanation TO derive;
GRANT SELECT, INSERT, TRUNCATE ON register.explanation TO loader;

ALTER TABLE run.step2 DROP CONSTRAINT step2_mode_check;
-- fingerprints: pnpm derive; classify: pnpm classify; explain: pnpm explain.
ALTER TABLE run.step2 ADD CONSTRAINT step2_mode_check CHECK (mode IN ('fingerprints', 'classify', 'explain'));
