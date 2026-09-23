---
title: Peerless
status: complete
created: 2026-09-17
updated: 2026-09-23
---

# Product Brief: Peerless — Peer Benchmarking from Public Accounts

## Executive Summary

Peerless answers a question most companies cannot answer about themselves: where are we losing money relative to companies like us, and what would closing that gap be worth. A user enters an organisation number and sees their company positioned against a group of genuinely comparable businesses across margin, cost structure, capital efficiency and productivity. Every deviation is converted into kroner. One control sets how much of each gap the user believes is closable, and the result is expressed as annual profit uplift, working capital released, and what that is worth in enterprise value.

Comparison tools exist. Proff Forvalt lets a user pick companies and set their key figures side by side, and valuation platforms such as Valutico now recommend comparable companies automatically. What none of them does for the small and mid-sized company is decide who the right peers are from what the company actually does, and turn each deviation into kroner. The comparison itself is not hard. Choosing the group and making the result mean something is, and that is why it rarely happens.

What makes it possible now is that the data is already public and free. Every Norwegian limited company files its accounts, and the register publishes them alongside industry classification, size and activity descriptions. Only a summary of the latest year is published as structured data; the full accounts are published as scanned pages, which Peerless reads with optical recognition and accepts only where the figures reconcile. The information needed to benchmark a company against its real competitors is sitting in a public register, used almost exclusively for credit checks.

The one genuinely hard part is deciding who counts as a comparable company. Industry codes are too coarse — a business registered under a generic consulting code could be doing almost anything — and comparing against the wrong set produces confident nonsense. What a company actually does is described in free text, and judging that from text is the part of the problem rules cannot solve. The peer group determines the answer, which is why the quality of that judgement is the thing Peerless lives or dies on, and why it is measured rather than asserted.

## The Problem

A managing director knows their gross margin. They do not know whether it is good.

Absolute figures mean little without a reference point. A wage share of thirty-one per cent sounds neither high nor low until you know that comparable companies run at twenty-nine, and that the difference is two million kroner a year. Without that context, management attention goes to whichever problem is loudest rather than whichever gap is largest — and the largest gaps are usually quiet, because they have been there for years.

**How it gets answered today.** Rarely, and expensively. A consultant is engaged, spends weeks assembling comparisons by hand, and delivers a deck that is accurate for one quarter and never revisited. Or the company's accountant is asked, offers an impression formed from other clients, and cannot show the working. Or nobody asks at all, and the company carries a structural disadvantage that has never been named.

**What exists commercially** leaves the hard part to the user. Credit bureaus sell risk products, which answer a counterparty's question rather than the company's own. Proff Forvalt offers competitor analysis, but the user chooses the companies, and choosing well is exactly the part that requires knowing the industry. Valutico's peer recommendation, released in 2026, scores and explains comparability, but it serves valuation against listed companies, not operational benchmarking of a Norwegian SME against its actual competitors. The underlying data is largely the same; the question is not.

**For the adviser**, the same analysis is rebuilt from scratch for every client, which means it is offered rarely and priced as a project rather than included as a service.

**For the investor** evaluating a target or working on value creation in a portfolio company, the need is identical and the method is the same manual one.

## The Solution

**Enter an organisation number.** That is the entire setup. Optionally, the user can describe the company in a sentence; for the company being analysed, that description takes precedence over the register's. No upload, no configuration, no template to fill in. Within seconds the company appears with its figures, its peer group, and its position against that group. A company outside the covered industries still gets its own filed key figures, with a plain statement that its industry is not yet covered. It gets no peer comparison rather than one against a group nobody has checked.

**See where the company stands.** About a dozen measures covering margin, cost structure, working capital, capital efficiency and productivity, with revenue growth alongside for context. For each, the company's own value, the peer median, the favourable quartile — the upper quartile where higher is better, the lower where lower is better — and a position marker showing where it sits on the distribution, stated as a percentile. Strengths are shown as clearly as weaknesses — a company that is better capitalised than its peers should know that, because it changes what it can afford to do about everything else.

**See what the gap is worth.** Each deviation is expressed in kroner against the company's own revenue and balance sheet. A margin gap becomes an annual amount. A receivable-days gap becomes capital tied up. This is the step that turns an observation into a decision.

**Decide how much is closable.** A single control runs from nothing to full convergence with the favourable quartile. Moving it updates annual profit uplift, working capital released, and implied enterprise value at an EV/EBIT multiple the user sets. The point is not to produce a number but to let someone reason about what a realistic improvement is actually worth.

**Add this year's figures.** An owner can enter the current year before it is filed. These figures are marked as unaudited and user-entered wherever they appear, including in exports, and are never merged with filed figures. They are compared against the peers' latest filed year, and the difference in periods is stated. When the filing arrives, it replaces them.

**Understand where to start.** A written explanation names the largest gaps in kroner, the measures where the company is strong, and — where several years of filings are available — which gaps have persisted. Whether a gap has persisted is decided by the engine from the figures, not by the model. It explains; it does not recommend. Every figure in it links back to the calculation behind it.

