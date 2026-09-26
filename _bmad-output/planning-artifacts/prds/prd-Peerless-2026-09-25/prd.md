---
title: Peerless
status: draft
created: 2026-09-25
updated: 2026-09-26
---

# PRD: Peerless

## 0. Document Purpose

This PRD is for the people who build Peerless and the downstream BMAD workflows that turn it into UX, architecture, epics and stories. It is also read by a course sensor checking whether the arithmetic is right.

It states **what Peerless does**, not how. Four hand-written documents remain authoritative and are referenced rather than duplicated:

| Document | Owns |
|---|---|
| `briefs/brief-Peerless-2026-09-17/brief.md` | What the product is and who it serves |
| `technical-note-architecture.md` | Architecture, test strategy, the thirteen-week schedule |
| `docs/data-sources-brreg.md` | Data sources, verified field sets, API traps |
| `docs/key-figures.md` | Every key figure's formula, source, direction and kroner translation |

Where this PRD and one of those four disagree, **the other document wins and this one is wrong** — fix it here. Technical depth that surfaced during discovery sits in `addendum.md` as pointers into those documents, never as a second copy.

Structure: vocabulary is fixed in §3 Glossary and used verbatim everywhere after. Features are grouped in §4 with functional requirements nested and numbered globally FR-1 to FR-60 so epics can cite stable IDs. Assumptions are tagged `[ASSUMPTION]` inline and indexed in §12.

## 1. Vision

A managing director knows their gross margin. They do not know whether it is good.

Peerless answers the question a company cannot answer about itself: **where are we losing money relative to companies like us, and what would closing that gap be worth.** A user enters an organisation number and sees their company positioned against a group of genuinely comparable businesses across margin, cost structure, working capital, capital efficiency and productivity. Every deviation is converted into kroner. One control sets how much of each gap the user believes is closable, and the result reads as annual profit uplift, working capital released, and implied enterprise value.

The data is already public and free. Every Norwegian limited company files its accounts, and those filings sit in a public register alongside industry classification, size and a free-text description of what the company does — used almost entirely for checking whether counterparties pay their bills. Peerless reframes that register as a management data source.

The comparison itself is not hard. **Choosing the group is**, and that is why it rarely happens. Industry codes are too coarse: a company registered under a generic programming code could be a reseller, a product company or a consultancy, and comparing across those produces confident nonsense. A comparison against the wrong set is worse than no comparison, because a managing director will spot it in the first thirty seconds and never return. The peer group determines the answer — which is why its quality is **measured against a human-labelled set rather than asserted**, and why that measurement is the project's central result.

The near-term goal: any company can see itself in context in under a minute, for nothing, and the comparison is good enough to argue with.

## 2. Target User

### 2.1 Jobs To Be Done

**Accountants and advisers — the primary user, and the one most likely to pay.**

- Answer "are we doing well?" for dozens of client companies with evidence instead of impression, without rebuilding the analysis each time.
- Turn an unbillable conversation into a billable advisory service.
- Judge whether a proposed peer group is actually right — they are the user best placed to do this, which is why v1 is built for them.
- Carry their own client base as the product's distribution.

**Managing directors and finance leads — also served in v1.**

- Find out whether a figure they already know is good or bad, before a pricing, hiring or working-capital decision.
- Get that without maintaining a modelling tool — they will not.
- Change what they work on next, having seen where the largest quiet gap is.

**Board members and co-owners — served as invited viewers.**

- Read management's figures against an external reference, often for the first time.

### 2.2 Non-Users (v1)

- **Investors and fund professionals.** Screening targets and benchmarking a portfolio start with the same question, but depend on screening and portfolio views that are out of scope (§5). Explicitly deferred, not served badly.
- **Anyone analysing a company outside a covered industry.** They see that company's own filed key figures and a plain statement that the industry is not yet covered — no peer comparison is offered (FR-4).
- **Credit and risk analysts.** Peerless answers "where are we losing money", not "will they pay". The incumbents serve the second question well and this product does not compete there.
- **Banks, insurers and entities outside the ordinary accounting layout.** Their filings do not fit the layout extraction depends on.

### 2.3 Key User Journeys

> **[ASSUMPTION — the whole of §2.3]** These journeys are drafted, not captured. The protagonists, their contexts and the beat-by-beat paths are my invention, inferred from the brief's user types; the brief names the users but narrates no sessions. **This is the section most worth your correction**, because UX and epics will build screen order directly on it. Every FR reference is real; the scenes around them are not yet yours.

- **UJ-1. Ingrid checks a client's margin before a meeting she did not prepare for.**
  - **Persona + context:** Ingrid, an authorised accountant with 40 client companies, has a board meeting in 20 minutes and the client has asked "how are we doing compared to others?" She has never had an answer that was not an impression.
  - **Entry state:** Not signed in, on a laptop, in a browser tab opened from a bookmark.
  - **Path:** Types the client's organisation number → sees the company identified with its filed key figures and a peer group of 23 companies → scans the funnel counts showing how the 23 were narrowed → sees operating margin at the 18th percentile, personnel cost share 4.1 points above the peer median → reads the kroner amount beside it.
  - **Climax:** The personnel cost gap reads as **2.4 million kroner a year** at full convergence with the favourable quartile. She has a number, and the path from it back to the filed accounts is on screen.
  - **Resolution:** She takes the meeting with one concrete figure and the peer list behind it. No account, no setup, nothing saved.
  - **Edge case:** Two of the 23 peers look wrong to her — a reseller and a much larger firm. She excludes both; everything recomputes in under a second and the gap moves to 2.1 million (FR-17, FR-19).

- **UJ-2. Ingrid saves the analysis and invites the client's chair to see it.**
  - **Persona + context:** Same Ingrid, next morning. The meeting went well enough that the chair asked to see it himself.
  - **Entry state:** Anonymous session from yesterday, same browser.
  - **Path:** Clicks save → asked for an email address → receives a magic link → signs in, and **the analysis she built anonymously is still there**, because the anonymous user was converted in place (FR-40) → creates a workspace for this client → invites the chair by email as a viewer.
  - **Climax:** The chair opens his own link and sees the same figures, read-only, without being able to reach Ingrid's 39 other clients (FR-45).
  - **Resolution:** A workspace exists per client. Ingrid is now a user with many workspaces, which is all "adviser" means here.
  - **Edge case:** She mistypes the chair's address. The invitation grants nothing until accepted from that mailbox, and it reaches one workspace only, as a viewer (FR-44).

