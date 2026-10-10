# Review notes, v1 render (2026-10-10)

These notes are for reviewers. They are not product copy. Product copy is in `messages-v1.nb.json`. The three HTML files hold that object inline, and a build step copies it in unchanged. Review chrome strings (frame labels, state captions) sit in a separate `R` object in each page.

## Files

- `v1-front.html`: Forside at 1200 and 375. Field states at phone width: focus, error, loading, not found. Uncovered-industry result for an invented 69.202 company at 1200 and 375.
- `v1-analysis.html`: Oversikt (with the adjusted-group explanation state), Peers (default and widened), Nøkkeltall og gap, Verdi (with the EV empty and filled states and the below-median state).
- `v1-about.html`: Slik fungerer Peerless at 1200 and 375.
- `messages-v1.nb.json`: a single messages object for all three pages.

## Arithmetic check

All inputs are integer kroner. Kroner amounts are computed in the page with BigInt and are never computed from the rounded figure 16,7 mill. kr. That figure appears in only one place, as the rounded revenue in the company header. Exact values below are given to four decimals.

### Fjordkode inputs (invented)

| Field | kr | Share of revenue |
|---|---:|---:|
| sumDriftsinntekter | 16 714 286 | 100,0000 % |
| driftsresultat | 351 000 | 2,1000 % (exact 2,09999996 %) |
| varekostnad | 852 429 | 5,1000 % |
| lonnskostnad | 11 181 857 | 66,9000 % |
| annenDriftskostnad | 4 078 286 | 24,4000 % |
| avskrivninger og øvrige poster (residual) | 250 714 | 1,5000 % |
| **Sum of the four shares + margin** | 16 714 286 | **100,0 %** |
| sumEiendeler | 7 312 500 | |
| bankinnskudd | 1 456 107 | |

The shares from analysis-2 (5,1 / 66,9 / 24,4 / 1,5) are kept unchanged.

### Peer-gruppen samlet (invented sums over the common set P, 22 peers)

| Field | Σ kr | Share |
|---|---:|---:|
| sumDriftsinntekter | 393 800 000 | 100,0 % |
| driftsresultat | 1 969 000 | 0,5 % |
| varekostnad | 44 105 600 | 11,2 % |
| lonnskostnad | 251 638 200 | 63,9 % |
| annenDriftskostnad | 82 698 000 | 21,0 % |
| avskrivninger og øvrige poster | 13 389 200 | 3,4 % |
| **Sum of the four shares + margin** | 393 800 000 | **100,0 %** |

Each share is an exact multiple of 0,1 %, because 0,1 % of 393 800 000 is a whole 393 800 kr. ΣP revenue is the sum of the 22 invented peer revenues, which excludes Myrvoll Digital AS at 8,9 mill. kr. Weighting the displayed peer margins by revenue gives 0,47 %. That is within the rounding of the displayed one-decimal figures, so the aggregate is set at 0,5 %.

### Margin waterfall: bar = (Aₓ − cₓ) × 16 714 286

| Bar | Fjordkode | Samlet | Exact kr | Floor + remainder | Displayed |
|---|---:|---:|---:|---:|---:|
| Varekostnad | 5,1 % | 11,2 % | +1 019 571,0320 | 1 019 571 · ,032 | **+1 019 571** |
| Lønn | 66,9 % | 63,9 % | −501 428,2460 | −501 429 · ,754 | **−501 428** (+1) |
| Andre driftskostnader | 24,4 % | 21,0 % | −568 285,9400 | −568 286 · ,060 | **−568 286** |
| Avskrivninger og øvrige poster | 1,5 % | 3,4 % | +317 571,7240 | 317 571 · ,724 | **+317 572** (+1) |
| **Total** = (2,1 % − 0,5 %) × rev | | | +267 428,5700 | floors sum 267 427 | **+267 429** |

The floors sum to 267 427 against a rounded total of 267 429. Largest remainder therefore gives +1 to Lønn (,754) and +1 to Avskrivninger (,724). Check: 1 019 571 − 501 428 − 568 286 + 317 572 = **267 429**.

The waterfall starts at the samlet margin × revenue, which is 83 571,43 and displays as 83 571. It ends at driftsresultat, 351 000. Check: 83 571 + 267 429 = 351 000. The page throws an error if any of these sums fails.

### Verdi and the cards (target = beste fjerdedel)

- **Profit uplift:** (0,091 × 16 714 286 − 351 000) × s.
- **Capital in operating assets:** ((7 312 500 − 1 456 107) − 16 714 286 / 3,07) × s. Operating assets are 5 856 393 kr.
- **EV:** exact uplift × 6.

