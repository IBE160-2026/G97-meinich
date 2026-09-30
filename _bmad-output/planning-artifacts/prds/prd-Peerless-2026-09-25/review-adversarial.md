# Adversarial review — Peerless PRD

Reviewed 2026-09-29 against `prd.md` (958 lines, FR-1–FR-67), `addendum.md`, `brief.md`, `docs/key-figures.md`, `analysis/output/industry-screening.md`, `technical-note-architecture.md`, `AGENTS.md`.

This is a review of reasoning, not of tidiness. Where the document is right I say so in one line and move on. Findings are ranked by what would most damage the product or the grade.

**Verdict.** The PRD is unusually disciplined about the things that are easy to be disciplined about — vocabulary, traceability, the no-calculation rule, the anonymous-role trap — and it is quietly confident about the three things the grade actually rests on: the size and validity of the labelled set, the number of peers that will survive the funnel once reconciliation is applied, and whether thirteen solo weeks can reach the interface at all. The central claim as stated in §1 and §10 is not falsifiable under the labelling protocol described; the falsifiable claim is the ablation, and the document conflates the two. There is one concrete double-count of the exact kind FR-30 was written to prevent, sitting one line below FR-30.

**Count: 26 findings — 5 critical, 9 high, 9 medium, 3 low.**

---

# CRITICAL

## C-1. The labelled set has no size, no sampling frame, and no start date — and SM-1 as written needs far more labels than a solo builder can produce

SM-1 promises precision and recall **"Reported per industry, split by whether the company's description is informative (with the share of companies in each cohort disclosed), and per funnel layer — industry code and size alone, then adding the fingerprint, then embeddings, then model classification."**

That is three simultaneous splits: 2 industries × 2 description cohorts × 4 layers = **16 reporting cells**. Nowhere in 958 lines does the PRD state how many subjects are labelled, how many candidates per subject, or how candidates are drawn. Not one FR covers the labelled set — FR-3 *depends* on it ("measured against a labelled set for that industry"), §9 asserts it, §10 describes its stratification, and no requirement creates it.

Worse, **recall is undefined without an exhaustively labelled candidate pool.** Recall needs a denominator: all genuine comparables for that subject. If candidates are drawn from the funnel's own output, the funnel's recall is 1.0 by construction and the number is meaningless. To get a real denominator you must label pairs the funnel *rejected* — which, across a 942-company comparable population in 62.100, means judging on the order of hundreds of pairs per subject, or defining a defensible sampling frame (e.g. stratified random draw from the size band with inverse-probability weighting). The PRD defines neither.

The technical note is the only document that protects this at all: *"Two pieces of manual work start early and run alongside the code ... Deferring either to the week it appears in the table above is how they end up too small to report."* The PRD — the document epics are generated from — drops that sentence entirely. §6.1, §6.2 and §9 never say when labelling starts or how big it is.

**If no epic contains "label N pairs, drawn this way, by week X", it will not happen, and SM-1 reports 16 cells with single-digit denominators.** This is the highest-leverage omission in the document relative to the grade.

Required: an FR (or a stated acceptance criterion on SM-1) fixing the number of subjects, candidates per subject, the sampling frame that makes recall computable, the start week, and a minimum-viable fallback (e.g. one industry, one cohort split, pooled layers) if the set comes in small.

## C-2. The headline claim is not falsifiable under this protocol. The falsifiable claim is the ablation, and the document conflates them

§10: **"The claim under test: that reading what a company actually does — from its accounts and from free text — assembles a better peer group than industry classification alone. The measurement is the result, and it can come back negative."**

It cannot come back negative, and the reason is structural rather than a matter of care. The labeller's operative definition of "genuine comparable" is the same definition the fingerprint encodes: cost composition, inventory, capitalised intangibles, asset intensity — reseller versus product company versus consultancy. §1 states the premise that makes the label: *"a company registered under a generic programming code could be a reseller, a product company or a consultancy, and comparing across those produces confident nonsense."* The labeller will mark cross-type pairs as non-comparable **because that is the belief the method implements**. The industry-code baseline is then guaranteed to lose, because the label was defined as the thing the industry code fails to capture.

The mitigation offered — §9 and §10: **"labelled without seeing which funnel stage proposed a candidate, since the labeller also designed the method"** — blinds the wrong variable. It blinds *provenance*. The contamination is in the *criterion*. A sceptical examiner will say, correctly: you measured whether your code implements your own intuition. That is an implementation-fidelity test, not a validity test, and the improvement over the industry-code baseline is a near-tautology.

What *is* genuinely falsifiable here is the question §10 already identifies: **"If the accounts-based fingerprint alone captures most of the improvement, the model was needed less than expected."** That is a real test with a real chance of failing, it is the interesting result, and it is what the ablation measures. The document should promote it to the headline and demote "better than industry code alone" to a sanity check — otherwise the central chapter of the report rests on a result the examiner will discount in the first paragraph.

Cheap repairs, none of which the PRD contains:

