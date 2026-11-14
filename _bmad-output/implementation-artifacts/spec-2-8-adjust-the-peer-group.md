---
title: 'Story 2.8: Adjust the peer group'
type: 'feature'
created: '2026-11-13'
status: 'in-review'
baseline_commit: '042fbe1a7083b8bcbfbad96e5183e8d1d94c6355'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The user can see the peer group and why each peer is in it (Story 2.7), but cannot remove a peer they know is wrong or widen a thin group, so they must either accept the default group or edit the URL by hand (FR-17, FR-18, FR-19).

**Approach:** Exclude, restore, widen and reset are soft navigations: `router.push` to a URL from `serialize`, rendered on the server, with nothing stored. A client provider in `src/app/analyse/[orgnr]/layout.tsx`, which survives query-only navigations, holds the pending state, the announcements and the failure alert. Issue #58, branch `story/2.8-adjust-peer-group`.

## Boundaries & Constraints

**Always:**
- Every change URL comes from `serialize`. It is built on the latest requested state (a second click while one is pending builds on the first), never on a string the client composes.
- The size band is the only thing that loosens. No control offers a comparability field, legal form, industry or geography.
- Excluded rows stay in the list. Every aggregate, percentile, kroner amount and the header count use group − `ekskl`.
- The funnel's flagged count and its "{n} ekskludert av deg → {m} i analysen" line count only the peers in the analysis (deferred item, Story 2.7 triage row 13).
- "Vis alle" stays open across exclude and restore, so focus can stay on the button. It closes when the band changes, because it is keyed by the band (deferred item, triage row 14).
- No animation in any motion mode. Every target is ≥ 24 × 24 px. Neither 375 nor 320 px scrolls the body sideways.
- Fixtures and examples come from demo A/B or synthetic companies. A test on another seed subject compares totals only and names no company.
- No `pnpm classify` run, no deleted dump, no push before Meinich says so. Small commits.

**Never:** a server action, a new route or endpoint, a cookie or browser storage for the group, the explanation's adjusted-group state (Epic 4), share or EV controls (Epic 3), or loosening segmentation (stage 3).

