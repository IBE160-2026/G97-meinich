# Tilbakemelding på PRD

| | |
|---|---|
| **Gruppe** | G97 – G97-meinich |
| **PRD vurdert** | `_bmad-output/planning-artifacts/prds/prd-Peerless-2026-09-25/prd.md` (status i frontmatter: draft, `updated` 2026-11-04, siste commit 2026-11-06, `b2a9cdf`). Lest sammen med `addendum.md`. |
| **Dato** | 2026-11-12 |
| **Type** | Formativ tilbakemelding, ikke karakter |

## 1. Samlet inntrykk

PRD-en har en tydelig tese (peer-gruppens kvalitet skal måles, ikke påstås), nesten alle krav har testbare konsekvenser, og KI-bruken er avgrenset og kontrollert med tester. Risikoen ligger i størrelsen: ca. 23 600 ord og 73 FR-er der krav, byggehistorikk og beslutningslogg er blandet, og v1 er fortsatt stor for én person, med to arbeidsposter uten eier.

## 2. Dette fungerer godt

1. **Tese og målbar kjerne.** §1: «The peer group determines the answer», og §10 lar SM-1-resultatet bli «modellen trengtes ikke». SM-1b er ærlig merket som kontroll, ikke påstand, fordi kriteriet er sirkulært. Dette er en tese som kan feile.
2. **KI-kontroll og testmodus.** FR-53 avviser tall som mangler i motorens output, og også riktig tall på feil nøkkeltall. Testen leser norske tallformater. FR-54 har en frasebibliotek-sjekk, og FR-73 lar appen kjøre uten nøkkel med lagret KI-output.
3. **Ærlig avgrensning.** §5 og §6.4 har «Never cut»-liste og kuttrekkefølge. SM-C1 til SM-C4 er motmål som hindrer feil optimalisering. FR-22 krever at en tom rad forklarer hvorfor, og kjente svakheter (MVA-effekten på kundefordringsdager) er oppgitt, ikke skjult.

## 3. Oversikt per dimensjon

| Dimensjon | Vurdering | Kort begrunnelse |
|---|---|---|
| Beslutningsklarhet | sterk | Valg står med dato og avveining (Q5, Q6, FR-8, FR-32). Åpne spørsmål er reelt åpne. |
| Substans | sterk | Lite pynt. Navn og tall i UJ-ene er merket som oppdiktet med `[ASSUMPTION]`. |
| Strategisk sammenheng | sterk | Alle funksjoner tjener peer-gruppetesen. SM-ene måler tesen, ikke aktivitet. |
| Testbarhet | god | De fleste FR-er har konkrete konsekvenser. Noen stage 2-FR-er og FR-11 mangler dem. |
| Scope og avgrensning | god | Utelatelser er svært eksplisitte, men v1 er stort og to poster har ingen eier. |
| Brukbarhet for neste fase | god | Godt glossar og stabile ID-er. Lengden og blandingen med historikk gjør uttrekk tungt. |
| Formtilpasning | god | UJ-ene passer et produkt med flere brukertyper. Dokumentet fungerer også som logg, noe malen ikke er ment for. |

## 4. Viktigste forbedringer

### 4.1 Krav og byggehistorikk er blandet
- **Alvorlighet:** høy
- **Hvor:** FR-1 («accepted in the Epic 1 retrospective (R9, 2026-10-16)»), FR-24 («An earlier wording said …»), FR-58 (ca. 350 ord «Known limit»), FR-73
- **Problem og hvorfor det betyr noe:** Den som skal lage stories og tester må selv skille gjeldende regel fra historikk, story-henvisninger og filstier. §0 sier også at de fire håndskrevne dokumentene vinner ved uenighet, så PRD-en er ikke selvstendig. Lange avsnitt skjuler hva som faktisk skal testes.
- **Forslag:** Flytt «hvem bestemte hva og når» til `.memlog.md` eller en beslutningslogg i addendumet. La hvert FR bestå av regelen og 3–6 konsekvenser. Eksempel:
  > **FR-24: Same source for comparison · v1.** A comparison (median, favourable quartile, percentile, kroner) is shown for a key figure only if the subject and at least 10 peers have the value from the same source. *Consequences:* the subject's own value is always shown, with the reason when no comparison exists; a test with an OCR-only subject value and API-only peers yields no median, quartile, percentile or kroner.

### 4.2 V1 er stort, og to arbeidsposter har ingen eier
- **Alvorlighet:** høy
- **Hvor:** §11 Q22, FR-59 («Not yet true for `62.100`»), §5 («No story in `epics.md` owns the reading yet»), FR-70 («About 900 judgements»)
- **Problem og hvorfor det betyr noe:** FR-3 og FR-59 sier at en bransje først er dekket når den er ferdig innlest og målt. Den fulle dokumentkjøringen (ca. 190 timer) er utsatt og eies av ingen story, så v1 kan ikke oppfylle sine egne vilkår. Nøkkeltall 7 og 8 mangler inndata (`aarsverk`). Fagfellen på briefen ba om et kraftig kutt. Kontokrav og arbeidsområder er flyttet til stage 2, men v1 har fortsatt OCR-pipeline, femstegs trakt, merket sett og 15 nøkkeltall.
- **Forslag:** Avgjør Q22 nå. Skriv at v1 leveres på demodata (FR-73 støtter det) og at full kjøring er `pnpm seed:full`. Skriv om FR-3 og FR-59 slik: «`62.100` regnes som dekket i v1 for selskapene i seedet, målt mot det merkede settet.» Flytt nøkkeltall 7 og 8 til stage 2, eller merk dem som «fraværende i v1» i FR-21. Legg til en minimumsliste: hvilke FR-er må være ferdige for at SM-1, SM-2 og SM-9 kan rapporteres.

