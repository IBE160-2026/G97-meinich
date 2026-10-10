# UX spines reviewed by four lenses and finalised

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5), `bmad-ux` Finalize. Reviewer gate with four parallel subagents (rubric, accessibility, figures, adversarial), a fix pass and a polish pass with `bmad-review` (structure, prose).
**Story / issue:** planning
**Result:** `DESIGN.md` and `EXPERIENCE.md` set to `status: final`; validation report and four review files in the UX workspace; v1 mocks promoted to `mockups/`; PRD FR-52, FR-69, FR-73, UJ-1, UJ-2; technical note; `docs/key-figures.md`. See the commit "UX-runde 5".

## Goal

Take the drafted spines through the workflow's Finalize: resolve the last open choices, review the spines with independent lenses, fix what the reviews found, polish, and mark them final.

## Prompts that mattered

- "✦: agreed — no ✦ on 'Hvorfor med' (rules-written, FR-16) … My earlier instruction was wrong."
- "Finalize: yes to the reviewer lenses; move only the v1 mocks to mockups/ and keep earlier rounds in .working/ as history."
- The lens choice: all four — rubric walker, accessibility, figures and money, adversarial.
- "One veto: show placement in whole percent ('bedre enn 61 %'), not 60,9 % … Add it to docs/key-figures.md as an explicit exception."

## What came back, and what was done with it

- **Accepted:**
  - **Decided before the review:**
    - ✦ on the match basis "Beskrivelse og regnskap", on "Usikker klassifisering" and on the explanation;
    - "Ikke i demodataene" with an explanatory popover;
    - the table and hero always at full convergence, with Verdi starting at 50 %;
    - Source Serif 4 for headings only;
    - the hollow triangle for beste fjerdedel;
    - "better to the right" with the axis label "Bedre →";
    - waterfall bars in petrol and amber, with the residual in slate.
  - **Decided after the review:**
    - fingerprint results for every 62.100 candidate in the demo seed, behind a licence gate;
    - "Til medianen" defined exactly in `key-figures.md`;
    - the explanation hidden for an adjusted peer group;
    - light mode only in v1;
    - the URL schema, breakpoint and remaining defaults;
    - "Største kapitalgap" in place of "Nest største gap";
    - three clarifications in `key-figures.md`.
  - **Defaults proposed from the reviewers' fixes**, accepted without veto:
    - a 320 px reflow floor;
    - the uncertainty flag in slate;
    - excluded rows in slate with the word "Ekskludert";
    - a visible middle-half band (#6C7F95, 3.09:1 on the track) plus Q1–Q3 as text;
    - caveats never only in a tooltip;
    - a "Vis tallene" table for every chart;
    - a build order whose slice 0 matches the technical note's week 2.
- **Rejected, and why:**
  - The figures reviewer's 60,9 %, vetoed by the user: with about 23 peers a decimal is false precision. Recorded as an exception in `key-figures.md`.
  - "Hvorfor med" with ✦: the text is written by rules, so marking it would mislabel engine output as AI.
- **Corrected, and how it was caught:**
  - **The demo seed could not produce the peer groups it was meant to show.** The adversarial and figures reviewers found it independently: stage 4 needs document figures for every candidate, not only for the final peers.
  - **"Til medianen" contradicted `key-figures.md`.** Its amount also depended on whether the exact or the displayed share was used: 212 807 kr against 210 304 kr. The figures reviewer recomputed both.
  - **The stored explanation beside an adjusted group** carried stale figures, and its own source line became false.
  - **Accessibility:** excluded rows at 4.15:1, a middle-half band at 1.00:1, caveats reachable only by tooltip, and dark-mode focus rings at 1.58:1.
  - **Facilitator check:** the waterfall's signed largest-remainder rounding was tested against the mock's exact amounts before it was written into `key-figures.md`.

## Links

- `_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/validation-report.html` (and `.md`), `review-*.md`
- AI-log entry of 2026-10-10, "Four reviewers on the UX spines: the arithmetic held, the seed did not"
- Still open, listed in EXPERIENCE.md:
  - demo companies A, B and C;
  - the licence assessment for fingerprint categories;
  - recompute location (for `bmad-architecture`);
  - how screen readers read space-grouped numbers;
  - ✦ on the "Klassifisering" funnel stage. The recommendation is no.
- Previous session: `2026-10-10-ux-spines-distilled.md`
