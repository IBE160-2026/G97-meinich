# Epic 5 Context: Prove it and make it runnable — measurement, demo seed and About page

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 5 turns Peerless from a working funnel into a measured, demonstrable and runnable product. Its core is the layer-by-layer measurement against the labelled set: it shows how much each funnel layer adds, whether the model is worth keeping beyond the accounts-based fingerprint, and whether each cost-share band stays. Around that it delivers a committed demo seed (companies A, B and C) within what the document licence allows, a human review of 30 stored explanations, the full "Slik fungerer Peerless" page that reports the results, and proof that a fresh clone runs from the README with no keys. The measurement is the project's headline result. The labelled set (5.1) is done. The build order is: 5.2 right after Epic 2, 5.4 after Epic 3, then 5.5, 5.6, 5.3 (embeddings, cut first) and 5.7 last.

## Stories

- Story 5.1: The labelled set (done)
- Story 5.2: Layer-by-layer measurement
- Story 5.3: Embeddings — last, and cut first
- Story 5.4: The demo seed
- Story 5.5: 30 explanations read by a person
- Story 5.6: "Slik fungerer Peerless" in full
- Story 5.7: Runs from a fresh clone

## Requirements & Constraints

- **The measurement (SM-1).** Precision and recall against the labelled set, for each layer alone and cumulatively: industry code and size; adding the fingerprint; adding classification; and embeddings as a fourth layer only if built. The report has three layers without embeddings and four with. Each result is split by informative and uninformative descriptions, with each cohort's share disclosed. If a stratum falls short, the cohorts are pooled, and the report says so. Flagged candidates ("Usikker klassifisering") are reported apart from the rest. SM-1b compares the full funnel with an industry-code-only baseline; it is a sanity check, not a claim.
- **The stage-5 decision rule, fixed in advance and never re-tuned.** Compare *fingerprint alone* with *fingerprint and text* on all labelled pairs, with `usikker` left out. Stage 5 is kept only if the text raises precision by at least 3 percentage points and lowers recall by no more than 3. Blind pairs are reported on their own, but the rule is decided on all pairs. If stage 5 fails, the same PR switches the text signal off in the v1 funnel: the fingerprint alone decides the group, no peer is flagged, and no match basis rests on the description. Each of those has a test, and the report and the PRD's limitations section say the model was not needed.
- **The bands (FR-13).** Report precision and recall with and without the cost-of-goods band and the personnel-cost band, and record kept or dropped for each, with the reason. **The planning documents disagree here.** The epic says a dropped band means updating the fingerprint type, its migration check, the type rule and the technical note's fixed rules, and rebuilding the fingerprints (their digests change). The PRD and the technical note say a failing band goes to Meinich and nothing is dropped automatically. Resolve this with the human before acting.
- **No numeric targets.** No precision, recall or OCR target is set; v1 measures and reports. Counter-metrics are never pushed upward: group size, share classified, figures shown and industries covered.
- **Honest framing of the labels.** The rubric was dated before the fingerprint features were fixed, and a blind subsample was labelled by a person from description and website only. The other 720 pairs come from a ChatGPT model's revenue-model labels, accepted by a person, so for those pairs the text layer is one AI measured against another's. There is no second labeller and no κ in v1; that is stage 2, and the gap is stated. Report achieved counts, not planned ones.
- **Reports** go in `analysis/output/` with the generation date and the script that produced them. Only totals are reported; no committed file or PR text gives a per-orgnr classification, fingerprint or label for the labelled set.
- **Coverage flip.** Once the report exists, the 62.100 entry in `seed/coverage.json` becomes `{"code": "62.100", "measured": true, "report": "analysis/output/<file>.md", "sha256": "…"}`. The loader refuses a `measured: true` entry whose path is missing or whose checksum does not match.
- **Demo seed (FR-73).** It holds register data and API figures for all of 62.100 and a stored classification for every AS. Document figures are included only for the allow-list: A, B, C, A's and B's peers at all three band steps, and the OCR reference set. Stored explanations follow once Epic 4 and Story 5.5 are done. Loading twice gives the same state. Committing fingerprint categories outside the allow-list waits on the licence gate, `docs/licence-gate.json` (`{open, assessment, date}`); a closed gate is the expected outcome. v1 reads no other 62.100 company's documents for the seed. The labelled set's documents and fingerprints stay local.
- **Explanation review.** 30 stored explanations are drawn at random with a recorded seed, read by a person and recorded in `docs/ai-sessions/`. Missed recommending phrasing goes into the phrase list, and the affected texts are regenerated or withheld.
- **About page.** It covers the five funnel stages in plain language, where AI is used (with the FR-53 test sentence), measurement results read from committed reports, limitations and data age. Before results exist it shows "Målingen pågår. Resultatene publiseres her når de foreligger." and no placeholder figures. A test fails if the page shows a figure with no report behind it.
- **Fresh clone (SM-9).** The README's fixed command sequence reaches a complete analysis for A, B and C with no keys, and the whole suite passes, AI test mode included. A no-network test proves that no request goes to the register or a model host. `pnpm seed:full` runs both batch steps without a model and exports to a gitignored path.

