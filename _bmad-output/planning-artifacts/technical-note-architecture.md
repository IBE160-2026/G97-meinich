# Technical note: architecture — Peerless

Supplements the product brief. Data sources are documented separately in `docs/data-sources-brreg.md`.

---

## Guiding principles

**The engine calculates, the model explains.** The language model is used for two things: classification of business activity, and explanatory text. It must never perform arithmetic. The boundary is enforced in code and verified by an automated test that rejects generated text containing figures absent from the engine's output.

**Rules first, model on the remainder.** Where a problem can be solved deterministically, it is solved deterministically. The model receives only the cases the rules do not cover. Both layers are measured separately, and the difference between them is the project's central AI result.

**Authorization in the database, not in the code.** Row-level security means a fault in the application layer is not sufficient to leak data across users.

---

## Data ingestion

**Bulk download.** Company data and key figures are loaded in bulk per industry. This is free and fast, and covers the first three stages of the funnel.

**Documents are extracted ahead of use, not on demand.** OCR takes seconds to tens of seconds per filing, so it cannot run inside a user request. A batch job pre-warms every covered industry before they are available in the product, and the result is stored permanently. Lazy on-demand extraction was the original design; it is not viable once extraction means OCR.

This bounds the cost by the size of the covered industries rather than by the register, which is why coverage is added industry by industry, each only once it is measured.

**The subject of the analysis** is always extracted in full detail across several years, since it is a single company.

**History is fetched every other year**, because each document carries a prior-year column.

---

## Document extraction

**The filed documents contain no text layer.** Every page of every filing served by the register is a single full-page raster image — verified on 264 pages across all 15 available years for the primary test company. There is no rule-based text extraction path, because there is nothing to parse. Full evidence in `docs/data-sources-brreg.md`.

Extraction is therefore an OCR pipeline: render the page at high resolution, recognise words with their bounding boxes, group them into rows and columns by position, then parse the numbers. Extraction targets the Brreg-generated section, which is three pages with a layout identical across all companies. That fixed layout is what makes this tractable — column boundaries are calibrated once and reused, rather than inferred per document.

**Every extracted figure is checked twice, under two different rules, and neither is exact equality.**

*Within* the document, a tight absolute bound of a few kroner. The register presents whole kroner rounded from underlying øre, so a stated subtotal can legitimately differ from the sum of its components by a krone — verified on three subtotals in the primary test filing. Demanding exactness would reject valid filings.

*Between* sources — the document against the API's key figures — a proportional tolerance, because companies reporting in thousands or millions introduce real scaling error.

The distinction matters because the two error scales are so far apart. The filing's own rounding is a krone or two; recognition errors observed in the feasibility spike were wrong by orders of magnitude. An absolute bound of a few kroner admits the former and catches the latter, while a proportional tolerance would hide both.

A failure blocks the filing rather than degrading the analysis silently.

**The data quality flag is derived from these arithmetic checks, not from recognition confidence.** A generic engine reported mean confidence 0.974 on these pages while misreading several figures; confidence is not a signal here.

**A first feasibility measurement exists and the premise holds.** On a recent filing, untuned and with a generic engine, 11 of 14 authoritative figures were recovered exactly, and position-based row grouping reconstructed label-to-value rows correctly across both year columns. All remaining failures were digit assembly rather than recognition, which is code we control. Detail and headroom in `docs/data-sources-brreg.md`.

**The older filings are measured, and the answer is five years.** Paper filings have no generated section and are never read; they are a small remainder before 2014. The generated section keeps its fixed layout back to 2011. Read twice — plain, then digits-only where the plain read gave nothing — and kept only where it reconciles, about 88 % of columns verify for 2021–2025 and about 60 % for 2011–2016, with 71 of 71 figures agreeing with the key figures API. Development over time in v1 therefore covers 2021–2025. Older generated years are used where they reconcile, not promised. Detail in `docs/data-sources-brreg.md`.

---

## Industries covered first

**62.100 Dataprogrammeringstjenester and 69.202 Regnskapsføring og bokføring**, chosen from the screening in `analysis/output/industry-screening.md`.

62.100 is where classification has most to prove. With five or more employees there are about 1 000 companies, and their operating margins run from −46 % to +9 % between the first and third quartile. Loss-making product companies and profitable consultancies share one code. 69.202 is the control. About 800 companies, 93 % describing core bookkeeping, and margins within 12 points. If classification lifts precision substantially in 62.100 and little in 69.202, that is a result about *when* the model earns its place, not only that it does. 69.202 is also the primary user's own industry.

