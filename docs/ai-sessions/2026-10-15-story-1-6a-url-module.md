# Story 1.6a: one module reads and writes the analysis URL

**Date:** 2026-10-15
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #7, Story 1.6a
**Result:** branch `story/1.6a-url-module`, [PR #23](https://github.com/IBE160-2026/G97-meinich/pull/23).

## Goal

One module that parses and serializes the analysis URL (AD-5, FR-69, UX-DR79), with every parameter and fallback under unit test before Epic 2 adds a control, and the search field's hand-built `/analyse/{orgnr}` link replaced by it. No route, page or notice copy: those are Story 1.6b.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-6a-url-module.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human's answer to the two open questions in the draft spec (candidate-pool check; unknown query parameters), verbatim:
  > Behold spec-en hel.
  > 1: (a), men isCandidate er en ferdig lukket funksjon fra den som kaller: (peerOrgnr: string) => boolean. parse skal ikke vite hvordan poolen bygges (bånd e.l.) – det avgjør 1.7 inni funksjonen. 1.6b sender en dokumentert "godta alle" til 1.7 finnes.
  > 2: (a). Ukjente parametre ignoreres uten melding, og forsvinner når URL-en skrives kanonisk. Test med fbclid og utm_source.

  This narrowed the session's proposal, `isCandidate(orgnr, { orgnr, band })`, to a closed predicate on the peer orgnr alone.
- The human's approval, adding a matrix row the session had not proposed, verbatim:
  > godkjent, med ett tillegg i matrisen før du starter: en ekskl-verdi lik orgnr-et i stien (selskapet selv) droppes og setter flagget, uavhengig av isCandidate. Test det.

- The human's correction after the review, which had deferred an inexact AGENTS.md sentence, verbatim:
  > rett AGENTS.md-setningen i denne PR-en, så den sier nøyaktig hva som skjer: en avvist ekskl-verdi droppes, en ukjent fane blir Oversikt, ukjente parametre ignoreres, øvrige ugyldige verdier faller tilbake til standard. Push deretter og opprett PR-en (Closes #7, FR-69).

  The sentence was corrected in this PR, and its `deferred-work.md` entry removed.

## What came back, and what was done with it

- **Accepted:**
  - `src/url/analysis-state.ts`: `parse(href, context)` → `analysis` (state plus one `invalidSettings` flag) | `invalid-orgnr` (`length` | `checksum`) | `not-analysis`; `serialize(state)`; `parseMultippel(text)` for Story 3.6's field; `defaultState(orgnr)`; `MULTIPPEL_MAX`, `MULTIPPEL_STEP`, `MAX_EKSKL`; the types `Fane`, `Band`, `Andel`, `AnalysisState`, `ParseResult`, `ParseContext`. It imports only `src/engine/decimal.ts` and `src/engine/orgnr.ts`.
  - `test/url/analysis-state.test.ts`: every row of the spec's I/O matrix, both predicates both ways, and a final fixed-point test: every URL parsed in the file, once serialized, parses back to the same state without the flag and serializes to the same string.
  - `test/url-module-boundary.test.ts`: the module's imports resolve only into `src/engine`, and no other file under `src/` contains `/analyse/`.
  - `src/components/search-field.tsx`: `analysisHref` is `serialize(defaultState(orgnr))`; a header comment that named the path was reworded so the boundary test holds.
- **Decided in implementation, for review:**
  - `defaultState(orgnr)` is exported, beyond the spec's list, so callers such as the search field do not repeat the defaults.
  - Empty items inside `ekskl` (`a,,b`, a trailing comma) are skipped without the flag, as an empty value is: there is nothing to drop.
  - `serialize` sorts and de-duplicates `ekskl` itself, so a later control that hands it an unsorted list still writes the canonical URL. It does not validate the state; `parse` is the gate.
  - `parseMultippel` does not trim whitespace; the Verdi field (Story 3.6) trims before calling it if it wants to.
  - A tab segment is matched exactly (`Peers`, `nøkkeltall` fall back to `oversikt`).
- **Corrected during implementation:** none beyond a variable-name typo.
- **Corrected after review** (`bmad-build` review layers: blind, edge-case and verification-gap): the multiple's step check rounded at precision 40 and is now exact (`decimalPlaces() <= 1`); a repeated empty value no longer sets the flag; malformed `%` escapes in the path are now tested; the boundary test searches for `/analyse` without the trailing slash. Details in the ai-log entry.

## Links

- `docs/ai-log.md`, entry "Story 1.6a: the analysis URL is user input, and how it could reach the engine".
- `AGENTS.md` Toolchain paragraph (the URL module sentence); the 1.5b deferred item about `analysisHref` is resolved and removed from `deferred-work.md`.
