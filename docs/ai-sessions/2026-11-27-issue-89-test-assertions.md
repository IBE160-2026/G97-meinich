# Issue #89: tests assert unconditionally, e2e reads only through auto-waiting assertions

**Date:** 2026-11-27
**Tool:** Claude Code (claude-opus-5-5), in the Story 4.1 `bmad-build` session
**Story / issue:** #89, Epic 3 retro action 8 (moved out of Story 4.1, #88)
**Result:** PR #90, https://github.com/IBE160-2026/G97-meinich/pull/90 (branch `story/89-test-assertions`)

## Goal

Epic 3 retro action 8: an e2e test reads a page value only through an auto-waiting assertion, never a snapshot, and no test has an `expect` inside a condition. Lint enforces it. Meinich moved it out of Story 4.1 into its own PR, merged before 4.1's code, so that the rewrites are reviewed on their own.

## Prompts that mattered

Meinich's answer to the Story 4.1 checkpoint (2026-11-27), point 3. The prompt was drafted by the review session and sent by Meinich (see "From the review session" below):

> Handlingspunkt 8 tas i en egen PR før 4.1-koden, ikke i denne. Det gjelder omtrent 100 omskrivninger i 26 testfiler, og de skal vurderes for seg. Lag et eget issue og en egen branch fra origin/main, som #71 og PR #85. Før du skriver om, list kategoriene av betingede expect og hva hver blir skrevet om til. Eventuelle eslint-disable må ha en grunn. List dem. Rapporten viser for et utvalg av de omskrevne testene at de fortsatt feiler når vernet fjernes.

## The rules

Both use `no-restricted-syntax` in `eslint.config.mjs`. No dependency is added: neither `eslint-plugin-playwright` nor `@vitest/eslint-plugin` is installed, and Playwright's `no-conditional-expect` would cover only half.

- **No `expect` inside a condition** (`test/**` and `e2e/**`). The ban covers `expect(…)` and `expect.x(…)` anywhere inside an `if`, `?:`, `switch`, `&&` / `||` or `catch`.
- **No snapshot read of a page value** (`e2e/**`).
  - **Methods:** `textContent`, `innerText`, `innerHTML`, `inputValue`, `allTextContents`, `allInnerTexts`, `getAttribute`, `count`, `all`, `boundingBox`, `evaluate`, `evaluateAll`, and the `is…` state methods.
  - **Flagged when the value is used:** kept in a variable, assigned, passed to `expect`, returned, made an arrow function's body, or iterated with `for … of await`.
  - **Allowed:**
    - inside `expect.poll`'s callback or an `expect(…).toPass()` block, because both retry;
    - inside an `evaluate` callback, which is the browser's DOM;
    - an awaited call whose value is not used, such as `page.evaluate(() => document.fonts.ready)`.
- **Out of scope:** HTTP answers (`response.json()`, `context.cookies()`, status codes). They are settled values, not a streamed page.

## Inventory before the rewrite

This section was committed before the rewrite started, in `5f9f798`. Its first count was 188 sites: 72 conditional `expect`s and 116 reads. The read rule then listed the parents it flags one by one: a variable, an assignment, an `expect` argument, a `return`, an arrow's body and `for … of await`.

While rewriting, the read rule was widened twice, after two misses showed up in the code. Each widening was counted on `origin/main` against the list it extended:

| Widening | Example | New sites |
|---|---|---|
| 1. A read inside a template literal, which is how a selector is built | `` `[id="${await b.getAttribute('aria-controls')}"]` `` | **10**: demo-waterfall 1, failed-subject 1, key-figures 5, search 1, synthetic-documents 2 |
| 2. Every awaited read whose value is used: `:not(ExpressionStatement) > AwaitExpression > read`, which replaces the list of parents. The new cases are a read passed to a function, a member access and a comparison. | `pooledCount(await vare.innerText())`, `(await count.innerText()).split(…)`, `(await x.count()) > 0` | **17**: analysis-states 1, demo-waterfall 1, failed-subject 2, peers 1, provenance 3, search 2, synthetic-documents 6, verdi 1 |

The second widening drops nothing the first found (0 sites). On `origin/main` at `13b510c`, the final rules report **215 sites in 34 files**:
- **72 conditional `expect`s** in 16 Vitest and e2e files, unchanged;
- **143 snapshot reads** in 18 e2e files: 116 + 10 + 17.

