---
title: 'Story 2.5: The business-model fingerprint (stage 4)'
type: 'feature'
created: '2026-11-01'
status: 'done'
baseline_commit: 'f7611482680a22e02c86ca49227abfb9a7f85488'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/key-figures.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stages 1–3 group 62.100 companies by industry code, size and legal form only, so a reseller, a product company and a consultancy that share the code are compared as equals (FR-10). Nothing yet reads what kind of business a company's own accounts show. Batch step 2 does not exist.

**Approach:**
- `src/engine/fingerprint.ts` derives five categories from a reconciled document column; an empty line can leave a category unknown.
- A first step-2 Node script stores one fingerprint per (orgnr, filing year), with an input digest and the dataset tag.
- In the request path, stage 4 derives a business type from the stored categories and removes a candidate whose type differs from the subject's.
- The seed carries the fingerprints, filtered by the licence gate.
- A within-band spread test checks the two banded measures (FR-13).

## Decisions (Meinich, 2026-11-01)

- **D1, types, bands and rule as proposed (Q1a).** The thresholds and the rule are locked before the spread test runs, and they are not adjusted after data.
  - **Types:**
    - `produkt`: the company's own software, as a licence or a subscription;
    - `konsulent`: hours or projects delivered by its own staff, staffing included;
    - `forhandler`: resells products made by others;
    - `annet`: operations, hosting or holding, or accounts that show none of the above.
  - **Bands,** as shares of `sum_driftsinntekter` in the same column, lower edge inclusive:
    - cost of goods `varekostnad`: low < 10 %, mid < 40 %, high ≥ 40 %;
    - personnel cost `lonnskostnad`: low < 30 %, mid < 60 %, high ≥ 60 %;
    - asset intensity `sum_varige_driftsmidler`: low < 10 %, mid < 50 %, high ≥ 50 %.
  - **Yes/no categories:**
    - inventory: `varer` > 0;
    - capitalised intangibles: `sum_immaterielle_eiendeler` ≥ 5 % of revenue.
  - **Rule,** first match wins:
    1. `forhandler`: cost of goods high, or cost of goods mid with inventory;
    2. `produkt`: capitalised intangibles;
    3. `annet`: asset intensity high;
    4. `konsulent`: personnel cost mid or high, with cost of goods low;
    5. `annet` otherwise.
  - The PR states that a product company which expenses its development becomes `konsulent`, and that Story 5.2 measures this.
- **D2, an empty line is not 0.**
  - Measured locally by the review session, 2026-11-01:
    - `lonnskostnad` is empty in 531 of 1 920 reconciled columns, and only 45 of those sum to the total;
    - the median unexplained amount is 62 % of costs;
    - in the reference set, 915338534/2023 and 936252710/2024 have personnel costs in the millions read as empty.
  - **The rule:**
    - An empty cost line lies in [0, U], where U is `sum_driftskostnad` minus the cost lines that were read.
    - If the whole interval lies in one band, the band is known; otherwise the category is unknown.
    - A negative U gives no fingerprint.
  - **When an unknown category decides the type,** the company gets no type and is not excluded at stage 4. It is counted as undetermined, not `annet`.
  - **Empty balance lines** get a tighter bound than total assets. Meinich decided this at approval; the question came from the review session.
    - Bounds:
      - Intangibles and fixed assets lie in [0, `sum_anleggsmidler` − whichever of the two were read].
      - `varer` lies in [0, `sum_omloepsmidler` − whichever of {`varer`, `kundefordringer`, `bankinnskudd`} were read].
      - Both subtotals come from `key_figures`, the filing the document belongs to.
    - A NULL subtotal is not 0. The bound is then the column's `sum_eiendeler` minus every asset line that was read.
    - A negative remainder gives no fingerprint.
    - The subtotals are used only as upper bounds, never subtracted from anything.
    - Measured by the review session: of 431 columns with an empty intangibles line, 330 fall under 5 % with `sum_anleggsmidler`, against 165 with `sum_eiendeler`.
  - **Before review,** the local data is measured as totals only: how many companies get a type, how many per type, and how many are undetermined. If the undetermined share is high, propose a separate story to read the cost lines, like 2.3b.
  - **No fingerprint is shown for an orgnr in the labelled set** (`drawn.json`), in output, in chat or in a test (Meinich).
