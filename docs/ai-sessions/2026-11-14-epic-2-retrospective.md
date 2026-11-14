# Epic 2 retrospective

**Date:** 2026-11-14
**Tool:** Claude Code (Opus 5.5): the BMAD session (`bmad-retrospective`) and four read-only investigation subagents dispatched by it
**Story / issue:** planning, Epic 2 (stories 2.1a–2.9)
**Result:** commits `09c8e2a`, `860cfa5`, `9b5954e`, `ea68a7c`, `6e04f8c`, `ed5cbb8`, `9da6ed3`, `4ccd5fc` and `c680dde` on `main`; retrospective `_bmad-output/implementation-artifacts/epic-2-retro-2026-11-14.md`

## Goal

Run the Epic 2 retrospective. That meant checking the PRD, the technical note and `epics.md` against what Epic 2 built, and reporting the state of the lecturer's PRD feedback. It also meant giving the 21st exclusion a story, sourcing the recurring patterns, following up the Epic 1 action items, and setting action items for Epic 3.

## Prompts that mattered

Meinich, opening the session (verbatim):

> /bmad-retrospective Epic 2: Trust the peer group (stories 2.1a–2.9, alle done i sprint-status.yaml). Retrospektiven skrives til _bmad-output/implementation-artifacts/epic-2-retro-2026-11-14.md, som for Epic 1. Planleggingsdokumenter går rett på main i små commits, én per dokument eller tema. Ingen push før jeg sier fra.
>
> Den skal dekke dette:
>
> 1. PRD-en mot det Epic 2 bygde (AGENTS.md, «Each epic retrospective checks the PRD …»). Gå FR for FR gjennom FR-ene som epics.md sitt dekningskart gir Epic 2. Si for hver om PRD-en stemmer med koden, og rett avvik i PRD-en med en (change)-linje i .memlog.md. Gjør det samme for den tekniske notatet og epics.md der de er berørt.
>
> 2. Faglærerens tilbakemelding på PRD-en (_bmad-output/planning-artifacts/prds/prd-Peerless-2026-09-25/tilbakemelding-prd.md, Bård Pettersen, 48cc54a). Vis meg først en tabell over hvert punkt (4.1–4.4, kvalitetsfunnene i §5 og listen i §6): hva som allerede er gjort (med commit), og hva som gjenstår. 4.1, å skille krav fra byggehistorikk, gjenstår. Foreslå hvordan det gjøres, med FR-24 som i hans eksempel: regelen og 3–6 konsekvenser i PRD-en, og «hvem bestemte hva og når» flyttet til .memlog.md eller addendumet. Ikke skriv om PRD-en før jeg har godkjent forslaget.
>
> 3. Ekskludering nr. 21: legg den til som story i epics.md og i sprint-status.yaml (AGENTS.md, «Deferring v1 work that no story owns …»). Teksten under den deaktiverte knappen er godkjent: «Du kan ekskludere opptil 20 selskaper. Ta med et selskap igjen for å ekskludere et annet.» (deferred-work.md). Foreslå hvilken epic den hører til.
>
> 4. Funn som gjentar seg, med kilde (commit, PR-review eller session-fil): […]
>
> 5. Oppfølging av handlingspunktene fra Epic 1-retroen: hvilke er gjort, og hvilke står åpne.
>
> 6. Handlingspunkter for Epic 3, hver med eier og hvor det skal skrives inn (AGENTS.md, spec-mal, epics.md).
>
> Regler: ingen klassifisering eller fingeravtrykk per orgnr for de 845 selskapene i fasitsettet, bare totaler. Ingen kode endres. pnpm classify kjøres ikke, og ingen dump slettes. Stopp og vis meg tabellen fra punkt 2 og forslaget til 4.1 før du skriver om PRD-en, og vis retrospektiven før den committes.

Meinich, deciding the open questions (verbatim):