- **UJ-3. Bjørn learns that his best-looking number is the ordinary one.**
  - **Persona + context:** Bjørn runs a 14-person software consultancy and is deciding whether to raise rates. He is proud of a 9% operating margin.
  - **Entry state:** No account, on his phone at about 390px wide, standing up.
  - **Path:** Enters his own organisation number → the ratio table reflows to one column and the distribution plot scrolls inside its own container, the page itself never sideways (FR-55) → sees 9% sits at the **62nd percentile**, unremarkable → scrolls to revenue per FTE, where he is at the 21st.
  - **Climax:** The gap is not price, it is productivity — his personnel cost per FTE is ordinary while his revenue per FTE is not. He was about to solve the wrong problem.
  - **Resolution:** He wants the decomposition view that puts pay level and productivity side by side (FR-26), which needs an account, so he signs in with a magic link and keeps the analysis he started (FR-40, FR-42).
  - **Edge case:** Receivable days shows no peer aggregate at all — fewer than 10 peers had a usable value for it — so the row says so plainly instead of comparing against four companies (FR-22).

- **UJ-4. Ingrid enters figures that have not been filed yet, and the product refuses to pretend they are audited.**
  - **Persona + context:** A client's year ended in December; the filing goes in months from now. The client wants to know where they stand *now*.
  - **Entry state:** Signed in, owner of that client's workspace.
  - **Path:** Enters current-year revenue and operating profit by hand, and personnel cost as an optional extra (FR-38) → every figure derived from them is labelled unaudited wherever it appears, exports included (FR-33) → the comparison states that these figures cover a different period from the peers' latest filed year (FR-35).
  - **Climax:** She sees a provisional position she could not otherwise have, and can tell it apart from the filed analysis at a glance.
  - **Resolution:** When the real filing lands it takes precedence automatically and her figures are kept as history (FR-36). They never entered any peer aggregate at any point (FR-37).
  - **Edge case:** The chair, a viewer, can read the unfiled figures but not change them; an anonymous visitor cannot see them at all (FR-34).

## 3. Glossary

Downstream workflows and readers use these terms exactly. Introducing a synonym anywhere is a discipline violation. Register field names are the register's own and are never translated — including two the register misspells.

**Core objects**

- **Organisation number** (`organisasjonsnummer`) — the nine-digit register key. The sole lookup input and the **only** basis for matching a company across filings and years; names change while the number does not.
- **Subject** — the company being analysed. Exactly one per analysis. Must be in a covered industry to receive a peer group (FR-3); outside one it gets its own key figures only (FR-4).
- **Front page** — the entry page: a description, the organisation-number field, and industry overviews (FR-61).
- **Industry overview** — an aggregate picture of one covered industry. Never names a company.
- **Portfolio** — a signed-in user's front page, listing every company they follow (FR-63).
- **Peer** — a company included in the subject's peer group. Named and visible, never anonymised.
- **Peer group** — the set of peers assembled for a subject by the funnel (§4.2). Visible, adjustable, and never used for an aggregate below the minimum group size.
- **Covered industry** — an industry Peerless offers peer analysis for. An industry becomes covered only once its filings are extracted and reconciled **and** its peer selection has been measured against a labelled set. Unmeasured industries are not offered.
- **Workspace** — the unit of saved work, typically one per company. Has one **owner** and any number of invited **viewers**.
- **Owner** — creates a workspace, owns it, writes unfiled figures, invites viewers.
- **Viewer** — invited read-only member of a workspace: a board member, co-owner, or an adviser's client.
- **Adviser** — *not a role.* A user with many workspaces. There is no adviser role in the system.
- **Anonymous session** — a visitor without an account. Holds a real `auth.uid()` via Supabase anonymous sign-in, so one access model covers everyone. May read public figures and nothing else.
- **Open route** — the no-account path: lookup, peer group, adjustment, kroner gaps. Rate-limited.

**The funnel**

- **Coarse filter** — stage 1, rules. Industry code and size band.
- **Comparability filter** — stage 2, rules. Requires subject and candidate to match on currency (`valuta`), accounting framework (`regnskapsregler`), `smaaForetak`, `avviklingsregnskap`, financial period and `regnskapstype`.
- **Segmentation** — stage 3, rules. Size, legal form, and geography where the industry calls for it.
- **Business-model fingerprint** — stage 4, rules. Reads *what kind* of business a company is from its own accounts: cost of goods share, whether it carries inventory, capitalised intangibles, fixed-asset intensity. Separates a reseller from a product company from a consultancy even when all three call themselves "Programvareutvikling".
- **Classification** — stage 5, model. Judges whether a candidate is the same type of business, from company name, secondary industry codes, statement of purpose and business description. Answers only in fixed categories.
- **Unclassified** — a company with nothing useful to classify on. Stored as unclassified, **never guessed at**, and still eligible as a peer through stages 1–4.
- **Match basis** — what a peer's inclusion rests on, one of three tiers: *description and accounts* / *accounts alone* / *industry and size alone*.
- **Inclusion reason** — the short statement of why a peer was included. Generated deterministically from shared profile fields. **Rules-written, never model-written.**
- **Coarse band** — the banded form in which a measure that is *also* benchmarked may enter selection. Today: cost of goods share and personnel cost share. Selecting on exact values would drive that gap to zero by construction.

**Figures and the benchmark**

- **Key figure** — one of the 14 numbered measures defined in `docs/key-figures.md`, plus the unnumbered cash share. That document is authoritative for every formula.
- **Filed figures** — figures from the register: the structured key-figures API, or OCR of the filed document, reconciled.
- **Unfiled figures** — owner-entered current-year figures, before official filing. Always labelled unaudited, never merged with filed figures, never in an aggregate.
- **API-sourced** / **OCR-sourced** — a key figure is OCR-sourced if *any* component is. Three of the 14 are API-only: operating margin, return on assets, equity ratio.
- **Median** — the peer median for a key figure.
- **Favourable quartile** — the upper quartile where higher is better, the lower quartile where lower is better. Direction-aware by definition.
- **Percentile** — the share of peers the subject does better than, ties counted as half: `(peers worse + 0.5 × peers equal) / peers × 100`, in the favourable direction.
- **Minimum group size** — 10 peers, counted **per key figure** after companies with an undefined value for that figure are excluded. Below it, no aggregate is shown for that figure. A quality threshold, not a confidentiality control.
- **Undefined** — a key figure that cannot be computed for a company because a denominator is zero or negative, or a component is missing and cannot be derived from a stated total. **Undefined is not zero.** The company leaves that figure's distribution and the excluded count is shown.
- **Data quality flag** — a per-filing flag derived **only** from the two reconciliation checks, never from OCR confidence. A generic engine reported mean confidence 0.974 while misreading several figures; confidence is not a signal.
- **Reconciliation** — two checks, neither exact equality. *Within* a document: a tight absolute bound of a few kroner, because the register prints whole kroner rounded from øre. *Between* document and API: a proportional tolerance, because reporting in thousands or millions introduces scaling error.

**Money**

- **Closable share** (*s*) — the user-set fraction, 0 to 1, of each gap assumed closable. 1 means full convergence with the favourable quartile.
- **Target** (*T*) — the reference value a gap is measured to: the peer median, or the favourable quartile at full closure.
- **Annual profit uplift** — the kroner value of the operating margin gap: `(T − r) × sumDriftsinntekter × s`.
- **Working capital released** — the kroner value of the receivable-days, payable-days and operating-asset-turnover gaps.
- **EV/EBIT multiple** — a user-set multiple applied to annual profit uplift to give implied enterprise value. EBIT, not EBITDA, because `driftsresultat` is API-sourced for every company and traces directly to the filing.
- **Øre** — the integer unit every monetary value is stored and computed in. Money is never a float.

