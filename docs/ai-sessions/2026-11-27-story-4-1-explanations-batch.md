# Story 4.1: explanations generated in batch

**Date:** 2026-11-27
**Tool:** Claude Code (claude-opus-5-5), `bmad-build`, with one implementation subagent
**Story / issue:** #88, Story 4.1 (FR-52; AD-7, AD-9, AD-13, AD-19)
**Result:** branch `story/4.1-explanations-batch`, not pushed yet (PR to follow); sample runs 181 and 185

## Goal

Build step 2's explanation run, `pnpm explain`: test mode, `--plan`, a stored row per company with its provenance, and one approved sample of 20 companies. The full run is Story 4.3's, after the figure test (4.2) and the phrase test (4.3) guard it.

## Prompts that mattered

The first three are Meinich's; the fourth is under "Prompt 4" below. The review session's reading of the spec at `b609ce0` is behind the second one.

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
- **Not diagnosed at first:** what the seven refused answers wrote as digits. The run keeps neither their text nor the batch's results. It was read afterwards (see "The seven refused texts" below).

### Prompt 4: the refused texts, the wording fix, and a second sample

Meinich's answer to the report:

> Svar på de to spørsmålene i rapporten din fra prøvekjøringen (run.step2 id 181):
>
> Les resultatene fra batchen på nytt. Det gjelder batchen fra kjøring 181. Les nøkkelen fra .env, og skriv den aldri ut. Det skal ikke gjøres noe modellkall.
> Skriv de sju avviste tekstene ordrett i sesjonsfilen, uten orgnr. Marker hvert siffer utenfor en slot.
> Skill ut svaret til selskapet med kapitalgap, og vurder det mot de fire reglene.
> Rett ordlyden i 4.1, før PR-en.
> Payloaden skal si hva hvert felt betyr, i en forklaring som står én gang og ikke per slot. Forklaringen skal ikke ha sifre.
> beste er grensen for beste fjerdedel i gruppen, ikke ett selskap.
> gap er kroner per år ved full tilnærming til beste fjerdedel, ikke til medianen.
> Teksten i retning har allerede ordet «medianen», så det skal ikke gjentas etter sloten.
> For en kostnadsandel er lavere bedre, så beste fjerdedel kan ligge under selskapets egen verdi.
> Rett også prompten mot sifrene du fant i punkt 1.
> Legg til en test som viser at forklaringen er med i payloaden. Payload-testen skal fortsatt finne verken orgnr, navn eller registertekst.
> Ny prøvekjøring med de samme 20. Rekkefølgen i sampleOrder er fast, så resultatene kan sammenlignes med kjøring 181.
> Si hvordan kjøringen sender alle 20 på nytt når prompt-hashen er endret.
> Kjør --plan først. Er taket ≤ $0,01, har du ja til pnpm explain --sample 20 --max-usd 0.05 uten ny stopp. Er det høyere, stopp.
> La en prøvekjøring skrive ut hver avviste tekst sammen med grunnen, slik den skriver ut eksemplene. Teksten skal aldri lagres, og orgnr skal aldri vises. Da forklarer neste prøvekjøring seg selv.
> Rapporten. Den skal ha med:
> kjøring 181 og den nye kjøringen side om side: forklart, feilet med grunn, tokens og kostnad;
> om hver av de tre feilene i ordlyden er borte i de lagrede tekstene;
> om teksten med kapitalgap nå er lagret og holder reglene. Hvis ja, rett den utsatte oppføringen for 4.3 til å si det. Hvis nei, vis den avviste teksten.
> Utsatt oppføring. antall-sloten og company-header.tsx:53 bruker String(...) uten tusenskille («1036»), utenom format.ts. Sett 4.4 som eier, med en begrunnelse, eller en annen story du kan begrunne bedre.
>
> Ikke push før jeg sier fra.

### The seven refused texts of run 181

