# Story 2.5c: siffer lest som to, og kostnadslinjer som ikke summerer

## 2026-11-07 kl. 11:24 — Christian Meinich

### Oppgave
Bygge Story 2.5c (issue #47) gjennom bmad-build: en probe først, så R1–R4 i kode og tester, omlesingen med de ni stegene fra 2.5b, og PR mot main. Story 2.5d (fasitsettets dokumentkjøring med lokal OCR-hurtigbuffer) ble lagt inn i planen underveis.

### Plan
- Probe, read-only (`analysis/output/cost-sum-probe.md`), og stopp ved sjekkpunktet. Spec: `_bmad-output/implementation-artifacts/spec-2-5c-refuse-a-digit-read-as-two.md`.
- R1 og R4 i step 1, R2 og R3 i `src/engine`, tellinger og SM-2-seksjon, review i spec-en (triage-logg med 20 rader).
- Omlesingen etter eget ja. Meinich kjørte steg 2 selv, sesjonen tok steg 1 og 3–9.
- Sesjonsfil: `docs/ai-sessions/2026-11-06-story-2-5c-refuse-a-digit-read-as-two.md`.

### Resultat
- PR [#48](https://github.com/IBE160-2026/G97-meinich/pull/48) er åpnet og branchen `story/2.5c-refuse-digit-read-as-two` er pushet (siste arbeidscommit `5f3d91e`).
- Omlesingen: referansesettet tok 38 min 20 s og 2.1b-radene 11 t 31 min 37 s. Ingen dokumenter ble stående uerstattet, ingen feil, og alle 2 044 dokumenter har reader commit `b57aaba`.
- Steg 3–9:
  - Ny dump i `.local/document-run-2.5c/`, med kopi i `C:\Users\cmein\peerless-backups\` og lik sha256. Den er nå gjenopprettingskilden (README «Seed», `46ae913`).
  - Seed-eksporten er `29bf5fc`.
  - Derive etter steg 9 ga 1 856 fingeravtrykk.
  - Ingen dump er slettet.
- Story 2.5d er lagt inn i `epics.md` (`6ee327b`). Tesseract-innstillingene er med i nøkkelen.
- R4-funnet fra review-sesjonen er nå en telling med test (`02163fa`) og vises i SM-2-rapporten (`105dbb7`): 1.
- Review-sesjonen fant at meldingen i `29bf5fc` nevner feil felt. Spec og sesjonsfil er rettet i `40e8bf4`, og PR-teksten sier fra om det. Selve commit-meldingen er ikke skrevet om.
- Tester: `pnpm test` 982, `test:db` 167, `test:ingest` 304, typecheck, build og `check:routes` er grønne. e2e lokalt ga 7 feil. Antatt årsak, som CI skal bekrefte: e2e regner forventningene ut fra seed-filene, mens den lokale databasen også har 2.1b-fingeravtrykkene.

### Åpne punkter
- e2e-antakelsen avgjøres av CI på PR #48.
- Human review med linjekommentarer, og merge etter grønn CI.
- `pnpm lint` lint-er `.local/wt-5.1/` (et worktree for en annen branch) og feiler der.
- Timeout i seed-testen etter FK-feilen i `copyIn`: ført i `_bmad-output/implementation-artifacts/deferred-work.md`.
