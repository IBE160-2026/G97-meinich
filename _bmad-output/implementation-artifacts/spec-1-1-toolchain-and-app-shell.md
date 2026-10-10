---
title: 'Story 1.1: Toolchain and app shell from a fresh clone'
type: 'feature'
created: '2026-10-10'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '0c32889d6a1ae176e758b79a6805fbdb8b71405f'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repository has no code. Every later story needs the same pinned toolchain, the same CI guards (pins, lint, typecheck, tests, no `NEXT_PUBLIC_`) and a shell that already works at phone width.

**Approach:** Scaffold Next.js 16.4.0 App Router + TS 6.0.3 strict + Tailwind 4.3.3 with pnpm 12.11.2, add ESLint guards (rounding ban, restricted imports), check scripts, Vitest + Playwright and a GitHub Actions workflow, and render an empty shell (header, empty main, footer) from a Norwegian message file. Story ACs: GitHub issue #1 (authoritative text; `epics.md` wins on conflict).

## Boundaries & Constraints

**Always:** Exact versions, no `^`/`~` anywhere in `package.json` (devDependencies too). `cacheComponents: false` in `next.config.ts`. `<html lang="nb">`. Every user-facing string from `src/messages/nb.json` via dotted ids. Light-mode tokens only. Body never scrolls horizontally at 320/375. Branch `story/1.1-toolchain-and-shell` (issue #1 and `epics.md` updated to match); small commits; PR says `Closes #1`, lists FR-55, FR-73 (toolchain part), AD-8, AD-19 and UX-DRs, shows test + lint output, links `docs/ai-sessions/` file, and lists the dead `/slik-fungerer-peerless` link as a known gap closed by Story 1.6b. Do not merge; stop once the PR is open.

**Never:** No database, migration, Supabase or `postgres`/`decimal.js`/`shadcn`/`recharts` dependency. No front-page content, search, about page or tabs (later stories). No dark tokens. No `any`. No `NEXT_PUBLIC_` occurrence except the two commented stage-2 lines in `.env.example`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Range in deps | `"x": "^1.0.0"` or `~` in any dep section | pin check exits non-zero, names the package | CI fails |
| Public env | `NEXT_PUBLIC_FOO` in a tracked source/config file | env check exits non-zero with file:line | CI fails |
| Allowed env | `# NEXT_PUBLIC_SUPABASE_URL=` / `# NEXT_PUBLIC_SUPABASE_ANON_KEY=` in `.env.example` | passes | — |
| Rounding | `Math.round` / `.toFixed(` in `src/engine/**` or a `*format*` file | lint error | lint test asserts it |
| Restricted import | engine or `'use client'` file importing `@/server/*`, relative `server/`, or `postgres` (4 cases) | lint error | lint test asserts each |
| Hard-coded copy | JSX text or literal `aria-label`/`title`/`alt`/`placeholder` in `src/app` or `src/components` | test fails naming file:line | — |
| Phone width | shell at 320 and 375 px | `scrollWidth ≤ innerWidth`; header link on two lines, inside viewport | — |

</frozen-after-approval>

## Code Map

- `.nvmrc` (24.21.0), `.gitignore` (already covers `.next`, `node_modules`, `test-results`, `playwright-report`) -- keep.
- `.env.example` -- two prose comments contain `NEXT_PUBLIC_` ("in v1 no NEXT_PUBLIC_ variable exists", "the only NEXT_PUBLIC_ variables"); reword so only the two commented variable lines remain.
- `_bmad-output/planning-artifacts/technical-note-architecture.md:301` -- deferred bullet "Test runner and CI provider: chosen in the first setup story"; update to record the choice.
- `ux-designs/.../mockups/messages-v1.nb.json` -- source of `shell.brand`, `shell.how`, `footer.source` copy.
- `DESIGN.md` frontmatter -- colours (light only), spacing, radii; header spec: wordmark bold navy-700, link right-aligned, wraps to two lines on phone (max ~92px), 1px `divider` bottom; breakpoint `md` 768px; source line `typography.source` slate.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` -- `packageManager: pnpm@12.11.2`, `engines.node`, exact pins; scripts `dev build start lint typecheck test test:e2e check:pins check:env` -- toolchain AC.
- [ ] `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `next-env.d.ts` (gitignored) -- strict, `@/*` → `src/*`; `cacheComponents: false` (flag name verified in Next docs, cited in PR).
- [ ] `eslint.config.mjs`, `eslint-rules/client-restricted-imports.mjs` -- next + typescript-eslint (`no-explicit-any` error); `no-restricted-properties`/`no-restricted-syntax` for `Math.round`/`toFixed` in `src/engine/**` and `**/*format*.{ts,tsx}`; `no-restricted-imports` for `src/engine/**`; local rule reusing core `no-restricted-imports` only in files with a `'use client'` directive. Ignore `test/fixtures/**`.
- [ ] `test/fixtures/lint/*`, `test/lint.test.ts` -- six fixtures linted via `ESLint.lintText` with virtual `filePath`; assert each rule fires, and a clean fixture passes.
- [ ] `scripts/check-pinned-deps.ts`, `scripts/check-no-public-env.ts`, `test/checks.test.ts` -- exported pure check functions + CLI entry (run with `node`, native type stripping); env check scans `git ls-files` excluding `*.md`, `_bmad/`, `_bmad-output/`, `docs/`, `analysis/` and its own test fixtures.
- [ ] `src/messages/nb.json`, `src/messages/index.ts` -- flat dotted ids; `t(id: MessageId)` typed from the JSON keys.
- [ ] `src/app/globals.css` -- Tailwind `@theme`: light colour tokens, `--font-sans` Inter, `--font-serif` Source Serif 4 (via `@fontsource-variable/*`, no build-time network), spacing tokens, radii; base body Inter 14px/1.45 with `tabular-nums` utility for figures; headings serif.
- [ ] `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/site-header.tsx`, `src/components/site-footer.tsx` -- shell; header wordmark → `/`, link → `/slik-fungerer-peerless` (page arrives in a later story), footer source-line placeholder `footer.source`.
- [ ] `test/no-hardcoded-copy.test.ts` (+ fixture) -- TS compiler API scan of `src/app/**/*.tsx`, `src/components/**/*.tsx`.
- [ ] `test/theme.test.ts` -- asserts each DESIGN.md light token incl. `band #6C7F95`, radii 3/4/6/9999px, fonts, no `-dark` token.
- [ ] `e2e/shell.spec.ts`, `playwright.config.ts` -- Chromium against `pnpm build && pnpm start`; 375 and 320 widths; `lang="nb"`, header/footer present.
- [ ] `vitest.config.ts` -- node environment, `test/**/*.test.ts`.
- [ ] `.github/workflows/ci.yml` -- Node from `.nvmrc`, corepack pnpm, frozen install, pins, env, lint, typecheck, test, Playwright install + e2e.
- [ ] `README.md`, `AGENTS.md` (Stack: test runner/CI), technical note line 301, `_bmad-output/implementation-artifacts/sprint-status.yaml`, `docs/ai-sessions/2026-10-10-story-1-1-toolchain-and-shell.md`.

**Acceptance Criteria:**
- Given a fresh clone with Node 24.21.0, when `corepack enable && pnpm install --frozen-lockfile && pnpm build && pnpm start`, then the shell renders on `/`.
- Given the repo, when lint, typecheck, unit tests and e2e run, then all pass and no `src/server`, database client or migration exists.

## Design Notes

Test runner: **Vitest** (unit; its Browser Mode with Playwright covers AD-6's real-browser test later) + **Playwright Test** for the rendered shell. CI: **GitHub Actions** (repo is on GitHub). Fonts via `@fontsource-variable` so builds need no Google fetch. Next.js 16.4 security release (2026-10-14) has not shipped on 2026-10-10: PR states this and asks the reviewer to re-check before merge.

## Verification

**Commands:**
- `pnpm check:pins && pnpm check:env` -- exit 0
- `pnpm lint && pnpm typecheck && pnpm test` -- all pass
- `pnpm build && pnpm test:e2e` -- both widths pass

## Implementation Notes

- ESLint pinned at 9.39.5, not 10.x: eslint-config-next 16.4.0's react/import/jsx-a11y plugins cap their peer range at ESLint 9. typescript-eslint 8.71.1 accepts TS <6.1.0.
- `vite` 8.3.4 pinned explicitly (required peer of Vitest 5).
- `pnpm-workspace.yaml` denies the `unrs-resolver` install script (`allowBuilds`); pnpm 12 fails install on unapproved builds.
- `next.config.ts` also sets `agentRules: false` so `next dev` does not write a managed block into AGENTS.md.
- `typecheck` runs `next typegen && tsc --noEmit` so `next-env.d.ts` (gitignored) exists on a fresh clone.
- Env check also scans untracked, non-ignored files; it excludes itself and `test/fixtures/env/`.
- Tailwind default colours, fonts and radii are reset (`--color-*: initial` etc.), so only DESIGN.md tokens exist; a `figure` utility gives Inter + tabular-nums.

## Spec Change Log

## Review Triage Log
