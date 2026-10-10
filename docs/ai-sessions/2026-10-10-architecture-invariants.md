# Architecture invariants in the technical note

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5), `bmad-architecture`, on the coaching path for load-bearing choices only. Three reviewer subagents ran: input reconciliation, version check and adversarial. Each wrote to its own file.
**Story / issue:** planning
**Result:** "Architecture invariants" (AD-1 to AD-19) in `_bmad-output/planning-artifacts/technical-note-architecture.md`, with run log and reviews in `_bmad-output/planning-artifacts/architecture/architecture-Peerless-2026-10-10/`. Also AGENTS.md, PRD FR-6, FR-54, FR-73 and §8, EXPERIENCE.md, the brief, `docs/key-figures.md`, `.env.example` and `.nvmrc`. See the commit "Arkitektur: invarianter".

## Goal

Fix the invariants that keep independently built parts consistent, so stories can cite them and the sensor can check the architecture against the documentation (criterion 5).

## Prompts that mattered

- "Update the existing technical note; no separate architecture document." This follows AGENTS.md's rule against rival documents, which the skill's default output would have broken. I raised the conflict before drafting.
- The user's five starting positions: hybrid recalculation, one validated URL schema, public data written only by batch, no model call at request time, and one schema with dataset tags.
- "A: Alternative 2 — one engine."
- "AD-19 needs a stage boundary … Update .env.example now."

## What came back, and what was done with it

- **Accepted:**
  - **Split batch:** Python only extracts and reconciles raw figures; a TypeScript step uses `src/engine` for everything derived.
  - **Reads:** the public-data schema is kept out of Supabase REST and read through a SELECT-only role. The only JSON endpoint is search, returning identification fields only.
  - **Rate limit:** an in-memory per-IP counter, with persistent limiting as a gate before deployment.
  - **Explanations:** generated for every 62.100 company against the dataset they ship in, and shown only while their input digest matches.
  - **Recalculation:** the server renders adjustments as new URLs; the browser scales share and EV from exact decimal strings with the same engine.
  - **Seed:** one seed path with a manifest.
  - **Raw figures:** stored as filed, in `bigint` øre, with a per-filing status.
  - **Stack:** decimal.js 10.6.0 as the one decimal library. Cache Components off in v1, TypeScript 6.x pinned, and versions checked against the web.
  - **SSB:** added to PRD §8 for stage 3.
  - **FR-54:** given a phrase-list test and a 30-explanation sample review.
- **Rejected, and why:**
  - **Engine version as a hard CI failure on every stored row.** It would force about 1 000 model calls on any engine change; the input digest catches the same staleness without that.
  - **Search as a form-only page.** It would have dropped the typeahead EXPERIENCE.md specifies.
  - **TypeScript 7.** It needs an experimental Next.js flag.
- **Corrected, and how it was caught:**
  - **Two engines.** Explanation at ingestion implied computing figures in batch, and doing that in Python would have meant two implementations of `key-figures.md`. Raised in coaching before drafting.
  - **A harvesting path through Supabase REST.** The anon key becomes public with stage-2 sign-in, so exposing the public-data schema there would bypass the rate limit. Raised in coaching.
  - **IP addresses in Postgres.** A per-IP counter in the database would have stored personal data in a v1 that promises none. Raised in coaching.
  - **Two flaws in the first draft**, both from the adversarial reviewer: Python could store kroner where TypeScript reads øre, and stored explanations were not tied to the output they describe.
  - **Contradictions in the documents**, from the reconciliation reviewer:
    - search against "no JSON endpoints";
    - explanations outside the demo set (PRD and EXPERIENCE said none);
    - a responsive pass scheduled at the end;
    - a stale "one exception" line in AGENTS.md.
  - **Version hazards**, from the version reviewer: postgres.js returning numerics as strings, and Cache Components on by default.

## Links

- AI-log entry of 2026-10-10, "Architecture invariants: one engine, a closed read path, and the seams the first draft left open"
- Reviews: `reviews/review-reconcile.md`, `review-versions.md`, `review-adversarial.md` in the run folder
- **Deferred, each with a revisit point in the run log:**
  - a fallback if the licence gate stays closed;
  - explanation slot references;
  - latency after an adjustment;
  - segmentation wording;
  - the prior-year growth column;
  - pgvector;
  - a pointer to the UI copy convention.
- **Pin to update:** the patched Next.js 16.4.x announced for 2026-10-14.
- Next step: `bmad-create-epics-and-stories`, using EXPERIENCE.md's build order and citing AD ids.
