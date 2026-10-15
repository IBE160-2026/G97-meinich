# Prompts: how the AI sessions were steered

This file records the prompts the human sent to the AI, verbatim, from Story 1.3a on, and what each one changed in the repository. It complements `docs/ai-sessions/` (one summary per session) and `docs/ai-log.md` (lessons).

## How the work is set up

Two Claude Code sessions run side by side on the same repository:

- **The BMAD session** (a terminal running `claude`) does the work: `/bmad-build` writes the spec, hands it to an implementation subagent, runs three reviewers, and stops for the human at every decision point: spec approval, open questions, push.
- **The review session** (Claude Code in the desktop app) does no story work. The human pastes the BMAD session's output into it, asks what to do, and gets a recommendation. The review session reads the spec, the diff and the database on its own before answering. The human decides, and pastes the instruction they chose back into the BMAD session.

The prompts in the BMAD session below are therefore mostly drafted in the review session and approved by the human. That is deliberate: one AI checks another, and a person decides what goes through. Where a finding came from the review session rather than from the human's own reading, this file says so.

## How this file is produced

Claude Code stores every session as a local transcript (`~/.claude/projects/<project>/<session>.jsonl`). After each story, the human's prompts are extracted from both sessions with their timestamps (UTC). Pasted BMAD output in the review session is shortened to a note in brackets. Menu choices made with the arrow keys are not in the transcript and are noted where they mattered. Before committing, the text is checked for passwords, connection strings, keys and personal data.

---

## Story 1.3a: batch step 1 ingests register data (#3, PR #17)

### Prompts to the BMAD session

**2026-10-11 09:22**
```
/bmad-build Story 1.3a, issue #3
```

**09:29**: answers to the spec's three open questions, plus one correction the spec had not asked about.
```
1: (b), fast etikett api_whole_units. Ikke gjett enheten. Hvis vi senere trenger
å vite hvor presise beløpene er (f.eks. for avstemming mot dokument i Epic 2),
regnes det ut der det trengs, ikke lagres som om det var et faktum fra registeret.
Rett kriteriet i epics.md, issue #3 og docs/data-sources-brreg.md.
Parse beløp som heltall, ikke float, og avvis beløp som ikke er hele tall.

2: (a) KANTALL AS, 967 534 579.

3: Behold spec-en hel.

I tillegg: nøkkelen på register.filing må inneholde regnskapstype, ikke bare
orgnr + periode. Ellers kolliderer selskaps- og konsernregnskap for samme år.
Bekreft hvordan det er løst i spec-en.

Ingen push/PR før jeg har sett grenen, som i 1.2.
```
*Changed:* the AI recommended (a), inferring the reporting unit from the amounts. This was rejected for a fixed label, because an inferred unit looks like a register fact and would be trusted later. The filing primary key gained `regnskapstype`; without it, company and group accounts for the same year would have overwritten each other silently. Amounts are parsed with `Decimal`. All of this is in the spec, `1340608`.

**09:32**: approval, with two additions after the review session read the spec.
```
Godkjent, med to tillegg i spec-en før du starter:
1. Hvert regnskap skrives i én transaksjon: filing og key_figures sammen,
   eller ingen av dem. Legg til en testrad der skrivingen av key_figures
   feiler og filing-raden ikke blir stående.
2. En test som feiler hvis en avhengighet i ingest/pyproject.toml ikke er
   pinnet med ==, siden check:pins bare leser package.json.
Approve and continue.
```
*Changed:* atomic writes per filing, with a test, and `ingest/tests/test_pins.py`. Neither was in the AI's spec.

**09:59**
```
Underagenten er ferdig – rapporten ligger i agent-resultatet. Ingest-kjøringen
tar ca. 2 timer (17 556 selskaper). Ikke vent på den: gjør diff-gjennomgang,
sjekkene og de tre reviewerne nå, og la kjøringen gå i bakgrunnen. Ikke kjør
db:reset før kjøringen er ferdig, det sletter dataene den skriver.
```
*Changed:* the BMAD session believed it was still waiting for its subagent. The review session saw that the subagent had finished and that the session's own plan included `db:reset`, which would have wiped the running ingest.

