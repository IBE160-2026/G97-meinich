---
title: 'Story 3.1b: The full key-figure table'
type: 'feature'
created: '2026-11-15'
status: 'in-progress'
baseline_commit: '952a4f6ba3f1a238c4d6e0d53229dc8b75765fb5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/docs/key-figures.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Nøkkeltall og gap table shows only the three API figures (`FIGURES` in `src/components/analysis/api-figures.tsx`). Story 3.1a computes every other figure in the engine (`computeDocumentKeyFigures`, `benchmarkDocumentFigures`, `capitalGap`), but nothing in the request path calls them, so no document row, capital kroner amount or document absence reaches the page (FR-23, FR-24, FR-27, FR-29, FR-55, FR-56, FR-71; issue #68).

**Approach:** `shownGroup` also runs `benchmarkDocumentFigures` over the subject's and the group's document bases. The server-rendered table gets one row per figure, in the order of `docs/key-figures.md`, with each row's state taken from the engine's comparison and gap. Rows render only formatted strings and strip geometry, never raw øre. The phone table follows Story 1.8's pattern for every row.

**Decisions (Meinich, 2026-11-15):**

1. **Groups.** One `<tbody>` per `docs/key-figures.md` group, separated by a rule. Only the cost-share group has a heading (EXPERIENCE). No new group copy.
2. **Order.** 1, 2, then the cost-share group (3, 4, 5, and 6 as its check row), then 7, 8, 9, 10, 11, 12, 13, kontantandel, 14. This is `docs/key-figures.md` order.
3. **Popover.** A hand-written `'use client'` component: a real `button` "Mer om dette" with a visible ⓘ, `aria-expanded` and `aria-controls`. It toggles on tap, click, Enter and Space. Esc and a tap elsewhere close it, and it stays open while hovered. No new dependency.
4. **CI fixture.** A third committing e2e fixture in the Playwright project `synthetic`: one synthetic subject and 10 synthetic peers, each a 62.100 AS with a reconciled current document column for 2025. All are on the manifest's `document_figure_orgnrs` while the spec runs.
   - **Guards,** the same as the two existing fixtures: `localhost`/`127.0.0.1` only, written through `SUPABASE_DB_URL`, a name check before any delete, and removal before, after and in `e2e/global-setup.ts`.
   - **Revenue** lies outside demo A's and B's size bands at every step.
   - **The payload scan** asserts that no document øre of the subject or of any peer reaches the page.
   - **"Ekskluder"** on one peer shows below the floor, "For få sammenlignbare (9 av 10)".
   - **AGENTS.md** is updated: three tests commit rows.
5. **Copy** (approved verbatim; new keys, the subagent never rewords them):
   - **Caption:** `keyFigures.caption` "Nøkkeltall mot sammenlignbare selskaper".
   - **Midtre halvdel, days:** "Midtre halvdel: {lo}–{hi} dager" and "midtre halvdel {lo}–{hi} dager". The negative variants read "… {lo} til {hi} dager".
   - **Midtre halvdel, turnover:** "Midtre halvdel: {lo}–{hi}" and "midtre halvdel {lo}–{hi}". The negative variants read "… {lo} til {hi}".
   - **Denominator reasons:**
     - 9: "salgsinntekten er null eller negativ".
     - 10: "varekostnad og andre driftskostnader er til sammen null eller negative".
     - 11: "eiendelene utenom bankinnskudd er null eller negative".
     - 14: "fjorårets omsetning er null eller negativ".
   - **Kroner for 11 at T ≤ 0:** "Ingen kronebeløp: beste fjerdedel er ikke over null".
   - **Check-row subline (6):** "Kontroll av de tre andelene", in place of a direction.
   - **Verbatim from Story 3.1b or EXPERIENCE, given keys:**
     - the twelve `fig.*` labels of EXPERIENCE's table;
     - "Mer om dette";
     - the popover text (EXPERIENCE, "Figure not in the demo seed");
     - "Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen.";
     - "Se forklaring av marginen";
     - "engangsbeløp";
     - "Forklarer marginavviket – summeres ikke".
   - **EXPERIENCE** gets the new strings in the same commit as `nb.json`.
6. **Deferred work.**
   - **Taken in:** Story 2.9's "year's own current column" entry. A test is added and the entry is closed.
   - **Moved, with Story 3.7 named as owner:** Epic 1 retro D2 (the filing order) and Story 2.3 B9 (unguarded lines).
7. **Phone indent.** The cost-share rows are indented 30 px on desktop and 16 px on the phone, which leaves room for the label at 320 px.
8. **No sorting.** The table has no sort control and no `aria-sort`.

## Boundaries & Constraints

