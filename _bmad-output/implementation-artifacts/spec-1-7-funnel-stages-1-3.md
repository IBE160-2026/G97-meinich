---
title: 'Story 1.7: Peerless finds comparable companies, stages 1–3'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: '1b7f8ce817633cd9bfb5768984d37e8c926ae397'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/key-figures.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A covered company opens on empty tabs. No peer group exists, so Stories 1.8–1.9 have nothing to aggregate. A subject that is not an AS is treated as covered, although it can never have peers in v1.

**Approach:**
- A pure engine module runs funnel stages 1–3. Its input is the subject's benchmark-year filing and every same-industry company's filing for that year, read once per request as `reader`.
- It returns the candidate pool at the URL's band, with a count for each stage and for each stage-3 criterion.
- `ekskl` is checked against that pool, and the excluded peers are then removed from it.
- The header shows the count. The Peers tab lists the group.
- A non-AS subject in a covered industry gets its own state.
- ACs: issue #9 and `epics.md` Story 1.7. `epics.md` wins on a conflict.

**Decisions (agent, open to change at approval):**
- **Benchmark year and filing:** the year is the subject's `filing.filingYear` (the newest `SELSKAP` filing, as in 1.6b). For each candidate, its benchmark filing is its filing with that `filing_year`. A filing with the subject's `regnskapstype` is preferred; ties go by `periode_til`, `periode_fra` and `brreg_id`, each descending. A candidate with no filing that year is out before stage 1.
- **Stage 1:** same `naeringskode1`. Revenue `r` is in [lo×s, hi×s], both bounds included, compared as Decimals on øre. If the subject's revenue `s` is null or ≤ 0, or a candidate's revenue is null, that candidate does not pass. The band factors are the exact decimals `0.5/2`, `0.33/3` and `0.25/4`.
- **Stage 2:** the six fields must be equal and non-null on both sides. Financial period means `periode_fra` and `periode_til` are equal, and both filings must run 1 Jan–31 Dec. An unknown `valuta` matches nothing; it is never mapped to NOK.
- **Stage 3:** `organisasjonsform === 'AS'` exactly, so `ASA` is out. Counts are `{ stage1, stage2, stage3: { legalForm } }`, each counted on what survived the stage before.
- **Exclusions:** `ParseContext.isCandidate(peer, band)` takes the band, and `parse` reads `band` before `ekskl`. The list and the header count show the group with the excluded peers removed. Showing excluded rows is Epic 2's job.
- **State precedence:** no filing, then uncovered, then non-AS, then covered. A non-AS subject gets `state: 'non-as'`, with the same redirects and title as an uncovered one.
- **Header:** when the subject is covered, the meta line gets "{n} sammenlignbare" after the revenue item, including when n = 0.
- **Peers tab:** below the `h2`, a line reads "{n} sammenlignbare selskaper". Under it is a table (Selskap · Omsetning · Kommune) inside the scroll region, sorted by revenue descending and then by orgnr. With n = 0, the table is replaced by the existing UX copy "Fant ingen sammenlignbare selskaper.". A missing name falls back to the grouped orgnr, and a missing municipality reads "Ukjent". When the group's `valuta` is not NOK, the revenue cell reads "Ikke i kroner".
- **Payload (AD-4):** the list is a server component and renders only the strings it shows. Peer orgnrs, filing ids and figures go nowhere else.

**Decisions (human, 2026-10-16):**
- **Spec size:** kept whole, at about 2,600 tokens.
- **Non-calendar subject:** the page uses the ordinary covered structure, with no new page state. The header reads "0 sammenlignbare". When the group is empty because the subject's own benchmark filing does not run 1 Jan–31 Dec, the Peers tab shows `peers.nonCalendar` "Peerless sammenligner foreløpig bare selskaper med kalenderår som regnskapsår." instead of "Fant ingen …". The engine reports this reason (`emptyReason: 'subject_non_calendar'`), and the component does not infer it. FR-8 in the PRD and the Peers row in EXPERIENCE.md each get one line saying so.
- **`isCandidate(peer, band)` changes a 1.6a decision:**
  - What changes: 1.6a's `isCandidate(peer)` assumed the caller knew the pool.
  - Why: the pool depends on the band, and the band is read by `parse` itself from the same URL. A caller cannot close over a value it has not parsed yet.
  - Where the reason is recorded: this spec, the session file and AGENTS.md (the URL-module sentence).