- **D3, spread from the local 2.1b set (Q3a), computed by the D2 rule.**
  - The test asserts that in each band with n ≥ 10, the interquartile range of the share is ≥ 2 percentage points; a band below n 10 is reported only.
  - The test and its threshold are committed before the script runs.
  - The committed output holds aggregates only.
  - If a band fails, stop and show Meinich the figures. Nothing is dropped automatically.
- **D4, the live run, after review.**
  - Ask for one yes before `pnpm seed`, with the dump checked against the database.
  - Then:
    1. `pnpm seed`;
    2. step 2;
    3. `pnpm seed:export`, committed on its own;
    4. restore `.local/document-run-2.4/` and confirm the row counts;
    5. step 2 again, then the spread script.
  - Stop at any deviation.
- **D5, the spec is kept whole** (about 2,600 tokens).

## Boundaries & Constraints

**Always:**
- **One engine (AD-1).**
  - Every share, band, interval, category, type and digest is computed in `src/engine`. Shares are exact `Decimal`s, and band edges are never compared as floats.
  - Inputs come only through `documentFigures`.
- **Which column.**
  - A fingerprint is built from the `current` column of its filing year, and only when that column is `reconciled`.
  - Stage 4 compares the subject's fingerprint for its benchmark year with each candidate's fingerprint for the same year.
- **The ban on selecting by benchmarked measures.**
  - Shares reach selection only as band ids.
  - No stage-1–5 input type carries a margin, a return, a productivity figure, total assets or an employee count. `test/engine/peers.test.ts:298-313` is extended, not weakened.
- **Step 2.**
  - It runs as `derive` through `DERIVE_DATABASE_URL`, and runs no DDL.
  - It rebuilds every fingerprint in one transaction: TRUNCATE, then INSERT.
  - Grants:
    - `derive`: SELECT on `register.document_column`, `register.document` and `register.key_figures` (for the D2 subtotals, joined through `document.brreg_id`); SELECT, INSERT and TRUNCATE on `register.fingerprint`; nothing else.
    - `loader`: SELECT, INSERT and TRUNCATE on the new table.
  - Every skip (not reconciled, no revenue, negative unexplained) and every undetermined type is counted and printed. An input it cannot read makes it exit 1.
- **The table.**
  - `register.fingerprint` references its document column `ON DELETE CASCADE ON UPDATE CASCADE`.
  - Migration CHECKs mirror every category's value set.
- **No exclusion on a missing signal.**
  - A candidate with no fingerprint, or with no type, stays in the group.
  - A subject with neither leaves stage 4's count equal to stage 3's.