**Decisions (Meinich, 2026-11-13):**
- **AD-4:** the orgnr of every peer in the group, excluded rows included, may reach the page: the exclusion writes it into the URL. Pool peers removed at stage 4 or 5 stay banned from the payload. This PR amends AD-4 in the technical note.
- **Prefetch:** the tab links get `prefetch={false}`, so a change costs one analysis request.
- **429:** a change answered with 429 becomes a full page load, and the user sees the refusal page at the new URL. That is the one exception to "the URL stays at the last good state". It is written into EXPERIENCE "Recompute" and into epics.md, and an e2e test shows the refusal page.
- **Error boundary:** `src/app/analyse/[orgnr]/error.tsx` goes back (`router.back()` + `reset()`) only while the provider has a peer-group change pending. On any other error, the first load of a page included, it shows today's error state (`role="alert"`, no detail) and never navigates. `e2e/db-down.spec.ts` passes unchanged.
- **Copy:** as shown at the checkpoint, with three changes: the range is "Omsetning {fra}–{til} mill. kr" (e.g. "Omsetning 3,1–12,4 mill. kr"); "Bare størrelsesintervallet kan utvides. Kravene til sammenlignbart regnskap, selskapsform og bransje løsnes aldri."; "Du har ekskludert alle sammenlignbare selskaper. Ta med et selskap igjen, eller tilbakestill til standard." The other new strings are approved as shown: "Størrelsesintervall"; the singular m = 1 forms; the too-small block at the widest band; "Handling"; "Ta med igjen {Navn}".
- At 0,33–3× the too-small block also has "Utvid størrelsesintervallet", which widens one step. The step labels come from `SIZE_BANDS` through a new `formatBandFactor`.
- The full spec is kept.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails without it |
|---|---|---|---|
| Exclude | press "Ekskluder {Navn}" | URL from `serialize` with the orgnr added; row struck through, "Ekskludert", "Ta med igjen"; focus on the same button; announcement | `e2e/peer-adjust.spec.ts` "exclude and restore keep focus, announce and push one history entry each" |
| Back | after exclude, restore, widen or reset | one history entry each; back gives the previous group | same spec, "back returns the previous peer group" |
| Nothing stored | any change | no write: `reader` holds SELECT only; no server action | `test/db/grants.test.ts`, `pnpm check:routes` |
| Reset | exclusions and band 2 | `ekskl` empty, band 0, announced, focus on the Peers `h2` | `e2e/peer-adjust.spec.ts` "reset restores the standard group and focuses the heading" |
| Band | choose step 1 | `band=1`, range shown, "Utvidet" tag + State block, focus stays on the step, roving tabindex | `e2e/peer-adjust.spec.ts` "the size band is a radiogroup …"; `test/analysis/size-band.test.ts` |
| FR-18 | each band × each of the six fields failing | never in the pool | `test/engine/peers.test.ts` "FR-18: no band admits a candidate that fails a comparability field" |
| Band drops `ekskl` | `ekskl` outside the new band's pool | dropped; notice once; the next change does not repeat it | `e2e/peer-adjust.spec.ts` "a band change drops exclusions outside the pool with the notice once" |
| Floor | group of 10 → exclude 1 → restore | below-floor state, then the comparison back | `test/analysis/shown-group.test.ts` "crosses the 10-peer floor both ways"; `e2e/peer-adjust.spec.ts` "an exclusion takes a figure below the floor and back" (seed subject, totals only) |
| Too small | < 10 at band 0 / 1, at band 2, 0 | State block with "Utvid…", without it ("… også med det videste intervallet"), "Fant ingen…" | `test/analysis/peer-list.test.ts` "too-small block at each band" |
| All excluded | every group peer in `ekskl` | its own sentence, the funnel with "→ 0 i analysen" | `test/analysis/peer-list.test.ts` "a group excluded entirely" |
| Funnel with `ekskl` | 2 excluded, 1 of them flagged | "2 ekskludert av deg → m"; flagged count without the excluded one | `test/analysis/shown-group.test.ts` "counts flagged among the peers in the analysis" |
| Vis alle | open, then exclude / change band | stays open / closes | `test/analysis/show-all-toggle.test.ts` (keyed by band) + `e2e/peer-adjust.spec.ts` at 375 px |
| Pending | a change in flight | `aria-busy="true"` on the panel and header count, figures dimmed, "Oppdaterer …", no animation | `e2e/peer-adjust.spec.ts` "a pending change dims the figures and marks them busy" (response held by `page.route`) |
| Failure | the change's RSC request is answered with the db-down server's payload | `role="alert"` "Kunne ikke oppdatere analysen. Prøv igjen."; URL and figures as before | `e2e/peer-adjust.spec.ts` "a failed change keeps the last good URL and figures" |
| Failure on first load | the database is unreachable on a direct load | today's error state; the page stays at the opened URL, with no Back | `e2e/db-down.spec.ts` (unchanged) + `e2e/db-down.spec.ts` "a direct load with an error does not navigate away" |
| 429 mid-series | the change's request over budget | the refusal page at the new URL | `e2e/peer-adjust.spec.ts` "a change over the rate limit shows the refusal page" |
| Tab prefetch off | load, then a change | one analysis request per change | `e2e/peer-adjust.spec.ts` "a change costs one analysis request" |
| Assembly time | demo A/B, each band, with `ekskl` | subject + candidate read + assembly + shown group < 1 s | `test/db/peer-assembly-time.test.ts` |
| Phone | every 2.8 state at 375 and 320 px | no sideways body scroll; the band control a 3-column grid | `e2e/peer-adjust.spec.ts` "at {w} px …" |

</frozen-after-approval>

## Code Map

