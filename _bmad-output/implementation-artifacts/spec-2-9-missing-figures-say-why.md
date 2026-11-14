---
title: 'Story 2.9: Missing figures say why'
type: 'feature'
created: '2026-11-14'
status: 'done'
baseline_commit: '291c5cf54cabf92966c6cb9d0be5c6e7e21d3929'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/key-figures.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The engine's absence reasons exist only as types: nothing produces `not_in_dataset`, figures 7 and 8 have no reason, `src/analysis/figure-text.ts` reads every reason but `undefined` as "en regnskapslinje mangler", and a subject whose filing failed reconciliation looks like any other (FR-21, FR-23, FR-55, FR-56, FR-71; issue #60).

**Approach:** Complete the absence union, map each reason to one EXPERIENCE state through one exhaustive switch, decide each company's document basis in the engine from the manifest, the filing year and the stored statuses, and show the header subline. Document rows come with Epic 3.

**Decisions (Meinich, 2026-11-14):**
1. **Engine scope.** Per company and per document figure, 2.9 returns an absence or "read" (`null`); Story 3.1a fills "read" with the formula. The twelve: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14 and kontantandel.
2. **The union, eight reasons:** `undefined` (cause `denominator_not_positive` | `component_missing` | `line_not_read_safely`), `below_floor`, `not_in_dataset`, `failed_reconciliation`, `not_reconciled`, `refused`, `document_missing`, `not_read_in_v1` (scope `notes` | `filing_year` | `paper`). `exceeds_api_subtotal` leaves `Absence` and stays an input-level absence in `document-inputs.ts`; a figure reading such a line is `undefined`/`line_not_read_safely`.
3. **Basis, in order:** figures 7 and 8 are `not_read_in_v1`/`notes` for every company. Then: orgnr not in `register.dataset.manifest->'document_figure_orgnrs'` → `not_in_dataset`; filing year outside `DOCUMENT_YEARS` → `not_read_in_v1`/`filing_year`; no document row → `document_missing`, the only reason decided from a missing row, with one `warn` line through `src/logger.ts` (event `analysis.documentMissing`, no orgnr); `paper` → `not_read_in_v1`/`paper`; `not_extracted` → `refused`; otherwise the current column through `documentFigures` (`failed_reconciliation`, `not_reconciled`, or read). Nothing throws.
4. **`DOCUMENT_YEARS`** (2021–2025) is set once in `src/engine`; a test fails if it differs from `ingest/src/peerless_ingest/run.py`.
5. **Derivation test:** a document `sumDriftsinntekter` NULL is derived from `driftsresultat` + `sumDriftskostnad`; with either one also NULL it is `undefined`/`component_missing`, never 0. `epics.md` 2.9's `langsiktigGjeld` AC is corrected in this PR.
6. **Copy (approved):** `analysis.documentFailed` "Regnskapet for {aar} kunne ikke leses sikkert" (failed, not reconciled, refused; header subline); `analysis.documentNotRead` "Regnskapet for {aar} er ikke lest i denne versjonen" (subline for `filing_year`, `paper`); `analysis.figures.documentMissing` "Regnskapet for {aar} er ikke lest inn" (state and subline); `analysis.figures.notReadInV1` "Ikke lest i denne versjonen" with `.notes` "Antall årsverk står i notene til årsregnskapet. Denne versjonen av Peerless leser ikke notene.", `.filingYear` "I denne versjonen leser Peerless årsregnskapene for {fra}–{til}. Regnskapet for {aar} er ikke lest." ({fra}/{til} from `DOCUMENT_YEARS`), `.paper` "Regnskapet for {aar} er levert på papir. Denne versjonen av Peerless leser ikke papirregnskap."; `analysis.figures.reason.lineNotReadSafely` "en regnskapslinje kunne ikke leses sikkert"; `analysis.figures.notInDataset` "Ikke i demodataene". No subline for `not_in_dataset` or a read basis.
7. **E2E subject:** synthetic, in its own Playwright project that runs last. It inserts one 62.100 AS (filing, key figures, a `failed_reconciliation` document, its orgnr added to the manifest list) as the database owner. It cleans up before and after, idempotently, so a crash is cleaned up by the next run. The orgnr is set in one place, and the revenue lies outside demo A's and B's bands at every step. AGENTS.md is changed in this PR to allow this one committing test, with the reason. The owner connection comes from an environment variable, and the test refuses to run unless its host is local (`localhost` or `127.0.0.1`). No new secret goes into any commit, and `.env.example` shows the variable without a password. The synthetic company's name says it is synthetic: "SYNTETISK TESTSELSKAP AS".