43.210 Elektrisk installasjonsarbeid is the likely third. It is the largest population, and receivables and inventory put the OCR-derived ratios to work.

---

## Peer group — a five-stage funnel

1. **Coarse filter**, rules. Industry code and size band. Hundreds of thousands → a few hundred.
2. **Comparability filter**, rules. Currency, accounting rules, `smaaForetak`, `avviklingsregnskap`, accounting period, `regnskapstype`. All exposed as fields in the API.
3. **Segmentation**, rules. Size, legal form, geography where the industry calls for it. → under a hundred.
4. **Business-model fingerprint**, rules. Reads what kind of business a company is from its own accounts: cost of goods sold as a share of revenue, whether it carries inventory, capitalised intangible assets such as self-developed software, fixed-asset intensity, with cost of goods share and personnel cost share in coarse bands. A reseller, a product company and a consultancy separate here even when all three describe themselves as "Programvareutvikling." Works for every company whose accounts are extracted.
5. **Classification**, model. Reads the company name, secondary industry codes, the statement of purpose and the business description, and judges whether the candidate is the same type of business. Where the text and the fingerprint disagree, the candidate is flagged rather than resolved by either. A company with nothing to classify on is stored as unclassified, not guessed at, and can still be a peer on stages 1–4.

**Never select on what is being benchmarked.** If peers were chosen for having a similar margin, every margin gap would be close to zero and the analysis would show nothing. The fingerprint therefore uses only features that say *what kind* of business a company is, never *how well* it is run: no margins, returns or productivity. Cost of goods share and personnel cost share are both business-model markers and benchmarked ratios, so they enter selection only in coarse bands and are benchmarked within the band. That is a deliberate trade-off, recorded under decision points.

**The subject can be described by the user.** The subject is the one company whose classification matters most, and the user knows what it does. An optional sentence entered by the user takes precedence over the register's description for the subject. It belongs to the workspace, and for anonymous sessions it is used for that analysis and not stored. It is sent to the model only to classify, and the model can answer only with fixed categories, so text written to steer the model cannot change more than the category it lands in.

Classification runs once per company at ingestion, never at search time. The one exception is a description the user enters for the subject: it is classified once, when entered, and the result is cached against that text and rate-limited with the open route. No peer is ever classified at search time. Each company is stored with a structured profile: what it does, B2B or B2C, manufacturing, trade or services, capital intensity. A search then becomes an ordinary database query.

Each peer's inclusion reason is generated deterministically from the profile fields it shares with the subject, and states what the match rests on: description and accounts, accounts alone, or industry and size alone. The model classifies; it does not write the justification.

**Measured layer by layer.** Each stage is scored against the labelled set on its own and in combination: industry code and size alone; adding the fingerprint; adding text through embeddings (stored with pgvector in the same Supabase Postgres, no separate vector service); adding text through model classification. The report then shows where the improvement comes from, not only that there is one. If the fingerprint alone captures most of it, that is a finding: the model was needed less than expected. Embeddings replace classification only if they measurably beat it.

The user sees how many companies remain after each stage and can loosen a criterion when the group becomes too small.

---

## Calculation engine

Every key figure, its source, direction and translation to kroner is defined in `docs/key-figures.md`; the engine implements exactly that document.

Pure functions with no dependency on the database or the framework. Figures in, figures out. Tested in isolation against reference cases with hand-calculated expected values.

Money is handled as integers in øre, or with a decimal library. Never floating point.

Deviating or changed financial years are excluded or adjusted explicitly.

---

## Pages

**Front page.** A short description of Peerless and the organisation-number field. Below it, an overview of each covered industry: the median margin over time, the spread in personnel cost share, the share of companies growing. Overviews show aggregates only, never named companies, are computed by the same engine from the same stored figures, and follow the minimum group size. Named rankings are out of scope: a top list collects recognition errors and small-base outliers, and a wage-share ranking misleads wherever subcontractors are booked outside payroll.

**Analysis tabs.** Overview, peers, key figures and gaps, development over time, and value.

**Portfolio front page.** A signed-in user's front page lists every company they follow, with its latest position, what has changed since the last filing and the largest gaps. It reads saved analyses only. User-arranged widgets are deferred.

---

## Access control

**Anonymous sessions.** A visitor without an account gets a Supabase anonymous sign-in, so every request still carries a real `auth.uid()`. There is one access model, not two: row-level security, the audit log and rate limiting all work unchanged. When the visitor registers, the anonymous user is converted in place and keeps what it did.