The checkpoint's estimate of about 100 sites in 26 files counted only direct reads and reads into a variable. The count is `git show origin/main:<file>`, linted through `eslint.config.mjs` with only `no-restricted-syntax`.

### Conditional `expect`: categories and what each becomes

| # | Category | Example | Rewritten to | Sites (files) |
|---|---|---|---|---|
| C1 | **Narrowing after an asserted kind.** The `if` only narrows the type, and the kind is asserted on the line before. | `expect(v.kind).toBe('absent'); if (v.kind === 'absent') expect(v.text)…` | `narrow(v, 'absent')` from a new `test/narrow.ts`, which throws on another kind. Then the `expect` runs unconditionally. | `waterfall-view`, `closable`, `document-benchmark`, `benchmark` |
| C2 | **A branch chosen by seed data.** An e2e oracle picks the assertion from the engine's result, so a seed change silently moves a figure to the weaker branch. | `if (c.best !== null) { …best… }`; `if (c.kind === 'subject_absent') … else …` | The case is stated as a literal per figure, a fact of the committed seed. It is asserted unconditionally (`expect(c.kind).toBe(KIND[figure])`) and narrowed, so each figure has one path. | e2e `key-figures`, `oversikt`, `peer-adjust`, `synthetic-documents` |
| C3 | **A branch on a test parameter.** One test loops over widths, variants, tabs or table rows and branches on the parameter. | `if (width >= 768) … else …`; `if (variant === 'compact') … else …`; `if (ok) … else …` | One test per case, or the loop split into one loop per case, each with its own assertions. Where a table row carries an expected value, it holds the value itself, not a flag. | e2e `failed-subject`, `key-figures`, `verdi`; `search-field`, `seed-format` |
| C4 | **A shape walker.** A recursive `leaves()` asserts inside path branches, so a payload without a strip or geometry passes. | `if (path.endsWith('.strip')) { expect(…) }` | The walker only collects the strips, geometries and non-plain objects. The test asserts over the collected lists, including a fixed count, so an empty collection fails. | `decomposition-view`, `key-figure-rows`, `waterfall-view` |
| C5 | **A filter inside a loop.** | `if (field !== 'kundefordringer') expect…`; `if (result.kind === 'value') expect…`; `if (flagged.has(…)) expect…`; `if (words.detail !== null) expect…`; `if (absolute === half) expect…` | Filter first into a named list, and assert that list: a fixed expected list, or a length above 0 where the inputs are generated. Then `expect` over every element. | `absence-state`, `document-inputs`, `document-key-figures`, engine `peers`, engine `waterfall` |
| C6 | **A guard on a fact that may not hold.** The test checks nothing when the fact is the other way. | `if (funnel.fingerprint === null) { … }`; `if (existsSync(proxy)) expect…`; `if ((await headerSearch(page).count()) > 0) { … }` | Assert the fact unconditionally, or build the case the title names. **This one is a hollow test:** demo A has a 2025 fingerprint in `seed/demo/fingerprint.csv`, so the block in `test/db/peers.test.ts` "…a subject without one keeps the whole pool" never ran. It now runs the funnel with the fingerprint signal on and the subject's fingerprint set to null. | db `peers`, `service-role`, e2e `analysis-states` |
| C7 | **`expect` in a `catch`.** | `refusal()` in `test/seed-format.test.ts` | Catch into a variable and assert after the `try`. | `seed-format` |
| C8 | **A null guard after `expect(box).not.toBeNull()`.** | `if (box) { expect(box.x)… }` | A throwing null check inside the `toPass` block (S3). | e2e `shell` |
| C9 | **A branch on the literal expected table**, not on data. | `if ('undefined' in expected)` in `check` / `checkDocument` | Kept, with `eslint-disable-next-line` and a reason: the branch picks the assertion from a hand-written reference case, never from the engine's output. Listed below. | engine `reference-cases` |

### Snapshot reads: categories and what each becomes

