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

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1a-ocr-library.md`
  summary: Årsverk (`aarsverk`, full-time equivalents, one decimal) is not read in Epic 2, so key figures #7 revenue per FTE (`sumDriftsinntekter / aarsverk`) and #8 personnel cost per FTE (`lonnskostnad / aarsverk`) in `docs/key-figures.md` have no input until a later story reads it. Until then Story 2.9 must show both as absent with the right reason, not as undefined or as a failed reconciliation.
  evidence: Story 2.1 planning, 2026-10-19. Årsverk is printed in the company's own notes, which follow the three Brreg-generated pages; the spike's layout rules read only the generated section, and the notes are free-form. Deferred by Meinich, 2026-10-19.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1a-ocr-library.md`
  summary: Story 2.2 should add sub-total checks within a document (for example the short-term debt lines against sum kortsiktig gjeld, the cost lines against sum kostnader), so that fields in none of the four checks — leverandørgjeld, annen driftskostnad and the other component lines — can confirm a digits-only figure instead of staying absent.
  evidence: Story 2.1a review, 2026-10-19. In 979607008/2025 the plain pass misread a digit in annen driftskostnad 2025 and leverandørgjeld 2025/2024 ("l0 170 8365", "l 001 605", "l 731 356"); no check covers them, so the gate refused the digits-only figure and they are absent. Decided by Meinich.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1a-ocr-library.md`
  summary: The Tesseract pin (`tesseract-ocr=5.5.0-1+b1`, `libtesseract5`) installs from the live trixie mirror; a point release that replaces that version breaks `docker build` with no change in the repository, and leptonica and the other libraries float. Pin through snapshot.debian.org, or record the full package set, so the measured engine stays reproducible.
  evidence: Story 2.1a review, finding 17 (`ingest/Dockerfile`). Deferred at triage.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1b-ocr-ingest.md`
  summary: Run the document pass over all of 62.100, not only the acceptance set: `pnpm ingest --documents` with every covered orgnr (a plain `pnpm ingest` reads no document) reads about 33 000 documents, about 190 hours (8 days) at 21 s per document. The run is resumable, so it can be split across sessions; the machine must stay awake while it runs.
  evidence: Story 2.1b, decided by Meinich 2026-10-20. Estimate: `read_document` measured in the step-1 image on the development machine (16 logical cores) over 20 cached 2021–2025 filings, median 21.1 s per document (mean 22.8 s, max 38.5 s); two or three documents at once gave 19.1 and 21.5 s each, so running in parallel does not help. Document count: the demo seed has 8 441 companies with a 62.100 primary code and at least one SELSKAP key-figures filing; at about four filed documents each in 2021–2025 (the spec's ratio for the acceptance set, about 2 000 documents for 500 companies) that is about 33 000 documents, × 21 s ≈ 190 h. The acceptance run's counts per year (PR and session file) are the first measured check of the four-per-company ratio.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1b-ocr-ingest.md`
  summary: A documents run never fetches a stored document again, so a document the register refiles after it was read keeps its first result until the reader version changes. Decide how a later run notices a refiling. The `/aar` list gives only years, so a refiling cannot be seen from it. (Narrowed by Story 2.3b: `pnpm ingest --reread <file>` now reads a stored document again when another reader version read it, which also retries a document stored `not_extracted` after a Tesseract failure, `ocr_error`; what is left is a refiling under an unchanged reader.)
  evidence: Story 2.1b decision (rerun skips every stored `(orgnr, filing_year)`), recorded as a limit; `ingest/src/peerless_ingest/run.py`, `_load_documents`. Story 2.3b: `_reread_documents` selects on `register.document.reader_commit` only.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1b-ocr-ingest.md`
  owner: Story 5.4 (Meinich, 2026-10-23, Story 2.3 spec)
  summary: The acceptance run's document rows live only in the local database and in a gitignored dump (`.local/document-run-<commit>.sql`, README "Seed"). `pnpm seed` and `pnpm db:reset` delete them, and they are restored from the dump. Story 2.3 put only the 20 OCR reference orgnrs on the allow-list; the acceptance run's 407 orgnrs (demo A and B and their peers) are listed by Story 5.4 (technical note, "Seed data"; `epics.md` Story 1.3b's allow-list AC), which then commits their rows and drops the dump step from the README.
  evidence: Story 2.1b, decided by Meinich 2026-10-20; reassigned from 2.3 to 5.4 in the Story 2.3 spec (Never: "Add any other orgnr to the allow-list"). A 10–12 h OCR run must not be lost to a reset. A dump taken after Story 2.3 also holds the seed's reference rows and would fail on their keys if restored over the seed (README, "Seed"); the current dump, `document-run-bd2ce3e.sql`, predates them.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-reconciliation.md`
  owner: Story 2.3b (Meinich, 2026-10-23; was Story 2.3)
  closed: Story 2.3b, with the entry below (`layout.fold_mixed`; the re-read and its before and after in `analysis/output/ocr-sm2.md`).
  summary: The 2.1a reading library leaves `sum_egenkapital_gjeld` NULL in about 43 % of the read documents, so checks c3 and c4 are not evaluable there. The cause is how the bold "SUM EGENKAPITAL OG GJELD" row is recognised, not a missing label variant (corrected 2026-10-23; this entry first said the label was missed): see the Story 2.3b entry below. Story 2.3b fixes the reading of that row and reads the affected documents again, measuring the hit rate for that figure before (Story 2.3's report, `analysis/output/ocr-sm2.md`) and after.
  evidence: Story 2.2 implementation, measured on the 2.1b acceptance run's rows (image `e09a413`). `sum_egenkapital_gjeld` is NULL in 836 of 1 946 current columns and 852 of 1 946 prior columns. In 802 of those 836, sum eiendeler equals sum egenkapital + sum gjeld within 5 kr, so the other balance figures were read and only the total line is missing. Example: 919062223 in 2021–2023. Until the fix, Story 2.2's c5 (sum eiendeler against sum egenkapital + sum gjeld) gives the balance check. The re-read is about 836 documents, about 5 h at 21 s per document; the rerun needs a way to read a stored document again (see the refiling entry above).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-reconciliation.md`
  owner: Story 2.9
  summary: When 2.9 reads document figures, it must pick that year's own current column, and use a prior column only when the year has no document of its own (e.g. 2020 from the 2021 filing). A reconciled prior column whose `api_check` is `fail` is a restated comparative, and it must never stand in for that year's own document (Meinich, 2026-10-21). `documentFigures` takes no role, so this rule lives in the selection 2.9 writes. It needs a test there.
  evidence: Story 2.2 review, finding 13 (blind B6). `src/engine/document-inputs.ts` `DocumentColumnRow` has no `role` or `api_check`. 173 of 5 447 prior-column figures deviate from the register, e.g. 924830972 is +56 007 in sum eiendeler and sum gjeld.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-ocr-accuracy-sm2.md`
  owner: Story 2.3b (split from Story 2.3, Meinich 2026-10-23)
  closed: Story 2.3b (issue #38). `layout.fold_mixed` reads the "50M" row (`ingest/tests/test_layout.py::test_bold_sum_misread_matches_total`); a bold "l" in a figure enters only through the digits-only gate (`test_documents.py::test_bold_one_recovered_only_through_gate`); `pnpm ingest --reread` re-reads every stored document by reader version. The hit rate before and after, and the not-replaced count of the acceptance run, are in the report, the PR and the session file.
  summary: Read the balance total. Story 2.3 measures the reader as it is, and its report is 2.3b's "before"; Story 2.3b fixes the reading of the "SUM EGENKAPITAL OG GJELD" row and re-reads the documents where `sum_egenkapital_gjeld` is NULL (about 836 current columns of the 2.1b run, and the reference set's), reporting the hit rate before and after. The rerun needs a way to read a stored document again (see the refiling entry above).
  evidence: Story 2.3 implementation, 2026-10-23: `read_document`'s own OCR (`ocr.ocr_figure_pages`, plain pass) on seven documents whose stored `sum_egenkapital_gjeld` is NULL (919062223/2021, and six drawn at random from the 836: 921600070/2024, 914000076/2022, 924895772/2024, 991939490/2024, 823980892/2023, 887217912/2021). The row is printed in bold. In all seven, Tesseract reads it as "50M EGENKAPITAL OG GJELD": "EGENKAPITAL OG GJELD" is read, but the bold "SUM" comes back as "50M". `layout.fold` drops the digits, so the label folds to "megenkapitaloggjeld", which neither ends with the variant "sumegenkapitaloggjeld" nor passes `similar` (two characters shorter), and the row matches no target. The figures on the row are mostly read as printed (919062223/2021: "33 855 462 10 536 079", equal to its stored sum eiendeler); in two of the seven a bold "1" comes back as "l" ("l4 066 151", "l2 853 098"), which refuses that figure even once the label matches. The Story 2.2 entry above, `docs/data-sources-brreg.md` and `epic-2-context.md` first described this as a missed label.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-ocr-accuracy-sm2.md`
  summary: `analysis/ocr/consistency.py` and the JSON contract between it and `parseConsistency` (`scripts/ocr-sm2.ts`) have no test, so a field renamed on either side surfaces only when someone re-runs the script by hand.
  evidence: Story 2.3 review, finding V3. No test or CI step runs `consistency.py` or `parseConsistency` other than the snapshot of the committed report; the script needs Docker and the network.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-ocr-accuracy-sm2.md`
  summary: Lines that no within-document check and no API figure covers (bankinnskudd, kundefordringer, salgsinntekt, leverandørgjeld and the other component lines) can be misread and still reach the engine in a reconciled column; decide a guard (e.g. sub-total checks, deferred from 2.1a) or show such figures as unverified before the engine uses them.
  evidence: Story 2.3 review, finding B9. `docs/data-sources-brreg.md` (SM-2 section) names the risk; the SM-2 sample found none after the transcription corrections, which bounds nothing tightly in 20 filings.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3b-read-the-balance-total.md`
  summary: A document fetch can hang well past its timeout, and the run then stalls with no error. Give each document a time limit (a watchdog) enforced outside the network call: when it expires, the document is listed as not fetched (not replaced, on a re-read) and the run goes on, or exits 1 so a rerun resumes. Not fixed in Story 2.3b (Meinich, 2026-10-29).
  evidence: Story 2.3b acceptance run, step 4 (`pnpm ingest --reread seed/document-run.json`). The machine slept during the run; after it woke, the re-read wrote 981479076/2022 at 15:48:34 UTC and then nothing for about two hours. The process was at 0 % CPU, blocked in `poll` (`/proc/1/wchan`: `do_sys_poll`) with an established port-443 connection and no data queued, and its database session had been idle since its last `COMMIT`. `UrllibTransport.get` (`ingest/src/peerless_ingest/fetch.py`) passes `timeout=60` to `urlopen`, which bounds each socket operation, not the request, and here did not fire at all. The cause is not verified (the suspended Docker VM is likely). The container was stopped by hand and the re-read restarted; it resumed from the documents still on the old `reader_commit`.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-withdrawn-companies-disappear.md`
  summary: `pnpm seed` does not print the latest run record of each step, as `epic-2-context.md` ("Two batch steps, one writer per table") says it should. Story 2.4 decided (D1) that `loader` and `reader` get no access to schema `run`, so the loader cannot read `run.step1`; printing it needs a grant decision, or a separate command run as `ingest`.
  evidence: Story 2.4 implementation. The spec's code map and tasks do not include it; `test/db/run-grants.test.ts` asserts loader has no privilege in `run`.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-withdrawn-companies-disappear.md`
  summary: Decide whether a dissolved company (a stored `register.company.slettedato`, from a unit answering 200 with `slettedato` while absent from the bulk file) leaves the peer pool, and whether its filings still count in aggregates. Today nothing reads `slettedato`, so a dissolved company stays a candidate on its last filing.
  evidence: Story 2.4 review pass 1, Q4a (Meinich, 2026-10-30): only 410 deletes; the read-only measurement that day found 48 stored companies dissolved in 2026 (`docs/data-sources-brreg.md`, "Dissolved is not withdrawn").

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-withdrawn-companies-disappear.md`
  summary: Decide what happens to a stored `register.company.slettedato` when the company is in the bulk file again. Today the upsert from the bulk file does not touch the column, so the date stays; nothing reads it yet.
  evidence: Story 2.4 review fixes (implementation report, 2026-10-30). Not observed in the 2026-10-30 measurement; raised by Meinich to be recorded.
