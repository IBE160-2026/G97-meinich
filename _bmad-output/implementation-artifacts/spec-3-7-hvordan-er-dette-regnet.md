---
title: 'Story 3.7: "Hvordan er dette regnet?"'
type: 'feature'
created: '2026-11-20'
status: 'in-review'
baseline_commit: '0c3301cac7415ff3f6e98dddc803525889596999'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-6-ev-ebit-what-the-uplift-is-worth.md'
  - '{project-root}/docs/key-figures.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No kroner amount can be traced, so a sensor cannot verify any number by hand. The formula, how beste fjerdedel was found, the filed values and whether they were checked are all hidden (FR-60, FR-64, issue #81). The hero still lacks the link that Story 1.9 left out (UX-DR12).

**Approach:**
- Every displayed kroner amount gets a "Hvordan er dette regnet?" trigger that opens an inline drill-down.
- Its text is built on the server from the engine's output through `src/engine/format.ts`. On Verdi, the share and multiple parts are built in the browser by `verdiCards` from the existing wire.
- The data-quality line is decided from stored states and the manifest, never inferred (AD-15).
- D2: the subject's benchmark filing is chosen in the engine.

**Decisions (proposed by the BMAD session at the checkpoint; approved by Meinich, 2026-11-20):**

1. **The amounts.** A trigger on each of these:
   - **Nøkkeltall:** the four gap cells (driftsmargin, kfd (9), lgd (10), oml (11)), on desktop and in the phone expansion.
   - **Oversikt:** the hero and "Største kapitalgap".
   - **Verdi:** the three cards, one drill-down per card. The working-capital card's drill-down shows both parts.
   - **EV.**

   **The formulas** are the ones the engine uses:

   | Amount | Formula |
   |---|---|
   | Profit | (T − r) × `sumDriftsinntekter` |
   | Profit at the median step | (M − r) × `sumDriftsinntekter`, never full × s_med |
   | (9) | `kundefordringer` − T × `salgsinntekt` / 365 |
   | (10) | T × (`varekostnad` + `annenDriftskostnad`) / 365 − `leverandorgjeld` |
   | (11) | (`sumEiendeler` − `bankinnskudd`) − `sumDriftsinntekter` / T |
   | Working capital | (9) + (10), a strength counted as 0 |
   | Største kapitalgap | the candidates compared, then the chosen amount's formula |
   | EV | profit × m, with "≈" by 3.6's rule |

   The forms for (9)–(11) also go into `docs/key-figures.md` in this PR, stated as the same amounts.

   **The waterfall bars are left out.** They explain the profit gap and are not gaps themselves. "Vis tallene" does **not** give enough numbers to recompute a bar (see Design Notes). So this PR adds:
   - a `deferred-work.md` entry owned by **Story 3.8 "Vannfallet kan regnes ut for hånd"** (Meinich, 2026-11-20);
   - Story 3.8 itself in `epics.md`, in FR-60's row of the coverage map, and in `sprint-status.yaml` as `backlog`;
   - a line under FR-60 in the PRD pointing to 3.8.
