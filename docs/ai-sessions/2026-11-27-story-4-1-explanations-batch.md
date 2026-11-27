# Story 4.1: explanations generated in batch

**Date:** 2026-11-27
**Tool:** Claude Code (claude-opus-5-5), `bmad-build`, with one implementation subagent
**Story / issue:** #88, Story 4.1 (FR-52; AD-7, AD-9, AD-13, AD-19)
**Result:** branch `story/4.1-explanations-batch`, not pushed yet (PR to follow)

## Goal

Build step 2's explanation run, `pnpm explain`: test mode, `--plan`, a stored row per company with its provenance, and one approved sample of 20 companies. The full run is Story 4.3's, after the figure test (4.2) and the phrase test (4.3) guard it.

## Prompts that mattered

All three are Meinich's. The review session's reading of the spec at `b609ce0` is behind the second one.

1. After PR #90 was merged:

   > PR #90 er merget som afe9a8e (gh pr view 90), og #89 er lukket. Retroens handlingspunkt 8 er dermed ferdig på main.
   >
   > 1. Rebase story/4.1-explanations-batch på origin/main. Branchen har én commit, f96a1cb, med specen og kjørerekkefølgen i epics.md.
   >    - Løs eventuelle konflikter i epics.md og retroen uten å miste noe fra main.
   >    - Specen skal vise til #89/PR #90 for punkt 8, ikke beskrive det som arbeid i 4.1.
   > 2. Sjekk specen mot det som nå står på main:
   >    - AGENTS.md «Testing» har reglene for assertions (ingen expect i en betingelse, e2e leser bare med en assertion som prøver på nytt, en løkke sjekker lengden først). Alle nye tester i 4.1 skal følge dem, og pnpm lint håndhever de to første.
   >    - deferred-work.md har oppføringen for peer-assembly-time (Story 5.7). Den gjelder ikke 4.1.
   > 3. Vis meg specen til godkjenning, før du endrer kode:
   >    - I/O-matrisen, med testen som feiler for hver rad.
   >    - Spec Change Log med beslutningene fra 2026-11-27.
   >    - Planen for prøvekjøringen: --plan-utskriften (ingen nøkkel, ingen kall), taket og --max-usd 0.05.
   >    - De utsatte oppføringene som nevner 4.3 og 4.4.
   >    - Det åpne spørsmålet om varekostnad som styrke, med totalen.
   >    Ingen modellkall før jeg sier ja til taket.
   >
   > Ikke push før jeg sier fra.

2. The approval, with the review session's matrix rows:

   > Specen godkjennes når disse to punktene er rettet. Review-sesjonen har lest specen på b609ce0.
   >
   > 1. I/O-matrisen mangler rader for vern som specen selv beskriver. Legg dem til, hver med testen som feiler:
   >    - Digest (AD-13), spec linje 48: en endret peer, et endret tall i en slot eller en endret ordlyd for en slot gir en ny digest, og den samme analysen gir den samme digesten.
   >    - Lagrede kolonner: model_id er claude-haiku-5-5, prompt_hash er hashen av prompten som ble sendt, og dataset er lest fra register.dataset.
   >    - Kjørepost: hver kjøring av pnpm explain, også --plan og prøvekjøringen, skriver én post i run.step2 med modusen explain og tellingene. Det gjelder også når kjøringen ender med exit 1.
   >    - Samme valg som siden: for demo A, demo B og selskapet med bare API-tall er den første styrken i payloaden den samme som strengthCard sin (src/analysis/oversikt-cards.ts), og rekkefølgen på kapitalgapene er den samme som largestCapitalGap sin. Fasiten hentes fra de to funksjonene, ikke fra payload-modulen.
   >    - Nøkkelen: en ekte kjøring uten ANTHROPIC_API_KEY nektes med exit 1 og sender ingenting. Nøkkelen skrives ikke ut, verken i loggen eller i run.step2.
   >    - Punkt 10: --plan skriver ut tellingen per formulering for retning og rang.
   > 2. Oppføringen om WHERE false får én eier, Story 4.3, fordi det er der ekte forklaringer lagres. Rett deferred-work.md og Spec Change Log punkt 7.
   >
   > Varekostnad som styrke stopper ikke 4.1. Legg spørsmålet inn som en utsatt oppføring for Story 4.4, med totalene du har (62 av 8 356, hvorav 45 med nøyaktig 0 %, telt 2026-11-27 som reader).
   >
   > Når dette er gjort: sett specen til ready-for-dev og begynn på koden. Commit i logiske steg. Stopp før modellkallet og vis meg --plan-utskriften for --sample 20 og prisen lest på nytt fra prissiden. Ingen kall før jeg sier ja. Ikke push før jeg sier fra.

