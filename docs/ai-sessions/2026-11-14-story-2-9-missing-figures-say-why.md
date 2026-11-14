# Story 2.9: missing figures say why

**Date:** 2026-11-14
**Tool:** Claude Code (Opus 5.5): the BMAD session (`bmad-build`), an implementation subagent dispatched by it, a subagent that recompiled the Epic 2 context, and three review subagents
**Story / issue:** #60, Story 2.9 (FR-21, FR-23, FR-55, FR-56, FR-71)
**Result:** [PR #61](https://github.com/IBE160-2026/G97-meinich/pull/61), commits `dec1b33` to `d68a47e` on `story/2.9-missing-figures-reasons`

## Goal

Give every missing figure one absence reason, decided in the engine and shown through one exhaustive switch, so that an unreadable filing, an undefined ratio or a thin group is never read as zero. Decide each company's document basis from the loaded manifest, the filing year and the stored statuses, and show a slate subline in the header when the subject's own document cannot be used. The document rows that render the reasons come with Epic 3.

## Prompts that mattered

Meinich, opening the session (verbatim):

> /bmad-build Story 2.9: Missing figures say why (epics.md, Story 2.9). Lag branchen story/2.9-missing-figures-reasons fra origin/main, og opprett issuet.
>
> Stopp ved sjekkpunktet før du endrer kode, og vis meg:
> (a) Fraværsgrunnene: Absence i src/engine/types.ts har i dag seks grunner (undefined, below_floor, not_in_dataset, failed_reconciliation, not_reconciled, exceeds_api_subtotal), og storyen nevner fem, med «ikke lest i v1» som ny. Vis den fulle unionen etterpå, og hvilken EXPERIENCE-tilstand hver grunn går til gjennom den uttømmende switchen. Foreslå særlig hva not_reconciled og exceeds_api_subtotal skal vise, og hvorfor.
> (b) De tolv dokumenttallene: hvilke er de, og hva finnes i motoren før Story 3.1a? Si nøyaktig hva 2.9 leverer (motorens resultat og undertittelen i overskriften) og hva som venter til Epic 3.
> (c) Avledning: hvor i src/engine langsiktigGjeld utledes fra sumGjeld og sumKortsiktigGjeld, at ingen avledning skjer i steg 1 (testen over dokumenttabellen), og at et tall som ikke kan utledes, er undefined, aldri 0.
> (d) Subjekt med failed_reconciliation: hvilket selskap brukes i e2e-testen og på 375 og 320 px? Et demoselskap, et selskap fra seeden som ikke er i fasitsettet, eller et syntetisk selskap? Vis at det beholder fanene og peer-gruppen og ikke vises som udekket.
> (e) not_in_dataset: at grunnen avgjøres fra manifestets document_figure_orgnrs og aldri fra en manglende rad, og hva demo A og B viser i den committede seeden før Story 5.4.
> (f) Peers med failed_reconciliation: at de går ut av fordelingen for hvert dokumenttall, men teller for API-tallene, og at antallet utelatte returneres.
> (g) Norsk tekst: all ny tekst som ikke står ordrett i Story 2.9, særlig tilstanden for «ikke lest i v1» og eventuelle tilstander for de to ekstra grunnene. Vis meg den før den står i nb.json og EXPERIENCE.
>
> Regler: hver rad i I/O-matrisen nevner testen som feiler hvis koden fjernes. Eksempler og testdata kommer fra demoselskapene eller syntetiske selskaper. Tester som bruker andre subjekter, sammenligner bare totaler og navngir ingen selskaper fra fasitsettet. PR-en sier hva som kan gå galt med fraværsgrunner og utledede komponenter i pengetall, med begrunnelse i ai-log. Små commits, sjekk på 375 og 320 px underveis, hele suiten før første push. Kjør e2e med --workers=1. Hvis den stopper på grunn av minne, si fra i stedet for å starte på nytt. Etter siste seed-lasting: gjenopprett .local/document-run-2.5d/, kjør pnpm derive og bekreft 2 785 dokumenter, 5 556 kolonner, 2 537 fingeravtrykk og 10 371 klassifiseringsrader. Ingen push før jeg sier fra. PR-en skal ha linjen «Planning documents:». pnpm classify kjøres ikke, og ingen dump slettes.

Meinich, answering the six open questions (verbatim):

> Fra meg:
> 1. A.
> 2. A, med ett krav: teksten for line_exceeds_api_subtotal sier at en regnskapslinje ikke kunne leses sikkert, ikke at den mangler.
> 3. B. Rett AC-en i epics.md i denne PR-en.
> 4. A, med disse kravene: testen rydder både før og etter seg (idempotent, så en krasj ryddes neste gang), det syntetiske orgnr-et står på ett sted, omsetningen ligger utenfor båndene til demo A og B så selskapet aldri havner i en annen tests gruppe, og prosjektet kjører sist. Dette bryter AGENTS.md («The database tests also create objects, but only inside transactions they roll back»), så endre AGENTS.md i samme PR og si hvorfor. Bekreft til slutt tallene i databasen som vanlig.
> 5. Ikke A. Review-sesjonen fant at det skjer i den committede seeden: 1 av 20 selskaper i manifestet mangler dokumentrad for sitt siste regnskapsår, og lokalt 1 av 1 168. En kastet feil gir 500 for det selskapet og for alle som har det som peer. Finn ut hvorfor raden mangler (bare totaler, ingen orgnr fra fasitsettet), og foreslå enten en egen grunn med egen tekst eller vis at en eksisterende grunn dekker det ærlig. «Kunne ikke leses sikkert» stemmer ikke for et dokument som aldri ble lest. Vis meg det før du går videre.
> 6. Teksten svarer jeg på når jeg har sett den.

Meinich, on the missing-row proposal and the copy (verbatim):

> Fra meg:
> Ja til forslaget: not_read_in_v1 med scope (notes, filing_year, paper), refused, document_missing med logglinje, og de åtte toppgrunnene. Rett grunnlisten i epics.md og AD-15 i denne PR-en. AD-15 skal si at document_missing er det eneste tilfellet som avgjøres av en manglende rad, og hvorfor.
>
> Teksten er godkjent, med to endringer:
> - notReadInV1.filingYear: «I denne versjonen leser Peerless årsregnskapene for {fra}–{til}. Regnskapet for {aar} er ikke lest.»
> - document_missing får også undertittel i overskriften, samme tekst: «Regnskapet for {aar} er ikke lest inn».
> Undertittelen «Regnskapet for {aar} er ikke lest i denne versjonen» for filing_year og paper er godkjent.
>
> Krav:
> - Logglinja for document_missing går gjennom src/logger.ts med de faste feltene.
> - DOCUMENT_YEARS står på ett sted motoren leser, og en test feiler hvis den og run.py er ulike.
> - I/O-matrisen får rader for filing_year (syntetisk selskap med avvikende regnskapsår), refused, paper og document_missing, hver med testen som feiler hvis koden fjernes.
>
> Svarene mine på 1–4 fra forrige runde gjelder. Skriv alt inn i spec-en og vis den før godkjenning.

Meinich, approving (verbatim):

> Fra meg:
> To tillegg før godkjenning, i den låste delen under beslutning 7:
> - Tilkoblingen som databaseeier i e2e-testen kommer fra en miljøvariabel, og testen nekter å kjøre hvis verten ikke er lokal (localhost/127.0.0.1). Ingen ny hemmelighet i noen commit, og .env.example viser variabelen uten passord.
> - Det syntetiske selskapet heter noe som tydelig sier at det er syntetisk, for eksempel «Syntetisk Testselskap AS», så det er lett å forstå hvis søket finner det etter en krasj.
>
> Deretter: godkjenn og fortsett. Samme regler som før: små commits, sjekk på 375 og 320 px, hele suiten før push, e2e med --workers=1, gjenopprett 2.5d-dumpen og kjør derive til slutt, og ingen push før jeg sier fra.

Meinich, on `.env.example` during review (verbatim):

> Fra meg:
> Behold SUPABASE_DB_URL slik den er. postgres:postgres er Supabase CLI-ens offentlige standardverdi for den lokale databasen og ingen hemmelighet, og en ny klone skal virke uten å fylle inn noe. Det som beskytter, er at testen nekter å kjøre hvis verten ikke er localhost/127.0.0.1. Rett formuleringen i beslutning 7 under Spec Change Log (min beslutning, etter forslag fra review-sesjonen), og fortsett.

The BMAD session dispatched the spec to the implementation subagent with the bmad-build handoff, adding one rule: commit in small steps, never push, never run `pnpm classify`, never delete anything under `.local/`.

## What came back, and what was done with it

- **Found by the BMAD session before the checkpoint:**
  - `undefinedText` in `src/analysis/figure-text.ts` wrote every reason other than `undefined` as "en regnskapslinje mangler". That was a silent fallback.
  - No key figure reads `langsiktigGjeld`, and it is not a document field, so the AC's test would have needed dead code. This became question 3, and the AC was corrected.
  - The seed's only failed 2025 document belongs to a labelled-set company, so the e2e subject had to be synthetic (question 4).
  - The manifest's `document_figure_orgnrs` holds only the 20 OCR reference orgnrs, so demo A and B are `not_in_dataset` until Story 5.4.
- **The missing row (question 5).** The review session found that one listed company has no document row for its latest filing year. The BMAD session traced it, with totals only: the company has a non-calendar year whose filing year, 2026, falls outside step 1's `DOCUMENT_YEARS`. The same company is the one missing row locally, out of 1 168. The local database also holds 7 `not_extracted` documents: 3 refused on reporting unit and 4 on year header. These findings gave the scopes `filing_year` and `paper`, the reason `refused`, and the one reason decided from a missing row, `document_missing`.
- **Decisions at the checkpoint (Meinich):**
  - The engine returns an absence or "read", and Story 3.1a fills in the formulas.
  - There are eight reasons. `exceeds_api_subtotal` becomes input-level, and a figure that reads such a line is `undefined`/`line_not_read_safely`, "en regnskapslinje kunne ikke leses sikkert".
  - The derivation test uses the document's `sumDriftsinntekter`.
  - A synthetic e2e subject is committed by the one test allowed to, with the AGENTS.md exception.
  - The copy is approved with two changes.
- **Accepted from the subagent** (`3b524e7` to `27022ad`): the engine, the switch, the step-1 write test, the copy, the request path and subline, the synthetic e2e project, and the docs upstream (AD-15, `epics.md`, `docs/key-figures.md`, the PRD's FR-23 and FR-71).
- **Corrected in review** (`c5a6a72`; spec triage log, 21 findings, 14 patched, 7 rejected). Each finding is credited to the review layer that made it:
  - Revenue growth with a failed prior column read "Regnskapet for 2025 …", the wrong year (Blind).
  - The e2e cleanup deleted orgnr 999999905 whatever company held it (Edge case, Blind).
  - `analysis.documentMissing` was logged per company per request (Edge case, Blind).
  - No test ran `document_missing` through the real queries (Verification gap).
  - A missing `register.dataset` row was a silent `not_in_dataset` (Edge case, Blind).
  - A crashed run's synthetic company could reach the next run's other projects. The BMAD session found this, and the fix is a global-setup cleanup.
  - Plus the documentation gaps: AD-16, the 3.1a 5 kr bound, the Epic 2 context and the README.
- **Rejected in review:**
  - An unknown stored status throwing. The CHECK constraint makes it unreachable.
  - A missing `default` in `documentFigureAbsence`. Its return type is exhaustive.
  - A `?host=` bypass. It needs the developer's own `.env`.
  - The synthetic project skipped after another failure. The run is red anyway.
  - The `.env.example` password. That was decided by Meinich.
  - An unmeasured candidate query. `peer-assembly-time` ran with it.
  - An alias typo yielding `undefined`. `parseOre` throws on it.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-9-missing-figures-say-why.md` (decisions, I/O matrix, change log, triage log)
- AI log: "2026-11-14 — Story 2.9: absence reasons and a derived component in money figures"
- Planning documents updated: technical note AD-15 and AD-16, `epics.md` Stories 2.9 and 3.1a, the PRD's FR-23 and FR-71 (with a `.memlog.md` change line), EXPERIENCE, `docs/key-figures.md`, AGENTS.md, README
