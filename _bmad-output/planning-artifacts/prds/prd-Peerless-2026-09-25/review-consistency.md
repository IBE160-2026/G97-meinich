# PRD consistency review — drift against the authoritative documents

Reviewed 2026-09-29. Target: `prd.md` (958 lines, FR-1 to FR-67, no gaps) and `addendum.md` in this folder.

Checked against the four hand-written authoritative documents and `AGENTS.md`:

- `briefs/brief-Peerless-2026-09-17/brief.md` (and its non-authoritative `addendum.md`)
- `technical-note-architecture.md`
- `docs/data-sources-brreg.md`
- `docs/key-figures.md`
- `AGENTS.md` — Non-negotiable rules and Known API traps

Corroborating (not authoritative, but the PRD cites it as the source of its illustrative figures): `analysis/output/industry-screening.md`.

Per `AGENTS.md`, where the PRD and one of the four disagree, **the other document wins and the PRD is wrong**. Each finding names which document I judge right.

---

## Verdict

**The PRD is substantially faithful.** Every one of `AGENTS.md`'s non-negotiable rules is carried through, several of them with a test attached:

| Rule | Where the PRD honours it | Verdict |
|---|---|---|
| Money is never a float | FR-21, §7 Correctness of money, glossary *Øre* | correct |
| Authorisation in the database, `is_anonymous` false | FR-45, FR-47, §7 Authorisation, SM-3 | correct |
| The model never calculates | FR-53, FR-11, FR-16, §8 Safety, SM-4 | correct |
| Rules before model | §4.2, FR-7–FR-12, §10 | correct |
| Never select peers on a benchmarked measure | FR-13 (incl. a within-band-spread test) | correct, but see L9 |
| No OCR or document fetch at query time | FR-59, FR-20, §7 Performance | correct |
| Secrets stay server-side | §7 Secrets | correct |
| Norwegian interface, English everything else | §11 Q2, §12 | correct |
| Responsive to 375px, body never scrolls horizontally | FR-55, FR-56, SM-7 | correct |

The four areas the task asked about in detail are also clean:

- **Scope.** Two committed industries (`62.100` ~1 000, `69.202` ~800 — both verified against `industry-screening.md`: 1003 and 797), `43.210` intended not committed, coverage one industry at a time gated on its own measurement. Cut order matches the brief and the technical note verbatim: portfolio front page → industry overviews → third industry, never the labelled set, the authorisation suite or the OCR measurement. No item the brief puts out of v1 is missing from §5, and §5 adds nothing the brief contradicts.
- **The access model.** FR-42's account wall matches the technical note's *Access control* and the brief addendum's table item for item, on both sides of the line. Anonymous sessions, conversion in place, magic link, workspaces with `owner`/`viewer`, no adviser role, email invitation into one workspace, share links out of v1, immediate revocation, audit log — all match.
- **The key figure set.** 14 numbered figures plus the unnumbered cash share; three API-only (operating margin, return on assets, equity ratio), so twelve of fifteen OCR-sourced — consistent across the PRD, `key-figures.md` and `data-sources-brreg.md`. Directions, the four figures with no direction (personnel cost per FTE, equity ratio, revenue growth, cash share), the kroner translations, the percentile formula, undefined-is-not-zero, same-basis, same-year, no-double-counting, and the minimum group size of 10 counted per key figure all match. The reference point is the favourable quartile at every setting of the closable share, with the median as context and a control marker only — matching the corrected `key-figures.md` and the technical note's decision point.
- **Measurement claims.** Five years of trend (2021–2025), ~88 % of columns reconciling in those years, ~60 % for 2011–2016, 71 of 71 figures agreeing with the API, mean OCR confidence 0.974 as a non-signal, description-quality proxy at 56 % / 38 % / 50 % — every figure traced correctly to `data-sources-brreg.md`. No numeric target is invented where none exists.

**The drift that does exist is concentrated in two places:** what an uncovered subject actually receives, and the embeddings layer that the primary success metric depends on but no requirement creates. Two High, six Medium, nine Low.

---

## High

### H1 — FR-4 promises an uncovered company its "own filed key figures", which cannot be delivered

**PRD location:** §4.1 FR-4 *Uncovered industry behaviour*; supported by §2.2 Non-Users and glossary *Subject*, and cited from UJ-2's edge case.