3. The yes to the ceiling:

   > Ja til taket på $0,0065 (--plan --sample 20, kjørepost id 165 og 178 i run.step2, lest i den lokale databasen). Gjør dette i rekkefølge:
   >
   > Prisdatoen. Sett PRICE_DATE i scripts/classify/plan.ts til 2026-11-27 i en egen commit, siden prisen ble lest på nytt i dag og ikke er endret. Kjør --plan --sample 20 på nytt og sjekk at bare datoen er endret.
   > Kjøringen. Kjør pnpm explain --sample 20 --max-usd 0.05.
   > Rapporten. Den skal ha med:
   > Utfall: antall forklart og feilet, med feilgrunn (stop_max_tokens, unknown_slot, digit_outside_slot osv.).
   > Tokens og kostnad: faktiske tokens inn og ut mot anslaget, og faktisk kostnad.
   > Kjøreposten: id-en i run.step2.
   > Eksempeltekstene: de som kjøringen skriver ut, ferdig utfylt. Ta med teksten for det ene selskapet som har kapitalgap, også hvis den ikke er blant eksemplene. Sjekk hver tekst mot reglene:
   > ingen anbefaling;
   > resultatgap og kapitalgap er aldri lagt sammen eller rangert mot hverandre;
   > rangord bare ved sitt eget kapitalgap;
   > ingenting om andre år eller trender.
   > Hva prøvekjøringen ikke dekker: si i rapporten, i sesjonsfilen og i PR-en at kapitalgap-teksten bare er prøvd på én tekst, og legg det som et punkt for 4.3.
   > Ingen orgnr. Ikke i rapporten, sesjonsfilen eller PR-en.
   > PR-teksten. Nevn at endringen i ingest/tests/test_run_record.py flytter reader_commit, så pnpm analysis:seed-documents melder referansedokumentene som lest av en eldre versjon til neste --reread.
   >
   > Ikke push før jeg sier fra.

## What came back, and what was done with it

### Rebase and spec

- **Rebase:** `story/4.1-explanations-batch` was rebased on `8df1e63`. One conflict, in `deferred-work.md`: main's Story 5.7 entry was kept, with the two new entries after it.
- **Checked before showing the spec:** demo A's values were read on demo A's analysis page in the built app ("(13,3 % − 3,4 %) × 21 473 080 kr ≈ 2 125 096 kr per år", Største kapitalgap Arbeidskapital, Største styrke Varekostnadsandel). The cited tests were checked to exist on main. "Entry 205", a line number, was replaced by a stable reference.
- **Corrected by the review session (prompt 2):** the I/O matrix lacked rows for six guards the spec itself described: the digest, the stored columns, the run record, the same choice as the page, the key, and the wording counts. Also, the `WHERE false` entry had two possible owners. Both were fixed in `0dde614`.
- **Corrected during the build:** the acceptance criterion said `--plan` "writes nothing", while the approved matrix row requires a run record. The criterion was reworded, with a change-log entry (`1361539`).

### Implementation (subagent, then read against the diff)

- **Commits:**
  - `5993045`: the model client is generic over each step's params, and a failed response carries its usage (entry from PR #54's review).
  - `d06c90a`: the payload, slot table and digest.
  - `4224031`: migration, seed wiring, re-export.
  - `f0fc9a0`: `pnpm explain`.
  - `7ac5672`: docs.
  - `6cbdcc9`: `PRICE_DATE` 2026-11-27.
- **Guards:** for every matrix row the subagent removed the guard and showed the failing output. Two first attempts did not fail and were replaced: the strength sort (demo A's first strength is also first in figure order, so the tie order is reversed instead), and the run-record wrapper (the store's run-record methods are replaced with no-ops instead).
- **Read in the diff:** the "same choice" test takes its expected values from `strengthCard` and `largestCapitalGap`. Its branches are on the hand-written table only.
- **Full verification (AGENTS.md "Testing"):** every step passed.
  - unit: 2 184;
  - db: 223;
  - ingest: 392;
  - e2e: chromium 209, db-down 7, synthetic 31.
- **Local database:** the first `seed:export` refused because of the restored dump rows. The subagent removed exactly the rows of `.local/document-run-5.4/` from the local database, exported, and put them back with `pnpm restore:documents` (2 785 documents, 5 556 columns, as after Story 5.4). No dump was deleted. The refusal printed orgnrs to the subagent's terminal only.

### The sample run

