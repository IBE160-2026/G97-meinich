# Story 5.2: layer-by-layer measurement

**Date:** 2026-11-15
**Tool:** Claude Code (Opus 5.5): the BMAD session (`bmad-build`), with these subagents:
- one that compiled the Epic 5 context
- three investigation subagents
- an implementation subagent dispatched by the BMAD session
- a documentation subagent
- three review subagents

**Story / issue:** #64, Story 5.2 (FR-3, FR-13, NFR23, NFR24, NFR32)
**Result:** branch `story/5.2-layer-measurement`, commits `1a7e052` to this docs commit; PR not yet opened (no push before Meinich says so)

## Goal

Measure precision and recall per funnel layer against the labelled set, apply the stage-5 rule fixed in PRD §9 before the run, decide each band, and write a dated report to `analysis/output/` that `seed/coverage.json` points to.

## Prompts that mattered

The review session wrote every prompt below. Meinich pasted them into this session, and the review session also recommended the answers. Where a decision is credited to Meinich below, Meinich made it on the review session's recommendation.

Meinich, opening the session (verbatim):

> /bmad-build Story 5.2: Layer-by-layer measurement (epics.md, Story 5.2). Lag branchen story/5.2-layer-measurement fra origin/main, og opprett issuet.
>
> Stopp ved sjekkpunktet før du endrer kode, og vis meg:
> (a) Data: hva skriptet leser. Etikettene er de blinde parene (labels-blind.csv) og andre runde (parene beregnet fra labels-revenue-model.csv etter regelen i analysis/labelled-set/README.md). Første runde (labels.csv) vises ved siden av som den strengere lesningen. Fingeravtrykk og klassifisering hentes fra den lokale databasen. Si hvilken rolle skriptet bruker, og at det leser gjennom funnelen i src/engine/peers.ts, ikke en kopi av den.
> (b) Definisjonene, lag for lag: hva «tatt med» betyr for næringskode og størrelse, for fingeravtrykket, for klassifiseringen alene og samlet, og for de flaggede. Si hvordan et fingeravtrykk uten type, et manglende fingeravtrykk (dokumentet feilet eller ble avvist), uklart og et subjekt uten type telles. Si hva recall måles mot, og hvordan SM-1b skiller seg fra det første laget når kandidatene er trukket fra poolen.
> (c) Regelen for trinn 5: nøyaktig hva som sammenlignes («bare fingeravtrykk» og «fingeravtrykk og tekst», usikker holdt utenfor), at «alle merkede par» er de 180 blinde og de 720 fra andre runde, følsomheten med usikker regnet som ja og som nei, og at de blinde parene rapporteres for seg.
> (d) Båndene: hvordan presisjon og recall «uten båndet» beregnes for andel varekostnad og andel personalkostnad, uten at utvalget i appen endres.
> (e) Rekkefølgen: definisjonene står i den frosne delen, og skriptet og testene (med syntetiske etiketter) er committet før første kjøring på de ekte etikettene. Rapporten nevner commiten. Hvis en feil i skriptet blir funnet etter kjøringen, skal begge resultatene vises, og ingen definisjon endres i det stille.
> (f) Begge utfall: hva som endres hvis trinn 5 ikke beholdes (tekstsignalet av, ingen flagg, ingen grunnlag for treff fra beskrivelsen, testene i test/engine/peers.test.ts, PRD §10), og hva som endres hvis et bånd droppes (fingerprint.ts, sjekken i migrasjonen, regelen for type, det tekniske notatet, derive og ny eksport av seeden).
> (g) seed/coverage.json: oppføringen med report og sha256, og om pnpm seed kjenner feltene i dag.
>
> Regler: ingen klassifisering eller fingeravtrykk per orgnr for fasitsettet, verken i rapporten, i PR-teksten eller i det du skriver ut underveis. Bare totaler. Skriv ikke ut rader fra etikettfilene. Rapporten går til analysis/output/ med dato og skriptets navn, har ingen tallmål (NFR32), og sier at andre runde er merket av en ChatGPT-modell og godkjent av meg, og at ingen andre har merket parene. Ingen modellkall: pnpm classify kjøres ikke. Stopp etter kjøringen og vis meg resultatet før du endrer noe i funnelen eller fingeravtrykket. Hver rad i I/O-matrisen nevner testen som feiler hvis koden fjernes. Små commits. Etter siste seed-lasting kjører du pnpm restore:documents og bekrefter de fire tallene. Kjør hele suiten før første push, og e2e med én worker. Ingen push før jeg sier fra. PR-en skal ha linjen «Planning documents:». Ingen dump slettes.