## Boundaries & Constraints

**Always:** reasons decided in `src/engine`, pure; derivation in `src/engine` only; copy in `nb.json`; test data from the demo companies or synthetic companies; tests on other subjects compare totals only and name no labelled-set company; check at 375 and 320 px.

**Never:** compute a document figure's value or kroner (3.1a); render document rows or the not-in-dataset State block (3.1b); a badge; a silent fallback; a migration or seed change; `pnpm classify`; deleting a dump.

## I/O & Edge-Case Matrix

All `document-absence` tests use synthetic companies.

| Scenario | Input | Expected | Fails if deleted |
|---|---|---|---|
| Reason without a state | a new `Absence` member | typecheck fails | `test/analysis/absence-state.test.ts` "every reason has exactly one state" + the `never` default in `src/analysis/absence-state.ts` |
| 7 and 8 | every basis | `not_read_in_v1`/`notes` | `test/engine/document-absence.test.ts` "7 and 8 are not read in v1 on every basis" |
| Not in manifest | rows present, orgnr not listed | ten `not_in_dataset` | `…` "rows outside the manifest are not in the dataset" |
| Filing year | listed, period 2025-04-01–2026-03-31, filing year 2026 | `not_read_in_v1`/`filing_year`; subline "ikke lest i denne versjonen" | `…` "a filing year outside the read years is not read in v1"; `test/analysis/company-header.test.ts` "a filing year not read shows its subline" |
| Paper | status `paper` | `not_read_in_v1`/`paper` | `…` "a paper filing is not read in v1" |
| Refused | status `not_extracted` | `refused`; subline "kunne ikke leses sikkert" | `…` "a refused document is refused"; `company-header.test.ts` "a refused filing shows the failed subline" |
| Document missing | listed, year in range, no row | `document_missing`, one `warn` line, no throw | `…` "a listed company with no row is document_missing"; `test/analysis/document-basis-log.test.ts` "a missing document logs once without the orgnr" |
| Failed subject | current column failed | ten `failed_reconciliation`; API benchmark and driftsmargin kroner unchanged; subline; tabs and peers kept; not uncovered | `…` "a failed column gives no document figure"; `test/engine/benchmark.test.ts` "a failed document leaves the API benchmark unchanged"; `company-header.test.ts` "a failed filing shows the subline"; `test/analysis/view.test.ts` "a failed filing stays covered"; `e2e/failed-subject.spec.ts` |
| Failed peer | one peer failed | `leftOut` +1 per document figure; counted for API figures | `…` "a failed peer is left out of document figures only" |
| Derivation | document `sumDriftsinntekter` NULL | derived; a part also NULL → `component_missing` | `test/engine/document-inputs.test.ts` "a missing revenue is derived from its stated parts" / "an underivable revenue is undefined, never 0" |
| Line not read safely | `kundefordringer` above `sumOmloepsmidler` | figure 9 `undefined`/`line_not_read_safely` | `…` "a line above its API subtotal makes receivable days undefined" |
| Step 1 | a read with a NULL total, written | stored NULL | `ingest/tests/test_documents_write.py::test_a_missing_total_is_stored_null_not_derived` |
| Years agree | `DOCUMENT_YEARS` ≠ `run.py` | test fails | `test/engine/document-years.test.ts` "the engine reads the years step 1 fetches" |
| Below floor | 9 peers with a value | `below_floor`, 9 | existing `test/engine/statistics.test.ts` floor test |
| 375/320 px | synthetic failed subject | subline wraps; no body scroll; tables in scroll containers | `e2e/failed-subject.spec.ts` "at 375 and 320 px …" |

</frozen-after-approval>

## Code Map

- `src/engine/types.ts` -- `Absence`, `UndefinedCause`, `FigureAbsence`.
- `src/engine/document-inputs.ts` -- `documentFigures`, `guardCurrentAssets` (keep `SubtotalAbsence` local); add `DOCUMENT_YEARS`, `DocumentBasis`, `documentBasis(...)` and the revenue derivation.
- `src/engine/document-absence.ts` (new) -- `DOCUMENT_KEY_FIGURES` and `documentFigureAbsence(basis, figure)`.
- `src/engine/statistics.ts` `compareFigure` -- counts absent peers in `leftOut` and applies `MIN_PEERS`; reuse.
- `src/engine/fingerprint.ts:248` -- reads `exceeds_api_subtotal` from a `DocumentFigure`; keep working.
- `src/analysis/absence-state.ts` (new), `figure-text.ts` -- the switch (reason → message id + vars) and the subline switch over the basis.
- `src/server/analysis.ts` -- `SUBJECT_SQL`/`CANDIDATES_SQL`: left join `register.document` and its current `register.document_column` for the filing year; manifest membership via `register.dataset`; the `document_missing` log line in `toSubject`/`toCandidate`.
- `src/logger.ts` -- event `analysis.documentMissing`.
- `src/analysis/view.ts` -- `SubjectFiling` carries the basis; `analysisView` unchanged.
- `src/components/analysis/company-header.tsx` -- the slate subline below the meta line.
- `e2e/synthetic.ts` (new, the one orgnr and figures), `e2e/failed-subject.spec.ts`, `playwright.config.ts` (a project with `dependencies` on the others); the owner URL as `test/db` reads it.
- Do not change: funnel rules, `register.*` schema, the seed, `parse`/`serialize`, the proxy.

