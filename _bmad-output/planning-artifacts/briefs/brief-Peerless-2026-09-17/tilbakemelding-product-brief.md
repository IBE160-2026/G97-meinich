# Tilbakemelding på product brief

| | |
|---|---|
| **Gruppe** | G97 – G97-meinich |
| **Product brief** | `_bmad-output/planning-artifacts/briefs/brief-Peerless-2026-09-17/brief.md` (commit `7e66824`), lest sammen med `addendum.md` i samme mappe. PRD, teknisk notat og UX-dokumenter er sett på som kontekst. |
| **Tilbakemelding fra** | Faglærer i IBE160 (utarbeidet med KI-støtte) |
| **Dato** | 2026-10-06 |

## Samlet vurdering

- **Godt utgangspunkt med justeringer.** Gruppen kan gå videre og innarbeide punktene under.

**Det som er bra:**

1. Briefen er presis om både problem og kjerneidé. Eksempelet med lønnsandel på 31 mot 29 prosent, som for et programvareselskap med 18 millioner i omsetning utgjør 360 000 kroner i året, viser verdien umiddelbart. Innsikten om at «the comparison itself is not hard – choosing the group is» gir prosjektet et tydelig faglig tyngdepunkt.
2. Arbeidsdelingen mellom regler og KI er svært gjennomtenkt: KI klassifiserer bare virksomhetsbeskrivelser og skriver forklaringer, «the AI never calculates», og tekst med tall motoren ikke har beregnet, avvises av en automatisk test. Suksesskriteriet for peer-utvalget (presisjon og recall mot et merket sett, blind merking og Cohen's κ med en annen merker) er et uvanlig modent opplegg for kvalitetssikring. Historikken viser også en ekte, iterativ prosess med målinger (OCR-avstemming på 180 regnskap) som har endret planen.

**De viktigste endringene:**

1. Reduser omfanget av v1 betydelig. For en gruppe på én person og «a thirteen-week solo schedule» inneholder v1 svært mye: OCR av skannede regnskap, femstegs peer-trakt med KI-klassifisering, et dusin nøkkeltall med dekomponering, verdsetting, bransjeoversikter, anonym og magic-link-innlogging, arbeidsområder med inviterte lesere, porteføljeforside, revisjonslogg, PDF-eksport, egne ikke-leverte tall og et responsivt grensesnitt. Dere har en kuttrekkefølge (porteføljeforside først, så bransjeoversikter) – gå lenger, og flytt arbeidsområder, invitasjoner, porteføljeforside, egne tall og PDF-eksport ut av v1 allerede nå.
2. Planlegg hvordan sensor kan kjøre appen. `.env.example` forutsetter et Supabase-prosjekt (inkludert service role-nøkkel) og en Anthropic-nøkkel, og magic link krever e-postutsending. Sensor må kunne starte appen lokalt med ferdig innlastede data for de to første bransjene, uten deres nøkler – for eksempel med lokal Supabase og et seed-skript, lagrede KI-klassifiseringer og en testmodus for forklaringsteksten.
3. Flytt grensesnittet tidligere i planen. Briefen sier selv at «the interface … lands late». Del 1 vurderer det sensor kan bruke, inkludert design og brukeropplevelse. Lag en enkel, fungerende analyseside (organisasjonsnummer → peer-gruppe → nøkkeltall og gap i kroner) tidlig, og bygg målingene og resten rundt den.

## Vanskelighetsgrad og gjennomførbarhet

### Vurdert vanskelighetsgrad

- **Vanskelig**

**Sammenlignbart med:** 4) KI-støttet MRP II (vanskelig). Som MRP II har Peerless mange moduler som henger sammen (datainnhenting med OCR, peer-utvalg, nøkkeltallsmotor, verdsetting, tilgangsstyring) og domenelogikk som må være faglig riktig. Kravene til korrekthet og tilgangskontroll ligner også 5) KI-styrt sensurering.

**Begrunnelse:**

