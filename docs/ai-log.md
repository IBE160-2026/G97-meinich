# AI log — Peerless

A record of how AI tools were used in this project: what was asked for, what came back, what was wrong, and how it was caught.

**What goes in.** An entry is written when at least one of these holds:

1. The AI proposed something wrong, or something that was rejected.
2. The proposal touched authorisation, data access or money. These are always logged, even when correct, together with what could have gone wrong (`AGENTS.md` requires this).
3. The AI's reasoning led to a project decision.

Routine work that went as expected is not logged.

**Rules.** Entries are appended at the bottom and never edited afterwards. If an entry turns out to be wrong, a new entry corrects it. The table below is updated with each new entry.

**Tags.** `auth` · `money` · `parsing` · `llm-boundary` · `scope` · `docs`

| Tag | Entries |
|---|---|
| auth | 5 |
| money | 5 |
| parsing | 3 |
| llm-boundary | 4 |
| scope | 10 |
| docs | 10 |

## Entry template

```markdown
### YYYY-MM-DD — Short title
**Tags:** …
**Tool:** …
**Asked:** What was requested, in one or two sentences.
**Got:** What came back.
**Problem:** What was wrong, or what could go wrong. "None" is allowed for auth/money entries.
**Caught by:** Review, test, verification against source, contradiction with another document.
**Outcome:** What was decided, and the commit.
```

---

## Entries

### 2026-09-23 — Product feature suggestions from an external chat
**Tags:** scope · llm-boundary
**Tool:** ChatGPT (brainstorming, external); reviewed with Claude Code (Opus 5.5)
**Asked:** Ideas for developing Peerless further, then an assessment of which of them belong in the product.
**Got:** A long list of features: an overall "Peerless Score", similarity percentages with fixed weights (40/20/15/10/10/5), an "Ask Peerless" chat over the data, screening and "hidden champions" rankings, a competitor scatter plot, a board report, and whole-register ingestion with nightly updates.
**Problem:** Several suggestions conflict with the project's own rules. The chat would have the model answer questions like "what would EBITDA be at peer margin" — the model calculating, which the non-negotiable rules forbid and which the figure-validation test cannot hold on free text. The composite score needs arbitrary weights and cannot be traced to the accounts. The similarity percentage and weights were unmeasured, presenting false precision. Screening and rankings are a different product. Most of the remaining suggestions were already in the brief in a stricter form (kroner gap, engine calculates / model explains, bulk ingestion, pre-computed classification).
**Caught by:** Review of each suggestion against the brief, the technical note and `AGENTS.md`.
**Outcome:** Rejected: composite score, unmeasured similarity score, free-form chat, screening/rankings, whole-register coverage. Accepted: a per-peer inclusion reason generated deterministically from the stored profile, an explicit percentile, and pgvector embeddings as a measured baseline rather than the method. `d0af714`.

### 2026-09-23 — Competitor claims verified before use
**Tags:** docs
**Tool:** ChatGPT (brainstorming, external); verified with Claude Code (Opus 5.5) web search
**Asked:** Who else offers peer benchmarking on Norwegian company data.
**Got:** A competitor table naming Proff Forvalt, Purehelp, Creditsafe, Mynk, PitchBook and Valutico, with claims about each — including that Proff Forvalt offers AI-based analysis and that Valutico launched a peer recommendation engine in 2026.
**Problem:** The claims were unverified. Separately, the review exposed that the brief's own claim — that only credit-risk products exist commercially and the management use case is unoccupied — was wrong.
**Caught by:** Web search against the vendors' own pages. Proff Forvalt's competitor analysis (user-selected companies, key figures side by side) and Valutico's Summer 2026 peer recommendation (comparability scores with rationale) were confirmed. Proff's AI analysis and the Mynk description could not be confirmed.
**Outcome:** The brief names Proff Forvalt and Valutico and states the difference honestly: incumbents leave peer choice to the user or serve valuation. Unconfirmed claims were left out. `d0af714`, refined in `6498fec`.

