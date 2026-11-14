# Story 2.8: adjust the peer group

**Date:** 2026-11-13
**Tool:** Claude Code (Opus 5.5): the BMAD session (`bmad-build`), an implementation subagent dispatched by it, and three review subagents
**Story / issue:** #58, Story 2.8 (FR-17, FR-18, FR-19, FR-55, FR-56, NFR1, NFR2, NFR27)
**Result:** commits `ebf0792` to `1c1eadd` on `story/2.8-adjust-peer-group`; PR not opened yet (no push before Meinich says so)

## Goal

Let the user exclude and restore a peer, widen the size band and go back to the standard group. Each change is a soft navigation to a URL from `serialize`, rendered on the server, with every figure recomputed and nothing stored. Also close the two items Story 2.7 deferred to this story.

## Prompts that mattered

Meinich, opening the session (verbatim):

> /bmad-build Story 2.8: Adjust the peer group (epics.md, Story 2.8). Lag branchen story/2.8-adjust-peer-group fra origin/main (042fbe1), og opprett issuet.
>
> Stopp ved sjekkpunktet før du endrer kode, og vis meg:
> (a) Flyten for ekskluder, ta med igjen, utvid og tilbakestill: serialize, router.push og server-rendering, at ingenting skrives til noen tabell, og hvordan ekskl utenfor poolen ved nytt bånd droppes med merknaden én gang.
> (b) Venting og feil: hvordan aria-busy, dimmede tall og "Oppdaterer …" virker med myk navigasjon, og hvordan en feilet endring oppdages, viser role="alert" og lar tallene og URL-en stå på siste gode tilstand. Si hvilken Next.js-mekanisme du bruker, og hvordan testen tvinger fram feilen.
> (c) Rate-grensen: analysebudsjettet er 60 forespørsler i minuttet per adresse (src/rate-limit/budgets.ts). Hvor mange forespørsler koster én endring, prefetch medregnet? Hva ser brukeren ved 429 midt i en serie endringer?
> (d) De to punktene utsatt fra 2.7 i deferred-work.md: traktens tall med ekskl, og "Vis alle" som husker tilstand på tvers av navigasjon. Hvordan blir begge riktige nå, og med hvilke tester?
> (e) Tidsmålingen: testen for at peer-gruppen bygges på under 1 s, og hvordan tiden til ferdig rendret analyse måles og føres i PR-en (NFR1, NFR2).
> (f) Norsk tekst: all ny tekst som ikke står ordrett i Story 2.8. Vis meg den før den står i nb.json og EXPERIENCE.
>
> Regler: hver rad i I/O-matrisen nevner testen som feiler hvis koden fjernes. Eksempler og testdata kommer fra demoselskapene eller syntetiske selskaper. Tester som bruker andre subjekter, sammenligner bare totaler og navngir ingen selskaper fra fasitsettet. PR-en sier hva som kan gå galt når URL-tilstand når motoren og når en omregning feiler, med begrunnelse i ai-log. Små commits, sjekk på 375 og 320 px underveis, hele suiten før første push. Kjør e2e med --workers=1 hvis minnet blir knapt. Ingen push før jeg sier fra. PR-en skal ha linjen "Planning documents:". pnpm classify kjøres ikke, og ingen dump slettes.

Meinich, at the checkpoint (verbatim):

> Fra meg:
> 1. AD-4: enig. Tillat orgnr for peerne i gruppa (også ekskluderte rader), forby fortsatt orgnr for dem trinn 4 og 5 fjernet, og rett AD-4 i den tekniske notatet i denne PR-en.
> 2. Prefetch: (a), prefetch={false} på fanelenkene.
> 3. 429: (a). Skriv unntaket inn i EXPERIENCE "Recompute" og epics.md, med e2e-testen som viser avvisningssiden.
> 4. Teksten er godkjent med tre endringer:
>    - "Omsetning {fra}–{til} mill. kr", for eksempel "Omsetning 3,1–12,4 mill. kr".
>    - "Bare størrelsesintervallet kan utvides. Kravene til sammenlignbart regnskap, selskapsform og bransje løsnes aldri."
>    - "Du har ekskludert alle sammenlignbare selskaper. Ta med et selskap igjen, eller tilbakestill til standard."
>    Dine to egne valg (utvid-knappen på 0,33–3× og formatBandFactor) er greie.
>
> Ett krav til feilhåndteringen: den nye src/app/analyse/[orgnr]/error.tsx fanger også feil ved første lasting av siden. Der må den ikke kalle router.back(), for da sendes en som åpnet lenken direkte tilbake til forrige side, kanskje ut av Peerless. Den skal bare gå tilbake når provideren har en peer-gruppe-endring som venter. Ellers viser den samme feiltilstand som i dag (role="alert", ingen detaljer). e2e/db-down.spec.ts skal fortsatt passere uendret, og legg til en test for at direkte lasting med feil ikke navigerer bort.
>
> Behold hele spec-en. Approve and continue: skriv dette inn i den låste delen og start implementeringen. Samme regler som før, og ingen push før jeg sier fra.