| # | Category | Rewritten to |
|---|---|---|
| S1 | **Text.** `textContent`, `innerText` and `all…Texts`, compared afterwards. | `toHaveText` / `toContainText` against the oracle. Two page values compared with each other are each compared with the oracle instead. |
| S2 | **Computed style** through `evaluate(getComputedStyle)`. | `toHaveCSS(property, value)`. |
| S3 | **Geometry**: `boundingBox`, `getBoundingClientRect` and scroll widths through `evaluate` or `evaluateAll`, with the `expect`s that compare them. | The read and its `expect`s inside `await expect(async () => { … }).toPass()`. `noSidewaysScroll` in `e2e/seed.ts` becomes one. |
| S4 | **Page state** through `page.evaluate`: history length, the `replaceState` and announcement spies, storage, the user agent. | `expect.poll(() => page.evaluate(…))`. The helpers (`historyLength`, `replaced`, `announced`, `chips`, `groupSize`) become poll factories, such as `expectHistoryLength(page).toBe(n)`. |
| S5 | **An attribute read** to find a related element (`aria-describedby`, `aria-controls`, `id`). | `toHaveAttribute(name, id)` with the component's id constant, then a locator on that id. |
| S6 | **`count()` and `all()`** for a limit or a loop. | `toHaveCount(n)` before the loop, or `expect.poll(() => locator.count())` for a bound. |
| S7 | **Values computed in the browser** (wire identity, the beeswarm's dots, the funnel's stages): `evaluate` or `evaluateAll` returning data that is then compared. | `expect.poll(() => …evaluateAll(…)).toEqual(…)`, or a `toPass` block where several `expect`s read the same value. |

| S8 | **A baseline**: a page value read before an action, to compare with after it. | It is read inside a `toPass` block that asserts what the value must hold, so it is taken only once it holds that. This covers the Verdi cards before a reload or an arrow key, the beeswarm's lists, and a scroll region's width. Where nothing can be asserted on the baseline, it stays a plain read with a reasoned `eslint-disable` (below). |

**A limit of the rule:** it sees method names, not types. A read wrapped in a helper defined outside `e2e/` would pass unseen, and none exists today.

### Every `eslint-disable`, with its reason

| File | What it reads | Reason |
|---|---|---|
| `e2e/history.ts` `historyLength` | `window.history.length` | A baseline taken before the action, not an assertion. The comparison after the action polls (`expectHistoryLength`). |
| `e2e/failed-subject.spec.ts` `apiCells` | the three API rows' cells | A baseline of the page's own cells, read once the page is rendered. The second state is compared with it through `expect.poll`. |
| `e2e/peer-change-timing.spec.ts` `timed` | the status region's text | A baseline taken before the action, so the poll can tell the new announcement from the old. |
| `test/engine/reference-cases.test.ts`, three sites in `check` and `checkDocument` | | The branch is on the hand-written reference case (`expected`), never on the engine's output (C9). |

## What came back, and what was done with it

### Three tests that did not test what they said

For each one, the guard was removed in `src/` and both the test as it stood at `13b510c` and the rewritten test were run. The guard was then restored with `git checkout`.

| Test | Guard removed | `13b510c` | Now |
|---|---|---|---|
| `test/db/peers.test.ts` "reads no fingerprint as null, and a subject without one keeps the whole pool" | `agree` in `src/engine/peers.ts` treats a subject with no type as disagreeing (`b === null ? null : a === b`) | passes: the block under `if (funnel.fingerprint === null)` never ran, because demo A has a 2025 fingerprint | fails: `expected [ …(215) ] to deeply equal [ …(434) ]` |
| `test/engine/waterfall.test.ts` "1 000 seeded random cases keep every rule" | `roundHalfAway` in `src/engine/waterfall.ts` rounds an exact half toward zero | passes: the seed draws no exact half, so the tie check never ran | The tie check is removed from this test. "the total half away from zero, once" fails: `expected 0n to be -1n` |
| `e2e/key-figures.spec.ts` `expectFactor`, below-floor branch | `src/components/analysis/factor-pair.tsx` drops a factor's `belowFloor` sentence | "margin or capital: each factor against the engine" passes: no caller reaches the branch | The branch is removed. `e2e/peer-adjust.spec.ts` "factors below the floor" fails: `Expected substring: "For få sammenlignbare (9 av 10)"`, `Received string: "DriftsmarginPEXIP AS21,6 %↑ … 9 sammenlignbare brukt · 0 utelatt"` |

**The subject of `test/db/peers.test.ts` is now chosen by a fixed rule.** It is demo A, `DEMO_A` in `src/demo-companies.ts`, with its fingerprint set to null by the test itself (`{ ...funnel, fingerprint: null }`). The test runs stage 4 with the fingerprint signal on. It asserts that demo A has a fingerprint, unconditionally, so a seed in which it had none would fail rather than skip.

### A sample of rewritten tests, with the guard removed

