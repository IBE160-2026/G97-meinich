---
title: 'Story 1.10: The open route is rate-limited without storing anyone'
type: 'feature'
created: '2026-10-16'
status: 'in-progress'
baseline_commit: '5677bec7da93b4a991d3e3ecf1d568a158296427'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing limits the open route: any client can request every analysis and search as fast as it likes, which is how the dataset would be harvested. There is also no server logger, so nothing guarantees a log line never carries an IP.

**Approach:** A Next.js proxy (`src/proxy.ts`) counts every surface per IP in memory on `globalThis` against two budgets from one config module, and answers an over-budget request itself — 429 with the refusal and no figures — so no page, layout or query runs. One structured logger replaces every `console.*` in `src`. ACs: issue #12 and `epics.md` Story 1.10; `epics.md` wins on a conflict.

**Decisions (agent, open to change at approval):**
- **Budgets:** `search` = `GET /api/sok`; `analysis` = every other matched request (all page renders, RSC payloads, prefetches, 404s — every one renders on the server). Fixed window per budget per IP; refused requests do not count.
- **Matcher:** everything except `_next/static`, `_next/image` and static files by extension, so an unlisted path is limited too.
- **Refusal:** pages and RSC get a 429 HTML document built by a pure function (`lang="nb"`, inline tokens, `role="alert"` text from `nb.json`, no header search, no figure); `/api/sok` gets 429 `{}`. Both `Cache-Control: no-store` and `Retry-After`. A refused soft navigation makes the client router fall back to a full load, which is refused as a page. The search field shows the refusal text in its existing `role="alert"` on a 429, instead of "Noe gikk galt".
- **Counter keys:** the address is hashed with a random per-process salt (`node:crypto`), so even process memory holds no IP. Entries expire with their window; the map is capped at 10 000 keys (eviction: see the human decisions).
- **Logger:** `log(level, event, fields)` where `fields` is a closed type (budget, outcome, status, failure class/SQLSTATE) — no free-form string, no path (an orgnr looked up is visitor activity). One JSON line per event. Served and refused proxy requests are logged.
- **Placement:** limiter, config and logger live outside `src/server` (its modules begin with `import 'server-only'`, which the proxy bundle cannot import).
- **e2e isolation:** a shared Playwright fixture gives every test its own `X-Forwarded-For`, so the suite never shares one budget.

**Decisions (human, 2026-10-16, at planning):**
- **Budgets:** 60 analysis and 60 search requests per minute per IP.
- **Spoofed `X-Forwarded-For`:** under `next start` Next.js sets the header from the socket only when the client sent none (`base-server.js`, `??=`), and the proxy cannot see the socket, so a client can choose its own key. Documented as a v1 limitation in the PR and in the technical note (AD-10). The pre-deployment gate requires the client address to be read from what the platform sets — not the leftmost `X-Forwarded-For` value — and a test that a client-set `X-Forwarded-For` only gets its own budget and does not lift the limit for anyone else. v1 already has that test: an exhausted IP stays refused while requests carrying another header value are counted under that value. The key is the rightmost entry (the one a single trusted proxy appends).
- **Salt (human, at approval):** random, made at process start with `crypto.randomBytes`, and never written to a file, env, log or database. Tested: two processes give different hashes for the same address.
- **Full table (human, at approval):** at 10 000 keys, remove expired entries first, then the oldest entry still within budget; an exhausted entry goes only when every live entry is exhausted. Never clear the whole table, never refuse a new address. Tested: an exhausted address stays refused after 10 000 forged addresses arrive in the same window.

## Boundaries & Constraints

**Always:** no IP, header or request path in any log line, table or file; the refusal carries no figure and no partial analysis; budgets defined once; `pnpm check:routes` still passes (the proxy is not a route); no body scroll at 375 and 320 px.

**Never:** a database table, file or cookie for counting; a new dependency; a new route; an env variable that changes or disables the budgets; `next dev` in the README run path.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Within budget | n ≤ budget requests from one IP in a window | served normally |
| Page over budget | analysis budget + 1 | 429 HTML, `role="alert"` refusal text, no figure, no orgnr from the URL |
| RSC/prefetch over budget | `RSC: 1` (± `Next-Router-Prefetch: 1`) | 429; a clicked tab ends on the refusal page |
| Search over budget | search budget + 1 | 429 `{}`; field shows the refusal in `role="alert"`, no results |
| Separate budgets | search exhausted | analysis served; and the reverse |
| Window ends | budget used, window passed | served again (unit, fake clock) |
| Different IPs | A exhausted | B served; A, with no header, still refused (a client-set header only buys its own budget) |
| Map at cap | 10 000 live keys, new IP | served; expired swept, then oldest within-budget evicted; an exhausted IP stays refused |
| Sentinel IP | requests within and over budget | sentinel in no server output, no table, no file changed since the run |