**Register fields** — the register's own names, never translated. Two are misspelled in the API; do not "fix" either.

`sumDriftsinntekter` total operating revenue · `driftsresultat` operating profit (EBIT) · `sumEiendeler` total assets · `sumEgenkapital` total equity · `salgsinntekt` sales revenue · `varekostnad` cost of goods sold · `lonnskostnad` personnel costs · `avskrivninger` depreciation and amortisation · `nedskrivninger` impairment · `annenDriftskostnad` other operating expenses · `kundefordringer` trade receivables · `bankinnskudd` bank deposits and cash · `leverandorgjeld` trade payables · `aarsverk` full-time equivalents, one decimal, from the notes · `regnskapsperiode` accounting period · `regnskapstype` accounts type · `smaaForetak` small-enterprise flag · `avviklingsregnskap` winding-up accounts · `regnskapsregler` accounting framework · `valuta` currency · **`sumInnskuttEgenkaptial`** total paid-in equity *(misspelled in the API)* · **`regnkapsprinsipper`** the object holding `smaaForetak` and `regnskapsregler` *(misspelled in the API)* · `naeringskode1.kode` primary industry code — the field to filter on, since the search API's `naeringskode` filter also matches secondary and tertiary codes.

## 4. Features

Requirements are numbered globally FR-1 to FR-63. `docs/key-figures.md` is authoritative for every formula; where an FR names one it is citing that document, not restating it.

### 4.1 Company lookup and eligibility

**Description.** The entire setup is an organisation number. No upload, no configuration, no template, no account. The product identifies the company, decides whether it can be analysed, and either produces a full analysis or says plainly why it cannot. Realises UJ-1, UJ-3.

Honesty at this boundary is load-bearing: a company outside a covered industry gets its own filed figures and a statement that its industry is not yet covered, rather than a comparison against a group nobody has checked.

#### FR-1: Lookup by organisation number

A visitor, with or without an account, can enter a nine-digit organisation number and reach an analysis. Realises UJ-1, UJ-3.

**Consequences (testable):**
- A valid organisation number for a company in a covered industry returns a complete analysis.
- Companies are matched across filings and years on organisation number only; a name match never identifies a company.
- A malformed or non-existent number returns a clear message, not an empty analysis.

#### FR-2: Company identification

The subject is shown with its registered name, organisation number, primary industry code and the accounting year being analysed.

**Consequences (testable):**
- The displayed year is the year of the returned filing, verified against `regnskapsperiode` or the filing `id` — never the year that was requested. The `år` request parameter is silently ignored by the register and is never trusted.
- A company whose registered name has changed since an older filing still resolves to one company.

#### FR-3: Covered-industry gate

The subject must be in a covered industry to receive a peer analysis.

**Consequences (testable):**
- An industry is offered only once its filings are extracted and reconciled **and** its peer selection has been measured against a labelled set for that industry.
- A subject whose `naeringskode1.kode` is outside the covered set never receives a peer group.
- Industry codes are SN2025. An SN2007 code returns nothing rather than a wrong match.

#### FR-4: Uncovered industry behaviour

A company outside a covered industry is shown its own filed key figures and a plain statement that its industry is not yet covered. Realises UJ-3 (edge).

**Consequences (testable):**
- No peer group, no median, no quartile and no kroner amount is shown for an uncovered subject.
- The statement names the industry and says coverage is not yet available — it does not imply the company is ineligible or unavailable.

#### FR-5: User-entered subject description

A user can optionally describe the subject in free text, and that description takes precedence over the register's own for classification of the subject.

**Consequences (testable):**
- The text is sent to the model only to classify, and the model can answer only with a fixed category, so text written to steer the model cannot change more than which category it lands in.
- For an anonymous session the description is used for that analysis and not stored.
- For a signed-in user the description belongs to the workspace.
- The description never affects any peer's classification, only the subject's.
- This is the one model call a user request can trigger. It runs once per entered text, the result is cached against that text, and it is rate-limited with the open route (FR-6). Every other classification happens at ingestion (FR-20).

#### FR-6: Open-route rate limiting

The no-account route is rate-limited so it cannot be used to harvest the register.

**Consequences (testable):**
- Requests are limited per session and per IP.
- Anonymous sign-in is protected by CAPTCHA.
- Exceeding the limit returns a refusal, not a degraded or partial analysis.

**Notes.** `[NOTE FOR PM]` The brief promises "under a minute" to first insight. That is a product promise no FR currently measures. Consider whether it belongs in §7 as a metric.

### 4.2 Peer group construction and adjustment

**Description.** A five-stage funnel narrows hundreds of thousands of companies to a peer group, four stages by rules and the fifth by model. The user sees how many companies survive each stage, why each peer is in the group, and what its match rests on — and can exclude a peer or loosen a criterion, with everything recomputing immediately. Realises UJ-1.

This is the feature the product lives or dies on. A benchmark the user cannot interrogate is a benchmark they will not trust, so the group is visible rather than hidden, and its quality is measured rather than asserted (§8).

#### FR-7: Stage 1 — coarse filter (rules)

Candidates are reduced by industry code and size band.

**Consequences (testable):**
- Filtering uses `naeringskode1.kode`. The register's `naeringskode` filter also matches secondary and tertiary codes and is never used where the primary industry is meant.

#### FR-8: Stage 2 — comparability filter (rules)

A candidate must match the subject on currency (`valuta`), accounting framework (`regnskapsregler`), `smaaForetak`, `avviklingsregnskap`, financial period and `regnskapstype`.

**Consequences (testable):**
- A candidate failing any comparability field cannot appear in the peer group by any later stage.
- Only calendar-year filings pass.
- `smaaForetak` and `regnskapsregler` are read from the object the API misspells as `regnkapsprinsipper`.

#### FR-9: Stage 3 — segmentation (rules)

Candidates are segmented by size, legal form, and geography where the industry calls for it.

#### FR-10: Stage 4 — business-model fingerprint (rules)

Candidates are grouped by what kind of business their own accounts say they are: cost of goods share, whether they carry inventory, capitalised intangibles, fixed-asset intensity.

**Consequences (testable):**
- A reseller, a product company and a consultancy separate here even when all three describe themselves as "Programvareutvikling".
- Applies to every company whose accounts are extracted.

#### FR-11: Stage 5 — classification (model)

The model judges whether a candidate is the same type of business, reading company name, secondary industry codes, statement of purpose and business description.

**Consequences (testable):**
- The model answers only with a fixed category. It never returns free text at this stage.
- The model performs no arithmetic here or anywhere (FR-53).

#### FR-12: Unclassified companies remain eligible

A company with nothing useful to classify on is stored as unclassified — never guessed at — and remains eligible as a peer through stages 1 to 4.

