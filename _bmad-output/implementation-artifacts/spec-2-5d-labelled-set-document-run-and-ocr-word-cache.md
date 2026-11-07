---
title: "Story 2.5d: The labelled set's document run, with a local OCR word cache"
type: 'feature'
created: '2026-11-07'
status: 'ready-for-dev'
baseline_commit: 'dc4f737'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-5c-refuse-a-digit-read-as-two.md'
  - '{project-root}/analysis/output/page-kind-probe.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Each of the last three re-reads took about 12 hours, and every fix they carried came after OCR; Tesseract's words were the same each time. Story 5.2 needs the labelled set's documents (845 companies, 741 without any read document), which would make a full re-read take more than 35 hours.

**Approach:** step 1 keeps every document's recognised words in a local, gitignored cache keyed by everything that determines them, and uses them only on an exact key match; then, after Meinich's yes, step 1 reads the labelled set's documents, and the counts before and after are reported as totals.

**Probe (`analysis/output/page-kind-probe.md`, `6a222e5`; read-only, 363 cached documents, totals):**
- No page holds both statements. The 4 income-statement pages that also contain "balanse" contain it only in "balanseført" (capitalised development costs). No row of a balance field sits on a page that is not a balance page, so no balance page has lost its heading.
- 92 rows would match `varer`: 78 on balance pages and 14 on income-statement pages (the inventory-change row).
- Splitting a page at a line starting "balanse" changes no column's `varer`. The rule before Story 2.5c (any page) would bring back the income statement's figure in 19 columns (10 new, 9 changed) and lose 2. In the 5 of these 21 where the neighbouring year's document is cached, none matches that document's figure.
- The gap: 2 columns in the cache are empty while the neighbouring year's document holds the figure (current 1, prior 1). Both have a balance `Varer` row, on a page `page_kind` classifies correctly. The plain figure is refused there: its last group has four digits. The digits pass reads one digit too many, so its figure differs from the neighbouring year's. `varer` is in no gate, so the digits figure never reaches the column.

**Decisions (Meinich, 2026-11-07):**
- **D1 (Story 2.5) is unchanged:** thresholds, the type rule, `FINGERPRINT_FIELDS`.
- **R4 and `page_kind`: no fix.** The probe shows that every rule that would bring a figure back brings back a wrong one: splitting at the heading changes nothing, reading `varer` on any page brings back the income statement's figure, and the gap's digits-pass figure has one digit too many. An empty `varer` stays empty with its reason. No re-read of the 2 044 stored documents comes first.
- **The 2 044 stored documents keep `reader_commit` `b57aaba`;** the cache fills with them at the next reader fix's re-read.
- **The cache is proven on real data before the labelled set.** After the cache is built, Meinich runs `--reread` of the OCR reference set twice: first through OCR (filling the cache), then from the cache. Both must give exactly the figures, status and checks the committed seed holds now, and the second must have only hits. Hits and misses are counted, and the result goes in this spec and the PR. Any difference is a defect that stops the story before the labelled set.
- **The list comes from Story 5.1's draw,** brought in by merging `c0f10a0` from `story/5.1-labelled-set` (not a cherry-pick, so the hashes are kept); `15e1010` (the blind labelling) and later commits stay out. The PR says these are 5.1 commits taken unchanged and that the 5.1 PR takes the rest.
- **`--reread-all <file>` (Meinich, 2026-11-07):** the second re-read needs a mode that reads a document whatever its `reader_commit`, since `--reread` skips a current one. It has exactly `--reread`'s rules for refusing an orgnr, "not replaced", the fetch deadline, the stop after three deadlines in a row and the exit code; the only difference is that `reader_commit` is not checked. It runs alone like the other modes, `pnpm derive` runs after it as after `--reread`, and AGENTS.md gets a line. The script that compares the reference set with the seed also counts the cache's hits and misses from `run.step1`, totals only.
- **Only the reference year 2025.** A list entry may be `{"orgnr": …, "years": [2025]}` beside a plain orgnr (every year 2021–2025, as today). This is new behaviour: AGENTS.md is updated, and a later run with more years fetches only the documents not stored.
- **The run order, each after Meinich's own yes and run by Meinich:** the dump and backup with sha256; the reference set re-read twice; the labelled set.
- **The cache key** is the PDF's sha256, the Tesseract version, the sha256 of `nor.traineddata`, the render settings, and the options of both passes. Only an exact match uses the stored words. A key that differs runs full OCR and is counted in `run.step1`, never silently. Hits and misses are counted per run.
- **A re-read still fetches the PDF**, so a refiled document has another sha256 and misses. `reader_commit` is set as today, also on a hit.
- **The cache is gitignored and kept only locally**, like the PDFs, until the licence assessment in Story 5.4. No seed, export or committed file holds its words.
- **Every run starts only after Meinich's own yes, and Meinich runs it** in their own windows. Before it, a dump and backup with sha256, as in 2.5c. After it, a new dump as the restore source, and README "Seed" updated in the same commit. No dump is deleted.
- **No fingerprint result is tied to an orgnr of the labelled set**, in output, chat, the terminal, tests, commits or PR text. Totals only. Its 720 pairs in `labels.csv` are not labelled yet.

