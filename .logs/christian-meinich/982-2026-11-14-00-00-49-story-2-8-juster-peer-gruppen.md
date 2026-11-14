# Story 2.8: juster peer-gruppen

## 2026-11-14 kl. 00:00 — Christian Meinich

### Oppgave
Bygge Story 2.8 med `bmad-build`: ekskluder og ta med igjen en peer, utvid størrelsesintervallet og tilbakestill. Hver endring er en myk navigasjon til en URL fra `serialize`, rendret på serveren, og ingenting lagres. Stopp ved sjekkpunktet før kode, med (a)–(f) besvart, og ingen push før Meinich sier fra.

### Plan
- Gren `story/2.8-adjust-peer-group` fra origin/main (042fbe1) og issue [#58](https://github.com/IBE160-2026/G97-meinich/issues/58).
- Måle før sjekkpunktet, mot `next start`:
  - En DB-feil under myk navigasjon gir 200 med feilen i RSC-payloaden. 429 gir full sidelasting.
  - En endring kostet 3 forespørsler (prefetch av fanene), en lasting 7.
- Spec: `_bmad-output/implementation-artifacts/spec-2-8-adjust-the-peer-group.md`. Beslutningene fra sjekkpunktet står i den låste delen: AD-4, prefetch av, 429-unntaket, teksten, og at `error.tsx` bare går tilbake når en endring venter.
- Implementasjon ved subagent, review med tre review-subagenter, så rettelser.
- Sesjonsfil: `docs/ai-sessions/2026-11-13-story-2-8-adjust-the-peer-group.md`.

### Resultat
- **Commits:**
  - `ebf0792`: spec og epic-kontekst.
  - `b3f7689`–`95f5343`: implementasjonen.
  - `c2e57cb`: review-rettelser i kode og tester.
  - `1c1eadd`: entallstekst som godkjent, «1 sammenlignbar».
  - `d7e08d1`: docs.
- **Funnet av BMAD-økten:**
  - Båndvelgeren viste feil steg etter tilbakestilling og Tilbake, fordi komponenten overlever spørrestreng-navigasjon.
  - Subagenten hadde skrevet om godkjent entallstekst.
- **Review:** 20 funn er triagert i spec-en. Rettet:
  - en endring som kunne bli hengende i lufta,
  - en utestet gren i feilgrensen,
  - fokus,
  - feilvarselet,
  - payload-skanningen med ekskl og bånd,
  - tom gruppe,
  - en testhjelper som svelget feil.
- **Kjøringer** mot committed seed: pins, env, lint, typecheck, test (1 217), test:db (191), build og check:routes er grønne. test:ingest ble 390/391; den ene var en Windows-tempfil-flake, som er grønn ved ny kjøring.
- **Tidsmåling:** sammenstilling 87–145 ms; klikk til ferdig rendret 406–511 ms (median).
- **Lokale data:** dumper i `.local/before-2.8-suite/` og `.local/before-2.8-review/`, begge like `.local/document-run-2.5d/`. Ingen dump er slettet, og `pnpm classify` er ikke kjørt.

### Åpne punkter
- Ekskludering nr. 21 er utsatt av Meinich i `_bmad-output/implementation-artifacts/deferred-work.md` (siste oppføring): knappen deaktiveres ved `MAX_EKSKL`, med egen tekst.

## 2026-11-14 kl. 00:30 — Christian Meinich

### Oppgave
Meinichs svar etter oppsummeringen:
- Entall skal være «1 sammenlignbart», som review-sesjonen påpekte.
- Ekskludering nr. 21 skal utsettes, ikke avvises.
- Full e2e med `--workers=1`, så gjenoppretting av dumpen.

### Plan
- Rette de seks strengene, testen og EXPERIENCE, med en oppføring i spec change log.
- Flytte funn 18 til utsatt i triage-loggen, `deferred-work.md` og sesjonsfila.
- Bygge, kjøre e2e, gjenopprette `.local/document-run-2.5d/` og kjøre `pnpm derive`.

### Resultat
- Review-fix-commit `eb38d33`.
- Full e2e: 145/145 grønne (4,1 min).
- Tidsmåling, median fra klikk til ferdig: 380–523 ms.
- Dumpen er gjenopprettet og `pnpm derive` kjørt: 2 785 dokumenter, 5 556 kolonner, 2 537 fingeravtrykk og 10 371 klassifiseringsrader. Radene er identiske med dumpen. Ingen dump er slettet.
- Den første delen av økten står over; sesjonsfila er oppdatert.

### Åpne punkter
- Ekskludering nr. 21 (`deferred-work.md`, siste oppføring), som over.