**Consequences (testable):**
- An unclassified company is never assigned a category by inference.
- A peer that reached the group without stage-5 confirmation carries the match basis *accounts alone* or *industry and size alone* (FR-16).

#### FR-13: Never select on a measure that is benchmarked

No measure the product benchmarks may be used to select peers at its exact value.

**Consequences (testable):**
- Selection uses no margin, return or productivity measure at all.
- Cost of goods share and personnel cost share are both business-model markers and benchmarked ratios; they enter selection **only in coarse bands** and are benchmarked within their band.
- A test asserts that for a peer group built with banding, the within-band spread of a banded figure is non-trivial — i.e. the gap has not been driven to zero by construction.

#### FR-14: Disagreement is flagged, not resolved

Where the text and the fingerprint disagree about a candidate, the candidate is flagged rather than resolved by either signal.

#### FR-15: Visible funnel counts

The user sees how many companies remain after each stage. Realises UJ-1.

**Consequences (testable):**
- Each of the five stages reports its surviving count.
- The counts are shown whether or not the group is large enough to produce aggregates.

#### FR-16: Per-peer inclusion reason and match basis

Each peer carries a short statement of why it was included, and a flag for what its match rests on.

**Consequences (testable):**
- The inclusion reason is generated deterministically from the profile fields the peer shares with the subject. **The model classifies; it does not write the justification.**
- The match basis is exactly one of: *description and accounts*, *accounts alone*, *industry and size alone*.
- Where the match rests on industry and size alone, the product says so rather than presenting a guess as a judgement.
- Peers are shown by name.

#### FR-17: Exclude a peer

The user can exclude a company from the peer group. Realises UJ-1 (edge).

#### FR-18: Loosen a criterion

The user can widen a criterion when the group is too small.

#### FR-19: Immediate recompute

Any change to the peer group recomputes every key figure, aggregate, percentile and kroner amount immediately. Realises UJ-1 (edge).

**Consequences (testable):**
- After an exclusion, aggregates reflect the reduced group with no stale value anywhere on screen.
- A change that drops a figure below the minimum group size causes that figure to stop showing an aggregate (FR-22).

#### FR-20: Peer group assembly latency

Peer group assembly returns in under one second.

**Consequences (testable):**
- Assembly reads stored key figures and profiles only.
- No document is fetched or OCR'd during a user request, for the subject or for any peer (FR-59), and no peer is classified. The only request-time model call is classifying a user-entered subject description (FR-5).

### 4.3 Key figures and the benchmark display

**Description.** Around a dozen measures across margin, cost structure, working capital, capital efficiency and productivity, with revenue growth for context. For each, the subject's own value, the peer median, the favourable quartile and a percentile marker. Strengths are shown as clearly as weaknesses — a company better capitalised than its peers should know that, because it changes what it can afford to do about everything else. Realises UJ-1, UJ-3.

**Formulas are not restated here.** `docs/key-figures.md` defines all 14 numbered figures plus cash share, and the engine implements exactly those definitions.

#### FR-21: The key figure set

The product computes and displays the key figures defined in `docs/key-figures.md`.

**Consequences (testable):**
- The engine implements every formula exactly as that document states; a formula changes in the document and in the code in the same commit.
- Two algebraic identities are asserted exactly by tests: return on assets equals operating margin × (`sumDriftsinntekter` / `sumEiendeler`), and personnel cost share equals personnel cost per FTE ÷ revenue per FTE.
- Total cost share is a reconciliation check against the three cost shares, not a primary benchmarking figure.
- Amounts are integers in øre. Ratios use a decimal library and are rounded only for display: percentages to one decimal, days to whole days, kroner to whole kroner.

#### FR-22: Minimum group size, per key figure

No aggregate is shown for a key figure unless at least 10 peers have a defined value for that figure. Realises UJ-3 (edge).

**Consequences (testable):**
- The count is taken **per key figure**, after companies with an undefined value for that figure are excluded.
- A peer group can clear the floor for one figure and fail it for another; each figure is gated independently.
- Below the floor, the figure states that there are too few comparable values rather than showing an aggregate over a handful of companies.
- Synthetic cohorts at and below 10 assert that no aggregate escapes.
- This is a quality threshold, not a confidentiality control: aggregates are computed only from public filings.

#### FR-23: Undefined is not zero

A key figure that cannot be computed for a company is undefined for that company, never defaulted to zero.

**Consequences (testable):**
- A zero or negative denominator, or a component that is missing and cannot be derived from a stated total, makes the figure undefined.
- A missing component is first attempted by derivation from a stated total — an empty element such as `<langsiktigGjeld/>` is recovered from the difference against its stated sum, not read as zero.
- An undefined figure excludes that company from that figure's distribution only, not from the peer group.
- The number of companies left out of each figure's distribution is shown to the user.
- No figure is ever estimated or imputed.

#### FR-24: Same basis for subject and peers

A key figure is shown only if it can be computed for the subject and for at least the minimum group size of peers **from the same source**.

**Consequences (testable):**
- A figure the subject has from OCR and the peers do not is not shown.

#### FR-25: Same year

The benchmark year is the subject's latest filed year, and peers use the same year.

**Consequences (testable):**
- A peer without a filing for that year is excluded.

#### FR-26: Decomposition views

The product separates margin from capital efficiency, and pay level from productivity. Realises UJ-3.

**Consequences (testable):**
- The pay-level-versus-productivity view distinguishes paying more per person from producing less per person, using the identity in FR-21.
- Both decomposition views need an account (FR-42).

#### FR-27: Distribution display

For each key figure the product shows the subject's value, the peer median, the favourable quartile, and the subject's percentile.

**Consequences (testable):**
- The favourable quartile is the upper quartile where higher is better and the lower quartile where lower is better, by the direction declared for that figure.
- Percentile is `(peers worse + 0.5 × peers equal) / peers × 100`, in the favourable direction.
- Revenue growth is shown without a direction and is never ranked, because fast growth often explains a weak margin.

#### FR-28: Multi-year trend where available

Where filings allow, the product shows how the subject has moved against its peers over time.

**Consequences (testable):**
- `[ASSUMPTION]` How many years the trend reaches back is determined by the measured OCR accuracy on older paper-form scans, and no depth is promised before that measurement exists. The brief commits the feature; the note gates its reach.
- Peer history is fetched every other year, since each document carries a prior-year column; every year is still covered.
- Development over time needs an account (FR-42).

### 4.4 Gap quantification in kroner and the closable-share control

**Description.** The feature that turns a ratio into a decision. Every unfavourable deviation becomes a kroner amount; one control sets how much of each gap the user believes is closable; the totals move live. This is where a double-counting error would be most damaging and least visible, so the rule against it is a requirement with a test, not a convention.

#### FR-29: Deviation to kroner

Each key figure with a kroner translation converts its gap to money exactly as `docs/key-figures.md` specifies. Realises UJ-1.

