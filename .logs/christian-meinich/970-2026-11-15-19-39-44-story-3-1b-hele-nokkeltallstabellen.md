# Story 3.1b: hele nøkkeltallstabellen

## 2026-11-15 kl. 19:39 — Christian Meinich

### Oppgave
Bygge Story 3.1b med `bmad-build`. Fanen Nøkkeltall og gap skal vise hvert nøkkeltall fra `docs/key-figures.md`, også dokumenttallene og kronebeløpene for kapital, og hver tilstand skal ha sin tekst. Telefonmønsteret skal gjelde ved 375 og 320 px. Siden skal ikke få dokumentøre (AD-4). Økten skulle stoppe ved et sjekkpunkt (a–g) før noen kode ble endret, og ingenting skulle pushes.

### Plan
- Lage issue #68 og branchen `story/3.1b-full-key-figure-table` fra origin/main. Kompilere epic 3-konteksten på nytt.
- Kjøre tre undersøkelser: utsatt arbeid og koden, tellinger (bare totaler), og rader, tilstander og tekst. Deretter sjekkpunktet. Meinich tok beslutning 1–8: 1A, 2A, 3A og 4B, godkjente teksten og bestemte hvordan det utsatte arbeidet skulle fordeles.
- Spec: [spec-3-1b-the-full-key-figure-table.md](../../_bmad-output/implementation-artifacts/spec-3-1b-the-full-key-figure-table.md).
- En underagent implementerer. Deretter review med tre lag, rettelser, og full verifisering kjørt én ting om gangen.

### Resultat
- **Commits:**
  - spec: `952a4f6`;
  - implementasjon: `233aac3`–`9972a9a`;
  - review-rettelser: `4720b82` og `f0368d6`;
  - triage-logg: `9bf7a32`;
  - sesjonsfil og spec satt til done: `ee53628`.
- **Kode:**
  - `src/analysis/key-figure-rows.ts` er en ren visning som gir bare strenger og stripeposisjoner. Det er grensen for hva som når siden.
  - `shownGroup` benchmarker nå også dokumenttallene.
  - Tabellen har én `<tbody>` per gruppe, med radgruppen for kostnadsandelene.
  - `info-popover.tsx` er skrevet for hånd, uten ny avhengighet.
  - Teksten Meinich godkjente står ordrett i `nb.json` og EXPERIENCE.
- **Testoppsett:** et tredje oppsett som lagrer rader, `SYNTHETIC_DOCUMENTS`, med ett subjekt og ti peers. Seeden har ingen subjekt med 10 dokumentpeers; det høyeste er 6.
- **Review:** 26 funn i 24 rader. 13 ble rettet og 13 avvist, 5 av dem som feil. Triagen står i spec-en.
- **Verifisering etter rettelsene:**
  - lint og typecheck rene;
  - `pnpm test` 1 649, `test:db` 200 og `test:ingest` 392, alle bestått;
  - build grønn;
  - e2e med én worker: 168 bestått, og 0 syntetiske selskaper igjen etterpå.
- **`pnpm restore:documents`:** 2 785 dokumenter, 5 556 kolonner, 2 537 fingeravtrykk og 10 371 klassifiseringsrader.
- **Avbrutt kjøring:** første fulle kjøring ble stoppet under build fordi maskinen hadde for lite minne. Den ble kjørt på nytt steg for steg etter at Meinich ga beskjed.
- **Filer:**
  - sesjonsfil: [docs/ai-sessions/2026-11-15-story-3-1b-full-key-figure-table.md](../../docs/ai-sessions/2026-11-15-story-3-1b-full-key-figure-table.md);
  - PR-teksten ligger klar i scratchpad, men PR-en er ikke opprettet. Det er ingen push før Meinich sier fra.

### Åpne punkter
- Meinich må avgjøre om dagteksten skal ha hardt mellomrom (U+00A0) eller vanlig mellomrom foran «dager». Spørsmålet er stilt i økten og står i sesjonsfila. Svaret føres i spec-ens Spec Change Log.
- Utsatt arbeid står i `deferred-work.md`: Epic 1-retro D2 og 2.3 B9 er flyttet til Story 3.7. Fulle rader for demo A og B fra en fersk klone venter på Story 5.4.
