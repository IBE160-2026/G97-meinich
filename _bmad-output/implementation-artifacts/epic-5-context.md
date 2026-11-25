# Epic 5 Context: Prove it and make it runnable — measurement, demo seed and About page

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 5 turns v1 into something a sensor can trust and run. It measures the peer funnel layer by layer against an independent labelled set, and that result switched stages 4 and 5 off in v1. It commits a demo seed with three demo companies that shows every v1 feature within what the register's licence allows, behind a licence gate. It has 30 stored explanations read by a person, completes the "Slik fungerer Peerless" page, and proves from a fresh clone that the README alone reaches a complete analysis with no keys. Stories 5.1 and 5.2 are done. The rest remains: 5.4 directly after Epic 3, then Epic 4, 5.5, 5.6, 5.3 (cut first) and 5.7 last.

## Stories

- Story 5.1: The labelled set (done)
- Story 5.2: Layer-by-layer measurement (done)
- Story 5.3: Embeddings — last, and cut first
- Story 5.4: The demo seed
- Story 5.5: 30 explanations read by a person
- Story 5.6: "Slik fungerer Peerless" in full
- Story 5.7: Runs from a fresh clone

## Requirements & Constraints

- **Measurement results that bind the rest of the epic:** stage 5 (classification) was not kept (+2.967 pp precision, +1.422 pp recall, below the fixed 3 pp rule). Meinich kept both banded measures (cost-of-goods share and personnel-cost share) but switched the fingerprint signal off as well. In v1, stages 4 and 5 are computed and stored but select nothing. No peer is flagged, every match basis is "Kun bransje og størrelse", and the Peers tab shows stages 1–3 with a note. The 62.100 entry in `seed/coverage.json` is `measured: true` and cites its report by path and SHA-256.
- **Reports** go to `analysis/output/` with their generation date and the script that produced them. They state no numeric target. Layers are reported alone and cumulatively and split by description quality. SM-1 shows three layers, or four with embeddings.
- **Embeddings (5.3)** are batch-only and stored with pgvector. Only `derive` writes them, and they reference the company `ON DELETE CASCADE`. No request path reads them, and no peer is ever chosen by them. pgvector moves from "Deferred" to the stack in the technical note in the same PR.
- **Demo seed (5.4):**
  - **A** is a typical consultancy with a full analysis. **B** is a loss-making product company with a large gap against its stages 1–3 group. Each is recorded with the reason it was chosen.
  - **C** is the 69.202 company already chosen, which must still show the uncovered state.
  - No demo company is chosen to show an AI layer.
  - At least one demo company must show the margin waterfall with ≥10 peers in its common set, and every "Vis tallene" row must have its drill-down. An e2e test on the committed seed asserts this.
  - A document-based peer aggregate's drill-down shows the filing year and the range of the peers' read dates (same rule as the waterfall facts), never one peer's date.
  - The README lists the three demo orgnrs and what each demonstrates.
- **Licence gate:** a short committed assessment decides whether committing derived fingerprint categories is low risk. Its result goes in `docs/licence-gate.json` (`{open, assessment, date}`), which `pnpm seed:export` reads. If the gate is closed, fingerprint categories are exported only for allow-listed companies. Every 62.100 company still gets a stages 1–3 group and a stored classification.
- **Source credit:** the "Kilder og lisens" section gets the document-figure paragraph whether the gate opens or not. It credits Brønnøysundregistrene as the source of document figures read by Peerless, asserts no licence, and is kept separate from the NLOD credit for API figures. The wording "og for resten av bransjen bare avledede kategorier" appears only if the gate is open. The "Ikke i demodataene" popover links to this paragraph.
- **Explanation review (5.5):** 30 stored explanations are drawn at random, with the draw seed recorded, and read by a person before they are committed. Missed recommending phrasing goes into the phrase list, and affected texts are regenerated or withheld. The result is recorded in `docs/ai-sessions/`. Every 62.100 default group then has an explanation, or a failure recorded in step 2's run record. Seed load passes the figure test, the phrase check and the digest check.
- **About page (5.6):**
  - **Funnel:** the five stages in plain language, without formulas. It says stages 4 and 5 were measured and switched off, so the group is chosen by industry, size, comparable accounts and legal form.
  - **AI:** classification is stored only and chooses no peer. The page also covers the explanation and includes the exact test sentence about the automatic figure test.
  - **Measurement:** SM-1 and SM-2 results are read from the committed reports. A test fails on any measurement figure with no report behind it. Without results, show "Målingen pågår. Resultatene publiseres her når de foreligger." with no placeholder figures.
  - **Limitations:** VAT in receivable days, cost-line classification, FTEs from the notes, the `smaaForetak` limit, and that only 62.100 is covered.
  - **Also:** data age, and "Kilder og lisens" kept as 5.4 left it.