**Never:**
- Python computes a category.
- Step 2 deletes anywhere, or runs in a request.
- Comparability is loosened.
- The stage 1–3 `pool` changes. `ekskl`, `pnpm ingest:document-set` and the 5.1 frame all read it.
- `pnpm seed` runs, or the local 2.1b rows are removed, without D4's yes.
- Band edges, the rule or the threshold change after the shares have been seen.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails if the guard is deleted |
|---|---|---|---|
| Three kinds | fixtures: a reseller, a product company and a consultancy, all 62.100 | three different types | `test/engine/fingerprint.test.ts` "a reseller, a product company and a consultancy derive three types" |
| Band edge | a share exactly on an edge | the upper band | `fingerprint.test.ts` "band edges are inclusive below" |
| Empty line, one band | `lonnskostnad` empty, U/revenue < 30 % | band known: low | `fingerprint.test.ts` "an empty line whose interval fits one band is known" |
| Empty line, spanning | `lonnskostnad` empty, U spans bands | band range low–high (unknown) | `fingerprint.test.ts` "an empty line spanning bands is unknown" |
| Balance bound | an empty intangibles line or `varer`, with the subtotal present; with the subtotal NULL | bounded by `sum_anleggsmidler` or `sum_omloepsmidler`; NULL falls back to `sum_eiendeler`; a negative remainder gives no fingerprint | `fingerprint.test.ts` "anleggsmidler bounds an empty intangibles line", "omloepsmidler bounds empty varer", "a NULL subtotal falls back to sum eiendeler", "a negative balance remainder gives no fingerprint" |
| Negative U | read cost lines > `sum_driftskostnad` | no fingerprint, counted | `fingerprint.test.ts` "negative unexplained gives no fingerprint" |
| Undetermined | an unknown category decides the rule | type null; the candidate is kept | `fingerprint.test.ts` "an unknown that decides the rule gives no type"; `peers.test.ts` "an undetermined candidate is kept" |
| Unknown, not deciding | unknown personnel cost, cost of goods high | `forhandler` | `fingerprint.test.ts` "an unknown that does not decide still gives a type" |
| Not reconciled / no revenue | status ≠ reconciled; revenue null or ≤ 0 | no fingerprint | `fingerprint.test.ts` "unreconciled or no revenue: no fingerprint" |
| Subject without type | no fingerprint, or type null | `stage4 === stage3.legalForm`; group = pool | `test/engine/peers.test.ts` "a subject without a type leaves stage 4 equal to stage 3" |
| Other type | candidate type ≠ subject type | removed from `group`; `pool` unchanged | `peers.test.ts` "stage 4 removes another type and leaves the pool" |
| Digest | the committed seed's fingerprint rows | recomputed digest and categories equal | `test/fingerprint-seed.test.ts` |
| Withdrawn | company deleted on 410 | its fingerprints gone | `ingest/tests/test_run_record.py::test_gone_unit_is_deleted_everywhere` (seeds a fingerprint row first) |
| Licence gate | `docs/licence-gate.json` absent / closed / open | allow-listed only / allow-listed only / all; allow-listed always kept | `test/db/seed.test.ts` (three cases) |
| Grants | every relation in `register` | derive's exact ACL | `test/db/grants.test.ts` |
| Spread | the committed spread output | each band with n ≥ 10 has IQR ≥ 2 pp; a missing file fails, never skips (Meinich) | `test/fingerprint-spread.test.ts` |

</frozen-after-approval>

## Code Map

- **`src/engine/fingerprint.ts` (new).**
  - `BUSINESS_TYPES` is the shared set, which 2.6 reuses.
  - `Band = 'low' | 'mid' | 'high'`.
  - `Fingerprint`:
    - each band field is a `BandRange {lo, hi}`, known when `lo === hi`;
    - `inventory` and `capitalisedIntangibles` are `boolean | null`, where null is unknown.
  - `fingerprintOf(figures: DocumentFigures)` returns `{kind:'fingerprint', fingerprint, inputs}` or `{kind:'skip', reason}`.
  - `businessType(fp): BusinessType | null` runs the rule over every combination of the possible values and returns a type only if all combinations agree.
  - It imports only `decimal.ts`, `document-inputs.ts` and `inputs.ts`.
  - **Intervals:**
    - Cost lines: U = `sumDriftskostnad` − Σ read lines of {`varekostnad`, `lonnskostnad`, `avskrivninger`, `nedskrivninger`, `annenDriftskostnad`}. Empty `sumDriftskostnad` gives an unbounded U.
    - Balance lines follow D2. `fingerprintOf` takes the two API subtotals (`sum_anleggsmidler_ore` and `sum_omloepsmidler_ore`, parsed with `parseOre`) beside the figures, and they enter the digest.
- **`src/engine/digest.ts` (new).**
  - The one digest function: sha256 over canonical JSON (sorted keys, bigint as a decimal string), using `node:crypto`.
  - No `'use client'` module may import it; this is added to the ESLint ban.
