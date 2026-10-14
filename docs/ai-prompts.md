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

## From Story 1.5 on

After each merged story, and after planning or documentation work committed straight to `main`, the prompts from both sessions are added here in the same form: verbatim, with what changed and the commit or PR it landed in.
