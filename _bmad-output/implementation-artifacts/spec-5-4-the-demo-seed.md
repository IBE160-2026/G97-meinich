---
title: 'Story 5.4: The demo seed'
type: 'feature'
created: '2026-11-25'
status: 'in-progress'
baseline_commit: '06fd41f983116e4bd69e2cbea6a386d03c85c9b3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/docs/licence-gate.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The committed seed holds document figures only for the 20 OCR reference companies, so no real demo company shows the margin waterfall (Epic 3 retro, W5/E4). The 2.1b acceptance run's rows live in a local dump that every `pnpm seed` loses. Demo A and B are placeholders, and the licence gate has never been assessed (issue #86; FR-73, FR-65, FR-72, FR-64).

**Approach:**
- Fix A and B, allow-list A, B, C and their peers at all three band steps, and record the licence gate as closed.
- Export the allow-listed companies' read document rows and fingerprints into the committed seed, so the full analysis and the waterfall run from a fresh clone.
- Close the deferred entries that name this story.
- Write the full-verification order into AGENTS.md.

## Decisions (Meinich, 2026-11-25, checkpoint 1)

1. **Demo companies.**
   - **A = 922425620 TRETOEN AS** (Hamar): a typical IT consultancy. Its fingerprint type, its classification and its register text agree. Its 2025 driftsmargin is 3.42 % against a band-0 median of 3.08 %. Its 2024 and 2025 columns are reconciled, with the API check passed.
   - **B = 912159329 HUMA AS** (Oslo): a loss-making software product company. Its type, classification and text agree. Its margin is −48.5 % against a median of 4.56 %, a gap of about 21.5 mill. kr on 40.5 mill. revenue.
   - **C** stays 967534579 KANTALL AS (69.202, uncovered).
   - The review session checked the margins and revenues, and that A, B and C are not in the labelled set.
2. **The labelled set (option ii).**
   - Every group member at bands 0–2 is allow-listed, the 216 labelled-set orgnrs among them. Their document rows and fingerprints are not exported; that includes those 2.1b read.
   - **Export rule:** no fingerprint row for an orgnr in the labelled set (`analysis/labelled-set/document-run.json`). This removes the 8 reference companies' fingerprints from the seed. Their document rows stay, because the OCR reference check needs them.
   - A test on the committed seed fails if such a fingerprint row exists. It reports a count only, never an orgnr.
   - `docs/ai-log.md` says that the rule has been broken since Story 5.1, and that git history still holds the old rows.
3. **Peers without a document (option a).**
   - Allow-listed peers with no read document stay on the list.
   - The AC reads "full document figures for A, B and the allow-listed peers whose documents are read". `epics.md` is corrected in this PR and the correction is logged in the Spec Change Log.
   - No OCR run.
4. **Licence gate closed.**
   - Commit `docs/licence-gate.json` as `{"open": false, "assessment": "docs/licence-gate.md", "date": "2026-11-25"}`, and commit the assessment.
   - **Reason:** an open gate changes nothing in the v1 seed, and the AC says that the gate opens only *if* the assessment concludes so, not that it must.
   - "Kilder og lisens" gets the closed-gate text, without the derived-categories phrase.
5. **Copy (approved verbatim):**
   - `about.sources.documents`: «Tall fra innsendte årsregnskap er lest av Peerless fra dokumentene i Regnskapsregisteret hos Brønnøysundregistrene. Registeret oppgir ingen lisens for disse dokumentene. Demoversjonen inneholder derfor bare et avgrenset utvalg av slike tall.»
   - `keyFigures.notInDataset.popoverLink`: «Om tallene fra årsregnskapene» (links to that paragraph)
   - `waterfall.tooFew`: «Ingen forklaring av marginen: bare {n} sammenlignbare har et avstemt årsregnskap for {aar} med alle kostnadslinjene (av 10 som trengs).»
   - `waterfall.tooFewOne`: «Ingen forklaring av marginen: bare ett sammenlignbart selskap har et avstemt årsregnskap for {aar} med alle kostnadslinjene (av 10 som trengs).»
   - `waterfall.tooFewNone`: «Ingen forklaring av marginen: ingen sammenlignbare har et avstemt årsregnskap for {aar} med alle kostnadslinjene (av 10 som trengs).»
   - `analysis.notice.median`: ««Til medianen for driftsmargin» gjelder ikke for denne peer-gruppen, så andelen er satt til 50 %.»
   - `provenance.date.peers`: «Peer-gruppen: Regnskapsår {aar} · årsregnskapene hentet {fra}–{til}»
   - `provenance.date.peersOne`: «Peer-gruppen: Regnskapsår {aar} · årsregnskapene hentet {dato}»
   - **README:** the three demo lines as shown at checkpoint 1.
   - **X1** is resolved by the new tooFew wording.
6. **Verification order** is written in AGENTS.md "Testing". There is no `pnpm verify`.
7. **Restore.**
   - The rows not exported are dumped to `.local/document-run-5.4/`, which becomes `pnpm restore:documents`'s default.
   - AGENTS.md is updated where it names `.local/document-run-2.5d/`. That directory is never deleted.

## Boundaries & Constraints

**Always:**
- **Outside the allow-list, totals only.** No orgnr, type, label or figure of a company outside the allow-list is published in the repository, PR, issue or a session file. Overlap with the labelled set is a total only.
- **The export refuses** document rows of a labelled-set orgnr that is not in the OCR reference draw (the BMAD session's guard for decision 2). The test that checks it gives the count only.
- **Running tests.** `pnpm test --maxWorkers=2`. E2e runs with one worker, one project at a time, `synthetic` last.
- **No expected value is chosen from data with a condition.**
- **Commits.** Commit in logical steps, with the review fixes separate. Push only when Meinich says so.

**Never:**
- Run `pnpm classify`, a model or an OCR run.
- Delete a dump.
- Change `src/engine/fingerprint.ts`, the bands or the v1 funnel switches.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails if the guard is removed |
|---|---|---|---|
| Unlisted document figures | a committed `document_column` row whose orgnr is not listed | fails | `test/allow-list.test.ts` "covers every orgnr with document figures in the committed seed" (existing) |
| Labelled-set fingerprint in the seed | `seed/demo/fingerprint.csv` | 0 rows of labelled-set orgnrs; the failure message gives a count only | new `test/allow-list.test.ts` "holds no fingerprint of a labelled-set company" |
| The export's fingerprint rule | a labelled-set orgnr with a fingerprint, listed, gate closed and open | the row is not exported | new `test/db/seed.test.ts` "never exports a fingerprint of a labelled-set company" |
| The export's document rule | a labelled-set orgnr outside the reference draw with a document column, listed | refuses, naming a count | new `test/db/seed.test.ts` "refuses document rows of a labelled-set company outside the reference draw" |
| Groups inside the list | A and B at bands 0, 1 and 2 on the loaded seed | every member is listed | new `test/db/demo-companies.test.ts` "A’s and B’s groups at every band step are subsets of the allow-list" |
| Demo companies | `DEMO_COMPANIES` | TRETOEN AS and HUMA AS | `test/db/demo-companies.test.ts` (updated) |
| Allow-list entries | `pnpm ingest:document-set --allow-list` | A, B, C and bands 0–2 members with reasons, the reference entries kept | new `test/document-set.test.ts` "writes the allow-list entries for A, B, C and their peers at bands 0–2" |
| Waterfall on a real demo company | the committed seed, Oversikt and Nøkkeltall of A | a decomposition with P ≥ 10; every "Vis tallene" row has a drill-down | new `e2e/demo-waterfall.spec.ts` "demo A shows the margin waterfall from the committed seed" |
| Peer aggregate dates (FR-64) | a document key figure's quartile drill-down | the filing year and the read-date range of the compared peers; one date when min = max | new `test/analysis/provenance.test.ts` "a document-based aggregate states its filing year and read-date range" |
| tooFew | `too_few` with n = 0, 1 and 5 | `tooFewNone`, `tooFewOne`, `tooFew` | new cases in `test/analysis/waterfall-view.test.ts`; `test/messages.test.ts` |
| X1 | `too_few` where every outside peer lacks a document | the sentence names the document and the year | new `test/analysis/waterfall-view.test.ts` "too few for reasons other than cost lines" |
| Median notice | `andel=median` and a group with no median step | `analysis.notice.median`, not `analysis.notice` | new cases in `test/url/analysis-state.test.ts` and `test/analysis/view.test.ts` |
| dataQuality | `failed_reconciliation` with `brregId` ≠ the shown filing's | `not_compared` | new `test/engine/provenance.test.ts` "failed against another filing is not compared" |
| brreg_id | `document_brreg_id` | read by an id parser, not `parseOre` | new case in `test/analysis/document-basis.test.ts` |
| Licence gate | `docs/licence-gate.json` closed | allow-listed fingerprints only | `test/db/seed.test.ts` "the licence gate" (existing) |
| About page | `/slik-fungerer-peerless#kilder`, the popover | the paragraph, without the phrase; the popover links to it | `e2e/analysis-states.spec.ts` (updated), `test/messages.test.ts` |
| C | 967534579 | the uncovered state | `e2e/analysis-states.spec.ts` "uncovered company (demo company C)" (existing) |

</frozen-after-approval>

## Code Map

**Seed export and the allow-list**
- `scripts/seed-export.ts:131-139,194-257`, `scripts/seed-format.ts:456-482,522-561,595-653`:
  - the allow-list's shape, `{orgnr, reason}`;
  - `withReferenceOrgnrs`;
  - `fingerprintWhere(gate, list)` gains the labelled-set exclusion;
  - `refuseUnlistedDocumentFigures` sits next to the new labelled-set document refusal, since document tables are exported whole;
  - the gate's file must be exactly `{open, assessment, date}`.
- `analysis/labelled-set/document-run.json` holds the labelled set's orgnrs. `analysis/ocr-reference/drawn.json` holds the reference draw.
- `scripts/document-set.ts` and `document-set-compute.ts:27-45` compute `demoPools` at band 0. Add bands 1–2 for `--allow-list`. `seed/document-run.json` stays the band-0 union of the new A and B, regenerated. `test/db/document-set.test.ts` recomputes it.

**Tests and fixtures on the committed seed**
- Counts in `test/db/seed.test.ts:109-140`.
- These assume demo A is outside the demo data: `test/db/analysis.test.ts:154-167`, `e2e/oversikt.spec.ts:221-226` and `e2e/provenance.spec.ts:157-163`. Switch them to a fixed 62.100 company that is not listed, chosen by a fixed rule (not from data with a condition), or to an assertion that holds for every company that is not listed.
- Hard-coded A and B: `e2e/search.spec.ts:9,168-169`, `e2e/db-down.spec.ts:15`, `e2e/no-ip-stored.spec.ts:32` and `e2e/rate-limit.spec.ts:14`. They switch to `DEMO_COMPANIES`.
- `test/fingerprint-seed.test.ts:75-111`: its allow-listed recompute holds.

**Waterfall**
- `src/engine/waterfall.ts:434-437`: `too_few` carries `n` and `notInDataset`.
- `absentText` at `src/analysis/waterfall-view.ts:167-179` needs the filing year for `{aar}`.

**The median notice**
- `src/url/analysis-state.ts:231-232`: a separate `medianFallback` result next to `invalidSettings`.
- `src/analysis/view.ts:197-231` and `src/components/analysis/settings-notice.tsx`.

**dataQuality and brreg_id**
- `src/engine/provenance.ts:453-454`: tie the case to `filingBrregId` as `read` is (`:455-466`).
- `src/analysis/document-basis.ts:152`: a `parseId` in `src/engine/inputs.ts`.

**FR-64**
- `waterfallFacts` (`src/analysis/shown-group.ts:128-149`) holds the min/max rule and throws on a null date.
- Add a sibling for the peers a document figure's comparison counts, and print it in `figureStep` (`src/analysis/provenance.ts:220-269`) for (9), (10) and (11) via `capitalProvenance`. Reuse the shape of `samletDateLine` (`:741-747`).

**About page and popover**
- `src/app/slik-fungerer-peerless/page.tsx:25-46` gets the paragraph, with an id.
- `InfoPopover` (`src/components/analysis/info-popover.tsx:30-40`) gets an optional link, used at `key-figure-table.tsx:126`.

**Restore**
- `scripts/restore-documents.ts` (default directory) and its tests.

## Tasks & Acceptance

**Execution:**
1. `src/demo-companies.ts`, `scripts/document-set*.ts` (`--allow-list`, bands 0–2), `seed/document-run.json` and their tests.
2. `scripts/seed-format.ts`, `scripts/seed-export.ts`: the labelled-set fingerprint rule and the document refusal, with their tests.
3. `scripts/restore-documents.ts`: default `.local/document-run-5.4/`.
4. **Local data.** The BMAD session does this, not the subagent:
   - dump every document, column and fingerprint row of an orgnr not to be exported to `.local/document-run-5.4/`;
   - delete those rows, then run `pnpm derive`;
   - write the allow-list with `--allow-list`, then run `pnpm seed:export` with the gate file in place;
   - check totals per file;
   - run `pnpm seed`, then `pnpm restore:documents`.
5. The waterfall copy (tooFew, X1), the median notice, dataQuality and `brreg_id`, FR-64: each with its tests.
6. The about page, the popover link, `docs/licence-gate.{md,json}` and the README demo text.
7. The fixture and count updates in the Code Map, and the new e2e spec.
8. Docs:
   - AGENTS.md:
     - the "Testing" order;
     - `.local/document-run-2.5d/` → `.local/document-run-5.4/`;
     - the seed text, saying who writes what in `seed/`: `pnpm seed:export` writes `seed/demo/`; `pnpm ingest:document-set` writes `seed/document-run.json`; `pnpm ingest:document-set --allow-list` writes `seed/allow-list.json`'s entries for A, B, C and their peers, which the export then writes back with the reference entries; `seed/coverage.json` is hand-edited;
   - the technical note, line 86 (AD-16's writers): `pnpm restore:documents` puts back, from `.local/document-run-5.4/`, the rows that are not exported (the labelled set's, and those of read companies not on the allow-list), not "until Story 5.4 commits those rows" (decision 7);
   - `README.md` "Seed";
   - `epics.md` 5.4 AC (decision 3), PRD/memlog if affected;
   - `deferred-work.md`: close the entries;
   - `docs/ai-log.md` (risks, decision 2's history);
   - the session file.

**Acceptance Criteria:**
- Given the committed seed, when `pnpm seed` runs twice, then the state is the same, and `pnpm restore:documents` then restores the rows that were not exported.
- Given the PR, then it has "Planning documents:" and the section on what could go wrong, and the allow-list is approved in review.

## Implementation Notes

## Spec Change Log

- 2026-11-25, Meinich, checkpoint 1 (decision 3): `epics.md` Story 5.4's "full document figures for A, B and the allow-listed peers" becomes "… the allow-listed peers whose documents are read". The 2.1b run read band 0 only, so 412 allow-listed peers at bands 1–2 have no document. P stays far above 10 without them. An OCR run of about 2.4 h was declined. Known-bad state avoided: an AC that the seed cannot meet without a run outside v1's scope (FR-3).

## Review Triage Log

## Design Notes

**Measured 2026-11-25 on the local database, with `.local/document-run-2.5d/` restored, read-only as `reader`.** The manifest test was replaced by `true` in a scratch script (`.local/analysis-5.4/`).

| Company | Band 0 | Band 1 | Band 2 |
|---|---|---|---|
| TRETOEN, group | 434 | 690 | 900 |
| TRETOEN, P exported | 203 | 225 | 226 |
| HUMA, group | 296 | 482 | 619 |
| HUMA, P exported | 127 | 207 | 225 |

- The allow-list: 960 orgnrs, 940 of them new. 216 of the new orgnrs are in the labelled set, and 412 have no read document.
- The seed is estimated at about +1.28 MB, to 15.9 MB.

**Classifications are published, fingerprints are not.** The committed `seed/demo/classification.csv` holds a type for 352 of the labelled set's 845 companies (a total, read by the review session and checked here). It is published because the AGENTS.md rule covers fingerprint results only, and decision 2 follows that rule. Both the classifications (Story 2.6's full run, "with the 845 like any other company") and the fingerprints were produced after the set was labelled. The export of classifications is unchanged. `docs/ai-log.md`'s entry on decision 2 says the same.