**What the PRD says:** "A company outside a covered industry is shown its own filed key figures and a plain statement that its industry is not yet covered." No qualification on which figures.

**Which document disagrees, and where:**

- `technical-note-architecture.md`, *Performance targets*: "**The subject must be in a covered industry to be analysed at all**, and covered industries are fully pre-warmed, so no recognition happens at query time."
- `docs/data-sources-brreg.md`, *Fields in the key figures API* → *Not in the API*: cost of goods sold, personnel costs, depreciation, impairment, sales revenue, trade receivables, bank deposits, trade payables, FTEs. Twelve of the fifteen key figures are recoverable only by OCR.
- `AGENTS.md`, Things not to do: "Do not OCR or fetch documents at query time."

**Why this is wrong as written.** An uncovered industry is by definition not pre-warmed (FR-59: "A covered industry is fully pre-warmed before it is offered"). So for an uncovered subject only the four API fields exist, yielding exactly three key figures: operating margin, return on assets, equity ratio. Anything more would require OCR inside the request. The PRD already knows this number — FR-38 uses the same three as "the three figures that depend on no extracted data" — but FR-4 does not say so.

It also collides with FR-24 (*Same basis for subject and peers*), which shows a figure only where the subject **and** at least ten peers have it from the same source. An uncovered subject has no peers, so read literally FR-24 shows nothing at all.

**Which is right:** the technical note and `AGENTS.md`. FR-4 should state that an uncovered subject receives the three API-sourced key figures (operating margin, return on assets, equity ratio) and no others, and FR-24 needs an explicit carve-out for the no-peer-group case.

**Consequence for a builder:** the most likely outcome is a developer wiring the uncovered-industry path to the same figure pipeline as a covered one and either triggering query-time OCR — breaking a non-negotiable rule and the one-second/few-second budget — or shipping twelve empty rows on a page whose whole purpose is to be honest about what is not available. This is also the first thing any user outside `62.100`/`69.202` will see, and per the PRD's own §4.1 framing, "honesty at this boundary is load-bearing".

### H2 — The embeddings layer carries a primary success metric but has no requirement and is absent from MVP scope

**PRD location:** §9 SM-1 ("per funnel layer — industry code and size alone, then adding the fingerprint, **then embeddings**, then model classification … Validates FR-7 to FR-16"); §10 ("If embeddings do not measurably beat model classification, classification stays"). Absent from §4.2 (five FRs for five funnel stages, none for embeddings) and absent from §6.1 In Scope.

**What the PRD says:** embeddings are a scored layer of the primary measurement, but no FR creates them and §6.1 does not list the work.

**Which document disagrees, and where:**

- `technical-note-architecture.md`, *Peer group — measured layer by layer*: "adding text through embeddings (stored with pgvector in the same Supabase Postgres, no separate vector service); adding text through model classification."
- `technical-note-architecture.md`, *Schedule*, week 10: "**Embeddings; layer-by-layer comparison**" — a full week of the thirteen, and one of only two weeks devoted to the project's central result.
- `technical-note-architecture.md`, *Stack*: "Supabase for PostgreSQL … **with pgvector for embeddings**."
- The brief, *Success Criteria*: "layer by layer — industry code, then the accounts, then AI reading the description".

**Which is right:** the technical note. Embeddings are committed work with a scheduled week and a stack dependency.

**Consequence for a builder:** §0 states that FR numbers exist "so epics can cite stable IDs", and §6.2 says "Epics are cut from this list, in this order." `bmad-create-epics-and-stories` working from §4 and §6.1 will generate no embeddings story — and then SM-1, the project's stated primary result, cannot be reported as specified. This is the single most likely way for the PRD to cause the graded deliverable to come out incomplete. It needs an FR in §4.2 (or an explicit measurement-only requirement in §9/§10 that §6.1 lists) rather than a passing mention inside a metric.

---

## Medium

### M1 — FR-8 closes a decision the technical note explicitly leaves open, and contradicts FR-18

**PRD location:** §4.2 FR-8 consequence: "A candidate failing **any** comparability field cannot appear in the peer group by any later stage."