- **Pre-register the labelling rubric before the fingerprint feature list is fixed**, and record the date. As things stand, OQ-12 leaves the feature list open, so rubric and features will co-evolve (see M-15).
- **Label a subsample from description and website only, blind to the accounts.** Then the accounts-based fingerprint is scored against a signal independent of it, and stage 4 can actually fail.
- **A second labeller on a subsample with reported agreement.** Even 50 pairs and a Cohen's κ converts "one person's intuition" into "a criterion two people can apply".

## C-3. Nobody has multiplied the funnel through to the expected number of peers per key figure — and the modal analysis may be mostly empty rows

The screening reads reassuringly: *"Passes the comparability filter: 94 (94 %)"* in 62.100, 99% in 69.202, and every size band answers "yes" to "Enough for a group of 10?". That table is computed on **industry × size band only.** The shipped peer group must satisfy, simultaneously:

1. `naeringskode1.kode` match (FR-7)
2. size band (FR-7, FR-9)
3. all six comparability fields matching **the subject** (FR-8) — including `smaaForetak`, which is true for 89/100 in 62.100, so a *non-small* subject has roughly 11% of the industry available
4. segmentation, incl. geography where the industry calls for it (FR-9)
5. fingerprint band match (FR-10, FR-13) — 62.100 has "Business types ≥5 %: 5"
6. a filing for the subject's exact year (FR-25)
7. **for any OCR-sourced figure, every component of that figure reconciling in that peer's filing** (FR-24, FR-58)

Take 62.100, 10–19 employees: 285 companies × 0.94 comparability × band split (~1/3) ≈ 90 before reconciliation. Now apply (7). The evidence is *"about 88 % of columns reconcile"* for 2021–2025. A figure needing two components is ~0.77 if independent; payable days needs three (`leverandorgjeld`, `varekostnad`, `annenDriftskostnad`) at ~0.68. Ninety candidates × 0.7 ≈ 60 — fine there, but the same arithmetic in 69.202's 50–99 band (17 companies) or for a non-`smaaForetak` subject collapses below 10 immediately, and **12 of 15 figures are subject to (7)**.

The addendum knows: *"it will happen often, because 12 of the 15 formulas depend on OCR."* §6.1, §9 and the screening table do not. **The single most important missing artefact in this PRD is one table: expected qualifying peers, per key figure, per size band, per industry, after reconciliation.** It is computable today from the screening CSVs and the reconciliation rate. It decides whether this product has a ratio table or a page of "7 av 10 sammenlignbare verdier" — and therefore whether FR-22's careful empty-row behaviour is a graceful edge case or the modal screen.

FR-22 is exactly right as behaviour (*"the row persists and still shows the subject's own value"*). It is the right answer to a rare problem and a disaster as the default.

## C-4. One week for the entire interface plus the kroner layer, and the cut list cannot absorb the realistic overrun

The technical note's schedule gives **week 12** this cell: *"Valuation control, explanation layer, export, front page with industry overviews, analysis tabs, responsive interface."* That is FR-29, FR-30, FR-31, FR-32, FR-51, FR-52, FR-53, FR-54, FR-55, FR-56, FR-61, FR-62, FR-63 — **thirteen requirements including the whole user interface and the feature the product is named for.** Week 11 carries FR-6, FR-17, FR-18, FR-19, FR-44, FR-49, FR-50. Week 13 is documentation.

So the front end is one week, at the end, immediately after the weeks most likely to overrun (4–6: render, recognise, column grouping, number parsing, two reconciliation rules, quality flags, accuracy measurement) — on a pipeline whose field names are **still provisional**: OQ-14, *"All ten OCR-sourced field names in `docs/key-figures.md` are marked provisional until confirmed against a real filing."*

The brief is candid (*"the interface ... lands late in a thirteen-week solo schedule"*); the PRD's §6.1 and §7 read as fully committed.

**Honest probability that all of §6.1 ships: under 10%.** Probability the graded core ships (labelled-set measurement, OCR measurement, authorisation suite, engine, responsive minimum): perhaps 55–65%, and only if the cut order is executed in week 8 rather than discovered in week 12.

**The cut order is too shallow.** §6.2: *"The portfolio front page (FR-63) first, then the industry overviews (FR-61), then the third industry."* The third industry is already out of scope per §6.2 and OQ-4, so that is two real rungs worth perhaps 1.5 weeks, against a plausible 3–5 week overrun. After them there is nothing left, and the next cut gets made in panic during the week the interface is being built.

**Items that belong in the cut order and are not in it, in the order I would cut them:**

