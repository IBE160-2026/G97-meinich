# Epic 2 Context: Trust the peer group

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the peer group something the user can judge and adjust. Behind the page, batch step 1 reads every filed 62.100 document for 2021–2025 by OCR, stores the figures exactly as filed, and accepts a filing only when it reconciles; OCR accuracy is measured (SM-2) against a hand-transcribed reference set; a company the register withdraws (`410 Gone`) is deleted; batch step 2 computes the business-model fingerprint (stage 4) and a model classification (stage 5). On the page, the Peers tab shows the five-stage funnel with counts, "Hvorfor med", "Grunnlag for treff" and "Usikker klassifisering" per peer, lets the user exclude a peer or widen the size band with every figure recomputed, and every missing figure states its reason, including a subject whose own filing fails reconciliation. Epic 1 is done; nothing in Epic 2 has started. Build order is 2.1a → 2.1b → 2.2 → … → 2.9.

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

- **OCR is batch only.** No document is fetched or read in a request; the no-outbound-request test still passes during an analysis. Match on orgnr only; take the filing year from the document and the returned `id`/`regnskapsperiode`, never the requested `år`. Paper filings (cover form "VEDLEGG TIL") get status `paper` and are never read; only the generated section ("GENERELL INFORMASJON") is read.
- **Never repair an OCR digit.** A figure is built only from the generated layout's digit groups; a token with any non-digit is absent, never guessed. The digits-only pass fills only figures the plain pass missed, and is kept only if the column then reconciles. The spike's four errors each get a regression fixture.
- **Two reconciliation rules, never collapsed, neither exact equality:** within a document a tight absolute bound of a few kroner (spike: 5 kr); document vs API a proportional tolerance (reporting in millions must pass, a factor-10 error must fail). Each value set once in configuration and recorded with its reason in `docs/data-sources-brreg.md` in the same PR. Any failed check makes the filing `failed_reconciliation` and none of its document figures reaches the engine. The data-quality flag derives only from the checks, never from OCR confidence.
- **SM-2:** a seeded, stratified draw (years × revenue bands, strata written before the draw) of 15–20 generated filings from the whole industry, tracked in issue #14. Report both denominators against the baseline 156/178 and 156/168; list every mismatch; make no claim beyond what was measured.
- **Deletion:** only `410 Gone` deletes, and it deletes rather than flags; every other answer deletes nothing and is written to step 1's run record. A deleted orgnr leaves every peer group, aggregate, seed file, the manifest and the allow-list; in `ekskl` it drops with the invalid-settings notice.
- **Never select on a benchmarked measure.** No stage-1–5 function takes a margin, return or productivity figure; cost-of-goods and personnel-cost shares enter only as band ids. A within-band spread test for 62.100, with measure and threshold written before running on data; a collapsed band is dropped and recorded.
- **Classification:** the model receives only name, secondary codes, statement of purpose and business description, and answers in the fixed category set; no free text, nothing coerced (outside the set → `failed`). Unchanged text is not reclassified. Nothing to classify → `no_text`, still eligible on stages 1–4. Status is `classified`, `no_text`, `failed` or `pending`; `seed:export` refuses while a covered-industry row is `failed` or `pending`.
- **Peer adjustment:** the size band is the only loosenable criterion in v1; no step admits a company failing any comparability field, and no control loosens legal form or geography. Assembly for a new URL under 1 s (timed test); time to re-render measured and recorded in the PR. A figure must be able to cross the 10-peer floor either way.
- **Absence reasons:** each figure is a value or an absence with exactly one reason — undefined, failed reconciliation, not in this dataset (decided from the manifest's orgnrs with document figures, never from a missing row), below the floor (with count). A subject whose own filing failed reconciliation keeps its API figures, kroner, tabs and peer group; its twelve document figures are absent with that reason.
- **Responsive:** every Peers state at 375 and 320 px with no horizontal body scroll; tables and charts in their own scroll containers.
- **PR obligation:** each PR states what could go wrong (OCR money figures, tolerances, automated delete, banding and selection, model input/output and key, payload, URL state and recompute failures, absence reasons) and records it in `docs/ai-log.md`.

## Technical Decisions

- **Two batch steps, one writer per table.** Step 1 (Python, Docker) writes register data, document figures as filed and the per-filing status, and does the one declared delete. Step 2 (Node scripts here) writes fingerprints and classifications through `DERIVE_DATABASE_URL`. Python's only arithmetic is reconciliation; every ratio, band and type is computed by `src/engine`. Postgres is the only hand-off.
- **One Tesseract image.** Step 1's image absorbs `analysis/ocr/Dockerfile` (a CI check fails on a second one), Tesseract 5.5 with `nor` from `tessdata_best` at a pinned commit and checksum. Build on the spike in `analysis/ocr/`, do not restart. Files passed into the container are LF.
- **Stored as filed.** `bigint` øre columns named `<field>_ore` with a unit comment; NULL for absent or unreadable, never 0; stated totals kept, nothing derived stored (derivation of missing components lives only in the engine). Both columns stored, the prior-year column with its own year reference. Per filing: filing year, `read_at`, reporting unit, status (`reconciled`, `failed_reconciliation`, `not_extracted`, `paper`) and each check's result. Document rows carry the dataset tag (provenance only). The 979607008/2025 contract test asserts hand-checked øre for both columns.
- **Schema:** all DDL in migrations; new tables need grants and a seed decision (`SEED_TABLES`/`LOADER_TABLES`), and a migration re-exports the seed in the same PR. Step-2 tables reference the company `ON DELETE CASCADE`, covered by the 2.4 deletion test. Each step has its own run-record table, written only by its own role; every run writes one, failures included; `pnpm seed` prints the latest of each.
- **Fingerprint:** one type in `src/engine/fingerprint.ts` with five categories (inventory, cost-of-goods band, capitalised intangibles, asset-intensity band, personnel-cost band), mirrored by a migration check. Each row stores a digest of its raw inputs from the one engine digest function; all fingerprints rebuilt every run; CI recomputes the allow-listed ones and fails on mismatch. Export of categories outside the allow-list follows `docs/licence-gate.json` (absent or closed → allow-listed only).
- **Business types:** one shared set in `src/engine` (proposed produkt, konsulent, forhandler, annet), used by both the fingerprint and the model's response schema (generated from it). Story 2.5 fixes the set, meanings, the type rule and the spread threshold, and records them in the technical note's funnel section.
- **Combination rule:** both signals agree → decides (two different non-subject types also remove); disagree → keep and flag "Usikker klassifisering", the model never adjudicates; one present → it decides; neither → stages 1–3 only. A signal missing for the subject counts as missing for all. Stage 4 removes a fingerprint mismatch unless the text gives the subject's type; stage 5 removes a text mismatch with no fingerprint.
- **Model provenance:** model id pinned in config; each row stores model id, prompt hash and description digest; the key is read only by step 2. Without a key, tests use stored responses and the app stored classifications (no-network test).
- **Request path:** stages 4–5 read stored rows only. Peer changes are `router.push` soft navigations to a `serialize` URL, rendered on the server; nothing is written. Payload carries no peer field beyond what funnel, list and shown figures need (AD-4 is now the ceiling, not Epic 1's stricter rule). Any exact value sent to a client component goes through the wire codec. Make the AD-4 payload scan a shared e2e helper and split `e2e/analysis.spec.ts` by surface (retro action, Story 2.7).
- **Engine absence type:** a discriminated union with an exhaustive switch to EXPERIENCE states, failing to compile on a new reason.

## UX & Interaction Patterns

- **Funnel:** "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", counts in tabular figures, 8px navy-700 bar proportional to stage 1; Segment shows each criterion (v1: AS only, worded as FR-9); "✦ {n} med usikker klassifisering"; shown even below the floor; "{n} ekskludert av deg → {m} i analysen". Phone: vertical list, name left, count right, bar beneath.
- **Peer list:** Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag; caption key "✦ KI-generert". "Hvorfor med" is deterministic, no ✦, no model input. Basis is one of "Beskrivelse og regnskap" (✦), "Kun regnskap", "Kun beskrivelse" (✦), "Kun bransje og størrelse". ✦ is `aria-hidden`; screen readers hear "KI-generert" once per cell; never on a number. Phone: one card per peer, "Vis alle {n}", targets ≥ 24 × 24 px.
- **Exclude/restore:** row stays, slate, struck through, tag "Ekskludert", action "Ta med igjen"; focus stays on the button; live announcements with name and new count. "Tilbakestill til standard" announces and moves focus to the Peers `h2`. One history entry per change; back restores.
- **Size band:** `radiogroup` with roving tabindex, three steps showing the revenue range; beyond Standard the group is tagged "Utvidet" with a State block and "Tilbake til standard (0,5–2×)". Too-small State block above the funnel with "Utvid størrelsesintervallet" (absent at the widest step); zero peers "Fant ingen sammenlignbare selskaper."
- **Pending/failure:** `aria-busy`, previous figures dimmed with "Oppdaterer …", no animation; failure `role="alert"` "Kunne ikke oppdatere analysen. Prøv igjen.", URL and figures stay at the last good state.
- **Failed subject filing:** slate header subline "Regnskapet for {år} kunne ikke leses sikkert", no badge, wraps on phone.

## Cross-Story Dependencies

- 2.1a → 2.1b → 2.2 → 2.3: 2.1a is the reading library and image (no database; PyMuPDF pinned, AGPL noted in the stage-2 licence assessment); 2.1b stores its output. Årsverk is not read in Epic 2 (deferred; 2.9 shows FTE figures absent). Reconciliation consumes 2.1b's stored per-check results; SM-2 consumes 2.1's output and the reference set (issue #14). 2.3 must make `seed:export` keep curated `seed/allow-list.json` entries (it writes `[]` today) and refuse document-figure orgnrs not on the list.
- 2.4 creates step 1's run-record table and the deletion test that 2.5 and 2.6 extend; 2.6 creates step 2's.
- 2.5 fixes the shared business types and the stage-4 rule; 2.6 reuses them unchanged and completes the combination rule; 2.7 shows the result; 2.8 adjusts it; 2.9 adds absence reasons over 2.2's statuses.
- Open items assigned here: 2.1a removes `minimumReleaseAgeExclude` from `pnpm-workspace.yaml`; 2.1b extends the first "Kilder og lisens" paragraph to name the filed annual accounts; 2.9 owns the "revenue not stated" copy and the reason for an empty peer group from a failed comparability field. Before document figures become a second source, choose the subject's benchmark filing in the engine only (it is written three times today).
- Epic 3 renders the document rows using these figures and reasons; the explanation's adjusted-group state belongs to Epic 4. Story 5.2 follows Epic 2 directly and measures each funnel layer against the labelled set; Story 5.4 writes the licence-gate file.