Meinich, at the checkpoint (verbatim):

> 1. (a): uten bånd betyr båndet utvidet til lav–høy, og regelen er uendret. En type som hang på båndet blir uten type og tas med.
> 2. (a), med to presiseringer. Regelen for bånd brukes på fingeravtrykkslaget (L2) med og uten båndet, ikke på group, så teksten ikke skjuler hva båndet gjør. Tersklene er de samme som for trinn 5, og de fastsettes nå. Regelen gir en anbefaling, men jeg bestemmer, slik FR-13 og det tekniske notatet sier. Går jeg mot regelen, sier rapporten det og hvorfor. Rett epics.md 5.2 i denne PR-en.
> 3. Første runde får hele lagtabellen, med navnet «den strengere lesningen». Den avgjør ingenting.
> 4. Definisjonene i (b) og (c) er godkjent, med tre tillegg: en merket kandidat som ikke er i poolen i dag, telles og rapporteres, og den faller aldri ut i det stille (forventet 0). Et lag uten par med ja eller nei får presisjon «ikke definert», ikke 0. Sammenligningen med 3 pp gjøres med brøker eller src/engine/decimal.ts, ikke med flyttall.
> 5. Hold spec-en samlet.

Meinich, after the first run (verbatim):

> 1. Ja: vis de avgjørende differansene med tre desimaler og som brøk, i en ny commit. Rapporten sier at 2,967 pp blir 3,0 med én desimal. Det er visning, ikke en definisjon.
> 2. Ja: regelen ble satt før resultatet, og trinn 5 beholdes ikke. Slå av tekstsignalet i denne PR-en slik AC-en sier, med tester for hver egenskap, og oppdater PRD §10 og FR-11. register.classification blir liggende. Rapporten kan si at L3 alene hadde best presisjon, men at regelen sammenligner med og uten tekst over fingeravtrykket, og at det ikke endres nå.
> 3. Vent med båndene. Vis meg først, bare som totaler: L1, L2, L3 og group på de 180 blinde parene alene, testen for båndene på de blinde parene, og om verdikten for trinn 5 og for båndene endrer seg med usikker regnet som ja og som nei. Skriv i rapporten at «uten båndet» i praksis ble «uten fingeravtrykk», fordi regelen for type henger på andel varekostnad, og at testen derfor ikke skiller ett bånd fra fingeravtrykket. Ingen definisjon endres.

Meinich, on the bands and the Peers tab (verbatim):

> 1. Båndene: jeg følger anbefalingen i den formen som gir samme gruppe med minst endring. Slå av fingeravtrykkssignalet slik tekstsignalet er slått av (V1_FINGERPRINT_SIGNAL = false), i stedet for å droppe båndene med migrasjon. Fingerprint.ts, båndene, de lagrede fingeravtrykkene og derive blir som de er, så stage 2 kan måle på nytt. Rapporten skal si at jeg bestemte det ut fra regelen og de blinde parene (25,2 % mot 25,1 % presisjon, −35,6 pp recall), og at testen for båndene ikke skiller ett bånd fra fingeravtrykket. Tester for hver egenskap, og mutasjonene skal feile.
> 2. Teksten i appen og EXPERIENCE rettes i denne PR-en, nå for både trinn 4 og trinn 5. Vis meg først hvordan trakten, «Grunnlag for treff», «Hvorfor med», «Merknad» og forklaringen for ✦ blir, med ny tekst, før den står i nb.json og EXPERIENCE.