### 2026-09-23 — Stale reconciliation rules in the data-sources document
**Tags:** parsing
**Tool:** Claude Code (Opus 5.5), during review; origin of the stale text not recorded
**Asked:** A review of the project documents against the ChatGPT suggestions.
**Got:** The review flagged that "Design implications" in `docs/data-sources-brreg.md` demanded an *exact* internal consistency check and fed *per-word OCR confidence* into the data quality flag.
**Problem:** Both contradict the verified findings in the same document. Exact equality rejects valid filings, since the register rounds øre to whole kroner and subtotals can be a krone off. OCR confidence averaged 0.974 while producing figures wrong by orders of magnitude. Code written from that section would have rejected valid filings and trusted bad ones.
**Caught by:** Contradiction with `AGENTS.md` and with the pitfalls section of the same document.
**Outcome:** Section rewritten: a tight absolute bound of a few kroner within a filing, proportional tolerance between sources, quality flag derived from arithmetic checks only. `d0af714`.

### 2026-09-23 — Anonymous users hold the authenticated role
**Tags:** auth
**Tool:** Claude Code (Opus 5.5)
**Asked:** Whether analysis could be open without an account, with an account required only for saving and sharing.
**Got:** A proposal to use Supabase anonymous sign-in, so every visitor has a real `auth.uid()` and one access model covers both anonymous and registered users.
**Problem:** What could go wrong: Supabase anonymous users hold the `authenticated` Postgres role. Any policy that only checks for an authenticated user would admit them to saved analyses, workspaces and unfiled figures. The open route also invites register harvesting and per-visit LLM cost.
**Caught by:** Identified in the proposal itself, before any code.
**Outcome:** `AGENTS.md` now requires every policy on saved or user-entered data to check `is_anonymous`, and the authorisation tests include an anonymous attacker. Rate limiting and CAPTCHA on the open route; explanation text cached per company and peer group. `93c39d1`.

### 2026-09-23 — Disclosure control protected public data
**Tags:** auth · scope
**Tool:** Claude Code (Opus 5.5)
**Asked:** Implications of open access for the planned protection against difference attacks.
**Got:** The observation that the protection could not work with anonymous access — an attacker can take a new identity per query — and, more fundamentally, that it protected nothing: aggregates are built only from public filings, peers are shown by name, and unfiled figures never enter an aggregate.
**Problem:** A security objective in the brief had no asset behind it. It would have cost implementation and test time and been hard to defend under examination.
**Caught by:** Tracing what the control actually protected once the access model changed.
**Outcome:** Dropped as a security objective. Minimum group size kept as a quality requirement. Security effort moved to what is actually private: workspaces, invitations, the anonymous/registered boundary and the open route. `93c39d1`.

### 2026-09-23 — Who can see unfiled figures
**Tags:** auth
**Tool:** Claude Code (Opus 5.5)
**Asked:** A review of the brief after the access-model change.
**Got:** A flagged contradiction: the brief said unfiled figures were visible "only to whoever entered them", while workspaces with invited viewers assumed a board member would see the current year.
**Problem:** An ambiguous rule becomes an ambiguous RLS policy. What could go wrong with the resolution: an aggregate query picking up user-entered figures, a removed member keeping access, figures leaking through PDF export, and comparing a current unfiled year against peers' last filed year.
**Caught by:** Reading the brief and the technical note against each other.
**Outcome:** Unfiled figures belong to the workspace; the owner writes, viewers read, anonymous sessions never read. They live in their own table, and aggregate queries read only filed-accounts tables, so a leak would require changing the query rather than forgetting a filter. Marked as unaudited everywhere, including exports; the period difference is stated. `6498fec`.

### 2026-09-23 — Industry screening script
**Tags:** parsing · scope
**Tool:** Claude Code (Opus 5.5)
**Asked:** A way to choose the first industries from data rather than intuition.
**Got:** `analysis/industry_screening.py`, which counts the population, scores descriptions with word lists, samples the key figures API for comparability and margin spread, and estimates OCR volume.
**Problem:** Three things found while building it. The API filter matches secondary industry codes, which would have inflated the baseline population. The accounting principles object is misspelled `regnkapsprinsipper`, so a parser written from the documented flat field names would have read `null` for `smaaForetak` and `regnskapsregler` and silently failed the comparability filter. And the description score is a generous proxy — Nynorsk words and misspellings count as distinguishing — so it overstates the share of informative descriptions.
**Caught by:** Inspecting a raw API response before writing the parser; reading the examples the report prints for each category.
**Outcome:** Primary-code filtering, the misspelling handled and documented, the proxy labelled as an upper bound with CSV files for hand scoring. Amounts converted to integers and ratios computed with `Decimal`. First industries: 62.100 and 69.202.

