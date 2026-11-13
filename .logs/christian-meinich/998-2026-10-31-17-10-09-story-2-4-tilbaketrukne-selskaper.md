# Story 2.4: tilbaketrukne selskaper forsvinner

## 2026-10-31 kl. 17:10 — Christian Meinich

### Oppgave
Bygge Story 2.4 (FR-66) med `/bmad-build`. Steg 1 skal slette et lagret selskap når registeret svarer `410 Gone`, og hver kjøring skal få en kjøringspost i `run.step1`. Deretter skulle live-kjøringen og seed-eksporten (steg a–e) kjøres, og saken og PR-en opprettes.

### Plan
- Spesifikasjonen ligger i `_bmad-output/implementation-artifacts/spec-2-4-withdrawn-companies-disappear.md`, med beslutningene D1–D6 og Q4a/Q5a/Q6.
- Først implementasjon og review, så live-kjøringen (a: dump, b: `pnpm ingest`, c: tabell over slettede selskaper, d: ny dump), så steg e: seed-eksport, to lastinger og gjenoppretting.
- Sesjonsfil: [`docs/ai-sessions/2026-10-30-story-2-4-withdrawn-companies.md`](../../docs/ai-sessions/2026-10-30-story-2-4-withdrawn-companies.md).

### Resultat
- **Live-kjøringen:** kjøringspost 229, exit 0. 56 lagrede selskaper manglet i bulkfila. 48 av dem er avviklet og ble beholdt med `slettedato`. 8 svarte 410 og ble slettet; alle er konkurs- eller tvangsavviklingsbo, og ingen hadde dokumenter. Det var 0 feil.
- **Avbrutt prosess:** Claude Code stoppet `pnpm`-prosessen på grunn av lite minne, men containeren kjørte ferdig.
- **Ny dump:** `.local/document-run-2.4/` med kopi i `peerless-backups`, sha256-kontrollert. Den er nå gjenopprettingskilden (README, `2196482`). 823633882/2025 ble omlevert under en ny id (7242006), og dokumentet fulgte med.
- **Steg e:**
  - Seed-eksporten ble committet som `40295b5`. `pnpm seed` kjørte to ganger, og eksporten var uendret.
  - Gjenopprettingen ga 1 947 + 97 dokumenter og 3 892 + 194 kolonner, bekreftet.
  - Seed-testene ble oppdatert (`a649010`). `seed/document-run.json` har nå 412 orgnr, med 5 nye uten leste dokumenter (`f21cdc6`).
- **Tester:** `pnpm test` 816/816, `test:db` 147/147 og `test:ingest` 264.
- **Kreditering:** rettet i sesjonsfila (`6df9e52`). Review-lagene var subagenter i denne sesjonen; review-sesjonen bidro med D5, D6, dumpene og Q6-tillegget.
- **GitHub:** sak [#41](https://github.com/IBE160-2026/G97-meinich/issues/41) og PR [#42](https://github.com/IBE160-2026/G97-meinich/pull/42), pushet.

### Åpne punkter
- Din GitHub-review med linjekommentarer på PR #42, og merge når CI er grønn. Etter merge settes spesifikasjonen til `done`, og review-sesjonen fører promptene inn i `docs/ai-prompts.md`.
- De utsatte punktene ligger i `_bmad-output/implementation-artifacts/deferred-work.md`, i Story 2.4-oppføringene:
  - `pnpm seed` skriver ikke ut kjøringsposten;
  - avviklede selskaper i peer-utvalget;
  - en `slettedato` som står igjen når selskapet kommer tilbake;
  - en drept kjøring etterlater posten åpen.
- Omleveringen av 823633882/2025 hører til den eksisterende omleveringsoppføringen i `deferred-work.md`.
- De 5 nye selskapene i `seed/document-run.json` har ingen leste dokumenter.