**Consequences (testable):**
- Only gaps where the subject is worse than the target produce a kroner amount; where it is better, the figure is shown as a strength with no amount.
- Figures with no kroner translation in that document produce none here.

#### FR-30: No double counting

Cost-share kroner amounts explain the operating margin gap and are never added to it **or to each other**.

**Consequences (testable):**
- An automated test asserts that no total presented to the user, or contained in an export, sums more than one of {operating margin, cost of goods share, personnel cost share, other operating cost share}.
- Cost-share amounts are presented as a subordinate breakdown of the operating margin amount, never as independent opportunities that could be added up.

#### FR-31: The closable-share control

A single control sets the closable share from nothing to full convergence with the favourable quartile, and the results update live. Realises UJ-1.

**Consequences (testable):**
- Annual profit uplift, working capital released and implied enterprise value all recompute from the same closable share.
- At full closure the target is the favourable quartile; the peer median is the alternative reference point.

#### FR-32: Valuation at a user-set multiple

Implied enterprise value is annual profit uplift × an EV/EBIT multiple set by the user.

**Consequences (testable):**
- The multiple is a user input. The engine never looks one up or infers one.
- The calculation uses EBIT (`driftsresultat`), which is API-sourced for every company and traces directly to the filing, so the headline valuation figure carries no OCR dependency.
- `[NOTE FOR PM]` No default value or range for the multiple is specified in any source document. A default is a product decision still open (§11).

### 4.5 Unfiled current-year figures

**Description.** A company knows its current year long before it files it. An owner can enter those figures by hand and see a provisional position — but the product never lets them be mistaken for filed accounts, and never lets them touch anyone else's comparison. Realises UJ-4.

#### FR-33: Unaudited labelling everywhere

Every figure derived from unfiled input is labelled unaudited and user-entered wherever it appears. Realises UJ-4.

**Consequences (testable):**
- The label survives into PDF export.
- Filed and unfiled figures are never merged into a single displayed value.

#### FR-34: Visibility of unfiled figures

Unfiled figures belong to the workspace: the owner writes them, viewers read them, anonymous sessions never read them. Realises UJ-4 (edge).

**Consequences (testable):**
- An anonymous session cannot read an unfiled figure by any route, including export.
- A viewer cannot write one.

#### FR-35: Period difference stated

Unfiled current-year figures are compared against the peers' latest filed year, with the difference in periods stated. Realises UJ-4.

#### FR-36: Filed figures take precedence

When the filing for the same year arrives it takes precedence, and the user-entered figures are kept only as history. Realises UJ-4.

#### FR-37: Unfiled figures never enter an aggregate

No user-entered figure contributes to any peer median, quartile, distribution or percentile.

**Consequences (testable):**
- Aggregate queries read only tables holding filed accounts, so leaking an unfiled figure into a peer median would require changing the query rather than forgetting a filter.

#### FR-38: Which figures may be entered

`[ASSUMPTION]` An owner may enter the components needed for the API-sourced figures — revenue, operating profit, total assets, total equity — with OCR-sourced components optional. No source document specifies the input set; this is inferred from which figures matter most and which are least dependent on extraction.

### 4.6 Accounts, workspaces and access

**Description.** One access model covers everyone. A visitor without an account gets a real authenticated identity, so row-level security, the audit log and rate limiting all work unchanged — and registering converts that identity in place rather than starting over. An account is needed only for what persists. Realises UJ-2.

The security-relevant subtlety: anonymous users hold the `authenticated` Postgres role, so a policy that merely checks for an authenticated user admits them.

#### FR-39: Anonymous session on arrival

A visitor without an account receives a Supabase anonymous sign-in, so every request carries a real `auth.uid()`.

#### FR-40: Conversion in place

When a visitor registers, the anonymous user is converted in place and keeps what it did. Realises UJ-2.

**Consequences (testable):**
- An analysis built anonymously is still reachable after registration, without being rebuilt.

#### FR-41: Magic-link sign-in

Sign-in is by emailed magic link.

**Consequences (testable):**
- No password is stored anywhere, so none can be leaked.

#### FR-42: The account wall

Open to anyone: the front page and industry overviews, lookup, the peer group and its adjustment, key figures, percentiles, gaps in kroner, the closable-share control and valuation. An account is required for development over time, the decomposition views, PDF export, saved analyses and history, favourites, unfiled figures, workspaces, invitations and the portfolio front page. Realises UJ-1, UJ-3.

**Consequences (testable):**
- The core — peers and the gap in kroner — never requires an account.

#### FR-43: Workspaces

Saved work belongs to a workspace, typically one per company, with membership carrying the role `owner` or `viewer`.

**Consequences (testable):**
- An adviser holding many client companies is a user with many workspaces; no adviser role exists.

#### FR-44: Invitation

An owner invites a viewer by email, into a single workspace, as a viewer. Realises UJ-2 (edge).

**Consequences (testable):**
- An invitation grants access to exactly one workspace, never to the inviter's other workspaces.
- An invitation confers read-only access only.
- Share links that grant access to anyone holding them are out of v1 (§5).

#### FR-45: Cross-workspace isolation

No user can reach a workspace they are not a member of. Realises UJ-2.

**Consequences (testable):**
- Isolation holds **between two workspaces held by the same owner**, not only between different users.
- An invited viewer cannot reach a workspace they were not invited to.
- Row-level security keys every user-scoped table to workspace membership; no endpoint's safety depends on remembering a `where` clause.

#### FR-46: Immediate revocation

Removing a member revokes access immediately, because every policy goes through membership.

#### FR-47: The anonymous boundary in policy

Every policy on saved or user-entered data requires `is_anonymous` to be false in the JWT, not merely that a user is authenticated.

**Consequences (testable):**
- The authorisation suite includes an anonymous attacker attempting to read and to write saved data, and asserts rejection.

#### FR-48: Audit log

Every analysis, anonymous or not, resolves to an actor in an append-only audit log.

**Consequences (testable):**
- Entries carry actor, timestamp and prior state.
- Anonymous actors are logged by their anonymous id.

### 4.7 Saved analyses, history and export

**Description.** The second visit should show how the company has moved against its peers rather than starting over.

#### FR-49: Save an analysis

A signed-in owner can save an analysis into a workspace.

#### FR-50: History

A saved analysis accumulates history, so a later visit shows movement against the peer group rather than a fresh start.

#### FR-51: PDF export

A signed-in user can export an analysis as PDF.

**Consequences (testable):**
- Unaudited labelling on user-entered figures is carried through into the export (FR-33).
- Export is unavailable to anonymous sessions.

### 4.8 Explanatory text

**Description.** Written text naming the largest gaps in kroner, the measures where the company is strong, and — where multi-year data exists — which gaps have persisted. It explains; it does not recommend. This is one of exactly two jobs the model has.

#### FR-52: Generated explanation

The product presents written explanation of the computed analysis.

**Consequences (testable):**
- It names the largest gaps in kroner and the measures where the subject is strong.
- Whether a gap has persisted across years is decided by the engine from the figures, never by the model.
- Every figure in the text links back to its calculation.
- Text is cached per company and peer group rather than generated per visit.