## Tasks & Acceptance

**Execution (one commit each):**
- [x] `types.ts`, `document-inputs.ts`, `document-absence.ts` + `test/engine/document-absence.test.ts`, `document-inputs.test.ts`, `document-years.test.ts`, `benchmark.test.ts`.
- [x] `absence-state.ts`, `figure-text.ts` + tests.
- [x] `ingest/tests/test_documents_write.py` as-filed write test.
- [x] Copy into `nb.json` and the EXPERIENCE states.
- [x] `logger.ts`, `server/analysis.ts`, `view.ts`, `company-header.tsx` + tests; check at 375/320 px.
- [x] `e2e/synthetic.ts`, `e2e/failed-subject.spec.ts`, `playwright.config.ts`; AGENTS.md exception.
- [x] Review fixes; `docs/ai-log.md`; `docs/key-figures.md`; technical note AD-15 (eight reasons; `document_missing` the one decided from a missing row, and why); `epics.md` 2.9 (reasons, derivation AC); PRD if moved; session file; sesjonslogg.

**Acceptance Criteria:** `epics.md` Story 2.9 as settled by the decisions. The PR states what can go wrong with absence reasons and derived components in money figures and has a "Planning documents:" line.

## Implementation Notes

- Seven implementation commits, `3b524e7` to `27022ad`, and the review fixes `c5a6a72`, by the implementation subagent. The SQL fragments and the row-to-basis mapping live in `src/analysis/document-basis.ts`, shared by `SUBJECT_SQL` and `CANDIDATES_SQL`; the reads log (`logSubjectRead`, `logCandidatesRead`), `documentBasisOf` does not.
- A document with no current column, which step 1 never writes, takes the document's own status: `failed_reconciliation`, otherwise `not_reconciled`.
- For a read basis, 2.9 decides only R3's lines (`line_not_read_safely`), an underivable revenue and revenue growth's prior column (`component_missing`); every other empty line, a denominator's sign and the 5 kr bound on a derived revenue are Story 3.1a's (its AC, `epics.md`).
- The synthetic e2e company is orgnr 999999905 with 2 500 000 kr revenue, outside demo A's (26,2 mill. kr) and B's (24,9 mill. kr) bands at 0,25–4×.
- Verified on the committed seed (BMAD session, after the review fixes): check:pins, check:env, lint, typecheck; `pnpm test` 1 271; `pnpm seed:export` unchanged; `pnpm test:db` 193; `pnpm test:ingest` 392; build; check:routes; `pnpm test:e2e --workers=1` 150, the 375 and 320 px checks among them. Then `.local/document-run-2.5d/` restored and `pnpm derive`: 2 785 documents, 5 556 columns, 2 537 fingerprints, 10 371 classification rows.

## Spec Change Log

