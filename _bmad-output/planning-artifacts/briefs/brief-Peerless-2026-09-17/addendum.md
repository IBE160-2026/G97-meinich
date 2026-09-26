# Addendum — Peerless product brief

Detail that was decided while the brief was written but belongs downstream rather than in a one-to-two-page brief. It is kept here so nothing is lost. Where this addendum and one of the authoritative documents disagree — the technical note, `docs/data-sources-brreg.md` or `docs/key-figures.md` — that document wins.

## Where AI is used, and where it is not

AI has exactly two jobs in Peerless.

- **Classifying what a company does.** AI reads the company name, secondary industry codes, statement of purpose and business description, and answers only with a fixed category. It runs once per company when data is loaded, never while a user waits. The one exception is a description the user enters for the company being analysed: it is classified once, cached against that text and rate-limited. A company with nothing to classify on is left unclassified rather than guessed at.
- **Writing the explanation.** AI describes figures the engine has already computed. It never calculates. An automated test rejects generated text containing any figure absent from the engine's output.

Everything else is rules: the comparability filter, size segmentation, the business-model fingerprint read from the accounts, every ratio and every kroner amount, and the statement of why each peer was included. Rules come first, and AI gets only what the rules cannot settle.

Embeddings of the business descriptions are measured as an alternative to AI classification and replace it only if they do better. Each layer is scored on its own against the labelled set, so the result shows how much the AI adds. If the fingerprint from the accounts does most of the work, that is a finding worth reporting: AI was needed less than expected.

## The front page and the analysis pages

**Industry overviews on the front page.** For each covered industry: the median margin over time, the spread in personnel cost share, the share of companies growing. They use the same engine and the same stored figures as the analysis, so they cost little to build and show what the data can do. They exist only for covered industries — two at the start. If older filings cannot be read reliably, the overviews show the latest year only — the spread without the trend — rather than a trend built on weak data.

**Why no named rankings.** Lists such as "fastest-growing companies" or "lowest wage share" were considered and rejected.
- A top list collects the errors. A recognition error that turns 72 million into 722 million, or growth from one million to ten, lands at the top — and Peerless rests on a wrong figure being worse than a missing one.
- A wage-share ranking is systematically misleading: a company that books subcontractors as other operating costs rather than payroll looks like the lowest payer.
- It would amount to a public list of who pays worst, built on figures that do not mean that.

**Tabs.** An analysis is organised as overview, peers, key figures and gaps, development over time, and value.

**The account wall.**

| Open to anyone | Needs an account |
|---|---|
| Front page and industry overviews | Development over time |
| Lookup, peer group and adjustment | Decomposition views |
| Key figures, percentiles and gaps in kroner | PDF export |
| Closable-share control and valuation | Saved analyses and history, favourites |
| | Unfiled current-year figures |
| | Workspaces, invitations and the portfolio front page |

The core — peers and the gap in kroner — stays open, because "one field and a minute" is what separates Peerless from the alternatives. The deeper pages give a reason to create an account without breaking that promise.

**The portfolio front page.** A signed-in user sees every company they follow: latest position, what has changed since the last filing, and the largest gaps. It is built on saved analyses and serves the primary user, the adviser with many clients.

**Deferred.** Widgets users choose and arrange themselves. Useful, but a large amount of interface work for a solo project, with little added over a well-chosen fixed layout.

## Access and confidentiality

**What is protected.** The filed figures are public — anyone may look up any company, and that is the point. What is protected is what the product adds: unfiled figures, and a user's activity. Each lookup is harmless on its own, but an investor's searches reveal their acquisition strategy and an adviser's workspaces reveal their client list.

**One access model.** Anonymous visitors get a Supabase anonymous sign-in, so row-level security, rate limiting and the audit log cover everyone, and registering converts that identity in place.

**Workspaces.** Saved work belongs to a workspace, typically one per company, with an owner and invited read-only viewers. Isolation between workspaces is where it matters most: one adviser's clients must never be reachable from another's account, and a viewer invited to one workspace must never reach another held by the same owner.