- **FR-28, multi-year trend (2021–2025).** The most expensive item in the project, and decoration for every success metric. The screening: *"For 5 years of trend: 3 documents each → 2826 filings, 8478 generated pages"* (62.100) plus **7101** (69.202) ≈ **15 600 pages**. Cutting to the latest year removes roughly two-thirds of all OCR volume, removes the 88%/60% reconciliation risk from the critical path, and costs one FR plus one line on the front page — where the fallback is already written (FR-61: *"an overview shows the latest year only — the spread without the trend"*). That FR-28 is not even in the cut order is the largest scope-discipline miss in the document.
- **FR-33–FR-38 and FR-67, unfiled and year-to-date figures.** Seven FRs, an extra table, its own RLS policies, labelling that must survive PDF export, period bookkeeping. Serves UJ-4 only. **Bears on no primary success metric.** Pure product, zero graded result.
- **FR-51, PDF export.** Known time sink (Norwegian typography, wide tables, labels surviving), serves no SM.
- **FR-66, withdrawn-company removal.** Correct, and it will fire approximately zero times in thirteen weeks with a manually triggered batch (§8: *"the batch job runs when it is triggered"*).
- **Embeddings** (technical note week 10) are simultaneously optional (§10: *"Embeddings replace it only on evidence"*) and load-bearing for SM-1's four-layer split. Pick one. If SM-1 must report the embeddings layer, embeddings are not optional; if they are optional, SM-1 reports three layers.
- **FR-40, conversion in place.** Fiddly Supabase-specific plumbing, measured by no SM, worth one line in UJ-1.

The PRD should state plainly which FRs are load-bearing for the graded result and which are product. It never does. My partition:

> **Graded-load-bearing:** FR-7–16 + SM-1 + the labelled set · FR-57–59 + SM-2 + the transcribed set · FR-21–25, FR-29–31 + SM-6 · FR-39, FR-43–48 + SM-3 · FR-53 + SM-4 · FR-55–56 + SM-7.
>
> **Product, not grade:** FR-5, FR-18, FR-28, FR-33–38, FR-40, FR-49–51, FR-61, FR-62, FR-63, FR-66, FR-67, and the CAPTCHA half of FR-6.

## C-5. "Working capital released" double-counts — the exact error FR-30 exists to prevent, one line below FR-30

FR-30 is good and its test is well specified: *"no total presented to the user, or contained in an export, sums more than one of {operating margin, cost of goods share, personnel cost share, other operating cost share}."*

Then §3 defines: **"Working capital released — the kroner value of the receivable-days, payable-days and operating-asset-turnover gaps."** A sum of three.

Those are not independent. From `docs/key-figures.md`:

- Receivable days released: `(r − T)/365 × salgsinntekt × s` — a reduction in `kundefordringer`.
- Operating asset turnover released: `((sumEiendeler − bankinnskudd) − sumDriftsinntekter/T) × s` — a reduction in **operating assets**.

`kundefordringer` **is inside** `sumEiendeler − bankinnskudd`. Cutting receivables by X kroner is one of the ways you reduce operating assets by X kroner. **Summing the two counts the same krone twice** — precisely the failure FR-30 forbids for cost shares, uncaught because FR-30's asserted set lists only the four margin-side figures.

Payable days compounds it differently: it is a *liability* gap (release cash by paying suppliers later), not an asset reduction, so adding it to asset releases mixes two economically distinct things without saying so — and it worsens supplier terms and liquidity risk, uncounted (see M-18).

Fix, cheap: extend FR-30's asserted set to `{receivable days, operating asset turnover}`, and either present the three separately with no total, or net receivables out of the asset-turnover target so the two are genuinely additive. **This is the finding a sensor checking the arithmetic is most likely to find, in the section the document is proudest of.**

---

# HIGH

## H-6. FR-13's banding test is unfalsifiable as written, and banding must be a per-industry decision

FR-13: *"A test asserts that for a peer group built with banding, the within-band spread of a banded figure is non-trivial — i.e. the gap has not been driven to zero by construction."*

"Non-trivial" is not a threshold. Any band wide enough to hold 10 peers out of a 1000-company industry will have *some* spread, so this test passes on essentially any real data and proves nothing. The honest test is comparative and takes one query:

> For each banded figure, report **(a)** within-band spread as a fraction of the unbanded peer-group spread, and **(b)** the subject's kroner gap under the banded group against the same gap under stages 1–3 only. Report both per industry as part of SM-1.

If banding halves the personnel-cost-share gap, the user is silently shown half the opportunity on **the largest cost line in both committed industries**. In 69.202 — 93% "bookkeeping core", margin spread Q3−Q1 only 12.4 points — personnel cost share *is* the business. Banding on it means banding on the thing being benchmarked, and there is nowhere else for the margin variance to live.

And note the governance problem: FR-13 and the §3 glossary state banding as settled (*"Today: cost of goods share and personnel cost share"*), while **OQ-12 lists it as open**: *"whether personnel cost share enters selection at all, in bands, or not. Stage 4 describes it as banded; the decision points still list it as open, with a stated risk that bands blur the benchmark."* A PRD should not assert a mechanism in a numbered requirement whose central parameter it also lists as unresolved.

## H-7. The bands-correlate-with-performance case is real, industry-specific, and invisible when it bites

The failure mode is concrete in the likely third industry. In **43.210 Elektrisk installasjonsarbeid**, cost-of-goods share is the materials-versus-labour mix — and materials-heavy installers are structurally lower-margin (pass-through materials), while labour-heavy service work is higher-margin. **Band ≈ margin, almost directly.** The subject lands among peers with the same materials mix, its margin gap collapses toward zero, and the product reports "you are near the median" for a company genuinely five points behind. **The failure is invisible, because a small gap reads as good news.** Nothing in the product distinguishes "you are fine" from "we banded away the variance".

