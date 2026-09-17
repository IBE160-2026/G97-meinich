---
title: Peerless
status: complete
created: 2026-09-17
updated: 2026-09-17
---

# Product Brief: Peerless — Peer Benchmarking from Public Accounts

## Executive Summary

Peerless answers a question most companies cannot answer about themselves: where are we losing money relative to companies like us, and what would closing that gap be worth. A user enters an organisation number and sees their company positioned against a group of genuinely comparable businesses across margin, cost structure, capital efficiency and productivity. Every deviation is converted into kroner. One control sets how much of each gap the user believes is closable, and the result is expressed as annual profit uplift, working capital released, and what that is worth in enterprise value.

Benchmarking of this kind exists, but as enterprise software sold to companies that already employ someone to operate it. For the small and mid-sized company, the alternative is a consultant engagement that costs weeks and produces a snapshot nobody updates. The comparison itself is not hard. Assembling it is, and that is the only reason it does not happen.

What makes it possible now is that the data is already public and free. Every Norwegian limited company files its accounts, and those filings are available through open interfaces alongside industry classification, size and activity descriptions. The information needed to benchmark any company against its real competitors is sitting in a public register, structured, and used almost exclusively for credit checks.

The one genuinely hard part is deciding who counts as a comparable company. Industry codes are too coarse — a business registered under a generic consulting code could be doing almost anything — and comparing against the wrong set produces confident nonsense. What a company actually does is described in free text, and judging that from text is the part of the problem rules cannot solve. The peer group determines the answer, which is why the quality of that judgement is the thing Peerless lives or dies on, and why it is measured rather than asserted.

## The Problem

A managing director knows their gross margin. They do not know whether it is good.

Absolute figures mean little without a reference point. A wage share of thirty-one per cent sounds neither high nor low until you know that comparable companies run at twenty-nine, and that the difference is two million kroner a year. Without that context, management attention goes to whichever problem is loudest rather than whichever gap is largest — and the largest gaps are usually quiet, because they have been there for years.

**How it gets answered today.** Rarely, and expensively. A consultant is engaged, spends weeks assembling comparisons by hand, and delivers a deck that is accurate for one quarter and never revisited. Or the company's accountant is asked, offers an impression formed from other clients, and cannot show the working. Or nobody asks at all, and the company carries a structural disadvantage that has never been named.

**What exists commercially** is aimed elsewhere. Credit bureaus sell risk products: will this company pay its bills. That question is asked by a company's counterparties, not by the company itself, and the answer says nothing about where it is losing money. The underlying data is largely the same; the framing is not.

**For the adviser**, the same analysis is rebuilt from scratch for every client, which means it is offered rarely and priced as a project rather than included as a service.

**For the investor** evaluating a target or working on value creation in a portfolio company, the need is identical and the method is the same manual one.

## The Solution

**Enter an organisation number.** That is the entire setup. No upload, no configuration, no template to fill in. Within seconds the company appears with its figures, its peer group, and its position against that group.

**See where the company stands.** Ten or so measures covering margin, cost structure, working capital, capital efficiency and productivity. For each, the company's own value, the peer median, the upper quartile, and a position marker showing where it sits on the distribution. Strengths are shown as clearly as weaknesses — a company that is better capitalised than its peers should know that, because it changes what it can afford to do about everything else.

**See what the gap is worth.** Each deviation is expressed in kroner against the company's own revenue and balance sheet. A margin gap becomes an annual amount. A receivable-days gap becomes capital tied up. This is the step that turns an observation into a decision.

**Decide how much is closable.** A single control runs from nothing to full convergence with the upper quartile. Moving it updates annual profit uplift, working capital released, and implied enterprise value at a multiple the user sets. The point is not to produce a number but to let someone reason about what a realistic improvement is actually worth.

**Understand where to start.** A written explanation identifies which gaps are largest, which are one-off and which have persisted, and which could be addressed without changing how the business operates. It explains; it does not recommend. Every figure in it links back to the calculation behind it.

**Adjust the comparison.** The peer group is visible, not hidden. The user can see how many companies remain after each filter, widen a criterion when the group is too small, or exclude a company that does not belong. Everything recomputes immediately. A benchmark the user cannot interrogate is a benchmark they will not trust.

**Come back to it.** Analyses are saved, so the next visit shows how the company has moved against its peers rather than starting over.

**Access.** Three roles: an owner with access to their own company, an adviser holding many separate client companies, and a read-only viewer for a board member or co-owner.

The filed figures themselves are public and are not protected — anyone may look up any company, and that is the point. What needs protecting is everything the product adds on top of them. A user's unfiled current-year figures are not public and are visible only to whoever entered them. A user's activity is confidential even though each individual lookup is not: an investor screening acquisition targets reveals their strategy in what they search, and an adviser reveals their client list. And aggregates can expose what the individual filings did not — in a small group a median says a great deal about each member, and a user running two nearly identical filters can recover a single company's figures from the difference. That last problem exists precisely because the inputs are public, and it is handled explicitly rather than by group size alone.

The adviser role is where isolation matters most: one adviser's clients must never be reachable from another's account.


## What Makes This Different

**The peer group is built from what companies do, not from how they are registered.** This is the whole product. A comparison against the wrong set is worse than no comparison, because it is confidently wrong, and a managing director will spot it in the first thirty seconds and never return. Industry codes cannot carry this; reading how a company describes itself can.

**Every deviation is also expressed in kroner.** The ratios are there and they matter — they are what makes a deviation comparable across companies and across years, and they are what a reader checks the arithmetic against. But a four-point margin deviation is true and not yet actionable. Three point one million a year is. Peerless shows both, and keeps the path from the money back to the ratio and on to the filed accounts visible, because a figure nobody can trace is a figure nobody acts on. The translation itself is simple arithmetic; what is uncommon is doing it at all, since ratio tables are what the underlying data looks like and converting them into money means taking a position on what the company could realistically reach.