| Faktor | Nivå (lav / middels / høy) | Kommentar |
|---|---|---|
| Domenelogikk – hvor mange og hvor kompliserte regler og beregninger må stemme? | Høy | Nøkkeltall, kvartiler og persentiler, oversetting av avvik til kroner, arbeidskapital, EV/EBIT-verdsetting, avstemming av OCR-tall og regler for når et avvik er vedvarende. |
| Datamodell – antall entiteter og relasjoner mellom dem | Høy | Selskap, regnskap per år og linje, bransje, klassifisering, peer-gruppe med begrunnelse, analyse, arbeidsområde, medlemskap, egne tall og revisjonslogg. |
| Brukere, roller og innlogging | Høy | Anonym innlogging, magic link, arbeidsområder med eier og inviterte lesere, og radnivåsikkerhet med krav om null tilgang på tvers av arbeidsområder. |
| KI-funksjonalitet i appen, f.eks. kall til språkmodell, prompts i koden og håndtering av usikre svar | Middels | To avgrensede oppgaver (klassifisering til fast kategori og forklaringstekst), med automatisk avvisning av tall. Godt kontrollert. |
| Integrasjoner og eksterne tjenester, f.eks. API-er, betaling og e-post | Høy | Brønnøysundregistrene, OCR, Supabase, Anthropic og e-post for magic link. |
| Sanntid, samtidighet eller flere brukere som påvirker hverandre | Middels | Delte arbeidsområder og hastighetsbegrensning, men ingen sanntid. |
| Filhåndtering, f.eks. opplasting, PDF-lesing og eksport | Høy | OCR av skannede regnskapssider med avstemming, og PDF-eksport. |
| Sikkerhet og personvern | Høy | Brukeraktivitet og egne tall er konfidensielle, revisjonslogg, hastighetsbegrensning mot høsting av registeret. Svært godt gjennomtenkt i addendumet. |

**Hva vanskelighetsgraden betyr for dere:**

- _Vanskelig:_ Et vanskelig prosjekt gir større mulighet for toppkarakter, men også større risiko. Definer en minimal versjon som sikkert kan bli ferdig – én bransje, analyse uten konto, peer-gruppe med begrunnelse, nøkkeltall, gap i kroner og KI-forklaring – og legg resten i tydelige trinn etterpå. Målingen av peer-utvalget er kjernen i prosjektet og bør beholdes.

### Gjennomførbarhet med BMAD og Claude Code

Dere skal planlegge med BMAD (product brief → PRD → arkitektur → epics og stories) og implementere med Claude Code. Vurderingen under tar hensyn til at det må være tid til hele denne flyten, og til testing, retting og README til slutt.

