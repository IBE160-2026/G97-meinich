# Story 2.9: manglende tall sier hvorfor

## 2026-11-14 kl. 11:12 — Christian Meinich

### Oppgave
Bygge Story 2.9 med bmad-build: hvert manglende tall får én fraværsgrunn fra motoren, vist gjennom én uttømmende switch, og overskriften får en slate undertittel når subjektets eget dokument ikke kan brukes. Sjekkpunkt før kode, ingen push.

### Plan
- Branch `story/2.9-missing-figures-reasons` fra origin/main, issue [#60](https://github.com/IBE160-2026/G97-meinich/issues/60).
- Spec: `_bmad-output/implementation-artifacts/spec-2-9-missing-figures-say-why.md` (beslutning 1–7, I/O-matrise, endringslogg, triagelogg).
- Sjekkpunkt i tre runder: seks åpne spørsmål, så årsaken til manglende rad (avvikende regnskapsår, filing year 2026 utenfor `DOCUMENT_YEARS`), så tekst og e2e-krav.
- Implementering ved subagent, tre review-lag, rettelser i egen commit, hele suiten, dump og derive.
- Sesjonsfil: `docs/ai-sessions/2026-11-14-story-2-9-missing-figures-say-why.md`.

### Resultat
- Commits `dec1b33` (spec), `3b524e7`–`27022ad` (motor, tekst, switch, steg 1-test, forespørselsvei og undertittel, syntetisk e2e, dokumenter), `c5a6a72` (review-rettelser), `d68a47e` (triage, sesjonsfil, AI-logg).
- Åtte fraværsgrunner; `document_missing` er eneste grunn som avgjøres av en manglende rad og logges én gang per lesing. Syntetisk e2e-selskap «SYNTETISK TESTSELSKAP AS» (999999905) skrives som eier, bare mot lokal vert, ryddes i global setup og før og etter.
- Review: 21 funn, 14 rettet, 7 avvist (spec-ens triagelogg). `SUPABASE_DB_URL` beholdt etter Meinichs beslutning.
- Hele suiten på committet seed: pins, env, lint, typecheck, `pnpm test` 1 271, `seed:export` uendret, `test:db` 193, `test:ingest` 392, build, check:routes, `test:e2e --workers=1` 150 (inkl. 375 og 320 px).
- `.local/document-run-2.5d/` gjenopprettet og `pnpm derive` kjørt: 2 785 dokumenter, 5 556 kolonner, 2 537 fingeravtrykk, 10 371 klassifiseringsrader. Ingen dump slettet, `pnpm classify` ikke kjørt.
- Planleggingsdokumenter oppdatert: teknisk notat AD-15/AD-16, `epics.md` 2.9 og 3.1a, PRD FR-23/FR-71 med `.memlog.md`, EXPERIENCE, `docs/key-figures.md`, AGENTS.md, README.

### Åpne punkter
Ingen.