- `src/url/analysis-state.ts` -- reuse `parse`/`serialize` unchanged. `ekskl` is checked against the pool at the parsed band.
- `src/components/analysis/analysis-page.tsx` `resolve`/`Covered` -- pass the parsed state, the rows with an excluded flag, the funnel with the exclusion counts, the band ranges and the too-small state. Rows come from the group (not group − ekskl).
- `src/analysis/shown-group.ts` -- add `excludedInGroup`, `analysisCount`, and flagged without `ekskl`. The benchmark is unchanged.
- `src/analysis/peer-rows.ts` -- add `excluded: boolean` and the peer's orgnr (AD-4 decision).
- `src/engine/peers.ts` `SIZE_BANDS` -- the source of the step labels and ranges. Add no literal.
- `src/engine/format.ts` -- add `formatBandFactor` ("0,33", "0,5", "2"): `formatMultiple` gives one decimal, so "0,3". Add `formatMillionsNumber` (no unit) for the range "3,1–12,4 mill. kr".
- `src/components/analysis/tab-links.tsx` -- `prefetch={false}`.
- `src/app/analyse/[orgnr]/layout.tsx` -- wrap the children in `PeerChangeProvider` (new, `'use client'`, `src/components/analysis/peer-change.tsx`): `useTransition` + `router.push(href, { scroll: false })`, `isPending`, the latest target, the last good href, a polite live region, and the `role="alert"`.
- `src/app/analyse/[orgnr]/error.tsx` (new) -- inside the layout, so the provider survives. When a change is in flight it calls `router.back()` and `reset()`: Next's boundary resets only on a pathname change (`error-boundary.js` `getDerivedStateFromProps`), and Back is served from the router cache with 0 requests (measured). Otherwise (the first load included) it renders `LookupError` as `src/app/analyse/error.tsx` does, and never navigates.
- `src/components/analysis/peer-list.tsx`, `peer-card.tsx`, `peer-funnel.tsx`, `show-all-toggle.tsx` -- the action column, the excluded style (DESIGN.md), the funnel line, the too-small and widened blocks, and the toggle keyed by band.
- `src/components/analysis/size-band.tsx` (new, client) -- the radiogroup, following the roving pattern in `tab-links.tsx`/EXPERIENCE.
- `src/components/analysis/company-header.tsx` -- the busy/dimmed count and the "Utvidet" tag.
- `src/components/analysis/focus-manager.tsx` -- unchanged: a query-only change keeps the pathname, so it does not move focus.
- `e2e/payload.ts` -- `inUrl` becomes the group's orgnrs (AD-4 decision).
- `e2e/seed.ts` -- `floorSubject()`: a covered AS outside `analysis/labelled-set/document-run.json` with 11–30 peers at band 0.
- `src/messages/nb.json`, EXPERIENCE -- the approved copy.
- Do not change: the funnel rules, `register.*`, the seed, `parse`/`serialize`, the proxy and its budgets.

## Tasks & Acceptance

**Execution (one commit each):**
- [x] `src/engine/format.ts` + test, then the FR-18 band loop in `test/engine/peers.test.ts`.
- [x] `shown-group.ts`, `peer-rows.ts` + tests (floor, flagged, exclusion counts).
- [x] Copy into `nb.json` and EXPERIENCE (after approval).
- [x] `peer-change.tsx`, `[orgnr]/layout.tsx`, `[orgnr]/error.tsx`.
- [x] `size-band.tsx`, the peer list/cards/funnel/header changes + component tests; check at 375/320 px.
- [x] `test/db/peer-assembly-time.test.ts`.
- [x] `e2e/peer-adjust.spec.ts`, `e2e/payload.ts`, `e2e/seed.ts`, and a timing spec that records the time to the re-rendered analysis.
- [ ] Review fixes (a separate commit); `docs/ai-log.md` (URL state into the engine, failed recompute); technical note AD-4/AD-6, EXPERIENCE, epics.md and the PRD if a decision moves them; session file; sesjonslogg.

**Acceptance Criteria:** those of `epics.md` Story 2.8 as settled by the decisions. The PR states what can go wrong when URL state reaches the engine and when a recompute fails, records the measured times (NFR1, NFR2), and has a "Planning documents:" line.

## Implementation Notes

- Nine implementation commits, `b3f7689` to `95f5343`, by the implementation subagent. `PHONE_CARDS` moved to `src/components/analysis/phone-cards.ts`, because Node tests can no longer import `peer-list.tsx` now that it pulls in `next/navigation`.
- A query-only navigation keeps the page's elements (checked in a browser), so a client component's own state survives a change. That is what made review triage row 1 possible.
- The full suite runs only against the committed seed (`pnpm seed`), not against the restored document dump, because the e2e expectations compute the group from the committed files. Before each seed load the local document rows were dumped (`.local/before-2.8-suite/`, `.local/before-2.8-review/`, both identical to `.local/document-run-2.5d/`), and afterwards `.local/document-run-2.5d/` was restored and `pnpm derive` run.
- Measured (NFR1, NFR2): assembly for demo A and B at every band with three exclusions is 87–145 ms (`test/db/peer-assembly-time.test.ts`). In a browser, the median of three runs from click to the filled announcement on demo A's Peers tab is: load 553 ms, exclude 498 ms, restore 406 ms, band 511 ms, reset 471 ms (`e2e/peer-change-timing.spec.ts`).

