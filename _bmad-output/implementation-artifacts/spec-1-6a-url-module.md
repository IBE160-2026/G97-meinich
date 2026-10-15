---
title: 'Story 1.6a: One module reads and writes the analysis URL'
type: 'feature'
created: '2026-10-15'
status: 'done'
baseline_commit: 'c0d75bda576430b4257df945fd856556c282697b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing parses or validates an analysis URL, and the search field builds `/analyse/${orgnr}` by hand. Without one module, later controls (exclude, band, share, multiple) would each read and write the URL their own way, and unvalidated values could reach the engine (AD-5).

**Approach:**
- `src/url/analysis-state.ts` exports `parse` and `serialize` (plus types and the multiple bounds), importing only from `src/engine`.
- Unit tests cover every parameter and fallback before Epic 2 adds a control.
- The search field's hand-built href goes through `serialize`.
- Story ACs: GitHub issue #7 and `epics.md` Story 1.6a (authoritative; `epics.md` wins on conflict).

**Decisions (human, 2026-10-15):**
- **Spec size:** kept whole at about 1 700 tokens.
- **Candidate pool:** `parse` takes a second caller-supplied predicate, `isCandidate(peerOrgnr: string) => boolean`, a closed function. `parse` does not know how the pool is built (band or anything else); Story 1.7 decides that inside the function. An `ekskl` item it rejects is dropped and sets the flag. Story 1.6b passes a documented accept-all until 1.7 exists. Tests supply it both ways.
- **Unknown query parameters** are ignored without the notice and disappear when the URL is written canonically. Tested with `fbclid` and `utm_source`.

## Boundaries & Constraints

**Always:**
- Grammar per AD-5 / UX-DR79: path `/analyse/{orgnr}` or `/analyse/{orgnr}/{fane}`, `fane` ∈ `oversikt|peers|nokkeltall|verdi`; query `ekskl`, `band` (default `0`), `andel` (default `50`), `multippel` (default none).
- Orgnr rules from `src/engine/orgnr.ts` (`isValidOrgnr`), never re-implemented. Path orgnr: spaces (incl. `%20`) stripped; not nine digits → `invalid-orgnr` reason `length`; nine digits failing mod 11 → reason `checksum`.
- Every fallback sets one `invalidSettings` flag; nothing is dropped without it. Canonicalising (sorting, de-duplicating, stripping spaces, `6,5`→`6.5`, `6.50`→`6.5`) is not a fallback.
- `andel=median` is kept only if the caller's `medianStepExists` predicate says so; it receives the parsed `{ orgnr, band, ekskl }`, since s_med depends on the peer group.
- Canonical output: defaults omitted; parameters in the order `ekskl`, `band`, `andel`, `multippel`; literal commas in `ekskl`; `multippel` written with a point and no trailing zero. `serialize(parse(u))` is a fixed point for every test URL.
- `multippel` held as an engine `Decimal`, never a float.

**Never:**
- No route, page, notice copy or redirect (Story 1.6b). No candidate pool computation (Story 1.7).
- No import outside `src/engine` in the module; no other file in `src/` builds or reads `/analyse/` paths.
- No browser storage, no new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected | Flag |
|---|---|---|---|
| bare path | `/analyse/123456785` | `fane: null`; serializes back to the bare path | no |
| tab | `/analyse/123456785/peers` | `fane: 'peers'` | no |
| unknown tab | `/analyse/123456785/foo` | `oversikt` | yes |
| bad orgnr | `12345678`, `abc`, `123456789` | `invalid-orgnr` `length` / `length` / `checksum` | — |
| not analysis | `/`, `/analyse`, `/analyse/x/y/z` | `not-analysis` | — |
| ekskl canonical | `ekskl=b,a,a` (valid orgnrs) | sorted, de-duplicated | no |
| ekskl bad item | one item failing mod 11 | that item dropped, rest kept | yes |
| ekskl > 20 | 22 valid orgnrs | first 20 after sorting kept | yes |
| band | `1` / `2` / `0` / `3`, `x` | kept / kept / default, omitted / `0` | no / no / no / yes |
| andel | `0`…`100` / `33` / `median` with predicate false / true | kept / `50` / `50` / `median` | no / yes / yes / no |
| multippel | `6.5`, `6,5`, `50`, `0.1` / `0`, `50.1`, `6.55`, `-1`, `x` | kept / none | no / yes |
| repeated param | `band=1&band=2` | default | yes |
| empty value | `ekskl=`, `multippel=` | as absent | no |
| outside pool | `ekskl` item where `isCandidate` is false | that item dropped | yes |
| subject itself | `ekskl` item equal to the path orgnr (human, 2026-10-15) | dropped regardless of `isCandidate` (tested with it returning true) | yes |
| unknown param | `fbclid=x`, `utm_source=y` | ignored; gone from `serialize` output | no |

