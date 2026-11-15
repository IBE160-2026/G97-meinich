# Layer-by-layer measurement, 62.100 (SM-1)

Generated 2026-11-15 by `scripts/layer-measurement.ts` (`pnpm analysis:layers`) at commit `e88a6ef4331094195b8a49a1713d8237595f2aef`, with the reads in `scripts/layer-measurement-compute.ts`. Inputs: `analysis/labelled-set/drawn.json`, `analysis/labelled-set/labels-blind.csv`, `analysis/labelled-set/labels-revenue-model.csv` and `analysis/labelled-set/labels.csv` (Story 5.1), and the local database read as `reader`. The definitions were fixed in the Story 5.2 spec before the first run on the real labels. Totals only: no company, label, classification or fingerprint is given per orgnr.

This measures the funnel as it is and states no numeric target (NFR32).

## The labels

- 30 subjects and 900 labelled pairs from `analysis/labelled-set/drawn.json`.
- The measure is 900 pairs: the blind pairs, labelled by Meinich from description and website only, and the other pairs, whose label is computed from `analysis/labelled-set/labels-revenue-model.csv` by the README rule. A ChatGPT model (OpenAI, version not recorded) filled in those revenue models, and Meinich went through and accepted them; nobody else labelled. For those pairs, the text layer (stage 5, a Claude model) is therefore one AI measured against another; the fingerprint and the industry code are not AI.
- There is no second labeller and no Cohen's κ in v1 (project stage 2), so nothing here checks one labeller against another.
- Round 1 (`analysis/labelled-set/labels.csv`, 720 pairs) is shown below as "den strengere lesningen" and decides nothing.
- `usikker` is left out of precision and recall and counted; a sensitivity table counts it as `ja` and as `nei`.

## How the layers are read

Each subject is read as the analysis page reads it and assembled by `assemblePeerGroup(…, 0)` (`src/engine/peers.ts`) at the Standard size band, with both signals on: stage 4 and stage 5 as built, which is what is measured. In v1 both signals are switched off after this measurement (`V1_FUNNEL`), so v1's group is the stage 1–3 pool (L1).

- **L1** includes a pair when the candidate is in today's stage 1–3 pool. Every labelled candidate was drawn from that pool.
- **L2** includes it when the fingerprint signal is not `false`: the funnel with the subject's classification switched off. A missing fingerprint, an undetermined type or a subject with no type is a null signal, and the pair is kept.
- **L3** includes it when the text signal is not `false`: the funnel with the subject's fingerprint switched off. `uklart`, a missing row and a subject with no type are null, and the pair is kept.
- **L2+L3** is `group`, the funnel as built (both signals on): `assemblePeerGroup` is called with the measured options (`MEASURED`). Flagged pairs are shown apart from the rest of `group`.
- Precision is `ja` / (`ja` + `nei`) among the included pairs; recall is the included `ja` / all `ja`, so recall counts within the stage 1–3 pool. "ikke definert" means there is no pair to divide by, never 0.

Labelled companies with a fingerprint for the labelled year: 776 of 845.
Database state read: 776 fingerprints; classifications by model `claude-haiku-5-5` with prompt hash `2810d26aa8dc66140b8b41fb4508cffe80de00a5e55761d39d67da195ffefee8`.
Subjects with a type of their own: 19 of 30 on the fingerprint, 10 on the text, 7 on both. A subject without a type keeps every candidate in that layer, so L2 and the band rules move only on the pairs of the 19 subjects with a fingerprint type, and L3 and the stage-5 rule only on those of the 10 with a text type: the verdicts rest on few subjects.
Labelled candidates not in today's pool: 0 of 900. They are in no layer, so a `ja` among them counts against every layer's recall.

**SM-1b.** An industry-code-only baseline also includes every labelled pair, so on these pairs it equals L1, the base rate. The size band and funnel stage 2 cannot be judged with this draw. SM-1b is the funnel against that base rate: a check, not a claim.

## The layers (the measure)

900 pairs of 30 subjects: 211 ja, 365 nei, 324 usikker (left out of precision and recall, and counted).

### All pairs

