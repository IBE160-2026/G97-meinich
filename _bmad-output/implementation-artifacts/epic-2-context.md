# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group something the user can judge and adjust. Batch step 1 reads the filed 2021–2025 documents by OCR, stores the figures as filed and accepts a column only when it reconciles. OCR accuracy is measured (SM-2) against a hand-transcribed reference set. A company the register withdraws (`410 Gone`) is deleted. Batch step 2 computes the business-model fingerprint (stage 4) and a model classification (stage 5). On the page, the Peers tab shows the five-stage funnel with counts, and "Hvorfor med", "Grunnlag for treff" and "Usikker klassifisering" for each peer. The user can exclude a peer or widen the size band, and every figure is recomputed. Every missing figure states its reason. Status: 2.1a–2.3b are done (OCR library, ingest, reconciliation, SM-2, the balance-total fix and re-read). 2.4–2.9 are in backlog and come in that order.

## Stories

- Story 2.1a: Read a filed document (OCR library and image)
- Story 2.1b: Store the filed accounts (OCR ingest)
- Story 2.2: Accept only figures that reconcile
- Story 2.3: Measure OCR accuracy (SM-2)
- Story 2.3b: Read the balance total ("SUM EGENKAPITAL OG GJELD")
- Story 2.4: Withdrawn companies disappear
- Story 2.5: The business-model fingerprint (stage 4)
- Story 2.6: Classification (stage 5)
- Story 2.7: The Peers tab shows why
- Story 2.8: Adjust the peer group
- Story 2.9: Missing figures say why

## Requirements & Constraints

- **OCR runs in batch only.** Nothing is fetched or read during a request. Match companies on orgnr only, and never trust a requested year. Never repair an OCR digit: a figure token with a non-digit makes the figure absent.
- **Reconciliation is settled.** Within a document the bound is 5 kr absolute (checks c1–c5 per column). Between the document and the API it is max(5 kr, 0.001 % of the API figure). The two rules are never collapsed into one, neither is exact equality, and their values live only in `ingest/config.toml`. A column is `reconciled` or `failed_reconciliation`, and only a reconciled column's figures reach the engine. The quality flag comes from the checks alone, never from OCR confidence.
- **Deletion (2.4).** Only `410 Gone` deletes a company, and it is deleted, never flagged; the delete cascades through every `register` table. Any other answer (404, 5xx, timeout) deletes nothing and is written to step 1's run record. A deleted orgnr leaves every peer group, aggregate, seed file, manifest list and `seed/allow-list.json`. If it appears in `ekskl`, it is dropped and the invalid-settings notice shows. Only `ingest` may delete from the company table.
- **Never select on a benchmarked measure.** No function in stages 1–5 takes a margin, return or productivity figure as input. Cost-of-goods share and personnel-cost share enter selection only as band ids. A within-band spread test for 62.100 fixes its measure and threshold before it runs on data. If a band's spread collapses, the band is dropped and the drop is recorded.
- **Classification (2.6).** The model sees only the name, secondary codes, statement of purpose and business description. It answers only in the fixed type set: the schema has no free-text field, and nothing is coerced, so an answer outside the set is `failed`. Unchanged text is not reclassified. A company with nothing to classify is `no_text` and stays eligible through stages 1–4. The statuses are `classified`, `no_text`, `failed` and `pending`. `seed:export` refuses while a covered-industry row is `failed` or `pending`. Without a key, the tests run on stored responses and no request goes to a model host.
- **Peer adjustment (2.8).** The size band (0.5–2× → 0.33–3× → 0.25–4×) is the only criterion that can be loosened. No step admits a candidate that fails comparability, and no control loosens legal form or geography. Peer-group assembly runs in under 1 s (timed test), and the re-render time is measured and recorded in the PR. A figure can cross the 10-peer floor in either direction.
- **Absence reasons (2.9).** Each figure is either a value or an absence with exactly one reason: undefined, failed reconciliation, not in this dataset (decided from the manifest, never from a missing row) or below the floor (with the count). If the subject's own filing failed reconciliation, it keeps its API figures, the kroner amount, its tabs and its peer group, and its twelve document figures are absent.
- **Responsive.** Every Peers state works at 375 and 320 px with no horizontal body scroll. Tables and charts sit in their own scroll containers.
- **Each PR** states what could go wrong and records it in `docs/ai-log.md`.

## Technical Decisions