> Fra meg:
> 1. 4.1: skriv om FR-1, FR-24, FR-58 og FR-73 nå (Bårds egne eksempler), med FR-24 som mønster: regelen og 3–6 konsekvenser, og historikken flyttet til .memlog.md eller addendumet. Resten av FR-ene blir et eget handlingspunkt med frist før Epic 5.
> 2. §0: behold rekkefølgen, men skriv at uenighet er en feil som rettes i samme PR (AGENTS.md, «A decision travels upstream»), ikke en regel man kan lene seg på. AGENTS.md endres ikke.
> 3. Ja, ta med de små punktene: minimumslisten i 4.2, konsekvenser for FR-46 og de andre FR-ene for stage 2 i 4.3, fjern notatene for FR-16 og FR-27 (Q24 og FR-27 er avgjort), filstiene ut av glossaret, «Around a dozen», og antagelsene i §12.
> 4. Én story, «2.10 Epic 2 follow-ups», i Epic 2: R2 og R3 (W1), ekskludering nr. 21 med den godkjente teksten (W2), handlingspunkt 5 (punkt 6 fra Epic 1 og kommentarene fra B4) og handlingspunkt 9 (--workers=1 og gjenopprettingen). Epic 2 står som in-progress til den er merget.
> 5. Ja, skriv statusene fra Epic 1 slik tabellen foreslår.
> 6. Ja. Godkjent retro med vurderingen accepted-with-open-items. Rett D1–D11, B4 og B5 med én commit per dokument på main, og oppdater retroen med svarene over. Handlingspunkt 8 er review-sesjonens ansvar.
>
> Vis meg diffen for PRD-en (FR-1, FR-24, FR-58, FR-73 og §0) før den committes. Ingen push før jeg sier fra.

Meinich, on the 4.1 diff (verbatim):

> Fra meg:
> Godkjent, med to krav:
> 1. FR-58 sier at hver vei inn står i AD-15, men det gjør den ikke i dag. Flytt hele listen over det som fortsatt ikke er voktet inn i AD-15 i det tekniske notatet, i commiten for D10 eller før FR-58 committes, så ingenting forsvinner: feillesning med samme bredde (8 lest som 3) i salgsinntekt, leverandorgjeld eller en kostnadslinje i en kolonne der ikke alle hovedlinjene er lest; kundefordringer eller bankinnskudd for fjoråret; og de to sammen over delsummen mens hver for seg er under. Ta med fila for lisensporten (docs/licence-gate.json med {open, assessment, date}), som du sa.
> 2. FR-73: legg begge tilbake som et halvt punkt under konsekvens 4: at README-en sier hva pnpm seed:full bygger, og at klassifiseringene kommer fra den committede seeden og nye bare fra pnpm classify.
> FR-24-teksten er Bårds eksempel, og den godkjenner jeg nå. Skriv det slik i memlog. Fortsett så med resten, én commit per dokument. Ingen push.

## What came back, and what was done with it

- **The investigations.** Four read-only subagents covered:
  - the PRD FR by FR;
  - the lecturer's feedback;
  - the recurring patterns and the Epic 1 follow-through;
  - the cross-story boundaries.

  The BMAD session checked each claim against its primary source before it went into the retro, among them the commit hashes, FR-24's lines, the word count, `peers.ts:308-316`, `fingerprint.ts:264-265`, `derive.ts:116-117` and the measured numbers. No per-orgnr result for the labelled set was used.
- **Found against the BMAD session itself (W1).** `deferred-work.md` gave Story 2.9 two copy gaps from the Epic 1 retro, R2 and R3. The session did not read the ledger for entries naming the story while planning, so PR #61 merged without them. The patterns subagent found it. The fixes are a new AGENTS.md rule and Story 2.10.
- **Corrected by Meinich:**
  - FR-58 pointed to AD-15 for the unguarded paths, which AD-15 did not hold; the paths were moved in `9b5954e` before the FR-58 commit.
  - FR-73 lost two requirements in the first rewrite; they were put back as a half-point.
- **Changed by the BMAD session:** the FR-24 title stayed "Same basis for subject and peers", as `docs/key-figures.md` and `epics.md` name the rule; this was said at the diff. The script for the PRD's §11 inserted question 25 in the wrong section on its first run; the session caught it before anything was written.
- **Not done here:**
  - `pnpm analysis:spread` was not rerun on the labelled set's fingerprints (D2 is corrected in words).
  - No code was changed.
  - `sprint_status.py` rewrote `last_updated` in its own MM-DD format.

## Links

- Retrospective: `_bmad-output/implementation-artifacts/epic-2-retro-2026-11-14.md`
- The lecturer's feedback: `_bmad-output/planning-artifacts/prds/prd-Peerless-2026-09-25/tilbakemelding-prd.md`
- Planning documents updated: PRD and `.memlog.md`, technical note (AD-15, AD-16, stages 4–5), `epics.md` (Story 2.10, the coverage map, Stories 3.1a and 3.5), AGENTS.md, `deferred-work.md`, `sprint-status.yaml`