- **Price:** read again on 2026-11-27 from https://platform.claude.com/docs/en/about-claude/pricing. On the Batch API, Claude Haiku 5.5 costs $0.05 in and $0.25 out per MTok for prompts up to 100 000 tokens, unchanged since 2026-11-08. `--plan --sample 20` before and after `6cbdcc9` differ only in the date. The ceiling is $0.0065, and the plan runs were run.step2 ids 165 and 178.
- **Run:** `pnpm explain --sample 20 --max-usd 0.05`, **run.step2 id 181**.
  - **Outcome:** 20 sent, **13 explained, 7 failed, all `digit_outside_slot`**. There was no `stop_max_tokens`, `unknown_slot` or `malformed_slot`. Exit 1, as designed when a row fails.
  - **Tokens:** 15 720 in and 4 496 out, thinking included. The central estimate was 21 400 in and 5 000 out; the high one 29 200 in and 12 000 out.
  - **Cost:** 15 720 × $0.05/M + 4 496 × $0.25/M = **$0.0019**, against a ceiling of $0.0065.
- **The company with capital gaps:** one sample company had capital gaps (omløpshastighet driftseiendeler and leverandørgjeldsdager). Its answer was among the seven refused (`digit_outside_slot`), and a refused answer's text is not stored. **The capital-gap wording is therefore not tried on any stored text.** No stored template uses a rank slot. Deferred to Story 4.3 (`deferred-work.md`).
- **The three examples the run printed**, filled in:
  1. "Driftsmargin er 9,6 %, mot en medianverdi i sammenligningsgruppen på −25,0 %, og selskapet ligger over medianen (bedre enn 66 % av 330 sammenlignbare selskaper). Gapet er 4 999 kr per år. Det finnes ingen engangsforskjeller i kapital å melde. Som styrke viser totalkapitalrentabiliteten 7,2 % mot en median på −4,5 %, altså over medianen (bedre enn 77 % av 330 selskaper), med beste verdi i gruppen på 5,4 %. Merk: Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen."
  2. "Sammenlignet med 744 selskaper i samme bransje for 2025 ligger driftsmarginen til selskapet på −69,0 %, som er under medianen medianen på 3,8 % og bedre enn 11 %. Forskjellen tilsvarer et årlig resultatgap på 5 720 165 kr i forhold til medianen, mens det beste selskapet har 17,4 %. Det er ikke identifisert noen kapitalgap eller styrker i sammenligningen. Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen."
  3. "Driftsmargin for selskapet er −25,8 %, mot en median på 1,8 % blant 1036 sammenlignbare selskaper, og det ligger under medianen med plassering bedre enn 23 %. Den årlige resultatforskjellen til medianen er 516 708 kr, mens den beste i gruppen har 18,7 %. Det er ingen kapitalforskjeller eller styrker å trekke frem for 2025. Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen."
- **Checked against the four rules:** all 13 stored texts, the three above included.
  - **No recommendation:** holds in all 13.
  - **Profit and capital gaps never added or ranked against each other:** holds. No stored text names a capital gap, so the rule is only tested in texts that say there is none.
  - **A rank word only by its own capital gap:** no rank word is used, so this is untested (see above).
  - **Nothing about other years or trends:** holds. The texts name only the filing year.
- **Wrong in every text, and caught by none of the template checks:**
  - **The `beste` slot is the best quartile, but the model calls it the best company:** "den beste i gruppen har 18,7 %", "beste selskap har 3,8 %". In example 1 the best value (5,4 %) is below the company's own (7,2 %), which reads as a contradiction.
  - **The kroner gap is to the best quartile, but the model says it is to the median:** "resultatgap … i forhold til medianen", "Den årlige resultatforskjellen til medianen", in examples 2 and 3 and four other texts. The page says "ved full tilnærming til beste fjerdedel".
  - **The direction slot doubles "medianen":** its text already says «over medianen», and six texts add another "medianen" after it ("under medianen medianen på 3,8 %").
  - **Cause:** the payload gives each slot's text but not what it means. The slot ids `beste` and `gap` say nothing about the best quartile. These are phrase errors, not figure errors: every number is the engine's. They are Story 4.3's to test, but the prompt and payload need fixing before any full run. That is put to Meinich, not decided here.
- **Not diagnosed:** what the seven refused answers wrote as digits. The run keeps neither their text nor the batch's results. Reading the paid batch's results again would show it at no model cost, but it needs the key, so it waits for Meinich.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-4-1-explanations-generated-in-batch.md` (Spec Change Log, Sample run plan).
- Deferred: `_bmad-output/implementation-artifacts/deferred-work.md`. The new entries are for 4.4 (`not sample`; cost of goods as a strength) and 4.3 (`WHERE false`; the untried capital-gap wording).
- AI log: `docs/ai-log.md`, Story 4.1 entry.
