# Story 2.5: the business-model fingerprint (stage 4)

**Date:** 2026-11-01
**Tool:** Claude Code (BMAD coordinator session and its implementation and review subagents, Opus 5.5)
**Story / issue:** Story 2.5 (FR-10, FR-13), branch `story/2.5-fingerprint-stage-4`, issue [#43](https://github.com/IBE160-2026/G97-meinich/issues/43); PR linked below once opened
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
  - The grants test first failed on a TRUNCATE that `derive` is granted. The test connection cannot `SET ROLE derive` (it holds ADMIN, not SET), and the refusal has the same SQLSTATE as a missing privilege. The new tests grant SET inside the rolled-back transaction. An older test that passed vacuously for the same reason ("refuse ingest and derive writes on them") is fixed the same way: with an extra INSERT granted to `derive` inside it, it now fails (SQLSTATE 23502 instead of 42501), and before the fix it passed.
  - The first request-path commit broke `test/analysis/failed-read.test.ts`. Its mocked subject rows lack the join's columns, and the validator rightly throws on a partial row. The fixtures now carry them as all null (`054b762`). Caught by running the whole unit suite after the commit.
  - The spread script first named 62.100 as a literal, which `test/no-industry-literal.test.ts` forbids in code. It now reads the industries from `seed/coverage.json` (`375d199`). Caught by the full unit suite.
  - The 410 test runs as `ingest`, which may not write or read `register.fingerprint`. A new `owner_db` fixture runs as the migration role acting as `ingest`, and the fingerprint is seeded and counted as the owner.
- **Findings for Meinich (not changed, since the rules are locked):**
  - **47 % of companies are undetermined** at their newest year. A cost-line reading story is proposed in `deferred-work.md`, as D2 asks.
  - **Rounding dropped columns.** 63 of the 84 columns skipped for a negative unexplained cost were within 5 kr, which the register's rounding allows. Meinich amended the rule before review (spec change log): a remainder down to −5 kr counts as 0. Rerun: 1 876 fingerprints.
- **Not done here:** D4 (one yes before `pnpm seed`), and the PR with the issue.
  - Until D4, these fail: the committed-seed tests, `test/fingerprint-seed.test.ts`, `test/fingerprint-spread.test.ts` and CI's seed load.
  - `sprint-status.yaml` is at `review`, and the spec at `in-review`.

## Review pass 1 fixes (same day)

The review layers (blind hunter, edge-case hunter, verification gap) were subagents of the BMAD session; the triage and the amendment are the coordinator's and Meinich's (spec change log and Review Triage Log).

- **The amendment (triage 1, 2, 20, 21; Meinich, option a):** the fingerprint references the company in a new migration, `pnpm ingest` ends with `pnpm derive` (four runner tests, each checked to fail with its call removed or changed), an open gate exports an unlisted fingerprint without its column (a whole-export test), and the seed recompute counts unlisted rows instead of skipping them.
- **Patches:** `shownGroup` picks the stage-4 group (3); the subject join DB test (4); derive's rebuild equals the stored rows (5); the `fingerprintWhere` comment (7); the spread test per covered industry and with a measured band (12, 13); the digest ban for `.js` specifiers (16); `gateWith(null)` (18). Each new test was checked to fail with its guard removed.
- **Deferred:** `SPREAD_SQL` untested (6), no run record for derive (27), and a killed run leaving fingerprints stale.

## D4: the seed re-export and the spread run (coordinator session, after Meinich's go)

Meinich gave the order of the steps. `pnpm seed` refused the stale seed (older `migration_id`), so the non-allow-listed rows were deleted in a checked transaction instead, as in 2.4.

- **Step 1: the dump against the database. One deviation, which stopped the run.**
  - `document`: 1 947 rows, and the sha256 is identical.
  - `document_column`: 3 892 rows. The sha256 of a fresh `\copy` differed from the dump's (`1da6c7fe…` against `d5f53b19…`), but the two files are byte-identical once sorted.
  - **Explanation:** the dump command has no `ORDER BY`, so the rows come out in physical order, and that order had changed since 2026-10-30. The likely cause is autovacuum, or the rolled-back test transactions of this session's subagents. The data was unchanged.
  - The coordinator stopped and asked. The review session compared the rows independently and got the same result.
  - **Meinich's decision:**
    - step 6 checks the row counts and the sorted contents against the dump, not the sha256 of the files;
    - the dump files themselves must still match the copy in `peerless-backups`. They do: `document.csv` `3cb518c8…` and `document_column.csv` `1da6c7fe…` are equal in both places.
- **Step 2:** one transaction deleted the 1 947 documents and 3 892 columns outside the allow-list. It asserted the counts deleted and the 97 + 194 left.
- **Step 3:** `pnpm derive` read 97 current columns and wrote 85 fingerprints (11 not reconciled, 1 without revenue), the count predicted before the export.
- **Step 4:** `pnpm seed:export`, with the gate closed. Only the manifest and the new `fingerprint.csv` changed. Committed alone (`b3406e6`).
- **Step 5:** `pnpm seed` ran twice with the same counts (company 17 883, filing 22 522, key_figures 22 522, document 97, document_column 194, fingerprint 85). A new export left the tree unchanged.
- **Step 6:** `.local/document-run-2.4/` was restored: 1 947 + 97 documents and 3 892 + 194 columns. The rows outside the allow-list are identical to the dump once sorted.
- **Step 7:**
  - `pnpm derive`: 1 876 fingerprints, the same totals as before D4.
  - `pnpm analysis:spread`: every band passes. The lowest IQR is 5.0 pp, in the low cost-of-goods band (n 83). No band is dropped. Committed alone (`714426f`).
- **Found and fixed during D4, each in its own commit:**
  - The `pnpm seed` summary line did not name `register.fingerprint`, because its count query is a fixed list (`33adfff`).
  - The Story 2.4 test "leaves a company deleted after 410 out of every seed file…" asserts the export's stderr exactly. It failed on the new gate notice, so the expectation now lists that notice (`4f8a7e0`). It failed in `pnpm test:db` and would have failed in CI. The implementation subagent had run the seed tests only in a patched copy that tolerated the stale seed.
- **The full suite afterwards:**
  - check:pins, check:env and typecheck pass.
  - `pnpm test`: 941 of 941.
  - `pnpm test:db`: 163 of 163.
  - `pnpm test:ingest`: 264 passed.
  - build and check:routes pass.
  - `pnpm test:e2e`: 116 passed. For that run the local fingerprints were cut to the seed's 85, because the specs compute their expectations from the seed's files. `pnpm derive` rebuilt the 1 876 afterwards.
  - lint reports problems only in the pre-existing `.local/wt-5.1`.
- **Local state at the end:** 2 044 documents, 4 086 columns and 1 876 fingerprints.

## What came from the review session

Meinich's separate review session, not this session, contributed:
- the D2 measurement behind "an empty line is not 0";
- the question that led to the tighter balance bounds (`sum_anleggsmidler`, `sum_omloepsmidler`);
- the deferred entry on the labelled set's document run;
- the independent check of the dump rows in D4.

The spec's Decisions and Spec Change Log credit each one.

## Links

- AI log: "2026-11-01 — Story 2.5: the business-model fingerprint and stage 4, and what could go wrong with banding and selection".
- Deferred work: the cost-line reading proposal (the rounding question is answered by the spec change log; the vacuous SET ROLE test is fixed).
- Documents updated:
  - the technical note (AD-2, "Fingerprint shape", "Rules fixed by the stories", the combination paragraph);
  - `docs/key-figures.md` (stage 4);
  - `AGENTS.md`;
  - the README ("Batch step 2: fingerprints", the seed sequence).
