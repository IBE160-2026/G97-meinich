# UX re-scoped to v1, PRD tagged by stage, and a margin decomposition that adds up

**Date:** 2026-10-04 to 2026-10-10
**Tool:** Claude Code (Opus 5.5), `bmad-ux`, with subagents for source extraction, document edits and HTML mocks
**Story / issue:** planning
**Result:** commits e7e6d2d, 10324cc and the commit that adds this file; PRD, brief, addendum, technical note, `docs/key-figures.md`, AGENTS.md and the UX workspace `_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/`

## Goal

Capture the UX for Peerless as DESIGN.md and EXPERIENCE.md, using the coaching path, with options drawn where seeing them helps. Midway through, after the teacher's feedback, the work was re-scoped to v1. The PRD was restructured into v1, stage 2 and stage 3 so that plan and design describe the same app.

## Prompts that mattered

- "It should feel like a calm, competent analyst — not a database and not a dashboard full of widgets … Everything must be traceable: from a kroner amount to the ratio, to the filed figures, to the source." The brief for the visual and behavioural direction.
- "Keep the signature colour and give the marker a navy-900 outline … Verify these yourself and adjust if anything fails." Every colour pair was checked against WCAG before it was recorded.
- "None of the three directions works yet." Round 1's three layouts were rejected as wholes and replaced by a detailed spec per tab.
- "Show the cost-share breakdown against the peer average instead of each share's own best quarter … tell me whether you think that's worth it."
- "Pause the landing page with industry overviews and the portfolio … Tag every FR as v1, stage 2 or stage 3 … Add an FR for running locally."
- "The brief and technical note were already corrected to one industry in commit 942ec1c … only adjust what's still inconsistent; don't rewrite them."

## What came back, and what was done with it

- **Accepted:**
  - The palette with the user's own values, and markers separated by shape, not colour: the company is a dot, the median a tick.
  - A fixed Norwegian vocabulary, e.g. *beste fjerdedel*, *Plassering*, *Grunnlag for treff*, *peer-gruppen samlet*.
  - The label *Egne tall – ikke levert* in place of "unaudited", because many small AS have no auditor, so their filed accounts are unaudited too.
  - The size band widening in three fixed steps.
  - FR-72, the "Slik fungerer Peerless" page.
  - FR-73, running locally.
  - Every FR tagged by stage, with §6 split into v1, stage 2, stage 3 and out of scope.
  - UJ-2 rebased on a 62.100 prospect, so two journeys run in v1.
  - v1 mocks of the front page, the analysis page with four tabs, and the About page, at desktop and 375 px.
- **Rejected, and why:**
  - Round-1 layouts A, B and C, rejected by the user. One of them, the persistent rail, was rejected for good: there is no side rail anywhere.
  - A plain average for the margin decomposition. In the `62.100` screening sample the mean operating margin is −660 % against a median of −3.2 %, so a few near-zero-revenue companies would flip the reading. A revenue-weighted aggregate over a common peer set was chosen instead.
  - A named "median company" as the benchmark in the margin-or-capital decomposition. Each factor is compared with its own median instead.
- **Corrected, and how it was caught:**
  - **The user's FR-66 premise** was that a withdrawn company must be removed from saved analyses. The PRD actually said the opposite. Reading FR-66 before editing it caught this. The user then chose removal by role, and FR-64 gained an explicit exception.
  - **The user's landing-page source line** claimed NLOD for all data. That repeated the overclaim corrected on 2026-09-30, and checking it against FR-65 caught it.
  - **The VAT caveat** survived in `key-figures.md` in its weaker form after the PRD had been corrected. I first proposed following the document precedence rule. The user overruled that, since the PRD was the accurate one.
  - **Cost-share kroner in a mock** summed to 1.94 m kr under a 1.17 m kr margin gap. The arithmetic was right, but quartiles are not additive. This led to the decomposition against the peer group as a whole.
  - **The mock's amounts** were computed on a rounded 16.7 m revenue instead of the exact filed figure. Re-rendered on exact values.
  - **v1 industries:** the instruction said one industry, while the uncommitted brief and technical note said three. I asked rather than chose. The user confirmed one, and it was already committed in 942ec1c.
  - **Labelled set:** the technical note said 20 subjects / ~600 judgements. Corrected to 30 × 30 / ~900, the effort already budgeted. The earlier session file of the same day records the 20 as it stood then.

## Links

- AI-log entries of 2026-10-04 (withdrawn companies; VAT and "unaudited"; sparklines and the source line) and 2026-10-10 (cost-share kroner replaced by a decomposition)
- `docs/key-figures.md` — "Margin decomposition against the peer group as a whole"
- UX memlog: `_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/.memlog.md`
- Mocks: `.working/v1-front.html`, `.working/v1-analysis.html`, `.working/v1-about.html` in the UX workspace. Earlier rounds are kept there as the audit trail.
- Resolved at the end of the session:
  - **The fresh clone would have shown mostly "too few peers".** A public seed with document figures for 20–30 arbitrary companies clears the ten-peer floor for almost nothing. It became two seed levels. The committed **demo** seed (`pnpm seed`) carries API figures for all of 62.100 and document figures for three named demo companies and their peer groups:
    - A, a typical consultancy;
    - B, a loss-making product company;
    - C, a 69.202 bookkeeping firm in the uncovered state.

    The **full** seed (`pnpm seed:full`) is generated locally and never committed while the documents' licence is unresolved. Recorded in FR-73 and "Running Peerless locally".
  - **Security grading after the cut.** The technical note still said "Security/login: yes, strictly". It now says v1 has no accounts, following the teacher's feedback. v1 security is input validation, server-side secrets, a per-IP rate-limited open route and no stored user data, so FR-6's per-IP limit moved into v1. Accounts and workspaces are the first item of stage 2.
- Still open: DESIGN.md and EXPERIENCE.md are not yet distilled.
