# Story 4.1: explanations generated in batch

**Date:** 2026-11-27
**Tool:** Claude Code (claude-opus-5-5), `bmad-build`, with one implementation subagent
**Story / issue:** #88, Story 4.1 (FR-52; AD-7, AD-9, AD-13, AD-19)
**Result:** branch `story/4.1-explanations-batch`, not pushed yet (PR to follow); sample runs 181, 185, 193, 195 and 199

## Goal

Build step 2's explanation run, `pnpm explain`: test mode, `--plan`, a stored row per company with its provenance, and one approved sample of 20 companies. The full run is Story 4.3's, after the figure test (4.2) and the phrase test (4.3) guard it.

## Prompts that mattered

The first three are Meinich's; the fourth to seventh are under "Prompt 4" to "Prompt 7" below. The review session's reading of the spec at `b609ce0` is behind the second one.

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

**Review fix after the sample runs (`06a7739`):** `test:db` failed on "the committed seed holds no explanation", because it counted the whole `register.explanation` table and the local sample rows were in it. It now counts the two rows it inserts. `test/db/derive.test.ts` also fails while the 5.4 dump is restored. That is the order AGENTS.md "Testing" expects (step 4 before step 7), and it is not 4.1's.

**What the samples do not cover:** the capital-gap wording is tried on one stored text only, the one company in the sample with capital gaps. The deferred entry for Story 4.3 now says so, and asks for a sample with several capital-gap companies before the full run.


### Prompt 5: bokmål, repeated slot words, and a third sample

Meinich's answer to the report on run 185:

> Svar på rapporten fra kjøring 185 (run.step2 id 185, 20 forklart; tellingene er lest fra register.explanation i den lokale databasen). Rett dette i 4.1:
>
> 1. Forklaringen av feltene på bokmål. slot_fields skal bruke sidens egne ord:
>    - «beste fjerdedel», aldri «kvartil»;
>    - «median»;
>    - «bedre enn», slik keyFigures.placement skriver det.
>    16 av 20 lagrede maler skriver nå «kvartil», og ingen skriver «fjerdedel». Prompten skal si at teksten skrives på bokmål selv om JSON-nøklene er på engelsk.
>
> 2. Dobbeltord som avvisningsgrunn i parseTemplate. Avvis en mal der ordene rett før en slot gjentar starten på slotens tekst, eller ordene rett etter gjentar slutten. Det skal sammenlignes uten å skille store og små bokstaver.
>    - Sjekk mot «bedre enn {{x.plassering}}» (12 av 20 maler nå) og «{{x.retning}} medianen».
>    - Gi grunnen et eget navn i TemplateRefusal.
>    - Legg til en matriserad med test som feiler når regelen fjernes.
>
> 3. antall med sidens frase. Teksten i sloten skal være analysis.peerCount eller analysis.peerCountOne, som i company-header.tsx:53, så modellen ikke bøyer substantivet selv. Tusenskillet blir fortsatt hos 4.2, slik din oppføring sier.
>
> 4. Ny kjøring med de samme 20. Kjør --plan først. Er taket ≤ $0,01, har du ja til pnpm explain --sample 20 --max-usd 0.05 uten ny stopp. Er det høyere, stopp.
>
> 5. Rapporten. Den skal ha med:
>    - 181, 185 og den nye kjøringen side om side;
>    - hvor mange maler som skriver «kvartil», «fjerdedel», «bedre enn bedre enn» og engelsk;
>    - hvor mange som ble avvist for dobbeltord;
>    - om teksten med kapitalgap fortsatt holder reglene.
>
> 6. Til 4.3 i triage-loggen. Disse skal ikke rettes her:
>    - «Driftsmargenen»;
>    - setningen uten verb;
>    - at mangler.dokument blir omskrevet før sloten brukes.
>    Det er arbeid for 4.3 sine frasetester.
>
> Ikke push før jeg sier fra.

**Checked first:** in `register.explanation` (`sample`, explained), 16 of 20 templates had «kvartil», 0 had «fjerdedel», and 12 had «bedre enn {{…plassering}}", as the prompt said.

**The fix:**
- **`16a30ec`:** `slot_fields` is in bokmål, in the page's words («beste fjerdedel», never «kvartil»; «median»; «bedre enn»), with no digit. The `antall` slot's text is `analysis.peerCount` / `analysis.peerCountOne`.
  - Test: `test/explain/payload.test.ts` "writes antall as the page's own phrase".
  - Not covered: the `peerCountOne` case. The committed seed holds no subject with exactly one peer.