### 2026-09-23 — Peer matching beyond the business description
**Tags:** scope · llm-boundary
**Tool:** Claude Code (Opus 5.5)
**Asked:** How to match peers well when many register descriptions say almost nothing.
**Got:** A layered approach: a deterministic fingerprint of the business model read from the accounts, text classification only where there is text, the user describing the subject, and each layer measured separately. Websites and the annual report's own narrative considered and deferred.
**Problem:** What could go wrong: selecting peers on a benchmarked measure makes that gap vanish by construction — the fingerprint must describe the kind of business, not its performance. Personnel cost share is both, so it is limited to coarse bands. User-entered text reaches the model, so a prompt injection is possible; bounded because the model can only answer with fixed categories.
**Caught by:** Identified in the proposal, before any code.
**Outcome:** Five-stage funnel with the fingerprint as a rules stage before classification, the selection rule added to `AGENTS.md`, layer-by-layer measurement. Personnel cost bands left as an open decision.

### 2026-09-23 — Key figure definitions
**Tags:** money · scope
**Tool:** Claude Code (Opus 5.5)
**Asked:** Which key figures the analysis should use, and how each is defined.
**Got:** Fourteen definitions with formula, source, direction and translation to kroner, plus revenue growth, personnel cost per FTE and an operating-asset turnover that excludes cash.
**Problem:** What could go wrong: summing kroner from the cost shares with the operating margin gap counts the same krone twice; receivable days are overstated by VAT; cost lines are classified differently between companies; today's employee count mixed with last year's revenue; a quartile method that cannot be reproduced in a spreadsheet; selecting peers on a ratio that is then benchmarked.
**Caught by:** Identified in the proposal, before any code.
**Outcome:** `docs/key-figures.md` as the single definition the engine implements. Kroner from cost shares explain rather than add; inclusive quartiles; FTEs from the notes; EV/EBIT; selection features only in coarse bands.

### 2026-09-26 — Request-time classification contradiction
**Tags:** llm-boundary
**Tool:** Claude Code (Opus 5.5); surfaced while reviewing the `bmad-prd` draft
**Asked:** A review of the PRD draft produced by `bmad-prd`.
**Got:** A flagged contradiction: FR-5 lets the user describe the subject and sends that text to the model, while FR-20 and the performance NFR say nothing is classified during a user request. The same contradiction sat in the technical note, introduced on 2026-09-23 when the user-entered description was added without revisiting "never at search time".
**Problem:** Two requirements that cannot both hold. An implementation following either one would break the other: no user description at all, or an unbounded model call on the open route.
**Caught by:** Reading the PRD's requirements against each other.
**Outcome:** An explicit exception: classifying a user-entered subject description is the one request-time model call, once per text, cached against that text and rate-limited with the open route. Peers are classified only at ingestion. Fixed in the technical note and the PRD.

### 2026-09-26 — Condensing the brief, and a request for named rankings
**Tags:** scope · docs
**Tool:** Claude Code (Opus 5.5)
**Asked:** Whether the brief needed more before submission; then how to make AI more visible, and a front page with industry widgets such as "highest revenue growth" and "lowest wage relative to revenue".
**Got:** A check against the `bmad-product-brief` skill showed the brief at 3 269 words against its "aim for 1-2 pages". A condensed brief with detail moved to an addendum; AI named where it acts rather than a separate section; and, instead of named rankings, industry overviews without company names.
**Problem:** Named top lists collect exactly the errors the product exists to avoid — a recognition error or a tiny base year lands at the top — and a wage-share ranking systematically favours companies that book subcontractors outside payroll. Adding AI features for visibility (a chat, an AI score) was advised against as ornament. Separately, the front page, tabs and portfolio page grow scope beyond the thirteen-week schedule.
**Caught by:** Reading the skill's own constraints; checking the widget idea against `docs/key-figures.md` known limitations.
**Outcome:** Brief condensed to about 1 800 words with `addendum.md` alongside; industry overviews without names, tabs and a portfolio front page in scope; named rankings out; user-arranged widgets deferred. Schedule impact still to be reflected in the technical note.

