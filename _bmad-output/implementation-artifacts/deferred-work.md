# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-roles-grants.md`
  summary: Stage 2: hosted Supabase does not run `supabase/roles.sql` automatically, so the four roles must exist before migration `20261010120000_register_and_app_schemas.sql` runs there, or its `GRANT … TO reader` statements fail.
  evidence: The local CLI applies `roles.sql` on `db start` and `db reset` ("Seeding globals from roles.sql"). `supabase db push` does so only with `--include-roles` ("Include custom roles from supabase/roles.sql", verified in CLI 2.120.0 `db push --help`); otherwise the roles must be created another way before the push.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3a-step1-register-ingest.md`
  summary: A company that the register later reclassifies out of a covered primary code keeps its old `register.company` row (old `naeringskode1`, old `read_at`), because a step-1 run only upserts the units in today's bulk selection.
  evidence: Story 1.3a review. Only 410 deletion is planned (Story 2.4); reclassification is not. Readers that select on `naeringskode1` would still see the stale row as covered until a run records which companies it last saw, or a later story decides how a refresh retires rows.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3a-step1-register-ingest.md`
  summary: Negative `sumEiendeler` and unknown `valuta` are left to Stories 1.7 and 1.8. 105 stored filings have a negative `sumEiendeler` (in 86 `sumEgenkapitalGjeld` is equally negative). Story 1.4's engine already makes every ratio over a negative (or zero) `sumEiendeler` undefined (`denominator_not_positive`), never a sign-flipped value. Story 1.7 must decide how such a filing enters an asset-intensity band or peer selection (flag or exclude it, never compute on it silently), and in stage 2 refuse a `valuta` that is not a known currency code — for subject and peers alike, never mapped to NOK (`EDT` on 920835252 for 2023 and 2024). The engine's ratios are currency-neutral and it does not read `valuta`, but `formatKroner`, `formatSignedKroner` and `formatMillions` write "kr" and assume NOK: Story 1.8 shows a kroner amount only when the subject's `valuta` is `NOK`.
  evidence: Step-1 acceptance run 2026-10-11, checked against the live API (example 930115746: −6 186 121 for 2025 in both fields). Details under "Pitfalls" in `docs/data-sources-brreg.md`. Story 1.4 human decision 2026-10-12 ("Currency is not the engine's"); reference case 931165992 SIGMA DATA SOLUTIONS AS 2023 in `test/engine/reference-cases.test.ts`.

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
  summary: Story 1.7 must keep dormant companies — zero or near-zero `sumDriftsinntekter` — out of the peer group. They are a selection question, not an engine one: the engine makes their margin undefined (`denominator_not_positive`, or within ±5 kr of zero when revenue is derived), but as peers they would still count towards the 10-peer floor of the other figures and pull their distributions.
  evidence: Story 1.4 human decision 2026-10-12. 4 268 filings in the demo seed have zero or near-zero revenue; examples 924971487 PAF SOFTWARE AS 2021 (stated 0) and 919728574 JOAKIM BORDING AS 2025 (derived 1 kr).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-engine-format.md`
  summary: Story 1.8, the first story that displays a figure, should extend the ESLint bans to where numbers are displayed — `toFixed`, `toDecimalPlaces`/`toDP`, `toSignificantDigits` and `toLocaleString` in `src/app` and `src/components` — so `src/engine/format.ts` stays the only formatter and the only rounding, and update AGENTS.md's ESLint sentence in the same change.
  evidence: Story 1.4 review (edge-case and blind hunters). Today the rounding ban covers only `src/engine/**` and `*format*` files, and the Intl ban only `Intl.NumberFormat`; `Number#toLocaleString` uses Intl and differs between Node and browsers. Deferred because the fix edits an agent-context file and no component displays a figure yet.

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

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5b-company-search.md`
  summary: Story 1.6b mounts the compact variant of `SearchField` (`<SearchField variant="compact" coverage={…} />`, `src/components/search-field.tsx`) in the header on every page except `/`, and covers it mounted in its e2e test. It must pass the same coverage string the front page builds (`industryInSentence` and `joinList` over `coveredIndustries()`), and decide the compact variant's visible hint: today its label is visually hidden and it has no placeholder.
  evidence: Story 1.5b decision (human, 2026-10-14): the header stays unchanged in 1.5b; the variant is built and tested by server-rendered markup only (`test/search-field.test.ts`), because no extra route may be added to render it in a browser.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5b-company-search.md`
  summary: Story 1.6a's URL module replaces the two hand-built `/analyse/${orgnr}` links — `analysisHref` in `src/components/search-field.tsx` (results, exact submit and the demo links) — so every link goes through `serialize`. The orgnr rules it needs are already in `src/engine/orgnr.ts` (`classifySearchInput`, `isValidOrgnr`).
  evidence: Story 1.5b. The URL module does not exist yet, and EXPERIENCE.md requires every link and navigation to use it.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5b-company-search.md`
  summary: The literal copy "programmeringstjenester (62.100)" still stands in FR-4, UX-DR41, UX-DR42 and UX-DR43 and in Story 1.6b's ACs in `epics.md`, and in EXPERIENCE.md's State Patterns. Story 1.5b's ACs and issue #6 now say the industry name and code come from the register; the others should be brought in line when 1.6b is planned, so 1.6b's uncovered and not-found states do not reintroduce a literal.
  evidence: Story 1.5b human decision 2026-10-15 ("Industry name from the register"); the spec scoped the correction to Story 1.5b and issue #6.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5b-company-search.md`
  summary: When Story 1.6b mounts the compact SearchField in the persistent header, `busy` and the "Henter analysen …" notice set before `router.push` are never cleared, because the header does not unmount on navigation.
  evidence: Review of 1.5b (edge-case finding 4, maybe-false, medium if true). The hero variant unmounts with the front page, so 1.5b cannot hit it; settle it in 1.6b with an e2e test that searches from the header twice, or reset `busy` on a `usePathname` change.
