---
title: 'Story 3.8: Vannfallet kan regnes ut for hånd'
type: 'feature'
created: '2026-11-22'
status: 'in-review'
baseline_commit: '07b0560d7cf56e30743724c5330f7ff6e9db061c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-7-hvordan-er-dette-regnet.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-3-the-margin-waterfall.md'
  - '{project-root}/docs/key-figures.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No column of the margin waterfall can be recomputed from the page (FR-60, issue #83; the deferred entry owned by 3.8). "Vis tallene" shows each bar's kroner and its 1-decimal shares. It does not show:
- R;
- the subject's lines;
- n = |P|;
- how samlet was pooled.

**Approach:** Every column gets a "Hvordan er dette regnet?" drill-down: the start, the four bars, the end and a new sum row.
- **Reused from 3.7:** `ProvenanceSteps`, `dataQuality` and `src/engine/provenance.ts`.
- **What each drill-down shows:**
  - the subject's own lines in kroner, with register names;
  - R, read by `documentRevenue` with its derivation;
  - Aₓ, cₓ and M with 2 decimals;
  - the exact kroner line;
  - n = |P| and the reasons a peer is outside P;
  - samlet's read date;
  - the largest-remainder note, where it applies.
- **Never shown:** a Σ over P, an exact Aₓ or M, or any peer's line.

**Decisions (proposed by the BMAD session at the checkpoint; approved by Meinich, 2026-11-22):**

1. **Comparing groups across URLs. Invariant:** only a peer whose document basis is `read` enters P, and `read` requires the orgnr to be on the manifest (`documentBasis`, `document-inputs.ts:433`). So a comparison after an exclusion reaches only the lines of a company in the published dataset. That company's own page shows the same lines in kroner wherever its own amounts are shown.
   - **Tests:**
     - `test/engine/waterfall.test.ts` "a peer outside the manifest never enters P": a reconciled document with `inManifest: false` stays out of P. It fails with the manifest guard removed.
   - **AI log:** a new `docs/ai-log.md` entry corrects Story 3.7's claim. A value can be tied to a peer by comparing two URLs, though not from one page. The entry gives the measurement (Design Notes) and says the analysis was asked for by the review session.
2. **Decimals and the kroner line.**
   - Aₓ, cₓ and M are shown with 2 decimals (`formatPercentFine`, new) in the drill-down. The table keeps 1.
   - Each bar adds the exact line "Aₓ × R − egen linje = søyle". It reveals nothing new, because Aₓ × R = bar + own line, and both are shown.
   - Aₓ × R is a new kroner amount: `pooledOnRevenue` in `waterfall.ts`, registered in `amounts.ts` as `explanation`.
     - The report shows `test/engine/no-double-counting.test.ts` failing when a total references it.
     - "=" or "≈" comes from `lineIsApproximate` on the displayed numbers.
3. **Sum.** A new row "Sum av postene" in "Vis tallene" with its own trigger.
   - Its drill-down states that the sum is against peer-gruppen samlet, not beste fjerdedel, so it is not read as the Driftsmargin row's gap.
   - It shows (m − M) × R and the sum of the shown bars.
4. **Data quality of start, end and sum.** These are document amounts whose every input can be compared.
   - They read "Kontrollert mot registerets nøkkeltall: {felt}" (new `DataQuality` kind `checked`), never "Avstemt".
   - The line appears only under 3.7's conditions for "Avstemt": `api_check` = `pass`, the document's `brreg_id` equal to the chosen filing's (B1), and every input in `SHARED_FIELDS` and read in the column (not derived).
   - Otherwise it reads "Ikke kontrollert mot andre tall: {felt}". A derived revenue gives that line.
   - **Tests** (`test/engine/provenance.test.ts`, each failing with its guard removed):
     - "checked: the ids differ";
     - "checked: revenue derived";
     - "checked: api_check not passed".
   - The bars keep 3.7's rule: the three cost lines are never compared, so they read "Ikke kontrollert …".