**10:04**
```
Ingest-containeren kjører på koden fra før review-rettelsene. Når du
oppsummerer: si eksplisitt om noen rettelse endrer parse, write eller
fetch. Hvis ja, må pnpm ingest kjøres på nytt med det nye imaget (gjerne
bare for KANTALL og et par hundre selskaper) før PR – ellers beskriver
akseptansekriteriet en kjøring av kode som ikke lenger finnes.
```

**10:06**: the AI then proposed a new `--limit` option and a second, partial run. This was rejected:
```
Hva tenker du om dette da?

Endring i planen: stopp den pågående kjøringen (stoic_wilbur) nå – den kjører
kode som erstattes. Ikke legg til --limit. Fullfør review-rettelsene, bekreft
fra diffen at parse.py og write.py er uendret, og kjør test:db og alle sjekker
mens databasen er fri. Kjør deretter pnpm ingest fullt på det endelige imaget,
og bruk den kjøringen i oppsummering, session-fil og PR. Stopp før push.
```
*Changed:* the pre-fix run was stopped and discarded. The AI added a database reset, and the human accepted it ("option 1", 12:10). The acceptance run was one full run on the final image `79cde8e`.

**14:32**: after the review session checked the counts against the database and queried the data itself.
```
Jeg har sjekket tallene mot databasen – de stemmer. To funn fra dataene
som må dokumenteres før push:
1. 105 regnskaper har negativ sumEiendeler (f.eks. 930115746/2025,
   -6 186 121 kr); i 86 er sumEgenkapitalGjeld lik og like negativ –
   registeret leverer det slik. Legg det inn i docs/data-sources-brreg.md
   som verifisert funn, og en post i deferred-work.md for Story 1.4/1.7:
   engine og peer-utvalg må håndtere det eksplisitt.
2. valuta = 'EDT' (ikke ISO) på 920835252 for 2023 og 2024. Samme doc.
La commit 1f98702 være som den er. Commit dette, push grenen og opprett
PR-en (Closes #3), med de to funnene nevnt under kjente begrensninger.
```
*Changed:* `8e1d2fa`. Both findings were recorded and carried into Story 1.4: SIGMA DATA SOLUTIONS, with negative assets, became one of its reference cases. Neither finding came from the BMAD session or its three reviewers. Both came from the review session querying the loaded data.

### The human's own questions in the review session

Besides pasting BMAD output: "hva skal jeg skrive til terminalen?", "Jeg kjører i terminalen med claude for bmad rammeverket", "hvordan får jeg til at maskinen ikke går i dvale?" (the run took 3.5 h), "okei hva er steget videre nå".

### Merged without review

PR #17 was merged before a review was written. The review comment was added afterwards, and from Story 1.4 on the review is written before merging.

---

## Story 1.3b: the seed path, export, load and CI (#4, PR #18)

### Prompts to the BMAD session

**2026-10-11 14:38**
```
/bmad-build Story 1.3b
```
The two open questions were answered from the menu: plain CSV over gzip (diffable, and git compresses anyway), and keep the spec whole.

**14:47**
```
Godkjent, med to tillegg i spec-en før du starter:
1. Eksporten sorterer med ORDER BY … COLLATE "C" på tekstkolonner, så
   rekkefølgen – og dermed checksummene – ikke avhenger av databasens
   collation. Legg til en testrad i matrisen.
2. Dokumenter i README "Seed" og AD-16 hva som skjer når en senere story
   legger til en migrasjon: seeden blir ugyldig, og den må re-eksporteres
   i samme PR (migration up på en lastet database, så seed:export). Beskriv
   også hvordan man kommer seg ut hvis den lokale databasen er tom – uten
   å måtte kjøre hele ingest på nytt, hvis det går.
Approve and continue.
```
*Changed:* collation-independent sort order, and the re-export and recovery procedure in README "Seed" and AD-16. The spec had neither, and without the second, the first later migration would have turned CI red with no documented way out.