</frozen-after-approval>

## Code Map

- `src/engine/orgnr.ts` -- `isValidOrgnr(digits)`; reuse. `classifySearchInput` is for the search field, not the path (it treats non-digits as a name).
- `src/engine/index.ts` -- re-exports `Decimal` and `orgnr`; import from `../engine/index.ts` (or the specific engine files).
- `src/engine/decimal.ts` -- `toString()` never uses exponent notation; use it to write `multippel`.
- `src/components/search-field.tsx:79-81` `analysisHref` -- the one hand-built analysis path in `src/`; replace with `serialize`. `'use client'`: the URL module must stay client-safe (engine only).
- `test/engine/orgnr.test.ts` -- style for table-driven Vitest tests; new tests go in `test/url/analysis-state.test.ts` (Vitest picks up `test/**/*.test.ts`).
- `test/no-industry-literal.test.ts` + `scripts/check-no-public-env.ts` `listRepositoryFiles` -- reuse for the "only module" grep test.
- `AGENTS.md` (Toolchain paragraph, next to the orgnr sentence), `docs/ai-log.md`, `docs/ai-sessions/` README, `sprint-status.yaml`, `deferred-work.md` -- docs updated in this story.

## Tasks & Acceptance

**Execution:**
- [x] `src/url/analysis-state.ts` -- types `Fane`, `Andel`, `Band`, `AnalysisState`, `ParseResult`, `ParseContext`; `parse(href, context)`, `serialize(state)`, `MULTIPPEL_MAX`, `parseMultippel(text)` (for Story 3.6's field) -- the one reader and writer (AD-5).
- [x] `test/url/analysis-state.test.ts` -- every matrix row, the median predicate both ways, and the fixed point `serialize(parse(u))` over all test URLs.
- [x] `test/url-module-boundary.test.ts` -- the module's imports resolve only into `src/engine`; no other file under `src/` contains the `/analyse/` path literal.
- [x] `src/components/search-field.tsx` -- `analysisHref` uses `serialize`; existing e2e still navigates to `/analyse/{orgnr}`.
- [x] Docs: `AGENTS.md`, `docs/ai-log.md` (what could go wrong: URL input reaching the engine), session file, `sprint-status.yaml`.

**Acceptance Criteria:**
- Given issue #7's ACs and the matrix, when `pnpm lint && pnpm typecheck && pnpm test` run, then all pass.
- Given a seeded database, when `pnpm build && pnpm check:routes && pnpm test:e2e` run, then the search e2e still passes.

## Design Notes

```ts
type ParseResult =
  | { kind: 'analysis'; state: AnalysisState; invalidSettings: boolean }
  | { kind: 'invalid-orgnr'; reason: 'length' | 'checksum' }
  | { kind: 'not-analysis' };
type AnalysisState = { orgnr: string; fane: Fane | null; ekskl: readonly string[];
  band: 0 | 1 | 2; andel: 0 | 25 | 50 | 75 | 100 | 'median'; multippel: Decimal | null };
type ParseContext = {
  isCandidate: (peerOrgnr: string) => boolean;
  medianStepExists: (peers: { orgnr: string; band: Band; ekskl: readonly string[] }) => boolean };
```
`ekskl` order: split, strip, de-duplicate, drop items failing mod 11 or `isCandidate`, sort, then cap at 20 — so rejected items never take a slot.
`parse` accepts a path or absolute URL string (resolved against a dummy base; hash ignored; one trailing slash tolerated). Next.js callers in 1.6b pass the request path and search.

`multippel` read: `^\d+([.,]\d+)?$`, then `Decimal`; valid when `> 0`, `≤ 50` and `× 10` is an integer.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- pass
- `pnpm db:start && pnpm db:roles && pnpm seed && pnpm build && pnpm check:routes && pnpm test:e2e` -- pass

## Implementation Notes

- Exports beyond the list: `defaultState(orgnr)`, `MULTIPPEL_STEP`, `MAX_EKSKL`, and the value lists `FANER`, `BANDS`, `ANDELER`.
- Empty `ekskl` items (`a,,b`, trailing comma) are skipped without the flag, like an empty value.
- `serialize` sorts and de-duplicates `ekskl`; it does not otherwise validate the state.
- `parseMultippel` does not trim; a malformed `%` escape in the path is left undecoded and reads as `length`.
- Verified: `pnpm lint`, `pnpm typecheck`, `pnpm test` (25 files, 419 tests); seeded local database, `pnpm build`, `pnpm check:routes`, `pnpm test:e2e` (32 passed).

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind/edge | `parseMultippel` keeps a value off the 0.1 grid beyond 40 significant digits | medium | Probe: `multippel=6.500000000000000000000000000000000000000000001` parsed with no flag; `div` rounds to precision 40 | patch |
| 2 | gap/blind | Malformed `%` escape in the path (`decodeSegment` catch) untested | medium | Probe: `/analyse/%zz` → `length`, `/analyse/123456785/%zz` → `oversikt` + flag, but no test pins it; removing the `try` passes every test | patch |
| 3 | edge | Repeated empty value (`ekskl=&ekskl=`) sets the flag | low | Probe: `invalidSettings: true`; matrix says an empty value is absent; one-line filter | patch |
| 4 | edge/blind | Boundary test matches only `/analyse/`, not `/analyse` | low | `'/analyse' + '/' + orgnr` passes; no other `src/` file contains `/analyse`, so the broader literal is a direct change | patch |
| 5 | blind | Obligations left by this story are not in `deferred-work.md` | low | `isCandidate` accept-all until 1.7 and `medianStepExists` until 3.5 are only in ai-log prose | defer (two entries) |
| 6 | blind | ai-log says the types make other values unrepresentable | low | `orgnr: string` and `multippel: Decimal` are not narrowed by type; `parse` is the gate | patch (ai-log wording) |
| 7 | blind | Session file quotes no human prompt; ai-log "None found" vs review findings | low | AGENTS.md: "the prompts that mattered"; review found 1–4 | patch (docs) |
| 8 | blind | AGENTS.md sentence: "falls back to its default" is inexact for `ekskl` (dropped) and unknown params (ignored) | low | Sentence added in this diff | defer (agent-context file) |
| 9 | edge | Leading zeros in `multippel` (`06.5`) canonicalised while `band=01` is flagged | false | `band`/`andel` are enumerated tokens; `06.5` keeps its value like `6.50`, nothing lost | reject |
| 10 | edge | Double slash `/analyse//x`, `/analyse/x//` | low | Both still return a refusal or the flagged fallback; Next normalises paths; needs a guard | reject |
| 11 | edge/blind | `serialize` neither validates nor encodes `orgnr`/`ekskl` | low | Only caller passes an orgnr checked `^\d{9}$` by `parseResults`; `parse` is the gate by design | reject |
| 12 | edge | `serialize` may write > 20 `ekskl`, the subject, or 2-decimal multiple | false | No caller produces such a state; spec: `serialize` writes, `parse` validates | reject |
| 13 | edge | A throwing predicate makes `parse` throw | false | Caller's own bug failing loudly is correct behaviour | reject |
| 14 | edge | Thousands of `ekskl` items call `isCandidate` unboundedly | low | URL length is capped by the server's header limit; 1.7's predicate is a set lookup; needs a new limit | reject |
| 15 | edge | Boundary test throws ENOENT on a tracked file deleted locally | low | Same pattern as `no-industry-literal.test.ts`; developer-only, transient | reject |
| 16 | blind | Fixed-point test relies on file order and shared `seen` | low | Under `-t` it fails loudly on `> 50`, never passes silently | reject |
| 17 | blind | `/analyse/{orgnr}` and `/oversikt` both canonical | false | AD-5 grammar defines both; 1.6b redirects bare → `oversikt` for covered companies | reject |
| 18 | blind | `check-routes`/e2e not tied to `FANER` | low | `check-routes` uses the dynamic `[fane]` segment, no tab names | reject |
| 19 | blind | Code Map names the `docs/ai-sessions/` README as updated | false | It is listed as the format reference; fix would edit this spec | reject |
| 20 | blind | "84 tests" untraceable | false | 87 tests in the two new files minus 3 boundary tests = 84 | reject |
