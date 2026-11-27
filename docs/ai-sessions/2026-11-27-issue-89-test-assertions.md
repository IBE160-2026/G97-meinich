# Issue #89: tests assert unconditionally, e2e reads only through auto-waiting assertions

**Date:** 2026-11-27
**Tool:** Claude Code (claude-opus-5-5), in the Story 4.1 `bmad-build` session
**Story / issue:** #89, Epic 3 retro action 8 (moved out of Story 4.1, #88)
**Result:** branch `story/89-test-assertions` (not pushed)

## Goal

Epic 3 retro action 8: an e2e test reads a page value only through an auto-waiting assertion, never a snapshot, and no test has an `expect` inside a condition. Lint enforces it. Meinich moved it out of Story 4.1 into its own PR, merged before 4.1's code, so that the rewrites are reviewed on their own.

## Prompts that mattered

Meinich's answer to the Story 4.1 checkpoint (2026-11-27), point 3:

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

(Written as the work proceeds.)

## Links

- Issue #89. Epic 3 retro row 8 and finding P6 in `_bmad-output/implementation-artifacts/epic-3-retro-2026-11-22.md`.
- Story 4.1 spec: `_bmad-output/implementation-artifacts/spec-4-1-explanations-generated-in-batch.md`, the Spec Change Log entry of 2026-11-27.
