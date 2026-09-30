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

Structure: vocabulary is fixed in §3 Glossary and used verbatim everywhere after. Features are grouped in §4 with functional requirements nested and numbered globally FR-1 to FR-71 so epics can cite stable IDs. **An FR number is stable and never reused**, so a requirement added later sits at the end of its section out of numeric order rather than pushing existing numbers along. Assumptions are tagged `[ASSUMPTION]` inline and indexed in §12.

## 1. Vision

A managing director knows their gross margin. They do not know whether it is good.

Peerless answers the question a company cannot answer about itself: **where are we losing money relative to companies like us, and what would closing that gap be worth.** A user enters an organisation number and sees their company positioned against a group of genuinely comparable businesses across margin, cost structure, working capital, capital efficiency and productivity. Every deviation is converted into kroner. One control sets how much of each gap the user believes is closable, and the result reads as annual profit uplift, capital released, and implied enterprise value.

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

Captured from Meinich's own descriptions of real situations and confirmed by him. Two things are still mine and flagged as such: **the protagonists' names**, and **the illustrative figures**.

**How the figures are grounded.** Peer statistics are the real screening figures from `analysis/output/industry-screening.md` — operating margin quartiles for a comparability-filtered sample of 100 per industry — and company size is derived from that document's median revenue per employee rather than from a revenue median it does not contain. Two caveats travel with them. The screening notes that employee counts are today's while revenue is the latest filing, so size is *indicative only*. And the quartiles are **industry-wide**, standing in for a peer group that is by construction narrower: in a real analysis the peer median moves, which is the entire point of the product. The subject companies' own margins are invented, because no real subject exists yet.

The order below is narrative, not priority. Who matters most is stated in §2.1: advisers are the primary user and the likeliest payer.

`[ASSUMPTION]` The protagonists' names and each subject company's own operating margin are invented — no real subject company exists yet. The peer statistics around them are real. Indexed in §12.

- **UJ-1. A company finds out that beating its industry is not the same as being good.**
  - **Persona + context:** Kari, finance lead at a twelve-person software company under `62.100`. She knows the margin — she produces it — and has never had anything to compare it against but last year's own.
  - **Entry state:** No account, laptop, arrived from a search. Twelve employees at the industry's median revenue per employee of 1 390 898 kr puts the company near 16.7 million in revenue.
  - **Path:** Enters her own organisation number → the company is identified with its filed key figures and a peer group → she reads the funnel counts and the per-peer inclusion reasons, and adjusts the group: two companies are resellers rather than product businesses, and she excludes them (FR-16, FR-17, FR-19) → walks the key figures looking for the largest gaps in kroner → reads the written explanation of them (FR-52).
  - **Climax:** Her 2.1 % operating margin is *above* the industry median of −3.2 %, which is the number she would have quoted. Against the favourable quartile of 9.1 % it is a gap of seven points — about **1.17 million kroner a year** at full convergence (7.0 % × 16.7 m). Beating a loss-making industry average told her nothing.
  - **Resolution:** She wants it as a PDF for the board. Export needs an account, so she signs in with a magic link and keeps the analysis she already built (FR-40, FR-42, FR-49).
  - **Edge case:** Receivable days shows no peer aggregate — fewer than ten peers had a usable value — so the row keeps her own figure and says how many comparable values exist instead of comparing against a handful (FR-22).
  - **Weak ending, on purpose:** she intends to come back when the next filing is in, and **nothing will tell her it arrived.** Monitoring and alerting are deferred (§5), so the return trip rests on her remembering; the portfolio front page (FR-63) only rewards her once she is already back. This is the clearest gap between what the journey wants and what v1 does.

- **UJ-2. An adviser walks into a first meeting already knowing where the company is weakest.**
  - **Persona + context:** Anders, a consultant who sells improvement work to small companies. The company he is meeting on Thursday is a **prospect, not a client** — he has no engagement, no figures from them, and no relationship. Today he would prepare by reading their website.
  - **Entry state:** Not signed in, and he has no reason to be. The prospect is a nine-person bookkeeping firm under `69.202`; at that industry's median revenue per employee of 1 159 406 kr, around 10.4 million in revenue.
  - **Path:** Enters the prospect's organisation number cold → reads the peer group and judges it himself, which is the thing he is uniquely able to do (§2.1) → goes straight to the largest kroner gaps → notes one or two numbers.
  - **Climax:** Operating margin 2.5 % against a peer median of 9.7 % and a favourable quartile of 15.3 % — a gap of 12.8 points, about **1.34 million kroner a year** at full convergence. He opens the meeting with the prospect's own largest gap instead of a brochure.
  - **Resolution:** He wins the work. Now he signs in, saves the analysis into a workspace for that client, and invites their managing director (FR-40, FR-43, FR-44).
  - **Edge case:** The prospect's industry is not covered. They get their own filed key figures and a plain statement that the industry is not yet analysed — no peer group, no median, no kroner amount (FR-4).
  - **Scope boundary, recorded because the pull is real:** his next wish is "show me every firm in `69.202` with a weak margin". That is the screening feature §5 excludes, and on an open route it is the most direct way to harvest the register. Peerless stays at one organisation number at a time.

- **UJ-3. Someone else reads the analysis without being able to reach anything else.**
  - **Persona + context:** Solveig chairs the board of the company in UJ-2. She has never seen management's figures against an outside reference.
  - **Entry state:** An email invitation. No account yet, and no prior relationship with the product.
  - **Path:** Anders invites her by email into that one workspace, as a viewer (FR-44) → she signs in with a magic link → reads the saved analysis, the peer group and the kroner gaps, read-only.
  - **Climax:** She sees the same figures management sees, sourced from public filings rather than from management, and can trace any kroner amount back to the filed accounts (FR-60).
  - **Resolution:** She holds a viewer role in one workspace. Anders's other clients are unreachable to her, enforced in the database rather than by the interface remembering to filter (FR-45, FR-47).
  - **Edge case:** Anders mistypes her address. The invitation grants nothing until it is accepted from that mailbox, and it reaches exactly one workspace, as a viewer (FR-44).
  - **Deliberately not this:** a link anyone holding it can open. A link is a bearer token — forwarded, pasted into chat, leaked through logs — and it would carry unfiled figures with it unless deliberately excluded. Invitation by email covers v1 (§5).
  - **Later, not now:** users who want a **valuation basis** — investors, M&A and transaction advisers — are a v2 audience. v1 values a gap at a user-set EV/EBIT multiple and stops; a full valuation tool is out of scope (§5, §2.2).

