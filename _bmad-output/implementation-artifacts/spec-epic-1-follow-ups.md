---
title: 'Epic 1 follow-ups: retro actions 1–5'
type: 'bugfix'
created: '2026-10-16'
status: 'in-progress'
baseline_commit: 'b9fbbd48b13b76d1b750f43eaeee21894d29fedd'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Epic 1 retro (`epic-1-retro-2026-10-16.md`, actions 1–5) left open items: a raw database error escapes on `GET /` and in the analysis page's uncovered branch (R1, R4), `next` 16.4.0 carries two critical advisories (S1), the engine's framework-import ban is not enforced (S2), and there is dead or misleading code (X1, X2, S3, D10). Actions 1 and 2 are the gate for Epic 2.

**Approach:** One PR, with logical commits. Each `coveredIndustries()` read on the request path either catches the failure, logs class + SQLSTATE and throws a fixed message, or handles it the way it does today. Pin Next 16.4.2. Extend the engine's ESLint ban. Run the tidiness sweep. Action 3 is a ledger entry only.

Decisions (Meinich, 2026-10-16): include action 2 even though the request named only 1, 3, 4 and 5, because the retro gate needs it; action 3 is recorded in `deferred-work.md` under Story 2.9 together with R3, with no code change; D10 keeps the capital, because `analysis.uncovered.body` begins with `{bransje}`. The formatting moves into `src/messages/industry.ts` as `industryAtSentenceStart`, so no page calls `t('industry.inSentence')` directly. A unit test pins the sentence-start form against the mid-sentence form. No visible change.

## Boundaries & Constraints

**Always:** Fixed error messages and `log()` only (class + SQLSTATE). A database failure answers 500, never a streamed 200. Every read happens before the Suspense boundary. Copy comes from `nb.json`. Update AGENTS.md wherever it changes (the engine ban sentence). Review fixes go in their own commit.

**Never:** No change to the "not stated → no band" rule or to the R2 copy (that is Story 2.9). No refactors from actions 6 and later. No new routes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | What fails if the guard is deleted |
|---|---|---|---|
| Front page, DB down | `GET /` on the db-down server | 500; global-error alert; no `DETAILS` in the body; log `home.coverageFailed` with the failure only | db-down spec `/`; unit test on `HomePage` (fixed message, log line) |
| Uncovered, coverage read fails | subject read OK (`covered:false`), coverage query throws | page throws `analysis: coverage lookup failed` before Suspense; log `analysis.coverageFailed` | `failed-read.test.ts` new case |
| Search, DB down | `GET /api/sok?q=…` on the db-down server | 500 `{}` | db-down spec (route coverage) |
| Engine imports a framework | `import … from 'next/server'` / `'react'` / `'react-dom'` / `'next'` in `src/engine/*` | `no-restricted-imports` | `test/lint.test.ts` fixtures |
| Client module imports react | `'use client'` + `react-dom/server` | still allowed | existing lint test |

</frozen-after-approval>

## Code Map

