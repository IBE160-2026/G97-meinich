---
title: 'Story 4.1: Explanations generated in batch'
type: 'feature'
created: '2026-11-26'
status: 'draft'
baseline_commit: '13b510c12d9d8859ea131f3b07a4a67cff889a86'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/docs/key-figures.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No stored explanation exists, and nothing in step 2 can write one. FR-52 needs one per 62.100 company's default peer group, written ahead of time from engine output only, and the model must never compute or choose a figure (issue #88; FR-52, AD-7, AD-9, AD-13, AD-19).

**Approach:**
- Add a pure module in `src/analysis` that turns a subject's default analysis into a closed slot table and a payload, and computes the digest of its wire encoding.
- Add `pnpm explain`, a step-2 Batch API script. It reads through the request path's own functions and sends the payload. It refuses a template that uses an unknown slot or has a digit outside a slot, and stores what passes with its provenance in a new `register.explanation` table.
- Take in deferred-work entry 205. Epic 3 retro action 8 is moved to its own PR, merged before this one, because it rewrites about 100 sites in 26 test files that are reviewed on their own (Meinich, 2026-11-27).

## Decisions (Meinich, 2026-11-27)

- **Run order:** 4.1 builds the run with test mode and `--plan`, plus one sample run of 20 companies drawn outside `analysis/labelled-set/document-run.json`, marked `sample`, with `--max-usd 0.05`. Before the sample run, `--plan` shows the ceiling and nothing is sent until Meinich says yes. The full run is in Story 4.3, after the figure and phrase tests.
  - The sample report gives the token counts, how many templates kept the slot format and how many were refused (with reasons), and three templates with their slots filled in.
- **Model:** `claude-haiku-5-5`. It is assessed again after the sample run.
- **Labelled-set companies:** at the full run, they are explained and exported, as long as the payload test shows that no fingerprint or classification is included. Their output is totals only.
- **Empty peer group:** no call and no failure. It is counted per `EmptyReason` in `run.step2.counts`.
- **Slot words:** direction is «over medianen» / «under medianen» / «lik medianen», and rank is «det største» / «nest største» / «tredje største kapitalgapet». Both are subject to the `--plan` counts. `mangler.dokument` reuses `keyFigures.notInDataset.state`, so the card and the page say the same thing.
- **Strengths:** the rule of Største styrke (`atOrBeyondBest`, `NEVER_STRENGTH` in `src/analysis/oversikt-cards.ts`). `NEVER_STRENGTH` is unchanged.

## Boundaries & Constraints

**Always:**
- **Default analysis:**
  - band 0, no `ekskl`, `V1_FUNNEL`;
  - read with `loadSubject`, `loadCandidates` and `shownGroup` as `reader`, through Vite's module runner (the `scripts/document-set-compute.ts` pattern);
  - written as `derive` through `DERIVE_DATABASE_URL`.
- **Payload:**
  - only slot ids, each slot's text from `src/engine/format.ts` or `nb.json`, and fixed structural keys;
  - the engine chooses which gaps and strengths are named and in what order;
  - no orgnr, name, register text, peer identity, fingerprint, classification, or anything from stages 4 and 5.
- **Kroner gaps:** profit gaps (per year) and capital gaps (one-off) are kept in separate lists and never ranked against each other.
- **Digest:** `digest()` over the wire encoding of the subject, the filing year, the band, the sorted peer orgnrs, and every slot's id, text and exact `WireDecimal`.
- **Model and prompt:** the model id is a constant in `scripts/explain/request.ts`, and the prompt hash covers the system prompt and the settings.
- **Key:** reached only through `scripts/classify/model-client.ts`. `test/classify/key-boundary.test.ts` keeps its one-file lists.
- **Story 4.4** reads only rows with `not sample`. This is written here, and a deferred entry names 4.4.
- **Guards:** every guard in the I/O matrix fails its test when removed, and the report shows the removal and the failing output.

**Never:**
- generation, the SDK or `scripts/explain` reachable from `src/`;
- a model call without Meinich's yes to the ceiling;
- an explanation row in the committed seed: the export writes `WHERE false` until the full run;
- an expected value chosen from data with a condition;
- per-orgnr output for the 845 labelled-set companies in the terminal, the spec, the PR or `docs/ai-log.md`;
- deleting a dump.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Guard test (fails if guard removed) |
|---|---|---|---|
| Demo A payload | 922425620, band 0 | profit gap 2 125 096 kr/yr; capital gaps working capital, kfd, lgd; strengths vare, oml, andre | `test/explain/payload.test.ts` "demo A's payload" |
| API-only subject | not in `document_figure_orgnrs` | no document slot; `mangler.dokument` | `test/explain/payload.test.ts` "a non-allow-listed company's payload contains no document figure" |
| Forbidden fields | any subject | no orgnr, name, fingerprint or classification | `test/explain/payload.test.ts` "holds no identity, fingerprint or classification" |
| Digit outside slot | `"Marginen er 3,4 %"` | not stored; `digit_outside_slot` | `test/explain/run.test.ts` "a digit outside a slot is not stored" |
| Unknown slot | `{{driftsmargin.foo}}` | not stored; `unknown_slot` | `test/explain/run.test.ts` "an unknown slot is not stored" |
| Empty group | `analysisCount = 0` | no call; counted under its `EmptyReason` | `test/explain/run.test.ts` "an empty group makes no call and is counted by reason" |
| Over cap | `--max-usd` below ceiling | nothing sent, exit 1 | `test/explain/run.test.ts` "refuses above --max-usd" |
| Sample draw | `--sample 20` | no labelled-set orgnr; rows `sample` | `test/explain/run.test.ts` "a sample is drawn outside the labelled set" |
| Test mode | stored responses, no key | runs and stores | `test/explain/run.test.ts` (stub model) |
| Failed response | `max_tokens` stop | usage counted | `test/classify/run.test.ts` "counts a failed response's tokens" |
| Deletion | company withdrawn | explanation goes | `ingest/tests/test_run_record.py::test_gone_unit_is_deleted_everywhere`; `test/db/explanation.test.ts` "a deleted company takes its explanation with it" |
| Grants | new table | reader S; derive SIU; loader SIT | `test/db/grants.test.ts` "the explanation table" |
| Seed | committed seed | `explanation.csv` header only | `test/db/seed.test.ts` "the committed seed holds no explanation" |
| Request path | `src/` | no SDK, model host or `scripts/explain` | `test/classify/key-boundary.test.ts` (regex `scripts\/(classify\|explain)`); `test/db/peers.test.ts` "makes no outbound request" |