- **`src/engine/peers.ts`.**
  - `SubjectFiling` and `CandidateFiling` get `fingerprint: Fingerprint | null`.
  - `FunnelCounts` gets `stage4: { businessModel }`.
  - `PeerGroup` gets `group`: the pool after stage 4, in pool order.
  - `pool` (:214) stays stages 1–3.
  - The header comment (:16) changes.
- **`src/server/analysis.ts`.**
  - `SUBJECT_SQL` (:43) and `CANDIDATES_SQL` (:191) left-join `register.fingerprint` on (orgnr, filing_year).
  - Extend `CandidateRow` and `toCandidate`; the categories are parsed by one validator in the engine (an unknown value throws).
- **`src/components/analysis/analysis-page.tsx:80-96`.**
  - The aggregates use `withoutExcluded(group.group, ekskl)`.
  - `isCandidate` stays on `pool`.
- **`scripts/document-set-compute.ts:40`, `e2e/analysis.spec.ts:148` and `test/db/peers.test.ts`.** These pass or read the new field; their pools are unchanged.
- **`scripts/derive.ts` (new; `pnpm derive`).**
  - It reads every current `document_column` row and computes the fingerprints with the engine.
  - It truncates and inserts in one transaction.
  - It prints counts of written, skipped by reason, undetermined, and each type. These are the D2 measurement.
  - The dataset tag is copied from the column.
- **`supabase/migrations/20261101120000_fingerprint.sql` (new).**
  - `register.fingerprint(orgnr, filing_year, …)`, with PK (orgnr, filing_year). As first built it had `role CHECK = 'current'` and FK (orgnr, filing_year, role) → `document_column`; `20261101130000_fingerprint_references_company.sql` (Spec Change Log, review pass 1) drops both and references `register.company (orgnr)` ON DELETE CASCADE ON UPDATE CASCADE.
- **`scripts/run-ingest.ts`** (Spec Change Log, review pass 1): runs `scripts/derive.ts` after the step-1 container, after plain, `--documents` and `--reread`, never after `--companies-only`; step 1's non-zero code is kept, and a derive failure exits non-zero.
  - The band columns are `*_lo` and `*_hi` text, CHECK in the set, with lo ≤ hi.
  - `inventory` and `capitalised_intangibles` are nullable booleans.
  - `input_digest char(64)` and `dataset` CHECK in (demo, full).
  - The grants above.
- **`scripts/seed-format.ts:41-75`.**
  - `SEED_TABLES` gets `fingerprint` after `document_column`.
  - A gate reader for `docs/licence-gate.json` (`{open, assessment, date}`): absent or unreadable is closed, and stderr says so.
- **`scripts/seed-export.ts:137,173`.** It filters fingerprint rows to the allow-list unless the gate is open.
- **`scripts/fingerprint-spread.ts` (new; `pnpm analysis:spread`).**
  - It runs as `reader` and takes the newest fingerprinted year per company.
  - It writes `analysis/output/fingerprint-spread-62100.{json,md}`: aggregates only, n and IQR per band, counting only shares that are read (a point, not an interval).
- **Tests:**
  - `test/db/grants.test.ts` (:401-416, :504-548);
  - `ingest/tests/test_run_record.py:146-148`;
  - `test/db/seed.test.ts:107` (counts and digests after the re-export).

## Tasks & Acceptance

**Execution** (one commit per bullet or smaller; branch `story/2.5-fingerprint-stage-4`):
- [x] `fingerprint.ts`, `digest.ts` and their tests, plus `test/fingerprint-spread.test.ts` with its threshold, committed before any data is read (D1, D3).
- [x] `peers.ts` stage 4, with the `peers.test.ts` cases and the extended selection-ban test.
- [x] The migration and the grants and run-record tests. Apply with `pnpm exec supabase migration up` only.
- [x] `scripts/derive.ts` and `pnpm derive`. Run it locally and show Meinich the totals (D2) before review.
- [x] `analysis.ts` and `analysis-page.tsx`; the e2e and DB peers tests pass.
- [x] The seed-export gate, its tests and `test/fingerprint-seed.test.ts`.
- [x] `scripts/fingerprint-spread.ts`. It runs in D4 step 5.
- [x] After review, D4.
- [x] Docs:
  - the technical note: "Rules fixed by the stories" and AD-2;
  - `AGENTS.md`;
  - the README (`pnpm derive`, the seed sequence);
  - `docs/ai-log.md`: the banding and selection risks, each with its test;
  - the session file, `sprint-status.yaml`.