**Always:**
- **Engine untouched.** Values, comparisons and gaps come from the engine as Story 3.1a left it. Rounding happens once, in `src/engine/format.ts`.
- **Copy.** All copy comes from `nb.json`. New copy is Meinich's approved wording, copied verbatim. `test/messages.test.ts` has a "Story 3.1b" block asserting every new key verbatim. The subagent never rewrites approved text.
- **Payload.** Only `'use client'` modules receive strings or `StripMarks`. Raw øre, `Decimal`, `bigint` and `documentBasis` stay on the server (AD-4).
- **Data rules.** Document figures come only from allow-listed companies or committed synthetic test companies. Any measurement over the database prints totals only.
- **Phone.** Check 375 and 320 px during the build, not at the end.

**Never:**
- Classification, fingerprint or key figure per orgnr for the labelled set, or a test naming its companies.
- `pnpm classify`, deleting a dump, a migration, a change to an engine formula, a push before Meinich says so.
- A link on "Se forklaring av marginen" (Story 3.3).
- Sorting (no spec defines it).
- Peer dots in the strip.

## I/O & Edge-Case Matrix

"Fails if deleted" names the test that fails when the guard is removed; the implementation report shows the removal and the failure. KT = `test/analysis/key-figure-table.test.ts`.

| Scenario | Input / State | Expected | Fails if deleted |
|---|---|---|---|
| All rows, order | covered subject | 15 rows in `docs/key-figures.md` order, labels `fig.*` | KT "every key figure has a row, in key-figures order" |
| Cost-share group | 3–5 | own `<tbody>` led by `<th scope="rowgroup">` "Forklarer marginavviket – summeres ikke", indented; kroner "Se forklaring av marginen", not a link | KT "cost shares sit in their own row group and point to the margin explanation" |
| Check row 6 | defined | own, median, midtre halvdel; best, Plassering, kroner sr-only "ikke relevant"; strip unmirrored, no "Bedre" | KT "total cost share is a check row" |
| No direction | 8, 13, 14, kontantandel | own, median, "Midtre halvdel: x–y …", "Ingen retning", no best/Plassering/kroner | KT "no-direction rows: median and midtre halvdel only" |
| Kontantandel | — | no sort control, no `aria-sort`, no Plassering, no kroner text | KT "kontantandel is a diagnostic row" |
| Capital kroner | 9, 10, 11 worse than T, NOK | `formatKronerExact(amount)` + "engangsbeløp" | KT "capital kroner: one rounding, engangsbeløp" |
| Strength | r at or beyond T | "▲ Styrke", no amount | KT "at or beyond beste fjerdedel: strength, no amount" |
| not_nok / T ≤ 0 | USD / T = 0 on 11 | "Beløpet er ikke i kroner" / approved T ≤ 0 text | KT "capital kroner absent with its reason" |
| No translation | 2, 12 | "Ingen kronebeløp" | KT "no kroner translation: Ingen kronebeløp" |
| Below floor | own value, 9 from the same source | merged cell "For få sammenlignbare (9 av 10)", subline counts kept | KT "below the floor: no comparison, counts kept"; `e2e/synthetic-documents.spec.ts` "excluding one peer puts the document rows below the floor" |
| Undefined | each document `AbsenceReason` | "Kan ikke beregnes: {grunn}" with the figure's own denominator reason | KT "each undefined reason has its words" |
| Not read in v1 | 7, 8 | "Ikke lest i denne versjonen" + notes explanation | KT "figures 7 and 8 are not read in v1" |
| Failed own filing | SYNTHETIC (2.9) | each document row "Regnskapet for 2025 kunne ikke leses sikkert"; API rows compared | `e2e/failed-subject.spec.ts` "document rows say the filing could not be read" |
| Full document row | synthetic subject + 10 peers | every document row compared; values, median, best and kroner equal the engine's over the fixture | `e2e/synthetic-documents.spec.ts` "every document row is compared against the engine" |
| Not in dataset | subject off the manifest (demo A) | each document row "Ikke i demodataene" + "Mer om dette" popover; one State block; `aria-describedby` to it | KT "outside the demo data: one State block, cells point to it"; `e2e/key-figures.spec.ts` "outside the demo data: document rows withheld"; `test/analysis/info-popover.test.ts` "opens and closes on button, Esc and outside tap" |
| Phone | 375, 320 px | every row, including the row group, uses the three-column pattern with an expansion row; `scrollWidth ≤ innerWidth` | `e2e/key-figures.spec.ts` "phone: every row expands, no sideways scroll" |
| Payload | rendered page | no document field name, `cur_`/`pri_`, and no document line in øre of the subject or any peer | `e2e/synthetic-documents.spec.ts` "no document øre reaches the page" (through `e2e/payload.ts`); `test/analysis/key-figure-rows.test.ts` "row view holds only strings and strip marks" |
| Own column | document for Y absent, Y+1 present | basis for Y is never Y+1's prior column | `test/db/analysis.test.ts` "a prior column never stands in for its year" |

