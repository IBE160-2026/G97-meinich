# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group something the user can judge and adjust. Behind the page, batch step 1 reads the filed 62.100 documents for 2021–2025 by OCR, stores the figures as filed and accepts a column only when it reconciles; OCR accuracy is measured (SM-2) against a hand-transcribed reference set; a company the register withdraws (`410 Gone`) is deleted; batch step 2 computes the business-model fingerprint (stage 4) and a model classification (stage 5). On the page, the Peers tab shows the five-stage funnel with counts, "Hvorfor med", "Grunnlag for treff" and "Usikker klassifisering" per peer, lets the user exclude a peer or widen the size band with every figure recomputed, and every missing figure states its reason. Status: 2.1a, 2.1b and 2.2 are done (OCR library, ingest, reconciliation); 2.3–2.9 remain, in order.

## Stories

- Story 2.1a: Read a filed document (OCR library and image)
- Story 2.1b: Store the filed accounts (OCR ingest)
- Story 2.2: Accept only figures that reconcile
- Story 2.3: Measure OCR accuracy (SM-2)
- Story 2.4: Withdrawn companies disappear
- Story 2.5: The business-model fingerprint (stage 4)
- Story 2.6: Classification (stage 5)
- Story 2.7: The Peers tab shows why
- Story 2.8: Adjust the peer group
- Story 2.9: Missing figures say why

## Requirements & Constraints

- **OCR is batch only**; nothing is fetched or read in a request. Match on orgnr only; never trust a requested year. Never repair an OCR digit: a non-digit token makes the figure absent.
- **Reconciliation (settled):** within a document an absolute 5 kr bound (checks c1–c5 per column); between document and API max(5 kr, 0.001 % of the API figure). Never collapsed, never exact equality, values only in `ingest/config.toml`. A column is `reconciled` or `failed_reconciliation`; only a reconciled column's figures reach the engine. The quality flag derives from the checks only, never OCR confidence.
- **SM-2:** compare step 1's output field by field with the reference set (20 filings, seeded stratified draw from all of 62.100, issue #14); state the recent/older boundary before comparing; list every mismatch; report both denominators against the baseline 156/178 and 156/168; no numeric target claimed. Reference orgnrs go on `seed/allow-list.json` with reason "OCR-referansesett", written by `seed:export` from the committed draw.
- **Deletion:** only `410 Gone` deletes (cascade through every `register` table), never flags; any other answer deletes nothing and is written to step 1's run record. A deleted orgnr leaves every peer group, aggregate, seed file, the manifest and the allow-list; in `ekskl` it drops with the invalid-settings notice.
- **Never select on a benchmarked measure.** No stage-1–5 function takes a margin, return or productivity figure; cost-of-goods and personnel-cost shares enter only as band ids. A 62.100 within-band spread test, measure and threshold fixed before running on data; a collapsed band is dropped and recorded.
- **Classification:** the model sees only name, secondary codes, statement of purpose and description, and answers only in the fixed type set (no free text, nothing coerced: outside the set → `failed`). Unchanged text is not reclassified. Nothing to classify → `no_text`, still eligible on stages 1–4. Statuses `classified`, `no_text`, `failed`, `pending`; `seed:export` refuses while a covered-industry row is `failed` or `pending`. No key → stored responses, no network.
- **Peer adjustment:** the size band (0.5–2× → 0.33–3× → 0.25–4×) is the only loosenable criterion; no step admits a comparability failure; no control loosens legal form or geography. Assembly under 1 s (timed test); re-render time measured and recorded in the PR. A figure can cross the 10-peer floor either way.
- **Absence reasons:** each figure is a value or an absence with exactly one reason — undefined, failed reconciliation, not in this dataset (decided from the manifest, never from a missing row), below the floor (with count). A subject whose own filing failed reconciliation keeps its API figures, kroner, tabs and peer group; its twelve document figures are absent.
- **Responsive:** every Peers state at 375 and 320 px with no horizontal body scroll; tables and charts in their own scroll containers.
- **Each PR** states what could go wrong and records it in `docs/ai-log.md`.

## Technical Decisions

