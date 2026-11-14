# Story 2.10: Epic 2 follow-ups

**Date:** 2026-11-14
**Tool:** Claude Code (Opus 5.5): the BMAD session (`bmad-build`), with these subagents:
- one that recompiled the Epic 2 context
- four investigation subagents
- an implementation subagent dispatched by the BMAD session
- three review subagents

**Story / issue:** #62, Story 2.10 (FR-7, FR-8, FR-17, FR-73)
**Result:** branch `story/2.10-epic-2-follow-ups`, [PR #63](https://github.com/IBE160-2026/G97-meinich/pull/63), commits `f93541e` to `fe1065d` and the docs commits

## Goal

Close the gaps Epic 2 left before the document figures arrive:
- An empty group says why: R2 and R3 from the Epic 1 retro.
- The 21st exclusion is a disabled button, not a notice that blames the link.
- The code reads like the peer group it builds: one API key-figure column list, one `SubjectFiling`, the orgnr strip through `orgnr.ts`, and stage-4 comments that say stages 4 and 5.
- The two prompt-only rules become tooling: one e2e worker, and `pnpm restore:documents`.

## Prompts that mattered

The review session wrote every prompt below. Meinich pasted them into this session, and the review session also recommended the answers. Where a decision is credited to Meinich below, Meinich made it on the review session's recommendation.

Meinich, opening the session (verbatim):

> /bmad-build Story 2.10: Epic 2 follow-ups (epics.md, Story 2.10). Lag branchen story/2.10-epic-2-follow-ups fra origin/main, og opprett issuet.
>
> Stopp ved sjekkpunktet før du endrer kode, og vis meg:
> (a) Utsatt arbeid: hver oppføring i deferred-work.md som nevner Story 2.10 eller «Epic 2 follow-ups» (minst R2/R3 og ekskludering nr. 21). For hver: tas den inn, eller flyttes den til en navngitt story, og hvorfor (AGENTS.md, «A spec takes in the deferred work …»).
> (b) R2: hvor helten og setningen om tom gruppe henter omsetningen, og at regelen «ikke oppgitt gir ikke størrelsesbånd» står uendret (docs/key-figures.md). Foreslå teksten for «omsetningen er ikke oppgitt».
> (c) R3: hvilke felt hos subjektet som gjør trinn 2 tomt (valuta som ikke er NOK, regnskapsregler, smaaForetak eller avviklingsregnskap som mangler, og eventuelt andre), og hvor mange subjekter i seeden hvert felt gjelder, bare totaler. Foreslå de nye verdiene for emptyReason og teksten for hver. Filteret selv skal ikke endres.
> (d) Ekskludering nr. 21: hvordan knappen blir aria-disabled, kan fortsatt få fokus og beskrives av den godkjente teksten, og hvilken test som feiler hvis et trykk pusher URL-en.
> (e) Epic 1-punkt 6 og B4: hva den felles kolonnelista, den omdøpte SubjectFiling-typen og fjerningen av mellomrom i orgnr gjennom src/engine/orgnr.ts erstatter, fil for fil. Det er ren refaktorering: oppførselen endres ikke, og testene som finnes skal bestå uten å endres.
> (f) --workers=1: i playwright.config.ts eller i skriptet, og om CI også endres, med hvor lang tid CI bruker i dag og etterpå.
> (g) Gjenopprettingen: kommandonavnet, hvilken rolle som skriver, at den nekter alt som ikke er localhost eller 127.0.0.1, at den aldri sletter en dump, hva den gjør når .local/document-run-2.5d/ mangler (en fersk klone), og at den kjører pnpm derive og skriver ut de fire tallene. Hvor i README-en står den, og hvorfor?
>
> Regler: den godkjente teksten for ekskludering nr. 21 går ordrett inn i nb.json, og en test sjekker den ordrett. Underagenten skal ikke skrive om godkjent tekst. All ny tekst vises meg før den står i nb.json og EXPERIENCE. Hver rad i I/O-matrisen nevner testen som feiler hvis koden fjernes, og rapporten viser hva som ble fjernet og hvilken test som feilet. Testdata kommer fra demoselskapene eller syntetiske selskaper. Tester på andre subjekter sammenligner bare totaler og navngir ingen selskaper fra fasitsettet. PR-en sier hva som kan gå galt, med begrunnelse i ai-log. Små commits, og refaktoreringen i egne commits. Sjekk 375 og 320 px underveis. Kjør hele suiten før første push, og e2e med --workers=1. Hvis den stopper på grunn av minne, si fra i stedet for å starte på nytt. Etter siste seed-lasting: gjenopprett .local/document-run-2.5d/, kjør pnpm derive og bekreft 2 785 dokumenter, 5 556 kolonner, 2 537 fingeravtrykk og 10 371 klassifiseringsrader. Ingen push før jeg sier fra. PR-en skal ha linjen «Planning documents:». pnpm classify kjøres ikke, og ingen dump slettes.

Meinich, answering the checkpoint's five questions (verbatim):

> 1. Ja, ta med subject_not_comparable med egen setning, så en tom gruppe aldri står uten grunn.
> 2. Vis trakten sammen med setningen ved en R3-grunn.
> 3. Omdøp motorens SubjectFiling til FunnelSubject og fjern aliaset i view.ts. Importlinjene i testene kan endres, og testtittelen i shown-group.test.ts:60 rettes til «after stages 4 and 5». Ingen assert endres.
> 4. workers: 1 i playwright.config.ts, både lokalt og på CI. README-en sier hvorfor. Mål CI-tiden etter første push og skriv den i PR-en.
> 5. Teksten er godkjent, med én endring: slå subject_unknown_currency sammen med subject_currency, slik at enhver valuta som ikke er NOK gir «Regnskapet for {aar} er ført i {valuta}, og ingen selskaper i samme næring og størrelse fører regnskap i {valuta}.» Grunnene for felt som ikke er oppgitt, testes med syntetiske subjekter, fordi seeden ikke har noen.
> Tillegg til (g): pnpm restore:documents tar kolonnenavnene fra første linje i dumpen, som README-en gjør i dag, slik at eldre dumper også kan gjenopprettes. Standard er .local/document-run-2.5d/.
> Spec-en kan holdes samlet. Skriv svarene inn i den frosne delen, sett story og spec til ready-for-dev og fortsett. Ingen push.

Meinich, answering the review's four intent questions (verbatim):

> 1. (a): subject_currency bare når ingen kandidat i trinn 1 har subjektets valuta, eller når koden ikke er ISO 4217. Ellers subject_not_comparable. Teksten er uendret.
> 2. (a): behold «Utvid» sammen med setningen når et bredere bånd kan hjelpe (subject_currency med kjent kode og subject_not_comparable), og bare når det finnes et bredere steg. Ikke ved et felt som ikke er oppgitt.
> 3. Ja, rett til «three» med en oppføring i Spec Change Log, med dato og at jeg bestemte det.
> 4. (a): et syntetisk USD-selskap i e2e/synthetic.ts. Omsetningen skal ligge utenfor båndene til demo A og B på alle steg, og det skal ha kandidater i trinn 1, men ingen i USD, slik at testen viser subject_currency. Det ryddes før og etter, og i global-setup, med samme vern som det første. AGENTS.md får en setning om det. De gamle testene for null og negativ omsetning får stå, og triagen sier at de er eldre enn regelen.
> Ikke rull tilbake. Skriv i triagen hvorfor. Rad 14 skal nevne en eier-story i deferred-work.md, for eksempel 5.7. Rett så rad 5–13 og 1–4 i én runde. Etter siste seed-lasting gjenoppretter du med pnpm restore:documents og bekrefter de fire tallene. Kjør hele suiten og e2e med én worker. Ingen push.

## What came back, and what was done with it

### Found by the BMAD session before the checkpoint

Seed totals only:
- 1 537 of 8 356 covered-AS subjects state no revenue, and none of them has a derived revenue above 5 kr.
- No subject has a null `valuta`, `regnskapsregler`, `smaaForetak` or `avviklingsregnskap`.
- At band 0, 16 of 4 649 comparable subjects end with an empty stage 2. Ten of them are on currency (4 EUR and 15 USD subjects in all). The other six are on a stated field no candidate shares.

Other findings:
- `docs/key-figures.md`'s rule moved to line 159. `deferred-work.md` still said 151.
- Either `SubjectFiling` rename touches test imports. Meinich allowed import-only changes (question 3).

### Decisions

These are in the spec's frozen block. Each is Meinich's decision.

**At the checkpoint:**
- Three stage-2 reasons and `subject_revenue_not_stated`.
- The funnel kept beside a stage-2 sentence.
- The approved copy.
- On the review session's recommendation:
  - Merging the two currency reasons into one. This later made the currency sentence false, and the BMAD session's review found it (triage 1).
  - Renaming the engine's type to `FunnelSubject`, and correcting the test title in `shown-group.test.ts`.
  - `workers: 1`, locally and on CI.
  - `pnpm restore:documents` taking each table's column names from the first line of the dump.

**After the review, on the review session's recommendation:**
- Option (a) on all four intent questions: the narrowed currency reason, "Utvid" kept, the correction to "three", and the synthetic USD company.
- Giving triage row 14 an owner story (5.7).

### Accepted from the implementation subagent

Commits `bd77ec3` to `2fc0acb`:
- the engine reasons
- the exhaustive `emptyText`
- the cap, with the provider guard
- the four refactoring commits, with the existing assertions unchanged
- one worker
- `pnpm restore:documents`
- the upstream docs: PRD FR-7, FR-8, FR-17, FR-73 with a `.memlog.md` change line; EXPERIENCE; AGENTS.md; `deferred-work.md`; the AI log

### Corrected in review

The spec's triage log has 25 findings: 13 patched, 1 deferred, 11 rejected. The patches are `4834886`, `f07c520`, `99545fd`, `23cc0b2`, `409dd63` and `fe1065d`. Each finding is credited to the layer that made it:
- The currency sentence was false for 7 of 10 seed cases (Blind, Edge case). Meinich narrowed the reason, on the review session's recommendation.
- A stage-2 sentence dropped "Utvid" (Blind). Meinich kept it where a wider band helps, on the review session's recommendation.
- The frozen decision said "four" stage-2 reasons (Edge case). Meinich corrected it to three, on the review session's recommendation.
- The e2e currency subject was a seeded non-demo company (the BMAD session, against Meinich's rule). Meinich chose a synthetic USD company, on the review session's recommendation. The older zero, negative and null cases predate the rule and stay.
- The hero was untested with a stage-2 reason (Verification gap, Blind).
- "An empty group never stands without a reason" overstated the code in the PRD and EXPERIENCE (Blind, Edge case).
- The derive after a restore was not host-checked (Blind, Edge case).
- A fresh clone without `LOADER_DATABASE_URL` exited 1 (Edge case, Verification gap).
- The database test ran as the owner, not `loader` (Blind).
- "Nothing pushed" rested on a one-second sleep (Blind).
- Small items: AI-log claim wording and a `Partial` cast; an off-by-one guard; undated README counts (Blind, Edge case).
- The phone-width cap check could never pass (the BMAD session, in the full one-worker run). The implementation report had blamed the restored dump. The cause was that the test excluded the first 20 peers.

### Checked by the BMAD session, not taken from the report

The implementation report said the provider's cap guard was covered but had not run the mutation. With the guard removed, "with 20 exclusions … a press pushes nothing" failed; with it, all four cap tests passed.

When Meinich asked the PR text to say that the button does nothing at the cap and the provider refuses as well, the BMAD session checked that text, written by the review session, against the code. It found that the button still called the provider, which deviated from checkpoint answer (d) (triage 25). Meinich chose to add the button guard (`fe1065d`).

The three mutations, run on `e2e/peer-adjust.spec.ts`:
- Provider guard removed: the in-flight test fails.
- Both removed: "with 20 exclusions …" fails too.
- Button guard removed: nothing fails, because the provider holds.

One correction: the BMAD session had first said that removing the button guard alone would fail the 20-exclusion test. It does not, because the provider still refuses.

### Deferred

Triage 14 is deferred to Story 5.7 (`deferred-work.md`); Meinich gave it that owner story, on the review session's recommendation: no test runs the restore's real `loader` and derive path.

### Rejected in review

Eleven findings, each with its reason in the triage log, for example:
- the cap copy's "20", which is approved verbatim
- an unstated `regnskapstype`, which cannot occur
- crashes of a local developer command on a failed close

## Verification

On a database holding only the seed (the seed was loaded twice and re-exported without a diff):
- `pnpm lint`, `pnpm typecheck`, `pnpm check:pins` and `pnpm check:env` clean.
- `pnpm test`: 1 326 tests. `pnpm test:db`: 195 tests. `pnpm test:ingest`: 392 tests.
- `pnpm build` and `pnpm check:routes` OK.
- `pnpm test:e2e` (one worker): 157 of 157 in 5.2 min, with no memory stop. The first full run had 2 failures (triage 24), fixed in `409dd63`.

After the last seed load:
- No synthetic company was left.
- `pnpm restore:documents` printed 2 785 documents, 5 556 columns, 2 537 fingerprints and 10 371 classification rows.
- `.local/document-run-2.5d/` was intact.
- `pnpm classify` was not run.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-10-epic-2-follow-ups.md` (decisions, I/O matrix, change log, triage log)
- AI log: "2026-11-14 — Story 2.10: empty-group reasons, the exclusion cap, and a restore that writes as loader"
- Planning documents updated: the PRD's FR-7, FR-8, FR-17 and FR-73 (with a `.memlog.md` change line), EXPERIENCE, AGENTS.md, README, `deferred-work.md`

## CI

The first push was green: run 43607899346 on `7169715`, 10 m 15 s in all, of which e2e took 4 m 31 s with one worker. Before, run 43585950193 took about 8 m 53 s, and its e2e step about 3 m 16 s with two workers.
