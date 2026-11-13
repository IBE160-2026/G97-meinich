# Prompts: how the AI sessions were steered

This file records the prompts the human sent to the AI, verbatim, from Story 1.1 on, and what each one changed in the repository. It complements `docs/ai-sessions/` (one summary per session) and `docs/ai-log.md` (lessons).

## How the work is set up

Two Claude Code sessions run side by side on the same repository:

- **The BMAD session** (a terminal running `claude`) does the work: `/bmad-build` writes the spec, hands it to an implementation subagent, runs three reviewers, and stops for the human at every decision point: spec approval, open questions, push.
- **The review session** (Claude Code in the desktop app) does no story work. The human pastes the BMAD session's output into it, asks what to do, and gets a recommendation. The review session reads the spec, the diff and the database on its own before answering. The human decides, and pastes the instruction they chose back into the BMAD session.

The prompts in the BMAD session below are therefore mostly drafted in the review session and approved by the human. That is deliberate: one AI checks another, and a person decides what goes through. Where a finding came from the review session rather than from the human's own reading, this file says so.

## How this file is produced

Claude Code stores every session as a local transcript (`~/.claude/projects/<project>/<session>.jsonl`). After each story, the human's prompts are extracted from both sessions with their timestamps (UTC). Pasted BMAD output in the review session is shortened to a note in brackets. Menu choices made with the arrow keys are not in the transcript and are noted where they mattered. Before committing, the text is checked for passwords, connection strings, keys and personal data.

---

## Stories 1.1 and 1.2: the toolchain and the read boundary (#1/PR #15, #2/PR #16)

These two stories ran before this file existed. The prompts below were extracted afterwards from the same transcripts, for the Epic 1 retrospective (finding L7). At that time the review session was an earlier desktop session, and the human mostly pasted the BMAD session's output into it to ask what to answer.

### Prompts to the BMAD session

**2026-10-10 19:50**: `/bmad-build`, with Story 1.1 chosen from the menu.

**19:57**
```
Approve and continue. Two small things: update issue #1's branch name to story/1.1-toolchain-and-shell so issue, branch and PR match; and list the dead /slik-fungerer-peerless link in the PR as a known gap closed by story 1.6b. When the PR is open, stop — don't merge.
```
*Changed:* issue, branch and PR #15 share one name. The PR names the link that 404s until 1.6b as a known gap.

**20:54**: Story 1.2, carrying a finding from the review of PR #15.
```
/bmad-build Story 1.2 (local Supabase with roles and grants).
Two additions:
1. Follow-up from the review of PR #15: `check:env` must also fail if `next.config.ts` has an `env` key, since those values are inlined into the client bundle regardless of the NEXT_PUBLIC_ prefix. Add a test for it.
2. Do not push the branch and do not open a PR before I have reviewed the code. Stop when the story is ready for review and give me a summary.
```
```
Yes, this is my request. PR #15 is already merged (3e9c6ce) and the 1.1 branch is deleted, so run `git pull` on main first and verify.
1. Create story/1.2-<slug> from the updated main.
2. Put the env-key check on the Story 1.2 branch, as its own commit, separate from the roles and grants work.
As before: no push and no PR until I have reviewed it.
```
*Changed:* `pnpm check:env` also rejects an `env` key in `next.config.*` (AD-19). Values set there reach the browser bundle whatever their name. The rule "no push before the human has reviewed" started here.

**21:10**: answer to the spec's password question, with four additions.
```
(c), and keep the spec whole.

Add to the spec:
1. ALTER DEFAULT PRIVILEGES must name the role that runs the migrations (FOR ROLE postgres or whichever it is), and the test must create its table as that same role. Otherwise the "tables added later" test proves nothing.
2. Include service_role in the access tests: no access to register, the same as anon and authenticated.
3. db:roles must never overwrite an existing password in .env, never print a password to stdout or a log, generate URL-safe passwords (e.g. hex from crypto.randomBytes), and refuse to write unless .env is gitignored. Test the idempotence: running it twice changes nothing.
4. Test that reader cannot CREATE in any schema — register, app and public — not only register.

Then show me the finished spec before you write any code.
```
*Changed:* without (1), the test for tables added later would have passed without testing anything, because default privileges apply only to objects created by the role they name.

**21:15**
```
Approve and continue — but first add three things to the spec:
1. db:roles refuses unless the host in SUPABASE_DB_URL is 127.0.0.1 or localhost (stage 2 brings a hosted database; the script must never be able to change passwords there). Add a matrix row and a test.
2. Postgres grants EXECUTE on functions to PUBLIC by default. The migration also revokes that default for functions in register and app (ALTER DEFAULT PRIVILEGES FOR ROLE <migration role> ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC). The test checks that a function added later in register cannot be executed by anon or reader.
3. Before you write the tests, verify that the role the tests connect as can SET ROLE to reader, anon, authenticated and service_role in Supabase's local Postgres (postgres is not a real superuser there). Record the result and the solution in Implementation Notes.
```
*Changed:* `pnpm db:roles` cannot reach a hosted database. Functions added later are not executable by default. The test setup was checked against Supabase's non-superuser `postgres` before any test relied on it. That check led to `GRANT reader TO postgres WITH INHERIT FALSE, SET TRUE`.

**2026-10-11 09:08**: decisions on the review, before push.
```
Reviewed. Decisions: accept 1 (GRANT reader TO postgres WITH INHERIT FALSE, SET TRUE), accept 2 (the global EXECUTE revoke), accept 3 — but correct the spec so it says what the code does: db:roles reads .env to find SUPABASE_DB_URL, and writes nothing and alters no role before the host check.

Before push, on this branch:
- Change AGENTS.md so the DDL sentence says exactly what the test checks (CREATE/ALTER/DROP in .sql files live only in supabase/migrations; roles.sql holds only CREATE ROLE; db:roles may only run ALTER ROLE … PASSWORD against a local database). Remove that item from deferred-work.md.
- Add to deferred-work.md for stage 2: hosted Supabase does not run supabase/roles.sql automatically; the roles must go with `supabase db push --include-roles` or be created otherwise, or the migration fails on GRANT … TO reader.

Then push the branch and open the PR (Closes #2, list the FRs, link the session file, and add the review triage). Do not merge. Tell me when CI has run — the Supabase start on the runner is untested.
```
*Changed:* `2438e6a` and `b657c3e`, PR #16. The spec and AGENTS.md describe what the code does. The stage-2 trap with hosted roles is recorded in deferred work.

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

## Story 1.6b: open an analysis in the right state (#8, PR #24)

### Prompts to the BMAD session

**2026-10-16 06:18**
```
/bmad-build Story 1.6b, issue #8
```

**06:25**: four questions from the spec, answered by typing into the menu. The menu stores the text without its line breaks, and they are restored here.

*An invalid orgnr in an analysis URL.* The AI recommended rendering the front page's search in place.
```
Fra meg: 1, med krav: siden svarer med HTTP 404 (ikke 200), men viser
forsidens søkefelt med verdien fylt inn og feilmeldingen. Test statuskoden
i e2e for både feil lengde og feil sjekksum.
```

*The header search on a phone*, where 7 px were left for the input at 320 px.
```
Fra meg: 1, med krav: hvis headeren er sticky, skal den ikke være det med
to rader under md (ellers tar den for mye av skjermhøyden på telefon).
Test i e2e ved 320 og 375 px at søkefeltet er minst 200 px bredt og at
body ikke scroller horisontalt.
```

*The "Kilder og lisens" copy.*
```
Fra meg: godta teksten. Sjekk at NLOD-kreditten er ordrett slik
docs/data-sources-brreg.md oppgir den, og legg en post i deferred-work for
Epic 2 (Story 2.1): avsnitt (1) må nevne de innsendte årsregnskapene når
tall lest med OCR vises.
```

*Spec size:* kept whole. The alternative offered moved the about page and the header search into deferred work with no story to own them, and the header search had already been deferred once, from 1.5b.

**06:28**: approval, with two changes to decisions the AI had made on its own.
```
Fra meg: godkjent, med to endringer før du starter:
1. Et gyldig orgnr som ikke finnes i databasen svarer også med HTTP 404
   (med State-blokken og demolenkene), som ugyldig orgnr. Test status i e2e.
2. Det kompakte feltet beholder en ekte label (visuelt skjult er greit);
   placeholderen kommer i tillegg, ikke i stedet. Test at feltet har
   tilgjengelig navn fra label, ikke fra placeholder.
Approve and continue.
```
*Changed:* the spec had a valid but unknown orgnr answering 200, which made every valid orgnr look like a real page. It had also made the placeholder the compact field's only label, which screen readers do not treat as one.

**07:15**: four more questions from implementation, answered in the menu.
```
Fra meg: 1, og ikonknappen er minst 44×44 px under md. Test i e2e at den
har tilgjengelig navn "Sammenlign" og riktig størrelse ved 320 px.
```
```
Fra meg: 2. Databasefeil gir 503, og feilsiden viser den samme
role="alert"-meldingen fra t() ("Noe gikk galt. Prøv igjen om litt.") –
ikke Next.js' standardside. Ingen feildetaljer i svaret. Test status og
melding i e2e med databasen utilgjengelig.
```
```
Fra meg: legg til en synlig h1 (ikke skjult), som fokus flyttes til:
- gyldig orgnr som ikke er i databasen: "Ingen data for dette selskapet"
- ukjent sti: "Fant ikke siden"
Teksten i nb.json. Test i e2e at fokus lander på h1 etter navigasjon.
```
For the 404 pages being empty without JavaScript, the answer was "Accept, keep deferred". Search and analysis need JavaScript anyway.

*Changed:* the AI had first offered to keep HTTP 200 on a database error and defer it to Story 1.10, which is about rate limiting. It also offered a visually hidden h1 and the heading "Fant ikke selskapet", which is wrong for a company that exists in the register but not in Peerless.

**07:40**: the 503 requirement came from the review session and was worded too narrowly. Because Next.js 16.4 cannot set 503 from rendering, the BMAD session built `src/proxy.ts`. The proxy relied on undocumented behaviour, read the database twice per analysis, and ran on every request.
```
Fra meg: før push, bytt ut 503-løsningen. Jeg mente bare "ikke 200 ved
databasefeil", ikke akkurat 503 – proxyen koster for mye (udokumentert
oppførsel, to lesinger, kjører på alle forespørsler).
- Fjern src/proxy.ts. Databasefeil kastes, Next.js svarer 500, og en
  error.tsx/global-error.tsx på riktig nivå viser vår role="alert"-melding
  fra t() uten feildetaljer.
- Behold e2e-testen med databasen utilgjengelig, men forvent 500.
- Rett docs/ai-log.md og session-fila: proxyen ble prøvd og forkastet,
  og hvorfor. Proxyen hører hjemme i Story 1.10 hvis den trengs der.
Deretter: push og opprett PR-en for #8, med demolenkene, orgnr-nøkkelen
og 404 uten JavaScript under kjente begrensninger.
```
*Changed:* `a6d05d8`. The proxy was removed, and the error page renders our alert with status 500. The ai-log keeps the 503 entry and corrects it in a later entry, following the log's own rule that entries are never edited.

### Checks before merging

CI on `a6d05d8` was green before the review. The human posted the review at 08:08:46 and merged at 08:08:54.

---

## Story 1.7: Peerless finds comparable companies, stages 1–3 (#9, PR #25)

### Prompts to the BMAD session

**2026-10-16 08:10**
```
/bmad-build Story 1.7, issue #9
```

**08:20**: answers to the spec's two questions, plus two points the review session raised after reading it.
```
Fra meg:
Behold spec-en hel.
2: Hverken ren (a) eller (c). Bruk (a)-strukturen (vanlig analyse, ingen
   ny sidetilstand), men når grunnen til null peers er at selskapets
   regnskapsår ikke er kalenderår, viser Peers-fanen en egen tekst som
   sier det, f.eks. "Peerless sammenligner foreløpig bare selskaper med
   kalenderår som regnskapsår." Oppdater PRD og UX med én linje.
I tillegg:
- isCandidate(peer, band) endrer en beslutning fra 1.6a. Skriv i spec-en,
  session-fila og AGENTS.md hvorfor: båndet leses av parse selv, så den
  som kaller kan ikke lukke over det.
- Lukk deferred-posten om sovende selskaper: trinn 1 krever omsetning
  innenfor båndet, så selskaper med null omsetning kan ikke bli peers.
  Legg til en testrad som viser det.
```
*Changed:* the AI recommended (c): show the generic "Fant ingen sammenlignbare selskaper" for the 10 % of filings whose year isn't a calendar year, and defer the explanation. That suggests a search found nothing, when no search was made. The engine now returns `emptyReason`, and the Peers tab explains. The AI had changed the 1.6a `isCandidate` signature without saying so. The change was justified, so it was kept and documented as a deliberate reversal.

**08:24**: `Approve and continue`

**08:50**: the review found that 3 346 of the 8 299 covered AS companies (about 40 %) have no positive revenue, and so never get peers. That changed a locked decision in the spec.
```
Fra meg: (a), og ja, hopp over revert. Skriv endringen av den låste
beslutningen inn i spec-ens endringslogg med dato og at jeg godkjente den.
Teksten skal dekke null, negativ og manglende omsetning, f.eks.:
"Peerless finner sammenlignbare selskaper ut fra omsetning, og regnskapet
for {år} har ingen positiv omsetning å sammenligne med."
Test at Peers-fanen viser den for alle tre tilfellene.
```
*Changed:* the AI's wording, "Selskapet har ingen driftsinntekter", was wrong for negative and for missing revenue. The workflow's rule is to revert and re-plan when a locked decision changes. It was set aside here, because the change was one copy string and one branch and the human made it explicitly. The renegotiation is recorded in the spec.

**10:10**: `Fra meg: push og opprett PR-en for #9.`

### Checks before merging

The review session counted the peer group for both demo companies with its own SQL, written from the spec's rules without reading the code. It then ran `assemblePeerGroup` on the same seed data. Both give ADMMIT AS 391 and EXEBENUS AS 393 peers at the standard band. It also confirmed that `src/engine/peers.ts` reads no profit, equity or asset field, so selection uses size only. The human posted the review at 10:12. CI on `27bbeae` finished green at 10:15, and the PR was merged at 10:18.

---

## Story 1.8: the key-figure table with the three API figures and the margin in kroner (#10, PR #26)

### Prompts to the BMAD session

**2026-10-16 10:21**
```
/bmad-build Story 1.8, issue #10
```

**10:28**: the spec reported "no gaps that need your call". The review session found that two deferred-work entries addressed to Story 1.8 were missing from it, and that its strip scale would break on outliers.
```
Fra meg: godkjent, med tre tillegg i spec-en før du starter:
1. Deferred-posten fra 1.3a/1.4: Gap i kroner vises bare når selskapets
   valuta er NOK; ellers en tekst om at beløpet ikke er i kroner. Test med
   et USD-selskap fra seeden.
2. Deferred-posten fra 1.4: utvid ESLint-forbudet (toFixed, toDP/
   toDecimalPlaces, toSignificantDigits, toLocaleString) til src/app og
   src/components, og oppdater AGENTS.md i samme commit. Lukk begge postene.
3. Stripeskalaen klippes (f.eks. 5.–95. persentil) med en markør for verdier
   utenfor, så én ekstrem peer ikke presser resten sammen. Test med en
   gruppe som har én ekstrem verdi.
Approve and continue.
```
*Changed:* without (1), the 85 USD and EUR filings in the seed would have shown a dollar amount followed by "kr". `driftsmarginGap` now returns `not_nok` for them. The ESLint bans and AGENTS.md were updated. The AI's linear min–max strip let one peer at −400 % squeeze every other mark into one end. The strip now uses P5–P95, with a marker for values outside it.

**11:22**: Claude Code stopped the final verification because the machine was critically low on memory: 2.0 GB free of 15.7 GB. The BMAD session did not commit without a full run.
```
Fra meg: jeg har frigjort minne. Kjør verifiseringen i bolker, én om
gangen, og stopp ved første feil: (1) pnpm test, (2) pnpm test:db,
(3) pnpm build && pnpm check:routes, (4) e2e. Merk deretter spec-en
som done og commit.
```
*Changed:* `60b0b93`. All four batches passed: 675 unit, 120 database and 91 e2e tests.

**11:27**: `Fra meg: push og opprett PR-en for #10.`

### Checks before merging

The review session computed the kroner gap independently in SQL: a peer group built from the spec's rules, `percentile_cont` (the same as PERCENTILE.INC), and (beste fjerdedel − own margin) × revenue. It then ran `benchmarkApiFigures` on the same seed data. ADMMIT AS gives 3 215 708 kr and EXEBENUS AS 4 789 071 kr in both. The human posted the review at 11:28. CI on `60b0b93` finished green at 11:32, and the PR was merged at 11:33.

---

## Commit granularity: AGENTS.md rule (on `main`, `5d4b520`)

### Prompts to the review session

**2026-10-16 11:36**: the human asked, with a screenshot of the git graph:
```
Og burde man ha flere små commits til senere?
```
The review session measured the last story commits: `623b29d` (1.6b) had 50 files and +2 616 lines, `27bbeae` (1.7) +2 032, and `60b0b93` (1.8) +2 190, each a whole story in one commit. The cause is that `bmad-build` commits once, after verification. The grading guide counts "noen store commits" against the process criterion. Merged history was left as it is.
```
Legg til i agents og push
```
*Changed:* `5d4b520`. AGENTS.md's Git workflow now says that a story lands as several commits in logical steps (engine, server, UI, e2e, review fixes, docs), each one type-checking on its own, with the full suite run before the first push.

---

## Story 1.9: Oversikt shows the biggest gap first (#11, PR #27)

### Prompts to the BMAD session

**2026-10-16 11:38**: the first story started under the new commit rule.
```
/bmad-build Story 1.9, issue #11 - remember from agents.md - commit i logiske steg som AGENTS.md sier, ikke én commit for hele storyen.
```

**11:44**: approval, with one case the spec's matrix lacked.
```
Fra meg: godkjent, med ett tillegg i matrisen før du starter:
når gruppen er tom fordi emptyReason er satt (subject_non_calendar),
viser hero-kortet samme forklaring som Peers-fanen, ikke "For få
sammenlignbare (0 av 10)". Test med et selskap med avvikende regnskapsår
fra seeden.
Approve and continue.
```
*Changed:* without it, a company whose year isn't a calendar year would have read "For få sammenlignbare (0 av 10)" on Oversikt. That is the misleading message already rejected for the Peers tab in Story 1.7. The test is in `test/analysis/oversikt-hero.test.ts`.

**12:21**: the BMAD session pointed out that the approved wording "På medianen på −3,2 %" repeats "på", and left the decision to the human.
```
Fra meg: endre til "Lik medianen på {verdi}", så den følger samme mønster
som "Over/Under medianen på {verdi}". Egen commit. Push deretter og
opprett PR-en for #11.
```
*Changed:* `1824d67`. The AI's own suggestion, "Lik medianen, −3,2 %", broke the pattern of its two sibling lines.

### Result of the commit rule

The story landed as ten commits of 11 to 453 lines: the engine, the shared amount function, the hero card, the e2e tests, a focus fix, a test fix, the docs, the review fixes (`cd98d6f`, on their own), the review log and the copy change.

### Checks before merging

The spec corrected the mockup, which always said "Over medianen", even for the UX document's own example company, which sits below the median. The hero and the table share one amount function, and a test checks that they agree. The human posted the review at 12:24. CI on `1824d67` finished green at 12:27, and the PR was merged at 12:36.

---

## Story 1.10: the open route is rate-limited without storing anyone (#12, PR #28)

### Prompts to the BMAD session

**2026-10-16 12:39**
```
/bmad-build Story 1.10, issue #12
```

**12:47**: three questions from the spec, answered in the menu. The budgets were set at "60 + 60 per minute". The review session noted that many users behind one shared address share one budget. On the spoofable `X-Forwarded-For` (line breaks restored):
```
Fra meg: 1. Dokumenter det som v1-begrensning i PR-en og arkitekturnotatet.
Kontrollen før utrulling skal kreve at klientadressen leses fra det
plattformen setter (ikke venstre verdi i X-Forwarded-For), og ha en test
som viser at en klientsatt X-Forwarded-For bare gir eget budsjett, ikke
omgår grensen for andre.
```
The spec was kept whole: the test proving that no address is stored is the story's own claim, and deferring it would have left the claim untested. The alternatives offered to the AI's recommendation were a global ceiling and a custom Node server. A global ceiling would let one spoofer lock everyone out. A custom server breaks the "no second server" rule in AGENTS.md.

**12:51**: approval, with two additions after the review session read the spec.
```
Fra meg: godkjent, med to tillegg i spec-en før du starter:
1. Saltet er tilfeldig, lages ved prosessstart (crypto.randomBytes) og
   skrives aldri til fil, env, logg eller database. Test at to prosesser
   gir ulik hash for samme adresse.
2. Når tabellen er full (10 000): fjern utløpte oppføringer først, deretter
   de eldste – aldri tøm hele tabellen, og aldri avvis nye adresser. Test at
   10 000 forfalskede adresser ikke nullstiller budsjettet til en eksisterende.
Approve and continue.
```
*Changed:* the spec said "a salted hash" but not where the salt came from. A hash of an IPv4 address can be reversed by brute force over its 4 billion values unless the salt is secret and ephemeral. It said "capped at 10 000" but not what happens when the table is full. With a client-set header, one person could fill the table and either reset everyone's counters or lock out every new address.

**12:52**: the BMAD session found that the test the human had asked for would fail under plain "oldest first", because the exhausted address is the oldest and would be evicted with a fresh budget. The answer, from the menu, was "Oldest within budget first": an exhausted entry is evicted only when every live entry is exhausted. The comment in `src/rate-limit/limiter.ts` records it as the human's decision.

**13:30**: for the second time (after Story 1.8), Claude Code stopped the verification because the machine was low on memory (2.5 GB free of 15.7 GB). The review session found 13 Claude processes, a browser and VS Code holding most of it.
```
Fra meg: jeg har frigjort minne. Kjør verifiseringen i bolker som i 1.8,
én om gangen, og stopp ved første feil: (1) pnpm typecheck && pnpm test,
(2) pnpm test:db, (3) pnpm build && pnpm check:routes, (4) e2e.
Commit deretter spec-en, push og opprett PR-en for #12.
```
*Changed:* `84d54a5`. All batches passed: 736 unit, 120 database and 114 e2e tests. The story landed as eight commits, with the review fixes on their own in `03d0533` and `f05cc89`.

### Checks before merging

The review session read `src/rate-limit/limiter.ts` on the branch. It confirmed the `randomBytes` salt held only in memory, HMAC keying, and the eviction order. The human posted the review at 13:37, and CI was green on `84d54a5`. The PR was merged at 13:41, before the session file had been updated with the PR link and the review fixes, as the review session had recommended. The review session updated the session file on `main` afterwards.

With PR #28, Epic 1 is complete.

---

## Epic 1 retrospective (on `main`, `d168791`)

### Prompts to the BMAD session

**2026-10-16 13:44**: `/bmad-retrospective Epic 1`

