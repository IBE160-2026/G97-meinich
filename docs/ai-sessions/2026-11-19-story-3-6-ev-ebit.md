# Story 3.6: EV/EBIT, what the uplift is worth

**Date:** 2026-11-19 to 2026-11-20
**Tool:** Claude Code (Opus 5.5), running `bmad-build`.
- **Subagents dispatched by the BMAD session:**
  - one recompiled the epic context;
  - one implemented the story and, re-engaged, the review fixes;
  - the three review layers ran as subagents too.
- **Prompts:** as in Story 3.5, the prompts headed "Fra meg" were written by the review session, a separate Claude session, and pasted in by Meinich. What they added beyond the BMAD session's checkpoint recommendations is credited to the review session below. Every decision is Meinich's.

**Story / issue:** [#79](https://github.com/IBE160-2026/G97-meinich/issues/79), Story 3.6 (FR-32, FR-55)
**Result:**
- **Spec:** ready for dev at `01b4083`; in progress, with the report's contents, at `ec492d4`; in review with the story in review at `b477b84`. The spec stays `in-review` until the PR is merged.
- **Implementation:** `cdd6553` to `fcedd8f` (7 commits).
- **Review triage:** `e476ed2`; outcomes `2e1440b`.
- **Review fixes:** `df283ce`, `eb694ae` and `8f51267` (the implementation subagent); `571240e` (the BMAD session, two e2e reads found by the full verification run).
- **Error text after review:** `cb187e1`.
- **AI log:** the entry with the implementation (`fcedd8f`), its review outcome `fbb9088`.
- **Planning:** the epic context `a29fc4d`; the planning documents `fcedd8f`, DESIGN.md `eb694ae`.
- **PR:** opened when Meinich says so.

## Goal

On the Verdi tab:
- a field "EV/EBIT-multippel", empty by default and suggesting nothing;
- a card "Økt selskapsverdi" = round(exact profit uplift at the current share × m), computed in the browser by one engine function built on `profitAtShare`, from Story 3.5's wire values, with a product line and "≈" by an exact rule;
- `multippel` written through the one URL hook with the same `replaceState` as `andel`;
- a type that makes it impossible for any code path to produce a multiple.

## Prompts that mattered

- **The opening prompt** asked for a checkpoint before any code change, on ten points:
  - (a) deferred work, confirmed by a search of its own;
  - (b) the engine function, built on `profitAtShare`, with a test against full × s_med × m and an NDC probe;
  - (c) the "≈" rule;
  - (d) the URL and `replaceState`;
  - (e) the field's input rules and its look on reload;
  - (f) the disabled field;
  - (g) a test that no code path makes a multiple, "a grep for numbers is not enough";
  - (h) the wire, the payload and the identity test;
  - (i) phone width and accessibility;
  - (j) new copy.

  Its rules added to Story 3.5's: search every read after a `replaceState` change, not only the failing one (PR #78); run `pnpm restore:documents` after the last seed; and state what can go wrong with a user-entered multiple applied to money.
- **Meinich's checkpoint decisions** (spec, decisions 1–9):
  1. "≈" replaces "=" ("1 000 kr × 7 ≈ 6 997 kr"). "prefixed" is corrected in EXPERIENCE:202, UX-DR28 and Story 3.6's acceptance criterion, with `(change)` lines in the memlogs.
  2. E1 and E3 approved; E3 stands under the product line.
  3. A valid multiple stays in the URL and shows read-only in a disabled field.
  4. The disabled field's reason is the profit card's own words, with no new copy.
  5. Confirmed: `valueAtShare` with the role `'value'` and three probes; `replaceSettings` and `test/one-replace-state.test.ts`; `trim()` before `parseMultippel`; the type `Multiple` and `test/no-multiple-source.test.ts`; the identity test with the 999,5 kr wire; `formatMultiple` in `src/engine/format.ts`.
- **The review session's prompts added,** beyond the BMAD session's recommendations:
  - **(c):** the "≈" rule itself: the exact product of the displayed uplift in whole kroner and m, compared with round(exact uplift × m), which the BMAD session adopted as decision 3.
  - **(a):** that the review session had found no deferred entry, to be confirmed by a search of the BMAD session's own.
  - **The implementation report's list:** 6 996 kr instead of 6 997 kr; the "≈" test and `wholeKroner` at a half krone; each `'value'` probe; one extra `replaceState`; both multiple-source probes; the identity test with one side's formatting changed; the e2e reads after `replaceSettings` and what the search found; the four restore counts and zero synthetic remains; 375 and 320 px.
  - **The new error text** (2026-11-20), after Blind Hunter raised the old one.
  - **After a run stopped on memory:** run the chain step by step with a memory check before each, `pnpm test` with `--maxWorkers=2` (and `--maxWorkers=1` once if that stops), compare the test counts per step with the counts before the fixes and explain each change, and commit the AI-log update on its own before this file.

## What came back, and what was done with it

- **Accepted** (the implementation report removed each guard; each named test failed, and each removal was undone):
  - `valueAtShare` as full × s_med × m: "6 996 kr" instead of "6 997 kr" (`test/engine/closable.test.ts`).
  - The "≈" rule reversed: `verdi-view.test.ts` receives "585 000 kr × 6,5 ≈ 3 802 500 kr". `wholeKroner` rounding half to even: "0 kr" instead of "1 kr" at 50 øre.
  - Each of the three `'value'` probes fails with its check removed.
  - A second `history.replaceState` in `verdi-panel.tsx` fails `test/one-replace-state.test.ts`; an added `as Multiple` and `parseMultippel('6')` fail `test/no-multiple-source.test.ts`.
  - The identity test fails when the multiple's text changes in the browser bundle only.
  - The payload scan is unchanged (`git diff ec492d4 -- e2e/payload.ts` is empty), and Verdi with `?multippel=6.5` carries exactly 3.5's wire set.
- **Caught by the implementation run itself:**
  - "No displayed total adds two cards" found EV at the median step (13 000 kr at m = 6,5) equal to profit + working capital at full convergence by chance; the test runs at 6,7.
  - `toBeDisabled` counts `aria-disabled`; the synthetic test now checks that the native `disabled` attribute is absent.
- **Corrected by review** (spec, Review Triage Log, 24 rows):
  - **The field's committed value lived only in a prop** (Blind Hunter, Edge Case Hunter): Enter followed at once by a blur wrote and announced twice, and a multiple changed from outside the field left it showing another value than the card. Now a ref; the e2e test "EV: Enter and an immediate blur are one entry" fails on the pre-fix field.
  - **A second, different invalid entry announced nothing** (Edge Case Hunter), against decision 6. "EV: two different invalid entries announce twice, the same one twice announces once" fails on the pre-fix field.
  - **The two source scans were syntactic** (Edge Case Hunter, Blind Hunter; the `as AnalysisState` cast from the BMAD session's own reading of the diff). Both now use the type checker, with a probe for each bypass.
  - **Untested paths** (Verification Gap, Blind Hunter): a multiple entered from a URL holding `band` and `andel`, the field's recovery from an error, the announcements after the accepted forms, the "=" line in a browser, and a peer change with a multiple. Each now has an e2e test.
  - **The disabled field's tokens** (Blind Hunter): `bg-surface text-disabled-text`, as DESIGN reserves for disabled controls; DESIGN.md now describes the field's disabled state and the EV section.
- **Found by the BMAD session's full verification run** (after the review fixes): two EV e2e reads did not wait for the field's announcement, which comes 50 ms after the value renders. The accepted-forms loop cancelled two announcements by typing on, and the reload test's `before` held the announcement or not depending on timing. Both now wait (`571240e`). A search of every announcement and `innerText()` read in the two specs found no other.
- **Rejected** (spec, Review Triage Log): an invalid `multippel` loaded from the URL staying in the address bar when the field is cleared; the field's status region keeping its last sentence after a share change; Decimal precision 40 before the display rounding; the signature of `productIsApproximate`; the move from m = 6,5 to 6,7.
- **The error text, changed after review** (`cb187e1`): Blind Hunter raised that "… for eksempel 6 eller 6,5" can read as a suggested multiple; it was Story 3.6's and EXPERIENCE's copy, verbatim, so the BMAD session left it for Meinich. The review session proposed "Skriv inn et tall større enn 0 og høyst 50, med høyst én desimal", which names no multiple (FR-32) and says why 6,55 is refused; Meinich decided it on 2026-11-20 (spec, Spec Change Log). Checked by `test/messages.test.ts` (182 passed), typecheck and `e2e/verdi.spec.ts` (24 passed) after a rebuild.

## Verification

Run step by step after the review fixes, with free memory checked before each step (1,3–3,1 GB). The first full run stopped on low memory during `pnpm test` and was not restarted until Meinich said how.

| Step | Before the fixes | After | Why |
|---|---|---|---|
| `pnpm test` (`--maxWorkers=2`) | 1 895 | 1 895 | The fixes added probes inside existing tests, not new tests (the four changed files have the same number of `it`s) |
| `pnpm test:db` | 200 | 200 | No change in `test/db` |
| `pnpm test:ingest` | 392 | 392 | No change in `ingest/` |
| e2e `chromium` | 181 | 187 | Six P1 tests: band and share kept; error to value and to empty; two invalid entries; Enter and an immediate blur; m = 1 gives "="; a peer change keeps the multiple |
| e2e `db-down` | 7 | 7 | No change |
| e2e `synthetic --no-deps` | 25 | 25 | No change; "EV disabled below the floor" was already in it |

- **The first chromium run** after the fixes failed two tests (the early reads above); after `571240e`, 187 passed.
- **`pnpm build`:** stopped on `SecurityFatalError` on the first attempt and passed on the second (#71); no upgrade. `pnpm check:routes` is clean.
- **After `pnpm restore:documents`:** documents 2785, columns 5556, fingerprints 2537, classification rows 10371.
- **Remains:** 0 SYNTETISK companies, 20 entries in the manifest's `document_figure_orgnrs`, and no change under `seed/`.
- **Phone:** the field (90 px wide, at least 24 px high), the value with its product line and the error at 375 and 320 px, with no sideways scroll (`e2e/verdi.spec.ts` "at 375 px" and "at 320 px").

## Links

- AI log: "2026-11-19 — Story 3.6: EV/EBIT, a user-entered multiple applied to money".
- Spec: `_bmad-output/implementation-artifacts/spec-3-6-ev-ebit-what-the-uplift-is-worth.md`, decisions 1–9 and the Review Triage Log.
- Planning documents: EXPERIENCE.md and DESIGN.md with `(change)` lines in the UX memlog; `epics.md` (UX-DR28 and Story 3.6's acceptance criteria; it has no memlog); `docs/key-figures.md`; the technical note; AGENTS.md. The PRD is not affected.