In 62.100 the same mechanism is *desirable*: banding personnel cost share separates consultancies (high payroll share, positive margin) from product companies (payroll capitalised into intangibles, deeply negative margin — Q1 is **−45.7%**). So the identical mechanism is load-bearing in one industry and destructive in another, and **nothing in the PRD requires the banding decision to be made per industry.** FR-13 and the glossary state it globally. It should be per-industry, measured, and reported with the spread ratio from H-6.

## H-8. The favourable quartile is offered on every figure simultaneously, describing a company that exists nowhere in the peer set

OQ-6 resolved the median-versus-quartile question cleanly and FR-31's arithmetic is right (*"The target is the favourable quartile at every setting of the control"*, s scales the gap, no kroner at s=0). The *framing* is the problem.

The upper quartile is by definition attainable by at most 25% of a distribution, and the product offers it as the reference to 100% of subjects — **independently, per figure.** The implied end state at s=1 is a company simultaneously at the favourable quartile on operating margin, cost of goods share, personnel cost share, other operating cost share, receivable days, payable days *and* operating asset turnover. **That joint position is almost certainly occupied by no company in the data.** Checking it is one query the PRD could specify and does not.

Compounding it: the three cost-share amounts, each measured to *its own* quartile attained by *different* companies, **can exceed the operating-margin amount they are said to "explain"**. Concretely: margin gap 1.17m; cost of goods 0.3m; personnel 0.6m; other 0.4m — the three sum to 1.3m, larger than the headline. FR-30 forbids showing the sum; it cannot stop a user adding them and finding an inconsistency. The addendum sees the layout half (*"The layout has to make that visually obvious enough that nobody reaches for a calculator"*) and misses the numerical half: **this is definitional, not visual.** FR-30's word "breakdown" (*"a subordinate breakdown of the operating margin amount"*) is not earned — the three amounts do not break anything down; they are three alternative single-lever counterfactuals.

Either measure the cost-share gaps to the residual implied by the margin target, or state in copy that they are alternatives, not components. And relabel the control honestly: it is not "how much of this is closable", it is "what if we were an upper-quartile performer on this one measure".

## H-9. Implied enterprise value is the most misleading artefact the product can emit, and nothing carries its assumptions into export

FR-32 does the hard part right: no default multiple, nothing shown until the user enters one, EBIT rather than EBITDA so the headline carries no OCR dependency. Three problems remain.

**(i) The multiple is doing work it cannot do.** An EV/EBIT multiple prices a sustainable, risk-adjusted, growth-adjusted earnings stream. Capitalising a *hypothetical* uplift at the same multiple as existing earnings asserts the incremental krone is as certain and as perpetual as the existing krone. It also **compounds** the optimism already in *s*: at *s* = 0.5 and a multiple of 8, the displayed figure is 4× the annual uplift the user thought they had already halved. Users read the biggest number on the page.

**(ii) The asymmetry runs the wrong way.** Working capital released is correctly *not* added to EV — but a released krone of working capital is worth roughly a krone of equity value, which is the nearly-true part, while the speculative part is the one displayed. Worth stating.

**(iii) Nothing carries *s* and the multiple into export.** FR-33 requires unaudited labelling to survive PDF; FR-64 requires filing year and read date to survive PDF. **No FR requires the closable share and the EV/EBIT multiple to appear on the exported page.** A board PDF reading "implied enterprise value 14.2 MNOK" with no *s* and no multiple visible is the single worst thing this product can produce — and it is UJ-1's own resolution (*"She wants it as a PDF for the board"*). One-line fix: add to FR-32 and FR-51 that every derived money figure in an export states the closable share and, for EV, the multiple, adjacent to the number.

There is also no sanity bound on the multiple. A user typing 50 gets a number, and that is exactly the user who screenshots it.

## H-10. The VAT overstatement is not neutralised by being common to the group — the kroner figure is overstated, and §5 says otherwise

§5 and `key-figures.md`: *"Receivable days are overstated by VAT by up to 25%. The distortion is similar across a VAT-registered peer group, so the comparison holds while the absolute number is too high. Stated, not adjusted."*

**The comparison holds; the money does not, and the document does not notice.** Capital released = `(r − T)/365 × salgsinntekt × s`. If both *r* and *T* are inflated by ~1.25×, so is their **difference** — the kroner figure is overstated by up to 25%, not cancelled. A section that claims to have handled a limitation is arithmetically wrong about it.

Second, "similar across a VAT-registered peer group" is false where output-VAT exposure varies with sales mix. Software sold abroad carries no Norwegian output VAT; domestic consulting carries 25%. **So within 62.100 the distortion varies along exactly the business-model axis the fingerprint is trying to separate** — and varies most in the industry chosen for being most heterogeneous. Two companies with identical real collection behaviour will show receivable days differing by up to 25% purely from export share, and the product will translate that into kroner of "capital tied up".

