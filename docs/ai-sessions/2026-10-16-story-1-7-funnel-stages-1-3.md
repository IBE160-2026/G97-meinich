# Story 1.7: Peerless finds comparable companies, stages 1–3

**Date:** 2026-10-16
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #9, Story 1.7
**Result:** branch `story/1.7-funnel-stages-1-3` (PR to follow).

## Goal

Funnel stages 1–3 as a pure engine module, one candidate read per request as `reader`, `ekskl` checked against the pool at the URL's band, the peer count in the header, the peer list on the Peers tab, and a state of its own for a subject that is not an AS.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-7-funnel-stages-1-3.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human's decisions recorded in the spec's frozen section (2026-10-16): the spec kept whole; a non-calendar subject keeps the covered page with "0 sammenlignbare" and its own Peers sentence, the reason reported by the engine; `isCandidate(peer, band)`; dormant companies settled by stage 1.

## What came back, and what was done with it

- **Accepted:**
  - `src/engine/peers.ts`: `SIZE_BANDS` (exact decimals 0.5/2, 0.33/3, 0.25/4), `CandidateFiling` and `SubjectFiling` (øre as `bigint`, no assets, employee or performance field), `benchmarkFiling`, `isComparable`, `isCalendarYear`, `isKnownCurrency` (ISO 4217; `EDT` is not one), `assemblePeerGroup` (pool sorted by revenue then orgnr, counts `{ stage1, stage2, stage3: { legalForm } }`, `emptyReason`) and `withoutExcluded`. Exported from `src/engine/index.ts`.
  - `src/url/analysis-state.ts`: `Band` is the engine's `SizeBand`; `parse` reads `band` before `ekskl` and calls `isCandidate(peer, band)`.
  - `src/analysis/view.ts`: `Subject` carries `organisasjonsform` and the filing's comparability fields; `hasPeerGroup`, `funnelSubject`; the `non-as` state (precedence no filing → uncovered → non-AS → covered); `URL_CONTEXT` split into `PATH_CONTEXT` (accept-all, for path-only parsing in the layout and client components) and `urlContext(poolAt)`.
  - `src/server/analysis.ts`: `SUBJECT_SQL` reads the comparability fields (dates cast to text); `CANDIDATES_SQL` reads, for the subject's `naeringskode1` and benchmark year, each other company's filings with revenue, name, municipality and legal form; `lookupCandidates` is cached and fails with a fixed message like `lookupSubject`.
  - `src/components/analysis/analysis-page.tsx`: subject read, then the candidate read for a covered AS, then `parse` with the real context, so an `ekskl` outside the pool sets the notice before the redirect decision. Each band's pool is assembled on demand from the one read. The non-AS branch reuses `StateBlock`, `ApiFigures` and `SearchAgain` (shared with the uncovered state as `OwnFigures`).
  - `company-header.tsx` (`peerCount` after the revenue, also 0), `peer-list.tsx` (count line, a labelled `role="region"` scroll container with the table, the empty and non-calendar sentences, "Ukjent", "Ikke i kroner"), the new `nb.json` ids.
  - Tests: `test/engine/peers.test.ts` (every engine row of the matrix, ±1 øre at all three steps, one test per stage-2 field, legal form, counts, the benchmark filing, a compile-time check that the inputs hold no assets, employee or performance field), the band-aware URL test, the non-AS and precedence rows and `urlContext` in `test/analysis/view.test.ts`, `test/analysis/peer-list.test.ts`, the header count, the failed candidate read, `test/db/peers.test.ts` (timed assembly, no outbound request, the grep) and the e2e block (header count, Peers count and order, region, no peer orgnr in the HTML, both `ekskl` rows, reflow at 375 and 320 px, the non-AS states and redirect).
- **Decided in implementation, for review:**
  - **Changes a 1.6a decision:** `isCandidate(peer)` assumed the caller knew the pool; the pool depends on the band, which `parse` reads from the same URL, so it now takes `(peer, band)` and `parse` reads `band` first. Recorded here, in the spec and in AGENTS.md's URL-module sentence.
  - A subject with no pool (uncovered, no filing, non-AS) gets an always-empty pool, so any `ekskl` on it is dropped with the notice. Before, `ekskl` was accepted for every subject.
  - `emptyReason` follows the funnel order: `subject_no_revenue` (stage 1) before `subject_non_calendar` (stage 2).
  - The candidate read returns every filing of the benchmark year (any `regnskapstype`); the engine picks each company's benchmark filing. A `KONSERN` filing picked for want of a `SELSKAP` one is out at stage 2.
  - Rows are keyed by position, not orgnr: a React key travels in the RSC payload, and the e2e test checks that no pool orgnr is in the Peers HTML.
  - The grep for register and model hosts allows the bare `https://data.brreg.no`: it is the NLOD attribution link on "Slik fungerer Peerless", not a request. Any path under `brreg.no` fails the test.
  - The e2e `main` locator now skips the Suspense fallback (`main:not([aria-busy="true"])`): with the heavier Peers page, two `<main>` elements were briefly in the document during the streamed swap, and two existing tests failed once in strict mode.
  - The edge-fade cue named in UX-DR37 is not drawn; the region has the role, label, `tabindex` and a visible focus ring.

## Review fixes (2026-10-16)

- Added `peers.noRevenue` (human decision, review finding 6), shown when `emptyReason` is `subject_no_revenue`, with the year. The placeholder is `{aar}`, as in `analysis.dataDate`: `t()` matches `\w`, so `{år}` would never be filled. The rendered copy is the one decided.
- Added singular copy for n = 1: "1 sammenlignbart selskap" and "1 sammenlignbart".
- Added a visually hidden table caption, and corrected the peer-list comment about the nameless-peer orgnr.
- Added `VED` and `XCG` to the ISO 4217 list, with its source named.
- Wrote the stage 1–3 rules into `docs/key-figures.md`.
- Widened the host grep to all of `src/`. The pattern now matches the registers' API paths, not their names, which the copy uses.
- New tests:
  - A failed candidate read is driven through the page and its metadata.
  - e2e: zero, negative and null revenue, a non-calendar subject, and `ekskl` on subjects with no pool.
- Correction found while running e2e: `FocusManager` could focus the old page's `h1` while the old page and the loading state, or the old page and the 404, were both in the document. Two client-navigation focus tests then failed in most full runs. It now waits until there is one `main` and no busy one. The 404 focus test first waits for a single `h1`. Three full e2e runs then passed.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-1-7-funnel-stages-1-3.md`
- AI log: "Story 1.7: what the peer read reads, what the payload shows, and selection on the wrong basis"
- Documents updated: `AGENTS.md` (URL-module sentence, state precedence, the candidate read), PRD FR-8 and EXPERIENCE.md's Peers row (non-calendar subjects), `deferred-work.md` (dormant-companies entry removed), `sprint-status.yaml`.