### 2026-09-26 — Brief validation: illustrative figures and blind labelling
**Tags:** money · docs
**Tool:** `bmad-product-brief` Validate (Claude Code, terminal session); fixes applied with Claude Code (Opus 5.5)
**Asked:** A validation of the condensed brief before submission.
**Got:** Five findings: delivery scope missing from the known risks; the labelled set not stated as blind although its author designed the method; the front page built on the most fragile data; an illustrative figure that implied a company larger than the ones served; and wording that read as a privacy claim.
**Problem:** The wage-share example ("two points … two million kroner a year") implied 100 million kroner in revenue, while the screening sample's median is 18 million in 62.100 and 10 million in 69.202. A second example ("four points … three million") had the same error. Both were written earlier in the project and survived several reviews, including mine.
**Caught by:** The validator checked the example against `analysis/output/`; the second instance was found by searching the brief for the same pattern.
**Outcome:** Examples recomputed from the screening data (360 000 and 700 000 kroner at 18 million revenue); delivery named as a third risk with the cut order; labelling blind to the funnel stage, in the brief, the technical note and the to-do; the overview degrades to the latest year if history is thin; "distributions, not rankings".

### 2026-09-26 — OCR measurement of older filings
**Tags:** parsing
**Tool:** Claude Code (Opus 5.5), Tesseract 5 in Docker
**Asked:** Measure how well older filings can be read, to decide how far back development over time can reach.
**Got:** `analysis/ocr/era_screening.py` and `analysis/ocr/ocr_accuracy.py`, with reports in `analysis/output/`. Paper filings turned out to be a different kind of document, but rare; the generated section keeps its layout back to 2011; about 88 % of 2021–2025 columns reconcile, and 71 of 71 figures agree with the API.
**Problem:** Four errors were made and caught on the way. The first era rule classified paper cover forms as generated, because the form also contains "regnskapsåret". A todo list written with Windows line endings broke every filename inside the Linux container. Fuzzy label matching first matched "Annen driftskostnad" as "Sum driftskostnad" and "Sum innskutt egenkapital" as "Sum egenkapital", which dropped the income-statement check from 100 % to 0 %. And the digits-only pass, assumed to be an improvement, drops digits in the older font. Separately, `docs/data-sources-brreg.md` had stated as fact that older documents are "worse scans, not a different kind of document" — wrong for paper filings.
**Caught by:** Checking a surprisingly good result against the raw OCR text; a container exit status; a check rate that collapsed after a change; comparing both passes side by side rather than assuming the tuning helped; looking at the documents.
**Outcome:** Strict era rule on the heading; LF line endings; exact label matches first and fuzzy only on a row's own label of near-equal length; the digits-only pass used only as a fallback and only where the result reconciles. Five years of development over time in v1, recorded in the data-sources document, the technical note, the brief and the PRD. Consistency is measured; exact accuracy against a hand-transcribed set is still owed.

### 2026-09-26 — Eight open product decisions closed, and a target that meant two things
**Tags:** money · docs
**Tool:** Claude Code (Opus 5.5), `bmad-prd` Update
**Asked:** Work the open product decisions in the PRD's §11 rather than react to a change: the EV/EBIT default, the reference point, the below-floor display, cash share, the third industry, the hand-entered set, and cache lifetime.
**Got:** Eight decisions taken and carried into the PRD, `docs/key-figures.md` and the technical note. The reference point is now the favourable quartile at every setting of the closable-share control, with the control scaling the gap to it; the EV/EBIT multiple has no default and no enterprise value is shown until the user supplies one; a figure below the ten-peer floor keeps its row and reports its count; cash share stays an unnumbered diagnostic; `43.210` stays out; the hand-entered set is four required components; and freshness is disclosed through a read date rather than promised through a cadence.
**Problem:** Two money problems, one of them latent in the authoritative document. First, `docs/key-figures.md` defined the target as "peer median, or the favourable quartile at full closure". That admits a reading in which a closable share of zero still produces the entire gap to the median — a control labelled "how much of this is closable" that returns a non-zero number at zero. An engine written from that sentence would have been defensibly wrong, and the error would have shown up as inflated kroner amounts at exactly the setting a sceptical user tries first. Second, applying the cash-share decision exposed FR-27 asserting a favourable quartile and a percentile for *every* key figure, when both are defined in the favourable direction and four figures declare none — personnel cost per FTE, equity ratio, revenue growth and cash share. The requirement asked for something undefined. Against the no-default decision: the cost is that the product's headline valuation number is invisible until the user acts, so the feature may simply go unused; a default would have been reached for more often, at the price of the product implying a valuation nobody chose.
**Caught by:** Reading the definition in `docs/key-figures.md` against the requirement in the PRD while writing the decision into both; then reading FR-27's promise against the direction column of the key figure table.
**Outcome:** Target fixed at the favourable quartile in both documents, with the median demoted to context and a marker on the control. The no-direction rule generalised rather than directions invented for equity ratio and pay per FTE, where the direction is genuinely arguable — those figures show against the distribution and are never ranked. Two decision points marked settled in the technical note. Decision trail in the PRD run's `.memlog.md`.