**Acceptance Criteria:**
- Given the seed loaded in CI, when `pnpm seed:export` reruns, then nothing changes, `fingerprint.csv` included.
- Given the PR, then it states what could go wrong with banding and with selection, and that a product company which expenses its development becomes `konsulent`; `docs/ai-log.md` names the test behind each claim.

## Implementation Notes

Implementation subagent, 2026-11-01. Commits `b60d71b` (engine and spread test), `86090e0` (stage 4), `47f63bd` (migration), `aa38b13` (derive), `47e8b5e` and `054b762` (request path), `97d461e` (gate and seed test), `13d6c22` and `375d199` (spread script; the second reads the industries from `seed/coverage.json`, since `test/no-industry-literal.test.ts` forbids the literal in code), then the docs commit. D4 is not done.

**D2 measurement (local 2.1b rows, totals only), rerun after the Spec Change Log amendment (2026-11-01).** `pnpm derive`: 2 043 current columns read, 1 876 fingerprints written. Skipped: not reconciled 123, no revenue 11, negative unexplained 21, negative balance remainder 12. Per fingerprint: produkt 229, konsulent 221, forhandler 446, annet 43, undetermined 937. Per company at its newest fingerprinted year (421): produkt 58, konsulent 49, forhandler 105, annet 13, undetermined 196 (47 %). Before the amendment: 1 812 fingerprints; negative unexplained 84 (63 of them within 5 kr), negative balance remainder 13; per company produkt 58, konsulent 48, forhandler 105, annet 12, undetermined 198. The undetermined share is high, so a separate story to read the cost lines is proposed in `deferred-work.md`.

**Choices the spec left open, made here:**
- A negative U (below the −5 kr rounding, Spec Change Log) is checked whenever `sum_driftskostnad` is stated, also with every cost line read (the matrix: "read cost lines > `sum_driftskostnad`"). A balance bound is computed, and its sign checked, only for an empty line it bounds; with every asset line read, the subtotals are not read (`fingerprint.test.ts`, "uses a subtotal only to bound an empty line").
- A NULL subtotal with an empty `sum_eiendeler` leaves the line unbounded. A reconciled column always has `sum_eiendeler` (c3 or c5 needs it), so this does not occur in data.
- A negative read cost line is in the low band; `varer` ≤ 0 is no inventory.
- The skip reasons are `not_reconciled`, `no_revenue`, `negative_unexplained` and `negative_balance_remainder`.
- The digest covers the 13 document figures the fingerprint reads and the two subtotals, as `FingerprintInputs`. A bigint is written as its decimal string.
- The spread script runs for every industry in `seed/coverage.json` and names its files after the code (`fingerprint-spread-62100.*` today). The measure counts each company once, at its newest fingerprinted year, and only shares read as a point. `band-spread.ts` gives the IQR as a fraction and in percentage points.
- The view's `SubjectFiling` carries the fingerprint, and `funnelSubject` passes it on. `shownGroup`'s parameter is renamed `group`.
- The gate's three DB cases call `copyTable`, the function `exportSeed` uses for every table. A whole export cannot show the filter: a fingerprint of a company outside the allow-list needs its document column, which the export refuses first.
- `ingest/tests/conftest.py` gets an `owner_db` fixture: the migration role acting as `ingest`. It lets the 410 test seed a fingerprint that only `derive` and the loader may write, in the same transaction.
- The committed seed's expected fingerprint count, 85 of 97 current columns after the amendment (77 before it), was computed with the engine from the committed CSVs before the export. Before the amendment it was checked against a temporary export of the local allow-listed rows (77), and `test/fingerprint-seed.test.ts` passed on it.