- **How they were read:** from batch 181's results, through the SDK's results endpoint, which is no model call and costs nothing. The key was read from `.env` and never printed; the batch id was read from the run's own output.
- **Numbering:** each text is numbered by its company's place among the 20 sample rows in byte order. No orgnr.
- **Marking:** every digit outside a slot reference is in ⟦…⟧.
- **Every response ended on `end_turn`.** Every refusal is the year or the peer count written as digits: the model copied the `year` or `peer_count` slot's text instead of writing `{{aar}}` or `{{antall}}`.

1. #1: "Sammenligningen med ⟦227⟧ sammenlignbare selskaper for ⟦2025⟧ viser ingen gap i lønnsomhet per år og ingen engangsgap i kapital. Selskapet har sterke sider innen driftsmargin, der egen verdi er {{driftsmargin.egen}} mot medianen {{driftsmargin.median}}, og innen totalkapitalrentabilitet, der egen verdi er {{totalkapitalrentabilitet.egen}} mot medianen {{totalkapitalrentabilitet.median}}. Driftsmargin ligger {{driftsmargin.retning}} og plasserer seg {{driftsmargin.plassering}}, mens totalkapitalrentabiliteten ligger {{totalkapitalrentabilitet.retning}} og plasserer seg {{totalkapitalrentabilitet.plassering}}. {{mangler.dokument}}"
2. #3, **the company with capital gaps**: "Sammenlignet med ⟦545⟧ sammenlignbare selskaper ligger driftsmarginen til {{driftsmargin.egen}} i ⟦2025⟧, som er {{driftsmargin.retning}} (median {{driftsmargin.median}}, beste {{driftsmargin.beste}}, plassering {{driftsmargin.plassering}}). Dette gir et årlig resultatgap på {{driftsmargin.gap}}. Kapitalbindingen er også et gap: omløpshastigheten på driftseiendeler er {{oml.egen}} mot median {{oml.median}}, og gapet er engangsbeløpet {{oml.gap}}, {{oml.rang}}. Leverandørgjeldsdagene er {{lgd.egen}} mot median {{lgd.median}}, med et engangsgap på {{lgd.gap}}, {{lgd.rang}}."
3. #7: "Selskapets driftsmargin for ⟦2025⟧ er {{driftsmargin.egen}}, mot en median på {{driftsmargin.median}} blant {{antall}} sammenlignbare selskaper, og den ligger {{driftsmargin.retning}}. Den beste i gruppen har {{driftsmargin.beste}}, og selskapet er {{driftsmargin.plassering}}. Gapet tilsvarer {{driftsmargin.gap}} per år. Det er ingen kapitalforskjeller eller styrker å trekke frem i denne sammenligningen."
4. #8: "Sammenlignet med ⟦971⟧ selskaper i Peerless-utvalget for {{aar}} ligger driftsmargin for dette selskapet på {{driftsmargin.egen}}, mot en median på {{driftsmargin.median}} og en beste verdi på {{driftsmargin.beste}}. Det gir en plassering {{driftsmargin.plassering}}, og driftsmarginen er {{driftsmargin.retning}}, med et årlig resultatgap på {{driftsmargin.gap}}. Det er ikke identifisert noen kapitalgap eller styrker i sammenligningen. {{mangler.dokument}}"
5. #11: "Sammenlignet med ⟦868⟧ selskaper i utvalget ligger driftsmargin for året {{aar}} på {{driftsmargin.egen}}, mot en median på {{driftsmargin.median}}, og selskapet er {{driftsmargin.retning}} med en plassering {{driftsmargin.plassering}}. Det gir et årlig resultatgap på {{driftsmargin.gap}}, mens beste selskap i utvalget har en driftsmargin på {{driftsmargin.beste}}. Det er ingen kapitalgap å melde, og heller ingen styrker i datagrunnlaget. {{mangler.dokument}}"
6. #12: "Sammenlignet med ⟦969⟧ selskaper i Peerless for ⟦2025⟧ ligger driftsmargin for dette selskapet på {{driftsmargin.egen}}, mot en median på {{driftsmargin.median}}, og er dermed {{driftsmargin.retning}}. Selskapet er {{driftsmargin.plassering}} i gruppen, og det beste selskapet har {{driftsmargin.beste}}. Gapet til medianen utgjør {{driftsmargin.gap}} per år. Det er ikke registrert noen kapitalgap eller styrker for selskapet. {{mangler.dokument}}"
7. #19: "Driftsmargin for selskapet i ⟦2025⟧ er {{driftsmargin.egen}}, mot en median på {{driftsmargin.median}} blant {{antall}} sammenlignbare selskaper, og det er {{driftsmargin.retning}}; selskapet er {{driftsmargin.plassering}} i gruppen, og beste selskap har {{driftsmargin.beste}}. Gapet tilsvarer {{driftsmargin.gap}} per år. Det er ingen kapitalgap eller styrker å melde for {{aar}}. Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen."

