# Story 5.4: the demo seed

**Date:** 2026-11-25
**Tool:** Claude Code (Opus 5.5): the BMAD session (`bmad-build`), one implementation subagent, three review subagents
**Story / issue:** #86, Story 5.4
**Result:** branch `story/5.4-demo-seed`, from `0a1881d` (spec) to `45167b3` and the closing commits; PR #87 (https://github.com/IBE160-2026/G97-meinich/pull/87). The full verification order ran on `e10a88b`, the code after every review fix.

## Goal

Commit a demo seed in which real demo companies show the whole v1 analysis, the margin waterfall included, within what the licence allows. Fix demo A and B. Allow-list their groups at all three band steps. Record the licence gate. Close the deferred entries Story 5.4 inherits (Epic 3 retro, action 2).

## Prompts that mattered

Meinich's prompts are in `docs/ai-prompts.md`. Each was drafted by the review session and pasted by Meinich, who made the decisions in it; the recommendations behind decisions 1–7 and the three additions were the review session's (added on `main` after the merge). In short:
1. **Planning to checkpoint 1.** Stop before any code or data change. Report the inherited entries, candidates for A and B with group and P per band step, the allow-list and seed growth, the overlap with the labelled set as a total, and a licence assessment read from the sources. Give all new copy verbatim, the verification order, and the risks.
2. **The answers.**
   - A = TRETOEN AS, B = HUMA AS.
   - Overlap option (ii), plus a new export rule: no fingerprint of a labelled-set company. That also removes the eight reference companies' fingerprints.
   - The AC narrowed to "peers whose documents are read".
   - The gate closed.
   - The copy approved with two corrections.
   - No `pnpm verify`.
   - Restore to `.local/document-run-5.4/`.
3. **Three additions before approval:**
   - a sentence on why classifications are published and fingerprints not;
   - the technical note's AD-16 restore text;
   - who writes what under `seed/`.

   With them came an instruction to keep the BMAD session's guard against labelled-set document rows ("et reelt hull").
4. **The e2e run.** The order of the e2e run after a memory stop, and the manifest count.
5. **Before push** (2026-11-26). Set the spec back to `in-review` (`2d1aba7`); name the commit the verification ran on; push and open the PR with the allow-list line 960 / 224 / 331. The review session had checked the committed seed's counts and the closed gate, and agreed with the three rejected findings.

## What came back, and what was done with it

**Found by the BMAD session**
- The overlap with the labelled set: 216 of the 940 new orgnrs, and 96 of the 412 in `seed/document-run.json`.
- A rule already broken: eight of the 20 OCR reference companies are in the labelled set, and their fingerprints (35 rows) have been committed since Story 5.1. Meinich decided the export rule and the history note in `docs/ai-log.md`.
- That the licence gate changes nothing in the v1 seed, and that the derived-categories phrase would describe nothing in it. Meinich kept the gate closed on that ground.
- The placeholder demo A (ADMMIT AS) could not show the waterfall: its own cost line is missing (`subject_absent`).

**Checked by the review session before Meinich answered:** TRETOEN's and HUMA's 2025 margins and revenues; that A, B and C are outside the labelled set; and the 8-of-20 overlap. After the answers it also checked the 352-of-845 classification count, which the BMAD session verified against the committed file.

**Added by the BMAD session, kept by Meinich:** the export's refusal of document rows of a labelled-set company outside the reference draw. Without it, the allow-list alone would have let the 216 companies' documents through.

**Corrected after the export, by the BMAD session.** The subagent's code assumed a seed holding the reference set's documents only. These tests and checks failed and were fixed:
- the SM-2 report read every seed document; it now reads the reference set's rows and is byte-identical again;
- the fingerprint-completeness and derive-rebuild checks now leave out the labelled set;
- the scratch exports in `test/db/seed.test.ts` now list the committed allow-list;
- in e2e:
  - a distribution value with a thousands space;
  - the rate-limit search term, still the placeholder's name;
  - Verdi's arrow-key test, written for the placeholder's step order;
  - the median peer-change test, on demo A, which has no median step;
  - the synthetic oracle's old too-few sentence.

**Review pass 1.** Three layers gave 19 findings: 16 were patched and 3 rejected. The triage is in the spec.
- **Blind Hunter, the high one:** the payload leak scans had moved off the real demo companies. They now run on A's and B's Oversikt, Nøkkeltall and Verdi, and on A with an exclusion.
- **Edge Case Hunter:** `document.csv` was not checked against the allow-list; an empty labelled set was accepted; a median notice appeared on a company without a group.
- **Verification Gap:** nothing rendered the median notice or the FR-64 line.
- **Rejected:**
  - `dataQuality` with no inputs (unreachable);
  - `docs/licence-gate.md`'s statement (checked: the dump holds only labelled-set companies);
  - `OUTSIDE`'s selection rule. It is fixed and its state is asserted; flagged to Meinich.

**Memory.** Claude Code stopped two e2e runs on low memory: one of the BMAD session's, one of the subagent's. Neither was a test failure. Meinich closed other programs, and the full order then ran: chromium 209, db-down 7, synthetic 31.

## Merge

- **Review:** posted by the review session on `da0f496`, nine line comments, no change asked for before merge: https://github.com/IBE160-2026/G97-meinich/pull/87#pullrequestreview-6079224014
  - It approved `seed/allow-list.json` as the AC requires: 960 entries with no duplicates (A, B, C, 937 peers at bands 0–2, the 20 reference companies), 224 of them in the labelled set.
  - It checked the committed seed on `da0f496`: 331 orgnrs with documents, none outside the list and none from the labelled set outside the reference draw; 317 with fingerprints, none in the labelled set; 331 in the manifest; `seed/` 15 983 186 bytes; the gate closed; and that only the spec, this file and the log changed after `e10a88b`.
  - Finding 16 (`OUTSIDE`) stays rejected, Meinich's decision on the review session's reasoning (spec, Review Triage Log).
  - Not re-checked by the review session: data.norge.no's "Lisens: Ikke oppgitt", read by the BMAD session on 2026-11-25.
- **Merged:** PR #87 by Meinich, 2026-11-26 19:05 UTC, as `e7cb24f`. Issue #86 is closed. The spec and the story are `done` (on `main` after the merge).

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-5-4-the-demo-seed.md` (decisions, implementation notes, Spec Change Log, Review Triage Log).
- `docs/licence-gate.md`, `docs/licence-gate.json` (closed).
- `docs/ai-log.md`, the two 2026-11-25 Story 5.4 entries.
- `epics.md` 5.4, PRD FR-73 and its memlog, the technical note (AD-9, AD-16, "Seed data"), and `deferred-work.md` (seven entries closed).
