# Epics and stories for v1

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5), `bmad-create-epics-and-stories`. Subagents did the extraction, the story writing for each epic, and an independent final validation.
**Story / issue:** planning
**Result:** `_bmad-output/planning-artifacts/epics.md`, with 40 stories in five v1 epics plus a stage-2/3 backlog epic. Also PRD FR-3, FR-16, FR-18, FR-73 and the glossary; the technical note's AD-2, AD-5, AD-16 and funnel section; EXPERIENCE.md; the brief. See the commit "Epics og stories for v1".

## Goal

Break the PRD's v1 FRs into stories in EXPERIENCE.md's build order. Each story cites its FRs and the technical note's AD ids, and maps to one issue, one branch and one PR.

## Prompts that mattered

- "Build from the PRD's v1 FRs only, in the build order from EXPERIENCE.md: slice 0 is search → company header → key-figure table with API figures first."
- The four story-specific requirements: exact pins, TS 6.x, Cache Components off and the ESLint rule against `Math.round`/`toFixed` (setup); half-away-from-zero with negative ties (engine); spaces, nine digits and modulus 11 with "Ugyldig organisasjonsnummer" (search); a no-filing state, the licence gate and the 30-explanation review (seed).
- "Move the API part of FR-29 and the Oversikt hero card 'Største gap i kroner' into Epic 1." This is the teacher's "organisasjonsnummer → peer-gruppe → nøkkeltall og gap i kroner" early.
- "the two things graded hardest sit last in Epic 5, where an overrun would cut them." This moved the measurement (5.2) to directly after Epic 2, and the demo seed (5.4) to directly after Epic 3.
- "Check that 'measured: true' … is only accepted by the loader when it references the measurement report."

## What came back, and what was done with it

- **Accepted:**
  - **Epics:**
    1. Lookup with API figures and the first kroner gap.
    2. The peer group.
    3. All gaps in kroner and Verdi.
    4. The explanation.
    5. Measurement, demo seed, About page and fresh clone.
    6. Backlog only.
  - **A "Delivery order" section** for sprint planning. Calendar work in week 1 (the labelled set, the OCR reference set as its own issue). CI migrates and seeds on every PR from 1.3b.
  - **Decisions taken along the way:**
    - **Copy and characters:**
      - minus is U+2212, the separators are U+00A0, and `format.ts` is the only formatter, tested byte for byte;
      - "Ugyldig organisasjonsnummer" for a wrong check digit;
      - a no-filing state.
    - **Data:**
      - `seed/coverage.json` as the one hand-edited seed file, with a measured flag that needs a report reference and checksum;
      - the loader owns `covered_industry`;
      - demo company C chosen in 1.3a.
    - **Scope:**
      - a fourth match basis, "Kun beskrivelse" ✦;
      - segmentation loosening moved to stage 3;
      - "Kilder og lisens" on the About page from Epic 1;
      - the Verdi tab only when Epic 3 builds it;
      - FR-28's extraction as v1 data, with display in stage 2;
      - embeddings last and cut first.
  - **Splits:** three oversized stories split with a/b numbering (1.3, 1.6, 3.1), so no other numbers changed.
- **Rejected, and why:**
  - Renumbering after the splits. References in the other documents would have broken.
  - A synthetic company C until 5.4. A real 69.202 company needs only API figures and is available from the start.
- **Corrected, and how it was caught:**
  - **A wrong measurement baseline.** The technical note and the AI log cite "≈ 88 %" for OCR consistency, but `ocr-consistency.md` shows 93 % of 168 evaluable columns. The 88 % is passing columns over all columns (156/178). Story 2.3 now reports both denominators against the spike. Caught by reading the report before writing the threshold into a story.
  - **A misremembered decision.** The user said the report reference for "measured" was "as decided". It had not been recorded anywhere, so it was logged as a new decision rather than as an existing one.
  - **Gaps found by the independent final validation:**
    - no story built `pnpm seed:full`;
    - explanations were never exported into the committed seed;
    - the document-figure credit came three stories after the document figures;
    - the run record had two writers;
    - several stories touching data or money lacked the "what could go wrong" criterion and its AI-log entry.
  - **Wording conflicts caught during writing:**
    - the check-digit message conflicted between the user's instruction and EXPERIENCE;
    - `Intl.NumberFormat` in EXPERIENCE contradicted the technical note's own formatter.

## Links

- `_bmad-output/planning-artifacts/epics.md`
- Architecture memlog entries of 2026-10-10 (coverage.json, measured reference, four match-basis tiers)
- **Still open:**
  - whether run records travel through `seed:export`, so a fresh clone can print them (decide in 2.6);
  - the closed-licence-gate copy in 5.4, to approve when the story runs.
- Next step: `bmad-sprint-planning`, which reads the Delivery order.