5. **Samlet's read date (FR-64).** The range of `register.document.read_at` over P, on the server only. When every date is the same, one date is shown, never "{d}–{d}".
6. **Copy.** Approved as listed in Design Notes, with Meinich's three changes. Decision 3's sentence (`waterfall.prov.sumNotGap`) is worded by Meinich (2026-11-22, Spec Change Log).
7. **One spec,** kept whole (above 1600 tokens; Meinich).

## Boundaries & Constraints

**Always:**
- **Values:** every value in a drill-down equals the engine's output for that URL, through `src/engine/format.ts`.
- **FR-30:** a drill-down never turns a bar into a gap and never adds it to any amount. Every new engine function returning `ore`/`kroner` is registered as `explanation`, and `test/engine/no-double-counting.test.ts` passes unedited.
- **Data quality:** a document amount is never "Avstemt".
- **Payload:** it never holds:
  - a Σ over P, in øre, kroner or any other format;
  - an Aₓ or M beyond 2 decimals;
  - any peer's line or read date.
- **Tests:**
  - Every I/O row names the test that fails when its guard is removed.
  - No expected value is chosen from data by a condition; the fixture's state is asserted first.
  - Every read after an open or a URL change waits for what it reads.
- **Commits:** small, each type-checks. Check 375 and 320 px along the way.

**Never:**
- No new route, endpoint, server action, client fetch, wire value or URL writer.
- No change to the waterfall's arithmetic (`aggregateShares`, the bars, `displayWaterfall`'s rounding).
- No "Vis fordelingen" on the waterfall.
- Nothing per orgnr from the labelled set.
- No dump deleted, no upgrade, no push before Meinich says so.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Failing test |
|---|---|---|---|
| Bar ≈ | `SYNTHETIC_DOCUMENTS`, vare | "(8,02 % − 7,00 %) × 1 500 000 000 kr ≈ +15 241 935 kr"; c = 105 000 000 / 1 500 000 000; "120 241 935 kr − 105 000 000 kr = +15 241 935 kr" | `e2e/synthetic-documents.spec.ts` "each bar recomputes from its drill-down" (oracle `SYNTHETIC_WATERFALL`, `e2e/synthetic.ts`) |
| Bar = | fixture, andre; residual | "(20,00 % − 22,00 %) × … = −30 000 000 kr"; "(3,00 % − 2,00 %) × … = +15 000 000 kr" | same |
| Residual | fixture | Aᵣ = 1 − M − ΣA; cᵣ = (R − driftsresultat − the three lines) / R | `test/analysis/provenance.test.ts` "the residual's two rules" |
| Start / end | fixture | M × R ≈ 344 274 194; "Vist som 330 000 000 kr − (−14 274 194 kr) = 344 274 194 kr …"; end = `driftsresultat` | e2e as above |
| Sum | fixture | (m − M) × R ≈ −14 274 194; the shown bars sum exactly; the "ikke beste fjerdedel" line | `test/engine/provenance.test.ts` "Σ bars is (m − M) × R exactly"; e2e "the sum row" |
| Largest remainder | hand-made bars 100,4 / 200,4 / 300,4 / 0 kr | vare: "Vist som 101 kr, ikke 100 kr: postene er rundet slik at de til sammen blir 601 kr." | `test/analysis/provenance.test.ts` "a bar moved by the largest remainder says so" |
| No note | fixture | no rounding note | same file, "no note where the bar is its own rounding" |
| Manifest | reconciled peer, `inManifest: false` | not in P | `test/engine/waterfall.test.ts` "a peer outside the manifest never enters P" |
| n and reasons | P = 10 of 10; hand-made group with each reason | n; one count per reason, no names | `test/engine/waterfall.test.ts` "who is outside P, counted by reason" |
| R derived | subject revenue empty, derivable | "avledet: driftsresultat + sumDriftskostnad"; start/end/sum "Ikke kontrollert …" | `test/analysis/provenance.test.ts` "R derived" |
| Checked | three negative cases (decision 4) and the fixture's positive case | as decision 4 | `test/engine/provenance.test.ts` "checked: …" ×3; e2e reads "Kontrollert mot registerets nøkkeltall" on the fixture |
| Read date | P dates equal; P dates differ | one date; "{fra}–{til}" | `test/analysis/provenance.test.ts` "samlet's read date" |
| Amount registry | a total referencing `pooledOnRevenue` | fails | `test/engine/no-double-counting.test.ts` (unchanged; shown in the report) |
| No waterfall | demo A; `ekskl` one fixture peer (P = 9) | no trigger | `e2e/key-figures.spec.ts` (extended); `e2e/synthetic-documents.spec.ts` "excluding one peer leaves no waterfall" (extended) |
| Payload | Nøkkeltall, fixture and demo A | no Σ over P, no Aₓ/M beyond 2 decimals, no peer line or date | `e2e/payload.ts`; `test/payload-scan.test.ts` "probe: a group sum in kroner fails", "probe: an exact Aₓ fails" |
| Focus, several, phone | open, Lukk, Esc; two open; 375 and 320 px | focus to the heading and back; both stay open; no sideways scroll | `e2e/synthetic-documents.spec.ts` "waterfall drill-downs: focus, several open, phone" |

