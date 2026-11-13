# Story 2.6: classification, funnel stage 5

**Date:** 2026-11-08 to 2026-11-13
**Tool:** Claude Code (Opus 5.5, BMAD build), checked by Meinich's separate review session
**Story / issue:** #51, Story 2.6 (FR-11 to FR-14, FR-73)
**Result:** branch `story/2.6-classification-stage-5`, seed `77b8813`. PR [#54](https://github.com/IBE160-2026/G97-meinich/pull/54).

## Goal

Classify every AS in `62.100` from its register text with a model in batch step 2, store the result with its provenance, combine it with the fingerprint at funnel stages 4 and 5, and put the classifications in the seed, without any model call in the request path and without a key in a fresh clone.

## Prompts that mattered

- Meinich, at the start: "Ingen modellkall, verken prøve eller full kjøring, før jeg har sett kostnadsanslaget for den kjøringen og sagt OK. Dette gjelder hver kjøring for seg. Nøkkelen setter jeg selv, og den skal aldri stå i en commit eller i en logg. Jeg kjører selv de ekte kjøringene."
- Meinich, on blinding: the 720 pairs in the labelled set were not yet labelled, so no classification or fingerprint per orgnr for the 845 companies in `analysis/labelled-set/document-run.json`, anywhere; totals only. The prompt and the categories were not to be tried or tuned on them, and the label files were not to be opened.
- Meinich, after the BMAD session had run `pnpm classify --sample 300 --max-usd 0.01` itself to see it refuse without a key: "Du kjører ikke pnpm classify igjen med noe annet enn --plan, uansett flagg. Det gjelder også kjøringer du regner med stopper av seg selv."
- Meinich, after sample run 14: log the batch id right after submission, before any row is written, with a test; tighten the prompt on those 300 companies only.
- Meinich, on the prompt: "begrens produkt til programvare [...] Fysiske produkter blir annet", two general phrases added to the `uklart` list, no company names in the prompt, and "Etterpå står prompten fast til full kjøring, og den endres ikke etter at fasitsettet er målt."
- Meinich, after sample run 17: "Jeg lar prompten stå som bestemt: uklart tar ingen ut av gruppa, og andelen måles i Story 5.2."
- Meinich, after full run 18: the seed sequence of Story 2.5c (steps 3-9), the full suite, then the PR. Also two points from Bård Pettersen's PRD feedback of 2026-11-12 that 2.6 settles: FR-11's answer set with testable consequences, and the measured cost in §8.

## What came back, and what was done with it

- **Accepted:** an identical `aktivitet` and `vedtektsfestet_formaal` is sent once (the review session found 2 236 of 10 327 AS with identical text during Story 2.6a). `uklart` is the abstention, stored as `classified` with no type, not a fifth type. A classification is AS only, and FR-73, the PRD and the technical note say so.
- **Corrected by Meinich:** the BMAD session ran `pnpm classify` with a cap of $0.01 to watch it refuse without a key, without an OK for that run. Nothing was sent or written, but it broke the rule, and the rule was tightened to `--plan` only.
- **Corrected after run 14:** the batch id was written to the terminal only after the rows; an interrupted run would have lost it (`2a3bb91`, `test/classify/run.test.ts` "logs the batch id after submitting and before any row is written").
- **Prompt, on the 300 sample companies only:** run 14 gave `produkt` 126 of 300, too many general texts read as a product. The categories were limited (`47d4675`).
- **Found by the review session after run 17:** the BMAD session expected about 75 `produkt` and 140 `uklart`; run 17 gave 45 and 163. The review session read the `uklart` texts: an estimated 20-25 of the 163 concretely describe a software product of the company's own, and the model answers differently on nearly identical texts. Meinich let the prompt stand (spec change log, `1c30dd2`).
- **Found by the BMAD session in the seed sequence:** `pnpm seed` printed the wrong latest run record, because `latestRunRecord` ordered by its text alias. Fixed with a database test that fails without the fix (`869a82c`). Two tests that list the seed files lacked `classification.csv` (`4af1694`, `8045ca1`).
- **Seed:** 10 371 classification rows (`77b8813`), exported after the document rows outside the allow-list were removed; `.local/document-run-2.5d/` restored afterwards, all seven tables equal to the dump before.
- **Run 18,** checked by the review session in `run.step2` and the table: 10 326 sent, 0 failed, `produkt` 1 315, `konsulent` 1 699, `forhandler` 43, `annet` 1 379, `uklart` 5 890 (57 %), `no_text` 45; about $0.54. The spec has the three runs as totals.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-6-classification-stage-5.md`
- `docs/ai-log.md`, 2026-11-13: Story 2.6
- PRD: FR-11 and §8 Cost (`c0acc0c`), with a `(change)` line in `.memlog.md`
- Issue #51; Story 2.6a, issue #52 and PR #53
