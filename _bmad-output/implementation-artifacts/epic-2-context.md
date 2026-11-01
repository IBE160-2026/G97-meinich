# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group something the user can judge and adjust. Batch step 1 reads the filed 2021–2025 documents by OCR, stores the figures as filed and accepts a column only when it reconciles. OCR accuracy is measured against a hand-transcribed reference set (SM-2), and a company the register withdraws (`410 Gone`) is deleted. Batch step 2 computes the business-model fingerprint (stage 4) and a model classification (stage 5). On the page, the Peers tab shows the five-stage funnel with counts, plus "Hvorfor med", "Grunnlag for treff" and "Usikker klassifisering" for each peer. The user can exclude a peer or widen the size band, and every figure is recomputed. Every missing figure states its reason. Status: 2.1a–2.4 are done. 2.5 is next, and 2.5–2.9 are in backlog and come in that order.

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

- **The fingerprint (stage 4) is rules only.** It groups candidates by what kind of business their own accounts show: cost-of-goods share, whether they carry inventory, capitalised intangibles (such as self-developed software) and fixed-asset intensity, with cost-of-goods share and personnel-cost share in coarse bands. A reseller, a product company and a consultancy must separate, even when all three describe themselves as "Programvareutvikling" and share one industry code. The fingerprint applies to every company whose accounts are extracted.
- **Never select on a benchmarked measure.** No function in stages 1–5 may take driftsmargin, EBITDA margin, totalkapitalrentabilitet, any productivity figure, or any other margin or return as input. Selection never reads total assets or the register's employee count. Cost-of-goods share (key figure 3) and personnel-cost share (key figure 4) are benchmarked as well as being business-model markers, so they reach selection only as band ids, never as values, and they are benchmarked within their band.
- **Banding is proposed, not settled.** A within-band spread test runs for 62.100, the only industry in v1. It asserts non-trivial spread of each banded figure within its band. Its spread measure and threshold are written into the test before it runs on data. If spread collapses, the test fails and the band is dropped and recorded, not explained away. Passing in one industry does not count as passing in another, so the test runs again for each industry stage 3 adds. Story 5.2 later confirms or drops each band against the labelled set.
- **Missing signals.** A candidate with no reconciled filing has no fingerprint and is not excluded at stage 4. A subject with no fingerprint leaves stage 4's count equal to stage 3's.
- **OCR runs in batch only.** Nothing is fetched or read during a request. Companies are matched on orgnr only, and a requested year is never trusted. An OCR digit is never repaired: a figure token with a non-digit makes the figure absent.
- **Reconciliation is settled.**
  - Within a document the bound is 5 kr absolute, checks c1–c5 per column.
  - Between the document and the API it is max(5 kr, 0.001 % of the API figure).
  - The two rules are never collapsed into one, neither is exact equality, and both values live only in `ingest/config.toml`.
  - Only a `reconciled` column's figures reach the engine.
- **Deletion.** Only `410 Gone` deletes a company, and the delete cascades. Every new table that references a company, including step 2's, uses `ON DELETE CASCADE`, and Story 2.4's deletion test covers it.
- **Classification (2.6).**
  - The model sees only the name, secondary codes, statement of purpose and business description.
  - It answers only from the fixed type set. The response schema has no free-text field, and nothing is coerced, so an answer outside the set is `failed`.
  - Unchanged text is not reclassified.
  - A company with no such text is `no_text` and stays eligible through stages 1–4.
  - Without a key, the tests run on stored responses.
- **Peer adjustment (2.8).** The size band (0.5–2× → 0.33–3× → 0.25–4×) is the only criterion the user can loosen. Comparability is never loosened. Assembling a peer group takes under 1 s (timed test).
- **Absence reasons (2.9).** Each figure is a value or an absence with exactly one reason: undefined, failed reconciliation, not in this dataset (decided from the manifest) or below the floor.
- **Every PR** states what could go wrong and records it in `docs/ai-log.md`. For 2.5 that means banding and selection.

## Technical Decisions

- **One engine (AD-1).** Every category, band, type and digest is computed in `src/engine`, which is pure TypeScript. Python computes none of them.
- **Step 2 is Node scripts in this repository (AD-2).** Story 2.5 is the first step-2 code. Step 2:
  - reads reconciled figures from Postgres (through `documentFigures`);
  - writes through `DERIVE_DATABASE_URL` as the `derive` role;
  - runs no DDL and never runs in a request.
  - The fingerprint table is written only by step 2, and only the seed loader writes it as well.
  - Step 2's run-record table (`run.step2`) arrives in Story 2.6, and every step-2 run then writes a record.
- **Fingerprint shape.** One type in `src/engine/fingerprint.ts` holds five categories:
  - inventory: yes or no;
  - cost-of-goods band;
  - capitalised intangibles: yes or no;
  - asset-intensity band;
  - personnel-cost band.

  A migration check mirrors this type in the fingerprint table.
