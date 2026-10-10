# Key figures — definitions

The calculation engine implements exactly these definitions. Change this document and the code in the same commit. Field names are the register's own; names marked *OCR* come from the Brreg-generated section of the filed document and are **provisional until confirmed against a real filing**.

## General rules

**Same basis for subject and peers.** A key figure's *comparison* — median, favourable quartile, percentile and any kroner amount — is shown only if the figure can be computed for the subject and for at least the minimum group size of peers, 10, from the same source. The count is taken per key figure, after companies with an undefined value are left out. A figure the subject has from OCR and the peers do not gets no comparison. The subject's own value is still shown, with the count of comparable values and the reason the comparison is absent: withholding a comparison is not the same as withholding the company's own figure.

**Same year.** The benchmark year is the subject's latest filed year. Peers use the same year; a peer without it is excluded. Only calendar-year filings pass the comparability filter. User-entered current-year figures are compared against the peers' latest filed year, with the difference in periods stated.

**Partial periods are never scaled.** Owner-entered year-to-date figures are used for the period they cover and are never annualised, so they yield ratios only and no kroner amount — a kroner translation needs a twelve-month revenue base. The primary comparison is the company's own same period in the previous year, entered by the owner, so that seasonality largely cancels; the company's last filed full year and the peer distribution are context only, labelled as whole years rather than the same period. No adjustment is made for seasonality or any other external factor.

**Closing balances.** Balance sheet items are taken at year end, not averaged. The key figures API gives only the latest year, so an average would not be available for every peer.

**Undefined is not zero.** If a denominator is zero or negative, or a component is missing and cannot be derived from its stated total, the key figure is undefined for that company. The company is left out of that figure's distribution, and the number left out is shown.

**Arithmetic.** Amounts are integers in øre. Ratios are computed with a decimal library and rounded only for display: percentages to one decimal, days to whole days, kroner to whole kroner. **Exception: the percentile is shown in whole percent** ("bedre enn 61 %"), because with a peer group of around twenty a decimal is false precision; it is computed exactly and rounded only for display.

**Distribution.** Median and quartiles use linear interpolation between order statistics (the inclusive method, as `PERCENTILE.INC` in Excel), so every figure can be checked in a spreadsheet. The *favourable quartile* is the upper quartile where higher is better and the lower quartile where lower is better.

**Percentile.** The share of peers the subject does better than, counting ties as half: (peers worse + 0.5 × peers equal) / peers × 100, in the favourable direction.

## Source fields

| Field | Meaning | Source |
|---|---|---|
| `sumDriftsinntekter` | Total operating revenue | API |
| `driftsresultat` | Operating profit (EBIT) | API |
| `sumEiendeler` | Total assets | API |
| `sumEgenkapital` | Total equity | API |
| `salgsinntekt` | Sales revenue | OCR |
| `varekostnad` | Cost of goods sold | OCR |
| `lonnskostnad` | Personnel costs | OCR |
| `avskrivninger` | Depreciation and amortisation | OCR |
| `nedskrivninger` | Impairment | OCR |
| `annenDriftskostnad` | Other operating expenses | OCR |
| `kundefordringer` | Trade receivables | OCR |
| `bankinnskudd` | Bank deposits and cash | OCR |
| `leverandorgjeld` | Trade payables | OCR |
| `aarsverk` | Full-time equivalents, one decimal, from the notes | OCR |
| `sumDriftsinntekter` (prior year) | From the prior-year column of the same document | OCR |

## Key figures

Direction: ↑ higher is better, ↓ lower is better, – no direction.

### Margin

| # | Key figure | Formula | Source | Dir. | Kroner |
|---|---|---|---|---|---|
| 1 | Operating margin | `driftsresultat / sumDriftsinntekter` | API | ↑ | Profit |
| 2 | EBITDA margin | `(driftsresultat + avskrivninger + nedskrivninger) / sumDriftsinntekter` | OCR | ↑ | – |

### Cost structure

| # | Key figure | Formula | Source | Dir. | Kroner |
|---|---|---|---|---|---|
| 3 | Cost of goods share | `varekostnad / sumDriftsinntekter` | OCR | ↓ | None of its own; a bar in the margin decomposition |
| 4 | Personnel cost share | `lonnskostnad / sumDriftsinntekter` | OCR | ↓ | None of its own; a bar in the margin decomposition |
| 5 | Other operating cost share | `annenDriftskostnad / sumDriftsinntekter` | OCR | ↓ | None of its own; a bar in the margin decomposition |
| 6 | Total cost share *(check)* | `(varekostnad + lonnskostnad + annenDriftskostnad) / sumDriftsinntekter` | OCR | ↓ | – |

### Productivity