**Which document disagrees:** `technical-note-architecture.md`, *Course requirements → Decision points*: "**Which comparability criteria are hard exclusions and which are merely flagged**" — listed as unresolved. The PRD's own §11 Q13 repeats it as open, under "Gated on measurement".

**Also internally inconsistent:** FR-18 *Loosen a criterion* lets the user "widen a criterion when the group is too small", and the technical note says the user "can loosen a criterion when the group becomes too small". If every comparability field is a hard exclusion by any later stage, FR-18 has nothing left to loosen except size and geography — which FR-18 does not say.

**Which is right:** the technical note. Note one exception: "Only calendar-year filings pass" is separately authoritative — `docs/key-figures.md`, *Same year*, states it outright — so that clause stands. The blanket claim about *any* comparability field does not.

**Consequence:** a builder implements six hard filters, `bmad-architecture` records them as settled, and the decision point disappears without being taken. `data-sources-brreg.md` notes the comparability filter removes only 1–6 % of candidates, so the choice is cheap now and expensive to revisit after the funnel is built.

### M2 — UJ-4 quotes `69.202`'s peer median for a `62.100` company

**PRD location:** §2.3 UJ-4: "His own last filed full year, 8.9 %, and **the peers' latest full year median of 9.7 %**"; and later, "In `69.202` that matters — the accounting year is front-loaded".

**What the PRD asserts about its own figures:** §2.3 states that "Peer statistics are the real screening figures from `analysis/output/industry-screening.md`" and that only the names and the subjects' own margins are invented.

**What the source says:** `industry-screening.md` line 147 gives `69.202` operating margin median **9.7 %** (Q3 15.3 %); line 77 gives `62.100` median **−3.2 %** (Q3 9.1 %). UJ-4 opens "Tore owns the company in UJ-1" — and UJ-1 is explicitly "a twelve-person software company under `62.100`". Its peer median is −3.2 %, not 9.7 %. The seasonality aside about `69.202`'s front-loaded accounting year belongs to UJ-2's bookkeeping firm, not to Tore.

**Which is right:** the screening document, which the PRD itself nominates as authoritative for these numbers.

**Consequence:** UJ-4 is the journey that carries FR-33, FR-36, FR-38 and FR-67, and it is the one place the PRD demonstrates the unfiled-figures comparison. As written it either belongs to a different company than it claims or misquotes the project's own measured data — and §0 says this document is "read by a course sensor checking whether the arithmetic is right". No code breaks; credibility does. (UJ-1 and UJ-2's arithmetic, by contrast, checks out exactly: 12 × 1 390 898 ≈ 16.7 m, 9.1 − 2.1 = 7.0 pts, 7.0 % × 16.7 m ≈ 1.17 m; 9 × 1 159 406 ≈ 10.4 m, 15.3 − 2.5 = 12.8 pts, 12.8 % × 10.4 m ≈ 1.34 m.)

### M3 — FR-66's saved-analysis carve-out is not supported by the register's removal request

**PRD location:** §4.10 FR-66 consequence: "A saved analysis that included it keeps its own figures — it is a record of what was computed on its stated read date (FR-64) — but the company cannot be looked up or re-entered as a peer."

**Which document disagrees:** `docs/data-sources-brreg.md`, *Licence and attribution* → *Withdrawn entities must be dropped from stored copies*, quoting the Enhetsregisteret API documentation: an entity returning `410 Gone` — "Dette bør også anses som en forespørsel om at eventuelle kopier/cacher også fjerner den aktuelle enheten." The document adds: "Peerless stores register data permanently, so this is an obligation on the ingestion job rather than a caching detail." It grants no exception for derived or saved copies, and `AGENTS.md` does not either.

**Which is right:** `data-sources-brreg.md` states the obligation; the PRD adds an exception no authoritative document supports. The exception may well be defensible — a saved analysis holds recomputed ratios, not a copy of the register record, which is the same distinction §8 draws for the OCR licence gap — but the PRD asserts the conclusion instead of recording it as a judgement, and the removal reason the register names is "legal reasons", which is exactly the case where a retained copy matters most.

