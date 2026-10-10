# Rescoping after the teacher's feedback, and the grading guide

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5)
**Story / issue:** planning
**Result:** brief, technical note, AGENTS.md and this folder updated — see the commit "Omfang etter tilbakemelding fra faglærer"

## Goal

Pull the teacher's written feedback on the product brief from GitHub, decide what to change, and check the plan against the IBE160 grading guide for part 1.

## Prompts that mattered

- "Kan du gjøre en pull for å hente det som er lagt til i github som er kommentarer og tilbakemelding ihht sensorveiledning?"
- "Ja foreslå som tidligere" — proposals first, changes after approval, as throughout the project.
- "for nr 1. så kan vi fortsatt ha 3 ulike bransjer og næringskoder som vi allerede har inne" — the decision to depart from the feedback on one point.
- "se sensorveiledning" — with the grading guide attached.

## What came back, and what was done with it

- **Accepted from the feedback:** v1 reduced to the core flow; accounts, workspaces, portfolio, development over time, own figures, PDF and the user-written description moved to stage 2; industry overviews to stage 3; the interface moved early (a first working analysis page in week 2); a plan for running locally without our keys — local Supabase, seed data, AI test mode, no email.
- **Departed from, with a reason:** the feedback recommended one industry. Three were kept (62.100, 69.202, 43.210) because the measurement needs their contrast, at the same labelling effort: ten subjects per industry instead of fifteen across two, about 900 judgements either way. 43.210 is the first thing cut. The reason is written into the brief so the departure is visible.
- **Corrected by the AI:** the feedback said the register data is open and can be shipped as seed data. That holds for the API figures (NLOD), but the project had already found that the filed documents carry no stated licence, and the repository is public. Seed data therefore carries document-derived figures for a small sample only.
- **From the grading guide:** criterion 1 looks for branches, pull requests, issues and saved prompts, none of which the repository had. Added the git workflow to AGENTS.md and the technical note, and created this folder.

## Links

- Feedback: `_bmad-output/planning-artifacts/briefs/brief-Peerless-2026-09-17/tilbakemelding-product-brief.md`
- Brief memlog entry of 2026-10-10
- Still to do: PRD update with `bmad-prd` (tag FRs by stage), and the UX session told to pause the industry overviews and portfolio.
