---
title: 'Story 2.10: Epic 2 follow-ups'
type: 'feature'
created: '2026-11-14'
status: 'in-progress'
baseline_commit: 'b5e43dd0f2af6f7de3288ea6bba5a1bc418fb3e5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/key-figures.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 2 left gaps open (issue #62; FR-7, FR-8, FR-17, FR-73). A subject with no stated revenue is told it "har ingen positiv omsetning" (R2). An empty stage 2 caused by the subject's own fields shows a bare "Fant ingen …" (R3). A 21st exclusion is blamed on the link. The code has two `SubjectFiling` types, seven API columns listed in about six places, and stale "after stage 4" comments. And `--workers=1` and the dump restore live only in prompts.

**Approach:** Add `EmptyReason` values set by the engine and rendered by one exhaustive switch. Make "Ekskluder" `aria-disabled` at `MAX_EKSKL`. Do the refactoring in commits of its own, with no behaviour change. Pin e2e to one worker. Add a `pnpm` restore command that ends in `pnpm derive` and prints four counts.

**Decisions (Meinich, 2026-11-14):**
1. **Reasons.** `EmptyReason` gains `subject_revenue_not_stated` (stated `sumDriftsinntekter` null), and four stage-2 reasons. Each stage-2 reason is set only when stage 1 > 0 and stage 2 = 0, from the subject's fields, in this order:
   - `subject_field_not_stated`: the first null of `valuta`, `regnskapsregler`, `smaaForetak`, `avviklingsregnskap`.
   - `subject_currency`: any `valuta` other than NOK. This covers codes not in ISO 4217 too; there is no separate unknown-currency reason.
   - `subject_not_comparable`: any other empty stage 2, such as a stated field no candidate shares. An empty group never stands without a reason.
   The order of all reasons is no revenue → revenue not stated → non-calendar → the stage-2 reasons.
2. **Funnel.** With a stage-2 reason, the Peers tab shows the sentence together with the funnel. A subject that cannot have peers (no revenue, not stated, non-calendar) keeps sentence-only, with no funnel.
3. **Rename.** The engine's `SubjectFiling` becomes `FunnelSubject`, and the alias in `view.ts` goes. Test import lines may change, and the test title `test/analysis/shown-group.test.ts:60` becomes "… after stages 4 and 5 …". No assertion changes.
4. **Workers.** `workers: 1` in `playwright.config.ts`, locally and on CI; the README says why (the low-memory stops in 2.7 and 2.8). CI time is measured after the first push and written in the PR (today: e2e about 3 m 16 s, whole run about 8 m 53 s, run 43585950193).
5. **Copy (approved):**
   - `peers.revenueNotStated`: "Peerless finner sammenlignbare selskaper ut fra omsetning, og regnskapet for {aar} oppgir ikke omsetningen."
   - `peers.fieldNotStated`: "Regnskapet for {aar} oppgir ikke {felt}, og Peerless sammenligner bare regnskap der dette er oppgitt." The field names are `peers.field.valuta` "valuta", `.regnskapsregler` "regnskapsregler", `.smaaForetak` "om selskapet er et lite foretak" and `.avviklingsregnskap` "om regnskapet er et avviklingsregnskap".
   - `peers.currency`: "Regnskapet for {aar} er ført i {valuta}, og ingen selskaper i samme næring og størrelse fører regnskap i {valuta}."
   - `peers.notComparable`: "Ingen selskaper i samme næring og størrelse fører regnskapet etter de samme reglene som regnskapet for {aar}."
   - `peers.exclusionCap`: the cap text above, verbatim.
   The field-not-stated reasons are tested with synthetic subjects, because the seed has none.
6. **Restore.** `pnpm restore:documents [dir]` restores `.local/document-run-2.5d/` by default.
   - It takes each table's column names from the first line of its CSV, as the README does today, so older dumps restore too.
   - It writes as `loader` in one transaction and refuses any host but localhost or 127.0.0.1. It never deletes a file.
   - If the default directory is missing (a fresh clone), it says so, restores nothing, does not run derive and exits 0. A named directory that is missing exits 1.
   - If a dump key is already stored, it rolls back, says to run `pnpm seed` first and exits 1.
   - After a restore it runs `pnpm derive`, then prints the counts of documents, columns, fingerprints and classification rows.