## Spec Change Log

- 2026-11-13, BMAD session, review: the I/O matrix row "Failure on first load" names `e2e/db-down.spec.ts`. That server fails in the `[orgnr]` layout, so the outer `src/app/analyse/error.tsx` renders and the segment's boundary is never reached (review triage row 3). The row is now covered by `e2e/peer-adjust.spec.ts` "a page error outside a peer-group change shows the error state and does not navigate", which fails with `recovering` forced true. `e2e/db-down.spec.ts` "a direct load with an error does not navigate away" still shows that a failed direct load stays put. KEEP: `e2e/db-down.spec.ts`'s existing tests unchanged.
- 2026-11-13, BMAD session, review: the Code Map says "Vis alle" is keyed by the band. The implementation also holds its open state in the provider, as the band it was opened at, so it does not rest on React keeping the component. The provider also puts focus on the change's target after a commit, but only when focus was lost (triage row 5), for example after "Utvid størrelsesintervallet", whose link goes. KEEP: open across exclude and restore, closed by a band change; focus stays on the pressed button.
- 2026-11-13, BMAD session, review: every server render of a covered page commits once to the provider (`renderId`), so a change that ends on the last committed URL still clears the change in flight and is announced (triage row 2). The failure alert clears on the first commit after the failure's own Back (triage row 6). An empty group shows "Fant ingen sammenlignbare selskaper." with no widen action, as EXPERIENCE gives it (triage row 8).
- 2026-11-14, Meinich, after the review session pointed it out: the singular forms approved at the checkpoint as "1 sammenlignbar" were wrong. The word agrees with "selskap", which is neuter, also when it stands alone, and so it matches `analysis.peerCountOne` from Story 1.7. The six strings (`peers.tooSmallOne`, `peers.tooSmallWidestOne` and the four `peers.announce.*One`) read "1 sammenlignbart"; the decision in the frozen block above is superseded on this point. `test/analysis/peer-change.test.ts` checks the new form.

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | BMAD session (diff check, step 3) | `SizeBandControl` keeps `chosen` in `useState(band)`, and a query-only navigation keeps the component, so after a reset or a browser Back the radiogroup checks the wrong step | high | probe on `next start`: reset from `band=2` left step 2 checked at `/peers`; Back to Standard left step 1 checked. The new assertions in "back returns …" and "reset restores …" fail on the old build | patch (applied: `chosen` counts only while a change is in flight) |
| 2 | Blind, Edge case, Verification gap | `inFlight` stays set when a change commits the same `href`/`count`/`bandLabel` as the last commit (exclude, then restore while pending): `PeerChangeCommit`'s effect does not run again, so there is no announcement, and a later unrelated page error takes the recovering branch and goes Back | medium | the effect's deps are `[commit, href, count, bandLabel]`; the restore's push goes to the last good URL | patch |
| 3 | Verification gap, Blind | The non-recovering branch of `[orgnr]/error.tsx` is reached by no test: the db-down server fails in the layout, so the outer boundary renders; the matrix row "Failure on first load" names a test that cannot fail for it | medium | AI log item 6 says so; `recovering` always true would leave every test green | patch (a test, and a Spec Change Log entry) |
| 4 | Verification gap, Blind | `announcement` (the singular forms) and `nextState` have no unit test | low | no test imports `src/analysis/peer-change.ts`; e2e asserts plurals only | patch |
| 5 | Edge case, Blind | The provider puts focus back on the change's target after commit even when the user has moved focus elsewhere meanwhile | low | `commit()` focuses whenever `document.activeElement !== target`; EXPERIENCE says focus stays | patch |
| 6 | Blind | The failure alert stays through later tab changes and Back/Forward until the next peer change | low | `failed` is cleared only in `change()` | patch |
| 7 | Blind | The AD-4 payload scan runs only at band 0 with no `ekskl`; not on the states 2.8 adds | medium | `expectNoPeerFields` calls in `e2e/peers.spec.ts` | patch |
| 8 | Blind | `groupTooSmall` offers "Utvid størrelsesintervallet" with "Fant ingen sammenlignbare selskaper." at band 0 and 1; EXPERIENCE gives the zero state as the sentence alone | low | `size-band.ts` returns `widen: wider` for `memberCount === 0`; tested at band 2 only | patch |
| 9 | Edge case, Blind | `findElement` in `test/analysis/peer-list.test.ts` (new in this story) swallows every error a function component throws, so a throwing server component passes as absent | low | `catch {}` around any function component | patch |
| 10 | Edge case, Blind | After stacked pushes (X1 then X2) a failure of X2 goes Back to X1, never rendered, not the last good URL | maybe-false | depends on whether Next.js writes X1's history entry when X2 supersedes it before commit; settled by an e2e test that fails the second of two quick changes | patch (the test; the fix only if it fails) |
| 11 | Blind | `epic-2-context.md` lost the blind-labelled-set rule, the AI-marking rules, classification inputs and "runs without keys" in its recompile | low | the 2.8 tests that pick seed subjects rely on the blind rule; 2.9 reads the file | patch (docs, BMAD session) |
| 12 | Blind | The spec at `in-review` while `sprint-status.yaml` says `in-progress`; the change logs empty; session file, deferred-work resolution and the AI log's review fields missing | low | AGENTS.md vocabularies, L3–L5 | patch (docs, BMAD session) |
| 13 | Edge case | A superseded change's page commits before the later one, so the later announcement takes its count | low | Next.js commits only the latest navigation; the proposed `href` guard would leave `inFlight` stuck whenever the server drops an `ekskl` item (the canonical `href` then differs from the pushed one) | reject |
| 14 | Edge case | `PeerChangeLink` calls `preventDefault` and `change()` may return without navigating | false | `change()` returns early only for an unparseable base (never on an analysis page) or an unchanged URL, and every link is rendered only when its change differs | reject |
| 15 | Edge case | Holding an arrow key on the band control pushes a change per repeat and spends the rate limit | low | the ARIA radio pattern chooses on arrow; three steps, each push supersedes the last; fixing means a debounce | reject |
| 16 | Edge case | Positive revenue under 50 000 kr shows "Omsetning 0,0–0,1 mill. kr" | low | covered subjects that small are rare; fixing adds a branch | reject |
| 17 | Edge case | `widerBand` with an unknown band returns Standard | false | the parameter is `SizeBand`, and `BANDS` holds every value of it | reject |
| 18 | Blind | The 21st exclusion is dropped by `parse` with the notice that blames "the link", and the announcement may name the dropped peer | low | `MAX_EKSKL` is 20; the fix needs a disabled state and copy of its own. First rejected by the BMAD session as unusual; Meinich, 2026-11-14: not rejected, deferred | defer (Meinich) |
| 19 | Blind | "Vis alle": the unit test uses a hand-built context, so the real provider's reset on a band change is untested | false | `e2e/peer-adjust.spec.ts` "\"Vis alle\" at 375 px stays open across an exclusion and closes when the band changes" runs the real provider | reject |
| 20 | Blind | The timing results are only printed, and the timing spec costs CI time with a loose bound | low | the PR records them (spec task); the bound is the NFR's "within a few seconds" | reject |

