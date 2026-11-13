# Story 2.5d: fasitsettets dokumentkjøring og OCR-hurtigbufferen

## 2026-11-07 kl. 23:14 — Christian Meinich

### Oppgave
Bygge Story 2.5d (issue #49, PR #50): en lokal hurtigbuffer for OCR-ordene, bevist på referansesettet med to omlesinger, og deretter dokumentkjøringen for fasitsettet (2025), med dump, seed-eksport og bare totaler.

### Plan
- Spec: `_bmad-output/implementation-artifacts/spec-2-5d-labelled-set-document-run-and-ocr-word-cache.md`.
- Sesjonsfil: `docs/ai-sessions/2026-11-07-story-2-5d-ocr-word-cache.md`.
- Hurtigbuffer og tester, så beviset (to kjøringer), så fasitsettet, så 2.5c-stegene 3–9.

### Resultat
- Første bevis (run 1242/1243) feilet med 0 treff: data.brreg.no skriver ny tilfeldig `/ID` ved hver henting (funnet av review-sesjonen). Rettet ved å nøkle på PDF-en med `/ID` fast (`df34a2d`, `f8e0d1e`), dokumentert som API-felle.
- Andre bevis bestått: run 1410 (OCR, 0 treff) og 1411 (97 treff, 0 bom); begge sjekker exit 0.
- Dump før fasitsettet: `.local/document-tables-before-2.5d-labelled-set/` med backup og lik sha256; `before-2.5d`-tellingene (`90175c9`).
- Fasitsettet, run 1412: 845 listet, 741 lest (690 avstemt, 45 ikke, 6 ikke lest ut), 0 feilet; dokumenter 2 044 → 2 785, fingeravtrykk 1 856 → 2 537.
- Etterpå: `after-2.5d` (`ee35396`), ny dump `.local/document-run-2.5d/` + fulle tabeller med backup, README «Seed» (`a1edd4c`), kontrollert sletting, derive, seed-eksport (`eadadab`: bare `reader_commit`/`read_at` for de 97 referansedokumentene, ingen rader fra fasitsettet), to lastinger uendret, gjenoppretting og derive (nøyaktig dumpens 2 537 fingeravtrykk).
- Spec, sesjonsfil og PR oppdatert med totaler (`b4b5ee7`, `baec193`).
- Testsuite: pnpm test 1021, test:db 169 grønne; test:ingest 370/3 lokalt (se åpne punkter). CI grønn på `cc2446a`.

### Åpne punkter
- Tre step-1-tester feiler på en lokal database med fasitsettets rader; utsatt, ført i `_bmad-output/implementation-artifacts/deferred-work.md` (siste oppføring).
- Review av PR #50 (utkast fra review-sesjonen), og `docs/ai-prompts.md` etter merge.