| Spørsmål | Vurdering (OK / risiko / stor risiko) | Kommentar |
|---|---|---|
| **Tid og omfang** – kan v1 realistisk bli ferdig og stabil i løpet av semesteret, med tid til flere iterasjoner? | Stor risiko | Planleggingen er svært grundig, men v1 er større enn én person rekker å bygge, teste og dokumentere ferdig. Uten videre kutt er risikoen at mange deler blir halvferdige. |
| **BMAD-flyten** – er briefen konkret nok til at PRD, arkitektur og stories kan lages uten store hull, og blir det overkommelig mange stories? | Risiko | Brief, PRD, teknisk notat og UX er allerede laget og gjennomgått. Antall stories blir svært høyt med dagens v1 – bruk kuttrekkefølgen aktivt når epics lages. |
| **Egnet for Claude Code** – bruker løsningen en vanlig, godt dokumentert teknologistakk som Claude Code håndterer godt, eller krever den nisjeteknologi, spesialmaskinvare eller mye manuell konfigurasjon? | Risiko | Next.js og Supabase er godt dokumentert. OCR-pipelinen (med egen Dockerfile) og radnivåsikkerhet krever mer manuell konfigurasjon og testing. |
| **Kontroll på KI-ens arbeid** – kan gruppen selv avgjøre om koden gjør det riktige? Krever domenet kunnskap gruppen ikke har, f.eks. avanserte beregninger eller fagregler, så er det vanskelig å kvalitetssikre. | OK | Dere har vist domenekunnskap og planlagt kontroll: avstemming av OCR, håndberegnede tilfeller fra ekte regnskap, merket sett for peer-utvalget og test som avviser KI-tall. |
| **Testbarhet** – finnes det tydelige regler og forventede resultater som tester kan skrives mot? | OK | Svært godt egnet: nøkkeltall, avstemming, minstegruppe på ti peers og autorisasjonstester har tydelige forventede resultater. |
| **Kjørbar for sensor** – kan appen kjøres lokalt etter README, uten gruppens nøkler, betalte kontoer eller egen infrastruktur? | Stor risiko | Avhenger i dag av et Supabase-prosjekt, Anthropic-nøkkel, e-postutsending og data som må hentes og OCR-leses. Uten lokal database med seed-data og testmodus kan ikke sensor kjøre appen. |
| **Avhengigheter og kostnader** – krever løsningen betalte API-er, f.eks. språkmodeller, og finnes det en plan for kostnad, testmodus eller mock-data? | Risiko | KI kjøres én gang per selskap ved innlasting, noe som holder kostnaden nede. Lagre klassifiseringene i seed-dataene, og planlegg testmodus for forklaringsteksten. |

**Konklusjon om gjennomførbarhet:**

- **Gjennomførbart med justert omfang.** Se forslagene under.

**Forslag til justering av omfang eller vanskelighetsgrad:**

1. Definer v1 som: én bransje (for eksempel programmeringstjenester), analyse uten konto, synlig og justerbar peer-gruppe med begrunnelse, nøkkeltall med persentiler, gap i kroner med lukkbar andel, KI-forklaring og målingen av peer-utvalget. Legg magic link, arbeidsområder, invitasjoner, porteføljeforside, egne tall, revisjonslogg og PDF-eksport i trinn 2, og bokføringsbransjen og bransjeoversikter i trinn 3.
2. Gjør datagrunnlaget for v1 statisk: hent og OCR-les regnskapene for den valgte bransjen på forhånd, og lever dem som seed-data i repoet (registerdataene er åpne). Da kan sensor kjøre appen lokalt, og OCR-pipelinen kan vises og testes separat.

## Hvorfor product brief er viktig for mappen

Product brief er utgangspunktet for PRD, arkitektur, stories og til slutt koden. Del 1 av mappen vurderes blant annet på om sensor kan følge en sporbar vei fra plan til ferdig app. Den vurderes også på om appen gjør det dere har beskrevet, om den er testet, om den er godt designet, og om den kan kjøres etter README. Et uklart, for stort eller for lite brief gjør alt dette vanskeligere senere. Det er mye enklere å rette nå enn sent i semesteret.

## 1. Gjennomgang av briefens deler

| Del av brief | Status | Kommentar |
|---|---|---|
| Executive Summary – er det klart hva appen er, og hvilket problem den løser? | OK | Svært tydelig: organisasjonsnummer inn, posisjon mot sammenlignbare selskaper og gap i kroner ut. |
| The Problem – er problemet konkret, med reelle situasjoner og brukere? | OK | Konkret eksempel med tall, og en grundig gjennomgang av hvorfor eksisterende tjenester (kredittbyråer, Proff Forvalt, Enin, Valutico) ikke løser det. |
| The Solution – beskriver løsningen brukeropplevelsen, ikke bare teknologi? | OK | Beskriver brukerens vei steg for steg (oversikt, organisasjonsnummer, posisjon, gap, peer-gruppe, forklaring, lagring). |
| What Makes This Different – er vurderingen ærlig og realistisk? | OK | Ærlig: «None of this is defensible», med begrunnelse i addendumet. |
| Who This Serves – er primærbrukerne tydelige, og vet vi hva de trenger? | OK | Regnskapsførere og rådgivere som primærbrukere, med tydelig bruksituasjon. Vurder om daglige ledere og styremedlemmer som inviterte lesere trengs i v1. |
| Success Criteria – kan kriteriene faktisk sjekkes eller testes? | OK | Målbare og testbare kriterier for troverdighet, funksjon, ytelse og sikkerhet. |
| Scope – er det klart hva som er med i første versjon, og hva som ikke er det? | Endre | Tydelig inndeling og begrunnet «Out», men «In for v1» er for stort for én person. Flytt flere punkter til senere trinn. |
| Vision – henger visjonen sammen med resten uten å blåse opp omfanget? | OK | Investorvisninger og overvåking er tydelig plassert etter v1. |