| Category | Guard removed | Failing test and output |
|---|---|---|
| C4 walker | a strip mark gets one more field (`debug: 0` in `src/analysis/strip-marks.ts`) | `test/analysis/key-figure-rows.test.ts` "row view holds only strings and strip marks": `view.groups.0.rows.0.comparison.strip: expected [ 'bandFrom', 'bandTo', 'best', …(4) ] to deeply equal [ …(3) ]` |
| C5 filter | kfd's value is tagged `api` (`src/engine/document-key-figures.ts`) | `test/engine/document-key-figures.test.ts` "gives every value source document…": `kfd: expected 'api' to be 'document'` |
| C7 catch | a missing report throws `Error`, not `SeedRefusal` (`scripts/seed-format.ts`) | `test/seed-format.test.ts` "runs inside prepareSeed…": `expected Error: seed/coverage.json entry 62.100: m… to be an instance of SeedRefusal` |
| C3 split | the compact field loses its placeholder (`src/components/search-field.tsx`) | `test/search-field.test.ts` "has the label as placeholder, besides the label": `expected '<form role="search" …' to match /<input[^>]*placeholder="Navn eller or…/` |
| S2 style | `.scroll-region` gets `overflow-x: hidden` (`src/app/globals.css`) | `e2e/key-figures.spec.ts` "the table sits in a labelled, focusable scroll region…": `toHaveCSS` `Expected: "auto"`, `Received: "hidden"` |
| S5 attribute | the search field's message no longer describes it (`aria-describedby={undefined}`) | `e2e/search.spec.ts` `"81323555" shows "Organisasjonsnummeret må ha 9 siffer"…`: `toHaveAccessibleDescription` `Expected: "Organisasjonsnummeret må ha 9 siffer"`, `Received: ""` |

The three e2e guards were removed together in one production build, and only the named tests were run against it.

### Corrected along the way

- **A dead tie check.** The first rewrite of the waterfall tie check asserted that the seed draws at least one tie. That failed with `expected 0 to be greater than 0`, which is how the check was found to be dead.
- **`useInnerText` on body text.** The first `not.toContainText` rewrites of `e2e/db-down.spec.ts` and `e2e/rate-limit.spec.ts` read `textContent`, which includes the RSC payload's scripts. The originals read `innerText`, so both rewrites pass `useInnerText: true`.
- **Narrowing in closures.** In `e2e/synthetic-documents.spec.ts`, TypeScript's narrowing of `oml.gap` does not reach the `toPass` closures (TS2339), so the narrowed øre is held in `omlOre` before them.
- **The six directives in the intermediate commits.**
  - Vitest commit `3708974` brought in the three `reference-cases` directives before the rule existed, so lint shows them there as 3 "unused eslint-disable directive" warnings, though with 0 errors.
  - E2e commit `37d1188` takes all six out, so it lints with no warning.
  - Lint commit `dc60ef7` puts them back with the rule.

### Verification

Run in the order of AGENTS.md "Testing" on `bf79ea9`:

| Step | Result |
|---|---|
| `check:pins`, `check:env`, `lint`, `typecheck` | pass |
| `pnpm test --maxWorkers=2` | 2 146 passed |
| `pnpm seed` ×2, `pnpm seed:export` | `git status seed/` clean |
| `pnpm test:db`, `pnpm test:ingest` | 208 and 392 passed |
| `pnpm build`, `check:routes` | pass; 7 app entries, no server action |
| e2e, one worker, chromium in three runs of five spec files (ports 3100 and 3101 checked free before each) | 66, 77 and 66 passed (209) |
| e2e `db-down`, then `synthetic --no-deps` | 7 and 31 passed |
| `pnpm restore:documents` | documents 2 785, columns 5 556, fingerprints 2 537, classification rows 10 371 |

## From the review session

The review session is a separate Claude Code session. Meinich reads what it drafts and posts it. Each item below came from there, not from this session:

- **A PR of its own.** The review session recommended moving action 8 out of Story 4.1 into its own PR. Meinich decided it.
- **The checkpoint prompt.** The prompt quoted under "Prompts that mattered" was drafted by the review session.
- **The final count in the inventory.** It required updating the inventory from 188 to the final count, which gave `bf79ea9`.
- **The missing documentation.** It found that the PR changed neither AGENTS.md nor the retro before push, which gave `80b0523`.
- **CI.** It re-ran the failed CI job: `test/db/peer-assembly-time.test.ts` took 1 084 ms on attempt 1 and was green on attempt 2.
- **The review of PR #90** (https://github.com/IBE160-2026/G97-meinich/pull/90#pullrequestreview-6087515087). This session checked each finding before acting on it:
  - three forms the read rule let through, each confirmed here with `eslint --stdin` (0 errors each, against 1 for a stored awaited read as the control);
  - loops over an empty list;
  - the CI timing.

