# Story 2.7: the Peers tab shows why

**Date:** 2026-11-13
**Tool:** Claude Code (Opus 5.5), BMAD implementation subagent dispatched by the BMAD session
**Story / issue:** #56, Story 2.7 (FR-9 wording, FR-14 flagged count, FR-15, FR-16)
**Result:** commits `efa1cea` to `2c05f22` on `story/2.7-peers-why`; PR not opened yet

## Goal

Implement the approved spec `_bmad-output/implementation-artifacts/spec-2-7-the-peers-tab-shows-why.md`: the five-stage funnel with its counts, and per peer a driftsmargin, a rules-written "Hvorfor med" and the match basis, server-rendered so the page carries only the strings shown.

## Prompts that mattered

The dispatch, from the BMAD session:

> Read C:\Dev\ibe160\_bmad-output\implementation-artifacts\spec-2-7-the-peers-tab-shows-why.md fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start.

with two working rules from Meinich: commit in small steps in the order of the spec's Execution list, never push; and do not touch the local database (no seed, reset, derive, ingest or classify), leaving `pnpm test:db` and `pnpm test:e2e` to him.

## What came back, and what was done with it

- **Accepted, one commit per step:** the e2e split, tests unchanged (66 titles before and after, by `playwright test --list`); `matchBasis` and its matrix tests; the not-stored test; the copy; `inclusionReason`, `peerRows` and the counts and flag through `shownGroup`; the funnel, list, cards and "Vis alle"; the Peers e2e tests and the shared payload scan.
- **Order changed:** the copy commit came before the analysis step, not after it, because `t()` takes its id type from `nb.json` and each commit must type-check.
- **Signature changed:** `inclusionReason(subject, peer, subjectName)` takes the subject's display name as a third argument. The spec's code map gives two arguments, but its decision names the subject in the text, and the name is not a profile field. It is not a model field either.
- **Beyond the spec:** the candidate read no longer reads the municipality, since the list dropped the column (AD-4). `src/messages/index.ts` imports `nb.json` with the json import attribute, because Playwright's loader requires it once the specs import `peerRows`; `pnpm build` and `pnpm check:routes` pass with it.
- **Copy not quoted by the spec or EXPERIENCE, drafted here, to be checked by Meinich:** the Segment criterion line "Selskapsform: foreløpig bare aksjeselskaper (AS)", the flag column's screen-reader header "Merknad om klassifiseringen", the funnel's label "Trinnene i utvalget", and the traits "lønnskostnadsandel i samme bånd" and "varige driftsmidler i samme bånd".
- **Demo A and B:** both are `uklart`, so neither shows a ✦ basis or a flag even once Story 5.4 seeds their fingerprints. Story 5.4 in `epics.md` already carries the criterion to consider a demo company whose text has a type (`be7711b`).
- **Checked in the browser** at 1280, 375 and 320 px against the local database (demo A, 234 peers locally): no sideways scroll, no target under 24 px, "Vis alle 234" opens by keyboard and moves focus to the first revealed card.

## Not run

`pnpm test:db` and `pnpm test:e2e` (left to Meinich; the local database holds dump rows the committed seed does not, so seed-based e2e expectations may disagree locally). The review-fix commit, the PRD check after review and the PR wait for the review.

## Links

- AI log: "2026-11-13 — Story 2.7: what the Peers page now sends per peer"
- Planning documents: `EXPERIENCE.md` (Vocabulary, Funnel, Peer list) and its `.memlog.md`
