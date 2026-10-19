---
title: 'Story 1.1: Toolchain and app shell from a fresh clone'
type: 'feature'
created: '2026-10-10'
status: 'done'
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
- [x] `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` -- `packageManager: pnpm@12.11.2`, `engines.node`, exact pins; scripts `dev build start lint typecheck test test:e2e check:pins check:env` -- toolchain AC.
- [x] `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `next-env.d.ts` (gitignored) -- strict, `@/*` → `src/*`; `cacheComponents: false` (flag name verified in Next docs, cited in PR).
- [x] `eslint.config.mjs`, `eslint-rules/client-restricted-imports.mjs` -- next + typescript-eslint (`no-explicit-any` error); `no-restricted-properties`/`no-restricted-syntax` for `Math.round`/`toFixed` in `src/engine/**` and `**/*format*.{ts,tsx}`; `no-restricted-imports` for `src/engine/**`; local rule reusing core `no-restricted-imports` only in files with a `'use client'` directive. Ignore `test/fixtures/**`.
- [x] `test/fixtures/lint/*`, `test/lint.test.ts` -- six fixtures linted via `ESLint.lintText` with virtual `filePath`; assert each rule fires, and a clean fixture passes.
- [x] `scripts/check-pinned-deps.ts`, `scripts/check-no-public-env.ts`, `test/checks.test.ts` -- exported pure check functions + CLI entry (run with `node`, native type stripping); env check scans `git ls-files` excluding `*.md`, `_bmad/`, `_bmad-output/`, `docs/`, `analysis/` and its own test fixtures.
- [x] `src/messages/nb.json`, `src/messages/index.ts` -- flat dotted ids; `t(id: MessageId)` typed from the JSON keys.
- [x] `src/app/globals.css` -- Tailwind `@theme`: light colour tokens, `--font-sans` Inter, `--font-serif` Source Serif 4 (via `@fontsource-variable/*`, no build-time network), spacing tokens, radii; base body Inter 14px/1.45 with `tabular-nums` utility for figures; headings serif.
- [x] `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/site-header.tsx`, `src/components/site-footer.tsx` -- shell; header wordmark → `/`, link → `/slik-fungerer-peerless` (page arrives in a later story), footer source-line placeholder `footer.source`.
- [x] `test/no-hardcoded-copy.test.ts` (+ fixture) -- TS compiler API scan of `src/app/**/*.tsx`, `src/components/**/*.tsx`.
- [x] `test/theme.test.ts` -- asserts each DESIGN.md light token incl. `band #6C7F95`, radii 3/4/6/9999px, fonts, no `-dark` token.
- [x] `e2e/shell.spec.ts`, `playwright.config.ts` -- Chromium against `pnpm build && pnpm start`; 375 and 320 widths; `lang="nb"`, header/footer present.
- [x] `vitest.config.ts` -- node environment, `test/**/*.test.ts`.
- [x] `.github/workflows/ci.yml` -- Node from `.nvmrc`, corepack pnpm, frozen install, pins, env, lint, typecheck, test, Playwright install + e2e.
- [x] `README.md`, `AGENTS.md` (Stack: test runner/CI), technical note line 301, `_bmad-output/implementation-artifacts/sprint-status.yaml`, `docs/ai-sessions/2026-10-10-story-1-1-toolchain-and-shell.md`.

**Acceptance Criteria:**
- Given a fresh clone with Node 24.21.0, when `corepack enable && pnpm install --frozen-lockfile && pnpm build && pnpm start`, then the shell renders on `/`.
- Given the repo, when lint, typecheck, unit tests and e2e run, then all pass and no `src/server`, database client or migration exists.

## Design Notes