## Review fixes

| # | Finding (by) | Fix | Shown failing without the fix |
|---|---|---|---|
| R1 | Three forms the read rule let through: a read kept unawaited and awaited later, `.then` on a read, reads listed for `Promise.all` outside `toPass` (review session) | `d30a7b0`: `VariableDeclarator`, `MemberExpression[property.name='then']` and `ArrayExpression` join the parents of a read. The three `Promise.all` in `e2e/oversikt.spec.ts` (310, 328, 345) sit inside `toPass` and still lint clean. | Three new cases in `test/lint.test.ts` "rejects a snapshot read in e2e", run against the rule before the fix: `× kept unawaited and awaited later`, `× followed by .then`, `× listed for Promise.all` (3 failed, 9 passed). With the fix: 59 passed. |
| R2 | "Filter first and assert the filtered list" leaves the filtered list possibly empty; a loop or `it.each` over an empty list tests nothing (review session) | `e097ae6`: AGENTS.md "Testing" and the lint message now say filter first, assert the length, then each item. A loop with an `expect` asserts its list's length unless the list is a literal or a constant in the test. | None possible: lint cannot see whether a list is empty, so this is a rule for review. The audit below lists the loops that can run empty today. |
| R3 | `test/db/peer-assembly-time.test.ts` holds 1 s with little margin on CI (review session) | `32a01dd`: a `deferred-work.md` entry owned by Story 5.7, beside the `copyIn` entry | Not a code change. |

### Loops that could run over an empty list, and what each became

A subagent of this session audited the 298 loops with an `expect` over a non-literal list in `test/` and `e2e/`, and this session checked its findings:
- 201 loops run over a literal or a constant;
- 70 run over data, with a length guard before them or a check after them that fails when the list is empty;
- 27 had nothing pinning their length.

Meinich decided to fix all 27 in this PR (2026-11-27), so that the code keeps the rule `e097ae6` writes into AGENTS.md. All of them are fixed in `a9aa5db`.

