# Story 4.1: forklaringer i batch

## 2026-11-27 kl. 17:49 — Christian Meinich

### Oppgave
Rebase Story 4.1 på main etter PR #90, få specen godkjent og bygge `pnpm explain` (testmodus, `--plan`, utvalg, `--max-usd`). Deretter én prøvekjøring på 20 selskaper etter at Meinich sa ja til taket ($0,0065).

### Plan
- Rebase på `8df1e63`, løse konflikten i `deferred-work.md` og rette specen etter review-sesjonens lesing av `b609ce0`.
- Implementering i en subagent fra specen. Diffen leses mot specen.
- Prisen leses på nytt, `PRICE_DATE` får en egen commit, så kommer prøvekjøringen og rapporten.
- Spec: `_bmad-output/implementation-artifacts/spec-4-1-explanations-generated-in-batch.md`. Sesjonsfil: `docs/ai-sessions/2026-11-27-story-4-1-explanations-batch.md`.

### Resultat
- **Commits på `story/4.1-explanations-batch`** (ikke pushet):
  - spec: `323c249`, `b609ce0`, `0dde614`, `d36db6c`, `1361539`;
  - kode og dokumentasjon: `5993045`, `d06c90a`, `4224031`, `f0fc9a0`, `7ac5672`;
  - prisdato: `6cbdcc9`;
  - rapporter: `9df12c3`, `7f47723`, `05ba380`;
  - ordlyd: `0f0a279`, `2cb42f3`, pluss en kommentar i `scripts/explain.ts`;
  - review-retting: `06a7739`.
- **Prøvekjøring 181:** 13 forklart, 7 avvist, alle for årstall eller antall skrevet med sifre. $0,0019.
- **Ordlyden ble rettet:** payloaden sier én gang hva hvert felt betyr, uten sifre, og hvert nøkkeltall har `better`. Prompten fikk regler for `{{aar}}`/`{{antall}}`, beste, gap og retning. En prøvekjøring skriver nå ut de avviste tekstene.
- **Prøvekjøring 185**, med de samme 20 og et tak på $0,0077:
  - 20 forklart, 0 avvist, $0,0027;
  - de tre feilene fra 181 er borte;
  - teksten med kapitalgap er lagret og holder de fire reglene.
- **Tester etter rettingen:** lint, typecheck, unit (2 190), pins og env er grønne. I `test:db` ble seed-testen rettet. `derive.test.ts` feiler bare mens 5.4-dumpen er lagt tilbake, slik rekkefølgen i AGENTS.md forventer.
- **Rapporten** står i `docs/ai-sessions/2026-11-27-story-4-1-explanations-batch.md`. PR-utkastet ligger i scratchpad.

### Åpne punkter
- **Nye feil i ordlyden etter kjøring 185, til beslutning hos Meinich:**
  - «bedre enn bedre enn» i 12 av 20 tekster, fordi plasseringsteksten allerede begynner med «bedre enn»;
  - én tekst delvis på engelsk;
  - mindre feil, som «1 sammenlignbare selskap».
- **Kapitalgap-formuleringen er prøvd på bare én lagret tekst.** Utsatt til Story 4.3 i `_bmad-output/implementation-artifacts/deferred-work.md`.
- **`antall`-sloten og antallet i sideheaderen skrives uten `format.ts`.** Utsatt til Story 4.2 i `deferred-work.md`.