- **UJ-4. An owner asks whether this year is going better, before anything is filed.**
  - **Persona + context:** Tore owns the bookkeeping firm from UJ-2 and UJ-3 — the `69.202` company Anders won and Solveig chairs — and closes his books monthly. Anders's work started after a filed year at 2.5 % operating margin. Seven months in, Tore wants to know whether the business has moved in a positive direction, long before the filing exists.
  - **Entry state:** Signed in, owner of his own workspace.
  - **Path:** Enters year-to-date figures and states that they cover **seven months** → enters the same seven months of last year, which is what makes the comparison honest → sees ratios only, every one labelled unaudited and user-entered (FR-33, FR-67).
  - **Climax:** Operating margin 6.4 % over seven months against **4.8 % for the same seven months last year** — genuinely up, and up on a like-for-like period. His own last filed full year, 2.5 %, and the peers' latest full year median of 9.7 % sit alongside as context, labelled *"hele år, ikke samme periode"*: he is improving and still short of the typical peer, and both facts are legible at once.
  - **Resolution:** He has a direction, not a projection. Nothing is annualised, so nothing is forecast — and when the filing arrives it takes precedence and his entries are kept as history (FR-36).
  - **Edge case:** He has no figures for the same period last year. The year-to-date ratios are shown with no primary comparison, rather than being measured against a full year as though the periods matched (FR-67).
  - **What it deliberately will not do:** no kroner amount is produced from a partial period, because a kroner translation needs a twelve-month revenue base; and no adjustment is made for seasonality or anything else external. In `69.202` that plausibly matters: an accounting firm's work clusters around the annual-accounts and tax deadlines, so a January-to-May margin is unlikely to be its year. The project has not measured this — it is an argument for the like-for-like comparison, not a finding. Comparing against the owner's own same months is what contains the problem; the product states the limit rather than correcting it.

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
- **Median** — the peer median for a key figure. Shown for context and as a marker on the closable-share control; never the target of the kroner arithmetic.
- **Favourable quartile** — the upper quartile where higher is better, the lower quartile where lower is better. Direction-aware by definition, so a figure with no declared direction has none.
- **Percentile** — the share of peers the subject does better than, ties counted as half: `(peers worse + 0.5 × peers equal) / peers × 100`, in the favourable direction.
- **Size band** — the range of company size a candidate must fall within to be eligible as a peer: `sumDriftsinntekter` **from the same filing as the figures being compared**, by default 0.5 to 2 times the subject's, loosenable to 0.25 to 4 times (FR-18). Revenue, not assets and not employees; and the filing's own figure, never today's register.
- **Minimum group size** — 10 peers, counted **per key figure** after companies with an undefined value for that figure are excluded. Below it, no aggregate is shown for that figure. A quality threshold, not a confidentiality control.
- **Undefined** — a key figure that cannot be computed for a company because a denominator is zero or negative, or a component is missing and cannot be derived from a stated total. **Undefined is not zero.** The company leaves that figure's distribution and the excluded count is shown.
- **Data quality flag** — a per-filing flag derived **only** from the two reconciliation checks, never from OCR confidence. A generic engine reported mean confidence 0.974 while misreading several figures; confidence is not a signal.
- **Reconciliation** — two checks, neither exact equality. *Within* a document: a tight absolute bound of a few kroner, because the register prints whole kroner rounded from øre. *Between* document and API: a proportional tolerance, because reporting in thousands or millions introduces scaling error.

**Money**

- **Closable share** (*s*) — the user-set fraction, 0 to 1, of each gap assumed closable. 1 means full convergence with the favourable quartile.
- **Target** (*T*) — the reference value a gap is measured to. **Always the favourable quartile**, at every setting of the closable share; the closable share scales the gap to it rather than moving it.
- **Annual profit uplift** — the kroner value of the operating margin gap: `(T − r) × sumDriftsinntekter × s`.
- **Working capital released** — the kroner value of the receivable-days and payable-days gaps, and **only those two**. They do not overlap: one is an asset, the other a liability.
- **Capital released from operating assets** — the kroner value of the operating-asset-turnover gap, reported as its own amount and **never added to working capital released**. Its capital base, `sumEiendeler − bankinnskudd`, already contains `kundefordringer`, so summing the two would count the same receivable reduction twice (FR-30).
- **EV/EBIT multiple** — a user-set multiple applied to annual profit uplift to give implied enterprise value. **No default**: until the user enters one, no implied enterprise value is shown. EBIT, not EBITDA, because `driftsresultat` is API-sourced for every company and traces directly to the filing.
- **Øre** — the integer unit every monetary value is stored and computed in. Money is never a float.

**Register fields** — the register's own names, never translated. Two are misspelled in the API; do not "fix" either.

`sumDriftsinntekter` total operating revenue · `driftsresultat` operating profit (EBIT) · `sumEiendeler` total assets · `sumEgenkapital` total equity · `salgsinntekt` sales revenue · `varekostnad` cost of goods sold · `lonnskostnad` personnel costs · `avskrivninger` depreciation and amortisation · `nedskrivninger` impairment · `annenDriftskostnad` other operating expenses · `kundefordringer` trade receivables · `bankinnskudd` bank deposits and cash · `leverandorgjeld` trade payables · `aarsverk` full-time equivalents, one decimal, from the notes · `regnskapsperiode` accounting period · `regnskapstype` accounts type · `smaaForetak` small-enterprise flag · `avviklingsregnskap` winding-up accounts · `regnskapsregler` accounting framework · `valuta` currency · **`sumInnskuttEgenkaptial`** total paid-in equity *(misspelled in the API)* · **`regnkapsprinsipper`** the object holding `smaaForetak` and `regnskapsregler` *(misspelled in the API)* · `naeringskode1.kode` primary industry code — the field to filter on, since the search API's `naeringskode` filter also matches secondary and tertiary codes.

## 4. Features

Requirements are numbered globally FR-1 to FR-71. `docs/key-figures.md` is authoritative for every formula; where an FR names one it is citing that document, not restating it.

### 4.1 Company lookup and eligibility

**Description.** The entire setup is an organisation number. No upload, no configuration, no template, no account. The product identifies the company, decides whether it can be analysed, and either produces a full analysis or says plainly why it cannot. Realises UJ-1, UJ-2.

Honesty at this boundary is load-bearing: a company outside a covered industry gets its own filed figures and a statement that its industry is not yet covered, rather than a comparison against a group nobody has checked.

#### FR-1: Lookup by organisation number

A visitor, with or without an account, can enter a nine-digit organisation number and reach an analysis. Realises UJ-1, UJ-2.

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

A company outside a covered industry is shown the key figures the register's own latest-year summary supports, and a plain statement that its industry is not yet covered. Realises UJ-2 (edge).

**Consequences (testable):**
- Only the **API-sourced** figures are shown — operating margin, return on assets and equity ratio — computed from the key figures API's latest year.
- The twelve figures that need a component from the filed document are **not** shown, because extraction never runs during a user request (FR-59) and nothing has been pre-warmed for an uncovered industry.
- No peer group, no median, no quartile, no percentile and no kroner amount is shown for an uncovered subject. Nothing here is a comparison, so FR-24's same-basis rule is not engaged.
- The statement names the industry and says coverage is not yet available — it does not imply the company is ineligible or unavailable.

#### FR-5: User-entered subject description

A user can optionally describe the subject in free text, and that description takes precedence over the register's own for classification of the subject.

**Consequences (testable):**
- The text is sent to the model only to classify, and the model can answer only with a fixed category, so text written to steer the model cannot change more than which category it lands in.
- For an anonymous session the description is used for that analysis and not stored.
- For a signed-in user the description belongs to the workspace.
- The description never affects any peer's classification, only the subject's.
- This is one of exactly two model calls a user request can trigger, the other being explanation regeneration by a signed-in user (FR-52). It runs once per entered text, the result is cached against that text, and it is rate-limited with the open route (FR-6). Every other classification happens at ingestion (FR-20).

#### FR-6: Open-route rate limiting

The no-account route is rate-limited so it cannot be used to harvest the register.

**Consequences (testable):**
- Requests are limited per session and per IP.
- Anonymous sign-in is protected by CAPTCHA.
- Exceeding the limit returns a refusal, not a degraded or partial analysis.

**Notes.** `[NOTE FOR PM]` The brief promises "under a minute" to first insight. That is a product promise no FR currently measures. Consider whether it belongs in §7 as a metric.

### 4.2 Peer group construction and adjustment

**Description.** A five-stage funnel narrows hundreds of thousands of companies to a peer group, four stages by rules and the fifth by model. The user sees how many companies survive each stage, why each peer is in the group, and what its match rests on — and can exclude a peer or loosen a criterion, with everything recomputing immediately. Realises UJ-1, UJ-2.

This is the feature the product lives or dies on. A benchmark the user cannot interrogate is a benchmark they will not trust, so the group is visible rather than hidden, and its quality is measured rather than asserted (§8).

#### FR-7: Stage 1 — coarse filter (rules)

Candidates are reduced by industry code and size band.

**Consequences (testable):**
- Filtering uses `naeringskode1.kode`. The register's `naeringskode` filter also matches secondary and tertiary codes and is never used where the primary industry is meant.
- The size band is `sumDriftsinntekter` from the same filing as the figures being compared, by default 0.5 to 2 times the subject's.
- Size is revenue, never `sumEiendeler` and never the register's employee count — that count is today's figure, not the accounting year's (§5).

