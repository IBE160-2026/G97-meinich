---
title: 'Epic 1 follow-ups: retro actions 1–5'
type: 'bugfix'
created: '2026-10-16'
status: 'done'
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

- Final verification after the review fixes: check:pins, check:env, lint, typecheck, test 750, test:db 120, build, check:routes, e2e 116 (db-down included). test:ingest is not re-run: nothing under `ingest/` changed after `6a17ca7`.

- Branch `story/e1-follow-ups`. `6a17ca7` pins 16.4.2. pnpm 12's minimum release age made `pnpm install` add a commented `minimumReleaseAgeExclude` list to `pnpm-workspace.yaml`. The full suite passed on that commit alone: test 736, test:db 120, test:ingest 79, e2e 114.
- Commits 2–6: `4325185` guards, `4e55a7e` db-down e2e, `2164dae` engine ban, `e517794` sweep, `7e0994a` ledger and spec. Review fixes: `368b9df`.
- R1 "before" (db-down server, `GET /` on 16.4.2): HTTP 500, and the body contains no detail. But the server log prints Next.js's `⨯ Error: connect ECONNREFUSED 127.0.0.1:1` with a stack, `address: '127.0.0.1'`, `port: 1`, `code: 'ECONNREFUSED'` and a digest.
- R1 "after" (same server, 16.4.2, `GET /` with the fix): HTTP 500, global-error alert, and the body matches none of `ECONNREFUSED`, `127.0.0.1`, `coverage lookup failed`, `PostgresError`. The server log has our line `{"level":"error","event":"home.coverageFailed","failure":"Error"}`, then Next.js's own `⨯ Error: home: coverage lookup failed` with a stack into a compiled chunk (`.next/server/chunks/ssr/…`) and a digest. No address, port, `code` or query text is printed any more. Next.js still logs the fixed message and a stack frame for any uncaught render error; that is its behaviour, not something the app passes on.
- `failureKind` gives `Error` (not `PostgresError …`) for a refused connection, because ECONNREFUSED is no SQLSTATE.

## Review Triage Log

Pass 1, three layers: blind hunter (19 findings), edge-case hunter (4), verification gap (0 gaps). Prefix: B = blind, E = edge case.

| # | Finding | Verdict | Evidence / route |
|---|---|---|---|
| B1 | The engine-ban block splits the AD-8 rounding comment from `mathRoundRestriction` | low | `eslint.config.mjs:37-44` as cited. **Patch.** |
| B2/E1 | Dynamic `import()`/`require` of next/react pass the engine ban | low | Real, but the same holds for the existing `postgres`/`src/server` ban: `no-restricted-imports` checks static imports, and the engine has no dynamic import. The fix adds a `no-restricted-syntax` rule, so it is rejected (low, unlikely, adds complexity). |
| B3/E1 | `server-only`, `client-only`, `@next/*`, `react-server-dom-*` not banned in the engine | low | Retro action 4 names `next`, `next/*`, `react`, `react-dom`, and these four are what an engine module could plausibly reach for. Rejected (low, unlikely). |
| B4 | The db-down test "a path that is not an analysis is not affected" is wrong now that `/` answers 500 | low | `e2e/db-down.spec.ts:65`. **Patch** (rename). |
| B5 | The release-age exemption has no owner | low | Only a comment tracks it. **Patch** (ledger entry). |
| B6 | The workspace comment's "written by pnpm install" is ambiguous | low | **Patch** (direct wording fix). |
| B7 | `/` reads coverage twice, giving two queries and two log lines | false | `coveredIndustries` is already `cache()`d (`src/server/search.ts:79`): one query per request, shared by the header slot and the page. Two log events for one outage are two callers, each naming its own surface. |
| B8 | `CoveredIndustry` is used for an uncovered industry | low | The type is a `{code, beskrivelse}` label. A rename touches 5 files for no behavioural harm. Rejected (low, cosmetic churn). |
| B9 | `industryAtSentenceStart` reuses the `industry.inSentence` key and does not capitalise | low | The register's `naeringskode1_beskrivelse` is capitalised (the e2e test asserts the real seed text). The key is the shared "{navn} ({kode})" shape. Rejected (low). |
| B10 | Nothing enforces "no page calls `t('industry.inSentence')`" | low | A source-scan test adds machinery for a cosmetic regression. Rejected (low). |
| B11 | The `test/industry.test.ts` header comment is not updated | low | **Patch.** |
| B12/E4 | `test/no-other-decimal.test.ts:57` names the deleted `src/engine/index.ts` | false | It is a regex input string that tests alias detection. The path is data, a barrel is the realistic case, and the spec says to keep it. |
| B13 | Older specs and session files still describe `src/engine/index.ts` | false | Historical records of a past state. This spec's Code Map records the deletion. |
| B14 | The HomePage test covers only `readerSql()` throwing, not a rejected query | low | The guard is one try/catch around both. The case is a two-line addition. **Patch.** |
| B15 | No test that a covered analysis skips the coverage read | low | Affects performance only, and the condition is one ternary. Rejected (low). |
| B16 | `/api/sok` db-down test: does `q=admmit` reach the database? | false | A query rejected before the read answers 400, not 500. The asserted 500 proves the read ran and failed. |
| B17 | The HomePage case lives under `test/analysis/` | low | Cosmetic. Rejected. |
| B18 | The spec's Implementation Notes are stale, and its logs are empty | — | The fix edits this build's spec, so it is rejected by rule. The notes are tidied at hand-off. |
| B19 | The retro's action-5 row still states the original D10 fix | low | `epic-1-retro-2026-10-16.md:217`. AGENTS.md says to edit, not append. **Patch.** |
| E2 | `decimalPlaces() > MULTIPPEL_STEP.decimalPlaces()` is wrong for a step like 0.25 | low | Holds only for power-of-ten steps. The step is fixed at 0.1 by the URL contract, and the old `> 1` made the same assumption. Rejected (low, hypothetical). |
| E3 | An empty `covered_industry` leaves `{industry}` blank | low | The old code behaved the same. The loader writes coverage from `seed/coverage.json`, so it is unreachable in v1. Rejected (low, pre-existing). |

## Verification

**Commands:**
- `pnpm check:pins && pnpm lint && pnpm typecheck && pnpm test` -- pass
- `pnpm test:db` -- pass (seeded DB)
- `pnpm build && pnpm check:routes && pnpm test:e2e` -- pass, db-down project included
