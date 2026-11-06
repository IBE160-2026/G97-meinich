# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group something the user can judge and adjust. Batch step 1 reads the filed 2021–2025 documents by OCR, stores figures as filed and accepts a column only when it reconciles; OCR accuracy is measured (SM-2) and a company the register withdraws (`410 Gone`) is deleted. Batch step 2 derives a business-model fingerprint (stage 4) and a model classification (stage 5), both into one shared set of business types. On the page, the Peers tab shows the five-stage funnel and why each peer is in it, the user can exclude a peer or widen the size band with every figure recomputed, and every missing figure states its reason. Status: 2.1a–2.5b are done; 2.5c (refuse a digit read as two, and cost lines that do not sum) is next, then 2.6, 2.7, 2.8, 2.9.

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
- Story 2.6: Classification (stage 5)
- Story 2.7: The Peers tab shows why
- Story 2.8: Adjust the peer group
- Story 2.9: Missing figures say why

## Requirements & Constraints

- **Never select on a benchmarked measure.** No stage 1–5 function takes a margin, return or productivity figure as input; cost-of-goods and personnel-cost shares reach selection only as band ids. Selection never reads total assets or the register's employee count.
- **OCR runs in batch only.** Nothing is fetched or read during a request. Companies are matched on orgnr only, and a requested year is never trusted. An OCR digit is never repaired: a figure token with a non-digit makes the figure absent; a digits-only figure enters only through a passing check or sum gate (2.3b, 2.5b).
- **Reconciliation is settled.** Within a document the bound is 5 kr absolute, checks c1–c5 per column; between the document and the API it is max(5 kr, 0.001 % of the API figure). The two rules are never collapsed into one, neither is exact equality, and both values live only in `ingest/config.toml`. Only a `reconciled` column's figures reach the engine.
- **Deletion.** Only `410 Gone` deletes a company, and the delete cascades; every table that references a company uses `ON DELETE CASCADE`, covered by Story 2.4's deletion test.
- **The fingerprint (stage 4) is rules only, and D1 is locked** (Story 2.5): its bands, thresholds and type rule are not adjusted after data; Story 5.2 confirms or drops each band against the labelled set.
- **Business types are fixed** (one set in `src/engine`): `produkt` (own software, licence or subscription), `konsulent` (hours/projects by own staff, staffing included), `forhandler` (resells others' products), `annet` (operations, hosting, holding, or none of the above). Not adjusted after data. A fingerprint whose unknown categories allow more than one type is *undetermined*: no type, not excluded, not `annet`.
- **OCR corrections (2.5c).** A figure token narrower than its digit count at the page's character pitch is refused, never repaired. The cause of columns whose cost lines sum *under* `sum_driftskostnad` is found from the documents before anything is fixed. A possible `src/engine` rule: when every cost line is read and they miss `sum_driftskostnad` by more than 5 kr, no fingerprint, counted under a named reason (no re-read needed). The spec also decides whether `bankinnskudd`, `kundefordringer`, `salgsinntekt` and `leverandorgjeld` — lines no in-document check covers — get a check or are shown as unverified. Any re-read needs Meinich's yes first; misreads and phantoms reaching the engine on the reference set must not rise (SM-2 before/after, non-summing columns as totals). Must land before the labelled-set document run, so those companies are read once by the corrected reader.
- **Labelled set is blind.** No committed file or PR text ties a fingerprint result to an orgnr of the labelled set.
- **Classification (2.6).**
  - The model sees only name, secondary industry codes, statement of purpose and business description.
  - Its response schema is generated from the shared type set and has no free-text field; an answer outside the set is never coerced — the row is `failed` and the failure goes into step 2's run record.
  - Status per row: `classified`, `no_text`, `failed`, `pending`. `no_text` is never guessed and stays eligible through stages 1–4. `seed:export` refuses while a covered-industry row is `failed` or `pending`.
  - Unchanged description text is never reclassified; changed text is, on the next run.
  - Model id pinned in configuration; each row stores model id, prompt hash and a digest of the description text. The model key is read only by step 2.
  - Without a key, tests run on stored responses and the app on stored classifications; no request to a model host or the register leaves the app during an analysis (no-network test).
- **Combination rule (completed in 2.6).** Each signal present for both subject and candidate says whether the candidate is the subject's type.
  - Both present and agree → decides (two different non-subject types also agree: removed).
  - Both present and disagree → kept and flagged "Usikker klassifisering"; the model never adjudicates. The flag is stored and its count is available to the funnel.
  - One present → it decides. Neither → stages 1–3 decide.
  - A signal missing for the subject counts as missing for every candidate.
  - Counts: stage 4 removes a candidate whose fingerprint gives another type unless its text gives the subject's type; stage 5 removes one whose text gives another type and that has no fingerprint. A test per case, including the subject missing each signal.
- **Peers tab (2.7).** Precondition: the match basis of an undetermined peer (fingerprinted, no business type) is settled and recorded in the PRD before the story starts. Funnel always shown, also below the 10-peer floor. "Hvorfor med" is deterministic from shared profile fields and takes no model output. "Grunnlag for treff" is exactly one of four, from one `src/engine` function, exhaustive: classified+fingerprinted → "Beskrivelse og regnskap" (✦); fingerprinted only → "Kun regnskap"; classified only → "Kun beskrivelse" (✦); neither → "Kun bransje og størrelse". The page payload carries no peer field beyond what is shown.
- **Peer adjustment (2.8).** Only the size band is loosenable (0.5–2× → 0.33–3× → 0.25–4×, bounds inclusive); comparability, legal form and geography never. No widening step may admit a candidate failing any of the six comparability fields. Nothing is written to any table. Peer-group assembly under 1 s (timed test); a figure must be able to cross the 10-peer floor both ways. A failed change keeps the last good URL and figures.
- **Absence reasons (2.9).** Each figure is a value or an absence with exactly one reason — undefined, failed reconciliation, not in this dataset, below the floor — mapped to its UI state by an exhaustive switch. Zero/negative denominators or underivable components are undefined, never zero. Missing components are derived from stated totals in `src/engine` only, never stored by step 1. "Not in this dataset" comes from the manifest, never inferred from a missing row. A subject whose own filing failed reconciliation keeps the three API figures, its peer group and tabs; the twelve document figures are absent with that reason, nothing estimated.
- **Every PR** states what could go wrong in its area and records it in `docs/ai-log.md`.

## Technical Decisions

- **One engine.** Every category, band, type, match basis, digest and absence reason is computed in pure `src/engine`; Python computes none.
- **Step 2 is Node scripts** (`pnpm derive` is the first), writing as `derive` through `DERIVE_DATABASE_URL`, never in a request, no DDL. The classification table is written only by step 2 (and the seed loader).
- **Run records.** 2.6 adds `run.step2`, written only by `derive` (`ingest` and `loader` have no write grant); every step-2 run — fingerprints, classifications, later explanations — writes one record with start, end, counts per status, model id, prompt hash and failures. The two steps never share a run record. `pnpm seed` prints the latest record of each step, or says there is none.
- **Schema.** DDL only in migrations. A new `register` table: SELECT, INSERT, TRUNCATE to `loader`, write grants to its one step role, added to `SEED_TABLES` or `LOADER_TABLES`, references the company `ON DELETE CASCADE` and is covered by the 2.4 deletion test. A PR adding a migration re-exports the seed.
- **Digests (AD-13).** Stored derived rows carry a digest from the one digest function in `src/engine` (not importable from client modules).
- **Request path.** Stages 4 and 5 read stored rows only. `pool` is stages 1–3 (what `ekskl` validation reads); `group` is the pool after the funnel and feeds every aggregate. Peer changes are soft navigations (`router.push` to a `serialize`d URL), rendered on the server; the URL is the only state.
- **Licence gate.** Outside `seed/allow-list.json`, derived categories enter the committed seed only when `docs/licence-gate.json` (Story 5.4) records the gate open; absent or unreadable means closed.
- **Money and decimals.** Shares and amounts are exact decimals from the one constructor; DB `int8`/`numeric` parsed with `parseOre`/`parseDecimal`; no float comparisons; every displayed number goes through `src/engine/format.ts`.

## UX & Interaction Patterns

- **Funnel:** "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", counts in tabular figures with an 8px navy-700 bar proportional to stage 1; Segment states that v1 admits AS only; "✦ {n} med usikker klassifisering"; "{n} ekskludert av deg → {m} i analysen".
- **Peer list:** Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag; caption key "✦ KI-generert". ✦ is `aria-hidden`, read once per cell as "KI-generert", never on a number or "Hvorfor med". A flagged peer stays, tagged "✦ Usikker klassifisering" in slate.
- **Adjusting:** excluded rows stay, slate and struck through, with "Ekskludert" and "Ta med igjen"; focus stays on the button; changes are announced. Size band is a `radiogroup` with roving tabindex; beyond Standard a State block marks the group "Utvidet". "Tilbakestill til standard" moves focus to the Peers `h2`. Pending regions use `aria-busy` with dimmed figures and "Oppdaterer …", no animation; failure is a `role="alert"`. Each change is one history entry.
- **Absences:** "Kan ikke beregnes", "Regnskapet for {år} kunne ikke leses sikkert" (slate header subline, no badge), "Ikke i demodataene", "For få sammenlignbare (n av 10)".
- **Responsive:** at 375 and 320 px the funnel is a vertical list, peers are cards with "Vis alle {n}", targets ≥ 24 × 24 px, tables in their own scroll containers, no horizontal body scroll.

## Cross-Story Dependencies

- **2.5 → 2.6:** 2.6 reuses the type set unchanged, generates its response schema from it, and completes stage 4/5's combination rule; until then every text signal is absent and the fingerprint decides alone.
- **2.6 → 2.7:** match basis and flagged count need stored classifications. 2.7 builds on the simple Peers list from Story 1.7. 2.8 builds on 2.7's list and the URL module's `ekskl`/`band`. 2.9 owns choosing each year's current column and the subject's benchmark filing.
- **2.5c before the labelled-set document run and before 2.6:** it changes what reaches the fingerprint. 2.5c's item 4 settles the unchecked-lines question; 2.7 waits on the undetermined-peer match basis.
- **Open, not owned by a story:** whether a dissolved company (`slettedato` set) stays a peer — nothing in the request path reads it yet; and the full 62.100 document run (about 190 hours) — v1 may ship on the demo data.
- **Local data:** the 2.1b acceptance run's documents live only in the local database and a gitignored dump until Story 5.4; never delete them. The committed seed holds document rows only for allow-listed (OCR reference) orgnrs.
- **Other epics:** Epic 3 renders the document rows that show 2.9's reasons; the adjusted-group explanation state belongs to Epic 4; Story 5.2 measures each funnel layer and confirms or drops each band; Story 5.4 writes the licence-gate file and the full allow-list.
