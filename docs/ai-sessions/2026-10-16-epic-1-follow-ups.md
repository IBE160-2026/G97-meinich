# Epic 1 follow-ups: retro actions 1–5

**Date:** 2026-10-16 (PR opened 2026-10-19)
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session, one implementation subagent working from the frozen spec, and three review subagents (blind, edge case, verification gap)
**Story / issue:** [#29](https://github.com/IBE160-2026/G97-meinich/issues/29), Epic 1 follow-ups (no new FR; retro actions 1–5)
**Result:** [PR #30](https://github.com/IBE160-2026/G97-meinich/pull/30), not yet merged, from branch `story/e1-follow-ups`: commits `6a17ca7` (Next.js 16.4.2), `4325185` (coverage-read guards), `4e55a7e` (db-down e2e), `2164dae` (engine framework ban), `e517794` (tidiness sweep), `7e0994a` (ledger and spec), `368b9df` (review fixes), `cd445d7` (spec: triage log, done), `2879395` (this file), `3bd34e6` (the AI-log entry), and the commit adding this PR link.

## Goal

Close the Epic 1 retrospective's actions 1–5 in one PR before Epic 2. Actions 1 and 2 are the human's condition for starting Epic 2.

## Prompts that mattered

- `/bmad-build Epic 1 follow-ups: retro action items 1, 3, 4 og 5 (epic-1-retro-2026-10-16.md). Én PR, logiske commits.`
- Answers to the session's two questions before planning:
  - **Include action 2 (Recommended).** The request named 1, 3, 4 and 5, but the retro says 1 and 2 together are the gate.
  - **Ledger entry only for action 3.** This follows the retro, which places the copy fix in Story 2.9.
- Answer to the open question in the spec, **"A: keep capital (Recommended)"**. The uncovered statement begins with the industry, so it keeps the register's capital.
- Approval: "Fra meg: godkjent. Kjør hele suiten i bolker etter Next.js-oppgraderingen (særlig e2e for 404-status, 500 via error.tsx og rate limit, som bygger på Next.js-detaljer), før de andre commitene. Bekreft KANTALL-teksten i e2e. Approve and continue."
- "Fra meg: ja, gjør alt: opprett issue, legg session-fil og ai-log-oppføring som egne commits på grenen, push og opprett PR-en (Closes #n). Session-fila skal ha PR-lenken før merge."

## What came back, and what was done with it

**Accepted**
- **The plan's two corrections to the request.** The session pointed out that the request left out action 2, which the retro makes part of the gate. It also pointed out that the request included action 3, which the retro defers. The human chose to include action 2 and to make action 3 a ledger entry only.
- **The orchestrating session's correction of the retro's D10 fix.** The retro said to lower-case the uncovered page's industry name through `industryInSentence`. The copy `analysis.uncovered.body` begins with that name, so the fix would have started a sentence with a small letter. The session raised this as an open question. The human chose to keep the capital, and the retro row was edited in place to match (`368b9df`).
- **Ordering, at the human's request.** The Next.js pin was committed on its own, and the full suite was run on it in batches before any other change. The Next.js-specific e2e ran first (16 db-down, rate-limit and no-ip-stored tests, 5 for the 404 states), then all 114 e2e. Everything passed.
- **The KANTALL check, at the human's request.** The rendered page for demo company C reads "Regnskapsføring og bokføring (69.202) er ikke dekket ennå. Foreløpig sammenligner Peerless bare selskaper innen dataprogrammeringstjenester (62.100). …". Both e2e tests for the uncovered company pass.
- **R1 before and after**, captured on a 16.4.2 server whose database was unreachable:
  - Before the fix: `GET /` answered 500 with a clean body, but Next.js logged `connect ECONNREFUSED 127.0.0.1:1` with the address, the port and a stack.
  - After the fix: our line `{"level":"error","event":"home.coverageFailed","failure":"Error"}`, and Next.js's `Error: home: coverage lookup failed` with no address or port.

**Not planned, and kept**
- **The release-age exemption.** pnpm 12 refuses packages younger than its minimum release age, so `pnpm install` wrote a `minimumReleaseAgeExclude` list for exactly the twelve 16.4.2 packages. The session kept it, because 16.4.2 is the security fix, and it is flagged in the PR. A comment explains it, and removing it is now a ledger entry (review finding B5).
- **Two changes beyond the spec's listed edits.** The implementation subagent also updated the AGENTS.md sentence on failed reads and the comment in `global-error.tsx`, as the rule that AGENTS.md must match the code requires.

**Corrected, and how it was caught**
- The orchestrating session read the diff and saw the engine-ban block placed between the AD-8 rounding comment and the constant that comment describes. The blind reviewer found the same thing (B1). Fixed in `368b9df`.
- The review step returned 23 findings: 19 blind, 4 edge case, 0 verification gaps. 7 were patched in `368b9df`:
  - the comment placement (B1);
  - a db-down test name that `/` made untrue (B4);
  - an owner for the release-age exemption (B5);
  - the exemption comment's wording (B6);
  - a stale test header (B11);
  - a second front-page case in which the query itself rejects (B14);
  - the retro's D10 row (B19).

**Rejected, and why** (each with evidence in the spec's Review Triage Log)
- **"The front page reads coverage twice" (B7):** false. `coveredIndustries` is already wrapped in `cache()`, so it is one query per request.
- **"Dynamic `import()` and `require` pass the engine ban" (B2/E1):** true, but the same holds for the existing `postgres` and `src/server` ban, and the engine has no dynamic import. Fixing it would add a syntax rule.
- **"`server-only`, `@next/*` and `react-server-dom-*` are not banned" (B3):** outside the retro's list, and unlikely in a module of pure functions.
- **"The decimal-test fixture names the deleted `src/engine/index.ts`" (B12/E4):** false. The path is input data for a regex.
- **"The multiple's check is wrong for a step such as 0.25" (E2):** hypothetical. The step is fixed at 0.1, and the old code made the same assumption.
- **"An empty `covered_industry` leaves a blank" (E3):** the old code behaved the same, and the case can't be reached in v1.
- **Six more, low or cosmetic:** B8, B9, B10, B13, B15 and B17.

## Links

- Retro: `_bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md` (actions 1–5)
- Spec and triage log: `_bmad-output/implementation-artifacts/spec-epic-1-follow-ups.md`
- AI log: "Epic 1 follow-ups: the coverage-read guards, the Next.js pin and its release-age exemption"
- Ledger: `_bmad-output/implementation-artifacts/deferred-work.md` (R2/R3 under Story 2.9; the release-age exemption)
