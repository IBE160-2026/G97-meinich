# Story 2.5b: kostnadslinjene og delene av immaterielle eiendeler

## 2026-11-05 kl. 22:10 — Christian Meinich

### Oppgave
Les kostnadslinjene som kommer ut tomme, og de fire delene av immaterielle eiendeler, med en probe før noe rettes. Mål før og etter på referansesettet uten å betale med nye feillesninger. D1 er låst. Ingen fingeravtrykk for orgnr i fasitsettet. Omlesing og dokumentkjøring bare etter eget ja.

### Plan
- Spec: `_bmad-output/implementation-artifacts/spec-2-5b-read-the-cost-lines-and-intangible-parts.md`. Beslutningene står i Spec Change Log: C1–C3 ved godkjenning, F1–F3 ved probe-sjekkpunktet, «Utvikling» og blank rad, og stopp etter tre tidsgrenser.
- Rekkefølge: story og issue, før-tall, avskriftsmal, tidsgrense, probe, sjekkpunkt, retting, migrasjon, rapportkode, review.

### Resultat
- Issue [#45](https://github.com/IBE160-2026/G97-meinich/issues/45), gren `story/2.5b-read-cost-lines` (ikke pushet). `origin/main` er hentet inn (`7174937`).
- Tidsgrense per dokument (`6978bde`). Stopp etter tre utløp på rad, med run-record og test for at prosessen avslutter (`89f45f7`, `19b541b`).
- Probe: `analysis/output/empty-lines-probe.md` (`bb9d4f4`). Årsaker: nektede tall-tokens («l» for 1), avskrivning med annen ordlyd, notehenvisninger lest som «ll», flertallsformer. `Ö` for 0 rettes ikke.
- F1–F3 og «Utvikling» (`281f134`, `8c85ca8`, `bd94b80`). Ingen av de 1 486 gamle treffene endret seg på de 40 dokumentene.
- Migrasjon `20261105120000_document_intangible_parts.sql`, lagt inn med `migration up`. 2.1b-radene er beholdt.
- Rapportkoden for «Before and after Story 2.5b» er skrevet, men ikke generert.
- Avskriftskontroll av to celler uten rettelse (`3d32823`).
- Review pass 1: 19 funn, triage i spec-en (`6cb94c7`). Rettet i `901f859`, `60b5af3`, `26c074d`, `e652570` og `b496b30`. Ett funn utsatt i `deferred-work.md`.
- Tester:
  - lint og typecheck: OK;
  - `pnpm test`: 956/958;
  - `pnpm test:db`: 15/16 filer;
  - `pnpm test:ingest`: 296.
  - De tre feilene er forventet frem til C2: seed-manifestet og den committede SM-2-rapporten.
- Sesjonsfil: `docs/ai-sessions/2026-11-05-story-2-5b-read-the-cost-lines.md`.

### Åpne punkter
- C2, akseptansekjøringen i ni steg, venter på ja fra Meinich. Etter den kommer etter-målingen, seed-eksporten og PR-en med linjen «Planning documents:». Steget er sporet i spec-ens Tasks og i issue #45.
- Utsatt kodearbeid står i `deferred-work.md` (Story 2.5b-oppføringen om spørringene i `document-run-counts.ts`).

## 2026-11-06 kl. 11:12 — Christian Meinich

### Oppgave
Fullføre akseptansekjøringen (C2) etter Meinichs ja. Først undersøke 21-millionersfunnet, så ta ny dump og kjøre steg 4–9. Skrive rapporten og PR-utkastet. Ingen push.

### Plan
- Sjekke run.step1, reader_commit og derive. Telle med `pnpm analysis:document-run after-2.5b` og kontrollere tallene med psql.
- Undersøke én PDF med leseren i step 1-imaget. Rettingen legges i `deferred-work.md`, og `ingest/` endres ikke.
- Steg 3–9 som i spec-en.

### Resultat
- **Kjøringene:**
  - run 650: referansesettet, 97 dokumenter;
  - run 651: 2.1b, 1 947 dokumenter.
  - Begge kjøringene endte uten at noe ble stående uerstattet, uten tapte tall og uten feil.
- **Årsak til 21 mill:** i fjorårskolonnen leser Tesseract «2» i «2 375 956» (avskrivninger) som «23», i begge passene. Rettingen er utsatt i `deferred-work.md` (`3d1a03d`).
  - De 17 innværende kolonnene som summerer under totalen har fått fingeravtrykk.
  - Kolonnene over totalen hoppes over av derive.
- **Ny dump:**
  - `.local/document-run-2.5b/`: 1 947 dokumenter og 3 892 kolonner. Den er kilden for gjenoppretting, og README er oppdatert (`970d572`).
  - `.local/document-tables-after-2.5b-reread/`: full kopi med 2 044 dokumenter, 4 086 kolonner og 1 865 fingeravtrykk.
  - Begge er kopiert til `peerless-backups`, og sha256 er lik.
- **Steg 4–9:**
  - slettingen var én kontrollert transaksjon (97/194);
  - derive ga 86 fingeravtrykk;
  - `seed:export` er committet i `9b82409`;
  - seeden er lastet to ganger, uten diff ved ny eksport;
  - etter gjenopprettingen er det 2 044 dokumenter og 4 086 kolonner, og derive ga 1 865 fingeravtrykk, like dumpen etter `input_digest`.
- **Rapporten:** SM-2 er generert (`a696c6a`), med funnet. 2.1b-tellingen etter omlesingen er i `bb10497`.
- **Seed-testen** er oppdatert til 86 fingeravtrykk (`27a9743`).
- **Spec og sesjonsfil** er oppdatert.
- **Tester:**
  - `pnpm test`: 958/958;
  - `pnpm test:db`: 167/167;
  - `pnpm test:ingest`: 296;
  - lint og typecheck: OK.
- PR-utkastet ligger i scratchpad og er ikke pushet.

### Åpne punkter
- PR, GitHub-review og merge venter på Meinich.
- Rettingen av «2» lest som «23» står i `deferred-work.md` (Story 2.5b, oppføringen «Tesseract reads one printed digit as two»). Den må også inn som story i `epics.md` eller som åpent spørsmål i PRD-en. Det avgjør Meinich.