</frozen-after-approval>

## Code Map

- **Engine**
  - `src/engine/waterfall.ts`
    - Add `outsideCommonSet(peers, year)`: counts per reason (`marginComponents`' absences plus `other_year`), beside `commonPeerSet` :178. Not an amount.
    - Add `pooledOnRevenue(share, revenueOre)` → `{ ore: Fraction }`.
    - `WaterfallDisplay` :252 gains `ownKroner` (each bar rounded half away from zero), so the note can be decided in the engine.
  - `src/engine/amounts.ts` :46: add `pooledOnRevenue` as `explanation`.
  - `src/engine/document-inputs.ts:433`: the manifest guard the invariant rests on.
  - `src/engine/provenance.ts`
    - `inputCompared` :359 (already "read in the column", so a derived revenue is not compared).
    - `dataQuality` :404: replace the throw at :444 with `checked` for a caller that allows it. The bars and 3.7's amounts keep the throw.
    - `documentInput` :194 for R and the lines; `lineIsApproximate` :458.
  - `src/engine/format.ts`: `formatPercentFine`/`shownPercentFine` (2 decimals), beside :91 and :128.
- **Data:** `src/server/analysis.ts` `toCandidate` :290: keep each candidate's `document_read_at` on the server (no other fact). `src/analysis/document-basis.ts` already selects it (:78).
- **Views**
  - `src/analysis/provenance.ts`:
    - reuse `view()` :327 and `ProvenanceView` :87;
    - add `waterfallProvenance(...)`, one view per column. Its "Nøkkeltall" step holds the pooled line, the counts and samlet's date, with no `best` and no distribution;
    - `viewFields` :617.
  - `src/analysis/waterfall-view.ts` :213: a provenance id per row, and the sum row.
  - `src/analysis/shown-group.ts` :142: the counts and P's date range.
- **UI:** `src/components/analysis/waterfall.tsx` `NumbersTable`:
  - a `ProvenanceTrigger` in each row's kroner cell and a `ProvenanceRow` (colSpan 4) after it;
  - ids `kf-${d|p}-wf-prov-${start|vare|lonn|andre|residual|end|sum}`;
  - the SVG (`role="img"`) and the phone rows get no trigger;
  - `provenance.tsx` is unchanged.
- **Tests**
  - `e2e/synthetic.ts`: `SYNTHETIC_WATERFALL`, the hand-derived constants of Design Notes.
  - `e2e/synthetic-documents.spec.ts` :584-745 (today "the waterfall against the engine" copies the engine, :94).
  - `e2e/payload-scan.ts`, `e2e/payload.ts` (`documentOre` :199), `test/payload-scan.test.ts`.
  - `test/engine/waterfall.test.ts`, `test/engine/provenance.test.ts`, `test/analysis/provenance.test.ts`, `test/analysis/waterfall-view.test.ts`, `test/messages.test.ts`.
- **Docs**
  - `docs/key-figures.md` (the waterfall section: the drill-down's forms), `docs/ai-log.md` (decision 1).
  - EXPERIENCE (:195 and :203: "never on a waterfall bar" goes) and its memlog.
  - PRD FR-60 :901 and its memlog; `epics.md` UX-DR29 and Story 3.8.
  - `deferred-work.md` (close the 3.8 entry), `sprint-status.yaml`, AGENTS.md.

## Tasks & Acceptance

**Execution:**
- [x] `src/engine/waterfall.ts`, `amounts.ts`, `format.ts` and their tests: `outsideCommonSet`, `pooledOnRevenue`, `ownKroner`, `formatPercentFine`, and the manifest test.
- [x] `src/engine/provenance.ts` and its test: `checked` and its three guards, and Σ bars = (m − M) × R.
- [x] `src/messages/nb.json`, `test/messages.test.ts`, EXPERIENCE: the approved copy, before the views.
- [x] `src/server/analysis.ts`, `src/analysis/{provenance,waterfall-view,shown-group}.ts` and their tests: one view per column, the counts and the date.
- [x] `src/components/analysis/waterfall.tsx`: the triggers, the rows, the sum row.
- [x] `e2e/payload*.ts` and `test/payload-scan.test.ts`: the Σ-in-kroner and exact-Aₓ scans and their probes.
- [x] `e2e/synthetic.ts`, `e2e/synthetic-documents.spec.ts` and `e2e/key-figures.spec.ts`: the oracle and the matrix rows at 1280, 375 and 320 px.
- [x] The docs in the Code Map.

**Acceptance Criteria:**
- **Fixture:** given Nøkkeltall with the waterfall open, when each row's drill-down is opened, then the column can be recomputed from what it shows, and every value equals `SYNTHETIC_WATERFALL`.
- **The PR:**
  - It has "Planning documents:".
  - It says what can go wrong (decision 1, with the figures).
  - It names what the review session contributed.

## Implementation Notes

Implementation run, 2026-11-22 (subagent). Where the code differs from the Code Map's hints, or a row needed reading:

- **`waterfall.prov.sumNotGap` is the spec's proposed wording, committed as proposed.** Decision 6 puts it to Meinich before the copy commit; the subagent could not ask, so the key is in `nb.json`, EXPERIENCE.md and `test/messages.test.ts` with a comment that it awaits confirmation. A change of wording is one line in each.
- **No "Ikke med" line when no one is outside P.** `waterfall.prov.outside` has no form for an empty list, so `outsideLine` returns null then; n is still in the pooled sentence. Only a hand-made group reaches it (`test/engine/waterfall.test.ts` "who is outside P, counted by reason", the P = 10 of 10 case).
- **Step 2 of a column is a new `pooled` field of `ProvenanceView`** (label, lines, sentences about P), not a `FigureStepView` with an optional beste fjerdedel, so 3.7's views and tests are unchanged; `ProvenanceSteps` renders it under "Nøkkeltall". `provenance.tsx` is unchanged.
- **The end's inputs include R** (its m line reads it), so a derived R leaves the end "Ikke kontrollert …" as the matrix's "R derived" row asks, not only the start and the sum.
- **Written forms.** The residual's own line in the exact line is "c × R" (no register name holds it). The sum's second line adds the displayed bars unsigned, a negative one in parentheses, with the result signed. "Vist som {vist}, ikke {egen}" writes unsigned kroner, as the approved example does. The residual's A line writes 1 as "100,00 %".
- **Phone.** The "Vis tallene" table is wider than the screen at 375 and 320 px and scrolls in its region, so a drill-down row spanning it ran off the screen. On the phone the steps keep to the visible width and stay at the region's left edge (`sticky left-0`, `max-w-[calc(100vw-4.5rem)]` in `waterfall.tsx`); `e2e/synthetic-documents.spec.ts` "waterfall drill-downs: focus, several open, phone" checks the steps' box lies inside the screen. The drill-down's heading is `ProvenanceRow`'s h3, under the fold-out's own h3.
- **The read date and "no peer's read date".** Decision 5's range has two ends that are peers' dates, without a name; nothing per peer reaches the page. In the fixture every document is read in one transaction, so it shows one date.
- **Two Aₓ × R values equal a peer's line in the fixture.** Peer 5's revenue is the subject's, and its andre (20 %) and avskrivninger (3 %) shares are every peer's, so Aₓ × R for those two bars (300 000 000 and 45 000 000 kr) is peer 5's line by construction. The Nøkkeltall payload test asserts that state and admits the two shown values beside the subject's own lines.
- **Payload growth** (HTML bytes, raw / gzip -9, main `1c8063e` → branch, each tab built and served the same way). Demo A, which has no waterfall: Oversikt 347 500 / 53 552 → 347 505 / 53 554; Peers 492 065 / 43 602 → 492 065 / 43 610; Nøkkeltall 248 619 / 31 242 → 248 644 / 31 264; Verdi 135 477 / 22 208 → 135 487 / 22 206. The synthetic fixture: Oversikt 84 781 / 14 746 → 84 778 / 14 736; Peers 67 612 / 10 221, unchanged; Nøkkeltall 334 168 / 33 983 → 465 460 / 41 978 (+7 995 gzip: seven drill-downs in each of the two layouts' tables); Verdi 74 846 / 11 060 → 74 866 / 11 066.
- **The outside count in e2e.** The fixture's band holds seed companies off the manifest (`insertSyntheticDocuments` refuses another listed company there), so the e2e reads k = the group's size − 10, all "ikke i demodataene".

## Spec Change Log

- **2026-11-22, the checkpoint's premise is completed (the review session added that the peers are not on the manifest either; it took 885583822 for demo A, which was its own mistake; checked against the code and the database; Meinich decided the rest).** The draft said demo A gets no waterfall locally because it is not on the manifest. That holds. The review session's correction said demo A is on the manifest; it is not.
  - **Verified:** demo A (`DEMO_COMPANIES[0]`, 813235552 ADMMIT AS) is not on `document_figure_orgnrs`, either in `seed/demo/manifest.json` or in `register.dataset`. 885583822 (VISIONTECH AS, "OCR-referansesett" in the allow-list), which the review session took for demo A, is on it.
  - **The reason no subject has a waterfall locally:** the peers are not on the manifest. Each of the 20 manifest companies has P < 10, so 0 of them show a waterfall or a (9)/(11) distribution after `restore:documents`. Demo A has no waterfall for that reason too, and also because it is itself not on the manifest.
  - **Before Story 5.4,** only the synthetic fixture reaches a shown waterfall in e2e.
- **2026-11-22, decisions 1–7 replace the draft's Open Questions** (Meinich).
- **2026-11-22, the read-date boundary is read with decision 5 (review B4; recorded by the BMAD session, confirmed by Meinich 2026-11-22).** Boundaries says the payload never holds "any peer's … read date". Decision 5 shows the range of P's read dates, whose two ends are peers' dates without a name. Excluding a peer in a second URL can move an end. The boundary means no read date per peer; the range of decision 5 is allowed. By decision 1's invariant, a member of P is on the manifest, and its own page shows its own read date. A read date is also a time of Peerless's own reading, not an accounting figure (Meinich).
- **2026-11-22, decision 3's sentence is worded (Meinich).** `waterfall.prov.sumNotGap` reads "Summen er avstanden til peer-gruppen samlet, ikke til beste fjerdedel. Den er derfor ikke gapet i Driftsmargin-raden." Decision 6 is updated to say so.

## Review Triage Log

Review pass 1 (2026-11-22), over the diff from `baseline_commit` to the in-review commit: Blind Hunter (B), Edge Case Hunter (E) and Verification Gap (V), each in its own context-free subagent. The BMAD session verified each claim against the code.

| # | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| B1, B2, E6 | The kroner lines (Aₓ × R, M × R, beside R) give Aₓ and M to about 1/R. The ai-log and Design Notes cite the 2-decimal row (341 k kr) as what the page exposes | low | True. The page now matches the "bars with own lines" measurement (median 7,8 k kr, the exact level), not the 2-decimal one. Decision 2 chose the kroner line knowing Aₓ × R = bar + own line; decision 1's invariant covers the exposure. The record is wrong, not the code. | patch: the ai-log entry and Design Notes cite the right row |
| B3, E1 | The start's inputs omit `driftsresultat`, though its shown value is end − sum | low | True: `waterfallProvenance` passes only R to the start's `view`. `driftsresultat` is always read for a waterfall and is compared whenever R is, so "Kontrollert" is never false; the line only names one field too few. A direct correction. | patch |
| E4 | `finePercentsIn` misses a negative share: the page writes U+2212, the scan builds ASCII "-" | low | True: `toString()`/`toFixed` writes "-". A negative M (a loss-making group) beyond 2 decimals would pass the scan. A direct correction. | patch |
| E5 | `finePercentsIn` uses `toString()`, which writes an exponent for very small shares | low | True for \|x\| < 1e-7. A direct correction (`toFixed()`). | patch |
| E2 | The residual's A line takes the shares by position | false | `WATERFALL_BARS` is a fixed constant in bar order, and `marginWaterfall` maps it in that order. A reorder is a change to the waterfall itself, which the spec forbids. | rejected |
| E3 | `byBar` is cast to a full record without checking the keys | false | `marginWaterfall` always returns the four steps of `WATERFALL_BARS`. | rejected |
| V1, B8 | No test puts the rounding note through `waterfallProvenance`, only `roundingNote` directly, and none has a negative bar | medium | Filed with evidence: dropping the note's spread, or a wrong index, passes every test. | patch: a case through `waterfallProvenance` with a moved bar, a negative bar among them, asserting the note on that bar only |
| V2 | No test reads `shownGroup(...).waterfallFacts` with `ekskl` while a waterfall is shown | medium | Filed with evidence: passing `funnel.group` instead of `peers` passes every test. | patch: `test/analysis/shown-group.test.ts`, `ekskl` holding a peer outside P |
| B4 | The read-date range contradicts the frozen boundary "never any peer's read date", with no Spec Change Log entry | low | True: the boundary's wording is the BMAD session's, and decision 5 (Meinich) asks for the range. The fix edits this spec, so it is rejected as a code finding. AGENTS.md nevertheless asks for the correction, so it is recorded in the Spec Change Log for Meinich to confirm. | accepted, Meinich (2026-11-22): the boundary means no read date per peer; the range is allowed |
| B5 | `waterfall.prov.sumNotGap` is committed and tested without approval, and nothing tracks it | low | True: it was put to Meinich in the session (decision 6). Meinich worded it (2026-11-22): "Summen er avstanden til peer-gruppen samlet, ikke til beste fjerdedel. Den er derfor ikke gapet i Driftsmargin-raden." | patched: `nb.json`, `test/messages.test.ts`, EXPERIENCE.md and the UX memlog carry Meinich's wording |
| B6 | Peer 5's andre and avskrivninger lines equal two Aₓ × R values, so the scan allows those two øre values anywhere on Nøkkeltall | low | True, by the fixture's construction (peer 5's revenue is the subject's). A general leak of peer lines is still caught by the nine other peers, and changing the fixture would move numbers that 3.1b and 3.7 assert. The test now asserts that `pooledShown` holds exactly two values, and that the nine other peers' `annenDriftskostnad` and `avskrivninger` are in `peerOre` and not excepted. | accepted, Meinich (2026-11-22) |
| B7 | `waterfallFacts` throws on a P member without a read date, and `outsideLine` on an inconsistent count, failing the whole page | false | `register.document.read_at` is `NOT NULL`, and a member of P has a document row. `outsideLine`'s invariant holds by construction: the same peers give n and the counts. Loud failure on unreachable states is intended. | rejected |
| B9 | The seven triggers have the same accessible name | low | They sit in the kroner cell of a row with `th scope="row"`, so table navigation announces the row, as for 3.7's gap cells. | rejected |
| B10 | Each drill-down is rendered twice (desktop and phone), the notes repeat, and +8 kB gzip goes unquestioned; the end's step 2 is labelled "Driftsmargin" | low | Rendered twice by 3.7's pattern, measured, and under 3.7's 30 kB. The end's step 2 shows m = `driftsresultat` / R, which is the driftsmargin. | rejected |
| B11 | Several page states (two dates, several reasons, derived R, none outside P) are unit-tested only | low | They render through the same `ProvenanceSteps` path the e2e covers. Each would need another committed synthetic company. | rejected |

**Verification after review pass 1 (2026-11-22, the BMAD session, after `5291526` and `adfbf04`):**
- **Static and unit:** lint and typecheck are clean; `pnpm test --maxWorkers=2` passed 2 086.
- **Build:** `pnpm build` exited 1 once, consistent with #71, and passed on the rerun. `check:routes` is unchanged.
- **E2e** (one worker, one project at a time): chromium 197, db-down 7, synthetic `--no-deps` 31. The 3100 server was started separately and logged no `notFound.coverageFailed`, so the two lines come from the db-down server on 3101.
- **Database:** 2 785 / 5 556 / 2 537 / 10 371; 0 `SYNTETISK%`; 20 manifest entries.

## Design Notes

**Fixture oracle** (`SYNTHETIC_WATERFALL`, exact, in kr). P = 10, S = 15 500 000 000.
- **Sums over P:**
  - Σvare = 1 242 500 000
  - Σlønn = 7 135 000 000
  - Σandre = 3 100 000 000
  - Σresidual = 465 000 000
  - Σdriftsresultat = 3 557 500 000
- **Shares:** Avare = 1 242,5/15 500 = 8,016129 %; Alønn = 46,032258 %; Aandre = 20 %; Ares = 3 %; M = 22,951613 %.
- **Subject:** R = 1 500 000 000; own lines 105 000 000 / 705 000 000 / 330 000 000 / 30 000 000; `driftsresultat` 330 000 000; m = 22 %.
- **Aₓ × R:** 120 241 935,48 / 690 483 870,97 / 300 000 000 / 45 000 000.
- **Bars:** +15 241 935,48 / −14 516 129,03 / −30 000 000 / +15 000 000.
- **Columns:** sum −14 274 193,55, shown as −14 274 194; start 344 274 194; end 330 000 000.
- **Rounding:** each bar equals its own rounding.
- **The exact kroner line,** shown:
  - vare "120 241 935 kr − 105 000 000 kr = +15 241 935 kr";
  - lønn "690 483 871 kr − 705 000 000 kr = −14 516 129 kr".

**Largest-remainder example.** Exact bars of 100,4, 200,4, 300,4 and 0 kr give a total of 601,2, shown as 601. The floors sum to 600, so one krone remains. Ties go in bar order, so it goes to vare: shown 101 kr, own rounding 100 kr.

**Exposure, decision 1** (demo A 813235552, gate opened in memory, the restored dump; totals only). The groups are 396 / 629 / 789 by band, and P is 274 / 331 / 361. Band 0 and band 1 differ by 57 in P.

Excluding one peer and reconstructing its line from that peer's revenue (`formatMillions`) and its 1-decimal margin (Peers tab), over 1 096 lines:

| What the page shows | Median error |
|---|---|
| Aₓ, 2 decimals | 341 k kr (7,9 %) |
| Today's 3.3 bars | 9,9 k kr (0,22 %) |
| This story's drill-downs: bars with the own lines and R in kroner (equivalently Aₓ × R) | 7,8 k kr (0,18 %): what the page now exposes (review B1) |
| Aₓ exact | 7,7 k kr |

- An exact Σ gives the line to the krone.
- 3.7's "Vis fordelingen" gives kundefordringer at a median of 0,73 % and driftseiendeler at 0,16 %.
- All 274 members of P have their own waterfall with the gate open.
- Across 871 subjects, 0 pairs have P differing by 1.
- Outside P: 98 component missing, 16 failed reconciliation, 5 document missing, 3 R2.

**Approved copy (Meinich, 2026-11-22):**
- `waterfall.table.sum`: "Sum av postene"
- `waterfall.prov.pooled`: "Peer-gruppen samlet er én sammenslått andel over de {n} selskapene som har alle linjene i årsregnskapet for {aar}: summen av linjen delt på summen av omsetningen. Det er ikke en median eller beste fjerdedel."
- `waterfall.prov.outside`: "{n} av {gruppe} sammenlignbare er med. Ikke med: {liste}."
- The reason items:
  - "{k} ikke i demodataene"
  - "{k} uten innlest årsregnskap"
  - "{k} ikke lest i denne versjonen"
  - "{k} kunne ikke leses sikkert"
  - "{k} som ikke besto avstemmingen"
  - "{k} der kostnadslinjene ikke summerer til sum driftskostnader"
  - "{k} med en linje som mangler"
  - "{k} uten positiv omsetning"
  - "{k} med regnskap for et annet år"
- `waterfall.prov.rounded`: "Vist som {vist}, ikke {egen}: postene er rundet slik at de til sammen blir {total}."
- `waterfall.prov.startShown`: "Vist som {slutt} − ({sum}) = {start}, slik at start og postene til sammen gir {slutt}."
- `provenance.quality.checked`: "Kontrollert mot registerets nøkkeltall: {felt}"
- `waterfall.prov.date`: "Peer-gruppen samlet: Regnskapsår {aar} · årsregnskapene hentet {fra}–{til}"
- `waterfall.prov.dateOne`: "Peer-gruppen samlet: Regnskapsår {aar} · årsregnskapene hentet {dato}"

**Decision 3's sentence, worded by Meinich (2026-11-22):** `waterfall.prov.sumNotGap`: "Summen er avstanden til peer-gruppen samlet, ikke til beste fjerdedel. Den er derfor ikke gapet i Driftsmargin-raden."

Formula lines use only numbers, register field names and the symbols A, c, M, m, R and Σ.

## Verification

**Commands:**
- `pnpm lint`, `pnpm typecheck` and `pnpm test --maxWorkers=2` (in parts if memory is low): clean.
- `pnpm seed`, `pnpm test:db`, `pnpm test:ingest`, then `pnpm restore:documents`: report the four counts, 0 `SYNTETISK%` rows and 20 manifest entries.
- `pnpm build`, run once more on `SecurityFatalError` (#71); then `pnpm check:routes`: unchanged.
- E2e with one worker, one project at a time: `chromium`, `db-down`, then `synthetic --no-deps`.

**Report:**
- For every matrix row, the guard removed and the failing output.
- The probes failing.
- `no-double-counting.test.ts` failing on a total that references `pooledOnRevenue`.
- Payload size, raw and gzip, main → branch, for each tab.