</frozen-after-approval>

## Code Map

- `src/engine/benchmark.ts` -- `benchmarkDocumentFigures(subject, peers, valuta)` and `capitalGap`, both from 3.1a. Read them, do not change them.
- `src/engine/document-absence.ts` -- `DOCUMENT_KEY_FIGURES`; 7 and 8 → `not_read_in_v1` / `notes`.
- `src/engine/document-key-figures.ts` -- `DOCUMENT_FIGURE_DIRECTIONS`, `DOCUMENT_FIGURE_RANKABLE` (:59).
- `src/analysis/shown-group.ts:77` -- calls only `benchmarkApiFigures`. Add the document benchmark over the group less `ekskl`, from `Subject.filing.documentBasis` / `Candidate.documentBasis` (`src/server/analysis.ts:136,277`).
- `src/analysis/absence-state.ts`, `src/analysis/figure-text.ts` -- the exhaustive reason → words map. Extend `AbsenceContext.denominator` for 9, 10, 11 and 14.
- `src/components/analysis/key-figure-table.tsx` -- desktop seven columns (:332–371), phone three (:373–393), `gapCell` (:92–105), merged `colSpan=5` cell with `headers` (:232–239). Generalise from `FIGURES` to every row.
- `src/components/analysis/api-figures.tsx:12–20` -- `FIGURES` (three); the full row list goes beside it.
- `src/components/analysis/phone-row-toggle.tsx` -- reuse as is. `state-block.tsx` -- the State block. `distribution-strip.tsx` -- `StripMarks` only.
- `src/components/analysis/kroner-amount.ts` -- `formatKronerExact`. Add the capital variant with "engangsbeløp".
- `src/messages/nb.json` -- `fig.*` (only 3 today), `keyFigures.*`, `analysis.figures.*`, `analysis.documentFailed` (`{aar}`).
- `test/analysis/key-figure-table.test.ts`, `test/messages.test.ts`, `test/no-hardcoded-copy.test.ts`.
- `e2e/key-figures.spec.ts`, `e2e/failed-subject.spec.ts`, `e2e/synthetic.ts` (`setSyntheticListed`), `e2e/payload.ts` (`SERVER_FIELDS`, øre scan for API figures only), `e2e/global-setup.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/analysis/shown-group.ts` + its test -- add the document benchmark beside the API one.
- [ ] `src/analysis/key-figure-rows.ts` + `test/analysis/key-figure-rows.test.ts` -- a pure view builder giving one row per figure (label key, state, formatted cells, strip marks), strings only -- one place for each state and the payload boundary.
- [ ] `src/analysis/absence-state.ts` -- per-figure denominator words.
- [ ] `src/messages/nb.json` + `test/messages.test.ts` -- the approved copy, verbatim.
- [ ] `src/components/analysis/key-figure-table.tsx`, `info-popover.tsx` -- every row, the row group, the State block and the popover (decision 3).
- [ ] `e2e/synthetic.ts`, `e2e/synthetic-documents.spec.ts`, `e2e/global-setup.ts`, `playwright.config.ts` -- the third fixture (decision 4), its full rows, below floor and payload scan.
- [ ] `e2e/payload.ts`, `e2e/key-figures.spec.ts`, `e2e/failed-subject.spec.ts` -- document field names and øre scan, phone, failed, outside the demo data.
- [ ] `test/db/analysis.test.ts` -- the year's own column (deferred entry, Story 2.9).
- [ ] `docs/ai-log.md`, `deferred-work.md` (decision 6), `AGENTS.md` (three committing tests), `EXPERIENCE.md` (decision 5) -- in the same commits as their code.

**Acceptance Criteria:**
- Given the PR, then it states what could go wrong with the payload and the kroner cells, with the reasoning in `docs/ai-log.md`, and has a "Planning documents:" line.
- Given a final `pnpm seed` → `pnpm restore:documents`, then the four counts are reported, and `pnpm lint`, `typecheck`, `test`, `test:db`, `test:ingest` and e2e (one worker) all pass.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**How to work:**
- Commit in small logical steps as you go, each one type-checking on its own (AGENTS.md, Git workflow): rows view and its tests, server wiring, copy, table and popover, the fixture and e2e, docs. No push.
- For each matrix row, the report shows the guard you removed and the failing test's output, then restores the guard.
- After the last `pnpm seed`, run `pnpm restore:documents` and report its four counts.
- Run the full suite before you finish, with e2e at `workers: 1`.

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- green.
- `pnpm seed && pnpm test:db && pnpm test:ingest` -- green.
- `pnpm restore:documents` -- four counts printed.
- `pnpm build && pnpm test:e2e` -- green, `workers: 1`.

**Manual checks:**
- The Nøkkeltall og gap tab at 1280, 375 and 320 px: no sideways body scroll; the row group, check row and capital cells are readable.