#### FR-8: Stage 2 — comparability filter (rules)

A candidate must match the subject on currency (`valuta`), accounting framework (`regnskapsregler`), `smaaForetak`, `avviklingsregnskap`, financial period and `regnskapstype`.

**Consequences (testable):**
- A candidate failing any comparability field cannot appear in the peer group by any later stage.
- **All six fields are hard exclusions, and none of them is loosenable.** FR-18's loosening reaches the size band and segmentation only; no user action can admit a candidate that failed comparability.
- Only calendar-year filings pass.
- `smaaForetak` and `regnskapsregler` are read from the object the API misspells as `regnkapsprinsipper`.

#### FR-9: Stage 3 — segmentation (rules)

Candidates are segmented by size, legal form, and geography where the industry calls for it.

**Consequences (testable):**
- Size segmentation uses `sumDriftsinntekter` from the same filing, the same basis as the coarse filter's size band (FR-7), so the two stages cannot disagree about what size means.
- Legal form is the register's `organisasjonsform`. v1 covers `AS` only, so this stage excludes every other form.
- Geography is applied only where the industry calls for it, and where it is applied the criterion is named to the user so it can be seen and loosened (FR-15, FR-18).
- Each criterion this stage applies is reported in the funnel counts separately, so a group that collapsed here is distinguishable from one that collapsed at comparability.

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
- Cost of goods share and personnel cost share are both business-model markers and benchmarked ratios; where they enter selection they enter **only in coarse bands**, and are benchmarked within their band.
- **The banding is proposed, not settled.** Whether either share enters selection at all is confirmed or dropped against the labelled set (§11, question 12), and the test below is what decides it rather than a judgement made in advance.
- A test asserts that for a peer group built with banding, the within-band spread of a banded figure is non-trivial — i.e. the gap has not been driven to zero by construction. If the spread collapses, the banding is dropped rather than explained.
- **The test runs per industry, and passing in one industry is not passing.** Where a band and a performance measure correlate, banding quietly selects on performance; `43.210` is the case where cost of goods share and margin are expected to move together, so a test aggregated across industries could pass while failing exactly where it matters.

#### FR-14: Disagreement is flagged, not resolved

Where the text and the fingerprint disagree about a candidate, the candidate is flagged rather than resolved by either signal.

**Consequences (testable):**
- A flagged candidate stays in the group and carries its flag, shown next to its match basis (FR-16).
- Neither signal overrides the other, and the model is never asked to adjudicate the disagreement — that would be the model deciding, not classifying.
- The number of flagged candidates is reported with the funnel counts (FR-15).
- Flagged candidates are identifiable in the labelled-set measurement, so their precision can be reported apart from the rest (SM-1).

#### FR-15: Visible funnel counts

The user sees how many companies remain after each stage. Realises UJ-1, UJ-2.

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

The user can exclude a company from the peer group. Realises UJ-1.

**Consequences (testable):**
- An exclusion applies to that analysis only and never changes stored register data.
- For an anonymous session the exclusion lives in the URL (FR-69); for a signed-in user it is saved with the analysis.
- Every aggregate, percentile and kroner amount recomputes (FR-19), and a figure can fall below the minimum group size as a result (FR-22).
- An excluded peer is shown as excluded rather than vanishing, so the user can put it back.

#### FR-18: Loosen a criterion

The user can widen the size band or a segmentation criterion when the group is too small. Comparability is never loosenable.

**Consequences (testable):**
- Loosening reaches the size band (FR-7, FR-9) and segmentation by legal form or geography (FR-9). It never reaches the six comparability fields (FR-8).
- The size band widens from its default 0.5–2× the subject's `sumDriftsinntekter` to at most 0.25–4×.
- No loosening can admit a candidate that failed comparability, and a test asserts that.
- A loosened criterion is shown as loosened, with the funnel counts updated (FR-15), so a larger group never looks like the default one.
- Loosening recomputes everything immediately (FR-19), and a figure can cross the minimum group size in either direction as a result (FR-22).

#### FR-19: Immediate recompute

Any change to the peer group recomputes every key figure, aggregate, percentile and kroner amount immediately. Realises UJ-1.

**Consequences (testable):**
- After an exclusion, aggregates reflect the reduced group with no stale value anywhere on screen.
- A change that drops a figure below the minimum group size causes that figure to stop showing an aggregate (FR-22).

#### FR-20: Peer group assembly latency

Peer group assembly returns in under one second.

**Consequences (testable):**
- Assembly reads stored key figures and profiles only.
- No document is fetched or OCR'd during a user request, for the subject or for any peer (FR-59), and no peer is classified.
- **Exactly two model calls can be triggered by a user request**: classifying a user-entered subject description (FR-5), and a signed-in user regenerating the explanation for an adjusted peer group (FR-52). Both are rate-limited. Regeneration additionally requires an account; description classification is available on the open route under FR-6's limits.
- Peer group assembly itself triggers neither.

#### FR-70: The labelled set

A hand-labelled set of genuine comparables is built to a stated sampling frame, beginning in week 2, and is what SM-1 is measured against.

**Consequences (testable):**
- **15 subject companies per covered industry**, and **30 candidates for each**, drawn **at random from the subject's size band** rather than from the funnel's output. About **900 judgements** in total.
- Drawing candidates from the size band and not from the funnel is what gives recall a denominator: a candidate the funnel never proposed can still be labelled a genuine comparable, and missing it counts against recall.
- The labelling rubric is written and dated **before** the fingerprint's feature list is fixed, so the criterion cannot be tuned to the method after the fact.
- A **subsample is labelled from the description and website only, blind to the accounts**, so at least part of the set is not an expression of the fingerprint's own criterion.
- A **second labeller judges about 50 pairs**, and **Cohen's κ is reported** with the result. `[ASSUMPTION]` Who the second labeller is has still to be confirmed.
- **Fallback if the set comes in small:** `62.100` only, with the description cohorts pooled rather than reported separately. The fallback is stated in advance so a thin set is a smaller claim rather than a silent one.
- Every count above is reported as achieved, not as planned, and any shortfall is stated with the result.

#### FR-68: Embeddings, computed for measurement only

A vector representation of each company's description is computed at ingestion and used as one layer in the peer-selection measurement. It is not user-facing in v1.

**Consequences (testable):**
- Embeddings are computed in the batch job. Nothing embeds during a user request.
- The layer appears in SM-1's ablation as a step of its own, so the measurement can report what it adds over the rules and over model classification.
- **No peer reaches a user's group by embedding similarity in v1.** The layer changes what is measured, not what is shown.
- It becomes user-facing only if it measurably beats model classification, and that is a post-v1 decision this PRD does not take.
- **The layer is optional.** SM-1 reports three layers if embeddings are not built and four if they are, so the measurement stands either way and embeddings can be cut without taking a success metric with them (§6.2).

### 4.3 Key figures and the benchmark display

**Description.** Around a dozen measures across margin, cost structure, working capital, capital efficiency and productivity, with revenue growth for context. For each, the subject's own value, the peer median, the favourable quartile and a percentile marker. Strengths are shown as clearly as weaknesses — a company better capitalised than its peers should know that, because it changes what it can afford to do about everything else. Realises UJ-1, UJ-2.

**Formulas are not restated here.** `docs/key-figures.md` defines all 14 numbered figures plus cash share, and the engine implements exactly those definitions.

#### FR-21: The key figure set

The product computes and displays the key figures defined in `docs/key-figures.md`.

