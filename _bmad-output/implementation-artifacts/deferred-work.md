# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-roles-grants.md`
  summary: Stage 2: hosted Supabase does not run `supabase/roles.sql` automatically, so the four roles must exist before migration `20261010120000_register_and_app_schemas.sql` runs there, or its `GRANT … TO reader` statements fail.
  evidence: The local CLI applies `roles.sql` on `db start` and `db reset` ("Seeding globals from roles.sql"). `supabase db push` does so only with `--include-roles` ("Include custom roles from supabase/roles.sql", verified in CLI 2.120.0 `db push --help`); otherwise the roles must be created another way before the push.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3a-step1-register-ingest.md`
  summary: A company that the register later reclassifies out of a covered primary code keeps its old `register.company` row (old `naeringskode1`, old `read_at`), because a step-1 run only upserts the units in today's bulk selection.
  evidence: Story 1.3a review. Only 410 deletion is planned (Story 2.4); reclassification is not. Readers that select on `naeringskode1` would still see the stale row as covered until a run records which companies it last saw, or a later story decides how a refresh retires rows.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3b-seed-export-load.md`
  summary: Story 2.3 must make `seed:export` keep the curated entries in `seed/allow-list.json` instead of overwriting it with `[]`, and refuse an export whose document-figure orgnrs are not on the list.
  evidence: Story 1.3b review. `scripts/seed-export.ts` writes the literal `'[]\n'`. That is harmless while no filing has a document figure, but it erases entries as soon as Story 2.3 adds OCR reference filings with their reasons.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3b-seed-export-load.md`
  summary: Add a test in which the export's `checkPrimaryKey` refuses a `SEED_TABLES` declaration that disagrees with the catalog, when a migration first changes a seed table's key.
  evidence: Story 1.3b verification-gap review. Deleting the `checkPrimaryKey` call keeps every test green; the guard only matters once a key changes.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3b-seed-export-load.md`
  summary: AGENTS.md and technical note AD-16 name `seed/**` and `analysis/output/**` as `-text`, but `.gitattributes` also marks `test/fixtures/seed/**`; add the third path to both.
  evidence: Story 1.3b review. Deferred because the fix edits an agent-context file.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-engine-format.md`
  summary: Story 1.5's `src/server/db.ts` must be covered by a read-types test through the app's own client, so a `types`/`transform` option that parses `int8` or `numeric` to a number fails a test.
  evidence: Story 1.4 review. `test/db/read-types.test.ts` builds its own postgres.js client with default options, because the app client does not exist yet.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-engine-format.md`
  summary: Decide whether a filing whose stated balance does not balance (`sumEiendeler` ≠ `sumEgenkapitalGjeld` beyond a few kroner) is flagged or excluded from the API figures, the way document figures are reconciled.
  evidence: Story 1.4 review. 1 903 of 22 354 seed filings have `sumEiendeler ≠ sumEgenkapitalGjeld`, most by 1 kr (rounding); some by far more, e.g. 931165992 SIGMA DATA SOLUTIONS AS 2023 (−17 767 against +14 019 kr). The engine computes on stated values as filed and does not reconcile.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-engine-format.md`
  summary: The provenance drill-down (FR-64, Epic 3) needs to know which inputs were derived; `FigureResult` records only `denominatorDerived`, not a derived numerator (`driftsresultat`, `sumEgenkapital`).
  evidence: Story 1.4 review. JOAKIM BORDING AS 2025's equity ratio uses a derived `sumEgenkapital` and cannot be told apart from a stated one.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5a-company-search-data.md`
  summary: Story 1.5b — the search API (`GET /api/sok`), the front page with the hero combobox, `src/server/db.ts` and the route-manifest test — split from Story 1.5 to follow 1.5a.
  evidence: Story 1.5 planning 2026-10-14. The spec ran to about 2 700 tokens across the database, step 1, the API, the UI and tests, so the human split it 1.3a/1.3b-style. The data change comes first. Its draft spec is `spec-1-5b-company-search.md`.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5a-company-search-data.md`
  summary: Story 1.5b must settle three things about the data 1.5a stored:
    - whether search returns a sole proprietor's (`ENK`) business municipality, which is often the owner's home;
    - to handle `naeringskode1_beskrivelse` being NULL where the register's primary code has changed since the company was stored. Companies-only mode stores it only when the codes match: 920768695 is stored under 62.100, and its description is NULL;
    - to add a test with `EXPLAIN` that shows its name query uses `company_navn_trgm`, by calling the same `register.immutable_unaccent(lower(navn))` expression.
  evidence: Story 1.5a review. 6 258 of the 17 557 stored companies are `ENK`, as recorded in `docs/data-sources-brreg.md` and the ai-log entry for 1.5a. Companies-only mode now reports code mismatches in its summary. Index use was shown by a manual `EXPLAIN` only. `reader`'s `search_path` lacks `extensions`, so the query must qualify `extensions.%`/`extensions.word_similarity`.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6a-url-module.md`
  summary: Story 1.6b passes `parse` a documented accept-all `isCandidate`; Story 1.7 must replace it with the real candidate pool (funnel stages 1–3 at the parsed band), so an `ekskl` orgnr outside the pool is dropped with the notice (AD-5).
  evidence: Human decision 2026-10-15 in the 1.6a spec; until 1.7, any valid orgnr other than the subject is kept in `ekskl` (review finding 5).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6a-url-module.md`
  summary: `medianStepExists` has no real implementation until Story 3.5 computes s_med; until then every caller must pass a predicate returning false, so `andel=median` falls back to 50 % with the notice.
  evidence: Story 1.6a AC (the predicate is an input because no engine computes s_med until 3.5); review finding 5.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6b-analysis-route-states.md`
  summary: Story 2.1 must extend the first paragraph of "Kilder og lisens" on `/slik-fungerer-peerless` ("Tallene i Peerless kommer fra Brønnøysundregistrene: Enhetsregisteret og nøkkeltallene i Regnskapsregisteret.") to name the filed annual accounts once figures read by OCR are shown.
  evidence: Human decision 2026-10-16 when accepting the 1.6b copy. In Epic 1 only API figures are shown, so the paragraph names only the API sources; the separate document-figure licence paragraph stays with Story 5.4.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6b-analysis-route-states.md`
  summary: The analysis 404 states (invalid orgnr, valid orgnr not in the database) answer HTTP 404, but Next.js 16.4 serves them as its error shell and renders the content on the client after load, so they show nothing without JavaScript. Revisit when a Next.js release renders a nested `not-found.tsx` on the server for a `notFound()` thrown before streaming, or decide that a server-rendered 404 is worth a 200 status.
  evidence: Story 1.6b implementation, probing the production build: `curl /analyse/12345678` returns 404 with `<html id="__next_error__">` and an empty body; Playwright sees the front page with the message after load. A nested `src/app/analyse/not-found.tsx` was never used for these requests; the root `src/app/not-found.tsx` is.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-funnel-stages-1-3.md`
  summary: `CANDIDATES_SQL` filters `register.company` on `naeringskode1`, which has no index; add one (migration plus seed re-export) when a second industry is covered or the candidate read nears the 1 s budget.
  evidence: Story 1.7 review (blind hunter). A sequential scan of 17 558 rows is well under 1 s on the demo seed (`test/db/peers.test.ts`); the read runs on every covered-AS analysis request.

- source_spec: `_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md`
  summary: Story 2.9 (missing figures say why) owns two copy gaps from the Epic 1 retro:
    - R2 (retro action 3): a subject whose revenue is not stated but derivable (driftsresultat + sumDriftskostnad) gets "…har ingen positiv omsetning å sammenligne med" beside a hero that shows a margin. Keep the rule "not stated → no band" (`docs/key-figures.md:151`; `funnelSubject` passes only the stated `sum_driftsinntekter_ore`) and change only the copy: a message key for "revenue not stated", plus a test with null stated revenue (`test/analysis/oversikt-hero.test.ts` covers only `0n`).
    - R3: an empty peer group can show no reason. `emptyReason` is set only for no revenue and a non-calendar year, so a subject with `valuta` ≠ NOK, or a null `regnskapsregler`/`smaaForetak`/`avviklingsregnskap`, empties stage 2 with no explanation ("0 av 10").
  evidence: Epic 1 retro, findings R2 and R3 (`src/analysis/view.ts:139`, `src/engine/peers.ts:219-221`). Human decision (Meinich, 2026-10-16): no code change in the Epic 1 follow-ups PR; in the seed, 1 of 4 890 filings has a derived revenue above 5 kr, and that one is negative.
