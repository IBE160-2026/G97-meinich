# Figure audit — PRD Peerless

Reviewed 2026-09-29. Every quantity in `prd.md` checked against
`analysis/output/industry-screening.md`, `docs/key-figures.md`,
`docs/data-sources-brreg.md` and `technical-note-architecture.md`.

Screening quartiles were not taken on trust: they were recomputed from
`analysis/output/sample-accounts-{62100,69202,43210}.csv` with
`statistics.quantiles(..., n=4)`, the same inclusive method
`analysis/industry_screening.py` uses. All nine margin quartiles and all nine
revenue-per-employee quartiles in the screening document reproduce exactly.

| Industry | comparable n | margin Q1 / med / Q3 | rev/emp Q1 / med / Q3 | revenue median | employees median |
|---|---|---|---|---|---|
| 62.100 | 94 | −45.7 % / −3.2 % / 9.1 % | 630 014 / 1 390 898 / 2 125 447 | 17 431 505 | 12 |
| 69.202 | 99 | 2.9 % / 9.7 % / 15.3 % | 881 589 / 1 159 406 / 1 443 366 | 10 505 921 | 9 |
| 43.210 | 98 | 1.1 % / 4.6 % / 10.8 % | 1 322 513 / 1 530 497 / 1 919 396 | 24 628 718 | 14 |

**Verdict: two high-severity figure errors, both in UJ-4, both of the same
family as the two caught in the brief validation on 2026-09-26.** UJ-1 and UJ-2
are arithmetically and sourcewise clean — every kroner amount, quartile,
median and derived company size checks out. Everything else in the document is
sound apart from one numbering contradiction and a set of low-severity
labelling and precision nits.

---

## High

### H1 — UJ-4 quotes the wrong industry's peer median

- **Location:** §2.3, UJ-4, Climax (line 107).
- **As written:** "the peers' latest full year median of **9.7 %** sit alongside as context".
- **What the source says:** UJ-4's protagonist Tore "owns the company in UJ-1"
  (line 104). UJ-1's company is a software company under `62.100` (line 76).
  The operating-margin median for `62.100` in `industry-screening.md` §4 is
  **−3.2 %**. 9.7 % is the median for `69.202 Regnskapsføring og bokføring` —
  the industry of the *other* journey's company, used correctly in UJ-2 (line 88).
- **Correct value:** −3.2 % if the company stays in `62.100`; 9.7 % is only
  right if UJ-4 is re-pointed at the UJ-2 company.
- **Why it matters beyond the digit:** the sign flips the point of the journey.
  Against −3.2 % Tore's 11.2 % year-to-date is far ahead of his industry;
  against 9.7 % he is barely at par. It also contradicts UJ-1's own climax,
  which is built on the observation that the `62.100` median is *negative*
  ("Beating a loss-making industry average told her nothing", line 79). Two
  journeys about the same company now disagree about whether its peers make
  money.
- **Severity: HIGH.** Wrong figure, wrong source industry, and it inverts the
  reader's conclusion.

### H2 — UJ-4's "own last filed full year" contradicts UJ-1

- **Location:** §2.3, UJ-4, Climax (line 107).
- **As written:** "His own last filed full year, **8.9 %**".
- **What the PRD says elsewhere:** UJ-1, analysing the same company's latest
  filing, states "Her **2.1 %** operating margin" (line 79). FR-25 fixes the
  benchmark year as "the subject's latest filed year", so both journeys are
  reading the same filing. 8.9 % and 2.1 % cannot both be it.
- **Correct value:** 2.1 %, to agree with UJ-1 — or UJ-1's figure changed, in
  which case its 7.0-point gap and 1.17 m kroner amount must be recomputed too.
- **Note on sourcing:** 8.9 % is not in any source document. That is permitted
  by §2.3's own rule — "The subject companies' own margins are invented" — and
  by §12. The defect is the internal contradiction, not the invention.
- **Severity: HIGH.** A number contradicting another number inside the same
  document, on the figure the product's headline arithmetic runs on.

---

## Medium

### M1 — UJ-4's seasonality example names the wrong industry

