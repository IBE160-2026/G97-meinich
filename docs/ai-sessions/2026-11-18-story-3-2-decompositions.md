# Story 3.2: the two decompositions

**Date:** 2026-11-18 to 2026-11-19
**Tool:** Claude Code (Opus 5.5), running `bmad-build`.
- **Subagents dispatched by the BMAD session:** one compiled the epic context, three investigated, and one implemented the story and its review fixes. The three review layers ran as subagents too.
- **Prompts:** the prompts headed "Fra meg" were written by the review session, a separate Claude session, and pasted in by Meinich. The review session recommended the decisions credited to it below. Every decision is Meinich's.

**Story / issue:** #70, Story 3.2
**Result:**
- **Spec:** `e7c0485`. In progress at `3762f9f`; in review, story in review, at `40fcda0`.
- **Implementation:** `4c2ccad` to `5c6b2ab`.
- **Review triage and Meinich's change-log decisions:** `5228cd1`.
- **Review fixes:** `9956815` (code, tests and docs) and `5a50df9` (import cycle).
- **PR:** not opened yet; no push before Meinich says so.

## Goal

Show which lever a gap sits on. "Margin eller kapitalbruk?" opens under Totalkapitalrentabilitet. It shows driftsmargin and total asset turnover (`sumDriftsinntekter / sumEiendeler`), each against its own median and with its own 10-peer gate. The factors are never multiplied. "Lønnsnivå eller produktivitet?" opens under Lønnskostnadsandel. In v1 it shows Story 2.9's not-read-in-v1 state for both factors (FR-26).

## Prompts that mattered

- **The opening prompt** asked for a checkpoint before any code change. It covered eight points:
  - (a) deferred work;
  - (b) where the factors are computed, and the tests against a product and against turnover being ranked or labelled key figure 11;
  - (c) the pay factors in v1;
  - (d) the component, own or Radix;
  - (e) the phone;
  - (f) the payload;
  - (g) the e2e subjects;
  - (h) new Norwegian copy.

  Its rules:
  - Totals only for the labelled set.
  - A named failing test for every matrix row.
  - Approved copy kept verbatim.
  - The spec stays `in-review` until merge.
  - `pnpm restore:documents` after the last seed load.
  - e2e on one worker.
  - No push.
- **Meinich's checkpoint decisions** (decisions 1–7 in the spec):
  1. A hand-written fold-out. Every current-state shadcn mention in epics.md, DESIGN.md, EXPERIENCE.md (with the stack line) and the technical note is corrected.
  2. The story's not-read-in-v1 state applies outside the seed too, and EXPERIENCE :220 is corrected.
  3. The driftsmargin factor has the same fields as turnover.
  4. The indent is 16 px on the phone.
  5. The årsverk entry in deferred work gets a v1 line.
  6. The copy is approved.
  7. The no-product test covers only the decomposition factors, so the capital kroner of 9–11 are not caught, and the report must show it failing.

  The review session recommended:
  - correcting every shadcn mention, including EXPERIENCE :320 and the technical note (decision 1);
  - "ikke lest i v1" outside the seed too (decision 2);
  - limiting the no-product test to the factors and showing it fail (decision 7).

  Decisions 3–6 followed the BMAD session's checkpoint recommendations.
- **Meinich's review decisions** (Spec Change Log, 2026-11-19), each on the review session's recommendation:
  - Each compared factor also shows its midtre halvdel as text, from existing copy.
  - The driftsmargin factor's direction words "↑ Høyere er bedre" are accepted in place of decision 3's "Bedre →".
  - `architecture/technology.md` is the course lecturer's reference (`151d56a`) and stays untouched. The review session corrected the BMAD session's premise here: the BMAD session had taken the file for a stray.
- **The final prompt** asked for the review fixes in their own commit, then full verification: seed, `restore:documents`, e2e on one worker, and a count of synthetic leftovers.

## What came back, and what was done with it

- **Accepted.** The engine benchmarks total asset turnover with direction `none` and no gap field. The view builder gives each factor exactly its fields. The fold-out is hand-written. A parser-based scan of `src/` and `scripts/` refuses any multiplication involving a factor. Each guard was removed in turn, and its named test failed (implementation report, `docs/ai-log.md` 2026-11-18).
- **Corrected by review.** The three layers ran in the BMAD session, which also did its own diff check (spec, Review Triage Log):
  - **Missing midtre halvdel text** (Blind Hunter). The factor strip is `aria-hidden` and no text gave the quartiles. Meinich chose to add the existing labelled text.
  - **Direction words** (Edge Case Hunter). The words differed from decision 3. The frozen wording came from the BMAD session's own checkpoint summary, which wrote "Bedre →" for a strip that is never mirrored. Meinich accepted the code.
  - **Untested reasons and guard** (Verification Gap; Blind Hunter and Edge Case Hunter). The driftsmargin factor's absent reason and the pay guard's throw had no test. Tests were added.
  - **Smaller findings, patched:** the scan now also covers `scripts/`, e2e checks both keys in both directions and a subject in the demo data, the payload list was moved, the strip width was capped, and UX-DR22, DESIGN "Factor pair" and the ai-log Outcome were corrected.
  - **Import cycle** (the BMAD session's own check of the review-fix commit). `middleHalfText` moved to `src/analysis/middle-half.ts`.
- **Rejected, and why:**
  - The pay fold-out inside the cost-share row group is what the frozen matrix says.
  - Separate open state on desktop and phone follows 3.1b's two-table pattern.
  - One e2e edge case fails loudly by design. In the other, the branch is defensive and the unit tests cover it.
- **Not done, as decided:** `architecture/technology.md` was not edited.

## Verification (2026-11-19, final run)

- **Checks:** `check:pins`, `lint` and `typecheck` are clean. `pnpm test`: 1670 passed.
- **Seed:** `pnpm seed`, then `test:db` 200 passed and `test:ingest` 392 passed.
- **`pnpm restore:documents`:** documents 2785, columns 5556, fingerprints 2537, classification rows 10371.
- **`pnpm build`:** the first attempt stopped on Next.js's security-advisory check (`SecurityFatalError`), and the retry passed. No upgrade was made; issue [#71](https://github.com/IBE160-2026/G97-meinich/issues/71) tracks it as its own story. `check:routes` is clean.
- **`pnpm test:e2e`:** 173 passed with 1 worker.
- **Afterwards:** 0 synthetic companies, filings or documents remain, and the manifest holds no synthetic orgnr.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-3-2-the-two-decompositions.md`.
- AI log: `docs/ai-log.md`, 2026-11-18, "Story 3.2: the two decompositions, factors side by side and never multiplied".
- Planning documents updated: epics.md (Story 3.2 AC, UX-DR1, -19, -22, -31, -60, the Story 1.1 pin AC), DESIGN.md, EXPERIENCE.md, the technical note, PRD FR-26 with `.memlog.md` lines, and `epic-3-context.md`.