## Boundaries & Constraints

**Always:**
- A cached read is the same read: `read_words` runs on the stored words exactly as on Tesseract's.
- The key's values are read at run time (`tesseract --version`, the traineddata file's sha256), not copied from constants.
- A cache entry is written atomically (a temporary file, then a rename); an unreadable entry is a miss with its reason.
- One transaction per document, as today; a cached read changes no write, reconciliation or status rule.

**Never:**
- Change D1, `layout`, the reconciliation rules or `ingest/config.toml`'s values.
- Use words whose key differs in any part, or repair a key.
- Put the cache in the image, the seed, an export, `analysis/output` or any committed file.
- Start a run, `pnpm seed` or a deletion of rows without Meinich's yes. Delete a dump.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails if deleted |
|---|---|---|---|
| Hit | the entry's key equals the run's | no Tesseract call; the same `DocumentRead` (figures, status, checks) as through Tesseract; `ocr_cache_hit` +1 | `ingest/tests/test_ocr_cache.py::test_hit_reads_the_same_as_tesseract` (recorded words of 979607008-2025 against `expected-979607008-2025.json`) |
| Hit in the image | the fixture PDF read twice in the built image | the second read is a hit, with the same JSON | CI step `ocr-image-check` (`image_check.py`, cached pass) |
| No entry | a new PDF | full OCR, entry written; `ocr_cache_miss_absent` +1 | `test_ocr_cache.py::test_absent_runs_ocr_and_writes` |
| Key differs | one part differs (each part parametrised) | full OCR, entry replaced; `ocr_cache_miss_key` +1, and the differing part named in the counts | `test_ocr_cache.py::test_key_part_differs_runs_ocr` |
| Unreadable entry | truncated gzip or bad JSON | full OCR; `ocr_cache_miss_unreadable` +1 | `test_ocr_cache.py::test_unreadable_entry_is_a_miss` |
| Paper filing | top only, `pages == []` | cached and read as a paper filing | `test_ocr_cache.py::test_paper_filing_cached` |
| Re-read, refiled | the same (orgnr, year), another PDF | fetched; another sha256, a miss | `ingest/tests/test_documents_run.py::test_reread_fetches_and_misses_a_refiled_pdf` |
| `reader_commit` on a hit | a re-read whose words hit | the row carries the current commit | `test_documents_run.py::test_reread_hit_sets_reader_commit` |
| Counts in the record | a run with hits and misses | `run.step1.counts` holds each count | `ingest/tests/test_run_record.py::test_ocr_cache_counts_recorded` |
| No cache configured | `PEERLESS_OCR_CACHE` unset | full OCR; `ocr_cache` "off" in the counts | `test_run_record.py::test_ocr_cache_off_recorded` |
| Mount | `pnpm ingest --documents`/`--reread` | a read-write bind of `.local/ocr-cache` and the env var; not on a plain or `--companies-only` run | `test/run-ingest.test.ts` |
| Years per entry | `{"orgnr": X, "years": [2025]}` | only 2025 is fetched; a plain orgnr keeps 2021–2025; a bad entry (no orgnr, a year outside 2021–2025, empty years, duplicates) refuses the list | `ingest/tests/test_documents_run.py::test_list_entry_years_limit_the_fetch`, `::test_bad_list_entry_refused` |
| More years later | 2025 stored, then the plain orgnr | only 2021–2024 fetched | `test_documents_run.py::test_more_years_fetch_only_unstored` |
| Labelled list | the 5.1 draw | distinct orgnrs in byte order, each `{"orgnr", "years": [2025]}` | `test/document-set.test.ts` "labelled" |
| `--reread-all` | a stored document whose `reader_commit` is current | re-read (fetched, read, replaced); `--reread` on the same list skips it as current | `test_documents_run.py::test_reread_all_reads_a_current_document`, `::test_reread_skips_a_current_document` |
| `--reread-all` rules | a refused orgnr, a hung fetch, three deadlines in a row, a read that would fail reconciliation | as `--reread`: refused, not replaced, stop, exit 1 | `test_documents_run.py` (the `--reread` cases parametrised over both modes) |
| `--reread-all` derive | `pnpm ingest --reread-all f` | derive runs after; the mount and env as `--reread` | `test/run-ingest.test.ts` |
| Seed comparison | the reference set's rows and the last runs' records | totals: rows equal / differing per field, ignoring `reader_commit` and `read_at`; hits and misses per run | `test/compare-seed-documents.test.ts` |
| Real-data proof | the reference set re-read twice | equal to the seed; the second all hits | Meinich's run; recorded in this spec and the PR |
| Gitignored | a file under `.local/ocr-cache/` | `git check-ignore` matches; `git ls-files .local` is empty | `test/ocr-cache-ignored.test.ts` |

</frozen-after-approval>

## Code Map