**Consequences (testable):**
- The engine implements every formula exactly as that document states; a formula changes in the document and in the code in the same commit.
- Two algebraic identities are asserted exactly by tests: return on assets equals operating margin × (`sumDriftsinntekter` / `sumEiendeler`), and personnel cost share equals personnel cost per FTE ÷ revenue per FTE.
- Total cost share is a reconciliation check against the three cost shares, not a primary benchmarking figure.
- **Cash share is a diagnostic, not a numbered key figure.** It is shown as context with no declared direction, is never ranked, and produces no kroner amount — the same treatment revenue growth gets (FR-27).
- Amounts are integers in øre. Ratios use a decimal library and are rounded only for display: percentages to one decimal, days to whole days, kroner to whole kroner.

#### FR-22: Minimum group size, per key figure

No aggregate is shown for a key figure unless at least 10 peers have a defined value for that figure. Realises UJ-1 (edge).

**Consequences (testable):**
- The count is taken **per key figure**, after companies with an undefined value for that figure are excluded.
- A peer group can clear the floor for one figure and fail it for another; each figure is gated independently.
- Below the floor **the row persists and still shows the subject's own value**; where the median, favourable quartile and percentile would be, the figure states how many comparable values exist against the ten required. The user sees which figure specifically is thin, rather than a silently shorter table.
- A figure below the floor produces no kroner amount, because there is no target to compute a gap against (FR-29).
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

A key figure's **comparison** — median, favourable quartile, percentile and any kroner amount — is shown only if the figure can be computed for the subject and for at least the minimum group size of peers **from the same source**. The subject's own value is governed by FR-22, not by this requirement.

**Consequences (testable):**
- A figure the subject has from OCR and the peers do not gets no comparison: no median, no quartile, no percentile, no kroner amount.
- The subject's own value still appears in the row, with the reason the comparison is absent, exactly as below the minimum group size (FR-22). The two cases are displayed the same way because they are the same thing to the user: a figure with nothing trustworthy to compare against.
- Where the subject's own value cannot be computed either, the row states that instead (FR-23).
- **This requirement withholds a comparison; it never withholds the company's own figure.** An earlier wording said the figure itself was not shown, which contradicted FR-22.

#### FR-25: Same year

The benchmark year is the subject's latest filed year, and peers use the same year.

**Consequences (testable):**
- A peer without a filing for that year is excluded.

#### FR-26: Decomposition views

The product separates margin from capital efficiency, and pay level from productivity.

**Consequences (testable):**
- The pay-level-versus-productivity view distinguishes paying more per person from producing less per person, using the identity in FR-21.
- Both decomposition views need an account (FR-42).

#### FR-27: Distribution display

For each key figure the product shows the subject's value, the peer median, the favourable quartile, and the subject's percentile.

**Consequences (testable):**
- The favourable quartile is the upper quartile where higher is better and the lower quartile where lower is better, by the direction declared for that figure.
- Percentile is `(peers worse + 0.5 × peers equal) / peers × 100`, in the favourable direction.
- Both the median and the favourable quartile are always shown where both exist. The median is context, and a marker on the closable-share control; it is never the target of the kroner arithmetic (FR-31).
- **A figure with no declared direction gets no favourable quartile and no percentile**, because both are defined in the favourable direction and there is none. Those figures show the subject's value against the peer distribution and are never ranked: revenue growth, because fast growth often explains a weak margin; personnel cost per FTE and equity ratio, because the direction is genuinely arguable; and cash share, which is a diagnostic (FR-21).

#### FR-28: Multi-year trend where available

Where filings allow, the product shows how the subject has moved against its peers over time.

**Consequences (testable):**
- Development over time covers the last five years, 2021–2025. Measured 2026-09-26: about 88 % of columns reconcile in those years. Paper filings are never read; older generated years are used only where they reconcile.
- Peer history is fetched every other year, since each document carries a prior-year column; every year is still covered.
- Development over time needs an account (FR-42).

### 4.4 Gap quantification in kroner and the closable-share control

**Description.** The feature that turns a ratio into a decision. Every unfavourable deviation becomes a kroner amount; one control sets how much of each gap the user believes is closable; the totals move live. This is where a double-counting error would be most damaging and least visible, so the rule against it is a requirement with a test, not a convention.

#### FR-29: Deviation to kroner

Each key figure with a kroner translation converts its gap to money exactly as `docs/key-figures.md` specifies. Realises UJ-1, UJ-2.

**Consequences (testable):**
- Only gaps where the subject is worse than the target produce a kroner amount; where it is better, the figure is shown as a strength with no amount.
- Figures with no kroner translation in that document produce none here.

#### FR-30: No double counting

Cost-share kroner amounts explain the operating margin gap and are never added to it **or to each other**.

**Consequences (testable):**
- **Profit cluster.** An automated test asserts that no total presented to the user, or contained in an export, sums more than one of {operating margin, cost of goods share, personnel cost share, other operating cost share}.
- **Capital cluster.** A second assertion covers the capital amounts: no total sums the receivable-days amount together with the operating-asset-turnover amount. The operating asset base `sumEiendeler − bankinnskudd` already contains `kundefordringer`, so adding them counts the receivable reduction twice.
- Working capital released is receivable days **plus payable days only**. Those two are safe to add — one is an asset, the other a liability — and the test asserts that nothing else enters that total.
- Capital released from operating assets is presented as its own amount beside working capital released, never inside it.
- Cost-share amounts are presented as a subordinate breakdown of the operating margin amount, never as independent opportunities that could be added up.
- The two clusters are tested separately because they fail separately: an earlier version of this requirement guarded only the profit cluster, and the receivables double-count passed it.

#### FR-31: The closable-share control

A single control sets the closable share from nothing to full convergence with the favourable quartile, and the results update live. Realises UJ-1, UJ-2.

**Consequences (testable):**
- Annual profit uplift, working capital released, capital released from operating assets and implied enterprise value all recompute from the same closable share, and are presented as four amounts rather than one total (FR-30).
- **The target is the favourable quartile at every setting of the control**, and the control scales the gap to it: no kroner at zero, full convergence with the quartile at full closure.
- The peer median is marked on the control so the user can see where the typical peer sits relative to the target, and is never itself the target. `docs/key-figures.md` states the same.
- A figure with no favourable quartile (FR-27) has no target and produces no amount here.

#### FR-32: Valuation at a user-set multiple

Implied enterprise value is annual profit uplift × an EV/EBIT multiple set by the user.

**Consequences (testable):**
- The multiple is a user input with **no default**. The field starts empty and implied enterprise value is not shown at all until the user enters one.
- The engine never looks a multiple up, infers one, or offers a range, so the product never implies a valuation it did not receive from the user. Annual profit uplift and working capital released are unaffected and show without it.
- The calculation uses EBIT (`driftsresultat`), which is API-sourced for every company and traces directly to the filing, so the headline valuation figure carries no OCR dependency.

### 4.5 Unfiled current-year figures

**Description.** A company knows its current year long before it files it. An owner can enter those figures by hand and see a provisional position — but the product never lets them be mistaken for filed accounts, and never lets them touch anyone else's comparison. Realises UJ-4.

#### FR-33: Unaudited labelling everywhere

Every figure derived from unfiled input is labelled unaudited and user-entered wherever it appears. Realises UJ-4.

**Consequences (testable):**
- The label survives into PDF export.
- Filed and unfiled figures are never merged into a single displayed value.

#### FR-34: Visibility of unfiled figures

Unfiled figures belong to the workspace: the owner writes them, viewers read them, anonymous sessions never read them. Realises UJ-4 (owner writes) and UJ-3 (viewer reads).

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

An owner enters four required components — revenue, operating profit, total assets and total equity — and may add the document-sourced components (the cost lines, trade receivables, trade payables, FTEs) where they have them.

**Consequences (testable):**
- The four required components guarantee a provisional position on operating margin, return on assets and equity ratio — the three figures that depend on no extracted data.
- Every further key figure appears only once all of its components are present. A partly-entered figure is undefined, never completed from what is there (FR-23).
- A component left blank is undefined, not zero.

#### FR-67: Year-to-date figures against the same period last year

