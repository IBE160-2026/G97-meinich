---
title: 'Story 3.6: EV/EBIT — what the uplift is worth'
type: 'feature'
created: '2026-11-19'
status: 'done'
baseline_commit: '17d06194aa16a58b9b31cdf476d15437532111fe'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-5-verdi-how-much-is-closable.md'
  - '{project-root}/docs/key-figures.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Verdi gives the profit uplift per year, but nothing turns it into enterprise value. The URL module already reads and writes `multippel`, but no field sets it and nothing uses it (FR-32, FR-55, issue #79).

**Approach:**
- A field "EV/EBIT-multippel" on Verdi. It is empty by default and suggests nothing.
- A card "Økt selskapsverdi" = round(exact profit uplift at the current share × m).
  - The value is computed in the browser by one engine function built on `profitAtShare`, from the 3.5 wire values. No new wire value is added.
  - It shows a product line, with "≈" by an exact rule.
- `multippel` is written through the one URL hook, by the same `replaceState` as `andel`.
- A branded type makes it a type error for any code path to produce a multiple.

**Decisions (proposed by the BMAD session at the checkpoint; approved by Meinich, 2026-11-19):**

1. **The engine function.**
   - Signature: `valueAtShare(full: Decimal, atMedian: Decimal | null, share: ClosableShare, multiple: Multiple): { readonly ore: Decimal }` in `src/engine/closable.ts`.
   - It returns `profitAtShare(full, atMedian, share).ore × multiple`, rounded once at display.
   - At the median step this is therefore (M − r) × revenue × m.
   - It is registered in `amounts.ts` under a new role, `'value'`: it calls `profitAtShare`, sums nothing, and reaches no capital function.
2. **The brand.** `Multiple` is a branded `Decimal`, a type in the engine.
   - It is minted only by `parseMultippel` in `src/url/analysis-state.ts`, with the one `as Multiple` in `src/`.
   - `AnalysisState.multippel` is `Multiple | null`, and `valueAtShare` accepts only a `Multiple`.