- **Location:** §2.3, UJ-4, "What it deliberately will not do" (line 110).
- **As written:** "In `69.202` that matters — the accounting year is
  front-loaded".
- **Problem:** Tore's company is in `62.100`. Read alone this is a general
  remark about a different industry; read next to H1 it is the third trace of
  the same slip — UJ-4's figures and reasoning appear to have been drafted for
  the `69.202` company of UJ-2 and then attached to UJ-1's. Front-loading is
  also not a claim any source document makes about `69.202`; it is unsourced
  domain assertion, not screening data.
- **Severity: MEDIUM.** Not arithmetic, but it is the evidence that H1 is a
  systematic mix-up rather than a typo, and the claim itself has no source.

### M2 — The FR range in §4 contradicts §0, and the document

- **Location:** §4 preamble (line 174) versus §0 (line 25).
- **As written:** §4: "Requirements are numbered globally **FR-1 to FR-63**."
  §0: "numbered globally **FR-1 to FR-67**".
- **What the document contains:** 67 `#### FR-n` headings, n = 1…67 with no
  gaps (verified by extracting and sorting every heading). FR-64 to FR-67 all
  exist and are all cited from elsewhere.
- **Correct value:** FR-1 to FR-67. §0 is right; §4 is stale.
- **Severity: MEDIUM.** Downstream epics are told to cite stable FR IDs; a
  stated ceiling four below the real one invites a new requirement to be
  numbered on top of an existing one, which §0 forbids explicitly.

### M3 — UJ-2's kroner amount does not state the closable share it assumes

- **Location:** §2.3, UJ-2, Climax (line 88).
- **As written:** "a gap of 12.8 points, about **1.34 million kroner a year**."
- **Arithmetic (correct as far as it goes):** 15.3 % − 2.5 % = 12.8 points;
  9 × 1 159 406 = 10 434 654 kr revenue; 0.128 × 10 434 654 = **1 335 636 kr**
  → 1.34 m. Correct.
- **Problem:** FR-31 and `docs/key-figures.md` make the amount
  `(T − r) × sumDriftsinntekter × s`, with s user-set. At s = 0 the amount is
  zero; 1.34 m exists only at s = 1. UJ-1 says "at full convergence" for
  exactly this reason (line 79); UJ-2 omits it, so the figure reads as *the*
  gap value rather than the value at one setting of the control. This is the
  ambiguity open question 6 was closed to remove.
- **Fix:** add "at full convergence" to UJ-2, as UJ-1 has.
- **Severity: MEDIUM.** The number is right; the missing qualifier is what made
  `docs/key-figures.md` defensibly wrong before 2026-09-26.

---

## Low

### L1 — "a comparability-filtered sample of 100" overstates the n behind the quartiles

- **Location:** §2.3, grounding paragraph (line 71).
- **What the source does:** `analysis/industry_screening.py` draws a random
  sample of 100 (seed 160) and then computes the margin and revenue-per-employee
  quartiles over `comparable` only — the companies passing the comparability
  filter. That is **94** in `62.100` and **99** in `69.202`, not 100. Confirmed
  in the script (`margins = [... for c in comparable ...]`) and reproduced from
  the CSVs.
- **Correct wording:** a random sample of 100 per industry, of which the 94 and
  99 passing the comparability filter supply the quartiles.
- **Severity: LOW.** Sourcing precision, no figure changes.

### L2 — An industry-wide median is labelled a "peer median"

- **Location:** §2.3, UJ-2 Climax ("a **peer median** of 9.7 %", line 88) and
  UJ-4 Climax ("the **peers'** latest full year median", line 107).
- **Problem:** the grounding paragraph is explicit that "the quartiles are
  **industry-wide**, standing in for a peer group that is by construction
  narrower". §3 fixes **Median** as "the peer median for a key figure". Calling
  the industry figure a peer median inside the journey contradicts the caveat
  two paragraphs above it, and a reader checking the screening file will find
  no peer group behind it. UJ-1 handles this correctly — it says "the industry
  median" (line 79).
- **Fix:** say "industry median" in UJ-2 and UJ-4, as UJ-1 does.
- **Severity: LOW** (would be Medium if the grounding caveat were absent).

