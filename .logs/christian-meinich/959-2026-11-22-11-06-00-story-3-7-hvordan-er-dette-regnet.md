# Story 3.7 «Hvordan er dette regnet?»

## 2026-11-22 kl. 11:06 — Christian Meinich

### Oppgave
Bygg Story 3.7 med `bmad-build` (issue #81): en drill-down «Hvordan er dette regnet?» på hvert kronebeløp med formel, nøkkeltall og beste fjerdedel, innsendte verdier med navn og dato, kilde og en datakvalitetslinje avgjort fra lagret status, og D2 (benchmark-filingen valgt i motoren). Ingen push før Meinich sier fra.

### Plan
- Sjekkpunkt (a)–(k), spec med beslutning 1–11 og I/O-matrise: `_bmad-output/implementation-artifacts/spec-3-7-hvordan-er-dette-regnet.md`.
- Implementering ved en underagent med spec-en som eneste kilde, små commits.
- Steg 3: hele diffen lest mot oppgavene og matrisen, hull lukket.
- Review pass 1 med tre uavhengige reviewere, triagen i spec-en.
- Full verifisering i deler, deretter session-fil, AI-logg og denne loggen.

### Resultat
- Commits på `story/3.7-provenance` fra `cd50547` til `0ec577e`, ikke pushet. Spec `in-review`, story `review` i sprint-status.
- Steg 3: ni steder der testen valgte forventet verdi med en betingelse er rettet, og ett til fra Story 3.4 (`9e0f97e`). Vernene for e2e-radene er fjernet og vist feilende; et overflødig CSS-vern er slettet, og en test for det lengste feltnavnet ved 320 px er lagt til.
- Beslutning 4 er splittet (foreslått av review-sesjonen, avgjort av Meinich): «Ikke avstemt – {felt} kunne ikke leses i regnskapet for {aar}» når ingenting var forskjellig. Det står i Spec Change Log, PRD FR-71, EXPERIENCE og epics.
- `tmp-shot.mjs` er fjernet fra historikken ved å skrive om `87f0796`, uten å slå sammen commits; alle commit-meldinger er uendret.
- Review pass 1: 21 funn, seks patchet. B1 («Avstemt» bare mot filingen siden viser) ble først avvist, så overstyrt av review-sesjonen og avgjort av Meinich (`93bcd94`). Avvisningen av payload-veksten står, med målte tall (gzip-vekst på Verdi er 16 473 byte).
- D2-sammenligningen i `test/db` fikk egen tidsgrense (`0a3ae5f`).
- Verifisering 2026-11-22 i deler:
  - lint og typecheck er rene;
  - `pnpm test --maxWorkers=2` ga 2 035 bestått;
  - `pnpm seed` to ganger og `seed:export` er uendret;
  - `test:db` 204 og `test:ingest` 392 bestått;
  - `pnpm build` stoppet én gang med `SecurityFatalError` og gikk på nytt forsøk (#71);
  - `check:routes` er uendret;
  - e2e chromium 197, db-down 7 og synthetic 28 bestått;
  - `restore:documents` ga 2 785 / 5 556 / 2 537 / 10 371;
  - 0 SYNTETISK-selskaper og 20 oppføringer i manifestet.

  En tidligere samlet kjøring ble stoppet av lite minne og ikke startet på nytt.
- Session-fil: `docs/ai-sessions/2026-11-20-story-3-7-provenance.md`. AI-logg: fire Story 3.7-oppføringer i `docs/ai-log.md`.

### Åpne punkter
- Ingen nye. Utsatt arbeid står i `_bmad-output/implementation-artifacts/deferred-work.md`: vannfallet eies av Story 3.8 (backlog).
