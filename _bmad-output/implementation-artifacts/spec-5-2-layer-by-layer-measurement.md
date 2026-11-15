---
title: 'Story 5.2: Layer-by-layer measurement'
type: 'feature'
created: '2026-11-15'
status: 'done'
baseline_commit: '3ce98d0861ac44dfd14c388ae73634b5bf5717d4'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/analysis/labelled-set/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** v1's main result is missing (issue #64; FR-3, FR-13, NFR23, NFR24, NFR32). Nothing yet says how much each funnel layer adds against the labelled set, whether the model earns stage 5, or whether either banded share earns its place in the fingerprint.

**Approach:** Add one read-only script, `pnpm analysis:layers` (`scripts/layer-measurement.ts`). It assembles each labelled subject's group through `src/engine/peers.ts` itself, scores every labelled pair per layer, and applies the stage-5 rule as fixed in the PRD (§9). It writes one dated report to `analysis/output/`, and `seed/coverage.json` then points at that report.

## Definitions (fixed before the first run on the real labels)

- **Labels.** The measure is the 900 pairs in `drawn.json`:
  - The 180 blind pairs: `labels-blind.csv`, labelled by Meinich.
  - The 720 round-2 pairs: computed from `labels-revenue-model.csv` by the README rule. A ChatGPT model filled in the letters, and Meinich approved them; nobody else labelled.
  
  Round 1 (`labels.csv`, 720 pairs) is reported alongside as the stricter reading and decides nothing. `usikker` is left out and counted. A sensitivity analysis counts it as `ja` and as `nei`.
- **Included.** Each subject is assembled as the app does: as `reader`, through `loadSubject` → `funnelSubject` → `loadCandidates` → `assemblePeerGroup(…, 0)`, the path `analysis/labelled-set/draw-compute.ts` uses. A candidate is included by:
  - **L1, industry code and size:** it is in `pool`. Every labelled candidate was drawn from the pool, so L1 includes every pair.
  - **L2, fingerprint:** the fingerprint signal is not `false`. A missing fingerprint, an undetermined type, or a subject with no type is `null`, and `null` is kept.
  - **L3, classification alone:** the text signal is not `false`. `uklart`, a missing row, and a subject with no type are `null`, and `null` is kept.
  - **L2+L3, the funnel:** it is in `group`.
  - **Flagged:** it is in `flagged`. Flagged pairs are reported apart from the rest of `group`.
  
  For L2 and L3, the counts behind each `null` are reported: no fingerprint row and why (document failed, refused, absent), undetermined, `uklart`, and a subject without a type.
- **Precision and recall.** Precision is `ja` / (`ja` + `nei`) among the included pairs. Recall is the included `ja` / all `ja`. Recall therefore counts within the stage 1–3 pool. Both are computed as exact decimals; percentage points are shown to one decimal through `src/engine/format.ts`.
- **SM-1b.** An industry-code-only baseline also includes every labelled pair, so on these pairs it equals L1 (the base rate). The report says this: the size band and stage 2 cannot be judged with this draw. SM-1b is the funnel against that base rate, a check and not a claim.
- **Cohorts.** Each table is split by the subject's `informative` flag in `drawn.json`, with each cohort's share. The blind pairs are also reported on their own.
- **Stage-5 rule.** On all 900 pairs, with `usikker` left out:
  - *fingerprint alone* is L2;
  - *fingerprint and text* is `group`.
  
  Stage 5 is kept if and only if precision rises by ≥ 3.0 pp and recall falls by ≤ 3.0 pp, compared exactly with both bounds inclusive. The report states the verdict and the differences, and the rule is never re-tuned.
