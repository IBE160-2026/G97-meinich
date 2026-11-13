---
title: 'Story 2.6: Classification (stage 5)'
type: 'feature'
created: '2026-11-08'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/technical-note-architecture.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stage 5 does not exist, so FR-14's combination of fingerprint and text cannot run.

**Approach:** On the text fields Story 2.6a stores, a new step-2 command, `pnpm classify`, classifies them with `claude-haiku-5-5` through the Batch API into the shared `BUSINESS_TYPES`, gated on a printed cost plan and a spending cap. The funnel reads stored classifications only and applies the combination rule.

## Boundaries & Constraints

**Always:**
- No model call without Meinich's OK to that run's estimate; Meinich sets the key and runs every real run. `pnpm derive` and `pnpm ingest` never call the model.
- Blinding: no classification or fingerprint per orgnr for the 845 companies of `analysis/labelled-set/document-run.json` in the terminal, spec, PR or ai-log; totals only. `labels.csv` and `labels-blind.csv` are never opened. Prompt, categories, examples and fixtures come from other companies.
- The category set is `BUSINESS_TYPES`; the response schema is generated from it and has no free-text field. An answer outside it is `failed`, never coerced.
- Each row stores model id, prompt hash and text digest. `run.step2` is written only by `derive`.
- A fresh clone runs without a key on stored output (AD-7); the key is read only by step 2 (AD-19) and never logged or committed.
- No dump is deleted; `.local/document-run-2.5d/` stays the restore source after a seed.

