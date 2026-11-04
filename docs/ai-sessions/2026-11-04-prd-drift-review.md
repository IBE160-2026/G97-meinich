# PRD drift review after Epics 1–2

**Date:** 2026-11-04
**Tool:** Claude (claude.ai, cloud session, Opus 5.5), with three review subagents and one independent fact-check subagent
**Story / issue:** planning
**Result:** commits `c4d93d6` (PRD and memlog), `4337261` (technical note), `8d46181` (AGENTS.md rule and PR template), `8d8ab3a` (fact-check fixes), this file and the AI-log entry — prepared in a cloud session without push access and applied on `main` from Meinich's machine as a patch series

## Goal
Find where the PRD, last updated 2026-10-10, no longer matches what Epics 1–2 built and decided; bring it in line; and change the process so it does not drift again.

## Prompts that mattered
Meinich's prompts, verbatim (Norwegian):
- "hvordan ser prd-en ut i prosjektet" — an overview of the PRD, which ended with the observation that it had not been updated since 2026-10-10 while the specs had moved, and an offer to check it against the build.
- "gjerne" — run that check.
- "ja, kan du ikke lage endringene her så kan jeg be claude desktop gjøre det når man er hjemme igjen. Gjerne også foreslå noe slik at dette ikke blir et problem i fremtiden. Må logges" — make the changes in the cloud session as a patch for Claude Desktop to apply at home, propose a fix for the process, and log it.

## What came back, and what was done with it
- **The check.** The PRD was split into three slices (lookup, routes and running; the funnel and key figures; OCR and data quality), each given to a review subagent with the same brief: compare against code and tests first, then spec change logs, then `AGENTS.md`, then `epics.md`; report stale statements, silent drift and done stories missing their part. 31 findings came back (A1–A9, B1–B11, C1–C11). The main session re-checked the high and medium ones against the sources before using them.
- **Accepted:** all 31, as edits to `prd.md` with seven `.memlog.md` entries. Three were drift with no recorded decision anywhere: FR-58 promised acceptance per figure while reconciliation decides per column; FR-28/FR-59 promised a fully pre-warmed industry while only the acceptance and reference sets are read; FR-73 described the seed's reference set as filings when the allow-list is per company. The rest were decisions recorded correctly in spec change logs, the retro or `deferred-work.md` and never folded back.
- **Raised, not decided:** four new open questions (§11, 21–24) — guarding the lines no reconciliation check covers, owning stories for the full document run and for `aarsverk`, dissolved companies as peers, and the match basis of an undetermined peer before Story 2.7. The PRD edit records decisions; it does not make them.
- **Corrected, and how it was caught:**
  - Finding B10 cited `docs/key-figures.md:107` as saying total cost share has no direction. That line lists the no-direction figures and leaves total cost share out; the table row (line 72) is what gives it none. The PRD edit follows the table, and the inconsistency inside `docs/key-figures.md` is left for Meinich, because that document changes together with the code. Caught by reading the cited line.
  - Finding C8 proposed rewriting §8 as "ten of fifteen key figures are recoverable in v1". Rejected as worded: twelve figures still need a document component; two of them also need `aarsverk`, which is not read yet. §8 says that instead.
  - The main session's first FR-10 draft said reading the missing cost lines was "proposed", from the opening word of the `deferred-work.md` entry. The same entry records that Meinich decided on a separate story on 2026-11-01; the PRD says decided. Caught by reading the whole entry before committing.
- **Independent fact-check of the fix (`8d8ab3a`).** A subagent that had not seen the work checked about 70 statements in `c4d93d6` and `4337261` against the sources and found 10 wrong; the main session verified each before correcting it. The worst were two edits that made decisions instead of recording them — FR-73 allowing a performance-only migration and FR-27 settling total cost share's direction — both reverted and raised as notes; and the claim that "v1 is not complete" until the full document run, which rested on `measured: false`, a flag about the labelled-set measurement. The others: the reference set credited to Story 2.1b instead of 2.3; the full run called unowned when Story 2.1b's criterion asked for it; the spread test described as industry-wide when it ran on 421 companies; the glossary tying aggregates to stage 4 only; paper filings said never to be fetched; the read date said to be the first read. Details in the `.memlog.md` override entry and `docs/ai-log.md`.
- **Also corrected outside the PRD:** the technical note's Decision points paragraph still called the banding "proposed rather than settled", against its own "Rules fixed by the stories". `AGENTS.md` says to edit an authoritative document a finding makes wrong, so it is corrected in `4337261`. Under the new rule, `epics.md` Story 2.5 is corrected in `8d8ab3a`: a band that fails the spread test goes to Meinich (spec D3) rather than being dropped.
- **Process fix (`8d46181`).** Root cause: `AGENTS.md` told every session to correct the four authoritative documents and frozen specs, but nothing told a story to correct the PRD. Added to "Specs, reviews and merging": a decision travels upstream in the PR that makes it (PRD with a `.memlog` line, technical note, `epics.md`); deferred v1 work that no story owns goes into `epics.md` or a PRD open question; the PR states "Planning documents:" and the review checks it; each epic retrospective checks the PRD against the epic's FRs. A PR template carries that line next to the fields `AGENTS.md` already requires. Considered and rejected: a CI test comparing spec change-log dates with the PRD's `updated:` date — it would fail on every change log that does not touch an FR and teach people to bump the date.
- **Delivery.** The cloud session could read the repository but not push (the Claude GitHub App is not installed for the organisation). The commits were made there on a branch and handed over as a patch series, to be applied on `main` with `git am` from Meinich's machine; planning documents may go straight to `main` (`AGENTS.md`, Git workflow).

## Links
- PRD: `_bmad-output/planning-artifacts/prds/prd-Peerless-2026-09-25/prd.md`, `.memlog.md` (entries of 2026-11-04)
- `AGENTS.md`, "Specs, reviews and merging"; `.github/pull_request_template.md`
- `docs/ai-log.md`, entry "2026-11-04 — PRD drift after Epics 1–2, and an AI fact-check of the AI's own fix"
- `docs/ai-prompts.md` is not edited here: the review session adds the prompts when Meinich asks (`AGENTS.md`, Git workflow).
- Session log: `.logs/christian-meinich/996-2026-11-04-11-13-29-prd-drift.md`
