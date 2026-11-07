# Story 2.5d: the labelled set's document run, with a local OCR word cache

**Date:** 2026-11-07
**Tool:** Claude Code (Opus 5.5): the BMAD session, and its implementation subagent for the code
**Story / issue:** #49, Story 2.5d
**Result:** commits on `story/2.5d-labelled-set-run-and-ocr-cache` (below); PR [#50](https://github.com/IBE160-2026/G97-meinich/pull/50). The runs wait for Meinich's yes.

## Goal

Build what the labelled set's document run needs: a local cache of Tesseract's words, so a later re-read after a fix that comes after OCR does not take another 12 hours (or more than 35 once the labelled set is read); a way to prove the cache on real data (`--reread-all` and a comparison with the seed); and the labelled set's document list, reading the reference year 2025 only.

## Prompts that mattered

- The BMAD session to the implementation subagent: "Read `spec-2-5d-labelled-set-document-run-and-ocr-word-cache.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start. Commit in small logical steps as you go on the current branch (each commit type-checks on its own; no push)."
- Meinich's decisions are in the spec (D1 unchanged, R4 no fix, `--reread-all`, years per entry, the run order); the probe is `analysis/output/page-kind-probe.md` (`6a222e5`), and Story 5.1's draw was merged in `7c27af8` before this session.

## What came back, and what was done with it

- Accepted, as built (the spec's Implementation Notes have the detail):
  - `ocr_cache.py`: the key, atomic gzipped entries, the counts (`93cc97b`).
  - the cache in documents and re-read mode, its counts in `run.step1.counts` (`3338427`).
  - `--reread-all`, recorded as mode `reread` with `reread_all: true`, so no migration (`c460e70`).
  - list entries with their years (`f174c5d`).
  - the image check's cached pass (`60f1918`).
  - the mount (`549d631`).
  - `--labelled` and its list (`863c59d`, `61e932e`).
  - `pnpm analysis:seed-documents` (`1b7f3c6`).
  - the whole version report in the key (`25917d3`).
- Corrected by the implementation subagent before commit: the first key held only the first line of `tesseract --version`. Printing the report in the built image showed leptonica, the image libraries and the CPU features. All three can change the words, so the key now holds them. The libarchive and libcurl lines are left out: the read never uses them, and they change with every base-image rebuild.
- Raised for review by the implementation subagent, and decided by Meinich (below):
  - `read_tsv`, which turns Tesseract's TSV into the stored words, was not in the key (AI log, 2026-11-07, item 1).
  - The comparison script reads as `ingest`, because `reader` has no access to schema `run` (item 5).

## Review

Pass 1 (BMAD session, 2026-11-07): three reviewer subagents read the diff `dc4f737..6779472`: Blind Hunter (BH), Edge Case Hunter (EC) and Verification Gap (VG). They made 17 findings, triaged in the spec's Review Triage Log with each finding's layer.

- **Fixed** (by the implementation subagent, each fix in its own commit):
  - #1 (BH, EC): an entry stored with no figure pages whose top now classifies as generated misses (`ffc7e9c`).
  - #12 (VG, BH): a stored key with an extra or a missing name misses in `parts` (`ffc7e9c`).
  - #3 (EC): a failed `tesseract --version` gives no key part (`534dc41`).
  - #4 (BH, EC): a year asked for that `/aar` does not list is named and counted as `asked_not_listed` (`6610032`).
  - #13 (BH): `--reread-all`'s deadline stop says a rerun reads every document again (`6610032`).
  - #9, #10, #11 (EC, BH, VG): the seed comparison shows an unreadable count as unreadable, requires the current reader commit, and with `--cache-proof` requires all hits; its verdict is unit-tested and its select is checked against the loaded seed (`f3b6141`).
  - #14 (BH): a test of the read-only connection, and the AGENTS.md line (`f3b6141`, `605c376`).
  - #5 (BH, EC): the docs no longer overclaim what years limit in documents mode, and a test pins the re-reconciliation (`605c376`).
  - #17 (BH): the technical note's `run.step1` paragraph (`605c376`).
- **Rejected:** #6 (EC; `mkdirSync` on a file, unlikely), #7 (EC; false, the root is always absolute), #8 (BH, EC; the reference list is plain strings), #15 (BH; CI time only), #16 (BH; orphan entries of about 8.5 KB do no harm).
- **Decided by Meinich**, 2026-11-07:
  - #2: the sha256 of `ocr.py` becomes a key part. It is read from the module file when the run starts, and a differing one is named `ocr_code_sha256`. Tested both ways and mutation-checked (`ac61135`); the spec records it in its Spec Change Log, and AGENTS.md, the technical note, epics.md and the AI log were updated (`98a87fb`, `f1eb27b`).
  - #14: the comparison stays as `ingest` on a read-only connection, with no migration. `reader` is the website's role and is not to see schema `run`.
  - #17: Story 2.5c's closing log `36b6117` stays on the branch and goes in with the PR.
  - The CPU features in the key are accepted, since the cache is local.
- Verified:
  - `pnpm lint` (with `.local/` ignored: the local worktree `.local/wt-5.1` is not part of this repository's tree), `pnpm typecheck`, `pnpm test` (1013), `pnpm test:db` (167), `pnpm test:ingest` (359).
  - The image check in the built image: both fixture PDFs match, live and through the cache.
  - `pnpm analysis:seed-documents` against the local database before any run: 97 documents and 194 columns equal to the seed.

## The runs

- **Dump and backup** (BMAD session, after Meinich's yes):
  - `.local/document-tables-before-2.5d-runs/`, the three tables in full: 2 044 documents, 4 086 columns, 1 856 fingerprints;
  - copied to `C:\Users\cmein\peerless-backups\document-tables-before-2.5d-runs\`, with equal sha256 (the spec's Implementation Notes).
- **The first cache proof failed** (Meinich's runs 1242 `--reread` and 1243 `--reread-all`, the OCR reference set):
  - Each read 97 of 97, with 0 failed, 0 not replaced, and 87 reconciled and 10 not.
  - `pnpm analysis:seed-documents` gave exit 0 after both, all documents read by `ac61135`.
  - Both runs had 0 hits and 97 absent misses, so `--cache-proof` gave exit 1.
- **The review session found the defect in the real runs, not this session.** data.brreg.no writes a new random `/ID` array into each PDF's trailer on every fetch, and every other byte stays the same. The key hashed the raw bytes, so it never matched twice. The tests could not catch this, because they all read the same bytes twice.
- **Meinich decided the fix**: hash the PDF with its one `/ID` array fixed, and count a PDF without exactly one `/ID` as a miss with its reason.
  - The BMAD session built it with tests that fetch with another `/ID`, and mutation-checked it (`df34a2d`, `f8e0d1e`).
  - It is recorded in the spec's Spec Change Log (`2f4e3f5`), as a trap in AGENTS.md and `docs/data-sources-brreg.md`, and in the AI log (`951c24b`).
  - The 194 old cache entries stay, never read.
- **The second cache proof passed** (Meinich's runs 1410 `--reread` and 1411 `--reread-all`; the review session checked the counts against `run.step1`): 97 of 97 read each time, 0 failed, 0 not replaced, 0 figures lost; 1410 had 0 hits in 38 min, 1411 had 97 hits and no miss in 2 min 30 s, and both checks gave exit 0.
- **Before the labelled set** (BMAD session, after Meinich's yes): a new dump and backup, `document-tables-before-2.5d-labelled-set`, with equal sha256, and `analysis/output/document-run-counts-before-2.5d.json` (the spec's Implementation Notes).
- **The labelled-set run** (Meinich's run 1412, `--documents`, 4 h 33 min; the review session checked the counts against `run.step1`), totals only:
  - 845 listed, 0 refused, 104 already stored for 2025;
  - 741 read, 0 failed, 0 OCR errors: 690 reconciled, 45 not, 6 not read out;
  - 741 absent cache misses, as expected for new documents.
  - Documents 2 044 → 2 785, fingerprints 1 856 → 2 537.
- **After it** (BMAD session, 2.5c's steps 3–9):
  - the `after-2.5d` counts (`ee35396`);
  - the dump `.local/document-run-2.5d/` and the full tables, backed up with equal sha256, with README "Seed" (`a1edd4c`);
  - the controlled delete, derive, the seed export (`eadadab`: only `reader_commit` and `read_at` of the 97 reference documents; no labelled-set row), two loads with an unchanged re-export, the restore and derive, which gave exactly the dump's 2 537 fingerprints.
  - The derive output's by-type lines were kept out of the terminal, because they now include the labelled set.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-5d-labelled-set-document-run-and-ocr-word-cache.md`
- AI log: `docs/ai-log.md`, "2026-11-07 — Story 2.5d: the OCR word cache, `--reread-all`, years per list entry"
- Updated: `AGENTS.md` (Stack), `README.md`, `docs/data-sources-brreg.md`, `epics.md` (Story 2.5d's decisions), the technical note, `deferred-work.md` (the Story 2.5 entry: code done, run pending)