- **Bands without** (Meinich, 2026-11-15, question 1). One category's band is widened to low–high in memory, in the subject's fingerprint and every candidate's, before `assemblePeerGroup` runs. This is done for `costOfGoods` and then for `personnelCost`. The rule stays the same, so a type that depended on the band becomes undetermined and is kept. The app, the stored fingerprints and `fingerprint.ts` are unchanged.
- **Band rule** (Meinich, 2026-11-15, question 2). The rule is applied to L2, the fingerprint layer, with and without the band; it is never applied to `group`, so the text cannot hide what the band does. It uses the stage-5 thresholds, fixed now and compared the same way: a band is recommended kept if L2 with it has ≥ 3.0 pp higher precision and ≤ 3.0 pp lower recall than L2 without it, and dropped otherwise. The rule gives a recommendation and Meinich decides, as FR-13 and the technical note say. If Meinich decides against it, the report says so and why. This PR corrects `epics.md` 5.2, which said the PR drops a failing band.
- **Round 1** (question 3). It gets the full layer table under the name "den strengere lesningen", and it decides nothing.
- **Additions** (question 4):
  - A labelled candidate that is not in today's pool is counted and reported, and it never drops out silently (0 expected).
  - A layer with no `ja` or `nei` pair has precision "ikke definert", never 0. The same holds for recall with no `ja`.
  - Every comparison against 3 pp is made with `src/engine/decimal.ts`, never with floats.

## Boundaries & Constraints

**Always:**
- **Totals only.** No classification, fingerprint or label is printed per orgnr or per row. A test fails if the report holds a nine-digit number from `drawn.json`.
- The report goes to `analysis/output/layer-measurement-62100.md`. It carries the date, the script, `pnpm analysis:layers` and the commit the script ran at, and it states no numeric target (NFR32).
- **Order of work.** The script and its tests on synthetic labels are committed before the first real run. A bug found after that run is fixed in a new commit, and both results are shown; no definition changes silently.
- The script refuses when the local database lacks the restored document dump (none of the 845 has a fingerprint), and says why.

**Never:**
- Run `pnpm classify` or any model.
- Change `src/engine/peers.ts`, `fingerprint.ts` or the stored fingerprints before Meinich has seen the result.
- Delete a dump, or push before Meinich says so.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected | Test that fails if the code is removed |
|---|---|---|---|
| Pair rule | letters p/p, p/k, i/p, u/p, u/i | ja, nei, nei, usikker, nei | `test/layer-measurement.test.ts` "pair label rule" |
| Layers | synthetic funnel results and labels | per-layer precision and recall by hand | "layer metrics on synthetic labels" |
| Null signals | candidate with no fingerprint, or uklart | kept in L2 or L3, counted under its cause | "a null signal is kept and counted" |
| usikker | synthetic usikker pairs | left out; sensitivity as ja and as nei | "usikker left out, and both sensitivities" |
| Rule bounds | Δp = +3.0, Δr = −3.0 / +2.9 / −3.1 | kept / not / not | "stage-5 rule is inclusive at 3 pp" |
| Band widened | a fingerprint with costOfGoods mid | widened to low–high, others untouched | "widens one band only" |
| Privacy | report text | no nine-digit number from `drawn.json` | "the report names no labelled company" |
| No dump | 0 of 845 with a fingerprint | refuses, exit 1 | "refuses without the document dump" |
| Not in pool | a labelled candidate absent from today's pool | counted and reported, never silently dropped | "a labelled candidate outside the pool is counted" |
| No ja or nei | a layer whose included pairs are all usikker | precision "ikke definert", never 0 | "precision is undefined without ja or nei" |
| Band rule | synthetic L2 with/without a band at the bounds | recommended kept / dropped as the stage-5 bounds | "band rule on L2 at 3 pp" |
| Decimal | Δ computed from counts | exact Decimal comparison | "rule bounds compare in Decimal" |
| Coverage | measured entry with report and sha256 | `pnpm seed` accepts it | existing `test/seed-format.test.ts` |

</frozen-after-approval>


## Code Map