3. **"≈".**
   - **Inputs:** U = the profit uplift as displayed, in whole kroner (`wholeKroner` of the exact øre, the same rounding as `formatKronerExact`). V = round(exact uplift × m), in whole kroner.
   - **Rule:** "≈" exactly when the exact Decimal product U × m ≠ V.
   - It is decided by `productIsApproximate` in the engine, which returns a boolean, not an amount.
   - **Form (Meinich, Q1 B):** "≈" replaces "=": "1 000 kr × 7 ≈ 6 997 kr", never "≈ 1 000 kr × 7 = 6 997 kr".
   - "prefixed" is corrected in this PR in three places: EXPERIENCE:202, UX-DR28 and Story 3.6's acceptance criterion in `epics.md`. Each document's memlog gets a `(change)` line (epics has none, so the PR's "Planning documents:" line names it).
4. **URL.**
   - `replaceShare` becomes `replaceSettings({ andel?, multippel? })`, still the only `history.replaceState` in `src/`.
   - A valid value is written with a point. An empty or invalid field removes `multippel` from the URL.
   - An unchanged value writes nothing and announces nothing.
   - A share change and a peer change keep a valid multiple.
5. **The field.**
   - `type="text"`, `inputMode="decimal"`, 90 px, label "EV/EBIT-multippel".
   - Leading and trailing whitespace is trimmed (`trim()`), then the input goes to `parseMultippel` itself. Inner spaces are invalid.
   - After a valid commit the field shows `formatMultiple`: "6.50" → "6,5", "06" → "6". `formatMultiple` lies in `src/engine/format.ts` (:154), where it already exists; it is reused, not copied.
   - On load, its text is `formatMultiple(state.multippel)` or "", the same on server and client.
6. **Announcements** (one per commit, on Enter or blur, in a `role="status"` region that is empty from load):
   - valid: "Økt selskapsverdi: {v}.";
   - invalid: the error text;
   - cleared: the empty sentence.
   - A share change keeps 3.5's approved announcement alone.
7. **Disabled field** where the profit card has no amount (strength, below the floor, not NOK, own margin missing).
   - `aria-disabled="true"` and `readOnly`, still focusable, as the median step in 3.5.
   - `aria-describedby` points to the reason under the field.
   - **The reason (Meinich, Q4 A):** the profit card's own words for each reason, with no new copy: the strength sentence, "Ikke beregnet – for få sammenlignbare på driftsmargin", "Beløpet er ikke i kroner", and the driftsmargin row's words.
   - **A valid `multippel` in the URL (Meinich, Q3 A):** it stays in the URL and the disabled field shows it read-only (`formatMultiple`).
   - No value and no product line.
8. **Copy (Meinich).** E1 "{a} × {m} = {v}" and E3 "Økt driftsresultat per år ganger multippelen du har lagt inn." are approved; E3 stands under the product line. The "≈" form is E2 "{a} × {m} ≈ {v}" (decision 3).
9. **Confirmed (Meinich):**
   - `valueAtShare` with the role `'value'`, and the three NDC probes;
   - `replaceSettings` and `test/one-replace-state.test.ts`;
   - `trim()` before `parseMultippel`;
   - the type `Multiple` and `test/no-multiple-source.test.ts`;
   - the identity test extended with the 999,5 kr wire;
   - one spec, kept whole.

## Boundaries & Constraints

**Always:**
- **Money and rounding:** every kroner amount is rounded once, from the exact value.
- **Calculation:** the browser computes only through `src/engine`. There is no `Number()`, `parseFloat` or arithmetic on money or on the multiple in `src/components` or `src/app`.
- **Bounds:** they come from the URL module (`parseMultippel`, `MULTIPPEL_MAX`), never from a copy.
- **Copy:** approved copy enters `nb.json` and EXPERIENCE word for word, and `test/messages.test.ts` checks it verbatim.
- **Tests:**
  - Every I/O row names the test that fails when its guard is removed.
  - No test picks its expected value from the data with a condition. A fixture's state is asserted first.
  - A test that reads the page after a `replaceState` change waits for that change to render first, and every such read is searched, not only the failing one (PR #78).
- **Commits:** small, each type-checks. Check 375 and 320 px along the way.

**Never:**
- No default, placeholder value or suggested multiple, and no new wire value.
- No second URL writer, no `router.replace`, no new dependency, route or endpoint.
- Nothing per orgnr from the labelled set, and no test naming its companies.
- No `pnpm classify`, no dump deleted, no edit to `architecture/technology.md`, no upgrade.
- No push before Meinich says so.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Failing test |
|---|---|---|---|
| Empty | no `multippel` | empty field, no placeholder, the empty sentence, no value | `test/analysis/verdi-view.test.ts` "without a multiple the card reads the empty sentence"; `e2e/verdi.spec.ts` "EV: empty by default" |
| No source of a multiple | `src/` as built; probes | one `as Multiple` (in `parseMultippel`); `parseMultippel` called only by `parse` and the field, never on a literal | `test/no-multiple-source.test.ts` (compiler scan + probes); `test/types/wire-props.ts` `@ts-expect-error` on a plain Decimal |
| Valid | "6,5", " 6.5 ", "6.50", "06", "50", "0,1" | value; URL `multippel=6.5`; field "6,5" / "6" | `verdi-view.test.ts` "a valid multiple"; `e2e/verdi.spec.ts` "EV: a multiple replaces the URL, announces once" |
| Invalid | "0", "50,1", "6,55", "abc", "6 ,5", "-1" | error, `aria-invalid`, `aria-describedby`, no value, `multippel` removed | `e2e/verdi.spec.ts` "EV: invalid input" |
| Cancellation | 3.5's decision-2 fixture, m = 7, median | "6 997 kr", not "6 996 kr" (full × s_med × m) | `test/engine/closable.test.ts` "the value at the median is (M − r) × revenue × m, rounded once" |
| "≈" | profit 585 000 kr exact, m 6,5 → "="; profit 999,5 kr, m 7 → "1 000 kr × 7 ≈ 6 997 kr" | per decision 3 | `verdi-view.test.ts` "the product line is approximate only when U × m ≠ V" |
| Never summed | EV with every card | no displayed amount equals EV + another card, or EV + working capital | `verdi-view.test.ts` "no displayed total adds two cards" (extended); NDC "a value builds on the profit and sums nothing" (probes) |
| Rescale | share changed with a multiple set | EV rescales; URL keeps `multippel`; one announcement (the share's) | `e2e/verdi.spec.ts` "EV: a share change keeps the multiple" |
| Peer change | exclude with `multippel=6.5` | kept | `test/analysis/peer-change-href.test.ts` (existing :41) |
| Disabled | strength, below floor, not NOK, own missing | `aria-disabled`, focusable, its reason, no value; a URL multiple shown read-only | `verdi-view.test.ts` "the field is disabled with the profit card's reason"; `e2e/synthetic-currency.spec.ts` "EV disabled below the floor" |
| One writer | `src/` | exactly one `history.replaceState` | `test/one-replace-state.test.ts` |
| Reload | URL with `multippel` | same field and card, no hydration error | `e2e/verdi.spec.ts` "EV: a reload renders the same" |
| Identity | wires × shares × m ∈ {0,1; 6,5; 7; 50}, a "≈" case | byte-identical in Node and Chromium | `e2e/wire-identity.spec.ts` |
| Payload | Verdi with `?multippel=6.5` | exactly 3.5's wire set | `e2e/verdi.spec.ts` payload scan (second URL) |
| Phone | 375, 320 px | field 90 px, targets ≥ 24 × 24, no sideways scroll | `e2e/verdi.spec.ts` "phone" (extended) |

</frozen-after-approval>

## Code Map

- **`src/url/analysis-state.ts`**
  - `parseMultippel` (:115): returns `Multiple | null` and holds the one `as Multiple`.
  - `MULTIPPEL_MAX` and `MULTIPPEL_STEP` (:45).
  - `AnalysisState.multippel` (:58).
  - `serialize` (:277) already writes with a point.
- **`src/engine/closable.ts`**
  - Add `Multiple` (type only), `valueAtShare` and `productIsApproximate` beside `profitAtShare` (:150).
  - The cancellation fixture is at `test/engine/closable.test.ts:117`. Computed: m = 7 gives 6996,5 kr exact → "6 997 kr"; full × s_med × 7 = 6996,4999… → "6 996 kr".
- **`src/engine/format.ts`:** `formatMultiple` (:154) gives "6,5" and "6". Add `wholeKroner(ore)` beside `wholePercent` (:106), and a test that it agrees with `formatKronerExact` at halves.
- **`src/engine/amounts.ts`:** add the role `'value'`.
- **`test/engine/no-double-counting.test.ts`:**
  - `sumsInScales` (:271) is the pattern.
  - Add "a value builds on the profit and sums nothing". Its probes are a value adding `workingCapitalReleased`, a value calling `scaleAmount`, and a value computing full × s_med × m without `profitAtShare`.
- **`src/analysis/verdi-view.ts`**
  - `verdiCards(wire, share)` (:333) gets `multiple: Multiple | null` and returns an `ev` view: the field's disabled reason, the empty or error words, the value, the product line, and the announcement.
  - "No displayed total adds two cards" covers EV.
- **`src/components/analysis/analysis-url.tsx`:** `replaceShare` (:67) → `replaceSettings`. `withLiveSettings` already takes the live `multippel`.
- **`src/components/analysis/verdi-panel.tsx`:** add the EV section under the three cards. New `multiple-field.tsx` (`'use client'`), modelled on `search-field.tsx:398–476` (error inside `role="status"`, `aria-invalid`, `aria-describedby`).
- **Tests to update:**
  - Tests building a `Decimal` multiple use `parseMultippel` instead: `test/analysis/peer-change.test.ts:19`, `test/url/analysis-state.test.ts:392,403`, `test/analysis/oversikt-hero.test.ts`.
  - `e2e/wire-identity/entry.ts` and `fixtures.ts`: add multiples and the ≈ wire. `e2e/verdi.spec.ts`: the replaceState counter (:107) and the phone test (:269).
- **Do not change:** 3.5's wire set, the share announcement, Oversikt, and the Verdi payload scan's expected set.

## Tasks & Acceptance

**Execution:**
- [x] `src/engine/closable.ts`, `format.ts`, `amounts.ts`, `test/engine/closable.test.ts`, `format.test.ts`, NDC: decisions 1 and 3, with the role `'value'` and its probes.
- [x] `src/url/analysis-state.ts`, `test/no-multiple-source.test.ts`, `test/types/wire-props.ts`, and the tests listed in the Code Map: decision 2.
- [x] `src/analysis/verdi-view.ts`, `test/analysis/verdi-view.test.ts`: the `ev` view, decisions 3, 6 and 7.
- [x] `src/messages/nb.json`, `test/messages.test.ts`: the story copy and the approved new copy, verbatim.
- [x] `analysis-url.tsx`, `multiple-field.tsx`, `verdi-panel.tsx`, `test/one-replace-state.test.ts`: decisions 4 and 5.
- [x] `e2e/verdi.spec.ts`, `e2e/wire-identity.spec.ts` (+ entry, fixtures), `e2e/synthetic-currency.spec.ts`: the matrix's e2e rows at 1280, 375 and 320 px.
- [x] Planning documents:
  - EXPERIENCE:202 ("prefixed" corrected, decision 3), :240, :277 and a `(change)` line in the UX `.memlog.md`;
  - `epics.md`: UX-DR28 (:277) and Story 3.6's acceptance criterion, "prefixed" corrected (decision 3); epics.md has no memlog;
  - `docs/key-figures.md:164`, for the rounding and "≈";
  - the technical note :127, for `replaceSettings` and the brand;
  - AGENTS.md, for `replaceSettings`, `Multiple` and the role `'value'`;
  - `docs/ai-log.md`, for what can go wrong with a user-entered multiple applied to money;
  - the PRD only if FR-32's wording changes.

**Acceptance Criteria:**
- **Demo A, multiple entered:** given demo A at 50 %, when "6,5" is entered and Enter pressed, then the card shows round(exact profit at 50 % × 6,5), the product line, and `?multippel=6.5`, and one announcement.
- **Reload:** given the same URL, when it is reloaded, then the field reads "6,5" and the card is unchanged.
- **The PR:** it has "Planning documents:", names no new dependency, says what can go wrong with a user-entered multiple applied to money, and names what the review session contributed.

## Implementation Notes

- **Commit order.** The copy commit comes before the view commit, not after: `verdiCards` reads the `verdi.ev.*` keys through the typed `t`, so the view does not type-check without them. EXPERIENCE.md's Multiple field row gets its keys in the copy commit, as the copy rule asks.
- **Copy keys.** `verdi.ev.label`, `verdi.ev.kicker`, `verdi.ev.empty`, `verdi.ev.error`, `verdi.ev.announce`, and E1–E3 as `verdi.ev.product`, `verdi.ev.productApprox` and `verdi.ev.explanation`. No other new copy.
- **`productIsApproximate(upliftOre, valueOre, multiple)`** takes the exact uplift and the exact value the two amounts are rounded from, so the rule reads the value the page displays, not a second product.
- **"No displayed total adds two cards" runs EV at 6,7.** At 6,5 the fixture's EV at the median step (2 000 kr × 6,5 = 13 000 kr) equals profit + working capital at full convergence (10 000 + 3 000 kr) by chance, which the existing literal check reads as a sum.
- **The field's props.** `MultipleField` takes the `ev` view, the URL's current multiple, `onCommit` (the panel's `replaceSettings({ multippel })`) and `announcementFor` (the panel's `verdiCards(…).ev.announcement` at the current share), so the field computes nothing itself. An entry that leaves the field's state as it was (the same multiple, an empty field with none in the URL, a second invalid entry while the error shows) writes and announces nothing.
- **`announcementFor` throws** if a multiple on an enabled field gives no value; the field is enabled only where the profit card has an amount, so this is unreachable, and it is not a silent fallback.
- **The "Peer change" row (review P1, B5).** Its named test, `test/analysis/peer-change-href.test.ts` (:41), shows that the URL keeps `multippel`, but no 3.6 code can break it. The row is now also backed by `e2e/verdi.spec.ts` "EV: a peer change keeps the multiple, and Verdi shows it after": from `?multippel=6.5` on Peers, an exclusion keeps `multippel`, and Verdi, reached through its tab, shows the field reading "6,5" and a value.
- **No back-navigation test for the field's resync (review P2).** Through the UI, no back or forward step changes the multiple while the Verdi panel stays mounted. A multiple is only ever written on Verdi, by `history.replaceState`, which adds no history entry. Every pushed entry (a tab, a peer change) leaves Verdi, so the panel remounts with the URL's multiple. A test using a hand-made `history.pushState` would test Next.js's handling of foreign history entries, not the field. The resync's other half has a test that fails on the old field: `e2e/verdi.spec.ts` "EV: Enter and an immediate blur are one entry" (the last committed multiple kept in a ref). "EV: two different invalid entries announce twice, the same one twice announces once" (P3) also fails on the old field.

## Spec Change Log

- **2026-11-20, the error text (decided by Meinich; proposed by the review session, after Blind Hunter raised it in triage row B12).** "Skriv inn et tall større enn 0 og høyst 50, for eksempel 6 eller 6,5" becomes "Skriv inn et tall større enn 0 og høyst 50, med høyst én desimal". The old example named realistic multiples, which FR-32 forbids ("never … offers a range"), and did not say why 6,55 is refused. Changed in `src/messages/nb.json` (`verdi.ev.error`), `test/messages.test.ts`, `epics.md` (UX-DR28 and Story 3.6's acceptance criterion), EXPERIENCE.md, the epic context and this spec's Design Notes, with a `(change)` line in the UX memlog. B12's row stays as it was logged; this entry supersedes its route.

## Review Triage Log

Review 2026-11-19, three layers on the diff since `17d06194`: Blind Hunter (B), Edge Case Hunter (E), Verification Gap (VG); plus one note from the BMAD session's own reading of the diff (S). One row per finding; findings with one root cause share a route.

| # | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| VG1 | Entering or clearing a multiple is never tested from a URL that holds other settings | medium | Every field test starts with no `andel`, `band` or `ekskl`; a `replaceSettings` that reset them on a multiple write passes every test | patch P1 |
| VG2 | The field's recovery from an error is never run (invalid → valid, invalid → cleared, invalid with no URL multiple) | medium | "EV: invalid input" reloads before each case; dropping `!invalid` from the clear guard or `setInvalid(false)` fails no test | patch P1 |
| B4 | Same as VG2 | medium | Same | patch P1 |
| B3 | The accepted-forms loop never reads the announcements, so "an unchanged value announces nothing" is untested for " 6.5 " and "6.50" | medium | `announced(page)` is read only before the loop | patch P1 |
| B5 | The matrix's "Peer change" row names a test 3.6 code cannot break | medium | `peer-change-href.test.ts:41` passed before this story; nothing shows an exclude with `?multippel=6.5` keeps the field and value | patch P1 (with P2) |
| B9 | The "=" product line (E1) never renders in a real browser | low | Both e2e cases assert `approximate === true`; m = 1 always gives "=", so the fix is one more form in an existing loop | patch P1 |
| B1 | The field's text and error never resync with the URL's multiple | medium | `useState(ev.field)` only on mount; back to a pushed entry with another multiple, or a peer change that keeps the panel mounted, leaves the field showing a different multiple from the card | patch P2 |
| E4 | Same as B1 | medium | Same | patch P2 |
| B2 | Enter then an immediate blur can write and announce twice | low | `commit` compares with the `current` prop, which updates only after Next.js re-renders from `useSearchParams`; the same root as B1 (the field's committed value lives only in a prop) | patch P2 |
| E3 | A second, different invalid entry announces nothing | medium | `if (invalid) return;` before any announcement; decision 6 says each commit announces once, invalid included | patch P3 |
| E7, E8, B6, S1 | `test/no-multiple-source.test.ts` claims more than it checks: an aliased import, a literal through a `const`, `parse` on a literal URL, any helper in the field file, and `{ …, multippel: new Decimal(6) } as AnalysisState` all pass | medium | The scan is syntactic: it matches the identifier text and only `as Multiple` by name | patch P4 |
| E9, B7 | `test/one-replace-state.test.ts` misses a destructured `replaceState` and `router.replace` on a router not named `router` | medium | The scan matches property names and the receiver's text | patch P5 |
| E10 | The value check flags only `.plus`/`.add`; `Decimal.sum` passes | low | Adding `sum` is a direct one-word correction | patch P6 |
| B11 | The disabled field does not use DESIGN's disabled tokens, and DESIGN.md does not describe the EV section | low | DESIGN: `disabled-text` "disabled controls only"; the disabled median step is on `surface` in `disabled-text`; the field uses `border-divider text-slate` | patch P7 |
| E1, E11 | An invalid `multippel` loaded from the URL stays in the address bar when the field is cleared | low | Real, but the server already dropped it with the notice, the page shows no value, and any later share or multiple write writes the canonical URL; the fix compares against `window.location`, a second source | reject |
| E2 | Same as E1 | low | Same | reject |
| E12 | Same as E3 (a claim against decision 6) | medium | Same | patch P3 |
| E5 | The field's status region keeps its last sentence after a share change | low | It is not re-announced (a live region announces on change); only a user browsing the sr-only region meets it; the fix adds an effect | reject |
| E6, E13 | Decimal precision 40 rounds uplift × m before the display rounding | low | A tie flip needs a 40-digit product exactly at a half krone after truncation; the same holds for 3.5's `scaleAmount`; precision 40 is the project's documented setting | reject |
| B8 | `productIsApproximate` takes two amounts the caller must keep consistent | low | One caller, which passes `profitAtShare` and `valueAtShare` of the same inputs; the fix is a signature change | reject |
| B10 | No session file, empty triage log, ai-log "Review pending" | false | Not a defect of the diff: the triage is this table, and the session file, the ai-log update and the session log come in the present step, before the PR | reject |
| B12 | The error's "for eksempel 6 eller 6,5" reads as a suggested multiple, against FR-32 | low | The text is Story 3.6's acceptance criterion and EXPERIENCE's, verbatim, approved; changing it is Meinich's call, not a patch | reject (raised with Meinich at the checkpoint) |
| S2 | "No displayed total adds two cards" had to move from m = 6,5 to 6,7 | false | The check compares displayed numbers by design (Story 3.5); a chance equality at 6,5 is that design working, not a sum in the code | reject |
| S3 | The full chromium run after the review fixes (BMAD session, 2026-11-20): two EV tests read before the field's announcement, which comes 50 ms after the value renders. (a) The accepted-forms loop typed the next entry before the previous one's announcement, which cancelled it: "6" and "50" were never announced. (b) The reload test read the whole section, status region included, so `before` held the announcement or not depending on timing | medium | Both failed in the full run and passed in the fix run's spec-only run; the PR #78 pattern. A search of every read of `announced(page)`, `multiple-status` and `innerText()` in `e2e/verdi.spec.ts` and `e2e/synthetic-currency.spec.ts` found no other read after a change without a wait: the others wait for the status text or the error first, or are negative checks | patch: (a) wait for each changing entry's announcement in the loop; (b) wait for it, then compare the section without its status region (`571240e`) |

**Patched** by the implementation subagent, re-engaged: `df283ce` (P4, P5, P6), `eb694ae` (P2, P3, P7) and `8f51267` (P1); and by the BMAD session: `571240e` (S3).
- **P2, P3:** with the pre-fix field (`1a4505c`) rebuilt, "EV: Enter and an immediate blur are one entry" and "EV: two different invalid entries announce twice, the same one twice announces once" fail.
- **P4, P5, P6:** each bypass has a probe that the type-checked scan catches.
- **P2's back-navigation case** has no e2e test: through the UI no back or forward step changes the multiple while Verdi stays mounted (a multiple is written only by `replaceState`, which adds no entry, and every pushed entry leaves Verdi); see the Implementation Notes.

## Design Notes

**Copy from the story and EXPERIENCE, verbatim:**
- "EV/EBIT-multippel"
- "Økt selskapsverdi"
- "Verdi beregnes når du legger inn en multippel. Peerless foreslår ingen multippel."
- "Skriv inn et tall større enn 0 og høyst 50, med høyst én desimal"
- "Økt selskapsverdi: {v}."

**New copy (Meinich, 2026-11-19, decision 8):**
- E1: "{a} × {m} = {v}"
- E2: "{a} × {m} ≈ {v}"
- E3: "Økt driftsresultat per år ganger multippelen du har lagt inn." (under the product line)

{a} is the profit card's amount at the share, {m} is `formatMultiple`, and {v} is the value.

## Verification

**Commands:**
- `pnpm lint`, `pnpm typecheck`, `pnpm test`: clean.
- `pnpm seed`, `pnpm test:db`, `pnpm test:ingest`, then `pnpm restore:documents`: the four counts printed and confirmed.
- `pnpm build` (rerun once on `SecurityFatalError`, noted on #71) and `pnpm check:routes`: clean.
- E2e: one worker, one project at a time: `chromium`, `db-down`, then `synthetic --no-deps`. Afterwards there are 0 synthetic remains. If a run stops on memory, report it; do not restart it.

**The implementation report shows,** with each removal undone afterwards:
- for every matrix row, the guard removed and the failing output;
- "6 996 kr" for `valueAtShare` rebuilt as full × s_med × m;
- the ≈ test failing with the rule reversed;
- `wholeKroner`'s test failing when its rounding differs from `formatKronerExact` at half a krone;
- each of the three `'value'` NDC probes failing, one by one;
- `test/one-replace-state.test.ts` failing with a second `replaceState` call added in `src/`;
- the multiple-source scan failing on both probes: an `as Multiple` and `parseMultippel('6')`;
- the Playwright identity test failing when the multiple's formatting changes on one side only;
- every e2e read after a `replaceSettings` change waiting for the change to render first, with the list of such reads the search found (PR #78);
- the payload scan unchanged;
- the four counts after `pnpm restore:documents` (after the last seed), and zero synthetic companies and manifest entries;
- the field, its error and the card at 375 and 320 px.

**Commits** (Meinich): small, one logical step each, each type-checking, made as the work proceeds in the order of the Tasks: engine and tests; the brand and URL module; the view; copy; the URL hook, field and panel; e2e; planning documents. Never push. Run `pnpm test` before the first commit that touches `src/`.
