# PRD: the FRs cut to rule and consequences, part three

**Date:** 2026-11-22
**Tool:** Claude Code (Opus 5.5), the BMAD session, continuing the Epic 3 retrospective's session
**Story / issue:** planning; Epic 2 retro action 11 (`epic-2-retro-item-15`) and Epic 3 retro action 3
**Result:**
- commits on `main`, in order:
  - FR-10: `95bccc4`, `259c2b8`;
  - FR-11: `84ae67a`;
  - FR-13: `e266990`, `6618b6f`;
  - FR-28: `90b2ab3`, `f62aa4f`, and `2b6eaec` (a memlog fix);
  - the nine small FRs: `7c4b7c6`, `f4cecfe`, `b5d4195`, `16775fb`, `0ad57f0`, `ffbbb08`, `2ee02be`, `7a9fda8`, `b27d8c4`;
  - `epics.md`: `225f998`;
  - the action items: `388d374`;
- not pushed: the review session pushes and writes the prompt log.

## Goal

Cut the 13 PRD FRs that still carried build history to their rule and 3–6 testable consequences, before Story 5.4's spec is written. That meant removing story references, dates, "an earlier version", who decided what, and file paths. The pattern was FR-24 as the lecturer proposed it (`tilbakemelding-prd.md` 4.1, `ea68a7c`). The six Epic 3 FRs and FR-3 had been cut in the retro (`0897781`).

## Prompts that mattered

Meinich, opening the job (verbatim, shortened):

> PRD-kuttet, del to […] resten av FR-ene med byggehistorikk kuttes ned til regel og konsekvenser, før spec-en for 5.4 skrives. […]
> 1. Måletall slettes aldri. Før et tall tas ut av en FR, skal det stå et annet sted: i §10 i PRD-en, i det tekniske notatet eller i en rapport under analysis/output/. Flyttingen gjøres i en egen commit før kuttet, slik FR-58 ble flyttet til AD-15 i 9b5954e. […]
> 2. Sjekk det maskinelt: hvert tall med minst tre sifre eller med desimal som forsvinner fra prd.md i kuttet, skal finnes i målstedet. Vis utskriften.
> 3. Beslutningshistorikken går til .memlog.md som én (change)-linje per FR eller gruppe […]
> 4. Regelen skal ikke endres. Hvis et kutt ville endret hva FR-en krever […] skal du stoppe og spørre meg. […]
> 5. Sjekk hvem som viser til teksten som går ut […]
> - Først: flyttingen av måletallene og kuttet av FR-10, den tyngste. Vis meg tabellen fra regel 1, utskriften fra regel 2 og diffen for FR-10 før du committer.

Meinich, after FR-10 (verbatim, shortened):

> 2. numcheck.py: utvid sjekken til alle tall med minst to sifre og alle tall som står foran %, pp eller «of». «41 %» slapp gjennom nå […]

Meinich, after FR-11, FR-13 and FR-28 (verbatim, shortened):

> Rettelsen i §10, kulepunktet om avstemmingsraten: behold målingen fra 2.3b og legg den nyere ved siden av. Ikke bytt ut den ene med den andre. […] Regel 1 gjelder også for §10: et måletidspunkt forsvinner ikke.

Meinich, on the nine small FRs (verbatim, shortened):

> 1. FR-6: flytt [NOTE FOR PM] til §11 som et åpent spørsmål. Ordlyden skal være den samme og spørsmålet ubesvart. […]
> 2. FR-56: to konsekvenser holder. 3–6 er veiledning. Behold delingen bare hvis begge halvdelene kan testes hver for seg. […]
> 3. FR-65: la pekeren til docs/data-sources-brreg.md stå. […]
> 4. epics.md:41: ta ut «(signals() not null)» […] Gjør det i en egen commit.

## The numbers that moved

| Number | Was in | Is now in |
|---|---|---|
| 165 of 400 fingerprinted companies undetermined (41 %), 2026-11-07 | FR-10 | PRD §10, "Stage 4's undetermined share" (`95bccc4`), the same in `document-run-counts-after-2.5b`, `-2.5c` and `-2.5d.json` |
| +2.967 pp | FR-11 | already in §10 ("Stage 5 is not kept"); nothing moved |
| 420 companies, six bands pass, lowest 5.0 pp, 2026-11-07, not rerun | FR-13 | PRD §10, "Within-band spread" (`e266990`); `analysis/output/fingerprint-spread-62100.md` |
| 88 % (spike, 2026-09-26) | FR-28 | PRD §10, reconciliation-rate bullet, with its date (`90b2ab3`) |
| 1 837 of 1 946 after 2.5c; `lonnskostnad` 1 602, `avskrivninger` 1 403 | FR-28 | the same bullet, beside its after-2.3b measurement (1 834 of 1 946), which stays |
| about 8 400 companies, 33 000 documents, 190 hours | FR-28 | technical note, "Every filed document of 2021–2025 is fetched and read" (8 400 added; the others were there) |
| story numbers, dates, decisions, code and test names | the 13 FRs | the PRD memlog, one `(change)` line per FR |

The check: a scratch script, `numcheck.py`, outside the repository. It counts every date, every number of two or more digits and every number before %, pp or "of" in `prd.md` before and after. It looks each lost one up in PRD §10, the technical note, the PRD memlog and `analysis/output/`. Every step reported `MISSING: 0`, and so did the whole job (23 distinct numbers, 29 occurrences). The outputs were shown to Meinich before each commit.

## What came back, and what was done with it

- **Corrected by Meinich:** numcheck's first version counted only numbers of three or more digits or with a decimal, so "41 %" in FR-10 passed unchecked. It was widened, and FR-10's cut rerun: `MISSING: 0`, "41 %" found in §10.
- **Corrected by Meinich, from the review session's reading of the dumps:** the BMAD session's FR-28 move replaced §10's after-2.3b measurement with the after-2.5c counts. Both now stand, because a measurement's date does not disappear either. The review session checked that 400 and 165 are in all three run-counts files, and that 1 834 is in `after-2.3b.json`.
- **Already done when it was asked for again:** Meinich's second message asked for the after-2.5d sentence and the widened check on FR-10. The sentence was already in `95bccc4`. Only the check's output had not been shown, and it was shown then.
- **Stopped and asked (rule 4):** four points went to Meinich. FR-6's `[NOTE FOR PM]` moved to §11 as question 27, and FR-56 kept two consequences, each tested on its own. FR-65's pointer to `docs/data-sources-brreg.md` stayed, and `epics.md`'s `signals()` came out.
- **The BMAD session's own errors, caught before commit or fixed at once:**
  - FR-28's draft wrote "the demo companies" for "demo A and B and their candidate pools". That would have included C, so it was reverted before it was shown.
  - FR-56's draft added "the page itself never scrolls horizontally", which would have been a new requirement, so it was taken out.
  - Two backslashes reached the FR-28 memlog line through a shell escape (`2b6eaec`).
  - FR-6's memlog line about question 27 was first not written, because a script patch did not apply. The check caught it before commit.
- **Rule 5:** no active document referred to text that left. Only the PRD's dated review reports (`review-*.md`) quote old wording, and they are history.

## Links

- Epic 3 retro (action 3, and Epic 2 action 11 in its follow-through): `_bmad-output/implementation-artifacts/epic-3-retro-2026-11-22.md`
- Session file of the retro: `docs/ai-sessions/2026-11-22-epic-3-retrospective.md`
- Planning documents:
  - PRD and its `.memlog.md`;
  - technical note (`90b2ab3`);
  - `epics.md` (`225f998`);
  - `sprint-status.yaml` (`388d374`).