An owner may enter year-to-date figures, stating how many months they cover, and the primary comparison is the company's own figures for the same months of the previous year. Realises UJ-4.

**Consequences (testable):**
- The number of months covered is required, and is shown with every figure derived from the entry.
- **Nothing is annualised or scaled to a full year.** A partial-period figure is used for the period it covers, so no projection is made and FR-23's rule that no figure is ever estimated holds without exception — as does §5's exclusion of forecasting.
- **Ratios only.** No kroner amount is produced from a partial period, because a kroner translation needs a twelve-month revenue base (FR-29).
- The primary comparison is the company against its own same period last year, entered by the owner. Seasonality largely cancels because both sides cover the same months.
- Where the prior-year same-period figures are absent, the year-to-date ratios are shown **without a primary comparison** — never measured against a full year as though the periods matched.
- The company's own last filed full year and the peers' latest full year are shown as context only, labelled *"hele år, ikke samme periode"*.
- Every derived figure is labelled unaudited and user-entered (FR-33), and none enters any aggregate (FR-37).
- No adjustment is made for seasonality or any other external factor, and the product says so. It is disclosed, not corrected.

### 4.6 Accounts, workspaces and access

**Description.** One access model covers everyone. A visitor without an account gets a real authenticated identity, so row-level security, the audit log and rate limiting all work unchanged — and registering converts that identity in place rather than starting over. An account is needed only for what persists. Realises UJ-1, UJ-2, UJ-3.

The security-relevant subtlety: anonymous users hold the `authenticated` Postgres role, so a policy that merely checks for an authenticated user admits them.

#### FR-39: Anonymous session on arrival

A visitor without an account receives a Supabase anonymous sign-in, so every request carries a real `auth.uid()`.

#### FR-40: Conversion in place

When a visitor registers, the anonymous user is converted in place and keeps what it did. Realises UJ-1, UJ-2.

**Consequences (testable):**
- An analysis built anonymously is still reachable after registration, without being rebuilt.
- What carries across is the URL state of FR-69 — organisation number, exclusions, closable share, multiple — written into the new workspace at registration. Nothing was in the database before, so nothing had to be migrated out of an anonymous row.

#### FR-41: Magic-link sign-in

Sign-in is by emailed magic link.

**Consequences (testable):**
- No password is stored anywhere, so none can be leaked.

#### FR-42: The account wall

Open to anyone: the front page and industry overviews, lookup, the peer group and its adjustment, key figures, percentiles, gaps in kroner, the closable-share control and valuation. An account is required for development over time, the decomposition views, PDF export, saved analyses and history, favourites, unfiled figures, workspaces, invitations and the portfolio front page. Realises UJ-1, UJ-2.

**Consequences (testable):**
- The core — peers and the gap in kroner — never requires an account.

#### FR-43: Workspaces

Saved work belongs to a workspace, typically one per company, with membership carrying the role `owner` or `viewer`.

**Consequences (testable):**
- An adviser holding many client companies is a user with many workspaces; no adviser role exists.

#### FR-44: Invitation

An owner invites a viewer by email, into a single workspace, as a viewer. Realises UJ-3.

**Consequences (testable):**
- An invitation grants access to exactly one workspace, never to the inviter's other workspaces.
- An invitation confers read-only access only.
- Share links that grant access to anyone holding them are out of v1 (§5).

#### FR-45: Cross-workspace isolation

No user can reach a workspace they are not a member of. Realises UJ-3.

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

#### FR-69: An anonymous session's state lives in the URL

Everything an anonymous visitor changes — the organisation number, excluded peers, the closable share and the EV/EBIT multiple — is carried in the URL rather than written to the database.

**Consequences (testable):**
- **No anonymous session writes to any table.** FR-47's requirement that every policy on saved or user-entered data demand `is_anonymous` false therefore holds without exception, and the authorisation suite's anonymous-write attack stays a real attack.
- Every value carried this way is either public register data or the user's own choice of parameter. None of it is anyone's saved work.
- Refreshing, bookmarking or passing on the address reproduces the same analysis, because the state is in the address.
- This is not browser storage. AGENTS.md bars browser storage for anything that must survive, and nothing here is stored in the browser.
- On registration the URL state is written into the workspace, which is what makes FR-40's conversion in place observable rather than merely claimed.

### 4.7 Saved analyses, history and export

**Description.** The second visit should show how the company has moved against its peers rather than starting over.

#### FR-49: Save an analysis

A signed-in owner can save an analysis into a workspace.

#### FR-50: History

A saved analysis accumulates history, so a later visit shows movement against the peer group rather than a fresh start.

#### FR-51: PDF export

A signed-in user can export an analysis as PDF. Realises UJ-1.

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
- Text is generated and cached for the **default** peer group only, so an ordinary visit never triggers a model call.
- An adjusted peer group shows the default group's explanation, labelled *"Forklaringen gjelder standard peer-gruppe"*, rather than silently describing a group it was not written for.
- A signed-in user can regenerate the explanation for an adjusted group through a rate-limited action. This is the second of exactly two model calls a user request may trigger (FR-20).
- An anonymous session never triggers generation of explanatory text by any route, adjusted group or not.

#### FR-53: The model never calculates

No number may appear in generated text that is absent from the engine's calculation output.

**Consequences (testable):**
- An automated test rejects generated text containing any figure not present in the engine's output. Once that test exists it is never weakened.
- The test also rejects a figure that **is** in the engine's output but **attached to the wrong thing** — the right number against the wrong key figure, company, year or direction. Containment alone would pass that, and it is the more likely failure.
- The test parses **Norwegian number formats**, so `1 234 567,89`, a non-breaking or narrow space as thousands separator, a comma as decimal separator, `kr` before or after the amount, and `%` are all recognised as the figures they are. A figure the test cannot parse is a failure, not a pass.
- The model's only two jobs are classification into fixed categories (FR-11) and explanatory text (FR-52). It performs no arithmetic.
- Peer inclusion reasons are rules-generated, not model-generated (FR-16).
- A free-form chat over the data is out of scope precisely because it cannot be held to this rule (§5).

#### FR-54: Explains, does not recommend

Generated text describes what the figures show and does not prescribe action.

### 4.9 Responsive interface

**Description.** A data-dense product — four-column ratio tables, distribution plots, a peer list — that has to work from desktop down to phone width. This is a course requirement, not a preference, and retrofitting it is far more work than designing for it.

#### FR-55: Reflow to phone width

The interface works down to approximately 375px, reflowing and stacking to one column when narrow.

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

#### FR-71: When the subject's own filing fails reconciliation

Where the subject's own filed document fails reconciliation, the product shows the figures it can source from the API and says why the others are absent.

**Consequences (testable):**
- The three API-sourced figures — operating margin, return on assets, equity ratio — are shown, because they do not depend on the document.
- The twelve document-dependent figures are absent, and the product states that the subject's own filing could not be read reliably rather than showing a gap without a reason.
- No figure is estimated, substituted from another year, or shown with a caveat (FR-58).
- The subject is not silently demoted to an uncovered company: its industry **is** covered, its peers are unaffected, and the API-sourced figures still carry a full comparison (FR-24).
- This is distinct from FR-4, where the industry itself is uncovered and there is no peer group at all.

#### FR-64: The age of the data is disclosed, not promised

Every figure, aggregate and industry overview states the filing year behind it and the date the underlying data was read from the register.

**Consequences (testable):**
- The filing year and the read date survive into PDF export and into a saved analysis, so a saved analysis cannot be mistaken for a current one.
- A saved analysis shows the read date it was computed from, never today's.
- The product makes no freshness guarantee. The batch refresh is triggered manually in v1 (§8), so the disclosed read date — not a promised interval — is what tells the user how current the figures are.

#### FR-65: Source credit under the register's licence

The product credits Brønnøysundregistrene as the source, states that the figures have been processed by Peerless, and does not suggest the register endorses the analysis. **The NLOD credit is claimed for the API-sourced data only.**