#### FR-53: The model never calculates

No number may appear in generated text that is absent from the engine's calculation output.

**Consequences (testable):**
- An automated test rejects generated text containing any figure not present in the engine's output. Once that test exists it is never weakened.
- The model's only two jobs are classification into fixed categories (FR-11) and explanatory text (FR-52). It performs no arithmetic.
- Peer inclusion reasons are rules-generated, not model-generated (FR-16).
- A free-form chat over the data is out of scope precisely because it cannot be held to this rule (§5).

#### FR-54: Explains, does not recommend

Generated text describes what the figures show and does not prescribe action.

### 4.9 Responsive interface

**Description.** A data-dense product — four-column ratio tables, distribution plots, a peer list — that has to work from desktop down to phone width. This is a course requirement, not a preference, and retrofitting it is far more work than designing for it. Realises UJ-3.

#### FR-55: Reflow to phone width

The interface works down to approximately 375px, reflowing and stacking to one column when narrow. Realises UJ-3.

**Consequences (testable):**
- The page body never scrolls horizontally at any width from 375px upwards.
- Checked at phone width during development, not at the end.

#### FR-56: Wide content scrolls within its own container

Ratio tables, distribution plots and the peer list each scroll horizontally inside their own container when wider than the viewport.

### 4.10 Data quality visible to the user

**Description.** The register serves filed accounts only as page images, so most figures depend on optical recognition. The product's posture is that a figure nobody can trace is a figure nobody acts on — and that a wrong figure is worse than a missing one.

#### FR-57: Data quality flag per filing

Each filing carries a data quality flag derived from the two reconciliation checks.

**Consequences (testable):**
- The flag is derived from arithmetic checks only, never from recognition confidence. Confidence is not a signal: a generic engine reported mean confidence 0.974 while misreading several figures.

#### FR-58: A figure that fails reconciliation is withheld

A figure is accepted only where it reconciles, and a failure blocks the filing rather than degrading the analysis silently.

**Consequences (testable):**
- *Within* a document, stated subtotals must agree with their components within a tight absolute bound of a few kroner — because the register prints whole kroner rounded from øre, a legitimate filing can be a krone off.
- *Between* document and the register's structured figures, a proportional tolerance applies, because reporting in thousands or millions introduces scaling error.
- Neither check is exact equality, and the two are never collapsed into one: the filing's own rounding is a krone or two, while recognition errors are wrong by orders of magnitude.
- A failing figure is not shown with a caveat and not substituted.

#### FR-59: Nothing is extracted at query time

No document is fetched or OCR'd during a user request, for the subject or for any peer.

**Consequences (testable):**
- Every document-derived figure served to a user comes from pre-warmed storage.
- A covered industry is fully pre-warmed before it is offered.

#### FR-60: Traceability

Every kroner amount traces to the ratio that produced it and on to the filed accounts behind it.

**Consequences (testable):**
- From any displayed kroner figure the user can reach the key figure and the filed values it was computed from.
- Filings too degraded for reliable recognition — chiefly the oldest paper-form scans — are reported as unavailable rather than estimated.

### 4.11 Front page and navigation

**Description.** The product opens on a page that explains itself and shows what the data can do before anyone types a number, and a signed-in adviser lands on their own portfolio rather than an empty search field.

#### FR-61: Front page with industry overviews

The front page describes Peerless, holds the organisation-number field, and shows an overview of each covered industry: the median margin over time, the spread in personnel cost share, and the share of companies growing.

**Consequences (testable):**
- Overviews show aggregates only and never name a company.
- They are computed by the same engine from the same stored figures as an analysis, and follow the minimum group size (FR-22).
- They exist only for covered industries.
- If older filings cannot be read reliably, an overview shows the latest year only — the spread without the trend — rather than a trend built on weak data.
- Named rankings and league tables are out of scope (§5).

#### FR-62: Analysis tabs

An analysis is organised in tabs: overview, peers, key figures and gaps, development over time, and value.

**Consequences (testable):**
- Tabs that need an account are visible to anonymous sessions but say that an account opens them (FR-42).

#### FR-63: Portfolio front page

A signed-in user's front page lists every company they follow, with its latest position, what has changed since the last filing, and the largest gaps.

**Consequences (testable):**
- It reads saved analyses only; nothing is computed for companies the user does not follow.
- It shows only workspaces the user is a member of (FR-45).
- User-arranged widgets are out of v1.

## 5. Non-Goals (Explicit)

Scope discipline is part of what is being graded. These are things Peerless is not and will not do, with the reason where the reason matters.

**Not this product:**

- **Credit scoring or default prediction.** A different question for a different buyer, already well served.
- **A full valuation tool** — discounted cash flow, transaction multiples, several methods side by side. Peerless values a gap at a user-set multiple and stops there.
- **A composite performance score.** It would require arbitrary weights across ratios and could not be traced to the accounts.
- **Screening or searching the register by financial criteria, rankings of companies, or "find companies like this."** A different product for a different user — and on an open route, the most direct way to harvest the register.
- **A free-form chat over the data.** Explicitly excluded because it cannot be held to the rule that the model never calculates (FR-53).
- **Forecasting.** Peerless describes what the accounts say, not what comes next.
- **Automated monitoring and alerting on peer movements.** Deferred, not rejected.
- **Named rankings and league tables.** A top list collects recognition errors and small-base outliers, and a wage-share ranking misleads wherever subcontractors are booked outside payroll. Industry overviews without names serve the same purpose (FR-61).
- **Widgets users arrange themselves.** Deferred: much interface work for little over a fixed layout.

**Not this data:**

- **Entities outside the ordinary accounting layout, including banks and insurers.**
- **Filings too degraded for reliable recognition**, chiefly the oldest paper-form scans — reported as unavailable, never estimated.
- **Group consolidation across several legal entities.**
- **Ownership and group structure mapping.**
- **Cross-border comparison.**
- **Custom ratio definitions.** The figure set is fixed by `docs/key-figures.md`.

**Excluded key figures**, deliberately, with the reasons from `docs/key-figures.md`: cash flow (small companies are exempt from the statement); gearing, interest cover and return on equity (financing and credit risk, not operations); ROIC (needs interest-bearing debt separated, and operating asset turnover covers most of it); inventory days (arrives with 43.210, where inventory exists).

**Not in v1 mechanically:**

- **Share links that grant access to anyone holding them.** A link is a bearer token: it gets forwarded, pasted into chat and leaked through logs, and it would carry unfiled figures with it unless deliberately excluded. Invitation by email covers the need in v1.
- **Payment and subscription handling.**
- **Multi-language support.**
- **Native mobile.** The responsive web interface covers phone width (FR-55).

**Known limitations accepted rather than fixed**, and disclosed rather than silently corrected:

