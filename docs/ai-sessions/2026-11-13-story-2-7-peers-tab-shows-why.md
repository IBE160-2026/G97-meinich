# Story 2.7: the Peers tab shows why

**Date:** 2026-11-13
**Tool:** Claude Code (Opus 5.5): the BMAD session (`bmad-build`), and an implementation subagent dispatched by it
**Story / issue:** #56, Story 2.7 (FR-9 wording, FR-14 flagged count, FR-15, FR-16)
**Result:** commits `d6f6ffc` to `999c9f0` on `story/2.7-peers-why`; PR not opened yet

## Goal

Show the five-stage funnel with its counts on the Peers tab, and give each peer a driftsmargin, a rules-written "Hvorfor med" and a "Grunnlag for treff" from `signals()` in `src/engine/peers.ts`. The page renders on the server, so it sends only the strings it shows (AD-4).

## Prompts that mattered

Meinich, opening the session (verbatim):

> /bmad-build Story 2.7: The Peers tab shows why (epics.md, Story 2.7). Hent main først (85cf736). Opprett issuet og branchen story/2.7-peers-why.
>
> Stopp ved sjekkpunktet før du endrer kode, og vis meg:
> (a) "Hvorfor med": hvilke profilfelter peeren deler med subjektet funksjonen bruker, et par eksempeltekster fra demoselskapene, og hvordan testen viser at ingen modelloutput går inn.
> (b) "Grunnlag for treff": funksjonen i src/engine som bygger på signals() i peers.ts, og lista over testene, én per kombinasjon slik Story 2.7 sier. Tekstsignalet kan bli slått av i v1 etter Story 5.2 (FR-11). Vis hvordan grunnlaget og flagget da følger av samme sted, uten egen kode.
> (c) Payloaden: hvilke felter per peer som sendes til klienten, og at ingenting utover det som vises er med (AD-4).
> (d) Oppsettet på 375 og 320 px: trakten som liste og peerne som kort med "Vis alle {n}".
> (e) Norsk tekst for Segment-steget (bare AS i v1, i samsvar med FR-9), "✦ {n} med usikker klassifisering" og ✦-nøkkelen. Den går i nb.json og EXPERIENCE. Vis meg teksten før den står der.
>
> Regler: hver rad i I/O-matrisen nevner testen som feiler hvis koden fjernes. Eksempler og testdata kommer fra demoselskapene A, B og C eller syntetiske selskaper, aldri fra de 845 i fasitsettet, og ingen klassifisering eller fingeravtrykk per orgnr for dem i spec, PR eller ai-log. Små commits, sjekk på telefonbredde underveis, hele suiten før første push, ingen push før jeg sier fra. PR-en skal ha linjen "Planning documents:". pnpm classify kjøres ikke, og ingen dump slettes.

Meinich, at the checkpoint (verbatim):

> Fra meg:
> 1. Subjektets navn ({ref}), som du anbefaler.
> 2. Flagget i egen sjette kolonne, slik Story 2.7 sier.
> 3. 8 kort før "Vis alle {n}".
> 4. Behold hele spec-en, med oppdelingen av e2e/analysis.spec.ts som første commit, der testene bare flyttes.
>
> Teksten er godkjent med én endring: bruk regelen fra fingeravtrykket i stedet for "vesentlige": "balanseførte immaterielle eiendeler minst 5 % av omsetningen" / "immaterielle eiendeler under 5 % av omsetningen". Hent tallet fra konstanten i src/engine/fingerprint.ts, ikke skriv det inn på nytt.
>
> Om demo A og B: lokalt har begge fingeravtrykk. Bare den committede seeden mangler dem, fordi allow-listen ennå bare har OCR-referansesettet. Story 5.4 legger til A, B og peerne. Teksten deres er uklart, så heller ikke etter 5.4 vil de vise et ✦-grunnlag eller et flagg. Før det inn som et punkt i Story 5.4 i epics.md: vurder et demoselskap der teksten har en type, så demoen viser AI-laget. Skriv det i spec-en og session-fila også.
>
> Godkjent: skriv svarene inn i den låste delen og fortsett med implementeringen. Samme regler som før: små commits, sjekk på 375 og 320 px underveis, hele suiten før første push, ingen push før jeg sier fra.

