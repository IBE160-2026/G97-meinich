-- Database roles for Peerless (technical note, AD-3). Applied by the Supabase
-- CLI on `supabase start`, `supabase db start` and `supabase db reset`, before
-- the migrations run.
--
-- This file holds CREATE ROLE only: every other statement belongs in
-- supabase/migrations (test/no-ddl-outside-migrations.test.ts). It holds no
-- password. Local passwords are generated into the gitignored .env and applied
-- by `pnpm db:roles` (scripts/set-role-passwords.ts).
--
--   reader  the Next.js request path; SELECT only on schema register
--   ingest  batch step 1 (Python): register data, OCR, reconciled raw figures
--   derive  batch step 2 (Node): fingerprints, classifications, explanations
--   loader  the seed loader (`pnpm seed`)
--
-- Write grants for ingest, derive and loader arrive with each table (AD-2).

CREATE ROLE reader LOGIN;
CREATE ROLE ingest LOGIN;
CREATE ROLE derive LOGIN;
CREATE ROLE loader LOGIN;