**Review pass 1 (2026-11-01).** The amendment and patches 3, 4, 5, 7, 12, 13, 16 and 18 are in their own commits after `a11db33`; 6 and 27 are in `deferred-work.md`.
- The fingerprint references the company (new migration; the 2.5 migration is kept as committed). `derive` no longer writes `role`.
- The gate's DB tests no longer store document rows, and a whole export with the gate open writes an unlisted fingerprint without its column. It deletes, in the rolled-back transaction, the document rows outside the allow-list that a local acceptance run leaves, since the export refuses those first.
- `scripts/run-ingest.ts` runs `scripts/derive.ts` with its own Node (`process.execPath`), what `pnpm derive` runs, so no shell or package-manager lookup is involved on Windows.
- `shownGroup(funnel, ekskl, filing)` takes the funnel result; `toSubject` and `SubjectRow` are exported for the DB test.

**Failing until D4 (expected):** the committed-seed tests (`test/seed-format.test.ts`, "passes every check"; `test/allow-list.test.ts`, "reads the committed seed files"; all of `test/db/seed.test.ts`), `test/fingerprint-seed.test.ts` (no `fingerprint.csv`), `test/fingerprint-spread.test.ts` (no output) and CI's seed load. The e2e specs read `seed/demo/fingerprint.csv` and pass once it exists. Locally they passed (116) against a header-only file and an emptied local fingerprint table, which `pnpm derive` restored afterwards.

## Spec Change Log

- **2026-11-01, Meinich (before review): a negative remainder down to −5 kr counts as 0.**
  - **The gap.** D2 says "A negative U gives no fingerprint", and the same holds for a negative balance remainder. That wording came from the review session's rule text. It left out the register's documented rounding (AGENTS.md, "Reconcile with two rules"): the register prints whole kroner rounded from øre, so a stated total can be a krone or two off its components.
  - **The amendment.**
    - A remainder (cost U or balance bound) in [−5 kr, 0) is taken as 0.
    - Below −5 kr, there is still no fingerprint.
    - The 5 kr is `within_document_bound_kr` in `ingest/config.toml`. The engine's copy of the value has a test that fails when the two differ, so there is no second free constant.
  - **The reason is the documented rounding, not the results.** The D2 measurement (63 of 84 negative-unexplained skips within 5 kr) is what brought the gap to light, not what decided it.
  - **Known-bad state avoided:** a company whose cost lines exactly explain the total, but whose rounding goes 1 kr the other way, gets no fingerprint.
  - **KEEP:** D1's thresholds and rule, the interval rule, and the decision that an unknown that decides the type gives no type.
- **2026-11-01, Meinich (review pass 1, triage 1, 2, 20 and 21; option (a)): the fingerprint references the company, and step 1 is followed by a rebuild.** The code is amended where it stands, not reverted.
  - **The defect.**
    - The frozen Boundaries had `register.fingerprint` reference its document column. With the gate open, a fingerprint of a company outside the allow-list then needs that company's document column. `seed:export` refuses that column, and the loader would fail the FK, so the matrix row "open → all rows" could never hold.
    - The technical note asks for fingerprints "never the document figures behind them". `epics.md:1469` already says the fingerprint table references the company. The spec drifted from that and is corrected back to it.
    - Separately, a fingerprint outlived an in-place step-1 change to its column (`--documents` re-reconciling, `--reread`).
  - **The amendment.**
    - `register.fingerprint` references `register.company (orgnr) ON DELETE CASCADE ON UPDATE CASCADE`. The `role` column and the FK to `document_column` go. The 410 cascade test still covers the table.
    - `scripts/run-ingest.ts` runs `pnpm derive` after the step-1 container ends, never from Python (AD-2). It does so after a plain run (which refreshes the API subtotals derive reads), `--documents` and `--reread`, but not after `--companies-only`.
    - Derive also runs when step 1 exits 1, and step 1's exit code is kept.
    - A failing derive is visible (named on stderr) and makes the runner exit non-zero. Its single transaction leaves the old rows standing.
    - Each of these behaviours has a test that fails if the call is removed: run after each of the three modes; not run after `--companies-only`; run after an exit-1 step 1 with the code kept; a derive failure gives non-zero.
    - A killed run leaves the fingerprints stale until the next derive. This goes to `deferred-work.md`, and the README says to run `pnpm derive` after restoring from a dump.
  - **With the gate open,** the seed holds no figures behind the fingerprints of companies outside the allow-list. `test/fingerprint-seed.test.ts` therefore recomputes the allow-listed rows. It counts the others and names their count in the test output, rather than skipping them silently.
  - **Known-bad states avoided:**
    - an open gate that cannot export what it opens for;
    - stage 4 deciding on categories from a column that has since failed, or has been re-read.
  - **KEEP:** everything else in the code and tests as it stands, including the band ranges, the request-path type derivation, `pool`/`group`, the gate reader, the −5 kr rule and the grants.