The BMAD session dispatched the spec to the implementation subagent with the bmad-build handoff, adding one rule: commit in small steps and never push.

## What came back, and what was done with it

- **Measured by the BMAD session before the checkpoint**, against `next start`, so the checkpoint answers rest on behaviour rather than on reading:
  - A soft navigation whose render fails on the database answers 200 with the error in the RSC payload. It reaches a client error boundary, which is what makes the "last good state" possible.
  - A non-200 answer (429) makes Next.js do a full page load (`fetch-server-response.js`, `doMpaNavigation`).
  - A page load cost 7 analysis requests and a change cost 3, because the tab links prefetched the other two tabs. So the 17th change within a minute was refused, and the refusal page showed at the new URL.
  - Next.js resets an error boundary only on a new pathname, and Back is served from its router cache.
  - These findings gave the open questions on AD-4, prefetch and 429.
- **Decisions at the checkpoint (Meinich):**
  - The group's orgnrs may reach the page, and AD-4 is amended in this PR.
  - The tab links get `prefetch={false}`, so a change costs one request.
  - A 429 is the decided exception, written into EXPERIENCE and epics.md.
  - The copy is approved with three changes.
  - The new segment error boundary goes back only while a change is in flight.
- **Accepted from the subagent** (`b3f7689` to `95f5343`):
  - `formatBandFactor` and `formatMillionsNumber`, and the FR-18 band loop.
  - The whole group in the Peers list, with exclusions marked and flagged peers counted in the analysis only.
  - The copy and the EXPERIENCE rows.
  - The provider in the `[orgnr]` layout and the segment's `error.tsx`.
  - The size-band radiogroup, the action column, the State blocks and the funnel line.
  - The timed assembly test.
  - 14 e2e tests, plus a timing spec.
  - AD-4 and AD-6 amended in the technical note, the 429 criterion in epics.md, and the AI-log entry.
- **Corrected by the BMAD session:**
  - **The size-band control (`c2e57cb`).** Reading the subagent's diff, the BMAD session saw that the radiogroup kept the step last chosen in its own state. A probe on the built app confirmed it: after a reset from 0,25–4× the URL was standard but 0,25–4× stayed checked, and after Back to Standard 0,33–3× stayed checked. The cause is that a query-only navigation keeps the component. The chosen step now counts only while its change is in flight. Assertions added to two e2e tests fail on the old build.
  - **The singular copy (`1c1eadd`, then reversed).** The subagent wrote "1 sammenlignbart" in the six new singular strings, where Meinich had approved "1 sammenlignbar". The BMAD session restored the approved form in `1c1eadd`. The review session then pointed out that the approved form was wrong: the word agrees with "selskap", which is neuter, and "1 sammenlignbart" matches `analysis.peerCountOne` from Story 1.7. Meinich corrected it on 2026-11-14, and the six strings read "1 sammenlignbart" again (spec change log). So the subagent's form was right, but it changed approved copy without saying so. It is the second story running where a subagent reworded approved copy.

## Review

Three review subagents read the diff (Blind Hunter, Edge Case Hunter, Verification Gap). The BMAD session verified each finding and logged all 20 in the spec's Review Triage Log. Fixed in `c2e57cb` by the implementation subagent, sent back with the findings:

- **A change that could stay in flight** (all three reviewers). A change ending on the URL it started from committed identical props, so the commit effect did not run again: there was no announcement, and a later unrelated error would have been taken for a failed change. Every server render now commits once (`renderId`), with a test.
- **The segment boundary's other branch was untested** (Verification Gap, Blind Hunter). The matrix row "Failure on first load" named `e2e/db-down.spec.ts`, which fails in the layout before the segment's boundary. There is now a test that fails when the check is forced true, recorded in the spec's change log.
- **Focus pulled back** after the user moved it while a change was pending (Blind Hunter, Edge Case Hunter).
- **The failure alert outlived its change** across later pages (Blind Hunter).
- **The payload scan** never ran with exclusions or a widened band (Blind Hunter).
- **An empty group** offered "Utvid størrelsesintervallet", against EXPERIENCE (Blind Hunter).
- **A test helper** swallowed every component error (Edge Case Hunter, Blind Hunter).
- **Unit tests** for the announcements and `nextState` (Verification Gap).
- **Two quick changes whose second fails:** a test shows it returns to the last good URL, and no code change was needed (Edge Case Hunter, Blind Hunter).
- **Docs, by the BMAD session:**
  - The recompiled `epic-2-context.md` had dropped the blind-labelled-set rule, the AI-marking rules and the classification inputs; they are restored.
  - Sprint status is now `review`.
  - The two 2.7 items in `deferred-work.md` are marked resolved.
  - The AI log and this file are updated.

**Rejected:**
- A guard for a superseded change committing first. Next.js commits only the latest navigation, and the guard would leave a change stuck whenever the server drops an `ekskl` item.
- `preventDefault` on a no-op change: it cannot happen for a rendered link.
- Arrow-key auto-repeat on the band control. It follows the ARIA radio pattern, and a debounce would add complexity.
- A range reading "0,0" for revenue under 50 000 kr: rare.
- `widerBand` given an unknown band: the type makes it impossible.
- "Vis alle" untested with the real provider: an e2e test already covers it.
- Timings only printed: the PR records them.

**Deferred** (`deferred-work.md`): the 21st exclusion, which `parse` drops with the notice that blames "the link" although the user pressed a button (Blind Hunter). The BMAD session first rejected it as unusual; Meinich deferred it on 2026-11-14. The proposed fix is to disable the button at `MAX_EKSKL`, with a text of its own.

## Verification

- **After the review fixes, against the committed seed:**
  - Passed: `check:pins`, `check:env`, `lint`, `typecheck`, `test` (1 217), `test:db` (191), `build` and `check:routes`.
  - `test:ingest` passed 390 of 391. The one failure was a `PermissionError` from a Windows temp file in `tests/test_run_record.py`; it passed on a rerun, and `ingest/` is unchanged in this story.
  - The first full e2e run after the review fixes was stopped by Claude Code for low memory. With Meinich's go-ahead it ran again after `eb38d33`, on a fresh build: `test:e2e --workers=1` passed 145 of 145 (4.1 min).
- **Timings (NFR1, NFR2):**
  - Assembly for demo A and B at every band with three exclusions: 87–145 ms.
  - Click to the filled announcement on demo A's Peers tab, median of three runs, in the final e2e run: load 474 ms, exclude 439 ms, restore 380 ms, band 523 ms, reset 426 ms. The subagent's run before review gave 406–553 ms.
- **Local data:** before each seed load, the document rows outside the allow-list were dumped (`.local/before-2.8-suite/`, `.local/before-2.8-review/`). Both equal `.local/document-run-2.5d/` row for row. No dump was deleted, and `pnpm classify` was not run. After the final e2e run, `.local/document-run-2.5d/` was restored and `pnpm derive` run: 2 785 documents, 5 556 columns, 2 537 fingerprints and 10 371 classification rows, and the restored rows equal the dump.

## Links

- AI log: "2026-11-13 — Story 2.8: URL state reaching the engine, and a failed recompute"
- Spec: `_bmad-output/implementation-artifacts/spec-2-8-adjust-the-peer-group.md`
- Planning documents:
  - technical note: AD-4 and AD-6
  - `epics.md`: Story 2.8's 429 criterion and the AD-4 line
  - `EXPERIENCE.md` and its `.memlog.md`
  - the PRD is not affected
