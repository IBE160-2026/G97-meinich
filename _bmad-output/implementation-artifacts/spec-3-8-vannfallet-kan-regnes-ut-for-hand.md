---
title: 'Story 3.8: Vannfallet kan regnes ut for hånd'
type: 'feature'
created: '2026-11-22'
status: 'ready-for-dev'
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
6. **Copy.** Approved as listed in Design Notes, with Meinich's three changes. The one sentence decision 3 asks for (`waterfall.prov.sumNotGap`) is put to Meinich before the copy commit.
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
- [ ] `src/engine/waterfall.ts`, `amounts.ts`, `format.ts` and their tests: `outsideCommonSet`, `pooledOnRevenue`, `ownKroner`, `formatPercentFine`, and the manifest test.
- [ ] `src/engine/provenance.ts` and its test: `checked` and its three guards, and Σ bars = (m − M) × R.
- [ ] `src/messages/nb.json`, `test/messages.test.ts`, EXPERIENCE: the approved copy, before the views.
- [ ] `src/server/analysis.ts`, `src/analysis/{provenance,waterfall-view,shown-group}.ts` and their tests: one view per column, the counts and the date.
- [ ] `src/components/analysis/waterfall.tsx`: the triggers, the rows, the sum row.
- [ ] `e2e/payload*.ts` and `test/payload-scan.test.ts`: the Σ-in-kroner and exact-Aₓ scans and their probes.
- [ ] `e2e/synthetic.ts`, `e2e/synthetic-documents.spec.ts` and `e2e/key-figures.spec.ts`: the oracle and the matrix rows at 1280, 375 and 320 px.
- [ ] The docs in the Code Map.

**Acceptance Criteria:**
- **Fixture:** given Nøkkeltall with the waterfall open, when each row's drill-down is opened, then the column can be recomputed from what it shows, and every value equals `SYNTHETIC_WATERFALL`.
- **The PR:**
  - It has "Planning documents:".
  - It says what can go wrong (decision 1, with the figures).
  - It names what the review session contributed.

## Implementation Notes

## Spec Change Log

- **2026-11-22, the checkpoint's premise is corrected (the review session found it wrong; checked against the code and the database; Meinich decided the rest).** The draft said demo A gets no waterfall locally because it is not on the manifest.
  - **Verified:** demo A (`DEMO_COMPANIES[0]`, 813235552 ADMMIT AS) is not on `document_figure_orgnrs`, either in `seed/demo/manifest.json` or in `register.dataset`. 885583822 (VISIONTECH AS, "OCR-referansesett" in the allow-list), which the review session took for demo A, is on it.
  - **The reason no subject has a waterfall locally:** the peers are not on the manifest. Each of the 20 manifest companies has P < 10, so 0 of them show a waterfall or a (9)/(11) distribution after `restore:documents`. Demo A has no waterfall for that reason too, and also because it is itself not on the manifest.
  - **Before Story 5.4,** only the synthetic fixture reaches a shown waterfall in e2e.
- **2026-11-22, decisions 1–7 replace the draft's Open Questions** (Meinich).

## Review Triage Log

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

**Proposed under decision 3, the one line it asks for:** `waterfall.prov.sumNotGap`: "Summen er mot peer-gruppen samlet, ikke beste fjerdedel, og er ikke gapet i Driftsmargin-raden." Decision 3 requires the sentence but leaves its wording open; it is put to Meinich before the copy commit.

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