**The trap:** anonymous users hold the `authenticated` Postgres role. A policy that only checks for an authenticated user admits them. Every policy on saved or user-entered data must also require `is_anonymous` to be false in the JWT, and the authorisation tests include an anonymous attacker.

**Workspaces.** Saved work belongs to a workspace. Membership carries a role, `owner` or `viewer`. Row-level security keys every user-scoped table to workspace membership. An adviser is a user with many workspaces; there is no adviser role.

**Invitation** is by email, into a single workspace, as viewer. Share links are out of v1.

**The account wall.** Open to anyone: the front page and industry overviews, lookup, the peer group and its adjustment, key figures, percentiles, gaps in kroner, the closable-share control and valuation. Needs an account: development over time, the decomposition views, PDF export, saved analyses and history, favourites, unfiled figures, workspaces, invitations and the portfolio front page.

**A user's own unfiled figures** live in their own table, keyed to a workspace. The owner writes, viewers read, anonymous sessions never read. Aggregate queries read only the tables holding filed accounts, so leaking unfiled figures into a peer median would require changing the query, not forgetting a filter. Removing a member revokes access immediately, since every policy goes through membership. When the filing for the same year arrives, it takes precedence and the user-entered figures are kept only as history.

**Minimum group size: 10 peers** before any aggregate is shown, counted per key figure after companies with an undefined value are left out. This is a quality threshold, not a confidentiality control: aggregates are computed only from public filings.

**The open route** is rate-limited per session and per IP, with a CAPTCHA on anonymous sign-in, to stop register harvesting. The explanation text depends only on public figures and the peer group, so it is cached per company and peer group rather than generated per visit.

**The audit log** is append-only, with actor, timestamp and prior state. Anonymous actors are logged by their anonymous id.

---

## Test strategy

**Authorization tests** are written in week two. They attempt every forbidden access pattern and expect rejection: across workspaces, including those held by the same owner; an anonymous session reading or writing saved data; a viewer writing; an invited viewer reaching a workspace they were not invited to.

**Reference cases** for the engine: real filed accounts with hand-calculated expected values, including edge cases — negative equity, zero revenue, missing components.

**OCR accuracy, measured against a hand-transcribed set.** For a sample of filings, every figure in the generated section is transcribed by hand, and the pipeline's output is compared against it field by field. Reported as the share of figures recovered exactly, and separately as the share of filings passing the internal consistency check, split between recent filings and older scans. This is the measurement that decides which document-derived ratios the product can honestly offer.

**A labelled classification set:** for a selection of companies, a human judgement of which candidates are genuine comparables, made without seeing which stage of the funnel proposed a candidate, since the labeller also designed the method. Measured as precision and recall against industry code alone as the baseline, and reported per industry: an industry is offered in the product only once its own measurement exists. The set is stratified by description quality, so precision and recall can be reported separately for informative and uninformative descriptions, and reported for each layer of the funnel.

**Synthetic cohorts** at and below the minimum group size, to test that no aggregate is shown below it.

**An automated test** that rejects generated text containing figures outside the engine's output.

---

## Stack

**The application:** Next.js and TypeScript. Supabase for PostgreSQL, authentication and row-level security, with pgvector for embeddings. An LLM API for classification and explanation.

**The ingestion pipeline:** Python, managed with `uv`. Renders and OCRs the filed documents, and loads company data and key figures in bulk. Tesseract requires a system binary, so the pipeline is containerised; this is also what makes it reproducible outside the machine it was written on.

**The boundary between them is deliberate and it is not a matter of taste.** Python never serves a user request. It writes to Postgres as a batch job and is never in the request path. Everything a user can reach goes through Next.js, where the user's own token reaches the database and row-level security enforces access.

That is the whole rationale. Authorization is what this project is assessed on most strictly, and row-level security is a stronger guarantee than per-endpoint checks because a fault in the application layer is then not sufficient to leak data. Introducing a second request-serving service would mean forwarding the user's identity through it correctly on every path — and getting that wrong once means queries run with the service role and row-level security is silently bypassed. Python is used where it is genuinely the better tool, which is OCR and document processing, and nowhere that weakens that guarantee.

---

## Performance targets

Peer group assembly under one second, since it reads stored key figures and profiles.

A complete analysis under a few seconds, because it reads stored figures for every company involved — the subject included. The subject must be in a covered industry to be analysed at all, and covered industries are fully pre-warmed, so no recognition happens at query time. No documents are fetched or OCR'd during a user request, for the subject or for peers. The only model call a request can trigger is classifying a user-entered subject description, once per text.

