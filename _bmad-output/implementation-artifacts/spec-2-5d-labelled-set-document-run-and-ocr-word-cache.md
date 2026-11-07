---
title: "Story 2.5d: The labelled set's document run, with a local OCR word cache"
type: 'feature'
created: '2026-11-07'
status: 'in-review'
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
- [x] Merge `c0f10a0` from `story/5.1-labelled-set` (`--no-ff`) (`7c27af8`)
- [x] `ocr.py`, `ocr_cache.py`, `documents.py`: the key and the cache, with `test_ocr_cache.py` (`93cc97b`, `25917d3`)
- [x] `run.py`: the cache in both passes and the counts, with the run tests (`3338427`)
- [x] `run.py`: `--reread-all`, with its tests (`c460e70`)
- [x] `scripts/compare-seed-documents.ts` (`pnpm analysis:seed-documents`), with its test (`1b7f3c6`)
- [x] `scripts/run-ingest.ts`: the mount, with its test; `test/ocr-cache-ignored.test.ts` (`549d631`)
- [x] `image_check.py`: the cached pass in CI (`60f1918`)
- [x] `run.py` `read_document_list` and the year filter, with their tests; `scripts/document-set.ts --labelled` and its list, with its test (`f174c5d`, `863c59d`, `61e932e`)
- [x] Docs: `AGENTS.md` (Stack), `docs/data-sources-brreg.md`, the README (the cache, `.local/ocr-cache/`), `docs/ai-log.md`, the session file, `deferred-work.md` (close the Story 2.5 entry's run part)
- [x] Planning documents: `epics.md` Story 2.5d if a decision changes it, the PRD only if an FR does; the PR line "Planning documents:" (`epics.md`: the decisions under Story 2.5d; the technical note: the cache and `--reread-all`; the PRD: none affected, no FR changes)
- [ ] After review and Meinich's yes: the dump and backup with sha256; Meinich runs `pnpm ingest --reread analysis/ocr-reference/document-run.json` (OCR, fills the cache), checked with `pnpm analysis:seed-documents` (exit 0), then `pnpm ingest --reread-all analysis/ocr-reference/document-run.json` (the cache), checked with `pnpm analysis:seed-documents --cache-proof` (exit 0), the counts recorded here and in the PR; then `pnpm analysis:document-run before-2.5d`; Meinich runs `pnpm ingest --documents analysis/labelled-set/document-run.json`; `pnpm analysis:document-run after-2.5d`; the new dump `.local/document-run-2.5d/`, README "Seed" updated in the same commit; the seed re-export as in 2.5c, from the allow-list.

**Acceptance Criteria:**
- Given the labelled set's companies without read documents, when the run is done, then every document has the current `reader_commit` or is listed as not read with its reason, `pnpm derive` has run, and the counts are reported as totals.
- Given the run, when its record is read, then the cache's hits and misses are in `run.step1.counts`.
- Given any committed file or PR text, then no fingerprint result is tied to an orgnr of the labelled set.

## Implementation Notes

- **As built** (implementation subagent, 2026-11-07; commits in the Tasks above, totals only):
  - **The key** (`ocr_cache.Key.as_json`) has six parts: `pdf_sha256`, `tesseract`, `traineddata_sha256`, `render` (`zoom`, `figure_pages`, `top_dpi`, `top_fraction`, `pymupdf`), `plain_args` and `digits_args`.
    - `tesseract` is the report of `tesseract --version` (`ocr.tesseract_version_report`), not only its first line. It includes leptonica, the image libraries and the CPU features Tesseract found; it leaves out the libarchive and libcurl lines, which the read never uses and which change with every base-image rebuild. **For Meinich to confirm in review**: the CPU features make the cache specific to the machine's CPU, which costs nothing while the cache is local.
    - A key that differs counts `ocr_cache_miss_key` and names each differing part in `ocr_cache_miss_key_parts`. A stored key with another set of parts counts as differing in `parts`.
  - **Not in the key: `ocr.read_tsv` and `xargs_argv`'s `tsv` output config.** These two turn Tesseract's output into the stored words, so a change to either would not miss. **For review**: such a change needs `.local/ocr-cache/` emptied, or a further key part.
  - **The counts** go into `run.step1.counts`:
    - `ocr_cache` ("on" or "off");
    - `ocr_cache_hit`, `ocr_cache_miss_absent`, `ocr_cache_miss_key`, `ocr_cache_miss_key_parts`, `ocr_cache_miss_unreadable`;
    - `ocr_cache_write_failed`: an entry that could not be written. The read goes on, and the failure is named on stderr.
  - **A set `PEERLESS_OCR_CACHE` whose key cannot be read** (no Tesseract, no model file) refuses the run with exit 2, before any connection. It is never run with a partial key.
  - **`--reread-all`** is recorded as mode `reread` with `reread_all: true` in its counts. `run.step1`'s mode check is unchanged, so there is no migration and no seed re-export.
    - It does not resume: a rerun reads every document again. The three-deadlines test asserts this.
  - **Years per entry** apply in every list mode. In documents mode no other year is fetched (`not_asked_years`); in the re-read modes no stored document of another year is re-read (the same count).
    - The labelled list has 845 entries, each `{"orgnr", "years": [2025]}`. `analysis/labelled-set/document-run.json` is `-text` in `.gitattributes`, as the reference list is, so a Windows checkout keeps it byte-equal to what `--labelled` writes.
  - **`pnpm analysis:seed-documents` reads as `ingest`**, with `default_transaction_read_only`, because `reader` has no access to schema `run`. It compares every column from the catalog except `reader_commit` and `read_at`. Before any run of this story, on the local database: 97 documents and 194 columns equal to the seed.
    - Review fix: its one pure `verdict` also requires every compared document to carry the current reader commit, fails on an unreadable count, and with `--cache-proof` requires the newest run to be a `--reread-all` of all hits and no miss. Before any run it therefore exits 1 (0 of 97 documents read by the current commit), as it should.
  - Review fixes in step 1: an entry with no figure pages whose top now classifies as generated is a miss (`ocr_cache_miss_pages`); a stored key with a missing or an extra name misses in `parts`; a failed `tesseract --version` gives no key part; a year an entry asks for that `/aar` does not list is named (`asked_not_listed`); the deadline stop of `--reread-all` says a new run reads everything again.
  - **The image check**, run locally in the built image: both fixture PDFs (2025 generated, 2011 paper) match, live and through the cache, the second read a hit.
- **Verification** (2026-11-07):
  - all green: `pnpm typecheck`, `pnpm test` (1013), `pnpm test:db` (167), `pnpm test:ingest` (359).
  - `pnpm lint` fails locally only on files in `.local/wt-5.1/`, a local git worktree of `story/5.1-labelled-set` that ESLint's `.` includes. It is outside the repository's tree, and CI does not see it. `eslint . --ignore-pattern ".local/**"` is clean.

## Spec Change Log

## Review Triage Log

Pass 1, 2026-11-07. The diff ran from `dc4f737` to `6779472`, without Story 5.1's merged files (`analysis/labelled-set/*` other than the run list, `test/labelled-set-draw.test.ts`; taken unchanged from `c0f10a0`), the run list itself (845 entries), this spec and the epic context. Three layers ran: blind hunter (BH), edge-case hunter (EC) and verification gap (VG).

| # | Finding (layer) | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | `layout.classify` decides whether the figure pages are recognised, and is not in the key: an entry stored as a paper filing (`pages == []`) still hits after a fix to `classify` makes it generated (BH, EC) | medium | Confirmed: `documents.recognise` (:296) recognises the figure pages only when `classify(top) == "generated"`; on a hit `read_words` re-classifies the top as generated and reads no page, so the document gets a wrong status with the new `reader_commit` | patch: a hit whose top now classifies as generated with no stored pages is a miss (`pages`), counted, read by OCR |
| 2 | The key holds no version of the code that makes the words (`ocr_top`, `ocr_figure_pages`, `_run`, `read_tsv`, the `tsv` config, the render calls) (BH, EC; the build's own note) | medium | Confirmed: a change there returns the old words with no miss. The frozen key lists five parts; a sixth is a change to Meinich's decision | reject (spec edit); put to Meinich at the presentation |
| 3 | `tesseract --version` exiting non-zero with text on stderr makes that text the key's Tesseract part (EC) | low | Confirmed: `result.stdout or result.stderr` ignores the exit code; the run is then not refused as the docstring says | patch: "" on a non-zero exit |
| 4 | A year an entry asks for that the register's `/aar` list lacks is neither fetched nor named (BH, EC) | medium | Confirmed (`run.py` `_load_documents`): for the labelled set, a company without a 2025 document would be missing from the run's report, against the acceptance criterion "listed as not read with its reason" | patch: count and name each (orgnr, year) asked for but not listed |
| 5 | Documents mode re-reconciles every stored year, while the docs say an entry's years mean "only those years" (BH, EC) | low | Confirmed: `_rereconcile` (:692) takes no years; it fetches nothing and applies the same rules, so no status changes unless the rules did. The docs overclaim | patch: the docs say re-reconciliation covers every stored document; a test pins it |
| 6 | `mkdirSync` of `.local/ocr-cache` can throw with a stack trace (EC) | low | Only if `.local/ocr-cache` is a file or the disk refuses; unlikely, and the fix adds a branch | reject |
| 7 | The cache mount uses `path.join`, not `path.resolve`, so a relative root gives a relative bind source (EC) | false | `main` is called with `process.cwd()` (`run-ingest.ts:266`), always absolute | reject |
| 8 | `referenceOrgnrs` accepts only plain orgnr strings, not `{"orgnr", "years"}` (BH, EC) | low | The reference list is plain strings, written by `--reference`; the script reads no other list | reject |
| 9 | The comparison shows a missing or non-integer cache count as 0 (EC) | low | Confirmed: a silent fallback (AGENTS.md, L9) | patch: shown as unreadable, and it fails the cache check |
| 10 | The comparison does not enforce "the second only hits", and ignoring `reader_commit` cannot tell that the re-reads happened (BH, EC) | medium | Confirmed: `main` exits on row differences only; two re-reads that skipped every document would pass | patch: every compared document must carry the current reader commit; `--cache-proof` also requires the newest run to be `--reread-all` with the cache on, every read a hit and no miss or failed write |
| 11 | `main` of the comparison is run by no test (VG) | medium | Confirmed: only the helpers are imported | patch: the verdict as a pure function, unit-tested per condition, and a `test/db/` test that the catalog select lines up with the loaded seed |
| 12 | A stored key with an extra or a missing part is untested (`"parts"`) (VG, BH) | low | Confirmed: deleting the check fails no test (L2) | patch: both cases tested |
| 13 | The deadline stop says "a new run resumes here" also for `--reread-all`, which does not resume, and the test pins that text (BH) | low | Confirmed (`run.py:797`) | patch: the reason says a rerun reads every document again; the test asserts it per mode |
| 14 | The comparison connects as `ingest`, which can write, guarded by a connection setting no test checks; AGENTS.md's list of scripts reading database URLs is not updated (BH) | medium | Confirmed. The alternative, SELECT on `run.step1` for `reader`, is a migration and a grants change | patch: a test of the read-only setting and the AGENTS.md line; the choice of role put to Meinich |
| 15 | The image check runs Tesseract one extra time per fixture (BH) | low | CI time only; the round trip stays proven | reject |
| 16 | The cache is never pruned and its size is not reported (BH) | low | Refiled PDFs leave orphans of about 8.5 KB; no harm to a read | reject |
| 17 | The technical note's `run.step1` paragraph lacks `reread_all` and the cache counts; the session file has no review section yet; Story 2.5c's closing log (`36b6117`, local `main`) is on the branch (BH) | low | Confirmed. The log commit was made on local `main` after 2.5c and not pushed, so the branch carries it | patch (the technical note; the session file at the end); the log commit put to Meinich |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:ingest` -- all green
- `git check-ignore -q .local/ocr-cache/x.json.gz && test -z "$(git ls-files .local)"` -- passes
- After the run: `pnpm seed` twice, `pnpm seed:export && git diff --exit-code seed/` -- only the expected `reader_commit` and allow-list changes
