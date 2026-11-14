---
title: 'Story 2.9: Missing figures say why'
type: 'feature'
created: '2026-11-14'
status: 'in-progress'
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
- [ ] Review fixes; `docs/ai-log.md`; `docs/key-figures.md`; technical note AD-15 (eight reasons; `document_missing` the one decided from a missing row, and why); `epics.md` 2.9 (reasons, derivation AC); PRD if moved; session file; sesjonslogg.

**Acceptance Criteria:** `epics.md` Story 2.9 as settled by the decisions. The PR states what can go wrong with absence reasons and derived components in money figures and has a "Planning documents:" line.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm check:pins; pnpm check:env; pnpm lint; pnpm typecheck; pnpm test; pnpm test:db; pnpm test:ingest; pnpm build; pnpm check:routes; pnpm test:e2e --workers=1` -- all pass on the committed seed. If e2e stops for memory, report it; do not restart.
- After the last seed load: restore `.local/document-run-2.5d/`, `pnpm derive`, and confirm 2 785 documents, 5 556 columns, 2 537 fingerprints and 10 371 classification rows.

**Manual checks:**
- The synthetic failed subject at 1280, 375 and 320 px: the subline wraps, the body does not scroll sideways, and each table sits in its own scroll container.
