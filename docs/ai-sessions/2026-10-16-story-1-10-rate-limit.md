# Story 1.10: The open route is rate-limited without storing anyone

**Date:** 2026-10-16
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** [#12](https://github.com/IBE160-2026/G97-meinich/issues/12), Story 1.10
**Result:** [PR #28](https://github.com/IBE160-2026/G97-meinich/pull/28), merged 2026-10-16. Commits `caaf09f` (limiter and logger), `519fab0` (proxy, refusal and search field), `f83ed87` (e2e), `08f32f6` (self-review fixes), `154ddb5` (docs), `03d0533` (review fixes), `f05cc89` (review docs) and `84d54a5` (spec: triage log).

## Goal

Every open surface is limited per client address, with separate budgets for search and analysis, without storing any address anywhere; one logger replaces every `console.*` in `src`.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-10-rate-limit.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human's decisions recorded in the spec's frozen section (2026-10-16): 60 analysis and 60 search requests a minute; the spoofable `X-Forwarded-For` documented as a v1 limitation with a two-part deployment gate; a random per-process salt that is never written anywhere; and the full-table eviction order. Their verbatim text is extracted from the transcript into `docs/ai-prompts.md` by the review session.

## What came back, and what was done with it

- **Accepted:**
  - `src/rate-limit/budgets.ts` (the two budgets and the 10 000-key cap, defined once), `src/rate-limit/limiter.ts` (`consume` over a table with a clock parameter; the tables and the salt on `globalThis`; `clientAddress` takes the rightmost `X-Forwarded-For` entry and strips `::ffff:`; `hashAddress` is an HMAC-SHA-256 under the salt), `src/rate-limit/refusal.ts` (the 429 page and `{}`, `no-store`, `Retry-After`).
  - `src/proxy.ts`: `/api/sok` is search, every other matched path is analysis; the matcher skips only `_next/static` and `_next/image`. Each outcome is logged with budget and status.
  - `src/logger.ts`: `log(level, event, fields)` with closed event names and fields, re-checked at run time; `failureKind` moved here from `src/server/analysis.ts` (re-exported there) and now returns a branded type. The five `console.error` calls go through it.
  - The search field: `searchOutcome` reads a 429 as `refused`, and the alert (`SearchAlert`) shows the refusal instead of "Noe gikk galt".
  - Tests: `test/rate-limit.test.ts` (fake clock, the full table, the keys, two processes), `test/logger.test.ts` (JSON lines, forced values dropped, `@ts-expect-error` for free text, no `console` in `src` outside the logger), `test/proxy.test.ts` (classification, the matcher via `unstable_doesMiddlewareMatch`, the 429 bodies, separate budgets, a spoofed prefix, the log lines), `test/search-field.test.ts`; `e2e/rate-limit.spec.ts` and `e2e/no-ip-stored.spec.ts`; every spec imports `test` from `e2e/fixtures.ts`.
- **Decided in implementation, for review:**
  - The matcher does not skip "static files by extension" as the spec's decision put it. There is no `public/` directory, so any other path with an extension (`/favicon.ico`, `/x.json`) renders the 404 page, which reads the database; skipping it would leave a surface outside the limit. Only `_next/static` and `_next/image` are skipped.
  - The refusal page has an `h1` ("For mange oppslag") and a document title, so a third message, `rateLimit.pageTitle`, was added beside the spec's `rateLimit.title` and `rateLimit.refused`. It has the brand as text, no link, no form and no script.
  - With no `X-Forwarded-For` at all (not possible under `next start`, which fills it), every request shares one key.
  - The e2e fixture gives each test a unique-local IPv6 address with a random prefix per worker, so a rerun against a reused server does not inherit an exhausted budget.
  - `e2e/no-ip-stored.spec.ts` runs `next start` through Node directly (the command behind `pnpm start`), so stopping it stops the server on Windows too. It searches every row of every base table, cast to text, which covers every text column. The sentinel is assembled at run time and tracing is off for that spec, so neither the spec's source nor a Playwright trace holds it.
  - The matrix row "A, with no header, still refused" is tested on that spec's own server, because exhausting the socket address on the shared e2e server would also block Playwright's readiness check on a rerun.
  - The e2e search budget is spent with `?q=a`, which the route answers without a query but the proxy still counts; with `?q=ad` the test exceeded 30 s under the full parallel suite.
- **Corrected while running it:**
  - An RSC request without the router's cache-busting parameter answers 307 (a redirect to it), not 200; the sentinel spec now accepts any status below 400 for those requests.
- **Self-review fixes (`08f32f6`):** the sentinel spec's timeout moved from a top-level `test.setTimeout` to `describe.configure`; a unit test that expected `Retry-After` to be exactly 60 now checks 1 to 60.

## Review

Three reviewers raised 22 findings. Nine were fixed and 13 rejected, each with its reason in the spec's Review Triage Log.

- **Fixed in code (`03d0533`):** one list per log vocabulary, so an event missing from the array can no longer be dropped silently; the test-only `failureKind` re-export removed from `src/server/analysis.ts`; the full-table eviction sweep stops at the first live entry instead of scanning all 10 000; `127.0.0.1` added to the sentinel test.
- **Fixed in docs (`f05cc89`):** the measured cost of a page view (front page, one analysis and one tab click = 11 requests, so 60 a minute is about 15 views); the fixed window allowing twice the budget across a window boundary; IPv6 /64 rotation named in the deployment gate in AD-10.

## Verification and PR

- Claude Code stopped the full run after the review fixes because the machine was critically low on memory (2.5 GB free of 15.7 GB). The BMAD session did not commit or push without a full run. After the human freed memory, the suite ran in four batches, as in Story 1.8: typecheck and 736 unit tests; 120 database tests; build and route check; 114 e2e tests; and lint. All passed.
- The first version of the PR text gave the review split as 8 fixed and 14 rejected. The BMAD session corrected it to 9 and 13 right after opening the PR.
- The review session recommended updating this file with the PR link and the review before merging. The PR was merged at `84d54a5` before that happened, so the review session updated the file on `main` afterwards.

## Links

- `docs/ai-log.md`: "2026-10-16 — Story 1.10: the rate limiter and the logger, and what could go wrong with them".
- Technical note, AD-10 (client address, deployment gate) and "Deferred" (hosted deployment's gate); README, "Rate limit".
- Spec: `_bmad-output/implementation-artifacts/spec-1-10-rate-limit.md`.