### L3 — "industry average" for a median

- **Location:** §2.3, UJ-1 Climax, "Beating a loss-making industry **average**"
  (line 79), one sentence after quoting "the industry **median** of −3.2 %".
- **Problem:** the screening file publishes a median, never a mean. §3 states
  that "Introducing a synonym anywhere is a discipline violation". The mean
  margin for `62.100` is not published and, given a Q1 of −45.7 %, would be
  materially different from −3.2 %.
- **Fix:** "industry median".
- **Severity: LOW.** Wording, but it is the vocabulary rule the PRD sets itself.

### L4 — "Around a dozen measures" against 14 + 1

- **Location:** §4.3 Description (line 345).
- **What the source says:** `docs/key-figures.md` defines 14 numbered figures
  plus the unnumbered cash share = 15, which §3 and FR-21 both state correctly.
- **Severity: LOW.** Loose prose, internally contradicted by two precise
  statements in the same document. "Fifteen measures" or "fourteen numbered
  measures" would remove the discrepancy.

### L5 — FR-5 cites FR-20 for a claim FR-20 does not make

- **Location:** FR-5, last consequence (line 225): "Every other classification
  happens at ingestion (FR-20)."
- **Problem:** FR-20 is *Peer group assembly latency*. Its consequences say no
  peer is classified during a request, which is the negative; no FR positively
  requires classification at ingestion. The technical note does
  ("Classification runs once per company at ingestion"), so the requirement is
  real but uncited.
- **Severity: LOW.** Cross-reference precision, not a quantity.

### L6 — "ten OCR-sourced field names" — correct, but only on one reading

- **Location:** §11.14 (line 933).
- **What the source shows:** the Source fields table in `docs/key-figures.md`
  marks **11 rows** OCR. Ten are distinct field names; the eleventh is
  `sumDriftsinntekter` (prior year), the same name read from the prior-year
  column. So "ten OCR-sourced field names" is right by distinct name and wrong
  by row count.
- **Severity: LOW / informational.** No change required; noted so a later
  reader does not "correct" it to eleven.

### L7 — Percent-sign spacing inconsistent

- **Location:** §10 (line 905) "56%", "38%", "50%"; §5 (line 797) "25%" —
  against the "88 %", "9.1 %" style used throughout the rest of the document,
  and against `docs/data-sources-brreg.md`, which writes "at most 56 %".
- **Severity: LOW.** Cosmetic only.

---

## Verified correct — arithmetic shown

Nothing below needs changing. Recorded so the next reviewer does not redo it.

**UJ-1 (§2.3, `62.100`) — clean.**

- Employees 12 equals the median employee count of the comparable `62.100`
  sample (recomputed: 12.0). Representative.
- Revenue: 12 × 1 390 898 = **16 690 776 kr** → "near 16.7 million". Correct.
  Corroborated: the sample's own median revenue is 17 431 505 kr, 4.4 % above
  the derived figure. The company is the size the product serves.
- Median −3.2 % and favourable quartile 9.1 % both match `62.100` §4.
- **Direction correct:** operating margin is ↑ in `docs/key-figures.md`, so the
  favourable quartile is the **upper** quartile — 9.1 % is Q3.
- Gap: 9.1 − 2.1 = **7.0 points** → "a gap of seven points". Correct.
- Kroner: 0.070 × 16 690 776 = **1 168 354 kr** → "about 1.17 million".
  Correct. The PRD's own parenthetical, 7.0 % × 16.7 m = 1 169 000, agrees.
- "at full convergence" correctly pins s = 1 per FR-31.
- Edge case "fewer than ten peers" matches the 10-peer floor in FR-22, §3 and
  the technical note.

**UJ-2 (§2.3, `69.202`) — clean, subject to M3.**

- Employees 9 equals the median employee count of the comparable `69.202`
  sample (recomputed: 9). Representative.
- Revenue: 9 × 1 159 406 = **10 434 654 kr** → "around 10.4 million". Correct.
  Corroborated: sample median revenue 10 505 921 kr, 0.7 % away.