- 2026-11-14, Meinich, after a proposal from the review session: decision 7's "`.env.example` shows the variable without a password" is superseded. The owner connection is the existing `SUPABASE_DB_URL`, whose `postgres:postgres` is the Supabase CLI's public default for the local database, not a secret, so a fresh clone runs without filling anything in. What protects is the refusal of any host but `localhost` and `127.0.0.1` (`e2e/synthetic.ts`, `ownerSql`). KEEP: `.env.example` unchanged apart from its comment; no new variable.

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | Verification gap | `document_missing` never runs through `SUBJECT_SQL`/`CANDIDATES_SQL`, and no test asserts a candidate's basis | medium | every listed seed orgnr has a document row (`seed-export.ts` builds the list from them); the log and absence tests build rows by hand | patch (a rolled-back db test) |
| 2 | Verification gap | the `not_reconciled` side of "no current column" is untested | low | only the `failed_reconciliation` side is asserted | patch (one assertion) |
| 3 | Edge case, Blind | the e2e cleanup deletes orgnr 999999905 whatever company holds it, cascading its document rows | medium | `remove()` deletes by orgnr alone; a full ingest could store a real company under it | patch (refuse unless the name is the synthetic one) |
| 4 | Edge case, Blind | `analysis.documentMissing` is logged per company per request, every candidate included, not once | medium | `documentBasisOf` logs inside `toSubject` and `toCandidate`, so the whole industry is logged on every view | patch (subject once; candidates once per read) |
| 5 | Edge case, Blind | with no `register.dataset` row every company is silently `not_in_dataset` | low | `coalesce(…, false)`; L9 forbids a silent fallback | patch (one warn line) |
| 6 | Blind | revenue growth with a failed prior column reads "Regnskapet for 2025 kunne ikke leses sikkert", the wrong year and a state the header contradicts | medium | `readAbsence` returns the prior column's reason; Story 3.1a's AC says undefined | patch (undefined, `component_missing`) |
| 7 | Edge case | the phone-width table check passes with zero tables | low | `tables` may be empty | patch (at least one on nokkeltall) |
| 8 | BMAD session | a crashed run leaves the synthetic company in place while the next run's other projects execute, where it can join a small subject's pool | medium | cleanup runs only in the last project's `beforeAll` | patch (also clean in Playwright's global setup) |
| 9 | Edge case, Blind | the e2e test writes `register.dataset`, which AD-16 calls loader-only | low | AGENTS.md names it; the technical note does not | patch (AD-16 note) |
| 10 | Blind | "a failed document leaves the API benchmark unchanged" cannot fail in its API half | low | `benchmarkApiFigures` takes no document input; the guarantee is the signature, and the e2e on/off-list check | patch (comment and AI log say so) |
| 11 | Blind | the derived-revenue 5 kr bound is deferred to 3.1a without a record | low | AGENTS.md: deferred v1 work goes into `epics.md` | patch (3.1a AC) |
| 12 | Blind | `epic-2-context.md` lost the AD-4 payload rule and the performance targets | low | the same as Story 2.8's row 11; this story adds fields to `Subject` and `Candidate` (none reaches a client component: checked) | patch (docs) |
| 13 | Blind | the README's leftover note omits that `pnpm seed:export` refuses and `pnpm seed` removes it | low | README line 51 | patch |
| 14 | Blind | the spec at `in-review` while sprint-status says `in-progress` | low | AGENTS.md vocabularies | patch (sprint-status to `review`) |
| 15 | Edge case | `statusOf` throws on an unknown stored status, so "nothing throws" is false | false | the column `status` CHECK allows only `reconciled`, `failed_reconciliation` or NULL; a loud failure on an unreachable value is correct | reject |
| 16 | Edge case | `documentFigureAbsence` has no `default` and returns `undefined` for an unknown kind | false | the switch returns on every member of `DocumentBasis`; a new member fails the return type at compile time | reject |
| 17 | Edge case | a `?host=` parameter in `SUPABASE_DB_URL` could bypass the local-host check | low | needs the developer's own `.env` to point elsewhere; the fix adds a guard | reject |
| 18 | Edge case, Blind | a failure in another project skips the synthetic project | low | the run is red anyway; Playwright reports the project as not run | reject |
| 19 | Edge case | `.env.example` shows a password, against decision 7 | false | superseded by Meinich's decision in the Spec Change Log | reject |
| 20 | Blind | the wider candidate query is unmeasured against the 1 s target, and the candidate basis is unused | false | `test/db/peer-assembly-time.test.ts` ran in `pnpm test:db` with the new query; the basis is row 1's and Story 3.1a's input | reject |
| 21 | Blind | an alias typo in `DOCUMENT_SELECT` yields `undefined` silently | false | `parseOre(undefined)` throws a TypeError, and `test/db/analysis.test.ts` reads real rows to a `read` basis | reject |

## Verification

**Commands:**
- `pnpm check:pins; pnpm check:env; pnpm lint; pnpm typecheck; pnpm test; pnpm test:db; pnpm test:ingest; pnpm build; pnpm check:routes; pnpm test:e2e --workers=1` -- all pass on the committed seed. If e2e stops for memory, report it; do not restart.
- After the last seed load: restore `.local/document-run-2.5d/`, `pnpm derive`, and confirm 2 785 documents, 5 556 columns, 2 537 fingerprints and 10 371 classification rows.

**Manual checks:**
- The synthetic failed subject at 1280, 375 and 320 px: the subline wraps, the body does not scroll sideways, and each table sits in its own scroll container.