**Unfiled figures.** They belong to the workspace they were entered in and are visible to its members only. They are marked unaudited and user-entered wherever they appear, including exports, are never merged with filed figures, are compared against the peers' latest filed year with the period difference stated, and are replaced when the filing arrives. They never enter an aggregate.

**Minimum group size.** Ten peers, counted per key figure. A quality threshold, not a confidentiality control: aggregates are computed only from public filings, so a peer median discloses nothing the filings do not.

**Security criteria in full.** Zero cross-workspace access in the authorisation suite, including between workspaces held by the same owner. Anonymous sessions reach public figures only — no saved analysis, workspace or unfiled figure. Saved analyses and search activity are reachable only by the user and those they invited. The open route is rate-limited so it cannot be used to harvest the register. Every analysis, anonymous or not, resolves to an actor in the audit log.

## Data quality

The register serves the full accounts only as page images, so every figure beyond the latest-year summary depends on optical recognition. Every recognised figure is checked twice: within its own filing, where subtotals must agree within a few kroner because the register prints whole kroner rounded from øre; and against the register's summary figures, with a proportional tolerance because reporting in thousands or millions makes exactness wrong. A figure that fails is withheld, and a failing filing blocks the analysis rather than degrading it silently. Filings made on paper have no fixed layout to read and are reported as unavailable, never estimated; they are a small remainder before 2014. Measured on 180 filings: about 88 % of columns reconcile for 2021–2025, about 60 % for 2011–2016, and 71 of 71 figures agree with the register's summary figures. Development over time therefore covers five years in v1. Detail in the technical note and `docs/data-sources-brreg.md`.

## The benchmark in detail

- **Favourable quartile** — the upper quartile where higher is better, the lower where lower is better.
- **The key figures**, their formulas, sources and translation to kroner are defined in `docs/key-figures.md`.
- **Peer matching** is a five-stage funnel — four stages of rules, including the business-model fingerprint, and one of AI classification. Detail in the technical note.
- **Whether a gap has persisted** is decided by the engine from the figures, not by AI.

## Out of scope — the reasons

- **Named rankings and league tables.** See the front page section above.
- **Share links.** A link is a bearer token: it gets forwarded, pasted into chat and leaked through logs, and it would carry unfiled figures with it unless deliberately excluded. Invitation by email covers the need.
- **A full valuation tool.** Discounted cash flow, transaction multiples and several methods side by side are a different product, and the market Valutico already serves. Peerless values a gap at a user-set multiple and stops there.
- **Screening and "find companies like this".** A different product for a different user, and on an open route the most direct way to harvest the register.
- **A composite score.** It would need arbitrary weights across ratios and could not be traced to the accounts.
- **A free-form chat over the data.** It cannot be held to the rule that AI never calculates.
- **Credit scoring, forecasting, group consolidation, ownership mapping, cross-border comparison, custom ratio definitions, payment, multi-language support, native mobile.** Outside the question Peerless answers, or not needed for v1.
- **Banks, insurers and other entities outside the ordinary accounting layout.** Their filings do not fit the layout recognition depends on.
- **Deferred rather than rejected:** share links, user-arranged widgets, monitoring over time, and wider industry coverage are the natural first additions.

## Competitors in more detail

- **Credit bureaus** (Dun & Bradstreet, Experian, Creditsafe) sell risk products because creditors are who pay.
- **Proff Forvalt** sells competitor analysis where the user selects the companies, and industry-average comparison by industry code.
- **Enin** generates lists of comparable companies from accounting figures, purpose, geography, industry code and headcount, for banks' credit, fraud and compliance work. Verified against enin.ai, 2026-09-26.
- **Valutico** released peer recommendation with comparability scores and rationale in its Summer 2026 release, for valuation against listed companies.

Further desk research, with unverified pricing, is in `prds/prd-Peerless-2026-09-25/research-landscape.md`.
