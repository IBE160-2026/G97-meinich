# Story 3.1b: the full key-figure table

**Date:** 2026-11-15
**Tool:** Claude Code (Opus 5.5), running `bmad-build`. The BMAD session dispatched subagents for three tasks: one compiled the epic context, three investigated, and one implemented the story. It ran the three review layers as subagents too.
**Story / issue:** #68, Story 3.1b
**Result:**
- Spec: `952a4f6`.
- Implementation: `233aac3` to `9972a9a`.
- Review fixes: `4720b82` (code and tests) and `f0368d6` (docs).
- Triage log: `9bf7a32`.
- PR: not opened yet. There is no push before Meinich says so.

## Goal

Render what Story 3.1a computes. Every key figure goes in the Nøkkeltall og gap table, grouped as in `docs/key-figures.md`. The table includes the cost-share row group, the check row, the capital kroner for 9, 10 and 11, every absence's words, the outside-the-demo-data state with its info popover, and Story 1.8's phone pattern at 375 and 320 px. The page carries no raw document øre (AD-4).

## Prompts that mattered

- **The opening prompt** (pasted by Meinich, headed "Fra meg") asked for a checkpoint before any code change. It covered seven points:
  - (a) deferred work;
  - (b) who can show what in the seed and locally, totals only;
  - (c) the rows and every state with its text, and whether the table sorts;
  - (d) the payload;
  - (e) the kroner cells;
  - (f) the phone pattern;
  - (g) every new Norwegian string, before it enters `nb.json` or EXPERIENCE.

  Its rules:
  - No figures per orgnr for the labelled set.
  - Document figures only from allow-listed companies.
  - A named test that fails for every matrix row.
  - The approved copy kept verbatim and checked by a test.
  - `pnpm restore:documents` after the last seed load, with its four counts.
  - The full suite with e2e on one worker, and no push.
- **Meinich's decisions at the checkpoint** (recorded as decisions 1–8 in the spec):
  1. **Groups.** One `<tbody>` per group, and only the cost-share group has a heading.
  2. **Order.** `docs/key-figures.md`'s order, with EBITDA-margin before the cost-share group.
  3. **Popover.** A hand-written popover, with no new dependency.
  4. **Fixture.** A third committing e2e fixture: one synthetic subject and ten synthetic peers with reconciled document columns. It runs under the guards of the other two, with revenues outside demo A's and B's bands. Its payload scan covers the subject's and every peer's document øre. "Ekskluder" on one peer gives below the floor, and AGENTS.md is updated.
  5. **Copy.** The new copy in (g) is approved as written.
  6. **Deferred work.** Story 2.9's "year's own column" entry is taken in. D2 and B9 are moved, with Story 3.7 named as owner.

  The BMAD session recommended options 1A, 2A, 3A and 4B, and Meinich chose them.
- **The verification re-run.** The first full run was stopped during `pnpm build` because the machine was low on memory. Meinich closed other programs and asked for one step at a time: build, e2e, `test:db` again so its count shows, then `restore:documents`.

## Measurements (totals only)

- **Committed seed:** 8 356 covered subjects. None has 10 or more peers with document figures; the most is 6 and the median 4. Only 18 subjects have their own document read.
- **Local database with the 2.5d dump:** the page shows the same thing, because the manifest lists only the seed's 20 orgnrs and every dump company reads "Ikke i demodataene". With every dump company counted as listed, 4 363 subjects would have 10 or more peers with document figures, and 1 098 of them their own reconciled document as well.
- **What follows for the tests:** no seeded subject can show a full document row on CI. This is why the synthetic fixture exists. Showing real full rows from a fresh clone waits for Story 5.4.

## What came back, and what was done with it

- **Accepted:**
  - `src/analysis/key-figure-rows.ts`, a pure view of strings and strip geometry, which is the payload boundary;
  - the document benchmark in `shownGroup`;
  - the hand-written `info-popover.tsx`;
  - `SYNTHETIC_DOCUMENTS` and `e2e/synthetic-documents.spec.ts`;
  - the document-field and document-øre scans in `e2e/payload.ts`;
  - the database test that a year's figures never come from a later document's prior column.
- **Corrected during implementation** (by the implementation subagent, from its own screenshots and guard removals):
  - At 320 px a nine-digit capital amount ran past the phone table. The columns became 34 / 26 / 40 % (`4cb75e3`).
  - Kontantandel's kroner test could not catch "Ingen kronebeløp" (`75f92b6`).
- **Corrected in review pass 1.** Blind Hunter, Edge Case Hunter and Verification Gap found the issues below, all run by the BMAD session; the session's own diff check added two (S). Thirteen were fixed in `4720b82` and `f0368d6`:
  - **Tests:**
    - The non-small notice's new document-row trigger had no test (VG, BH).
    - The negative midtre halvdel wording for days and turnover was not checked (VG).
    - The failed-filing e2e test skipped 320 px (BH).
  - **Docs:** the closure of Story 2.9's deferred entry reversed the entry's rule without citing AD-15 (BH, medium).
  - **Layering and dead code:**
    - The analysis layer imported from `src/components` (BH).
    - Two dead re-export shims (BH).
    - The fixture's band guard copied the widest band by hand (BH).
  - **Accessibility:**
    - Esc on one popover took focus from anywhere (BH, ECH).
    - Merged cost-share cells did not name their row-group heading in `headers` (ECH).
    - "Ikke i demodataene" broke mid-word at 320 px (S).
  - **Docs:**
    - The AI log's fixture claim named no test (BH).
    - Story 3.7 in `epics.md` did not name the items moved to it (BH).
    - EXPERIENCE said the cost-share cell links before Story 3.3 (BH).
- **Rejected, with evidence in the spec's Review Triage Log:** 13 findings, 5 of them false. One example is the claim that the new `throw`s can 500 the page. The engine never gives a compared figure the gap states that would reach them (`src/engine/benchmark.ts:47`, `:134`, `:165`, `:227`).
- **Open for Meinich:** the approved days copy has a plain space before "dager". The code uses U+00A0, as `formatDays` and the percent ranges already do. This is not yet recorded in the Spec Change Log.

## Verification

All of these ran after the review fixes:
- `pnpm lint`, `pnpm typecheck`: clean.
- `pnpm test`: 1 649 passed.
- `pnpm seed`, then `pnpm test:db` (200 passed) and `pnpm test:ingest` (392 passed).
- `pnpm build`.
- `pnpm test:e2e` at `workers: 1`: 168 passed. Afterwards there were 0 synthetic companies, and the manifest was back at 20 orgnrs.
- `pnpm restore:documents`: documents 2 785, columns 5 556, fingerprints 2 537, classification rows 10 371.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-3-1b-the-full-key-figure-table.md`, with its decisions, Implementation Notes and Review Triage Log.
- AI log: "2026-11-15 — Story 3.1b: the full key-figure table, its payload and its kroner cells".
- Documents updated:
  - EXPERIENCE.md;
  - `epics.md` (one line under Story 3.7) and the PRD's `.memlog.md` (a `(change)` line for it);
  - `deferred-work.md`;
  - `AGENTS.md` (three tests commit rows).
