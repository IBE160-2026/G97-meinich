# Story 2.5d: the labelled set's document run, with a local OCR word cache

**Date:** 2026-11-07
**Tool:** Claude Code (Opus 5.5): the BMAD session, and its implementation subagent for the code
**Story / issue:** #49, Story 2.5d
**Result:** commits on `story/2.5d-labelled-set-run-and-ocr-cache` (below); PR to be opened. The runs wait for Meinich's yes.

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
- For review, not decided here:
  - `read_tsv`, which turns Tesseract's TSV into the stored words, is not in the key (AI log, 2026-11-07, item 1).
  - The comparison script reads as `ingest`, because `reader` has no access to schema `run` (item 5).
- Verified:
  - `pnpm lint` (with `.local/` ignored: the local worktree `.local/wt-5.1` is not part of this repository's tree), `pnpm typecheck`, `pnpm test` (1013), `pnpm test:db` (167), `pnpm test:ingest` (359).
  - The image check in the built image: both fixture PDFs match, live and through the cache.
  - `pnpm analysis:seed-documents` against the local database before any run: 97 documents and 194 columns equal to the seed.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-5d-labelled-set-document-run-and-ocr-word-cache.md`
- AI log: `docs/ai-log.md`, "2026-11-07 — Story 2.5d: the OCR word cache, `--reread-all`, years per list entry"
- Updated: `AGENTS.md` (Stack), `README.md`, `docs/data-sources-brreg.md`, `epics.md` (Story 2.5d's decisions), the technical note, `deferred-work.md` (the Story 2.5 entry: code done, run pending)