- `ingest/src/peerless_ingest/documents.py`: `recognise(pdf)` (:296) is the cache seam; `read_document` (:307) becomes `read_words(*recognise_cached(pdf, cache))`. `read_words` (:261) is unchanged.
- `ingest/src/peerless_ingest/ocr.py`: the settings are the constants at the top (`ZOOM`, `FIGURE_PAGES`, `TOP_DPI`, `TOP_FRACTION`, `PLAIN_ARGS`, `DIGITS_ARGS`); `Word` (6 fields), `PageWords`. The key's render part also holds PyMuPDF's version (it renders the pages). Move `tesseract_version()` and `model_sha256()` here from `image_check.py` (:36, :42) so the run and the check share them.
- New `ingest/src/peerless_ingest/ocr_cache.py`: `Key`, `lookup`, `store`. Entries are `<cache>/<pdf sha256>.json.gz` holding `{"key", "top", "pages"}`, with words as the probes store them (`[text, left, top, width, height, [page, block, par, line]]`).
- `ingest/src/peerless_ingest/run.py`: `_fetch_and_read` (:745), `_load_documents` (:848), `_reread_documents` (:944); the counts in `summary.record_counts()` (:361, :443) become new keys of `run.step1.counts` (jsonb, so no migration). `reader_commit_of` (:1413) is unchanged.
- `scripts/run-ingest.ts` `dockerRunArgs` (:108–130): creates `.local/ocr-cache/` and adds `--mount type=bind,source=…,target=/var/cache/peerless-ocr` plus `PEERLESS_OCR_CACHE` for `--documents`/`--reread`. The image's build context is `ingest/`, so the cache never enters the image. The container writes as uid 10001; this works on Docker Desktop for Windows.
- `ingest/src/peerless_ingest/image_check.py`: a second, cached read of the fixture PDF.
- `scripts/document-set.ts`: `--labelled` beside `--reference` (:42–80), reading `analysis/labelled-set/drawn.json` (subjects and candidates), writing `analysis/labelled-set/document-run.json`. `read_document_list` (`run.py:1426`) takes the years; the year filter sits where stored years are skipped (`run.py:836–846`), within `DOCUMENT_YEARS`.
- `.gitignore` (:66–67, `/.local/`) already covers `.local/ocr-cache/`; the test makes that binding.
- Reuse: `ingest/tests/test_documents.py::recorded_words` (:384) and `expected-979607008-{2025,2011}.json`; `ingest/tests/document_fakes.py`.
- Size: 38 KB per document as JSON, 8.5 KB gzipped (the probe cache's mean). 2 044 + 3 470 documents is about 47 MB; 2 044 + 741 is about 24 MB.

## Tasks & Acceptance

**Execution** (branch `story/2.5d-labelled-set-run-and-ocr-cache`, issue #49; small commits):
- [x] Probe committed (`6a222e5`)
- [ ] Merge `c0f10a0` from `story/5.1-labelled-set` (`--no-ff`)
- [ ] `ocr.py`, `ocr_cache.py`, `documents.py`: the key and the cache, with `test_ocr_cache.py`
- [ ] `run.py`: the cache in both passes and the counts, with the run tests
- [ ] `run.py`: `--reread-all`, with its tests
- [ ] `scripts/compare-seed-documents.ts` (`pnpm analysis:seed-documents`), with its test
- [ ] `scripts/run-ingest.ts`: the mount, with its test; `test/ocr-cache-ignored.test.ts`
- [ ] `image_check.py`: the cached pass in CI
- [ ] `run.py` `read_document_list` and the year filter, with their tests; `scripts/document-set.ts --labelled` and its list, with its test
- [ ] Docs: `AGENTS.md` (Stack), `docs/data-sources-brreg.md`, the README (the cache, `.local/ocr-cache/`), `docs/ai-log.md`, the session file, `deferred-work.md` (close the Story 2.5 entry's run part)
- [ ] Planning documents: `epics.md` Story 2.5d if a decision changes it, the PRD only if an FR does; the PR line "Planning documents:"
- [ ] After review and Meinich's yes: the dump and backup with sha256; Meinich runs `pnpm ingest --reread analysis/ocr-reference/document-run.json` (OCR, fills the cache), then `pnpm ingest --reread-all analysis/ocr-reference/document-run.json` (the cache), compared with the seed, the counts recorded here and in the PR; then `pnpm analysis:document-run before-2.5d`; Meinich runs `pnpm ingest --documents analysis/labelled-set/document-run.json`; `pnpm analysis:document-run after-2.5d`; the new dump `.local/document-run-2.5d/`, README "Seed" updated in the same commit; the seed re-export as in 2.5c, from the allow-list.

**Acceptance Criteria:**
- Given the labelled set's companies without read documents, when the run is done, then every document has the current `reader_commit` or is listed as not read with its reason, `pnpm derive` has run, and the counts are reported as totals.
- Given the run, when its record is read, then the cache's hits and misses are in `run.step1.counts`.
- Given any committed file or PR text, then no fingerprint result is tied to an orgnr of the labelled set.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:ingest` -- all green
- `git check-ignore -q .local/ocr-cache/x.json.gz && test -z "$(git ls-files .local)"` -- passes
- After the run: `pnpm seed` twice, `pnpm seed:export && git diff --exit-code seed/` -- only the expected `reader_commit` and allow-list changes