**14:01**: two questions, answered by typing into the menu (line breaks restored). On the verdict:
```
Fra meg: accepted-with-open-items, med frist per punkt:
- Punkt 1 (rå databasefeil i loggen) og punkt 2 (Next.js-versjonen mot
  sikkerhetsvarsler, særlig middleware-omgåelse siden rate limiteren
  ligger i proxyen) lukkes før Epic 2 starter, som én liten PR.
- Punkt 3 (motstridende tekst) går i deferred-work med eier-story.
Skriv fristene inn som tiltak i retrospektiven.
```
The retro's open questions were answered in the box for its second menu question, "which action items to track". The BMAD session therefore tracked all 11 items and said so.
```
Fra meg:
1. Ja: next 16.4.0 er sårbar for GHSA-2464-fhr4-w9xw og GHSA-673q-mjm6-r5xr
   (begge kritiske, rettet i 16.4.1). Pin next og eslint-config-next til
   16.4.2 i oppfølgings-PR-en, og noter det som et bommet AC i retroen.
2. Behold "ikke oppgitt → intet bånd" og rett bare teksten (1 av 4 890
   regnskap har utledet omsetning over 5 kr, og den er negativ).
3. Tiltak 1–5 som én "Epic 1 follow-ups"-PR før Story 2.1.
4. Ja, akseptabelt for lokal v1; AD-10-kontrollen dekker trinn 2.
```
*Changed:* the retro had left open whether `next` 16.4.0 was exposed to the 2026-10-14 advisory. The review session queried GitHub's security advisories for `vercel/next.js`. It found two critical unauthenticated remote-code-execution advisories, both fixed in 16.4.1, while the project pinned 16.4.0. This is recorded as a missed acceptance criterion from Story 1.1 and is fixed in the follow-ups PR before Epic 2.

**14:03**: three corrections before commit.
```
Fra meg: tre rettelser, så commit retroen og sprint-status til main:
1. Sikkerhetsvarslene er verifisert: GHSA-2464-fhr4-w9xw og
   GHSA-673q-mjm6-r5xr, hentet fra GitHubs security advisories for
   vercel/next.js av review-sesjonen, begge kritiske, publisert 2026-10-14,
   rettet i 16.4.1. Skriv kilden i retroen i stedet for "not verified".
2. Tiltak 10: en PR-forfatter kan ikke godkjenne sin egen PR på GitHub.
   Endre til en review med linjekommentarer, sendt som "Comment" via
   Files changed → Start a review, før merge.
3. Sett last_updated tilbake til dag-måned-år (16-10-2026).
```
*Changed:* `d168791`. The retro's action 10 required "an Approve review before merge", which GitHub does not allow the author of a PR to give. It now requires a review with line comments, submitted as "Comment".

**14:09**: the follow-ups PR was started:
```
/bmad-build Epic 1 follow-ups: retro action items 1, 3, 4 og 5 (epic-1-retro-2026-10-16.md). Én PR, logiske commits.
```

### Action 9, done by the review session

The corrections to the AI-process record from findings L4–L8 were made on `main` in a separate worktree, alongside the follow-ups PR:
- PR links in the stale session-file headers;
- "rejected" sections for 1.6a–1.9;
- credit to the review session in the 1.3a, 1.3b and 1.5a session files;
- two correction entries in `docs/ai-log.md`;
- the prompts for Stories 1.1 and 1.2 above.

---

## Epic 1 follow-ups: retro actions 1–5 (#29, PR #30)

### Prompts to the BMAD session

**2026-10-16 14:09**
```
/bmad-build Epic 1 follow-ups: retro action items 1, 3, 4 og 5 (epic-1-retro-2026-10-16.md). Én PR, logiske commits.
```
The review session drafted this command using the action numbers from before the retro renumbered them. It left out the security pin, which had become action 2.

**14:11**: the BMAD session caught the gap: "Action 2 (pin next + eslint-config-next to 16.4.2, both still on 16.4.0) is not in your list. Include it?" The answer, from the menu, was "Include action 2". For action 3, the copy for a derived but unstated revenue, the answer was "Ledger entry only": it goes to Story 2.9, as the retro had decided.

**14:14**: the BMAD session caught an error in the retro itself. Finding D10 proposed lower-casing the industry name on the uncovered page, but there the name begins the sentence. The answer, from the menu, was "A: keep capital".

**14:15**: approval.
```
Fra meg: godkjent. Kjør hele suiten i bolker etter Next.js-oppgraderingen
(særlig e2e for 404-status, 500 via error.tsx og rate limit, som bygger på
Next.js-detaljer), før de andre commitene. Bekreft KANTALL-teksten i e2e.
Approve and continue.
```
*Changed:* the suite ran after the pin commit `6a17ca7` and before the others, because several Epic 1 designs depend on Next.js details: 404 before Suspense, 500 through `error.tsx`, and the proxy.

**2026-10-19 18:39**
```
Fra meg: ja, gjør alt: opprett issue, legg session-fil og ai-log-oppføring
som egne commits på grenen, push og opprett PR-en (Closes #n). Session-fila
skal ha PR-lenken før merge.
```
*Changed:* issue #29 and PR #30. For the first time, the session file and the ai-log entry were in the PR before merge (retro L6). That held except for the merge date, which the review session filled in on `main` afterwards.

### Result

Eleven commits:
- `6a17ca7`: Next.js 16.4.2, with a pnpm release-age exemption for exactly these versions, whose removal is deferred;
- `4325185`: the front page and the uncovered page log only error class and SQLSTATE;
- `4e55a7e`: the database-down e2e test covers every route;
- `2164dae`: the engine may not import Next.js or React;
- `e517794`: the tidiness sweep;
- `7e0994a`: the ledger;
- `368b9df`: the review fixes;
- the remaining four: spec and documentation.

### Checks before merging

The human posted the review as a conversation comment at 18:44. CI on `0cdcf3b` finished green at 18:48:31, and the PR was merged at 18:48:37. Retro action 10 asks for a GitHub review with line comments, and that was not done this time: PR #30 has no inline comments. The review session had drafted three line comments, on `pnpm-workspace.yaml`, `src/app/page.tsx` and `e2e/db-down.spec.ts`. Retro actions 1–5 and 9 are marked done in `sprint-status.yaml`.

---

## Retro action 10: process rules in AGENTS.md (on `main`)

### Prompts to the review session

**2026-10-19**: the review session offered to make action 10's process changes, and the human answered `okei`.

*Changed:* AGENTS.md gained a section, "Specs, reviews and merging", with the six process changes from retro findings L2–L11:
- an I/O-matrix row names the test that would fail if its code were deleted;
- every AI-log claim names its test;
- reviewers know both status vocabularies;
- no silent fallbacks;
- post-freeze spec corrections go under `## Spec Change Log`;
- the session file is current, and the human's review has line comments, before merge.

The BMAD session and its reviewers read AGENTS.md at the start of every session, so the rules apply from Story 2.1 on.

---

## Retro actions 7 and 8: planning documents and the ledger (on `main`, `9583878`…`5916ecb`, `68107b2`)

### Prompts to the BMAD session

**2026-10-19 18:52**
```
Fra meg: gjør retro-tiltak 7 og 8 fra _bmad-output/implementation-artifacts/epic-1-retro-2026-10-16.md (listene under tabellen). Bare dokumenter, rett på main, én commit per dokument. Sett tiltakene til done i sprint-status.yaml.
```
*Changed:* thirteen commits, one per document. Among them:
- AD-5 records that the status (404, redirect or 500) is decided before any Suspense boundary renders.
- AD-10 and the README say plainly that rotating `X-Forwarded-For` defeats the local limit.
- PRD FR-7 and EXPERIENCE.md describe the no-revenue state.
- `epics.md` and the 1.1 spec record the missed Next.js advisory acceptance criterion.
- Five resolved entries were pruned from `deferred-work.md`, and four new ones were added.

The review session checked the push and found that finding R6 was to be recorded under AD-10 but was missing from action 7's list. It added R6 itself in `6a9295b`. The BMAD session had also said that the session file was the review session's to write.

**19:01**
```
Fra meg: session-fila er din, ikke review-sesjonens – bare docs/ai-prompts.md
er review-sesjonens (se AGENTS.md, "Prompts are saved verbatim"). Skriv
docs/ai-sessions/2026-10-19-epic-1-retro-actions-7-8.md med commitene,
de to valgene du tok (den femte deferred-posten, R6 utelatt), og at
review-sesjonen la inn R6 i AD-10 (6a9295b). Commit og push til main.
```
*Changed:* `68107b2`. The session file at first credited this correction to "the human". The review session changed it to say that the review session caught it and the human passed it on, as AGENTS.md requires.

With this, every Epic 1 retro action due before Story 2.1 is closed: 1–5 and 7–10. Action 6 is due before Epic 3, and action 11 belongs to Story 2.7.

---

## Story 2.1 split, and Story 2.1a: read a filed document, the OCR library and image (#31, PR #33)

### Prompts to the BMAD session

**2026-10-19 19:04**
```
/bmad-build Story 2.1
```