Third, `kundefordringer / salgsinntekt` compares a year-end balance including VAT against a full-year figure excluding it, and the year-end balance reflects December billing — which the PRD itself notes is seasonally atypical in 69.202 (UJ-4: *"the accounting year is front-loaded"*). Three distinct distortions in one ratio, one of them acknowledged and mis-analysed.

## H-11. FR-3 gates coverage on measurement, the 62.100/69.202 contrast makes both industries non-cuttable, and there is no cut order inside the measurement

FR-3: *"An industry is offered only once its filings are extracted and reconciled **and** its peer selection has been measured against a labelled set for that industry."* Correct and admirable. It is also a schedule bomb.

The measurement lands weeks 9–10. If 69.202's slips, **69.202 cannot ship at all** — and 69.202 is the primary user's own industry (technical note) *and* the control that makes the central result interesting: *"If classification lifts precision substantially in 62.100 and little in 69.202, that is a result about when the model earns its place."* **The contrastive result requires both industries measured**, so the labelled set is effectively double-sized and structurally non-cuttable.

§6.2 protects "the labelled set" from being cut and gives it no internal cut order. Yet its own logic — *"Two measured industries beat three unmeasured ones"* — implies the next rung: **one industry measured properly beats two measured thinly.** The PRD does not say it, and that is the decision that will actually have to be made in week 10. Say now which industry survives (I would keep 62.100, where classification has something to prove) and what is reported if only one does.

## H-12. "88% of columns reconcile" is one company's number, and it becomes "nine in ten filings" in the brief

The figure appears in FR-28 as the justification for five years of trend: *"Measured 2026-09-26: about 88 % of columns reconcile in those years."* The technical note is careful — *"about 88 % of columns verify for 2021–2025 and about 60 % for 2011–2016, with 71 of 71 figures agreeing with the key figures API"* — and traces to *"264 pages across all 15 available years for the primary test company"* and the 2025 filing for 979607008. **n = 1.**

Then the brief says: *"about nine in ten recent filings reconcile, which sets development over time at five years."* **Columns silently became filings.** Those are different quantities and the second is the optimistic reading of the first: a filing passes only if every column it needs passes, and a 15-field filing at 88% per column has a low probability of being wholly clean (see C-3).

The PRD inherits the careful wording but not the caveat. One company's reconciliation rate is currently carrying: the five-year trend commitment (FR-28), the OCR volume estimate (15 600 pages), FR-24's same-source rule, and implicitly the expected fill rate of the whole product. **Label it n=1 everywhere it appears, and state the sample the 88% will be re-measured on before FR-28 is committed.** SM-2 is the right measurement; it is scheduled for week 6, *after* weeks 4–5 built the pipeline around the assumption.

## H-13. FR-53's test is weaker than the document believes, and the "never weakened" pledge points at the wrong pressure

FR-53: *"An automated test rejects generated text containing any figure not present in the engine's output. Once that test exists it is never weakened."*

As specified this is a **containment** check: every numeral in the text must appear somewhere in the engine output. It catches hallucinated figures — the thing `AGENTS.md` cares about — and misses four failure modes that are at least as damaging:

1. **Wrong attachment.** "Lønnskostnadsandelen er 31 %" where 31% is the *cost of goods* share. Both numbers are in the output; the sentence is false. Containment passes.
2. **Wrong direction.** "over medianen" where the subject is below it. No numeral is wrong.
3. **Formatting.** Norwegian renders the same figure as `1 170 000`, `1,17 mill.`, `1,17 millioner kroner`. Naive containment produces false negatives; the obvious fix (loosen the matcher) produces false positives. **The first real encounter with Norwegian number formatting is precisely the pressure that weakens this test** — and it arrives in week 12, under time pressure, on the day the explanation layer is built.
4. **Model arithmetic that lands on an existing value.** The model sums two engine figures; the total happens to also be in the output.

The requirement needs to specify the **normalisation** (canonical numeric form before comparison) and the **pairing** (figure ↔ label ↔ direction), or the pledge not to weaken it will be honoured in letter and broken in substance. This is one of only four primary success metrics (SM-4) and the one the model-discipline claim rests on.

## H-14. Recall cannot improve through a filtering funnel, so SM-1's per-layer recall table is structurally misleading

The funnel narrows: stage 5 *"judges whether a candidate is the same type of business"* and stage 4 groups candidates. A pure filter can raise precision and can only lower recall. Therefore **recall is monotonically non-increasing from stage 1 to stage 5 by construction, and the industry-code-only baseline will always have the highest recall.**

SM-1 nonetheless promises *"precision and recall ... per funnel layer"*. The resulting table will show the model apparently hurting on half the metric, every time, for reasons that have nothing to do with its quality. Either name the comparison statistic (F1, or precision at a fixed group size of 10 — which is what the product actually needs, since it ships a fixed-size group), or define the candidate pool so recall is meaningful (C-1).

