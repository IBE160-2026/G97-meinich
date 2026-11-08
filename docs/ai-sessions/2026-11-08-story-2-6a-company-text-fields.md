# Story 2.6a: the register text classification reads

**Date:** 2026-11-08
**Tool:** Claude Code (Opus 5.5, BMAD build)
**Story / issue:** #52, Story 2.6a, split out of Story 2.6 (#51)
**Result:** branch `story/2.6a-company-text-fields`, seed `c6d990e`. PR: linked when opened.

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

## Links

- Spec, with the seed sequence's totals: `_bmad-output/implementation-artifacts/spec-2-6a-company-text-fields.md`
- Issue #52; Story 2.6, issue #51
