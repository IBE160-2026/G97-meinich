---
title: Peerless
status: complete
created: 2026-09-17
updated: 2026-09-26
---

# Product Brief: Peerless — Peer Benchmarking from Public Accounts

## Executive Summary

Peerless answers a question most companies cannot answer about themselves: where are we losing money relative to companies like us, and what would closing that gap be worth. A user enters an organisation number and sees their company positioned against a group of genuinely comparable businesses across margin, cost structure, working capital, capital efficiency and productivity. Every deviation is converted into kroner, and one control sets how much of each gap the user believes is closable — expressed as annual profit uplift, working capital released, and what that is worth in enterprise value.

The data is already public and free. Every Norwegian limited company files its accounts, and the register publishes them alongside industry classification, size and a description of what the company does — used almost exclusively for credit checks. Only a summary of the latest year is structured; the full accounts are scanned pages, which Peerless reads with optical recognition and accepts only where the figures reconcile.

The comparison itself is not hard. Choosing the group is. Industry codes are too coarse — one programming code covers resellers, product companies and consultancies — and comparing against the wrong set produces confident nonsense. Peerless builds the group with rules first and uses AI to read what each company does where the rules run out. Whether that AI actually picks better peers than the industry code is measured against human judgement, not assumed — because the peer group is the thing Peerless lives or dies on.

## The Problem

A managing director knows their gross margin. They do not know whether it is good.

A wage share of thirty-one per cent sounds neither high nor low until you know that comparable companies run at twenty-nine, and for a typical software company with eighteen million kroner in revenue, that difference is 360 000 kroner a year. Without that reference point, attention goes to whichever problem is loudest rather than whichever gap is largest — and the largest gaps are usually quiet, because they have been there for years.

**Today** the question is answered rarely and expensively: a consultant spends weeks on a deck that is never revisited, or an accountant offers an impression that cannot show its working. Advisers rebuild the same analysis from scratch for every client, so it is offered rarely and priced as a project.

**What exists commercially leaves the hard part to the user.** Credit bureaus answer a counterparty's question — will this company pay — not the company's own. Proff Forvalt offers competitor analysis, but the user picks the companies, and picking well is exactly what requires knowing the industry. Enin can generate lists of comparable companies, but sells to banks for credit and fraud work. Valutico recommends and explains comparable companies, but for valuation against listed companies. None of them chooses the peers for a Norwegian SME and turns each deviation into kroner.

## The Solution

**Start from an overview.** The front page explains what Peerless does and holds one field: the organisation number. Below it, a picture of each covered industry — how the median margin has moved over time, how widely personnel cost share varies, how many companies are growing. They show distributions, not rankings.

**Enter an organisation number.** That is the entire setup — no account, upload or configuration. The user may describe the company in a sentence, which AI then reads in place of the register's description. Within seconds the company appears with its figures, its peer group and its position, organised in tabs: overview, peers, key figures and gaps, development over time, and value. A company outside the covered industries gets its own key figures and a plain statement that its industry is not yet covered, rather than a comparison against a group nobody has checked.

**See where it stands.** About a dozen measures, with revenue growth alongside for context. For each: the company's value, the peer median, the favourable quartile, and its percentile. Strengths are shown as clearly as weaknesses.

**See what the gap is worth, and decide how much is closable.** Each deviation becomes kroner — a margin gap an annual amount, a receivable-days gap capital tied up. One control runs from nothing to full convergence with the favourable quartile and updates profit uplift, working capital released and enterprise value at an EV/EBIT multiple the user sets.

**Interrogate the peer group.** It is visible, not hidden. The user sees how many companies remain after each filter, can widen a criterion or exclude a company, and everything recomputes. Each peer states why it was included and what the match rests on — the accounts and an AI reading of its description, the accounts alone, or industry and size alone. A benchmark the user cannot interrogate is one they will not trust.

**Understand where to start.** An AI-written explanation names the largest gaps in kroner, the strengths, and which gaps have persisted. It explains; it does not recommend. The AI never calculates: every figure in the text comes from the engine and links back to its calculation, and text containing any other figure is rejected.

**Keep it and share it.** The overview, peer group and gaps in kroner are open to anyone. An account — by emailed magic link — opens the rest: development over time, the decomposition views, PDF export, saved analyses, this year's unfiled figures, and inviting others. A signed-in user's front page is their portfolio: every company they follow, its latest position, what has changed and where the largest gaps are. Saved work lives in workspaces; an owner invites board members, co-owners or clients as read-only viewers, and an adviser is simply a user with many workspaces. Unfiled figures are marked unaudited everywhere and never enter a peer aggregate.