30 subjects, 900 pairs (100,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 900 | 211 | 365 | 324 | 36,6 % | 100,0 % |
| L2 fingerprint alone | 669 | 154 | 267 | 248 | 36,6 % | 73,0 % |
| L3 classification alone | 825 | 206 | 302 | 317 | 40,6 % | 97,6 % |
| L2+L3 the funnel (`group`) | 643 | 157 | 240 | 246 | 39,5 % | 74,4 % |
| `group`, not flagged | 621 | 149 | 227 | 245 | 39,6 % | 70,6 % |
| flagged ("Usikker klassifisering") | 22 | 8 | 13 | 1 | 38,1 % | 3,8 % |

### Informative descriptions

15 subjects, 450 pairs (50,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 450 | 135 | 208 | 107 | 39,4 % | 100,0 % |
| L2 fingerprint alone | 328 | 89 | 148 | 91 | 37,6 % | 65,9 % |
| L3 classification alone | 413 | 132 | 179 | 102 | 42,4 % | 97,8 % |
| L2+L3 the funnel (`group`) | 314 | 91 | 133 | 90 | 40,6 % | 67,4 % |
| `group`, not flagged | 304 | 86 | 129 | 89 | 40,0 % | 63,7 % |
| flagged ("Usikker klassifisering") | 10 | 5 | 4 | 1 | 55,6 % | 3,7 % |

### Uninformative descriptions

15 subjects, 450 pairs (50,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 450 | 76 | 157 | 217 | 32,6 % | 100,0 % |
| L2 fingerprint alone | 341 | 65 | 119 | 157 | 35,3 % | 85,5 % |
| L3 classification alone | 412 | 74 | 123 | 215 | 37,6 % | 97,4 % |
| L2+L3 the funnel (`group`) | 329 | 66 | 107 | 156 | 38,2 % | 86,8 % |
| `group`, not flagged | 317 | 63 | 98 | 156 | 39,1 % | 82,9 % |
| flagged ("Usikker klassifisering") | 12 | 3 | 9 | 0 | 25,0 % | 3,9 % |

### Blind pairs (labelled by a person)

6 subjects, 180 pairs (20,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 180 | 45 | 134 | 1 | 25,1 % | 100,0 % |
| L2 fingerprint alone | 116 | 29 | 86 | 1 | 25,2 % | 64,4 % |
| L3 classification alone | 153 | 44 | 108 | 1 | 28,9 % | 97,8 % |
| L2+L3 the funnel (`group`) | 111 | 29 | 81 | 1 | 26,4 % | 64,4 % |
| `group`, not flagged | 99 | 28 | 70 | 1 | 28,6 % | 62,2 % |
| flagged ("Usikker klassifisering") | 12 | 1 | 11 | 0 | 8,3 % | 2,2 % |

## Sensitivity: usikker as ja and as nei (the measure, all pairs)

| Layer | Precision, as ja | Recall, as ja | Precision, as nei | Recall, as nei |
|---|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 59,4 % | 100,0 % | 23,4 % | 100,0 % |
| L2 fingerprint alone | 60,1 % | 75,1 % | 23,0 % | 73,0 % |
| L3 classification alone | 63,4 % | 97,8 % | 25,0 % | 97,6 % |
| L2+L3 the funnel (`group`) | 62,7 % | 75,3 % | 24,4 % | 74,4 % |
| `group`, not flagged | 63,4 % | 73,6 % | 24,0 % | 70,6 % |
| flagged ("Usikker klassifisering") | 40,9 % | 1,7 % | 36,4 % | 3,8 % |

## Why a signal is null (pairs in the pool)

| Fingerprint signal (L2) | Pairs |
|---|---:|
| `subject_no_type` | 330 |
| `undetermined` | 180 |
| `no_fingerprint:document_absent` | 0 |
| `no_fingerprint:document_refused` | 6 |
| `no_fingerprint:document_paper` | 0 |
| `no_fingerprint:document_failed` | 36 |
| `no_fingerprint:document_not_reconciled` | 0 |
| `no_fingerprint:reconciled_not_derived` | 5 |
| signal present | 343 |

| Text signal (L3) | Pairs |
|---|---:|
| `subject_no_type` | 600 |
| `uklart` | 172 |
| `no_row` | 0 |
| `no_text` | 0 |
| `failed` | 0 |
| `pending` | 0 |
| signal present | 128 |

`no_fingerprint:reconciled_not_derived` is a reconciled document that `pnpm derive` gave no fingerprint (R2, or a negative unexplained remainder).

## The stage-5 rule

Fixed in the PRD (§9) before any result: on all measure pairs, `usikker` left out, *fingerprint alone* (L2) against *fingerprint and text* (`group`). Stage 5 is kept if and only if precision rises by at least 3,0 pp and recall falls by at most 3,0 pp, both bounds inclusive, compared exactly. The rule is never re-tuned.

| | Precision | Recall |
|---|---:|---:|
| Fingerprint alone (L2) | 36,6 % (154/421) | 73,0 % (154/211) |
| Fingerprint and text (`group`) | 39,5 % (157/397) | 74,4 % (157/211) |
| Difference | +2,967 pp (157/397 − 154/421) | +1,422 pp (157/211 − 154/211) |

A difference of +2,967 pp shows as +3,0 pp at one decimal; the rule compares the exact value.

L3, the classification alone, has the highest precision of the layers (40,6 %). The rule does not compare L3: it compares the funnel with and without the text over the fingerprint (L2 against `group`), and that is not changed now.

**Verdict: stage 5 is not kept.**

The verdict sits within the noise (432 decided pairs in L2 or `group`, from 29 clustered subjects), and the rule decides it by construction.

## The bands (FR-13)

Each band is left out by widening it to low–high in memory, in the subject's fingerprint and every candidate's, before the funnel runs; the rule is unchanged, so a type that depended on the band becomes undetermined and the pair is kept. The rule is applied to L2 only, never to `group`, so the text cannot hide what the band does: a band is recommended kept if L2 with it has at least 3,0 pp higher precision and at most 3,0 pp lower recall than L2 without it, and dropped otherwise. The rule gives a recommendation; Meinich decides (FR-13). The stored fingerprints and `src/engine/fingerprint.ts` are unchanged.

### Cost of goods share band

| | Precision | Recall |
|---|---:|---:|
| L2 without the band | 36,6 % (211/576) | 100,0 % (211/211) |
| L2 with the band | 36,6 % (154/421) | 73,0 % (154/211) |
| Difference (with − without) | −0,052 pp (154/421 − 211/576) | −27,014 pp (154/211 − 211/211) |

In practice "without the band" here became "without the fingerprint". The type rule reads the cost-of-goods band first (high is `forhandler`, low never is), so a fingerprint with this band widened to low–high can always give `forhandler` and another type, and its type is undetermined. Without the band the fingerprint signal is null for 900 of 900 pairs in the pool, against 557 with it. This test therefore cannot tell the band apart from the fingerprint. No definition is changed.

**Recommendation: dropped.**

### Personnel cost share band

| | Precision | Recall |
|---|---:|---:|
| L2 without the band | 36,7 % (198/539) | 93,8 % (198/211) |
| L2 with the band | 36,6 % (154/421) | 73,0 % (154/211) |
| Difference (with − without) | −0,155 pp (154/421 − 198/539) | −20,853 pp (154/211 − 198/211) |

The type rule reads the personnel-cost band only to tell `konsulent` (personnel cost mid or high, cost of goods low) from `annet`, so widening it leaves those types undetermined and keeps `forhandler` and `produkt`. Without the band the fingerprint signal is null for 805 of 900 pairs in the pool, against 557 with it. The closer the first count is to all pairs, the more "without the band" is again "without the fingerprint", and the less this test can tell the band apart from the fingerprint. No definition is changed.

**Recommendation: dropped.**

## The text against L1 (informational)

With stage 4 off, v1's group is L1, so this compares the text (L3) with L1 by the same bounds. This comparison was not fixed before the run, so it decides nothing, and its differences lie within the noise (576 decided pairs in the pool, from 29 clustered subjects).

| | Precision | Recall |
|---|---:|---:|
| L1 industry code and size | 36,6 % (211/576) | 100,0 % (211/211) |
| L3 classification alone | 40,6 % (206/508) | 97,6 % (206/211) |
| Difference | +3,919 pp (206/508 − 211/576) | −2,370 pp (206/211 − 211/211) |

By the same bounds, the text against L1 would pass.

### The decision

The order of the decisions (Meinich, 2026-11-15):

1. **Stage 5 off, by the rule** fixed before the run (L2 against `group`: +2,967 pp precision, +1,422 pp recall).
2. **Stage 4 off, by Meinich's decision.** Meinich followed the band rule's recommendation in the form that changes the group least: the fingerprint signal is switched off in v1, like the text signal, instead of dropping the bands with a migration; `src/engine/fingerprint.ts`, the bands, the stored fingerprints and `pnpm derive` are unchanged, so a later stage can measure again. Meinich decided it from the rule on all pairs (cost-of-goods band, with against without: 36,6 % against 36,6 % precision, −27,0 pp recall) and the blind pairs (25,2 % against 25,1 % precision, −35,6 pp recall), and because the band test cannot tell one band from the fingerprint.
3. **Text against L1 reported, not used.** It would pass the same bounds (+3,919 pp precision, −2,370 pp recall). The comparison was not fixed before the run, and the gain lies within the noise (576 decided pairs in the pool, from 29 clustered subjects). The decision follows the fixed rule, and question 26 fixes text against L1 before the next measurement.

v1's group is therefore the stage 1–3 pool.

## The rules on the blind pairs alone (informational)

The 180 blind pairs, labelled by a person from description and website only. The rules are decided on all pairs; this decides nothing.

### Stage 5

| | Precision | Recall |
|---|---:|---:|
| Fingerprint alone (L2) | 25,2 % (29/115) | 64,4 % (29/45) |
| Fingerprint and text (`group`) | 26,4 % (29/110) | 64,4 % (29/45) |
| Difference | +1,146 pp (29/110 − 29/115) | 0,000 pp (29/45 − 29/45) |

Stage-5 rule on these pairs: stage 5 is not kept.

### Cost of goods share band

| | Precision | Recall |
|---|---:|---:|
| L2 without the band | 25,1 % (45/179) | 100,0 % (45/45) |
| L2 with the band | 25,2 % (29/115) | 64,4 % (29/45) |
| Difference (with − without) | +0,078 pp (29/115 − 45/179) | −35,556 pp (29/45 − 45/45) |

Band rule on these pairs: dropped.

### Personnel cost share band

| | Precision | Recall |
|---|---:|---:|
| L2 without the band | 26,1 % (43/165) | 95,6 % (43/45) |
| L2 with the band | 25,2 % (29/115) | 64,4 % (29/45) |
| Difference (with − without) | −0,843 pp (29/115 − 43/165) | −31,111 pp (29/45 − 43/45) |

Band rule on these pairs: dropped.

## The verdicts with usikker counted (informational)

The same rules on all measure pairs with `usikker` counted as `ja` and as `nei`. The verdicts above leave `usikker` out and decide; these decide nothing.

| Rule | usikker left out (decides) | usikker as ja | usikker as nei |
|---|---|---|---|
| Stage 5 | stage 5 is not kept | stage 5 is not kept (same) | stage 5 is not kept (same) |
| Cost of goods share band | dropped | dropped (same) | dropped (same) |
| Personnel cost share band | dropped | dropped (same) | dropped (same) |

## Round 1: den strengere lesningen

The first round of the non-blind pairs, labelled by a person more specifically than the rubric (README, "Labelling record"). Shown for comparison; it decides nothing.

720 pairs of 24 subjects: 31 ja, 649 nei, 40 usikker (left out of precision and recall, and counted).

### All pairs

24 subjects, 720 pairs (100,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 720 | 31 | 649 | 40 | 4,6 % | 100,0 % |
| L2 fingerprint alone | 553 | 25 | 499 | 29 | 4,8 % | 80,6 % |
| L3 classification alone | 672 | 29 | 603 | 40 | 4,6 % | 93,5 % |
| L2+L3 the funnel (`group`) | 532 | 23 | 480 | 29 | 4,6 % | 74,2 % |
| `group`, not flagged | 522 | 23 | 470 | 29 | 4,7 % | 74,2 % |
| flagged ("Usikker klassifisering") | 10 | 0 | 10 | 0 | 0,0 % | 0,0 % |

### Informative descriptions

12 subjects, 360 pairs (50,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 360 | 10 | 339 | 11 | 2,9 % | 100,0 % |
| L2 fingerprint alone | 271 | 10 | 253 | 8 | 3,8 % | 100,0 % |
| L3 classification alone | 332 | 8 | 313 | 11 | 2,5 % | 80,0 % |
| L2+L3 the funnel (`group`) | 260 | 8 | 244 | 8 | 3,2 % | 80,0 % |
| `group`, not flagged | 253 | 8 | 237 | 8 | 3,3 % | 80,0 % |
| flagged ("Usikker klassifisering") | 7 | 0 | 7 | 0 | 0,0 % | 0,0 % |

### Uninformative descriptions

12 subjects, 360 pairs (50,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 360 | 21 | 310 | 29 | 6,3 % | 100,0 % |
| L2 fingerprint alone | 282 | 15 | 246 | 21 | 5,7 % | 71,4 % |
| L3 classification alone | 340 | 21 | 290 | 29 | 6,8 % | 100,0 % |
| L2+L3 the funnel (`group`) | 272 | 15 | 236 | 21 | 6,0 % | 71,4 % |
| `group`, not flagged | 269 | 15 | 233 | 21 | 6,0 % | 71,4 % |
| flagged ("Usikker klassifisering") | 3 | 0 | 3 | 0 | 0,0 % | 0,0 % |

### The rules on this reading (informational)

| Rule | Verdict | Precision difference | Recall difference |
|---|---|---:|---:|
| Stage 5 (L2 against `group`) | stage 5 is not kept | −0,198 pp (23/503 − 25/524) | −6,452 pp (23/31 − 25/31) |
| Cost of goods share band | dropped | +0,212 pp (25/524 − 31/680) | −19,355 pp (25/31 − 31/31) |
| Personnel cost share band | dropped | +0,098 pp (25/524 − 30/642) | −16,129 pp (25/31 − 30/31) |
| Text against L1 | would not pass | +0,030 pp (29/632 − 31/680) | −6,452 pp (29/31 − 31/31) |

The base rate (L1 precision) is 36,6 % in the measure and 4,6 % in this reading. The two readings differ in how strictly "same main revenue model" was read, so the same layer looks different against them, and these verdicts decide nothing.