Related and unremarked: **what SM-1 measures is not what the user sees.** FR-12 keeps unclassified companies eligible through stages 1–4, and FR-18 lets the user loosen a criterion. So the shipped group is the funnel's output *plus* unclassified survivors *minus* user exclusions (FR-17). The measured object and the delivered object differ, and no metric covers the delivered one.

---

# MEDIUM

## M-15. Blinding is cosmetic, and OQ-12 guarantees the rubric and the features co-evolve

Beyond C-2's criterion problem: the labeller must read the accounts to judge comparability, and the fingerprint features *are* ratios of those accounts (cost of goods share, inventory, capitalised intangibles, fixed-asset intensity). **A labeller reading the accounts computes the fingerprint mentally.** Blinding to which stage proposed a candidate does not address this.

And OQ-12 is listed under *"Gated on measurement (answers arrive from work already scheduled)"* — but **which fingerprint features are used is an input to week 8, decided before the week-9 measurement that is supposed to answer it.** It is gated on a *decision*, not on measurement. That mislabelling is what allows H-6 to stand: an open parameter is treated as if evidence were coming to settle it, when in fact the feature set will be chosen by hand, in parallel with the rubric, by the same person. That is textbook circularity and it should be named in §10's contamination paragraph rather than covered by the blinding sentence.

## M-16. The description-quality cohorts are tiny in 69.202, the proxy is admittedly biased in a known direction, and the industry contrast is doubly confounded with n=2

§10: *"Description quality is currently a word-list proxy, not a measurement: at most 56% of descriptions in 62.100, 38% in 69.202 and 50% in 43.210 appear specific, and the true share is lower."* Honest, and then built upon anyway.

In 69.202 the informative cohort is ≤38% and truly lower — call it 25%. On a labelled set of 30 subjects that is ~7 subjects in the only cohort where the model can possibly help, and SM-1 promises precision *and* recall for it. Seven subjects is an anecdote.

Worse, the screening's own heterogeneity table says the model has nothing to read in 69.202: **"bookkeeping core 738 (93 %)"** — 93% of the industry describes the same activity. So the "control" industry's result is predetermined by the absence of text, not by any property of the model. That is a finding about the word list, not about *when* the model earns its place.

And the interesting comparison — 62.100 versus 69.202 — varies **two things at once**: description informativeness (56% vs 38%) *and* margin dispersion (Q3−Q1 of 54.8 points vs 12.4). With n = 2 industries, nothing can be attributed to either. The technical note frames the contrast as a result (*"that is a result about when the model earns its place"*); it is an observation with two candidate explanations and no way to separate them. Say so in §10 rather than letting the report claim more.

Unexamined and cheap: the screening records **"Has a website registered: 35 % / 36 % / 26 %"**. A registered URL is the obvious way to make the text layer non-trivial where the register's description says nothing, and §5 does not list it as rejected. It may well be out of scope — but an unlisted option is an unmade decision, and this one bears directly on the central claim.

## M-17. The growth confound is acknowledged in the right place and then ignored by the money

FR-27 and `key-figures.md` handle revenue growth correctly: no direction, therefore no favourable quartile, no percentile, no kroner — *"because fast growth often explains a weak margin"*.

But the **operating margin gap still produces its full kroner amount** for a company deliberately spending margin to buy growth, and FR-52 requires the generated text to *"name the largest gaps in kroner"*. So the growth-investing company is told it is losing 1.17 million kroner a year, with the one figure that would explain it demoted to an unranked context row.

Nothing in FR-29, FR-31, FR-52 or FR-54 requires the explanation to **mention** revenue growth when the subject's growth is above the peer distribution and its margin below. That is a deterministic one-line engine rule, and the precedent exists: FR-52 already has the engine, not the model, decide persistence (*"Whether a gap has persisted across years is decided by the engine from the figures"*).

The stakes are highest exactly where the product is most confident: in 62.100 the Q1 margin is **−45.7%**. That distribution is not a performance spectrum; it is a **mixture of two populations** — product companies burning investment and consultancies converting hours to cash. A "gap" of 55 points to the upper quartile in a mixture is an artefact of mixing, not a management opportunity, and banding on personnel cost share will only partly separate them (both call themselves "Programvareutvikling"). UJ-1 prints exactly this: *"Against the favourable quartile of 9.1 % it is a gap of seven points — about 1.17 million kroner a year"*, computed from an industry-wide distribution with a **−3.2% median**. The journey flags that the quartiles are industry-wide and indicative, and still uses the kroner figure as its payoff. The honest reading of 62.100's numbers is that the industry-wide distribution is not benchmarkable at all — which is an argument the peer group has to *win*, not one the illustration may assume.

## M-18. Payable days: direction ↑, converted to kroner, is a recommendation — and by the document's own rule it should have no direction

`key-figures.md` #10 gives payable days direction ↑ and a capital translation. FR-54 says the product *"explains; it does not recommend."* The product will nonetheless compute: *release 400 000 kr by paying suppliers as slowly as your upper-quartile peers.* That is a recommendation with contractual and relationship consequences, it is the one working-capital lever that transfers value from a third party rather than creating it, and high payable days is a **distress** signal at least as often as an efficiency one.

