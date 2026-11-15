# Layer-by-layer measurement, 62.100 (SM-1)

Generated 2026-11-15 by `scripts/layer-measurement.ts` (`pnpm analysis:layers`) at commit `cccccccccccccccccccccccccccccccccccccccc`, with the reads in `scripts/layer-measurement-compute.ts`. Inputs: `analysis/labelled-set/drawn.json`, `analysis/labelled-set/labels-blind.csv`, `analysis/labelled-set/labels-revenue-model.csv` and `analysis/labelled-set/labels.csv` (Story 5.1), and the local database read as `reader`. The definitions were fixed in the Story 5.2 spec before the first run on the real labels. Totals only: no company, label, classification or fingerprint is given per orgnr.

This measures the funnel as it is and states no numeric target (NFR32).

## The labels

- 2 subjects and 10 labelled pairs from `analysis/labelled-set/drawn.json`.
- The measure is 10 pairs: the blind pairs, labelled by Meinich from description and website only, and the other pairs, whose label is computed from `analysis/labelled-set/labels-revenue-model.csv` by the README rule. A ChatGPT model (OpenAI, version not recorded) filled in those revenue models, and Meinich went through and accepted them; nobody else labelled. For those pairs, the text layer (stage 5, a Claude model) is therefore one AI measured against another; the fingerprint and the industry code are not AI.
- There is no second labeller and no Cohen's κ in v1 (stage 2), so nothing here checks one labeller against another.
- Round 1 (`analysis/labelled-set/labels.csv`, 3 pairs) is shown below as "den strengere lesningen" and decides nothing.
- `usikker` is left out of precision and recall and counted; a sensitivity table counts it as `ja` and as `nei`.

## How the layers are read

Each subject is read as the analysis page reads it and assembled by `assemblePeerGroup(…, 0)` (`src/engine/peers.ts`) at the Standard size band, with both signals on: stage 4 and stage 5 as built, which is what is measured. In v1 both signals are switched off after this measurement (`V1_FUNNEL`), so v1's group is the stage 1–3 pool (L1).

- **L1** includes a pair when the candidate is in today's stage 1–3 pool. Every labelled candidate was drawn from that pool.
- **L2** includes it when the fingerprint signal is not `false`: the funnel with the subject's classification switched off. A missing fingerprint, an undetermined type or a subject with no type is a null signal, and the pair is kept.
- **L3** includes it when the text signal is not `false`: the funnel with the subject's fingerprint switched off. `uklart`, a missing row and a subject with no type are null, and the pair is kept.
- **L2+L3** is `group`, the funnel as the app runs it; flagged pairs are shown apart from the rest of `group`.
- Precision is `ja` / (`ja` + `nei`) among the included pairs; recall is the included `ja` / all `ja`, so recall counts within the stage 1–3 pool. "ikke definert" means there is no pair to divide by, never 0.

Labelled companies with a fingerprint for the labelled year: 11 of 12.
Labelled candidates not in today's pool: 1 of 10. They are in no layer, so a `ja` among them counts against every layer's recall.

**SM-1b.** An industry-code-only baseline also includes every labelled pair, so on these pairs it equals L1, the base rate. The size band and stage 2 cannot be judged with this draw. SM-1b is the funnel against that base rate: a check, not a claim.

## The layers (the measure)

10 pairs of 2 subjects: 4 ja, 4 nei, 2 usikker (left out of precision and recall, and counted).

### All pairs