| s | Profit exact | Shown | Operating assets exact | Shown | EV × 6 exact | Shown |
|---|---:|---:|---:|---:|---:|---:|
| 25 % | 292 500,0065 | 292 500 | 103 000,0415 | 103 000 | 1 755 000,0390 | 1 755 000 |
| 50 % (rendered) | 585 000,0130 | 585 000 | 206 000,0831 | 206 000 | 3 510 000,0780 | 3 510 000 |
| 75 % | 877 500,0195 | 877 500 | 309 000,1246 | 309 000 | 5 265 000,1170 | 5 265 000 |
| 100 % (hero, table, card) | 1 170 000,0260 | 1 170 000 | 412 000,1661 | 412 000 | 7 020 000,1560 | 7 020 000 |

412 000 follows from the exact values. I chose bankinnskudd 1 456 107 so that it does, and the change is noted below.

### Other derived figures

| Figure | Computation | Value |
|---|---|---|
| Omløpshastighet driftseiendeler | 16 714 286 / 5 856 393 | 2,854 → 2,85 |
| Totalkapitalrentabilitet | 351 000 / 7 312 500 | 4,8000 % |
| Totalkapitalens omløpshastighet | 16 714 286 / 7 312 500 | 2,2857 → 2,29 |
| Gap to beste fjerdedel | 9,1 − 2,1 | 7,0 pp |
| Til medianen, below-median example | (4,0 − 1,0) / (8,1 − 1,0) | 42,25 % → 42 % |
| Lindeberg Regnskap AS: driftsmargin | 991 200 / 8 400 000 | 11,8 % |
| Lindeberg: totalkapitalrentabilitet | 991 200 / 6 980 000 | 14,2 % |
| Lindeberg: egenkapitalandel | 2 896 700 / 6 980 000 | 41,5 % |

## What changed from analysis-2

- **412 000 was hard-coded in analysis-2**, which had no bankinnskudd. It is now derived from bankinnskudd **1 456 107** (invented), which gives operating assets of 5 856 393 and an exact amount of 412 000,17, so the figure stands. analysis-2's cost-share kroner (1 018 700 and 918 500) are gone.
- **Margin eller kapitalbruk?** no longer uses a named median peer (Vardholmen) or a multiplied median row. It shows two factors, each against its own median: margin 2,1 % against −3,2 %, and omløpshastighet 2,29 against 1,86. The turnover median 1,86 and its quartiles 1,21 and 2,64 are invented.
- **Cost-share rows** have no kroner of their own. Their cell reads "Se forklaring av marginen".
- **Explanation text** now cites the samlet comparison (lønn 66,9 % against 63,9 %, andre 24,4 % against 21,0 %, vare 5,1 % against 11,2 %) instead of lønn against beste fjerdedel. Every figure in it is a computed value on the page.

## Invented

- Fjordkode AS (912 345 678) and every figure listed above.
- 23 peers plus 2 excluded, carried over from analysis-2 with the same names, margins and revenues. The names have not been checked against the register.
- Peer-gruppen samlet sums.
- Funnel counts: 214 / 131 / 88 / 31 / 23, and 341 / 208 / 139 / 48 / 34 in the widened state.
- Lindeberg Regnskap AS (923 456 789, 69.202) and its figures.
- The not-found number 912 345 670.
- The turnover distribution.

## Decisions to confirm

- **Waterfall form.** On desktop it is drawn as columns from "Peer-gruppen samlet" (83 571 kr) to "Fjordkode" (351 000 kr). On the phone it is one row per step on a shared kroner scale. Each bar carries a sign, an arrow and the word "lavere enn samlet" or "høyere enn samlet". Colour is never the only cue.
- **Waterfall palette.** The validator flags the fixed tokens for lightness and chroma: they are muted institutional colours, not a categorical set. CVD separation passes (worst adjacent ΔE 15,5) and all colours pass 3:1 contrast.
- **Small-enterprise limitation.** The copy says that small enterprises are compared with small enterprises and larger companies with larger ones. A larger company can therefore get few or no peers. This follows the memlog rule that non-small subjects get normal analysis, rather than the literal "only small enterprises".
- **Uncovered-industry result.** It is drawn at /analyse/{orgnr} with no tabs.
- **Adjusted-group state.** It is shown as the explanation card only, at two widths.
- **Phone beeswarm tooltip.** It is drawn open above the plot with a leader line, so it does not cover the Fjordkode marker or its label.
