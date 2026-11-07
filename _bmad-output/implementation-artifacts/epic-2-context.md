# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group something the user can judge and adjust. Batch step 1 reads the filed 2021–2025 documents by OCR, stores figures as filed and accepts a column only when it reconciles; OCR accuracy is measured (SM-2) and a company the register withdraws (`410 Gone`) is deleted. Batch step 2 derives a business-model fingerprint (stage 4) and a model classification (stage 5), both into one shared set of business types. On the page, the Peers tab shows the five-stage funnel and why each peer is in it, the user can exclude a peer or widen the size band with every figure recomputed, and every missing figure states its reason. Status (2026-11-07): 2.1a–2.5c are done; 2.5d (the labelled set's document run, with a local OCR word cache) is next, then 2.6, 2.7, 2.8, 2.9.

## Stories

- Story 2.1a: Read a filed document (OCR library and image)
- Story 2.1b: Store the filed accounts (OCR ingest)
- Story 2.2: Accept only figures that reconcile
- Story 2.3: Measure OCR accuracy (SM-2)
- Story 2.3b: Read the balance total ("SUM EGENKAPITAL OG GJELD")
- Story 2.4: Withdrawn companies disappear
- Story 2.5: The business-model fingerprint (stage 4)
- Story 2.5b: Read the cost lines and the parts of intangible assets
- Story 2.5c: Refuse a digit read as two, and cost lines that do not sum
- Story 2.5d: The labelled set's document run, with a local OCR word cache
- Story 2.6: Classification (stage 5)
- Story 2.7: The Peers tab shows why
- Story 2.8: Adjust the peer group
- Story 2.9: Missing figures say why

## Requirements & Constraints

