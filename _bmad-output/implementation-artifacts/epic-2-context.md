# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group trustworthy and inspectable. Batch step 1 reads the filed 2021–2025 documents by OCR, stores every figure as filed with a per-column reconciliation status, measures OCR accuracy (SM-2) and deletes companies the register withdraws. Batch step 2 derives a business-model fingerprint (funnel stage 4) and a model classification (stage 5) ahead of time. In the request path the user sees how the group narrowed at each stage and why each peer is in it, can exclude peers and widen the size band with everything recomputed, and every missing figure states its reason instead of reading as zero. This turns the Epic 1 stages 1–3 group into one a user can judge before trusting any comparison.

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
- Story 2.6a: The register text classification reads
- Story 2.6: Classification (stage 5)
- Story 2.7: The Peers tab shows why
- Story 2.8: Adjust the peer group
- Story 2.9: Missing figures say why

## Requirements & Constraints

- **Nothing is fetched, OCR'd or sent to a model during a request.** Document figures, fingerprints and classifications are pre-warmed by batch runs; the app runs on stored output without any key.
- **Reconciliation decides acceptance, per column, never per figure.** Two rules, never collapsed and neither exact equality: within a document a tight absolute bound (5 kr); document against API max(5 kr, 0.001 % of the API figure). Values set once in config. A column is `reconciled` only if the income-statement check and a balance check pass, no check fails, and (current column) the API comparison does not fail; the filing's flag is its current column's. A failed column's figures never reach the engine — not caveated, substituted or estimated. The flag never takes OCR confidence as input.
- **Never repair an OCR digit.** A token with a non-digit character, a digit token too narrow for its digit count, or an assembly outside the generated layout yields no figure. Read improvements must be measured before and after and must not add errors reaching the engine.
- **Withdrawal:** only an explicit `410 Gone` deletes, by cascade, and the company disappears from every group and aggregate; a dissolved company is kept with its date; anything else is a recorded failure. Each step writes its own run record, failures included.
- **Never select on a benchmarked measure.** Selection functions take no margin, return or productivity input; cost-of-goods and personnel-cost shares enter only as band ids; within-band spread must stay non-trivial (threshold fixed before data).
- **Classification** uses only name, secondary codes, statement of purpose and business description, answers only from the fixed type set or the abstention `uklart`; out-of-set answers are `failed`, never coerced; unchanged text makes no call; no text gives `no_text` and the company stays eligible. Only an AS in a covered industry is classified.
- **Peers tab:** five-stage funnel with counts (shown even below the 10-peer floor), flagged count, deterministic "Hvorfor med" (no model input), one of four match bases, ✦ only on bases resting on a classification.
- **Adjusting:** exclude/restore/band/reset write nothing to any table, push one history entry each, recompute every figure on every tab, and can move a figure across the 10-peer floor either way. Comparability, legal form and geography are never loosenable; the size band is the only one in v1. Peer assembly for a new URL under 1 s.
- **Absence reasons (2.9):** every figure is a value or an absence with exactly one reason — undefined; failed reconciliation; not in this dataset; below the floor; not read in v1. Undefined is never zero: zero/negative denominator (a derived one of 5 kr or less counts as not positive) or an underivable missing component; the company leaves only that figure's distribution and the left-out count is returned. A missing component is first derived from its stated total, in the engine only. "Not in this dataset" comes from the manifest's list of orgnrs with document figures, never from a missing row. Key figures 7 and 8 (per årsverk) are absent as "not read in v1" for subject and every peer.
- **Subject's own filing failed (FR-71):** the three API figures keep full comparison and the driftsmargin kroner; the twelve document figures are absent with that reason; the subject keeps tabs and peer group and is not shown as uncovered. A failed peer leaves document-figure distributions only, still counting for API figures.
- Every PR states what could go wrong (auth, data access, money, OCR, model, deletion) and records it in the AI log.

## Technical Decisions