- Receivable days are overstated by VAT by up to 25%. The distortion is similar across a VAT-registered peer group, so the comparison holds while the absolute number is too high. Stated, not adjusted.
- Cost lines may be classified differently between companies — a consultancy booking subcontractors as cost of goods rather than personnel — distorting the split between the three cost shares. Total cost share is shown as a check against this.
- Employee count from Enhetsregisteret is deliberately not used for `aarsverk`: it is today's figure, not the accounting year's. FTEs come from the notes instead, accepting OCR dependency to get the right period.

## 6. MVP Scope

### 6.1 In Scope

- Analysis without an account; magic-link sign-in; workspaces with an owner and invited read-only viewers.
- Company lookup by organisation number, and analysis of any company in a covered industry.
- **Two committed industries: `62.100 Dataprogrammeringstjenester` (about 1 000 companies with five or more employees) and `69.202 Regnskapsføring og bokføring` (about 800).** `43.210 Elektrisk installasjonsarbeid` is the likely third, **not a commitment**. Coverage grows one industry at a time, as many as time allows — and an industry is offered only once its filings are extracted and reconciled and its peer selection has been measured for that industry.
- Peer group construction across all five stages, with visible filter counts, per-peer inclusion reasons, match-basis flags and user adjustment.
- The key figure set in `docs/key-figures.md`, across margin, cost structure, working capital, capital efficiency and productivity, with revenue growth for context.
- Decomposition views: margin versus capital efficiency, and pay level versus productivity.
- Multi-year trend where filings allow, with reach determined by measurement rather than promised in advance.
- Gap quantification in kroner, the closable-share control, and valuation at a user-set EV/EBIT multiple.
- Written explanation grounded in calculated figures, with the no-calculation rule enforced by test.
- Manual entry of unfiled current-year figures, labelled unaudited and excluded from all aggregates.
- Minimum group size of 10 peers per key figure; rate limiting on the open route; audit log.
- Saved analyses with history; PDF export.
- A front page with industry overviews, analysis in tabs, and a portfolio front page for signed-in users.
- A responsive, Norwegian-language interface from desktop down to phone width.

### 6.2 Out of Scope for MVP

Everything in §5, plus:

- **A third industry.** `43.210` is intended, not committed — it arrives only if time allows and only after its own measurement. `[NOTE FOR PM]` This is the most likely place for scope to quietly expand. Two measured industries beat three unmeasured ones, and the measurement is what the project is graded on.
- **Investor and portfolio use cases**, which depend on screening and portfolio views that are out of scope.
- **Numeric quality targets.** No source document states a target for peer-selection precision, recall, or OCR accuracy. v1 commits to *measuring and reporting* these, not to hitting a threshold (§9, §11).

**If time runs short, cut in this order.** The portfolio front page (FR-63) first, then the industry overviews (FR-61), then the third industry. Never the labelled set, the authorisation suite or the OCR measurement — they are what the project's results rest on. Epics are cut from this list, in this order.

## 7. Cross-Cutting Non-Functional Requirements

**Performance.** Peer group assembly under one second; a complete analysis within a few seconds. Achieved because every figure, profile and peer classification is pre-computed at ingestion — nothing is extracted or recognised during a user request, and the only request-time model call is classifying a user-entered subject description, once per text and cached (FR-5). The OCR pipeline has no interactive budget at all; it is a batch job measured on throughput and accuracy, not latency.

**Correctness of money.** Every monetary value is stored and computed in integer øre, or with a decimal library. No monetary value is ever a float, including intermediate results, because the error compounds across periods. Rounding happens only for display.

**Calculation integrity.** The calculation engine is pure functions — figures in, figures out, no database or framework imports — so it is testable in isolation and readable by someone checking the accounting. It is tested against hand-calculated reference cases from real filed accounts, including negative equity, zero revenue, missing components, and non-calendar financial years.

**Authorisation.** Enforced in the database by row-level security on every user-scoped table, keyed to workspace membership. The application layer filtering correctly is never sufficient: assume it will eventually fail and make that insufficient to leak data. The authorisation test suite is written early, not last, and attempts every forbidden pattern — reading another user's data, reaching another workspace including one held by the same owner, an anonymous session reading or writing saved data, a viewer writing, an invited viewer reaching a workspace they were not invited to, and calling an endpoint unauthenticated — asserting rejection in each case.

**Secrets.** API keys, service-role credentials and database connection strings stay server-side. `.env` is gitignored from the first commit.

**Accessibility and responsiveness.** Usable from desktop down to approximately 375px, with the page body never scrolling horizontally. Wide content scrolls within its own container.

**Architecture boundary with product consequence.** Nothing a user can reach may depend on the Python ingestion pipeline being up. It is a batch job, never a service, and never in a request path.

## 8. Constraints and Guardrails

**Privacy.** The source figures are public filings, so confidentiality attaches to *use*, not to the figures. What is actually private is: which companies a user looked at, their saved analyses, their workspace membership, and their unfiled figures. Security effort goes there rather than to protecting public data. Aggregates are computed only from public filings, so a peer median discloses nothing the filings do not — which is why the minimum group size is a quality threshold and not a disclosure control. Unfiled figures never enter an aggregate, enforced structurally (FR-37).

**Safety of generated text.** The model's two jobs are bounded by construction: classification answers only in fixed categories, and explanatory text is rejected by test if it contains a figure the engine did not compute. User-supplied description text reaches the model only for classification, so text written to steer it cannot change more than the category it lands in.

**Cost.** Bounded by covering a small number of industries rather than the register. OCR runs once per filing at ingestion and is stored permanently; explanation text is cached per company and peer group rather than generated per visit; the open route is rate-limited and CAPTCHA-protected so anonymous traffic cannot run up model cost or harvest the register.

**Data sourcing.** The free public register interfaces are the only data source. The paid multi-year bulk subscription is out of scope on cost grounds, which is why multi-year history comes from the filed documents rather than an API. `[NOTE FOR PM]` Attribution or terms-of-use obligations for register data are not addressed in any current document — see §11.

## 9. Success Metrics

Each metric names what it validates. No source document states a numeric target for the two measurement-based metrics, and this PRD does not invent one: v1 commits to measuring and reporting, and the thresholds are an open question (§11).

**Primary**

- **SM-1 — Peer selection quality.** Precision and recall against a human-labelled set of genuine comparables — labelled without seeing which funnel stage proposed a candidate, since the labeller also designed the method — compared against what industry classification alone achieves. Reported **per industry**, split by whether the company's description is informative (with the share of companies in each cohort disclosed), and **per funnel layer** — industry code and size alone, then adding the fingerprint, then embeddings, then model classification. The improvement over the industry-code baseline is the primary result. Validates FR-7 to FR-16.
- **SM-2 — Recognition accuracy.** Share of figures recovered exactly, and share of filings passing the internal consistency check, each split between recent filings and older paper-form scans, measured against a hand-transcribed reference set. This measurement decides which document-derived ratios the product can honestly offer and how far back trend can reach. Validates FR-28, FR-57, FR-58.
- **SM-3 — Authorisation.** Zero successful forbidden accesses across the full suite, including between workspaces held by the same owner and from an anonymous session against saved data. Validates FR-34, FR-45, FR-47.
- **SM-4 — The model never calculates.** No generated text contains a figure absent from the engine's output, asserted by automated test. Validates FR-53.