- **`9f97ee5`:** `parseTemplate` refuses `repeated_slot_words` when the words right before a slot repeat the start of its text, or the words right after repeat its end, compared without case. The prompt says bokmål although the keys are English, and names the rule.
  - Matrix row and tests: `test/explain/run.test.ts` "refuses … as repeated_slot_words" (six cases) and "keeps words beside a slot that do not repeat its own". All six fail with the rule switched off.
  - The spec's Review Triage Log sends rows 5–7 (the misspelling, the verbless clause, the paraphrased `mangler.dokument`) to Story 4.3, with a deferred entry.

**Run 193** (`--plan` ceiling $0.0080, at most $0.01; the same 20, md5 of the orgnrs unchanged):

| | Run 181 | Run 185 | Run 193 |
|---|---|---|---|
| Explained | 13 | 20 | **9** |
| Failed | 7 (`digit_outside_slot` 7) | 0 | **11** (`stop_max_tokens` 6, `repeated_slot_words` 5) |
| Tokens in | 15 720 | 32 210 | 40 510 |
| Tokens out | 4 496 | 4 160 | 10 515 |
| Cost | $0.0019 | $0.0027 | $0.0047 |
| `--plan` ceiling | $0.0065 | $0.0077 | $0.0080 |

**The words, in run 193's 9 stored templates and its 5 printed refused texts.** The 6 `stop_max_tokens` answers have no text to read.