**Adjust the comparison.** The peer group is visible, not hidden. The user can see how many companies remain after each filter, widen a criterion when the group is too small, or exclude a company that does not belong. Each peer carries a short statement of why it was included — the profile attributes it shares with the subject — derived from the stored classification rather than written by the model. Each peer is marked with what the match rests on: description and accounts, accounts alone, or industry and size alone. Everything recomputes immediately. A benchmark the user cannot interrogate is a benchmark they will not trust.

**Come back to it.** Analyses are saved, so the next visit shows how the company has moved against its peers rather than starting over.

**Access.** Anyone can run an analysis without creating an account: look up a company, see its peer group, adjust it, and see the gaps in kroner. An account is needed for anything that is kept — saved analyses and history, favourites, unfiled current-year figures, PDF export — and for sharing. Sign-in is by emailed magic link, so there are no passwords to store. Saved work lives in workspaces, typically one per company. The person who creates a workspace owns it and can invite others to it as read-only viewers — a board member, a co-owner, or an adviser's client. An adviser is simply a user with many workspaces.

The filed figures themselves are public and are not protected — anyone may look up any company, and that is the point. What needs protecting is everything the product adds on top of them. A user's unfiled current-year figures are not public. They belong to the workspace they were entered in and are visible to its members — the owner who entered them and anyone the owner has invited — and to no one else. A user's activity is confidential even though each individual lookup is not: an investor screening acquisition targets reveals their strategy in what they search, and an adviser reveals their client list. Aggregates are computed only from filed figures, which are public, so a peer median discloses nothing that the filings do not. A minimum group size still applies, but as a quality requirement: a median of three companies is not a benchmark. Unfiled figures entered by a user never enter any aggregate.

Isolation between workspaces is where it matters most: one adviser's clients must never be reachable from another's account, and a viewer invited to one workspace must never reach another held by the same owner.


## What Makes This Different

**The peer group is built from what companies do, not from how they are registered.** This is the whole product. A comparison against the wrong set is worse than no comparison, because it is confidently wrong, and a managing director will spot it in the first thirty seconds and never return. Industry codes cannot carry this. Peerless reads it in two places. The accounts show what kind of business a company is — a reseller carries stock and cost of goods, a product company capitalises its development, a consultancy is almost all payroll — for every company that files. The description, where it says anything, adds what the numbers cannot. Where neither separates a company, Peerless falls back to industry and size and says so, rather than presenting a guess as a judgement.

**Every deviation is also expressed in kroner.** The ratios are there and they matter — they are what makes a deviation comparable across companies and across years, and they are what a reader checks the arithmetic against. But a four-point margin deviation is true and not yet actionable. Three point one million a year is. Peerless shows both, and keeps the path from the money back to the ratio and on to the filed accounts visible, because a figure nobody can trace is a figure nobody acts on. The translation itself is simple arithmetic; what is uncommon is doing it at all, since ratio tables are what the underlying data looks like and converting them into money means taking a position on what the company could realistically reach.

**It answers the company's question, not its creditors'.** Credit bureaus built risk products because creditors are who pay. The comparison tools that do face the company leave the choice of peers to the user and stop at the ratio. Peerless chooses the peers and carries each ratio through to kroner, keeping both in view — the ratio is what makes a deviation comparable and checkable, the kroner are what make it a decision. For companies below the size where benchmarking software is sold, we have not found that combination offered.

**It costs a minute, not a project.** The realistic competitor is not another product. It is the analysis never being done. Anything that requires setup, data entry or a purchase order loses to inertia; anything that takes one field and a few seconds does not.

None of this is defensible. The data is public, the ratios are textbook, and a competitor could build the same thing. Automated peer recommendation is not new either — Valutico has shown it works for valuation. What is new is applying it to Norwegian SMEs and pointing it at operational benchmarking rather than a valuation multiple. The advantage is framing and execution, and it holds only as long as it takes someone else to notice.

## Who This Serves

**Primary: accountants and advisers.** They serve dozens of companies that all ask some version of "are we doing well?", and they answer from impression because building the evidence takes hours per client. A repeatable analysis across a client portfolio turns an unbillable conversation into an advisory service, and turns their existing client base into the product's distribution. They are also the user best placed to judge whether a peer group is right, which makes them the right user to build v1 for. This is the user most likely to pay.

**Also served in v1: managing directors and finance leads.** They own the problem — decisions about pricing, hiring and working capital made without a reference point — but will not maintain a modelling tool. They reach Peerless through the open route without an account, or as a viewer in their adviser's workspace. Success is opening it once a quarter and changing what they work on next.

**Board members and co-owners** are served as invited viewers, reading management's figures against an external reference for the first time.

**Later: investors and fund professionals.** Screening targets and benchmarking a portfolio start with the same question, but depend on screening and portfolio views that are outside v1.

## Success Criteria

