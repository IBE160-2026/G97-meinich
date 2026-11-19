---
title: 'Story 3.5: Verdi — how much is closable'
type: 'feature'
created: '2026-11-19'
status: 'in-progress'
baseline_commit: 'bdcb4834eecbd90b32479a81575176d516e813ab'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/docs/key-figures.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/technical-note-architecture.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The analysis shows every gap only at full convergence to beste fjerdedel. Nothing lets the user say how much of a gap the company can realistically close, or see what that share is worth. `verdi` falls back to Oversikt with the notice, and `andel=median` always falls back to 50 % (FR-31, FR-62, issue #77).

**Approach:**
- Open the fourth tab, Verdi: a closable-share `radiogroup` and three amount cards that are never summed.
- The server computes the full-convergence amounts and the exact s_med. They cross to the browser through a new codec, `src/engine/wire.ts`, as `WireDecimal` strings.
- The browser scales them with the same `src/engine` function the server uses, and writes `andel` with `history.replaceState` through one URL hook. Every later link and navigation keeps `andel` and `multippel`.
- The server's real `medianStepExists` replaces the `() => false` stub, and the peer-change provider uses it (Epic 2 retro B6).

**Decisions (Meinich, 2026-11-19):**

1. **Working capital with a strength** (`deferred-work.md:235`).
   - **A strength counts as 0.** The total exists when both (9) and (10) clear the floor and the filing is in NOK.
   - **One part a strength:** the total is the other part's amount. The strength part shows on its own line as "▲ Styrke".
   - **Both parts strengths:** the card is a strength, with no kroner.
   - `workingCapitalReleased` changes to this rule. Oversikt's "Største kapitalgap" then names the total ("Arbeidskapital (…)") where 3.4 named the part; the amount is unchanged.
   - Tests changed with it: NDC "cluster 2 …", and `test/engine/oversikt-cards.test.ts` :55, :65 and :183. `docs/key-figures.md:166` and AGENTS.md say the new rule.
2. **s_med is a `Decimal`,** computed in `src/engine/closable.ts` from the `Comparison`.
   - **The profit at the median step is (M − r) × sumDriftsinntekter, never full × s_med.** (T − r) cancels exactly, so the amount carries no division. It crosses the wire as its own value, `profitAtMedian`.
   - **The guard test:** at 40 digits the two can round to different kroner.
     - Revenue 1 000 000 kr, driftsresultat −49 000 kr, M −0,0480005, T −0,04798593.
     - Exact (M − r) × revenue = 999,50 kr, which rounds to 1 000 kr.
     - full × s_med = 999,4999… kr, which rounds to 999 kr. Found by searching (BMAD session, 2026-11-19).
     - `test/engine/closable.test.ts` "at the median the profit is (M − r) × revenue, rounded once" expects "1 000 kr" and must fail when `profitAtMedian` is replaced by full × s_med.
   - **The EXPERIENCE:371 test is kept:** "212 807 kr av 1 752 531 kr per år", different from the amount at the rounded 12 %.
   - **Capital cards at the median step:** full × s_med; nothing cancels there.
3. **The median step.**
   - **Order:** sorted by exact s_med. When s_med equals a fixed step, it stands right after that step.
   - **Label:** "(n %)", with n the whole percent of exact s_med. Where n rounds to 0 the label is N1 "(under 1 %)"; where it rounds to 100, N2 "(over 99 %)".
   - **Disabled, still focusable, with `aria-describedby` naming the reason:**

     | Case | Reason |
     |---|---|
     | r > M, a strength included | the story's "{Selskap} ligger allerede over medianen. Medianen gjelder driftsmargin." |
     | r = M | N3 |
     | M = T | N4 |
     | Below the floor | N5 |
     | The subject's own driftsmargin is missing | the same words as the driftsmargin row in the table |

   - **Outside NOK:** the step follows r < M < T as in NOK; the cards read "Beløpet er ikke i kroner".
4. **Median lines on the cards.** Each card's median line is for its own figure.
   - **"Median nås ved x %":** x is the whole percent of that figure's own exact s_med. N9 and N10 apply at 0 and 100.
   - **When the figure is at or beyond its median:** the profit card reads the story's "Median: allerede over". The capital lines read N12 "Median: allerede nådd", because "over" reads wrongly for kundefordringsdager, where low is good.
   - **Working capital:** one median line per part.
   - **No median line:** a strength card, or a card without a target.
   - EXPERIENCE:238 is corrected to this rule.
5. **The wire set.** All `WireDecimal`s, all the subject's own values:
   - `profitFull` and `profitAtMedian`;
   - `sMed`, or null;
   - `kfd`, `lgd`, `wcTotal` and `oml` at full convergence, or null.

   The cards' own median percents cross as finished strings.
   - **The payload scan:** Verdi's HTML and RSC hold exactly these values, as long decimal strings or integers of 6 or more digits, plus `expectNoPeerFields` with the pool and the exact peer margins. The Oversikt scan is unchanged.
   - **What can be derived:** `docs/ai-log.md` and the PR say that T can be derived from `profitFull` (AD-6), and M from `sMed`. M can be one peer's exact margin when the group's count is odd. The figures are public accounts data.
6. **The URL hook.**
   - **`useAnalysisUrl()`** lives in `src/components/analysis/analysis-url.tsx`, with `AnalysisUrlProvider` holding the server's `medianStep`.
     - `replaceShare(andel)` is the only `history.replaceState` in `src/`.
     - `hrefFor(change)` builds links.
   - **`AnalysisLink`** is used by the tabs, "· Endre i Verdi" ×3, "Se alle {n}", "og {n} til", the hero's "Se alle nøkkeltall", and the Peers band and reset hrefs.
   - **The peer-change provider keeps its base from `inFlight` or `lastGood`** for `ekskl` and `band`. That is the URL the server parsed, so an `ekskl` item the server rejected never returns (AD-6, Story 2.8). Only `andel` and `multippel` come from the live URL. The base is parsed with the server's `medianStep`.
   - **Tests:** the existing rejected-`ekskl` tests stay green. The B6 test is added.
7. **The identity test** uses Playwright and a `vite` bundle, with no new dependency, in the `chromium` project and with no route. The technical note's :322 is corrected in this PR.
8. **Copy N1–N12** is approved as shown at the checkpoint, N12 included (Design Notes).

## Boundaries & Constraints

**Always:**
- The target is beste fjerdedel at every step; s only scales the gap (`docs/key-figures.md:154`).
- Every kroner amount is rounded once, at display, from the exact value (`formatKronerExact`), never from another rounded amount.
- The browser computes only through `src/engine`. There is no `Number()`, `parseFloat` or arithmetic on money or a ratio in `src/components` or `src/app`, and a client prop holding money or a ratio is a `WireDecimal`, never a `number`.
- Every new engine function that returns an amount is registered in `src/engine/amounts.ts` and passes `test/engine/no-double-counting.test.ts`.
- Oversikt, the hero, the table and the Oversikt cards stay at full convergence whatever `andel` is.
- Approved copy enters `nb.json` and EXPERIENCE word for word, and `test/messages.test.ts` checks it verbatim. The implementation never rewrites it.
- Every I/O matrix row names the test that fails when its guard is removed. No test picks its expected value from the data with a condition; a test asserts the fixture's state first.
- Small commits, each of which type-checks. Check 375 and 320 px along the way.

**Never:**
- No EV/EBIT field, value or placeholder (Story 3.6), and no explanation text (Epic 4).
- No `router.replace` for `andel`, and no second place that writes the URL.
- No new dependency, route, page or API endpoint (`pnpm check:routes`).
- Nothing per orgnr from the labelled set, and no test naming its companies.
- No `pnpm classify`, no dump deleted, no edit to `architecture/technology.md`, and no Next.js upgrade.
- No push before Meinich says so.

## I/O & Edge-Case Matrix

Each row ends with the test that must fail when its guard is removed. The implementation report shows the removal and the failing output.

| Scenario | Input / State | Expected | Failing test |
|---|---|---|---|
| Median step exists | r < M < T on driftsmargin | enabled, "(n %)", in its ordered place, after an equal fixed step | `test/engine/closable.test.ts` "the median step exists only where r < M < T"; "the step stands after an equal fixed step" |
| Label at the ends | s_med rounds to 0 or 100 | N1, N2 | `closable.test.ts` "under 1 % and over 99 %" |
| Median step disabled | r > M; r = M; M = T; below floor; own margin missing | `aria-disabled`, focusable, reason per decision 3 | `closable.test.ts` "each disabled case gives its reason"; `test/analysis/verdi-view.test.ts` "the disabled step is described by its reason" |
| Exact s | EXPERIENCE:371 fixture | "212 807 kr av 1 752 531 kr per år", not the amount at 12 % | `closable.test.ts` "the median step uses the exact s, not the rounded n" |
| Cancellation | decision 2's fixture | "1 000 kr", not "999 kr" | `closable.test.ts` "at the median the profit is (M − r) × revenue, rounded once" |
| Fixed steps | s ∈ {0, 25, 50, 75, 100} | full × s / 100, rounded once; 0 gives "0 kr" | `closable.test.ts` "a fixed step scales the full amount" |
| Working capital | each pair of (9), (10) states | decision 1 | NDC "cluster 2 …" (changed); `verdi-view.test.ts` "working capital lines and total" |
| Never summed | three cards with amounts | no displayed total equals the sum of any two or three cards | `verdi-view.test.ts` "no displayed total adds two cards"; NDC "a scale sums nothing" (with a probe) |
| Median lines | figure below, at, beyond its median | "Median nås ved x %"; "allerede over" (profit) / N12 (capital) | `verdi-view.test.ts` "each card's median line is its own figure's" |
| Profit strength | r ≥ T | the story's strength sentence, no kroner, step disabled | `verdi-view.test.ts` "a strength reads the story's sentence" |
| No target | below floor | "Ikke beregnet – for få sammenlignbare på {figur}" | `verdi-view.test.ts` "a card without a target" |
| Basis not read | demo A/B on 9–11 | the basis words, as on the rows | `verdi-view.test.ts` "an unread basis names itself" |
| Not NOK | `valuta` ≠ NOK | "Beløpet er ikke i kroner" per card; step by r < M < T | `verdi-view.test.ts` "not NOK" |
| Wire | 40-digit, negative, zero | `fromWire(toWire(d))` equals d; a malformed string throws | `test/engine/wire.test.ts` |
| Wire type | `number` or plain `string` as a wire prop | typecheck fails | `test/types/wire-props.ts` (`@ts-expect-error`, `pnpm typecheck`) |
| Identity | the same wire values × every share | byte-identical texts in Node and Chromium | `e2e/wire-identity.spec.ts` |
| URL write | a step chosen | one `replaceState`, `andel` in the URL, history length unchanged, focus on the step, one announcement | `e2e/verdi.spec.ts` "a share change replaces the URL and keeps focus" |
| Links | a tab change after a share change | `andel` and `multippel` kept | `e2e/verdi.spec.ts` "a tab change after a share change keeps both" |
| B6 | `andel=median`, exclude/restore/band | the new URL keeps `andel=median`; a rejected `ekskl` stays gone | `test/analysis/peer-change-href.test.ts` "keeps andel=median"; the existing rejected-`ekskl` tests |
| Server stub replaced | `andel=median` where the step exists | kept, no notice | `test/analysis/view.test.ts` "urlContext resolves the median step" |
| Top note | table, hero, capital card | "· Endre i Verdi" links to Verdi | `e2e/verdi.spec.ts` "Endre i Verdi everywhere the top note is" |
| Payload | Verdi on the synthetic subject | exactly the wire set | `e2e/verdi.spec.ts` payload scan |
| Phone | 375 and 320 px | control 3 × 2, cards stacked, targets ≥ 24 × 24, no sideways scroll, four tabs wrap | `e2e/verdi.spec.ts` "phone"; `e2e/analysis-states.spec.ts` tabs |

</frozen-after-approval>

## Code Map

- `src/engine/benchmark.ts`:
  - `driftsmarginGap` (:66) gives `(T − r) × revenue` unrounded.
  - `capitalGap` (:197) gives (9), (10) and (11) at s = 1.
  - `workingCapitalReleased` (:239) changes per decision 1.
  - `largestCapitalGap` (:270) calls it; keep its order and tie rule.
- `src/engine/amounts.ts`: the registry. Add the role `'scale'`.
- `test/engine/no-double-counting.test.ts`: finds amount functions by an `ore`/`kroner` property in the return type. `sumsInChoices` (:227) is the pattern for "a scale sums nothing".
- `src/engine/format.ts`: `formatKronerExact` (:67) rounds once; `wholePercent` (:106) and `formatWholePercent` give the whole percents.
- `src/engine/decimal.ts`: `toString()` never uses exponent notation; it is the wire string.
- `src/engine/statistics.ts`: `compareFigure` gives `subject`, `median` and `best.quartile` as Decimal. `MIN_PEERS` (10) is in `types.ts:110`.
- `src/url/analysis-state.ts`: `verdi` is already a `Fane`. `ParseContext.medianStepExists` (:85) is called only for `andel=median`.
- `src/analysis/view.ts`:
  - `OPEN_FANER` (:68) gets `verdi`; drop the fallback at :202.
  - `urlContext` (:57) gets the real predicate.
  - `PATH_CONTEXT` (:44) stays for path-only parses.
- `src/components/analysis/analysis-page.tsx`: the second parse (:113); the panel per fane (:215–:230); `PeerChangeCommit` (:203) also carries `medianStep`.
- `src/components/analysis/peer-change.tsx`: the base (:102) and the parse with `PATH_CONTEXT` (:103) change per decision 6. Extract the pure `peerChangeHref` into `src/analysis/peer-change.ts`.
- Server-built links that become `AnalysisLink`:
  - `tab-links.tsx:21`;
  - `oversikt.tsx:227,238`;
  - `oversikt-hero.tsx:176`;
  - `small-card.tsx:64`;
  - `peer-list.tsx:249,265,335` (`PeerChangeLink` href).
- The top note (`keyFigures.topNote`): `key-figure-table.tsx:370`, `oversikt-hero.tsx:164`, `oversikt-cards.ts:83`.
- `src/components/analysis/size-band.tsx:60–73`: the radiogroup pattern. `peer-change.tsx:170` is the `role="status"` pattern.
- `src/messages/index.ts`: `t` is client-safe (it imports only `nb.json`).
- `e2e/payload.ts`: `expectNoPeerFields` (:114, `exact`). `e2e/synthetic.ts:357` and `e2e/synthetic-documents.spec.ts` give the subject with amounts on 9, 10 and 11. The Oversikt capital oracle (:209) is unchanged: all three are amounts.
- `e2e/analysis-states.spec.ts`: :59 expects three tab links (now four); :105 expects `verdi` to fall back (now it renders).
- Do not change: Oversikt's full-convergence output, and the Oversikt payload scan.

## Tasks & Acceptance

**Execution** (one commit per step or two; each type-checks):
- [ ] `src/engine/benchmark.ts`, `test/engine/no-double-counting.test.ts`, `test/engine/oversikt-cards.test.ts`, `docs/key-figures.md`, AGENTS.md -- decision 1 -- the deferred entry; close it in `deferred-work.md`.
- [ ] `src/engine/closable.ts`, `src/engine/amounts.ts`, `test/engine/closable.test.ts`, NDC -- `medianStep(comparison)` (exists with exact s_med, or a reason), `profitAtMedian`, `scaleAmount(full, share, sMed)`, `profitAtShare`, the role `'scale'` with "a scale sums nothing" -- decisions 2 and 3.
- [ ] `src/engine/wire.ts`, `test/engine/wire.test.ts`, `test/types/wire-props.ts` -- `WireDecimal` (branded), `toWire`, `fromWire`; strict grammar, malformed throws -- AD-6.
- [ ] `src/analysis/view.ts`, `test/analysis/view.test.ts` -- `verdi` open, the real `medianStepExists`.
- [ ] `src/analysis/verdi-view.ts`, `test/analysis/verdi-view.test.ts` -- `verdiWire(...)` (server) and `verdiCards(wire, andel)` (server and browser): every card, line, median line, step label, reason and announcement as strings.
- [ ] `src/messages/nb.json`, `test/messages.test.ts` -- the story copy and N1–N12 verbatim, plus `tabs.verdi` "Verdi" and "Endre i Verdi".
- [ ] `src/components/analysis/analysis-url.tsx`, `analysis-link.tsx`, the links in the Code Map, `peer-change.tsx`, `src/analysis/peer-change.ts`, `test/analysis/peer-change-href.test.ts` -- decision 6.
- [ ] `src/components/analysis/verdi-panel.tsx` (`'use client'`), `closable-share.tsx`, `analysis-page.tsx`, `tab-links.tsx`, the top note in its three places -- the Verdi tab and "· Endre i Verdi".
- [ ] `e2e/verdi.spec.ts`, `e2e/wire-identity.spec.ts`, `e2e/analysis-states.spec.ts`, `e2e/peer-adjust.spec.ts`, `e2e/synthetic-documents.spec.ts` (Verdi on the synthetic subject) -- the matrix's e2e rows, at 1280, 375 and 320 px.
- [ ] EXPERIENCE.md (:238, the new copy), its `.memlog.md`, the technical note :322, `docs/ai-log.md` (what can go wrong with in-browser scaling and the wire, decision 5's derivations), the PRD if FR-31's wording changes -- the planning documents.

**Acceptance Criteria:**
- Given demo A or B, when Verdi renders:
  - the median step is enabled with its whole percent;
  - the profit card shows "{a} av {full} per år" at 50 %;
  - both capital cards show "Ikke i demodataene";
  - the working-capital card reads "Ingen sum – én del mangler grunnlag" only where one part has an amount.
- Given a share change on Verdi, when the user goes to Oversikt, then Oversikt, the hero, the table and the Oversikt cards are unchanged at full convergence, and the URL keeps `andel`.
- Given the PR, then it has the line "Planning documents:", names no new dependency, and states what can go wrong with in-browser scaling and the wire codec.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

**New copy (Meinich, 2026-11-19).** Ids are the implementation's choice; the texts are fixed.

| | Text |
|---|---|
| N1 | Til medianen for driftsmargin (under 1 %) |
| N2 | Til medianen for driftsmargin (over 99 %) |
| N3 | {selskap} ligger på medianen. Medianen gjelder driftsmargin. |
| N4 | Medianen er lik beste fjerdedel, så til medianen er det samme som 100 %. Medianen gjelder driftsmargin. |
| N5 | Ingen median – for få sammenlignbare på driftsmargin. Medianen gjelder driftsmargin. |
| N6 | ved {andel} av gapet |
| N7 | engangsbeløp, ved {andel} av gapet |
| N8 | {figur}: {verdi} |
| N9 | Median nås ved under 1 % |
| N10 | Median nås ved over 99 % |
| N11 | Viser {andel} av gapet. |
| N12 | Median: allerede nådd |

**From the story and EXPERIENCE, verbatim:**
- "Til medianen for driftsmargin ({n} %)"
- "Hvor mye av gapet som lukkes"
- "Median nås ved {n} % av gapet. Medianen gjelder driftsmargin."
- "{Selskap} ligger allerede over medianen. Medianen gjelder driftsmargin."
- "Medianen gjelder driftsmargin."
- "Økt driftsresultat per år"
- "Frigjort arbeidskapital"
- "Frigjort kapital i driftseiendeler"
- "{a} av {full} per år"
- "Ingen sum – én del mangler grunnlag"
- "Ikke beregnet – for få sammenlignbare på {figur}"
- "Median nås ved {x} %"
- "Median: allerede over"
- "▲ Styrke. Driftsmarginen er på eller over beste fjerdedel, så det er ikke noe økt driftsresultat å regne ut."
- "Økt driftsresultat per år: {a} av {full}."
- "Endre i Verdi"

The capital cards' value is "{a} av {full}", with N7 under it.

**Rounding.**
- A fixed step is full × s / 100 in `Decimal`, rounded once.
- The working-capital total at a share is `wcTotal` × s, rounded once. It can differ by 1 kr from the sum of its rounded parts; that is accepted, as on Oversikt.

## Verification

**Commands:**
- `pnpm lint`, `pnpm typecheck`, `pnpm test`: clean.
- `pnpm seed`, `pnpm test:db`, `pnpm test:ingest`, then `pnpm restore:documents`: the four counts printed and confirmed.
- `pnpm build` and `pnpm check:routes`: clean. A `SecurityFatalError` is rerun and noted on #71.
- E2e, one worker, one project at a time: `chromium`, `db-down`, then `synthetic --no-deps`. Afterwards there are 0 synthetic companies and 0 synthetic manifest entries.
- If a run stops on memory, report it; do not restart it.

**Manual checks:**
- Verdi at 1280, 375 and 320 px for demo A and the synthetic subject.