| # | Key figure | Formula | Source | Dir. | Kroner |
|---|---|---|---|---|---|
| 7 | Revenue per FTE | `sumDriftsinntekter / aarsverk` | OCR | ↑ | – |
| 8 | Personnel cost per FTE | `lonnskostnad / aarsverk` | OCR | – | – |

### Working capital

| # | Key figure | Formula | Source | Dir. | Kroner |
|---|---|---|---|---|---|
| 9 | Receivable days | `kundefordringer / salgsinntekt × 365` | OCR | ↓ | Capital |
| 10 | Payable days | `leverandorgjeld / (varekostnad + annenDriftskostnad) × 365` | OCR | ↑ | Capital |

### Capital efficiency and strength

| # | Key figure | Formula | Source | Dir. | Kroner |
|---|---|---|---|---|---|
| 11 | Operating asset turnover | `sumDriftsinntekter / (sumEiendeler − bankinnskudd)` | OCR | ↑ | Capital |
| 12 | Return on assets | `driftsresultat / sumEiendeler` | API | ↑ | – |
| 13 | Equity ratio | `sumEgenkapital / sumEiendeler` | API | – | – |
| – | Cash share | `bankinnskudd / sumEiendeler` | OCR | – | – |

Cash share carries no number because it is a diagnostic rather than a benchmarked figure: it is shown as context, is never ranked, and produces no kroner amount.

### Context

| # | Key figure | Formula | Source | Dir. | Kroner |
|---|---|---|---|---|---|
| 14 | Revenue growth | `sumDriftsinntekter / sumDriftsinntekter(prior year) − 1` | OCR | – | – |

Revenue growth has no direction: fast growth often explains a weak margin, and the analysis shows the two side by side rather than ranking growth.

**A figure with no declared direction gets no favourable quartile and no percentile.** Both are defined in the favourable direction, so neither exists where the direction is genuinely arguable — personnel cost per FTE (8), equity ratio (13), revenue growth (14) and cash share. These figures show the subject's value and the peer median and quartiles as a distribution, and are never ranked or converted to kroner.

## Decompositions

Both hold exactly, and the engine's tests assert them:

- **Return on assets** = operating margin × (`sumDriftsinntekter / sumEiendeler`). Defined without financial income for this reason.
- **Personnel cost share** = personnel cost per FTE ÷ revenue per FTE. Separates paying more per person from producing less per person.

**Each factor is compared with its own median, and the factors are never multiplied together.** The median margin times the median asset turnover is not the median return on assets, so the decomposition shows the subject's two factors side by side with the peers' median of each, and no single peer is presented as the benchmark. Asset turnover here is `sumDriftsinntekter / sumEiendeler` — total assets, not key figure 11's operating assets. **Total asset turnover is a derived factor of this decomposition, not a numbered key figure.** It follows the same-basis rule and the minimum group size, and shows a median and the count of peers behind it, but it has no favourable quartile, no percentile and no kroner amount, and it is never labelled as key figure 11.

### Margin decomposition against the peer group as a whole

The cost shares explain the operating margin. They are not compared with the favourable quartile in kroner, because quartiles are not additive: each cost share's quartile comes from different companies, so their kroner amounts could sum to more than the margin gap they explain. Instead the margin difference is decomposed against **the peer group as a whole** (*peer-gruppen samlet*), which is additive by construction.

- **Common peer set *P*.** Peers whose `driftsresultat`, `varekostnad`, `lonnskostnad` and `annenDriftskostnad` all come from the same reconciled filing for the benchmark year, with `sumDriftsinntekter` > 0. Every bar uses the same set. If *P* has fewer than 10 peers, or the subject lacks any component, no decomposition is shown and the count is stated.
- **Components**, each as a share of `sumDriftsinntekter`: cost of goods (3), personnel (4), other operating (5), and **depreciation and other items**, defined as the residual (`sumDriftsinntekter` − `driftsresultat` − `varekostnad` − `lonnskostnad` − `annenDriftskostnad`) / `sumDriftsinntekter`. Defining the fourth as the residual makes operating margin = 1 − the four shares hold exactly for every company.
- **The peer group as a whole**, per component *x*: *A*ₓ = Σ*P* numeratorₓ / Σ*P* `sumDriftsinntekter`, and the margin *M* = Σ*P* `driftsresultat` / Σ*P* `sumDriftsinntekter`. A revenue-weighted aggregate, not a mean of ratios: a mean is dominated by peers with very little revenue (in the `62.100` screening sample the mean margin is −660 % against a median of −3.2 %), while within the default size band no peer weighs more than four times another (sixteen at the widest step).
- **Bars.** For each component, (*A*ₓ − *c*ₓ) × the subject's `sumDriftsinntekter`, where *c*ₓ is the subject's share. Positive means the subject spends less than the peer group as a whole. The four bars sum exactly to (subject margin − *M*) × `sumDriftsinntekter`.
- **Start, end and total.** The decomposition runs from the peer group's margin applied to the subject's revenue, *M* × `sumDriftsinntekter`, to the subject's `driftsresultat`. The total is `driftsresultat` − *M* × `sumDriftsinntekter`, computed exactly and rounded to whole kroner with ties away from zero. The start bar is displayed as `driftsresultat` − the displayed total, so start plus bars equals the end exactly.
- **Rounding, signed largest remainder.** Each bar's exact value is rounded down (towards negative infinity) to whole kroner; the kroner still needed to reach the displayed total are added one at a time to the bars with the largest fractional parts. This works for negative bars without special cases, and the displayed bars always sum to the displayed total.
- **It explains; it is not a gap to close.** The decomposition shows the actual difference against the peer group as a whole. It is not scaled by *s*, is never added to the profit uplift, and states its reference so it is not read against the favourable quartile.