## Boundaries & Constraints

**Always:**
- Neither the stage-2 filter (`isComparable`) nor the rule "not stated → no size band" (`docs/key-figures.md:159`) changes.
- The cap text goes into `nb.json` verbatim: "Du kan ekskludere opptil 20 selskaper. Ta med et selskap igjen for å ekskludere et annet." A test checks it verbatim. No agent rewrites approved copy.
- All other new copy is shown to Meinich before it goes into `nb.json` or EXPERIENCE.
- Test data comes from demo A, demo B or synthetic companies. Tests on other subjects compare totals only and name no labelled-set company.
- Refactoring commits change no behaviour, and the existing tests' assertions are unchanged.
- The restore command never deletes a file and refuses any host but `localhost`/`127.0.0.1`.

**Never:** run `pnpm classify`; delete a dump; push before Meinich says so; add `aria-disabled` anywhere but the exclude button; deduplicate the benchmark-filing order (a separate deferred entry, not this story).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails if the code is removed |
|---|---|---|---|
| R2 not stated | subject `sumDriftsinntekter` null | `emptyReason` `subject_revenue_not_stated`; hero and Peers tab show `peers.revenueNotStated`, never `peers.noRevenue` | `test/engine/peers.test.ts` "a subject with no stated revenue …"; `test/analysis/oversikt-hero.test.ts` "no stated revenue …"; `e2e/peers.spec.ts` null case |
| R2 zero/negative | `0n` / `< 0n` | unchanged `subject_no_revenue` | existing `peers.test.ts` it.each |
| R3 field not stated | subject `valuta`/`regnskapsregler`/`smaaForetak`/`avviklingsregnskap` null, stage 1 > 0 | `subject_field_not_stated` with the first missing field in that order | `peers.test.ts` one case per field |
| R3 currency | `valuta` ≠ NOK (known or not ISO 4217), stage 2 empty | `subject_currency`; sentence names the `valuta` | `peers.test.ts` (USD and an unknown code); `test/analysis/peer-list.test.ts` |
| R3 other | all fields stated, NOK, stage 2 empty (e.g. IFRS subject, no IFRS candidate) | `subject_not_comparable`; sentence and funnel | `peers.test.ts`; `peer-list.test.ts` |
| R3 not empty | NOK subject with a stage-2 match | `emptyReason` null | existing `peers.test.ts` |
| Order | several apply | no revenue → not stated → non-calendar → R3 | `peers.test.ts` precedence case |
| Cap reached | 20 in `ekskl` | every non-excluded "Ekskluder" is `aria-disabled="true"`, focusable, `aria-describedby` → the cap text; a press pushes nothing; no notice | `e2e/peer-adjust.spec.ts` "with 20 exclusions …"; `test/analysis/peer-list.test.ts` cap render |
| Below cap | 19 in `ekskl` | buttons enabled; a press pushes | same e2e (19 → 20 step) |
| Restore, dump present | local DB after `pnpm seed` | columns from each CSV's header; rows copied as `loader` in one transaction; `pnpm derive` runs; prints documents, columns, fingerprints, classification rows | `test/restore-documents.test.ts` |
| Restore, no dump | default dir missing (fresh clone) / named dir missing | says so, restores nothing, no derive; exit 0 / exit 1 | `test/restore-documents.test.ts` |
| Restore, remote host | `LOADER_DATABASE_URL` host not local | refuses, exit 1, nothing written | `test/restore-documents.test.ts` |
| Restore, already restored | dump key already stored | rolls back, says run `pnpm seed` first, exit 1 | `test/restore-documents.test.ts` |

</frozen-after-approval>

## Code Map

