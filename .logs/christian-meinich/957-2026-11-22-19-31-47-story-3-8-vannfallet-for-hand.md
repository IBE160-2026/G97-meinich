# Story 3.8: Vannfallet kan regnes ut for hånd

## 2026-11-22 kl. 19:31 — Christian Meinich

### Oppgave
Bygge Story 3.8 med `/bmad-build`: hver kolonne i marginvannfallet skal kunne regnes ut for hånd fra det siden viser, uten at noe når en peers dokumentlinje. Arbeidsflyten stoppet ved sjekkpunktet med punkt (a)–(j), før koden ble endret.

### Plan
- Branch `story/3.8-vannfallet-for-hand` fra origin/main, og issue #83.
- Sjekkpunkt med utsatt arbeid, beløp, en lekkasjeanalyse av ekskl og båndbytte (totaler for demo A, porten åpnet i minnet), formel, data, tester, UI og ny tekst.
- Spec: `_bmad-output/implementation-artifacts/spec-3-8-vannfallet-kan-regnes-ut-for-hand.md`, frosset med beslutning 1–7 (Meinich).
- Implementeringssubagent, review med tre lag, rettelser, og verifisering i deler.
- Sesjonsfil: `docs/ai-sessions/2026-11-22-story-3-8-waterfall-by-hand.md`.

### Resultat
- **Commits** på branchen fra `2896911` (spec) til `1845fc6` (verifisering og sesjonsfil):
  - implementeringen `d00183e`–`a84e1d4`;
  - triagen `fbf25e3`;
  - review-rettelsene `5291526`;
  - Meinichs tekst og avgrensningen av peer 5 `adfbf04`.
- **Hva som er bygd:**
  - drill-down på start, de fire søylene, «Sum av postene» og slutt;
  - Aₓ × R registrert som `explanation`;
  - datakvalitetslinjen «Kontrollert mot registerets nøkkeltall»;
  - antall utenfor P per grunn, og innlesingsdato for P;
  - nye payload-sjekker med prober;
  - et uavhengig orakel i `e2e/synthetic.ts`.
- **Premisset om demo A rettet:** demo A er 813235552 og står ikke på manifestet. 885583822 er VISIONTECH AS. Ingen av de 20 manifestselskapene har vannfall, fordi peerene ikke står på manifestet.
- **Review:** 15 rader. Fem er rettet, B5 og B6 avgjort av Meinich, resten avvist med begrunnelse.
- **Verifisering:**
  - lint og typecheck er rene, og `pnpm test --maxWorkers=2` har 2 086 bestått;
  - build feilet én gang (passer med #71) og gikk igjennom på andre forsøk;
  - `check:routes` er uendret;
  - e2e: chromium 197, db-down 7, synthetic 31;
  - `notFound.coverageFailed` kommer fra 3101, og 3100 logget den 0 ganger;
  - restore: 2 785 / 5 556 / 2 537 / 10 371, 0 SYNTETISK% og 20 i manifestet.
- **Status:** spec `in-review`, story `review`.
- **Datogrensen:** Meinich bekreftet den (B4 akseptert, `1bf8e3f`).
- **PR:** branchen er pushet, og PR #84 er opprettet: https://github.com/IBE160-2026/G97-meinich/pull/84

### Åpne punkter
- Spec-en settes til `done` etter at PR #84 er merget, som i 3.7.