## From gap to kroner

Let *r* be the subject's value, *T* the target — **the favourable quartile** — and *s* the closable share set by the user, 0–1. Only gaps where the subject is worse than the target produce kroner; where it is better, the figure is shown as a strength with no amount.

The target is the favourable quartile at every setting of *s*, and *s* scales the gap to it: *s* = 0 produces no kroner at all, *s* = 1 is full convergence with the quartile. The peer median is shown in every distribution and marked on the control so the user can see where the typical peer sits, but it never enters this arithmetic.

**One exception: the "to the median" step.** The control offers, besides its fixed steps, the share at which the subject's operating margin (1) would reach the peer median *M*: *s*<sub>med</sub> = (M − r) / (T − r), computed exactly and shown rounded to a whole percent. The median only sets *s*; the amounts are then computed by the formulas below with that exact *s*, never with the rounded one shown, and every amount still targets the favourable quartile. The step is defined on operating margin only and labelled so, because other figures reach their own medians at other shares. It exists only where r < M < T; where the subject is at or above the median, it is shown disabled.

- **Profit (1):** (T − r) × `sumDriftsinntekter` × s. This is the annual profit uplift.
- **Cost shares (3–5):** no kroner amount of their own. Their median, favourable quartile and percentile are shown as for any figure; what they mean in kroner is shown by the margin decomposition against the peer group as a whole (see *Decompositions*), which sums exactly and is never added to the profit uplift.
- **Receivable days (9):** (r − T) / 365 × `salgsinntekt` × s of capital released.
- **Payable days (10):** (T − r) / 365 × (`varekostnad` + `annenDriftskostnad`) × s.
- **Operating asset turnover (11):** ((`sumEiendeler` − `bankinnskudd`) − `sumDriftsinntekter` / T) × s of capital released.
- **Enterprise value:** annual profit uplift × EV/EBIT multiple set by the user. **There is no default multiple**, and no enterprise value is computed or shown until the user supplies one. EBIT is used because `driftsresultat` is available from the API for every company and traces directly to the filing.

**Two amounts that must never be added.** *Working capital released* is (9) plus (10) — receivable days and payable days — which are safe to add because one is an asset and the other a liability. The operating asset turnover amount (11) is reported **separately** and is never added to either, because its capital base `sumEiendeler − bankinnskudd` already contains `kundefordringer`: adding it to (9) counts the same receivable reduction twice. **Where only one of (9) and (10) clears the minimum group size**, that part is shown as its own line and no working-capital total is shown; the total appears only when both exist.

## Peer selection and benchmarking

Any measure used to select peers enters selection only in coarse bands, and is benchmarked within its band. Today that is cost of goods share (3) and personnel cost share (4); see the fingerprint in the technical note. Selecting on the exact value would make that gap close to zero by construction.

## Known limitations

- **Receivable days are overstated by VAT.** Receivables include VAT; revenue does not. The overstatement is up to 25 %, and it is only roughly similar across a peer group, not cancelled by it: export sales are zero-rated, so a company selling abroad carries less VAT in its receivables and shows fewer receivable days for the same credit terms, and export share varies between peers. The comparison holds only to the extent that peers share a VAT profile, and is weakest where the group is most mixed. Not adjusted silently; stated here.
- **Cost lines are classified differently.** A consultancy using subcontractors may book them as cost of goods or other operating cost rather than personnel, lowering its personnel share and raising the others. Total cost share (6) is shown as a check.
- **Employee count from Enhetsregisteret is not used.** It is today's figure, not the accounting year's. FTEs come from the notes.
- **Excluded on purpose:** cash flow (small companies are exempt from the statement), gearing, interest cover and return on equity (financing and credit risk, not operations), ROIC (needs interest-bearing debt separated; operating asset turnover covers most of it), inventory days (added with 43.210).