- **Fresh clone (5.7):**
  - On a clean machine with no keys, the README's five commands reach a complete analysis for A, B and C. The full test suite passes, AI test mode included.
  - A no-network test proves that no request leaves for the register or a model host.
  - Loading the seed twice leaves the same state.
  - `pnpm audit` shows no advisory in `next` just before delivery. Fix any advisory with a patch upgrade and record the result in the PR.
- **`pnpm seed:full`** runs step 1 (and `--documents <list>` only when the user gives a list) and then `pnpm derive`. It never calls a model and needs no key. It exports to a gitignored path and loads through the same loader with dataset `full`. Classifications come from the committed seed. Explanations are shown only where their digest matches, otherwise a notice. The README states the cost (about 21 s per document) and that new classifications need `pnpm classify` with a key.
- **Phone width:** every page reflows to 320 px with no horizontal body scroll.

## Technical Decisions

- **One seed path (AD-16):**
  - Seed files are written only by `pnpm seed:export`, deterministically, as CSV with collation-free ordering, and are read only by the loader.
  - The manifest records the format version, migration id, dataset (`demo`/`full`), fetched codes, document-figure orgnrs, read-date range and per-file checksums.
  - `seed/coverage.json` is the only hand-edited seed file. The loader fails loudly if a `measured: true` entry lacks a valid report reference.
- **Datasets and the allow-list (AD-9):**
  - A database holds one dataset at a time. Loading truncates and replaces.
  - Document figures, fingerprint categories and explanations carry a dataset tag, as provenance only.
  - A tag-blind allow-list test fails on document figures for any orgnr not in `seed/allow-list.json`. That list holds A, B, C, A's and B's peers at all three band steps, and the OCR reference set. A reviewer approves it in the PR.
  - A second test asserts that A's and B's groups at every step are subsets of the list.
- **Digests (AD-13):** stored derived rows carry a digest of their inputs, and explanations are shown only when their digest matches the engine output for the loaded dataset.
- **No model in a request (AD-7):** classifications and explanations are produced in batch step 2 with the model id and prompt hash. The request path only reads stored rows.
- **Batch steps (AD-2):** Python step 1 (OCR, register) and Node step 2 (`derive`, `classify`). Postgres is the only hand-off between them. Neither is a service.
- **Signals off:** with both signals off, the v1 funnel's `group` equals `pool`. `src/engine/fingerprint.ts`, the bands, the stored fingerprints, the classifications and `pnpm derive` stay unchanged so stage 2 can measure again.
- **Risk statements:** PRs for 5.3 and 5.4 must state what could go wrong (embeddings reaching a group or the request path; document figures leaking beyond the sample, or a licence claim the register does not make) and record that reasoning in `docs/ai-log.md`.

## UX & Interaction Patterns

- **About page layout:** a table of contents, sticky on desktop and a bordered box on phone. Header and footer links resolve.
- **Footer:** every page carries the source line linking to "Kilder og lisens".
- **Demo links:** the "not in database" and "search no match" states link to demo A and B, replacing their placeholders. Industry names come from the register, never a literal.
- **"Ikke i demodataene" popover:** uses EXPERIENCE's exact text, which names no command and promises no full dataset. A test on the message file checks it.
- **AI marking:** the ✦ marking appears only on the explanation, never on the Peers tab in v1.
- **Focus management:** follows the established rules (route change → h1, provenance → its heading and back to the trigger).

## Cross-Story Dependencies

- 5.4 needs Epic 3 complete (waterfall, provenance) and the 5.2 decision (signals off). It replaces the local document dump with committed rows for the allow-listed companies.
- 5.5 needs Epic 4 (stored explanations, figure test, phrase test) and the 5.4 seed. Until then the seed carries no explanations, and the card shows its no-stored-explanation state.
- 5.6 builds on 5.4's "Kilder og lisens" paragraph and the committed SM-1 and SM-2 reports. 5.3 later updates its measurement section to four layers.
- 5.3 is optional and is the first thing cut. It re-runs SM-1, and the withdrawal-deletion test must cover the embedding table.
- 5.7 comes last and confirms on a clean machine what CI has checked on every PR since the seed path was introduced.
- Epic 6 (stage 2/3) does not start until 5.7 passes.
