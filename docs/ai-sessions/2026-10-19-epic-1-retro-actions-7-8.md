# Epic 1 retro, actions 7 and 8: doc reconciliations and the deferred-work ledger

**Date:** 2026-10-19
**Tool:** Claude Code (Opus 5.5)
**Story / issue:** planning — Epic 1 retro (`_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md`), actions 7 and 8
**Result:** commits on `main`, one per document: `9583878`, `0adaada`, `9e5b863`, `3b094fa`, `32d8212`, `55ba8bb`, `e27c67c`, `d1ac578`, `5ce0fdc`, `1577830`, `f790b0f`, `84ad6fe`, `5916ecb`; the review session added `6a9295b`

## Goal

Apply the doc reconciliations listed under action 7 and the ledger changes in action 8, directly on `main` with one commit per document, and mark both actions done in `sprint-status.yaml`.

## Prompts that mattered

> Fra meg: gjør retro-tiltak 7 og 8 fra _bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md (listene under tabellen). Bare dokumenter, rett på main, én commit per dokument. Sett tiltakene til done i sprint-status.yaml.

> Fra meg: session-fila er din, ikke review-sesjonens – bare docs/ai-prompts.md er review-sesjonens (se AGENTS.md, "Prompts are saved verbatim"). Skriv docs/ai-sessions/2026-10-19-epic-1-retro-actions-7-8.md med commitene, de to valgene du tok (den femte deferred-posten, R6 utelatt), og at review-sesjonen la inn R6 i AD-10 (6a9295b). Commit og push til main.

## What came back, and what was done with it

Commits, action 7:
- `9583878` `epic-1-context.md`: no peer values reach the page, and there is no `src/engine/wire.ts` (S4).
- `0adaada` technical note: AD-5 states the 404 decision and why every status is decided before a Suspense boundary renders (no `loading.tsx`; 404 content from the root `not-found.tsx`). AD-10 says plainly that rotating `X-Forwarded-For` gets a fresh budget per value and that the candidate read is unbounded (S11). AD-16 names the third `-text` path. The 404 rule went into AD-5 only, not AD-12, because AD-12 lists surfaces rather than route behaviour (S5).
- `9e5b863` `spec-1-6b`: Intent and Design Notes corrected to the as-built, under `## Spec Change Log` (S5).
- `3b094fa` PRD FR-7 and `32d8212` `EXPERIENCE.md`: the no-revenue subject state (S6).
- `55ba8bb` `epics.md`: FR-64 split between Epic 1 (the subject) and Epic 3 (peer aggregates, provenance) (S7); the missed Story 1.1 advisory AC recorded.
- `e27c67c` `docs/data-sources-brreg.md`: Story 1.5b's ENK decision, and the count 6 287 (S9).
- `d1ac578` `spec-1-10`: status `done` (S8).
- `5ce0fdc` `AGENTS.md`: the `READER_DATABASE_URL` claim scoped to `src/`, and the third `-text` path (A1).
- `1577830` README: rotating `X-Forwarded-For` defeats the local limit (S11).
- `f790b0f` `spec-1-1`: the missed advisory AC in its change log (S1).

Action 8 and status:
- `84ad6fe` `deferred-work.md`: five entries pruned; R5, R8, D2 and the unbounded candidate read added. R2 and R3 were already there from action 3.
- `5916ecb` `sprint-status.yaml`: actions 7 and 8 `done`.

Two choices made by this session:
- **The fifth pruned entry.** The retro (S10) counts five resolved entries, but the ones it names — the read-types test, the 1.5b split note, the three 1.5b data items, the accept-all `isCandidate` — are four ledger entries. The fifth removed is the `-text` paths entry, which action 7 resolved in `AGENTS.md` and AD-16.
- **R6 left out.** Its disposition says "record under AD-10", but action 7's list does not include it, so this session did not add it and said so in its summary. The review session then added it to AD-10 in `6a9295b`.

Corrected:
- The first `spec-1-6b` change-log entry said there is "no cached `loadSubject`". That is wrong: `lookupSubject` is `loadSubject` wrapped in React's `cache()`. Caught by this session checking `src/server/analysis.ts` after the commit; the local commit was amended before push.
- This session said the session file was the review session's to write. The review session caught it, and the human passed the correction on: only `docs/ai-prompts.md` is the review session's (AGENTS.md, "Prompts are saved verbatim").

## Links

- Retro: `_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md`, actions 7 and 8
- Review-session follow-up: `6a9295b` (R6 in AD-10)