### 2026-09-26 — The register licenses the figures, but not the documents we read
**Tags:** scope · docs
**Tool:** Claude Code (Opus 5.5) with a web-research subagent
**Asked:** Establish the licence and attribution obligations for reusing Brønnøysundregistrene data, an open question no project document had addressed.
**Got:** The open APIs are NLOD 2.0, verified on three register pages. The licence permits commercial use, modification and redistribution, and requires the source and licence to be named and linked, modification to be declared, and the register not to be presented as endorsing the product. Two obligations were new: a credit in prescribed wording, and that a `410 Gone` entity "bør også anses som en forespørsel om at eventuelle kopier/cacher også fjerner den aktuelle enheten".
**Problem:** The finding that matters is a gap, not an obligation. On data.norge.no the key-figures distribution carries NLOD while the filed-document distributions read "Lisens: Ikke oppgitt", and no register page states that the filed annual accounts are covered. Twelve of the fifteen key figures are recovered from those documents by OCR, so the unlicensed source sits under most of the product rather than at its edge. Free innsyn is not a reuse licence — åndsverkloven §33 removes copyright as a bar to access and §34 then limits use of what was accessed. Peerless publishes derived ratios and aggregates, never a reproduction of a filing, which is a materially different act; but that is a legal judgement and no register page settles it, so it is recorded as a gap rather than argued away. Separately, against FR-66: a deletion rule driven by an HTTP status will delete stored data, and a transient or misread `410` would remove a company that should stay. Saved analyses keep their own figures, so the blast radius is the peer pool rather than a user's work — but the rule deserves to be narrow and logged when it fires.
**Caught by:** Reading the dataset's distributions separately instead of taking the dataset's headline licence for the whole of it.
**Outcome:** Attribution and the withdrawal rule become requirements (FR-65, FR-66) and enter v1 scope. The document-licence question is recorded as blocking before any public or commercial deployment and not blocking the coursework, in the PRD (§8, §11.19) and in `docs/data-sources-brreg.md`, which holds the clause references and URLs. The answer comes from asking the register directly; more searching will not produce it.

### 2026-09-30 — Working capital released counted the same receivables twice
**Tags:** money
**Tool:** Claude Code (Opus 5.5), `bmad-prd` reviewer gate — five parallel review subagents
**Asked:** Run a reviewer gate over the whole PRD after the user journeys were captured.
**Got:** 107 findings across five reviewers. Three of them independently reported the same defect: the PRD's Glossary defined *working capital released* as the sum of the receivable-days, payable-days and operating-asset-turnover kroner amounts.
**Problem:** The operating asset turnover amount is computed on a capital base of `sumEiendeler − bankinnskudd`, and `kundefordringer` sits inside `sumEiendeler` and is not `bankinnskudd`. Reducing receivables is therefore already part of reducing operating assets, and adding the two amounts counts the same kroner twice. Payable days does not overlap — it is a liability, outside `sumEiendeler`. What made this worse than an ordinary slip: **FR-30's automated test passed.** That test asserted only that no total sums more than one of the profit cluster — operating margin and the three cost shares — so the capital cluster was unguarded by the very requirement written to prevent double counting, one section below it. No success metric covered the kroner arithmetic either. A user would have seen an inflated "capital released" total with no test, metric or reviewer catching it, and the number would have looked plausible.
**Caught by:** Three reviewers independently; verified by me against the formulas in `docs/key-figures.md` before acting, not taken on the reviewers' word. A fourth reviewer's related claim — that the VAT overstatement in receivable days inflates the kroner amount by about 25 % — was checked and **rejected**: `r/365 × salgsinntekt` is `kundefordringer` by construction, so the conversion back to kroner cancels exactly what the ratio inflated, and the amount is the real reduction in the real VAT-inclusive balance. The valid residue of that finding is that the peer target mixes companies with different export share, which is a comparability problem, not an arithmetic one.
**Outcome:** Working capital released is now receivable days plus payable days only. Capital released from operating assets is a separate amount, presented beside it and never inside it. FR-30 gained a second assertion for the capital cluster, and states why the clusters are tested separately. Fixed in `prd.md` (Glossary, FR-30, FR-31, §1) and in `docs/key-figures.md` in the same change.