### 4.3 Noen FR-er mangler testbare konsekvenser
- **Alvorlighet:** medium
- **Hvor:** FR-36, FR-39, FR-46, FR-49, FR-50 (ingen konsekvenser), FR-11 («answers only with a fixed category»)
- **Problem og hvorfor det betyr noe:** Dette er stage 2, men de er sikkerhetsrelevante (FR-46) eller blir story-grunnlag. FR-11 sier ikke hvilke kategorier modellen svarer med, så en test kan ikke avvise et ugyldig svar.
- **Forslag:** FR-46: «Etter at eier fjerner en viewer gir neste forespørsel fra viewerens gyldige sesjon mot dette arbeidsområdet ingen rader, uten ny innlogging. Dekket av et tilfelle i autorisasjonssuiten.» FR-11: list kategoriene (f.eks. `same_type`, `different_type`, `unclear`) og legg til: «Et modellsvar utenfor settet lagres som unclassified (FR-12) og telles i en logg.»

### 4.4 KI-lagene mangler beslutningsregel og kostnadsanslag
- **Alvorlighet:** medium
- **Hvor:** §9 («No source document states a numeric target»), §11 Q11, §8 Cost («Bounded by covering one industry»)
- **Problem og hvorfor det betyr noe:** «Måle og rapportere» kan ikke feile, så ingen vet når stage 5 skal beholdes. Kostnaden til klassifiseringen er ikke tallfestet.
- **Forslag:** Sett ikke en kvalitetsgrense, men en beslutningsregel før Story 5.2: «Stage 5 beholdes bare hvis den øker presisjonen med minst X poeng over fingerprint alene, med høyst Y poeng tap i recall.» Legg til et kostnadsanslag: «ca. 1 000 selskaper × 1 kall, anslått n kr, kjøres på nytt bare ved endret prompt.»

### 4.5 Antakelsesindeksen og åpne notater er ikke i takt
- **Alvorlighet:** lav
- **Hvor:** FR-70, §10, §12, FR-16 og FR-27 (`[NOTE FOR PM]`)
- **Problem og hvorfor det betyr noe:** Noen `[ASSUMPTION]` og notater som styrer UX og stories ligger ute av syne.
- **Forslag:** Før dem inn i §12 og i §11 (se kapittel 5).

## 5. Mekaniske funn

- **FR-ID-er:** 73 FR-overskrifter, alle unike. Rekkefølgen er bevisst ikke numerisk (FR-64 til FR-72 ligger sist i sine seksjoner) og er forklart i §0. Stikkprøver av krysshenvisninger løste seg. SM-1 til SM-9 og SM-C1 til SM-C4 er sammenhengende.
- **Assumptions-indeks:** `[ASSUMPTION]` i FR-70 (hvem den andre merkeren er) og i §10 (andel `smaaForetak` per bransje) står ikke i §12.
- **Glossar:** Konsekvent bruk. Glossaret inneholder kodenavn og filstier (`pool`, `group`, `src/engine/peers.ts`) som hører hjemme i arkitekturen. «Around a dozen» i §4.3 stemmer ikke helt med «14 numbered plus cash share» i glossaret.
- **Notater:** To `[NOTE FOR PM]` (FR-16, FR-27) er ikke avklart og peker til Q24 og Story 3.1a.

## 6. Før dere går videre

**Må avklares før UX, arkitektur og epics:**
- Q22: hvem eier den fulle dokumentkjøringen og lesingen av `aarsverk`, og hva v1 leveres på (4.2).
- Q24: hvilket treffgrunnlag en peer uten forretningstype har. Det avgjør hierarkiet i grensesnittet og må på plass før Story 2.7.
- Totalkostandelens retning (FR-27), før Story 3.1a.
- Beslutningsregelen for stage 5 (4.4), før Story 5.2.

**Kan vente:** Q11 (terskler), Q23 (oppløste selskaper), Q14 og de tre kravene før offentlig drift (Q18–Q20).

**Oppfølging av briefen:** ja. Kutt til én bransje og uten konto er gjennomført, kjørbarhet uten nøkler er løst i FR-73, og analysesiden kom tidlig (Epic 1). V1 er likevel fortsatt stor (4.2).

## 7. Refleksjonsspørsmål

1. Hvilke deler av FR-58 og FR-73 kunne dere forklart og forsvart uten KI-hjelp, og hvilke står der fordi KI foreslo dem?
2. PRD-en er på 23 000 ord og endres etter hvert som koden endres. Hva er kilden til sannhet for en regel, PRD-en eller storyen, og hvordan oppdager dere at de er ute av takt?

_Vurdert mot kvalitetsrubrikken i bmad-prd. Dette er veiledning, ikke sensur._
