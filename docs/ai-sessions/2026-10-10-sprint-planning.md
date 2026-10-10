# Sprint planning: readiness gate, four settled rules and the first issues

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5), `bmad-sprint-planning`. Two subagents checked the plan in parallel, one tracing FRs from the PRD to the stories and one checking the stories against the architecture and UX decisions. Every finding was verified against the files before it was reported.
**Story / issue:** planning. Issues #1–#12 (Epic 1), #13 (Story 5.1), #14 (the OCR reference set)
**Result:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (new). Also `epics.md`, the technical note, PRD FR-9 and FR-73, EXPERIENCE.md and its mock, `docs/key-figures.md` and `docs/todo.md`. See the commit "Sprint planning: readiness, fire avgjørelser og sprint-status".

## Goal

Before anything was built: check that the epics can be built without anyone inventing a decision, then generate the sprint tracking file in the delivery order and open the issues for the work that starts now.

## Prompts that mattered

- "Run the readiness check first and show me PASS / CONCERNS / FAIL before generating anything."
- "Build the sprint status from epics.md's 'Delivery order' section, not from the story numbering." Week 1 is 5.1 plus the OCR reference set. After that: Epic 1 → Epic 2 → 5.2 → Epic 3 → 5.4 → Epic 4 → 5.5 → 5.6 → 5.3 → 5.7.
- The criteria for demo company C in 1.3a: an active AS in 69.202 with a filing for the latest year, `smaaForetak` and `regnskapslovenAlminneligRegler`, unremarkable, and not the developer's employer (Statement AS, 979 607 008).
- "Settle items 1–4 now rather than leaving them open; each would otherwise be decided silently mid-build."

## What came back, and what was done with it

**Gate: CONCERNS.**
- **What held:**
  - all 50 v1 FRs are in a story's "Implements" line;
  - every AD-n and UX-DR reference resolves;
  - every cross-story dependency is handled with a placeholder or a deferred criterion;
  - the parser reads all 6 epics and 40 stories, including the a/b splits.
- **Four gaps would have been decided mid-build.** The user settled each:
  1. **Stage 3 had no rule for size.** It said it "segments by size on the same basis as stage 1", but stage 1 had already applied the band. *Settled:* stage 1 is the only size step. In v1, stage 3 is legal form only (AS); geography is not used for 62.100. A subject that is not an AS gets its own state: "Peerless sammenligner foreløpig bare aksjeselskaper". EXPERIENCE's funnel example (131 → 88) was invented to fit a size step that does not exist; it is now 131 → 127, and the mock matches.
  2. **Stage 5 contradicted FR-14.** Stages 4 and 5 each removed a mismatching candidate, yet FR-14 says a candidate where the text and the fingerprint disagree stays in the group, flagged. Nothing defined "disagree". *Settled:* the fingerprint and the classification share one set of business types (proposed: produkt, konsulent, forhandler, annet). If both are present and agree, that decides. If they disagree, the candidate is kept and flagged. If only one is present, that one decides. This is recorded in the technical note as "Combining the fingerprint and the text" and in 2.5/2.6.
  3. **The OCR reference set conflicted with NFR15.** It would commit document figures for orgnrs outside the allow-list. See "Corrected" below.
  4. **The licence gate threatened demo company B.** With the gate closed, B might lose the fingerprint it exists to show. *Settled:* allow-listed companies keep their fingerprint categories either way. The gate covers only the other candidates.
- **Minor fixes:**
  - total cost share has direction "–" (a check row);
  - NFR1/2/27 are placed in 1.7 and 2.8, NFR28 in 1.4 and 3.1a, NFR30 in 1.5;
  - the FR-73 inventory line now agrees with the PRD (gate-conditional, C API-only);
  - "manifest" is now `seed/coverage.json`;
  - a stale "Story 1.3" note is removed;
  - 1.3b says what `seed/allow-list.json` holds before 5.4.

**Accepted:**
- `sprint-status.yaml` keeps the script's story-number order in `development_status`, because the script re-sorts that on every refresh.
- The build sequence is a separate `delivery_order` block, with the week-1 calendar items and Epic 6 as backlog. A refresh keeps the block, with one exception: a comment written above it was dropped, so the explanation is a `note:` value inside the block.
- 14 issues were created with `gh`. Each story issue carries the story text, its "Implements" line, its branch, its place in the delivery order and the AGENTS.md Git-workflow checklist. #14 is the OCR reference set; `epics.md` now links it.

**Rejected, and why:**
- Starting without settling items 2–4 and recording them as open questions. That was my first suggestion; the user rejected it because open questions get decided silently by whoever builds the story.

**Corrected, and how it was caught:**
- **Item 3 as first settled could not be scheduled.** The user's first answer was to draw the reference set from the allow-list (A's and B's peers). But A and B are only chosen in Story 5.4, after Epic 3. Their final peer groups also need stages 4–5, which come after Story 2.3. I caught this by checking the answer against the delivery order before editing, and put it back to the user.
- The rule replacing it: a seeded random draw of 15–20 filings from all of 62.100's generated filings. Paper filings are excluded, and the draw is stratified by year (2021–2025) and by size band, with the seed and the orgnrs committed. Each orgnr goes on the allow-list as "OCR-referansesett", and the report states that the sample is the whole industry.
- **One reading the user should check.** "Both present and agreeing" is read as agreeing on *whether the candidate is the subject's type*. A candidate whose fingerprint says forhandler and whose text says produkt, against a konsulent subject, is therefore removed rather than flagged. A literal reading by type would keep and flag it. A missing signal on the subject counts as missing for every candidate. Both readings are written into the technical note so they can be overruled in one place.

## Links

- AI-log entry: "2026-10-10 — Sprint planning: four rules settled before the build, and one settlement that could not be scheduled"
- Issues: https://github.com/IBE160-2026/G97-meinich/issues/1 to /14
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