- **Never select on a benchmarked measure.** No stage 1–5 function takes a margin, return or productivity figure as input; cost-of-goods and personnel-cost shares reach selection only as band ids.
- **OCR runs in batch only.** Nothing is fetched or read during a request. Companies are matched on orgnr only; a requested year is never trusted. An OCR digit is never repaired: a non-digit token, or a digit token narrower than 0.6 × its digits × the page pitch (R1), makes the figure absent; a digits-only figure enters only through a passing check or sum gate.
- **Reconciliation is settled.** Within a document 5 kr absolute; between document and API max(5 kr, 0.001 % of the API figure). Never collapsed, never exact equality, values only in `ingest/config.toml`. Only a `reconciled` column's figures reach the engine. Engine-side guards: R2 (four main cost lines short of `sum_driftskostnad` by > 5 kr → no fingerprint, `cost_lines_short_of_total`) and R3 (current `kundefordringer`/`bankinnskudd` above API `sumOmloepsmidler` + tolerance → absent, `exceeds_api_subtotal`).
- **Deletion.** Only `410 Gone` deletes, and the delete cascades; every table referencing a company uses `ON DELETE CASCADE`, covered by Story 2.4's deletion test.
- **Fingerprint is rules only; D1 is locked.** Bands, thresholds and the type rule are not adjusted after data; Story 5.2 confirms or drops each band. Business types are fixed in `src/engine`: `produkt`, `konsulent`, `forhandler`, `annet`. A fingerprint whose unknown categories allow more than one type is *undetermined*: no type, never excluded for it, never counted as `annet`.
- **OCR word cache (2.5d).** Key = PDF sha256 + Tesseract version + `nor.traineddata` sha256 + render settings and both passes' options; only an exact match reuses words, a miss runs full OCR and is reported in `run.step1` and the counts. Cached and live reads must give identical figures, status and checks. A re-read still fetches the PDF. The cache is gitignored and local only until the licence assessment (5.4); no seed, export or committed file holds its words. Before the labelled set is read, check whether `layout.page_kind` explains R4's known `varer` gap. The run itself needs Meinich's yes, ends with `pnpm derive`, and reports totals only.
- **Labelled set is blind.** No committed file or PR text ties a fingerprint result to an orgnr of the labelled set.
- **Classification (2.6).** The model sees only name, secondary industry codes, statement of purpose and business description. Response schema generated from the shared type set, no free-text field; an answer outside the set is never coerced (row `failed`, failure in step 2's run record). Statuses `classified`, `no_text` (never guessed, stays eligible through stages 1–4), `failed`, `pending`; `seed:export` refuses while a covered-industry row is `failed` or `pending`. Unchanged text is not reclassified. Model id pinned; each row stores model id, prompt hash and a description digest. The key is read only by step 2; without it, tests use stored responses and the app stored classifications, with no network call during an analysis.
- **Combination rule (completed in 2.6).** Both signals present and agreeing decide; disagreeing keeps the candidate flagged "Usikker klassifisering" (the model never adjudicates; flag stored, count available to the funnel); one present decides alone; neither leaves stages 1–3 to decide. A signal missing for the subject counts as missing for every candidate. A test per case.
- **Peers tab (2.7).** Precondition: the match basis of an undetermined peer (fingerprinted, no type) is still open (PRD open question 24) and must be settled in the PRD before the story starts. Funnel always shown, also below the 10-peer floor. "Hvorfor med" is deterministic and takes no model output. "Grunnlag for treff" is exactly one of four, from one exhaustive `src/engine` function. Page payload carries no peer field beyond what is shown.
- **Peer adjustment (2.8).** Only the size band is loosenable (0.5–2× → 0.33–3× → 0.25–4×); comparability, legal form and geography never, and no step admits a candidate failing a comparability field. Nothing is written to any table. Assembly under 1 s (timed test); a figure must cross the 10-peer floor both ways. A failed change keeps the last good URL and figures.
- **Absence reasons (2.9).** Each figure is a value or an absence with exactly one reason — undefined, failed reconciliation, not in this dataset, below the floor — mapped to its UI state by an exhaustive switch. Underivable components and non-positive denominators are undefined, never zero; derivation from stated totals happens in `src/engine` only. "Not in this dataset" comes from the manifest. A subject whose own filing failed reconciliation keeps the API figures, peer group and tabs; the document figures are absent with that reason.
- **Every PR** states what could go wrong in its area and records it in `docs/ai-log.md`.

## Technical Decisions

- **One engine.** Every category, band, type, match basis, digest and absence reason is computed in pure `src/engine`; Python computes none.
- **Step 2 is Node scripts** (`pnpm derive` first), writing as `derive` through `DERIVE_DATABASE_URL`, never in a request, no DDL.
- **Run records.** `run.step1` is written only by `ingest`; 2.6 adds `run.step2`, written only by `derive`. Every step-2 run (fingerprints, classifications, later explanations) writes one record with start, end, counts per status, model id, prompt hash and failures. `pnpm seed` prints the latest record of each step, or says there is none.
- **Schema.** DDL only in migrations. A new `register` table gets SELECT, INSERT, TRUNCATE to `loader` and write grants to its one step role, is added to `SEED_TABLES` or `LOADER_TABLES`, and references the company `ON DELETE CASCADE`. A PR adding a migration re-exports the seed.
- **Digests.** Stored derived rows carry a digest from the one digest function in `src/engine`.
- **Request path.** Stages 4 and 5 read stored rows only. `pool` is stages 1–3 (what `ekskl` validation reads); `group` is the pool after the funnel and feeds every aggregate. Peer changes are soft navigations to a `serialize`d URL, rendered on the server; the URL is the only state.
- **Licence gate.** Outside `seed/allow-list.json`, derived categories enter the committed seed only when `docs/licence-gate.json` (Story 5.4) records the gate open; absent or unreadable means closed.
- **Money and decimals.** Exact decimals from the one constructor; `int8`/`numeric` parsed with `parseOre`/`parseDecimal`; every displayed number through `src/engine/format.ts`.

## UX & Interaction Patterns

- **Funnel:** "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", tabular counts with an 8px navy-700 bar proportional to stage 1; Segment says v1 admits AS only; "✦ {n} med usikker klassifisering"; "{n} ekskludert av deg → {m} i analysen".
- **Peer list:** Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag; caption key "✦ KI-generert". ✦ only on bases resting on a classification, `aria-hidden`, read once per cell as "KI-generert", never on a number or "Hvorfor med".
- **Adjusting:** excluded rows stay, slate and struck through, with "Ekskludert" / "Ta med igjen"; focus stays on the button; changes are announced. Size band is a `radiogroup` with roving tabindex; beyond Standard a State block marks the group "Utvidet". Reset moves focus to the Peers `h2`. Pending regions use `aria-busy`, dimmed figures and "Oppdaterer …", no animation; failure is `role="alert"`. Each change is one history entry.
- **Absences:** "Kan ikke beregnes", "Regnskapet for {år} kunne ikke leses sikkert" (slate header subline, no badge), "Ikke i demodataene", "For få sammenlignbare (n av 10)".
- **Responsive:** at 375 and 320 px the funnel is a vertical list, peers are cards with "Vis alle {n}", targets ≥ 24 × 24 px, tables in their own scroll containers, no horizontal body scroll.

## Cross-Story Dependencies

- **2.5c → 2.5d:** 2.5d's labelled-set run reads by the corrected reader, so those 741 companies are read once; Story 5.2 needs that run to measure the fingerprint layer.
- **2.5 → 2.6:** 2.6 reuses the type set unchanged and completes the stage 4/5 combination rule; until then the fingerprint decides alone.
- **2.6 → 2.7 → 2.8:** match basis and flagged count need stored classifications; 2.7 builds on the simple Peers list from Story 1.7; 2.8 builds on 2.7's list and the URL module's `ekskl`/`band`.
- **Open, not owned by a story:** whether a dissolved company (`slettedato` set) stays a peer (today it does); the full 62.100 document run (about 190 hours) — v1 may ship on the demo data.
- **Local data:** the 2.1b acceptance run's documents live only in the local database and gitignored dumps until Story 5.4; never delete them. The committed seed holds document rows only for allow-listed orgnrs.
- **Other epics:** Epic 3 renders the document rows that show 2.9's reasons; the adjusted-group explanation state belongs to Epic 4; Story 5.2 measures each funnel layer and confirms or drops each band; Story 5.4 writes the licence-gate file.