**The capital-gap answer (#3) against the four rules:**
- **No recommendation:** holds.
- **Profit and capital gaps never added or ranked against each other:** holds. "Kapitalbindingen er også et gap" sets them side by side, and calls the capital gap a one-off amount.
- **A rank word only by its own capital gap:** holds. `{{oml.rang}}` stands by `{{oml.gap}}`, and `{{lgd.rang}}` by `{{lgd.gap}}`.
- **Nothing about other years or trends:** holds.

It was refused for the year and the count as digits only. Like the others it calls `beste` "beste", and like the stored texts of run 181 it would have read the best quartile as a company.

### The fix

- **`0f0a279`: the payload.**
  - It carries `slot_fields`: what each field means, stated once per payload and holding no digit.
  - `beste` is the best-quartile boundary, never one company. Where lower is better, it can lie below the company's own value.
  - `gap` is to that boundary, never to the median, per year for a profit gap and one-off for a capital gap.
  - `retning`'s text already contains «medianen».
  - `aar` and `antall` are always written as their slot.
  - Each figure item also carries `better` (`higher` or `lower`), so the model can tell a cost share from a margin. The working-capital total has none. That field is the BMAD session's addition: the legend's sentence on cost shares needs to know which items they are.
  - **Tests** (`test/explain/payload.test.ts`):
    - "every field is explained once, with no digit", for demo A, demo B and the API-only subject;
    - "says beste is the best-quartile boundary, gap is to it, and retning holds «medianen»";
    - "names each figure's better direction, and none for the working-capital total".
  - **Register text:** the identity test now also asserts that neither `aktivitet` nor `vedtektsfestet_formaal` is in the payload, whole or as its first words. It did not before.
- **`2cb42f3`: the prompt.** It says to write `{{aar}}` and `{{antall}}`, never a slot's text, and states the `beste`, `gap` and `retning` rules.
- **`2cb42f3`: refused texts.** A sample run prints each refused text with its reason, on one line, with no orgnr. The text is never stored or recorded. Test: `test/explain/run.test.ts` "a sample run prints each refused text with its reason, stores no text and shows no orgnr".
- **Guards:** a digit added to a meaning fails the three legend tests. With the print switched off, the refused-text test fails.

### The second sample: run 185

- **How all 20 are sent again:** `decideWork` (`scripts/explain/plan.ts`) counts a subject as unchanged only when it has an `explained` row with the same analysis digest, model and prompt hash. The fix changes `SYSTEM_PROMPT`, and through it `promptHash()`, so none of run 181's 13 explained rows counts as unchanged. The 7 failed rows never do. `--plan` showed "would send 20; unchanged 0".
- **The same 20 companies:** `sampleOrder` orders by a fixed digest. The md5 of the 20 sample orgnrs in `register.explanation` was the same after run 185 as after run 181.
- **`--plan`:** the ceiling was $0.0077, at most $0.01, so the run followed without a new stop.

| | Run 181 | Run 185 |
|---|---|---|
| Explained | 13 | **20** |
| Failed | 7 (`digit_outside_slot` 7) | 0 |
| Tokens in | 15 720 | 32 210 |
| Tokens out | 4 496 | 4 160 |
| Cost | $0.0019 | $0.0027 |
| `--plan` ceiling | $0.0065 | $0.0077 |

Input roughly doubled: the legend and the longer prompt go with every request. The central estimate for run 185 was 41 700 in and 5 000 out.

**The three wording errors, in the 20 stored texts of run 185** (each text read in full, not only searched):
- **`beste` as one company:** gone in all 20. The texts say "grensen for beste kvartil" or "beste kvartilgrense".
- **The gap as to the median:** gone in all 20. Every gap is to the best-quartile boundary.
- **«medianen» after the direction slot:** gone in all 20.

**The capital-gap text is now stored, and it holds all four rules:**

> "Driftsmarginen for 2025 ligger på −53,9 %, og det er under medianen, med bedre enn 13 % av 545 sammenlignbare selskaper. Å nå den beste kvartilens grense på 13,4 % ville gi et resultat som er 8 864 839 kr høyere per år. Størst kapitalgap finner vi i omløpshastigheten for driftseiendeler, som er 0,40 mot en beste kvartilgrense på 4,85, og en frigjøring på 30 443 711 kr engangsbeløp, det største kapitalgapet. Leverandørgjeldsdagene er 21 dager, under medianen, og et kapitalgap på 990 382 kr engangsbeløp, nest største kapitalgapet."

- No recommendation.
- The profit gap is per year, and the capital gaps are one-off amounts, never added to it. "Størst kapitalgap" ranks only among the capital gaps.
- Each rank word stands by its own capital gap.
- Nothing about other years or trends.

**The three examples run 185 printed:**
1. "Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen. Analysen omfatter 1 sammenlignbare selskap for 2025, og det finnes derfor ingen gap- eller styrkepunkter å beskrive."
2. "Driftsmargin for selskapet i 2025 er −9,2 %, mot medianen 4,7 % blant 868 sammenlignbare selskaper, og selskapet ligger under medianen. Grensen for beste kvartil er 22,2 %, og selskapet gjør det bedre enn bedre enn 27 % av de sammenlignbare selskapene. Avstanden til grensen for beste kvartil tilsvarer 1 424 623 kr per år i driftsresultat. Selskapets dokumenterte regnskapstall er ikke med i datasettet: Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen."
3. "Driftsmargin for selskapet i 2025 er −69,0 %, mot en median på 3,8 % blant 744 sammenlignbare selskaper, og ligger under medianen. Selskapet er bedre enn bedre enn 11 % av de sammenlignbare selskapene. Grensen for den beste kvartilen er 17,4 %, og avstanden til den er 5 720 165 kr per år i driftsresultat. Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen."

**The four rules in all 20 stored texts:**
- **No recommendation:** holds in all.
- **Profit and capital gaps never added or ranked against each other:** holds. Only the capital-gap text names capital gaps.
- **A rank word only by its own capital gap:** holds in the one text that has rank words.
- **Nothing about other years or trends:** holds.

**New wording errors in run 185, which no template check catches:**
- **"bedre enn bedre enn" (12 of 20):** the `plassering` slot's text already begins with «bedre enn», as `retning`'s already ends in «medianen». The legend says its text is "complete as written", which is not enough.
- **Text partly in English (1 of 20):** "Driftsmargins gap to the best quartile is 226 332 kr per year, since the company's own value of 17,7 % is over medianen …". The legend is in English, and the model followed it once.
- **Smaller errors:**
  - "1 sammenlignbare selskap" (the count is 1);
  - "Driftsmargenen" (misspelled, twice in one text);
  - one sentence whose clause has no verb ("Kvartilgrensen for de beste ligger på 24,0 %, og bedre enn 42 %");
  - one text that paraphrases `mangler.dokument` and then uses it.

These are put to Meinich. They are phrase errors, not figure errors: every number is the engine's.

**What the samples do not cover:** the capital-gap wording is tried on one stored text only, the one company in the sample with capital gaps. The deferred entry for Story 4.3 now says so, and asks for a sample with several capital-gap companies before the full run.


## Links

- Spec: `_bmad-output/implementation-artifacts/spec-4-1-explanations-generated-in-batch.md` (Spec Change Log, Sample run plan).
- Deferred: `_bmad-output/implementation-artifacts/deferred-work.md`. The new entries are for 4.4 (`not sample`; cost of goods as a strength) and 4.3 (`WHERE false`; the untried capital-gap wording).
- AI log: `docs/ai-log.md`, Story 4.1 entry.