- **Two batch steps, one writer per table.** Step 1 (Python, Docker) writes register data and documents as filed and does the one declared delete; step 2 (Node) writes fingerprints and classifications through `DERIVE_DATABASE_URL`. Every ratio, band and type is computed by `src/engine`. Each step has its own run-record table, written only by its own role (2.4 creates step 1's, 2.6 step 2's); every run writes one, failures included; `pnpm seed` prints the latest of each.
- **Document storage (done):** `register.document` keyed `(orgnr, filing_year)`, `register.document_column` keyed `(orgnr, filing_year, role)` with `current`/`prior`, figures as `<field>_ore`, NULL never 0, nothing derived stored. Document status is its current column's; a prior column is accepted on its own c1–c5 and its API comparison is information only. Engine input goes through `documentFigures` in `src/engine/document-inputs.ts`.
- **Schema:** DDL only in migrations; new tables need grants and a `SEED_TABLES`/`LOADER_TABLES` entry, and the seed is re-exported in the same PR. Step-2 tables reference the company `ON DELETE CASCADE`, covered by 2.4's deletion test.
- **Fingerprint:** one type in `src/engine/fingerprint.ts` with five categories (inventory, cost-of-goods band, capitalised intangibles, asset-intensity band, personnel-cost band), mirrored by a migration check; each row stores the engine digest of its raw inputs (AD-13) and the dataset tag; all rebuilt every run; CI recomputes allow-listed ones. Export outside the allow-list follows `docs/licence-gate.json` (absent or closed → allow-listed only).
- **Business types:** one shared set in `src/engine` (proposed produkt, konsulent, forhandler, annet); the model's response schema is generated from it. Story 2.5 fixes the set, meanings, type rule and spread threshold and records them in the technical note's funnel section.
- **Combination rule:** both signals agree → decides (two different non-subject types also remove); disagree → keep and flag "Usikker klassifisering", the model never adjudicates; one present → decides; neither → stages 1–3 only. A signal missing for the subject counts as missing for all. Stage 4 removes a fingerprint mismatch unless the text gives the subject's type; stage 5 removes a text mismatch with no fingerprint.
- **Request path:** stages 4–5 read stored rows only. Peer changes are `router.push` soft navigations to a `serialize` URL rendered on the server; nothing is written. The payload carries no peer field beyond what funnel, list and shown figures need (AD-4).
- **Engine absence type:** a discriminated union with an exhaustive switch to the EXPERIENCE states, failing to compile on a new reason.

## UX & Interaction Patterns

- **Funnel:** "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", tabular counts, 8px navy-700 bar proportional to stage 1; Segment states AS only; "✦ {n} med usikker klassifisering"; shown below the floor too; "{n} ekskludert av deg → {m} i analysen". Phone: vertical list.
- **Peer list:** Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag; caption "✦ KI-generert". "Hvorfor med" is deterministic, no ✦. Basis is one of "Beskrivelse og regnskap" (✦), "Kun regnskap", "Kun beskrivelse" (✦), "Kun bransje og størrelse". ✦ is `aria-hidden`, never on a number. Phone: one card per peer, "Vis alle {n}", targets ≥ 24 × 24 px.
- **Exclude/restore and reset:** row stays slate, struck through, "Ekskludert", "Ta med igjen"; focus stays on the button; live announcements with name and count; reset moves focus to the Peers `h2`. One history entry per change.
- **Size band:** `radiogroup` with roving tabindex, three steps with revenue range; beyond Standard an "Utvidet" State block with "Tilbake til standard (0,5–2×)"; too-small block with "Utvid størrelsesintervallet"; zero peers "Fant ingen sammenlignbare selskaper."
- **Pending/failure:** `aria-busy`, dimmed previous figures with "Oppdaterer …", no animation; failure `role="alert"` "Kunne ikke oppdatere analysen. Prøv igjen.", last good state kept.
- **Failed subject filing:** slate header subline "Regnskapet for {år} kunne ikke leses sikkert", no badge.

## Cross-Story Dependencies

- 2.3 consumes the reference set (issue #14, transcribed) and the 2.1b run. It owns: fixing the "SUM EGENKAPITAL OG GJELD" label miss (~43 % of documents; hit rate before and after), and deciding which acceptance-run document rows (today only in the local DB and a gitignored dump) enter the committed seed, then dropping the dump step from the README.
- 2.4's deletion test is extended by 2.5 and 2.6; 2.5 fixes the business types that 2.6 reuses unchanged; 2.7 shows the result; 2.8 adjusts it; 2.9 adds absence reasons over 2.2's statuses.
- 2.9 owns: årsverk absent (FTE figures #7, #8 shown absent with the right reason), the "revenue not stated" copy and a reason for an empty peer group from a failed comparability field, and choosing that year's own current column (a prior column only when the year has no document; a prior column with `api_check` fail never stands in). Before document figures become a second source, choose the subject's benchmark filing in the engine only.
- Epic 3 renders the document rows; the explanation's adjusted-group state is Epic 4. Story 5.2 follows Epic 2 and measures each funnel layer; Story 5.4 writes the licence-gate file.