- Median 9.7 % and favourable quartile 15.3 % both from `69.202` §4, upper
  quartile as the ↑ direction requires.
- Gap 15.3 − 2.5 = **12.8 points**; 0.128 × 10 434 654 = **1 335 636 kr** →
  "about 1.34 million". Correct.

**UJ-3** quotes no quantities.

**UJ-4** figures: 11.2 % and 10.1 % are invented subject figures, permitted by
§2.3 and §12, and mutually consistent (year-to-date up on the like-for-like
period). 8.9 % and 9.7 % are H2 and H1.

**Elsewhere**

- §6.1: `62.100` "about 1 000 companies with five or more employees" — 1003.
  `69.202` "about 800" — 797. Both match the technical note.
- §10: "at most 56% … 38% … 50%" — screening reports 56 %, 38 %, 50 %, and
  `data-sources-brreg.md` gives the same three with the same "at most".
- FR-28: "the last five years, 2021–2025 … about 88 % of columns reconcile" —
  `data-sources-brreg.md` combined read, 2021–2025: 88 %. Consistent with open
  question 10 and with the technical note.
- FR-28 "peer history is fetched every other year" — 3 documents × 2 columns
  covers 6 years (2020–2025), so 2021–2025 is covered. The screening's
  `(TREND_YEARS + 1) // 2 = 3` documents per company agrees.
- FR-57 and §3: mean OCR confidence **0.974** — matches
  `data-sources-brreg.md` and the technical note.
- §8 and §11.19: "twelve of the fifteen key figures" from documents —
  15 figures (14 numbered + cash share), API-only are 1, 12, 13, leaving 12
  OCR-dependent. Agrees with §3's "Three of the 14 are API-only: operating
  margin, return on assets, equity ratio".
- FR-22, §3, §6.1, open question 8: minimum group size **10**, per key figure —
  matches the technical note's "Minimum group size: 10 peers".
- FR-38: four required components yield operating margin, return on assets and
  equity ratio — exactly the three API-sourced figures.
- FR-27 and §3: the no-direction set (personnel cost per FTE, equity ratio,
  revenue growth, cash share) matches `docs/key-figures.md` figures 8, 13, 14
  and cash share. Direction rule stated correctly: upper quartile where higher
  is better, lower where lower is better.
- FR-27 and §3 percentile formula `(peers worse + 0.5 × peers equal) / peers
  × 100` — verbatim from `docs/key-figures.md`.
- §3 glossary money formulas: annual profit uplift
  `(T − r) × sumDriftsinntekter × s`; working capital released covers
  receivable days, payable days and operating asset turnover — the three
  figures marked "Capital"; target always the favourable quartile.
- FR-30 no-double-counting set {operating margin, cost of goods share,
  personnel cost share, other operating cost share} matches figures 1 and 3–5.
- §5 excluded key figures — cash flow, gearing, interest cover, return on
  equity, ROIC, inventory days — matches `docs/key-figures.md` exactly.
- §5: receivables overstated by VAT "up to 25%" matches both authoritative
  documents.
- FR-55, §7, SM-7: 375px.
- §0 "thirteen-week schedule" matches the technical note's thirteen weeks.
- §9 SM-1's four funnel layers, in order, match the technical note's
  layer-by-layer ablation.
- The screening document is itself internally consistent: est. comparable =
  population × sample comparable share (1003 × 0.94 → 942; 797 × 0.99 → 789;
  1325 × 0.98 → 1298), filings = 3 × est. comparable, pages = 3 × filings
  (942 → 2826 → 8478; 789 → 2367 → 7101; 1298 → 3894 → 11682). None of these
  appear in the PRD, so nothing to contradict.

---

## Counts

| Severity | Count | Findings |
|---|---|---|
| High | 2 | H1, H2 |
| Medium | 3 | M1, M2, M3 |
| Low | 7 | L1–L7 |
| **Total** | **12** | |

All four §2.3 journeys' kroner arithmetic recomputed; UJ-1 and UJ-2 are correct
to the last digit and representative of the served population. The failure is
concentrated in UJ-4, where the peer statistics of `69.202` were applied to a
`62.100` company and the subject's own filed margin drifted from UJ-1's.
