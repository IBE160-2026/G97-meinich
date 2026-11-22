# Epic 3 retrospective

**Date:** 2026-11-22
**Tool:** Claude Code (Opus 5.5): the BMAD session (`bmad-retrospective`), with four read-only investigation subagents it dispatched
**Story / issue:** planning, Epic 3 (stories 3.1a–3.8)
**Result:**
- commits on `main`: `0897781`, `adb6402`, `80b3ed2`, `fe6d812`, `6b57dc5` and `774df04`;
- retrospective: `_bmad-output/implementation-artifacts/epic-3-retro-2026-11-22.md`;
- not pushed: the review session pushes.

## Goal

Run the Epic 3 retrospective:
- check the PRD and the other planning documents FR by FR against what Epic 3 built;
- list the FRs still carrying build history and propose when they are cut (Epic 2 action 11);
- follow up the Epic 2 action items and the deferred work Epic 3 and Story 5.4 own;
- source the recurring patterns;
- verify behaviour without changing code;
- set action items for 5.4 and Epic 4, and propose a verdict.

## Prompts that mattered

Meinich, opening the session (verbatim, point 5's list of patterns shortened):

> /bmad-retrospective Epic 3: See every gap in kroner and what closing it is worth (Story 3.1a, 3.1b og 3.2–3.8, alle done i sprint-status.yaml). Retrospektiven skrives til _bmad-output/implementation-artifacts/epic-3-retro-<dato>.md, med datoen den kjøres, som for Epic 1 og 2. Planleggingsdokumenter går rett på main i små commits, én per dokument eller tema. Ikke push før jeg sier fra.
>
> 1. PRD-en mot det Epic 3 bygde […] For hver: stemmer PRD-en med koden? Oppgi filen eller testen du sjekket mot. […]
> 2. Handlingspunkt 11 fra Epic 2-retroen […] Vis meg en liste over FR-ene som gjenstår, med omtrentlig størrelse, og foreslå om kuttet gjøres i denne retroen eller som egen jobb før 5.4. Ikke skriv om PRD-en før jeg har godkjent det.
> 3. Oppfølging av handlingspunktene fra Epic 2-retroen […]
> 4. Utsatt arbeid […] Lag en liste over det Story 5.4 arver, også at vannfallet før 5.4 bare vises i den syntetiske fixturen.
> 5. Funn som gjentar seg, med kilde […]
> 6. Atferdsverifisering uten kodeendringer: lint, typecheck, pnpm test --maxWorkers=2, og etter restore tellingene (2 785 / 5 556 / 2 537 / 10 371), 0 SYNTETISK% og 20 oppføringer i manifestet. Kjør ikke e2e. […]
> 7. Handlingspunkter for 5.4 og Epic 4 […]
> 8. Forslag til akseptdom, og når epic-3 kan settes til done i sprint-status.yaml.
>
> Regler: Ingen klassifisering eller fingeravtrykk per orgnr for de 845 selskapene i fasitsettet, bare totaler. Ingen kode endres. pnpm classify kjøres ikke, og ingen dump slettes. Stopp og vis meg PRD-gjennomgangen fra punkt 1 og forslaget fra punkt 2 før du retter planleggingsdokumentene. Vis meg retrospektiven før den committes.

Meinich, on the PRD review and the cut (verbatim):

> Rettelsene dine i punkt 5 stemmer. Review-sesjonen skrev premissene fra hukommelsen. Bruk kildene, som du gjør, og si i retroen at premissene ble rettet mot kildene.
> 1. FR-64: (a). Rett PRD-en og epics.md (:391, :414) til det som er bygd […] Gi Story 5.4 en AC: når det finnes ekte dokumentpeerer, viser drill-downen for et dokumentbasert peeraggregat (kvartillinjen fra 3.7) regnskapsåret og datospennet for lesingen, med samme regel som waterfallFacts. Ett fellesår holder. Sett en (change)-linje i memloggen som sier at dette er flyttet, ikke droppet.
> 2. Kuttet: godkjent som foreslått. […] Aldri slett et måletall som ikke finnes et annet sted. […]
> 3. Rett også P6, T1–T4 og E2–E3. E4 blir en AC i Story 5.4 […]

Meinich, on the retrospective (verbatim, shortened):

> 1. Dommen accepted-with-open-items er godkjent. Sett epic-3 til done i samme commit som retroen.
> 2. Handlingspunktene er godkjent, med én rettelse. Det finnes ingen grense på 30 kB. Tallet kommer fra review-sesjonens prompt i 3.7 (docs/ai-prompts.md:4087) […] Nr. 4 (#71): jeg avgjør det før PR-en for 5.4, ikke før 5.7, fordi README ber sensor kjøre pnpm build. […] Nr. 7 er review-sesjonens. […]
> 3. X1: legg den inn i deferred-work.md under 5.4 nå […]
> 4. action_items i sprint-status: ikke dupliser. Legg inn én linje som peker på tabellen «Action items» i retroen. […]

## What came back, and what was done with it

- **The investigations.** Four read-only subagents covered:
  - the PRD FR by FR, with the technical note, `epics.md`, EXPERIENCE.md, `docs/key-figures.md` and AGENTS.md;
  - the FRs with build history;
  - the Epic 2 action items and the deferred work;
  - the recurring patterns, the PRs and the cross-story boundaries.

  The BMAD session checked every drift it reported against both ends before showing it to Meinich: P1, P2, P3, T1, T3 and E3 against the PRD, the technical note and the code.
- **Premises corrected against the sources.** The opening prompt's patterns were written from memory by the review session. The investigation found five that did not match their sources in full:
  - the memory stops hit 7 of 9 stories;
  - #71 hit every story from 3.2;
  - 3.7's B9 came in the review session's opening prompt, not at the checkpoint;
  - in 3.8 the review session itself found that no review was posted;
  - in 3.8 the phone fix was needed, and its 9–16 px offset belonged to the restored fix.

  Meinich confirmed the corrections. The retro uses the sources.
- **The cut, split in two.** The proposal was accepted.
  - In this retro: the six Epic 3 FRs and FR-3's stale sentence, in the same diff as their corrections.
  - As a separate job before Story 5.4's spec: the other 13 FRs.
- **Corrected by Meinich:** the retro's draft called 30 kB a payload limit. It is the review session's growth threshold for one story (`docs/ai-prompts.md:4087`), so P7 and action 9 were rewritten.
- **Corrected by Meinich:** the draft's deadline for #71 was before 5.7. He moved it to before 5.4's PR, because the README tells a grader to run `pnpm build`.
- **Verification** matched Story 3.8 on every count (the retro's "Behavior verification").

## Links

- Retrospective: `_bmad-output/implementation-artifacts/epic-3-retro-2026-11-22.md`
- Planning documents:
  - PRD and its `.memlog.md` (`0897781`);
  - technical note (`adb6402`);
  - `epics.md` (`80b3ed2`);
  - `docs/key-figures.md` (`fe6d812`);
  - `sprint-status.yaml` (`6b57dc5`, `774df04`);
  - `deferred-work.md` (`774df04`).
