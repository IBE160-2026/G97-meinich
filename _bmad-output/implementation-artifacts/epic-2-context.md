# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group something the user can judge and adjust. Batch step 1 reads filed 2021–2025 documents by OCR and accepts only figures that reconcile; batch step 2 derives a business-model fingerprint (stage 4) and a model classification (stage 5) in one shared set of business types. The Peers tab shows the five-stage funnel and why each peer is included, the user can exclude a peer or widen the size band with every figure recomputed, and every missing figure states its reason. Status (2026-11-13): 2.1a–2.7 are done; 2.8 (adjust the peer group) and 2.9 (absence reasons) remain.

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

- **Never select on a benchmarked measure.** No funnel stage takes a margin, return or productivity figure; cost-of-goods and personnel-cost shares reach selection only as band ids. Bands, thresholds and the type rule are fixed, not tuned after seeing data.
- **Combining the signals (stages 4 and 5).** A signal present for both subject and candidate says whether the candidate is the subject's type. Both agree: decides. Disagree: kept and flagged "Usikker klassifisering"; the model never adjudicates. One present: decides alone. Neither: stages 1–3 decide. Undetermined fingerprints, `uklart`, `no_text` and unclassified companies give no signal and are never excluded for it. Code must not assume classifications exist: Story 5.2 may switch the text signal off.
- **Funnel counts.** All five stages report their surviving count, shown whether or not the group clears the 10-peer floor; stage 3 names each criterion (v1: legal form, AS only); the flagged count is shown with the counts.
- **"Hvorfor med" / "Grunnlag for treff".** The reason is deterministic from shared profile fields, never model-written, no ✦. The basis is one of four from one exhaustive engine function, counting a signal only when it gives a type for both sides. Basis and flag depend on the subject, are computed per request and never stored.
- **Exclusion (FR-17, v1).** Excluding a peer lives only in the URL (`ekskl`); nothing is written to any table. The excluded peer stays visible as excluded and can be restored. Saving exclusions is stage 2.
- **Loosening (FR-18, v1).** Only the size band loosens, in fixed single steps 0,5–2× → 0,33–3× → 0,25–4×, nothing wider. Comparability fields (currency, framework, `smaaForetak`, `avviklingsregnskap`, period, `regnskapstype`), legal form and geography are never loosened and no control offers them; a test asserts no step admits a candidate failing any of the six comparability fields. Loosening segmentation is stage 3.
- **Recompute (FR-19).** Any peer-group change recomputes every key figure, aggregate, percentile and kroner amount on every tab, with no stale value shown as current; a figure can cross the 10-peer floor either way.
- **Performance.** Peer-group assembly under 1 s (timed test on the seeded 62.100 data); a full analysis within a few seconds, reading only stored figures, measured in a real browser and recorded in the PR.
- **Payload (AD-4).** The browser receives only what the shown analysis needs — every peer's value behind each shown figure, excluded rows included — and no other peer field, except the orgnr of each peer in the group, which the exclude action writes into the URL (Meinich, 2026-11-13); a pool peer stage 4 or 5 removed never reaches the page. No open JSON endpoint besides search; no server actions.
- **Absence reasons (2.9).** Each figure is a value or an absence with exactly one reason (undefined, failed reconciliation, not in this dataset, below the floor, not read in v1), mapped to its state by an exhaustive switch; never zero. Missing components are derived from stated totals in the engine only, never stored by step 1.
- **Responsive.** Every Peers-tab state works at 375 and 320 px with no horizontal body scroll; tables and lists in their own scroll containers.
- **Every PR** states what could go wrong in its area (2.8: URL state reaching the engine and recompute failures) and records the reasoning in the AI log.

## Technical Decisions

