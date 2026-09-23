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

**What is still unmeasured is the older paper-form scans**, which are visibly far worse than recent filings. Their accuracy determines how far back multi-year trend can honestly reach, and it is measured before that reach is promised.

---

## Industries covered first

**62.100 Dataprogrammeringstjenester and 69.202 Regnskapsføring og bokføring**, chosen from the screening in `analysis/output/industry-screening.md`.

62.100 is where classification has most to prove. With five or more employees there are about 1 000 companies, and their operating margins run from −46 % to +9 % between the first and third quartile. Loss-making product companies and profitable consultancies share one code. 69.202 is the control. About 800 companies, 93 % describing core bookkeeping, and margins within 12 points. If classification lifts precision substantially in 62.100 and little in 69.202, that is a result about *when* the model earns its place, not only that it does. 69.202 is also the primary user's own industry.

43.210 Elektrisk installasjonsarbeid is the likely third. It is the largest population, and receivables and inventory put the OCR-derived ratios to work.

---

## Peer group — a four-stage funnel

1. **Coarse filter**, rules. Industry code and size band. Hundreds of thousands → a few hundred.
2. **Comparability filter**, rules. Currency, accounting rules, `smaaForetak`, `avviklingsregnskap`, accounting period, `regnskapstype`. All exposed as fields in the API.
3. **Segmentation**, rules. Size, legal form, geography where the industry calls for it. → under a hundred.
4. **Classification**, model. Reads the statement of purpose and the business description and judges whether the candidate is the same type of business. A company whose description gives nothing to classify on is stored as unclassified, not guessed at. It can still be a peer, matched on stages 1–3 only, and the inclusion reason says so.

Classification runs once per company at ingestion, never at search time. Each company is stored with a structured profile: what it does, B2B or B2C, manufacturing, trade or services, capital intensity. A search then becomes an ordinary database query.

Each peer's inclusion reason is generated deterministically from the profile fields it shares with the subject. The model classifies; it does not write the justification.

**Embeddings as a measured baseline, not the method.** Business descriptions are embedded once at ingestion and stored with pgvector in the same Supabase Postgres — no separate vector service. This gives the middle level of the three-level comparison: industry code alone, embedding similarity, and model classification, each scored against the labelled set. Embeddings become part of the funnel only if they measurably beat classification.

The user sees how many companies remain after each stage and can loosen a criterion when the group becomes too small.

---

## Calculation engine

Pure functions with no dependency on the database or the framework. Figures in, figures out. Tested in isolation against reference cases with hand-calculated expected values.

Money is handled as integers in øre, or with a decimal library. Never floating point.

Deviating or changed financial years are excluded or adjusted explicitly.

---

## Access control

**Anonymous sessions.** A visitor without an account gets a Supabase anonymous sign-in, so every request still carries a real `auth.uid()`. There is one access model, not two: row-level security, the audit log and rate limiting all work unchanged. When the visitor registers, the anonymous user is converted in place and keeps what it did.

**The trap:** anonymous users hold the `authenticated` Postgres role. A policy that only checks for an authenticated user admits them. Every policy on saved or user-entered data must also require `is_anonymous` to be false in the JWT, and the authorisation tests include an anonymous attacker.

**Workspaces.** Saved work belongs to a workspace. Membership carries a role, `owner` or `viewer`. Row-level security keys every user-scoped table to workspace membership. An adviser is a user with many workspaces; there is no adviser role.

**Invitation** is by email, into a single workspace, as viewer. Share links are out of v1.

**A user's own unfiled figures** live in their own table, keyed to a workspace. The owner writes, viewers read, anonymous sessions never read. Aggregate queries read only the tables holding filed accounts, so leaking unfiled figures into a peer median would require changing the query, not forgetting a filter. Removing a member revokes access immediately, since every policy goes through membership. When the filing for the same year arrives, it takes precedence and the user-entered figures are kept only as history.

**Minimum group size** before any aggregate is shown. This is a quality threshold, not a confidentiality control: aggregates are computed only from public filings.

**The open route** is rate-limited per session and per IP, with a CAPTCHA on anonymous sign-in, to stop register harvesting. The explanation text depends only on public figures and the peer group, so it is cached per company and peer group rather than generated per visit.

**The audit log** is append-only, with actor, timestamp and prior state. Anonymous actors are logged by their anonymous id.

---

## Test strategy

**Authorization tests** are written in week two. They attempt every forbidden access pattern and expect rejection: across workspaces, including those held by the same owner; an anonymous session reading or writing saved data; a viewer writing; an invited viewer reaching a workspace they were not invited to.

**Reference cases** for the engine: real filed accounts with hand-calculated expected values, including edge cases — negative equity, zero revenue, missing components.