- `src/engine/peers.ts:271-281,364-373` -- `signals`, `afterStage4` (L2 is `fingerprint !== false` alone), `group`, `flagged`. Reused, not changed.
- `analysis/labelled-set/draw-compute.ts:33-47`, `scripts/document-set-compute.ts:29-42` -- the reader path through `loadSubject`/`loadCandidates`. It needs Vite's module runner (`server-only`).
- `analysis/labelled-set/draw.ts` -- file paths and `DrawnSubject`. `scripts/ocr-sm2-compare.ts` `parseSemicolonCsv` reads the BOM'd semicolon CSVs.
- `src/engine/fingerprint.ts:105-113,339-367` -- `Fingerprint`, the rule, `businessType`.
- `scripts/seed-format.ts:158-232` -- the coverage validation, which already accepts `report`/`sha256`.
- `scripts/ocr-sm2.ts:909-940` -- the pattern for a dated report header.
- `test/fingerprint-spread.test.ts` -- the pattern for a missing-output check.
- `deferred-work.md:133-136` -- names 5.2. Closed with the counts at the checkpoint: 784 of 845 companies have a fingerprint, 776 of them for 2025.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/layer-measurement.ts` and `scripts/layer-measurement-compute.ts`, `package.json` `analysis:layers` -- the script.
- [ ] `test/layer-measurement.test.ts` -- the matrix rows on synthetic labels. Commit both before the real run.
- [ ] Run on the real labels and write the report. The BMAD session does this, not the implementation agent; the agent stops after the script and tests are committed and never runs the script on the real labels. **Then stop and show Meinich.**
- [ ] `epics.md` 5.2 (band decision is Meinich's, per FR-13), `seed/coverage.json`, PRD §10 (an "SM-1, measured" block), `deferred-work.md`, `docs/ai-log.md` -- after Meinich has seen the result. Plus whichever of the stage-5 or band follow-ups the result triggers, in later commits.

**Acceptance Criteria:**
- Given the report, when CI runs `pnpm seed`, then the measured entry with its sha256 loads.
- Given the PR, then it has "Planning documents:" and states what could go wrong.

## Spec Change Log

- 2026-11-15, Meinich, after the first real run (report version 1, `4f26803`):
  - **The run.** Report version 1 showed the stage-5 precision difference as +3,0 pp. The exact value is 2,967 pp. Version 2 (`8a0e875`) shows the deciding differences to three decimals and as fractions; this is display, not a definition. It also adds the rules on the blind pairs alone and the verdicts with usikker as ja and as nei, which change nothing.
  - **Stage 5 is not kept**, by the rule fixed before the run. The text signal is off in v1: `V1_TEXT_SIGNAL = false`, an engine option the measurement turns on so that it keeps measuring stage 5 as built.
  - **The bands.** Both are recommended dropped, but widening either one leaves almost every type undetermined, so the test cannot tell a band from the fingerprint. Meinich followed the recommendation in the form that changes the group least: `V1_FINGERPRINT_SIGNAL = false`, with no migration, and `fingerprint.ts`, the bands, the stored fingerprints and derive unchanged. He decided from the rule and the blind pairs (L2 25,2 % against L1 25,1 % precision, −35,6 pp recall). v1's group is the stage 1–3 pool.
  - **The Peers tab.** Meinich approved the copy:
    - three funnel stages and `peers.funnel.notApplied`
    - no «Grunnlag for treff» column, no «Merknad» column and no ✦ legend
    - «Hvorfor med» shows the base sentence only
  - **Upstream docs.** The FRs state how v1 works, without history (retro feedback 4.1), and the history goes in the PRD's `.memlog.md`. A new §11 question asks for stages 4 and 5 to be measured again in stage 2 with a second labeller. The brief is corrected in place, and the addendum gets a dated note.
  - **Known-bad states avoided:** a +3,0 pp shown beside "not kept"; a fingerprint layer that selects without raising precision; Peers copy that describes a stage that does not run.
  - **KEEP:** the frozen definitions; reports 1 and 2 as committed; the measurement turning both signals on.

- 2026-11-15, Meinich, review pass 1 (triage rows 1–2). The order of the decisions:
  1. **Stage 5 off, by the rule** fixed before the run (L2 against `group`: +2,967 pp precision, +1,422 pp recall).
  2. **Stage 4 off, by Meinich's decision** from the band rule and the blind pairs (L2 25,2 % against L1 25,1 % precision, −35,6 pp recall).
  3. **Text against L1 reported, not used.** It would have passed the same bounds (+3,919 pp precision, −2,370 pp recall). The comparison was not fixed before the run, and the gain lies within the noise. The decision follows the fixed rule, and question 26 fixes text against L1 before the next measurement.
  
  The `peers.funnel.notApplied` copy stays as approved. "Ikke klart bedre" holds against L1 too, and the nuance belongs in the report and on «Slik fungerer Peerless». The workflow's default for an intent gap is to revert the code; that was not done, because the code already matches the decision. Known-bad state avoided: switching the text back on by a comparison chosen after the result. KEEP: both signals off; the copy as approved.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db` -- green.
