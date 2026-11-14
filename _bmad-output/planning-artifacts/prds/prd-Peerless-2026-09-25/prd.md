---
title: Peerless
status: draft
created: 2026-09-25
updated: 2026-11-04
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

Where this PRD and one of those four disagree, **the other document wins and this one is wrong**. A disagreement is a defect, not a rule to lean on: it is fixed in the same pull request that made it (AGENTS.md, "A decision travels upstream"). Technical depth that surfaced during discovery sits in `addendum.md` as pointers into those documents, never as a second copy.

Structure: vocabulary is fixed in §3 Glossary and used verbatim everywhere after. Features are grouped in §4 with functional requirements nested and numbered globally FR-1 to FR-73 so epics can cite stable IDs. **An FR number is stable and never reused**, so a requirement added later sits at the end of its section out of numeric order rather than pushing existing numbers along. Every FR carries its stage on its heading line — `v1`, `Stage 2` or `Stage 3`, as the brief defines them — and an FR that spans stages states the split in its first bullet; §6 groups them. Assumptions are tagged `[ASSUMPTION]` inline and indexed in §12.

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

**Board members and co-owners — served as invited viewers, from stage 2.**

- Read management's figures against an external reference, often for the first time.

### 2.2 Non-Users (v1)

- **Investors and fund professionals.** Screening targets and benchmarking a portfolio start with the same question, but depend on screening and portfolio views that are out of scope (§5). Explicitly deferred, not served badly.
- **Anyone analysing a company outside a covered industry** — in v1, every industry but `62.100`. They see that company's own filed key figures and a plain statement that the industry is not yet covered — no peer comparison is offered (FR-4).
- **Credit and risk analysts.** Peerless answers "where are we losing money", not "will they pay". The incumbents serve the second question well and this product does not compete there.
- **Banks, insurers and entities outside the ordinary accounting layout.** Their filings do not fit the layout extraction depends on.

### 2.3 Key User Journeys

Captured from Meinich's own descriptions of real situations and confirmed by him. Two things are still mine and flagged as such: **the protagonists' names**, and **the illustrative figures**.

**How the figures are grounded.** Peer statistics are the real screening figures from `analysis/output/industry-screening.md` — operating margin quartiles for a comparability-filtered sample of 100 per industry — and company size is derived from that document's median revenue per employee rather than from a revenue median it does not contain. Two caveats travel with them. The screening notes that employee counts are today's while revenue is the latest filing, so size is *indicative only*. And the quartiles are **industry-wide**, standing in for a peer group that is by construction narrower: in a real analysis the peer median moves, which is the entire point of the product. The subject companies' own margins are invented, because no real subject exists yet.

The order below is narrative, not priority. Who matters most is stated in §2.1: advisers are the primary user and the likeliest payer.

`[ASSUMPTION]` The protagonists' names and each subject company's own operating margin are invented — no real subject company exists yet. The peer statistics around them are real. Indexed in §12.

**Stages.** A step that needs stage 2 or stage 3 is marked inline, and each journey ends with a line saying what of it runs in v1. UJ-1 and UJ-2 run in v1 up to their resolution; UJ-3 and UJ-4 are stage 2.

- **UJ-1. A company finds out that beating its industry is not the same as being good.**
  - **Persona + context:** Kari, finance lead at a twelve-person software company under `62.100`. She knows the margin — she produces it — and has never had anything to compare it against but last year's own.
  - **Entry state:** No account, laptop, arrived from a search. Twelve employees at the industry's median revenue per employee of 1 390 898 kr puts the company near 16.7 million in revenue.
  - **Path:** Enters her own organisation number → the company is identified with its filed key figures and a peer group → she reads the funnel counts and the per-peer inclusion reasons, and adjusts the group: two companies are resellers rather than product businesses, and she excludes them (FR-16, FR-17, FR-19) → walks the key figures looking for the largest gaps in kroner → reads the written explanation of them (FR-52).
  - **Climax:** Her 2.1 % operating margin is *above* the industry median of −3.2 %, which is the number she would have quoted. Against the favourable quartile of 9.1 % it is a gap of seven points — about **1.17 million kroner a year** at full convergence (7.0 pp × 16 714 286 kr = 1 170 000 kr, computed on the exact revenue). Beating a loss-making industry average told her nothing.
  - **Resolution (stage 2):** She wants it as a PDF for the board. Export needs an account, so she signs in with a magic link and keeps the analysis she already built (FR-40, FR-42, FR-49).
  - **Edge case:** Receivable days shows no peer aggregate — fewer than ten peers had a usable value — so the row keeps her own figure and says how many comparable values exist instead of comparing against a handful (FR-22).
  - **Weak ending, on purpose:** she intends to come back when the next filing is in, and **nothing will tell her it arrived.** Monitoring and alerting are deferred (§5), so the return trip rests on her remembering; the portfolio front page (FR-63, stage 2) only rewards her once she is already back. This is the clearest gap between what the journey wants and what v1 does.
  - **In v1:** everything up to and including the explanation, and the edge case. The resolution is stage 2: in v1 there is no account and no PDF, and what she built survives as its address (FR-69).

- **UJ-2. An adviser walks into a first meeting already knowing where the company is weakest.**
  - **Persona + context:** Anders, a consultant who sells improvement work to small companies. The company he is meeting on Thursday is a **prospect, not a client** — he has no engagement, no figures from them, and no relationship. Today he would prepare by reading their website.
  - **Entry state:** Not signed in, and he has no reason to be. The prospect is a nine-person software consultancy under `62.100`; at that industry's median revenue per employee of 1 390 898 kr, around 12.5 million in revenue.
  - **Path:** Enters the prospect's organisation number cold → reads the peer group and judges it himself, which is the thing he is uniquely able to do (§2.1) → goes straight to the largest kroner gaps → notes one or two numbers.
  - **Climax:** Operating margin −4.9 % against a peer median of −3.2 % and a favourable quartile of 9.1 % — a gap of 14.0 points, about **1.75 million kroner a year** at full convergence (14.0 pp × 12 518 082 kr = 1 752 531 kr, computed on the exact revenue). He opens the meeting with the prospect's own largest gap instead of a brochure.
  - **Resolution (stage 2):** He wins the work. Now he signs in, saves the analysis into a workspace for that client, and invites their managing director (FR-40, FR-43, FR-44).
  - **Edge case:** His next prospect is a bookkeeping firm under `69.202`, an industry not yet covered (stage 3). He gets its own filed key figures and a plain statement that the industry is not yet analysed — no peer group, no median, no kroner amount (FR-4).
  - **Scope boundary, recorded because the pull is real:** his next wish is "show me every firm in `62.100` with a weak margin". That is the screening feature §5 excludes, and on an open route it is the most direct way to harvest the register. Peerless stays at one organisation number at a time.
  - **In v1:** everything up to the resolution, and the edge case as written. Saving and inviting are stage 2; until then his preparation survives as the analysis's address (FR-69).

- **UJ-3. Someone else reads the analysis without being able to reach anything else.** *(stage 2)*
  - **Persona + context:** Solveig chairs the board of the company in UJ-2. She has never seen management's figures against an outside reference.
  - **Entry state:** An email invitation. No account yet, and no prior relationship with the product.
  - **Path:** Anders invites her by email into that one workspace, as a viewer (FR-44) → she signs in with a magic link → reads the saved analysis, the peer group and the kroner gaps, read-only.
  - **Climax:** She sees the same figures management sees, sourced from public filings rather than from management, and can trace any kroner amount back to the filed accounts (FR-60).
  - **Resolution:** She holds a viewer role in one workspace. Anders's other clients are unreachable to her, enforced in the database rather than by the interface remembering to filter (FR-45, FR-47).
  - **Edge case:** Anders mistypes her address. The invitation grants nothing until it is accepted from that mailbox, and it reaches exactly one workspace, as a viewer (FR-44).
  - **Deliberately not this:** a link anyone holding it can open. A link is a bearer token — forwarded, pasted into chat, leaked through logs — and it would carry unfiled figures with it unless deliberately excluded. Invitation by email covers the need (§5).
  - **Later, not now:** users who want a **valuation basis** — investors, M&A and transaction advisers — are a v2 audience. v1 values a gap at a user-set EV/EBIT multiple and stops; a full valuation tool is out of scope (§5, §2.2).
  - **In v1:** none of it. Invitation, magic link, workspaces and roles are all stage 2; v1 has no accounts.

- **UJ-4. An owner asks whether this year is going better, before anything is filed.** *(stage 2; peer context stage 3)*
  - **Persona + context:** Tore owns a bookkeeping firm under `69.202` — another of Anders's clients — and closes his books monthly. Anders's work started after a filed year at 2.5 % operating margin. Seven months in, Tore wants to know whether the business has moved in a positive direction, long before the filing exists.
  - **Entry state:** Signed in, owner of his own workspace.
  - **Path:** Enters year-to-date figures and states that they cover **seven months** → enters the same seven months of last year, which is what makes the comparison honest → sees ratios only, every one labelled *Egne tall – ikke levert* (FR-33, FR-67).
  - **Climax:** Operating margin 6.4 % over seven months against **4.8 % for the same seven months last year** — genuinely up, and up on a like-for-like period. His own last filed full year, 2.5 %, and the peers' latest full year median of 9.7 % sit alongside as context, labelled *"hele år, ikke samme periode"*: he is improving and still short of the typical peer, and both facts are legible at once.
  - **Resolution:** He has a direction, not a projection. Nothing is annualised, so nothing is forecast — and when the filing arrives it takes precedence and his entries are kept as history (FR-36).
  - **Edge case:** He has no figures for the same period last year. The year-to-date ratios are shown with no primary comparison, rather than being measured against a full year as though the periods matched (FR-67).
  - **What it deliberately will not do:** no kroner amount is produced from a partial period, because a kroner translation needs a twelve-month revenue base; and no adjustment is made for seasonality or anything else external. In `69.202` that plausibly matters: an accounting firm's work clusters around the annual-accounts and tax deadlines, so a January-to-May margin is unlikely to be its year. The project has not measured this — it is an argument for the like-for-like comparison, not a finding. Comparing against the owner's own same months is what contains the problem; the product states the limit rather than correcting it.
  - **In v1:** none of it. Signing in and own figures are stage 2, and the peer context needs `69.202`, which is stage 3. Stage 2 alone gives Tore the like-for-like comparison against his own months, without the peer median.

## 3. Glossary

Downstream workflows and readers use these terms exactly. Introducing a synonym anywhere is a discipline violation. Register field names are the register's own and are never translated — including two the register misspells.

**Core objects**

- **Organisation number** (`organisasjonsnummer`) — the nine-digit register key. Every lookup resolves on it — the search field takes a name or a number, and a chosen result resolves on the number (FR-1) — and it is the **only** basis for matching a company across filings and years; names change while the number does not.
- **Subject** — the company being analysed. Exactly one per analysis. Must be in a covered industry to receive a peer group (FR-3); outside one it gets its own key figures only (FR-4).
- **Front page** — the entry page: a description, the search field (name or organisation number), and from stage 3 industry overviews (FR-61).
- **Industry overview** — an aggregate picture of one covered industry. Never names a company. Stage 3.
- **Portfolio** — a signed-in user's front page, listing every company they follow — that is, every company with a saved analysis in one of their workspaces (FR-63). Stage 2.
- **Peer** — a company included in the subject's peer group. Named and visible, never anonymised.
- **Peer group** — the set of peers assembled for a subject by the funnel (§4.2). Visible, adjustable, and never used for an aggregate below the minimum group size. Every aggregate uses the group the funnel leaves after stages 4 and 5, less the user's exclusions.
- **Candidate pool** — the companies left after funnel stages 1–3, before the fingerprint. An exclusion in the URL is checked against the pool, and the labelled set's frame and the document run read it; aggregates never do.
- **Covered industry** — an industry Peerless offers peer analysis for. An industry becomes covered only once its peer selection has been measured against a labelled set **and** the filings of the companies it is offered with are extracted and reconciled. In v1 `62.100` is covered for the companies whose document figures are in the seed (FR-3). Unmeasured industries are not offered.
- **Workspace** — the unit of saved work, typically one per company. Has one **owner** and any number of invited **viewers**. Workspaces, owners and viewers arrive in stage 2.
- **Owner** — creates a workspace, owns it, writes unfiled figures, invites viewers.
- **Viewer** — invited read-only member of a workspace: a board member, co-owner, or an adviser's client.
- **Adviser** — *not a role.* A user with many workspaces. There is no adviser role in the system.
- **Anonymous session** — a visitor without an account. Holds a real `auth.uid()` via Supabase anonymous sign-in, so one access model covers everyone. May read public figures and nothing else. Stage 2; in v1 a visitor has no identity at all and nothing is stored.
- **Open route** — the no-account path: lookup, peer group, adjustment, kroner gaps. In v1 it is the only route; rate-limited per IP from v1, and per session with a CAPTCHA from stage 2 (FR-6).

**The funnel**

- **Coarse filter** — stage 1, rules. Industry code and size band.
- **Comparability filter** — stage 2, rules. Requires subject and candidate to match on currency (`valuta`), accounting framework (`regnskapsregler`), `smaaForetak`, `avviklingsregnskap`, financial period and `regnskapstype`.
- **Segmentation** — stage 3, rules. Legal form, and geography where the industry calls for it. Size is settled by the coarse filter alone (FR-9).
- **Business-model fingerprint** — stage 4, rules. Reads *what kind* of business a company is from its own reconciled accounts, in five categories: cost-of-goods band, personnel-cost band, asset-intensity band, inventory yes/no and capitalised intangibles yes/no. A fixed rule turns the categories into a business type. Separates a reseller from a product company from a consultancy even when all three call themselves "Programvareutvikling". Band edges and the rule are in the technical note, "Rules fixed by the stories" (FR-10).
- **Business type** — one of `produkt`, `konsulent`, `forhandler` or `annet`, defined once and shared by the fingerprint (stage 4) and classification (stage 5). A company whose type depends on a category its accounts leave unknown is **undetermined**: it has no type, is never excluded for it, and is counted as undetermined rather than `annet`.
- **Classification** — stage 5, model. Gives each AS one business type, or the abstention `uklart`, from company name, secondary industry codes, statement of purpose and business description; the funnel compares the candidate's type with the subject's by rule. Answers only in fixed categories.
- **Unclassified** — a company with nothing useful to classify on. Stored as unclassified, **never guessed at**, and still eligible as a peer through stages 1–4.
- **Match basis** — which signals took part in keeping a peer in the group, one of four tiers: *description and accounts* / *accounts alone* / *description alone* / *industry and size alone*. A signal counts only when it gives a business type for both the subject and the peer (FR-16).
- **Inclusion reason** — the short statement of why a peer was included. Generated deterministically from shared profile fields. **Rules-written, never model-written.**
- **Coarse band** — the banded form in which a measure that is *also* benchmarked may enter selection. Today: cost of goods share and personnel cost share. Selecting on exact values would drive that gap to zero by construction.

**Figures and the benchmark**

