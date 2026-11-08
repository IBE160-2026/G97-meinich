# Story 2.6a: the register text classification reads

**Date:** 2026-11-08
**Tool:** Claude Code (Opus 5.5, BMAD build)
**Story / issue:** #52, Story 2.6a, split out of Story 2.6 (#51)
**Result:** branch `story/2.6a-company-text-fields`, seed `c6d990e`. PR [#53](https://github.com/IBE160-2026/G97-meinich/pull/53).

## Goal

Store `aktivitet` and `vedtektsfestetFormaal` for an AS, so Story 2.6 has text to classify, and re-export the seed without losing the local document rows.

## Prompts that mattered

- Meinich, at Story 2.6's checkpoint: split out 2.6a with its own issue, epics story and PR. Build first and stop before `--companies-only`.
- Meinich, after review pass 1 raised sole proprietors' text in the seed: "Bare AS. Andre organisasjonsformer skal ha aktivitet og vedtektsfestet_formaal NULL, også hvis et selskap slutter å være AS og hadde tekst fra før. Tell hvor mange som hoppes over i run.step1, aldri stille, og test begge deler."
- Meinich, after run 1708: "Les diffen i seed/demo/company.csv kolonne for kolonne før du committer. [...] Alt annet som endrer seg, er en feil: stopp og si fra."

## What came back, and what was done with it

- **Accepted:** the migration, the strict parser and one write path through `SEARCH_FIELD_COLUMNS`. Review fixes in `e5295f5`.
- **Corrected by Meinich:** the first version stored every form's text. A BMAD review layer raised it and Meinich decided AS only (`ab27ed0`). `--companies-only` does not update the stored form, so the text stays only when both the register and the stored row say AS.
- **Corrected, caught by running:** swapping the fixture orgnr in `test_documents_run.py` was not enough, because `brreg_id` is unique and collided with stored rows (`f10ccf6`, `1eeb878`).
- **Corrected, caught by the suite after the re-export:** `test/db/seed.test.ts` expected the column list to end on `slettedato`; it could not run before (`c023e7c`).
- **Rejected:** see the spec's Review Triage Log, with who found what.
- **The review session (Meinich's separate session)** checked the totals after run 1708 and named the expected diff of `company.csv`, which the column-by-column comparison confirmed. No per-orgnr result for the labelled set is recorded.

## Merge

CI was green on `9023435`. Before merging, the review session checked run 1708 in `run.step1`, the database before and after the restore, the backup's sha256, and the seed: `c6d990e` changes only `company.csv` and `manifest.json`, the new file has 10 327 AS with both texts and no other form with text, and the document rows stay at 97, 194 and 86, so no labelled-set row entered the seed. It compared the old seed with the database after the run for the 28 changed municipalities and the 28 emptied industry descriptions, none on the allow-list. Meinich asked for the review to be posted: seven line comments on `9023435` (review 5818323357). One comment carries a question to Story 2.6: the spec does not say what happens to an AS with neither text, of which there are 45, all among the 81 companies not in the bulk file. Nothing was rejected in this review. Merged at 14:49 UTC on 2026-11-08 as `1d1eaf2`.

## Links

- Spec, with the seed sequence's totals: `_bmad-output/implementation-artifacts/spec-2-6a-company-text-fields.md`
- Issue #52; Story 2.6, issue #51