**15:24**: the review session ran `pnpm test:ingest` against the seeded database and found two failures.
```
To ting før push:
1. pnpm test:ingest feiler nå lokalt mot den seedede databasen (2 feilet:
   test_run_reports_a_non_whole_amount_and_writes_the_rest og
   test_run_rolls_back_a_failed_filing_and_continues) fordi de antar tomme
   register-tabeller. Rett testene i stedet for å flytte CI-steget: bruk et
   orgnr/brreg_id som ikke finnes i seeden, eller sammenlign før/etter
   innenfor transaksjonen. Begge må bestå både på tom og på seedet database.
   Sett CI-rekkefølgen tilbake til spec-en (seed rett etter test:db), så CI
   faktisk kjører step-1-testene mot en lastet database.
2. Deretter: push og opprett PR-en for issue #4. Nevn postgres.js-patchen
   under kjente begrensninger.
```
*Changed:* `a92f9c3`. The BMAD session had made CI green by moving the seed steps after the step-1 tests, which hid the failure. Anyone following the README would have got red tests. The tests were fixed instead, and CI was restored to the spec's order. When the BMAD session asked whether to trust pasted messages for the rest of the session, the human chose "Yes, and trust pastes".

---

## Story 1.4: the engine calculates and formats correctly (#5, PR #19)

### Prompts to the BMAD session

**2026-10-12 18:11**
```
/bmad-build Story 1.4, issue #5
```

**18:20**
```
1: (a). Begrunnelse som skal stå i key-figures.md: et utledet tall arver
avrundingsusikkerheten fra totalene det er regnet ut fra, så et utledet
beløp innenfor ±5 kr av null kan ikke skilles fra null. Grensen gjelder
bare utledede tall – et oppgitt tall brukes som det er.
Legg til i deferred-work for Story 1.7: selskaper med null eller nesten null
omsetning (4 268 regnskaper i seeden) er sovende og bør ikke være peers i
det hele tatt – det er et utvalgsspørsmål, ikke et engine-spørsmål.

2: Behold spec-en hel.

I tillegg:
- Valuta: deferred-work fra 1.3a nevner Story 1.4 for ukjent valuta
  (EDT). Forholdstallene er valutanøytrale, men formatKroner skriver "kr".
  Si eksplisitt i spec-en hvor valutasjekken hører hjemme (1.7 eller 1.8),
  og oppdater deferred-posten så den ikke peker på 1.4 uten at noe skjer.
- Referansecasene: skriv utregningen for hver case i testfila som kommentar
  (tall i kroner, steg for steg), så jeg kan kontrollregne minst én for
  hånd før merge.
```
*Changed:* the ±5 kr bound has a stated reason in `docs/key-figures.md` and applies only to derived figures. The currency check is assigned to Stories 1.7 and 1.8 instead of being left on 1.4, where nothing would have happened. The reference cases show their working step by step.

**18:26**: `Approve and continue`

**18:48**: `Push og opprett PR-en som lukker #5.`

### Checks before merging

The review session read the reference cases against the seeded database and recomputed four quotients independently: TRACSENSE 2020, and BMC SOFTWARE 2025's margin, ROA and equity ratio. All matched. The human then recomputed TRACSENSE AS 2020 by hand (−1 150 973 / 3 174 472 = −36,3 %) and posted the review on PR #19 before merging.

---

## Story 1.5 split, and Story 1.5a: step 1 stores what search shows (#20, PR #21)

### Prompts to the BMAD session

**2026-10-14 19:30**
```
/bmad-build Story 1.5, issue #6
```

**19:42**: four questions from the spec, answered by typing into the menu. The review session drafted each answer.

*Data gap.* `register.company` had no municipality or industry name. The AI recommended a companies-only refresh.
```
1, med to krav:
- Oppdateringen fyller bare de nye kolonnene på selskaper som allerede
  finnes i register.company. Den legger ikke til og sletter ikke selskaper,
  så selskapssettet fortsatt passer med regnskapene fra 1.3a. Oppsummeringen
  sier hvor mange som ikke ble funnet i bulkfilen.
- Verdiene lagres som registeret leverer dem (kommunenummer og kommunenavn
  fra forretningsadresse, næringskodens beskrivelse), og migrasjonen
  re-eksporterer seeden i samme PR, slik README "Seed" beskriver.
```

