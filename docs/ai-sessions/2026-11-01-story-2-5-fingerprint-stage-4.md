# Story 2.5: the business-model fingerprint (stage 4)

**Date:** 2026-11-01
**Tool:** Claude Code (implementation subagent, Opus 5.5)
**Story / issue:** Story 2.5 (FR-10, FR-13), branch `story/2.5-fingerprint-stage-4`; issue and PR not yet opened
**Result:** commits `b60d71b`, `86090e0`, `47f63bd`, `aa38b13`, `47e8b5e`, `054b762`, `97d461e`, `13d6c22`, `375d199`, and the docs commit

## Goal

Implement `_bmad-output/implementation-artifacts/spec-2-5-the-business-model-fingerprint-stage-4.md`:
- the fingerprint and the digest in `src/engine`;
- the first step-2 script, `pnpm derive`;
- `register.fingerprint`;
- stage 4 in the request path;
- the licence gate in `seed:export`;
- the within-band spread test.

D4 comes after review and is not part of this session: the seed re-export and the spread run.

## Prompts that mattered

- "Read … spec-2-5-the-business-model-fingerprint-stage-4.md fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start. … Commit in small logical steps as you go, one per Execution bullet or smaller, each type-checking on its own … Do not push."

## What came back, and what was done with it

- **Accepted (built as the spec's code map says):**
  - `src/engine/fingerprint.ts`: the five categories, `fingerprintOf`, `businessType` over every combination of possible values, and `fingerprintFromColumns`, the one validator for stored categories.
  - `src/engine/digest.ts`: sha256 over canonical JSON. A `'use client'` module may not import it (ESLint, `test/lint.test.ts`).
  - `test/fingerprint-spread.test.ts`, committed in the first commit, before any data was read.
  - Stage 4 in `assemblePeerGroup`, with `group` beside an unchanged `pool`, and the extended selection-ban test.
  - Migration `20261101120000_fingerprint.sql`, applied with `supabase migration up` only.
  - `scripts/derive.ts`, run locally on the 2.1b rows; the totals are in the spec's Implementation Notes.
  - The fingerprint joins in `src/server/analysis.ts`; the page's aggregates use `group`.
  - The licence gate (`readLicenceGate`, `fingerprintWhere`, `copyTable`), and `test/fingerprint-seed.test.ts`.
  - `scripts/fingerprint-spread.ts`. Not run: it runs in D4 step 5.
- **Choices the spec left open:** listed in the spec's Implementation Notes. Among them:
  - a negative U is checked even with every cost line read;
  - a balance bound is checked only for an empty line;
  - the gate's DB cases test `copyTable`, since a whole export cannot show the filter.
- **Corrected during the session, and how it was caught:**
  - The grants test first failed on a TRUNCATE that `derive` is granted. The test connection cannot `SET ROLE derive` (it holds ADMIN, not SET), and the refusal has the same SQLSTATE as a missing privilege. The new tests grant SET inside the rolled-back transaction. An older test that passes vacuously for the same reason is listed in `deferred-work.md`.
  - The first request-path commit broke `test/analysis/failed-read.test.ts`. Its mocked subject rows lack the join's columns, and the validator rightly throws on a partial row. The fixtures now carry them as all null (`054b762`). Caught by running the whole unit suite after the commit.
  - The spread script first named 62.100 as a literal, which `test/no-industry-literal.test.ts` forbids in code. It now reads the industries from `seed/coverage.json` (`375d199`). Caught by the full unit suite.
  - The 410 test runs as `ingest`, which may not write or read `register.fingerprint`. A new `owner_db` fixture runs as the migration role acting as `ingest`, and the fingerprint is seeded and counted as the owner.
- **Findings for Meinich (not changed, since the rules are locked):**
  - **47 % of companies are undetermined** at their newest year. A cost-line reading story is proposed in `deferred-work.md`, as D2 asks.
  - **Rounding dropped columns.** 63 of the 84 columns skipped for a negative unexplained cost were within 5 kr, which the register's rounding allows. Meinich amended the rule before review (spec change log): a remainder down to −5 kr counts as 0. Rerun: 1 876 fingerprints.
- **Not done here:** D4 (one yes before `pnpm seed`), and the PR with the issue.
  - Until D4, these fail: the committed-seed tests, `test/fingerprint-seed.test.ts`, `test/fingerprint-spread.test.ts` and CI's seed load.
  - `sprint-status.yaml` is at `review`, and the spec at `in-review`.

## Links

- AI log: "2026-11-01 — Story 2.5: the business-model fingerprint and stage 4, and what could go wrong with banding and selection".
- Deferred work: the cost-line reading proposal, the rounding question, and the vacuous SET ROLE test.
- Documents updated:
  - the technical note (AD-2, "Fingerprint shape", "Rules fixed by the stories", the combination paragraph);
  - `docs/key-figures.md` (stage 4);
  - `AGENTS.md`;
  - the README ("Batch step 2: fingerprints", the seed sequence).