- **One engine.** Types, bands, the combination rule, flag, basis and reason are pure `src/engine` code. Python computes none of it.
- **URL is the only state (AD-5).** Tab, `ekskl` and `band` are read and written only through `parse`/`serialize` in the analysis-state module. `band` is `0`, `1` or `2`; `ekskl` is sorted, de-duplicated, at most 20 orgnrs, each in the candidate pool (stages 1–3) at the current band. An invalid value falls back to its default and raises the one invalid-settings notice; nothing is dropped silently. Defaults are omitted from the URL; "default peer group" is a predicate on parsed state, not on the URL string.
- **Peer changes (AD-6).** Exclude, restore, widen and reset are soft navigations — `router.push` to a URL from `serialize` — rendered on the server, one history entry each; back returns the previous group. While pending, previous figures stay dimmed; a failure keeps the last good URL and figures. (Share and EV, Epic 3, use `replaceState` instead; all URL writes go through one hook that serializes one state object.) Exact values cross to the client only through the wire codec, never as `number`.
- **Request path.** `pool` is stages 1–3 and validates `ekskl`; `group` is the pool after stages 4–5; aggregates use `group` minus `ekskl`. The shown group is picked by the shared helper, not by callers. Statuses (404, redirects) are decided before any Suspense boundary; a failed read answers 500.
- **Request surface (AD-10, AD-12).** No new route or server action; soft navigations and RSC payloads pass the proxy's per-IP analysis budget.
- **Copy** lives in the message file, looked up by dotted id; numbers go through the engine's format module; counts and revenues in tabular figures.

## UX & Interaction Patterns

- **Funnel:** five stages with tabular counts and 8px navy-700 bars proportional to stage 1; "✦ {n} med usikker klassifisering" below; with exclusions "{n} ekskludert av deg → {m} i analysen".
- **Peer list:** Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag · action; caption key "✦ KI-generert". "Ekskluder {Navn}" keeps the row in slate, struck through, tag "Ekskludert", action "Ta med igjen"; focus stays on the same button while its label changes. Phone: one card per peer with "Vis alle {n}".
- **Size-band control:** segmented `radiogroup` with roving tabindex (arrow keys), steps "0,5–2× / Standard", "0,33–3× / Utvidet", "0,25–4× / Utvidet", each showing the resulting revenue range; full-width three-column grid on phone; states that comparability is never loosened. Fixed steps, never a slider.
- **State blocks** (surface, 4px navy-700 left accent, kicker + one or two sentences, at most one action; the only banner-like component): widened band — tag "Utvidet" and "Utvidet størrelsesintervall (0,33–3×). Dette er ikke standard peer-gruppe." with "Tilbake til standard (0,5–2×)"; too small — above the funnel, "Peer-gruppen har bare {n} sammenlignbare. Med under 10 viser vi ingen median eller kroner." with "Utvid størrelsesintervallet" at Standard, without the action and with "… også med det videste intervallet" at the widest step, "Fant ingen sammenlignbare selskaper." at zero; counts always shown.
- **Live regions** exist empty from page load; one action, one polite announcement: "{Navn} er ekskludert. {m} sammenlignbare i analysen." / "{Navn} er tatt med igjen. …"; "Størrelsesintervall {b}. {n} sammenlignbare."; reset "Standard peer-gruppe er gjenopprettet. {n} sammenlignbare." with focus to the Peers `h2`. Band steps keep focus.
- **Recompute:** affected regions `aria-busy="true"`, previous figures dimmed with slate "Oppdaterer …", never animated in any motion mode; failure is `role="alert"` "Kunne ikke oppdatere analysen. Prøv igjen.".
- **Invalid settings:** exclusions outside the pool at the new band are dropped with the slate notice "Noen innstillinger i lenken var ugyldige og er satt tilbake til standard.", shown once.
- **Targets** at least 24 × 24 px (44 recommended on phone); focus ring never clipped by a scroll container; no hover-only affordances, no modals, no browser storage for state that matters.

## Cross-Story Dependencies

- **2.7 → 2.8:** 2.8 adds the action column, exclude/restore, the size-band control, the too-small and widened State blocks and the exclusion line to 2.7's list and funnel. Two open review items from 2.7 land in 2.8: with `ekskl` set, the stage-5 and flagged counts must count only peers in the analysis (an excluded flagged peer must not count), and an all-excluded group needs its own sentence rather than "Fant ingen sammenlignbare selskaper." under a funnel with survivors; and the phone list's "Vis alle {n}" must reset (or deliberately stay open, tested) across a soft navigation that changes the group.
- **2.9** supplies absence reasons, including below the floor, which 2.8's floor crossings surface; Epic 3 renders the document rows that show them.
- **Other epics:** the adjusted-group explanation state ("Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den.") belongs to Epic 4; share and EV controls (Epic 3) must survive peer-change navigations; Story 5.2 measures each funnel layer and may switch the text signal off; Story 5.4 writes the demo seed.
- **Local data:** document rows from the acceptance and labelled-set runs live only in the local database and gitignored dumps until the licence assessment; never delete them.