- **Two batch steps, one writer per table.** Step 1 (Python, Docker) writes register data and documents as filed, and makes the one declared delete. Step 2 (Node) writes fingerprints and classifications through `DERIVE_DATABASE_URL`. Every ratio, band and type is computed in `src/engine`. Each step has its own run-record table, written only by its own role: 2.4 creates step 1's table and 2.6 creates step 2's. Every run writes a record, failures included, and `pnpm seed` prints the latest record of each step.
- **Document storage (done).** `register.document` is keyed `(orgnr, filing_year)`. `register.document_column` is keyed `(orgnr, filing_year, role)`, where the role is `current` or `prior`. Figures are stored as `<field>_ore`: NULL is never stored as 0, and nothing derived is stored. Each row carries a `reader_commit`. A document's status is its current column's. A prior column is accepted on its own c1–c5, and its API comparison is information only. The engine gets its input through `documentFigures`.
- **Schema.** DDL lives only in migrations. A new table needs grants and an entry in `SEED_TABLES` or `LOADER_TABLES`, and the seed is re-exported in the same PR. Step-2 tables reference the company `ON DELETE CASCADE`, and 2.4's deletion test covers them.
- **Fingerprint (2.5).** One type in `src/engine/fingerprint.ts` holds five categories: inventory, cost-of-goods band, capitalised intangibles, asset-intensity band and personnel-cost band. A migration check mirrors the type. Each row stores the engine digest of its raw inputs and the dataset tag. Every run rebuilds all fingerprints, and CI recomputes the allow-listed ones. A candidate with no reconciled filing has no fingerprint and is not excluded at stage 4. Fingerprints for companies outside the allow-list are exported only when `docs/licence-gate.json` records the gate as open; if the file is absent or the gate is closed, only allow-listed companies are exported.
- **Business types.** One shared set lives in `src/engine` (proposed: produkt, konsulent, forhandler, annet), and the model's response schema is generated from it. Story 2.5 fixes the set, what each type means, the rule that derives a type from the fingerprint, and the spread threshold. It records them in the technical note's funnel section, under "Rules fixed by the stories".
- **Combination rule.** If both signals agree, they decide; two different types, neither the subject's, also remove the candidate. If they disagree, the candidate is kept and flagged "Usikker klassifisering", and the model never adjudicates. If only one signal is present, it decides. If neither is present, stages 1–3 decide alone. A signal missing for the subject counts as missing for every candidate. Stage 4 removes a candidate whose fingerprint gives another type, unless its text gives the subject's type. Stage 5 removes a candidate whose text gives another type and that has no fingerprint.
- **Request path.** Stages 4 and 5 read stored rows only. Peer changes are `router.push` soft navigations to a URL built by `serialize` and rendered on the server, and nothing is written. The page payload carries no peer field beyond what the funnel, the list and the shown figures need.
- **Engine absence type.** A discriminated union with an exhaustive switch to the EXPERIENCE states, so adding a reason without a state fails to compile.

## UX & Interaction Patterns

- **Funnel.** "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", with counts in tabular figures and an 8px navy-700 bar proportional to stage 1. The Segment stage states that v1 admits AS only. The funnel shows "✦ {n} med usikker klassifisering" and "{n} ekskludert av deg → {m} i analysen", and it is shown below the floor too. On a phone it is a vertical list.
- **Peer list.** Columns: Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag, with the caption "✦ KI-generert". "Hvorfor med" is deterministic and carries no ✦. The basis is one of "Beskrivelse og regnskap" (✦), "Kun regnskap", "Kun beskrivelse" (✦) or "Kun bransje og størrelse". ✦ is `aria-hidden` and never sits on a number. On a phone each peer is a card, with "Vis alle {n}" and targets of at least 24 × 24 px.
- **Exclude, restore and reset.** An excluded row stays in the list in slate, struck through, tagged "Ekskludert", with the action "Ta med igjen". Focus stays on the button, and live announcements give the name and count. Reset moves focus to the Peers `h2`. Each change is one history entry.
- **Size band.** A `radiogroup` with roving tabindex and three steps, each showing its revenue range. Beyond Standard, an "Utvidet" State block offers "Tilbake til standard (0,5–2×)". A group that is too small gets a block with "Utvid størrelsesintervallet". With zero peers the page says "Fant ingen sammenlignbare selskaper."
- **Pending and failure.** While a change is pending, regions carry `aria-busy` and keep the previous figures dimmed with "Oppdaterer …", with no animation. On failure, `role="alert"` shows "Kunne ikke oppdatere analysen. Prøv igjen.", and the last good state is kept.
- **Failed subject filing.** The header gets a slate subline, "Regnskapet for {år} kunne ikke leses sikkert", with no badge.

## Cross-Story Dependencies

- **2.3b is done.** The bold "SUM" read as "50M" is now matched by a second label fold, and `pnpm ingest --reread` re-reads every stored document whose `reader_commit` is not the current one. The `sum_egenkapital_gjeld` hit rate rose from 57 % to 99 % on the 2.1b run, with no new misreads or phantoms reaching the engine. A refiling under an unchanged reader is still not detected.
- **The 2.1b acceptance run is local data.** Its 1 947 documents (407 orgnrs) live only in the local database and a gitignored dump until Story 5.4's allow-list, so they must not be deleted, and the README's dump-restore step stays until then. Only the 20 OCR reference orgnrs' document rows are in the committed seed.
- **Within the epic.** 2.5 and 2.6 extend 2.4's deletion test. 2.5 fixes the business types, and 2.6 reuses them unchanged. 2.7 shows the result, 2.8 adjusts it, and 2.9 adds absence reasons on top of 2.2's statuses.
- **2.9 also owns:**
  - showing årsverk-based figures #7 and #8 as absent, because årsverk is not read in Epic 2;
  - the copy for "revenue not stated";
  - a reason for an empty peer group caused by a failed comparability field;
  - choosing each year's own current column. A prior column is used only when the year has no document, and a prior column whose `api_check` failed never stands in.
  The subject's benchmark filing is to be chosen in the engine alone before document figures become a second source.
- **Other epics.** Epic 3 renders the document rows, and Epic 4 owns the explanation's adjusted-group state. Story 5.2 measures each funnel layer, and Story 5.4 writes the licence-gate file.