- `src/app/page.tsx:15` -- unguarded `coveredIndustries()`; wrap it the way `src/server/analysis.ts:141-142` does (log, then `throw new Error('home: coverage lookup failed')`); there is no `app/error.tsx`, so `global-error.tsx` renders it.
- `src/components/analysis/analysis-page.tsx:228-229` -- the coverage read inside `AnalysisBody` (under Suspense). Move it into `AnalysisPage` after the redirect check (`:266`) and before `<Suspense>`, then pass `coverage` down; `AnalysisBody` no longer needs to be async.
- `src/components/analysis/analysis-page.tsx:112-117` -- `uncoveredIndustry` (D10).
- `src/logger.ts:15-22` -- `LOG_EVENTS`: add `home.coverageFailed` and `analysis.coverageFailed`. `test/logger.test.ts:51` loops over it.
- `test/analysis/failed-read.test.ts` -- the pattern to follow: the `readerSql` mock, `expectFixedThrow`. The mock routes on query text; the subject query and `coveredIndustries` (`src/server/search.ts:79`) both mention `register.covered_industry`, so route on something unique to one of them (e.g. `ci.code`).
- `e2e/db-down.spec.ts:33` -- add `/` (500, global-error) and `/api/sok` (500 `{}`), so every route in `check:routes` is covered.
- `eslint.config.mjs:9-26,91-96` -- `serverImportRestriction` is shared with the client rule. Create an `engineImportRestriction` that extends it with `next`, `react`, `react-dom` and the patterns `^next/`, `^react/`, `^react-dom/`, and use it only in the engine block.
- `test/lint.test.ts:110` and `test/fixtures/lint/` -- add the fixture `engine-imports-next.ts` plus inline cases for `react`, `react-dom`, `next/server`.
- `src/engine/index.ts` -- delete it: nothing imports it, and re-exporting `Decimal` widens the route around `decimal.ts`. The regex string in `test/no-other-decimal.test.ts:57` is a fixture; keep it.
- `src/url/analysis-state.ts:32,46,125-130` -- use `BANDS` in `parseBand` (loop, as `parseAndel` does) and `MULTIPPEL_STEP` in `parseMultippel` (`decimalPlaces() > MULTIPPEL_STEP.decimalPlaces()`).
- `scripts/seed-format.ts:422` -- delete the unused `AllowListEntry`.
- `.env.example:25` -- drop `pnpm seed:full`.
- `package.json:35,48` -- `next` and `eslint-config-next` → `16.4.2`; `pnpm install` updates the lockfile.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- append R2 and R3 under Story 2.9.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `pnpm-lock.yaml` -- pin 16.4.2 -- GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr (commit 1)
- [x] `src/logger.ts`, `src/app/page.tsx`, `src/components/analysis/analysis-page.tsx`, `test/analysis/failed-read.test.ts` (plus a `HomePage` case) -- guard the coverage reads (commit 2)
- [x] `e2e/db-down.spec.ts`, `playwright.config.ts` comment -- `/` and `/api/sok` (commit 3)
- [x] `eslint.config.mjs`, `test/lint.test.ts`, the fixture, AGENTS.md (the ESLint sentence) -- the engine framework ban (commit 4)
- [x] the sweep: `src/engine/index.ts`, `analysis-state.ts`, `seed-format.ts`, `.env.example`, D10 via `industryAtSentenceStart` plus a test in `test/industry.test.ts` (commit 5)
- [x] `deferred-work.md` -- the R2/R3 entry (commit 6, with the docs)
- [x] Capture what the db-down server logs for `GET /` before and after the fix (retro open item) and record it in the PR body.

**Acceptance Criteria:**
- Given the full suite (`check:pins`, lint, typecheck, `test`, `test:db`, build, `check:routes`, e2e including db-down), when it runs after the change, then it passes.
- Given `grep -rn "16.4.0" package.json`, then nothing matches.

## Implementation Notes

- Branch `story/e1-follow-ups`. Commit 1 is done: `6a17ca7` pins 16.4.2. pnpm 12's minimum release age made `pnpm install` add a commented `minimumReleaseAgeExclude` list to `pnpm-workspace.yaml`. The full suite passed on that commit alone: test 736, test:db 120, test:ingest 79, e2e 114. The local DB is running and seeded.
- Make commits 2–6 one at a time, in the order of the task list, each one type-checking, with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer. Do not push.
- R1 "before" (db-down server, `GET /` on 16.4.2): HTTP 500, and the body contains no detail. But the server log prints Next.js's `⨯ Error: connect ECONNREFUSED 127.0.0.1:1` with a stack, `address: '127.0.0.1'`, `port: 1`, `code: 'ECONNREFUSED'` and a digest. After the fix, capture the same with `READER_DATABASE_URL='postgresql://reader:unreachable@127.0.0.1:1/postgres' pnpm start --port 3199` (after `pnpm build`), then stop the server, and write the result here.
- R1 "after" (same server, 16.4.2, `GET /` with the fix): HTTP 500, global-error alert, and the body matches none of `ECONNREFUSED`, `127.0.0.1`, `coverage lookup failed`, `PostgresError`. The server log has our line `{"level":"error","event":"home.coverageFailed","failure":"Error"}`, then Next.js's own `⨯ Error: home: coverage lookup failed` with a stack into a compiled chunk (`.next/server/chunks/ssr/…`) and a digest. No address, port, `code` or query text is printed any more. Next.js still logs the fixed message and a stack frame for any uncaught render error; that is its behaviour, not something the app passes on.
- `failureKind` gives `Error` (not `PostgresError …`) for a refused connection, because ECONNREFUSED is no SQLSTATE.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm check:pins && pnpm lint && pnpm typecheck && pnpm test` -- pass
- `pnpm test:db` -- pass (seeded DB)
- `pnpm build && pnpm check:routes && pnpm test:e2e` -- pass, db-down project included