- **Fingerprint inputs.** The document columns hold `varer_ore`, `sum_immaterielle_eiendeler_ore`, `sum_varige_driftsmidler_ore`, `varekostnad_ore`, `lonnskostnad_ore` and the revenue and asset totals. The planning docs do not fix which year's reconciled column feeds the fingerprint. Story 2.9 owns choosing each year's own current column, and the subject's benchmark filing is to be chosen in the engine alone.
- **Digest and dataset tag (AD-9, AD-13).**
  - Each fingerprint row stores a digest of its raw inputs, made by the one digest function in `src/engine`, which Story 2.5 introduces. The same function later serves classifications and explanations.
  - Each row also stores the dataset tag.
  - Every step-2 run rebuilds all fingerprints.
  - A CI test recomputes the allow-listed companies' fingerprints from committed figures and fails on a digest mismatch.
- **Schema (AD-3, AD-16).**
  - DDL lives only in migrations.
  - A new `register` table is granted SELECT, INSERT and TRUNCATE to `loader`, gets write grants for `derive` only, and is added to `SEED_TABLES` or `LOADER_TABLES`.
  - The seed is re-exported in the same PR.
- **Business types.** One shared set lives in `src/engine`. The proposed set is produkt, konsulent, forhandler and annet. Story 2.5 fixes four things:
  - the final set;
  - what each type means;
  - the rule that derives a type from the five categories;
  - the spread measure and its threshold.

  It records them in the technical note, section "Peer group — a five-stage funnel", under "Rules fixed by the stories", in the same PR. Story 2.6 generates the model's response schema from the same set, unchanged.
- **Stage 4 in the request path.** Stage 4 reads stored fingerprints only, derives a type for each and removes a candidate whose type differs from the subject's. Until 2.6, every text signal is absent, so the fingerprint decides alone.
- **Combination rule (completed in 2.6).**
  - **Both signals agree:** they decide. Two different types, neither of them the subject's, also remove the candidate.
  - **The signals disagree:** the candidate is kept and flagged "Usikker klassifisering". The model never adjudicates.
  - **One signal:** it decides.
  - **No signal:** stages 1–3 decide alone.
  - A signal missing for the subject counts as missing for every candidate.
  - **In the counts:** stage 4 removes a candidate whose fingerprint gives another type, unless its text gives the subject's type. Stage 5 removes a candidate whose text gives another type and that has no fingerprint.
- **Licence gate in `seed:export`.** The export reads `docs/licence-gate.json`, which Story 5.4 writes and which is absent until then.
  - Allow-listed companies always keep their fingerprint categories, so demo B shows fingerprint separation with the gate closed.
  - Other companies' categories are exported only when the file records the gate as open.
  - When the file is absent, unreadable or closed, the seed carries allow-listed fingerprints only. There is one test each for absent, closed and open.
- **Money and decimals (AD-8).** Shares are exact decimals from the one `src/engine/decimal.ts` constructor. `int8` and `numeric` are parsed with `parseOre` and `parseDecimal`, never `Number()`, and a band boundary comparison must never use a float.

## UX & Interaction Patterns

- **Funnel.** The stage labels are "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", with counts. The funnel is always shown, including below the floor. Stage 4 is "Forretningsmodell". Rendering is Story 2.7's; Story 2.5 has no UX.
- **Match basis.** Each peer shows exactly one basis: "Beskrivelse og regnskap" (✦), "Kun regnskap", "Kun beskrivelse" (✦) or "Kun bransje og størrelse". "Kun regnskap" means fingerprinted and unclassified, which is every fingerprinted peer until 2.6.
- **Outside the demo set.** For a 62.100 company outside the demo set, stage 4 runs on committed fingerprint categories only if the gate is open. Otherwise those candidates have no fingerprint and stay in the group.

## Cross-Story Dependencies

- **2.4 is done.** The deletion test must be extended to cover the fingerprint table (2.5) and the classification table (2.6).
- **The 2.1b acceptance run is local data.** Its 1 947 documents (407 orgnrs: demo A and B and their standard-band pools) live only in the local database and a gitignored dump until Story 5.4. They must not be deleted. Only the 20 OCR reference orgnrs' document rows are in the committed seed, so the CI recompute and the seed's fingerprints cover allow-listed companies only.
- **Within the epic.** 2.5 fixes the business types, and 2.6 reuses them and adds `run.step2` and the combination rule's text half. 2.7 shows the funnel and the match basis, 2.8 adjusts the group, and 2.9 adds absence reasons and filing-year selection.
- **Other epics.** Story 5.2 measures each funnel layer against the labelled set and confirms or drops each band. Story 5.4 writes the licence-gate file and the full allow-list.
