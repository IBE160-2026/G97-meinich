# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group something the user can judge and adjust. Batch step 1 reads filed 2021–2025 documents by OCR and accepts only figures that reconcile; batch step 2 derives a business-model fingerprint (stage 4) and a model classification (stage 5) in one shared set of business types. The Peers tab shows the five-stage funnel and why each peer is included, the user can exclude a peer or widen the size band with every figure recomputed, and every missing figure states its reason. Status (2026-11-13): 2.1a–2.6 are done (2.6a included); 2.7 (in preparation), 2.8 and 2.9 remain.

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

- **Never select on a benchmarked measure.** No funnel stage takes a margin, return or productivity figure; cost-of-goods and personnel-cost shares reach selection only as band ids. Bands, thresholds and the type rule are fixed and not tuned after seeing data.
- **Combining the signals (stages 4 and 5).** Each signal present for both subject and candidate says whether the candidate is the subject's type. Both agree: decides (two different non-subject types agree, removed). Disagree: kept and flagged "Usikker klassifisering"; the model never adjudicates. One present: decides alone. Neither: stages 1–3 decide. A signal missing for the subject is missing for every candidate. In counts, stage 4 removes another-type fingerprints unless the text gives the subject's type; stage 5 removes another-type text with no fingerprint; a flagged candidate is removed at neither. Undetermined fingerprints, `uklart`, `no_text` and unclassified companies give no signal and are never excluded for it.
- **Funnel counts.** All five stages report their surviving count, shown whether or not the group clears the 10-peer floor. Segmentation (stage 3) reports each criterion it applies separately — in v1 legal form only, worded so the user learns v1 admits AS only (consistent with the PRD's segmentation requirement); geography is not used for 62.100 but would be named the same way where a later industry applies it. The flagged count is reported with the counts.
- **"Hvorfor med" (inclusion reason).** Written by a deterministic function from the profile fields the peer shares with the subject. It takes no model output (its input type has no model field), same inputs give the same text, and it carries no ✦. The model classifies; it never writes the justification.
- **"Grunnlag for treff" (match basis).** Names the signals that took part in keeping the peer. A signal counts only when it gives a business type for both subject and peer — exactly when `signals()` in `src/engine/peers.ts` returns non-null for it. One exhaustive `src/engine` function returns exactly one of four, in order: fingerprint and text → "Beskrivelse og regnskap"; fingerprint only → "Kun regnskap"; text only → "Kun beskrivelse"; neither → "Kun bransje og størrelse". A fingerprint with no type, `uklart`, an unclassified peer and a subject with no type give no signal, so a fingerprinted peer is not "Kun regnskap" unless its fingerprint has a type. A flagged peer is "Beskrivelse og regnskap" with its tag. Where the match rests on industry and size alone, the product says so. Tests cover each combination (incl. undetermined/`uklart` on each side, unclassified, flagged) plus exhaustiveness.
- **Basis and flag are request-time.** Both depend on the subject, are computed in the request and never stored (no table or seed file holds them).
- **Stage 5 may be switched off later.** If Story 5.2 finds the text does not raise precision by ≥ 3 pp with recall loss ≤ 3 pp, the text signal is off in v1: no flags, and every basis is "Kun regnskap" or "Kun bransje og størrelse". Code must not assume classifications are present.
- **Payload (AD-4).** The browser receives only what the shown analysis needs: the funnel, the list and the shown figures — every peer's value behind each shown figure, excluded rows included — and no other peer field. No open JSON endpoint besides search; no server actions.
- **Classification inputs/outputs (settled in 2.6).** Name, secondary codes, statement of purpose and business description only; schema enum from `BUSINESS_TYPES` plus `uklart`; statuses `classified`, `no_text`, `failed`, `pending`. Runs without keys: the app uses stored classifications and no model host is contacted during an analysis.
- **Adjusting peers (2.8).** Only the size band loosens (0.5–2×, 0.33–3×, 0.25–4×); comparability, legal form and geography never. Nothing is written to any table. Assembly under 1 s. A failed change keeps the last good URL and figures.
- **Absence reasons (2.9).** Each figure is a value or an absence with exactly one reason (undefined, failed reconciliation, not in this dataset, below the floor, not read in v1), mapped to its state by an exhaustive switch; never zero.
- **Blind labelled set.** No committed file or PR text ties a fingerprint or classification result to an orgnr of the labelled set.
- **Every PR** states what could go wrong in its area (for 2.7: what the page payload exposes) and records the reasoning in the AI log.

## Technical Decisions

- **One engine.** Types, bands, the combination rule, the flag, the match basis and the inclusion reason are pure `src/engine` code; no framework or database imports; Python computes none of it.
- **Request path.** Stages 4 and 5 read stored fingerprints and classifications only, via the subject and candidate reads in the server layer. `pool` is stages 1–3 and validates `ekskl`; `group` is the pool after stages 4–5 and feeds every aggregate (minus `ekskl`); the funnel returns flagged orgnrs with the group and the flagged count with its counts. The shown group is picked from the funnel result by the shared helper, not by callers.
- **URL is the only state.** Tab, `ekskl` and `band` are read and written only through the analysis-state module's `parse`/`serialize`; peer changes are soft navigations rendered on the server, one history entry each.
- **Copy** lives in the message file, looked up by dotted id; no hard-coded strings in components. The mock-era message file is not authoritative; the UX spine's vocabulary is.
- **Display.** Every number goes through the engine's format module; counts and revenues in tabular figures.
- **E2E.** Retro action: in Story 2.7, split the analysis e2e spec by surface and make the AD-4 payload scan a shared helper used by every tab.

## UX & Interaction Patterns

- **Funnel:** five stages "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", each with its count (tabular) and an 8px `navy-700` bar proportional to stage 1, dividers between. Below it "✦ {n} med usikker klassifisering"; with exclusions (2.8) "{n} ekskludert av deg → {m} i analysen". No ✦ on the stage name "Klassifisering". Counts are identification, not benchmarked figures, so they need no median context.
- **Peer list (desktop):** columns Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag (2.8 adds the action column); caption carries the visible key "✦ KI-generert"; peers shown by name; inside a scroll container (`overflow-x: auto`, `tabindex="0"`, `role="region"`, descriptive `aria-label`, visible focus).
- **AI marking:** ✦ (slate, `aria-hidden`, at least the label's size, SVG fallback if the font lacks U+2726) appears only on "Beskrivelse og regnskap", "Kun beskrivelse" and the flag "✦ Usikker klassifisering" (slate `tag` type, beside the basis; the peer stays). Never on "Hvorfor med", "Kun regnskap", "Kun bransje og størrelse" or any number. Screen readers hear "KI-generert" once per cell, once for both where basis and flag share a cell.
- **Tags** are non-interactive state labels, small radius, never the sole carrier of a number.
- **Responsive (375 and 320 px):** funnel becomes a vertical list (name left, count right, bar beneath); the peer list becomes one card per peer (name, revenue and driftsmargin; reason; basis + flag + action) with "Vis alle {n}"; every target ≥ 24 × 24 px (44 recommended on phone); no horizontal body scroll; no fixed column widths that cannot shrink. `<html lang="nb">`; the tab label "Peers" may carry `lang="en"`.
- **Peers-tab states:** a non-calendar-year subject or one with no positive revenue has no peers and its own sentence; below-floor/too-small and widened-band State blocks belong to 2.8; Peers sections use full-width cards and flat styling (1px divider, no shadow).

## Cross-Story Dependencies

- **2.5 → 2.6 → 2.7:** 2.7 needs the stored fingerprints and classifications and the funnel's flag output; it extends the simple Peers list built in Story 1.7.
- **2.7 → 2.8:** 2.8 adds exclude/restore, the size-band control, too-small and widened State blocks, and the action column on 2.7's list and funnel.
- **2.9** supplies absence reasons; Epic 3 renders document rows that show them.
- **Other epics:** the adjusted-group explanation state belongs to Epic 4; Story 5.2 measures each funnel layer and may switch the text signal off; Story 5.4 writes the licence-gate file and the demo seed.
- **Local data:** document rows from the acceptance and labelled-set runs live only in the local database and gitignored dumps until the licence assessment; never delete them.
