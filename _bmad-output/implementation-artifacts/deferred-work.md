# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-roles-grants.md`
  summary: Stage 2: hosted Supabase does not run `supabase/roles.sql` automatically, so the four roles must exist before migration `20261010120000_register_and_app_schemas.sql` runs there, or its `GRANT … TO reader` statements fail.
  evidence: The local CLI applies `roles.sql` on `db start` and `db reset` ("Seeding globals from roles.sql"). `supabase db push` does so only with `--include-roles` ("Include custom roles from supabase/roles.sql", verified in CLI 2.120.0 `db push --help`); otherwise the roles must be created another way before the push.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3a-step1-register-ingest.md`
  summary: A company that the register later reclassifies out of a covered primary code keeps its old `register.company` row (old `naeringskode1`, old `read_at`), because a step-1 run only upserts the units in today's bulk selection.
  evidence: Story 1.3a review. Only 410 deletion is planned (Story 2.4); reclassification is not. Readers that select on `naeringskode1` would still see the stale row as covered until a run records which companies it last saw, or a later story decides how a refresh retires rows.

- source_spec: `_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md`
  summary: Step 1 refuses a corrected filing that keeps the register's id. `UPSERT_FILING` resolves conflicts on `FILING_KEY` (orgnr, regnskapstype, periode_fra, periode_til), but `brreg_id` is also UNIQUE, so a reissued filing whose period changed under the same id raises UniqueViolation and the stale row stays.
  evidence: Epic 1 retro, finding R5 (`ingest/src/peerless_ingest/write.py`, `UPSERT_FILING`; migration `20261011120000_register_step1_tables.sql`, `brreg_id … UNIQUE`). Deferred by Meinich, 2026-10-16; decide with the reclassification entry above how a refresh retires or replaces rows.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3b-seed-export-load.md`
  summary: Story 2.3 must make `seed:export` keep the curated entries in `seed/allow-list.json` instead of overwriting it with `[]`, and refuse an export whose document-figure orgnrs are not on the list.
  evidence: Story 1.3b review. `scripts/seed-export.ts` writes the literal `'[]\n'`. That is harmless while no filing has a document figure, but it erases entries as soon as Story 2.3 adds OCR reference filings with their reasons.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3b-seed-export-load.md`
  summary: Add a test in which the export's `checkPrimaryKey` refuses a `SEED_TABLES` declaration that disagrees with the catalog, when a migration first changes a seed table's key.
  evidence: Story 1.3b verification-gap review. Deleting the `checkPrimaryKey` call keeps every test green; the guard only matters once a key changes.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-engine-format.md`
  summary: Decide whether a filing whose stated balance does not balance (`sumEiendeler` ≠ `sumEgenkapitalGjeld` beyond a few kroner) is flagged or excluded from the API figures, the way document figures are reconciled.
  evidence: Story 1.4 review. 1 903 of 22 354 seed filings have `sumEiendeler ≠ sumEgenkapitalGjeld`, most by 1 kr (rounding); some by far more, e.g. 931165992 SIGMA DATA SOLUTIONS AS 2023 (−17 767 against +14 019 kr). The engine computes on stated values as filed and does not reconcile.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-engine-format.md`
  summary: The provenance drill-down (FR-64, Epic 3) needs to know which inputs were derived; `FigureResult` records only `denominatorDerived`, not a derived numerator (`driftsresultat`, `sumEgenkapital`).
  evidence: Story 1.4 review. JOAKIM BORDING AS 2025's equity ratio uses a derived `sumEgenkapital` and cannot be told apart from a stated one.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6a-url-module.md`
  summary: `medianStepExists` has no real implementation until Story 3.5 computes s_med; until then every caller must pass a predicate returning false, so `andel=median` falls back to 50 % with the notice.
  evidence: Story 1.6a AC (the predicate is an input because no engine computes s_med until 3.5); review finding 5.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6b-analysis-route-states.md`
  summary: Story 2.1b must extend the first paragraph of "Kilder og lisens" on `/slik-fungerer-peerless` ("Tallene i Peerless kommer fra Brønnøysundregistrene: Enhetsregisteret og nøkkeltallene i Regnskapsregisteret.") to name the filed annual accounts once figures read by OCR are shown.
  evidence: Human decision 2026-10-16 when accepting the 1.6b copy. In Epic 1 only API figures are shown, so the paragraph names only the API sources; the separate document-figure licence paragraph stays with Story 5.4.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6b-analysis-route-states.md`
  summary: The analysis 404 states (invalid orgnr, valid orgnr not in the database) answer HTTP 404, but Next.js 16.4 serves them as its error shell and renders the content on the client after load, so they show nothing without JavaScript. Revisit when a Next.js release renders a nested `not-found.tsx` on the server for a `notFound()` thrown before streaming, or decide that a server-rendered 404 is worth a 200 status.
  evidence: Story 1.6b implementation, probing the production build: `curl /analyse/12345678` returns 404 with `<html id="__next_error__">` and an empty body; Playwright sees the front page with the message after load. A nested `src/app/analyse/not-found.tsx` was never used for these requests; the root `src/app/not-found.tsx` is.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-funnel-stages-1-3.md`
  summary: `CANDIDATES_SQL` filters `register.company` on `naeringskode1`, which has no index; add one (migration plus seed re-export) when a second industry is covered or the candidate read nears the 1 s budget.
  evidence: Story 1.7 review (blind hunter). A sequential scan of 17 558 rows is well under 1 s on the demo seed (`test/db/peers.test.ts`); the read runs on every covered-AS analysis request.

- source_spec: `_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md`
  summary: The rate limit does not bound what one client can read. A client that sends a new `X-Forwarded-For` value with each request gets a fresh budget each time, and every covered-AS analysis reads its industry's whole candidate pool (`lookupCandidates` in `src/server/analysis.ts`) with no limit and no cross-request cache, so each request costs a full industry scan. The AD-10 deployment gate must solve both before stage 2.
  evidence: Epic 1 retro, finding S11 (`src/rate-limit/limiter.ts`, `src/server/analysis.ts`). Accepted for local v1 by Meinich, 2026-10-16; stated in the README and AD-10.

- source_spec: `_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md`
  summary: Story 2.9 (missing figures say why) owns two copy gaps from the Epic 1 retro:
    - R2 (retro action 3): a subject whose revenue is not stated but derivable (driftsresultat + sumDriftskostnad) gets "…har ingen positiv omsetning å sammenligne med" beside a hero that shows a margin. Keep the rule "not stated → no band" (`docs/key-figures.md:151`; `funnelSubject` passes only the stated `sum_driftsinntekter_ore`) and change only the copy: a message key for "revenue not stated", plus a test with null stated revenue (`test/analysis/oversikt-hero.test.ts` covers only `0n`).
    - R3: an empty peer group can show no reason. `emptyReason` is set only for no revenue and a non-calendar year, so a subject with `valuta` ≠ NOK, or a null `regnskapsregler`/`smaaForetak`/`avviklingsregnskap`, empties stage 2 with no explanation ("0 av 10").
  evidence: Epic 1 retro, findings R2 and R3 (`src/analysis/view.ts:139`, `src/engine/peers.ts:219-221`). Human decision (Meinich, 2026-10-16): no code change in the Epic 1 follow-ups PR; in the seed, 1 of 4 890 filings has a derived revenue above 5 kr, and that one is negative.

- source_spec: `_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md`
  summary: The benchmark-filing order (benchmark year, the subject's `regnskapstype` first, then latest `periode_til`, `periode_fra` and register id) is written three times: the subject SQL, the engine's `benchmarkFiling`, and the e2e oracle. Choose the subject's filing in the engine too, before Epic 2 adds the document figures as a second figure source.
  evidence: Epic 1 retro, finding D2 (`src/server/analysis.ts`, `SUBJECT_SQL`; `src/engine/peers.ts`, `benchmarkFiling`; `e2e/analysis.spec.ts`, the seed oracle). Deferred by Meinich, 2026-10-16.

- source_spec: `_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md`
  summary: `/analyse/813 235 552/oversikt` renders without a redirect, while the bare spaced path `/analyse/813 235 552` redirects, so every analysis has duplicate URLs. Redirect a non-canonical orgnr segment to its canonical form on every tab.
  evidence: Epic 1 retro, finding R8 (`src/analysis/view.ts`, the covered branch of `analysisView`). Crosses Stories 1.6a and 1.6b. Deferred (small) by Meinich, 2026-10-16.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-1-follow-ups.md`
  summary: Remove `minimumReleaseAgeExclude` (and its comment) from `pnpm-workspace.yaml` once Next.js 16.4.2 (released 2026-10-15) is past pnpm's minimum release age. Trigger: the next dependency update or Story 2.1a, whichever comes first.
  evidence: Commit `6a17ca7` pinned 16.4.2 for GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr; pnpm install refused the too-young versions and wrote the exemption list.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1a-ocr-library.md`
  summary: Årsverk (`aarsverk`, full-time equivalents, one decimal) is not read in Epic 2, so key figures #7 revenue per FTE (`sumDriftsinntekter / aarsverk`) and #8 personnel cost per FTE (`lonnskostnad / aarsverk`) in `docs/key-figures.md` have no input until a later story reads it. Until then Story 2.9 must show both as absent with the right reason, not as undefined or as a failed reconciliation.
  evidence: Story 2.1 planning, 2026-10-19. Årsverk is printed in the company's own notes, which follow the three Brreg-generated pages; the spike's layout rules read only the generated section, and the notes are free-form. Deferred by Meinich, 2026-10-19.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1a-ocr-library.md`
  summary: Story 2.1b stores what Story 2.1a reads: the document tables and migration, fetching every 2021–2025 document of the covered industry in the step-1 run, the contract test against a migrated database, the seed re-export, the "Kilder og lisens" paragraph and the docs.
  evidence: Story 2.1 was about 2 900 tokens, against the 1 600-token spec ceiling; split into 2.1a (library, image, fixtures, no database) and 2.1b on 2026-10-19 by Meinich, following the 1.3a/1.3b pattern. `epics.md` holds both halves.