> 1. Trakten: (a), med denne teksten i peers.funnel.notApplied: «Forretningsmodell og klassifisering ble målt mot et fasitsett og ga ikke klart bedre treff, så de brukes ikke til å velge sammenlignbare selskaper i denne versjonen.»
> 2. Punkt 2–5 er godkjent.
> 3. Oppstrøms er godkjent, med to endringer. FR-ene får ikke historikk lagt til. Den ble tatt ut i retroen (tilbakemelding 4.1). FR-10, FR-11 og de andre skal si hvordan v1 virker: trinn 4 og 5 beregnes og lagres, men velger ikke, avgjort av målingen i Story 5.2. Historikken går i .memlog.md. Legg til et åpent spørsmål i §11 om å måle trinn 4 og 5 på nytt i stage 2 med den andre merkeren. Briefen rettes der den er feil, ikke med en merknad øverst, fordi AGENTS.md sier «edit it. Do not append a correction elsewhere». Addendumet kan få en datert merknad.

Meinich, on the review's intent gap (verbatim):

> (a): behold avgjørelsen, begge av. Rapporten og PRD §9/§10 sier at tekst mot L1 ville bestått (+3,919 pp, −2,370 pp), at sammenligningen ikke var fastsatt før kjøringen, og at gevinsten ligger innenfor støyen. Avgjørelsen følger den fastsatte regelen, og spørsmål 26 fastsetter tekst mot L1 før neste måling.
> Teksten i trakten blir den jeg godkjente. «Ikke klart bedre» stemmer også mot L1, og nyansen hører hjemme i rapporten og på «Slik fungerer Peerless».

## What came back, and what was done with it

### The measurement

Totals only, from `analysis/output/layer-measurement-62100.md`: 900 pairs, 211 ja, 365 nei and 324 usikker.

| Layer | Precision | Recall |
|---|---:|---:|
| L1 industry and size | 36,6 % | 100 % |
| L2 fingerprint alone | 36,6 % | 73,0 % |
| L3 classification alone | 40,6 % | 97,6 % |
| the funnel as built (`group`) | 39,5 % | 74,4 % |

- **Stage 5:** +2,967 pp precision and +1,422 pp recall, so it is not kept.
- **The bands:** both are recommended dropped. Widening a band leaves almost every type undetermined, so the test cannot tell a band from the fingerprint.
- **The verdicts are robust:** none changes on the blind pairs, or with usikker counted as ja or as nei.

### Decisions (Meinich), in order

1. **Stage 5 off,** by the rule fixed before the run (`V1_TEXT_SIGNAL = false`).
2. **Stage 4 off,** by Meinich's decision from the band rule and the blind pairs (`V1_FINGERPRINT_SIGNAL = false`). There is no migration; the fingerprint rule, the bands, the stored data and derive are unchanged.
3. **Text against L1 reported, not used.** The review found it would have passed (+3,919 pp, −2,370 pp), but it was not fixed before the run. PRD question 26 fixes it before the next measurement.

The Peers tab shows three funnel stages and `peers.funnel.notApplied`, with no basis column, no flag column and no ✦ legend. «Hvorfor med» is the base sentence only.

### Contributions from the review session

Each item below is Meinich's decision, made on the review session's recommendation.