## 2. Utgangspunkt for del 1 av mappen

Punktene følger kriteriene i sensorveiledningen for del 1. Vektene i parentes viser hvor mye hvert kriterium teller i del 1.

| Kriterium i del 1 | Hva briefen bør legge til rette for | Status | Kommentar |
|---|---|---|---|
| **1. Prosess og KI-styring** (30 %) | Brief som er presis nok til at PRD og stories kan bygges direkte på den, slik at krav kan spores fra brief til kode. | OK | Svært sterk sporbarhet: revidert brief, PRD med gjennomganger, teknisk notat, AI-logg og beskrivende commits. Fortsett med å koble stories og kode til disse dokumentene. |
| **2. Funksjonalitet og omfang** (20 %) | Realistisk omfang for gruppen og semesteret: en tydelig kjerneflyt som kan bli ferdig og stabil, og nok innhold til å vise reell funksjonalitet. | Endre | Kjerneflyten er tydelig, men omfanget er for stort til å bli ferdig og stabilt. Kutt til kjerneflyten nå. |
| **3. Kvalitetssikring og testing** (15 %) | Suksesskriterier og funksjoner som er konkrete nok til å bli testtilfeller. | OK | Gode testkriterier og et gjennomtenkt opplegg for å måle peer-utvalget. |
| **4. Design og brukeropplevelse** (10 %) | Tydelige brukere og brukssituasjoner som designet kan bygges rundt, gjerne med de viktigste skjermbildene eller flytene skissert. | Juster | DESIGN.md og EXPERIENCE.md finnes allerede. Risikoen er at grensesnittet kommer sent – start tidlig med analysesiden. |
| **5. Kodekvalitet og arkitektur** (10 %) | Teknologivalg som er begrunnet og ikke mer komplekse enn appen trenger. | Juster | Valgene er godt begrunnet, men anonym innlogging, radnivåsikkerhet og arbeidsområder gir mer arkitektur enn kjerneflyten trenger i v1. |
| **6. README og kjørbarhet** (10 %) | Løsning som andre kan kjøre lokalt uten betalte kontoer, og uten tilgang til gruppens egne tjenester og nøkler. | Endre | Krever i dag eget Supabase-prosjekt og Anthropic-nøkkel. Planlegg lokal database med seed-data og testmodus, og beskriv det i README. |
| **7. Ryddighet i repoet** (5 %) | En plan for hvor hemmeligheter, testdata og dokumentasjon skal ligge. | OK | `.env.example` med tydelige advarsler, og en klar struktur for analyse, dokumentasjon og planlegging. |

## 3. Neste steg for gruppen

1. Oppdater Scope i briefen (og PRD-en) med en mindre v1 – én bransje og analyse uten konto – og flytt resten til navngitte trinn.
2. Bestem i arkitekturen hvordan sensor kjører appen lokalt: lokal Supabase eller tilsvarende, seed-data med ferdige OCR-tall og KI-klassifiseringer, og testmodus for forklaringsteksten.
3. Bygg en første, enkel versjon av analysesiden tidlig, og la målingen av peer-utvalget og grensesnittet utvikles parallelt i flere korte runder.

Oppdater product brief i repoet når dere har gjort endringene, slik at historikken viser hvordan planen utviklet seg. Det er en del av prosessen sensor ser etter.
