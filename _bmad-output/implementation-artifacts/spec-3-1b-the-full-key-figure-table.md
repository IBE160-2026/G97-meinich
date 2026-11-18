---
title: 'Story 3.1b: The full key-figure table'
type: 'feature'
created: '2026-11-15'
status: 'done'
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
- [x] `src/analysis/shown-group.ts` + its test -- add the document benchmark beside the API one.
- [x] `src/analysis/key-figure-rows.ts` + `test/analysis/key-figure-rows.test.ts` -- a pure view builder giving one row per figure (label key, state, formatted cells, strip marks), strings only -- one place for each state and the payload boundary.
- [x] `src/analysis/absence-state.ts` -- per-figure denominator words.
- [x] `src/messages/nb.json` + `test/messages.test.ts` -- the approved copy, verbatim.
- [x] `src/components/analysis/key-figure-table.tsx`, `info-popover.tsx` -- every row, the row group, the State block and the popover (decision 3).
- [x] `e2e/synthetic.ts`, `e2e/synthetic-documents.spec.ts`, `e2e/global-setup.ts`, `playwright.config.ts` -- the third fixture (decision 4), its full rows, below floor and payload scan.
- [x] `e2e/payload.ts`, `e2e/key-figures.spec.ts`, `e2e/failed-subject.spec.ts` -- document field names and øre scan, phone, failed, outside the demo data.
- [x] `test/db/analysis.test.ts` -- the year's own column (deferred entry, Story 2.9).
- [x] `docs/ai-log.md`, `deferred-work.md` (decision 6), `AGENTS.md` (three committing tests), `EXPERIENCE.md` (decision 5) -- in the same commits as their code.

**Acceptance Criteria:**
- Given the PR, then it states what could go wrong with the payload and the kroner cells, with the reasoning in `docs/ai-log.md`, and has a "Planning documents:" line.
- Given a final `pnpm seed` → `pnpm restore:documents`, then the four counts are reported, and `pnpm lint`, `typecheck`, `test`, `test:db`, `test:ingest` and e2e (one worker) all pass.

## Implementation Notes

- **The view.** `src/analysis/key-figure-rows.ts` holds the row order, the groups (`KEY_FIGURE_GROUPS`), each figure's unit, role and denominator words (`KEY_FIGURE_ROWS`), and `keyFigureTableView`. The table only renders it. `DIRECTION_WORDS` and `StripMarks` moved there; `api-figures.tsx` and `distribution-strip.tsx` re-export them.
- **7 and 8.** `AbsenceContext.denominator` is `MessageId | null`. It is null for 7 and 8, and a not-positive cause with null throws. The engine makes both `not_read_in_v1` on every basis, so outside the demo data and for a failed filing they read "Ikke lest i denne versjonen", not the basis's words.
- **Cost-share group.** All four rows of the group are indented, 6 included.
- **Non-small notice.** It now also counts document rows below the floor, not only the API rows. It has its own `data-testid="non-small-notice"`, so it can be told apart from the outside-the-demo-data State block.
- **Days copy.** The days midtre halvdel messages have U+00A0 before "dager", as `formatDays` and the percent ranges do. The spec's markdown shows a plain space; the words are unchanged. `formatDaysNumber` writes the bounds.
- **Phone columns.** At 320 px a nine-digit capital amount overflowed the gap column, and "engangsbeløp" broke across lines. The columns are now 34 % / 26 % / 40 %, with 8 px right padding on the own cell. Labels hyphenate more at 320 px, and "Ikke i demodataene" breaks inside the word in the 26 % column.
- **Popover.** The text opens in the flow of its cell, not floating, so the table's scroll container cannot clip it. The rule is the pure `nextOpen`: there is no DOM test environment and no new dependency. `test/analysis/info-popover.test.ts` covers the rule and the markup, and `e2e/key-figures.spec.ts` "outside the demo data: document rows withheld" drives click, Enter, Space, Esc, hover and an outside click.
- **Fixture.** The revenues are 1,1–2,0 milliard kr: below the subject's widest band there is no gap free of listed reference companies, and above it lie demo A's and B's bands. The insert refuses when a listed company lies in the subject's widest band.

## Spec Change Log

- **2026-11-18, Meinich: the space before "dager" in decision 5 is a no-break space (U+00A0).**
  - Decision 5 approved the days copy "Midtre halvdel: {lo}–{hi} dager" and its variants verbatim, written with a plain space.
  - The code writes U+00A0 before "dager", as `formatDays` and the percent ranges already do before their units.
  - This was found by the BMAD session's review triage (row 5) and decided by Meinich, who approved the no-break space as for the other units.
  - The words are unchanged. `nb.json`, EXPERIENCE.md and the verbatim test in `test/messages.test.ts` already hold U+00A0, so no code changes.

## Review Triage Log