**Consequences (testable):**
- The NLOD 2.0 credit applies to what the register licences under NLOD: the data from the open APIs. Its prescribed form is used where it applies — *"Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene"*.
- **Figures derived from the filed documents are credited to Brønnøysundregistrene as their source without asserting a licence**, because the register states none for those documents (§8). The product never claims NLOD coverage for data NLOD does not cover — an earlier version of this requirement did exactly that, and it was wrong.
- The credit distinguishes the two, so a reader can tell which figures rest on a licence and which rest on a right of access.
- It states that Peerless has processed the data, because every displayed figure is recomputed rather than reproduced. The licence requires modification to be declared where it applies, and saying so for everything costs nothing.
- It reaches every route out of the product, PDF export included, not only the web interface.
- It may live on an *Om*-style page rather than beside each figure, but it is reachable from every page and is not hidden.
- The register's name and marks appear as the source of the data only — never in a way that implies the register stands behind, recommends or markets the analysis.
- Nothing in the presentation distorts or misrepresents the register's figures. This is the licence restating what FR-58 and FR-60 already enforce.

`docs/data-sources-brreg.md` holds the licence text, the clause references and the URLs.

#### FR-66: A withdrawn company is removed from storage

When the register reports a company as gone, Peerless deletes its stored copy.

**Consequences (testable):**
- An entity returning `410 Gone` is removed from stored register data, not merely flagged, because the register states that the status should also be treated as a request that copies and caches remove it.
- A removed company disappears from every peer group and from every aggregate computed after the removal.
- A saved analysis that included it keeps its own figures — it is a record of what was computed on its stated read date (FR-64) — but the company cannot be looked up or re-entered as a peer.
- The check belongs to the ingestion job, so removal never depends on a user visiting the company.

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
- **Forecasting.** Peerless describes what the accounts say, not what comes next. A part-year figure is never scaled to a full year either: year-to-date entries stay on the period they cover and are compared against the same period of the previous year (FR-67).
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

- Receivable days are overstated by VAT by up to 25%: receivables include it, revenue does not. **The distortion is only roughly similar across a peer group, not cancelled by it.** Export sales are zero-rated, so a company selling abroad carries proportionally less VAT in its receivables and shows fewer receivable days for the same real credit terms — and export share varies along precisely the axis the fingerprint separates businesses on. The ratio is therefore comparable only to the extent that peers share a VAT profile, and the comparison is weakest where the peer group is most mixed. Stated, not adjusted. The kroner amount is unaffected by this: `r / 365 × salgsinntekt` is `kundefordringer` by construction, so the conversion returns the real VAT-inclusive balance either way — what the VAT profile distorts is the *target*, not the arithmetic.
- Cost lines may be classified differently between companies — a consultancy booking subcontractors as cost of goods rather than personnel — distorting the split between the three cost shares. Total cost share is shown as a check against this.
- Employee count from Enhetsregisteret is deliberately not used for `aarsverk`: it is today's figure, not the accounting year's. FTEs come from the notes instead, accepting OCR dependency to get the right period.

## 6. MVP Scope

### 6.1 In Scope

- Analysis without an account; magic-link sign-in; workspaces with an owner and invited read-only viewers.
- Company lookup by organisation number, and analysis of any company in a covered industry.
- **Two committed industries: `62.100 Dataprogrammeringstjenester` (about 1 000 companies with five or more employees) and `69.202 Regnskapsføring og bokføring` (about 800).** `43.210 Elektrisk installasjonsarbeid` is the likely third, **not a commitment**. Coverage grows one industry at a time, as many as time allows — and an industry is offered only once its filings are extracted and reconciled and its peer selection has been measured for that industry.
- Peer group construction across all five stages, with visible filter counts, per-peer inclusion reasons, match-basis flags and user adjustment.
- Embeddings computed at ingestion **for the SM-1 ablation only**, not user-facing in v1 (FR-68). Listed here because it is scheduled work that carries a primary success metric; omitting it from scope would drop it from the epics and make SM-1 unreportable.
- The key figure set in `docs/key-figures.md`, across margin, cost structure, working capital, capital efficiency and productivity, with revenue growth for context.
- Decomposition views: margin versus capital efficiency, and pay level versus productivity.
- Multi-year trend where filings allow, with reach determined by measurement rather than promised in advance.
- Gap quantification in kroner, the closable-share control, and valuation at a user-set EV/EBIT multiple.
- Written explanation grounded in calculated figures, with the no-calculation rule enforced by test.
- Manual entry of unfiled current-year figures, labelled unaudited and excluded from all aggregates, including year-to-date figures compared against the same period of the previous year, as ratios and never annualised.
- Minimum group size of 10 peers per key figure; rate limiting on the open route; audit log.
- Saved analyses with history; PDF export.
- A front page with industry overviews, analysis in tabs, and a portfolio front page for signed-in users.
- Source credit under the register's NLOD 2.0 licence, stating that Peerless has processed the figures, on every route out of the product including PDF export.
- Removal of a withdrawn company from stored register data when the register reports it gone.
- A responsive, Norwegian-language interface from desktop down to phone width.

### 6.2 Out of Scope for MVP

Everything in §5, plus:

- **A third industry.** `43.210` is intended, not committed — it arrives only if time allows and only after its own measurement. `[NOTE FOR PM]` This is the most likely place for scope to quietly expand. Two measured industries beat three unmeasured ones, and the measurement is what the project is graded on.
- **Investor and portfolio use cases**, which depend on screening and portfolio views that are out of scope.
- **Numeric quality targets.** No source document states a target for peer-selection precision, recall, or OCR accuracy. v1 commits to *measuring and reporting* these, not to hitting a threshold (§9, §11).

**If time runs short, cut in this order.** Epics are cut from this list, in this order, and nothing is cut out of order to keep a demo tidy.

1. The **portfolio front page** (FR-63).
2. The **industry overviews** (FR-61).
3. **Unfiled and year-to-date figures** (FR-33–FR-38, FR-67).
4. **PDF export** (FR-51).
5. **Removal of withdrawn companies** (FR-66) — a licence obligation, so cut only as far as recording that it is owed.
6. The **development-over-time view** (FR-28). **The data is kept**: multi-year extraction is batch compute, not build time, and once the filings are extracted and reconciled they stay extracted. What is cut is the interface that displays the trend.
7. The **third industry** (`43.210`), which was never committed.
8. **Embeddings** (FR-68), which is why SM-1 reports three layers without them and four with (FR-68, SM-1).

**Never cut**, because the project's results rest on them: the **labelled set** (FR-70), the **authorisation suite** (SM-3), and the **OCR measurement** (SM-2).

**Load-bearing for the graded result** — these carry a success metric, and cutting one removes a claim rather than a feature: FR-7 to FR-16 and FR-70 (SM-1, SM-1b), FR-28, FR-57, FR-58 (SM-2), FR-34, FR-45, FR-47 (SM-3), FR-53 (SM-4), FR-21, FR-23, FR-30 (SM-6), FR-1 and FR-42 (SM-8).

**Product, not result** — these make Peerless worth using but no success metric depends on them: FR-49 to FR-51, FR-61 to FR-63, FR-26, FR-33 to FR-38, FR-67, FR-52 and FR-54. The cut order above draws from this group first by design, and the one exception is FR-28, which SM-2 measures and which is therefore cut last among them and only its interface.

## 7. Cross-Cutting Non-Functional Requirements

**Performance.** Peer group assembly under one second; a complete analysis within a few seconds. Achieved because every figure, profile and peer classification is pre-computed at ingestion — nothing is extracted or recognised during a user request, and only two model calls are reachable from a request at all — classifying a user-entered subject description, once per text and cached (FR-5), and explanation regeneration by a signed-in user for an adjusted peer group (FR-52). The OCR pipeline has no interactive budget at all; it is a batch job measured on throughput and accuracy, not latency.