## Design Notes

Flow: click → `serialize({...latest, ekskl: [...latest.ekskl, orgnr]})` → `startTransition(() => router.push(href, { scroll: false }))`. React keeps the committed UI during the transition, so the old figures stay, dimmed, under `aria-busy`. The server parses with the pool at the new band, drops an `ekskl` outside it with `invalidSettings`, and renders. Its `serialize(parsed.state)` becomes the provider's last good href and the base for the next change, so a dropped orgnr never returns and the notice shows only in the render that dropped it. Measured with `next start` on demo A: push → render 206–271 ms.

Failure paths: a database or engine error during a soft navigation answers 200 with the error in the RSC payload (measured against a server whose database is unreachable). It reaches `[orgnr]/error.tsx`, which goes back and shows the alert. Between the error and the Back, the panel is empty for about one frame. A non-200 (429, a proxy error) is a full page load (the 429 decision).

## Verification

**Commands:**
- `pnpm check:pins; pnpm check:env; pnpm lint; pnpm typecheck; pnpm test; pnpm test:db; pnpm test:ingest; pnpm build; pnpm check:routes; pnpm test:e2e` (with `--workers=1` if memory is tight) -- expected: all pass on the loaded seed, without a model key.

**Manual checks:**
- The Peers tab for demo A at 1280, 375 and 320 px: exclude, restore, widen and reset by keyboard and with a screen reader's live region.