- `src/engine/peers.ts:108-114,324-326` -- `EmptyReason` and where it is set; `isComparable` :198-211 unchanged; comments :1,:4 (stage 4 → 4 and 5).
- `src/components/analysis/peer-list.tsx:52-56` -- `emptyText`: becomes an exhaustive switch (no default) and takes `valuta` and the missing field; feeds hero (`oversikt-hero.tsx:54-60`) and Peers tab.
- `src/analysis/view.ts:145-163` -- `funnelSubject` passes stated revenue only; keep.
- `src/components/analysis/peer-list.tsx:217-245` -- where a reason hides the funnel today; a stage-2 reason keeps it (decision 2).
- `src/components/analysis/peer-action.tsx:12-44` -- the button; add `capReached`; header comment.
- `src/components/analysis/peer-list.tsx:113,237`, `peer-card.tsx:112`, `analysis-page.tsx:220` -- thread the count; render the cap text once with a fixed id (pattern: `size-band.tsx:21,75,109`).
- `src/components/analysis/peer-change.tsx:96-112` -- `change`: also refuses an exclude at `MAX_EKSKL` (defence in depth).
- `src/engine/inputs.ts:33-77` -- add `API_KEY_FIGURE_COLUMNS` (as const) and `ApiKeyFiguresRow`; reuse in `view.ts:72-81` (`SubjectKeyFigures` becomes an alias), `src/server/analysis.ts:87-93,139-147,225-231,253-259,301-309`. Leave `e2e/seed.ts` and `e2e/synthetic.ts` (independent oracle and fixture).
- `src/engine/orgnr.ts:41`, `src/url/analysis-state.ts:97-99,163` -- export `compactOrgnr` (`/\s/g`), use it in both; keep the `length` check :164.
- `src/analysis/shown-group.ts:5,7,51`, `analysis-page.tsx:110-111`, `e2e/seed.ts:185` -- comments only; test title `test/analysis/shown-group.test.ts:60` → "after stages 4 and 5".
- `playwright.config.ts`, `package.json:17`, `README.md:136-211`, `.github/workflows/ci.yml:129` -- workers and restore.
- `scripts/restore-documents.ts` (new), `package.json` `restore:documents` -- `.local/document-run-2.5d/{document,document_column}.csv` via `COPY … FROM STDIN` as `loader`; host check like `e2e/synthetic.ts:43-45`.
- `src/messages/nb.json:64-66,99-106` -- new keys.

## Tasks & Acceptance

**Execution:**
- [ ] `src/engine/peers.ts`, `test/engine/peers.test.ts` -- new reasons + tests (commit 1).
- [ ] `peer-list.tsx`, `oversikt-hero.tsx`, `nb.json`, tests -- copy and exhaustive switch (commit 2).
- [ ] `peer-action.tsx`, `peer-list.tsx`, `peer-card.tsx`, `peer-change.tsx`, `nb.json`, tests, `e2e/peer-adjust.spec.ts` -- cap (commit 3–4).
- [ ] refactor: columns (5), `SubjectFiling` (6), `compactOrgnr` (7), comments (8) -- each alone, suite green, existing assertions untouched.
- [ ] `playwright.config.ts`, README -- one worker (9).
- [ ] `scripts/restore-documents.ts`, `test/restore-documents.test.ts`, `package.json`, README -- restore (10).
- [ ] EXPERIENCE.md, PRD (FR-7, FR-8, FR-17, FR-73 + `.memlog.md`), AGENTS.md, `deferred-work.md` (resolved lines), `docs/ai-log.md` -- docs (11).

**Acceptance Criteria:**
- Given the PR, when opened, then it lists what could go wrong, has "Planning documents:", and `docs/ai-log.md` holds the reasoning.
- Given the phone widths, when the Peers tab with the cap and an R3 sentence renders at 375 and 320 px, then the body does not scroll horizontally.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db` -- green.
- `pnpm build && pnpm test:e2e` (one worker) -- green; on a memory stop, report, do not restart.
- After the last `pnpm seed`: `pnpm restore:documents` -- 2 785 documents, 5 556 columns, 2 537 fingerprints, 10 371 classification rows.