*Demo links until Story 5.4.*
```
1, med krav: begge selskapene har et SELSKAP-regnskap i NOK for 2025 med
alle tre API-nøkkeltall beregnbare (ingen negativ sumEiendeler, omsetning
over null). Oppgi orgnr, navn og hvorfor de ble valgt i en kommentar i
src/demo-companies.ts, og at de er midlertidige til Story 5.4.
```

*Header search.*
```
1, med krav: den kompakte varianten har en egen test nå (rendrer, har
label, sender samme søk), og deferred-work-posten peker eksplisitt på
Story 1.6b som stedet der den monteres. Hvis akseptansekriteriet i
epics.md sier at headersøket er en del av 1.5, oppdater det så planen
og koden sier det samme.
```

*Spec size.* The AI recommended keeping the spec whole, as in 1.3b and 1.4. The answer was to split it, because here the data change can be merged and tested without the search page, and one PR mixing Python, SQL, seed data and UI would be hard to review.
```
2, som 1.5a og 1.5b etter samme mønster som 1.3a/1.3b:
- 1.5a: migrasjonen, companies-only-oppdateringen i step 1 og
  re-eksport av seeden. Eget issue, egen gren og egen PR.
- 1.5b: API og søkesiden, med resten av 1.5 sine akseptansekriterier.
Oppdater epics.md, sprint-status.yaml og issue #6 (som blir 1.5b, med et
nytt issue for 1.5a), og skriv i begge spec-ene hvorfor den ble delt.
Start med 1.5a.
```
*Changed:* the planning commit `a5ccd6d` on `main` has new issue #20 for 1.5a, issue #6 rewritten as 1.5b, and `epics.md` with both stories and the reason for the split. Story 1.6b mounts the header search.

**19:47**: approval of the 1.5a spec, with three changes after the review session read it.
```
Godkjent, med tre endringer før du starter:
1. register.immutable_unaccent kaller unaccent med fullt skjemanavn på
   både funksjon og ordbok (f.eks. extensions.unaccent('extensions.unaccent', $1)),
   så resultatet ikke avhenger av search_path.
2. read_at skal ikke beskrive verdier lest senere. Legg til en egen kolonne
   (f.eks. location_read_at timestamptz) som --companies-only setter for de
   tre nye feltene; en vanlig step-1-kjøring setter den lik read_at.
   read_at, navn og regnskapene forblir urørt.
3. Rett delivery-order-linjen ("step N of 12") i de åpne issuene #7 og
   utover så de stemmer med splitten, som del av planleggingscommiten.
Commit planleggingsendringene til main før du lager grenen for 1.5a.
Approve and continue.
```
The BMAD session asked whether the pasted text was really from the human. The answer was: `Ja det er fra meg, kjør`.

*Changed:* the spec itself said the three new values would be "read later than `read_at` says", which is a false read date. They now carry their own `search_fields_read_at`. The wrapper is schema-qualified, and the open issues match the new delivery order.

**20:16**: the implementation found that the spec's grant was wrong. Postgres evaluates an index expression as the role that writes the row, so `ingest` and `loader` also need EXECUTE on the wrapper. The answer, from the menu, was "Accept the wider grant", recorded in the spec's locked section with the reason. A test pins the exact set of roles.

