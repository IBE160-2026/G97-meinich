---
title: 'Story 2.7: The Peers tab shows why'
type: 'feature'
created: '2026-11-13'
status: 'in-progress'
baseline_commit: 'be7711b53e54208b5a590d3a285bda45794235c7'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Peers tab lists names, revenue and municipality only, so the user cannot see how the group narrowed or why a peer is in it, and cannot judge the group before trusting a comparison (FR-15, FR-16).

**Approach:** Add the five-stage funnel and the counts the funnel already computes, and give each peer a driftsmargin, a rules-written "Hvorfor med" and a "Grunnlag for treff" derived in `src/engine/peers.ts` from `signals()`. Server components render it, so the page sends only the strings shown. The phone layout uses a list and cards. Issue #56, branch `story/2.7-peers-why`.

## Boundaries & Constraints

**Always:**
- The match basis comes from one exported function next to `signals()`, which calls it. The group, the flag and the basis all read the same `signals()`. If Story 5.2 switches the text signal off where the classification enters, all three follow with no further code.
- The basis and the flag are computed per request and stored nowhere.
- "Hvorfor med" takes no model field. Its input type is the profile fields only (`naeringskode1`, `sumDriftsinntekter`, `fingerprint`), it carries no ✦, and the same input gives the same text.
- ✦ appears only on "Beskrivelse og regnskap", "Kun beskrivelse", the flag tag and the flagged-count line. It is `aria-hidden` and appears on no number. Screen readers hear "KI-generert" once per cell.
- AD-4: each peer reaches the page as display strings only (name, revenue, driftsmargin, reason, basis label, flag tag). No orgnr, municipality, øre amount, fingerprint category or business type.
- Every number goes through `src/engine/format.ts`. Every string comes from `nb.json`, shown to Meinich before it is written there and in EXPERIENCE.
- Examples and fixtures use demo A, B and C or synthetic companies. No classification or fingerprint is given per orgnr for the labelled set's 845 companies, here, in the PR or in the ai-log. The e2e subject with mixed bases is picked from the seed outside `analysis/labelled-set/document-run.json` and never named in a title.
- No `pnpm classify` run, no deleted dump, no push before Meinich says so. Small commits, phone width checked as the work goes.

