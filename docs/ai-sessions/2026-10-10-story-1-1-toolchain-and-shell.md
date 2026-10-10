# Story 1.1: toolchain, CI guards and the app shell

**Date:** 2026-10-10
**Tool:** Claude Code (Opus 5.5), dispatched as a dev subagent from `bmad-build` against the frozen spec
**Story / issue:** #1, Story 1.1
**Result:** branch `story/1.1-toolchain-and-shell`, PR linked from issue #1

## Goal

Implement `_bmad-output/implementation-artifacts/spec-1-1-toolchain-and-app-shell.md`: pinned toolchain, lint and CI guards, Vitest + Playwright, and an empty Norwegian shell that works at 320 and 375 px. No database.

## Prompts that mattered

- "Read the spec fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."

## What came back, and what was done with it

- **Accepted:** exact pins checked against the npm registry on 2026-10-10 (next 16.4.0 released 2026-10-06; react 19.3.0; typescript 6.0.3 — 7.0.2 is `latest` but the project stays on 6.x; tailwindcss 4.3.3; pnpm 12.11.2).
- **Accepted:** ESLint 9.39.5, not 10.x. `eslint-config-next` 16.4.0 pulls in `eslint-plugin-react`, `-import` and `-jsx-a11y`, whose peer ranges stop at ESLint 9. `typescript-eslint` 8.71.1 accepts TypeScript `<6.1.0`, so it fits 6.0.3.
- **Accepted:** `vite` 8.3.4 is pinned explicitly; Vitest 5 declares it as a required peer.
- **Accepted:** `allowBuilds: unrs-resolver: false` in `pnpm-workspace.yaml`. pnpm 12 refuses to install while a build script is unapproved; the resolver's native binary comes as an optional dependency, so its postinstall fallback is denied rather than allowed.
- **Accepted:** `agentRules: false` in `next.config.ts`. Next.js 16.4's `next dev` otherwise writes a managed block into `AGENTS.md`, which is hand-written and authoritative here.
- **Accepted:** the `'use client'` import ban is a local rule that delegates to core `no-restricted-imports`, because flat config selects files by path and a client module can live anywhere.
- **Accepted:** the env check scans tracked *and* untracked-but-not-ignored files (`git ls-files --cached --others --exclude-standard`), so a new file is caught before it is added. It excludes itself and its own fixtures; the test file builds its assertions without the literal prefix.
- **Corrected, caught by the e2e run:** `getByRole('link', { name: 'Peerless' })` matched both the wordmark and "Slik fungerer Peerless"; the locators now use `exact: true`.
- **Corrected, caught by the theme test:** the "no dark mode" assertion matched the word `prefers-color-scheme` in a CSS comment; the test now strips comments first.
- **Environment note:** on this machine `corepack enable` writes a `pnpm` shim that the local nvm refuses to run (NVM4306). Everything was run as `corepack pnpm …`; the README mentions the fallback.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-1-1-toolchain-and-app-shell.md`
- Technical note, "Stack": the test runner and CI choice replaces the deferred bullet.
- AI log: no entry. The story touches no auth, data access or money handling beyond the lint ban on float rounding, and nothing the AI proposed was rejected.