### 2026-09-30 — Anonymous state in the URL, and a second model call admitted
**Tags:** auth · llm-boundary · scope
**Tool:** Claude Code (Opus 5.5), `bmad-prd` reviewer gate
**Asked:** Resolve two blockers the gate raised: an anonymous session's peer adjustments had to survive registration while FR-47 asserts anonymous users cannot write user-entered data; and explanation text cached "per company and peer group" meant any peer adjustment forced a request-time model call, while FR-20 said only one such call exists.
**Got:** The user's positions. Anonymous state — organisation number, excluded peers, closable share, EV/EBIT multiple — lives in the URL, so no anonymous session writes to any table and the state is written into the workspace at registration. Explanation text is generated and cached for the default peer group only; an adjusted group shows the default group's text labelled *"Forklaringen gjelder standard peer-gruppe"*; a signed-in user may regenerate behind a rate limit, and an anonymous session never triggers generation.
**Problem:** What could go wrong, on the record. The URL now carries analysis state, so anything ever added to it becomes world-readable by design: every value must stay either public register data or the user's own parameter, and unfiled figures or workspace identifiers must never be allowed in. It is also not tamper-proof — an organisation number or exclusion list in a URL is user input and must be validated on every request, not trusted because it came from a link the product generated. On the model side, the boundary widened from one request-time call to two; the second is gated by an account and a rate limit, but it is a new cost and abuse vector, and FR-6's open-route limiting does not cover it because it is not on the open route. Against the embeddings decision: adding FR-68 puts a scheduled week of work into a document that a thirteen-week solo project may not reach, and it is measurement-only, so it is a candidate for the cut list — but leaving it out of §6.1 would have dropped it from the epics and made SM-1's ablation unreportable, which is worse.
**Caught by:** The testability reviewer, which traced FR-40 against FR-47 and FR-52 against FR-20 and reported both as story-level contradictions rather than wording problems.
**Outcome:** New FR-69 (anonymous state in the URL, with the no-database-write consequence tested) and FR-68 (embeddings at ingestion, measurement-only, never user-facing in v1, listed in §6.1). FR-20 now states exactly two reachable model calls; FR-5, FR-52, §7 and §8 updated to match. FR-8's comparability fields recorded as hard exclusions with FR-18's loosening scoped to size and segmentation; size band defined in the Glossary as `sumDriftsinntekter` from the same filing, 0.5–2× by default and 0.25–4× loosened; testable consequences added to FR-9, FR-14, FR-17 and FR-18.

### 2026-09-30 — The central claim could not fail, so it stopped being the claim
**Tags:** scope · docs
**Tool:** Claude Code (Opus 5.5), adversarial reviewer in the `bmad-prd` gate
**Asked:** Attack the PRD's reasoning, hardest first, starting with the measurement the grade rests on.
**Got:** The finding that §1 and §10's claim — that reading what a company does assembles a better peer group than industry classification alone — is not falsifiable under the stated protocol. The labelled set is judged by the person who designed the method, on the criteria the fingerprint encodes: cost composition, inventory, asset intensity. Industry code demonstrably does not capture those, so it must lose. Blinding the labeller to which funnel stage proposed a candidate removes provenance bias, not the circularity of the criterion itself. §10's promise that "it can come back negative" was therefore unearned.
**Problem:** The claim that could not fail was the headline of a graded project, and a sensible examiner would find this faster than the reviewer did. What could go wrong with the fix: the ablation *can* fail, which is the point, but it also means the honest result may be "the model added nothing measurable over the accounts-based fingerprint" — and that is a thinner-sounding result to present even though it is a better one. The three defences added do not fully remove the circularity either, and the PRD now says so rather than implying they do. The blind subsample is the only one that genuinely breaks it, and it is a subsample.
**Caught by:** The adversarial reviewer. Two other reviewers in the same gate rated strategic coherence "strong" and did not see it, which is an argument for keeping an adversarial lens in the gate rather than only a rubric.
**Outcome:** The headline claim is now the layer-by-layer ablation — how much each layer adds, and whether the model adds anything beyond the fingerprint. The comparison against industry code alone is demoted to SM-1b, a sanity check whose passing shows the labelling is coherent rather than that the method works. Added: the rubric is written and dated before the fingerprint's feature list is fixed; a subsample is labelled from description and website only, blind to the accounts; a second labeller judges about 50 pairs with Cohen's κ reported. FR-70 gives the labelled set a sampling frame it did not have — 15 subjects per industry, 30 candidates each drawn at random from the subject's **size band rather than from the funnel's output**, which is what gives recall a denominator. Carried into §9, §10, the brief's Credibility paragraph and the technical note.

