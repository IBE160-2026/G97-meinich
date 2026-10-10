# Story 1.1: toolchain, CI guards and the app shell

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session, one implementation subagent working from a frozen spec, three review subagents
**Story / issue:** #1, Story 1.1
**Result:** PR #15 on branch `story/1.1-toolchain-and-shell`, commits `0c32889` (spec) through the review fixes; not merged

## Goal

Pinned toolchain (Node 24.21.0, pnpm 12.11.2, Next.js 16.4.0, React 19.3.0, TypeScript 6.0.3, Tailwind 4.3.3), CI guards for AD-8 and AD-19, Vitest and Playwright, and an empty Norwegian app shell that works at 320 and 375 px. No database.

## Prompts that mattered

- `/bmad-build`, then choosing Story 1.1 with: "Follow AGENTS.md 'Git workflow' from this first story: work on branch story/1.1-toolchain-and-shell (create it from main first), commit in small steps with descriptive messages, and finish by opening a PR that says 'Closes #1', lists the FRs and ADs from the story, shows the test and lint output, and links a session summary in docs/ai-sessions/. Don't merge — I'll review the PR first."
- Approving the spec: "Approve and continue. Two small things: update issue #1's branch name to story/1.1-toolchain-and-shell so issue, branch and PR match; and list the dead /slik-fungerer-peerless link in the PR as a known gap closed by story 1.6b. When the PR is open, stop — don't merge."
- The dispatch to the implementation subagent: "Read the spec fully and implement it — the spec is the sole source of truth."

## What came back, and what was done with it

**Planning**
- **Accepted:** spec `_bmad-output/implementation-artifacts/spec-1-1-toolchain-and-app-shell.md` with these choices: Vitest + Playwright, GitHub Actions, fonts from `@fontsource-variable` (no build-time Google fetch), and rewording two `.env.example` comments that contained the literal prefix. Pins verified against the npm registry the same day.
- **Corrected:** the issue named branch `story/1.1-toolchain-app-shell`; issue #1 and `epics.md` were updated to the user's name.
- **Environment:** Node 24.21.0 was not installed; installed with the local nvm.

**Implementation**
- **Accepted:**
  - ESLint 9.39.5, not 10.x: eslint-config-next 16.4.0's plugins stop at ESLint 9.
  - vite 8.3.4 pinned, as Vitest 5's peer.
  - `allowBuilds: unrs-resolver: false`, because pnpm 12 refuses unapproved install scripts.
  - `agentRules: false` in `next.config.ts`, so `next dev` does not write into AGENTS.md.
  - The `'use client'` import ban as a local rule that delegates to core `no-restricted-imports`.
- **Corrected while building:**
  - The env-check fixtures sat in `test/fixtures/env/`, which `.gitignore`'s `env/` rule silently hid; they were moved to `test/fixtures/public-env/`.
  - An e2e locator for "Peerless" also matched "Slik fungerer Peerless".
  - The no-dark-mode test matched a CSS comment.
- **Rejected:** the implementation subagent pushed and opened PR #15 before review. The workflow keeps remote operations for after review. The PR was left open and updated after review, and the deviation is recorded here and in the AI log.

**Review** (31 findings, triaged in the spec's Review Triage Log)
- **Fixed:**
  - The server-import pattern `**/server` also blocked `react-dom/server` and `next/server`; it is now a regex over the project's own `@/server`, `src/server` and relative `server` paths.
  - `postgres/*` subpaths are now blocked.
  - The rounding glob is now `*[fF]ormat*`.
  - A redundant `no-restricted-syntax` block is removed.
  - CLI exit-code tests are added for both check scripts.
  - `+sha512` is accepted in `packageManager`.
  - The copy scan now catches fragment literals and four more attributes.
  - e2e waits for webfonts before measuring.
  - GitHub Actions are bumped to v7 (v4 ran on deprecated Node 20).
- **Rejected or deferred, with reasons in the triage log:**
  - Literals in ternaries and `.ts` files are not scanned.
  - The `env` key in `next.config.ts` is not checked.
  - Transitive server imports are left to `server-only` in Story 1.2.
  - Rounding paths other than `Math.round`/`toFixed` are not banned.
  - The dead `/slik-fungerer-peerless` link stays until Story 1.6b.

## Links

- Spec and triage log: `_bmad-output/implementation-artifacts/spec-1-1-toolchain-and-app-shell.md`
- AI log: "Story 1.1: the AD-8 and AD-19 lint guards, and what they do not catch"
- Technical note, "Stack": the test runner and CI choice replaces the deferred bullet