</frozen-after-approval>

## Code Map

- `src/proxy.ts` (new) — `proxy(request)` + `config.matcher`; classify → `consume` → `NextResponse.next()` or the refusal; log each outcome.
- `src/rate-limit/{budgets,limiter,refusal}.ts` (new) — budgets config; pure limiter (`consume(store, key, budget, now)`) with the store on `globalThis`; `clientKey(headers)` (rightmost `x-forwarded-for` entry, `::ffff:` stripped, salted hash); refusal HTML/JSON.
- `src/logger.ts` (new) — the one logger; replace `console.error` in `src/app/api/sok/route.ts:33`, `src/app/not-found.tsx:20`, `src/components/header-search-slot.tsx:16`, `src/server/analysis.ts:147,274` (keep `failureKind`).
- `src/components/search-field.tsx:174-190,466` — `fetchResults` returns `'refused'` on 429; the alert shows `rateLimit.refused`.
- `src/messages/nb.json` — `rateLimit.refused`, `rateLimit.title`.
- `scripts/check-routes.ts` — unchanged; confirm the proxy adds no app entry.
- `e2e/fixtures.ts` (new) — `test` with a unique `X-Forwarded-For` per test; every spec imports it. `playwright.config.ts` unchanged.
- `README.md` lines ~15-30 — run section already uses `pnpm start`; remove the stale "not built yet … 404" sentence; add the limiter limitation and the deployment gate.
- Do not change: `src/server/db.ts`, migrations, `src/url/*`, `src/engine/*`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/rate-limit/*`, `src/logger.ts` + `test/rate-limit.test.ts`, `test/logger.test.ts` — matrix rows with a fake clock; key hashing (raw IP not in the store); logger rejects nothing it can't type, emits JSON; a lint-style test: no `console.` in `src` outside `src/logger.ts`.
- [ ] `src/proxy.ts`, refusal, `nb.json`, `search-field.tsx`, replaced `console.error` calls + `test/proxy.test.ts` (classification, matcher excludes static assets, 429 bodies have no digits from the URL) and `test/search-field.test.ts` (429 → refusal alert).
- [ ] `e2e/fixtures.ts`, `e2e/rate-limit.spec.ts` — within budget served; page, RSC, prefetch and `/api/sok` refused over budget; separate budgets both ways; a tab click after exhaustion ends on the refusal; the search field's alert; refusal at 375 and 320 px with no body scroll.
- [ ] `e2e/no-ip-stored.spec.ts` — starts its own `pnpm start` on a spare port with output captured, sends sentinel `203.0.113.77` within and over budget, then asserts the sentinel is absent from the output, from every text column of every table (`SUPABASE_DB_URL`), and from every file under the repository (and the OS temp dir) modified since the start.
- [ ] Docs — README; `technical-note-architecture.md` AD-10 (spoofable header as a v1 limitation; the deployment gate's two requirements) and line ~306's gate list; `docs/ai-log.md` (what could go wrong: spoofed header, one process, unbounded map, prefetch counting, a logger field that later takes a string); session file; `sprint-status.yaml`.

**Acceptance Criteria:**
- Given issue #12 and the matrix, when `pnpm lint && pnpm typecheck && pnpm test` run, then all pass.
- Given a seeded database, when `pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e` run, then all pass.
- Given the work, it lands as several logical commits (limiter and logger, proxy and UI, e2e, review fixes, docs).

## Implementation Notes

- **Matcher:** only `_next/static` and `_next/image` are skipped, not "static files by extension": there is no `public/` directory, so any other path with an extension renders the 404 page, which reads the database, and must be counted.
- **Copy:** a third message, `rateLimit.pageTitle`, gives the refusal page its document title; `rateLimit.title` is its `h1`.
- **`failureKind`** moved to `src/logger.ts` (re-exported from `src/server/analysis.ts`) and returns a branded `FailureKind`, so the logger's `failure` field cannot take free text.
- **No header:** under `next start` the header is always set; without it every request would share one key.
- **e2e:** the "A, with no header, still refused" row runs on `e2e/no-ip-stored.spec.ts`'s own server: exhausting the socket address on the shared server would block Playwright's readiness probe on a rerun. The search budget is spent with `?q=a` (counted, answered without a query) to stay within the test timeout under the parallel suite. RSC requests without `_rsc` answer 307, served and counted.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test`
- `pnpm db:start && pnpm db:roles && pnpm seed && pnpm test:db && pnpm build && pnpm check:routes && pnpm test:e2e`