**20:22**: before push, after the review session queried the refreshed data.
```
Fra meg: én ting før push.
920768695 KIRKEBY GÅRDSDRIFT har naeringskode1 62.100 men
naeringskode1_beskrivelse "Produksjon av møbler" – beskrivelsen er for
registerets nye kode, ikke den lagrede. Lagre beskrivelsen bare når
registerets naeringskode1 er lik den lagrede; ellers NULL, og nevnt i
oppsummeringen. Legg til en test for det. Kjør --companies-only på nytt,
re-eksporter seeden, og sjekk at bare den raden endret seg.
Sørg også for at spec-en for 1.5b sier at 504 selskaper mangler kommune
og at søkeresultatet må vise dem uten.
Deretter: push main (planleggingscommiten a5ccd6d) først, så grenen, og
opprett PR-en for #20. La CI kjøre build og e2e.
```
*Changed:* `b2c90e9` and `e43af18`. The refresh had stored the name of the register's new industry code (31.000, furniture) next to the old stored code, 62.100. Neither the BMAD session nor its reviewers had caught it. The review session also checked that the ten original columns of `company.csv` are byte-identical to `main`, row by row, so the diff of 17 558 changed lines is only the added columns.

### Checks before merging

The human posted the review on PR #21 before merging (comment 20:33:58, merge 20:34:12).

---

## Story 1.5b: find a company by name or organisation number (#6, PR #22)

### Prompts to the BMAD session

**2026-10-15 19:00**
```
/bmad-build Story 1.5b, issue #6
```

**19:04**: answers to the spec's open questions on the front-page copy, the industry name and capital letters.
```
Fra meg:
Behold spec-en hel.
1: Godta teksten, men ingressen skal ikke skrive antallet bransjer inn i
   teksten ("én bransje"). Bruk f.eks. "Peerless dekker foreløpig
   {industry}." så den stemmer også når dekningen vokser.
2: (a). Rett akseptansekriteriet i epics.md og issue #6 så det sier at
   bransjenavnet kommer fra registeret.
3: (b). Omgjøringen skjer bare ved visning; databasen beholder registerets
   verdi. Test med bindestreksnavn (AURSKOG-HØLAND → Aurskog-Høland) og
   flerspråklige navn (PORSANGER - PORSÁŊGU - PORSANKI → Porsanger -
   Porsáŋgu - Porsanki, KÅFJORD - GÁIVUOTNA - KAIVUONO).
```
*Changed:* the AI's proposed lead, "Foreløpig dekker Peerless én bransje: {industry}.", wrote the number of industries into the copy, and would have gone wrong as coverage grew. Municipality casing is display-only, and tested on the Sámi-language and hyphenated names.

**19:06**: approval, with two additions after the review session read the spec.
```
Fra meg: godkjent, med to tillegg i spec-en før du starter:
1. /api/sok validerer på serveren: q over 100 tegn gir 400 uten å spørre
   databasen, og et ni-sifret orgnr sjekkes med mod 11 også der. Legg
   begge til i matrisen.
2. Hvis søket bruker LIKE/ILIKE, escapes % og _ i brukerens tekst. Test at
   søket "%" ikke gir alle selskaper.
Approve and continue.
```
*Changed:* the first endpoint open to users had no length limit on input and no server-side orgnr check, and a search for "%" would have matched every company. Both are now in the spec's matrix and tested.

**19:29**: the BMAD session reported, on its own, that its first browser test for "%" passed for the wrong reason: a one-character query returns nothing before any SQL runs. The review session suggested the replacement inputs.
```
Fra meg: bruk "%%" (eller "_%") i browser-testen, så søket kommer forbi
minstelengden på to tegn og faktisk treffer escapingen. Nevn i PR-en at
den første versjonen av testen besto av feil grunn.
```

**19:39**: before push.
```
Fra meg: før push, rett den gamle bransjeteksten nå i stedet for å utsette
den: FR-4, UX-DR41, UX-DR42, UX-DR43 og 1.6b-kriteriene i epics.md,
epic-1-context.md og State Patterns i EXPERIENCE.md skal si at
bransjenavnet og koden kommer fra registeret (som i 1.5b), ikke ha
"programmeringstjenester (62.100)" som fast tekst. Fjern deferred-posten.
Push deretter og opprett PR-en for #6. Nevn i PR-en: demolenkene er
midlertidige til 5.4, lenkene som gir 404 til 1.6a/1.6b, at CI-rekkefølgen
er endret og hvorfor, og at den første "%"-testen besto av feil grunn.
```
*Changed:* `2cc79c7`. The AI had deferred the stale planning text to Story 1.6b, but UX-DR42 and UX-DR43 describe states that this story builds, so the plan and the code disagreed on the PR's own content.