**Functional.** A complete analysis from an organisation number alone, without an account, and with no upload or configuration. Peer groups are never shown below the minimum size threshold. Every kroner figure traces back to the ratio and the filed accounts behind it. The user can adjust the peer group and see everything recompute. Generated explanation contains no figure absent from the calculation output.

**Credibility.** The central measure, because it determines whether anything else matters: peer selection is scored against a labelled set where a human has judged which candidates are genuine comparables, reported as precision and recall, and compared against what industry classification alone achieves. The improvement over that baseline is the primary result of the project. Results are reported separately for companies whose descriptions are informative and those whose are not, because the method can only improve on the baseline where there is text to read. The share of companies in each group is reported alongside. Each layer is also measured on its own — industry code alone, then the accounts, then the description — so the result shows where the improvement comes from.

**Technical.** Peer group assembly returns in under a second, and a complete analysis within a few, because every figure it needs has already been recognised and stored. Recognition accuracy is measured against a hand-transcribed sample and reported, rather than assumed. Every figure is checked twice: against the other figures in its own filing, where subtotals must agree within a few kroner because the register prints whole kroner rounded from øre, and proportionally against the register's summary figures, where reporting in thousands or millions makes exactness wrong. A figure that fails is withheld rather than shown, and a filing that fails blocks the analysis rather than degrading it silently. Calculation logic is covered by tests against hand-calculated reference cases built from real filed accounts.

**Security.** The filed data is public, so the objectives concern confidentiality of use, not of the source figures. The authorisation test suite passes with zero cross-workspace access, including between workspaces held by the same owner. Anonymous sessions can read public figures and nothing else: no saved analysis, no workspace, no unfiled figure. A user's saved analyses and search activity are reachable only by that user and those they have invited. Unfiled figures are reachable only by members of the workspace they belong to, and never enter a peer aggregate. The open route is rate-limited and cannot be used to harvest the register. Every analysis, anonymous or not, resolves to an actor in the audit log.

## Scope

**In for v1.** Analysis without an account. Magic-link sign-in. Workspaces with an owner and invited read-only viewers, which covers advisers holding many client companies. Company lookup by organisation number and analysis of any company in the covered industries. Coverage grows one industry at a time, as many as the time allows. An industry opens only when its filings have been extracted and reconciled and its peer selection has been measured against a labelled set; an industry that has not been measured is not offered. Peer group construction with visible filtering and user adjustment. Ratio coverage across margin, cost structure, working capital, capital efficiency and productivity. The register serves the filed accounts only as page images, so the ratios beyond the summary figures depend on optical recognition of those pages, and a figure is accepted only where it reconciles. Decomposition views separating margin from capital efficiency, and pay level from productivity. Multi-year trend where available. Gap quantification in kroner, the closable-share control, and valuation at a user-set multiple. Written explanation grounded in the calculated figures. Manual entry of unfiled current-year figures. Minimum group size. Rate limiting on the open route. Saved analyses with history. Audit log. PDF export. A responsive layout, from desktop down to phone width.

**Explicitly out of v1.** Share links that grant access to anyone holding them. A link is a bearer token: it gets forwarded, pasted into chat and leaked through logs, and it would carry unfiled figures with it unless deliberately excluded. Invitation by email covers the need in v1. A full valuation tool — discounted cash flow, transaction multiples, several methods side by side. Peerless values a gap at a user-set multiple and stops there; a valuation product is a different product, and the market Valutico already serves.

Also out: entities outside the ordinary accounting layout, including banks and insurers. Filings too degraded for reliable recognition — chiefly the oldest paper-form scans — which are reported as unavailable rather than estimated. Group consolidation across several legal entities. Forecasting. Credit scoring or default prediction. Ownership and group structure mapping. Cross-border comparison. Automated monitoring and alerting on peer movements. Custom ratio definitions. A composite performance score, since it would require arbitrary weights across ratios and cannot be traced to the accounts. Screening or searching the register by financial criteria, rankings of companies, and "find companies like this" — a different product for a different user, and on an open route the most direct way to harvest the register. A free-form chat over the data, because it cannot be held to the rule that the model never calculates. Payment and subscription handling. Multi-language support. Native mobile.

Deferred rather than rejected. Share links, monitoring over time and wider industry coverage are the natural first additions.

## Vision

The near-term goal is that any company can see itself in context in under a minute, for nothing, and that the comparison is good enough to argue with.

Beyond that, the opportunity is the register. Every Norwegian limited company files its accounts into a public register that is used almost entirely for checking whether counterparties pay their bills. Treated as a management data source instead, it supports a family of products on one foundation: a company's position tracked over time rather than at a point, an investor's whole portfolio benchmarked against its respective peer sets in one view, and companies whose figures have moved in ways that merit someone's attention — a buyer's, a lender's, or their own.

The longer-term position is that the comparison becomes the reflexive first step before any significant decision. Not because the analysis is sophisticated, but because it is free and takes a minute, and the alternative is a consultant and three weeks.