## Technical Decisions

- **One engine.** All measurement arithmetic and funnel logic lives in `src/engine`. Python never computes a ratio. The measurement script is a Node analysis script that reads the stored rows and runs the same funnel the app uses.
- **Funnel semantics being measured.** `pool` is stages 1–3, which is what the labelled-set frame drew from. `group` is the pool after stages 4 and 5. Fingerprint and text are combined by rule: if both agree, that decides; if they disagree, the candidate is kept and flagged; if only one is present, that one decides; if neither is, the candidate stays on stages 1–3. A missing subject signal counts as missing for every candidate. An undetermined fingerprint gives no type and does not exclude.
- **Fingerprint rules are fixed** (bands, type rule, empty-line intervals, R2 and R3) and are not adjusted after data. The one exception is a band decision made under the stage-5 or FR-13 outcome above. A product company that expenses its development comes out as `konsulent`, and Story 5.2 measures this.
- **One writer per table.** Step 2 (`derive`) writes fingerprints, classifications and run records. Any new derived table (5.3 embeddings, in pgvector) is written only by `derive`, cascades on company delete, and is read by no request path. The loader alone writes `register.covered_industry`. Seed files are written only by `pnpm seed:export` and read only by `pnpm seed`, with a manifest. A PR that adds a migration re-exports the seed.
- **Digests (AD-13).** Fingerprints, classifications and explanations carry digests of their inputs. A changed rule changes the digests and forces a rebuild. An explanation is shown only when its digest matches the engine output.
- **No model in a request (AD-7).** Classification and explanation calls happen only in batch step 2, with the model id pinned. Test mode runs on stored output.
- **Embeddings (5.3)** move pgvector from "Deferred" to the stack in the technical note. They are for measurement only, and no peer ever reaches a group by similarity.

## UX & Interaction Patterns

- **About page** `/slik-fungerer-peerless`: builds on the existing "Kilder og lisens" section. Sticky table of contents on desktop, a bordered box on phone. Focus moves to the h1 on route change. No horizontal body scroll at 320 px and 375 px.
- **Document-figure credit paragraph (5.4)**: published whether the gate opens or not. It credits Brønnøysundregistrene as the source, asserts no licence, and is kept apart from the NLOD credit for API figures. With the gate closed, the phrase "og for resten av bransjen bare avledede kategorier" is dropped. The "Ikke i demodataene" popover links to this paragraph.
- **Outside the demo seed**: stage 4 reads "Ikke kjørt – regnskapstall ikke i demodataene", with the same count as stage 3. The popover text is EXPERIENCE's exact wording, names no command and promises no full dataset. All copy comes from `src/messages/nb.json`.
- **Demo links**: the A and B placeholders in the not-in-database and no-match states are replaced with real links. The README lists the three demo orgnrs and what each one shows.

## Cross-Story Dependencies

- 5.2 needs 5.1 (done) and the Epic 2 funnel, and runs on the labelled set's locally stored 2025 documents, fingerprints and classifications. Those rows are not in the seed, so 5.2 must restore them from the local dump.
- A failed stage-5 or band decision in 5.2 changes `src/engine/peers.ts` and/or `src/engine/fingerprint.ts`, and so changes what Epic 3, 5.4 and the about page show.
- 5.4 waits for Epic 3, so that document figures and kroner exist. It chooses A and B, preferring a company whose text classification has a business type, since the current A and B are both `uklart`. It writes the licence gate file and the allow-list.
- 5.5 needs Epic 4's stored explanations and runs before they are exported into the seed.
- 5.6 needs 5.4's credit paragraph and reads SM-1 (5.2) and SM-2 (Story 2.3) from committed reports. 5.3 later updates the measurement section to four layers.
- 5.7 is last. It confirms the whole sequence on a clean machine; CI has loaded the seed on every PR since Story 1.3b.