Test runner: **Vitest** (unit; its Browser Mode with Playwright covers AD-6's real-browser test later) + **Playwright Test** for the rendered shell. CI: **GitHub Actions** (repo is on GitHub). Fonts via `@fontsource-variable` so builds need no Google fetch. Next.js 16.4 security release (2026-10-14) has not shipped on 2026-10-10: PR states this and asks the reviewer to re-check before merge. (Missed: see the Spec Change Log.)

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
- Env check also scans untracked, non-ignored files; it excludes itself and `test/fixtures/public-env/` (moved from `test/fixtures/env/`, which `.gitignore`'s `env/` rule hid).
- Tailwind default colours, fonts and radii are reset (`--color-*: initial` etc.), so only DESIGN.md tokens exist; a `figure` utility gives Inter + tabular-nums.

## Spec Change Log

- **2026-10-19 (Meinich, Epic 1 retro action 7, finding S1):** the AC to pin the patched `next` once the 2026-10-14 advisory shipped was missed. The advisory shipped that day as 16.4.1 (GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr, both critical), no later story re-checked it, and the repository stayed on 16.4.0 until the retro. `next` and `eslint-config-next` were pinned to 16.4.2 in the Epic 1 follow-ups PR (#30, commit `6a17ca7`). The Implementation Notes' 16.4.0 references describe the version this story shipped.

## Review Triage Log

Pass 1 (blind-hunter BH, edge-case-hunter EC, verification-gap VG):

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 1 | VG: CLI exit path of check:pins/check:env untested | medium | Tests import only pure functions; a dropped `process.exitCode = 1` or a non-matching entry guard passes CI | patch |
| 2 | EC/VG/BH: string literal in a fragment `<>{'x'}</>` not reported | low | `ts.isJsxElement(node.parent)` excludes `JsxFragment`; one-token fix | patch |
| 3 | EC/BH: copy attributes miss `label`, `aria-description`, `aria-roledescription`, `aria-valuetext` | low | `COPY_ATTRIBUTES` set; direct addition | patch |
| 4 | EC/BH: literals in ternaries/`&&`/substituted templates not detected | low | Real, but detection needs subtree walk with `t()` exemption; no such code exists yet | reject (noted in PR as known limit) |
| 5 | EC/BH/VG: `.ts` files and `metadata` objects not scanned | low | `layout.tsx` uses `t()`; widening scan adds rules for non-JSX literals | reject (noted in PR) |
| 6 | EC/VG: rounding glob case-sensitive (`kronerFormat.ts`) | low | `**/*format*` misses capital F; direct glob change | patch |
| 7 | VG/EC: `**/*format*` also matches `information.ts` | low | Errs strict; harmless | reject |
| 8 | EC/BH: `**/server` pattern blocks `react-dom/server`, `next/server` | low | Verified with `ignore`: both match | patch (narrow to project `server` paths) |
| 9 | BH: nested `@/server/db/client` not covered | false | Verified with `ignore`: matches (parent-dir rule) | reject |
| 10 | EC: `postgres/...` subpath not restricted | low | `paths` matches exact name only; add `postgres/*` | patch |
| 11 | EC: dynamic `import()`/`require` bypass | low | Unlikely; adds selectors | reject |
| 12 | EC: template-literal computed access `Math[\`round\`]` | low | Contrived; adds selectors | reject |
| 13 | VG: `no-restricted-syntax` computed selectors redundant with `no-restricted-properties` | low | Core rule resolves static computed names; deletion is direct | patch |
| 14 | BH: other rounding paths (`floor`, `Intl`, destructuring) | low | Intent names `Math.round` and `toFixed` only | reject (noted in ai-log) |
| 15 | EC: `packageManager` with corepack `+sha512…` suffix fails check:pins | low | Regex `^pnpm@x.y.z$`; `corepack use` writes the hash; direct regex fix | patch |
| 16 | EC: `pnpm.overrides` ranges unchecked | low | None exist | reject |
| 17 | EC/BH: Playwright `webServer` runs bare `pnpm`, fails where shim blocked | false | e2e passed via `corepack pnpm test:e2e` on that machine (`[WebServer] $ next start`) | reject |
| 18 | EC/BH: `reuseExistingServer` may test a stale server | low | Local-only, port 3100 dedicated | reject |
| 19 | EC: line count measured before webfont loads | low | Fallback metrics could change wrap; one-line `document.fonts.ready` await | patch |
| 20 | EC: gitignored `.env` with public var not scanned | low | AC scopes source/config in repo; CI has no `.env` | reject |
| 21 | EC: `.MD` uppercase extension | low | No such file; contrived | reject |
| 22 | EC claim: README/AGENTS contain `NEXT_PUBLIC_` | false | AC covers source and configuration; docs are prose and excluded by design | reject |
| 23 | BH: `next.config` `env` key leaks without `NEXT_PUBLIC_` | low | Real path, requires deliberately writing `env:`; outside AC | reject (recorded in ai-log) |
| 24 | BH: transitive import via non-client module reaches client bundle | low | AD-19 requires `import 'server-only'` in `src/server/db.ts` (Story 1.2), which fails the build on that path | reject (recorded in ai-log) |
| 25 | BH: dead `/slik-fungerer-peerless` link | false | Accepted by the user; known gap closed by Story 1.6b, listed in PR | reject |
| 26 | BH: unused `id="innhold"`, no skip link / `nav` | low | Not in story; no user harm in an empty shell | reject |
| 27 | BH: Actions on floating `@v4` tags, Node 20 deprecation warning | low | CI warns now; v7 majors exist (verified via gh api); direct bump | patch |
| 28 | BH: no pnpm/Playwright cache in CI | low | Speed only | reject |
| 29 | BH: spec `in-review` vs sprint-status `review` | false | Each file uses its own status vocabulary | reject |
| 30 | BH: AI session thin; no ai-log entry despite AD-8/AD-19 guards | low | AGENTS.md asks for what-could-go-wrong on money/data guards | patch (orchestrator writes docs) |
| 31 | BH: Node version in three places; `engines` not enforced | low | Consistent today; enforcement adds config | reject |