- **At the checkpoint: "without a band" as the band widened to low–high, an AI error that was corrected.** The review session recommended this definition, and Meinich adopted it. In the run it measured the whole fingerprint, not the band: the type rule reads the cost-of-goods band first, so widening it leaves almost every type undetermined, and the fingerprint gives no signal for 900 of 900 pairs. The review session pointed this out itself after the run, and the BMAD session noted it when it presented the result. The correction is in the report: the band test is stated not to tell a band from the fingerprint, and Meinich's decision was made on that basis, so no band was dropped on this test.
- **At the checkpoint: the three additions.** A labelled candidate outside today's pool is counted, never dropped silently. A layer without ja or nei has precision "ikke definert", never 0. The 3 pp comparisons are made with fractions or `src/engine/decimal.ts`, never with floats.
- **After the run: the blind-pair figures before the band decision.** It asked for L1, L2, L3 and `group` on the 180 blind pairs, the band test on them, and the verdicts with usikker as ja and as nei, before Meinich decided on the bands.
- **After the run: the fingerprint signal off instead of a migration.** It recommended switching the fingerprint signal off like the text signal, keeping `fingerprint.ts`, the bands, the stored fingerprints and derive, rather than dropping the bands with a migration.
- **On the upstream proposals: two corrections.** The FRs say how v1 works and get no history added, with history in `.memlog.md` (the retro's feedback 4.1). The brief is corrected where it is wrong, not given a note at the top (AGENTS.md: "edit it. Do not append a correction elsewhere").

### Found by the BMAD session

- **Report 1 displayed "+3,0 pp" beside "not kept".** From version 2, the deciding differences carry three decimals and fractions.
- **"Without the band" meant "without the fingerprint".** The type rule reads the cost-of-goods band first, so widening it removes every type.
- **The band decision said "He".** That pronoun came from the BMAD session's own instruction to the subagent. It now says Meinich.
- **Three documents the documentation subagent left wrong.** `docs/key-figures.md` still had stage 4 removing candidates. The brief said "a human has judged" every pair. The AGENTS.md rule said "today cost of goods share and personnel cost share". All three are corrected.

### Accepted from the subagents

- **The script and tests,** committed before the first real run: `e6c0624`, `1d01b6a`, `f54067b`.
- **The report display and the switch-off of both signals,** with a test per property.
- **The Peers tab copy.**
- **The documentation pass:**
  - PRD (FRs state v1 behaviour, with history in `.memlog.md`; §9, §10 and question 26), plus a `(change)` line in `.memlog.md`
  - technical note, `epics.md` 5.2, 5.4 and 5.6
  - the brief, corrected in place, and a dated note in the addendum
  - EXPERIENCE, DESIGN, README and AGENTS.md

### Corrected in review

The spec's triage log has 19 findings: 16 patched, 1 rejected and 2 decided by Meinich. Each finding is credited to the layer that made it:
- **The lost baseline for the stage-5 rule (Blind).** Decided by Meinich, on the review session's recommendation.
- **The band decision printed whatever the verdicts (Blind).** It is now gated on the verdicts.
- **Missing subject-level coverage and a noise statement (Blind).**
- **v1 hard-coded apart from `V1_FUNNEL` (Blind, Edge case).** The funnel component and the rows now follow the options.
- **The dirty-tree guard, `FACTS_SQL` and the e2e "whole pool" check (Verification gap, Blind, Edge case).** All three passed with their guards removed. They now have tests that fail.
- **An unknown document status counted silently (Edge case).**
- **Unused v1 code.** Two `deferred-work.md` entries, owned by Story 4.4 and PRD question 26.

### Deferred

- `AiMark` and `peers.ai`, to Story 4.4.
- The unrendered stage-4/5, basis and flag keys and `matchBasis`'s outside callers, to PRD question 26.
- The 2.5d deferred entry is closed with the fingerprint counts.

## Verification

Run on a database holding only the seed (loaded twice and re-exported without a diff):
- lint, typecheck, `check:pins`, `check:env` and `check:routes` clean
- `pnpm test`: 1 393 tests
- `pnpm test:db`: 197 tests
- `pnpm test:ingest`: 392 tests
- `pnpm test:e2e` (one worker): 159 of 159 in 5,5 min, with no memory stop and no synthetic company left behind

The report was regenerated four times on the restored dump; no table value or verdict moved between versions. After the last seed load, `pnpm restore:documents` printed 2 785 documents, 5 556 columns, 2 537 fingerprints and 10 371 classification rows, and `.local/document-run-2.5d/` was intact. `pnpm classify` was not run, and no model was called.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-5-2-layer-by-layer-measurement.md` (definitions, I/O matrix, change log, triage log)
- Report: `analysis/output/layer-measurement-62100.md` (version 4, `4397498`)
- AI log: "2026-11-15 — Story 5.2: the layer measurement, and stages 4 and 5 switched off in v1"
- Planning documents updated: the PRD (with a `.memlog.md` change line), the technical note, `epics.md`, the brief and its addendum, EXPERIENCE, DESIGN, README, AGENTS.md, `docs/key-figures.md`, `deferred-work.md`