2. **Beste fjerdedel.**
   - **n:** n = `Comparison.count`, the peers with a value from the subject's source.
   - **Text:** "Beste fjerdedel {T} = {øvre|nedre} kvartil av {n} verdier (lineær interpolasjon, som PERCENTILE.INC i Excel)". The quartile follows `best.quartile`'s direction, through `percentileInc`.
   - **"Vis fordelingen"** is a fold-out inside the drill-down, not a link. It shows the n values sorted, without name or orgnr, with T marked, so that T can be computed by hand.
     - **Caption:** "De {n} verdiene, sortert fra lavest til høyest".
     - **The T line,** with h = (n − 1) × p, k = ⌊h⌋ + 1 (1-based) and f = h − ⌊h⌋ as a number:
       - "Beste fjerdedel ligger mellom verdi {k} og {k1}: {a} + {f} × ({b} − {a}) = {T}";
       - "≈" replaces "=" when the sum with the displayed numbers does not give the displayed T, decided in the engine on the same principle as `productIsApproximate`;
       - when f = 0: "Beste fjerdedel er verdi {k}: {T}".
     - **Tests:** one fixture with "=", one with "≈", one with f = 0, each for both the upper and the lower quartile. The test fails if the rule is reversed.
   - **Planning documents:** "linking" is corrected in `epics.md` (UX-DR29 and Story 3.7's acceptance criterion) and in EXPERIENCE, with a `(change)` line in the UX memlog.
3. **Filed values.**
   - **Names:** API fields show the register's leaf name in monospace (`sumDriftsinntekter`), from `parse.py` `KEY_FIGURES`, with a test that the TS table equals it. Document lines show the engine name from `docs/key-figures.md` in monospace, grouped under "Fra årsregnskapet".
   - **Derived values:** shown as "avledet: {regel}", from one engine table, tested against `resolveApiInputs` and `documentCostLines`.
     - **A cost line set to 0** because the remainder is within the bound follows `documentCostLines`' rule (±5 kr, both bounds inclusive): "avledet: {regel} = {rest}, innenfor ±5 kr, satt til 0".
     - **Tests:** a remainder of exactly +5 kr and one of exactly −5 kr.
   - **Data-date lines,** one per source:
     - "Registerets nøkkeltall: Regnskapsår {aar} · hentet {dato}", from `filing.read_at`;
     - "Innsendt årsregnskap: Regnskapsår {aar} · hentet {dato}", from `document.read_at`.
4. **The data-quality line,** per amount. It is decided by an exhaustive switch in `documentBasis` order:

   | State | API amount (profit, hero, Verdi profit, EV) | Document amount ((9), (10), (11), working capital, Største kapitalgap, Verdi capital cards) |
   |---|---|---|
   | not on the manifest | "Ikke avstemt – årsregnskapet er ikke i demodataene" | absent |
   | year outside 2021–2025, or `paper` | "Ikke avstemt – regnskapet for {aar} er ikke lest i denne versjonen" | absent |
   | no document | "Ikke avstemt – regnskapet for {aar} er ikke lest inn" | absent |
   | `not_extracted`, or status NULL | "Ikke avstemt – regnskapet for {aar} kunne ikke leses sikkert" | absent |
   | `failed_reconciliation` | "Avvik ved avstemming: {felt}" | absent |
   | reconciled, and every input compared | "Avstemt mot innsendt årsregnskap" | never |
   | reconciled, and an input not compared | "Ikke kontrollert mot andre tall: {felt}" | always the same line |

   - **Compared** means the field is in `SHARED_FIELDS`, is stated (not derived) in the API, is read in the document, and `api_check` = `pass`. R3 does not count as compared.
   - **{felt}** for a failure:
     - `api_fail_fields`, mapped to register names;
     - a c-check, as its equation in register names (c1 `sumDriftsinntekter − sumDriftskostnad ≠ driftsresultat`, c2 `driftsresultat + nettoFinans ≠ ordinaertResultatFoerSkattekostnad`, c3 `sumEiendeler ≠ sumEgenkapitalGjeld`, c4 `sumEgenkapital + sumGjeld ≠ sumEgenkapitalGjeld`, c5 `sumEiendeler ≠ sumEgenkapital + sumGjeld`);
     - when both fail, the API fields first, then the equations, joined with "; ".
   - **{felt}** for "not compared" is the inputs that were not compared.
   - **B9** closes with this line, and no ingest guard is added.
5. **The source line.**
   - **API values:** "Kilde: Brønnøysundregistrene, nøkkeltallene i Regnskapsregisteret. Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene. Bearbeidet av Peerless."
   - **Document values:** "Kilde: Brønnøysundregistrene, årsregnskapet som er sendt inn til Regnskapsregisteret. Lest maskinelt (OCR) og bearbeidet av Peerless."
6. **The payload scan.**
   - The øre scans are unchanged.
   - A field name is allowed only as `<code data-provenance-field>name</code>`, or its RSC form. Those occurrences are removed first, and the existing substring scans run over the rest unchanged.
   - New checks:
     - the drill-downs' field names are exactly the subject's inputs for that tab's amounts;
     - no peer's document line appears, not even formatted;
     - `api_check`, `api_fail_fields` and `c1`–`c5` are forbidden.
   - Probes show the scan failing on a field name outside the marker, on a peer's formatted document line, and on each new column.
   - Growth is measured before and after.
7. **Verdi and the wire.** No new wire value.
   - The fixed parts come from the server as formatted strings.
   - `verdiCards` builds the share line "{full} × {andel} = {a}". At the median step the capital amounts read "{full} × {s_med} ≈ {a}".
   - "≈" comes from `productIsApproximate`, made general.
   - The identity test gets fixtures for the median step with capital amounts and for an "=" case.
8. **D2.**
   - `SUBJECT_SQL` drops its `ORDER BY … LIMIT 1` and returns every `SELSKAP` filing of the subject with its joins.
   - The engine's `subjectBenchmarkFiling(filings)` in `peers.ts` takes the newest year (AD-18) and `benchmarkFiling`'s order.
   - SQL keeps `orgnr`, the `SELSKAP` filter and the joins.
   - `e2e/seed.ts:49-61` keeps its own copy.
9. **UI.**
   - **Trigger:** a `button` in `link` colour with `aria-expanded` and `aria-controls`, under the amount.
   - **Body:** inline. In the tables it is a full-width row, as `DesktopFoldOut` and `PhoneFoldOuts` are.
   - **Focus:** opening moves focus to the heading (`tabIndex=-1`). "Lukk", or Esc with focus inside, closes it and returns focus to the trigger. Nothing is announced.
   - **Several may be open at once.**
   - **An unavailable amount gets no trigger;** its cell keeps its stored reason (AC 3).
   - Calc chips sit on `surface`.
   - At 375 and 320 px there is no sideways scroll, and targets are at least 24 × 24 px.
10. **Copy.** Approved as listed in Design Notes, verbatim; nothing is pending.
11. **One spec,** kept whole (above 1600 tokens; Meinich).

## Boundaries & Constraints

**Always:**
- **Values:** every value in a drill-down equals the engine's output for that URL, through the one formatter.
- **Payload:** øre never reaches it. A peer's document lines never reach it, in any form. The subject's document lines appear only as formatted kroner.
- **No estimates:** a degraded filing is never estimated or substituted.
- **Copy:** enters `nb.json` and EXPERIENCE verbatim, and `test/messages.test.ts` checks it.
- **Tests:**
  - Every I/O row names the test that fails when its guard is removed.
  - No test picks its expected value from the data with a condition; each fixture's state is asserted first.
  - A read after a `replaceState` change, or after opening a drill-down or "Vis fordelingen", waits for the change to render. Every such read is searched, not only the failing one.
- **Commits:** small, each type-checks. Check 375 and 320 px along the way.

**Never:**
- No new route, endpoint or server action (`pnpm check:routes` unchanged), and no client fetch.
- No new wire value, and no second URL writer.
- Nothing per orgnr from the labelled set, and no test naming its companies.
- No `pnpm classify`, no dump deleted, no edit to `architecture/technology.md`, no upgrade.
- No push before Meinich says so.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Failing test |
|---|---|---|---|
| Avstemt | profit; reconciled, `api_check` pass, both inputs stated and read | "Avstemt mot innsendt årsregnskap" | `test/analysis/provenance.test.ts` "Avstemt only where every input was compared" |
| Derived API input | as above, `driftsresultat` derived | "Ikke kontrollert mot andre tall: `driftsresultat`" | same, "a derived input is not compared" |
| Document amount | (9), (10), (11), WC, Største kapitalgap, reconciled and API pass | never "Avstemt"; {felt} as decision 4 | same, "a document line no check covers is never Avstemt" |
| Every AD-15 state | each row of decision 4's table | its line; a document amount is absent with no trigger | same, `it.each` over the table |
| {felt} | API failure; each of c1–c5; both together | the names, the equation, "; " | same, "felt names the failing fields or equation" |
| Outside the seed | a 62.100 company not on the manifest | profit: "Ikke avstemt – årsregnskapet er ikke i demodataene"; no capital trigger | `e2e/provenance.spec.ts` "outside the demo seed: no reconciliation claim" |
| Failed | `SYNTHETIC` | "Avvik ved avstemming: …"; no capital trigger | `e2e/failed-subject.spec.ts` (extended) |
| Reconciled | `SYNTHETIC_DOCUMENTS` | profit "Avstemt…"; capital lines "Ikke kontrollert mot andre tall: …" | `e2e/synthetic-documents.spec.ts` (extended) |
| Engine identity | each drill-down, demo A, default URL, and `andel=median&multippel=6.5` | every shown value equals the engine's formatted output | `test/analysis/provenance.test.ts` "every value is the engine's"; `e2e/provenance.spec.ts` "values equal the engine" |
| Quartile | higher-is-better and lower-is-better figures | "øvre" / "nedre"; n = `count` | `provenance.test.ts` "the quartile follows the direction" |
| Distribution | "Vis fordelingen" | n sorted values, no name or orgnr, T marked; recomputing `percentileInc` from the shown list gives T | `provenance.test.ts` "T recomputes from the shown values"; `e2e/provenance.spec.ts` |
| T line | upper and lower quartile × {"=", "≈", f = 0} | the three forms; "≈" by the engine's rule | `test/engine/provenance.test.ts` "the T line: =, ≈ and f = 0, both quartiles" (fails with the rule reversed) |
| Cost line set to 0 | remainder exactly +5 kr and −5 kr | "avledet: … = {rest}, innenfor ±5 kr, satt til 0" | `test/engine/provenance.test.ts` "a cost line within ±5 kr, both bounds" |
| Names | API vs document inputs | register leaf names equal `parse.py`; document lines under "Fra årsregnskapet" | `test/register-field-names.test.ts` |
| Derived rule | each derivation | the rule reproduces the derived value | `test/engine/provenance.test.ts` "each rule reproduces its value" |
| Dates | an amount from both sources | two lines, filing and document `read_at` | `provenance.test.ts` "one data-date line per source" |
| Share line | Verdi at 50 % and at the median | "{full} × 50 % = / ≈ {a}"; median profit from `profitAtMedian` | `test/analysis/verdi-view.test.ts` "the share line" |
| Wire identity | the Verdi drill-down texts | byte-identical in Node and Chromium | `e2e/wire-identity.spec.ts` |
| Payload | every tab, demo A and `SYNTHETIC_DOCUMENTS` | decision 6 holds | `e2e/payload.ts` callers; `test/payload-scan.test.ts` (the probes) |
| D2 | two filings in one year; older and newer years | the same filing the old SQL chose | `test/engine/peers.test.ts` "the subject's benchmark filing"; `test/db/analysis.test.ts` |
| Focus | open, Lukk, Esc | to the heading; back to the trigger | `e2e/provenance.spec.ts` "focus" |
| Hero | Oversikt | the hero has the trigger | `e2e/oversikt.spec.ts` (extended) |
| Phone | 375 and 320 px, every surface open | no sideways scroll; targets ≥ 24 × 24 | `e2e/provenance.spec.ts` "phone" |
| Routes | build | unchanged | `pnpm check:routes` |

</frozen-after-approval>

## Code Map

- **Engine**
  - `src/engine/amounts.ts:46-59`: the registry. The new provenance functions return no kroner amount, so they are not registered; any that does is registered.
  - `benchmark.ts`: `driftsmarginGap` :66, `capitalGap` :197, `workingCapitalReleased` :246, `largestCapitalGap` :282.
  - `closable.ts`: `profitAtMedian` :121, `scaleAmount` :135, `profitAtShare` :148, `valueAtShare` :163, and `productIsApproximate` :174 (to be made general).
  - `statistics.ts`: `percentileInc` :12; `compareFigure` :57, which gives `count` and `best.quartile` (:88-94).
  - `types.ts:80` `FigureInput` has no value. The values come from `resolveApiInputs` (`key-figures.ts:44`), from the document terms (`document-key-figures.ts:96-125`) and from `documentCostLines` (`document-inputs.ts:~280-320`; a cost line is derived as `sumDriftskostnad` − the other lines, or 0 within 5 kr). The document's `sumDriftsinntekter` is derived as `driftsresultat` + `sumDriftskostnad` (:222-243).
  - `format.ts`: `formatKronerExact` :67, `formatPercent` :91, `formatDays` :150, `formatTurnover` :160, `formatReadDate` :227.
  - `peers.ts:259` `benchmarkFiling`.
- **Data**
  - `src/server/analysis.ts:73-114` `SUBJECT_SQL` (ORDER BY :108).
  - `src/analysis/document-basis.ts:57-105`: add `cur.api_check`, `cur.api_fail_fields`, `cur.c1`–`c5` and `d.read_at`.
  - `document-inputs.ts:390-460` `DocumentBasis`.
  - `reconcile.py:46-58,94-111`.
  - `parse.py:32-75`.
- **Views and UI**
  - `key-figure-rows.ts`: `profitCell` ~211, `capitalCell` ~225. `GapCell.amount` marks a real amount and is where a trigger goes.
  - `key-figure-table.tsx`: `Gap` :79, `DesktopFoldOut` :258, `PhoneFoldOuts` :276.
  - `oversikt-hero.tsx:57-100`.
  - `oversikt-cards.ts:77`: `capitalCard` must also return the chosen figure and the candidates.
  - `small-card.tsx`.
  - `verdi-panel.tsx`: `Card` :61, `EvSection` :96.
  - `verdi-view.ts`: `verdiCards` :423.
  - `fold-out.tsx`: the pattern.
  - `info-popover.tsx:45-61`: the Esc pattern, with the pure `nextOpen`.
- **Tests**
  - `e2e/payload.ts`: `SERVER_FIELDS` :36, `documentFieldsIn` :112, `expectWireSet` :188.
  - `e2e/wire-identity/*`.
  - `e2e/synthetic.ts`.
  - `e2e/seed.ts`: `noSidewaysScroll` :226.
  - `test/messages.test.ts`.
- **Planning documents**
  - `epics.md`: UX-DR29 (:278) and Story 3.7's acceptance criterion ("linking").
  - EXPERIENCE:203 and the UX memlog.
  - `docs/key-figures.md` (9)–(11).
  - PRD FR-60 (:901) and its memlog: the line pointing to Story 3.8.
  - `epics.md`: Story 3.8 "Vannfallet kan regnes ut for hånd" and FR-60's row of the coverage map. `sprint-status.yaml`: `3-8-…: backlog`.
  - `deferred-work.md`: close D2 and B9, and add the waterfall entry, owner Story 3.8.
  - The technical note: AD-15 (the B9 line) and D2.
  - AGENTS.md.
  - `docs/ai-log.md`.

## Tasks & Acceptance

**Execution:**
- [x] `src/engine/peers.ts`, `src/server/analysis.ts`, `test/engine/peers.test.ts`, `test/db/analysis.test.ts`: decision 8 (D2).
- [x] `src/engine/provenance.ts` (new) and its test:
  - inputs with values and their derivation rules;
  - register leaf names, with `test/register-field-names.test.ts`;
  - the compared-input rule and the data-quality switch (decision 4);
  - `productIsApproximate` made general.
- [x] `src/analysis/document-basis.ts` and `test/db`: the new stored columns, passed only to the server.
- [x] `src/messages/nb.json`, `test/messages.test.ts`, EXPERIENCE: the approved copy, before the views.
- [x] `src/analysis/provenance.ts` (new) and `test/analysis/provenance.test.ts`: the drill-down view per amount (decisions 1–5), all strings.
- [x] `src/components/analysis/provenance.tsx` (`'use client'`): trigger, body, focus, Esc and Lukk; "Vis fordelingen" as a fold-out inside it. Wired into the table (both layouts), the hero, the capital card, the Verdi cards and EV. Verdi's share line comes from `verdiCards`.
- [x] `e2e/payload.ts` and `test/payload-scan.test.ts`: decision 6 and its probes.
- [x] `e2e/provenance.spec.ts` (new), plus extensions of failed-subject, synthetic-documents, oversikt and wire-identity: the matrix rows at 1280, 375 and 320 px.
- [x] Planning documents (Code Map), `docs/ai-log.md` and AGENTS.md.

**Acceptance Criteria:**
- **Demo A, Nøkkeltall:** given the default URL, when the driftsmargin cell's "Hvordan er dette regnet?" is opened, then the four steps show, the values equal the engine's, and focus is on the heading.
- **Verdi:** given `?andel=median`, when the profit card's drill-down is opened, then it shows (M − r) × `sumDriftsinntekter` and the card's amount.
- **The PR:**
  - It has "Planning documents:".
  - It says what can go wrong: what the drill-down exposes from the filed values, and a reconciliation claim that is not true. The reasoning is in `docs/ai-log.md`.
  - It names what the review session contributed.

## Implementation Notes

- **A failure with nothing that differed (decision 4).** "Avvik ved avstemming: {felt}" is shown only where something differed: the stored `api_fail_fields` and the checks c1–c5 that `fail`. A failed column with neither (in the local document run, 141 of the 164 failed current columns, each missing a line a required check needs) reads "Ikke avstemt – {felt} kunne ikke leses i regnskapet for {aar}", naming those lines, through its own `DataQuality` variant `lines_not_read`; a column with both shows only the deviation. See the Spec Change Log, 2026-11-20 (`test/analysis/provenance.test.ts` "a failed column with only unread lines: …" and "a failed column with a failing check and an unread line: only the deviation").
- **The distribution's values** are `Comparison.sorted`, added to the compared variant, so "Vis fordelingen" lists exactly the values the quartiles were taken from and n is `count` (the view checks that the two agree). Four hand-made comparisons in tests carry `sorted: []` with a comment; none of those tests reads a distribution.
- **Formula lines.** Each amount has a symbolic line (T, r, M and field names) and a line of displayed numbers; step 2 binds the symbols ("r = …", "M = …", "T = …"). The median line appears on driftsmargin only, whose formula reads M at Verdi's median step. Negative operands after an operator are written in parentheses.
- **A long field name at 320 px.** The drill-down's body and each chip carry `break-words`, so a long register name breaks inside its chip; a separate `overflow-wrap: anywhere` on the field-name rule was redundant (removing it failed no test) and was removed. `e2e/provenance.spec.ts` "phone: the longest register field name wraps inside its chip at 320 px" puts `ordinaertResultatFoerSkattekostnad` into Verdi's EV drill-down and fails (430 > 320) with `break-words` removed.
- **Where the drill-down sits.** In the table: the trigger in the gap cell; on the desktop the body in a full-width row after the figure's row (before its fold-out), on the phone inside the row's expansion, under its gap (already a full-width row). On cards: under the amount. Verdi's fixed parts are server-rendered nodes passed to `VerdiPanel`; its share lines and EV's product line come from `verdiCards` through `VerdiViewContext`.
- **Payload growth** (bytes, HTML / RSC, demo A, before the story → on the build of `a66d6d6`): Oversikt 268 997 / 148 642 → 347 500 / 173 613; Peers 492 065 / 260 834, unchanged; Nøkkeltall 167 380 / 80 366 → 248 619 / 128 830; Verdi 26 402 / 11 598 → 135 477 / 60 761. Most of it is "Vis fordelingen" (demo A's group has 396 peers with a driftsmargin), rendered once per layout on Nøkkeltall and twice on Verdi (the profit card and EV).
- **A stray file.** A screenshot script (`tmp-shot.mjs`) committed by mistake was removed from history by rewriting `87f0796` (Meinich, 2026-11-20).

## Spec Change Log

- **2026-11-20, decision 4's failed state is split (proposed by the review session, which checked the stored columns; decided by Meinich).** "Avvik ved avstemming: {felt}" is shown only where something differed: the `api_fail_fields` fields and the equations of the checks c1–c5 with `fail`. Where nothing differed and a check the status requires (c1, or both c3 and c5) could not read a line, the line reads "Ikke avstemt – {felt} kunne ikke leses i regnskapet for {aar}" (`provenance.quality.linesNotRead`), {felt} the lines it could not read, marked up as every field name, {aar} the filing year. A column with both a deviation and unread lines shows only the deviation. Decision 4's table row "`failed_reconciliation` → Avvik ved avstemming: {felt}" reads with this split; PRD FR-71, EXPERIENCE.md and `epics.md` say so.

## Review Triage Log

Review pass 1 (2026-11-20), over the diff from `baseline_commit` to `4028bf5` plus the status commit: Blind Hunter (B), Edge Case Hunter (E), Verification Gap (V), each in its own context-free subagent; the BMAD session verified each claim against the code, the schema and step 1.

| # | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| B1 | "Avstemt" does not check that the API comparison used the filing the engine chose | low | `api_check` compares with `filing_brreg_id`, the one SELSKAP filing of the year, else `not_evaluable` (reconcile.py `api_check`, write.py `filing_brreg_id`); with one filing that is the engine's choice. Only a second filing added by a plain run after the last `--documents` run, before the document is reconciled again, leaves a stale `pass`. No new id is needed: step 1 sets `register.document.brreg_id` only when the year has exactly one SELSKAP filing, the one `api_check` ran against (`src/analysis/document-filing.ts`). | patched: first rejected as unlikely; the review session overruled the rejection and Meinich decided it (2026-11-22). "Avstemt" only when the document's `brreg_id` is the chosen filing's; otherwise, a null id included, the "Ikke kontrollert mot andre tall" rule |
| B2, E6, V-other | A failed column with nothing that failed, `current` null, or a derived-flag mismatch throws and turns the tab into a 500 | false | Step 1 sets `failed_reconciliation` only from a `fail` check, an `api_check` `fail` (which always carries fields) or a required check `not_evaluable` (a line not read), so `failure` always has a cause; `current` exists for every stored document status but `paper`/`not_extracted`, which map to other states. Loud failure on a state never shown reachable is intended (spec: an amount without its drill-down throws). | rejected |
| B3 | `api_check = 'fail'` with empty `api_fail_fields` falls through to `lines_not_read` | false | reconcile.py returns `fail` only with a non-empty `failed` tuple, and write.py stores it as `api_fail_fields`. | rejected |
| B4 | `lines_not_read` has no rendered-page test | low | Unit tests cover it end to end through `qualityLine`; the page renders it through the same `LineText` path the e2e-tested `failed` line uses. A second failed synthetic company is a large fixture for a copy branch. | rejected |
| B5 | The I/O matrix was not updated for the split | false | The frozen block is corrected in the Spec Change Log (AGENTS.md); its two tests are named there and in Implementation Notes. The fix would edit this build's spec. | rejected |
| B6 | The first AI-log entry was left standing after it was superseded | false | `docs/ai-log.md` rules: entries are never edited; a new entry corrects one, as the second 2026-11-20 entry does. | rejected |
| B7 | The Review Triage Log is empty | false | This table; the review ran after the step-3 fixes. | rejected |
| B8 | "Vis fordelingen" lists every peer's document-derived ratio, and the AI log reasons only about driftsmargin | low | Decision 2 (Meinich) puts the n values of each figure on the page, without name or orgnr; the payload scan refuses a peer's document line but not a ratio, by design. The log's "what could go wrong" omits (9)–(11). | patch: the review's AI-log entry states it |
| B9 | Payload growth is unbudgeted and Verdi carries the same distribution twice | low | Verdi 26 402 → 135 477 bytes of HTML on a local v1; the profit card and EV render the same list. Sharing one distribution adds structure across server and client. | rejected; the figures are in Implementation Notes and raised with Meinich |
| B10, E1 | The open store outlives unmount, so a drill-down reopens on another company's page | medium | `opened` is module-level, keyed by fixed ids (`hero-prov`, `kf-d-prov-*`), never cleared. | patch |
| B11 | Three candidates in "Det største av" lack "og" | false | `largestCapitalGap` pushes at most one of working capital, (9) or (10), then (11): never three. | rejected |
| B12 | D2 silently picks an older filing when the newest has a NULL column | false | `periode_fra`, `periode_til`, `filing_year`, `regnskapstype` and `read_at` are `NOT NULL` in `register.filing`; only the no-filing left-join row has NULLs. | rejected |
| B13 | EXPERIENCE's step (4) and epics' AC still say "one of" three lines | low | The same row's Rules list every state. A direct correction. | patch |
| V1 | No rendered-page test of Verdi's share line in the drill-downs | low | Filed with evidence: only `verdiCards`' strings are tested. | patch |
| V2 | No test reads the "Vis fordelingen" line (`distribution.line`) | medium | Filed with evidence: only the engine's booleans are tested; swapping the copy keys passes. | patch |
| V3 | "Det største av …" and the strength-as-0 working-capital line are untested | medium | Filed with evidence: `largestOf` and `strengthPart` occur only in `test/messages.test.ts`. | patch |
| E2 | EV shows a value with no drill-down if `provenance.ev` is null | false | `provenance.ev` is null only without a profit amount, and EV has a value only with one. | rejected |
| E3 | A negative T after "−" or "/" is not parenthesised | low | Every other operand after an operator is; a direct correction. | patch |
| E4 | A displayed denominator of 0 gives Infinity and an unexplained "≈" | low | Needs revenue under 0,5 kr or T shown as 0,00 with T > 0; the fix adds a branch. | rejected |
| E5 | The copy hard-codes "±5 kr" | low | Approved verbatim by Meinich; the bound is a constant changed only with a story. | rejected |
| E7 | At the median step the slot may show no (M − r) line | false | `andel=median` survives `urlContext` only where `medianStep` exists, which is where `profitAtMedian` is non-null. | rejected |
| E8 | A median-step capital line can read "=" where decision 7 says "≈" | false | Decision 7: "≈" comes from `productIsApproximate` made general; "=" where the shown numbers do give the amount is that rule. | rejected |

## Design Notes

**Why "Vis tallene" cannot recompute a bar** (decision 1). Each bar is (Aₓ − cₓ) × the subject's revenue.
- Aₓ is pooled over the common peer set P (Σ numerator / Σ revenue, `aggregateShares`).
- `displayWaterfall` distributes the rounded total by largest remainder.
- The table (`waterfall-view.ts:240-255`) shows per bar only `formatPercent` of the own and pooled shares, plus the bar's kroner.
- It does not show the subject's revenue, the unrounded shares, P or the peers' numerators.
- So the deferred entry and the FR-60 line are needed.

**Copy from the story and EXPERIENCE, verbatim:**
- "Hvordan er dette regnet?" (also the drill-down's heading)
- "Lukk"
- "Vis fordelingen"
- "Avstemt mot innsendt årsregnskap"
- "Ikke avstemt – årsregnskapet er ikke i demodataene"
- "Avvik ved avstemming: {felt}"

**New copy approved (Meinich, 2026-11-20):**
- Steps: "Formel", "Nøkkeltall", "Innsendte verdier", "Kilde"
- "Beste fjerdedel {T} = {kvartil} kvartil av {n} verdier (lineær interpolasjon, som PERCENTILE.INC i Excel)", where {kvartil} is "øvre" or "nedre"
- "Fra årsregnskapet"
- "avledet: {regel}"
- Data dates:
  - "Registerets nøkkeltall: Regnskapsår {aar} · hentet {dato}"
  - "Innsendt årsregnskap: Regnskapsår {aar} · hentet {dato}"
- Data-quality lines:
  - "Ikke kontrollert mot andre tall: {felt}"
  - "Ikke avstemt – regnskapet for {aar} er ikke lest i denne versjonen"
  - "Ikke avstemt – regnskapet for {aar} er ikke lest inn"
  - "Ikke avstemt – regnskapet for {aar} kunne ikke leses sikkert"
- "{del} er en styrke og teller som 0"
- "Det største av {liste}"
- The two source lines (decision 5)

**Also approved (Meinich, 2026-11-20, second answer):**
- "De {n} verdiene, sortert fra lavest til høyest"
- "Beste fjerdedel ligger mellom verdi {k} og {k1}: {a} + {f} × ({b} − {a}) = {T}", and the same with "≈"
- "Beste fjerdedel er verdi {k}: {T}"
- "avledet: {regel} = {rest}, innenfor ±5 kr, satt til 0"

Formula lines use only numbers, field names and symbols, plus the existing "per år" and "engangsbeløp".

## Verification

**Commands:**
- `pnpm lint`, `pnpm typecheck`, `pnpm test`: clean.
- `pnpm seed`, `pnpm test:db`, `pnpm test:ingest`, then `pnpm restore:documents` after the last seed: the four counts confirmed.
- `pnpm build` (rerun once on `SecurityFatalError`, noted on #71), then `pnpm check:routes`: unchanged and clean.
- E2e: one worker, one project at a time: `chromium`, `db-down`, then `synthetic --no-deps`. Afterwards, 0 synthetic remains. On a memory stop, report it; do not restart.

**The implementation report shows,** with each removal undone afterwards:
- for every matrix row, the guard removed and the failing output;
- the three scan probes failing;
- payload size per tab before and after;
- every read after a drill-down or `replaceState` change waiting for the render, with the list the search found;
- "Avstemt mot innsendt årsregnskap" never on an amount with an uncompared input, and the test failing with rule 8b (the "not compared" row) removed;
- the line for a 62.100 company outside the demo seed claiming no reconciliation;
- the identity test covering Verdi's formula lines, the median step included;
- the four counts after `pnpm restore:documents`, zero synthetic remains, and 20 entries in the manifest;
- every surface at 375 and 320 px.

**Commits:** small, in the Tasks' order, each type-checking. Never push.
