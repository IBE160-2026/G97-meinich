# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group something the user can judge and adjust. Batch step 1 reads filed 2021–2025 documents by OCR and accepts only figures that reconcile; batch step 2 derives a business-model fingerprint (stage 4) and a model classification (stage 5) in one shared set of business types. The Peers tab shows the five-stage funnel and why each peer is included, the user can exclude a peer or widen the size band with every figure recomputed, and every missing figure states its reason. Status (2026-11-08): 2.1a–2.5d are done; 2.6, 2.7, 2.8 and 2.9 remain.

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

- **Never select on a benchmarked measure.** No funnel stage takes a margin, return or productivity figure; cost-of-goods and personnel-cost shares reach selection only as band ids. Fingerprint bands, thresholds and the type rule are fixed and not tuned after seeing data.
- **Classification inputs and outputs.** The model sees only name, secondary industry codes, statement of purpose and business description, and answers from a schema generated from the shared type set, with no free text. An answer outside the set is never coerced: the row is `failed` and recorded. Statuses are `classified`, `no_text` (never guessed; stays eligible), `failed`, `pending`; seed export refuses while a covered-industry row is `failed` or `pending`. Unchanged text makes no model call.
- **Combining the signals.** Each signal present for subject and candidate says whether the candidate is the subject's type. Both agree: decides (two different non-subject types count as agreeing, removed). Disagree: kept and flagged "Usikker klassifisering"; the model never adjudicates. One present: decides alone. Neither: stages 1–3 decide. A signal missing for the subject is missing for every candidate. In counts, stage 4 removes another-type fingerprints unless the text gives the subject's type; stage 5 removes another-type text with no fingerprint; a flagged candidate is removed at neither.
- **Undetermined is a result.** A company whose unknown categories allow several types has no type, is not excluded for it, and is never counted as `annet`.
- **Runs without keys.** Tests use stored model responses and the app stored classifications; no model host is contacted during an analysis.
- **Peers tab.** The funnel shows at every group size, also below the 10-peer floor. "Hvorfor med" is deterministic and takes no model output. "Grunnlag for treff" is exactly one of four, from one exhaustive engine function. The payload carries no peer field beyond what is shown. **Match basis:** it names the signals that took part in keeping the peer in the group, and a signal counts only when it gives a business type for both the subject and the peer (`signals()` in `src/engine/peers.ts` not null): fingerprint and text → "Beskrivelse og regnskap"; fingerprint only → "Kun regnskap"; text only → "Kun beskrivelse"; neither → "Kun bransje og størrelse". A fingerprint with no type, `uklart` and a subject with no type give no basis, so a fingerprinted peer is not "Kun regnskap" unless its fingerprint has a type. A flagged peer is "Beskrivelse og regnskap". The basis depends on the subject and is not stored (PRD FR-16).
- **Adjusting peers.** Only the size band loosens (0.5–2×, 0.33–3×, 0.25–4×); comparability, legal form and geography never, and no step admits a candidate failing a comparability field. Nothing is written to any table. Assembly under 1 s (timed test); the re-render time is measured against "within a few seconds". A failed change keeps the last good URL and figures. Exclusions falling outside the pool are dropped with the invalid-settings notice.
- **Absence reasons.** Each figure is a value or an absence with exactly one reason (undefined, failed reconciliation, not in this dataset, below the floor), mapped to its state by an exhaustive switch. Non-positive denominators and underivable components are undefined, never zero; derivation from stated totals happens in the engine only. "Not in this dataset" comes from the manifest, never from a missing row. A subject whose filing failed reconciliation keeps its API figures, driftsmargin kroner, peer group and tabs. A failed peer leaves document-derived distributions only.
- **OCR and reconciliation are settled.** No fetch or OCR in a request; an OCR digit is never repaired; only a reconciled column's figures reach the engine. Between sources max(5 kr, 0.001 % of the API figure), within a document 5 kr; the two are never collapsed.
- **Blind labelled set.** No committed file or PR text ties a fingerprint or classification result to an orgnr of the labelled set.
- **Every PR** states what could go wrong in its area and records the reasoning in the AI log.

## Technical Decisions

- **One engine.** Every category, band, type, match basis, digest and absence reason is computed in pure `src/engine`; Python computes none.
- **Step 2** is Node scripts writing as `derive`, never in a request, running no DDL. The model id is pinned in configuration; each classification row stores model id, prompt hash and a description digest. Only step 2 reads the model key.
- **Run records.** Story 2.6 adds step 2's run-record table, written only by `derive` and never shared with step 1. Every step-2 run writes one record with start, end, counts per status, model id, prompt hash and failures. `pnpm seed` prints the latest record of each step, or says there is none.
- **Schema.** A new `register` table references the company `ON DELETE CASCADE` and joins Story 2.4's deletion test. The migration PR re-exports the seed.
- **Request path.** Stages 4 and 5 read stored rows only. `pool` is stages 1–3 and validates `ekskl`; `group` is the pool after the funnel and feeds every aggregate. Peer changes are soft navigations to a `serialize`d URL rendered on the server; the URL is the only state, and each change is one history entry.
- **Licence gate.** Outside the allow-list, derived categories enter the committed seed only when the gate file records it open; absent or unreadable means closed.

## UX & Interaction Patterns

- **Funnel:** "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", tabular counts with an 8px navy-700 bar proportional to stage 1. Segment says v1 admits AS only. "✦ {n} med usikker klassifisering"; "{n} ekskludert av deg → {m} i analysen".
- **Peer list:** Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag; caption key "✦ KI-generert". ✦ marks only "Beskrivelse og regnskap", "Kun beskrivelse" and the flag, is `aria-hidden`, is read as "KI-generert" once per cell, and never sits on a number or "Hvorfor med".
- **Adjusting:** excluded rows stay, slate and struck through, with "Ekskludert" / "Ta med igjen"; focus stays on the button and changes are announced. The size band is a `radiogroup` with roving tabindex; beyond Standard a State block says "Utvidet". Reset moves focus to the Peers `h2`. Pending regions use `aria-busy`, dimmed figures and "Oppdaterer …", no animation; failure is `role="alert"`.
- **Absences:** "Kan ikke beregnes", "Regnskapet for {år} kunne ikke leses sikkert" (slate header subline, no badge), "Ikke i demodataene", "For få sammenlignbare (n av 10)".
- **Responsive:** at 375 and 320 px the funnel is a vertical list and peers are cards with "Vis alle {n}"; targets at least 24 × 24 px; tables in their own scroll containers; no horizontal body scroll.

## Cross-Story Dependencies

- **2.5 → 2.6:** 2.6 reuses the type set unchanged and completes the stage 4/5 combination; until then the fingerprint decides alone.
- **2.6 → 2.7 → 2.8:** match basis and flagged count need stored classifications; 2.7 extends the simple Peers list from Epic 1; 2.8 builds on 2.7's list and the URL module's `ekskl` and `band`.
- **Local data:** document rows from the acceptance and labelled-set runs live only in the local database and gitignored dumps until the licence assessment; never delete them.
- **Other epics:** Epic 3 renders the document rows that show 2.9's reasons; the adjusted-group explanation state belongs to Epic 4; Story 5.2 measures each funnel layer and confirms or drops each band; Story 5.4 writes the licence-gate file.
