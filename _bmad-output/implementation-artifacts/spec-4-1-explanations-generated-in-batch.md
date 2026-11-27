---
title: 'Story 4.1: Explanations generated in batch'
type: 'feature'
created: '2026-11-26'
status: 'in-review'
baseline_commit: '8df1e6335592143d9e8ec474669ac70bf95da3fc'
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
- Take in the deferred-work entry on a failed response's usage (Story 2.6, review of PR #54, `discussion_r4567327638`; called "entry 205" below).
- Epic 3 retro action 8 is not part of 4.1. It was done in issue #89, PR #90, merged as `afe9a8e` (Meinich, 2026-11-27). 4.1's tests follow the rules it wrote into AGENTS.md "Testing".

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
- **Test assertions** (AGENTS.md "Testing", from #89/PR #90): every new test asserts unconditionally. No `expect` inside an `if`, `?:`, `switch`, `&&`/`||` or `catch`; narrow with `narrow` from `test/narrow.ts` or split the case. A loop or `it.each` with an `expect` asserts the length of what it runs over first, unless the list is a literal in the test. `pnpm lint` enforces the first rule and the e2e read rule; the length rule is the review's to check. 4.1 adds no e2e test.

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
| Demo A payload | 922425620 (TRETOEN AS, `src/demo-companies.ts`), band 0 | profit gap 2 125 096 kr/yr; capital gaps working capital, kfd, lgd; strengths vare, oml, andre (source: below the table) | `test/explain/payload.test.ts` "demo A's payload" |
| API-only subject | not in `document_figure_orgnrs` | no document slot; `mangler.dokument` | `test/explain/payload.test.ts` "a non-allow-listed company's payload contains no document figure" |
| Forbidden fields | any subject | no orgnr, name, fingerprint or classification | `test/explain/payload.test.ts` "holds no identity, fingerprint or classification" |
| Digit outside slot | `"Marginen er 3,4 %"` | not stored; `digit_outside_slot` | `test/explain/run.test.ts` "a digit outside a slot is not stored" |
| Unknown slot | `{{driftsmargin.foo}}` | not stored; `unknown_slot` | `test/explain/run.test.ts` "an unknown slot is not stored" |
| Placement after «bedre enn» (added by Meinich, 2026-11-27, after run 195) | `blant de {{x.plassering}} beste`; `bedre enn. {{x.plassering}}`; `bedre enn {{x.plassering}}` | not stored; `placement_without_bedre_enn`; the last one kept, in any case | `test/explain/run.test.ts` "a placement slot right after «bedre enn» in its sentence: …" (six cases); `test/explain/payload.test.ts` "writes the placement slot as only the percent, so the template supplies «bedre enn»" |
| Repeated slot words (added by Meinich, 2026-11-27, after run 185) | `bedre enn {{x.plassering}}`, `{{x.retning}} medianen`, in any case; never across `.`, `!` or `?` (Meinich, after run 193) | not stored; `repeated_slot_words`; `{{x.retning}}. Medianen …` and `… medianen. {{x.retning}}` kept | `test/explain/run.test.ts` "refuses … as repeated_slot_words" (six cases); "keeps … : …" (four cases across a sentence end); "keeps words beside a slot that do not repeat its own" |
| Empty group | `analysisCount = 0` | no call; counted under its `EmptyReason` | `test/explain/run.test.ts` "an empty group makes no call and is counted by reason" |
| Over cap | `--max-usd` below ceiling | nothing sent, exit 1 | `test/explain/run.test.ts` "refuses above --max-usd" |
| Sample draw | `--sample 20` | no labelled-set orgnr; rows `sample` | `test/explain/run.test.ts` "a sample is drawn outside the labelled set" |
| Test mode | stored responses, no key | runs and stores | `test/explain/run.test.ts` "runs from stored responses without a key" |
| Failed response (entry 205) | `max_tokens` stop | usage counted, in classify and explain | `test/classify/run.test.ts` "counts a failed response's tokens"; `test/explain/run.test.ts` "counts a failed response's tokens" |
| Deletion | company withdrawn | explanation goes | `ingest/tests/test_run_record.py::test_gone_unit_is_deleted_everywhere`; `test/db/explanation.test.ts` "a deleted company takes its explanation with it" |
| Grants | new table | reader S; derive SIU; loader SIT | `test/db/grants.test.ts` "the explanation table" |
| Seed | committed seed | `explanation.csv` header only | `test/db/seed.test.ts` "the committed seed holds no explanation" |
| Request path | `src/` | no SDK, model host or `scripts/explain` | `test/classify/key-boundary.test.ts` (regex `scripts\/(classify\|explain)`); `test/db/peers.test.ts` "makes no outbound request" |
| Digest (AD-13) | the same analysis twice; then one peer changed, one slot's exact value changed, one slot's text changed | the same digest twice; a new digest for each of the three changes | `test/explain/payload.test.ts` "the same analysis gives the same digest", "a changed peer changes the digest", "a changed slot value changes the digest", "a changed slot text changes the digest" |
| Stored columns | a stub run stores one row | `model_id` = `claude-haiku-5-5`; `prompt_hash` = the hash of the prompt and settings sent in that request; `dataset` = `register.dataset`'s value | `test/explain/run.test.ts` "stores the model, the hash of the prompt sent and the dataset" |
| Run record | every `pnpm explain`: `--plan`, a stub run, a run that ends in exit 1 | one `run.step2` row with mode `explain` and its counts, also on exit 1 | `test/explain/run.test.ts` "--plan writes one run record", "a run writes one run record", "a refused run still writes its run record"; `test/db/explanation.test.ts` "run.step2 accepts mode explain" |
| Same choice as the page | demo A, demo B, the API-only subject | the payload's first strength is `strengthCard`'s; its capital-gap order is `largestCapitalGap`'s order. The expected value comes from those two functions, not from the payload module | `test/db/explanation.test.ts` "the payload names the page's strength and capital-gap order" |
| Key | a real run without `ANTHROPIC_API_KEY` | refused, exit 1, nothing sent; the key never in the log or `run.step2` | `test/explain/run.test.ts` "a real run without a key is refused and sends nothing", "the key is never printed or recorded" |
| Wording counts (decision on slot words) | `--plan` | prints the count per wording for direction (over/under/lik medianen) and rank (største/nest største/tredje største kapitalgapet) | `test/explain/run.test.ts` "--plan prints the count per wording" |

Sources for the matrix:
- **Demo A:** the built app on 2026-11-27 (build newer than the last change to `src/` on main), `/analyse/922425620` Oversikt: "(13,3 % − 3,4 %) × 21 473 080 kr ≈ 2 125 096 kr per år", Største kapitalgap "Arbeidskapital", Største styrke "Varekostnadsandel". The rest of both lists (kfd, lgd; oml, andre) is from the checkpoint session and not checked again. The test holds the hand-written values, not values read from the code it tests.
- **Deletion:** `test_gone_unit_is_deleted_everywhere` loops over every `register` table with an `orgnr` column and asserts each holds a row of the target before the run. The new table therefore makes it fail until the test inserts an explanation row as `derive` would. That is the guard.
- **Tests that exist on main:** `test_gone_unit_is_deleted_everywhere`, "makes no outbound request" and the key-boundary test (its regex is now `scripts\/classify` and becomes `scripts\/(classify|explain)`). Every other named test is new in 4.1.

</frozen-after-approval>

## Review Triage Log

Wording found in sample runs 185, 193, 195 and 199, triaged by Meinich (2026-11-27). Counts are from `register.explanation` (`sample`), totals only.

| # | Finding | Decision |
|---|---|---|
| 1 | `slot_fields` in English: «kvartil» in 16 of 20 templates, «fjerdedel» in none | fixed in 4.1: bokmål, the page's words |
| 2 | «bedre enn bedre enn» in 12 of 20 | fixed in 4.1: `repeated_slot_words`, and the legend and prompt name it |
| 3 | one text partly in English | fixed in 4.1: the prompt says bokmål although the keys are English |
| 4 | «1 sammenlignbare selskap»: the model inflects the count's noun | fixed in 4.1: `antall` is the page's phrase |
| 5 | «Driftsmargenen»: a figure's name misspelled | Story 4.3, its phrase tests (deferred-work.md) |
| 6 | a clause without a verb («… ligger på {{beste}}, og {{plassering}}») | Story 4.3 (deferred-work.md) |
| 7 | `mangler.dokument` paraphrased before the slot is used | Story 4.3 (deferred-work.md) |
| 8 | run 193: `repeated_slot_words` across a full stop («{{x.retning}}. Medianen …») | fixed in 4.1: the rule stays within the slot's sentence |
| 9 | run 193: `stop_max_tokens` in 6 of 20 | fixed in 4.1: `MAX_TOKENS` 2 000, thinking kept |
| 10 | run 193: a phrase that makes the placement follow from the gap («… per år, så selskapet er bedre enn 13 %») | Story 4.3 (deferred-work.md) |
| 11 | run 193: a claim beyond the payload («Ingen av nøkkeltallene ligger under grensen for beste fjerdedel») | Story 4.3 (deferred-work.md) |
| 12 | run 193: `mangler.dokument` read as the company having no figures at all | Story 4.3 (deferred-work.md) |
| 13 | run 193: the model's own comment in English inside a text («Let me correct: …»); refused there for repeated words, not for the comment | Story 4.3 (deferred-work.md) |
| 15 | run 195: `{{retning}}` with no figure before it (`unknown_slot`) | Story 4.3 (deferred-work.md) |
| 16 | run 195: «høyere-er-bedre», the item's `better` translated literally | Story 4.3 (deferred-work.md) |
| 17 | run 199, 4.1's last: 3 of 20 refused (`placement_without_bedre_enn`); `decideWork` counts only explained rows as unchanged, so the full run needs a plan for sending refused rows again | Story 4.3 (deferred-work.md) |
| 18 | run 199: a meta sentence («Dette er en beskrivelse …, ikke en vurdering av hva selskapet bør gjøre»), a self-correction left in a text («Rettere: …», refused), the own value written twice in one sentence | Story 4.3 (deferred-work.md) |
| 14 | run 193: a sentence that begins with a slot starts in lower case («bedre enn 68 % …», «2,2 % driftsmargin …») | Story 4.4, where the card fills the template (deferred-work.md) |

## Code Map

- `src/analysis/shown-group.ts` `shownGroup`, `src/engine/benchmark.ts` (`atOrBeyondBest`, `largestCapitalGap`, `driftsmarginGap`), `src/analysis/oversikt-cards.ts` (`NEVER_STRENGTH`), `src/analysis/key-figure-rows.ts`: reused, unchanged.
- `src/engine/format.ts`, `src/engine/wire.ts`, `src/engine/digest.ts`.
- `scripts/document-set-compute.ts`: the reader-through-Vite pattern.
- `scripts/classify/*`: the template for request, plan, run and CLI. `model-client.ts` becomes generic over request params, and its failed outcome carries `usage` (entry 205).
- `scripts/step2-record.ts`; `supabase/migrations/20261108130000_classification.sql` (the pattern); `scripts/seed-format.ts`, `scripts/seed-export.ts`, `scripts/seed-load.ts:180`; `test/db/grants.test.ts:581`; `ingest/tests/test_run_record.py:153–187`.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/classify/model-client.ts`, `test/classify/run.test.ts`: generic params, and usage on a failed response (entry 205, marked `resolved:` in `deferred-work.md`).
- [x] `src/analysis/explanation-payload.ts`, `src/messages/nb.json`, `test/explain/payload.test.ts`: the slot table, payload, wire encoding and digest.
- [x] `supabase/migrations/20261126120000_explanation.sql`: the table, cascade, checks, grants, and `explain` in `run.step2`'s mode check.
- [x] `scripts/explain.ts`, `scripts/explain/{request,plan,run}.ts`, `scripts/explain-compute.ts`, `test/explain/*`, `test/fixtures/explain/`: the script with test mode, `--plan`, `--sample` and `--max-usd`.
- [x] Seed wiring and re-export, with the grants and deletion tests.
- [x] The sample run, after Meinich's yes, and its report (run.step2 id 181; the report is in the session file `docs/ai-sessions/2026-11-27-story-4-1-explanations-batch.md`).
- [x] Docs:
  - `docs/ai-log.md` and `AGENTS.md`;
  - the epic 3 retro rows for actions 9 and 11, and epics.md's ACs for them (4.2: the parser reads `format.ts`'s strings, including the two-decimal exceptions; 4.4: growth per tab after gzip, and a growth above 30 kB is put to Meinich);
  - the PRD memlog.

**Acceptance Criteria:**
- Given `pnpm explain --plan` without a key, then it prints the subject counts by `EmptyReason`, the token estimate, the ceiling and the per-wording counts, and writes no explanation row: only its one `run.step2` record (mode `explain`, `plan: true`).
- Given the sample run, then the report gives its tokens, the counts of kept and refused templates with reasons, and three filled-in templates. No labelled-set orgnr is in the sample.
- Given the full verification in AGENTS.md "Testing", then every step passes, and `git status seed/` shows only the re-export.

## Spec Change Log

- **2026-11-27, Meinich:** epics.md Story 4.1's third AC said a step-2 run stores every company's explanation. 4.1 now builds the run and makes a 20-company sample, and the full run moves to Story 4.3, so no unguarded text is stored. AD-7's coverage line in epics.md says so too.
- **2026-11-27, Meinich:** the AC "every 62.100 company has a stored explanation … or a failure written to step 2's run record" now also counts a company with an empty peer group under its `EmptyReason` in `run.step2.counts`. That count meets the AC.
- **2026-11-27, Meinich:** Epic 3 retro action 8 was moved out of this spec into its own PR: issue #89, PR #90, merged as `afe9a8e`. The retro's action table on main records it as done in #89. 4.1 only follows the rules it added to AGENTS.md "Testing".
- **2026-11-27, Meinich:** the model is `claude-haiku-5-5`, and it is assessed again after the sample run (see Decisions).
- **2026-11-27, Meinich:** labelled-set companies are explained and exported at the full run, as long as the payload test shows that no fingerprint or classification is included, and their output is totals only (see Decisions).
- **2026-11-27, Meinich:** the slot words for direction and rank, `mangler.dokument` = `keyFigures.notInDataset.state`, and strengths by the rule of Største styrke with `NEVER_STRENGTH` unchanged (see Decisions).
- **2026-11-27, Meinich:** three deferred entries are written in this PR. Story 4.4's card reads only `not sample`; the export's `WHERE false` is lifted in Story 4.3, where real explanations are stored (one owner, Meinich after the review session's reading of `b609ce0`); and the open question on cost of goods as a strength goes to Story 4.4.
- **2026-11-27, Meinich (review session's reading of `b609ce0`):** the I/O matrix gets rows for the digest, the stored columns, the run record, the same choice as the page, the key and the wording counts.
- **2026-11-27, Meinich (matrix row "Run record"):** `--plan` writes one `run.step2` record, so the acceptance criterion's "writes nothing" now reads "writes no explanation row". The matrix row is the later decision and wins over the criterion's wording.
- **2026-11-27, Meinich (after sample run 181):** the payload states once what each slot field means (`slot_fields`, no digit): `beste` is the best-quartile boundary, never one company; `gap` is to that boundary, never to the median; `retning`'s text already holds «medianen»; `aar` and `antall` are written as slots. Each figure item carries `better` (higher or lower), so a cost share's boundary below its own value reads right. That field is the BMAD session's addition, for the cost-share sentence. The payload boundary above ("only slot ids, slot texts … and fixed structural keys") now also admits these two fixed parts. The prompt says never to copy a slot's text, after all seven refusals of run 181 turned out to be the year or the count written as digits.
- **2026-11-27, Meinich:** a sample run prints each refused text with its reason (never stored or recorded, never with an orgnr), so a sample explains itself (`test/explain/run.test.ts` "a sample run prints each refused text with its reason, stores no text and shows no orgnr").
- **2026-11-27, sample run 185** (the same 20, ceiling $0.0077, at most Meinich's $0.01): 20 explained, 0 refused. The three wording errors of run 181 are gone, and the capital-gap text is stored and holds the rules. New wording errors ("bedre enn bedre enn" in 12 texts; one text partly in English) are put to Meinich (session file).
- **2026-11-27, Meinich (after sample run 185):** `slot_fields` is in bokmål and in the page's own words: «beste fjerdedel», never «kvartil»; «median»; «bedre enn» as `keyFigures.placement` writes it. The prompt says to write bokmål although the JSON's keys are English. `parseTemplate` refuses words beside a slot that repeat the slot's own, compared without case (`repeated_slot_words`, a new matrix row). The `antall` slot's text is the page's phrase (`analysis.peerCount` / `analysis.peerCountOne`, as in `company-header.tsx`), so the model never inflects the noun. The thousands separator stays with Story 4.2.
- **2026-11-27, sample run 193** (the same 20, ceiling $0.0080): 9 explained, 11 refused (`stop_max_tokens` 6, `repeated_slot_words` 5, one of them across a full stop). «kvartil» is gone (0 of 9 stored), «fjerdedel» is in 8, there is no «bedre enn bedre enn» in a stored text, and the capital-gap text is stored and holds the rules. `MAX_TOKENS` and the full-stop case are put to Meinich (session file).
- **2026-11-27, Meinich (after sample run 193):** `MAX_TOKENS` is 2 000, as classify's, and thinking stays. Run 185 had thinking and explained 20 of 20. Run 193's six `stop_max_tokens` were answers cut short, after the longer legend and rules lengthened the thinking, not answers that thinking made worse. The sample-run plan's "output cap of 1 000" is superseded.
- **2026-11-27, sample run 195** (the same 20, ceiling $0.0130, at most Meinich's $0.015): 9 explained, 11 refused (`repeated_slot_words` 10, all «bedre enn {{…plassering}}»; `unknown_slot` 1). No `stop_max_tokens`. In the 9 stored texts there is no «kvartil», no «bedre enn bedre enn», no English and no gap to the median. Below Meinich's 18 of 20, so the trial stopped for his decision (session file).
- **2026-11-27, Meinich (after sample run 195):** the placement slot's text is only the percent (`formatWholePercent`, as before), and the template writes «bedre enn» before it, so the reader still sees `keyFigures.placement`'s «bedre enn 66 %». The model wrote «bedre enn» before the placement slot in 12 of 20 texts without a rule (run 185) and in 10 of 20 with the rule forbidding it (run 195). Asking for it is what the model does anyway. A new refusal, `placement_without_bedre_enn`, requires every `{{x.plassering}}` to stand right after «bedre enn» in its own sentence, compared without case. `slot_fields` and the prompt say so. This supersedes the 'plassering' half of the repeated-words rule of run 193; `repeated_slot_words` stays for the other slots.
- **2026-11-27, Meinich:** the next sample run is 4.1's last. After it there are no more prompt changes or runs in 4.1, whatever the result, and what remains goes to Story 4.3 with a deferred entry.
- **2026-11-27, sample run 199, 4.1's last** (the same 20, ceiling $0.0130): 17 explained, 3 refused (`placement_without_bedre_enn` 3). The 17 stored texts hold no «kvartil», «bedre enn bedre enn», English or gap to the median, and the capital-gap text is stored and holds the rules. Meinich's threshold of 18 of 20 is not met. As decided, 4.1 makes no more prompt changes or runs, and what remains goes to Story 4.3 (Review Triage Log rows 15–18).
- **2026-11-27, rebase on `main`:** the branch now sits on `8df1e63`. `deferred-work.md` kept main's Story 5.7 entry on `peer-assembly-time` (PR #90's CI). It does not concern 4.1.

## Sample run plan

Nothing is sent before Meinich's yes to the ceiling that `--plan` prints.

1. **`pnpm explain --plan`** needs no key and makes no model call: it never builds the model client, so the key in `.env` is not read. It writes no explanation row, only its `run.step2` record. It prints:
   - the 62.100 AS subjects, how many have a peer group, and how many are empty, per `EmptyReason`;
   - the token estimate, central and high, with the input from the payloads and the system prompt (as `scripts/classify/plan.ts` estimates it);
   - the ceiling: high input plus `MAX_TOKENS` × requests for output, at `PRICE_PER_MTOK` with its `PRICE_DATE`;
   - the per-wording counts: direction («over/under/lik medianen») and rank («det største» / «nest største» / «tredje største kapitalgapet»).
2. **`pnpm explain --plan --sample 20`** prints the same for the 20 companies drawn outside `analysis/labelled-set/document-run.json`, with counts only and no orgnr.
3. **Price check:** before the run, `PRICE_PER_MTOK` (now $0.05 input and $0.25 output per million batch tokens for `claude-haiku-5-5`, read 2026-11-08) is checked again against the pricing page, and `PRICE_DATE` is updated if it has changed.
4. **Meinich's yes** to the ceiling for the sample.
5. **`pnpm explain --sample 20 --max-usd 0.05`** refuses with exit 1 and sends nothing if the ceiling is above $0.05. Rows are stored with `sample = true` and the run record goes to `run.step2`.
   - Order of magnitude, to be replaced by `--plan`'s figure: 20 requests of at most 4 000 input tokens and an output cap of 1 000 come to about $0.004 + $0.005 = $0.009. $0.05 gives roughly five times that in margin.
   - The output cap is set in `scripts/explain/request.ts` (classify uses 2 000).
6. **The report** (in the PR and the session file):
   - input and output tokens and their dollar amount;
   - the kept and refused templates, each refusal by reason (`digit_outside_slot`, `unknown_slot`, `max_tokens`, …);
   - three templates with their slots filled in;
   - the model assessment.
   No orgnr of the labelled set appears anywhere, and the sample's orgnrs are not printed.

## Deferred work naming Stories 4.3 and 4.4 (not taken into 4.1)

- **Story 4.4:** the explanation card renders or removes `AiMark`, `Mark` and `peers.ai`, which v1 does not use (from Story 5.2).
- **Story 4.4:** the card reads only `not sample` from `register.explanation`, with a test that fails when the condition is removed. Written by this PR.
- **Story 4.3:** lift `seed:export`'s `WHERE false` for `register.explanation` when the full run is guarded, and change "the committed seed holds no explanation" to "no sample row, and every row passes the figure and phrase tests". Written by this PR.
- **Story 4.4:** whether a cost-of-goods share of 0 % is a strength (the open question below). Written by this PR.
- **Not 4.1:** the entry naming Story 5.7 (`peer-assembly-time`, PR #90's CI).

## Open question for Meinich (not blocking 4.1; deferred to Story 4.4)

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