Review pass 1 (2026-11-15): Blind Hunter (BH), Edge Case Hunter (ECH) and Verification Gap (VG), all run by the BMAD session; two findings (S) from the BMAD session's own diff check.

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | VG, BH | The non-small notice now counts document rows below the floor, and no test pins it. | medium | Every notice test renders the document benchmark as `OUTSIDE` (all `subject_absent`). The synthetic below-floor e2e has `smaa_foretak` false but asserts nothing about the notice. | patch |
| 2 | VG | No test picks the negative midtre halvdel wording for days or turnover. | low | `middleHalfText` is tested with `percent` only. The 3.1b tests assert the positive forms. | patch |
| 3 | BH | `src/analysis/key-figure-rows.ts` imports from `src/components/analysis/kroner-amount.ts`, so the view depends on the UI folder. | low | This is the only import from `src/components` in `src/analysis`. The two identical function bodies are intended, one per kind. | patch (move the module to `src/analysis`) |
| 4 | BH | Two re-export shims are dead or nearly so. | low | Nothing imports `StripMarks` from `distribution-strip.tsx`. `DIRECTION_WORDS` is re-exported from `api-figures.tsx` only for `oversikt-hero.tsx`. | patch |
| 5 | BH | Deviations from the frozen spec sit in Implementation Notes, not in the Spec Change Log. | low | Indenting row 6 and the phone column widths do not contradict the frozen block (decision 2 puts 6 in the group). The U+00A0 before "dager" deviates from decision 5's verbatim copy. Fixing this means editing this spec, so it went to Meinich, who approved U+00A0 on 2026-11-18 (Spec Change Log). | reject (human) |
| 6 | BH | New throw guards (`causeMessage` null, `middleHalfText` kroner, `profitCell`/`capitalCell` none) can 500 the page. | false | No state reaches them. A compared figure always has a gap (`driftsmarginGap` returns none only when not compared or `best` is null, `src/engine/benchmark.ts:47`; capital none is `no_comparison`, `target_not_positive` or `no_translation`, :134, :165, :227). 7 and 8 are `not_read_in_v1` first, so they are never compared or not-positive. | reject |
| 7 | ECH | `middleHalfText` throws for a compared figure 7. | false | As 6: 7 and 8 are absent on every basis in v1 (`document-absence.ts`). | reject |
| 8 | ECH | `profitCell`/`capitalCell` throw when the engine returns none for a compared figure. | false | As 6. | reject |
| 9 | BH | The fixture's band guard hard-codes 1/4–4× instead of reading `SIZE_BANDS`. | low | If the widest band changes, the guard checks the wrong range and a listed company can join the comparison. | patch |
| 10 | BH | In the AI log, item 5 names no test, and item 1's single-word-key limit has no follow-up. | low | AGENTS.md: every claim names its test. Item 5's guards are code only. | patch (docs) |
| 11 | BH | The closure of Story 2.9's deferred entry reverses its rule (a prior column as fallback) and names no decision. | medium | The entry allowed a prior column when the year has no document. The closure says never. The rule actually in force is AD-15 "Basis, in order" (Story 2.9: no document row → document missing), which the closure does not cite. | patch (docs) |
| 12 | BH | Story 3.7 in `epics.md` does not name the two deferred items moved to it. | low | AGENTS.md: a decision travels upstream in the PR that makes it. | patch (docs) |
| 13 | BH | EXPERIENCE still says the cost-share cell jumps to the waterfall. | low | The code shows plain text until Story 3.3, and the epics AC says so. EXPERIENCE does not. | patch (docs) |
| 14 | BH, ECH | The popover's Esc handler on `document` moves focus to the button from anywhere, and every open popover reacts. Hover-away is not tested. | low | `onKey` focuses the button whatever holds focus. With two popovers open, the last listener wins. The e2e test hovers only the text. | patch |
| 15 | ECH | A tab-away does not close the popover. | false | EXPERIENCE "Info button" names Esc and tapping elsewhere as the closers, and says it stays open while hovered. Tab-away is not one of them. | reject |
| 16 | BH | The failed-filing document-row e2e test skips 320 px. | low | The file's other tests loop over 1280, 375 and 320, and 320 is where the columns changed. | patch |
| 17 | BH | `box.height < 30` in the phone check is tied to the font size. | low | The check passes and catches the overflow it was written for. A computed line-height adds complexity for no shown harm. | reject |
| 18 | ECH | A capital gap under 0.5 kr shows "0 kr engangsbeløp". | low | Needs a subject within a fraction of a krone of T, which is rare. A fix needs new copy and a branch. | reject |
| 19 | ECH | A merged cell's explicit `headers` omits the row-group heading in the cost-share group. | low | `headers` overrides scope association, so screen readers do not announce the group for merged cost-share cells. | patch |
| 20 | ECH | The fixture's `brregId = orgnr` can clash with a seeded filing and give a raw unique violation. | low | No 9999980xx brreg id exists. A clash would fail loudly. | reject |
| 21 | ECH | The øre scan skips document amounts under 6 digits. | low | This is the same threshold as the API scan, documented in `e2e/payload.ts`: short digit runs occur in ordinary page text. | reject |
| 22 | ECH | Quartiles rounding to the same day show "33–33 dager". | low | The text is accurate and cosmetic. | reject |
| 23 | S | `test/analysis/info-popover.test.ts` tests `nextOpen` only, so removing the component's listeners would not fail it. | low | `e2e/key-figures.spec.ts` "outside the demo data: document rows withheld" drives Esc, an outside click and focus return, and fails on that removal. | reject |
| 24 | S | At 320 px "Ikke i demodataene" breaks inside the word in the own column. | low | `break-words` splits mid-word. Norwegian hyphenation (`hyphens-auto` under `lang="nb"`) breaks at a syllable instead. | patch |

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