2 subjects, 10 pairs (100,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 9 | 3 | 4 | 2 | 42,9 % | 75,0 % |
| L2 fingerprint alone | 7 | 3 | 2 | 2 | 60,0 % | 75,0 % |
| L3 classification alone | 6 | 2 | 2 | 2 | 50,0 % | 50,0 % |
| L2+L3 the funnel (`group`) | 7 | 3 | 2 | 2 | 60,0 % | 75,0 % |
| `group`, not flagged | 5 | 2 | 1 | 2 | 66,7 % | 50,0 % |
| flagged ("Usikker klassifisering") | 2 | 1 | 1 | 0 | 50,0 % | 25,0 % |

### Informative descriptions

1 subjects, 7 pairs (70,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 6 | 2 | 3 | 1 | 40,0 % | 66,7 % |
| L2 fingerprint alone | 4 | 2 | 1 | 1 | 66,7 % | 66,7 % |
| L3 classification alone | 3 | 1 | 1 | 1 | 50,0 % | 33,3 % |
| L2+L3 the funnel (`group`) | 4 | 2 | 1 | 1 | 66,7 % | 66,7 % |
| `group`, not flagged | 2 | 1 | 0 | 1 | 100,0 % | 33,3 % |
| flagged ("Usikker klassifisering") | 2 | 1 | 1 | 0 | 50,0 % | 33,3 % |

### Uninformative descriptions

1 subjects, 3 pairs (30,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 3 | 1 | 1 | 1 | 50,0 % | 100,0 % |
| L2 fingerprint alone | 3 | 1 | 1 | 1 | 50,0 % | 100,0 % |
| L3 classification alone | 3 | 1 | 1 | 1 | 50,0 % | 100,0 % |
| L2+L3 the funnel (`group`) | 3 | 1 | 1 | 1 | 50,0 % | 100,0 % |
| `group`, not flagged | 3 | 1 | 1 | 1 | 50,0 % | 100,0 % |
| flagged ("Usikker klassifisering") | 0 | 0 | 0 | 0 | ikke definert | 0,0 % |

### Blind pairs (labelled by a person)

1 subjects, 7 pairs (70,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 6 | 2 | 3 | 1 | 40,0 % | 66,7 % |
| L2 fingerprint alone | 4 | 2 | 1 | 1 | 66,7 % | 66,7 % |
| L3 classification alone | 3 | 1 | 1 | 1 | 50,0 % | 33,3 % |
| L2+L3 the funnel (`group`) | 4 | 2 | 1 | 1 | 66,7 % | 66,7 % |
| `group`, not flagged | 2 | 1 | 0 | 1 | 100,0 % | 33,3 % |
| flagged ("Usikker klassifisering") | 2 | 1 | 1 | 0 | 50,0 % | 33,3 % |

## Sensitivity: usikker as ja and as nei (the measure, all pairs)

| Layer | Precision, as ja | Recall, as ja | Precision, as nei | Recall, as nei |
|---|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 55,6 % | 83,3 % | 33,3 % | 75,0 % |
| L2 fingerprint alone | 71,4 % | 83,3 % | 42,9 % | 75,0 % |
| L3 classification alone | 66,7 % | 66,7 % | 33,3 % | 50,0 % |
| L2+L3 the funnel (`group`) | 71,4 % | 83,3 % | 42,9 % | 75,0 % |
| `group`, not flagged | 80,0 % | 66,7 % | 40,0 % | 50,0 % |
| flagged ("Usikker klassifisering") | 50,0 % | 16,7 % | 50,0 % | 25,0 % |

## Why a signal is null (pairs in the pool)

| Fingerprint signal (L2) | Pairs |
|---|---:|
| `subject_no_type` | 0 |
| `undetermined` | 0 |
| `no_fingerprint:document_absent` | 1 |
| `no_fingerprint:document_refused` | 0 |
| `no_fingerprint:document_paper` | 0 |
| `no_fingerprint:document_failed` | 0 |
| `no_fingerprint:document_not_reconciled` | 0 |
| `no_fingerprint:reconciled_not_derived` | 0 |
| signal present | 8 |

| Text signal (L3) | Pairs |
|---|---:|
| `subject_no_type` | 0 |
| `uklart` | 1 |
| `no_row` | 0 |
| `no_text` | 0 |
| `failed` | 0 |
| `pending` | 0 |
| signal present | 8 |

`no_fingerprint:reconciled_not_derived` is a reconciled document that `pnpm derive` gave no fingerprint (R2, or a negative unexplained remainder).

## The stage-5 rule

Fixed in the PRD (§9) before any result: on all measure pairs, `usikker` left out, *fingerprint alone* (L2) against *fingerprint and text* (`group`). Stage 5 is kept if and only if precision rises by at least 3,0 pp and recall falls by at most 3,0 pp, both bounds inclusive, compared exactly. The rule is never re-tuned.

| | Precision | Recall |
|---|---:|---:|
| Fingerprint alone (L2) | 60,0 % (3/5) | 75,0 % (3/4) |
| Fingerprint and text (`group`) | 60,0 % (3/5) | 75,0 % (3/4) |
| Difference | 0,000 pp (3/5 − 3/5) | 0,000 pp (3/4 − 3/4) |

A difference of 0,000 pp shows as 0,0 pp at one decimal; the rule compares the exact value.

**Verdict: stage 5 is not kept.**

## The bands (FR-13)

Each band is left out by widening it to low–high in memory, in the subject's fingerprint and every candidate's, before the funnel runs; the rule is unchanged, so a type that depended on the band becomes undetermined and the pair is kept. The rule is applied to L2 only, never to `group`, so the text cannot hide what the band does: a band is recommended kept if L2 with it has at least 3,0 pp higher precision and at most 3,0 pp lower recall than L2 without it, and dropped otherwise. The rule gives a recommendation; Meinich decides (FR-13). The stored fingerprints and `src/engine/fingerprint.ts` are unchanged.

### Cost of goods share band

| | Precision | Recall |
|---|---:|---:|
| L2 without the band | 42,9 % (3/7) | 75,0 % (3/4) |
| L2 with the band | 60,0 % (3/5) | 75,0 % (3/4) |
| Difference (with − without) | +17,143 pp (3/5 − 3/7) | 0,000 pp (3/4 − 3/4) |

In practice "without the band" here became "without the fingerprint". The type rule reads the cost-of-goods band first (high is `forhandler`, low never is), so a fingerprint with this band widened to low–high can always give `forhandler` and another type, and its type is undetermined. Without the band the fingerprint signal is null for 9 of 9 pairs in the pool, against 1 with it. This test therefore cannot tell the band apart from the fingerprint. No definition is changed.

**Recommendation: kept.**

### Personnel cost share band

| | Precision | Recall |
|---|---:|---:|
| L2 without the band | 42,9 % (3/7) | 75,0 % (3/4) |
| L2 with the band | 60,0 % (3/5) | 75,0 % (3/4) |
| Difference (with − without) | +17,143 pp (3/5 − 3/7) | 0,000 pp (3/4 − 3/4) |

The type rule reads the personnel-cost band only to tell `konsulent` (personnel cost mid or high, cost of goods low) from `annet`, so widening it leaves those types undetermined and keeps `forhandler` and `produkt`. Without the band the fingerprint signal is null for 9 of 9 pairs in the pool, against 1 with it. The closer the first count is to all pairs, the more "without the band" is again "without the fingerprint", and the less this test can tell the band apart from the fingerprint. No definition is changed.

**Recommendation: kept.**

### The decision

Meinich (2026-11-15) followed the band rule's recommendation in the form that changes the group least: the fingerprint signal is switched off in v1, like the text signal, instead of dropping the bands with a migration; `src/engine/fingerprint.ts`, the bands, the stored fingerprints and `pnpm derive` are unchanged, so a later stage can measure again. Meinich decided it from the rule and the blind pairs (66,7 % against 40,0 % precision, 0,0 pp recall, cost-of-goods band with against without), and because the band test cannot tell one band from the fingerprint. v1's group is therefore the stage 1–3 pool.

## The rules on the blind pairs alone (informational)

The 7 blind pairs, labelled by a person from description and website only. The rules are decided on all pairs; this decides nothing.

### Stage 5

| | Precision | Recall |
|---|---:|---:|
| Fingerprint alone (L2) | 66,7 % (2/3) | 66,7 % (2/3) |
| Fingerprint and text (`group`) | 66,7 % (2/3) | 66,7 % (2/3) |
| Difference | 0,000 pp (2/3 − 2/3) | 0,000 pp (2/3 − 2/3) |

Stage-5 rule on these pairs: stage 5 is not kept.

### Cost of goods share band

| | Precision | Recall |
|---|---:|---:|
| L2 without the band | 40,0 % (2/5) | 66,7 % (2/3) |
| L2 with the band | 66,7 % (2/3) | 66,7 % (2/3) |
| Difference (with − without) | +26,667 pp (2/3 − 2/5) | 0,000 pp (2/3 − 2/3) |

Band rule on these pairs: kept.

### Personnel cost share band

| | Precision | Recall |
|---|---:|---:|
| L2 without the band | 40,0 % (2/5) | 66,7 % (2/3) |
| L2 with the band | 66,7 % (2/3) | 66,7 % (2/3) |
| Difference (with − without) | +26,667 pp (2/3 − 2/5) | 0,000 pp (2/3 − 2/3) |

Band rule on these pairs: kept.

## The verdicts with usikker counted (informational)

The same rules on all measure pairs with `usikker` counted as `ja` and as `nei`. The verdicts above leave `usikker` out and decide; these decide nothing.

| Rule | usikker left out (decides) | usikker as ja | usikker as nei |
|---|---|---|---|
| Stage 5 | stage 5 is not kept | stage 5 is not kept (same) | stage 5 is not kept (same) |
| Cost of goods share band | kept | kept (same) | kept (same) |
| Personnel cost share band | kept | kept (same) | kept (same) |

## Round 1: den strengere lesningen

The first round of the non-blind pairs, labelled by a person more specifically than the rubric (README, "Labelling record"). Shown for comparison; it decides nothing.

3 pairs of 1 subjects: 1 ja, 2 nei, 0 usikker (left out of precision and recall, and counted).

### All pairs

1 subjects, 3 pairs (100,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| L2 fingerprint alone | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| L3 classification alone | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| L2+L3 the funnel (`group`) | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| `group`, not flagged | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| flagged ("Usikker klassifisering") | 0 | 0 | 0 | 0 | ikke definert | 0,0 % |

### Informative descriptions

0 subjects, 0 pairs (0,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 0 | 0 | 0 | 0 | ikke definert | ikke definert |
| L2 fingerprint alone | 0 | 0 | 0 | 0 | ikke definert | ikke definert |
| L3 classification alone | 0 | 0 | 0 | 0 | ikke definert | ikke definert |
| L2+L3 the funnel (`group`) | 0 | 0 | 0 | 0 | ikke definert | ikke definert |
| `group`, not flagged | 0 | 0 | 0 | 0 | ikke definert | ikke definert |
| flagged ("Usikker klassifisering") | 0 | 0 | 0 | 0 | ikke definert | ikke definert |

### Uninformative descriptions

1 subjects, 3 pairs (100,0 % of the pairs).

| Layer | Included | ja | nei | usikker | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| L1 industry code and size (the stage 1–3 pool) | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| L2 fingerprint alone | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| L3 classification alone | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| L2+L3 the funnel (`group`) | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| `group`, not flagged | 3 | 1 | 2 | 0 | 33,3 % | 100,0 % |
| flagged ("Usikker klassifisering") | 0 | 0 | 0 | 0 | ikke definert | 0,0 % |