**Decisions (Meinich, 2026-11-08):**
- Abstention: the schema is the four `BUSINESS_TYPES` plus `uklart`. `uklart` is not a fifth type: `BUSINESS_TYPES` stands, the row is `classified` with no type (like the fingerprint's null), is counted on its own in `run.step2`, and its share goes into Story 5.2. The epic's AC is corrected in this PR.
- AS only. The `seed:export` refusal covers AS companies in a covered industry; a non-AS company is never `pending`. "All 62.100" becomes AS in FR-73, the technical note and the PRD, in this PR.
- Real runs: until the 720 pairs are labelled, the only one is the 300-company sample outside the labelled set, on its own OK and never in the seed. The full run comes after labelling, with the 845 like any other company. There is no `--include-labelled`.
- Seed: after the full run, every AS in 62.100, as FR-73 says; blinding is the only condition. The licence gate does not apply (NLOD text). This PR stays open until the full run and seed are done.
- Story 2.6a is split off with its own issue, epics story and PR, and lands first.
- One text once: where `aktivitet` and `vedtektsfestet_formaal` are identical (2 236 of the 10 327 AS with text, compared as stored), the request carries that text once, under `vedtektsfestet_formaal`, and leaves `aktivitet` out. Every cost plan builds on the requests as sent, so `pnpm classify --plan` counts it.

**Never:** a model call at request time; a classification in the seed before the labelling is finished; automatic reclassification on a changed prompt.

## I/O & Edge-Case Matrix

Every row names the test that fails if its code is removed.

| Scenario | Input / State | Expected | Test that fails without it |
|---|---|---|---|
| Fields sent | a company | only name, secondary codes, purpose, description in the request | `test/classify/request.test.ts` "sends only the four fields" |
| One text once | `aktivitet` equal to `vedtektsfestet_formaal` | the text appears once in the request, `aktivitet` left out; two different texts are both sent | `test/classify/request.test.ts` "sends an identical text once" |
| Schema from set | `BUSINESS_TYPES` | enum equals it; no string field without enum | `test/classify/request.test.ts` "schema is generated from BUSINESS_TYPES" |
| Outside the set | stubbed answer `"saas"` | `failed`, failure in the run record | `test/classify/run.test.ts` "answer outside the set is failed, not coerced" |
| Refusal, truncation, batch error | stubbed `refusal`, `max_tokens`, `errored` | `failed` with reason | `test/classify/run.test.ts` "refusal, truncation and errored are failed" |
| Unchanged text | digest, prompt hash and model match | no model call | `test/classify/run.test.ts` "unchanged text makes no model call" |
| Changed text | digest differs | reclassified | `test/classify/run.test.ts` "changed text is reclassified" |
| Changed prompt | other prompt hash | not sent; reported as stale with its count and cost; needs `--reclassify-stale` | `test/classify/run.test.ts` "a changed prompt is not reclassified without the flag" |
| Nothing to read | no codes, purpose or description | `no_text`, no call, stays eligible | `test/classify/run.test.ts` "no_text makes no call"; `test/engine/peers.test.ts` "an unclassified candidate stays through stage 5 (no_text, uklart)" |
| No key | key unset | `--plan` works; a real run refuses | `test/classify/run.test.ts` "a real run without a key refuses" |
| Over the cap | ceiling above `--max-usd` | nothing sent, exit 1 | `test/classify/run.test.ts` "refuses above the cap with nothing sent and the refusal in the run record" |
| Sample | labelled orgnr drawn | never in a sample | `test/classify/plan.test.ts` "a sample never holds a labelled orgnr" |
| Sample not seeded | rows from the sample run | not exported | `test/db/classification.test.ts` "sample rows are not exported" |
| Non-AS | a covered non-AS company | never `pending`, no refusal | `test/db/classification.test.ts` "non-AS never blocks the export" |
| Abstention | stubbed `uklart` | `classified`, no type, counted apart | `test/classify/run.test.ts` "uklart is stored without a type and counted apart" |
| Seed refuses | a `failed` or `pending` row | export refuses | `test/db/classification.test.ts` "refuses while a row is failed", "refuses while a row is pending" |
| Combination | each case in the epic | kept, removed or flagged | `test/engine/peers.test.ts` "stages 4 and 5: the combination rule" (one test per case) |
| Run records printed | one or both absent | labelled per step, says none | `test/seed-load.test.ts` "prints each step's latest run record" |
| Grants | `run.step2`, `register.classification` | only `derive` writes the run record | `test/db/run-grants.test.ts`, `test/db/grants.test.ts` |
| Deletion | 410 Gone | classification row cascades | `test/db/classification.test.ts` "a deleted company takes its classification with it" |
| No network | the request path | names no SDK, model host or step-2 module | `test/classify/key-boundary.test.ts` "nothing in the request path names a model host or batch step 2", "the SDK is imported only by the model client" |
| Key reach | source scan | key named only in the model client | `test/classify/key-boundary.test.ts` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/` -- new: `register.classification` (ON DELETE CASCADE, status check); `run.step2`.
- `src/engine/fingerprint.ts` -- `BUSINESS_TYPES`, reuse unchanged.
- `src/engine/digest.ts` -- the one digest function, for text and prompt hash.
- `src/engine/peers.ts:28`, `SUBJECT_SQL`, `CANDIDATES_SQL` -- stage 5 and the combination rule.
- `scripts/derive.ts` -- pattern for a step-2 script; writes `run.step2`, never calls the model.
- `scripts/seed-format.ts:39,639`, `scripts/seed-export.ts:128`, `scripts/seed-load.ts:185` -- `SEED_TABLES` entry, `fingerprintWhere` pattern, run-record print.
- Do not change: `register.fingerprint`, the type rule, D1.

## Tasks & Acceptance

**Execution:** done on the branch, stopped before the 300-company sample; the seed re-export follows the full run. Commits in small steps.

**Acceptance Criteria:** those of `epics.md`, Story 2.6, as settled by the answers above.

## Implementation Notes

- **Cost plan with the identical text sent once (2026-11-08, no model call).** Haiku 5.5 Batch, $0.05 in / $0.25 out per MTok (pricing page read 2026-11-08). Input from the real prompt length (765 characters) and the mean request of the 9 482 AS with text outside the labelled set: 371.0 characters as two fields, 338.6 with the identical text once. Central: 3.0 characters per token, 300 tokens overhead, 115 out. High: 2.2 and 500, 1 015 out. Ceiling: `max_tokens` on every request.

  | 10 327 AS | Tokens in | Tokens out | Dollars | Before |
  |---|---|---|---|---|
  | Central | 6.90 M | 1.19 M | $0.64 | $0.65 |
  | High | 10.34 M | 10.48 M | $3.14 | $3.15 |
  | Ceiling | 10.34 M | 20.65 M | $5.68 | $5.69 |

  The 300-AS sample stays about $0.02 / $0.09 / max $0.17. The saving is about 1.5 % of input tokens: output dominates, so the reason to send the text once is what the model reads, not the cost.

- **The model runs, totals only (Meinich ran each, after its own OK on the cost plan).** None shows a result per orgnr for the labelled set.

  | Run | What | Sent | Failed | `produkt` | `konsulent` | `forhandler` | `annet` | `uklart` | `no_text` | Tokens in | Tokens out | Cost |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | 14 | sample, first prompt | 300 | 0 | 126 | 56 | 2 | 53 | 63 | 0 | 186 154 | 16 827 | about $0.0135 |
  | 17 | sample, prompt `2810d26aa8dc` | 300 | 0 | 45 | 45 | 0 | 47 | 163 | 0 | 234 754 | 15 171 | about $0.0155 |
  | 18 | full, prompt `2810d26aa8dc` | 10 326 | 0 | 1 315 | 1 699 | 43 | 1 379 | 5 890 (57 %) | 45 | 8 069 842 | 530 218 | about $0.54 |

  Run 18 (2026-11-11, `claude-haiku-5-5`, Batch API, 9 min) classified every AS in `62.100`, the 300 sample companies again among them: 10 371 rows, none `pending`, `failed` or `sample`, one prompt hash and one model id. Its cost is within the plan's central estimate ($0.73) and the extrapolation from run 17 ($0.53). The review session checked `run.step2` and the table.

- **The seed sequence after run 18 (2026-11-13), Story 2.5c's steps 3-9, totals only.**
  - Dump and backup first: `.local/document-tables-before-2.6-seed/` (seven tables, `classification` included) copied to `C:\Users\cmein\peerless-backups\` with equal sha256. `.local/document-run-2.5d/` equals the database's rows outside the allow-list: 2 688 documents and 5 362 columns, row for row.
  - One transaction, counts checked before COMMIT: 5 362 columns and 2 688 documents deleted, 97 and 194 left, 10 371 classifications untouched. `pnpm derive`: 86 fingerprints of 97 columns. `seed:export`, committed alone (`77b8813`): `seed/demo/classification.csv` with 10 371 rows (`classified` 10 326, of them `uklart` 5 890; `no_text` 45; none `sample`), and `manifest.json` with the file's sha256 and the migration id `20261108130000_classification`. No other seed file changed.
  - `pnpm seed` twice, the re-export unchanged. Restored from the 2.5d dump, `pnpm derive`: 2 785 documents, 5 556 columns, 2 537 fingerprints, 10 371 classifications; all seven tables row for row equal to the dump taken before the deletion.
- **Found in the seed sequence:** `pnpm seed` printed step 2's latest run as 3 and step 1's as 783, not 19 and 1708: `latestRunRecord` ordered by its text alias. Fixed in `869a82c` with `test/db/classification.test.ts` "the latest record is the highest id, not the highest as text", which fails without the fix.
- **Tests only the re-export could reach:** `test/allow-list.test.ts` "reads the committed seed files" (`4af1694`) and `test/db/seed.test.ts` "writes rows in byte order of the key even when the table was filled in another order" (`8045ca1`) listed the seed files without `classification.csv`.
- **The suite, 2026-11-13:** `check:pins`, `check:env`, `lint`, `typecheck`, `test` (1 082), `test:db` (184), `test:ingest` (391), `build`, `check:routes` and `test:e2e` (116) pass. e2e ran on the seeded database, as in CI: on the restored one, seven peer-group and key-figure tests fail by design, because their expected values are computed from the seed's 86 fingerprints. The database was restored again afterwards and compared, all seven tables equal.

## Spec Change Log

- 2026-11-08, Meinich: the prompt's category limits are set after sample run 14, on those 300 companies only, never the labelled set: `produkt` needs a named or concretely described software product of the company's own that is sold or rented out; physical products are `annet`; general wording is `uklart`. After one new sample on the same 300, the prompt stands until the full run and is not changed after the labelled set is measured.
- 2026-11-08, Meinich, on a finding from the review session: sample run 17 (prompt `2810d26aa8dc`, the same 300 companies, none in the labelled set): 300 sent, 0 failed, `produkt` 45, `konsulent` 45, `forhandler` 0, `annet` 47, `uklart` 163; 234 754 tokens in, 15 171 out, about $0.0155. That is stricter than the BMAD session expected (`produkt` about 75, `uklart` about 140). The review session read the `uklart` texts: an estimated 20-25 of the 163 concretely describe a software product of the company's own, and the model answers differently on nearly identical texts. Decision: the prompt stands. `uklart` removes no company from the group, and its share is measured in Story 5.2.

- 2026-11-08, BMAD session, for Meinich to confirm: the epic says the flag is stored. It depends on the subject, so no company row can hold it; the funnel returns the flagged orgnrs and count with the group, from the two stored signals. The epic's AC is corrected in this PR.
- 2026-11-08, BMAD session: the `e2e/no-model-network.spec.ts` row is replaced. A browser test sees only the browser's requests, not the server's, so it would pass with a model call in a server component; a source scan of the request path fails on one.
- 2026-11-08, BMAD session: `seed:export`'s tests are in `test/db/classification.test.ts`, because they need the database, and `test/db/seed.test.ts` cannot run until the seed is re-exported.

## Review Triage Log

## Verification

**Commands:**
- `pnpm check:pins; pnpm lint; pnpm typecheck; pnpm test; pnpm test:db; pnpm test:ingest; pnpm build; pnpm e2e` -- expected: all pass, without a model key.