### 2026-09-30 — Peer group yield computed, and the subject that gets nothing
**Tags:** scope · docs
**Tool:** Claude Code (Opus 5.5); `analysis/peer_group_yield.py`, written for this
**Asked:** A reviewer objected that nobody had multiplied the funnel through the 88 % reconciliation rate, so the modal analysis might be mostly "too few comparable values" rows with no metric noticing. Compute it.
**Got:** Computed from the existing screening samples rather than argued about. After comparability and the size band, and after the reconciliation rate, the typical `62.100` subject has about 223 qualifying peers for a document-sourced figure; dividing by three to stand in for classification leaves about 74, and 88 % of subjects still clear the ten-peer floor. `69.202` is comfortable throughout. **The reviewer's worry was not supported, and the table now says so with numbers.**
**Problem:** The real failure case is narrower and was missed by everyone, including me. `smaaForetak` is a comparability field and therefore a hard exclusion, so a subject that is **not** a small enterprise can only be compared against others like it. In `62.100` that is 8 of 93 comparable companies and they still find a median of 25 peers. In `69.202` it is **1 in a sample of 99** — roughly 8 companies in the whole industry — so **a large accounting firm gets no peer group at all** and FR-22 correctly withholds every aggregate. The behaviour is right; the coverage limit was undocumented, and the first such visitor would have discovered it. Also worth stating: the computed figures are upper bounds, because the script applies stages 1 and 2 plus the size band and stands in for stages 3 to 5 with a crude division. Quoting them as the real yield would be the same kind of overconfidence the reviewer was attacking.
**Caught by:** Writing the computation instead of accepting the finding. The `smaaForetak` consequence fell out of the data once the filter was applied per subject rather than to the population as a whole.
**Outcome:** `analysis/peer_group_yield.py` and `analysis/output/peer-group-yield.md` added, with the assumptions in the script's docstring. The table and the `smaaForetak` limit are stated in §10. The user's brief had put the non-small share at about 11 %; the measured figure is 9 % in `62.100` after comparability and 1 % in `69.202`, so the PRD states it per industry rather than as one number.

### 2026-09-30 — Two overclaims corrected: NLOD coverage, and VAT "cancelling out"
**Tags:** money · docs
**Tool:** Claude Code (Opus 5.5), reviewer gate
**Asked:** Resolve the remaining gate findings, among them an NLOD credit I had written four days earlier and a claim about VAT inherited from `docs/key-figures.md`.
**Got:** Both were overclaims, one mine and one older. FR-65 had the product print *"Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene"* across the board — while §8 of the same document states that the register licences the API but **not** the filed documents, which twelve of the fifteen key figures come from. The credit asserted coverage the same PRD denied. Separately, §5 said the VAT overstatement in receivable days "is similar across a VAT-registered peer group, so the comparison holds".
**Problem:** The NLOD error is the worse of the two: a licence claim printed in the interface, in a graded document, contradicted two sections away. On VAT — export sales are zero-rated, so a company selling abroad carries proportionally less VAT in its receivables and shows fewer receivable days for identical real credit terms, and export share varies along the very axis the fingerprint separates businesses on. So the distortion does not cancel; it is roughly similar only where peers share a VAT profile, and it is worst where the group is most mixed. A reviewer additionally claimed the kroner amount was inflated ~25 % by this, which I checked and **rejected**: `r / 365 × salgsinntekt` is `kundefordringer` by construction, so the conversion returns the real VAT-inclusive balance and the money is right. What the VAT profile distorts is the target, not the arithmetic.
**Caught by:** The adversarial reviewer for both; the arithmetic half of the VAT finding was disproved by working the algebra rather than accepting it.
**Outcome:** FR-65 now claims NLOD for API-sourced data only and credits document-derived figures to the source **without asserting a licence**, with the distinction visible to the reader. §5's VAT limitation rewritten to say the distortion is roughly similar rather than cancelled, to name export share as the reason, and to state that the kroner amount is unaffected. Also in this round: FR-13's banding test now runs per industry, because a test aggregated across industries could pass while failing in `43.210` where band and margin move together; FR-53's containment test now also rejects a figure attached to the wrong key figure, company, year or direction, and parses Norwegian number formats; and new FR-71 covers a subject whose own filing fails reconciliation — API-sourced figures shown, the rest absent with the reason given.