**19:14**: three questions from the investigation: which library renders PDF pages, whether årsverk is read, and whether to split.
```
Fra meg:
1: (a) PyMuPDF, pinnet. Legg AGPL-forbeholdet inn i lisensvurderingen som
   er port før trinn 2 (AD-en for hosted deployment), så det ikke
   overrasker senere.
2: (a) Utsett årsverk. Deferred-posten skal navngi hvilke nøkkeltall som
   mangler til da, og peke på Story 2.9 for at de vises med riktig grunn.
3: (a) Del i 2.1a (bibliotek, image, fixtures – ingen database) og 2.1b
   (migrasjon, kjøring, kontraktstest, seed, docs). Oppdater epics.md,
   sprint-status og issuet som for 1.5a/b, og start med 2.1a.
```
*Changed:* the planning commits on `main` (issues #31 and #32, `epics.md`, the technical note). The AGPL licence of PyMuPDF is recorded in the licence assessment that gates hosted deployment. It is acceptable while step 1 is a local batch tool. The deferred årsverk entry names the two figures that stay absent (#7 revenue per FTE, #8 personnel cost per FTE) and hands their display to Story 2.9.

**19:20**: approval, with one rule the spec lacked, after the review session read it.
```
Fra meg: godkjent, med ett tillegg i matrisen før du starter:
tallene leses bare når "Beløp i:" er en ren valutakode (hele enheter).
Står det noe annet (f.eks. "NOK 1000", "tusen kroner"), gir dokumentet
ingen kolonner – aldri en gjettet skala. Test med en fixture der
"Beløp i:" har en enhet.
Approve and continue.
```
*Changed:* the spec read "Beløp i:" only for the currency, and set `valuta` to None when it was anything else. It did not say what happened to the figures. A document in thousands could have been read as kroner, a thousand times too small. `test_scaled_or_unreadable_unit_gives_no_columns` covers it.

**19:33**: `remember to have several commit per story`

**19:59**: two decisions after the review. The BMAD session asked; the review session drafted the answers.
```
Fra meg:
1: (a). En kontroll bekrefter et sifferlest tall bare når minst ett av de
   andre tallene i kontrollen kom fra den vanlige lesingen. Ingen revert;
   skriv det i Spec Change Log med dato og at jeg besluttet det. Test med
   sum eiendeler og sum egenkapital og gjeld som mister samme siffer.
2: (a). De tre tallene står som manglende. Deferred-post for Story 2.2:
   delsumkontroller (f.eks. komponentene mot sum kortsiktig gjeld) så
   slike felt kan bekreftes.
Bruk de 14 rettelsene i én egen commit.
```
*Changed:* `e468fcd` and `bd6c4ad`. The edge-case reviewer found that the approved rule let two digits-only figures confirm each other. Sum eiendeler and sum egenkapital og gjeld print the same number, so the same dropped digit in both would pass the balance check, and both wrong figures would be kept. Test: `test_digits_never_confirm_each_other`.

**20:09**
```
Fra meg: push og opprett PR-en (Closes #31). Nevn at ocr-image-check kjører
i GitHub Actions for første gang i denne PR-en.
```

### Result

Eleven commits on the story branch, plus the spec commit on `main`, with the human's rule and the review fixes each in a commit of their own.

### Checks before merging

The review session compared the OCR contract for 979607008/2025 with the register's API for the same filing. Sum driftsinntekter 72 632 310, driftsresultat 122 003, årsresultat −1 541 009 and sum eiendeler 31 073 544 are identical, so the contract is confirmed by an independent source and not only by the AI's own reading of the PDF. It also confirmed that both tests the human asked for exist.

The human asked the review session to post the review ("kan du fikse det?"). It posted a GitHub review, submitted as Comment, with five line comments: on the digits-only rule, both tests, the model pin in the Dockerfile and the contract values. The review's summary says the comments were drafted by the review session and posted at the human's decision. This was the first PR with line comments, as retro action 10 asks. CI was green at 20:17, including the first GitHub run of `ocr-image-check`, and the PR was merged at 20:22.

---

## Story 2.1b: store the filed accounts, the OCR ingest (#32, PR #34)

### Prompts to the BMAD session

**2026-10-20 16:41**
```
/bmad-build Story 2.1b, issue #32
```

**16:56**: the spec asked about the status before 2.2, which years to fetch, and how large the run should be. Its recommendation for the run was to ship the seed empty and leave the full industry for the human to run. In the review session the human asked "Hvorfor ikke hele?". The answer: about 42 000 PDFs, days of OCR, nothing a grader would see, and load on Brønnøysund. The message was sent twice, identically:
```
Fra meg:
Behold spec-en hel.
1: A – status extracted.
2: A – alle år 2021–2025, som akseptansekriteriet.
3: Ingen av alternativene. Mål først sekunder per dokument i imaget og gi
   meg et anslag. Kjøringen skal kunne avgrenses til et sett orgnr, og
   akseptansekjøringen er demoselskapene A, B, C pluss peer-gruppene deres
   i standardbåndet (~500 selskaper), ikke hele 62.100. Seeden har de nye
   tabellene tomme til allow-listen i 2.3. Hele bransjen er en
   deferred-post med anslått tid.
```
*Changed:* the BMAD session measured 21.1 s per document in the image. That gave about 12 hours for the acceptance set and about 190 hours (8 days) for all of 62.100. The review session's own guess, 5–10 s, had been too optimistic. A `--documents <file>` mode was added, with the acceptance set computed in Node from `src/engine/peers.ts`.

**17:20**: approval, with two requirements drawn from Story 1.3a.
```
Fra meg: godkjent, med to krav:
1. Rekkefølge: akseptansekjøringen (~12 t) starter først etter review,
   rettelser og full testsuite, på imaget bygget fra siste commit – ikke
   før, som i 1.3a. Oppgi commit-hash for imaget i PR og session-fil.
2. Kjøringen skal kunne avbrytes og startes på nytt uten å gjøre om
   lagrede dokumenter. Test det, og si fra før du starter den, så jeg kan
   holde maskinen våken.
Approve and continue.
```

**18:13**: after review. Two findings were put to the human.
```
Fra meg:
1. Godta A og B uten C (C er udekket og bruker ikke dokumenttall). Skriv
   det i Spec Change Log.
2. Ikke godta. Jeg besluttet at dokumentlesing skal kunne avgrenses, ikke
   at vanlig pnpm ingest skal lese dokumenter. pnpm ingest gjør register-
   og API-kjøringen som før; dokumenter leses bare med --documents <fil>.
   Spec Change Log med dato og min beslutning, egen commit, test som viser
   at vanlig pnpm ingest ikke henter noen PDF. Oppdater README og AGENTS.md.
Kjør deretter hele verifiseringen i bolker, én om gangen, og stopp ved
første feil.
```
*Changed:* `529f65b` and `e09a413`. The BMAD session had rejected finding #10 as an "intended consequence" of the human's earlier decision. But the implementation made every plain `pnpm ingest` read documents, so a routine register refresh would have taken about 8 days. Test: `test_normal_run_fetches_no_document`.

**18:22** and **18:28**: before and during the start of the run. The review session saw that the next `pnpm seed`, which runs in every story's verification, would delete 12 hours of OCR rows that existed nowhere else.
```
Fra meg: ja, start, med ett tillegg:
Når kjøringen er ferdig, dump register.document og register.document_column
(data only) til en gitignored fil, f.eks. .local/document-run-<commit>.sql,
og legg en gjenopprettingskommando i README "Seed". Skriv i session-fila og
deferred-work at pnpm seed og db:reset sletter dokumentradene, og at de
gjenopprettes fra dumpen til allow-listen i 2.3 finnes. Si fra når
containeren kjører, med navnet.
```
```
Fra meg: to justeringer for når kjøringen er ferdig:
1. Før du kjører pnpm seed for å teste gjenopprettingen: sjekk at radtallene
   i dumpen stemmer med tabellene, og kopier dumpen til en ekstra plassering
   (f.eks. også utenfor repoet). Først da seed + restore + sammenlign.
2. Spec-en står på in-review til etter merge, som etter retroen – ikke done.
```
*Changed:* the BMAD session's own plan had been to test the restore by running `pnpm seed` first, which would have deleted the only copy before the dump was proven. `9a662c1` adds the dump and restore to the README "Seed" section.

**2026-10-21 05:17**: the human closed the laptop mid-run.
```
Fra meg: jeg lukker PC-en en stund, så maskinen går i dvale midt i
kjøringen. Når containeren avslutter: sjekk først at alle 407 selskapene
i seed/document-run.json har dokumentrader (eller er rapportert som uten
dokumenter). Mangler noen, er kjøringen avbrutt – start den igjen med samme
kommando (den hopper over lagrede dokumenter), og ikke dump, seed eller
gjenopprett før den har gått helt ferdig.
```
The container paused while the machine slept and resumed on wake. The BMAD session's background `docker wait` was stopped for low memory, for the fourth time in the project.

**16:40**
```
Fra meg: ikke start watcheren igjen. Jeg sier fra når containeren er ferdig. fullfør resterende
```

**16:46**: the session file credited every decision to the human and never mentioned the review session, the error retro finding L5 describes.
```
Fra meg: før push, rett krediteringen i session-fila (AGENTS.md: "When a
decision or correction came from the review session, the session file says
so"). Disse kom fra review-sesjonen og ble besluttet av meg: avgrensningen
til A, B og peers i stedet for hele 62.100 og kravet om å måle sek/dokument
først; argumentet for å overstyre #10; akseptansekjøringen på endelig kode
etter review og at den skal kunne gjenopptas; dump og backup før pnpm seed;
fullstendighetssjekken etter dvale. Skriv det slik. Egen commit.
```
*Changed:* `80a4108`.

**18:07**: the review session found the container gone, with 407 of 407 companies holding document rows. Its summary was lost with the container, so a company missing one year could not be ruled out.
```
Fra meg: tender_kepler er ferdig og fjernet. 407 av 407 selskaper har
dokumentrader (1 947 dokumenter, 1 avvist med year_header). Siden
oppsummeringen er borte med containeren: kjør pnpm ingest --documents
seed/document-run.json én gang til, så den fanger år som feilet. Den skal
bare hoppe over lagrede dokumenter. Når den andre kjøringen er ferdig og
ikke har lest noe nytt (eller har lest det som manglet): fortsett med
dump, radtall, backup utenfor repoet, så seed + restore + sammenlign.
Ikke push før jeg sier fra.
```
*Changed:* `8bf3c79`. The second run read nothing new (278 s, exit 0). The dump's row counts matched the tables, the copy outside the repository had the same sha256, and after `pnpm seed` and the restore a checksum over each table was identical.

**18:21**
```
Fra meg: rett ai-log-oppføringen der den står – den er ikke på main ennå,
så den kan redigeres. #10: argumentet kom fra review-sesjonen, beslutningen
var min. Egen commit. Push deretter og opprett PR-en (Closes #32). Nevn i
PR-en: akseptansekjøringen (tabellen over), at dokumentradene ikke er i
seeden og gjenopprettes fra .local-dumpen til allow-listen i 2.3, og at
vanlig pnpm ingest ikke leser dokumenter.
```
*Changed:* `f528639`, PR #34.

### The acceptance run

The run used the image built from `e09a413`. It covered 407 of 407 companies (demo A and B and their standard-band pools) and stored 1 947 documents for 2021–2025, 3 892 figure columns in all. 1 946 documents are `extracted`. One was refused: 912355233/2024, `year_header`. Reading took 21.0 s per document and 12.3 hours of wall time, excluding sleep. Every 2023–2025 document is linked to its key-figures filing. None are linked for 2021–2022, because the key-figures API holds no filings for those years. The review session checked the counts against the database during and after the run.

### Checks before merging

CI on `14ea028` was green. At the human's request ("ja"), the review session posted the GitHub review with five line comments, on `extracted`, the plain-ingest test, `to_ore`, the 406 API finding and the seed-export refusal, and it says so in the summary. The PR was merged at 18:31 UTC.

---

## Story 2.2: accept only figures that reconcile (#35, PR #36)

### Prompts to the BMAD session

**2026-10-21 18:35**
```
/bmad-build Story 2.2
```

**18:45**: the spec asked about the tolerance, the prior column and where the "no failed figure" guard lives. It recommended 0.1 % and comparing the prior column with the register. Before answering, the review session compared all 13 681 stored OCR figures with the register's.
```
Fra meg:
Behold spec-en hel.
1: Ikke 0,1 %. Review-sesjonen målte 2.1b-dataene: av 8 234 nåværende
   kolonne-tall mot registeret er 8 230 innen 5 kr og 0 mellom 5 kr og
   0,1 % – den proporsjonale slingringen slipper bare inn lav-siffer-feil
   (f.eks. 911701251: 114 120 459 vs 114 210 458, ombyttede sifre).
   Toleranse = maks(5 kr, 0,001 % av registerets tall). Oppdater
   AGENTS.md og docs/data-sources-brreg.md: 2.1a avviser skalerte enheter,
   så begrunnelsen for en grov proporsjonal toleranse er borte.
2: (a), og fjorårskolonnen sammenlignes ikke med registeret: 173 av 5 447
   avviker, ofte konsekvent i flere summer (924830972: +56 007 i både sum
   eiendeler og sum gjeld) – omarbeidede sammenligningstall, ikke OCR-feil.
   Fjorårskolonnen vurderes bare med c1–c4; avviket mot registeret lagres
   som informasjon, og den overstyrer aldri årets eget dokument.
3: (a) documentFigures i src/engine.
Skriv målingene inn i spec-en som grunnlag for valgene.
```
*Changed:* the measurement settled both questions, so neither recommendation was taken. A 0.1 % band admitted nothing that 5 kr did not, except misread low digits. Comparing prior columns with the register would have failed correctly read, restated comparatives. AGENTS.md's "Reconcile with two rules" was corrected in place, because its stated reason for a coarse proportional tolerance (scaled reporting units) no longer held after 2.1a.

**18:47**: approval, with one change to the AI's own choice: it had made `documentFigures` throw on an unreconciled column.
```
Fra meg: godkjent, med én endring: documentFigures kaster ikke for en
kolonne uten avstemmingsstatus. Den gir alle tall som fraværende med
grunnen not_reconciled – synlig, ikke stille, og uten at en hel
analyseside får 500 fordi én gjenopprettet extracted-rad ikke er
re-sjekket. Test det.
Approve and continue.
```

**19:04**: the human's own check on the commit rule: `comitter du flere ganger som det står i agents.md?`

**19:14**: implementation found that 836 of 1 946 current columns, about 47 %, would fail. The reading library missed the "SUM EGENKAPITAL OG GJELD" line, so the balance check could not run, although in 802 of them the balance held. The review session confirmed both counts in the database.
```
Fra meg: B. c5 = sum eiendeler mot sum egenkapital + sum gjeld, samme
5 kr-grense; balansekontrollen er evaluerbar når c3 eller c5 består.
Summen brukes bare i kontrollen og lagres ikke (AD-15). Spec Change Log
med dato og min beslutning, test med 919062223-mønsteret, og en test som
viser at c5 feiler når ett av de tre tallene er feillest.
Etikettfeilen ("SUM EGENKAPITAL OG GJELD") skal eies av Story 2.3, ikke
bare ligge åpen: deferred-post som peker på 2.3, med mål for treffrate før
og etter, og ny lesing av de ~836 dokumentene.
```

**19:54**: the reconciliation run over the stored documents.
```
Fra meg: ja, start. Den skal ikke OCR-e noe nytt (2.1b-kjøring nr. 2 leste
ingenting nytt); si fra hvis den gjør det. Rapporter: reconciled /
failed_reconciliation per år for nåværende kolonne, hvor mange som feilet
på hhv. c1–c5 og registersammenligningen, og sammenlign med anslaget
1 803 av 1 946. Ny dump ved siden av den gamle, og kopi til
C:\Users\cmein\peerless-backups\. Deretter push og PR (Closes #35).
```
*Changed:* the run took 224 s with 0 OCR reads. 1 801 current columns are `reconciled` and 145 `failed_reconciliation`: 17 failed a check, and 128 lacked a figure that a required check needs. Of the 1 801, 770 pass the balance by c5 alone, which shows how much the label fix owned by Story 2.3 matters. Only 2 failed solely against the register. A new dump, `document-run-bd2ce3e.sql`, sits next to the old one, and both are copied outside the repository.

### Checks before merging

The review session checked the per-year counts against the database. It read the tolerance (exact `Fraction`, `0.00001`), c5, the current-only register check and `documentFigures` on the PR head. At the human's request ("ja"), it posted the GitHub review with four line comments once CI on `91e56ca` was green. The PR was merged at 20:24 UTC.

---

## The OCR reference set (#14, on `main`: `5fa7d23`, `f2ba21e`, `3afca4d`, `38f0d9a`, `b19b1fa`)

### Prompts to the review session

**2026-10-22**: asked whether to set up a template and choose which filings to include, the human answered `gjerne`. The review session followed issue #14's sampling rule. It committed the strata, the population and `draw.py` **before** running the draw (`5fa7d23`). Then it ran the draw: seed 20261022, 20 filings, one per filing year 2021–2025 × four size bands on 2023 revenue, with the 407 demo-set companies excluded. It committed the result and a transcription template (`f2ba21e`). The PDFs went to the gitignored `.local/ocr-reference/`.

**2026-10-23**: during transcription the human added two lines that the reader does not target (`finansielle_anleggsmidler`, `andre_kortsiktige_fordringer`), and asked:
```
I årsregnskapene er det også noen andre kolonner som ikke er med i csv filen slik som andre kortsiktige fordringer feks og finansielle anleggsmidler - la til radene - men burde jeg ikke dette kanskje?
```
```
Okei, men da får kanskje ikke OCR med seg alle tall og da vil kanskje ikke for eksempel balansen gå opp?
```
*Answered:* no. The checks c1–c5 compare printed totals only, so the balance needs no component lines. Extra columns were allowed but optional, and Story 2.3 must read the file by header name (`3afca4d`). The review session also pointed out that `varer` was 0 in every row, while an absent line must be left empty, not 0.

**Checking the transcription before it became truth.** After each save (`Ser du at det er noen rader …`, `Sånn da har jeg gått gjennom alle radene, ser du?`, `nå da?`, `sjekk igjen` three times), the review session ran c1–c4 on every transcribed row, without looking at any OCR output. Six of the 40 rows failed at first:
- 921716257/2021: 20 kr;
- 912197905/2022: 10 000 kr;
- 915338534/2023: several figures;
- 989081799/2025 prior: 50 000 kr;
- 917526729/2025: about 8 mill. kr;
- 922184534/2025 prior: 450 000 kr.

Each was a mistyped or dropped digit. For the last one, 915338534's costs, the review session pointed out that the component lines in the same row summed to 9 505 586, not the transcribed 9 595 586. The human corrected all six against the PDFs, and all 40 rows passed (`38f0d9a`). The dates were made ISO, and the check was recorded in the reference set's README (`b19b1fa`).

**At the human's request** (`Kan du gjøre dette? … krysse av … kommentar med commit-lenkene`), the review session ticked issue #14's first three items and commented with the commit links.

---

## Story 2.3: measure OCR accuracy, SM-2 (#37, PR #39; #38 split out)

### Prompts to the BMAD session

**2026-10-23 09:38**
```
/bmad-build Story 2.3
```

**10:17**: three questions answered in the menu, as drafted by the review session (line breaks restored).
```
Fra meg: 1, del ut 2.3b. Diagnosen er endret: etiketten leses, det er de
fete tallene i sumlinja som feiles. Rett beskrivelsen der den står
(deferred-work-posten fra 2.2, og ai-log hvis den nevner etiketten), og
la 2.3b-issuet beskrive den faktiske feilen. 2.3 lenker fortsatt issue #14.
```
```
Fra meg: 1. Rapporten oppgir n per gruppe (8 og 12 i referansesettet) og
trekker ikke konklusjoner om forskjeller mellom gruppene ut over det
utvalget tåler.
```
The spec was kept whole. The split gives a clean before/after measurement: 2.3 measures today's reader, and Story 2.3b fixes it and measures again.

**10:19**: approval, with two additions to the report from the review session.
```
Fra meg: godkjent, med to tillegg til rapporten:
1. Hovedtallet er feilleste tall som likevel ble reconciled (de som kan nå
   motoren), per gruppe og totalt, med hvert tilfelle listet.
2. Hvert felt klassifiseres som riktig / ikke lest (OCR tom, avskrift har
   tall) / feillest (begge har tall, ulike) / fantom (OCR har tall, avskrift
   tom), med antall per kategori. Ingen samlet prosent uten denne
   inndelingen.
Sammenligningen gjelder bare (orgnr, år) fra drawn.json og leser
transcriptions.csv etter kolonnenavn.
Approve and continue.
```
*Changed:* a single accuracy percentage would have hidden the difference between a figure that is missing (harmless) and one that is wrong (dangerous). The headline counts only the wrong figures that can reach the engine.

**10:48**: `husk å commite i omganger slik det står i agents.md`

**11:06**: `jobber den fortsatt`

**11:08**: the review session found that the database held only the reference documents. The verification had run `pnpm seed`, which deleted the 1 947 rows from 2.1b. It also saw that restoring them before the export would make `seed:export` refuse.
```
Fra meg: de 1 947 dokumentradene fra 2.1b er ikke i databasen nå (seed tømte
dem). Gjenopprett fra .local/document-run-bd2ce3e.sql først ETTER at
seed:export med referansesettet er kjørt og committet – ellers nekter
eksporten. Bekreft radtallet (1 947 + referansedokumentene) etter
gjenopprettingen.
```

**11:40**: two decisions. A probe had disproved the diagnosis given at 10:17: the fault is "SUM" folded to "50M", and "1" read as "l". It had also turned out that five of six headline misreads looked like transcription errors.
```
Fra meg: 1. Rettelsen i spec-en skal si at den forrige diagnosen
("etiketten leses, tallene feiler") kom fra BMAD-sesjonens første
undersøkelse og ble videreført i min beskjed – nå motbevist av proben.
Issue 2.3b beskriver "SUM" → "50M" i tegnfoldingen og "1" → "l" i 2 av 7,
med proben som bevis.
```
```
Fra meg: 1, men blindet: lag en sjekkliste med 20 celler (orgnr, år,
kolonne, felt) – de 6 mistenkte blandet med 14 tilfeldige der OCR og
avskrift er enige, i tilfeldig rekkefølge, uten OCR-verdier og uten å
markere hvilke som er mistenkte. Jeg sjekker alle mot PDF-ene. Hver
rettelse logges i analysis/ocr-reference/README.md med gammel og ny
verdi og dato. Rapporten viser hovedtallet både før og etter rettelsene.
```
*Changed:* correcting only the cells OCR disagreed with would have looked like fitting the truth to the OCR. The BMAD session made the check stricter than asked: the list showed neither the OCR value nor the earlier transcription. All 14 control cells agreed, and all 6 suspected cells were transcription errors.

**11:58**: asked to re-read cell 6, the human answered `37849846 is the figure`. The README and the report record that this one cell was re-read on prompting, not blind.

**11:53** and **12:08**:
```
Fra meg: blind-check.csv er ferdig utfylt og lagret, Excel er lukket.
Datoene står som 23.10.2026 – gjør dem om til 2026-10-23. Fortsett med
sammenligning, logging av rettelser i README, før/etter i rapporten og
egne commits som avtalt.
```
`du sjekker nå?`

**12:35**
```
Fra meg: opprett issuene for 2.3 og 2.3b, push og opprett PR-en (Closes
2.3-issuet, lenker #14). Nevn i PR-en at seed-rundturen ikke er kjørt
lokalt etter gjenopprettingen av 2.1b-radene, og at CI derfor er den
kontrollen.
```

### Result

Six misread figures reached the engine against the transcription as first written, and none after the blind corrections. Of 769 compared fields, 645 are correct, 121 not read, 3 misread (all in columns that failed reconciliation) and 0 phantom. The report says plainly that:
- 0 of 20 proves little;
- lines no check covers, such as `bankinnskudd` and `kundefordringer`, could still be misread and reach the engine;
- every correction moved the transcription towards the OCR.

In all, 12 transcription errors were found in 40 columns. The spike's consistency baseline was re-measured at 89 of 178 columns with today's reader: 68 columns miss only the balance total, which is Story 2.3b's work. Under Story 2.2's rules, 157 of 178 columns reconcile.

### Checks before merging

The review session confirmed that the committed seed holds only the 20 reference orgnrs' 97 documents, and that the export ran before the 2.1b rows were restored. CI on `a6846f3`, which included the seed round trip not run locally, was green. At the human's request ("ja"), the review session posted the GitHub review with five line comments. The PR was merged at 12:46 UTC. Then the review session closed issue #14 with all four items ticked ("du kan også fikse issue 14").

---

## Story 2.3b: read the balance total (#38, PR #40)

Every `Fra meg:` prompt below was drafted by the review session and then pasted by the human, who decided to send it. The one exception is the short reminder at 14:00. The menu answers lost their line breaks in the transcript; the breaks are restored here.

### Prompts to the BMAD session

**2026-10-23 12:51**
```
/bmad-build Story 2.3b, issue #38
```

**13:00**: four questions, answered in the menu.
```
Fra meg: 2, alle lagrede dokumenter. Feilen "1" → "l" gjelder fete tall,
og alle sumlinjene er fete – ikke bare sum egenkapital og gjeld. Legg til
en kolonne for hvilken leserversjon (image-commit) som leste hver rad, så
ingen rad er uten opphav. Ny lesing velger rader med eldre versjon, så en
avbrutt kjøring fortsetter der den slapp. Kjøringen skjer på endelig kode
etter review, som i 2.1b, og dump + backup tas før og etter.
```
```
Fra meg: 1. Et dokument som ikke erstattes beholder også sin gamle
leserversjon. PR-en og session-fila oppgir hvor mange som ble "ikke
erstattet" i akseptansekjøringen, og hvorfor.
```
```
Fra meg: 1. Rapporten viser også feilleste tall som når motoren (fra 2.3)
før og etter ny leser på referansesettet – flere leste tall skal ikke
betales med nye feillesninger.
```
`Keep full spec (Recommended)`

*Changed:* the plan was to re-read only the documents that missed the total. The answer widened it to every stored document, because every total row is bold. It also gave each row a reader version, so a re-read knows what is out of date and an interrupted run resumes.

**13:40**: approval.
```
Fra meg: godkjent, med tre tillegg:
1. Akseptansekriteriet sier eksplisitt at fantomtall og feilleste tall som
   når motoren rapporteres før og etter på referansesettet – flere leste
   felt skal ikke betales med nye feil.
2. Backfill av reader_commit kontrolleres: en sjekk/test viser at hver rad
   får en versjon og at fordelingen er 1 947 (e09a413) og 97 (cfecb1e).
3. De gamle dumpene (e09a413, bd2ce3e) beholdes; den nye dumpen legges ved
   siden av, også i peerless-backups.
Approve and continue.
```
Item 2 named the wrong commit for the reference rows: the review session's error, corrected on 10-25 (below).

**14:00**: `husk å legge ut flere commits underveis per story`

**2026-10-25 17:15**: the PC had restarted in the middle of the verification.
```
Fra meg: PC-en startet på nytt midt i verifiseringen din (stoppet 23.10
kl. 16:17). Docker og databasen er startet igjen. Gjør dette først:
1. Sjekk at databasen fortsatt har migrasjonen og alle dokumentradene
   (2 044 dokumenter), før noe annet.
2. Kopier .local/document-tables-before-2.3b-migration.sql til
   C:\Users\cmein\peerless-backups\ – den mangler der.
3. Backfillen av reader_commit bruker cfecb1e for referanseradene, men
   definisjonen er siste commit som endret ingest/, og det er 901a78d.
   Rett migrasjonen og testen som sjekker fordelingen.
Fortsett så verifiseringen i bolker og deretter review.
```
*Changed:* the review session found that its own 13:40 prompt was wrong. `cfecb1e` did not change `ingest/`, so it is not a reader version. Fixed in `9d2fcf9`.

**17:30**
```
Fra meg: ja, start de fire review-lagene på hele diffen.
Før akseptansekjøringen: kopier også .local/document-run-e09a413-reader-commit/
til C:\Users\cmein\peerless-backups\ og sjekk sha256 – den er
gjenopprettingskilden etter pnpm seed og finnes bare lokalt nå.
```

**17:52**: three review decisions.
```
Fra meg:
D1: 2. Ingen push før akseptansekjøringen, så en ekstra slett-og-
gjenopprett av 2.1b-radene nå gir bare risiko.
D2: Ny regel (Spec Change Log, datert, min beslutning): en ny lesing som
gjør en reconciled kolonne til failed_reconciliation erstatter ikke –
dokumentet beholder tall og leserversjon og telles som "ikke erstattet"
(samme prinsipp som "færre kolonner"). Tall som går fra verdi til NULL i
en kolonne som fortsatt er reconciled, erstattes, men listes per dokument
i oppsummeringen, og antallet står i PR-en. Test begge.
D3: 1. Rapporten regenereres i akseptansekjøringen før merge.
Bruk de 8 rettelsene i en egen commit.
```
*Changed:* the review layers found that a re-read could take figures away from the engine unseen when it gave as many columns as were stored (B4, E1, E9). D2 closes that gap. It is fixed in `fb47a46`, and the eight patches are in `2ce5a50`.

**18:25**
```
Fra meg: ja, start akseptansekjøringen med steg 1 og 2. Jeg godkjenner at
2.1b-radene slettes før seed:export i steg 2 – gjenopprettingskilden
.local/document-run-e09a413-reader-commit/ finnes også i peerless-backups.
Bekreft radtallene (1 947 + 97) etter gjenopprettingen før du går videre.
Imaget skal bygges fra 42b1c02. Si fra før steg 4 (~11 t), så jeg holder
maskinen våken.
```
The re-read of the reference set then fetched nothing: Brønnøysund answered 503 (Sunday 2026-10-25). The run replaced nothing, as designed.

**2026-10-27 16:53**
```
Fra meg: Brønnøysund svarer 200 igjen (sjekket av review-sesjonen: /aar,
dokument-PDF og nøkkeltall-API). Databasen er uendret: 1 947 rader på
e09a413 og 97 på 901a78d. Gjenoppta akseptansekjøringen fra steg 2a:
1. Sjekk selv at dokumentendepunktet svarer 200, og kjør den nye lesingen
   av de 97 referansedokumentene med imaget fra 42b1c02.
2. Stopp og vis oppsummeringen (erstattet / ikke erstattet med grunner /
   tapte tall) før du sletter noe.
3. Fortsett deretter steg 2 og 3 som planlagt, og si fra før steg 4.
```

**2026-10-28 19:06**
```
Fra meg: ja, fortsett med steg 2 som godkjent: slett 2.1b-radene,
seed:export, pnpm seed, gjenopprett fra .local/document-run-e09a413-
reader-commit/ og bekreft 1 947 + 97 før noe annet. Kjør så steg 3
(consistency.py) og regenerer rapporten. Vis hovedtallet (feilleste tall
som når motoren, før/etter på referansesettet) og stopp før steg 4.
```

**19:53**: the regenerated report showed one new misread reaching the engine. The review session pointed out the cell, and the human checked the PDF.
```
Fra meg: sjekket 915648479/2021 i PDF-en (2020-kolonnen): Salgsinntekt
3 657 114, og en egen linje Annen driftsinntekt 1 899; Sum inntekter
3 659 013. OCR leste riktig – det er en skrivefeil i avskriften.
Rett transcriptions.csv (salgsinntekt, prior, 3659013 → 3657114) og
logg den i Corrections-tabellen med dagens dato. Merk i README at denne
rettelsen ikke var blind: review-sesjonen pekte ut cellen etter at den
nye rapporten viste avviket, og jeg sjekket PDF-en. Egen commit.
Start deretter steg 4.
```
*Changed:* the "new misread" was the transcription's error, not the reader's. The correction is logged as not blind (`77b51c9`). The report now counts it apart from the six blind corrections (`2ac2cdb`).

**2026-10-29 05:39**: the human wanted to close the lid without stopping the container.
```
Fra meg: jeg lukker lokket og går på jobb. Maskinen går i dvale midt i
steg 4. Hvis containeren avslutter etter dvale: ikke gå videre til steg 5.
Sjekk først at ingen dokumenter står igjen med reader_commit e09a413 eller
som "ikke erstattet" på grunn av nettverk – kjør i så fall --reread igjen.
Vent på meg før steg 5.
```
After the machine woke, the re-read hung for about two hours on one fetch, although the fetch has a 60 s timeout. The BMAD session stopped the container and restarted the re-read, which resumed where it stopped. It did this without asking first. The human approved it afterwards:

**17:55**
```
Fra meg: bra. Legg hengingen etter dvale inn som kjent problem i PR-en og
som en deferred-post: fetch med 60 s timeout hang i ~2 t etter at maskinen
våknet; foreslå en tidsgrense per dokument (watchdog) utenfor
nettverkskallet. Ikke rett det i 2.3b.
```

**21:42**: after the review session had checked in the database that all 2 044 documents carried `2ce5a50`.
```
Fra meg: steg 4 er ferdig (exit 0). Alle 2 044 dokumenter har reader_commit
2ce5a50, ingen ble ikke erstattet, og ingen tall gikk tapt. Fortsett med
steg 5–7: pnpm analysis:document-run after-2.3b, generer rapporten på nytt,
commit rapporten og ocr-consistency-2026.json i egne commits, ta den andre
dumpen med kopi til peerless-backups (sjekk sha256), og kjør hele
testsuiten i omganger. Ikke push eller opprett PR før jeg sier fra.
```

**2026-10-30 07:03**
```
Fra meg: godkjent. Push og opprett PR-en (Closes #38). PR-en skal ha
før/etter-tabellen, si at 0 dokumenter ikke ble erstattet og 0 tall gikk
tapt (første kjørings 1 414 dokumenter sjekket mot dumpene), liste
henget etter dvale som kjent problem, si at seed-rundturen ikke er kjørt
lokalt og at CI er kontrollen, og lenke sesjonsfila.
```

### Prompts to the review session

Most were status questions during the long runs, such as `sjekk`, `hvor langt nå`, `nå?` and `hvor lang tid tar det`. The review session answered each one from the database: documents per reader version and status, and the latest `read_at`. These prompts shaped the run:
- `pcen startet på nytt hvor var vi? … hva burde prompt være nå da?` (10-25): led to the 17:15 prompt and the `901a78d` correction.
- `nå er det i morgen kan du gi meg en prompt` (10-27): the review session first checked that Brønnøysund answered 200 on `/aar`, the document PDF and the key-figures API, then drafted the 16:53 prompt.
- `ønsker ikke å drepe conatiner - skrur ikke av pcen bare lukker lokket` (10-29): the human's decision. It led to the 05:39 prompt, which made a resumed `--reread` the recovery path instead of a stopped container.

### Result

"Sum egenkapital og gjeld" is read in:
- the 2.1b run, this-year columns: 1 930 of 1 946, up from 1 110;
- the 2.1b run, last-year columns: 1 894 of 1 946, up from 1 094;
- the reference set: 96 of 97 this year and 93 of 97 last year, up from 49 and 47;
- the spike's filings: 178 of 178, up from 102.

Reconciled this-year columns in the 2.1b run went from 1 801 to 1 834. In the reference set, misread figures reaching the engine stayed at 0, and phantom figures at 0. No document was left unreplaced, and no figure was lost.

The first run's summary was lost when it hung. Its 1 414 documents were therefore checked against the dumps taken before and after the re-read. That check used a script that is not committed.

The rows after the re-read are dumped to `.local/document-run-2ce5a50/`. The copy in `peerless-backups` has the same sha256.

### Checks before merging

The review session checked these against the database and the repository:
- every document carries `2ce5a50`;
- the status counts and the before/after counts in `document-run-counts-*.json`;
- the dump's row counts and its backup checksums;
- that `seed/`, `supabase/` and `ingest/` are unchanged since `5444765`, so CI's seed round trip covers the round trip that was skipped locally.

CI on `fc6f559` was green. At the human's request (`gjerne`), the review session posted the GitHub review with six line comments. The PR was merged at 07:15 UTC as `1dd628e`, with 19 commits from `a07089a` to `fc6f559`.

---

## The lecturer's session-log skill fitted in (on `main`: `d0c0983`, `ab96819`, `e5ad746`)

The pull after PR #40 brought two commits from the course lecturer, Bård Pettersen (`1adcdf8`, `35a9590`, 2026-10-26). They added the `sesjonslogg` skill and a section at the end of AGENTS.md.

### Prompts to the review session

**2026-10-30 07:20**
```
kan vi rydde i repoet vedrørende sesjonlogg ferdigheten slik at det er ryddig?
```
The review session found that the skill was in the repository and that AGENTS.md referred to it, so it asked how to tidy it. The human chose `Behold og tilpass (Anbefalt)` in the menu.
- **The skill file was left as it is.**
- **The AGENTS.md section was rewritten in English and moved under Git workflow** (`d0c0983`). It now says:
  - the log is short and links the session file instead of repeating it;
  - it is written in Norwegian, the one exception to English documentation;
  - open items go to `deferred-work.md` or a GitHub issue, not to a third list in `.logs/<user>/issues.md`.
- **The first session log** was committed as `ab96819`.

**07:24**
```
han er foreleser - er den ryddig nå?
```
AGENTS.md now names the lecturer as the skill's source (`e5ad746`). The review session also pruned 17 stale remote-tracking branches; this touched no file.

*Corrected:* the review session pushed the log commit, although the skill says to commit it locally only. It said so in its reply.

---

## Story 2.4: withdrawn companies disappear (#41, PR #42)

Every `Fra meg:` prompt below was drafted by the review session and pasted by the human, who made the decisions in it.

### Prompts to the BMAD session

**2026-10-30 07:26**
```
/bmad-build Story 2.4
```

**07:37**: two decisions and a size check, answered in the menu.
```
Fra meg: 1a, 2a, keep – med disse tilleggene:
1a: Det nye skjemaet run trenger sin egen grants-test som går gjennom
alle roller: ingest kan skrive, derive og loader har ingen
skrivetilgang, og reader har ingen tilgang med mindre noe faktisk
trenger det. Testen skal løkke over alle relasjoner i run, slik
grants.test.ts gjør for register. AGENTS.md og AD-2/AD-3 skal nevne
skjemaet i samme PR.
2a: Før kjøringen: ta dump av dokumenttabellene til .local/ og kopier
den til peerless-backups (sjekk sha256). En 410 sletter med cascade
også dokumentradene fra 2.1b, som bare finnes lokalt. PR-en skal liste
hvert slettet orgnr, hvor mange dokumentrader som fulgte med, og om det
var blant de 407 i 2.1b-settet eller i OCR-referansesettet. Etter
kjøringen: ta en ny dump, som erstatter .local/document-run-2ce5a50/
som gjenopprettingskilde. Den gamle har rader for slettede orgnr og vil
feile på fremmednøkkelen. Oppdater README "Seed" til det. Seed-eksporten
etter kjøringen skal ligge i en egen commit, så den oppdaterte
nøkkeltallsdataen ikke blandes med koden. Si fra før kjøringen
starter, og oppgi omtrent hvor lang tid den tar.
```
*Changed:* the run record moved to its own schema, `run`, with its own grants test. The live run got a dump before it and after it.

**07:39**: approval, with three additions that the review session found in the spec.
```
Fra meg: godkjent, med tre tillegg i spec-en:
1. Seed-eksport og pnpm seed: lokalt ligger 2.1b-radene for 407
selskaper som ikke står på allow-listen, så seed:export nekter, og
pnpm seed sletter dem. Gjør som i 2.3b: eksporten skjer bare i
akseptansekjøringen (steg e). Ingen sletting av 2.1b-rader og ingen
pnpm seed uten at jeg har sagt ja. Gjenopprett alltid fra den nyeste
dumpen etterpå, og bekreft radtallene. Rett Tasks og Verification
etter dette.
2. Sperre mot avkortet bulk: hvis flere enn 1 % av de lagrede
selskapene mangler i bulk-fila, kjøres ikke sletting og oppslag. Det
skrives som feil i run-recorden, og kjøringen avslutter med 1. Lag en
test for dette.
3. Hvis et slettet orgnr er i OCR-referansesettet (drawn.json): stopp
før seed:export og spør meg. SM-2-rapporten og testen som sjekker at
den er byte-identisk, endres da.
Approve and continue.
```
*Changed:* the spec's tasks would have run `seed:export` and `pnpm seed` during the build. The export refuses while the 2.1b rows are present, and `pnpm seed` deletes those rows. The other two additions became decisions D5 (the 1 % guard) and D6 (stop on a deleted reference orgnr).

**08:17**: the BMAD session's review found that the spec's premise was wrong. An ordinarily dissolved company answers 200 with a `slettedato`, not 410. The review session checked this against the live register on the same three orgnrs before drafting the answer.
```
Fra meg: 4a, 5a, 6 med ett tillegg, og endre koden der den står.
Q4a: lagre slettedato på register.company, tell "avviklet" i
run-recorden, ikke som feil. Bare 410 sletter. Om avviklede selskaper
skal ut av peer-puljen, legges inn i deferred-work.md.
Q5a: kjør målingen (bulk mot lagrede orgnr, lesing bare, og et utvalg
oppslag) og vis meg tallene før grensen settes. Første ekte kjøring har
ingen lagret slettedato, så alle selskaper avviklet siden 1.3a teller
med. Målingen må vise om det går under grensen.
Q6: 404 og live/avviklet gir ikke exit 1. Exit 1 gis for sperren, for
en sletting som feiler, og for nettverksfeil i oppslaget (5xx, timeout),
fordi sjekken da ikke ble fullført.
Ikke revert: endre koden der den står. Skriv beslutningene inn i
spec-ens Spec Change Log med dato. Rett data-sources-brreg.md: et
avviklet selskap svarer 200 med slettedato (verifisert 2026-10-30 på
930663530, 974676125 og 936651437), og 410 gjelder bare fjernede enheter.
```
*Changed:* as first built, every dissolved company would have been a permanent failure, every plain run would have exited 1, and normal churn would have tripped the guard, so nothing would ever have been deleted. Dissolved companies are now kept, with their date. The BMAD session had proposed exit 1 only for the guard and a failed delete. The review session added a lookup that did not complete, because then the check is not finished.

**08:28**
```
Fra meg: go a–d. Hold maskinen våken (jeg lar lokket være åpent).
Stopp etter d og vis meg: radtallene før og etter, sha256 for begge
dumpene og kopiene i peerless-backups, tabellen fra c, og hvor mange
som ble avviklet, slettet og feilet i run-recorden. Steg e venter på
eget ja fra meg. Legg "slettedato som kommer tilbake" inn i
deferred-work.md hvis det ikke står der.
```
The live run took 2 h 42 min. It deleted the 8 bankruptcy and forced-dissolution estates the measurement had predicted, none with a document, and marked 48 companies dissolved. It had no failures.

**2026-10-31 15:38**
```
Fra meg: go e. Bekreft radtallene etter gjenopprettingen (1 947 + 97
dokumenter, 3 892 + 194 kolonner) før noe annet. Nevn i PR-en at
dokumentet for 823633882/2025 nå peker på det nye regnskapet (7242006),
men ble avstemt mot det gamle, og lenk til omleverings-saken i
deferred-work.md.
```

**16:09**: the PR draft credited the three review layers to the review session. They were subagents of the BMAD session.
```
Fra meg: ja til push, issue og PR, men rett først krediteringen i
PR-utkastet og sesjonsfila. De tre review-lagene var subagenter i
BMAD-sesjonen, ikke review-sesjonen. Skriv det slik det står i 2.3b
("subagents of this session"). Kreditér review-sesjonen for: sperren
på 1 % (D5), stoppet ved et slettet referanse-orgnr (D6), dump før og
etter kjøringen og eksport bare i akseptansekjøringen, og tillegget i
Q6 om at et ufullført oppslag gir exit 1. Funnet om at avviklede
selskaper svarer 200 med slettedato er BMAD-reviewens og BMADs egen
live-sjekk. Commit rettingen i sesjonsfila før push.
```
*Changed:* the session file, the PR and a `deferred-work.md` entry with the same wrong credit (`6df9e52`).

**16:26**: the session log (`81c77ad`) had been committed but not pushed, so it would have stayed behind when the branch was deleted.
```
Fra meg: push 81c77ad (sesjonsloggen) til PR-en nå, så den kommer med i merge.
```

### Prompts to the review session

Most were status questions during the 2 h 42 min run, such as `kan du se hvor langt i prosessen den er?`, `sjekk igjen`, `nå da?` and `nå?`. The review session answered each one from the container log and the database. These prompts shaped the run:
- `fikk ikke svar på bmad 2.4` (10-30): the review session's answer to the 07:37 questions had been written between tool calls and was not shown. It was given again.
- `okei, men må dra om 7 - 8 min` and `men må lukke lokket - hvor lenge må jeg vente før jeg kan det` (10-30): the review session said to wait until the ingest container had ended. Steps c and d could be redone after sleep, but the run could hang as in Story 2.3b.

### Result

The live run (run record 229) found 56 of 17 557 stored companies absent from the bulk file (0.32 %). Of these, 48 are dissolved and kept, and 8 were deleted on 410. No document row was lost. The seed was re-exported on its own (`40295b5`), and the 2.1b rows were restored from the new dump `.local/document-run-2.4/`. The register replaced one filing during the run (823633882/2025). Its document now points to a filing it was not reconciled against; this is listed in the PR and in `deferred-work.md`.

### Checks before merging

The review session checked these against the database and the dumps:
- run record 229;
- the row counts after the run and after step e;
- the sha256 of both dumps and their backup copies;
- that 823633882/2025's document points to 7242006.

CI was green on `664c275` and `81c77ad`. At the human's request (`ja post review`), the review session posted the GitHub review with seven line comments. The PR was merged at 16:34 UTC as `e91327b`.

---

## Story 2.5: the business-model fingerprint, stage 4 (#43, PR #44)

Every `Fra meg:` prompt below was drafted by the review session and pasted by the human, who made the decisions in it. The prompts name no company's type: the licence gate keeps that out of the repository for companies outside the allow-list.

### Prompts to the BMAD session

**2026-11-01 18:15**
```
/bmad-build Story 2.5
```
Before this, the human finished the labelled set's blind subsample (180 pairs), so those labels could not follow the fingerprint's rule. Story 5.1's rubric was already committed (`737d089`), and its branch was pushed first.

**18:39**: four questions. The BMAD session recommended treating an empty line as 0.
```
Fra meg: 1a, Q2 som under, 3a med stopp, Q4 som under, keep.
Q1a: terskler og regel låses før spredningstesten kjøres, og justeres
ikke etter data. PR-en sier at produktselskaper som kostnadsfører
utviklingen blir konsulent, og at 5.2 måler det.
Q2: ikke tom = 0. Målt lokalt: lønn er tom i 531 av 1 920 avstemte
kolonner, bare 45 summerer til totalen, og medianen uforklart er 62 %
av kostnadene. Referansesettet har 915338534/2023 og 936252710/2024 med
lønn i millioner lest som tom. Regel: en tom kostnadslinje ligger i
[0, total minus leste linjer]. Ligger hele intervallet i ett bånd, er
båndet kjent. Ellers er kategorien ukjent. Negativt uforklart beløp gir
ikke fingeravtrykk. Ukjent kategori som avgjør typen gir ingen type,
ingen eksklusjon på trinn 4, og telles (ikke annet). Mål på lokale data
hvor mange som får type, per type og ukjent, bare som samletall, og vis
meg det før review. Er andelen høy, foreslår du en egen story for å
lese kostnadslinjene, som 2.3b.
Q3a: spredningen beregnes etter Q2-regelen. Feiler et bånd: stopp og
vis meg tallene. Ikke dropp noe automatisk.
Q4: ikke ja til alt nå. Etter review ber du om ett ja før pnpm seed,
med dumpen sjekket mot databasen. Etter det: seed, steg 2, seed:export
i egen commit, gjenopprett document-run-2.4 og bekreft radtallene, kjør
steg 2 og spredningsskriptet. Stopp hvis noe avviker.
Legg i deferred-work.md, kreditert review-sesjonen: bare 104 av 845
selskaper i fasitsettet (drawn.json) har leste dokumenter, så 5.2 kan
ikke måle fingeravtrykk-laget uten en dokumentkjøring for dem, rundt 26
timer med alle år eller rundt 5 timer med bare referanseåret. Bør
kjøres etter en eventuell leser-retting.
```
*Rejected:* "empty = 0". The review session measured it first: most empty cost lines are figures that were not read, so 0 would have given many companies the wrong type and excluded them from peer groups. The interval rule replaced it. The same check found that 741 of the labelled set's companies have no read document, which Story 5.2 needs.

**18:53**: the BMAD session proposed total assets as the bound for empty balance lines.
```
Fra meg: approve and continue, med én endring i D2:
Punkt 1: bruk en strammere øvre grense for tomme balanselinjer enn
totalen. Immaterielle og varige driftsmidler ligger i
[0, sumAnleggsmidler minus de av disse linjene som er lest], og varer i
[0, sumOmloepsmidler minus de av disse linjene som er lest], begge fra
key_figures. Er subtotalen NULL (et tomt element er ikke 0), brukes sum
eiendeler som grense. Negativ rest gir ikke fingeravtrykk. Subtotalene
brukes bare som øvre grense, aldri som trekk. Målt lokalt: av 431
kolonner med tom immateriell linje blir 330 avgjort under 5 % med
sumAnleggsmidler, mot 165 med sum eiendeler. Test begge grensene og
NULL-tilfellet. Spørsmålet kom fra review-sesjonen, så krediter den.
Punkt 2: ja, testen skal feile når fila mangler, ikke hoppes over.
Husk små commits underveis, og ikke vis meg fingeravtrykk for orgnr i
fasitsettet.
```

**19:35**: the first totals: 47 % of companies had no type, and 63 of 84 "negative" skips were within 5 kr.
```
Fra meg: start code review, med disse endringene først:
1. Negativ rest: tillat grensen på 5 kr fra within_document_bound_kr
   (register-avrunding, AGENTS.md). En rest fra -5 kr til 0 regnes som
   0. Under -5 kr gir fortsatt ikke fingeravtrykk. Verdien skal settes
   ett sted: ingen ny konstant uten en test som feiler hvis den avviker
   fra ingest/config.toml. Skriv det i Spec Change Log, med dato og min
   beslutning, og at utelatelsen kom fra review-sesjonens regeltekst.
   Grunnen er dokumentert avrunding, ikke resultatene.
2. Rett grants-testen "refuse ingest and derive writes on them" i egen
   commit, slik de nye 2.5-testene gjør det, og bekreft at den feiler
   når en ekstra skrivetilgang gis. Blir det stort: si fra, så blir den
   i deferred-work.md.
3. Kostnadslinje-storyen: ja, som egen story etter merge av 2.5. Skriv i
   deferred-work.md at den kommer før dokumentkjøringen for fasitsettet,
   så de 741 selskapene ikke må leses to ganger.
4. Terskler og typeregel er låst (D1). Skriv i PR-en: forhandler er 105
   av 223 med type. Mulige grunner er at forhandler kan avgjøres med
   ukjente linjer, og at underleverandører føres som varekostnad, som
   kan gjøre konsulentselskaper til forhandler. 5.2 måler det, ingen
   justering nå.
5. Vis antall før og etter stage 4 for demo A og B og om minstegruppen
   på 10 holder, som samletall. Vis ingen resultater for orgnr i
   fasitsettet.
D4 venter fortsatt på eget ja fra meg etter review.
```
*Corrected:* the rule the review session drafted at 18:39 left out the register's rounding. The grants test, found by the BMAD session, passed whatever the grants were, because the test connection could not switch role (`a49a164`).

**19:49**: the BMAD session's review found that a fingerprint tied to its document column could never leave the seed through an open licence gate, and that it could go stale.
```
Fra meg: (a), og endre koden der den står. Epics sier allerede at
fingeravtrykket refererer selskapet (epics.md:1469), så spec-en rettes
tilbake til det. Skriv det i Spec Change Log med dato og min beslutning.
Tre presiseringer:
1. derive kjøres fra scripts/run-ingest.ts etter at containeren er ferdig,
   aldri fra Python (AD-2), etter plain, --documents og --reread. Plain er
   med fordi den oppdaterer API-subtotalene derive leser.
   --companies-only er ikke med.
2. derive kjøres også når steg 1 avslutter med exit 1, og exit-koden fra
   steg 1 beholdes. Feiler derive, er det synlig og gir exit ulik 0, og de
   gamle radene står (én transaksjon). Test hver av disse, slik at testen
   feiler hvis kallet fjernes.
3. En drept kjøring lar fingeravtrykk stå utdatert til neste derive. Legg
   det i deferred-work.md, og skriv i README at derive må kjøres etter
   gjenoppretting fra dump.
Når porten er åpen, finnes ikke tallene bak andre selskapers fingeravtrykk
i seed. Testen som regner om fingeravtrykkene må derfor regne om de
allow-listede, og telle og si fra om de andre, ikke hoppe over dem i
stillhet.
Triagen er godkjent. Vis meg også før D4, bare som samletall:
- demo A og B før og etter stage 4, og om minstegruppen på 10 holder
- andelen uten type i referanseåret, som er det stage 4 faktisk ser
  (punkt 24)
Ingen resultater for orgnr i fasitsettet. D4 venter på eget ja fra meg.
```

**20:05**: the BMAD session's plan began with `pnpm seed`, which refuses a seed with an older migration id.
```
Fra meg: go D4, men med denne rekkefølgen. pnpm seed nekter nå, fordi
seed-en har en eldre migration_id. Gjør det som i 2.4:
1. Sjekk .local/document-run-2.4/ mot databasen (radtall og sha256).
   Stopp hvis noe avviker.
2. Slett radene utenfor allow-listen i én transaksjon som sjekker antallet
   (1 947 dokumenter, 3 892 kolonner, og 97 + 194 igjen).
3. pnpm derive.
4. pnpm seed:export, seed-en i egen commit.
5. pnpm seed to ganger med samme tall, og ny eksport uendret.
6. Gjenopprett .local/document-run-2.4/ og bekreft 1 947 + 97 og
   3 892 + 194.
7. pnpm derive, deretter pnpm analysis:spread. Feiler et bånd: stopp og
   vis meg tallene.
Kjør hele testsuiten etterpå. Skriv i PR-en, med eksakte tall, hvor mange
i A og B sine grupper som bare er med fordi de mangler type eller
fingeravtrykk, ikke fordi typen stemmer. Ikke push før jeg sier fra.
```

**20:07**: step 1 stopped: the column dump's sha256 differed from a fresh copy. The review session compared the rows itself and found the same rows in another physical order.
```
Fra meg: (a). Review-sesjonen har sammenlignet radene utenfor allow-listen
med dumpen, uavhengig av deg: 3 892 rader, samme kolonner, sortert
identisk. Fortsett med steg 2–7. I steg 6 er kontrollen radtall og sortert
innhold mot dumpen, ikke sha256 av filene. Sha256 av selve dumpfilene skal
fortsatt stemme med kopien i peerless-backups, så sjekk det før steg 2.
Skriv avviket og forklaringen i sesjonsfila. Ikke push før jeg sier fra.
```

**20:17**: the PR draft still had the figure from before the 5 kr change (223).
```
Fra meg: go. Opprett issue, push og opprett PR-en. Bruk tallene fra etter
5 kr-endringen: forhandler er 105 av 225 med type (ikke 223), og 196 uten
type (47 %) per selskap ved nyeste år. Ta med tabellen over hvem som er med
bare på grunn av manglende signal, og at terskeltesten (b60d71b) ble
committet før dataene ble lest (714426f). Si også at
stage 4 foreløpig bare skiller ut en liten del, og at kostnadslinje-storyen
er neste. Push sesjonsloggen sammen med resten, så den er med før merge.
```
*Error in this prompt:* "bare skiller ut en liten del" was the review session's wording, and it was wrong. Corrected at 20:21.

**20:21**
```
Fra meg: rett overskriften i PR-beskrivelsen. "Stage 4 currently removes
only a small part of the group" er feil, og formuleringen kom fra
review-sesjonen. Stage 4 fjerner 149 av 396 for A (38 %) og 147 av 398 for
B (37 %) i standardbåndet, men rundt 80 % av dem som blir igjen er med bare
fordi signalet mangler. Skriv det slik. Vis også, som samletall for A og B
i standardbåndet, hvor mange av de fjernede som er forhandler, produkt og
annet, og knytt det til risikoen for at underleverandører ført som
varekostnad fjerner ekte konsulent-peers. Dette endrer bare PR-teksten:
ingen commit, så CI kjører ikke på nytt. Rett det samme i sesjonsfila hvis
formuleringen står der, i en egen commit.
```

**20:24**: the BMAD session stopped before publishing that breakdown. It would have revealed the type of two named companies outside the allow-list, and it pointed to a further risk in the `produkt` rule.
```
Fra meg: (c), med én endring: sesjonsfila og deferred-work.md er også
offentlige, så typen til A og B skal ikke stå der heller. Ikke oppgi typen
til noe navngitt selskap utenfor allow-listen noe sted i repoet.
I PR-en, uten å navngi noen: rundt 63 % av de fjernede i standardbåndet er
forhandler. To risikoer gjelder regelen:
1. underleverandører ført som varekostnad kan gjøre konsulentselskaper til
   forhandler
2. sum_immaterielle_eiendeler inneholder også utsatt skattefordel og
   goodwill, så et konsulentselskap kan bli produkt, og da fjernes alle
   ekte konsulent-peers. Regelen skiller ikke dette i dag.
5.2 måler begge. D1 er låst, så ingen justering nå.
I deferred-work.md, kreditert BMAD-sesjonen for funnet og review-sesjonen
for neste steg:
- Kostnadslinje-storyen utvides til å lese delene av immaterielle
  eiendeler (utsatt skattefordel, goodwill, FoU), så 5.2 kan vurdere en
  regel som bare teller egenutvikling.
- Story 5.4 må kontrollere demoselskapenes type mot hva de faktisk driver
  med før de låses, lokalt, uten å publisere typen før lisensporten er åpen.
Commit deferred-work.md alene. Ikke endre kode.
```

### Prompts to the review session

```
okei, kan man kjøre 2.5 før man gjør subject subscription?
```
(10-31; meaning the labelling.) The review session answered that only the rubric had to come before Story 2.5, but advised finishing the blind subsample first, because Story 2.5 shows how the fingerprint decides. The human chose that: `okei, da venter jeg til det er fullført`.

`da er labels blind ferdig` (11-01): the review session validated the 180 labels, committed them on the Story 5.1 branch and pushed the branch.

### Result

Of 2 043 current columns, 1 876 have a fingerprint. Of the 421 companies, at each one's newest fingerprinted year: 58 produkt, 49 konsulent, 105 forhandler, 13 annet and 196 (47 %) without a type. Every spread band passed; the threshold test (`b60d71b`) was committed before the data was read (`714426f`). In the standard band stage 4 removes 149 of 396 candidates for A and 147 of 398 for B, but about 80 % of those who remain are in only because a signal is missing. The story to read the cost lines and the parts of intangibles is next, before the labelled set's document run.

### Checks before merging

The review session checked the row counts, the seed's 85 fingerprints, the order of the spread test's commits, and that no demo company's orgnr appears in the changed documentation. CI was green on `5d7e704`. At the human's request (`ja post review`), the review session posted the GitHub review with nine line comments. The PR was merged at 20:38 UTC as `bc30267`.

---

## The PRD drift series brought onto `main` (`21ae99e` to `165e1cf`, `4e1b9d7`)

A Claude Desktop session on 2026-11-04 reviewed the PRD against what Epics 1–2 built (`docs/ai-sessions/2026-11-04-prd-drift-review.md`). The session saved its work as a patch series, with instructions, in the human's Downloads folder. Its own prompts are not in this log: that transcript is not in Claude Code.

### Prompts to the review session

**2026-11-05 19:40**
```
Kan du se på denne fra chat med claude i desktop - er lagt til filer for endringer som gjelder prd og konkurrenter:
```
The review session found that the 12 patches applied without conflict, changed no code, and held no secret or demo orgnr. Every commit hash differed from the instructions, so it did not push. The instructions said not to push if the hashes did not match.

**19:43**
```
ja gjør det du anbefaler
```
The series landed on `main` from `21ae99e` to `165e1cf`, and was pushed with the 2.5 session log (`f9249a6`). The new hashes still differ, for a cause the review session did not find. `4e1b9d7` adds a table from the old hashes to the new ones, because the documents cite the old ones. The series brought the AGENTS.md rule "A decision travels upstream in the PR that makes it", so the review session drafted the prompt that merged `main` into the 2.5b branch (below, 19:51).

`hvordan blir dette bli ferdig med 2.6 først - også merges de?` (19:46): the review session explained that 2.5b is finished and merged first, and 2.6 starts from `main` after that.

*Open:* the four new open questions in PRD §11 (21–24) are not GitHub issues yet.

---

## Story 2.5b: read the cost lines and the parts of intangible assets (#45, PR #46)

Every `Fra meg:` prompt and menu answer below was drafted by the review session and pasted or chosen by the human, who made the decisions in it. Fingerprint results are given as totals only: eight of the reference set's companies are also in the labelled set.

### Prompts to the BMAD session

**2026-11-01 21:41**
```
/bmad-build Story 2.5b: les kostnadslinjene og delene av immaterielle
eiendeler (deferred-work.md, de to postene fra Story 2.5). Opprett
storyen og issuet først. Start med en probe, som i 2.3: finn ut hvorfor
linjene kommer ut tomme, med bevis fra dokumentene, før noe rettes. Mål
før og etter på referansesettet, med feilleste tall som når motoren og
andelen uten type. Flere leste tall skal ikke betales med nye feil.
D1 er låst: ingen endring i terskler eller typeregel. Vis ingen
fingeravtrykk-resultater for orgnr i fasitsettet. Omlesing og
dokumentkjøringen for fasitsettet starter bare etter eget ja fra meg.
```

**21:52**: four questions in the menu. The human chose the recommended option in each:
- "All four lines", meaning every printed part of intangible assets becomes a field;
- "You transcribe them": the human transcribes the parts in the reference set;
- "Decide after probe" for a cost-line sum gate;
- "No, after merge" for the labelled set's document run.

**21:53**
```
Fra meg: approve and continue, med tre endringer. Skriv dem inn i spec-en
før du starter:
1. Avskriften av de fire delene kommer før proben. Lag malen først, uten
   å vise meg noen OCR-verdier. Jeg skriver av, og review-sesjonen sjekker
   at delene summerer til totalen. Vis meg proben først etter at avskriften
   er committet.
2. Seed og omlesing følger rekkefølgen fra 2.5. Ingen pnpm seed og ingen
   sletting av 2.1b-rader uten mitt ja. Rett Tasks og Verification:
   seed:export kan ikke kjøres med 2.1b-radene i databasen. Rekkefølge etter
   ja: dump og backup; --reread av alle lagrede dokumenter; ny dump; slett
   radene utenfor allow-listen i én kontrollert transaksjon; pnpm derive;
   seed:export i egen commit; pnpm seed to ganger og ny eksport uendret;
   gjenopprett fra den nye dumpen og bekreft radtallene; pnpm derive.
   Gjenoppretting fra en dump uten de nye kolonnene må fortsatt virke før
   omlesingen: test det, og README "Seed" må si hvilken dump som gjelder.
3. Legg inn tidsgrensen per dokument (watchdog) fra deferred-work.md i
   denne storyen, med test, i egen commit og før omlesingen, fordi rundt
   40 timer OCR venter. Når den utløper, listes dokumentet som ikke hentet,
   og kjøringen går videre.
```
*Changed:*
- **The transcription came before the probe**, so the human's reading of the parts could not follow the OCR. The template is `e9444da`.
- **The seed steps were reordered.** The spec would have run `seed:export` while the 2.1b rows were in the database, and the export refuses them.
- **The watchdog came into the story.** The 2.3b re-read had hung on a fetch.

**2026-11-05 19:51**: after the PRD drift series landed on `main` (above).
```
Fra meg: main er oppdatert med PRD-rettelsene (f9249a6), også AGENTS.md.
Hent origin/main inn i story/2.5b-read-cost-lines nå, og les den nye regelen
"A decision travels upstream in the PR that makes it". PR-en for 2.5b skal
ha linjen "Planning documents:".
Bygg deretter tidsgrensen per dokument, i egen commit. Jeg redigerer
analysis/ocr-reference/transcriptions.csv i arbeidstreet imens. Ikke rør
den fila, ikke bytt gren, og stage bare de filene du endrer selv, ingen
git add -A. Ikke kjør proben, og ikke vis meg OCR-verdier før avskriften
er committet.
```
The merge is `7174937`, and the watchdog is `6978bde`.

**20:17**
```
Fra meg: avskriften av de fire delene er committet (8e97232). Review-sesjonen
sjekket uten OCR-verdier at delene summerer til totalen i alle 23 kolonner.
Der totalen er 0, står den trykt som 0. Kjør proben nå (read-only, i
step-1-imaget), og stopp ved sjekkpunktet: vis meg årsakene per tom linje med
OCR-ordene som bevis, og foreslått retting, før layout.py eller documents.py
endres. Ta også med om nektede tall-tokens er en årsak, siden det avgjør
Q3. Ikke vis fingeravtrykk for orgnr i fasitsettet.
```
The probe is `bb9d4f4` (`analysis/output/empty-lines-probe.md`). It found four causes:
- refused figure tokens ("l" for 1);
- depreciation in other wordings;
- note references read as letters;
- plurals.

**20:48**: the checkpoint, answered in the menu.
```
Fra meg: godkjent F1–F3, med disse vilkårene (skriv dem i Spec Change Log):
F3: et tall fra sifferpasset slippes bare inn når alle operandene i
sjekken finnes, totalen (sum_driftskostnad eller sum_immaterielle_eiendeler)
er lest i vanlig pass, høyst ett operand kommer fra sifferpasset, og
summen stemmer innen 5 kr. Testene skal bruke probe-tilfellene:
l4 481 267 (sifferpasset gir 4 481 267, riktig 14 481 267), 8 605 8349
og 3 804 3836 skal alle nektes, og ett riktig tilfelle slippes inn.
Ingen reparasjon av tall: Ö skal ikke leses som 0, og linja forblir tom.
F1: den brutte etiketten "Avskrivning på varige driftsmidler og /
immaterielle eiendeler" matches bare som fortsettelse i
resultatregnskapet. Test begge veier: avskrivningslinja leses aldri som
immaterielle eiendeler i balansen, og omvendt.
Dagens matching skal fortsatt matche alt den matcher i dag. Kjør testene
for det.
Jeg sjekker to celler i avskriften mot PDF, ikke blindt, fordi proben
viste OCR-verdien: 922184534/2025 prior lønnskostnad og 927533235/2023
current lønnskostnad. Vent med målingen til det er avklart.
```
In the same menu, the human chose "Som 0, bare i sperren" for a line that was neither read nor offered.

*Changed:* the BMAD session proposed a sum gate for the digits pass. The conditions made it unable to admit a wrong figure:
- the total must come from the plain pass;
- at most one operand may come from the digits pass;
- the probe's three misreads must be refused, by test.

The regression check that every old match still holds became part of F1. That check is the 1 486 matches, all unchanged. The fixes are `281f134`, `8c85ca8` and `bd94b80`.

**21:06**: a follow-up question, answered "Uten rad regnes som 0". The review session's reasoning was that a missing line counted as 0 can never make a wrong figure pass: the sum then does not add up, and nothing is admitted. A row that matched but could not be read leaves the gate not evaluable.

**21:41**: two questions in the menu. "Utvikling" as a variant of research and development was kept ("Ja, behold"). For a blank printed row:
```
1, som 0 i sperren, med to tillegg: (a) en test med 994176021/2021-tilfellet
som viser at sperren ikke slipper inn noe når en trykt linje mangler,
(b) rapporten etter omlesingen oppgir hvor mange tall sperren slapp inn,
og hvor mange av dem som bygde på en blank rad regnet som 0, som samletall.
```
*Changed:* the gate's report counts what it admitted and how many of those rested on an operand counted as 0 (`1514ef5`, `scripts/sum-gates.ts`).

**21:45**
```
Fra meg: begge avskriftscellene er sjekket mot PDF-en, ikke blindt, fordi
proben hadde vist OCR-verdien. Avskriften stemmer i begge, og ingenting
rettes:
- 922184534/2025, kolonnen for 2024, lønnskostnad: 31 286 483. Kostnadene
  summerer til 104 938 509 mot "Sum kostnader" 104 938 508 (1 kr avrunding).
- 927533235/2023, kolonnen for 2023, lønnskostnad: 1 448 646. Kostnadene
  summerer nøyaktig til 2 280 576.
OCR leste 6 som 5 i begge. Med OCR-tallet ville summen vært 999 kr og
100 kr feil, så sperren ville nektet. Skriv dette i sesjonsfila og i
README-en for referansesettet, som en kontroll uten rettelse. Det skal
ikke inn i rettelsestabellen. Fortsett med målingen og kodegjennomgangen.
Omlesingen starter først etter ja fra meg.
```
The check is `3d32823`.

**21:57**: the BMAD session's review found that an abandoned fetch keeps running. If the network hung, every remaining document would wait 600 s, about 330 hours in all.
```
1, stopp etter 3 utløpte hentinger på rad, med tre presiseringer:
(a) En forlatt henting skal aldri føre til en skriving. Resultatet kastes
selv om den blir ferdig senere. Lag en test der hentingen fullføres etter
tidsgrensen og ingenting skrives.
(b) Tråden for en forlatt henting må ikke hindre prosessen i å avslutte
(daemon eller tilsvarende). Kjøringen skal kunne avslutte med kode 1 selv
om tre hentinger fortsatt henger.
(c) Stoppen skrives i run-recorden med grunn, og telleren nullstilles når
en henting lykkes. En ny kjøring fortsetter der den slapp.
```
The stop is `89f45f7` and `19b541b`, with a test for each of (a) to (c).

**22:13**
```
Fra meg: ja til C2, med to endringer:
0. Først: supabase migration up (ingen reset). De fire nye kolonnene
   finnes ikke lokalt nå, så omlesingen ville feilet. Bekreft at
   radtallene er uendret (2 044 dokumenter, 4 086 kolonner, 1 876
   fingeravtrykk) og at kolonnene finnes. Ta dumpen i steg 1 etter dette.
2. Anslaget: 40 timer var omlesing pluss fasitsett til sammen. Mål tiden
   på de første 20 dokumentene og gi meg et ekte anslag. Hold maskinen
   våken gjennom hele kjøringen, ikke bare 4 timer.
Ellers som du skrev, med de ni stegene. Stopp og vis meg tallene etter
steg 2 (erstattet, ikke erstattet med grunn, tapte tall, og hva sperrene
slapp inn), før noe slettes i steg 4. Ingen push før jeg sier fra.
```
*Corrected afterwards:* item 0 rested on a mistake by the review session. It searched for the new columns without the `_ore` ending, found none, and said the migration was not applied. It was applied. The review session said so during the run; the extra step did no harm.

*Changed:* the BMAD session had read "about 40 hours" as the re-read alone. That figure was the review session's, for the re-read and the labelled-set run together. The measured estimate was 20–23 hours; the 2.1b re-read took 11 h 44 min.

**22:46**
```
Fra meg: (a). Jeg kjører keep-awake og omlesingen av 2.1b-radene i mine
egne PowerShell-vinduer. Omlesingen venter til referansesettet er ferdig,
og loggen går til .local\reread-2.1b-2.5b.log. Ikke start noe selv. Når
jeg sier at kjøringen er ferdig, sjekker du run.step1 for begge kjøringene,
at alle dokumenter har ny reader_commit, og at pnpm derive har kjørt, og
viser meg tallene fra steg 2 før noe slettes.
```
Claude Code had stopped the BMAD session's three background commands because the machine was low on memory. The human ran the re-read in their own windows from then on.

**2026-11-06 10:55**: the review session's check of the finished re-read found the misread.
```
Fra meg: Kjøringen er ferdig, og review-sesjonen har sjekket den mot databasen og .local/document-run-2.4/. 1 947 dokumenter er erstattet, ingen tall er tapt eller endret, og 2 941 tall er lagt til. Ett funn som skal med i rapporten og PR-en: av 1 291 kolonner der avskrivninger er nytt og alle kostnadslinjene finnes, summerer 48 ikke til sum_driftskostnad innenfor 5 kr. 36 kolonner i 25 selskaper overstiger totalen (negative_unexplained gikk fra 21 til 35), og 10 av dem i 8 selskaper ligger nøyaktig 21 000 000 kr over, med avskrivninger lest som omtrent 23 mill. Undersøk ett av de åtte selskapene lokalt i PDF-en og si hvorfor: hvilken linje og hvilket siffer. Ikke endre noe i ingest/ nå, for det krever en ny omlesing. Legg rettingen inn i deferred-work.md med tallene, totaler uten orgnr. Vis meg så punkt 3 og 4, med sperrenes tall. Før steg 4: ta en ny dump av dokumenttabellene etter omlesingen til .local/ og en kopi til peerless-backups, og sjekk sha256. Den erstatter .local/document-run-2.4/ som kilde for gjenoppretting. Oppdater README «Seed» til det. Stopp og vis meg sha256 og radtallene (2 044 dokumenter, 4 086 kolonner) før du sletter noe.
```
*Found:* in one PDF, the BMAD session showed that Tesseract reads the leading "2" of a seven-digit depreciation figure as "23" in both passes. That is 21 000 000 kr too much. The column still reconciles, because no check within a document sums the cost lines. Before 2.5b this line was never matched. The BMAD session's count was 7 companies, not 8: the review session had used a looser bound. It also found something more important: all 17 current columns under the total have a fingerprint. The entry is `3d1a03d`, and the new restore source is `.local/document-run-2.5b/` (`970d572`).

**11:04**
```
Fra meg: ja til steg 4–9. Review-sesjonen har sjekket dumpene (sha256 er lik i peerless-backups, og ingen rader i document-run-2.5b/ er på allow-listen) og at document_column i dumpen er identisk med databasen. Kjør slettingen i én kontrollert transaksjon, deretter derive, seed:export i en egen commit, pnpm seed to ganger med uendret re-eksport, gjenoppretting fra .local/document-run-2.5b/, og derive til slutt. Bekreft etter gjenopprettingen: 1 947 + 97 dokumenter, 3 892 + 194 kolonner, og 1 865 fingeravtrykk som er like dem i document-tables-after-2.5b-reread/fingerprint.csv (sammenlign input_digest). Skriv rapporten og PR-utkastet, og ta med: 21-millionersfunnet med lenke til 3d1a03d, de 17 innværende kolonnene under totalen som har fått fingeravtrykk, og linjen «Planning documents:». Stopp før push og vis meg utkastet.
```
The seed is `9b82409`. `test/db/seed.test.ts` hard-coded 85 seed fingerprints, but the re-read makes 86 (`27a9743`).

**11:14**: the BMAD session pointed out that AGENTS.md wants deferred v1 work that no story owns to be a story in `epics.md`, not only an entry in `deferred-work.md`.
```
Fra meg: Story 2.5c i epics.md, ordnet etter 2.5b og før dokumentkjøringen for fasitsettet. Omfang: (1) nekt et siffertoken som er smalere enn antall sifre tilsier (3d1a03d); (2) finn årsaken til de 17 innværende kolonnene som summerer under totalen; (3) vurder en regel i src/engine: når alle kostnadslinjene er lest og ikke summerer til sum_driftskostnad innenfor 5 kr, brukes ikke kolonnen til fingeravtrykk, og grunnen registreres. Denne regelen krever ingen omlesing. Rett «Planning documents:» i PR-utkastet så den nevner 2.5c, og pek oppføringen i deferred-work.md til storyen. Commit det, og push deretter branchen og opprett PR-en. Gi meg lenken, og si fra når CI er grønn.
```
*Changed:* item 3 came from the review session. The digit-width rule catches only this one kind of error, while an engine rule also covers the 17 columns under the total, and needs no re-read. Story 2.5c comes before the labelled set's document run, so its 741 companies are read once, by a fixed reader (`3834156`).

### Prompts to the review session

- `tenkte ikke at jeg trengte labels.csv før story 5.1?` (11-01): the review session confirmed that the 720 remaining pairs are needed only before Story 5.2.
- `hva skal jeg nå da , på 2.5 er det csv` and `hvilke rader skal vi fylle ut` (11-05): the review session listed the 23 columns to transcribe and the rules: empty when a line is not printed, `0` when 0 is printed.
- `Ser du hva som er lagret nå? Har lagt inn for alle - markert i grønt er fordi det ikke står 0 - er tom`, `Står faktisk immatrielle eiendeler og 0 her` and `Ja gjør det nå` (11-05): the review session checked that the parts summed to the total in all 23 columns, with 0 kr off. It reverted Excel's rewrite of every `transcribed_on` date, and committed the transcription as `8e97232`.
- `står dette på den første:` and `Dette på den andre:` (11-05, with screenshots of the two PDFs): the review session confirmed both transcribed cells against the screenshots and drafted the 21:45 prompt.
- `kan jeg få det til powershell slik at maskinen ikke sovner` (11-05): the review session gave a keep-awake command for the human's own window, which ends when no ingest container is running.
- `sjekk` (11-06, four times): the review session followed the re-read from the log and the database. It compared every column with the dump taken before the re-read, which found the overshoot and drafted the 10:55 prompt.

### Result

All 2 044 documents are read by `19b541b`. Nothing was left not replaced, no figure was lost or changed, and no deadline ran out. The 2.1b re-read took 11 h 44 min. The reference set recovers 89,9 % of its figures exactly, up from 83,2 %, with depreciation right in 27 of 27 columns, up from 10. No misread figure reaches the engine from the reference set. The 2.1b fingerprints without a type fell from 49,9 % to 42,2 %. The misread found after the re-read is Story 2.5c.

### Checks before merging

The review session checked these against the database and the dumps:
- the re-read, column by column;
- the new dump's sha256 and its backup copy;
- that the restore dump holds no allow-listed row and equals the database;
- the counts after steps 4–9;
- that the seed commit holds only seed files and the seed's fingerprints only allow-listed companies;
- that the PR text names no orgnr.

CI was green on `b363a6e`. At the human's request (`ja post review`), the review session posted the GitHub review with seven line comments. The PR was merged at 10:33 UTC as `e30ba6d`.

## Story 2.5c: refuse a digit read as two, and cost lines that do not sum (#47, PR #48)

Every `Fra meg:` prompt below was drafted by the review session and pasted by the human, who made the decisions in it, except where noted. Fingerprint results are given as totals only: eight of the reference set's companies are also in the labelled set.

### Prompts to the BMAD session

**2026-11-06 11:43**
```
/bmad-build Story 2.5c: nekt et siffer lest som to, og kostnadslinjer som ikke summerer (epics.md, Story 2.5c, punkt 1–4). Hent main først (f80febf). Opprett issuet og branchen.
Start med en probe, read-only, før noe rettes:
(a) Finn årsaken til de 17 innværende kolonnene som summerer under totalen, med OCR-ordene som bevis. Vis det som totaler per årsak.
(b) Mål regelen for siffertoken-bredde på lagrede ord før den bygges. Hvor mange tokens ville blitt nektet i referansesettet og i 2.1b-radene, og hvor mange av de nektede i referansesettet er riktige etter avskriften? «1» er smalt, så regelen må tåle det. Et riktig tall som blir nektet, er en kostnad, ikke en gevinst.
(c) For punkt 4: tell hvor ofte bankinnskudd, kundefordringer, salgsinntekt og leverandørgjeld er feil i referansesettet i dag, og om en delsumkontroll ville fanget det.
Stopp ved sjekkpunktet og vis meg tallene før koden endres.
D1 er låst: ingen endring i terskler eller typeregel. Regelen i src/engine (punkt 3) er en grunn til å hoppe over en kolonne, ikke en endring i typeregelen. Vis ingen fingeravtrykk-resultater for orgnr i fasitsettet. Alle tall som totaler, uten orgnr.
Omlesingen starter bare etter eget ja fra meg, med samme ni steg som i 2.5b. Gjenopprett fra .local/document-run-2.5b/. Ingen dump slettes. Dokumentkjøringen for fasitsettet er ikke en del av denne storyen.
Små commits underveis. PR-en skal ha linjen «Planning documents:».
```
*Changed:* the probe came first, read-only, and the digit-width rule was measured on stored words before it was built (`e6c1cde`). The issue is #47.

**12:08**
```
Fra meg: fortsett proben, med ett tillegg til (c). Review-sesjonen finner 55 avstemte innværende kolonner i 44 selskaper der salgsinntekt ligger mer enn 5 kr over sum_driftsinntekter, ikke bare de 13 med forhold ≥ 1,4. Noen av avvikene er runde på mindre skala (5 000 000, 300 000, 10 000). Vis i sjekkpunktet, som totaler:
1. hvor mange av de 55 som er siffer-lest-som-to (runde avvik i alle størrelser), hvor mange som er andre lesefeil, og hvor mange som er ekte (for eksempel negativ annen driftsinntekt), med bevis fra et utvalg;
2. det samme for kundefordringer og bankinnskudd mot sumOmloepsmidler fra key_figures, siden begge brukes i fingeravtrykket;
3. hvor mange av disse breddeegelen i (b) ville fanget, og hvor mange en del-mot-sum-kontroll i src/engine ville fanget uten omlesing.
Ingen kodeendring før sjekkpunktet.
```
*Changed:* the review session had found 55 reconciled current columns with `salgsinntekt` above `sum_driftsinntekter`, not only the 13 the probe first counted. The probe then measured that 40 of 56 current cases are genuine (a negative revenue row), which is why R3 does not guard `salgsinntekt`.

**12:13**
```
Fra meg: fint. Ta med i sjekkpunktet om forrige års kolonne når motoren i dag (documentFigures og fingeravtrykket), slik at det er klart om de 123 i forrige års kolonne betyr noe nå eller bare ved en senere bruk.
```
*Changed:* the BMAD session confirmed that the prior column does not reach the engine (`scripts/derive.ts` reads `role = 'current'`), so the 123 prior-column cases matter only for a later use.

**14:08**: the human's own words, not drafted by the review session.
```
er den ikke ferdig nå?
```
*Changed:* none; the probe was still running.

**14:19**: the answers to the four decisions at the probe checkpoint.
```
Fra meg: 1 k = 0,6 med «1» som et helt siffer, 2 ja, 3 ja til begge, 4 ja. Skriv beslutningene og målingene inn i spec-en.
1: begrunnelsen er tallene fra proben: 0 riktige tall tapt i referansesettet, de 7 kolonnene på nøyaktig 21 mill. fanget, og 10 av 11 og 37 av 45 bekreftede salgsinntektsfeil, mot 3 og 3 med k = 0,5. Et nektet token gir et tomt felt, aldri en reparasjon. Testene skal bruke «23 375 956» og «123»-tilfellene fra proben, og et riktig tall med mange «1»-ere som ikke nektes.
2: reglen gjelder bare når alle kostnadslinjene er lest. Grunnen telles i derive, og en kolonne uten fingeravtrykk blir værende i gruppen, som i dag.
3: Q21 i PRD-en og Story 3.1a i epics.md rettes i denne PR-en, med .memlog-linje. Ta med tallet: 40 av 56 tilfeller i innværende år der salgsinntekt overstiger totalen er ekte, så en enkel regel om at en del ikke kan overstige summen, passer ikke for salgsinntekt. Kundefordringer eller bankinnskudd over API-ets sumOmloepsmidler blir tomme med en navngitt grunn, i src/engine, uten omlesing.
4: review-sesjonen finner 18 kolonner for innværende år med negativ verdi for varer. 10 av dem har fingeravtrykk, og alle har inventory = false, så feilen når fingeravtrykket i dag. Tell i rapporten før og etter hvor mange kolonner som har varer lest fra resultatregnskapet, også med positiv verdi. D1 er uendret.
Omlesingen venter på eget ja. Mål tiden, og bruk samme ni steg som i 2.5b.
```
*Changed:* R1 to R4 were written into the spec as decided (`e8f97b3`). Item 4, `varer` read from the income statement, came from the review session: 18 current columns had a negative `varer`, and the 10 with a fingerprint all had `inventory = false`.

**14:23**: the answer to the BMAD session's question whether R2 needs (a) the four main lines read, or (b) every line.
```
Fra meg: (a). Skriv i spec-en at R2 bare gjelder når de fire hovedlinjene er lest, og at en kolonne uten varekostnad eller en annen hovedlinje følger intervallregelen som i dag. Ta med kostnaden fra proben: én trykt nedskrivning som ikke ble lest (1 649 988 kr) mister fingeravtrykket. Tell i rapporten etter omlesingen hvor mange kolonner cost_lines_short_of_total gjelder, og hvor mange av dem som har nedskrivninger NULL. Begge valgene dine er godkjent. Behold spec-en samlet. Sett den til ready-for-dev og fortsett med kode og tester i små commits. Omlesingen venter på eget ja.
```
*Changed:* R2 applies only when the four main lines are read (`58c5b71`). The cost of one printed `nedskrivninger` that was not read is in the spec.

**15:10**: the answers to the two findings of review pass 1 that the BMAD session put to the human (triage 1 and 19).
```
Fra meg: 1: mål det først. Kjør R1 med minustegnet regnet som et tegn på de lagrede ordene i hurtigbufferen, uten OCR, og vis meg hvor mange tall som nektes og hvor mange riktige tall referansesettet mister. Er det 0 tapte riktige tall, tas endringen inn med en test for «-23»-tilfellet, og beslutningen skrives i Spec Change Log. Ellers står hullet som en kjent begrensning i AI-loggen. 2: ja. R3 skal bruke regelen for sammenligning mellom kilder, max(5 kr, 0,001 % av API-tallet), som AGENTS.md krever. Legg verdien ett sted i src/engine, med en test som feiler hvis den avviker fra [reconciliation] i ingest/config.toml. Skriv det i Spec Change Log. Finn årsaken til tidsavbruddene i test:db før PR-en, ikke bare kjør på nytt. Omlesingen venter fortsatt på eget ja.
```
*Changed:* the minus was measured first, with 0 correct figures lost, and then taken in (`b57aaba`). R3 uses the between-sources rule, set once and tested against `ingest/config.toml` (`e9ce2ae`). The `test:db` timeouts were traced to a loader transaction left open after a deliberate foreign-key error, and deferred (`a7465b5`).

**15:25**
```
Fra meg: ja til omlesingen med de ni stegene fra 2.5b. Ta steg 1 (dump og backup, sjekk sha256) nå og si fra når den er ferdig. Omlesingen kjører jeg selv i mine egne PowerShell-vinduer: først referansesettet, så 2.1b-radene, med logg til .local\reread-ref-2.5c.log og .local\reread-2.1b-2.5c.log. Ikke start noe selv. Når jeg sier at kjøringen er ferdig, sjekker du run.step1 for begge kjøringene, at alle dokumenter har ny reader_commit, og at pnpm derive har kjørt. Vis meg tallene fra steg 2 og tiden kjøringen tok, før noe slettes i steg 4. Ingen push før jeg sier fra.
```
*Changed:* the human ran the re-read in their own windows. The review session had recommended a full re-read that night instead of only the reference set: the labelled set's run comes later, and a combined run would have taken about 20 hours.

**2026-11-07 11:06**
```
Fra meg: omlesingen er ferdig, og review-sesjonen har sjekket den mot .local/document-tables-before-2.5c-reread/. Run 782 og 783 endte med 0 ikke erstattet og 0 feil, og alle 2 044 dokumenter har reader_commit b57aaba. Ingen kolonne har gått fra avstemt til ikke avstemt. 139 tall ble tomme: 130 større enn sin egen total, 6 nøyaktig 21 mill. over kostnadstotalen, og resten varer fra resultatregnskapet. Det eneste tallet som kan ha vært riktig, ligger i en fjorårskolonne. Ingen andre tall er endret enn varer. Ett funn til PR-en: i ett selskap-år er beholdning nå ukjent fordi R4 ikke fant varer på balansen, mens neste års regnskap har 3,6 mill. kr som fjorårstall. Det er et tomt felt, ikke et galt tall; noter det i SM-2-rapporten og sesjonsfilen som totaler, uten orgnr.

Gjør i denne rekkefølgen:
1. Legg inn i epics.md en story for dokumentkjøringen for fasitsettet, ordnet etter 2.5c, med en lokal hurtigbuffer for OCR-ordene, kreditert review-sesjonen. Begrunnelse: omlesing har kostet rundt 12 timer tre ganger (2.3b, 2.5b, 2.5c), alle rettingene var etter OCR, og etter fasitsettet blir en omlesing over 35 timer. Vilkår: (a) nøkkelen er PDF-ens sha256, Tesseract-versjonen, traineddata-sha256 og renderinnstillingene, og et avvik gir full OCR som rapporteres, aldri i stillhet; (b) PDF-en hentes fortsatt ved omlesing, så et regnskap som er levert på nytt oppdages; (c) hurtigbufferen er gitignored og ligger bare lokalt, som PDF-ene, til lisensvurderingen i 5.4. Pek oppføringen om fasitsett-kjøringen i deferred-work.md til storyen. Commit planleggingsendringene alene.
2. Ja til steg 3–9 i seed-prosedyren: ny dump med sha256 og kopi i C:\Users\cmein\peerless-backups\, sletting utenfor allow-listen i én kontrollert transaksjon, derive, seed:export i egen commit, pnpm seed to ganger med uendret re-eksport, gjenoppretting av 2.1b-radene, derive. Den nye dumpen erstatter .local/document-run-2.5b/ som gjenopprettingskilde. Oppdater README («Seed») i samme commit som peker til den nye mappen. Slett ingen eldre dump.
3. Kjør hele testsuiten, og vis meg tellingene etter steg 5 og 9 og PR-utkastet med linjen «Planning documents:». Ikke push før jeg sier det.
```
*Changed:* the local OCR word cache was proposed by the review session after three re-reads of about 12 hours each; it is Story 2.5d (`6ee327b`). The BMAD session added the Tesseract options of both passes to the cache key, and the human kept it. The seed is `29bf5fc`, and the restore source is now `.local/document-run-2.5c/` (`46ae913`).

**11:23**
```
Fra meg: review-sesjonen har sjekket steg 3–9, og alt stemmer, med ett unntak. 29bf5fc sier «three figures in the reference set's prior-year columns (salgsinntekt, varekostnad, sum_kortsiktig_gjeld); no current column changed». Diffen viser salgsinntekt i en fjorårskolonne (avstemt), varekostnad i en fjorårskolonne (ikke avstemt) og leverandorgjeld i en nåårskolonne (avstemt). Alle tre er større enn sin egen total, og leverandorgjeld er ikke med i fingeravtrykket. Rett dette i spec-en (C2-avsnittet, steg 6) og i sesjonsfilen, krediter funnet til review-sesjonen, og skriv i PR-teksten at commit-meldingen til 29bf5fc er feil på dette punktet og ikke skrives om. Tesseract-innstillingene i nøkkelen til 2.5d beholdes. e2e: ikke kjør en ny seed-runde, la CI avgjøre det, og skriv årsaken du mener ligger bak i PR-en som en antakelse som CI skal bekrefte. Commit rettingen for seg, push og åpne PR-en mot main.
```
*Changed:* the review session found that `29bf5fc`'s message names the wrong fields and says no current column changed. The BMAD session had split the CSV lines on commas, which shifts the fields after a quoted `digits_pass_fields`. The spec and the session file were corrected (`40e8bf4`), and the commit message was not rewritten. PR #48 was opened.

**11:35**
```
Fra meg: reviewen min er postet på PR #48, med seks linjekommentarer på 5f3d91e. Før merge:
1. Rett PR-teksten. (a) R4-linjen: «emptied or changed in 22 current and 17 prior columns» er feil. Skriv det slik document-run-counts-after-2.5c.json har det: endret 22 og 17, tømt 15 og 14, nylest 4 og 7. (b) Fingeravtrykkene: skriv at 1 757 er de gamle tallene regnet med denne storyens motor, og at tabellen faktisk hadde 1 779 for 2.1b-radene før storyen, så det lagrede tallet gikk fra 1 779 til 1 770. Legg samme presisering i ocr-sm2.md ved raden «1757 of 1946».
2. Linjekommentaren på TARGET_PAGES: page_kind regner en side som resultatside hvis «resultatregnskap» står noe sted i etikettene, før «balanse» sjekkes. Det kan forklare R4-hullet, men det er ikke verifisert. Ikke rett det i denne PR-en. Legg det inn som et punkt i Story 2.5d i epics.md: sjekkes før fasitsettet leses. Krediter review-sesjonen.
3. Oppdater sesjonsfilen: reviewen, hva som ble rettet etter den, og hvem som fant hva. CI var grønn på 5f3d91e med 116 av 116 e2e-tester, og det bekrefter forklaringen på de lokale feilene.
Commit i logiske steg, push, og si fra når CI har kjørt på nytt. Ikke merge.
```
*Changed:* the PR text's R4 counts and the fingerprint count were corrected, and the SM-2 report now gives the stored count beside the engine's (`e79cf32`). The `page_kind` question is item 3 of Story 2.5d, not verified and not fixed here (`8d506be`). The session file has the review (`8ff1b35`).

### Prompts to the review session

- `hva anbefaler du`, `gjerne` and `vil starte` (11-06): the review session recommended that PRD open question 21 go into Story 2.5c and that question 24 become a precondition of Story 2.7 (`f80febf`), and drafted the 11:43 prompt.
- Five pastes of the BMAD session's output during the probe and the build (11-06): the review session checked them against the database and the probe's JSON, and drafted the 12:08, 12:13, 14:19, 14:23 and 15:10 prompts. For R1 it recommended k = 0,6 with "1" counted as a full digit, because the probe showed 0 correct reference figures lost.
- `okei så får vi nå igjen en ny lang kjøring?`, `okei, men må alt lastes inn på nytt? for noen småfeil i noen tall=` and `Ja tenker du at dette er det beste eller burde vi ha en lang kjøring nå?` (11-06): the review session explained why R1 and R4 need a re-read while R2 and R3 do not, and recommended the full re-read that night.
- `Vindu 1 ; og vindu 2:` (11-06, with screenshots): the review session confirmed that the re-read and the keep-awake command were running.
- `er det slik at man må gjennom denne prosessen på nytt igjen kanskje etter denne lange kjøringen også?`, `okei, og ved gjennomgang synes du dette er en god idee=`, `okei, skal jeg skrive til bmad nå?`, `Okei, men burde jeg vente med denne etter kjøringen da eller=` and `okei, men hvis det er likt er ikke det dumt?` (11-06): the review session proposed the local OCR word cache, with its conditions, and advised sending it after the re-read, so the BMAD session would not touch the branch while the run used it.
- `sjekk` and `sjekk igjen nå` (11-06 and 11-07): the review session followed the run from the log and the database, and compared all 4 086 columns with the dump taken before the re-read. It checked each of the 139 emptied figures, and found the R4 gap: one company-year whose stock the next year's document prints.
- `den er grønn`, `ja post review` and `merget` (11-07): the review session confirmed CI, posted the review and did the housekeeping on `main`.

### Result

All 2 044 documents are read by `b57aaba`. Nothing was left not replaced and no deadline ran out. The 2.1b re-read took 11 h 32 min, and the reference set 38 min. No column went from reconciled to not reconciled. 139 figures were emptied, and every one but one, in a prior column, is a misread or `varer` read from the income statement. No figure other than `varer` changed. No column is now exactly 21 000 000 kr over its cost total, against 10 before, and no `varer` is negative, against 33 before. The share of companies without a type is unchanged (175 of 420), so the story made the data more correct, not more complete. The labelled set's run, with the OCR word cache, is Story 2.5d.

### Checks before merging

The review session checked these against the database and the dumps:
- runs 782 and 783 and their counts;
- all 4 086 columns against `.local/document-tables-before-2.5c-reread/`, including each emptied figure, and the fingerprints before and after;
- the new dump's sha256 and its backup copy;
- the counts after steps 5 and 9;
- that the seed commit holds only seed files, and which figures it emptied;
- the PR text's counts, two of which it corrected.

CI was green on `5f3d91e`, with 116 of 116 e2e tests, which confirmed why 7 failed locally: the local database also holds the 2.1b fingerprints. At the human's request (`ja post review`), the review session posted the GitHub review with six line comments. After the corrections, CI was green on `8ff1b35`, and the PR was merged at 10:59 UTC as `c90ad3e`.

## Story 2.5d: the labelled set's document run, with a local OCR word cache (#49, PR #50)

Every `Fra meg:` prompt below, and the 12:04 prompt, was drafted by the review session and pasted by the human, who made the decisions in it. Results for the labelled set are given as totals only: its 720 pairs are not labelled yet.

### Prompts to the BMAD session

**2026-11-07 12:04**
```
/bmad-build Story 2.5d: dokumentkjøringen for fasitsettet, med en lokal hurtigbuffer for OCR-ordene (epics.md, Story 2.5d, punkt 1–3). Hent main først (dc4f737). Opprett issuet og branchen.

Rekkefølge:
1. Probe først, read-only (punkt 3): sjekk om layout.page_kind forklarer R4-hullet (emptied_current_held_by_next_prior = 1), med OCR-ordene som bevis. Tell på de lagrede ordene i analysis/.cache/ocr/probe/ hvor mange sider som har både «resultatregnskap» og «balanse», eller en balanse uten lesbar overskrift, og hvor mange varer som ville blitt lest med en annen regel. Et riktig tall som blir borte, eller et varer fra resultatregnskapet som kommer tilbake, er en kostnad. Vis det som totaler.
2. Stopp ved sjekkpunktet og vis meg: (a) proben og et forslag, retting eller ingen retting; (b) planen for hurtigbufferen: hvor den ligger, hvor stor den blir for 2 044 + fasitsettets dokumenter, og hvordan den kommer inn i og ut av Docker-imaget; (c) hvordan listen for fasitsettet lages (i Node, som pnpm ingest:document-set), og hvor mange dokumenter og timer det blir med alle årene 2021–2025 og med bare referanseåret. Ingen kodeendring før jeg har svart.
3. Hurtigbufferen (punkt 1), etter mitt svar: nøkkelen er PDF-ens sha256, Tesseract-versjonen, traineddata-sha256, renderinnstillingene og innstillingene for begge lesingene. Bare et eksakt treff bruker de lagrede ordene. Et avvik gir full OCR og telles i run.step1, aldri i stillhet. PDF-en hentes fortsatt ved omlesing. reader_commit settes som i dag, også når ordene kommer fra hurtigbufferen. Treff og bom telles per kjøring. Test at en lesing fra lagrede ord gir de samme tallene, status og kontrollene som en lesing gjennom Tesseract.
4. Hurtigbufferen er gitignored og ligger bare lokalt, som PDF-ene, til lisensvurderingen i 5.4. Ingen seed, eksport eller committet fil skal inneholde ordene. Test at .gitignore dekker den.

Kjøringene starter bare etter eget ja fra meg, og jeg kjører dem selv i mine egne PowerShell-vinduer. Før kjøringen: dump og backup med sha256, som i 2.5c. Krever en retting av page_kind at de 2 044 lagrede dokumentene leses på nytt, kommer den omlesingen før fasitsettet, og den fyller hurtigbufferen. Etter kjøringen: en ny dump som gjenopprettingskilde, README «Seed» oppdatert i samme commit, og ingen dump slettes.

D1 er låst: ingen endring i terskler eller typeregel. Vis ingen fingeravtrykk-resultater for orgnr i fasitsettet. Alle tall som totaler, uten orgnr. Hver rad i I/O-matrisen i spec-en skal nevne testen som feiler hvis koden fjernes. Små commits underveis. PR-en skal ha linjen «Planning documents:».
```
*Changed:* the probe came first, read-only (`6a222e5`), and the BMAD session stopped at the checkpoint. The probe showed that every rule that would bring a figure back brings back a wrong one. The issue is #49.

**12:27**: the answers to the four decisions at the checkpoint.
```
Fra meg: 1 ingen retting; proben viser at hver regel som henter tilbake et tall, henter tilbake et galt tall. Skriv det i spec-en.
2 (a), med én kontroll lagt til før fasitsettet: etter at hurtigbufferen er bygget, kjører jeg --reread av referansesettet to ganger, først med OCR (fyller hurtigbufferen), så fra hurtigbufferen. Begge skal gi nøyaktig de samme tallene, status og kontrollene som seeden har nå, og den andre skal ha bare treff. Tell treff og bom, og skriv resultatet i spec-en og PR-en. Det beviser på ekte data at hurtigbufferkoden ikke endrer det som leses. Avvik er en feil som stopper storyen før fasitsettet.
3 (a), som en merge av c0f10a0 fra story/5.1-labelled-set, ikke cherry-pick, så hashene beholdes. 15e1010 (den blinde merkingen) skal ikke med. Skriv i PR-teksten at dette er 5.1-commits tatt med uendret, og at 5.1-PR-en tar resten.
4 (b), bare 2025. Formatet med {"orgnr", "years"} er ny oppførsel: oppdater AGENTS.md, og test at en ny kjøring med flere år bare henter dokumentene som ikke er lagret.
Spec-en kan beholdes samlet. De 720 parene i labels.csv er ikke merket ennå: ingen fingeravtrykk-resultater for orgnr i fasitsettet, heller ikke i terminalen. Kjøringene starter bare etter eget ja fra meg, og jeg kjører dem selv: først dump og backup, så referansesettet to ganger, så fasitsettet. Små commits.
```
*Changed:* written into the spec (`0c57cb0`), and Story 5.1's draw merged unchanged (`7c27af8`). The control before the labelled set, the reference set read twice, was proposed by the review session.

**12:40**
```
Fra meg: (a), --reread-all <file>. Godt fanget. Vilkår: den har nøyaktig de samme reglene som --reread for nekting av orgnr, ikke erstattet, frister, stopp etter tre frister på rad og exit-kode, og forskjellen er bare at reader_commit ikke sjekkes. Test at den leser et dokument som allerede har gjeldende reader_commit, og at --reread fortsatt hopper over det. Den skal også kjøre pnpm derive etterpå, som --reread. Linje i AGENTS.md. Skriptet som sammenligner med seeden skal også telle treff og bom fra run.step1, og bare skrive totaler. Sett spec-en til ready-for-dev og fortsett med kode og tester i små commits. Kjøringene venter på eget ja.
```
*Changed:* `--reread-all` (`2db61f5`, `c460e70`). The BMAD session found that a second `--reread` at the same commit reads nothing, so the control as the review session had drafted it would have proved nothing.

**14:25**: the answers to the three findings of review pass 1 that the BMAD session put to the human (triage 2, 14 and 17), and the CPU features in the key.
```
Fra meg: 1. Ja, legg til sha256 av ocr.py som en sjette del av nøkkelen, lest fra modulfila når kjøringen starter, ikke en konstant, med eget navn i tellingen når den er ulik. Test at en endret ocr.py gir bom med den delen navngitt, at en uendret gir treff, og at sletting av sjekken får en test til å feile. Oppdater spec-en (i Spec Change Log, med dato og meg som beslutningstaker), AGENTS.md og den tekniske notatet. 2. Behold ingest med skrivebeskyttet tilkobling, ingen migrasjon: reader er rollen nettsiden bruker, og skal ikke se run-skjemaet. 3. 36b6117 blir på branchen og går inn med PR-en. Si det i én linje i PR-teksten. CPU-funksjonene i nøkkelen godtar jeg, siden hurtigbufferen er lokal. Kjør hele testsuiten, så åpner du PR-en med «Planning documents:»-linjen. Kjøringene venter på mitt eget ja.
```
*Changed:* `ocr_code_sha256` in the key (`ac61135`) and the decisions in the spec (`f1eb27b`). PR #50 was opened.

**14:41**
```
Fra meg: CI er grønn. Ja til kjøringene. Ta dumpen og backupen nå med sha256, som i 2.5c, og vis meg stiene og hashene. Gi meg så kommandoene for de to kjøringene av referansesettet, med sjekken etter hver, og keep-awake-kommandoen. Jeg kjører dem selv i egne vinduer. Mens en kjøring går, rører du ikke ingest/, databasen eller Docker, og du committer ingenting som endrer ingest/, fordi det endrer reader_commit. Fasitsettet starter jeg først når begge sjekkene har gitt exit 0, og etter mitt eget ja.
```
*Changed:* the dump `.local/document-tables-before-2.5d-runs/` and its backup. The human ran the first proof in their own windows: runs 1242 and 1243.

**16:11**
```
Fra meg: Begge kjøringene av referansesettet er ferdige, og du kan røre ingest/ igjen. Resultat: run 1242 (--reread) og 1243 (--reread-all) leste 97 av 97, 0 feilet og 0 ikke erstattet, 87 avstemt og 10 ikke avstemt, og ga 0 treff og 97 bom «absent» hver. pnpm analysis:seed-documents ga exit 0 etter begge: 97 dokumenter og 194 kolonner er like seeden, og alle er lest av ac61135. --cache-proof ga exit 1 med «0 hits of 97 read» og «97 absent, must be 0». OCR ga altså samme tall tre ganger, men hurtigbufferen traff aldri.

Review-sesjonen fant årsaken: data.brreg.no legger en ny tilfeldig /ID [<…> <…>] i PDF-ens trailer ved hver henting. Ellers er bytene like, sjekket på tre dokumenter fra referansesettet hentet to ganger hver, og hver PDF har nøyaktig én /ID. Derfor gir pdf_sha256 av rå bytes alltid bom «absent», og .local/ocr-cache/ har nå 194 oppføringer for 97 dokumenter.

Retting: nøkkelen og filnavnet bruker sha256 av PDF-en med /ID-arrayen erstattet av en fast verdi. Er det ikke nøyaktig én /ID, er det ingen treff, og bommen telles med årsaken navngitt, aldri stille.

Tester: to PDF-er som bare har ulik /ID, gir samme nøkkel og treff. Én endret byte et annet sted gir bom. Null eller to /ID gir bom med årsak. Fjernes normaliseringen, skal en test feile.

Skriv det inn som en API-felle i docs/data-sources-brreg.md og under «Known API traps» i AGENTS.md, med dato. Føy det til Spec Change Log, med dato og meg som beslutningstaker, siden det endrer nøkkelen jeg bestemte. Før kjøringene 1242 og 1243 inn i spec-en og PR-en som det første forsøket på beviset, mislykket, med tellingene over. Si i sesjonsfila og ai-log at review-sesjonen fant feilen i den ekte kjøringen, og at testene ikke kunne fange den fordi de bruker samme bytes. Hold de gamle oppføringene i hurtigbufferen utenfor. De treffer aldri, og jeg sletter ikke noe nå. Kjør hele testsuiten og push. Gi meg så de samme to kjøringene på nytt med sjekkene. De starter etter mitt ja.
```
*Changed:* the review session found the defect, and the key now hashes the PDF with its `/ID` array fixed (`df34a2d`, `f8e0d1e`). The trap is in `AGENTS.md` and `docs/data-sources-brreg.md` (`951c24b`), and the failed proof is in the spec and the session file (`2f4e3f5`, `53c3fd6`).

**18:09**
```
Fra meg: Beviset er bestått. Run 1410 (--reread, OCR) tok 38 min med 0 treff og 97 bom «absent», og pnpm analysis:seed-documents ga exit 0. Run 1411 (--reread-all) tok 2 min 30 s med 97 treff, 0 bom, 0 uten brukbar /ID og 0 skrivefeil, og --cache-proof ga exit 0. Begge leste 97, med 0 feilet, 0 ikke erstattet og 0 tapte tall, og 87 avstemt og 10 ikke avstemt. Alle 97 er lest av df34a2d. Før det inn i spec-en og PR-en som det andre, beståtte forsøket. Review-sesjonen har sjekket tellingene mot run.step1.

Ja til fasitsettet. Før jeg starter: ta en ny dump og backup med sha256 av de tre tabellene, slik at gjenopprettingspunktet er nøyaktig. Kjør pnpm analysis:document-run before-2.5d. Commit dette, push, og gi meg kommandoen for fasitsettet. Etter kjøringen skriver du bare totaler, ingen fingeravtrykk eller type per orgnr i fasitsettet, heller ikke i terminalen. Mens kjøringen går, rører du ikke ingest/, databasen eller Docker, og du committer ingenting.
```
*Changed:* the passed proof in the spec, and the dump before the labelled set (`b4b5ee7`); the counts before the run (`90175c9`). The human then ran run 1412.

**23:01**
```
Fra meg: Fasitkjøringen er ferdig. Run 1412 (--documents) gikk fra 18:22 til 22:55. 845 listet og 0 nektet. 104 var allerede lagret for 2025. 741 ble lest, med 0 feilet, 0 OCR-feil og 0 asked_not_listed. Av de 741 ble 690 avstemt, 45 ikke avstemt og 6 ikke lest ut. Lagrede dokumenter for de samme selskapene ble avstemt på nytt: 448 avstemt og 39 ikke avstemt. Hurtigbufferen ga 741 bom «absent», 0 uten /ID og 0 skrivefeil. Alle 741 er lest av df34a2d. Dokumenter: 2 044 → 2 785. Fingeravtrykk: 1 856 → 2 537. Review-sesjonen har sjekket dette mot run.step1. Gjør resten nå:
1. pnpm analysis:document-run after-2.5d.
2. Ny dump .local/document-run-2.5d/ med backup og sha256, og README «Seed» oppdatert i samme commit.
3. Seed-eksporten med de ni stegene fra 2.5c, fra allow-lista. Ingen rader fra fasitsettet utenfor allow-lista skal havne i seed/.
4. Før totalene inn i spec-en, sesjonsfila og PR-en.
5. Bare totaler, ingen orgnr, type eller fingeravtrykk per selskap i fasitsettet, heller ikke i terminalen.
Slett ingen dump. Kjør hele testsuiten, push, og si fra når CI er grønn. Da lager review-sesjonen et utkast til reviewen.
```
*Changed:* the counts after the run (`ee35396`), the new restore source in README "Seed" (`a1edd4c`), the seed (`eadadab`), the totals in the spec (`baec193`), and three step-1 tests deferred (`cc2446a`).

**2026-11-08 09:07**
```
Fra meg: Review-sesjonen har sjekket dumpene, databasen, seed-commiten og CI, og alt stemmer. Utsettelsen av de tre stegtestene godtar jeg. Push sesjonsloggen 87a5d5d, så den kommer med i PR-en. Reviewen min kommer på GitHub, og så merger jeg når CI er grønn.
```
*Changed:* the session log `87a5d5d` was pushed to the PR.

### Prompts to the review session

- `okei, gi meg prompt` (11-07): the review session drafted the 12:04 prompt for Story 2.5d.
- Pastes of the BMAD session's output at the checkpoint, after the build and after the PR (11-07): the review session checked them against the code and the branch, and drafted the 12:27, 12:40 and 14:25 prompts. It recommended a sixth key part for `ocr.py`, because stored words would otherwise survive a change to `read_tsv`, and it recommended keeping `reader` away from schema `run`.
- `hva skal jeg nå?`, `Sånn?`, `da har jeg begynt denne i nytt vindu: …`, `når skal jeg kjøre denne …`, `Skal jeg holde dette vinduet åpent mener du?`, `Har kjøringen da startet?` and `Nå kjører den?` (11-07): the review session gave the commands for each run and confirmed from `run.step1` that it had started.
- `sjekk`, `nå`, `hvordan ligger vi an nå`, `okei, kan du se hvor lang tid kjøring 2 har brukt nå`, `ferdig nå?` and `kan du sjekke` (11-07): the review session followed the runs in the database. Following the second run of the first proof, it saw about 20 seconds per document and new cache entries instead of hits. It compared the stored keys, then fetched three reference documents twice each and found that the register writes a new random `/ID` on every fetch.
- `ci er grønn`, `post review` and `merget` (11-08): the review session confirmed CI, posted the review and did the housekeeping on `main`.

### Result

The labelled set's 2025 documents are read: 845 listed, 104 already stored, 741 read and none failed, of which 690 reconciled, 45 did not and 6 could not be read out. Documents went from 2 044 to 2 785, and fingerprints from 1 856 to 2 537. The OCR word cache is proven on real data: the reference set took 38 minutes by OCR and 2 min 30 s from the cache, with 97 hits of 97 and the same figures, status and checks as the seed. The first proof failed with 0 hits, because the cache was keyed on the raw PDF bytes, and `--cache-proof` caught that with exit 1. The tests could not have caught it, because they read the same bytes twice.

### Checks before merging

The review session checked these against `run.step1`, the database and the dumps:
- runs 1242, 1243, 1410, 1411 and 1412 and their counts;
- the `/ID` fix on three reference documents fetched twice each, with the raw bytes different and the key equal;
- the dumps' sha256 against their backups, and the counts after the restore;
- with a CSV parser, that the seed commit `eadadab` changes only `reader_commit` and `read_at` of the 97 reference documents.

CI was green on `87a5d5d`. At the human's request (`post review`), the review session posted the GitHub review with six line comments. The PR was merged at 08:21 UTC on 2026-11-08 as `a5476b1`.

## Story 2.6a: the register text classification reads (#52, PR #53)

Every `Fra meg:` prompt below was drafted by the review session and pasted by the human, who made the decisions in it. Results for the labelled set are not given: its 720 pairs are not labelled yet.

### Prompts to the BMAD session

**2026-11-08 09:58**: the answers at Story 2.6's checkpoint, where 2.6a was split out. The prompt that opened Story 2.6 belongs to that story's section.
```
Fra meg: 
1. Ja til «uklart». Det er ikke en femte type: BUSINESS_TYPES står fast, skjemaet er de fire pluss avstå, og det lagres uten type, som fingeravtrykkets null. Det telles for seg i run-recorden, og andelen skal med i 5.2. Rett AC-en i epics.md.
2. Ingen --include-labelled. Full kjøring gjøres først etter at jeg er ferdig med å merke de 720 parene, og da er de 845 med som alle andre. Før det er 300-prøven utenfor fasitsettet den eneste ekte kjøringen. Den trenger eget OK og skal ikke inn i seeden.
3. Bare AS. seed:export-sperren gjelder bare AS-selskaper i dekket næring, og ikke-AS skal aldri stå som pending. Rett «all 62.100» til AS i FR-73, tekniske notat og PRD.
4. Ja, skill ut 2.6a (tekstfeltene, migrasjon, parser, seed-re-eksport) med eget issue, egen story i epics.md og egen PR. Si hvor mye company.csv vokser.

Seeden: jeg trekker tilbake allow-list-utgangspunktet. FR-73 setter lisensporten bare på fingeravtrykk, og klassifiseringene er NLOD-tekst. Etter full kjøring får seeden alle AS i 62.100, som FR-73 sier. Det eneste vilkåret er blindingen, og den er oppfylt når merkingen er ferdig. Derfor skal ikke tekniske notat, PRD og FR-73 skrives om på dette punktet. 2.6-PR-en holdes åpen til full kjøring og seed er gjort.

Bygg 2.6a først. Stopp før --companies-only og gi meg kommandoen. Jeg kjører den selv. Blindingen og reglene fra forrige melding gjelder fortsatt. Ingen modellkall før jeg har sagt OK til akkurat den kjøringen.
```
*Changed:* Story 2.6a got its own issue (#52), epics story and spec (`6a3f42c`); columns, parser and docs followed (`a5bc619`, `556379a`, `ce45e0d`), and the review fixes (`e5295f5`). The review session had withdrawn the human's earlier starting point that only allow-listed companies could be stored, because FR-73 gates only fingerprints.

**10:13**: the answer to whether text is stored for every company or for an AS only, and three findings by the review session.
```
Fra meg: Bare AS. Andre organisasjonsformer skal ha aktivitet og vedtektsfestet_formaal NULL, også hvis et selskap slutter å være AS og hadde tekst fra før. Tell hvor mange som hoppes over i run.step1, aldri stille, og test begge deler. Grunnen er den samme som for ENK-kommunen i docs/data-sources-brreg.md: offentlig i registeret, men ikke noe Peerless skal samle uten at noe bruker det.

Tre ting til i samme PR:
1. Rett de tre testene i test_documents_run.py nå. Årsaken står i deferred-work.md: de bruker et ekte orgnr som nå har et lagret dokument, og vi utsatte dem til neste story som endrer ingest/, altså denne. Bruk et gyldig orgnr som aldri er lagret, som foreslått der, og lukk oppføringen.
2. seed:export alene virker ikke, fordi den lokale databasen har 2 688 dokumenter utenfor allow-lista. Følg steg 3–9 fra 2.5c: sjekk at .local/document-run-2.5d/ fortsatt er lik radene i databasen, kontrollert sletting i én transaksjon, derive, seed:export i egen commit, pnpm seed to ganger med uendret re-eksport, gjenoppretting og derive. Vis tellingene. Ingen dump slettes.
3. Skriv i PR-en at reader_commit nå flytter seg fra df34a2d uten at tallene endres, at analysis:seed-documents derfor feiler på «current reader» til neste omlesing, og at ingen omlesing trengs for dette.

Kjør hele testsuiten, også pnpm lint, og commit i små steg. Så gir du meg kommandoen for --companies-only. Jeg kjører den selv. Ingenting pushes før seeden er med.
```
*Changed:* the AS rule (`ab27ed0`), the three tests on an orgnr no run stores (`f10ccf6`, `1eeb878`) and the deferred entry closed (`aa57ab0`). Without point 2, `seed:export` would have refused the local database. The human then ran `--companies-only`: run 1708.

**15:19**
```
Fra meg: --companies-only er ferdig, run 1708: 17 802 oppdatert, 81 ikke i bulkfila, 7 475 uten tekst fordi de ikke er AS, 0 feilet. Review-sesjonen har sjekket: 10 327 AS med begge tekstene, 0 andre former med tekst, 2 785 dokumenter, 5 556 kolonner og 2 537 fingeravtrykk.

Gå videre med seeden etter steg 3–9 fra 2.5c, slik du fikk beskjed om. Dump og backup med sha256 først. Sjekk at .local/document-run-2.5d/ er lik radene i databasen. Slett i én kontrollert transaksjon, kjør derive, kjør seed:export i egen commit, kjør pnpm seed to ganger med uendret re-eksport, gjenopprett og kjør derive. Etterpå skal det være 2 785 dokumenter, 5 556 kolonner, 2 537 fingeravtrykk og fortsatt 10 327 AS med tekst. Ingen dump slettes.

Les diffen i seed/demo/company.csv kolonne for kolonne før du committer. Forventet: de to nye kolonnene, search_fields_read_at på 17 802 rader, 28 endrede kommuner (nummer og navn), og 28 rader der naeringskode1_beskrivelse blir tom fordi bulkfilas kode ikke er den lagrede (code_differs 29). Ingen av dem er på allow-lista. Alt annet som endrer seg, er en feil: stopp og si fra. Skriv dette i PR-en. Sjekk også at søket tåler en tom beskrivelse, og navngi testen som viser det.

Til spec-en for 2.6: 2 236 av 10 327 AS har identisk aktivitet og vedtektsfestet_formaal. Send teksten bare én gang i de tilfellene, og la kostnadsanslaget regne med det. Ingen modellkall.

Kjør hele testsuiten etterpå, også de to seed-testene og pnpm lint. Vis meg resultatene og tellingene. Ikke push før jeg sier fra.
```
*Changed:* the seed alone in `c6d990e`, the seed test's column list (`c023e7c`), the sequence in the spec and the session file (`110ba8d`), and identical text sent once in Story 2.6's spec (`1c9c70e`, still on that branch). The review session named the expected diff of `company.csv` before the BMAD session read it, and the comparison found nothing else.

**15:34**
```
Fra meg: Review-sesjonen har sjekket seed-commiten, tellingene, backupen og PR-teksten, og alt stemmer. Du kan pushe story/2.6a-company-text-fields og åpne PR-en med teksten du har skrevet. Identisk tekst under vedtektsfestet_formaal er greit.

Si fra med PR-nummeret når den er åpen. Ikke merge. Ikke start på 2.6 før 2.6a er merget, og ingen modellkall.
```
*Changed:* the branch was pushed and PR #53 opened.

**15:38**
```
Fra meg: Ja, push sesjonsloggen til PR-en, AGENTS.md krever det på en story-branch. Ingen andre endringer. Ikke merge, og ikke start på 2.6.
```
*Changed:* the session log `9023435` was pushed to the PR.

### Prompts to the review session

- `kan vi starte med 2.6 før denne De 720 parene i labels.csv må merkes før Story 5.2. …`, and `hvor mye koster det da? …` (11-08): the review session drafted the prompt that opened Story 2.6. The human's condition, `ikke kjør noe før jeg vet kostnadsanslag ved en kjøring og har sagt OK`, became a rule in it: no model call without an OK for that run.
- Pastes of the BMAD session's output at the Story 2.6 checkpoint and after the 2.6a build (11-08): the review session checked them against the branch and the database, recommended AS only, found the cause of the three failing tests in `deferred-work.md`, and pointed out that a bare `seed:export` would be refused. It drafted the 09:58 and 10:13 prompts.
- `okei limt inn i powershell og kjører nå? Hvor lang tid?` and `ferdig nå` (11-08): the review session confirmed the run had started and checked run 1708 and the counts. It found the 2 236 companies with identical text and the 28 changed municipalities and descriptions, by comparing the old seed with the database, and drafted the 15:19 prompt.
- A paste of the BMAD session's report after the seed (11-08): the review session checked the seed commit, the counts, the backup and the PR text, and drafted the 15:34 prompt.
- `ci er grønn`, `post review` and `merget` (11-08): the review session confirmed CI, posted the review and did the housekeeping on `main`.

### Result

`register.company` has `aktivitet` and `vedtektsfestet_formaal` for an AS only: 10 327 AS have both texts and no other form has any. The seed carries them. Run 1708 updated 17 802 companies, left 81 not in the bulk file untouched and did not store text for 7 475 that are not an AS.

### Checks before merging

The review session checked these against `run.step1`, the database and the seed files:
- run 1708 and its counts;
- that `c6d990e` changes only `company.csv` and `manifest.json`, and that no labelled-set row entered the seed;
- the counts after the restore, and the backup's sha256 against the dump;
- the 28 changed municipalities and 28 emptied descriptions, none on the allow-list.

CI was green on `9023435`. At the human's request (`post review`), the review session posted the GitHub review with seven line comments. The PR was merged at 14:49 UTC on 2026-11-08 as `1d1eaf2`.

## Story 2.6: classification, funnel stage 5 (#51, PR #54)

Every `Fra meg:` prompt below was drafted by the review session and pasted by the human, who made the decisions in it. Results for the labelled set are given as totals only.

### Prompts to the BMAD session

**2026-11-08 09:29**: the prompt that opened Story 2.6.
```
/bmad-build Story 2.6: klassifisering, steg 5 (epics.md, Story 2.6). Hent main først (9d43524). Opprett issuet og branchen.

Stopp ved sjekkpunktet før du endrer kode, og vis meg:
(a) hva som sendes til modellen, kategorisettet og responsskjemaet;
(b) hvor mange selskaper som skal klassifiseres, hvor mange som er no_text, og et kostnadsoverslag for én full kjøring;
(c) hvordan test-modus med lagret output virker, så en fersk klone kjører uten nøkkel;
(d) hva seeden skal inneholde. Den tekniske notatet sier AI-klassifiseringer for hele 62.100, men regelen vår er ingen type for selskaper utenfor allow-lista i repoet, og merkingen av fasitsettet er ikke ferdig. Mitt utgangspunkt er bare allow-listede selskaper til merkingen og lisensvurderingen i 5.4 er gjort. Hvis det gjør et plandokument feil, sier du hvilket og retter det i samme PR;
(e) om en endret prompt gjør at alle selskaper må klassifiseres på nytt, og hva det i så fall koster.

Modell og kostnad: utgangspunktet mitt er claude-haiku-5-5 med batch-API-et. Overslaget lages uten et eneste modellkall, ut fra den faktiske lengden på prompten og på beskrivelsene til et utvalg utenfor fasitsettet, med prisen du oppgir og datoen for den. Vis det som tokens inn, tokens ut (med tenkingen regnet med, og et høyt anslag i tillegg) og dollar, både for hele 62.100 og for bare AS. Etter mitt OK til overslaget kan du be meg om å kjøre en prøve på noen hundre selskaper utenfor fasitsettet for å måle det faktiske tokenforbruket. Da oppgir du også hva prøven koster.

Ingen modellkall, verken prøve eller full kjøring, før jeg har sett kostnadsanslaget for den kjøringen og sagt OK. Dette gjelder hver kjøring for seg. Nøkkelen setter jeg selv, og den skal aldri stå i en commit eller i en logg. Jeg kjører selv de ekte kjøringene.

Blinding: de 720 parene i labels.csv er ikke merket. Ingen klassifisering eller fingeravtrykk per orgnr for de 845 selskapene i analysis/labelled-set/document-run.json, heller ikke i terminalen, spec-en, PR-en eller ai-log. Bare totaler. Prompten og kategoriene skal ikke prøves ut eller justeres på disse selskapene, og du skal ikke åpne labels.csv eller labels-blind.csv. Eksempler og testdata kommer fra andre selskaper.

Ingen dump slettes. .local/document-run-2.5d/ er gjenopprettingskilden etter seed. Hver rad i I/O-matrisen skal nevne testen som feiler hvis koden fjernes. Små commits. PR-en skal ha linjen «Planning documents:».
```
*Changed:* issue #51, the branch and the draft spec with these decisions (`70d3187`). At the checkpoint the register text was found missing, and Story 2.6a was split out; its prompts are in the section above. The cost rule (no model call without an OK for that run) and the blinding rule held for the whole story.

**15:53**, after Story 2.6a was merged.
```
Fra meg: 2.6a er merget. Hent main (a71eb51) og oppdater story/2.6-classification-stage-5 med den. Fortsett Story 2.6 etter svarene jeg allerede har gitt ved sjekkpunktet, og med teksten sendt én gang der feltene er like.

Reglene står: ingen modellkall før jeg har sett kostnadsanslaget for den kjøringen og sagt OK, hver kjøring for seg. Nøkkelen setter jeg selv, og den skal aldri stå i en commit eller i en logg. Jeg kjører de ekte kjøringene selv. Ingen klassifisering eller fingeravtrykk per orgnr for de 845 selskapene i fasitsettet, bare totaler. Ikke åpne labels.csv eller labels-blind.csv.

Bygg og test uten nøkkel, med lagret output. Stopp før 300-prøven og vis meg anslaget for den. Små commits. Ingen push før jeg sier fra.
```
*Changed:* the branch was brought up to date with `main`, and the build followed: the SDK pinned (`d51dee9`), the table and the run record (`9965de9`), stages 4 and 5 (`370c6ce`), `pnpm classify` (`c486873`), the seed and `run.step2` (`d674075`), and docs (`ce3b80b`). The BMAD session stopped before the sample with an estimate.

**16:22**, the OK to the first sample.
```
Fra meg: OK til 300-prøven med --max-usd 0.20. Jeg setter nøkkelen og kjører den selv. Du kjører ikke pnpm classify igjen med noe annet enn --plan, uansett flagg. Det gjelder også kjøringer du regner med stopper av seg selv. Ikke rør databasen eller koden mens prøven går.

Når jeg sier at den er ferdig: logg batch-ID-en rett etter innsending, før raden skrives til databasen, så en stopp der ikke mister en betalt batch. ID-en navngir ingen selskaper. Legg til en test og oppdater issue #51. Full kjøring venter på at merkingen er ferdig og på eget OK.
```
*Changed:* the human ran run 14 himself. The BMAD session had run `pnpm classify` with a $0.01 cap without an OK for that run; nothing was sent, and this prompt limited it to `--plan`.

**16:35**, after run 14.
```
Fra meg: Prøven er ferdig: run 14, 300 sendt, 0 feilet, 186 154 tokens inn og 16 827 ut, omtrent $0,0135. Fordeling: produkt 126, konsulent 56, forhandler 2, annet 53, uklart 63. Review-sesjonen har sjekket at ingen av de 300 er i fasitsettet.

1. Gjør det du lovet: logg batch-ID-en rett etter innsending, før radene skrives, legg til testen og oppdater issue #51.

2. Prompten ser ut til å bruke produkt for lett. «Utvikling og programmering av software» og «Konsept- og programvareutvikling» ble produkt, men teksten viser ikke at selskapet selger egen programvare. Stram inn slik at utvikling av programvare alene ikke er nok til produkt: teksten må vise et eget produkt som selges, ellers uklart hvis den ikke viser hvordan selskapet tjener penger. Bruk bare de 300 i prøven som grunnlag, aldri de 845. Vis meg den nye prompten, hvor mange av de 300 du venter blir endret, og anslaget for en ny prøve med --reclassify-stale. Stopp der.

Ingen kjøring uten nøkkel-OK fra meg. Du kjører bare --plan. Full kjøring venter på merkingen og eget OK.
```
*Changed:* the batch id is logged before any row is written (`2a3bb91`, with a test), and the BMAD session proposed tighter categories.

**16:36**, sent while the BMAD session was still working on 16:35, as an addition to its point 2.
```
Fra meg: Tillegg til punkt 2. Bruk disse grensene i prompten:

- produkt: teksten navngir eller beskriver konkret et eget produkt som selges eller leies ut, for eksempel en plattform, et dataspill, en lisens eller et abonnement. Utvikling av programvare alene er ikke nok.
- konsulent: rådgivning, konsulenttjenester, utvikling for kunder eller utleie av folk.
- forhandler: videresalg av andres produkter.
- annet: drift, hosting, holding eller noe som ikke er noe av det over.
- uklart: bare generelle ord som «programvareutvikling», «IT-tjenester» eller «digitale tjenester og produkter», eller flere virksomheter sidestilt uten at én er hovedsaken.

Blandede tekster: det som står først og er konkret gjelder hvis resten kommer etter «samt» eller lignende. Sidestilte virksomheter gir uklart.

Prompten skal ikke inneholde selskapsnavn. Eksempler bare fra de 300 i prøven, aldri fra de 845. Vis meg den endelige prompten, hvor mange av de 300 du venter endres, og anslaget for en ny prøve. Stopp der.
```
*Changed:* these limits, with the human's answer at 16:40, became the prompt's categories (`47d4675`).

**16:40**, the human's answer to the proposed prompt.
```
Fra meg: Punkt 4: begrens produkt til programvare. Bruk «a software product of the company's own that is sold or rented out, such as a platform, a computer game, a licence or a subscription». Fysiske produkter blir annet.

Legg «utvikling og salg av programvare» og «selge varer og tjenester innen programvare» til i uklart-listen, så de svarene blir stabile.

Punkt 1–3 er greit: uklart er riktig for generelle tekster, og andelen rapporteres i 5.2.

Commit prompten, kjør testene og --plan, og gi meg den endelige kommandoen. OK til én ny prøve på de samme 300 med --reclassify-stale og --max-usd 0.20. Den kjører jeg selv. Etterpå står prompten fast til full kjøring, og den endres ikke etter at fasitsettet er målt.
```
*Changed:* the prompt was committed (`47d4675`) and the spec said when it stands (`57d7bb4`). The human ran sample run 17 himself.

**22:12**, after run 17.
```
Fra meg: Prøve 2 er ferdig (run 17, prompt 2810d26aa8dc): 300 sendt, 0 feilet, produkt 45, konsulent 45, forhandler 0, annet 47, uklart 163. 234 754 tokens inn, 15 171 ut, ca. $0,0155.

Det er strengere enn du ventet (produkt ~75, uklart ~140). Review-sesjonen leste uklart-tekstene: anslagsvis 20–25 av de 163 beskriver eget programvareprodukt konkret ("utvikling og salg av programvare for X"), og modellen svarer ulikt på nesten like tekster. Jeg lar prompten stå som bestemt: uklart tar ingen ut av gruppa, og andelen måles i Story 5.2.

Gjør dette, og ikke noe mer:
1. Før resultatet og denne avgjørelsen inn under Spec Change Log i spec-en for 2.6, med dato og at funnet kom fra review-sesjonen. Kun totaler, og egen commit på branchen.
2. Kjør pnpm classify --plan --all (ingen nøkkel, skriver ingenting) og gi meg kostnadsanslaget for full kjøring.

Ikke endre prompten. Ikke start full kjøring: den venter på at merkingen er ferdig og på min OK.
```
*Changed:* the finding and the decision went into the spec's change log (`1c30dd2`), and `--plan --all` gave the estimate for the full run: $0.73 central, $5.81 ceiling.

**2026-11-13 19:22**, after full run 18, with an addition on Bård Pettersen's PRD feedback pasted in the same message.
```
Fra meg: Full kjøring er ferdig (run 18, prompt 2810d26aa8dc, claude-haiku-5-5, 9 min): 10 326 sendt, 0 feilet, produkt 1 315, konsulent 1 699, forhandler 43, annet 1 379, uklart 5 890 (57 %), no_text 45. 8 069 842 tokens inn, 530 218 ut, ca. $0,54. Ingen rader er pending, failed eller sample. Review-sesjonen har sjekket run.step2 og tabellen.

Fullfør Story 2.6:
1. Før run 18 inn i spec-en og session-fila (kun totaler).
2. Seed-sekvensen som i 2.5c, steg 3–9: dump og backup med sha256, sjekk .local/document-run-2.5d/ mot databasen, slett rader utenfor allow-listen i én sjekket transaksjon, pnpm derive, pnpm seed:export i egen commit, pnpm seed to ganger med uendret re-eksport, gjenopprett .local/document-run-2.5d/, pnpm derive. Klassifiseringene går i seed slik spec-en sier. Rapporter hvor mange klassifiseringsrader seeden fikk, og tallene etter gjenoppretting (forventet 2 785 dokumenter, 5 556 kolonner, 2 537 fingeravtrykk og 10 371 klassifiseringsrader). Ingen dump slettes.
3. Kjør hele suiten med test:db og e2e.
4. Når alt er grønt: push branchen og åpne PR-en med "Planning documents:"-linje og lenke til session-fila. Gi meg PR-nummeret.

Blindingen gjelder fortsatt: ingen klassifisering eller fingeravtrykk per orgnr for de 845 i fasitsettet, hverken i terminal, spec, PR eller ai-log. Bare totaler. Ikke åpne labels.csv, labels-blind.csv eller labels-revenue-model.csv. Ikke kjør pnpm classify igjen.


Fra meg, tillegg til 2.6: Bård Pettersen har lagt tilbakemelding på PRD-en i main (prds/prd-Peerless-2026-09-25/tilbakemelding-prd.md). To punkter hører hjemme i 2.6-PR-en, siden 2.6 har avgjort dem:
1. FR-11: list kategoriene modellen svarer med (produkt, konsulent, forhandler, annet og avståelsen uklart, som lagres som classified uten type), og at et svar utenfor settet lagres som failed og telles i run.step2. Lag konsekvenser som kan testes, og pek på testene.
2. §8 Cost: det faktiske tallet fra run 18 (10 326 selskaper, ca. $0,54, Batch API, kjøres på nytt bare ved endret tekst, prompt eller modell).
Skriv det som regel og konsekvenser, ikke historikk, og legg historikken i .memlog.md med en (change)-linje. Resten av tilbakemeldingen tar vi etter 2.6.
```
*Changed:* run 18 in the spec (`9b7eb53`), FR-11 and §8 Cost (`c0acc0c`), the seed (`77b8813`), the fixes the BMAD session found in the seed sequence (`869a82c`, `4af1694`, `8045ca1`), the docs (`e763091`) and PR #54.

**19:51**: pasted before the review was posted, so the BMAD session found no review and changed nothing.
```
Fra meg: Review på PR #54 er postet. Gjør dette, og ikke noe mer:
1. Rett blinding-påstanden i docs/ai-log.md (linje 825), PR-teksten og session-fila som foreslått i linjekommentaren. Seedens classification.csv har alle 845 selskapene i fasitsettet. Det er riktig at de er der, men teksten skal si det. Merkingen var ferdig før run 18, og den andre merkeren får ikke se fila.
2. Før de to andre kommentarene inn i deferred-work.md som egne punkter med lenke til kommentaren: tokens for feilede svar, og prøverader i forespørselsstien.
3. Oppdater session-fila med review-funnene, med hvem som fant hva (review-sesjonen), og hva som ble rettet eller utsatt.
Én commit for rettingen og én for dokumentasjonen. Push, og si fra når CI er grønn. Ikke merge.
```
*Changed:* nothing; see the next prompt.

**19:53**, after the review was posted.
```
Fra meg: Reviewen er postet nå (https://github.com/IBE160-2026/G97-meinich/pull/54#pullrequestreview-5896391765). Gjør de tre punktene fra forrige melding:
1. Blinding-påstanden: ordlyden står i kommentaren på docs/ai-log.md:825 (https://github.com/IBE160-2026/G97-meinich/pull/54#discussion_r4567327631).
2. deferred-work.md:
   - tokens for feilede svar: https://github.com/IBE160-2026/G97-meinich/pull/54#discussion_r4567327638
   - prøverader i forespørselsstien: https://github.com/IBE160-2026/G97-meinich/pull/54#discussion_r4567327641
3. Session-fila med funnene, kreditert review-sesjonen.
Én commit for rettingen og én for dokumentasjonen. Push, og si fra når CI er grønn. Ikke merge.
```
*Changed:* the blinding claim corrected (`b9f928a`) and two findings deferred, with the review in the session file (`c47b951`).

### Prompts to the review session

- `ikke kjør noe før jeg vet kostnadsanslag ved en kjøring og har sagt OK` (11-08, in the 2.6a section): the rule every model run in this story followed.
- `hvordan finner jeg nøkkelen? …`, `står at max abbonnement inkluderer 100 USD i mnd` and the following questions (11-08): the review session explained the API credit included in the plan, where the key goes, and that it stays in `.env`. The key was saved in `.env.example` by mistake; the human restored that file before any commit, and the review session checked that the key is in no commit on any ref.
- `limt inn til BMAD - men føler vi må ha det mer klart ja` (11-08): the review session drafted the 16:35 and 16:40 prompts after reading run 14's answers on the 300 sample companies only.
- `svart igjen:` with run 17's output (11-08): the review session read the `uklart` texts, found that an estimated 20-25 of 163 describe a product of the company's own, and recommended letting the prompt stand. The human did (22:12).
- `okei så må først bli ferdige med labels` (11-08) to `vi brukte her Chat GPT sin modell til å fylle ut. …` (11-11): the labelling of the 720 pairs, which the full run waited for. That exchange belongs to Story 5.1 and goes in its section.
- `okei, så nå kjører vi full batch kjøring?` (11-11): the review session checked the branch, the database and that no batch was pending; the human had already started run 18.
- `Se svaret:` with run 18's output, and `Først se at sensor har pushet noe som jeg må pulle` (11-13): the review session checked run 18, brought `main` up to date with Bård Pettersen's two commits, summarised his PRD feedback and drafted the 19:22 prompt's addition.
- The BMAD session's report on PR #54, `post review` and `merget` (11-13): the review session reviewed the PR, posted the review at the human's request and did the housekeeping on `main`.

### Result

Every AS in `62.100` with text is classified from its register text by `claude-haiku-5-5` through the Batch API: run 18 sent 10 326, 0 failed, `produkt` 1 315, `konsulent` 1 699, `forhandler` 43, `annet` 1 379, `uklart` 5 890 (57 %), and 45 had no text; about $0.54. Funnel stages 4 and 5 combine the fingerprint and the text, and the seed holds the 10 371 rows.

### Checks before merging

The review session checked these against `run.step2`, the database, the seed and the code:
- runs 14, 17 and 18, and that neither sample held a company of the labelled set;
- stages 4 and 5 for all nine combinations of the two signals;
- that the eleven tests the spec and FR-11 cite exist;
- the seed's 10 371 rows, among them the 845 of the labelled set, which the PR text had said were not there.

CI was green on `c47b951`. At the human's request (`post review`), the review session posted the GitHub review with six line comments. The PR was merged at 19:05 UTC on 2026-11-13 as `2e98a7b`.

## Story 5.1: the labelled set (#13, PR #55), with question 22 and `seed:full` on `main` (`d9fb281`…`d704fd2`, `8e69ac6`…`797429f`)

The rules, the draw and most of the labelling were done with the review session, in the worktree `.local/wt-5.1`; the BMAD session took the PR and the planning changes. Every `Fra meg:` prompt below was drafted by the review session and pasted by the human, who made the decisions in it. The labels are not given per pair.

### Prompts to the BMAD session

Before these, the 2.5d section's prompt of 2026-11-07 12:27 merged the draw's commits into Story 2.5d, so the labelled set's document run could read its list.

**2026-11-13 20:15**: question 22 on `main`, then the Story 5.1 PR.
```
Fra meg: To oppgaver, i denne rekkefølgen.

DEL 1: Q22 (PRD §11), rett på main som planarbeid. Min beslutning, på Bård Pettersens tilbakemelding (tilbakemelding-prd.md, 4.2):
- v1 leveres på demodataene (FR-73). Alt som allerede er lest, er med: dokumentene i seeden (demoselskapene og OCR-referansesettet), og de lokale dokumentene og fingeravtrykkene for fasitsettet, som Story 5.2 måler mot. Det som ikke er med i v1, er dokumentkjøringen for resten av 62.100 (alle selskaper, alle år, ca. 190 timer). Verktøyet for den finnes (pnpm ingest --documents <liste>), så den kan kjøres senere uten ny kode.
- FR-3 og FR-59 skrives om: 62.100 regnes som dekket i v1 for selskapene i seeden, målt mot fasitsettet. Andre 62.100-selskaper får trinn 1–3 og klassifiseringen, slik Story 5.4 sier.
- Nøkkeltall 7 og 8 vises som fraværende i v1, med grunn (FR-21, FR-22). Lesing av aarsverk flyttes til stage 2.
- Q22 flyttes til "Answered". Rett epics.md, den tekniske notatet, docs/key-figures.md hvis den berøres, og deferred-work.md (de to oppføringene). (change)-linje i .memlog.md.
Skriv FR-ene som regel og konsekvenser, ikke historikk. Små commits, push til main, og vis meg hashene.

DEL 2: Story 5.1-PR-en (issue #13). Branchen story/5.1-labelled-set er sjekket ut i worktreen .local/wt-5.1 og har 7 lokale commits som ikke er pushet. Arbeid der, og oppdater den med main etter del 1.
- Merkingen er ferdig. De 180 blinde parene er merket av meg. De 720 andre har to runder: første runde merket av meg, strengere enn kriteriet, og beholdt som første runde. Andre runde er én forretningsmodell per selskap (685 selskaper), fylt ut av en ChatGPT-modell som jeg har gått gjennom og godtatt. Parene regnes ut. README-en i analysis/labelled-set/ har tallene og hvorfor. Bruk tallene derfra.
- Den andre merkeren og κ er ikke oppnådd i v1. Min beslutning: det tas i stage 2. Si det i README-en under "Labelling record" som en mangel, slik FR-70 krever.
- FR-70 og Story 5.1 i epics.md sier "hand-labelled". Rett dem i denne PR-en: de blinde parene er merket av et menneske, andre runde av de 720 av en ChatGPT-modell, og κ er utsatt til stage 2. Rett også den tekniske notatets avsnitt om hva målingen hevder, hvis det sier noe annet. (change)-linje i .memlog.md.
- Session-fil for 5.1, med lenker til commitene. Ta med funnene fra review-sesjonen: den lave andelen ja i første runde og at notatene viste at sektor ble vektlagt. Ta også med beslutningene mine: beholde første runde, gå tilbake til kriteriet, og godta ChatGPT-runden.
- Push og åpne PR-en mot main med "Closes #13", "Planning documents:"-linjen og lenke til session-fila. Gi meg PR-nummeret. Ikke merge.

Ikke åpne labels.csv, labels-blind.csv eller labels-revenue-model.csv. Det du trenger, står i README-en. Ingen dump slettes, og pnpm classify kjøres ikke.
```
*Changed:* part 1 on `main`: the PRD (`d9fb281`), `epics.md` (`de07de3`), the technical note (`cb00c4c`), `docs/key-figures.md` (`1998731`) and `deferred-work.md` (`d704fd2`); the BMAD session added that the pay-level-versus-productivity view is absent too. Part 2: `main` merged into the branch (`8144423`), the shortfall and the counts in the README (`e73a3c8`), FR-70, `epics.md`, PRD §10 and the technical note (`fe34951`, `8a2a9b0`, `f3cb055`), the session file (`f317cda`, `4100f59`) and PR #55. The first point was replaced before it was pasted, after the human asked whether the document runs already made were left out of v1; they were not.

**20:27**, sent while the BMAD session was working, after the review was posted.
```
Fra meg: Reviewen på PR #55 er postet (https://github.com/IBE160-2026/G97-meinich/pull/55#pullrequestreview-5896815047). Gjør dette i worktreen .local/wt-5.1, og ikke noe mer:
1. Formuleringen "one AI's classification with another's" gjelder bare tekstlaget (trinn 5), ikke fingeravtrykket eller bransjekoden. Rett den slik kommentaren foreslår (https://github.com/IBE160-2026/G97-meinich/pull/55#discussion_r4567668083) på alle fire stedene: PRD FR-70, den tekniske notatet (linje 516), README-en for fasitsettet (linje 87) og session-fila. Kreditér funnet til review-sesjonen, og si at feilen startet i README-teksten den skrev selv.
2. Push sesjonsloggen e2d5697 til PR-en, slik AGENTS.md krever.
3. Oppdater session-fila med reviewen: funnet, hva som ble rettet, og mine to beslutninger fra kommentarene på README-en.
Én commit for rettingen og én for session-fila. Push, og si fra når CI er grønn. Ikke merge.
```
*Changed:* the wording corrected in four files (`d46ebb6`), the BMAD session's own session log pushed (`e2d5697`), and the review in the session file (`15c63f0`).

**20:27**: `pnpm seed:full`.
```
Fra meg: pnpm seed:full (FR-73, Story 5.7). Min beslutning, etter Q22: kommandoen lover ikke lenger hele datasettet.
- pnpm seed:full bygger registerdata og API-nøkkeltall for hele 62.100 (pnpm ingest), og leser dokumenter bare for selskapene i en liste brukeren gir (pnpm ingest --documents <liste>). Uten liste leser den ingen dokumenter. Den kaller ingen modell og trenger ingen nøkkel.
- Popover-teksten for "Ikke i demodataene" lover ikke lenger hele datasettet. Den sier at tallene fra årsregnskapsdokumentene bare er lest for demoselskapene i v1. Foreslå en norsk tekst, og vis den til meg før den står i EXPERIENCE.
- Rett FR-73 (både "full"-nivået og avsnittet om hva andre selskaper viser), Story 5.7 i epics.md (kriteriene om seed:full, README-teksten og popover-teksten), EXPERIENCE og den tekniske notatet der de nevner seed:full. (change)-linje i .memlog.md.
Skriv det som regel og konsekvenser, ikke historikk. Små commits rett på main, og vis meg hashene og popover-teksten.
```
*Changed:* the BMAD session paused and asked where the full dataset's classifications and explanations come from, and proposed the popover text.

**20:39**: the answer.
```
Fra meg:
1. PR #55: rett PR-beskrivelsen til samme formulering som i d46ebb6 (tekstlaget, trinn 5). Ingenting annet. Jeg merger etterpå.

2. seed:full, på main:
- Popover-teksten kan brukes som du foreslo: «Tallene fra årsregnskapsdokumentene er i denne versjonen bare lest inn for demoselskapene og sammenligningsgruppene deres. For dette selskapet sammenlignes bare nøkkeltallene fra Regnskapsregisterets API.»
- seed:full kaller aldri en modell. Klassifiseringene tas fra den committede seeden, som har alle AS i 62.100. Den som vil lage nye, kjører pnpm classify for seg selv, med nøkkel. Forklaringene fra demoseeden vises bare der den lagrede digesten stemmer med motoren for datasettet som er lastet, og ellers vises ingen, med beskjed (FR-73, AD-13). Det er ingen ny regel.
- "Runs both batch steps" i Story 5.7 betyr pnpm ingest (med dokumentliste hvis brukeren gir en) og pnpm derive. Klassifisering og forklaringer er ikke med.
Rett FR-73, Story 5.7, den tekniske notatet og EXPERIENCE i små commits rett på main, med (change)-linje i .memlog.md. Vis meg hashene.
```
*Changed:* the PR text corrected, and on `main` the PRD (`8e69ac6`), `epics.md` (`7f0cbee`), the technical note (`cdf9f23`) and EXPERIENCE (`797429f`). The BMAD session added two test requirements and the time per document to Story 5.7.

### Prompts to the review session

- `okei hva er neste steg nå` and `gjerne` (10-30): the review session wrote the sampling frame and rubric before the draw and before Story 2.5 (`737d089`, after `ja det er greit`), then the draw script and its first step (`2c21381`, `dbe2d0d`), in the worktree.
- `se nå`, `sånn - føler konsulenttjenester innen it er beskrvende nok?`, `sånn` and `behold` (10-30): the human scored the subjects' descriptions. The review session found 54 rows left empty before the last scored one and asked for them in order, proposed a sharper rule for "informative", and ran the second step (`d631915`, `c0f10a0`).
- `Okei, kan du beskrive og gi meg excel filene jeg bør jobbe på` and `kan du fylle inn det for meg?` (10-30): the review session explained the sheets and filled in only `labelled_by` and `labelled_on` for the rows the human had labelled, never a label.
- `da er labels blind ferdig` (11-01): the review session checked the 180 blind pairs and pushed them (`15e1010`).
- `kan vi starte med 2.6 før denne De 720 parene i labels.csv må merkes før Story 5.2. …` (11-08): Story 2.6 started while the 720 pairs waited, and its full run waited for them.
- `okei gi meg labels.csv så jeg kan fortsette` and `har fylt den ut` (11-09): the review session checked the format, then found the low share of `ja` against the blind pairs and, from the notes, that sector and wording had been weighed (`7b0a54f`, `ead8f8a`).
- `det kan hende jeg var litt strengere nå. …`, `ønsker det spesifikt som jeg har gjort` and `ja eller hva tenker du? Er det dumt med endring?` (11-09): the human first kept the specific labels; the review session then recommended a second round against the rubric, keeping the first.
- `okei, kan du fylle ut en ny en med din vurdering også kan jeg bekrefte eller avkrefte om ikke OK?` (11-09): the review session declined to pre-fill the labels, because the set measures a Claude model and the human would anchor on its answers, and proposed one revenue model per company with the pair labels computed (`52794dd`).
- `okei, har readme fått med seg at vi går tilbake til det vi opprinnelig ble enige om - ikke sektor nå i første omgang` (11-09): the README was corrected to say so.
- `har fylt ut nå` (11-09), then `vi brukte her Chat GPT sin modell til å fylle ut. Må være OK i denne omgang. …` and `gått gjennom og ser OK ut - noe av oppgaven er jo også basert på å bruke AI så synes det er greit` (11-11): the review session noticed from the timing and the notes that the sheet had not been filled in by hand and asked; the human confirmed it and accepted the round, and the README says so (`c799ff1`, `3a7f322`, `60ae244`).
- `1. enig 2. ok for nå - får eventuelt gjøre dette i steg 2` (11-13): the human accepted the review session's proposal for question 22 and moved the second labeller and κ to stage 2.
- `okei vent 2 sek - all den dokumentkjøringen vi har gjort skal ikke med i v1?` (11-13): the review session clarified that everything already read stays in v1 and rewrote the first point of the 20:15 prompt.
- `A (anbefalt): endre løftet. …` and `1. ja` (11-13): the human chose to change what `seed:full` promises, and asked for the review to be posted.
- A screenshot of the merge conflict (11-13): the review session merged `main` into the branch and kept both `.memlog.md` lines (`b07322c`).

### Result

The labelled set has 30 subjects and 900 pairs. The 180 blind pairs are labelled by the human. The other 720 have a first round by the human, kept as a stricter reading, and a second round by revenue model per company, filled in by a ChatGPT model and accepted by the human, which is the measure; no second labeller or κ in v1. Question 22 is answered: v1 ships on the demo data with everything already read, and `pnpm seed:full` no longer promises the full dataset.

### Checks before merging

The review session checked the README's counts against the label files as it counted them when they were committed, and that FR-70, Story 5.1, PRD §10 and the technical note say who labelled and that κ is stage 2. At the human's request (`1. ja`), it posted the GitHub review with three line comments; one wording, which had started in a README sentence the review session wrote, was corrected. The PR was merged at 19:52 UTC on 2026-11-13 as `0e21eae`.

---

## Going forward

After each merged story, and after planning or documentation work committed straight to `main`, the prompts from both sessions are added here in the same form: verbatim, with what changed and the commit or PR it landed in.