**Consequence:** a builder implements a deletion job that deliberately spares one store. That is a defensible design and an indefensible silence: it needs either a sentence of reasoning in §8 or an open question in §11 alongside Q19, with which figures survive stated explicitly (a peer's name and organisation number are register data; the ratio computed from them arguably is not).

### M4 — Two arithmetic rules from `key-figures.md` are silently dropped

**PRD location:** §4.3 FR-21 and FR-27 restate most of `key-figures.md`'s *General rules* — percentile formula, undefined-is-not-zero, rounding, same basis, same year, the no-direction rule — but omit two.

**What the authoritative document states and the PRD does not:**

- `docs/key-figures.md`, *Distribution*: "Median and quartiles use **linear interpolation between order statistics (the inclusive method, as `PERCENTILE.INC` in Excel)**, so every figure can be checked in a spreadsheet."
- `docs/key-figures.md`, *Closing balances*: "Balance sheet items are taken at **year end, not averaged**. The key figures API gives only the latest year, so an average would not be available for every peer."

**Which is right:** `key-figures.md`, and the PRD's stated method ("Formulas are not restated here … the engine implements exactly those definitions") technically covers both by reference.

**Consequence:** the risk is that the PRD restates *nearly* all of the general rules, so the list reads as complete. Quantile method is not a detail — different conventions give visibly different quartiles on a group of ten to thirty peers, and the favourable quartile is the target of every kroner amount in the product. Averaging balance-sheet items is the textbook default for return on assets and asset turnover and is exactly what a developer reaching for a standard formula will do. Both feed FR-29's money arithmetic and SM-6's hand-calculated reference cases. Either restate them in FR-21/FR-27 or replace the partial restatement with a pointer.

### M5 — The subject's own multi-year extraction is dropped; FR-28 covers only peer history

**PRD location:** §4.3 FR-28 consequences: "Peer history is fetched every other year, since each document carries a prior-year column; every year is still covered."

**Which document disagrees:** `technical-note-architecture.md`, *Data ingestion*: "**The subject of the analysis is always extracted in full detail across several years**, since it is a single company." And, separately: "History is fetched every other year."

**Which is right:** the technical note. These are two different rules — full-detail extraction for the one subject, every-other-year sampling for peers — and the PRD keeps only the second while attributing it to peers.

**Consequence:** every subject of every analysis is a company in a covered industry, so under FR-59 its full history must already be pre-warmed. A builder reading only FR-28 may implement every-other-year extraction for the whole population, which would leave subject-level trend rows in the *development over time* tab thinner than the tab promises, with no error anywhere.

### M6 — The brief's "under a minute" promise survives in §1 but has no requirement or metric

**PRD location:** §1 Vision — "any company can see itself in context in under a minute" — and §4.1's own flag: "`[NOTE FOR PM]` The brief promises 'under a minute' to first insight. That is a product promise no FR currently measures. Consider whether it belongs in §7 as a metric."

**Which document states it:** the brief, twice and load-bearing — *Vision*: "any company can see itself in context in under a minute, for nothing"; *What Makes This Different*: "**It costs a minute, not a project.** The realistic competitor is the analysis never being done." It is the brief's stated differentiator, not a flourish.

**Which is right:** the brief. The PRD repeats the promise in its own Vision and then measures only machine latency (SM-5: peer group under a second, analysis within a few) and setup (SM-8: nothing but an organisation number). Nothing covers time-to-first-insight for a human, which is a product and UX target, not a server one.

**Consequence:** the PRD leaves a live `[NOTE FOR PM]` in a document that `bmad-ux` and `bmad-create-epics-and-stories` build from. Either §7 or §9 takes the promise as a requirement, or §1 stops making it. Leaving an unresolved editorial note inside a requirement section is also the kind of thing a sensor reads as an unfinished document.

---

## Low

### L1 — §4's FR range is stale

§4 opens "Requirements are numbered globally FR-1 to **FR-63**", while §0 says FR-1 to FR-67 and the document contains all 67 with no gaps (verified). Internal, but §0 makes FR numbering a contract for downstream epics. Fix the §4 header.

### L2 — FR-5 cites FR-20 for the wrong thing

FR-5: "Every other classification happens at ingestion (FR-20)." FR-20 is *Peer group assembly latency*. Its consequence does mention that no peer is classified at request time, so the cite half-lands, but there is no requirement that owns ingestion-time classification. The technical note states it plainly ("Classification runs once per company at ingestion, never at search time"), and the funnel FRs (FR-11, FR-12) never say when stage 5 runs. Worth an explicit consequence on FR-11.

### L3 — "Favourites" sits behind the account wall with no requirement and no glossary entry

FR-42 lists "favourites" among what needs an account, matching `technical-note-architecture.md`, *The account wall* ("saved analyses and history, favourites"). But the word appears nowhere else in the PRD: no FR, no glossary entry, and the glossary's *Portfolio* speaks of companies the user "follow[s]" (as does FR-63) without connecting the two. One of the two terms should go, or FR-63 should define following as the favourite mechanism.

### L4 — §6.1 softens the trend commitment the brief and FR-28 both make

§6.1: "Multi-year trend where filings allow, **with reach determined by measurement rather than promised in advance**." But the measurement is done (2026-09-26), §11 Q10 is in the **Answered** list — "five (2021–2025), from measurement" — FR-28 states 2021–2025, and the brief's *Scope → In for v1* says "Development over the last five years." MVP scope should name the five years it commits to.

### L5 — The glossary's *Open route* is narrower than FR-42

Glossary: "**Open route** — the no-account path: lookup, peer group, adjustment, kroner gaps." FR-42, the technical note and the brief addendum all also open the front page and industry overviews, the closable-share control and valuation. §3 says these terms are "used verbatim everywhere after", so the shorter definition is the one a reader carries forward — and valuation being open is a deliberate, slightly surprising decision worth not losing.

### L6 — FR-35 is unqualified where `key-figures.md` qualifies

FR-35: "Unfiled current-year figures are compared against the peers' latest filed year, with the difference in periods stated." That is `key-figures.md`'s *Same year* rule, and it is right for a full unfiled year. For a **partial** year, `key-figures.md`'s *Partial periods are never scaled* overrides it: "The primary comparison is the company's own same period in the previous year … the company's last filed full year and the peer distribution are **context only**." FR-67 gets this exactly right; FR-35 reads as though the peer comparison were primary in both cases. Add "for a full unfiled year; for year-to-date entries see FR-67."

### L7 — Total cost share: "not a primary benchmarking figure" versus a declared direction

FR-21: "Total cost share is a reconciliation check against the three cost shares, not a primary benchmarking figure." `docs/key-figures.md` gives figure 6 direction **↓** and no kroner translation — so under FR-27 it does get a favourable quartile and a percentile, which is more than "a check". No formula conflict, but the display treatment is undefined: FR-21 says check, FR-27 says ranked. Say which.

### L8 — §5 implies inventory days will arrive; §6.2 and Q4 say `43.210` will not

§5 *Excluded key figures*: "inventory days (**arrives with** 43.210, where inventory exists)" — echoing `key-figures.md`'s "added with 43.210". But §6.2 and §11 Q4 confirm `43.210` is "intended, not committed", and Q4 adds "inventory days stay out of the key figure set with it." Phrase it as conditional so §5 cannot be read as a v1 commitment to a fifteenth benchmarked figure.

### L9 — Fixed-asset intensity enters selection while operating asset turnover is benchmarked — a latent conflict all four documents share

FR-10 (stage 4) selects on "cost of goods share, whether they carry inventory, capitalised intangibles, **fixed-asset intensity**", while `docs/key-figures.md` benchmarks **operating asset turnover** (figure 11, direction ↑, kroner: Capital) — essentially asset intensity inverted. FR-13 bands only cost of goods share and personnel cost share.

`AGENTS.md` states the rule both ways: peer matching "may use … asset intensity", **and** "Any measure used in selection enters only in coarse bands — today cost of goods share and personnel cost share — and is benchmarked within its band." `key-figures.md` and the technical note both list only those two as banded.

**Not PRD drift** — the PRD reproduces the authoritative position faithfully, and all four documents say the same thing. But the tension is real: FR-13's test ("the within-band spread of a banded figure is non-trivial") will not catch a turnover gap compressed by an unbanded fingerprint feature. Recommend extending that test to operating asset turnover, or adding an open question in §11 near Q12, which already asks which fingerprint features are used.

---

## Checked and found consistent

Recorded so a later reviewer does not repeat the work.

- **`AGENTS.md` Known API traps.** All eight reach the PRD correctly: the ignored `år` parameter (FR-2, glossary), empty element ≠ zero with derivation from a stated total (FR-23), no text layer / OCR-only (§4.10, FR-59), never trust an OCR digit and 0.974 as a non-signal (FR-57, glossary *Data quality flag*), the two reconciliation rules with the right scales (FR-58, glossary *Reconciliation*), match on organisation number only (FR-1, FR-2, glossary), both misspelled field names preserved (§3 register fields, FR-8), SN2025 and `naeringskode1.kode` (FR-3, FR-7). The full comparability field list matches (FR-8).
- **Scope, in and out.** Every brief *Out of v1* item appears in §5; every brief *In for v1* item appears in §6.1. §5's additions (custom ratio definitions, multi-language, native mobile, degraded filings, entities outside the ordinary layout) contradict nothing and are supported by the brief addendum or `data-sources-brreg.md`.
- **Excluded key figures.** Cash flow, gearing, interest cover, return on equity, ROIC, inventory days — reasons match `key-figures.md` *Known limitations*.
- **Known limitations accepted.** VAT overstating receivable days up to 25 %, cost-line misclassification with total cost share as the check, Enhetsregisteret employee count rejected for `aarsverk` — all three match `key-figures.md`.
- **Kroner translations.** Profit from figure 1; cost shares 3–5 explaining figure 1 and never summed; capital from 9, 10, 11; enterprise value from a user-set EV/EBIT multiple with no default; EBIT chosen because `driftsresultat` is API-sourced. All match `key-figures.md` *From gap to kroner*, and §11 Q5–Q6 record the decisions.
- **Both algebraic identities** (FR-21) match `key-figures.md` *Decompositions*, including the reason return on assets is defined without financial income.
- **The authorisation suite** (§7) covers every pattern in the technical note's *Test strategy* plus `AGENTS.md`'s "calling an endpoint unauthenticated".
- **Licence.** FR-65's NLOD 2.0 wording, the *Om*-page allowance, the modification declaration, the anti-endorsement clause; §8's licence gap and §11 Q19's framing of the documents as unlicensed with twelve of fifteen figures derived from them, a pre-deployment gate rather than a v1 blocker — all match `data-sources-brreg.md` *Licence and attribution*, §§5, 6 and åndsverkloven §§33–34.
- **Data freshness** (FR-64, §8, Q15, Q18) matches the technical note's decision point, including the summer filing window.
- **Measurement and counter-metrics.** SM-1's blind labelling and stated contamination, per-industry and per-description-quality reporting, the industry-code baseline, layer-by-layer ablation, "the model was needed less than expected" as a reportable result, and SM-C1–C4 as counter-metrics all match the brief's *Success Criteria* and the technical note's *Test strategy*. §9's refusal to invent a numeric target is correct: none of the four states one.
- **Thirteen-week solo schedule**, and the cut order, match the technical note and the brief.
- **`addendum.md`** (this folder) contains no independent claims — it points into the four documents and records rejected alternatives. Nothing in it contradicts them. Its own note that the landscape research's pricing is unverified is honoured: the only pricing figure reaching the PRD is NOK 480 000, which `data-sources-brreg.md` corroborates.

---

## Summary

| Severity | Count | Findings |
|---|---|---|
| High | 2 | H1 FR-4 uncovered-industry figure set · H2 embeddings layer has no requirement |
| Medium | 6 | M1 FR-8 hard exclusions · M2 UJ-4 wrong industry median · M3 FR-66 carve-out · M4 quantile method and closing balances dropped · M5 subject multi-year extraction dropped · M6 "under a minute" unmeasured |
| Low | 9 | L1 stale FR range · L2 FR-5 mis-cite · L3 favourites · L4 §6.1 trend depth · L5 open-route glossary · L6 FR-35 unqualified · L7 total cost share treatment · L8 inventory days · L9 asset intensity in selection (all four docs, not PRD drift) |

No finding requires a change to any of the four authoritative documents, with one possible exception: L9 is a tension the authoritative set carries itself, and closing it means editing `docs/key-figures.md` *Peer selection and benchmarking* or the technical note's fingerprint stage rather than the PRD.

*Review only — no project file was modified.*
