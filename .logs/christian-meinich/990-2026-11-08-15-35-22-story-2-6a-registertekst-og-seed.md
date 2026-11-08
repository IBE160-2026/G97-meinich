# Story 2.6a: registerteksten klassifiseringen leser

## 2026-11-08 kl. 15:35 — Christian Meinich

### Oppgave
Skille ut Story 2.6a fra 2.6: lagre `aktivitet` og `vedtektsfestet_formaal` for AS, re-eksportere seeden etter `--companies-only` (run 1708) og åpne PR uten å merge. Ingen modellkall.

### Plan
- Migrasjon, parser og én skrivevei, med AS-regelen og telling i `run.step1`.
- Rette de tre utsatte testene i `test_documents_run.py`.
- Steg 3–9 fra 2.5c etter Christians kjøring, med `company.csv` lest kolonne for kolonne.
- Spec: `_bmad-output/implementation-artifacts/spec-2-6a-company-text-fields.md`. Sesjonsfil: `docs/ai-sessions/2026-11-08-story-2-6a-company-text-fields.md`.

### Resultat
- PR [#53](https://github.com/IBE160-2026/G97-meinich/pull/53) er åpen og ikke merget, issue #52. Seeden ligger alene i `c6d990e`, testretting i `c023e7c`, AS-regelen i `ab27ed0`.
- `company.csv`: to nye kolonner (10 327 AS, 0 andre former), `search_fields_read_at` på 17 802 rader, 28 kommuner, 28 tømte beskrivelser. Ingenting annet endret.
- Backup med lik sha256 i `.local/document-tables-before-2.6a-seed/` og `peerless-backups`. Etter gjenoppretting: 2 785 dokumenter, 5 556 kolonner, 2 537 fingeravtrykk, 10 327 AS med tekst, alle seks tabellene rad for rad like som før slettingen. Ingen dump slettet.
- `lint`, `typecheck` og `check:pins` grønne. `pnpm test` 1021/1021, `test:db` 169/169, `test:ingest` 391/391, e2e 116/116 på seeden alene.
- Spec for 2.6 (`1c9c70e` på `story/2.6-classification-stage-5`, lokalt): identisk tekst sendes én gang under `vedtektsfestet_formaal`. Anslaget for 10 327 AS er $0,64 sentralt, $3,14 høyt og $5,68 tak.

### Åpne punkter
- Story 2.6 starter først når 2.6a er merget. Ingen modellkall uten OK til den enkelte kjøringen.
- `analysis:seed-documents` feiler på «current reader» til neste omlesing. Dette er ventet, og står i PR #53.
- Story 2.6 må nekte å klassifisere når ingen dekket AS har tekst: ført i `_bmad-output/implementation-artifacts/deferred-work.md`.