**Correctness of money.** Every monetary value is stored and computed in integer øre, or with a decimal library. No monetary value is ever a float, including intermediate results, because the error compounds across periods. Rounding happens only for display.

**Calculation integrity.** The calculation engine is pure functions — figures in, figures out, no database or framework imports — so it is testable in isolation and readable by someone checking the accounting. It is tested against hand-calculated reference cases from real filed accounts, including negative equity, zero revenue, missing components, and non-calendar financial years.

**Authorisation.** Enforced in the database by row-level security on every user-scoped table, keyed to workspace membership. The application layer filtering correctly is never sufficient: assume it will eventually fail and make that insufficient to leak data. The authorisation test suite is written early, not last, and attempts every forbidden pattern — reading another user's data, reaching another workspace including one held by the same owner, an anonymous session reading or writing saved data, a viewer writing, an invited viewer reaching a workspace they were not invited to, and calling an endpoint unauthenticated — asserting rejection in each case.

**Secrets.** API keys, service-role credentials and database connection strings stay server-side. `.env` is gitignored from the first commit.

**Accessibility and responsiveness.** Usable from desktop down to approximately 375px, with the page body never scrolling horizontally. Wide content scrolls within its own container.

**Architecture boundary with product consequence.** Nothing a user can reach may depend on the Python ingestion pipeline being up. It is a batch job, never a service, and never in a request path.

## 8. Constraints and Guardrails

**Privacy.** The source figures are public filings, so confidentiality attaches to *use*, not to the figures. What is actually private is: which companies a user looked at, their saved analyses, their workspace membership, and their unfiled figures. Security effort goes there rather than to protecting public data. Aggregates are computed only from public filings, so a peer median discloses nothing the filings do not — which is why the minimum group size is a quality threshold and not a disclosure control. Unfiled figures never enter an aggregate, enforced structurally (FR-37).

**Safety of generated text.** The model's two jobs are bounded by construction: classification answers only in fixed categories, and explanatory text is rejected by test if it contains a figure the engine did not compute. User-supplied description text reaches the model only for classification, so text written to steer it cannot change more than the category it lands in.

**Cost.** Bounded by covering a small number of industries rather than the register. OCR runs once per filing at ingestion and is stored permanently; explanation text is generated once for the default peer group and cached, with regeneration for an adjusted group behind an account and a rate limit (FR-52); the open route is rate-limited and CAPTCHA-protected so anonymous traffic cannot run up model cost or harvest the register.

**Data sourcing.** The free public register interfaces are the only data source. The paid multi-year bulk subscription is out of scope on cost grounds, which is why multi-year history comes from the filed documents rather than an API.

**Data freshness.** There is no automatic refresh in v1: the batch job runs when it is triggered. Freshness is therefore disclosed rather than promised — every figure carries its filing year and read date (FR-64). Norwegian annual accounts cluster in a single filing window, so an automatic cadence is a real decision rather than a cron line; it is a blocking item before any public deployment (§11), not a v1 requirement.

**Licence.** The register's open APIs are published under NLOD 2.0, which permits commercial use, modification and redistribution, and requires the source and the licence to be credited and any modification declared (FR-65). It also forbids presenting the data misleadingly or implying the register endorses the product — the same posture §9 and §10 take for other reasons.

**The one licence gap, and it is not small.** The register licences the key-figures API but **not the filed annual-account documents**: on data.norge.no the key-figures distribution carries NLOD while document retrieval reads *"Lisens: Ikke oppgitt"*, and no register page states that the documents are NLOD-covered. Twelve of the fifteen key figures are recovered from those documents by OCR, so the gap sits under most of the figure set rather than at its edge. Peerless publishes derived ratios and aggregates, never a reproduction of a filing, which is a materially different act — but the distinction is a legal judgement, free access is not a reuse licence (åndsverkloven §§33–34), and nothing in the register's own pages settles it. **Not a v1 blocker** — this is coursework against public data — and **a gate before any public or commercial deployment**, where the answer comes from asking Brønnøysundregistrene rather than from reading their website (§11.19). Detail and sources in `docs/data-sources-brreg.md`.

## 9. Success Metrics

Each metric names what it validates. `[ASSUMPTION]` No source document states a numeric target for the two measurement-based metrics, and this PRD does not invent one: v1 commits to measuring and reporting, and the thresholds are an open question (§11). If the course expects a stated threshold, SM-1 and SM-2 both need one.

**Primary**

- **SM-1 — What each layer adds.** The headline result is the **layer-by-layer ablation**: precision and recall against the labelled set (FR-70) for each funnel layer standalone and cumulatively — industry code and size alone, adding the accounts-based fingerprint, adding model classification, and adding embeddings if they are built. **Three layers reported, four with embeddings.** The question it answers is how much each layer contributes and, specifically, **whether the model adds anything beyond the accounts-based fingerprint.** That question can genuinely come back "no", which is what makes it the headline. Reported **per industry**, split by whether the description is informative, with each cohort's share disclosed. Validates FR-7 to FR-16, FR-70.
- **SM-1b — Sanity check against industry code alone.** Precision and recall of the full funnel against the industry-code-only baseline on the same labelled set. This is a **check, not a claim**: the labeller judges comparability on criteria the fingerprint encodes, so the baseline is expected to lose, and its losing confirms the labelling is coherent rather than demonstrating the method works. A result where industry code alone *wins* would mean something is wrong with the funnel or the labelling. Validates FR-70.
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

**The claim under test:** **how much each layer of the funnel adds, and whether reading free text with a model adds anything beyond what the accounts alone already say.** That is the headline, and it can come back "the model was not needed" — which is a real result and one the rules-before-model principle actively predicts.

**Why the claim is framed that way, and not the other way.** The obvious framing — "reading what a company does beats industry classification alone" — **cannot fail under this protocol, so it is not the headline.** The labelled set is judged by the person who designed the method, on the same criteria the fingerprint encodes: cost composition, inventory, asset intensity, what the business actually is. Industry code demonstrably does not capture those criteria, so it must lose. Blinding the labeller to which funnel stage proposed a candidate removes *provenance* bias; it does not remove the circularity of the criterion itself. That comparison is kept as **SM-1b, a sanity check** — if industry code alone won, something would be wrong — but a check that is expected to pass is not a finding.

**What makes the headline claim measurable:**

- The labelled set of FR-70, to a stated sampling frame: 15 subjects per industry, 30 candidates each drawn **at random from the subject's size band rather than from the funnel's output**, so a comparable the funnel never proposed still counts against recall. Roughly 900 judgements, from week 2.
- **Three defences against the circularity**, none of which fully removes it and all of which are reported: the labelling rubric is written and dated **before** the fingerprint's feature list is fixed; a **subsample is labelled from description and website only, blind to the accounts**; and a **second labeller judges about 50 pairs with Cohen's κ reported**.
- **Layer-by-layer ablation:** each layer scored standalone and cumulatively, so the result shows where any improvement comes from — rules, or the model. Stratified by description quality, because the model can only help where there is text to read, and pooling the cohorts would hide that.

**Anticipated findings that are results, not failures:**

- If the accounts-based fingerprint alone captures most of the improvement, **the model was needed less than expected.** That is a finding worth reporting, and the rules-before-model principle predicts it.
- If embeddings do not measurably beat model classification, classification stays. Embeddings replace it only on evidence.
- Description quality is currently a word-list proxy, not a measurement: at most 56% of descriptions in 62.100, 38% in 69.202 and 50% in 43.210 appear specific, and the true share is lower. Hand-scoring converts this estimate into a measurement, and it covers the two committed industries.

**Will there be anything to compare against?** This had been asserted rather than computed: the PRD set a floor of 10 peers per key figure without knowing how often it would be cleared once comparability, the size band and the reconciliation rate had all taken their cut. Computed by `analysis/peer_group_yield.py` from the screening samples, reported in `analysis/output/peer-group-yield.md`:

