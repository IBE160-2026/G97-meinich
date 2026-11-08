---
title: 'Story 2.6: Classification (stage 5)'
type: 'feature'
created: '2026-11-08'
status: 'draft'
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
| Nothing to read | no codes, purpose or description | `no_text`, no call, stays eligible | `test/classify/run.test.ts` "no_text makes no call"; `test/engine/peers.test.ts` "no_text stays through stage 5" |
| No key | key unset | `--plan` works; a real run refuses | `test/classify/run.test.ts` "a real run without a key refuses" |
| Over the cap | ceiling above `--max-usd` | nothing sent, exit 1 | `test/classify/plan.test.ts` "refuses when the ceiling exceeds the cap" |
| Sample | labelled orgnr drawn | never in a sample | `test/classify/plan.test.ts` "a sample never holds a labelled orgnr" |
| Sample not seeded | rows from the sample run | not exported | `test/seed-export.test.ts` "sample rows are not exported" |
| Non-AS | a covered non-AS company | never `pending`, no refusal | `test/seed-export.test.ts` "non-AS never blocks the export" |
| Abstention | stubbed `uklart` | `classified`, no type, counted apart | `test/classify/run.test.ts` "uklart is stored without a type and counted apart" |
| Seed refuses | a `failed` or `pending` row | export refuses | `test/seed-export.test.ts` "refuses while a row is failed or pending" |
| Combination | each case in the epic | kept, removed or flagged | `test/engine/peers.test.ts` "combination rule" (one test per case) |
| Run records printed | one or both absent | labelled per step, says none | `test/seed-load.test.ts` "prints each step's latest run record" |
| Grants | `run.step2`, `register.classification` | only `derive` writes the run record | `test/db/run-grants.test.ts`, `test/db/grants.test.ts` |
| Deletion | 410 Gone | classification row cascades | `ingest/tests/test_run_record.py` (Story 2.4's deletion test, extended) |
| No network | an analysis without a key | no request to a model host | `e2e/no-model-network.spec.ts` |
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

**Execution:** written after Story 2.6a has merged.

**Acceptance Criteria:** those of `epics.md`, Story 2.6, as settled by the answers above.

## Implementation Notes

- **Cost plan with the identical text sent once (2026-11-08, no model call).** Haiku 5.5 Batch, $0.05 in / $0.25 out per MTok (pricing page read 2026-11-08). Input from the real prompt length (765 characters) and the mean request of the 9 482 AS with text outside the labelled set: 371.0 characters as two fields, 338.6 with the identical text once. Central: 3.0 characters per token, 300 tokens overhead, 115 out. High: 2.2 and 500, 1 015 out. Ceiling: `max_tokens` on every request.

  | 10 327 AS | Tokens in | Tokens out | Dollars | Before |
  |---|---|---|---|---|
  | Central | 6.90 M | 1.19 M | $0.64 | $0.65 |
  | High | 10.34 M | 10.48 M | $3.14 | $3.15 |
  | Ceiling | 10.34 M | 20.65 M | $5.68 | $5.69 |

  The 300-AS sample stays about $0.02 / $0.09 / max $0.17. The saving is about 1.5 % of input tokens: output dominates, so the reason to send the text once is what the model reads, not the cost.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm check:pins; pnpm lint; pnpm typecheck; pnpm test; pnpm test:db; pnpm test:ingest; pnpm build; pnpm e2e` -- expected: all pass, without a model key.