**OCR accuracy, measured against a hand-transcribed set.** For a sample of filings, every figure in the generated section is transcribed by hand, and the pipeline's output is compared against it field by field. Reported as the share of figures recovered exactly, and separately as the share of filings passing the internal consistency check, split between recent filings and older scans. This is the measurement that decides which document-derived ratios the product can honestly offer.

**A labelled classification set:** for a selection of companies, a human judgement of which candidates are genuine comparables. Measured as precision and recall against industry code alone as the baseline, and reported per industry: an industry is offered in the product only once its own measurement exists. The set is stratified by description quality, so precision and recall can be reported separately for informative and uninformative descriptions.

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

A complete analysis under a few seconds, because it reads stored figures for every company involved — the subject included. The subject must be in a covered industry to be analysed at all, and covered industries are fully pre-warmed, so no recognition happens at query time. No documents are fetched or OCR'd during a user request, for the subject or for peers.

The OCR pipeline has no interactive budget. It runs as a batch job and is measured on throughput and accuracy, not latency.

---

## Schedule

Thirteen weeks.

| Week | Content |
|---|---|
| 1 | Data model, anonymous and magic-link authentication, workspaces. **Extend the OCR spike to the older scans**, in parallel |
| 2 | Row-level security, authorization tests |
| 3 | Bulk download from the registers, key figures ingestion |
| 4 | OCR pipeline: render, recognise, position-based row and column grouping |
| 5 | Number parsing, the two reconciliation rules, data quality flags |
| 6 | OCR accuracy measurement against the hand-transcribed set; buffer |
| 7 | Calculation engine with reference cases |
| 8 | Classification, the funnel, structured company profiles |
| 9 | Labelled set complete, measurement against the industry-code baseline |
| 10 | Embeddings as an intermediate baseline; three-level comparison |
| 11 | Invitations, rate limiting, peer group adjustment, saved analyses |
| 12 | Valuation control, explanation layer, export, responsive interface |
| 13 | Security report, threat model, AI documentation |

**The remaining OCR question belongs in week one**, not in week four. Recognition on recent filings is already measured and adequate; the older scans are not, and their result determines how many years of trend v1 can honestly promise. Finding that out in week four would be expensive; finding it out in week one is a scope decision.

**Two pieces of manual work start early and run alongside the code**, because they are calendar work rather than coding work and they are what the project's results rest on: the hand-transcribed OCR reference set, and the labelled classification set. Deferring either to the week it appears in the table above is how they end up too small to report.

**An AI log** (`docs/ai-log.md`) is kept from week one: what was asked for, what came back, what was wrong, how it was caught. Particular attention to authorization checks proposed in the client rather than on the server, floating point applied to money, and parsers that read an empty element as zero.

---

## Course requirements — IBE160

Kept out of the product brief, which follows the template provided. Collected here for internal use.

**Difficulty: hard.** Four processing stages with a defined data flow, integration against external public APIs, extraction from documents, a statistics engine computing distributions over dynamically assembled groups, a model-based classification stage whose accuracy determines the result and is measured against a baseline, an open anonymous route that must resist harvesting while sharing one access model with registered users, per-workspace roles with invitation and isolation between workspaces, and database-enforced multi-tenancy.

**Security/login: yes, strictly.** The filed accounting figures are public and are not protected. What is protected is what the solution adds on top of them: the user's unfiled figures, and the user's activity and saved analyses — which reveal strategy for an investor and a client list for an adviser. Concretely: anonymous sessions separated from registered users within one access model, per-workspace roles with isolation between workspaces enforced by row-level security in the database, invitation by email, rate limiting on the open route, an audit log, and automated authorization testing.

**Online purchase/sale: no.** Not within the scope of this version.

**Data in.** Key figures from filed annual accounts and company data — industry code, employees, registration date, business description — from public registers. Annual accounts as documents. The user's own unfiled figures. Adjustments to the peer group. The share of the gap to be closed, and the valuation multiple.

**Data out.** Key figures for the company across the years available. The distribution within the peer group with median and upper quartile. The company's position on the distribution per key figure. Decomposition of return into margin and asset turnover. Each deviation quantified in kroner. Profit uplift, released capital and implied enterprise value at the chosen closable share. A data quality flag per filing. Explanatory text with traceable figures. PDF export. Audit log.

**Decision points.** How much autonomy the model has in accepting or rejecting a peer group candidate. Which comparability criteria are hard exclusions and which are merely flagged. The minimum group size, weighed against coverage in thin industries. Whether the explanation layer is ever allowed to calculate, and how the boundary is enforced rather than merely instructed. Which key figures are included and how each is defined, since differences in definition between subject and group invalidate the comparison. Whether the reference point is the median or the upper quartile. How long fetched public data is cached, against the risk of showing stale figures. Whether a user's unfiled figures may ever enter a group aggregate. What an anonymous session may do, and where the account wall sits.