**19:42**: the PR, the AI log and the session file had credited the "%" finding to the human.
```
Fra meg: to rettelser.
1. "%"-funnet er feil kreditert i PR #22, docs/ai-log.md (linje ~356, punkt c)
   og session-fila. Det var du (BMAD-sesjonen) som fant at testen besto av
   feil grunn, under din egen testkjøring. Review-sesjonen foreslo bare
   "%%"/"_%" og at det skulle nevnes i PR-en. Skriv det slik alle tre steder.
2. Ja, oppdater issue #8 så den sier at bransjenavnet kommer fra registeret,
   som epics.md.
```
*Changed:* `aad6eee`. Credit now matches what happened, and issue #8 matches `epics.md`.

### Checks before merging

The human posted the review on PR #22 at 19:45:15 and merged at 19:45:22, before the PR's CI run had finished. The two earlier runs had been cancelled by newer pushes. The run on `aad6eee` finished green at 19:47:48, so build and e2e did pass, but only after the merge. From now on, the merge waits for a green check.

---

## Story 1.6a: one module reads and writes the analysis URL (#7, PR #23)

### Prompts to the BMAD session

**2026-10-15 19:50**
```
/bmad-build Story 1.6a, issue #7
```

**19:53**: answers to the spec's two open questions.
```
Fra meg:
Behold spec-en hel.
1: (a), men isCandidate er en ferdig lukket funksjon fra den som kaller:
   (peerOrgnr: string) => boolean. parse skal ikke vite hvordan poolen
   bygges (bånd e.l.) – det avgjør 1.7 inni funksjonen. 1.6b sender
   en dokumentert "godta alle" til 1.7 finnes.
2: (a). Ukjente parametre ignoreres uten melding, og forsvinner når URL-en
   skrives kanonisk. Test med fbclid og utm_source.
```
*Changed:* the AI proposed `isCandidate(orgnr, { orgnr, band })`, a signature that guessed what Story 1.7 needs to decide pool membership. It is now a closed `(peerOrgnr) => boolean`, so `parse` knows nothing about how the pool is built. Tracking parameters on shared links never trigger the invalid-settings notice.

**19:57**: approval, with one case the spec's matrix lacked.
```
Fra meg: godkjent, med ett tillegg i matrisen før du starter:
en ekskl-verdi lik orgnr-et i stien (selskapet selv) droppes og setter
flagget, uavhengig av isCandidate. Test det.
Approve and continue.
```
*Changed:* `9e77cff`. Until Story 1.7, 1.6b passes an accept-all `isCandidate`, so without this a URL could have excluded the subject from its own peer group and kept that in the canonical URL. `parse` now drops it (`src/url/analysis-state.ts`), tested even when `isCandidate` accepts it.

**20:17**: the BMAD session flagged that its own AGENTS.md sentence ("falls back to its default") did not describe what the code does, and offered to fix it later.
```
Fra meg: rett AGENTS.md-setningen i denne PR-en, så den sier nøyaktig hva
som skjer: en avvist ekskl-verdi droppes, en ukjent fane blir Oversikt,
ukjente parametre ignoreres, øvrige ugyldige verdier faller tilbake til
standard. Push deretter og opprett PR-en (Closes #7, FR-69).
```
*Changed:* `85a3d69`. Fixed in the same PR, because the next story reads that sentence.

During the review the BMAD session asked to read its own diff file in the system temp folder. The human allowed that single read ("Yes, but ask again next time") rather than a standing permission to read outside the project.

### Checks before merging

The human posted the review at 20:21:08. CI on `75e8730` finished green at 20:24:31, and the PR was merged at 20:24:42.

---

## From Story 1.5 on

After each merged story, and after planning or documentation work committed straight to `main`, the prompts from both sessions are added here in the same form: verbatim, with what changed and the commit or PR it landed in.