- `pnpm build && pnpm test:e2e` (one worker) -- green.
- After the last `pnpm seed`: `pnpm restore:documents` -- 2 785 / 5 556 / 2 537 / 10 371.

## Review Triage Log

Review pass 1 (2026-11-15), on the diff from the baseline to `82a1696`. Layers: Blind Hunter (BH), Edge Case Hunter (ECH), Verification Gap (VG).

| # | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | BH: once stage 4 is off, the stage-5 rule's baseline (L2) no longer is v1's. Text over L1 would pass the same bounds | high | L3 against L1: +3,919 pp precision (206/508 − 211/576), −2,370 pp recall. The fixed rule compared L2 with `group`, and a comparison against L1 was not fixed before the run | intent_gap → Meinich (a): decision kept, reported (change log) |
| 2 | BH: `peers.funnel.notApplied` says neither layer gave "klart bedre treff" | medium | True by the fixed rule, contestable for the classification against L1 (row 1) | intent_gap → Meinich: copy kept as approved; nuance in the report |
| 3 | BH: the band decision cites the blind figures, while the rules are decided on all pairs | low | Meinich's stated basis was the rule (all pairs) and the blind pairs; the text names only the blind figures | patch (name both) |
| 4 | BH: `bandDecision` prints Meinich's decision whatever the computed verdicts | medium | A rerun with other verdicts would still state the decision | patch (print it only when the verdicts are the ones it was made on; otherwise say the decision is pending) |
| 5 | BH: report says "L2+L3 is `group`, the funnel as the app runs it" | low | The app now runs `V1_FUNNEL`, whose group is L1 | patch |
| 6 | BH: the report does not give subject-level signal coverage | medium | 20 of 30 subjects have no text type and about 11 no fingerprint type; the verdicts rest on few subjects | patch |
| 7 | BH: no statement that the stage-5 verdict sits within noise | medium | +2,967 against 3,000 pp, about 400 pairs in 30 clustered subjects | patch (a sentence, no numeric target) |
| 8 | BH: round 1 has no verdicts, and the gap in base rate between the readings is not discussed | low | Base rate 4,6 % against 36,6 % | patch (informational verdicts and one sentence) |
| 9 | BH, ECH: the funnel, `peerRows` and `inclusionReason` hard-code v1 apart from `V1_FUNNEL` | medium | Turning a signal on would leave the funnel note and the reasons wrong | patch (derive them from `V1_FUNNEL`, with a test that the note shows only when both are off) |
| 10 | BH, ECH: `AiMark`, `Mark` and the unrendered nb.json keys are dead code in v1 | medium | Meinich approved keeping `AiMark`/`peers.ai` for Epic 3; the stage-4/5, basis and flag keys have no owner | patch (deferred-work entries with owners; `peer-funnel.test.ts`'s `toBeTruthy` on unused keys removed) |
| 11 | BH: the signal-independent `inclusionReason` tests run only with the signal on | low | The refusals and rounding never run on the v1 default | patch |
| 12 | BH, ECH, VG: the dirty-tree refusal is untested; `CLEAN_PATHS` omits `seed/coverage.json`; the database state is not recorded | medium | Every test injects `commit`; deleting the check fails nothing | patch (test it; add the path; record the classification model, prompt hashes and fingerprint count read) |
| 13 | BH: "stage 2" is used in two senses | low | Funnel stage 2 against project stage 2 | patch |
| 14 | ECH: a rerun changes the bytes, and `coverage.json`'s sha256 goes stale | low | `pnpm seed` refuses loudly on a mismatch (AD-16) | patch (the script prints the new sha256) |
| 15 | ECH: an unknown document status is counted as not reconciled | medium | Silent fallback (AGENTS.md) | patch (throw) |
| 16 | VG: `FACTS_SQL` and `loadMeasurementData` run in no test | medium | Mocked in every test | patch (`test/db/` with synthetic rows in a rolled-back transaction) |
| 17 | VG: the e2e "v1 shows the whole pool" may not notice the as-built funnel | medium | Its subjects may lose no candidate as built | patch (a subject whose as-built group is smaller than its pool, or say none exists) |
| 18 | VG: a stale comment in `test/analysis/peer-rows.test.ts` | low | Refers to a `flagged` argument that no longer exists | patch |
| 19 | ECH: the ai-log entry is missing | false | Planned after the review (Tasks, item 4) | reject |