The OCR pipeline has no interactive budget. It runs as a batch job and is measured on throughput and accuracy, not latency.

---

## Schedule

Thirteen weeks.

| Week | Content |
|---|---|
| 1 | Data model, anonymous and magic-link authentication, workspaces. ~~Extend the OCR spike to the older scans~~ — done before week 1 |
| 2 | Row-level security, authorization tests |
| 3 | Bulk download from the registers, key figures ingestion |
| 4 | OCR pipeline: render, recognise, position-based row and column grouping |
| 5 | Number parsing, the two reconciliation rules, data quality flags |
| 6 | OCR accuracy measurement against the hand-transcribed set; buffer |
| 7 | Calculation engine with reference cases |
| 8 | Fingerprint and classification, the funnel, structured company profiles |
| 9 | Labelled set complete, measurement against the industry-code baseline |
| 10 | Embeddings; layer-by-layer comparison |
| 11 | Invitations, rate limiting, peer group adjustment, saved analyses, portfolio front page |
| 12 | Valuation control, explanation layer, export, front page with industry overviews, analysis tabs, responsive interface |
| 13 | Security report, threat model, AI documentation |

**The OCR question was answered before week one.** Five years of development over time, paper filings never read, older generated years where they reconcile. What remains is exact accuracy against a hand-transcribed set, which runs alongside the code.

**Two pieces of manual work start early and run alongside the code**, because they are calendar work rather than coding work and they are what the project's results rest on: the hand-transcribed OCR reference set, and the labelled classification set. Deferring either to the week it appears in the table above is how they end up too small to report.

**If time runs short, cut in this order:** the portfolio front page, then the industry overviews, then the third industry. Never the labelled set, the authorisation suite or the OCR measurement — they are what the project's results rest on.

**An AI log** (`docs/ai-log.md`) is kept from week one: what was asked for, what came back, what was wrong, how it was caught. Particular attention to authorization checks proposed in the client rather than on the server, floating point applied to money, and parsers that read an empty element as zero.

---

## Course requirements — IBE160

Kept out of the product brief, which follows the template provided. Collected here for internal use.

**Difficulty: hard.** Four processing stages with a defined data flow, integration against external public APIs, extraction from documents, a statistics engine computing distributions over dynamically assembled groups, a model-based classification stage whose accuracy determines the result and is measured against a baseline, an open anonymous route that must resist harvesting while sharing one access model with registered users, per-workspace roles with invitation and isolation between workspaces, and database-enforced multi-tenancy.

**Security/login: yes, strictly.** The filed accounting figures are public and are not protected. What is protected is what the solution adds on top of them: the user's unfiled figures, and the user's activity and saved analyses — which reveal strategy for an investor and a client list for an adviser. Concretely: anonymous sessions separated from registered users within one access model, per-workspace roles with isolation between workspaces enforced by row-level security in the database, invitation by email, rate limiting on the open route, an audit log, and automated authorization testing.

**Online purchase/sale: no.** Not within the scope of this version.

**Data in.** Key figures from filed annual accounts and company data — industry code, employees, registration date, business description — from public registers. Annual accounts as documents. The user's own unfiled figures. Adjustments to the peer group. The share of the gap to be closed, and the valuation multiple.

**Data out.** Industry overviews for covered industries, without named companies. Key figures for the company across the years available. The distribution within the peer group with median and favourable quartile (upper or lower, by the direction of the key figure). The company's position on the distribution per key figure. Decomposition of return into margin and asset turnover. Each deviation quantified in kroner. Profit uplift, released capital and implied enterprise value at the chosen closable share. A data quality flag per filing. Explanatory text with traceable figures. PDF export. Audit log.

**Decision points.** How much autonomy the model has in accepting or rejecting a peer group candidate. Which comparability criteria are hard exclusions and which are merely flagged. The minimum group size, weighed against coverage in thin industries — set at 10 peers. Whether the explanation layer is ever allowed to calculate, and how the boundary is enforced rather than merely instructed. Which key figures are included and how each is defined — settled in `docs/key-figures.md`, including EV/EBIT as the valuation basis. Whether the reference point is the median or the favourable quartile. How long fetched public data is cached, against the risk of showing stale figures. Whether a user's unfiled figures may ever enter a group aggregate — settled: never, enforced structurally. What an anonymous session may do, and where the account wall sits. Which fingerprint features are used, and whether personnel cost share — also a benchmarked ratio — enters at all, in bands, or not.