- **One engine (`src/engine`).** All derived arithmetic, fingerprints and digests live there; Python only checks reconciliation and never computes a ratio. Exhaustive switches map each absence reason to exactly one UI state so a new reason fails to compile.
- **One writer per table.** Step 1 (Python, containerised, `ingest` role) writes register data and documents as filed in `bigint` øre, NULL for empty, never derived values; step 2 (Node scripts, `derive` role) writes fingerprints, classifications and its run record; the seed loader writes a seeded database. Run records live in schema `run`, one table per step, never seeded.
- **Storage:** `register.document` keyed (orgnr, filing year — from the register's list, never a requested `år`), `register.document_column` keyed (orgnr, year, role current/prior) with check results and status. Every row carries a dataset tag and the reader's commit. Every step-2 table references the company `ON DELETE CASCADE`.
- **Stored derived rows carry a digest** from the one digest function; fingerprints are rebuilt whole on every derive and recomputed in CI for allow-listed companies; classifications store model id, prompt hash and text digest.
- **Business types** `produkt`, `konsulent`, `forhandler`, `annet`, defined once and shared by fingerprint and classification; fixed bands and a first-match rule; an empty line is an interval, not 0, and a type is given only if every value in it agrees (otherwise undetermined, not excluded).
- **Combining signals:** both agree → decides; both disagree → kept and flagged "Usikker klassifisering", never adjudicated; one present → it decides; neither → stages 1–3 alone. A signal missing for the subject is missing for all. Flag and match basis depend on the subject, so they are computed in the request and never stored.
- **Pool vs group:** the pool (stages 1–3) is what `ekskl` validates against; the group (after stages 4–5) is what aggregates use, minus exclusions.
- **URL is the only request state**, read and written only by the analysis-state module; peer changes are `router.push` soft navigations rendered on the server; a failed change keeps the last good URL and figures (a 429 becomes a full page load). The page payload carries only the shown analysis' figures; pool peers removed at stage 4/5 never reach it.
- **Seed and licence gate:** document figures only for allow-listed orgnrs; fingerprints for others only when the licence-gate file says open. A migration means re-exporting the seed in the same PR.

## UX & Interaction Patterns

- Funnel stages "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", counts in tabular figures with proportional bars; Segment says v1 admits AS only; "{n} ekskludert av deg → {m} i analysen".
- Match bases "Beskrivelse og regnskap" (✦), "Kun regnskap", "Kun beskrivelse" (✦), "Kun bransje og størrelse"; ✦ is `aria-hidden`, read as "KI-generert" once per cell, never on a number.
- Exclusion keeps the row struck through in slate with "Ekskludert" / "Ta med igjen", focus kept, changes announced; size band is a radiogroup with three steps; widened groups are tagged "Utvidet" with a State block; pending regions use `aria-busy` with dimmed figures and no animation; failure shows `role="alert"` "Kunne ikke oppdatere analysen. Prøv igjen.".
- Absence copy: "Kan ikke beregnes" plus reason; "Regnskapet for {år} kunne ikke leses sikkert" (also as a slate header subline, no badge, for a failed subject filing); "Ikke i demodataene" with its info popover; "For få sammenlignbare (n av 10)" — row stays with own value, no comparison or kroner. The "not read in v1" state's copy is added to EXPERIENCE by Story 2.9.
- Works at 375 and 320 px: funnel becomes a vertical list, peer list becomes cards with "Vis alle {n}", targets at least 24 × 24 px, tables in their own scroll containers, body never scrolls horizontally.

## Cross-Story Dependencies

- 2.1a → 2.1b → 2.2: reading library, then storage, then acceptance; 2.3 needs the hand-transcribed reference set (its own issue since week 1); 2.3b, 2.5b, 2.5c re-read stored documents and are measured against earlier outputs; 2.5d needs 2.5c merged and feeds Story 5.2's fingerprint measurement.
- 2.4's deletion test covers every later table referencing the company (fingerprint, classification).
- 2.5 fixes the type set that 2.6 uses unchanged; 2.6 needs 2.6a's stored register texts; 2.7 and 2.8 build on 1.7's peer list and the combined funnel.
- 2.9 delivers the engine absence types and the failed-filing header subline; Epic 3 renders the document rows with those reasons. The explanation's adjusted-group state belongs to Epic 4.
- No committed file or PR text may tie a fingerprint result to an orgnr of the labelled set (Story 5.1/5.2 integrity). Stage 5 stays only if Story 5.2's measurement shows the text earns its place.