**Secondary**

- **SM-5 — Latency.** Peer group assembly under one second; complete analysis within a few seconds. Validates FR-20.
- **SM-6 — Engine correctness.** All hand-calculated reference cases pass, including negative equity, zero revenue, missing components and non-calendar financial year; both algebraic identities hold exactly. Validates FR-21, FR-23.
- **SM-7 — Responsiveness.** No horizontal page scrolling at any width from 375px upwards. Validates FR-55, FR-56.
- **SM-8 — A complete analysis needs nothing but an organisation number** — no account, no upload, no configuration. Validates FR-1, FR-42.

**Counter-metrics (do not optimise)**

- **SM-C1 — Peer group size.** Do not optimise upward. A larger group containing companies that are not genuine comparables is worse than a smaller correct one, because the product's whole claim is that the group is right. Counterbalances SM-1 and coverage pressure.
- **SM-C2 — Number of figures displayed.** Do not optimise upward. Showing a figure computed over a barely-qualifying set of peers, to avoid an empty row, is a regression — an empty row that says why is the correct output. Counterbalances SM-2.
- **SM-C3 — Share of companies classified.** Do not optimise upward. "Unclassified" is a correct answer, and a classifier pushed to label everything produces confident nonsense on exactly the companies whose descriptions say nothing. Counterbalances SM-1.
- **SM-C4 — Industries covered.** Do not optimise upward. Each industry needs its own measurement before it is offered; a third industry added without one would trade the project's central result for apparent breadth. Counterbalances coverage in §6.1.

## 10. Measured Results — the project's central claim

This section exists because Peerless is coursework as well as a product, and the thing being graded is not only whether the software runs.

**The claim under test:** that reading what a company actually does — from its accounts and from free text — assembles a better peer group than industry classification alone. The measurement is the result, and it can come back negative.

**What makes that measurable:**

- A human-labelled set of genuine comparables, built by hand and **stratified by description quality**, so precision and recall can be reported separately for companies whose descriptions are informative and those whose are not. The method can only improve on the baseline where there is text to read, and mixing the two cohorts would hide that. The labeller also designed the method, so candidates are judged without seeing which funnel stage proposed them; any contamination that remains is stated rather than hidden.
- The industry-code-only baseline, computed on the same labelled set.
- **Layer-by-layer ablation:** each funnel layer scored standalone and cumulatively, so the result shows where any improvement comes from — rules, or the model.

**Anticipated findings that are results, not failures:**

- If the accounts-based fingerprint alone captures most of the improvement, **the model was needed less than expected.** That is a finding worth reporting, and the rules-before-model principle predicts it.
- If embeddings do not measurably beat model classification, classification stays. Embeddings replace it only on evidence.
- Description quality is currently a word-list proxy, not a measurement: at most 56% of descriptions in 62.100, 38% in 69.202 and 50% in 43.210 appear specific, and the true share is lower. Hand-scoring converts this estimate into a measurement, and it covers the two committed industries.

**Honest framing of the market claim.** No Norwegian product found assembles a matched peer group *and* converts deviations to kroner self-serve for the company itself; incumbents lead with credit-risk framing. But the gap sits between two well-funded adjacent categories rather than in an empty market, and the brief is candid that there is no moat: the data is public, the ratios are textbook, and the advantage is framing and execution only.

## 11. Open Questions

**Answered 2026-09-26**

1. **Course requirements.** No fixed user roles are required. Nothing must be delivered before coding, but BMAD requirements must be met. The product brief is due 2026-09-27.
2. **Interface language.** Norwegian (bokmål). All documentation stays English.
3. **Team size.** Solo.

**Product decisions still open**

4. **Is `43.210` committed for v1?** The note says "the likely third". §6.2 currently treats it as out.
5. **A default or range for the EV/EBIT multiple.** Specified nowhere. The control needs a starting value.
6. **Median or favourable quartile as the headline reference point.** The direction-aware mechanism is decided; which one leads is still listed as an open decision.
7. **Which figures a user may hand-enter as unfiled** (FR-38 is an assumption).
8. **User-facing behaviour below the minimum group size.** "No aggregate is shown" is decided; the wording and whether the row persists are not.
9. **Cash share** — a numbered key figure or a diagnostic? It is the only figure without a number in `docs/key-figures.md`.

**Gated on measurement (answers arrive from work already scheduled)**

10. **How many years of trend can honestly be promised** — determined by OCR accuracy on older paper-form scans, scheduled for week 1 precisely so the answer arrives before the promise.
11. **Target thresholds for precision, recall and OCR accuracy.** None stated anywhere. Whether v1 should commit to a threshold at all, or only to measuring, is a decision — and committing to one before the baseline exists would be guessing.
12. **Which fingerprint features are used, and whether personnel cost share enters selection at all, in bands, or not.** Stage 4 describes it as banded; the decision points still list it as open, with a stated risk that bands blur the benchmark.
13. **How much autonomy the model has in accepting or rejecting a candidate**, and **which comparability criteria are hard exclusions rather than flags.**
14. **OCR field names.** All ten OCR-sourced field names in `docs/key-figures.md` are marked provisional until confirmed against a real filing.

**Unaddressed**

15. **Cache lifetime for fetched public data**, against the risk of showing stale figures. No TTL decided.
16. **Attribution or terms-of-use obligations for register data.** Not covered in any current document. Worth confirming before a public deployment, commercial or not.
17. **Whether unfiled figures may ever enter a group aggregate.** Closed: never, enforced structurally (FR-37). Closed in the technical note as well.

## 12. Assumptions Index

Every `[ASSUMPTION]` in this document, for explicit confirmation:

- **§2.3, all four user journeys** — the protagonists, their contexts and every beat are invented, inferred from the brief's user types. The brief names users but narrates no sessions. The FR references are real; the scenes are not yet yours. **Highest-value correction in the document.**
- **§4.3, FR-28** — trend depth is left unpromised and gated on the week-1 OCR measurement, rather than committed to a number of years. The brief commits the feature; the note gates its reach.
- **§4.5, FR-38** — the set of figures an owner may hand-enter as unfiled is inferred (the API-sourced components, with OCR-sourced ones optional). No source document specifies it.
- **§6.2** — `43.210` is treated as out of MVP because the note calls it "likely" rather than committing to it. If you intend it as committed, §6.1 and §6.2 both change.
- **§9** — no numeric target is stated for any measured metric, so none is invented here. If the course expects a stated target, SM-1 and SM-2 need one.
- **Interface language** — resolved 2026-09-26: Norwegian (bokmål). §11.2.

---

*Assembled by `bmad-prd` on 2026-09-25 from the brief, the technical note, `docs/key-figures.md`, `docs/data-sources-brreg.md`, `analysis/output/industry-screening.md` and landscape research. Decision trail in `.memlog.md`.*
