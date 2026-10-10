# UX spines distilled: DESIGN.md and EXPERIENCE.md for v1

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5), `bmad-ux`, with a subagent for the distillation
**Story / issue:** planning
**Result:** `DESIGN.md` and `EXPERIENCE.md` in `_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/` (status draft), PRD FR-1, FR-4 and glossary, technical note's front page — see the commit "UX-runde 4"

## Goal

Turn the UX decision log and the v1 mocks into the two spines that implementation will build from. Settle the last front-page and navigation decisions first.

## Prompts that mattered

- "Search by company name or organisation number in one field … It searches the companies in the seed database … never the register live."
- "Mark everything AI-generated with ✦ … Engine figures never carry ✦."
- "A product-wide rule: no number is shown without its context."
- "Make the statement useful, not only honest: 'Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi programmeringstjenester (62.100).' followed by links to demo companies A and B."
- "Adopt your reading as the rule: 'Every number shows its context, or says why it has none.'"

## What came back, and what was done with it

- **Accepted:**
  - FR-1 became lookup by name or organisation number in one field, searched in the seed database: fuzzy on name, exact on number. Results show name, number, industry and municipality, and the choice resolves on organisation number.
  - One header on every page, with its search hidden on the front page, where the hero search takes its place.
  - ✦ on the explanation as a whole, read as "KI-generert" by screen readers.
  - The spines, with four flows and every state the user listed. Two of the flows are new: Anders on his phone before the meeting, and Kari reading the margin decomposition. A further state is new: a rate-limit refusal.
- **Corrected by the AI, before the user ruled:**
  - **FR-4 versus FR-73.** FR-4 promised API figures for any uncovered company, but v1 never calls the register (FR-73), so only demo company C could show them. Raised as an open question. The user settled it with a no-data statement that links to demo companies A and B.
  - **The context rule.** It met three cases that have no peer context by design: the uncovered figures, a below-floor own value, and the header revenue. Proposed "or says why it has none" instead of adopting it silently.
  - **Two search fields on the front page.** A header search on every page plus the hero search would have given the front page two.
- **Corrected after the distillation:**
  - The phone flow computed Anders's amounts on a rounded 12.5 m revenue. Recomputed on the PRD's exact 12 518 082 kr: 1 752 531 kr at full convergence, and 212 807 kr to reach the median.
  - The PRD glossary still said the open route is rate-limited "from stage 2", while FR-6 puts the per-IP limit in v1. Aligned with FR-6.
- **Not adopted, for the record:** composite scores, peer-match percentages, an AI chat, screening and rankings, and a compare module. All are out of scope for reasons in the brief's addendum.

## Open, listed in EXPERIENCE.md

- **✦ on "Hvorfor med" against FR-16.** ✦ is meant to go on "Hvorfor med" where AI was involved, but FR-16 says the inclusion reason is written by rules.
- **62.100 companies outside the demo seed.** Their own document figures are missing too, so the "For få sammenlignbare" copy needs a variant without an own value.
- **The closable-share default,** and whether the key-figure table follows the control.
- **Demo companies A and B:** names and organisation numbers, decided when the seed is built.
- **Unconfirmed mock proposals:**
  - Source Serif 4;
  - the beste-fjerdedel triangle;
  - "better to the right" mirroring;
  - the waterfall palette.
- **The v1 mocks predate this round.** The spines list ten discrepancies, which are not re-rendered.

## Links

- UX memlog entries of 2026-10-10
- PRD memlog entries for FR-1 and FR-4
- Previous session: `2026-10-10-ux-v1-scope-and-margin-decomposition.md`
