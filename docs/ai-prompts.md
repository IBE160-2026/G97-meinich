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

## Going forward

After each merged story, and after planning or documentation work committed straight to `main`, the prompts from both sessions are added here in the same form: verbatim, with what changed and the commit or PR it landed in.