- **Dormant companies (closes the 1.4 deferred-work entry):**
  - Stage 1 requires revenue inside the band, and the subject's revenue `s` is > 0, so a candidate with zero or null revenue can never be a peer, at any band.
  - A near-zero candidate passes only when the subject is itself near zero. A subject with revenue `s` ≤ 0 or null gets no peers at all.
  - The entry is removed from `deferred-work.md`, and the matrix row below tests it.
- **Subject with no positive revenue (2026-10-16, after review; renegotiated by the human, finding 6):**
  - The page keeps the ordinary covered structure, and the header reads "0 sammenlignbare".
  - When `emptyReason` is `'subject_no_revenue'`, the Peers tab shows `peers.noRevenue`: "Peerless finner sammenlignbare selskaper ut fra omsetning, og regnskapet for {år} har ingen positiv omsetning å sammenligne med." `{år}` is the subject's `filingYear`.
  - This covers zero, negative and null `sumDriftsinntekter`.

## Boundaries & Constraints

**Always:**
- The funnel lives in `src/engine` and is pure.
- The server reads only `register`, through `readerSql()`, in one candidate query per request wrapped in `cache()`. That read happens before `analysisView` and the redirect decision, because invalid `ekskl` sets the notice.
- Money is `bigint` øre, compared as Decimal, never `Number()`.
- All copy goes through `t()`. Every figure goes through `format.ts`.
- `/analyse/` is used only in the URL module. Stages 1–3 can be called on their own (Story 5.2).
- The body never scrolls horizontally at 375 px or 320 px.

**Never:**
- `sum_eiendeler` or an employee count as an engine input.
- A median, beste fjerdedel, Plassering or kroner gap (1.8/1.9).
- Funnel counts in the UI, "Hvorfor med", exclude or widen controls (Epic 2).
- A fetch, register call or model call.
- A migration, a new dependency or a new route.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected |
|---|---|---|
| Band bounds (each step) | candidates at exactly lo×s and hi×s; lo×s − 1 øre and hi×s + 1 øre | the first two in, the last two out |
| One field differs | candidate differs only on `valuta`, `regnskapsregler`, `smaa_foretak`, `avviklingsregnskap`, period, `regnskapstype` or legal form | out at stage 2 (or 3); the counts show where |
| No benchmark-year filing | candidate has 2024 only, subject 2025 | out |
| Non-calendar subject | subject 2024-07-01–2025-06-30 | empty group, `emptyReason: 'subject_non_calendar'`; header "0 sammenlignbare"; Peers shows `peers.nonCalendar` |
| Dormant candidate | candidate revenue 0 or null, subject s > 0 | out at stage 1 at band 0, 1 and 2 |
| Dormant subject | subject revenue 0, negative or null | empty group at every band, `emptyReason: 'subject_no_revenue'`; Peers shows `peers.noRevenue` with the year, in each of the three cases |
| Non-AS, covered | `/analyse/{nuf}` | non-AS State block, the API figures, the sentence, a link; `/{fane}` → 307 to the bare path |
| Non-AS, no filing | `/analyse/{enk}` | the 1.6b no-filing state |
| `ekskl` outside the pool | `?ekskl={pool peer},{non-pool}` | the pool peer leaves the count; the other is dropped with the notice |
| `ekskl` widened | peer in band 1 only; `?band=1&ekskl=it` | kept; without `band=1`, dropped with the notice |

</frozen-after-approval>

## Code Map

- `src/url/analysis-state.ts`:
  - `ParseContext.isCandidate(peer)` becomes `(peer, band)`.
  - In `parse`, move band parsing above `ekskl`.
  - `Band` is re-exported from the engine's `SizeBand`, because the URL module may import only from the engine.
- `test/url/analysis-state.test.ts:161-190`: add a test with a supplied pool that varies by band.
- `src/engine/peers.ts` (new): `SIZE_BANDS`, `CandidateFiling`, `SubjectFiling` input types (ore as `bigint`), `benchmarkFiling`, `assemblePeerGroup(subject, candidates, band)` returning `{ pool, counts, emptyReason: 'subject_non_calendar' | 'subject_no_revenue' | null }`, and `withoutExcluded(pool, ekskl)`. Export it from `src/engine/index.ts`.
- `src/server/analysis.ts`:
  - `SUBJECT_SQL` adds `organisasjonsform`, `regnskapstype`, `periode_fra`, `periode_til`, `regnskapsregler`, `smaa_foretak` and `avviklingsregnskap`.
  - New `CANDIDATES_SQL`: companies with the subject's `naeringskode1`, other than the subject, joined to their filings at `filing_year = $2`, with `sum_driftsinntekter_ore`, `navn`, `forretningsadresse_kommune` and `organisasjonsform`.
  - `lookupCandidates = cache(...)` uses the same fixed-message throw as `lookupSubject`.
