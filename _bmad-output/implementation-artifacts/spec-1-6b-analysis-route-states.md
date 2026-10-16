---
title: 'Story 1.6b: Open an analysis in the right state'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: 'b079f28c85f0500dfd0d3c61969c2347a0cec414'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/analyse/{orgnr}` does not exist: search navigates to a 404, and the header and footer link to a missing `/slik-fungerer-peerless`. A shared link must reopen the same state, and a company Peerless cannot analyse must say why.

**Approach:**
- Two pages, `/analyse/[orgnr]` and `/analyse/[orgnr]/[fane]`, share one server renderer. It parses the URL with `src/url/analysis-state.ts`, reads the subject once as `reader`, and picks one state: covered (three tab links with an empty panel `h2` each), uncovered, no filing, not found, or invalid orgnr. Each state redirects or renders by the matrix.
- Also `loading.tsx`/`error.tsx`, `/slik-fungerer-peerless` with "Kilder og lisens", the compact header search on every page but `/`, and the service-role grep test.
- ACs: issue #8 plus `epics.md` Story 1.6b. `epics.md` wins on a conflict, and it adds the compact header search AC.

**Decisions (agent, open to change at approval):**
- **Subject filing:** the subject's newest `SELSKAP` filing by `filing_year`. With no `SELSKAP` filing the company is in the no-filing state, whether or not its industry is covered.
- **Revenue:** "Omsetning x mill. kr" appears only when `valuta = 'NOK'` and `sum_driftsinntekter_ore` is not null. Kroner are never printed for another currency.
- **Not found:** the State block and the demo links, with HTTP **404** (human, 2026-10-16), asserted in the e2e tests. No register call. `src/app/analyse/[orgnr]/layout.tsx` does the cheap subject lookup (`loadSubject`, cached), so a 404 is decided before streaming. `loading.tsx` sits below it and covers the page-level work that Stories 1.7–1.9 add. `src/app/analyse/error.tsx` catches errors from that layout. `not-found.tsx` renders the front page for an invalid orgnr and the not-found State block for a valid one.
- **Titles:** covered "{navn} – {Fane} – Peerless"; uncovered and no filing "{navn} – Peerless"; not found and invalid "Peerless". A null `navn` falls back to the orgnr in groups of three.
- **Notice:** a client component renders an empty `role="status"` and fills it after mount, so it is announced once.
- **Picked over the deferred-work items:** the compact field keeps its real `<label>`, visually hidden, and also gets `placeholder = t('search.label')`, in addition to the label and never in its place (human, 2026-10-16). The e2e tests check that its accessible name comes from the label: the name stays the same when the placeholder is removed. It does not set `busy` when the target orgnr is the one already shown, and it resets `busy` and the notice when the pathname changes.
- **No writes:** `readerSql()` connects with `default_transaction_read_only=on`, so a request cannot write even by mistake.

**Decisions (human, 2026-10-16):**
- **Invalid orgnr:** the front page's content renders at the analysis URL, with the hero field holding the input and the length or checksum message. The response is **HTTP 404**, not 200, and the e2e tests assert 404 for both a wrong length and a wrong checksum. The 404 status must be set before streaming starts. So `notFound()` is called in `src/app/analyse/[orgnr]/layout.tsx`, above the `loading.tsx` boundary, and `src/app/analyse/not-found.tsx` renders the front-page body. The raw input comes from `useParams()` in a client part, parsed by the URL module.
- **Header search on phone:** below `md` the search takes a full-width second row under the wordmark and the link, and stays inline from `md`. A two-row header is never sticky. The e2e tests assert, at 320 px and 375 px, that the header's search input is at least 200 px wide and that the body does not scroll horizontally.
- **"Kilder og lisens" copy**, accepted:
  - "Tallene i Peerless kommer fra Brønnøysundregistrene: Enhetsregisteret og nøkkeltallene i Regnskapsregisteret."
  - The NLOD credit, verbatim as `docs/data-sources-brreg.md` gives it ("… tilgjengeliggjort av Brønnøysundregistrene"), with links to https://data.norge.no/nlod/no/2.0 and https://data.brreg.no.
  - "Peerless har bearbeidet dataene: alle nøkkeltall og sammenligninger er regnet ut av Peerless."
  - "Brønnøysundregistrene står ikke bak Peerless og har ikke godkjent analysene."

  A `deferred-work.md` entry for Story 2.1 says that paragraph 1 must name the filed annual accounts once figures read by OCR are shown.
- **Spec size:** kept whole, at about 2 700 tokens.

## Boundaries & Constraints

**Always:** Only `analysis-state.ts` builds or reads `/analyse` paths. It gains `parseSegments({orgnr, fane?}, search, ctx)` so pages never compose the path. `isCandidate` is a documented accept-all until 1.7, and `medianStepExists` returns false until 3.5. All copy goes through `t()`. Coverage comes from `register.covered_industry`, and `{industry}` comes from `industryInSentence` and `joinList`. The read date is formatted on the server in `Europe/Oslo`, and the filing year comes from the stored `filing_year`. Figures come from `computeApiKeyFigures` and are formatted with `format.ts`. Nothing is written to browser storage or a table. Nothing scrolls the body horizontally at 375 px or 320 px.

**Never:** No peer group, median, beste fjerdedel, Plassering or kroner gap, and no panel content beyond the `h2` (Stories 1.7–1.9). No Verdi tab, no non-AS state (1.7), no rate limit (1.10), no migration, no new dependency, no service-role variable, no other route.

## I/O & Edge-Case Matrix

| Request | State | Result |
|---|---|---|
| `/analyse/{covered}` | covered, filing | 307 → `serialize({...state, fane:'oversikt'})`, query kept |
| `/analyse/{covered}/peers?band=x` | covered | Peers tab with `aria-current`; notice shown |
| `/analyse/{covered}/verdi` or `/foo` | covered | Oversikt rendered, notice shown, no redirect |
| `/analyse/{C}` | uncovered (`69.202`) | header, no tabs, State block, 3 API figures, "Søk på et annet selskap" → `/` |
| `/analyse/{C}/peers` | uncovered | 307 → `/analyse/{C}` (query kept) |
| `/analyse/{no-filing}` (+`/{fane}` → 307 to bare) | no SELSKAP filing | name, orgnr, industry, municipality; "Vi har ikke et levert regnskap …" |
| `/analyse/{valid, absent}` | not found | **404**; State block with `search.unknownOrgnr` + demo A/B links |
| `/analyse/12345678`, `/analyse/123456789` | invalid orgnr | **404**; front-page content, hero field holds the input, length/checksum message, `aria-invalid` |
| DB throws | error | `error.tsx`: `role="alert"` "Noe gikk galt. Prøv igjen om litt.", no figures |

</frozen-after-approval>

## Code Map

- `src/url/analysis-state.ts` -- `parse`, `serialize`, `defaultState`, `FANER`. Add `parseSegments`. Keep it importing from the engine only.
- `src/server/db.ts` -- `readerSql()`. Add `default_transaction_read_only: 'on'` to `connection`.
- `src/server/search.ts` -- `coveredIndustries()`. Wrap it in React `cache()`; the layout, the front page and the analysis all call it.
- `src/engine/{key-figures,inputs,format}.ts` -- `computeApiKeyFigures`, `apiInputsFromRow`, `formatMillions`, `formatPercent`, `formatOrgnr`, `formatKommune`. Add `formatReadDate(date)`, which returns "3. okt. 2026" in `Europe/Oslo` using `Intl.DateTimeFormat` parts (not NumberFormat) and fixed nb month abbreviations.
- `src/messages/{nb.json,industry.ts}` -- the new ids under `analysis.*`, `tabs.*` and `about.*`. Reuse `search.*`.
- `src/components/search-field.tsx` -- add `initialValue`/`initialError` props for the invalid state, the compact placeholder, and the busy fixes.
- `src/components/site-header.tsx`, `src/app/layout.tsx`, `src/app/page.tsx` -- the header search slot: an async server part that calls `connection()` and the coverage read, and renders null on failure; a client part that hides on `/` and on an `invalid-orgnr` path. Extract the front page body into a component the invalid state reuses.
- `src/demo-companies.ts` -- demo A/B placeholders for the not-found links.
- `ingest/config.toml` `[demo_company_c]` -- C's orgnr for the e2e tests. No app code names C.
- `scripts/check-routes.ts` -- already allows the four pages. Leave it unchanged.
- `e2e/search.spec.ts:102-167` -- waits for `**/analyse/{orgnr}`. After the redirect, update it to `/oversikt`.

## Tasks & Acceptance

**Execution:**
- [x] `src/url/analysis-state.ts` + its test -- `parseSegments`, encoding each segment.
- [x] `src/analysis/view.ts` + `test/analysis/view.test.ts` -- pure `analysisView(subject, parsed)` returning the state, a redirect target or null, the effective tab, the notice flag and the title. Every matrix row is unit-tested.
- [x] `src/server/analysis.ts` -- `import 'server-only'`, plus a `cache()`d `loadSubject(orgnr)`: one parameterised query over the company, coverage, the newest `SELSKAP` filing and its key figures.
- [x] `src/components/analysis/*` -- the company header, the tab links (a `nav` that wraps, `aria-current`), the State block, the notice, the API figure list, and a client focus manager (a tab change focuses the panel `h2`, any other route change the `h1`, both `tabIndex={-1}`).
- [x] `src/app/analyse/[orgnr]/{layout,page,loading}.tsx`, `[fane]/page.tsx`, `src/app/analyse/{not-found,error}.tsx` -- thin wrappers with `generateMetadata`. The layout calls `notFound()` on an invalid or absent orgnr. `loading` sets `<main aria-busy="true">` with a local `Skeleton` in the card layout.
- [x] `src/app/slik-fungerer-peerless/page.tsx` -- `h1`, and a `section` with `h2#kilder` holding the accepted copy.
- [x] `src/engine/format.ts` + `test/engine/format.test.ts` -- `formatReadDate`, with `2026-10-02T23:30Z` → "3. okt. 2026".
- [x] `test/service-role.test.ts` -- `.env.example` has `SUPABASE_SERVICE_ROLE_KEY` only commented out. A grep over `src/app`, `src/server` and `src/proxy.ts` if present fails on that name or `service_role`.
- [x] `test/analysis-shell.test.ts` -- `renderToString` of loading (`aria-busy`) and error (`role="alert"`, the copy).
- [x] `test/db/analysis.test.ts` -- `loadSubject` for A, C, a no-filing 62.100 company and an absent orgnr, and `show transaction_read_only` = `on` through `readerSql()`.
- [x] `e2e/analysis.spec.ts` -- every matrix row (404 for both invalid-orgnr cases), the header search input ≥ 200 px at 320 px and 375 px, the tab history (`goBack`) with its params and focus, titles, the notice, header and footer links on every page, the header search present except on `/` and used twice, empty local/session storage, IndexedDB and cookies, and no horizontal scroll per state at 375 px and 320 px. Orgnrs are read from the seed CSVs and `ingest/config.toml`.
- [x] Docs -- `AGENTS.md` (if any sentence changes), `docs/ai-log.md` (read path, payload, service-role boundary), the session file, `sprint-status.yaml`, and removal of the two settled `deferred-work.md` entries.

**Acceptance Criteria:**
- Given issue #8's ACs and the matrix, when `pnpm lint && pnpm typecheck && pnpm test` run, then all pass.
- Given a seeded database, when `pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e` run, then all pass.
- Given the PR, then it says that the demo A/B links are placeholders until 5.4, and that the renamed-company AC holds by the `orgnr` primary key.

## Design Notes

The focus manager keeps the previous pathname in a ref. On a change it parses both paths: the same orgnr with a different tab focuses the panel `h2`, anything else the `h1`. The first render focuses nothing.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- pass
- `pnpm db:start && pnpm db:roles && pnpm seed && pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e` -- pass

## Implementation Notes

Three parts of the design do not hold in Next.js 16.4; found by probing the production build (`curl` status and `Location`, Playwright):

- **No `loading.tsx`.** Below the layout it wraps the page in Suspense; its fallback starts a 200 response before the page redirects, so every matrix 307 became a streamed meta refresh. The loading state (`AnalysisLoading`: `main aria-busy` with Skeletons) is a Suspense boundary inside `AnalysisPage`, after the redirect decision. Redirects are 307.
- **404 content from the root `src/app/not-found.tsx`.** A `notFound()` before streaming is recovered with the root not-found tree, never `src/app/analyse/not-found.tsx`. `NotFoundBody` tells the invalid-orgnr and not-found states apart from `usePathname()` (not `useParams`). Status 404 as required; the HTML is Next.js's error shell and the content renders on the client (deferred-work entry).
- **A failed read does not throw.** Thrown in the layout, outside Suspense, it would skip `error.tsx` for the global error page. `lookupSubject` returns `failed` and the layout renders `LookupError` (the same component `error.tsx` renders).
- **Params arrive percent-encoded** (`813%20235%20552`): `parseSegments` decodes each segment once, then encodes it, so encoded and decoded segments read the same.
- Redirects keep the query canonically when nothing fell back, and as it came when a value fell back, so the target shows the notice.
- Below `md` the compact submit button is a 44 × 44 px magnifier with "Sammenlign" as its accessible name (human decision 2026-10-16); with the text the field was 186 px at 320 px, and it is 244 px now.
- New copy beyond the quoted strings: `analysis.figures.undefined`, `analysis.figures.reason.*` ("eiendelene er null eller negative" for the two asset-based figures), `analysis.uncovered.unknownIndustry`, `notFound.page`, `notFound.home` (unknown non-analysis paths), and the 404 headings `notFound.noDataTitle` "Ingen data for dette selskapet" and `notFound.pageTitle` "Fant ikke siden" (human decision 2026-10-16).
- **A failed subject read answers 503** (human decision 2026-10-16). Rendering can set only 404, 403, 401 and redirect statuses in Next.js 16.4. So `src/proxy.ts` reads the subject first, through `readSubject`, the uncached read behind `lookupSubject`. When that read fails, it passes the request on with `NextResponse.next({ status: 503 })`, and the page renders the lookup-error state.
  - The forwarded status is undocumented behaviour; `resolve-routes.js` copies it to the response.
  - The matcher covers every request but static assets. The URL module decides which paths are analyses.
  - The cost is a second subject read per analysis request.
  - Tested by `e2e/db-down.spec.ts` against a second server whose `READER_DATABASE_URL` points at a closed port: status, alert text and no error details. Also by `test/analysis-shell.test.ts` and `test/analysis/failed-read.test.ts`.
- **The 404 states have a visible, focusable `h1`.** A client navigation to a valid orgnr not in the database focuses it. The e2e test drives `window.next.router`, because no UI path reaches that state. An unknown path cannot be reached by a client navigation at all: Next.js turns `router.push` to an unmatched path into a full page load.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | gap | No-filing municipality never asserted | medium | e2e no-filing test checks orgnr and industry only; dropping the push passes | patch |
| 2 | gap | NOK-only revenue rule untested | medium | Every fixture and seed company is NOK; removing the condition passes | patch |
| 3 | gap/blind | "Kan ikke beregnes" reason mapping untested | medium | Only demo C (all defined) renders `ApiFigures` | patch |
| 4 | gap | Failed-read path through layout and page never exercised | medium | `analysis-shell.test.ts` renders `LookupError` in isolation; nothing makes `readerSql` throw | patch |
| 5 | blind | Failed read answers HTTP 200 | medium | Layout renders `<LookupError />` as a normal page; the spec states no status for that row | human decision (presented) |
| 6 | blind | Failure logs carry no diagnostic | low | Fixed string only; class/SQLSTATE leak nothing | patch |
| 7 | blind/edge | Focus to `h1` defeats `#kilder` anchor | medium | `FocusManager` focuses `main h1` on every non-tab route change, scrolling it into view after the hash scroll | patch |
| 8 | blind/edge | 404 states have no `h1`; focus manager polls 5 s for none | medium | `NotFoundBody` analysis/unknown branches render no heading | human decision (copy needed) |
| 9 | blind | `NotFoundBody.typedOrgnr` reads the analysis path outside the URL module | medium | `pathname.split('/')[2]` + decode; AGENTS.md rule; boundary test only greps `/analyse` | patch |
| 10 | blind/edge | Spec ticks `loading.tsx`, nested `not-found.tsx`, cached `loadSubject` that do not exist | low | Deviations recorded in Implementation Notes; fix edits this spec | reject (spec edit) |
| 11 | blind | API figure values not hand-checked in tests | low | Engine reference cases cover the formulas (`test/engine/reference-cases.test.ts`) | reject |
| 12 | blind | e2e revenue expectation uses `formatMillions` itself | low | `formatMillions` has its own literal tests in `format.test.ts` | reject |
| 13 | blind | Db test filing-selection edges (KONSERN, tiebreak, no key_figures row) | low | C has 2023–2025 SELSKAP filings (`ingest/config.toml`), so the newest-year test is real; other edges rare | reject |
| 14 | blind | Db test hard-codes orgnrs, e2e derives them | low | Same pattern as `test/db/demo-companies.test.ts`; fails loudly on re-export | reject |
| 15 | blind | Fallback redirect query re-encoded, keeps `utm_source` | low | Only on the fallback path; links on the target page are canonical via `serialize` | reject |
| 16 | blind | Header search makes every page dynamic | false | Intended: spec decision (connection() in the header search) | reject |
| 17 | blind | Session file incomplete (PR link, corrections) | low | Completed at PR time in step 5 | reject (done at PR) |
| 18 | edge/blind | Uncovered/no-filing `/foo` redirect drops the notice; comment claims otherwise | low | Tab is meaningless where there are no tabs; comment is wrong | patch (comment + pinning test) |
| 19 | edge | Subject SQL tiebreak nondeterministic for equal `periode_til` | low | PK includes `periode_fra`, so two rows can tie; one-line order fix | patch |
| 20 | edge | Empty `covered_industry` yields "innen ." | low | Loader always writes `seed/coverage.json`; unreachable in v1 | reject |
| 21 | edge | `not_in_dataset`/`failed_reconciliation` mapped to "en regnskapslinje mangler" | low | Neither absence is produced until Story 2.9 | reject (2.9 owns the copy) |
| 22 | edge | Header search opening the shown company from `/peers` focuses `h2` | low | Same orgnr after redirect reads as a tab change; rare; fix needs navigation-source tracking | reject |
| 23 | edge | Busy stuck if navigation aborts without a pathname change | maybe-false | Would need a failing RSC fetch; Next falls back to a hard navigation | reject (low if true) |
| 24 | edge | Non-canonical orgnr segment renders without redirect | low | `/analyse/813%20235%20552/oversikt` renders; tab links are canonical; fix adds a redirect branch | reject |
| 25 | edge | `SettingsNotice` true→false→true not re-announced | low | `show` changes only with a navigation, which remounts the page | reject |
| 26 | edge | `tParts` duplicate placeholder gives duplicate keys | false | No message repeats a placeholder | reject |
| 27 | edge | 404 content client-rendered, empty without JS | medium | Root not-found renders via client `NotFoundBody`; recorded in deferred-work | human decision (presented) |