### 2026-10-04 — Withdrawn companies leave saved analyses too, and the premise was checked first
**Tags:** auth · docs
**Tool:** Claude Code (Opus 5.5), `bmad-ux`
**Asked:** Design the state for a saved analysis whose company the register later withdraws. My first proposal kept the analysis read-only with its figures; the user overruled it citing FR-66.
**Got:** Before acting on the overrule, the documents were checked: FR-66 bullet 3 and the technical note's licence paragraph said the *opposite* of the cited premise — a saved analysis keeps its figures as a record of its read date (FR-64). Shown to the user with both readings. The user chose removal, by role: as subject, the figures are removed and the workspace keeps only the notice *"Selskapet er slettet fra Enhetsregisteret 12.03.2027, og tallene er fjernet"*; as peer, its row and name are removed and already-computed aggregates kept with *"Én sammenlignbar er fjernet fra registeret"*.
**Problem:** What could go wrong, on the record. Deletion now reaches user-owned rows, not only register copies, so the batch job must find every saved analysis naming the entity across all workspaces — a job that runs with service-role rights and bypasses row-level security, which makes it the one place a bug could touch other users' data. It must delete only rows about the withdrawn organisation number, and the authorisation suite should assert that no user path can trigger it. A missed copy (a cached explanation text, a PDF already generated, a URL carrying the orgnr) would keep data the register asked to be deleted; exported PDFs are outside our reach and the documents should not imply otherwise. Keeping aggregates computed with the removed peer is a judgement: they contain no data identifying it, but the count shown no longer matches the visible rows, which is why the note is required. FR-64's record promise now has an exception, and saying so is better than an untrue promise.
**Caught by:** Verification against source — reading FR-66 before editing it, rather than taking the cited requirement on trust.
**Outcome:** FR-66 bullet 3, FR-64, §6.1 and the technical note's licence paragraph updated to state the exception. Also in this round: favourites removed (to follow = to have a saved analysis), the size band loosens in three fixed steps with 0.33–3× added to `analysis/peer_group_yield.py` and its report, and user-entered figures are labelled *Egne tall – ikke levert* and never yield kroner.

### 2026-10-04 — The VAT correction never reached key-figures.md, and "unaudited" was the wrong word
**Tags:** docs
**Tool:** Claude Code (Opus 5.5), `bmad-ux` source extraction
**Asked:** Extract UX-relevant facts from the authoritative documents.
**Got:** Two inconsistencies. `docs/key-figures.md` still said the VAT overstatement is similar across peers "so the comparison holds" — the claim the 2026-09-30 entry corrected in the PRD, but which survived in the document AGENTS.md ranks above the PRD. I first proposed writing UX copy from key-figures.md on that ranking; the user overruled it, because the PRD's wording was the accurate one. Separately, user-entered figures were labelled "unaudited" everywhere, while many small AS companies have no auditor, so their *filed* accounts are unaudited too and the label implied a distinction that does not exist.
**Problem:** Precedence rules decide which document wins, not which is right; following them mechanically would have printed the weaker claim in the interface. A correction made in one document and not its siblings is the failure AGENTS.md's edit-in-place rule exists to prevent.
**Caught by:** Contradiction between sources, surfaced by the extraction; the label problem by reasoning about the population.
**Outcome:** `docs/key-figures.md` VAT bullet rewritten to match the PRD. The label *Egne tall – ikke levert* now replaces "unaudited" in the brief addendum, the PRD and its addendum, with the reason stated once in the PRD glossary.