**Decisions (Meinich, 2026-11-13):**
- "Hvorfor med" names the subject: "omsetning 2× ADMMIT AS" (the subject's name, or its grouped orgnr when it has none).
- The flag has its own sixth column on desktop, with a screen-reader-only header; basis and flag share a cell only on the phone card.
- The phone shows 8 cards before "Vis alle {n}".
- The full spec is kept; splitting `e2e/analysis.spec.ts` is the first commit and moves tests only.
- Copy as shown at the checkpoint, with the intangibles trait written from the fingerprint's rule: "balanseførte immaterielle eiendeler minst {andel} av omsetningen" / "immaterielle eiendeler under {andel} av omsetningen", `{andel}` formatted from `INTANGIBLES_SHARE` in `src/engine/fingerprint.ts`, never a literal.
- Demo A and B: locally both have fingerprints; only the committed seed lacks them, because the allow-list holds only the OCR reference set until Story 5.4 adds A, B and their peers. Their text is `uklart`, so even after 5.4 neither shows a ✦ basis or a flag. Story 5.4 in `epics.md` gets a criterion to consider a demo company whose text has a type, so the demo shows the AI layer (this PR); the session file says so too.

**Never:** the exclude or restore action, the size-band control, the too-small and widened State blocks (all Story 2.8); a stored basis; model text in "Hvorfor med"; a new endpoint or server action.

## I/O & Edge-Case Matrix

Every row names the test that fails if its code is removed. Engine tests use synthetic filings.

| Scenario | Input / State | Expected | Test that fails without it |
|---|---|---|---|
| Both signals | both fingerprint and text types on both sides | "Beskrivelse og regnskap" | `test/engine/peers.test.ts` "match basis: both signals" |
| Fingerprint only | the peer's classification is null | "Kun regnskap" | "match basis: fingerprint only" |
| Text only | the peer has no fingerprint | "Kun beskrivelse" | "match basis: text only" |
| Neither | no signal on either side | "Kun bransje og størrelse" | "match basis: neither" |
| Undetermined, peer / subject | `businessType` returns null | no fingerprint signal | "match basis: an undetermined fingerprint for the peer", "… for the subject" |
| `uklart`, peer / subject | classification null (`classified`, no type) | no text signal | "match basis: uklart for the peer", "… for the subject" |
| Unclassified peer | no classification row (null) | no text signal | "match basis: an unclassified peer" |
| Flagged | the signals disagree | "Beskrivelse og regnskap", and in `flagged` | "match basis: a flagged peer is description and accounts" |
| Exhaustive | every type × null combination, subject × peer, of the peers in the group | exactly one of the four, each one reached | "match basis: exhaustive over the four" |
| Text signal off | every classification null | `flagged` empty, no basis rests on the text | "match basis: without the text signal, no flag and no description basis" |
| Never stored | migrations and seed headers | no basis or flag column | `test/match-basis-not-stored.test.ts` |
| Reason deterministic | the same profile, any classification | the same text | `test/analysis/inclusion-reason.test.ts` "same inputs give the same text, whatever the classification" |
| Reason has no model field | the input type | has no `classification` key | `test/analysis/inclusion-reason.test.ts` "the input type has no model field" (a `@ts-expect-error`, caught by `pnpm typecheck`) |
| Shared traits | equal, known categories | named in fixed order, at most two | `test/analysis/inclusion-reason.test.ts` "names shared fingerprint categories in order, at most two" |
| ✦ placement | four bases, with and without a flag | ✦ on two bases and the flag; "KI-generert" once per cell; never on reason or numbers | `test/analysis/peer-list.test.ts` "✦ on exactly the two classification bases and the flag" |
| Funnel | counts, a group of 7 | five stages, the Segment criterion, the flagged count, bars proportional to stage 1 | `test/analysis/peer-funnel.test.ts` "shows all five stages and the flagged count with a group of 7" |
| Row keys (AD-4) | a peer | exactly the shown fields | `test/analysis/peer-rows.test.ts` "a row has only the shown fields" |
| Payload (AD-4) | the Peers page, HTML and RSC | no peer orgnr, øre amount or server field name | `e2e/peers.spec.ts` via `e2e/payload.ts` `expectNoPeerFields` |
| Rendered | demo A, and a mixed-basis seed subject | rows match the engine run on the seed | `e2e/peers.spec.ts` "each row's basis and flag match the engine on the seed" |
| Phone | 375 and 320 px | funnel list, cards, "Vis alle {n}", targets ≥ 24 × 24 px, no sideways body scroll | `e2e/peers.spec.ts` "at {w} px: the funnel is a list and peers are cards" |
| Empty subject | `emptyReason` set | the sentence, no funnel | `test/analysis/peer-list.test.ts` "a subject that cannot have peers shows its sentence and no funnel" |

</frozen-after-approval>

## Code Map

- `src/engine/peers.ts:218` -- `signals()`: add `MATCH_BASES` and `matchBasis(subject, candidate)` beside it, and export them. `assemblePeerGroup` stays the same.
- `src/engine/key-figures.ts` `computeApiKeyFigures` -- a peer's driftsmargin, the same value the benchmark uses.
- `src/engine/format.ts` `formatMultiple`, `formatPercent`, `formatMillions`, `formatOrgnr` -- reuse. Add no formatter.
- `src/components/analysis/api-figures.tsx:31` `undefinedText` -- the text for a peer whose driftsmargin cannot be computed.
- `src/analysis/shown-group.ts` -- pass `counts` and `flagged` through `FunnelResult`/`ShownGroup`. Keep the choice of `group` here.
- `src/analysis/inclusion-reason.ts` (new) -- `inclusionReason(subject: ProfileFields, peer: ProfileFields): string`.
- `src/analysis/peer-rows.ts` (new) -- builds the display rows: name, revenue, driftsmargin, reason, basis and flag, and nothing else.
- `src/components/analysis/peer-list.tsx` -- rewrite as funnel + table + cards. The Kommune column goes, as the AC's column list has none.
- `src/components/analysis/peer-funnel.tsx` (new) -- an `<ol>` that is five columns at `md`, a list below it. Each bar is `width: calc(100% * n / stage1)`, using integers only.
- `src/components/analysis/show-all-toggle.tsx` (new, `'use client'`) -- reveals the hidden cards. Takes only ReactNodes and a count, following `phone-row-toggle.tsx`.
- `src/components/analysis/analysis-page.tsx:177` -- pass the subject's profile and the funnel output into `PeerList`.
- `src/messages/nb.json` `peers.*` -- the copy from the checkpoint, after Meinich's OK; `peers.col.kommune` and `peers.unknownKommune` go.
- `e2e/analysis.spec.ts` -- split by surface (Epic 1 retro action 11): `e2e/seed.ts` for the helpers, `e2e/payload.ts` as the shared AD-4 scan used by every tab, `e2e/peers.spec.ts`, `e2e/key-figures.spec.ts`, `e2e/oversikt.spec.ts`, `e2e/analysis-states.spec.ts`. The move is its own commit, with no test changed.
- Do not change: the funnel rules, `register.*`, the seed, `src/url/analysis-state.ts`.

## Tasks & Acceptance

**Execution (one commit per step):**
- [ ] Split `e2e/analysis.spec.ts` (a move only). Count the tests before and after and confirm both counts are the same.
- [ ] `src/engine/peers.ts` + `test/engine/peers.test.ts`: `matchBasis` and its tests from the matrix.
- [ ] `test/match-basis-not-stored.test.ts`.
- [ ] `src/analysis/inclusion-reason.ts`, `peer-rows.ts`, `shown-group.ts` + their tests.
- [ ] Copy into `nb.json` and EXPERIENCE (Segment line, flagged line, ✦ key, reason and basis texts), once approved.
- [ ] `peer-funnel.tsx`, `peer-list.tsx`, `show-all-toggle.tsx`, `analysis-page.tsx` + component tests. Check at 375 and 320 px in the browser.
- [ ] `e2e/peers.spec.ts` and `e2e/payload.ts`; every tab's payload test uses the helper.
- [ ] Review fixes (a separate commit), then `docs/ai-log.md` (what the payload exposes), the session file, FR status in the PRD if wording moves, sesjonslogg.

**Acceptance Criteria:** those of `epics.md`, Story 2.7, as settled by the answers above. The PR states what could go wrong with what the payload exposes, and has a "Planning documents:" line.

## Design Notes

"Hvorfor med" (synthetic: both fingerprints with cost of goods `low`, no inventory): "Samme bransje, omsetning 1,4× ADMMIT AS, varekostnadsandel i samme bånd, uten varelager". Demo A has no fingerprint in the committed seed, so there its rows read "Samme bransje, omsetning 2× ADMMIT AS" and nothing more; with the local dump restored, its fingerprint adds traits. The trait order follows the type rule: cost of goods, inventory, capitalised intangibles, personnel cost, asset intensity. Revenue ratio = peer / subject in Decimal, shown with `formatMultiple`.

A subject with `emptyReason` shows its sentence and no funnel. The zeros would only repeat what the sentence says.

## Verification

**Commands:**
- `pnpm check:pins; pnpm check:env; pnpm lint; pnpm typecheck; pnpm test; pnpm test:db; pnpm test:ingest; pnpm build; pnpm check:routes; pnpm test:e2e` -- expected: all pass on the loaded seed, without a model key.

**Manual checks:**
- The Peers tab for demo A and B at 1280, 375 and 320 px: no sideways body scroll, and the cards and "Vis alle" work by keyboard.