| Industry | Stage reached (default 0.5–2× band) | Median peers | Q1 | Share clearing 10 |
|---|---|---|---|---|
| `62.100` | comparability + size band, API figures | 253 | 101 | 99 % |
| `62.100` | × 88 % reconciliation, document figures | 223 | 89 | 97 % |
| `62.100` | ÷ 3 for classification, document figures | 74 | 30 | 88 % |
| `69.202` | comparability + size band, API figures | 422 | 251 | 99 % |
| `69.202` | × 88 % reconciliation, document figures | 372 | 221 | 99 % |
| `69.202` | ÷ 2 for classification, document figures | 186 | 110 | 99 % |

**The funnel is not the binding constraint, and that was worth checking rather than assuming.** Even after reconciliation and a divide-by-three for classification, the typical `62.100` subject has around 74 qualifying peers and 88 % of subjects clear the floor. These are upper bounds — the computation applies stages 1 and 2 plus the size band, and stands in for stages 3 to 5 with a crude division — so the real figures are lower, but not by the order of magnitude that would make below-floor rows the normal case.

**What does fail is narrower and sharper: a subject that is not `smaaForetak`.** `smaaForetak` is a comparability field and therefore a hard exclusion (FR-8), so such a company can only be compared against others like it — and there are very few. In `62.100` they are 8 of 93 comparable companies (about 9 %, or 81 in the population), and they still find a median of 25 peers among themselves. In `69.202` there is **1 in a sample of 99** — about 8 companies in the entire industry — so **a large accounting firm gets no peer group at all**, and FR-22 will withhold every aggregate for it. That is correct behaviour and a real coverage limit, and it is stated here rather than discovered by the first such user. `[ASSUMPTION]` The share is per industry and not a single figure: 9 % in `62.100` after comparability, 1 % in `69.202`.

**Honest framing of the market claim.** No Norwegian product found assembles a matched peer group *and* converts deviations to kroner self-serve for the company itself; incumbents lead with credit-risk framing. But the gap sits between two well-funded adjacent categories rather than in an empty market, and the brief is candid that there is no moat: the data is public, the ratios are textbook, and the advantage is framing and execution only.

## 11. Open Questions

Numbers are stable: an answered question keeps its number so the decision trail in `.memlog.md` stays resolvable.

**Answered**

1. **Course requirements.** No fixed user roles are required. Nothing must be delivered before coding, but BMAD requirements must be met. The product brief is due 2026-09-27.
2. **Interface language.** Norwegian (bokmål). All documentation stays English.
3. **Team size.** Solo.
4. **Is `43.210` committed for v1?** No — intended, not committed, and §6.2 stands as written. It remains the last rung of the cut order, and inventory days stay out of the key figure set with it. *(2026-09-26)*
5. **A default or range for the EV/EBIT multiple.** None. The field starts empty and implied enterprise value is not shown until the user enters a multiple, so the product never implies a valuation it did not receive (FR-32). *(2026-09-26)*
6. **Median or favourable quartile as the reference point.** The favourable quartile is the target at every setting of the closable-share control, and the control scales the gap to it — no kroner at zero, full convergence at full closure. The median is shown in every distribution and marked on the control so the user can see where the typical peer sits, but never enters the arithmetic (FR-31). `docs/key-figures.md` was corrected in the same change; its previous wording admitted a reading in which zero closable share still produced the whole gap to the median. *(2026-09-26)*
7. **Which figures a user may hand-enter as unfiled.** Four required components — revenue, operating profit, total assets, total equity — with the document-sourced components optional (FR-38). *(2026-09-26)*
8. **User-facing behaviour below the minimum group size.** The row persists and still shows the company's own value; the aggregate cells state how many comparable values exist against the ten required, and no kroner amount is produced (FR-22). *(2026-09-26)*
9. **Cash share** — a diagnostic, not a numbered key figure. Shown as context, never ranked, no kroner translation (FR-21). *(2026-09-26)*
10. **How many years of trend can honestly be promised** — five (2021–2025), from measurement. See `docs/data-sources-brreg.md`. *(2026-09-26)*
15. **Cache lifetime for fetched public data.** Resolved as disclosure rather than cadence: every figure carries its filing year and the date the data was read (FR-64), and the batch refresh is triggered manually in v1. An automatic cadence is a pre-deployment gate, below. *(2026-09-26)*
16. **Attribution and terms-of-use obligations for register data.** Superseded rather than dropped: researched 2026-09-26, which split it into the attribution duty (now FR-65, settled) and the document-licence gap (now question 19, open). Kept here because question numbers are stable.
17. **Whether unfiled figures may ever enter a group aggregate.** Never, enforced structurally (FR-37). Closed in the technical note as well.

**Gated on measurement** (answers arrive from work already scheduled)

11. **Target thresholds for precision, recall and OCR accuracy.** None stated anywhere. Whether v1 should commit to a threshold at all, or only to measuring, is a decision — and committing to one before the baseline exists would be guessing.
12. **Which fingerprint features are used, and whether cost of goods share or personnel cost share enters selection at all.** Status sharpened 2026-09-30: banding is **proposed, not settled** (FR-13). It is confirmed or dropped against the labelled set, and FR-13's within-band spread test is what decides it. If the spread collapses, the banding goes rather than being explained.
13. **How much autonomy the model has in accepting or rejecting a candidate.** The second half of this question is answered (2026-09-30): all six comparability fields are hard exclusions and none is loosenable (FR-8), and FR-18's loosening reaches the size band and segmentation only. Model autonomy at stage 5 remains open.
14. **OCR field names.** All ten OCR-sourced field names in `docs/key-figures.md` are marked provisional until confirmed against a real filing.

**Pre-deployment gates** (not v1 requirements; blocking before anything is public)

18. **Automatic refresh cadence.** v1 refreshes manually and discloses the read date (FR-64, §8). A public deployment needs a real cadence, and Norwegian annual accounts cluster in a single filing window rather than arriving evenly, so the answer is a schedule shaped to that window rather than a fixed interval. Revisit when a deployment is actually planned.
19. **May the filed annual-account documents be reused the way Peerless reuses them?** Researched 2026-09-26, and this is the part that did not resolve. The APIs are NLOD 2.0 and the attribution duty is now a requirement (FR-65), but the documents themselves carry no stated licence, and twelve of fifteen key figures come from them. Deriving ratios is not reproducing a filing, and free innsyn is not a reuse licence (åndsverkloven §§33–34) — the register's pages do not reach the question. **The answer comes from asking Brønnøysundregistrene, not from more searching.** Blocking before any public or commercial deployment; not blocking the coursework. See `docs/data-sources-brreg.md` and §8.
20. **Whether the paid subscription's framework agreement restricts redistribution.** Unverified — the agreement document was not read, and the tier is out of scope on cost grounds anyway. Matters only if the paid tier is ever revisited.

## 12. Assumptions Index

Every `[ASSUMPTION]` in this document, for explicit confirmation:

- **§9** — no numeric target is stated for any measured metric, so none is invented here. If the course expects a stated target, SM-1 and SM-2 need one. Open question 11.
- **§2.3, names and illustrative figures only** — the four situations are captured and confirmed, but the protagonists' names are invented, and each subject company's own margin is invented because no real subject exists. The peer statistics around them are real screening figures, standing in for a narrower peer group.

**Resolved, kept for the trail:**

- **§4.3, FR-28** — trend depth: five years, from measurement (2026-09-26).
- **§4.5, FR-38** — the hand-entered set is confirmed, not inferred (2026-09-26).
- **§6.2** — `43.210` confirmed out of MVP, intended rather than committed (2026-09-26).
- **Interface language** — Norwegian (bokmål) (2026-09-26).

---

*Assembled by `bmad-prd` on 2026-09-25 from the brief, the technical note, `docs/key-figures.md`, `docs/data-sources-brreg.md`, `analysis/output/industry-screening.md` and landscape research. Decision trail in `.memlog.md`.*