Apply the document's own best rule. FR-27 withholds direction from equity ratio and personnel cost per FTE *"because the direction is genuinely arguable"*. Payable days is far more arguable than equity ratio. Either drop its direction (losing one kroner figure), or state the stretching-suppliers caveat in the row itself rather than only in the ratio's definition.

## M-19. Product-only cost is never named as such, and some of it is unaffordable

Beyond C-4's cut list, three items deserve naming because they are individually small and collectively a week:

- **FR-6's CAPTCHA** on a product with no planned deployment (OQ-18, OQ-19 make deployment a gate). Rate limiting earns its place as a course security deliverable; the CAPTCHA integration does not.
- **FR-40's conversion in place** — Supabase-specific plumbing, no SM.
- **FR-48's audit log with prior state**, append-only, covering anonymous actors too. Listed as a course security requirement in the technical note, so it stays — but "prior state" on an append-only log across anonymous analyses is more design than the one FR line suggests.

## M-20. The rule against selecting on a benchmarked measure is nominal; the constraint that matters is statistical

FR-13: *"Selection uses no margin, return or productivity measure at all."* True by name. But:

- Fixed-asset intensity (`anleggsmidler / sumEiendeler`) is a selection feature; **operating asset turnover** (`sumDriftsinntekter / (sumEiendeler − bankinnskudd)`) is benchmarked. Selecting on asset composition conditions on the benchmark's denominator.
- Capitalised intangibles is a selection feature and a component of `sumEiendeler` — the same denominator, plus the depreciation that drives EBITDA margin.

So the funnel conditions on the denominators of two benchmarked ratios while satisfying the letter of the rule. **Nobody has checked the induced correlation**, and there is exactly one way to check it: for each benchmarked figure, report the subject's gap under the full funnel against its gap under stages 1–3 only. That is the honest version of FR-13's test (H-6), it is one query, and it would be a genuinely strong thing to report. It is not in the PRD.

## M-21. The NLOD credit asserts licence coverage over the documents §8 says are unlicensed

§8 is one of the best passages in the document: *"the register licences the key-figures API but **not** the filed annual-account documents ... Twelve of the fifteen key figures are recovered from those documents by OCR, so the gap sits under most of the figure set rather than at its edge."* Correctly placed as a pre-deployment gate, correctly resolved as "ask Brønnøysundregistrene, not their website".

But FR-65 then requires, *"on every route out of the product, PDF export included"*: **"Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene"** — printed over a figure set 12/15 of which comes from documents whose licence §8 records as *"Ikke oppgitt"*. **The attribution makes a licence claim about data the PRD says is not licensed.** That is arguably worse than silence, and it is a wording fix: scope the NLOD statement to the API-sourced figures, or phrase it so it does not assert coverage of the documents. §8 and FR-65 were written for different reasons and nobody reconciled them.

## M-22. There is no requirement for the case where the **subject's own** filing fails reconciliation

FR-58: *"a failure blocks the filing rather than degrading the analysis silently."* FR-24: *"A figure the subject has from OCR and the peers do not is not shown."* FR-25: the benchmark year is the subject's latest filed year.

What happens when the subject's latest filing fails the within-document check? Fall back to the prior year (violating FR-25)? Show only the three API-sourced figures? Refuse the analysis? **At 88% column reconciliation roughly one subject in eight has a problem somewhere**, and the document has no FR for it. This is not a nitpick: it is the most common degraded path in the product and it is unspecified. UJ-1 and UJ-2 both assume a clean subject.

## M-23. The one-access-model design is elegant and its operational cost is unbudgeted

FR-39's anonymous sign-in on arrival is genuinely the right call — one RLS model, one audit log, one rate limiter, and the `is_anonymous` trap correctly caught in FR-47. The cost: a row in `auth.users` for **every** visitor, plus an audit row per analysis, plus rate-limit state, all before the visitor does anything; plus in-place conversion (FR-40); plus CAPTCHA (FR-6). Supabase anonymous-user accumulation is a known operational chore with no cleanup story here. The schedule gives all of this to week 1, alongside the data model and workspaces.

---

# LOW

## L-24. Internal inconsistencies a sensor will notice

- **§4 opening:** *"Requirements are numbered globally FR-1 to FR-63."* §0 says FR-1 to FR-67, and FR-64–FR-67 exist. Stale header.
- **FR-5 cites the wrong FR:** *"Every other classification happens at ingestion (FR-20)."* FR-20 is "Peer group assembly latency". The ingestion-time classification claim lives in FR-11 and the technical note.
- **§6.2's cut order has a phantom third rung.** It ends *"then the third industry"*, but the third industry is already out of MVP per §6.2's own first bullet and OQ-4. Two real rungs presented as three — which matters, because C-4 turns on the depth of that list.
- **OQ-12 is filed under "Gated on measurement"** when it is gated on a week-8 decision (M-15).
- **Figure counts drift.** §3: *"one of the 14 numbered measures ... plus the unnumbered cash share"*; §3 again: *"Three of the 14 are API-only"*; addendum: *"12 of the 15 formulas depend on OCR"*. All reconcilable (15 total, 3 API, 12 OCR incl. cash share) but stated three ways. Fix to 15 uniformly.