| | Run 185 (20 stored) | Run 193 (9 stored) | Run 193 (5 refused) |
|---|---|---|---|
| «kvartil» | 16 | 0 | 0 |
| «fjerdedel» | 0 | 8 | 5 |
| «bedre enn bedre enn» (a template's «bedre enn {{…plassering}}») | 12 | 0 | 3 |
| English | 1 | 0 | 1 (a meta-comment: "Let me correct: the text must not repeat slot text beside it. Writing properly: …") |

**Refused for repeated slot words: 5.**
- Three are «bedre enn {{driftsmargin.plassering}}».
- One is «{{antall}} sammenlignbare selskapene», the new page phrase doubled.
- **One is a false refusal:** «… ligger {{driftsmargin.retning}}. Medianen blant de {{antall}} selskapene …». The word after the slot is the start of the next sentence. The rule as written compares across a full stop.

The five refused texts, as the run printed them:

1. "{{driftsmargin.egen}} er under medianen i gruppen, og driftsmarginen ligger langt under beste fjerdedel, som er grensen på {{driftsmargin.beste}}. Ved å nå den grensen ville driftsresultatet øke med {{driftsmargin.gap}} per år, målt mot beste fjerdedel blant {{antall}} selskaper i {{aar}}. Selskapet er bedre enn {{driftsmargin.plassering}} av de sammenlignbare selskapene på driftsmargin, og medianen er {{driftsmargin.median}}. {{mangler.dokument}}"
2. "{{driftsmargin.egen}} er driftsmarginen i {{aar}}, og den ligger {{driftsmargin.retning}}. Medianen blant de {{antall}} selskapene er {{driftsmargin.median}}, mens grensen for beste fjerdedel er {{driftsmargin.beste}}. Selskapet gjør det {{driftsmargin.plassering}} av de sammenlignbare selskapene, og driftsresultatet ville økt med {{driftsmargin.gap}} per år om driftsmarginen nådde grensen for beste fjerdedel."
3. "Driftsmargin ligger over medianen for de {{antall}} sammenlignbare selskapene i {{aar}}, med en egen verdi på {{driftsmargin.egen}} mot en beste fjerdedel-grense på {{driftsmargin.beste}}, og selskapet er {{driftsmargin.plassering}} selskapene. Ved å nå grensen for beste fjerdedel ville driftsresultatet ha økt med {{driftsmargin.gap}} per år, og dette er et gap vi ikke har engangsbeløp for. Et styrkepunkt er totalkapitalrentabiliteten, som er {{totalkapitalrentabilitet.retning}} med {{totalkapitalrentabilitet.egen}}, og den er {{totalkapitalrentabilitet.plassering}} selskapene. {{mangler.dokument}}"
4. "Driftsmargin ligger under grensen for beste fjerdedel: {{driftsmargin.egen}} mot {{driftsmargin.beste}}, og selskapet er {{driftsmargin.retning}}. Et løft til grensen ville gi {{driftsmargin.gap}} mer i driftsresultat per år, og selskapet gjør det bedre enn {{driftsmargin.plassering}} av de {{antall}} i {{aar}}. Totalkapitalrentabiliteten på {{totalkapitalrentabilitet.egen}} er en styrke, {{totalkapitalrentabilitet.retning}}, og den ligger over grensen for beste fjerdedel på {{totalkapitalrentabilitet.beste}}. Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen."
5. "{{driftsmargin.egen}} er under medianen i driftsmargin, og selskapets egen verdi er {{driftsmargin.retning}} ... ⏎⏎Let me correct: the text must not repeat slot text beside it. Writing properly:⏎⏎Driftsmargin for {{aar}} er {{driftsmargin.egen}}, mens medianen blant {{antall}} selskaper er {{driftsmargin.median}}, og selskapet ligger {{driftsmargin.retning}}. Grensen for beste fjerdedel er {{driftsmargin.beste}}, og selskapet gjør det bedre enn {{driftsmargin.plassering}} av de sammenlignbare selskapene. Hvis driftsmarginen nådde grensen for beste fjerdedel, ville driftsresultatet øke med {{driftsmargin.gap}} per år. {{mangler.dokument}}" (⏎ marks a line break in the model's text.)

**The capital-gap text is stored in run 193, and it still holds the four rules:**

> "Driftsmarginen ligger under medianen, med −53,9 % mot en median på 3,2 % blant 545 sammenlignbare. Grensen for beste fjerdedel er 13,4 %, og å nå den ville gi 8 864 839 kr mer driftsresultat per år, så selskapet er bedre enn 13 %. Omløpshastigheten på driftseiendelene er 0,40 mot 2,33 i medianen, og selskapet er bedre enn 7 %; kapitalgapet til beste fjerdedel er 30 443 711 kr i engangsbeløp og er det største kapitalgapet blant kapitalgapene i 2025. Leverandørgjeldsdagene er 21 dager mot 27 dager i medianen, og et gap på 990 382 kr til beste fjerdedel som engangsbeløp gjør dette til nest største kapitalgapet."

- No recommendation.
- The capital gaps are one-off and never added to or ranked against the profit gap.
- Each rank word is by its own gap.
- Nothing about other years or trends; «i 2025» is the filing year.
- **A phrase fault, not a rule fault:** «… per år, så selskapet er bedre enn 13 %» makes the placement follow from the gap. For Story 4.3.

**New in run 193, put to Meinich:**
- **`stop_max_tokens` in 6 of 20.** Output rose from 4 160 to 10 515 tokens. With the longer legend and rules, adaptive thinking uses up `MAX_TOKENS` (1 000) before the text is done. Classify uses 2 000. At 2 000 the ceiling would be about $0.013, above the $0.01 Meinich set.
- **The false refusal across a full stop.** Proposed: a word after `.`, `!` or `?` is not compared, with a test case for «{{x.retning}}. Medianen …» kept.
- **Smaller faults in the stored texts, for 4.3:**
  - three texts begin with a figure or «bedre enn» in lower case;
  - one claims more than the payload says: «Ingen av nøkkeltallene ligger under grensen for beste fjerdedel»;
  - the one-peer text reads `mangler.dokument` as "no figures for the company", where the API figures are there.

### Prompt 6: MAX_TOKENS, the sentence boundary, and a stop rule

> Svar på rapporten fra kjøring 193 (run.step2 id 193: 9 forklart, 11 feilet, stop_max_tokens 6 og repeated_slot_words 5; lest i den lokale databasen).
>
> 1. MAX_TOKENS til 2 000, og behold tenkingen. Kjøring 185 hadde tenking og forklarte 20 av 20, og feilene i 193 er svar som ble kuttet. Oppdater Spec Change Log med begrunnelsen.
>
> 2. Dobbeltord sammenlignes ikke over ., ! eller ?, i begge retninger. Testtilfeller:
>    - «{{x.retning}}. Medianen …» godtas;
>    - «… medianen. {{x.retning}}» godtas;
>    - «bedre enn {{x.plassering}}» avvises fortsatt.
>    Matriseraden skal fortsatt feile når regelen slås av.
>
> 3. Test peerCountOne med en håndlaget analyse med én sammenlignbar. Payload-modulen er ren, så det trengs ikke noe selskap i seeden.
>
> 4. Ny kjøring med de samme 20. Kjør --plan først. Er taket ≤ $0,015, har du ja til pnpm explain --sample 20 --max-usd 0.05 uten ny stopp. Er det høyere, stopp.
>
> 5. Når prøvingen stopper:
>    - Er minst 18 av 20 forklart, og ingen lagret tekst har «kvartil», «bedre enn bedre enn», engelsk eller gap mot medianen, stopper prøvingen i 4.1. Det som gjenstår, går til 4.3.
>    - Er resultatet dårligere, stopp og rapporter før du endrer noe mer.
>
> 6. Rapporten skal ha med:
>    - 181, 185, 193 og den nye kjøringen side om side;
>    - feil per grunn;
>    - antall maler med «kvartil», «fjerdedel», «bedre enn bedre enn» og engelsk;
>    - om teksten med kapitalgap fortsatt holder reglene.
>
> 7. Til triage-loggen, med utsatt oppføring:
>    - Til 4.3:
>      - frasen som lar plasseringen følge av gapet;
>      - «Ingen av nøkkeltallene ligger under grensen …», som sier mer enn payloaden;
>      - at mangler.dokument leses som at selskapet ikke har tall i det hele tatt;
>      - modellens egen kommentar på engelsk i en tekst («Let me correct: …»).
>    - Til 4.4: stor forbokstav når en setning begynner med en slot. Den løses der kortet fyller inn malen (lowerFirst finnes i format.ts), ikke i prompten.
>
> Ikke push før jeg sier fra.

**Done:**
- **`126a941`:** `MAX_TOKENS` is 2 000, and thinking stays. The Spec Change Log gives the reason.
- **`ba60bf7`:** repeated slot words are compared only within the slot's sentence, in both directions. Prompt 6's three cases are tests.
  - **Corrected by the BMAD session:** prompt 6's «… medianen. {{x.retning}}» would be kept even without the boundary, since «medianen» is not the start of the direction text. So the BMAD session added a case that does cross a full stop backwards, «… bedre enn. {{driftsmargin.plassering}} …». Meinich confirmed this in prompt 7. After run 195 that case became a refusal under `placement_without_bedre_enn`, so the backward case now uses the rank slot: «Slik er det. {{arbeidskapital.rang}} …».
  - All three keep-cases that cross a boundary fail with the boundary removed. The six refuse-cases still fail with the rule off.
- **`0c5606a`:** `peerCountOne` is tested with demo A against only one peer, giving «1 sammenlignbart». The test fails with the one-peer branch removed.
- **The triage log and deferred entries:** rows 8–14, with four entries for Story 4.3 and one for Story 4.4.
  - `src/engine/format.ts` has `lowerFirst` but no upper-casing counterpart, so the 4.4 entry says the card adds one.

**Run 195** (`--plan` ceiling $0.0130, at most $0.015; the same 20, md5 of the orgnrs unchanged):

| | Run 181 | Run 185 | Run 193 | Run 195 |
|---|---|---|---|---|
| Explained | 13 | 20 | 9 | **9** |
| `digit_outside_slot` | 7 | 0 | 0 | 0 |
| `stop_max_tokens` | 0 | 0 | 6 | **0** |
| `repeated_slot_words` | – | – | 5 | **10** |
| `unknown_slot` | 0 | 0 | 0 | 1 |
| Tokens in | 15 720 | 32 210 | 40 510 | 40 510 |
| Tokens out | 4 496 | 4 160 | 10 515 | 7 627 |
| Cost | $0.0019 | $0.0027 | $0.0047 | $0.0039 |
| `--plan` ceiling | $0.0065 | $0.0077 | $0.0080 | $0.0130 |

(`repeated_slot_words` did not exist before run 193.)

**The stop rule (prompt 6, point 5):** at least 18 of 20 explained is not met. Run 195 explained 9. **The trial stops here, and nothing more is changed before Meinich decides.**

**The words, in the stored templates:**

| | Run 185 (20) | Run 193 (9) | Run 195 (9) |
|---|---|---|---|
| «kvartil» | 16 | 0 | 0 |
| «fjerdedel» | 0 | 8 | 8 |
| «bedre enn bedre enn» | 12 | 0 | 0 |
| English | 1 | 0 | 0 |
| a gap to the median | 0 | 0 | 0 |

**Every one of the 10 refusals for repeated words is «bedre enn {{…plassering}}»**, all correct; none is across a sentence end. The model writes «bedre enn» before the placement slot even though the legend and the prompt forbid it: run 185 did it in 12 of 20 without the rule, run 195 in 10 of 20 with it. The one `unknown_slot` is `{{retning}}` with no figure. Two refused texts say «høyere-er-bedre», the item's `better` translated literally. One refused text carries its own correction in Norwegian («Retningen skal ikke gjentas, så riktig tekst er: …»).

**The capital-gap text was refused in run 195** (`repeated_slot_words`, for «bedre enn {{driftsmargin.plassering}}»):

> "Driftsmarginen ligger under medianen på {{driftsmargin.egen}} mot {{driftsmargin.median}} i median, og selskapet er bedre enn {{driftsmargin.plassering}} av {{antall}} i {{aar}}. Gapet til beste fjerdedel er {{driftsmargin.gap}} per år. Det største engangsgapet i kapital er omløpshastigheten på driftseiendeler, som ligger {{oml.retning}} med {{oml.egen}} mot median {{oml.median}}, og er {{oml.plassering}}; gapet til beste fjerdedel er {{oml.gap}}, {{oml.rang}}. Leverandørgjeldsdager er {{lgd.egen}} mot median {{lgd.median}}, {{lgd.retning}}, og gapet til beste fjerdedel er {{lgd.gap}}, {{lgd.rang}}."

Against the four rules it holds:
- no recommendation;
- the capital gaps are one-off, never added to or ranked against the profit gap ("Det største engangsgapet i kapital" ranks only among them);
- each rank word stands by its own gap;
- nothing about other years.

It was refused only for the doubled «bedre enn».

**Other faults in the stored texts, already triaged:** «Ingen av nøkkeltallene ligger under grensen …» again (row 11, Story 4.3). Texts starting with a slot in lower case or with a figure (row 14, Story 4.4). One text drops «av» after avoiding the double: «bedre enn 97 % de sammenlignbare selskapene».

### Prompt 7: the placement slot, and 4.1's last run

> Alternativ 1, med en regel i koden i tillegg (run.step2 id 195: 9 forklart, repeated_slot_words 10, unknown_slot 1; lest i den lokale databasen).
>
> 1. Plasseringssloten blir bare prosenten («66 %»), laget med format.ts som før. Leseren ser fortsatt «bedre enn 66 %», ordrett som keyFigures.placement.
>    - Ny avvisningsgrunn i parseTemplate: hver {{x.plassering}} må stå rett etter «bedre enn» i samme setning, uten å skille store og små bokstaver. Ellers avvises malen. Gi grunnen et eget navn i TemplateRefusal.
>    - Testtilfeller:
>      - «bedre enn {{x.plassering}}» godtas;
>      - «blant de {{x.plassering}} beste» avvises;
>      - «bedre enn. {{x.plassering}}» avvises.
>    - Ny matriserad med test som feiler når regelen slås av.
>    - Oppdater slot_fields og prompten så de sier at modellen skriver «bedre enn» foran plasseringen.
>    - Skriv beslutningen og begrunnelsen i Spec Change Log: modellen skrev «bedre enn» i 12 av 20 tekster uten regelen og 10 av 20 med den, og det leseren ser, er uendret.
>
> 2. Kreditering i sesjonsfilen: testtilfellet du la til for punktum bakover, «… bedre enn. {{driftsmargin.plassering}} …», er din rettelse. Mitt tilfelle, «… medianen. {{x.retning}}», ville blitt godtatt uansett.
>
> 3. Siste kjøring i 4.1, på de samme 20. Kjør --plan først. Er taket ≤ $0,015, har du ja til pnpm explain --sample 20 --max-usd 0.05 uten ny stopp. Er det høyere, stopp. Etter denne kjøringen gjør du ingen flere prompt-endringer eller kjøringer i 4.1, uansett resultat. Det som gjenstår, går til 4.3 med utsatt oppføring.
>
> 4. Til triage-loggen for 4.3:
>    - {{retning}} uten nøkkeltall foran (unknown_slot);
>    - «høyere-er-bedre», en direkte oversettelse av better;
>    - andelen avviste maler i den siste kjøringen. 4.3 trenger en plan for hvordan avviste rader sendes på nytt i hele kjøringen, siden decideWork bare regner forklarte rader som uendret.
>
> 5. Rapporten skal ha med:
>    - alle fem kjøringene side om side;
>    - feil per grunn;
>    - ordtellingene som før;
>    - om teksten med kapitalgap er lagret og holder reglene.
>    Etter det går du videre til review-steget og sesjonsfilen.
>
> Ikke push før jeg sier fra.

**Done:**
- **`223be1b`:** the placement slot's text is only the percent (`formatWholePercent`, as the table uses inside `keyFigures.placement`), and `slot_fields` says to write «bedre enn» before it. Test: `test/explain/payload.test.ts` "writes the placement slot as only the percent, so the template supplies «bedre enn»".
- **`8bd3324`:** `placement_without_bedre_enn` in `parseTemplate`, with the prompt rule and the stored test response corrected to «bedre enn {{vare.plassering}}».
  - Tests: six cases in `test/explain/run.test.ts` ("a placement slot right after «bedre enn» in its sentence: …"). Four of them fail with the rule off.
  - The repeated-words tests that used the placement slot now use `egen` («{{driftsmargin.egen}} %») and `retning` in upper case.
  - Matrix row and Spec Change Log entry.
- **Checks:** lint, typecheck, unit tests (2 210) and `test/db/explanation.test.ts` (12) are green.
- **`--plan`:** the ceiling was $0.0130, at most $0.015.

**Run 199, 4.1's last** (the same 20, md5 of the orgnrs unchanged):

| | Run 181 | Run 185 | Run 193 | Run 195 | Run 199 |
|---|---|---|---|---|---|
| Explained | 13 | 20 | 9 | 9 | **17** |
| `digit_outside_slot` | 7 | 0 | 0 | 0 | 0 |
| `stop_max_tokens` | 0 | 0 | 6 | 0 | 0 |
| `repeated_slot_words` | – | – | 5 | 10 | 0 |
| `unknown_slot` | 0 | 0 | 0 | 1 | 0 |
| `placement_without_bedre_enn` | – | – | – | – | 3 |
| Tokens in | 15 720 | 32 210 | 40 510 | 40 510 | 41 080 |
| Tokens out | 4 496 | 4 160 | 10 515 | 7 627 | 5 999 |
| Cost | $0.0019 | $0.0027 | $0.0047 | $0.0039 | $0.0036 |
| `--plan` ceiling | $0.0065 | $0.0077 | $0.0080 | $0.0130 | $0.0130 |

(– : the refusal did not exist yet.) Five sample runs together cost $0.0168.

**The words, in the stored templates:**

| | 185 (20) | 193 (9) | 195 (9) | 199 (17) |
|---|---|---|---|---|
| «kvartil» | 16 | 0 | 0 | 0 |
| «fjerdedel» | 0 | 8 | 8 | 15 |
| «bedre enn bedre enn» | 12 | 0 | 0 | 0 |
| English | 1 | 0 | 0 | 0 |
| a gap to the median | 0 | 0 | 0 | 0 |

**Meinich's threshold:** 18 of 20 explained, with no stored «kvartil», «bedre enn bedre enn», English or gap to the median. The words hold; 17 of 20 does not. As prompt 7 decided, this was 4.1's last run.

**The three refused texts of run 199** (`placement_without_bedre_enn`, each correct):
1. "{{driftsmargin.egen}} er selskapets driftsmargin i {{aar}}, {{driftsmargin.retning}}, og {{driftsmargin.plassering}} ... ⏎⏎Rettere: Selskapets driftsmargin i {{aar}} er {{driftsmargin.egen}}, som er {{driftsmargin.retning}}, og det gjør det bedre enn {{driftsmargin.plassering}} av de {{antall}} selskapene i analysen. Driftsmarginen ville øke med {{driftsmargin.gap}} per år om den nådde grensen for beste fjerdedel på {{driftsmargin.beste}}. Det er ingen styrker å fremheve i denne analysen, og {{mangler.dokument}}"
2. "Driftsmargin for {{aar}} er {{driftsmargin.egen}}, som er {{driftsmargin.retning}} og {{driftsmargin.plassering}} er ikke et tall vi skal skrive; i stedet: blant {{antall}} selskaper er selskapet bedre enn {{driftsmargin.plassering}}, hvilket betyr at driftsmarginen er {{driftsmargin.retning}}."
3. "Ingen gap ble funnet for {{aar}} blant {{antall}} selskaper. Driftsmargin er {{driftsmargin.egen}}, {{driftsmargin.retning}}, og det er {{driftsmargin.retning}} noe som gir en plassering på {{driftsmargin.plassering}}, altså bedre enn {{driftsmargin.plassering}} av de sammenlignbare selskapene. Grensen for beste fjerdedel ligger på {{driftsmargin.beste}}.⏎⏎{{mangler.dokument}}"

**The capital-gap text is stored in run 199, and it holds the four rules:**

> "2025-tallene for driftsmargin ligger under medianen, med en egen verdi på −53,9 % mot en median på 3,2 % blant 545 sammenlignbare. Driftsmargin er bedre enn 13 % av selskapene, og et løft til beste fjerdedel, som er 13,4 %, ville gi 8 864 839 kr mer driftsresultat per år. Omløpshastigheten for driftseiendeler ligger under medianen, med 0,40 mot beste fjerdedel på 4,85, og det gir 30 443 711 kr i kapital som frigjøres én gang; dette er det største kapitalgapet. Leverandørgjeldsdager ligger under medianen, med 21 dager mot beste fjerdedel på 52 dager, og det gir 990 382 kr i engangskapital, nest største kapitalgapet."

- No recommendation.
- The profit gap is per year, and the capital gaps are one-off, never added to or ranked against it.
- Each rank word stands by its own capital gap.
- Nothing about other years or trends; «2025-tallene» is the filing year.

**The three examples run 199 printed** are texts 14, 11 and 4 of the stored 17, in the session's numbering:
1. "Driftsmarginen til selskapet ligger på −879,1 % i 2025, og det er under medianen. Grensen for beste fjerdedel blant 494 sammenlignbare er 34,1 %, og selskapet gjør det bedre enn 10 % av gruppen. Et gap til denne grensen tilsvarer 428 454 kr i driftsresultat per år. Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen."
2. "Ingen gap er beregnet for 2025, så det er ingen gap å nevne mot beste fjerdedel. Driftsmargin ligger over medianen og er høyere enn grensen for beste fjerdedel, med egen verdi 31,3 % mot 0,1 % for medianen og 23,2 % for beste fjerdedel; selskapet gjør det bedre enn 79 % av de 866 sammenlignbare selskapene. Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen."
3. "13,6 % driftsmargin i 2025 ligger over medianen, og selskapet er bedre enn 66 % av 1080 sammenlignbare selskaper. For å nå grensen for beste fjerdedel, som er 21,8 %, ville driftsresultatet øke med 140 934 kr per år. Dokumenttall for selskapet er ikke med i datasettet."

**Left for Story 4.3** (Review Triage Log rows 15–18, with a deferred entry):
- the refused share, 3 of 20, and a plan for sending refused rows again in the full run;
- `{{retning}}` with no figure;
- «høyere-er-bedre»;
- a meta sentence about what the company «bør gjøre»;
- the self-correction «Rettere: …»;
- the own value written twice in one sentence.

Already triaged and seen again:
- `mangler.dokument` paraphrased and not used (text 3 above; row 7);
- «Ingen av nøkkeltallene ligger under grensen …» (row 11);
- a sentence starting with a figure (row 14, Story 4.4).

## Guards removed

The implementation subagent removed the guard for each I/O-matrix row and showed the named test failing. Afterwards it restored the code with `git checkout` or by restoring the database object. The rows added later in the session (refused texts, the legend, `repeated_slot_words`, the sentence boundary, `peerCountOne`, `placement_without_bedre_enn`) were checked the same way by the BMAD session; each section above names its test.

| Row | Guard removed | Failing output |
|---|---|---|
| Demo A payload | strength sort (tie order reversed) | "demo A's payload": strengths array not equal |
| API-only subject | `mangler.dokument` note | "expected [] to deeply equal [ { id: 'mangler.dokument' … } ]" |
| Forbidden fields | `subject` added to the payload | three cases fail; the key Set is not equal |
| Digit outside slot | `DIGIT` check | "expected +0 to be 1" (exit code) |
| Unknown slot | `known.has` check | "Error: no slot driftsmargin.foo" |
| Empty group | per-reason count | `toMatchObject` on the counts fails |
| Over cap | ceiling check | "promise resolved "+0" instead of rejecting" |
| Sample draw | labelled-set filter | "expected [ '<test orgnr>' ] to deeply equal []" |
| Test mode | stored client yields nothing | "expected 1 to be +0" |
| Failed response (classify) | usage counting | "expected +0 to be 30" |
| Failed response (explain) | usage counting | "expected +0 to be 1800" |
| Deletion (ingest) | the test's explanation insert | "AssertionError: register.explanation / assert 0 > 0" |
| Deletion (database) | FK without cascade | "violates foreign key constraint explanation_orgnr_fkey" |
| Grants | `REVOKE UPDATE` from derive | ACL arrays not equal |
| Seed | `WHERE false` | "expected [ [ '<test orgnr>', … ] … ] to deeply equal []" |
| Request path | a `src/` file naming `scripts/explain/run.ts` | the key-boundary regex matches |
| Digest: peer / value / text | each input left out of the digest | "not to be 'e11308…'" / "'5cc6df…'" / "'e66f99…'" |
| Stored columns | settings out of the prompt hash; dataset hard-coded | "expected '3e26d4…' to be 'c01915…'"; "expected 'demo' to be 'full'" |
| Run record: `--plan`, run | the store's run-record methods made no-ops | "expected [] to have a length of 1 but got +0" |
| Run record: refused run | `endRun` in the catch | "expected undefined to be 'Error: no dataset is loaded…'" |
| Run record: database | mode check without `explain` | "violates check constraint step2_mode_check" |
| Same choice | capital sort by figure order only; strength tie order reversed | demo B and demo A arrays not equal |
| Key | `NoModelKey` check; a log line printing the key | not an instance of NoModelKey; the output contains the marker |
| Wording counts | direction line removed from `--plan` | the plan lines do not include "  direction words: …" |

The subagent replaced two first attempts that did not fail:
- **The strength sort:** removing it did not fail the test, because demo A's first strength is also first in figure order. The guard reverses the tie order instead.
- **The run-record wrapper:** replacing it broke the call rather than the record. The guard makes the store's run-record methods no-ops instead.

## Review

- **Diff:** from `8df1e63` to `dd5f72f`, 331 kB, reviewed by three layers: Blind Hunter, Edge Case Hunter and Verification Gap. The BMAD session checked each finding against the code before its verdict.
- **Triage:** the spec's Review Triage Log, rows R1–R26, records the verdict and route of every finding.
- **Credit:** every finding is the review layer's (BH, EC or VG). The verdicts are the BMAD session's.

**Fixed (patch):**
- **R1–R5** (VG; R2 also BH): tests for `decideWork` over stored rows, the resume path, the sample draw with empty and no-filing subjects, the digest's subject, year and band, and the store's run-record SQL.
- **R6** (BH): `promptHash()` now covers `SLOT_FIELD_MEANINGS`, so a legend change makes the stored rows stale.
- **R7, R8** (BH): AGENTS.md and `docs/ai-log.md` brought up to date.
- **R9–R12** (BH): the spec's stale lines, this file's links and review section, `epic-4` in `sprint-status.yaml`, and the Epic 3 retro row for action 9.

**Deferred to Story 4.3** (`deferred-work.md`):
- **R14** (BH): coverage of what a template must name.
- **R16** (EC): an expired pending batch blocks later runs.
- **R17** (EC): pending rows are written outside a transaction.

**Put to Meinich, and decided by him (prompt 8):**
- **R13** (EC, BH), deferred to 4.3: `orgnr` alone keys `register.explanation`, so a sample run, a pending write or a failed rerun can overwrite a good full-run row. 4.3 decides the key and write rule, and until then no sample run follows a full run.
- **R15** (BH), deferred to 4.3: no note for the document states other than `not_in_dataset`. Each gets one in the page's words, and a text never says «ingen kapitalgap» when capital figures are missing.
- **R25** (BH), patched: Story 5.5 commits the explanations to the seed, and 4.3 makes the full run. AGENTS.md, the deferred entry, the comments in `scripts/seed-format.ts`, `scripts/seed-export.ts` and `test/db/seed.test.ts`, the AI log and the spec now say so.

**Rejected:**
- **R18–R22** (EC, BH): low, and unlikely in everyday use. Each fix would add a guard.
- **R23** (BH): false. The 4.3 entry already requires every row to pass the phrase test before any export.
- **R24** (BH): false. The page does not exclude dissolved companies either.
- **R26** (BH): false. That requirement is the epic's, not 4.1's.

**The review fixes:** made by the implementation subagent in `9241e95`, `2b2ee2b`, `5ecf4cb`, `d340431`, `3d1c3dd`, `7bae11c`, `2475b58` and `8a60830`, each test checked by removing its guard once.
- **Raised by the subagent:** `docs/ai-log.md`'s rule says an entry is never edited afterwards, and `8a60830` edits the 4.1 entry.
- **The BMAD session kept the edit:** that entry was written in this branch (`7ac5672`) and has never been on `main`, so it is corrected before it is published. Meinich agreed in prompt 8. The R25 correction (5.5, not 4.3) edits the same entry for the same reason.

**Full verification after the review fixes** (AGENTS.md "Testing"):
1. pins, env, lint, typecheck: pass.
2. Unit tests: 2 221 pass.
3. `pnpm seed` twice, then `pnpm seed:export`: `git status seed/` is clean. The reload also removed the 20 local sample rows; their reports are above.
4. `test:db`: 224 pass. `test:ingest`: 392 pass.
5. `pnpm build` and `check:routes`: pass.
6. **E2e did not complete.** Claude Code stopped the run during the chromium project because the machine was critically low on memory, and it was not restarted unasked. Neither `src/app` nor `src/components` changed, and the request path's only change is `nb.json`'s six keys. E2e still has to pass, locally or in CI, before merge.
7. `pnpm restore:documents`: 2 785 documents, 5 556 columns, 2 537 fingerprints and 10 371 classification rows, as after Story 5.4.

## Links

- **Spec:** `_bmad-output/implementation-artifacts/spec-4-1-explanations-generated-in-batch.md`. See its Spec Change Log, Sample run plan and Review Triage Log (rows 1–18 from the sample runs, R1–R26 from the review).
- **Deferred:** `_bmad-output/implementation-artifacts/deferred-work.md`. The entries this story adds:
  - **Story 4.2:** the `antall` slot and the header's peer count, written without `format.ts`.
  - **Story 4.3:**
    - the capital-gap wording, tried on one text;
    - run 185's phrase faults (triage rows 5–7);
    - run 193's (rows 10–13);
    - run 195's and 199's (rows 15–18), with a plan for refused rows;
    - the review's R14, R16 and R17.
    - R13, the table's key and write rule; R15, a note for each document state.
  - **Story 5.5:** lift `WHERE false` and commit the stored explanations into the seed, after 4.3's full run.
  - **Story 4.4:**
    - the card reads only `not sample`;
    - cost of goods at 0 % as a strength;
    - upper-casing a sentence that starts with a slot.
- **Resolved:** the entry on a failed response's usage (PR #54's review).
- **AI log:** `docs/ai-log.md`, the Story 4.1 entry.
- **PR:** to follow, once Meinich says to push.