## What Makes This Different

**The peer group is built from what companies do, not how they are registered.** Peerless reads it in two places. The accounts show what kind of business a company is — a reseller carries stock and cost of goods, a product company capitalises its development, a consultancy is almost all payroll. AI reads the description, where it says anything, for what the numbers cannot show. Where neither separates a company, Peerless falls back to industry and size and says so, rather than presenting a guess as a judgement.

**Every deviation is also expressed in kroner.** A four-point margin deviation is true and not yet actionable; seven hundred thousand kroner a year is. Peerless shows both, and keeps the path from the money back to the ratio and the filed accounts visible, because a figure nobody can trace is a figure nobody acts on.

**It costs a minute, not a project.** The realistic competitor is the analysis never being done. Anything needing setup or a purchase order loses to inertia; one field and a few seconds does not.

None of this is defensible. The data is public, the ratios are textbook, and automated peer recommendation already works for valuation. What is new is pointing it at operational benchmarking for Norwegian SMEs. The advantage is framing and execution.

## Who This Serves

**Primary: accountants and advisers.** Dozens of clients ask "are we doing well?", and they answer from impression because the evidence takes hours to build. A repeatable analysis across a portfolio turns an unbillable conversation into an advisory service. They are also best placed to judge whether a peer group is right, and most likely to pay.

**Also in v1: managing directors and finance leads**, who own the problem but will not maintain a modelling tool — through the open route or as viewers in their adviser's workspace. **Board members and co-owners** are served as invited viewers.

**Later: investors**, whose screening and portfolio needs depend on views outside v1.

## Success Criteria

**Credibility — the central result.** Peer selection is scored against a labelled set where a human has judged which candidates are genuine comparables — without seeing which stage of the funnel proposed them, since the same person designed the method — as precision and recall, and compared with industry classification alone. Results are reported separately for companies with informative and uninformative descriptions, and layer by layer — industry code, then the accounts, then AI reading the description — so the result shows whether the AI earns its place and where any improvement comes from.

**Functional.** A complete analysis from an organisation number alone. No aggregate below ten peers. Every kroner figure traces to its ratio and the filed accounts. No AI-written text contains a figure the engine did not compute.

**Technical.** Peer group in under a second, full analysis within a few. Recognition accuracy measured against a hand-transcribed sample; a figure that fails reconciliation is withheld, never shown. Calculations tested against hand-calculated cases from real filings.

**Security.** Confidentiality attaches to use, not to public figures. Zero cross-workspace access in the authorisation suite, including between workspaces held by the same owner; anonymous sessions reach public figures only.

**Known risks.** Two things could limit the result: how reliably the scanned accounts can be read, and how little many company descriptions say, which bounds what AI can add. Both are measured early rather than assumed — the first already: about nine in ten recent filings reconcile, which sets development over time at five years. The third is delivery: the interface — front page, tabs and portfolio — lands late in a thirteen-week solo schedule. If time runs short, the portfolio front page goes first, then the industry overviews; the measurement never does.

## Scope

**In for v1.** A front page with industry overviews; analysis in tabs; a portfolio front page for signed-in users. Analysis without an account; magic-link sign-in; workspaces with owners and invited viewers. Coverage grows one industry at a time, each offered only once its filings are extracted and its peer selection measured — first programming services and bookkeeping. Visible, adjustable peer groups. About a dozen key figures with two decomposition views. Development over the last five years. Kroner gaps, the closable-share control and EV/EBIT valuation. AI-written explanation. Unfiled current-year figures. Saved analyses, audit log, PDF export. A responsive, Norwegian-language interface down to phone width.

**Out of v1.** Named rankings and league tables; widgets users arrange themselves; share links; a full valuation tool; screening and "find companies like this"; a composite score; a free-form chat over the data; credit scoring; forecasting; group consolidation and ownership mapping; banks, insurers and cross-border comparison; monitoring and alerts; payment. Reasons for each are kept in the addendum.

## Vision

The near-term goal is that any company can see itself in context in under a minute, for nothing, and that the comparison is good enough to argue with.

Beyond that, the opportunity is the register itself — treated as a management data source rather than a credit check. On one foundation: a company's position tracked over time, an investor's portfolio benchmarked in one view, and companies whose figures have moved in ways that merit attention. The longer-term position is that the comparison becomes the reflexive first step before any significant decision — because it is free and takes a minute, and the alternative is a consultant and three weeks.