- `src/analysis/view.ts`:
  - Add `organisasjonsform` and the comparability fields to `Subject`.
  - Add the `'non-as'` state.
  - `URL_CONTEXT` becomes a function `urlContext(pool by band)`; the layout keeps accept-all with an empty query.
- `src/components/analysis/analysis-page.tsx`: in `resolve`, look up the subject, then the candidates when it is covered and an AS, parse with the real context, and pass the group to `Covered` and `CompanyHeader`. Add the non-AS branch, which reuses `StateBlock`, `ApiFigures` and `SearchAgain`.
- `src/components/analysis/company-header.tsx`: add the optional `peerCount` meta item.
- `src/components/analysis/peer-list.tsx` (new): the scroll region (`role="region"`, `tabIndex=0`, `aria-label`, `overflow-x-auto`) holding the table.
- `src/messages/nb.json`: add `analysis.nonAs.kicker`, `analysis.nonAs.body`, `analysis.peerCount`, `peers.count`, `peers.none`, `peers.regionLabel`, `peers.col.*`, `peers.unknownKommune` and `peers.otherCurrency`. Reuse the existing "Uten sammenlignbare …" id from the uncovered state.
- `e2e/analysis.spec.ts`: orgnrs come from the seed CSVs, as 1.6b's do. Pick a non-AS company that has a SELSKAP filing, and a non-AS company with none.

## Tasks & Acceptance

**Execution:**
- [x] `src/engine/peers.ts` + `test/engine/peers.test.ts`: every matrix row in the engine, all three band steps at ±1 øre, a test per field, legal-form counts, and a type-level check that the input has no assets or employee field.
- [x] `src/url/analysis-state.ts` + test: band-aware `isCandidate`.
- [x] `src/server/analysis.ts`, `src/analysis/view.ts` + `test/analysis/view.test.ts`: the non-AS rows and the precedence.
- [x] `src/components/analysis/{analysis-page,company-header,peer-list}.tsx`, `nb.json`.
- [x] `test/db/peers.test.ts`:
  - against the seed, the group for demo A comes back within 1 000 ms (timed after one warm-up query);
  - `globalThis.fetch`, `http.request` and `https.request` are spied, and none is called during lookup plus assembly;
  - a grep shows that `src/app`, `src/server` and `src/components` name no `brreg.no` or model host.
- [x] `e2e/analysis.spec.ts`:
  - the header count; the Peers count, sort order, region attributes and reflow at 375 px and 320 px;
  - no peer orgnr in the Peers HTML;
  - the non-AS states and their redirect;
  - `ekskl` both kept and dropped with the notice.
- [x] Docs:
  - `docs/ai-log.md`: what the read path reads, what the payload exposes, and selection on the wrong basis.
  - `AGENTS.md`: the URL-module sentence gets the band-aware `isCandidate` and why.
  - The PRD (FR-8) and EXPERIENCE.md (the Peers row) get one line each on non-calendar subjects.
  - `deferred-work.md`: remove the dormant-companies entry.
  - The session file, recording the 1.6a change and why, and `sprint-status.yaml`.

**Acceptance Criteria:**
- Given issue #9's ACs and the matrix, when `pnpm lint && pnpm typecheck && pnpm test` run, then all pass.
- Given a seeded database, when `pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e` run, then all pass.

## Implementation Notes

- `URL_CONTEXT` is split: `PATH_CONTEXT` (accept-all) stays for path-only parsing — the layout's 404 decision and the client components that read the pathname — and the page parses with `urlContext(poolAt)`.
- A subject without a pool (uncovered, no filing, non-AS) parses with an always-empty pool, so any `ekskl` on it is dropped with the notice.
- `emptyReason` follows funnel order: `subject_no_revenue` before `subject_non_calendar`.
- The host grep allows the bare `https://data.brreg.no` (the NLOD attribution link on the about page); any path under `brreg.no` and any model host fails it.
- The e2e `main` locator skips the Suspense fallback (`main:not([aria-busy="true"])`); two existing tests hit a strict-mode race during the streamed swap once.
- The UX-DR37 edge-fade cue is not drawn; the region has role, label, `tabindex` and a focus ring.

## Spec Change Log