</frozen-after-approval>

## Code Map

- `src/analysis/shown-group.ts` `shownGroup`, `src/engine/benchmark.ts` (`atOrBeyondBest`, `largestCapitalGap`, `driftsmarginGap`), `src/analysis/oversikt-cards.ts` (`NEVER_STRENGTH`), `src/analysis/key-figure-rows.ts`: reused, unchanged.
- `src/engine/format.ts`, `src/engine/wire.ts`, `src/engine/digest.ts`.
- `scripts/document-set-compute.ts`: the reader-through-Vite pattern.
- `scripts/classify/*`: the template for request, plan, run and CLI. `model-client.ts` becomes generic over request params, and its failed outcome carries `usage` (entry 205).
- `scripts/step2-record.ts`; `supabase/migrations/20261108130000_classification.sql` (the pattern); `scripts/seed-format.ts`, `scripts/seed-export.ts`, `scripts/seed-load.ts:180`; `test/db/grants.test.ts:581`; `ingest/tests/test_run_record.py:153–187`.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/classify/model-client.ts`, `test/classify/run.test.ts`: generic params, and usage on a failed response (entry 205).
- [ ] `src/analysis/explanation-payload.ts`, `src/messages/nb.json`, `test/explain/payload.test.ts`: the slot table, payload, wire encoding and digest.
- [ ] `supabase/migrations/20261126120000_explanation.sql`: the table, cascade, checks, grants, and `explain` in `run.step2`'s mode check.
- [ ] `scripts/explain.ts`, `scripts/explain/{request,plan,run}.ts`, `scripts/explain-compute.ts`, `test/explain/*`, `test/fixtures/explain/`: the script with test mode, `--plan`, `--sample` and `--max-usd`.
- [ ] Seed wiring and re-export, with the grants and deletion tests.
- [ ] The sample run, after Meinich's yes, and its report.
- [ ] Docs:
  - `docs/ai-log.md` and `AGENTS.md`;
  - the epic 3 retro rows for actions 9 and 11, and epics.md's ACs for them (4.2: the parser reads `format.ts`'s strings, including the two-decimal exceptions; 4.4: growth per tab after gzip, and a growth above 30 kB is put to Meinich);
  - the PRD memlog.

**Acceptance Criteria:**
- Given `pnpm explain --plan` without a key, then it prints the subject counts by `EmptyReason`, the token estimate, the ceiling and the per-wording counts, and writes nothing.
- Given the sample run, then the report gives its tokens, the counts of kept and refused templates with reasons, and three filled-in templates. No labelled-set orgnr is in the sample.
- Given the full verification in AGENTS.md "Testing", then every step passes, and `git status seed/` shows only the re-export.

## Spec Change Log

- **2026-11-27, Meinich:** epics.md Story 4.1's third AC said a step-2 run stores every company's explanation. 4.1 now builds the run and makes a 20-company sample, and the full run moves to Story 4.3, so no unguarded text is stored. AD-7's coverage line in epics.md says so too.
- **2026-11-27, Meinich:** the AC "every 62.100 company has a stored explanation … or a failure written to step 2's run record" now also counts a company with an empty peer group under its `EmptyReason` in `run.step2.counts`. That count meets the AC.
- **2026-11-27, Meinich:** Epic 3 retro action 8 was moved out of this spec into its own PR, merged first (see Intent).

## Open question for Meinich (not blocking 4.1)

- Is a cost-of-goods share of 0 % at a consultancy a strength? Under the current rule, `vare` is a strength for 62 of the 8 356 62.100 AS with a filing, and 45 of them have 0 % exactly. Only the 331 with document figures in the manifest can have it, and 329 of those have a peer group (local DB as `reader`, 2026-11-27, totals only). `NEVER_STRENGTH` is unchanged in 4.1, so the explanation follows the page.

## Design Notes

**Slots:**
- The syntax is `{{id}}`. Ids are `<figure>.<field>`, with fields `egen`, `median`, `beste`, `plassering`, `gap`, `retning` and `rang`, plus `aar`, `antall` and `mangler.dokument`.
- Story 4.4 fills the slots from the request path's own output, once the digests match.

**The stored row:**
- `template`, `slot_ids text[]`, `analysis_digest`, `prompt_hash`, `model_id`;
- `dataset`, read from `register.dataset`;
- `filing_year`;
- `status`: `explained`, `failed` or `pending`;
- `sample`, `batch_id` and `generated_at`.

## Verification

- Full verification in the order of AGENTS.md "Testing".
- Payload growth per tab after gzip against `main`. The expected growth is 0, because the request path does not change.
