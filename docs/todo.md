# To-do — Peerless

Open work that is decided but not yet done. Tick items off here, and move any decision they produce into the brief, the technical note or `AGENTS.md`.

## Manual work (calendar time, start early)

- [ ] **Score business descriptions by hand.** 50 randomly sampled companies each from 62.100 and 69.202, one question per company: does the description distinguish this company from others with the same code? (yes/no, plus a short business-type label). Sample with a fixed seed and hide the word-list score while scoring, so the proxy does not colour the answers. Turns the 38–56 % estimate in `analysis/output/industry-screening.md` into a measurement. About 30–45 minutes.
- [ ] **Build the labelled peer set.** For a selection of subject companies, judge which candidates from the same industry and size band are genuine peers — blind to which funnel stage proposed each candidate, so the labels are not coloured by the method being tested. This is the ground truth the project's main result is measured against. Stratify by description quality (from the item above). Needs candidate lists from the engine first; runs alongside the code through week 9.
- [ ] **Hand-transcribe the OCR reference set.** Every figure in the generated section for 15–20 filings spread over 2011–2025, to measure exact accuracy. Consistency is already measured (`analysis/output/ocr-consistency.md`); this is what turns it into accuracy.

## Decisions still open

- [x] **Define the key figures.** For each of the ten or so measures: formula, source (key figures API or OCR), and what happens when a component is missing. Includes what the valuation multiple applies to — EBIT is available from the API, EBITDA needs depreciation from OCR. → `docs/key-figures.md`
- [ ] **Confirm the fingerprint features**, including cost of goods and personnel cost share in bands (proposed) or not at all. Check against the labelled set whether the bands blur the benchmark.
- [x] **Set the minimum group size.** The screening used 10 as a placeholder. → 10 peers, per key figure
- [x] **Check the course requirements** for fixed user roles, since the access model now uses workspace roles (owner/viewer), and for which BMAD artifacts (PRD, UX, epics and stories) are expected before coding. → No fixed roles required. Nothing must be delivered before coding, but the BMAD requirements must be met. The product brief is due 2026-09-27. Solo project.

## Before the first line of code

- [ ] Choose package manager and test frameworks (e.g. pnpm, Vitest for the engine, Playwright end to end).
- [ ] Set up Supabase CLI locally with migrations in the repo, so RLS policies are tested as SQL against a real database.
- [ ] Settle the money type (integer øre, `bigint`) and record it in `AGENTS.md`.
- [ ] GitHub Actions running typecheck and tests on every push.
- [ ] Supabase project in an EU region; anonymous sign-in, CAPTCHA and magic link enabled; a short privacy notice.
- [x] Extend the OCR spike to the older paper-form scans (week 1 in the schedule). → Paper filings are rare and never read; about 88 % of 2021–2025 columns reconcile; five years of development over time in v1.
- [ ] Confirm the OCR field names in `docs/key-figures.md` against the Brreg-generated section of a real filing.
