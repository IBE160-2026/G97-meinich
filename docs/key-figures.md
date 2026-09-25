# Key figures — definitions

The calculation engine implements exactly these definitions. Change this document and the code in the same commit. Field names are the register's own; names marked *OCR* come from the Brreg-generated section of the filed document and are **provisional until confirmed against a real filing**.

## General rules

**Same basis for subject and peers.** A key figure is shown only if it can be computed for the subject and for at least the minimum group size of peers — 10 — from the same source. The count is taken per key figure, after companies with an undefined value are left out. A figure the subject has from OCR and the peers do not is not shown.

**Same year.** The benchmark year is the subject's latest filed year. Peers use the same year; a peer without it is excluded. Only calendar-year filings pass the comparability filter. User-entered current-year figures are compared against the peers' latest filed year, with the difference in periods stated.

**Closing balances.** Balance sheet items are taken at year end, not averaged. The key figures API gives only the latest year, so an average would not be available for every peer.

**Undefined is not zero.** If a denominator is zero or negative, or a component is missing and cannot be derived from its stated total, the key figure is undefined for that company. The company is left out of that figure's distribution, and the number left out is shown.

**Arithmetic.** Amounts are integers in øre. Ratios are computed with a decimal library and rounded only for display: percentages to one decimal, days to whole days, kroner to whole kroner.

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
| 3 | Cost of goods share | `varekostnad / sumDriftsinntekter` | OCR | ↓ | Profit, explains 1 |
| 4 | Personnel cost share | `lonnskostnad / sumDriftsinntekter` | OCR | ↓ | Profit, explains 1 |
| 5 | Other operating cost share | `annenDriftskostnad / sumDriftsinntekter` | OCR | ↓ | Profit, explains 1 |
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

### Context

| # | Key figure | Formula | Source | Dir. | Kroner |
|---|---|---|---|---|---|
| 14 | Revenue growth | `sumDriftsinntekter / sumDriftsinntekter(prior year) − 1` | OCR | – | – |

Revenue growth has no direction: fast growth often explains a weak margin, and the analysis shows the two side by side rather than ranking growth.

## Decompositions

Both hold exactly, and the engine's tests assert them:

- **Return on assets** = operating margin × (`sumDriftsinntekter / sumEiendeler`). Defined without financial income for this reason.
- **Personnel cost share** = personnel cost per FTE ÷ revenue per FTE. Separates paying more per person from producing less per person.

## From gap to kroner

Let *r* be the subject's value, *T* the target (peer median, or the favourable quartile at full closure) and *s* the closable share set by the user, 0–1. Only gaps where the subject is worse than the target produce kroner; where it is better, the figure is shown as a strength with no amount.

- **Profit (1):** (T − r) × `sumDriftsinntekter` × s. This is the annual profit uplift.
- **Cost shares (3–5):** (r − T) × `sumDriftsinntekter` × s each. **They explain the operating margin gap and are never added to it or to each other** — doing so counts the same krone twice.
- **Receivable days (9):** (r − T) / 365 × `salgsinntekt` × s of capital released.
- **Payable days (10):** (T − r) / 365 × (`varekostnad` + `annenDriftskostnad`) × s.
- **Operating asset turnover (11):** ((`sumEiendeler` − `bankinnskudd`) − `sumDriftsinntekter` / T) × s of capital released.
- **Enterprise value:** annual profit uplift × EV/EBIT multiple set by the user. EBIT is used because `driftsresultat` is available from the API for every company and traces directly to the filing.

## Peer selection and benchmarking

Any measure used to select peers enters selection only in coarse bands, and is benchmarked within its band. Today that is cost of goods share (3) and personnel cost share (4); see the fingerprint in the technical note. Selecting on the exact value would make that gap close to zero by construction.

## Known limitations

- **Receivable days are overstated by VAT.** Receivables include VAT; revenue does not. The overstatement is up to 25 % and similar across a VAT-registered peer group, so the comparison holds while the absolute number is too high. Not adjusted silently; stated here.
- **Cost lines are classified differently.** A consultancy using subcontractors may book them as cost of goods or other operating cost rather than personnel, lowering its personnel share and raising the others. Total cost share (6) is shown as a check.
- **Employee count from Enhetsregisteret is not used.** It is today's figure, not the accounting year's. FTEs come from the notes.
- **Excluded on purpose:** cash flow (small companies are exempt from the statement), gearing, interest cover and return on equity (financing and credit risk, not operations), ROIC (needs interest-bearing debt separated; operating asset turnover covers most of it), inventory days (added with 43.210).
