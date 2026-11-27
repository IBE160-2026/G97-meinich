# Epic 4 Context: Understand the gaps — the explanation

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give every 62.100 company a short, stored, AI-written explanation (marked ✦) of its default analysis: the largest gaps in kroner and the measures where it is strong. The text is generated ahead of time in batch step 2 from the engine's own output, never at request time, and is held to the project's central promise that the model never calculates: an automated figure test, a recommending-phrase list and an input digest guard it at generation and again at seed load. The explanation is shown only beside the default peer group it was written for; an adjusted group hides it with a reset action.

## Stories

- Story 4.1: Explanations generated in batch
- Story 4.2: The figure test (FR-53)
- Story 4.3: The phrase test (FR-54)
- Story 4.4: The explanation card

## Requirements & Constraints

- **Content:** names the largest kroner gaps and the strengths. Which gaps and strengths are named, their direction and rank words, and any claim of persistence across years are decided by the engine, never the model. v1 texts make no persistence claim.
- **Slot references:** the model writes text whose figures, direction words and rank words are engine-provided slots, not free numbers; the stored row keeps the references.
- **Payload:** built only from the default analysis computed in memory by `src/engine`, every figure formatted by `src/engine/format.ts`. A company outside the demo set gets a payload of API figures only — no document figure (tested).
- **Coverage:** every 62.100 company has a stored explanation for its default group against the dataset it ships in, or a failure in step 2's run record. Batch failures are never swallowed.
- **Figure test (never weakened):** rejects any figure absent from engine output, and any present figure attached to the wrong key figure, company, year or direction. Unparseable text fails; nothing is skipped. Parses exactly what `format.ts` writes (U+00A0 thousands and before "kr"/"%", decimal comma, U+2212 minus) and the variants a model might write (hyphen-minus, regular or narrow space, "kr" before or after, "%"). A committed set of known-bad fixtures must each keep failing. Runs in CI on stored fixtures with no model key.
- **Phrase test:** one reviewable file holds every recommending/imperative phrase ("bør", "anbefaler", "må redusere", …); no other file holds phrases. Matching is case-insensitive and on word boundaries.
- **At generation:** a figure-test or phrase hit means regenerate; after the configured attempts, the explanation is not stored and the failure goes to step 2's run record.
- **At seed load:** the loader runs the figure test, the phrase check and the digest check against the loaded dataset, writes only passing explanations, and reports the rest with the orgnr; a withheld text is never shown.
- **No request-time generation:** no model call reachable from any request; the model key is read only by step 2; the no-network test still passes; without a key step 2's tests run on stored model responses.
- Each PR states what could go wrong with the model's input/output (or the parser/phrase list), recorded in `docs/ai-log.md`.

## Technical Decisions

- **Where the model runs:** only batch step 2 (Node scripts, run as `derive` through `DERIVE_DATABASE_URL`), pinned model id in configuration. Follow the classification step's pattern: one module names the API key and imports the SDK, a plan mode that needs no key, a cost ceiling, stored responses for test mode.
- **Explanation row:** model id, prompt hash, digest of the wire-encoded default analysis (from the one digest function in `src/engine`), dataset tag (provenance only), the slot-referenced text. References the company `ON DELETE CASCADE` so the withdrawal (410 Gone) deletion test covers it. Default analyses are computed in memory, never stored.
- **Digest is the one display gate:** the request path shows a text only when the current engine yields the same digest for that company and dataset; otherwise it is treated as missing. Nothing writes a hidden flag; no engine-version hard fail.
- **One writer per table:** step 2 writes explanations; the loader is the only other writer. Postgres is the only hand-off between steps. A new `register` table needs loader grants and registration in the seed format's table lists, and a migration PR re-exports the seed.
- All arithmetic stays in `src/engine`; money never a float; every displayed number through `format.ts`. Exact values crossing to client components use the wire codec.
- Step 2's run record (`run.step2`) carries counts and failures; `pnpm seed` prints it.

## UX & Interaction Patterns

- **Card:** full width on Oversikt (spans all 12 columns; last in the one-column phone stack). Kicker "Forklaring" with ✦; text clamped to two lines, "Les mer" expands in place (target ≥ 24 × 24 px). Source line "Skrevet av KI ut fra tall Peerless har regnet ut. Hvert tall finnes i analysen." with key "✦ KI-generert".
- **✦ rule:** only on the explanation as a whole, `aria-hidden`; screen readers hear "KI-generert" once. Never on a number. Every figure in the text links to its calculation ("Hvordan er dette regnet?").
- **States:** adjusted group (any exclusion or widened band) → "Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den." with "Tilbakestill" (clears exclusions, band to Standard, keeps `andel` and `multippel`); after reset the text shows and focus moves to the explanation heading. No stored text or digest mismatch → "Det finnes ingen lagret forklaring for dette selskapet."; nothing generated. A 62.100 company outside the demo seed shows its API-figure explanation as normal.
- Copy lives in `src/messages/nb.json`. The card works at 375 and 320 px with no horizontal body scroll. Reset announcements go through the existing polite live region.

## Cross-Story Dependencies

- 4.1 produces the rows and payload that 4.2 and 4.3 check; 4.2's figure test and 4.3's phrase list plug into 4.1's generation loop (regenerate/fail) and the seed loader. Delivery order is 4.1 → 4.4.
- 4.4 depends on Epic 3's provenance drill-downs (figure links), Epic 2's peer-change reset flow (moved acceptance criterion from Story 2.8), and the digest from 4.1.
- Story 5.4's demo seed (done) defines the demo set and allow-list that decide document vs API-only payloads.
- Story 5.5 follows: 30 random stored explanations read by a person, missed phrasing added to 4.3's list, then `pnpm seed:export` commits explanations into the demo seed with all three load checks passing. Story 5.6's About page describes the FR-53 test.
