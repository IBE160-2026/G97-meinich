# Story 3.1a: motoren regner ut alle nøkkeltall

## 2026-11-15 kl. 16:38 — Christian Meinich

### Oppgave
Bygge Story 3.1a med `bmad-build`, og stoppe ved sjekkpunktet (a)–(h) før noen kode ble endret. Motoren skal regne ut alle nøkkeltall i `docs/key-figures.md`, også dokumenttallene, med kroner for 9, 10 og 11. Hver verdi skal kontrolleres mot håndutregnede referansetilfeller, og begge identitetene skal holde eksakt. B1–B3 skal avgjøres. Ingen push.

### Plan
- Issue #66 og branchen `story/3.1a-engine-key-figures`, laget fra `origin/main`.
- Investigere, så sjekkpunkt med målinger (bare totaler). Meinich tok vedtakene 1–6 i specen: `_bmad-output/implementation-artifacts/spec-3-1a-the-engine-computes-every-key-figure.md`.
- Implementere med en egen subagent. Deretter matrisesjekk og én gjennomgang med tre gjennomgåere, og rettinger.
- Sesjonsfil: `docs/ai-sessions/2026-11-15-story-3-1a-engine-key-figures.md`.

### Resultat
- **Commits:**
  - spec og status: `f5125af`, `f2805ea`, `54e3f14` og `87545d6`
  - motor, tester, B1–B3 og dokumentasjon: `875b4cd` til `587fa86`
  - rettinger etter gjennomgangen: `dbc5140`
  - sesjonsfil og AI-logg: `e03aedd`
- **Vedtak 1:** 1 962 av 2 614 avstemte løpende kolonner får alle fem kostnadslinjene.
- **B2:** de to kildene for `sum_omloepsmidler` skilte seg i 0 av 2 778 kolonner. **B1 og B3:** 0 fingeravtrykk endret.
- **Matrisesjekken:** R3-raden var feil for figur 11. Meinich rettet den, og loggen står under Spec Change Log.
- **Gjennomgang 1:** 17 funn. 7 er rettet (det ene, AI-loggen, i `e03aedd`), og 10 er avvist med begrunnelse i Review Triage Log.
- **Suiten er grønn:**
  - `pnpm test`: 1 597
  - `test:db`: 199
  - `test:ingest`: 392
  - e2e med én worker: 159
  - lint, typecheck, build og `check:routes` uten feil
  - seed lastet to ganger og eksport uendret
- **Etter siste `pnpm restore:documents`:** dokumenter 2785, kolonner 5556, fingeravtrykk 2537, klassifiseringsrader 10371.
- **PR-utkast,** med håndutregningene og «Planning documents:»: `C:\Users\cmein\AppData\Local\Temp\claude\C--Dev-ibe160\ee99dd4a-b441-4f8c-aa59-c6b24db6d998\scratchpad\pr-3.1a.md`.
- **Status:** specen står på `in-review` og saken på `review`. Ikke pushet, og PR-en er ikke opprettet.

### Åpne punkter
Ingen.