- **Key figure** — one of the 14 numbered measures defined in `docs/key-figures.md`, plus the unnumbered cash share. That document is authoritative for every formula.
- **Filed figures** — figures from the register: the structured key-figures API, or OCR of the filed document, reconciled.
- **Unfiled figures** — owner-entered current-year figures, before official filing. Stage 2. Always labelled *Egne tall – ikke levert* ("own figures, not filed"), never merged with filed figures, never in an aggregate. Never labelled "unaudited": many small AS have no auditor, so their filed accounts are unaudited too, and the word would wrongly suggest that filed figures are audited.
- **API-sourced** / **OCR-sourced** — a key figure is OCR-sourced if *any* component is. Three of the 14 are API-only: operating margin, return on assets, equity ratio.
- **Peer group as a whole** (*peer-gruppen samlet*) — the revenue-weighted aggregate of a common peer set, the reference the margin decomposition is measured against. Defined in `docs/key-figures.md`; distinct from the median and the favourable quartile, and never a target.
- **Median** — the peer median for a key figure. Shown for context and as a marker on the closable-share control; never the target of the kroner arithmetic.
- **Favourable quartile** — the upper quartile where higher is better, the lower quartile where lower is better. Direction-aware by definition, so a figure with no declared direction has none.
- **Percentile** — the share of peers the subject does better than, ties counted as half: `(peers worse + 0.5 × peers equal) / peers × 100`, in the favourable direction.
- **Size band** — the range of company size a candidate must fall within to be eligible as a peer: `sumDriftsinntekter` **from the same filing as the figures being compared**, by default 0.5 to 2 times the subject's, loosenable one fixed step at a time to 0.33 to 3 times and then 0.25 to 4 times (FR-18). Revenue, not assets and not employees; and the filing's own figure, never today's register.
- **Minimum group size** — 10 peers, counted **per key figure** after companies with an undefined value for that figure are excluded. Below it, no aggregate is shown for that figure. A quality threshold, not a confidentiality control.
- **Undefined** — a key figure that cannot be computed for a company because a denominator is zero or negative (a derived denominator of 5 kr or less counts as not positive, FR-23), or a component is missing and cannot be derived from a stated total. **Undefined is not zero.** The company leaves that figure's distribution and the excluded count is shown.
- **Data quality flag** — a per-filing status, `reconciled` or `failed_reconciliation`: the status of the filing's current-year column, derived **only** from the reconciliation rules, never from OCR confidence (FR-57). A generic engine reported mean confidence 0.974 while misreading several figures; confidence is not a signal.
- **Reconciliation** — two rules, neither exact equality and never collapsed into one. *Within* a document: five checks (c1–c5) on stated subtotals against their components, each within a tight absolute bound of a few kroner, because the register prints whole kroner rounded from øre. *Between* document and API: max(a few kroner, a very small proportion of the register's figure); the proportional part admits a millions reporter's rounding as the register states it, and stays tiny because documents in scaled reporting units are refused at reading. Decided **per column**, not per figure (FR-58). Values in `docs/data-sources-brreg.md`.
- **Withdrawn company** — one the register answers `410 Gone` for. Deleted from stored data (FR-66).
- **Dissolved company** — one the register still answers for, with a `slettedato`. Kept, with its date stored; it is not withdrawn (FR-66).

**Money**

- **Closable share** (*s*) — the user-set fraction, 0 to 1, of each gap assumed closable. 1 means full convergence with the favourable quartile.
- **Target** (*T*) — the reference value a gap is measured to. **Always the favourable quartile**, at every setting of the closable share; the closable share scales the gap to it rather than moving it.
- **Annual profit uplift** — the kroner value of the operating margin gap: `(T − r) × sumDriftsinntekter × s`.
- **Working capital released** — the kroner value of the receivable-days and payable-days gaps, and **only those two**. They do not overlap: one is an asset, the other a liability.
- **Capital released from operating assets** — the kroner value of the operating-asset-turnover gap, reported as its own amount and **never added to working capital released**. Its capital base, `sumEiendeler − bankinnskudd`, already contains `kundefordringer`, so summing the two would count the same receivable reduction twice (FR-30).
- **Margin decomposition** — the subject's operating margin difference against the peer group as a whole, in kroner, split into four bars: cost of goods, personnel, other operating, and depreciation and other items as the residual. The bars sum exactly to the difference. It is how the cost shares are expressed in kroner — they have no kroner amount of their own — and it is **never scaled by the closable share and never added to annual profit uplift** (FR-30). Defined in `docs/key-figures.md`.
- **EV/EBIT multiple** — a user-set multiple applied to annual profit uplift to give implied enterprise value. **No default**: until the user enters one, no implied enterprise value is shown. EBIT, not EBITDA, because `driftsresultat` is API-sourced for every company and traces directly to the filing.
- **Øre** — the integer unit every monetary value is stored and computed in. Money is never a float.

**Register fields** — the register's own names, never translated. Two are misspelled in the API; do not "fix" either.

`sumDriftsinntekter` total operating revenue · `driftsresultat` operating profit (EBIT) · `sumEiendeler` total assets · `sumEgenkapital` total equity · `salgsinntekt` sales revenue · `varekostnad` cost of goods sold · `lonnskostnad` personnel costs · `avskrivninger` depreciation and amortisation · `nedskrivninger` impairment · `annenDriftskostnad` other operating expenses · `kundefordringer` trade receivables · `bankinnskudd` bank deposits and cash · `leverandorgjeld` trade payables · `aarsverk` full-time equivalents, one decimal, from the notes · `regnskapsperiode` accounting period · `regnskapstype` accounts type · `smaaForetak` small-enterprise flag · `avviklingsregnskap` winding-up accounts · `regnskapsregler` accounting framework · `valuta` currency · **`sumInnskuttEgenkaptial`** total paid-in equity *(misspelled in the API)* · **`regnkapsprinsipper`** the object holding `smaaForetak` and `regnskapsregler` *(misspelled in the API)* · `naeringskode1.kode` primary industry code — the field to filter on, since the search API's `naeringskode` filter also matches secondary and tertiary codes.

## 4. Features

Requirements are numbered globally FR-1 to FR-73. `docs/key-figures.md` is authoritative for every formula; where an FR names one it is citing that document, not restating it.

### 4.1 Company lookup and eligibility

**Description.** The entire setup is one search field: a company name or an organisation number. No upload, no configuration, no template, no account. The product identifies the company, decides whether it can be analysed, and either produces a full analysis or says plainly why it cannot. Realises UJ-1, UJ-2.

Honesty at this boundary is load-bearing: a company outside a covered industry gets its own filed figures and a statement that its industry is not yet covered, rather than a comparison against a group nobody has checked.

#### FR-1: Lookup by name or organisation number · v1

A visitor, with or without an account, can search by company name or organisation number in one field and reach an analysis. Realises UJ-1, UJ-2.

**Consequences (testable):**
- One field accepts either. Input made only of digits (spaces ignored) is always read as an organisation number: nine digits that pass the modulus-11 check are matched exactly, and any other length or a failed check gets its own message. Anything else is a fuzzy match on company name, so a company whose name is only digits, such as "1881", cannot be found by name.
- A name search needs at least 2 characters and returns at most 8 results, each with name, organisation number, primary industry and municipality, so two companies with similar names can be told apart. It matches companies by name, never by financial criteria (§5, screening).
- The search runs against the companies in Peerless's own database (the seed, FR-73), never against the register live.
- Choosing a result resolves on organisation number, and companies are matched across filings and years on organisation number only; a name match never identifies a company.
- A valid organisation number for a company in a covered industry returns a complete analysis; a malformed number, or a search with no match, returns a clear message, not an empty analysis.

#### FR-2: Company identification · v1

The subject is shown with its registered name, organisation number, primary industry code and the accounting year being analysed.

**Consequences (testable):**
- The displayed year is the year of the returned filing, verified against `regnskapsperiode` or the filing `id` — never the year that was requested. The `år` request parameter is silently ignored by the register and is never trusted.
- A company whose registered name has changed since an older filing still resolves to one company.

#### FR-3: Covered-industry gate · v1

The subject must be in a covered industry to receive a peer analysis.

**Consequences (testable):**
- **Stage split:** v1 covers `62.100` only. `69.202` and `43.210` are stage 3, each added only once its own measurement exists.
- An industry is offered only once its peer selection has been measured against a labelled set for that industry **and** the filings of the companies it is offered with are extracted and reconciled.
- **In v1, `62.100` counts as covered for the companies whose document figures are in the seed** (`seed/allow-list.json`: the demo companies, their peers and the OCR reference set), with its peer selection measured against the labelled set (FR-70, SM-1). The labelled set's own documents and fingerprints are read and stored locally for that measurement and are not part of the committed seed.
- **Every other `62.100` company** gets funnel stages 1–3 and classification, a peer group, and its API key figures compared as normal; its document-based figures read "Ikke i demodataene" (FR-73). It is never shown as uncovered.
- Reading every document in the industry is not a condition of coverage. The run over the rest of `62.100` is not part of v1 and needs no new code: `pnpm ingest --documents <list>` performs it (FR-28, FR-59).
- **"Measured" means a referenced report exists.** Coverage is declared in the committed file `seed/coverage.json`; an entry is marked measured only by referencing its measurement report in `analysis/output/` by path and checksum, and the seed loader refuses a measured entry whose report is missing or does not match. A flag alone never counts. During v1 development `62.100` is declared with measured false so the app can be built against it; v1 is not complete until it is measured.
- A subject whose `naeringskode1.kode` is outside the covered set never receives a peer group.
- Industry codes are SN2025. An SN2007 code returns nothing rather than a wrong match.

#### FR-4: Uncovered industry behaviour · v1

A company outside a covered industry is shown the key figures the register's own latest-year summary supports, and a plain statement that its industry is not yet covered. Realises UJ-2 (edge).

**Consequences (testable):**
- In v1 this is every company outside `62.100`, including `69.202` and `43.210` until stage 3 covers them.
- Only the **API-sourced** figures are shown — operating margin, return on assets and equity ratio — computed from the key figures API's latest year.
- The twelve figures that need a component from the filed document are **not** shown, because extraction never runs during a user request (FR-59) and nothing has been pre-warmed for an uncovered industry.
- No peer group, no median, no quartile, no percentile and no kroner amount is shown for an uncovered subject. Nothing here is a comparison, so FR-24's same-basis rule is not engaged.
- The statement names the industry and says coverage is not yet available — it does not imply the company is ineligible or unavailable.
- **In v1 this rests on stored data**, because nothing calls the register at runtime (FR-73). It is demonstrated by demo company C, a `69.202` bookkeeping firm whose register data is in the seed. An organisation number that is not in Peerless's database gets *"Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi {industry}."* followed by links to demo companies A and B — never an empty analysis and never a live register call. `{industry}` is built from the register's own description of each covered code (in v1 "dataprogrammeringstjenester (62.100)"), never written as a literal (Story 1.5b, human decision 2026-10-15). This page and the invalid-number page answer HTTP 404 (Story 1.6b, human decision 2026-10-16). A live register lookup for such numbers may be considered in stage 2.

#### FR-5: User-entered subject description · Stage 2

A user can optionally describe the subject in free text, and that description takes precedence over the register's own for classification of the subject.

**Consequences (testable):**
- **Stage 2, because it needs a live model call at request time** — v1 has no model call reachable from a request (FR-73). In v1 the subject is classified from the register's description, like every other company.
- The text is sent to the model only to classify, and the model can answer only with a fixed category, so text written to steer the model cannot change more than which category it lands in.
- For an anonymous session the description is used for that analysis and not stored.
- For a signed-in user the description belongs to the workspace.
- The description never affects any peer's classification, only the subject's.
- This is one of exactly two model calls a user request can trigger, the other being explanation regeneration by a signed-in user (FR-52). It runs once per entered text, the result is cached against that text, and it is rate-limited with the open route (FR-6). Every other classification happens at ingestion (FR-20).

#### FR-6: Open-route rate limiting · v1

The no-account route is rate-limited, so that harvesting the register through it is slowed in v1 and prevented before any public deployment.

**Consequences (testable):**
- **Stage split:** the per-IP limit is v1, and part of v1's security together with input validation, server-side secrets and storing no user data. The per-session limit and the CAPTCHA arrive in stage 2 with anonymous sign-in, since v1 has no sessions to limit and no sign-in to guard.
- Requests are limited per IP (v1) and per session (stage 2). In v1 the per-IP counter is held in memory in the single local server process and no IP is stored; persistent rate limiting is a gate before any public deployment.
- In v1 there are two budgets per client address, one for analysis pages and one for search (`src/rate-limit/budgets.ts`), keyed on a salted hash.
- **v1's limit does not stop harvesting.** Locally the client address comes from `X-Forwarded-For`, which a client can rotate on every request, so the per-IP limit only slows an honest client. Accepted for local v1 (Epic 1 retrospective S11, Meinich 2026-10-16); a limit that cannot be bypassed this way is part of the deployment gate (technical note, AD-10).
- Anonymous sign-in is protected by CAPTCHA (stage 2).
- Exceeding the limit returns a refusal, not a degraded or partial analysis.

**Notes.** `[NOTE FOR PM]` The brief promises "under a minute" to first insight. That is a product promise no FR currently measures. Consider whether it belongs in §7 as a metric.

### 4.2 Peer group construction and adjustment

**Description.** A five-stage funnel narrows hundreds of thousands of companies to a peer group, four stages by rules and the fifth by model. The user sees how many companies survive each stage, why each peer is in the group, and what its match rests on — and can exclude a peer or loosen a criterion, with everything recomputing immediately. Realises UJ-1, UJ-2.

This is the feature the product lives or dies on. A benchmark the user cannot interrogate is a benchmark they will not trust, so the group is visible rather than hidden, and its quality is measured rather than asserted (§8).

#### FR-7: Stage 1 — coarse filter (rules) · v1

Candidates are reduced by industry code and size band.

**Consequences (testable):**
- Filtering uses `naeringskode1.kode`. The register's `naeringskode` filter also matches secondary and tertiary codes and is never used where the primary industry is meant.
- The size band is `sumDriftsinntekter` from the same filing as the figures being compared, by default 0.5 to 2 times the subject's, widened only in FR-18's fixed steps.
- Size is revenue, never `sumEiendeler` and never the register's employee count — that count is today's figure, not the accounting year's (§5).
- A subject whose benchmark filing states zero, negative or no `sumDriftsinntekter` has no size band, so its peer group is empty. The page keeps the covered structure, the header reads "0 sammenlignbare", and the Peers tab says why: "Peerless finner sammenlignbare selskaper ut fra omsetning, og regnskapet for {år} har ingen positiv omsetning å sammenligne med." (Story 1.7, human decision 2026-10-16 after review finding 6.) Revenue that is not stated but derivable still gives no band (`docs/key-figures.md`); the copy for that case is Story 2.9's.

#### FR-8: Stage 2 — comparability filter (rules) · v1

A candidate must match the subject on currency (`valuta`), accounting framework (`regnskapsregler`), `smaaForetak`, `avviklingsregnskap`, financial period and `regnskapstype`.

**Consequences (testable):**
- A candidate failing any comparability field cannot appear in the peer group by any later stage.
- **All six fields are hard exclusions, and none of them is loosenable.** FR-18's loosening reaches the size band and segmentation only; no user action can admit a candidate that failed comparability.
- Every one of the six fields must be stated on both sides: a missing value on the subject or the candidate matches nothing. A `valuta` that is not an ISO 4217 code matches nothing, not even itself (`docs/key-figures.md`).
- Only calendar-year filings pass.
- A subject whose own benchmark filing is not a calendar year gets an empty peer group, and the Peers tab says why: "Peerless sammenligner foreløpig bare selskaper med kalenderår som regnskapsår." (Story 1.7, human decision 2026-10-16.)
- `smaaForetak` and `regnskapsregler` are read from the object the API misspells as `regnkapsprinsipper`.

#### FR-9: Stage 3 — segmentation (rules) · v1

Candidates are segmented by legal form, and by geography where the industry calls for it. Size is settled by the coarse filter alone.

**Consequences (testable):**
- The coarse filter's size band (FR-7) is the only size step; this stage does not segment by size again, so the two stages cannot disagree about what size means.
- Legal form is the register's `organisasjonsform`. v1 covers `AS` only, so this stage excludes every other form. A subject that is not an AS gets its own state, *"Peerless sammenligner foreløpig bare aksjeselskaper"*, with its own API figures and no peer group.
- Geography is not used for `62.100`. It is applied only where a later industry calls for it, and where it is applied the criterion is named to the user so it can be seen and loosened (FR-15, FR-18).
- Each criterion this stage applies is reported in the funnel counts separately, so a group that collapsed here is distinguishable from one that collapsed at comparability.

#### FR-10: Stage 4 — business-model fingerprint (rules) · v1

Candidates are grouped by what kind of business their own accounts say they are, in five categories — cost-of-goods band, personnel-cost band, asset-intensity band, whether they carry inventory, and whether they carry capitalised intangibles — and a fixed rule turns the categories into a business type (`produkt`, `konsulent`, `forhandler`, `annet`). Band edges, the rule and the type definitions were fixed before any share was seen (Story 2.5, Meinich 2026-11-01) and are in the technical note, "Rules fixed by the stories"; they are not restated here.

**Consequences (testable):**
- A reseller, a product company and a consultancy separate here even when all three describe themselves as "Programvareutvikling".
- **A candidate whose fingerprint gives another type than the subject's is removed, unless its text gives the subject's type; then it is kept and flagged (FR-14).** A candidate with no fingerprint or no type stays, and a subject with no fingerprint or no type keeps the whole candidate pool, so stage 4's count equals stage 3's.
- **A fingerprint needs a reconciled current-year column with positive revenue.** A company without one has no fingerprint for that year and is never excluded for lacking one.
- **An empty line is not zero.** It lies in an interval bounded by the stated subtotals, and a category is known only if its whole interval gives one answer. A remainder below −5 kr (beyond the register's rounding) gives no fingerprint, and so does a column whose four main cost lines are read and fall short of sum kostnader by more than 5 kr, since a read line is then misread.
- **Undetermined is a result, not a gap to fill.** When an unknown category decides the rule, the company gets no type and is counted as undetermined, never as `annet`. Measured on the 400 fingerprinted companies of the Story 2.1b set after the cost lines were read (2026-11-07): 165 (41 %) are undetermined at their newest year, so stage 4 removes less than it could.
- **Known weakness:** capitalised intangibles include the deferred tax asset and goodwill, so a consultancy holding either can be typed `produkt`; and a product company that expenses its development is typed `konsulent`. Story 2.5b stores the four printed parts of the intangibles — research and development, concessions and patents, goodwill, the deferred tax asset — as figures of their own, which the fingerprint does not read, so that Story 5.2 can measure a rule counting only capitalised own development, rather than the rule being tuned now.
- Applies to every company with a reconciled document column. With the licence gate closed (FR-73), the committed seed holds fingerprints for the allow-listed companies only.

#### FR-11: Stage 5 — classification (model) · v1

Every AS in a covered industry is classified in the batch, never at request time, from four register fields only: name, secondary industry codes, `vedtektsfestet_formaal` and `aktivitet`. The model answers with exactly one of the business types `produkt`, `konsulent`, `forhandler` and `annet` (the same set as FR-10), or the abstention `uklart`. Stage 5 compares a candidate's stored type with the subject's, combined with the fingerprint by the rule in the technical note.

**Consequences (testable):**
- The answer set is the response schema's enum, generated from the business types plus `uklart`; the model returns no free text at this stage (`test/classify/request.test.ts` "schema is generated from BUSINESS_TYPES").
- `uklart` is not a fifth type: it is stored as `classified` with no type, counted apart in `run.step2`, and removes no candidate (FR-12) (`test/classify/run.test.ts` "uklart is stored without a type and counted apart"; `test/db/classification.test.ts` "holds uklart as classified with no type").
- An answer outside the set, or of any other shape, is stored as `failed` with no type, never coerced into a category, and is counted with its reason in `run.step2`, whose run exits 1 (`test/classify/request.test.ts` "refuses %s"; `test/classify/run.test.ts` "answer outside the set is failed, not coerced").
- The database refuses a type outside the set, and a type on a row that is not `classified` (`test/db/classification.test.ts` "refuses a type outside the set, and a type on a row that is not classified").
- The seed is not exported while a covered AS has a `failed` or `pending` row (`test/db/classification.test.ts` "refuses while a row is %s").
- The model performs no arithmetic here or anywhere (FR-53).
- **Stage 5 stays in the funnel only under SM-1's decision rule (§9).** Story 5.2 compares *fingerprint alone* with *fingerprint and text* on all labelled pairs, `usikker` left out: the text must raise precision by at least 3 percentage points and lower recall by no more than 3. If it does not, the text signal is switched off in v1: the group is decided by the fingerprint alone, no peer is flagged (FR-14), and no match basis rests on the description, so every peer is *accounts alone* or *industry and size alone* (FR-16). The blind pairs are reported on their own as well.

#### FR-12: Unclassified companies remain eligible · v1

A company with nothing useful to classify on is stored as unclassified — never guessed at — and remains eligible as a peer through stages 1 to 4.

**Consequences (testable):**
- An unclassified company is never assigned a category by inference.
- An unclassified peer, like one the model answered `uklart`, gives no text signal, so its match basis is *accounts alone* or *industry and size alone* (FR-16).

#### FR-13: Never select on a measure that is benchmarked · v1

No measure the product benchmarks may be used to select peers at its exact value.

**Consequences (testable):**
- Selection uses no margin, return or productivity measure at all.
- Cost of goods share and personnel cost share are both business-model markers and benchmarked ratios; where they enter selection they enter **only in coarse bands**, and are benchmarked within their band.
- **The bands are fixed; whether each one earns its place is measured later.** The band edges were set before any share was seen (Story 2.5, Meinich 2026-11-01). Whether each band is kept or dropped is decided against the labelled set in Story 5.2 (§11, question 12).
- A test asserts that the within-band spread of each banded figure is non-trivial — i.e. the gap has not been driven to zero by construction. It is measured over every fingerprinted company of the industry, each at its newest fingerprinted year, not per peer group: in every cost-of-goods and personnel-cost band with at least 10 read shares, the interquartile range is at least 2 percentage points (`test/fingerprint-spread.test.ts`, threshold committed before the script ran). Measured 2026-11-07 for `62.100` on the 420 companies fingerprinted before the labelled set's document run, not the whole industry (FR-28): all six bands pass, the lowest at 5.0 pp (`analysis/output/fingerprint-spread-62100.md`). It has not been rerun on the labelled set's fingerprints.
- A band that fails goes to the product owner for a decision; nothing is dropped automatically.
- **The test runs per industry, and passing in one industry is not passing.** Where a band and a performance measure correlate, banding quietly selects on performance; `43.210` (stage 3) is the case where cost of goods share and margin are expected to move together, so a test aggregated across industries could pass while failing exactly where it matters. In v1 it runs for `62.100`, and it runs again for each industry stage 3 adds.

#### FR-14: Disagreement is flagged, not resolved · v1

Where the text and the fingerprint disagree about a candidate, the candidate is flagged rather than resolved by either signal.

**Consequences (testable):**
- A flagged candidate stays in the group and carries its flag, shown next to its match basis (FR-16).
- Neither signal overrides the other, and the model is never asked to adjudicate the disagreement — that would be the model deciding, not classifying.
- The number of flagged candidates is reported with the funnel counts (FR-15).
- Flagged candidates are identifiable in the labelled-set measurement, so their precision can be reported apart from the rest (SM-1).

#### FR-15: Visible funnel counts · v1

The user sees how many companies remain after each stage. Realises UJ-1, UJ-2.

**Consequences (testable):**
- Each of the five stages reports its surviving count.
- The counts are shown whether or not the group is large enough to produce aggregates.

#### FR-16: Per-peer inclusion reason and match basis · v1

Each peer carries a short statement of why it was included, and a flag for what its match rests on.

**Consequences (testable):**
- The inclusion reason is generated deterministically from the profile fields the peer shares with the subject. **The model classifies; it does not write the justification.**
- **The match basis names the signals that took part in keeping the peer in the group.** A signal counts only when it gives a business type for both the subject and the peer, exactly when `signals()` in `src/engine/peers.ts` returns a value rather than null for it. It is exactly one of four, in this order:
  - fingerprint and text → *description and accounts* ("Beskrivelse og regnskap");
  - fingerprint only → *accounts alone* ("Kun regnskap");
  - text only → *description alone* ("Kun beskrivelse");
  - neither → *industry and size alone* ("Kun bransje og størrelse").
- A fingerprint with no business type (undetermined, FR-10), the model's abstention `uklart`, an unclassified company and a subject with no type of its own give no signal, and so no basis.
- A flagged peer (FR-14) has both signals, so its basis is *description and accounts*, with the tag "Usikker klassifisering" beside it.
- The two bases that rest on a classification, *description and accounts* and *description alone*, carry the AI marking in the interface.
- The basis depends on the subject, so it is computed in the request and never stored, like the flag.
- Where the match rests on industry and size alone, the product says so rather than presenting a guess as a judgement.
- Peers are shown by name.


#### FR-17: Exclude a peer · v1

The user can exclude a company from the peer group. Realises UJ-1.

**Consequences (testable):**
- An exclusion applies to that analysis only and never changes stored register data.
- **Stage split:** in v1 the exclusion lives in the URL (FR-69); saving it with the analysis for a signed-in user is stage 2.
- Every aggregate, percentile and kroner amount recomputes (FR-19), and a figure can fall below the minimum group size as a result (FR-22).
- An excluded peer is shown as excluded rather than vanishing, so the user can put it back.
- At most 20 peers can be excluded in one analysis; a link with more keeps 20 and shows the invalid-settings notice (FR-69).

#### FR-18: Loosen a criterion · v1

The user can widen the size band or a segmentation criterion when the group is too small. Comparability is never loosenable.

**Consequences (testable):**
- Loosening reaches the size band (FR-7, FR-9) and segmentation by legal form or geography (FR-9). It never reaches the six comparability fields (FR-8).
- The size band widens in fixed steps, one at a time, each a separate user action: 0.5–2× the subject's `sumDriftsinntekter` (default), then 0.33–3×, then 0.25–4×. Nothing wider is offered.
- No loosening can admit a candidate that failed comparability, and a test asserts that.
- **Stage split:** v1 loosens the size band only. Loosening segmentation by legal form or geography is stage 3, when an industry that applies geography or admits more than `AS` is covered. Comparability is never offered in any stage.
- A loosened criterion is shown as loosened, with the funnel counts updated (FR-15), so a larger group never looks like the default one.
- Loosening recomputes everything immediately (FR-19), and a figure can cross the minimum group size in either direction as a result (FR-22).

#### FR-19: Immediate recompute · v1

Any change to the peer group recomputes every key figure, aggregate, percentile and kroner amount immediately. Realises UJ-1.

**Consequences (testable):**
- After an exclusion, aggregates reflect the reduced group with no stale value anywhere on screen.
- A change that drops a figure below the minimum group size causes that figure to stop showing an aggregate (FR-22).

#### FR-20: Peer group assembly latency · v1

Peer group assembly returns in under one second.

**Consequences (testable):**
- Assembly reads stored key figures and profiles only.
- No document is fetched or OCR'd during a user request, for the subject or for any peer (FR-59), and no peer is classified.
- **In v1 no model call can be triggered by a user request** (FR-73). Stage 2 adds exactly two: classifying a user-entered subject description (FR-5), and a signed-in user regenerating the explanation for an adjusted peer group (FR-52). Both are rate-limited. Regeneration additionally requires an account; description classification is available on the open route under FR-6's limits.
- Peer group assembly itself triggers neither.

#### FR-70: The labelled set · v1

A labelled set of genuine comparables is built to a stated sampling frame, beginning in week 1, and is what SM-1 is measured against.

**Consequences (testable):**
- **30 subject companies in `62.100`**, and **30 candidates for each**, drawn **at random from the subject's size band** rather than from the funnel's output. About **900 judgements** in total — the effort budgeted when three industries were planned, now spent on the one v1 covers. Each industry stage 3 adds needs its own set before it is offered (FR-3).
- Drawing candidates from the size band and not from the funnel is what gives recall a denominator: a candidate the funnel never proposed can still be labelled a genuine comparable, and missing it counts against recall.
- The labelling rubric is written and dated **before** the fingerprint's feature list is fixed, so the criterion cannot be tuned to the method after the fact.
- A **subsample is labelled from the description and website only, blind to the accounts**, so at least part of the set is not an expression of the fingerprint's own criterion.
- **Who labels.** The blind subsample is labelled by a person. The other pairs are labelled through each company's main revenue model, and each pair's label is computed from the two; in v1 that revenue model is filled in by a ChatGPT model and checked and accepted by a person, so for those pairs, the text layer (stage 5) is one AI's classification measured against another's, and the result says so. A person's own first round of those pairs may be reported beside it as a stricter reading, never as the measure.
- **A second labeller and Cohen's κ are stage 2.** v1 has no second labeller and reports no κ, and the result states that shortfall: nothing in v1 checks one labeller against another. In stage 2 a second person judges about 50 pairs and κ is reported with them.
- **Fallback if the set comes in small:** the description cohorts pooled rather than reported separately. The fallback is stated in advance so a thin set is a smaller claim rather than a silent one.
- Every count above is reported as achieved, not as planned, and any shortfall is stated with the result.

#### FR-68: Embeddings, computed for measurement only · v1

A vector representation of each company's description is computed at ingestion and used as one layer in the peer-selection measurement. It is not user-facing in v1.

**Consequences (testable):**
- **v1, and the one v1 item that may be cut** — last, after stage 3 and stage 2 (§6). It is measurement work, not product, and SM-1 stands without it.
- Embeddings are computed in the batch job. Nothing embeds during a user request.
- The layer appears in SM-1's ablation as a step of its own, so the measurement can report what it adds over the rules and over model classification.
- **No peer reaches a user's group by embedding similarity in v1.** The layer changes what is measured, not what is shown.
- It becomes user-facing only if it measurably beats model classification, and that is a post-v1 decision this PRD does not take.
- **The layer is optional.** SM-1 reports three layers if embeddings are not built and four if they are, so the measurement stands either way and embeddings can be cut without taking a success metric with them (§6).

### 4.3 Key figures and the benchmark display

**Description.** Fourteen numbered measures and cash share, across margin, cost structure, working capital, capital efficiency and productivity, with revenue growth for context. For each, the subject's own value, the peer median, the favourable quartile and a percentile marker. Strengths are shown as clearly as weaknesses — a company better capitalised than its peers should know that, because it changes what it can afford to do about everything else. Realises UJ-1, UJ-2.

**Formulas are not restated here.** `docs/key-figures.md` defines all 14 numbered figures plus cash share, and the engine implements exactly those definitions.

#### FR-21: The key figure set · v1

The product computes and displays the key figures defined in `docs/key-figures.md`.

**Consequences (testable):**
- The engine implements every formula exactly as that document states; a formula changes in the document and in the code in the same commit.
- Two algebraic identities are asserted exactly by tests: return on assets equals operating margin × (`sumDriftsinntekter` / `sumEiendeler`), and personnel cost share equals personnel cost per FTE ÷ revenue per FTE.
- Total cost share is a reconciliation check against the three cost shares, not a primary benchmarking figure.
- **Key figures 7 and 8 are absent in v1.** Both divide by `aarsverk`, which comes from the notes, and v1 does not read the notes. Revenue per FTE and personnel cost per FTE are therefore shown as absent with that reason for every subject, never as undefined, failed reconciliation or below the floor, and no peer value of either enters an aggregate. The engine still implements both formulas, and the identity above is asserted on test inputs. Reading `aarsverk` is stage 2 (§6.2).
- **Cash share is a diagnostic, not a numbered key figure.** It is shown as context with no declared direction, is never ranked, and produces no kroner amount — the same treatment revenue growth gets (FR-27).
- Amounts are integers in øre. Ratios use a decimal library and are rounded only for display, ties away from zero: percentages to one decimal, the percentile to whole percent, days to whole days, kroner to whole kroner (`docs/key-figures.md`).

#### FR-22: Minimum group size, per key figure · v1

No aggregate is shown for a key figure unless at least 10 peers have a defined value for that figure. Realises UJ-1 (edge).

**Consequences (testable):**
- The count is taken **per key figure**, after companies with an undefined value for that figure are excluded.
- A peer group can clear the floor for one figure and fail it for another; each figure is gated independently.
- Below the floor **the row persists and still shows the subject's own value**; where the median, favourable quartile and percentile would be, the figure states how many comparable values exist against the ten required. The user sees which figure specifically is thin, rather than a silently shorter table.
- A figure below the floor produces no kroner amount, because there is no target to compute a gap against (FR-29).
- **The floor is not the reason for key figures 7 and 8 in v1.** They are absent for every company because v1 does not read `aarsverk` (FR-21), so their rows show that reason, not a count against the ten required.
- Synthetic cohorts at and below 10 assert that no aggregate escapes.
- This is a quality threshold, not a confidentiality control: aggregates are computed only from public filings.

#### FR-23: Undefined is not zero · v1

A key figure that cannot be computed for a company is undefined for that company, never defaulted to zero.

**Consequences (testable):**
- A zero or negative denominator, or a component that is missing and cannot be derived from a stated total, makes the figure undefined. A **derived** denominator of 5 kr or less counts as not positive, because it is within the register's rounding of zero (Story 1.4, human decision 2026-10-12; `docs/key-figures.md`).
- A missing component is first derived from its stated total — an empty document `sumDriftsinntekter` is recovered as `driftsresultat` + `sumDriftskostnad` — and with a part also empty the figure is undefined, never zero.
- A document line the engine does not use because it exceeds its API subtotal (R3, Story 2.5c) makes a figure that reads it undefined with its own reason, "en regnskapslinje kunne ikke leses sikkert", not "en regnskapslinje mangler" (Story 2.9).
- An undefined figure excludes that company from that figure's distribution only, not from the peer group.
- The number of companies left out of each figure's distribution is shown to the user.
- No figure is ever estimated or imputed.

#### FR-24: Same basis for subject and peers · v1

A key figure's comparison — median, favourable quartile, percentile and any kroner amount — is shown only if the subject and at least the minimum group size of peers (FR-22) have that figure from the same source. The rule withholds only the comparison; the subject's own value is governed by FR-22.

**Consequences (testable):**
- A subject value from OCR against peers with API values only yields no median, no favourable quartile, no percentile and no kroner amount.
- The subject's own value is still shown in the row, with the reason the comparison is absent, displayed the same way as below the minimum group size (FR-22).
- Where the subject's own value cannot be computed either, the row states that instead (FR-23).
- No case under this rule removes the subject's own value from the row.

#### FR-25: Same year · v1

The benchmark year is the subject's latest filed year, and peers use the same year.

**Consequences (testable):**
- A peer without a filing for that year is excluded.

#### FR-26: Decomposition views · v1

The product separates margin from capital efficiency, and pay level from productivity.

**Consequences (testable):**
- The pay-level-versus-productivity view distinguishes paying more per person from producing less per person, using the identity in FR-21.
- **Stage split:** both views are open in v1; from stage 2 they sit behind the account wall (FR-42).
- **In v1 the pay-level-versus-productivity view is absent**, with the same reason as key figures 7 and 8: both its factors divide by `aarsverk`, which v1 does not read (FR-21). It arrives with them in stage 2. The margin-versus-capital view is unaffected.

#### FR-27: Distribution display · v1

For each key figure the product shows the subject's value, the peer median, the favourable quartile, and the subject's percentile.

**Consequences (testable):**
- The favourable quartile is the upper quartile where higher is better and the lower quartile where lower is better, by the direction declared for that figure.
- Percentile is `(peers worse + 0.5 × peers equal) / peers × 100`, in the favourable direction.
- Both the median and the favourable quartile are always shown where both exist. The median is context, and a marker on the closable-share control; it is never the target of the kroner arithmetic (FR-31).
- **A figure with no declared direction gets no favourable quartile and no percentile**, because both are defined in the favourable direction and there is none. Those figures show the subject's value against the peer distribution and are never ranked: total cost share (6), because it is a check on the three cost shares and ranking it would rank the operating margin again (FR-21); revenue growth, because fast growth often explains a weak margin; personnel cost per FTE and equity ratio, because the direction is genuinely arguable; and cash share, which is a diagnostic (FR-21).

#### FR-28: Multi-year trend where available · Stage 2

Where filings allow, the product shows how the subject has moved against its peers over time.

**Consequences (testable):**
- **Stage split:** the view, its tab and the sparklines are stage 2. Extracting and reconciling the earlier years is batch work that SM-2 measures, and is not held back with the view.
- Development over time covers the last five years, 2021–2025. The spike measured about 88 % of columns reconciling (2026-09-26); the Story 2.1b run, re-read after Story 2.5c, reconciles 1 837 of 1 946 current columns, about 94 % (`analysis/output/document-run-counts-after-2.5c.json`). Paper filings are never read; older generated years are used only where they reconcile.
- **A reconciled column is not a complete one.** Lines no check needs can be empty in a reconciled column: in the same run `lonnskostnad` is present in 1 602 of 1 946 current columns and `avskrivninger` in 1 403. Whether a figure is available is therefore per field, not per filing.
- Every filed document of 2021–2025 is fetched and read, not every other year, although each document carries a prior-year column (Meinich, 2026-10-20, Story 2.1b); both columns of each document are stored.
- **What v1 reads.** Every 2021–2025 document of the companies whose document figures are in the seed (demo A and B and their candidate pools, the 20 OCR reference companies), and the 2025 document of each labelled-set company (FR-3). The run over the rest of `62.100` (about 8 400 companies, about 33 000 documents, about 190 hours) is not part of v1; `pnpm ingest --documents <list>` performs it with no new code, and it resumes where it stopped. A plain `pnpm ingest` reads no document. See FR-59.
- The full development-over-time view needs an account; a sparkline preview with the peer median is open to anyone (FR-42).

### 4.4 Gap quantification in kroner and the closable-share control

**Description.** The feature that turns a ratio into a decision. Every unfavourable deviation becomes a kroner amount; one control sets how much of each gap the user believes is closable; the totals move live. This is where a double-counting error would be most damaging and least visible, so the rule against it is a requirement with a test, not a convention.

#### FR-29: Deviation to kroner · v1

Each key figure with a kroner translation converts its gap to money exactly as `docs/key-figures.md` specifies. Realises UJ-1, UJ-2.

**Consequences (testable):**
- Only gaps where the subject is worse than the target produce a kroner amount; where it is better, the figure is shown as a strength with no amount.
- Figures with no kroner translation in that document produce none here.
- **Kroner only for kroner accounts.** An amount is produced only when the subject's filing has `valuta` NOK; otherwise the cell reads *"Beløpet er ikke i kroner"* (Story 1.8, human decision 2026-10-16; `docs/key-figures.md`). The amount uses the subject's resolved revenue — stated, or derived — in exact øre, rounded once, at display.
- **The cost shares (3–5) have no kroner amount of their own.** Their median, favourable quartile and percentile are shown as for any figure; what they mean in kroner is shown only by the margin decomposition (FR-30).

#### FR-30: No double counting · v1

The cost shares are expressed in kroner only through the margin decomposition against the peer group as a whole, defined in `docs/key-figures.md`, and that decomposition is never added to annual profit uplift. Quartiles are not additive — each cost share's favourable quartile comes from different companies — so cost-share amounts measured to their quartiles could sum to more than the margin gap they explain.

**Consequences (testable):**
- **Profit cluster.** An automated test asserts that no cost share produces a kroner amount of its own, and that no total presented to the user, or contained in an export, adds a margin decomposition bar to annual profit uplift.
- **The decomposition sums exactly.** Over the common peer set that `docs/key-figures.md` defines, the four bars — cost of goods, personnel, other operating, and depreciation and other items as the residual — sum exactly to the subject's margin difference against the peer group as a whole, times its `sumDriftsinntekter`; after rounding by largest remainder, the displayed bars sum to the displayed total. A test asserts both.
- Where the common peer set has fewer than 10 peers, or the subject lacks a component, no decomposition is shown and the count is stated (FR-22).
- **It explains; it is not a gap to close.** The decomposition is never scaled by the closable share, and it names its reference — *peer-gruppen samlet* — so it is not read against the favourable quartile or the median.
- **Capital cluster.** A second assertion covers the capital amounts: no total sums the receivable-days amount together with the operating-asset-turnover amount. The operating asset base `sumEiendeler − bankinnskudd` already contains `kundefordringer`, so adding them counts the receivable reduction twice.
- Working capital released is receivable days **plus payable days only**. Those two are safe to add — one is an asset, the other a liability — and the test asserts that nothing else enters that total.
- Capital released from operating assets is presented as its own amount beside working capital released, never inside it.
- The two clusters are tested separately because they fail separately: an earlier version of this requirement guarded only the profit cluster, and the receivables double-count passed it. An earlier version still gave each cost share its own amount to its quartile, which the decomposition replaced (2026-10-10).

#### FR-31: The closable-share control · v1

A single control sets the closable share from nothing to full convergence with the favourable quartile, and the results update live. Realises UJ-1, UJ-2.

**Consequences (testable):**
- Annual profit uplift, working capital released, capital released from operating assets and implied enterprise value all recompute from the same closable share, and are presented as four amounts rather than one total (FR-30).
- **The target is the favourable quartile at every setting of the control**, and the control scales the gap to it: no kroner at zero, full convergence with the quartile at full closure.
- The peer median is marked on the control so the user can see where the typical peer sits relative to the target, and is never itself the target. `docs/key-figures.md` states the same.
- A figure with no favourable quartile (FR-27) has no target and produces no amount here.

#### FR-32: Valuation at a user-set multiple · v1

Implied enterprise value is annual profit uplift × an EV/EBIT multiple set by the user.

**Consequences (testable):**
- The multiple is a user input with **no default**. The field starts empty and implied enterprise value is not shown at all until the user enters one.
- The engine never looks a multiple up, infers one, or offers a range, so the product never implies a valuation it did not receive from the user. Annual profit uplift and working capital released are unaffected and show without it.
- The calculation uses EBIT (`driftsresultat`), which is API-sourced for every company and traces directly to the filing, so the headline valuation figure carries no OCR dependency.

### 4.5 Unfiled current-year figures

**Description.** A company knows its current year long before it files it. An owner can enter those figures by hand and see a provisional position — but the product never lets them be mistaken for filed accounts, and never lets them touch anyone else's comparison. Realises UJ-4.

**Stage 2, the whole section.** Unfiled figures belong to a workspace, and v1 has none.

#### FR-33: "Egne tall – ikke levert" labelling everywhere · Stage 2

Every figure derived from unfiled input carries the label *Egne tall – ikke levert* wherever it appears. Realises UJ-4.

**Consequences (testable):**
- The label survives into PDF export.
- Filed and unfiled figures are never merged into a single displayed value.

#### FR-34: Visibility of unfiled figures · Stage 2

Unfiled figures belong to the workspace: the owner writes them, viewers read them, anonymous sessions never read them. Realises UJ-4 (owner writes) and UJ-3 (viewer reads).

**Consequences (testable):**
- An anonymous session cannot read an unfiled figure by any route, including export.
- A viewer cannot write one.

#### FR-35: Period difference stated · Stage 2

Unfiled current-year figures are compared against the peers' latest filed year, with the difference in periods stated. Realises UJ-4.

**Consequences (testable):**
- No kroner amount is computed from user-entered figures, whether full-year or year-to-date. They yield ratios and percentiles against the peers' latest filed year only.

#### FR-36: Filed figures take precedence · Stage 2

When the filing for the same year arrives it takes precedence, and the user-entered figures are kept only as history. Realises UJ-4.

**Consequences (testable):**
- Once a filing for a year is stored, every figure, aggregate and kroner amount for that year comes from the filing, not from the user-entered figures.
- The user-entered figures for that year stay visible as history, labelled as entered by the user.
- A user-entered figure never overwrites a filed one.

#### FR-37: Unfiled figures never enter an aggregate · Stage 2

No user-entered figure contributes to any peer median, quartile, distribution or percentile.

**Consequences (testable):**
- Aggregate queries read only tables holding filed accounts, so leaking an unfiled figure into a peer median would require changing the query rather than forgetting a filter.

#### FR-38: Which figures may be entered · Stage 2

An owner enters four required components — revenue, operating profit, total assets and total equity — and may add the document-sourced components (the cost lines, trade receivables, trade payables, FTEs) where they have them.

**Consequences (testable):**
- The four required components guarantee a provisional position on operating margin, return on assets and equity ratio — the three figures that depend on no extracted data.
- Every further key figure appears only once all of its components are present. A partly-entered figure is undefined, never completed from what is there (FR-23).
- A component left blank is undefined, not zero.

#### FR-67: Year-to-date figures against the same period last year · Stage 2

An owner may enter year-to-date figures, stating how many months they cover, and the primary comparison is the company's own figures for the same months of the previous year. Realises UJ-4.

**Consequences (testable):**
- The number of months covered is required, and is shown with every figure derived from the entry.
- **Nothing is annualised or scaled to a full year.** A partial-period figure is used for the period it covers, so no projection is made and FR-23's rule that no figure is ever estimated holds without exception — as does §5's exclusion of forecasting.
- **Ratios only.** No kroner amount is produced from a partial period, because a kroner translation needs a twelve-month revenue base (FR-29).
- The primary comparison is the company against its own same period last year, entered by the owner. Seasonality largely cancels because both sides cover the same months.
- Where the prior-year same-period figures are absent, the year-to-date ratios are shown **without a primary comparison** — never measured against a full year as though the periods matched.
- The company's own last filed full year and the peers' latest full year are shown as context only, labelled *"hele år, ikke samme periode"*.
- Every derived figure carries the label *Egne tall – ikke levert* (FR-33), and none enters any aggregate (FR-37).
- No adjustment is made for seasonality or any other external factor, and the product says so. It is disclosed, not corrected.

### 4.6 Accounts, workspaces and access

**Description.** One access model covers everyone. A visitor without an account gets a real authenticated identity, so row-level security, the audit log and rate limiting all work unchanged — and registering converts that identity in place rather than starting over. An account is needed only for what persists. Realises UJ-1, UJ-2, UJ-3.

**Stage 2, except FR-69.** v1 has no accounts, no anonymous sign-in and no user-scoped table; every analysis is open and nothing is stored about who looked. FR-69 is v1 because every visitor's adjustments live in the URL from the start.

The security-relevant subtlety: anonymous users hold the `authenticated` Postgres role, so a policy that merely checks for an authenticated user admits them.

#### FR-39: Anonymous session on arrival · Stage 2

A visitor without an account receives a Supabase anonymous sign-in, so every request carries a real `auth.uid()`.

**Consequences (testable):**
- A first request without a session gets an anonymous sign-in, and every later request in that session carries its `auth.uid()`.
- An anonymous session can neither read nor write saved or user-entered data (FR-47); covered by a case in the authorisation suite.
- A complete analysis needs no sign-in beyond the anonymous one (SM-8).

#### FR-40: Conversion in place · Stage 2

When a visitor registers, the anonymous user is converted in place and keeps what it did. Realises UJ-1, UJ-2.

**Consequences (testable):**
- An analysis built anonymously is still reachable after registration, without being rebuilt.
- What carries across is the URL state of FR-69 — organisation number, exclusions, size-band step, closable share, multiple — written into the new workspace at registration. Nothing was in the database before, so nothing had to be migrated out of an anonymous row.

#### FR-41: Magic-link sign-in · Stage 2

Sign-in is by emailed magic link.

**Consequences (testable):**
- No password is stored anywhere, so none can be leaked.

#### FR-42: The account wall · Stage 2

Open to anyone: the front page and industry overviews, lookup, the peer group and its adjustment, key figures, percentiles, gaps in kroner, the closable-share control and valuation, and a five-year sparkline per key figure as a preview of development over time. An account is required for the full development-over-time view, the decomposition views, PDF export, saved analyses and history, unfiled figures, workspaces, invitations and the portfolio front page. Realises UJ-1, UJ-2.

**Consequences (testable):**
- **v1 has no wall: every tab is open** and there is no account to require. The wall below is how the product divides once accounts arrive in stage 2.
- The core — peers and the gap in kroner — never requires an account.
- The open sparkline preview always draws the peer median as a faint reference line, so a rising figure is never read without the peers' movement beside it. It carries no band, no placement over time and no user-entered figures; those stay in the full view.

#### FR-43: Workspaces · Stage 2

Saved work belongs to a workspace, typically one per company, with membership carrying the role `owner` or `viewer`.

**Consequences (testable):**
- An adviser holding many client companies is a user with many workspaces; no adviser role exists.

#### FR-44: Invitation · Stage 2

An owner invites a viewer by email, into a single workspace, as a viewer. Realises UJ-3.

**Consequences (testable):**
- An invitation grants access to exactly one workspace, never to the inviter's other workspaces.
- An invitation confers read-only access only.
- Share links that grant access to anyone holding them are out of v1 (§5).

#### FR-45: Cross-workspace isolation · Stage 2

No user can reach a workspace they are not a member of. Realises UJ-3.

**Consequences (testable):**
- Isolation holds **between two workspaces held by the same owner**, not only between different users.
- An invited viewer cannot reach a workspace they were not invited to.
- Row-level security keys every user-scoped table to workspace membership; no endpoint's safety depends on remembering a `where` clause.

#### FR-46: Immediate revocation · Stage 2

Removing a member revokes access immediately, because every policy goes through membership.

**Consequences (testable):**
- After the owner removes a viewer, the next request from the viewer's still-valid session against that workspace returns no rows, without a new sign-in.
- The same holds for an editor: the next write is refused.
- Covered by a case in the authorisation suite.

#### FR-47: The anonymous boundary in policy · Stage 2

Every policy on saved or user-entered data requires `is_anonymous` to be false in the JWT, not merely that a user is authenticated.

**Consequences (testable):**
- The authorisation suite includes an anonymous attacker attempting to read and to write saved data, and asserts rejection.

#### FR-48: Audit log · Stage 2

Every analysis, anonymous or not, resolves to an actor in an append-only audit log.

**Consequences (testable):**
- Entries carry actor, timestamp and prior state.
- Anonymous actors are logged by their anonymous id.

#### FR-69: An anonymous session's state lives in the URL · v1

Everything an anonymous visitor changes — the organisation number, the active tab, excluded peers, the size-band step, the closable share and the EV/EBIT multiple — is carried in the URL rather than written to the database.

**Consequences (testable):**
- **Stage split:** in v1 this holds for every visitor, since nobody has an account. The anonymous-session wording and the write into a workspace at registration (FR-40) apply from stage 2.
- **No anonymous session writes to any table.** FR-47's requirement that every policy on saved or user-entered data demand `is_anonymous` false therefore holds without exception, and the authorisation suite's anonymous-write attack stays a real attack.
- Every value carried this way is either public register data or the user's own choice of parameter. None of it is anyone's saved work.
- Refreshing, bookmarking or passing on the address reproduces the same analysis, because the state is in the address.
- This is not browser storage. AGENTS.md bars browser storage for anything that must survive, and nothing here is stored in the browser.
- On registration the URL state is written into the workspace, which is what makes FR-40's conversion in place observable rather than merely claimed.

### 4.7 Saved analyses, history and export

**Description.** The second visit should show how the company has moved against its peers rather than starting over.

**Stage 2, the whole section.** Saving needs an account, and PDF export sits behind the account wall.

#### FR-49: Save an analysis · Stage 2

A signed-in owner can save an analysis into a workspace.

**Consequences (testable):**
- A saved analysis reopens with the peer-group settings it was saved with: the exclusions and the size band.
- An anonymous session cannot save (FR-47), and a viewer cannot save into a workspace they only view.
- A saved analysis is readable only by members of its workspace (FR-45).

#### FR-50: History · Stage 2

A saved analysis accumulates history, so a later visit shows movement against the peer group rather than a fresh start.

**Consequences (testable):**
- A later visit shows each key figure's value at the saved state beside its current value.
- A figure absent then or now shows its reason, never a change computed against zero (FR-23).
- History is readable only by members of the workspace (FR-45).

#### FR-51: PDF export · Stage 2

A signed-in user can export an analysis as PDF. Realises UJ-1.

**Consequences (testable):**
- The *Egne tall – ikke levert* label on user-entered figures is carried through into the export (FR-33).
- Export is unavailable to anonymous sessions.

### 4.8 Explanatory text

**Description.** Written text naming the largest gaps in kroner, the measures where the company is strong, and — where multi-year data exists — which gaps have persisted. It explains; it does not recommend. This is one of exactly two jobs the model has.

#### FR-52: Generated explanation · v1

The product presents written explanation of the computed analysis.

**Consequences (testable):**
- It names the largest gaps in kroner and the measures where the subject is strong.
- Whether a gap has persisted across years is decided by the engine from the figures, never by the model.
- Every figure in the text links back to its calculation.
- **Stage split:** v1 shows stored text — generated in the batch job, or in test mode read from the stored output for the seed companies' default peer groups (FR-73). Regeneration for an adjusted group needs a live model call and an account, so it is stage 2.
- Text is generated and cached for the **default** peer group only, so an ordinary visit never triggers a model call.
- **In v1 an adjusted peer group hides the explanation** and shows *"Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den."* with an action that restores the default group, rather than showing text written for a group that is not on screen. The explanation is therefore only ever shown beside the figures it describes, which keeps "every figure in the text links back to its calculation" true. In v1 that is the only behaviour for an adjusted group.
- From stage 2, a signed-in user can regenerate the explanation for an adjusted group through a rate-limited action. This is the second of exactly two model calls a user request may trigger (FR-20).
- An anonymous session never triggers generation of explanatory text by any route, adjusted group or not.

#### FR-53: The model never calculates · v1

No number may appear in generated text that is absent from the engine's calculation output.

**Consequences (testable):**
- An automated test rejects generated text containing any figure not present in the engine's output. Once that test exists it is never weakened.
- In v1 the test runs against the stored explanation fixtures of FR-73, so it runs in CI and on a sensor's machine without a model key.
- The test also rejects a figure that **is** in the engine's output but **attached to the wrong thing** — the right number against the wrong key figure, company, year or direction. Containment alone would pass that, and it is the more likely failure.
- The test parses **Norwegian number formats**, so `1 234 567,89`, a non-breaking or narrow space as thousands separator, a comma as decimal separator, `kr` before or after the amount, and `%` are all recognised as the figures they are. A figure the test cannot parse is a failure, not a pass.
- The model's only two jobs are classification into fixed categories (FR-11) and explanatory text (FR-52). It performs no arithmetic.
- Peer inclusion reasons are rules-generated, not model-generated (FR-16).
- A free-form chat over the data is out of scope precisely because it cannot be held to this rule (§5).

#### FR-54: Explains, does not recommend · v1

Generated text describes what the figures show and does not prescribe action.

**Consequences (testable):**
- A list of recommending and imperative phrases (for example "bør", "anbefaler", "må redusere") lives in one reviewable file in the repository.
- It is checked at generation: a hit means the explanation is regenerated.
- It is checked again at seed load: a hit means the explanation is withheld and reported, never shown.
- Before the demo seed is published, 30 random stored explanations are read by a person and the result is recorded in `docs/ai-sessions/`; any recommending phrasing the list missed is added to it.

### 4.9 Responsive interface

**Description.** A data-dense product — four-column ratio tables, distribution plots, a peer list — that has to work from desktop down to phone width. This is a course requirement, not a preference, and retrofitting it is far more work than designing for it.

#### FR-55: Reflow to phone width · v1

The interface works down to phone width, reflowing and stacking to one column when narrow. It is designed at 375 px, and 320 px is the floor it must still work at (epics, NFR18; technical note).

**Consequences (testable):**
- The page body never scrolls horizontally at any width from 320 px upwards; every UI story's e2e tests check 375 px and 320 px.
- Checked at phone width during development, not at the end.

#### FR-56: Wide content scrolls within its own container · v1

Ratio tables, distribution plots and the peer list each scroll horizontally inside their own container when wider than the viewport.

**Consequences (testable):**
- On a phone the key-figure table does not scroll: below the `md` breakpoint it reflows into a three-column table whose rows expand to show the rest (Story 1.8). The desktop table, the distribution plots and the peer list scroll in their own containers.

### 4.10 Data quality visible to the user

**Description.** The register serves filed accounts only as page images, so most figures depend on optical recognition. The product's posture is that a figure nobody can trace is a figure nobody acts on — and that a wrong figure is worse than a missing one.

#### FR-57: Data quality flag per filing · v1

Each filing carries a data quality flag derived from the reconciliation rules (FR-58).

**Consequences (testable):**
- The flag is derived from arithmetic checks only, never from recognition confidence. Confidence is not a signal: a generic engine reported mean confidence 0.974 while misreading several figures.
- **Status is set per column, and the filing's flag is its current-year column's** (Story 2.2, Meinich 2026-10-21). A column is `reconciled` when c1 (income statement) passes, c3 or c5 (balance) passes, no check among c1–c5 fails, and — for the current-year column — the comparison with the register does not fail. Otherwise it is `failed_reconciliation`.
- A failed prior-year column does not fail the filing. The prior column is checked within the document only; its difference from the register is stored as information.
- **2021 and 2022 have no register check.** The key-figures API holds filings from 2023 on, so for those years the comparison is `not_evaluable` and the flag rests on the within-document checks alone.
- A document that cannot be read at all is `not_extracted`, with its refusal reason (FR-60).

#### FR-58: A figure that fails reconciliation is withheld · v1

A figure is accepted only where its column reconciles, and a failure blocks the column rather than degrading the analysis silently. Acceptance is decided **per column, not per figure**: every figure of a reconciled column reaches the engine, and none of a failed one does.

**Consequences (testable):**
- *Within* a document, stated subtotals must agree with their components within a tight absolute bound of a few kroner — because the register prints whole kroner rounded from øre, a legitimate filing can be a krone off.
- *Between* document and the register's structured figures, a figure agrees within max(a few kroner, a very small proportion of the register's figure): the proportional part admits the rounding of a company reporting in millions as the register states it, and is kept small because documents in scaled reporting units are refused (`docs/data-sources-brreg.md`).
- Neither check is exact equality, and the two are never collapsed into one: the filing's own rounding is a krone or two, while recognition errors are wrong by orders of magnitude.
- A failing figure is not shown with a caveat and not substituted, and no OCR digit is repaired.
- A digit token too narrow for its digits is refused at reading, and a current-year `kundefordringer` or `bankinnskudd` above the register's `sumOmloepsmidler` is not used by the engine (`docs/key-figures.md`).
- **Known limit:** a misread that keeps the token's width, in a line no check covers (`salgsinntekt`, `leverandorgjeld`, a prior-year current asset), can still reach the engine in a reconciled column. What guards each path is in the technical note (AD-15).

#### FR-59: Nothing is extracted at query time · v1

No document is fetched or OCR'd during a user request, for the subject or for any peer.

**Consequences (testable):**
- Every document-derived figure served to a user comes from pre-warmed storage.
- A company is offered with document-derived figures only once its documents are pre-warmed. In v1 that is the companies whose document figures are in the seed (FR-3); every other `62.100` company shows its document-based figures as absent with a reason ("Ikke i demodataene", FR-73), and nothing is fetched to fill them.
- Pre-warming more companies is a batch run, not a code change: `pnpm ingest --documents <list>` reads the listed companies' documents, and a later seed export carries them.

#### FR-60: Traceability · v1

Every kroner amount traces to the ratio that produced it and on to the filed accounts behind it.

**Consequences (testable):**
- From any displayed kroner figure the user can reach the key figure and the filed values it was computed from.
- Filings that cannot be read reliably are reported as unavailable rather than estimated. A paper filing is stored with status `paper` and never read; none was seen after 2013 in a 30-company sample (`docs/data-sources-brreg.md`), so in 2021–2025 they should be rare. A generated document is unavailable when it was refused at reading (`not_extracted`: an unknown layout, a scaled reporting unit, an unreadable or mismatched year header, or an OCR error) or when its column failed reconciliation (FR-57).

#### FR-71: When the subject's own filing fails reconciliation · v1

Where the subject's own filed document fails reconciliation, the product shows the figures it can source from the API and says why the others are absent.

**Consequences (testable):**
- The three API-sourced figures — operating margin, return on assets, equity ratio — are shown, because they do not depend on the document.
- The twelve document-dependent figures are absent, and the product states that the subject's own filing could not be read reliably rather than showing a gap without a reason: "Regnskapet for {år} kunne ikke leses sikkert", in each absent figure and as a slate subline in the company header, with no badge (Story 2.9). The same words cover a document not yet reconciled and one refused at reading. A listed subject with no stored document for its filing year reads "Regnskapet for {år} er ikke lest inn", and one whose filing year is outside the years read, or whose filing is on paper, reads "Regnskapet for {år} er ikke lest i denne versjonen", each in the absent figures and as the header subline.
- No figure is estimated, substituted from another year, or shown with a caveat (FR-58).
- The subject is not silently demoted to an uncovered company: its industry **is** covered, its peers are unaffected, and the API-sourced figures still carry a full comparison (FR-24).
- This is distinct from FR-4, where the industry itself is uncovered and there is no peer group at all.

#### FR-64: The age of the data is disclosed, not promised · v1

Every figure, aggregate and industry overview states the filing year behind it and the date the underlying data was read from the register.

**Consequences (testable):**
- **Stage split:** disclosure on screen is v1; what follows about PDF export and saved analyses applies from stage 2, when they exist.
- The filing year and the read date survive into PDF export and into a saved analysis, so a saved analysis cannot be mistaken for a current one.
- A saved analysis shows the read date it was computed from, never today's.
- A saved analysis is a record of what was computed on that date, with one exception: a company the register later withdraws is removed from it, as subject or as peer (FR-66).
- The product makes no freshness guarantee. The batch refresh is triggered manually in v1 (§8), so the disclosed read date — not a promised interval — is what tells the user how current the figures are.
- **A stored document is not fetched again** (Story 2.1b), so a company that refiles a year keeps the first filing's figures until a re-read. The read date is the date of the read that produced the stored figures.

#### FR-65: Source credit under the register's licence · v1

The product credits Brønnøysundregistrene as the source, states that the figures have been processed by Peerless, and does not suggest the register endorses the analysis. **The NLOD credit is claimed for the API-sourced data only.**

**Consequences (testable):**
- The NLOD 2.0 credit applies to what the register licences under NLOD: the data from the open APIs. Its prescribed form is used where it applies — *"Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene"*.
- **Figures derived from the filed documents are credited to Brønnøysundregistrene as their source without asserting a licence**, because the register states none for those documents (§8). The product never claims NLOD coverage for data NLOD does not cover — an earlier version of this requirement did exactly that, and it was wrong.
- The credit distinguishes the two, so a reader can tell which figures rest on a licence and which rest on a right of access.
- It states that Peerless has processed the data, because every displayed figure is recomputed rather than reproduced. The licence requires modification to be declared where it applies, and saying so for everything costs nothing.
- It reaches every route out of the product, PDF export included from stage 2, not only the web interface.
- It may live on an *Om*-style page rather than beside each figure — "Slik fungerer Peerless" (FR-72) — but it is reachable from every page and is not hidden.
- The register's name and marks appear as the source of the data only — never in a way that implies the register stands behind, recommends or markets the analysis.
- Nothing in the presentation distorts or misrepresents the register's figures. This is the licence restating what FR-58 and FR-60 already enforce.

`docs/data-sources-brreg.md` holds the licence text, the clause references and the URLs.

#### FR-66: A withdrawn company is removed from storage · v1

When the register reports a company as gone, Peerless deletes its stored copy.

**Consequences (testable):**
- **Stage split:** removal from stored register data and from the seed data is v1; removal from saved analyses is stage 2, when they exist.
- An entity returning `410 Gone` is removed from stored register data, not merely flagged, because the register states that the status should also be treated as a request that copies and caches remove it.
- **Only `410` deletes** (Story 2.4, 2026-10-30). The ingestion run asks the register about each stored company missing from the bulk file. A **dissolved** company — answered with a `slettedato` — is not withdrawn: it is kept, its date is stored, and it is counted as dissolved. A `404`, or an answer without `slettedato`, deletes nothing and is recorded as a failure.
- **A truncated bulk file deletes nothing.** If more than 1 % of the stored companies are missing from the bulk file without a stored `slettedato`, the file is taken to be truncated: nothing is asked or deleted, and the run fails (`ingest/config.toml`, `[withdrawal]`).
- `[NOTE FOR PM]` Whether a dissolved company stays a peer candidate is open: nothing in the request path reads `slettedato` yet, so today it does (`deferred-work.md`, Story 2.4; §11, question 23).
- A removed company disappears from every peer group and from every aggregate computed after the removal.
- Removal reaches saved analyses too, because the register frames it as possibly made for legal reasons and asks every copy to delete the entity; this is the one exception to the record promise in FR-64. **As subject**, the company's figures are removed from every saved analysis; the workspace keeps the entry with the notice *"Selskapet er slettet fra Enhetsregisteret 12.03.2027, og tallene er fjernet"*. **As a peer** in other saved analyses, its row and name are removed, while aggregates already computed are kept with the note *"Én sammenlignbar er fjernet fra registeret"*. No data about the removed entity is stored anywhere afterwards, and it cannot be looked up or re-entered as a peer.
- The check belongs to the ingestion job, so removal never depends on a user visiting the company.

### 4.11 Front page and navigation

**Description.** The product opens on a page that explains itself and, from stage 3, shows what the data can do before anyone types a number; from stage 2 a signed-in adviser lands on their own portfolio rather than an empty search field.

#### FR-61: Front page with industry overviews · v1

The front page describes Peerless, holds the search field (name or organisation number), and shows an overview of each covered industry: the median margin over time, the spread in personnel cost share, and the share of companies growing.

**Consequences (testable):**
- **Stage split:** the front page — the description, the search field (name or organisation number), "Slik fungerer det" in three steps and the link to FR-72 — is v1. The industry overviews are stage 3, and every consequence below concerns them.
- Overviews show aggregates only and never name a company.
- They are computed by the same engine from the same stored figures as an analysis, and follow the minimum group size (FR-22).
- They exist only for covered industries.
- If older filings cannot be read reliably, an overview shows the latest year only — the spread without the trend — rather than a trend built on weak data.
- Named rankings and league tables are out of scope (§5).

#### FR-62: Analysis tabs · v1

An analysis is organised in tabs: overview, peers, key figures and gaps, development over time, and value.

**Consequences (testable):**
- **Stage split:** v1 has four tabs — overview, peers, key figures and gaps, and value — all open. Development over time (*Utvikling*) arrives with FR-28 in stage 2.
- From stage 2, tabs that need an account are visible to anonymous sessions but say that an account opens them (FR-42).

#### FR-63: Portfolio front page · Stage 2

A signed-in user's front page lists every company they follow, with its latest position, what has changed since the last filing, and the largest gaps.

**Consequences (testable):**
- It reads saved analyses only; nothing is computed for companies the user does not follow.
- It shows only workspaces the user is a member of (FR-45).
- User-arranged widgets are out of v1.

#### FR-72: "Slik fungerer Peerless" — how the product works · v1

A public page explains, in plain Norwegian, how peers are chosen, where AI is used and where it is not, what has been measured, where the data comes from, and what the product cannot do.

**Consequences (testable):**
- It describes the five funnel stages (FR-7 to FR-11) in plain language, without formulas.
- It names the two places a model is used — classifying what a company does (FR-11) and writing the explanation (FR-52) — and states that the model never calculates a figure, and that this is enforced by an automated test (FR-53), not by instruction.
- It reports what has been measured, layer by layer (SM-1, SM-2), **only once the measurement exists**. Until then it says the measurement is pending; it never shows a placeholder or expected figure.
- It carries the data sources and the licence distinction of FR-65, including the prescribed NLOD credit, and is the *Om*-style page FR-65 allows.
- It states the known limitations from `docs/key-figures.md` and §5, including the VAT effect on receivable days and the `smaaForetak` coverage limit (§10).
- It is reachable from the footer of every page and from the front page, without an account.

### 4.12 Running locally

**Description.** A sensor must be able to run Peerless from a fresh clone, from the README, without our keys, a paid account, email or a hosted service. That is a course criterion and an AGENTS.md rule, and it shapes v1: everything the app reads at runtime is already in the database, and anything that would call a model or the register at runtime has a test mode backed by stored output. The technical note's "Running Peerless locally" is authoritative for how.

#### FR-73: Running locally · v1

Peerless runs from a fresh clone on a local database loaded with seed data, and nothing it does at runtime needs OCR, the register API, a model, email or a secret.

**Consequences (testable):**
- **From a fresh clone by the README alone.** A short, fixed sequence — `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm db:start`, `pnpm db:roles`, `pnpm seed`, `pnpm build`, `pnpm start` — reaches a running production build, never `next dev`, with nothing typed in: local role passwords are generated into the gitignored `.env`, and every other value is a local default or optional (SM-9). Every table, policy and function is a migration, and a fresh database reaches the full schema from the migrations alone.
- **No runtime dependency on the pipeline or the network.** With the register API and every model host unreachable and no model key set, a lookup of a seeded company produces the complete analysis, and a test asserts that no request to the register or to a model leaves the app. Without a key the explanation comes from stored output that passes the figure-validation test against the loaded dataset (FR-52, FR-53); a subject with none that passes shows none and says so. Nothing in v1 sends email.
- **The demo seed, committed, loads with one command and twice gives the same state.** It holds register data and API key figures for all of `62.100`, the stored classification of every AS in it, a stored explanation for every company's default peer group, and document-derived figures only for a declared set: demo companies A and B, every peer of A and B at all three size-band steps, and the OCR reference companies (SM-2). Fingerprint categories, never the figures behind them, are committed for the declared set, and for other companies only if a recorded licence assessment opens the gate. A check asserts that the seed holds nothing else.
- **The full seed is built locally and never committed.** `pnpm seed:full` runs batch steps 1 and 2 without a model: register data and API key figures for all of `62.100`, and documents only for a list the user gives. It promises no full dataset, and a company whose documents are not read shows its document-based figures as absent.
  - The README says what `pnpm seed:full` builds. Classifications come from the committed seed, and new ones only from running `pnpm classify` separately, with a key.
- **Three demo companies show three states, and every other company shows what it is.** A, a typical `62.100` consultancy, shows the whole analysis; B, a loss-making `62.100` product company, shows the fingerprint separating it from consultancies and a large gap; C, a `69.202` bookkeeping firm, shows the uncovered-industry state from API figures alone (FR-4). Any other `62.100` company gets the full funnel and its API figures compared as normal, and its document-based figures — and any figure that needs its peers' — read "Ikke i demodataene", with an explanation that names no command and promises no full dataset (EXPERIENCE.md); "For få sammenlignbare" is kept for genuine below-floor cases (FR-22). A `62.100` company with no filed accounts in the loaded data shows identification only (FR-25). The README lists the three demo organisation numbers and what each demonstrates.
- **Adding an industry is data, not code.** A stage-3 industry arrives through the pipeline, its own labelled set and measurement, and a seed refresh, with no change to the application or the schema.

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
- **Filings that cannot be read reliably** — paper-form scans, stored as `paper` and never read, and any document refused at reading or failing reconciliation (FR-60) — reported as unavailable, never estimated.
- **Group consolidation across several legal entities.**
- **Ownership and group structure mapping.**
- **Cross-border comparison.**
- **Custom ratio definitions.** The figure set is fixed by `docs/key-figures.md`.

**Excluded key figures**, deliberately, with the reasons from `docs/key-figures.md`: cash flow (small companies are exempt from the statement); gearing, interest cover and return on equity (financing and credit risk, not operations); ROIC (needs interest-bearing debt separated, and operating asset turnover covers most of it); inventory days (arrives with 43.210, where inventory exists).

**Not in v1 mechanically:**

- **Share links that grant access to anyone holding them.** A link is a bearer token: it gets forwarded, pasted into chat and leaked through logs, and it would carry unfiled figures with it unless deliberately excluded. Invitation by email covers the need from stage 2.
- **Payment and subscription handling.**
- **Multi-language support.**
- **Native mobile.** The responsive web interface covers phone width (FR-55).

**Known limitations accepted rather than fixed**, and disclosed rather than silently corrected:

- Receivable days are overstated by VAT by up to 25%: receivables include it, revenue does not. **The distortion is only roughly similar across a peer group, not cancelled by it.** Export sales are zero-rated, so a company selling abroad carries proportionally less VAT in its receivables and shows fewer receivable days for the same real credit terms — and export share varies along precisely the axis the fingerprint separates businesses on. The ratio is therefore comparable only to the extent that peers share a VAT profile, and the comparison is weakest where the peer group is most mixed. Stated, not adjusted. The kroner amount is unaffected by this: `r / 365 × salgsinntekt` is `kundefordringer` by construction, so the conversion returns the real VAT-inclusive balance either way — what the VAT profile distorts is the *target*, not the arithmetic.
- Cost lines may be classified differently between companies — a consultancy booking subcontractors as cost of goods rather than personnel — distorting the split between the three cost shares. Total cost share is shown as a check against this.
- Employee count from Enhetsregisteret is deliberately not used for `aarsverk`: it is today's figure, not the accounting year's. FTEs come from the notes instead, accepting OCR dependency to get the right period. **Not read in v1:** v1 reads the three generated pages, not the notes, so revenue per FTE (7), personnel cost per FTE (8) and the pay-level-versus-productivity view have no input and are shown as absent with that reason (FR-21, FR-26). Reading `aarsverk` is stage 2 (§6.2).

## 6. MVP Scope

Scope comes in three stages, as the brief sets them after the teacher's feedback of 2026-10-06: **v1** is the core flow, built to run on a sensor's machine; **stage 2** and **stage 3** follow if time allows. Every FR carries its stage on its heading line (§0). No stage 2 or stage 3 work starts until v1 runs from a fresh clone (AGENTS.md).

### 6.1 v1

- **One industry: `62.100 Dataprogrammeringstjenester`** (about 1 000 companies with five or more employees), offered once its peer selection has been measured against the labelled set, and covered for the companies whose document figures are in the seed; every other `62.100` company gets stages 1–3, classification and its API figures (FR-3). The document run over the rest of the industry is not part of v1. It is where classification has most to prove, since product companies, consultancies and resellers share one code. Every other industry gets its own API-sourced figures and the uncovered-industry statement (FR-3, FR-4).
- Company lookup by name or organisation number and analysis **without an account**. v1 has no accounts, no account wall and no anonymous sign-in, stores nothing about users, and every tab is open (FR-1, FR-2, FR-42's v1 line).
- Peer group construction across all five stages, with visible filter counts, per-peer inclusion reasons, match-basis flags and user adjustment, carried in the URL (FR-7 to FR-19, FR-69).
- The labelled set and the layer-by-layer measurement against it (FR-70, SM-1, SM-1b).
- Embeddings computed at ingestion **for the SM-1 ablation only**, not user-facing (FR-68). Listed because it is scheduled work that carries a primary success metric; omitting it would drop it from the epics. It is the one v1 item that may be cut, and only last.
- The key figure set in `docs/key-figures.md` with medians, favourable quartiles and percentiles, the minimum group size of 10 peers per key figure, and the two decomposition views (FR-21 to FR-27); key figures 7 and 8 and the pay-level view are shown as absent with their reason, because v1 does not read `aarsverk`.
- Gap quantification in kroner, the margin decomposition against the peer group as a whole, the closable-share control, and valuation at a user-set EV/EBIT multiple (FR-29 to FR-32).
- The written explanation from stored output, with the no-calculation rule enforced by test and running against the stored fixtures (FR-52 to FR-54).
- Data quality and provenance: the per-filing flag, withheld figures, traceability, disclosed data age, source credit under the register's licence, removal of withdrawn companies from stored data (FR-57 to FR-60, FR-64 to FR-66, FR-71).
- A front page with the search field (name or organisation number), analysis in four open tabs, and the public "Slik fungerer Peerless" page (FR-61's front page, FR-62 without *Utvikling*, FR-72).
- Running locally from a fresh clone: local Supabase, the committed demo seed in one command with three named demo companies, the locally generated full seed, AI test mode, no email, and a README of about five commands (FR-73).
- Security for a version without accounts: input validation, server-side secrets, a per-IP rate limit on the open route, and no stored user data (FR-1, FR-6).
- A responsive, Norwegian-language interface from desktop down to phone width (FR-55, FR-56).

### 6.2 Stage 2

In the brief's order; the cut rule below draws from the end of this list.

- **First:** accounts by emailed magic link, with anonymous sign-in, conversion in place, the `is_anonymous` policy boundary, the per-session limit and CAPTCHA (FR-39 to FR-41, FR-47, FR-6's stage-2 part), and workspaces with an owner and invited read-only viewers, isolation and immediate revocation (FR-43 to FR-46) — and with them, row-level security and the authorisation suite (SM-3).
- The account wall (FR-42), including the open sparkline preview with the peer median.
- The portfolio front page (FR-63).
- Saved analyses with history, and the audit log (FR-48 to FR-50), with the saved-analysis parts of FR-64 and FR-66.
- Development over time and sparklines, and the *Utvikling* tab (FR-28, FR-62). **The data is not held back**: multi-year extraction is batch compute that SM-2 measures, not build time; what waits is the interface.
- Own unfiled and year-to-date figures, labelled *Egne tall – ikke levert* and excluded from all aggregates (FR-33 to FR-38, FR-67).
- PDF export, carrying labels, read dates and source credit (FR-51).
- Reading `aarsverk` from the notes, which gives key figures 7 and 8 and the pay-level-versus-productivity view their input (FR-21, FR-26).
- The user-written company description and explanation regeneration for an adjusted group — the two model calls a request can trigger (FR-5, FR-52's stage-2 part).

### 6.3 Stage 3

- **`69.202 Regnskapsføring og bokføring`** (about 800 companies), with its own labelled set and measurement before it is offered. It is the natural control for `62.100`, and the primary user's own industry.
- **`43.210 Elektrisk installasjonsarbeid`**, likewise measured first, and with it inventory days, which `docs/key-figures.md` adds only where inventory exists.
- The industry overviews on the front page (FR-61).

### 6.4 Out of scope

Everything in §5, plus:

- **Investor and portfolio use cases**, which depend on screening and portfolio views that are out of scope.
- **Numeric quality targets.** No source document states a target for peer-selection precision, recall, or OCR accuracy. v1 commits to *measuring and reporting* these, not to hitting a threshold (§9, §11).

**If time runs short:** cut stage 3, then stage 2 from the end of its list, then embeddings (FR-68) — which is why SM-1 reports three layers without them and four with. **v1 is not cut**, and nothing is cut out of order to keep a demo tidy.

**Never cut**, because the project's results rest on them: the **labelled set** (FR-70), the **OCR measurement** (SM-2), and — once stage 2 stores user data — the **authorisation suite** (SM-3).

**Load-bearing for the graded result** — these carry a success metric, and cutting one removes a claim rather than a feature. In v1: FR-7 to FR-16 and FR-70 (SM-1, SM-1b), FR-57 and FR-58 (SM-2), FR-53 (SM-4), FR-21, FR-23 and FR-30 (SM-6), FR-1 (SM-8), FR-73 (SM-9). In stage 2: FR-34, FR-45 and FR-47 (SM-3), which become load-bearing the moment user data is stored, and FR-28, whose view is stage 2 while the extraction behind it is measured by SM-2 in v1.

**Product, not result** — these make Peerless worth using but no success metric depends on them: FR-49 to FR-51, FR-61 to FR-63, FR-26, FR-33 to FR-38, FR-67, FR-52 and FR-54. Most of them are stage 2 or 3, which is why the cut rule reaches them first. The v1 ones — FR-26, FR-52, FR-54, and the front page and tabs of FR-61 and FR-62 — are kept anyway, because they are the core flow a sensor uses and v1 is not cut.

## 7. Cross-Cutting Non-Functional Requirements

**Performance.** Peer group assembly under one second; a complete analysis within a few seconds. Achieved because every figure, profile and peer classification is pre-computed at ingestion — nothing is extracted or recognised during a user request, and in v1 no model call is reachable from a request at all (FR-73). Stage 2 adds exactly two — classifying a user-entered subject description, once per text and cached (FR-5), and explanation regeneration by a signed-in user for an adjusted peer group (FR-52). The OCR pipeline has no interactive budget at all; it is a batch job measured on throughput and accuracy, not latency.

**Correctness of money.** Every monetary value is stored and computed in integer øre, or with a decimal library. No monetary value is ever a float, including intermediate results, because the error compounds across periods. Rounding happens only for display.

**Calculation integrity.** The calculation engine is pure functions — figures in, figures out, no database or framework imports — so it is testable in isolation and readable by someone checking the accounting. It is tested against hand-calculated reference cases from real filed accounts, including negative equity, zero revenue, missing components, and non-calendar financial years. The six reference cases in `test/engine/reference-cases.test.ts` hold no non-calendar year yet; that case arrives in Story 3.1a, where it is asserted excluded by funnel stage 2 and absent from every distribution, never adjusted (FR-8).

**Authorisation.** Enforced in the database by row-level security on every user-scoped table, keyed to workspace membership. The application layer filtering correctly is never sufficient: assume it will eventually fail and make that insufficient to leak data. v1 stores no user-scoped data, so this applies from stage 2. The authorisation test suite is written as soon as user-scoped data exists, before any feature that stores it, and attempts every forbidden pattern — reading another user's data, reaching another workspace including one held by the same owner, an anonymous session reading or writing saved data, a viewer writing, an invited viewer reaching a workspace they were not invited to, and calling an endpoint unauthenticated — asserting rejection in each case.

**Runnability.** A fresh clone runs from the README on a local database with seed data, with no API key, paid account, email or hosted service (FR-73). Anything that would call a model or the register at runtime has a test mode backed by stored output.

**Secrets.** API keys, service-role credentials and database connection strings stay server-side. `.env` is gitignored from the first commit.

**Accessibility and responsiveness.** Usable from desktop down to phone width — designed at 375 px, with 320 px as the floor — with the page body never scrolling horizontally. Wide content scrolls within its own container.

**Architecture boundary with product consequence.** Nothing a user can reach may depend on the Python ingestion pipeline being up. It is a batch job, never a service, and never in a request path.

## 8. Constraints and Guardrails

**Privacy.** The source figures are public filings, so confidentiality attaches to *use*, not to the figures. What is actually private is: which companies a user looked at, their saved analyses, their workspace membership, and their unfiled figures. Security effort goes there rather than to protecting public data. v1 holds none of it — no accounts, no stored lookups, no user-entered figures — so this applies from stage 2. Aggregates are computed only from public filings, so a peer median discloses nothing the filings do not — which is why the minimum group size is a quality threshold and not a disclosure control. Unfiled figures never enter an aggregate, enforced structurally (FR-37).

**Safety of generated text.** The model's two jobs are bounded by construction: classification answers only in fixed categories, and explanatory text is rejected by test if it contains a figure the engine did not compute. User-supplied description text (stage 2) reaches the model only for classification, so text written to steer it cannot change more than the category it lands in.

**Cost.** Bounded by covering one industry in v1 rather than the register. OCR runs once per filing at ingestion and is stored permanently; explanation text is generated once for the default peer group and cached, and v1 makes no model call at request time. Classification (FR-11) is one Batch API call per AS in the covered industry: for `62.100`, 10 326 companies at about $0.54 in total. It runs again only for a company whose text has changed, or for every company when the prompt or the model changes, and never on its own: a changed prompt or model is reclassified only on request. From stage 2, regeneration for an adjusted group sits behind an account and a rate limit (FR-52), and the open route is rate-limited and CAPTCHA-protected so anonymous traffic cannot run up model cost or harvest the register (FR-6).

**Data sourcing.** The free public register interfaces are the only data source in v1 and stage 2. From stage 3, Statistics Norway (SSB) may supply industry context, used only after its licence has been checked and recorded, in the same way as the licence gate for the filed documents (FR-73). The paid multi-year bulk subscription is out of scope on cost grounds, which is why multi-year history comes from the filed documents rather than an API.

**Data freshness.** There is no automatic refresh in v1: the batch job runs when it is triggered. Freshness is therefore disclosed rather than promised — every figure carries its filing year and read date (FR-64). A stored document is never fetched again, so a refiled year is missed until it is re-read (`deferred-work.md`, Story 2.1b). What *is* re-read is a document read by an older version of the reader: every document records the commit of the reader that read it, and `pnpm ingest --reread` replaces it only if the new read loses no reconciled column (Story 2.3b, 2026-10-25). Norwegian annual accounts cluster in a single filing window, so an automatic cadence is a real decision rather than a cron line; it is a blocking item before any public deployment (§11), not a v1 requirement.

**Licence.** The register's open APIs are published under NLOD 2.0, which permits commercial use, modification and redistribution, and requires the source and the licence to be credited and any modification declared (FR-65). It also forbids presenting the data misleadingly or implying the register endorses the product — the same posture §9 and §10 take for other reasons.

**The one licence gap, and it is not small.** The register licences the key-figures API but **not the filed annual-account documents**: on data.norge.no the key-figures distribution carries NLOD while document retrieval reads *"Lisens: Ikke oppgitt"*, and no register page states that the documents are NLOD-covered. Twelve of the fifteen key figures need a component recovered from those documents by OCR, so the gap sits under most of the figure set rather than at its edge. (Two of the twelve, the per-FTE figures, also need `aarsverk` from the notes, which v1 does not read — §5.) Peerless publishes derived ratios and aggregates, never a reproduction of a filing, which is a materially different act — but the distinction is a legal judgement, free access is not a reuse licence (åndsverkloven §§33–34), and nothing in the register's own pages settles it. **Not a v1 blocker** — this is coursework against public data, and the public repository carries document-derived figures for a small sample only (FR-73) — and **a gate before any public or commercial deployment**, where the answer comes from asking Brønnøysundregistrene rather than from reading their website (§11.19). Detail and sources in `docs/data-sources-brreg.md`.

## 9. Success Metrics

Each metric names what it validates. v1 states no quality target for SM-1 or SM-2: it measures and reports. It has one **decision rule**, which SM-1 applies to stage 5 (below), so the measurement can change the product (§11, question 11).

**Primary**

- **SM-1 — What each layer adds.** The headline result is the **layer-by-layer ablation**: precision and recall against the labelled set (FR-70) for each funnel layer standalone and cumulatively — industry code and size alone, adding the accounts-based fingerprint, adding model classification, and adding embeddings if they are built. **Three layers reported, four with embeddings.** The question it answers is how much each layer contributes and, specifically, **whether the model adds anything beyond the accounts-based fingerprint.** That question can genuinely come back "no", which is what makes it the headline. Reported for **`62.100`**, the one industry v1 covers, split by whether the description is informative, with each cohort's share disclosed (§10 states what one industry cannot show). Validates FR-7 to FR-16, FR-70.
- **SM-1's decision rule for stage 5.** Story 5.2 compares *fingerprint alone* with *fingerprint and text* against the labelled set, with `usikker` left out. Stage 5 is kept if the text raises precision by at least 3 percentage points and lowers recall by no more than 3 percentage points. Otherwise the text signal is switched off in the v1 funnel: the group is decided by the fingerprint alone, no peer gets a match basis that rests on the description, and the result is reported as the model not being needed (§10). The rule is decided on all labelled pairs; the blind pairs are also reported on their own.
- **SM-1b — Sanity check against industry code alone.** Precision and recall of the full funnel against the industry-code-only baseline on the same labelled set. This is a **check, not a claim**: the labeller judges comparability on criteria the fingerprint encodes, so the baseline is expected to lose, and its losing confirms the labelling is coherent rather than demonstrating the method works. A result where industry code alone *wins* would mean something is wrong with the funnel or the labelling. Validates FR-70.
- **SM-2 — Recognition accuracy.** Measured against a hand-transcribed reference set of 20 filings drawn from all of `62.100`. **The headline is the number of misread figures that reach the engine** — a misread figure in a column that nevertheless reconciled — because those are wrong figures Peerless would use. Alongside it: the share of figures recovered exactly (each figure classed as correct, not read, misread or phantom) and the share of filings that reconcile. Each is split between recent filings (2023–2025, which the register's key-figures API also holds) and older ones (2021–2022), a boundary set before the comparison ran (Story 2.3, 2026-10-23); paper filings are never read. Result in §10. This measurement decides which document-derived ratios the product can honestly offer and how far back trend can reach. Validates FR-28, FR-57, FR-58.
- **SM-3 — Authorisation.** From stage 2, when user data is first stored. Zero successful forbidden accesses across the full suite, including between workspaces held by the same owner and from an anonymous session against saved data. Validates FR-34, FR-45, FR-47.
- **SM-4 — The model never calculates.** No generated text contains a figure absent from the engine's output, asserted by automated test. Validates FR-53.

**What must be built before each primary metric can be reported.**
- **SM-1:** funnel stages 1–5 (FR-7 to FR-12) and the labelled set (FR-70). Embeddings (FR-68) add a fourth layer and are not required.
- **SM-2:** documents read and stored with a status per column (FR-57) and the blocking rule (FR-58), measured against the hand-transcribed reference set.
- **SM-9:** a complete analysis from an organisation number (FR-1, FR-21 to FR-24), the AI test mode (FR-53) and the README sequence on the committed seed (FR-73).

**Secondary**

- **SM-5 — Latency.** Peer group assembly under one second; complete analysis within a few seconds. Validates FR-20.
- **SM-6 — Engine correctness.** All hand-calculated reference cases pass, including negative equity, zero revenue, missing components and non-calendar financial year; both algebraic identities hold exactly. Validates FR-21, FR-23.
- **SM-7 — Responsiveness.** No horizontal page scrolling at any width from 320 px upwards. Validates FR-55, FR-56.
- **SM-8 — A complete analysis needs nothing but an organisation number** — no account, no upload, no configuration. Validates FR-1, and from stage 2 FR-42.
- **SM-9 — Runs from a fresh clone.** Following the README alone, on a clean machine with no keys, a fresh clone reaches a complete analysis of a seeded company, and the test suite passes, AI test mode included. Validates FR-73.

**Counter-metrics (do not optimise)**

- **SM-C1 — Peer group size.** Do not optimise upward. A larger group containing companies that are not genuine comparables is worse than a smaller correct one, because the product's whole claim is that the group is right. Counterbalances SM-1 and coverage pressure.
- **SM-C2 — Number of figures displayed.** Do not optimise upward. Showing a figure computed over a barely-qualifying set of peers, to avoid an empty row, is a regression — an empty row that says why is the correct output. Counterbalances SM-2.
- **SM-C3 — Share of companies classified.** Do not optimise upward. "Unclassified" is a correct answer, and a classifier pushed to label everything produces confident nonsense on exactly the companies whose descriptions say nothing. Counterbalances SM-1.
- **SM-C4 — Industries covered.** Do not optimise upward. Each industry needs its own measurement before it is offered; an industry added in stage 3 without one would trade the project's central result for apparent breadth. Counterbalances coverage in §6.1.

## 10. Measured Results — the project's central claim

This section exists because Peerless is coursework as well as a product, and the thing being graded is not only whether the software runs.

**The claim under test:** **how much each layer of the funnel adds, and whether reading free text with a model adds anything beyond what the accounts alone already say.** That is the headline, and it can come back "the model was not needed" — which is a real result and one the rules-before-model principle actively predicts.

**Why the claim is framed that way, and not the other way.** The obvious framing — "reading what a company does beats industry classification alone" — **cannot fail under this protocol, so it is not the headline.** The labelled set is judged by the person who designed the method, or, for most pairs in v1, by a model that person checked (FR-70), on the same criteria the fingerprint encodes: cost composition, inventory, asset intensity, what the business actually is. Industry code demonstrably does not capture those criteria, so it must lose. Blinding the labeller to which funnel stage proposed a candidate removes *provenance* bias; it does not remove the circularity of the criterion itself. That comparison is kept as **SM-1b, a sanity check** — if industry code alone won, something would be wrong — but a check that is expected to pass is not a finding.

**What makes the headline claim measurable:**

- The labelled set of FR-70, to a stated sampling frame: 30 subjects in `62.100`, 30 candidates each drawn **at random from the subject's size band rather than from the funnel's output**, so a comparable the funnel never proposed still counts against recall. Roughly 900 judgements, from week 1.
- **What one industry can and cannot say.** With v1 covering `62.100` only, the result says whether the model adds anything within that industry, where codes are most heterogeneous. It can no longer contrast an industry like that against a homogeneous one such as `69.202`, and so cannot say *when* the model earns its place; that contrast comes with stage 3, each industry with its own set.
- **Three defences against the circularity**, none of which fully removes it and all of which are reported: the labelling rubric is written and dated **before** the fingerprint's feature list is fixed; a **subsample is labelled from description and website only, blind to the accounts**; and a **second labeller judges about 50 pairs with Cohen's κ reported**. v1 has the first two; the third is stage 2 and its absence is stated with the result (FR-70).
- **Layer-by-layer ablation:** each layer scored standalone and cumulatively, so the result shows where any improvement comes from — rules, or the model. Stratified by description quality, because the model can only help where there is text to read, and pooling the cohorts would hide that.

**Anticipated findings that are results, not failures:**

- If the accounts-based fingerprint alone captures most of the improvement, **the model was needed less than expected.** That is a finding worth reporting, and the rules-before-model principle predicts it.
- If embeddings do not measurably beat model classification, classification stays. Embeddings replace it only on evidence.
- Description quality is currently a word-list proxy, not a measurement: at most 56% of descriptions in 62.100, 38% in 69.202 and 50% in 43.210 appear specific, and the true share is lower. Hand-scoring converts this estimate into a measurement; in v1 it covers `62.100`, and `69.202` and `43.210` when stage 3 adds them.

**Will there be anything to compare against?** This had been asserted rather than computed: the PRD set a floor of 10 peers per key figure without knowing how often it would be cleared once comparability, the size band and the reconciliation rate had all taken their cut. Computed by `analysis/peer_group_yield.py` from the screening samples, reported in `analysis/output/peer-group-yield.md`. `69.202` is stage 3; its rows stay as the evidence it was screened on:

| Industry | Stage reached (default 0.5–2× band) | Median peers | Q1 | Share clearing 10 |
|---|---|---|---|---|
| `62.100` | comparability + size band, API figures | 253 | 101 | 99 % |
| `62.100` | × 88 % reconciliation, document figures | 223 | 89 | 97 % |
| `62.100` | ÷ 3 for classification, document figures | 74 | 30 | 88 % |
| `69.202` | comparability + size band, API figures | 422 | 251 | 99 % |
| `69.202` | × 88 % reconciliation, document figures | 372 | 221 | 99 % |
| `69.202` | ÷ 2 for classification, document figures | 186 | 110 | 99 % |

**The funnel is not the binding constraint, and that was worth checking rather than assuming.** Even after reconciliation and a divide-by-three for classification, the typical `62.100` subject has around 74 qualifying peers and 88 % of subjects clear the floor. These are upper bounds — the computation applies stages 1 and 2 plus the size band, and stands in for stages 3 to 5 with a crude division — so the real figures are lower, but not by the order of magnitude that would make below-floor rows the normal case.

**Two corrections since the table was computed (2026-11-04).**
- **The reconciliation rate is measured now, and it is per field.** The table's 88 % is the spike's rate. The Story 2.1b run reconciles about 94 % of current columns after Story 2.3b, but a reconciled column can still lack a line no check needs (FR-28): `lonnskostnad` is present in 82 % of current columns and `avskrivninger` in 72 % (after Story 2.5c). For figures built on those lines the yield is lower than the table says, and the table is not recomputed per field.
- **The claim holds for subjects that can have a group, and many cannot.** In the seed, 3 346 of 8 299 covered AS subjects (40 %) have no positive revenue in their benchmark filing, so they have no size band and no peer group at all (FR-7); 308 have a non-calendar year (FR-8). The screening samples behind the table did not count them. For those subjects the empty group is correct behaviour and says why — but "88 % clear the floor" describes the subjects that can be compared, not every company a user can look up.

**What does fail is narrower and sharper: a subject that is not `smaaForetak`.** `smaaForetak` is a comparability field and therefore a hard exclusion (FR-8), so such a company can only be compared against others like it — and there are very few. In `62.100` they are 8 of 93 comparable companies (about 9 %, or 81 in the population), and they still find a median of 25 peers among themselves. In `69.202` (stage 3) there is **1 in a sample of 99** — about 8 companies in the entire industry — so **a large accounting firm gets no peer group at all**, and FR-22 will withhold every aggregate for it. That is correct behaviour and a real coverage limit, and it is stated here rather than discovered by the first such user. `[ASSUMPTION]` The share is per industry and not a single figure: 9 % in `62.100` after comparability, 1 % in `69.202`.

**SM-2, measured (Story 2.3, re-run after Story 2.5c; `analysis/output/ocr-sm2.md`, 2026-11-07).** Against 20 hand-transcribed filings:
- **Misread figures that reach the engine: 0** after the transcriptions were corrected (7 before: a blind check against the PDFs found 6 transcription errors, and 1 more was found later; every correction moved the transcription towards what OCR read). Phantom figures in reconciled columns: 0.
- **Recovered exactly: 89.9 %** of 804 counted figures — 92.5 % in recent filings, 85.7 % in older ones. Almost all the rest are *not read* (79) rather than misread (2): a line the reader leaves empty, which the engine treats as absent, not zero.
- **Filings reconciled: 17 of 20** — 12 of 12 recent, 5 of 8 older.
- **What it does not show.** Twenty filings bound nothing tightly: a misread on a line no check covers can still reach the engine (FR-58), and the sample found none. Recent and older groups are too small to compare, so the split is reported, not interpreted.

**Honest framing of the market claim.** No Norwegian product found assembles a matched peer group *and* converts deviations to kroner self-serve for the company itself; incumbents lead with credit-risk framing. Re-checked 2026-11-04 against six further names (`research-landscape.md` §7): the closest, Empirion Performance, benchmarks public accounts self-serve against up to 250 comparable companies, but the user searches out the set and no kroner amount is described. But the gap sits between two well-funded adjacent categories rather than in an empty market, and the brief is candid that there is no moat: the data is public, the ratios are textbook, and the advantage is framing and execution only.

## 11. Open Questions

Numbers are stable: an answered question keeps its number so the decision trail in `.memlog.md` stays resolvable.

**Answered**

1. **Course requirements.** No fixed user roles are required. Nothing must be delivered before coding, but BMAD requirements must be met. The product brief is due 2026-09-27.
2. **Interface language.** Norwegian (bokmål). All documentation stays English.
3. **Team size.** Solo.
4. **Is `43.210` committed for v1?** No *(2026-09-26)*. Superseded 2026-10-10 by the teacher's feedback of 2026-10-06 and the user's decision: v1 covers `62.100` only, and `69.202` and `43.210` are stage 3 (§6.3), each measured before it is offered. Inventory days stay out of the key figure set until `43.210` arrives.
5. **A default or range for the EV/EBIT multiple.** None. The field starts empty and implied enterprise value is not shown until the user enters a multiple, so the product never implies a valuation it did not receive (FR-32). *(2026-09-26)*
6. **Median or favourable quartile as the reference point.** The favourable quartile is the target at every setting of the closable-share control, and the control scales the gap to it — no kroner at zero, full convergence at full closure. The median is shown in every distribution and marked on the control so the user can see where the typical peer sits, but never enters the arithmetic (FR-31). `docs/key-figures.md` was corrected in the same change; its previous wording admitted a reading in which zero closable share still produced the whole gap to the median. *(2026-09-26)*
7. **Which figures a user may hand-enter as unfiled.** Four required components — revenue, operating profit, total assets, total equity — with the document-sourced components optional (FR-38). *(2026-09-26)*
8. **User-facing behaviour below the minimum group size.** The row persists and still shows the company's own value; the aggregate cells state how many comparable values exist against the ten required, and no kroner amount is produced (FR-22). *(2026-09-26)*
9. **Cash share** — a diagnostic, not a numbered key figure. Shown as context, never ranked, no kroner translation (FR-21). *(2026-09-26)*
10. **How many years of trend can honestly be promised** — five (2021–2025), from measurement. See `docs/data-sources-brreg.md`. *(2026-09-26)*
11. **Target thresholds for precision, recall and OCR accuracy.** v1 has a decision rule, not a quality target (§9): stage 5 is kept only if the text raises precision by at least 3 percentage points and lowers recall by no more than 3, measured in Story 5.2; otherwise the text signal is switched off (FR-11). No threshold is set for precision, recall or OCR accuracy as such, because one set before the baseline exists would be a guess. *(2026-11-13)*
15. **Cache lifetime for fetched public data.** Resolved as disclosure rather than cadence: every figure carries its filing year and the date the data was read (FR-64), and the batch refresh is triggered manually in v1. An automatic cadence is a pre-deployment gate, below. *(2026-09-26)*
16. **Attribution and terms-of-use obligations for register data.** Superseded rather than dropped: researched 2026-09-26, which split it into the attribution duty (now FR-65, settled) and the document-licence gap (now question 19, open). Kept here because question numbers are stable.
17. **Whether unfiled figures may ever enter a group aggregate.** Never, enforced structurally (FR-37). Closed in the technical note as well.
21. **Lines no reconciliation check covers.** A misread `bankinnskudd`, `kundefordringer`, `salgsinntekt` or `leverandorgjeld` could reach the engine in a reconciled column (FR-58). Answered by Story 2.5c (Meinich, 2026-11-06, R1 and R3): the width rule at reading applies to every figure, these four included, and refuses a digit token too narrow for its digits (a leading digit read as two, the error the probe found). In addition, a current-year `kundefordringer` or `bankinnskudd` above the key-figures API's `sumOmloepsmidler` of the same filing + max(5 kr, 0.001 % of it) is absent in the engine with a named reason (`exceeds_api_subtotal`; `docs/key-figures.md`), since a part cannot exceed its sum (the line or the subtotal is wrong); not for a prior-year column, nor for the two lines together. `salgsinntekt` and `leverandorgjeld` get no part-against-sum rule: in 40 of 56 current 2.1b columns where `salgsinntekt` exceeds sum driftsinntekter, a negative "Annen driftsinntekt" makes that genuine (`analysis/output/cost-sum-probe.md`). Nothing is shown as unverified. *(2026-11-06)*
22. **What v1 ships on, and the two pieces of work no story owned.** v1 ships on the demo data (FR-73), with everything already read: the documents in the seed (the demo companies and the OCR reference set), and the labelled set's local documents and fingerprints, which Story 5.2 measures against. `62.100` counts as covered for the companies in the seed, measured against the labelled set; every other `62.100` company gets stages 1–3 and classification (FR-3, FR-59). The document run over the rest of `62.100` (about 190 hours) is not part of v1; `pnpm ingest --documents <list>` performs it later with no new code (FR-28). Reading `aarsverk` moves to stage 2, so key figures 7 and 8 and the pay-level view are absent in v1 with that reason (FR-21, FR-22, FR-26, §6.2). Decided by Meinich on Bård Pettersen's PRD feedback (2026-11-12, point 4.2). *(2026-11-13)*
24. **The match basis of an undetermined peer.** The match basis names the signals that took part in keeping a peer in the group, and a signal counts only when it gives a business type for both the subject and the peer (FR-16). An undetermined fingerprint, the model's `uklart` and a subject with no type give no basis: a fingerprinted peer with no type is *industry and size alone* unless its text counts. A flagged peer is *description and accounts*, with its tag. The basis depends on the subject and is not stored. Decided by Meinich. *(2026-11-13)*

**Gated on measurement** (answers arrive from work already scheduled)

12. **Which fingerprint features are used, and whether cost of goods share or personnel cost share enters selection at all.** The first half is answered (Story 2.5, Meinich 2026-11-01): five categories with fixed band edges and a fixed rule to a business type (FR-10), set before any share was seen. The within-band spread test passed for all six cost-share bands on the 420 companies fingerprinted before the labelled set's document run, the lowest at 5.0 pp (FR-13). What remains open is whether each band **earns its place**, which is measured against the labelled set in Story 5.2; a band that fails goes to the product owner rather than being dropped automatically.
13. **How much autonomy the model has in accepting or rejecting a candidate.** The second half of this question is answered (2026-09-30): all six comparability fields are hard exclusions and none is loosenable (FR-8), and FR-18's loosening reaches the size band and segmentation only. The first half is answered too (Story 2.6, 2026-11-08): the model only assigns each company a type from the fixed set, or `uklart`; rules compare it with the subject's, a disagreement with the fingerprint is flagged and never decided by the model (FR-14), and stage 5 stays only under SM-1's decision rule (§9).
14. **OCR field names.** All ten OCR-sourced field names in `docs/key-figures.md` are marked provisional until confirmed against a real filing.

**Open from the build** (added 2026-11-04, when this PRD was brought in line with Epics 1–2)

23. **Does a dissolved company stay a peer?** Nothing in the request path reads `slettedato` yet, so a dissolved company remains a candidate and its filings count in aggregates (FR-66; `deferred-work.md`, Story 2.4).

25. **Whether an index-only migration counts as a schema change for "adding an industry is data, not code" (FR-73).** `deferred-work.md` plans an index on `naeringskode1`, a migration, for when a second industry is covered. Owner: stage 3.

**Pre-deployment gates** (not v1 requirements; blocking before anything is public)

18. **Automatic refresh cadence.** v1 refreshes manually and discloses the read date (FR-64, §8). A public deployment needs a real cadence, and Norwegian annual accounts cluster in a single filing window rather than arriving evenly, so the answer is a schedule shaped to that window rather than a fixed interval. Revisit when a deployment is actually planned.
19. **May the filed annual-account documents be reused the way Peerless reuses them?** Researched 2026-09-26, and this is the part that did not resolve. The APIs are NLOD 2.0 and the attribution duty is now a requirement (FR-65), but the documents themselves carry no stated licence, and twelve of fifteen key figures come from them. Deriving ratios is not reproducing a filing, and free innsyn is not a reuse licence (åndsverkloven §§33–34) — the register's pages do not reach the question. **The answer comes from asking Brønnøysundregistrene, not from more searching.** Blocking before any public or commercial deployment; not blocking the coursework. See `docs/data-sources-brreg.md` and §8.
20. **Whether the paid subscription's framework agreement restricts redistribution.** Unverified — the agreement document was not read, and the tier is out of scope on cost grounds anyway. Matters only if the paid tier is ever revisited.

## 12. Assumptions Index

Every `[ASSUMPTION]` in this document, for explicit confirmation:

- **§2.3, names and illustrative figures only** — the four situations are captured and confirmed, but the protagonists' names are invented, and each subject company's own margin is invented because no real subject exists. The peer statistics around them are real screening figures, standing in for a narrower peer group.

- **§10, non-small subjects** — the share of companies that are not `smaaForetak` is per industry, not one figure: about 9 % in `62.100` after comparability and about 1 % in `69.202`, from the screening samples.

**Resolved, kept for the trail:**

- **§9** — no quality target for SM-1 or SM-2; v1 has a decision rule for stage 5 instead (2026-11-13, question 11).
- **§4.3, FR-28** — trend depth: five years, from measurement (2026-09-26).
- **§4.5, FR-38** — the hand-entered set is confirmed, not inferred (2026-09-26).
- **§6** — `43.210` confirmed out of MVP (2026-09-26); since 2026-10-10 v1 covers `62.100` only, with `69.202` and `43.210` in stage 3 (§6.3).
- **Interface language** — Norwegian (bokmål) (2026-09-26).

---

*Assembled by `bmad-prd` on 2026-09-25 from the brief, the technical note, `docs/key-figures.md`, `docs/data-sources-brreg.md`, `analysis/output/industry-screening.md` and landscape research. Decision trail in `.memlog.md`.*