| Loop (line at `32a01dd`) | Now |
|---|---|
| `e2e/search.spec.ts:304`, `test/db/search.test.ts:65` | `toEqual([])`: no stored name holds `%`, `_` or `\`, which the new test "holds no name with %, _ or a backslash…" asserts. A literal match therefore finds none, while an unescaped wildcard returns 8. The old `rows.length < 8` passed for an empty list, and the loop never ran. |
| `test/engine/reference-cases.test.ts:660` | `notRead` is tested per case only for the cases that have any, with `notRead.length > 0` asserted. A new test states the cases whose `notRead` is empty by design: `911561972 2024` (line 326) and `992036079 2023` (line 567). The audit found only the first. The expected table is unchanged. |
| `test/engine/reference-cases.test.ts:643` | The stated inputs are filtered first, then the check is exact: some for a document figure, none for an API figure, `stated.length > 0` against `actual.source === 'document'`. `checkDocument` also checks the API key figures, whose inputs are all API. |
| `e2e/synthetic-documents.spec.ts:689`, `test/analysis/waterfall-view.test.ts:182`, `test/engine/waterfall.test.ts:319`, `:404` | `toHaveLength(4)`: the four bars |
| `test/analysis/waterfall-view.test.ts:413` | `.not.toHaveLength(0)`: the number of leaves follows the view's shape |
| `test/analysis/key-figure-table.test.ts:1060` | `.not.toHaveLength(0)`: the chart's marks follow its drawing |
| `test/analysis/oversikt-view.test.ts:166`, `:167` | `toHaveLength(11)` for the table's peers, and `toHaveLength(10)` for the plotted peers with a margin, which are the fixture's |
| `test/analysis/peer-list.test.ts:144` | `toHaveLength(5)` |
| `test/analysis/peer-rows.test.ts:125` | `toHaveLength(3)` |
| `test/classify/key-boundary.test.ts:31` | The walk must reach `src/server/db.ts` |
| `test/db/peers.test.ts:252` | The pool is `toHaveLength(434)`, demo A's band-0 group in the seed, and the candidates are at least as many |
| `test/db/run-grants.test.ts:77`, `:88`, `:99`, `:109` | Each test reads `runRelations()`, which asserts that the list contains at least `run.step1` and `run.step2`. No test depends on a sibling, and a later migration's relation is still covered. |
| `test/db/seed.test.ts:512` | The exported files with an `orgnr` column `toEqual` the six seed files that have one |
| `test/db/set-role-passwords.test.ts:78`, `:164` | One password per role (4), and the other three |
| `test/engine/peers.test.ts:854` | `.not.toHaveLength(0)`: a candidate with no fingerprint is always kept, and the group's size follows the side's type |
| `test/engine/provenance.test.ts:71` | `.not.toHaveLength(0)`: each field derives from its own number of operands |
| `test/engine/document-absence.test.ts:280` | The three API figures, by name |
| `test/rate-limit.test.ts:142` | The two stores, `analysis` and `search` |

**Each list emptied, and the test fails.** Every change was restored with `git checkout` in `src/`, or from a copy for a test file.

| # | List emptied | Failing output |
|---|---|---|
| L1 | the case at line 376 gets `notRead: []` (`:660`) | "reads every printed line of 911561972 2024 and 992036079 2023…": `expected [ '911561972 2024', …(2) ] to deeply equal [ '911561972 2024', '992036079 2023' ]` |
| L2 | `displayWaterfall` returns `barKroner: []` | "1 000 seeded random cases…": `run 0: expected 0n to be -8n`. The sum identity before the length check fails first. |
| L3 | `peerRows` returns no row | "carries no match basis and no flag…": `expected [] to have a length of 3 but got +0` |
| L4 | `sources()` in key-boundary finds no file | "nothing in the request path names…": `expected [] to include 'src\server\db.ts'` |
| L5 | `relations()` in run-grants returns `[]` | all six run-grants tests fail, each on its own, the four loops among them |
| L6 | the LIKE escape of `%` is removed in `src/server/search.ts` | "matches % literally…" and "matches %% literally…": `expected [ { navn: '=SPORT AS', …(3) }, …(7) ] to deeply equal []` |

## Review Triage Log

| # | Source | Finding | Verdict | Action |
|---|---|---|---|---|
| 1 | Review of PR #90, `eslint.config.mjs:124` | An unawaited read stored and awaited later, `.then` on a read, and `Promise.all` lists pass lint | Confirmed here with `eslint --stdin` | Fixed, `d30a7b0` |
| 2 | Review of PR #90, `eslint.config.mjs:129` and `AGENTS.md:104` | A loop or a filtered list can be empty | Confirmed: 27 loops could run empty, and the not-read check did for two cases | Rule in AGENTS.md, `e097ae6`; all 27 fixed in `a9aa5db` (Meinich decided to fix them here), each list emptied and shown failing |
| 3 | Review of PR #90, review body | `peer-assembly-time` flaked once on CI at 1 084 ms | Confirmed in the run's log (attempt 1 failed, attempt 2 green, no code change) | Deferred to Story 5.7, `32a01dd` |
| 4 | Review of PR #90, `test/db/peers.test.ts:260`, `test/engine/waterfall.test.ts:396` | The rewrites are correct | Agreed | None |
| 5 | Review of PR #90, `docs/ai-sessions/2026-11-27-issue-89-test-assertions.md:10` | The session file does not say what came from the review session | Confirmed | This section and the one above |
| 6 | Review session, on `a9aa5db`, `test/engine/reference-cases.test.ts:647` | `expect(stated.length > 0).toBe(actual.source === 'document')` takes its expected value from the engine's own output: an engine that reports `api` for a document figure and reads no line passes | Confirmed: with `computeDocumentKeyFigures` giving kfd source `api` and no inputs, the test at `a9aa5db` passed all 12 kfd cases | Fixed in its own commit: `checkDocument` takes `source` from each call (document at the document figures' call, API at the API figures'), asserts `actual.source` against it, and checks the stated inputs against it. With the same change in the engine, it fails: `911561972 2024: expected 'api' to be 'document'` (4 failed, the kfd cases with a value). No expected value changes. |

No finding was rejected.

## Links

- Issue #89. Epic 3 retro row 8 and finding P6 in `_bmad-output/implementation-artifacts/epic-3-retro-2026-11-22.md`.
- Story 4.1 spec: `_bmad-output/implementation-artifacts/spec-4-1-explanations-generated-in-batch.md`, the Spec Change Log entry of 2026-11-27.