**Checked and correct** — worth recording, since this is the arithmetic a sensor will verify first: UJ-1's 7.0 points × 16.7m = 1.169m ✓ (and 12 employees × 1 390 898 = 16.69m ✓). UJ-2's 15.3 − 2.5 = 12.8 points × 10.4m = 1.331m ✓ (9 × 1 159 406 = 10.43m ✓). Both peer statistics match `industry-screening.md` exactly. The percentile formula, the `PERCENTILE.INC` choice, the ROA and personnel-cost-share identities, and the direction-aware favourable-quartile definition are all internally consistent between §3, FR-21, FR-27 and `key-figures.md`.

## L-25. "Under one second" is asserted, not estimated — and the decimal library runs on every slider tick

FR-20 and SM-5 commit to sub-second assembly with no volume estimate behind them. Assembly filters ~1000 companies on six comparability fields, segments, joins fingerprint bands and stage-5 categories, then computes interpolated median/quartile/percentile for 15 figures — and FR-19 requires **all of it to recompute immediately** on every peer exclusion.

Separately, FR-31 requires three money outputs to *"update live"* from the closable-share control, while FR-21 and §7 require *"a decimal library"* and integer øre with no floats **including intermediate results**. That means decimal arithmetic across 15 figures and three totals on every slider tick, either in the browser or in a round trip per tick. Neither is specified and neither is impossible; it is simply asserted where it should be estimated.

## L-26. Registered websites are an unlisted option bearing directly on the central claim

Covered in M-16; recorded separately because it is the one *addition* I would argue for rather than a cut. 26–36% of companies have a registered URL. §5's Non-Goals list is otherwise scrupulous about recording rejected options with reasons; this one is absent rather than rejected.

---

# What the document gets right, briefly

- **The five-stage funnel with visible counts, per-peer inclusion reasons, and three explicit match-basis tiers** (FR-15, FR-16) is the correct product answer to an unprovable claim: make the group interrogable rather than asserting it is good. FR-16's *"The model classifies; it does not write the justification"* is exactly the right boundary.
- **FR-22's behaviour below the floor** — row persists, subject's own value stays, the cell states how many comparable values exist — is the right answer, and better than the alternatives. Its problem is frequency (C-3), not design.
- **FR-23's "undefined is not zero"**, including derivation from a stated total before giving up, correctly encodes the `<langsiktigGjeld/>` trap.
- **FR-57's refusal to use recognition confidence** as a quality signal, justified by the 0.974-mean-confidence-with-misreads evidence, is the sharpest piece of engineering judgement in the project.
- **FR-32's no-default multiple** is a rare case of a product deliberately refusing to show its most impressive number. Keep it.
- **FR-47** catching the `authenticated`-role-includes-anonymous trap, and **FR-37**'s structural rather than procedural exclusion of unfiled figures from aggregates (*"leaking an unfiled figure into a peer median would require changing the query rather than forgetting a filter"*), are both the right kind of defence.
- **FR-67's refusal to annualise** a part-year figure, comparing instead against the owner's own same months, is the correct resolution of a genuinely hard problem — and the right one to state rather than correct.
- **§8's licence gap** is disclosed at the right severity and with the right resolution path. Its only flaw is FR-65 contradicting it (M-21).
- **The counter-metrics SM-C1–C4** are real counter-metrics, not decoration. They are also the only place in §9 where the document argues against its own incentives — which is why the missing fill-rate counter-metric (C-3, and it should be an SM-9) is conspicuous by absence.

---

# The five things I would change before this generates epics

1. **Write the labelled set down as a requirement** — size, candidate sampling frame that makes recall computable, start week, and a minimum-viable fallback. Then reduce SM-1's splits to what that number of labels can actually support (C-1, H-14).
2. **Demote "better than industry code" to a sanity check and promote the rules-versus-model ablation to the headline claim**, stating the criterion contamination plainly instead of covering it with the blinding sentence. Pre-register the rubric, date it, and blind one subsample to the accounts (C-2, M-15).
3. **Compute the expected qualifying peers per key figure, per size band, per industry, after reconciliation — before the UI is designed** — and add SM-9 for realised fill rate. If the modal subject populates under half the figure set, cut the figure set (C-3).
4. **Deepen the cut order**: FR-28 multi-year trend first (two-thirds of all OCR volume, decoration for every metric), then unfiled and year-to-date figures (FR-33–38, FR-67), then PDF export, then the portfolio page, then industry overviews — and add the rung §6.2's own logic implies: one industry measured properly beats two measured thinly (C-4, H-11).
5. **Extend FR-30 to the working-capital side** (`receivable days` ∩ `operating asset turnover` overlap), stop calling the cost shares a "breakdown", and require *s* and the EV/EBIT multiple to appear beside every derived money figure in an export (C-5, H-8, H-9).