## Review Triage Log

Pass 1 (2026-11-01). Layers: blind hunter (BH), edge-case hunter (EC), verification gap (VG), all review subagents of the BMAD session.

| # | Finding (layer) | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | A fingerprint outlives an in-place change to its column. `--documents` re-reconciles and can flip the status, and `--reread` replaces figures; the request path joins the fingerprint without checking the column (EC, BH) | medium | The FK cascades only on a key change. `SUBJECT_SQL` and `CANDIDATES_SQL` left-join `register.fingerprint` alone. A stale row decides stage 4 until the next `pnpm derive`. | intent_gap (with 2) |
| 2 | An open licence gate cannot export an unlisted fingerprint (EC, BH, VG other) | medium | The frozen FK to `document_column` means an unlisted fingerprint needs an unlisted column. `refuseUnlistedDocumentFigures` refuses the export, and the loader would fail the FK. The matrix row "open → all rows" cannot hold, which contradicts the technical note's "fingerprint results for every 62.100 candidate … never the document figures behind them". | intent_gap |
| 3 | The page's switch from `pool` to `group` is observed by no test; e2e is circular and demo A has no fingerprint (VG, BH) | medium | Reverting `analysis-page.tsx:108` to `.pool` fails nothing: A has no seed document, so `group === pool`. | patch |
| 4 | The subject read's fingerprint join is verified only as source text (VG) | medium | No DB test stores a subject fingerprint and reads it through `SUBJECT_SQL`/`toSubject`. A wrong-year join, or a `toSubject` that drops the fingerprint, passes. | patch |
| 5 | `DERIVE_SQL`'s output is checked only for internal consistency (VG) | medium | `test/db/derive.test.ts` asserts counts only. Swapping the subtotal aliases passes. | patch |
| 6 | `SPREAD_SQL` is never executed by a test (VG) | medium | Its only callers are `main` and the definition. It runs once, in D4 step 5, and its output is reviewed by hand. | defer |
| 7 | The `fingerprintWhere` comment says demo B shows separation with the gate closed (VG other, BH) | low | B (and A) is not on the allow-list and has no seed document. | patch |
| 8 | `ekskl` can name a company stage 4 removed: accepted, invisible, no notice (EC, BH) | low | It follows the frozen rule that `ekskl` reads `pool`, and the UI never offers such a company. Only a hand-edited URL reaches it, and a notice would add a branch. | reject |
| 9 | Stage 4 removing every candidate leaves `emptyReason` null (EC) | low | The empty group shows the below-floor state, as any empty group does. A new reason would add surface; the counts come in 2.7. | reject |
| 10 | `TRUNCATE` holds ACCESS EXCLUSIVE, blocking page reads during `pnpm derive` (EC, BH) | low | Real, but locally it lasts seconds (about 2 000 rows). A staging swap would add complexity. Noted in the PR for stage 2. | reject |
| 11 | The spread script exits 1 after writing earlier industries' files (EC, BH) | low | Only one industry is covered. | reject |
| 12 | `test/fingerprint-spread.test.ts` hard-codes 62.100 (EC, BH) | medium | The intent is that the test runs again for each industry stage 3 adds. A second `coverage.json` industry would go unchecked. | patch |
| 13 | The spread test passes when every band has n < 10 (BH) | medium | Every band with n < 10 returns early, and nothing asserts that any band was measured. A seed-only run passes everything (the L2 pattern). | patch |
| 14 | A negative read cost line lands in `low` and widens U (EC) | low | This is the documented choice in the Implementation Notes, and the arithmetic matches the statement (total = sum of lines). | reject |
| 15 | `readShare` counts a negative share in the low band's IQR (EC) | low | It is a read value of the line; dropping it would bias the measure the other way. | reject |
| 16 | The ESLint digest ban misses `digest.js` import specifiers (EC) | low | The regex `(?:\.ts)?$` (eslint.config.mjs:36) does not match `.js`. A direct regex correction fixes it. | patch |
| 17 | `readLicenceGate` accepts an empty assessment and an impossible date (EC, BH) | low | 5.4 writes the file by hand under review, and the fix would add guards. | reject |
| 18 | `gateWith(null)` can read a file a previous case left (EC) | low | Today it is order-dependent only; the direct fix is an `rmSync` when the content is null. | patch |
| 19 | The 410 test now runs through `owner_db`, not ingest's own login (EC) | low | `owner_db` acts as `ingest` by role, so ingest's privileges still apply. Only the login's connection settings differ, and the deletion does not depend on them. | reject |
| 20 | Claim check: "open gate exports every row" (EC) | medium | Same defect as 2. | intent_gap (with 2) |
| 21 | Claim check: stage 4 reads rows unconditionally (EC) | medium | Same defect as 1. | intent_gap (with 1) |
| 22 | No engine version is recorded on a fingerprint row (BH) | low | AD-13 rebuilds every row on every run, and CI recomputes the seed's rows. A version column would be new surface. | reject |
| 23 | Stage 4 passes through silently when the subject has no type (BH) | low | This is the frozen rule ("a missing signal never excludes"). It is visible in `counts.stage4`, which 2.7 shows. | reject |
| 24 | D2's per-company count uses the newest fingerprinted year, not the benchmark year (BH) | low | True of the reported 47 %. Reported to Meinich with the caveat; it changes no code. | reject |
| 25 | The grants test never tries ingest DELETE on `register.fingerprint` (BH) | false | `test/db/grants.test.ts:630-648` checks DELETE for every Peerless role on every register relation. | reject |
| 26 | D4's seed and spread output are not in the branch, so CI is red (BH) | false | Planned: D4 lands in this PR before merge, and the spec's "Failing until D4" and the PR say so. | reject |
| 27 | Step 2 writes no run record (BH) | low | Story 2.6 adds `run.step2` (epic context). Until then, derive runs go unrecorded. | defer |
| 28 | Step-2 scripts import `setting` from step 1's runner (BH) | low | The coupling is only cosmetic; moving it is a refactor. | reject |
| 29 | The spread report does not say how many shares were dropped as intervals (BH) | low | It would add output fields; the D2 totals already show the empty-line counts. | reject |

## Design Notes

**Bands are stored as ranges, and the type is derived in the request.** An empty line gives an interval, which can span bands. Storing `lo` and `hi` keeps that exact, and `businessType` enumerates the possible values. The type is therefore never stored separately from the categories it came from, and the CI recompute covers both.

**What could go wrong (for the PR and the AI log):**
- **A cost line misread but still reconciling.** A misread that keeps its column reconciling moves a company into another type and out of the group. D2's interval only catches empty lines. 5.2 measures the rest.
- **Many undetermined companies.** Stage 4 then removes little. That is the honest outcome, and D2's measurement shows it.
- **A share reaching selection as a value.** It would let selection read a benchmarked measure; the compile-time key test guards against it.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: all pass
- `pnpm test:db && pnpm test:ingest` -- expected: pass after `supabase migration up`; the seed-dependent cases wait for D4
- `pnpm build && pnpm test:e2e` -- expected: pass
- After D4: CI green, with the seed loaded twice and the export unchanged