**It is aimed at the company, not at its creditors.** The incumbents built risk products because creditors are who pay. That left the management use case — the same data, a different question — largely unoccupied for companies below the size where benchmarking software is sold.

**It costs a minute, not a project.** The realistic competitor is not another product. It is the analysis never being done. Anything that requires setup, data entry or a purchase order loses to inertia; anything that takes one field and a few seconds does not.

None of this is defensible. The data is public, the ratios are textbook, and a competitor could build the same thing. The advantage is framing and execution, and it holds only as long as it takes someone else to notice.

## Who This Serves

**Managing directors and finance leads of small and mid-sized companies.** They are making decisions about pricing, hiring and working capital without knowing how their own numbers compare to anyone else's. They do not want a modelling tool and will not maintain one. What they need is a reference point and a sense of magnitude. Success is opening the product once a quarter and changing what they work on next.

**Accountants and advisers.** They serve dozens of companies that all ask some version of "are we doing well?", and they answer from impression because building the evidence takes hours per client. A repeatable analysis across a client portfolio turns an unbillable conversation into an advisory service, and turns their existing client base into the product's distribution. This is the user most likely to pay.

**Investors and fund professionals.** Screening a target, or running value creation in a company already owned, starts with the same question and is answered the same manual way. Success is a first-pass view of where the value sits before committing analyst time.

**Board members and co-owners**, who currently receive management's own account of performance with no external reference against which to read it.

## Success Criteria

**Functional.** A complete analysis from an organisation number alone, with no upload or configuration. Peer groups are never shown below the minimum size threshold. Every kroner figure traces back to the ratio and the filed accounts behind it. The user can adjust the peer group and see everything recompute. Generated explanation contains no figure absent from the calculation output.

**Credibility.** The central measure, because it determines whether anything else matters: peer selection is scored against a labelled set where a human has judged which candidates are genuine comparables, reported as precision and recall, and compared against what industry classification alone achieves. The improvement over that baseline is the primary result of the project.

**Technical.** Peer group assembly returns in under a second, and a complete analysis within a few, because every figure it needs has already been recognised and stored. Recognition accuracy is measured against a hand-transcribed sample and reported, rather than assumed. Every figure is checked twice: against the other figures in its own filing, where subtotals must agree within a few kroner because the register prints whole kroner rounded from øre, and proportionally against the register's summary figures, where reporting in thousands or millions makes exactness wrong. A figure that fails is withheld rather than shown, and a filing that fails blocks the analysis rather than degrading it silently. Calculation logic is covered by tests against hand-calculated reference cases built from real filed accounts.

**Security.** The filed data is public, so the objectives concern confidentiality of use and of what aggregation reveals, not of the source figures. The authorisation test suite passes with zero cross-tenant access, including between client sets held by the same adviser. A user's saved analyses and search activity are reachable only by that user. Unfiled figures entered by a user never reach another user and never enter a peer aggregate. Minimum-group-size enforcement cannot be circumvented by successive narrow queries, which is the one place where public inputs can yield a non-public output. Every analysis resolves to an actor in the audit log.

## Scope

**In for v1.** Authentication with three roles, including adviser access to multiple client companies. Company lookup by organisation number and analysis of any company in the covered industries. Three industries covered, chosen for depth of population, rather than the whole register. Peer group construction with visible filtering and user adjustment. Ratio coverage across margin, cost structure, working capital, capital efficiency and productivity. The register serves the filed accounts only as page images, so the ratios beyond the summary figures depend on optical recognition of those pages, and a figure is accepted only where it reconciles. A decomposition view separating margin from capital efficiency. Multi-year trend where available. Gap quantification in kroner, the closable-share control, and valuation at a user-set multiple. Written explanation grounded in the calculated figures. Manual entry of unfiled current-year figures. Minimum-group-size enforcement and protection against inference across queries. Saved analyses with history. Audit log. PDF export. A responsive layout, from desktop down to phone width.

**Explicitly out of v1.** Anonymous access. Every route requires a login, including lookup of figures that are themselves public — a deliberate choice rather than an oversight. An open search would fit the product better, since the friction of an account sits in front of data anyone may already read, and the material that actually needs protecting all lives behind the login regardless. But it means maintaining two access models, two sets of authorisation tests, and a defence against harvesting the register through the open route, and that is not a good use of the time available. It is the first thing to add once the closed model is demonstrably correct.

Also out: entities outside the ordinary accounting layout, including banks and insurers. Filings too degraded for reliable recognition — chiefly the oldest paper-form scans — which are reported as unavailable rather than estimated. Group consolidation across several legal entities. Forecasting. Credit scoring or default prediction. Ownership and group structure mapping. Cross-border comparison. Automated monitoring and alerting on peer movements. Custom ratio definitions. Payment and subscription handling. Multi-language support. Native mobile.

Deferred rather than rejected. Open search, monitoring over time and wider industry coverage are the natural first additions.

## Vision

The near-term goal is that any company can see itself in context in under a minute, for nothing, and that the comparison is good enough to argue with.

Beyond that, the opportunity is the register. Every Norwegian limited company files structured accounts into a public database that is used almost entirely for checking whether counterparties pay their bills. Treated as a management data source instead, it supports a family of products on one foundation: a company's position tracked over time rather than at a point, an investor's whole portfolio benchmarked against its respective peer sets in one view, and companies whose figures have moved in ways that merit someone's attention — a buyer's, a lender's, or their own.

The longer-term position is that the comparison becomes the reflexive first step before any significant decision. Not because the analysis is sophisticated, but because it is free and takes a minute, and the alternative is a consultant and three weeks.