- **2026-10-16, review finding 6 (intent gap), approved by the human.**
  - **Locked decision before:** every empty group except a non-calendar subject showed "Fant ingen sammenlignbare selskaper.".
  - **Amended:** a subject with no positive revenue (zero, negative or null) shows `peers.noRevenue` with the filing year. This adds a Decisions bullet and updates the Dormant-subject matrix row.
  - **What it avoids:** about 40 % of covered AS subjects in the seed (3 346 of 8 299) being told that no peers were found, when they cannot be compared at all.
  - **Process:** with the human's approval, the code was not reverted; the change was applied as a patch together with the other review fixes.
  - **KEEP:** everything else in the implementation.

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | gap | A failed candidate read is never driven through the page | medium | `failed-read.test.ts` mocks every read to throw, so `lookupSubject` fails first; a `catch { return [] }` in `resolve` passes every test | patch |
| 2 | gap/blind | Non-calendar `emptyReason` is not wired through the page in any test | medium | Only the engine and `PeerList` are tested in isolation; the seed has 308 covered AS non-calendar subjects for an e2e case | patch |
| 3 | gap | `ekskl` on a subject with no pool (dropped with the notice) is untested | medium | Every `ekskl` e2e uses demo A; view tests use accept-all `PATH_CONTEXT` | patch |
| 4 | edge | `benchmarkFiling` prefers a short-year filing over a calendar one with the same end | low | The seed has 0 companies with two filings of the same type, year and end; the fix adds a sort key | reject |
| 5 | edge | All peers excluded via `ekskl` reads "Fant ingen …" | low | No exclude control until Story 2.8, which owns the copy for excluded rows | reject |
| 6 | edge/blind | A subject with no positive revenue gets "Fant ingen sammenlignbare selskaper." with no reason | medium | 3 346 of 8 299 covered AS subjects in the seed (40 %); frozen intent gives that copy for every n = 0 except non-calendar | intent_gap |
| 7 | edge | Early filers get an empty group in their newest year | false | Intended: FR-25 and `docs/key-figures.md` "Same year" fix the benchmark year to the subject's latest | reject |
| 8 | edge | A nameless peer writes its grouped orgnr into the payload; the comment says no orgnr is rendered | low | Frozen intent allows the fallback; the seed has 0 null `navn`; the comment is inaccurate | patch (comment) |
| 9 | blind | Unknown `valuta` empties the group without a reason | low | 2 `EDT` filings in the seed; needs a new reason and copy | reject |
| 10 | blind | The e2e oracle is the engine itself | low | Engine selection is pinned by hand-built cases in `test/engine/peers.test.ts`; the e2e tests check the wiring | reject |
| 11 | blind | "1 sammenlignbare selskaper" for n = 1 | low | `t()` has no plural; a one-peer group is reachable at band 0 | patch |
| 12 | blind | Non-AS copy is wrong for an ASA | false | The copy is fixed by the AC; an allmennaksjeselskap is a separate form in law (allmennaksjeloven) | reject |
| 13 | blind | Peer table has no `<caption>`; the phone layout should be cards | low | Caption missing, so the table has no name when navigating by table; one table row per entry meets "one entry per row", and the e2e test asserts no body scroll at 320 px | patch (caption only) |
| 14 | blind | Missing edge-fade cue (UX-DR37) is not in deferred-work | low | It is only in the session file and Implementation Notes | defer |
| 15 | blind | The host grep scans only `src/app`, `src/server` and `src/components` | low | `src/analysis`, `src/url`, `src/engine` and `src/messages` are reachable from a request; widening the glob is a one-line change | patch |
| 16 | blind | ISO 4217 list has no source and lacks `VED` | low | `VED` is a valid code since 2021 | patch |
| 17 | blind | `toSubject` turns a malformed filing into the no-filing state | false | `regnskapstype`, `periode_fra` and `periode_til` are NOT NULL in `register.filing`; they are null only when the lateral join finds no filing | reject |
| 18 | blind | `CANDIDATES_SQL` relies on unindexed `company.naeringskode1` | low | A seq scan of 17 558 rows is fine at seed size; an index needs a migration once more industries are covered | defer |
| 19 | blind | The new selection rules are not in `docs/key-figures.md` | medium | AGENTS.md makes it authoritative; the subject-revenue, unknown-currency and benchmark-filing rules exist only in the spec and the code | patch |
| 20 | blind | The spec's Code Map disagrees with the code (`$2`/`$3`, `URL_CONTEXT`) | low | The fix is a spec edit | reject (spec edit) |
| 21 | blind | `assemblePeerGroup` runs twice per request (metadata and page) | low | It runs in memory over the cached rows, which is cheap at this size | reject |

## Design Notes

The pool for each band is a subset of the pool for band 2. One candidate read per request is enough: `isCandidate(peer, band)` runs the engine on the cached rows for that band.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test`: pass
- `pnpm db:start && pnpm db:roles && pnpm seed && pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e`: pass
