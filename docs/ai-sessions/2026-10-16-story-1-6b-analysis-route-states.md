# Story 1.6b: open an analysis in the right state

**Date:** 2026-10-16
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #8, Story 1.6b
**Result:** branch `story/1.6b-analysis-route-states` (PR to follow).

## Goal

The analysis route in every state — covered (three tabs with an empty panel heading each), uncovered (demo company C), no filing, not found, invalid orgnr — with the statuses the spec's matrix requires, the compact search in the header, `/slik-fungerer-peerless` with "Kilder og lisens", the loading and error states, a read-only reader connection and the service-role grep test.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-6b-analysis-route-states.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human's decisions recorded in the spec's frozen section (2026-10-16): HTTP 404 for not found and for an invalid orgnr, the two-row header on the phone with a header search at least 200 px wide, the accepted "Kilder og lisens" copy, and the compact field's placeholder in addition to its label.

## What came back, and what was done with it

- **Accepted:**
  - `src/analysis/view.ts`: `analysisView(subject, parsed, search)` → state, redirect target, effective tab, notice flag and title; `URL_CONTEXT` (accept-all `isCandidate` until 1.7, no median step until 3.5); `OPEN_FANER` (no Verdi). Every matrix row is in `test/analysis/view.test.ts`.
  - `src/server/analysis.ts`: one parameterised query for the company, its coverage, its newest `SELSKAP` filing and its key figures; `lookupSubject` cached per request.
  - The route files, `src/components/analysis/*` (company header, tab links, State block, notice, API figures, focus manager, loading, lookup error, not-found body), `FrontPageBody` shared by `/` and the invalid-orgnr 404, the header search slot, the about page, `formatReadDate`, `parseSegments`, `tParts`.
  - Tests: `test/analysis/view.test.ts`, `test/analysis-shell.test.ts`, `test/service-role.test.ts`, `test/db/analysis.test.ts`, `e2e/analysis.spec.ts`, and updates to the URL, formatter and search-field tests and `e2e/search.spec.ts`.
- **Deviations from the spec's design, forced by Next.js 16.4 and found by probing the production build** (details in the ai-log entry):
  - No `loading.tsx`: below the layout it wraps the page in Suspense and starts a 200 response before the page's redirect, which then arrives as a meta refresh. The loading state is a Suspense boundary inside the page, after the redirect decision; redirects are real 307s.
  - The 404 states are rendered by the root `src/app/not-found.tsx`, not `src/app/analyse/not-found.tsx`: a `notFound()` before streaming is recovered with the root not-found tree. The status is 404; the content is rendered on the client after load (Next.js's error shell).
  - A failed subject read is a value, not a throw: thrown outside Suspense it would skip `error.tsx`. The layout renders the lookup-error state; `src/app/analyse/error.tsx` stays for anything else thrown below the segment.
  - Next.js passes params percent-encoded, so `parseSegments` decodes each segment once before encoding it.
- **Decided in implementation, for review:**
  - A redirect keeps the query canonically (`serialize`) when nothing fell back, and as it came when a value fell back, so the target still shows the notice.
  - Read date is the filing's `read_at`; month abbreviations are fixed (`jan.` … `des.`, CLDR nb).
  - Below `md`, the compact submit button shows a magnifier and keeps "Sammenlign" as its accessible name, so the field is at least 200 px wide at 320 px.
  - New copy beyond the spec's quotes: the undefined-figure reason "eiendelene er null eller negative" (the vocabulary's "omsetningen …" fits driftsmargin only), "Kan ikke beregnes: {grunn}", the uncovered fallback "Selskapets bransje", and for unknown non-analysis paths "Denne siden finnes ikke." / "Til forsiden".
  - The not-found state has no `h1`; no copy was specified for one.

## Links

- `docs/ai-log.md`, entry "Story 1.6b: the analysis route reads the subject before streaming, and what it may show".
- `AGENTS.md` Toolchain paragraph (reader read-only, service-role test, `parseSegments`, why there is no `loading.tsx`).
- `deferred-work.md`: the two 1.5b items about the compact field are resolved and removed; one new item on the client-rendered 404 content.
