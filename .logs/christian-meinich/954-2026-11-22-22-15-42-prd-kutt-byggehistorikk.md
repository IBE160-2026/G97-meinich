# PRD-kutt av byggehistorikk, del tre

## 2026-11-22 kl. 22:15 — Christian Meinich

### Oppgave
Kutte de 13 gjenværende FR-ene med byggehistorikk ned til regel og konsekvenser før spec-en for Story 5.4 skrives. Det er handlingspunkt 11 fra Epic 2 og handlingspunkt 3 fra Epic 3. Ingen måletall skulle slettes uten å stå et annet sted, og regelen i hver FR skulle stå uendret.

### Plan
- Måletallene flyttes først, i en egen commit (til §10 eller det tekniske notatet). Deretter kuttes FR-en, med historikken i memloggen.
- `numcheck.py` (i scratchpad) sjekker hvert tall som forsvinner. Utskriften vises før hver commit.
- Rekkefølge: FR-10, deretter FR-11, FR-13 og FR-28, deretter de ni små. Session-fil: `docs/ai-sessions/2026-11-22-prd-build-history-cut.md`.

### Resultat
- Flyttet: `95bccc4`, `e266990` og `90b2ab3` (§10 og det tekniske notatet). Målingen fra 2.3b ble stående i §10.
- Kuttet:
  - FR-10, FR-11, FR-13 og FR-28: `259c2b8`, `84ae67a`, `6618b6f` og `f62aa4f`;
  - memlogg-retting: `2b6eaec`;
  - FR-66, FR-4, FR-6, FR-8, FR-16, FR-56, FR-57, FR-65 og FR-70: `7c4b7c6` … `b27d8c4`.
- Notatet i FR-6 er nå §11 spørsmål 27, uendret og ubesvart. epics.md:41: `225f998`.
- `numcheck` ga `MISSING: 0` på hvert steg og over hele jobben (23 tall).
- Handlingspunktene er satt til `done` i sprint-status (item-15) og i Epic 3-retroen: `388d374`. Session-fila: `f21a7f3`.
- Ingen kode er endret. Ikke pushet, fordi review-sesjonen pusher og skriver promptloggen.

### Åpne punkter
Ingen.