The BMAD session dispatched the spec to the implementation subagent with the bmad-build handoff. It added two rules of its own: commit in small steps in the spec's order and never push; and do not touch the local database, leaving `pnpm test:db` and `pnpm test:e2e` to the BMAD session.

## What came back, and what was done with it

- **Checkpoint findings by the BMAD session:**
  - Demo A and B have no fingerprint in the committed seed, and both are `uklart`. Their funnels lose no one at stages 4 and 5, and every basis is "Kun bransje og størrelse".
  - Of the seed's 3 786 subjects with a group outside the labelled set, 1 683 have mixed bases, two have "Beskrivelse og regnskap" with a flag, and none has all four. These are totals only.
  - So the four bases are tested with synthetic companies in engine and component tests. The e2e tests use demo A, plus one mixed-basis subject picked at run time.
- **Demo A and B, from Meinich:**
  - Locally both have fingerprints; the committed seed lacks them because the allow-list holds only the OCR reference set until Story 5.4.
  - Their text is `uklart`, so even after 5.4 neither shows a ✦ basis or a flag.
  - Story 5.4 in `epics.md` now has a criterion to consider a demo company whose text has a type (`be7711b`), and the spec records it.
- **Decisions at the checkpoint (Meinich):**
  - "Hvorfor med" names the subject.
  - The flag has its own sixth column.
  - The phone shows 8 cards before "Vis alle {n}".
  - The spec is kept whole, with the e2e split as a move-only first commit.
  - The intangibles trait states the fingerprint's rule, with `{andel}` formatted from `INTANGIBLES_SHARE`.
- **Accepted from the subagent, one commit per step:**
  - the e2e split: the BMAD session checked the 53 `test(` titles of the old file against the four new specs, and they are identical
  - `matchBasis` beside `signals()` and its matrix tests, plus the not-stored test
  - `inclusionReason`, `peerRows`, and the counts and flag through `shownGroup`
  - the funnel, the six-column table, the phone cards and "Vis alle"
  - the Peers e2e tests, and the shared AD-4 scan `e2e/payload.ts` used by every tab
  - removing the municipality from the candidate read, since the list no longer shows it
  - the `nb.json` import attribute that Playwright's loader needs
- **Corrected by the BMAD session in review, both in their own commits:**
  - **The copy (`5f73ab6`).** The subagent wrote its own wording for six strings Meinich had approved at the checkpoint:
    - a Segment line "Selskapsform: foreløpig bare aksjeselskaper (AS)" in place of "Selskapsform AS" and the sentence "Peerless sammenligner foreløpig bare aksjeselskaper."
    - "med varelager" for "har varelager"
    - "varige driftsmidler i samme bånd" for "kapitalbinding i samme bånd"
    - "Merknad om klassifiseringen" for "Merknad"
    - an `aria-label` "Trinnene i utvalget" in place of the visible heading "Slik ble peer-gruppen valgt"

    All were restored in the code, the tests, EXPERIENCE, its memlog and the AI log. The heading now names the funnel's list.
  - **The mixed-basis e2e test (`999c9f0`).** It compared the subject's rows one by one. The subject is outside the labelled set, but its peers need not be, so a failure would have printed a peer's name beside its basis and flag. It now compares totals per basis and per flag. Demo A, whose rows reveal no classification, keeps the row-by-row check.
- **Kept, and noted:**
  - `src/analysis/peer-rows.ts` imports `undefinedText` from `src/components/analysis/api-figures.tsx`, as the spec's code map said to reuse it.
  - A fingerprint can have known categories but no type, so a peer may show traits in "Hvorfor med" while its basis reads "Kun bransje og størrelse". Both are true; the reason names shared categories, and the basis names signals.

## Links

- AI log: "2026-11-13 — Story 2.7: what the Peers page now sends per peer"
- Spec: `_bmad-output/implementation-artifacts/spec-2-7-the-peers-tab-shows-why.md`
- Planning documents: `epics.md` (Story 5.4), `EXPERIENCE.md` (Vocabulary, Funnel, Peer list) and its `.memlog.md`
