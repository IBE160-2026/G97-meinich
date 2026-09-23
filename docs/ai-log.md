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
| auth | 3 |
| money | 0 |
| parsing | 1 |
| llm-boundary | 1 |
| scope | 2 |
| docs | 1 |

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
