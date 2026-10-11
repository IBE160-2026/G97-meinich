---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Peerless-2026-09-25/prd.md
  - _bmad-output/planning-artifacts/technical-note-architecture.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/EXPERIENCE.md
  - docs/key-figures.md
  - AGENTS.md
  - _bmad-output/planning-artifacts/architecture/architecture-Peerless-2026-10-10/.memlog.md
---

# Peerless - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Peerless, decomposing the requirements from the PRD, the UX design (DESIGN.md, EXPERIENCE.md) and the technical note's architecture invariants into implementable stories.

## Requirements Inventory

### Functional Requirements

PRD ids are kept (FR numbers are stable; out-of-order ids are as in the PRD). Stage tags mirror each FR heading; "Stage split" mirrors the PRD's own split bullet.

**v1**

- FR-1: One search field accepts a company name or an organisation number; nine digits → exact orgnr match, else fuzzy name match; searches Peerless's own database only (never the register live); each result shows name, orgnr, primary industry, municipality; never filters on financial criteria; choosing a result resolves on orgnr; malformed input or no match gives a clear message, never an empty analysis.
- FR-2: The subject is shown with registered name, orgnr, primary industry code and the analysed accounting year, the year taken from the returned `regnskapsperiode`/filing `id`, never the requested `år`; a renamed company still resolves to one company.
- FR-3: Only a subject whose `naeringskode1.kode` is in a covered industry gets a peer analysis; an industry is covered only once extracted, reconciled and measured against a labelled set; SN2025 codes only (SN2007 returns nothing). Stage split: v1 covers `62.100` only; `69.202` and `43.210` are stage 3.
- FR-4: A subject outside a covered industry shows only the three API-sourced figures (operating margin, return on assets, equity ratio) from the latest year plus a plain statement naming its industry as not yet covered; no peer group, median, quartile, percentile or kroner; an orgnr not in the database shows "Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi programmeringstjenester (62.100)." with links to demo companies A and B; demonstrated by demo company C (`69.202`); no live register call.
- FR-6: The open route is rate-limited per IP with an in-memory counter in the single local server process, storing no IP; exceeding the limit returns a refusal, never a partial analysis. Stage split: per-IP limit is v1; per-session limit and CAPTCHA are stage 2.
- FR-7: Funnel stage 1 (rules) filters on `naeringskode1.kode` and a size band of `sumDriftsinntekter` from the same filing, default 0.5–2× the subject's; never `sumEiendeler` or the register's employee count.
- FR-8: Funnel stage 2 (rules) hard-excludes any candidate not matching the subject on `valuta`, `regnskapsregler`, `smaaForetak`, `avviklingsregnskap`, financial period and `regnskapstype`; none loosenable; only calendar-year filings pass; `smaaForetak`/`regnskapsregler` read from the misspelled `regnkapsprinsipper`.
- FR-9: Funnel stage 3 (rules) is segmentation. Stage 1's size band (FR-7) is the only size step; stage 3 does not segment by size again. In v1 stage 3 is legal form only (`organisasjonsform`, `AS` only); geography is not used for `62.100` and is applied only for a later industry that calls for it (named to the user). A subject that is not an AS gets its own state, "Peerless sammenligner foreløpig bare aksjeselskaper", with no peer group. Each criterion is reported separately in the funnel counts.
- FR-10: Funnel stage 4 (rules) groups candidates by business-model fingerprint from their own accounts (cost-of-goods share, inventory, capitalised intangibles, fixed-asset intensity), separating reseller/product/consultancy; applies to every extracted company.
- FR-11: Funnel stage 5 (model) judges same-type-of-business from name, secondary industry codes, statement of purpose and description; answers only in fixed categories, never free text, never arithmetic.
- FR-12: A company with nothing to classify on is stored as unclassified, never inferred, and stays eligible through stages 1–4 with match basis *accounts alone* or *industry and size alone*.
- FR-13: No benchmarked measure is used for selection at exact value; no margin/return/productivity measure at all; cost-of-goods and personnel-cost shares only in coarse bands (proposed, confirmed or dropped against the labelled set); a per-industry test asserts non-trivial within-band spread of a banded figure (v1: `62.100`), and banding is dropped if spread collapses.
- FR-14: Where text and fingerprint disagree, the candidate is flagged (not resolved, model never adjudicates), stays in the group with its flag beside the match basis; the flagged count is shown with the funnel counts and identifiable in SM-1.
- FR-15: Each of the five funnel stages reports its surviving count, shown whether or not the group clears the minimum size.
- FR-16: Each peer is named and carries a rules-generated inclusion reason (from shared profile fields, never model-written) and exactly one of four match bases, in order: *description and accounts* / *accounts alone* / *description alone* (classified, no fingerprint because no reconciled accounts) / *industry and size alone*.
- FR-17: The user can exclude a peer for this analysis only (never changes stored data); the excluded peer stays visible as excluded and can be restored; everything recomputes. Stage split: v1 exclusion lives in the URL; saving it with the analysis is stage 2.
- FR-18: The user can loosen the size band in fixed single steps 0.5–2× → 0.33–3× → 0.25–4× (nothing wider); never a comparability field (test asserts no loosening admits a comparability failure); a loosened criterion is shown as loosened with updated counts. Stage split: v1 loosens the size band only and never offers comparability; loosening segmentation (legal form/geography) is stage 3.
- FR-19: Any peer-group change recomputes every key figure, aggregate, percentile and kroner amount immediately, with no stale value on screen; a figure can cross the minimum group size either way.
- FR-20: Peer group assembly returns in under one second, reading only stored key figures and profiles; no document fetched/OCR'd, no peer classified and no model call reachable from a request in v1.
- FR-70: A labelled set is built from week 1: 30 `62.100` subjects × 30 candidates drawn at random from the subject's size band (not funnel output), ~900 judgements; rubric written and dated before the fingerprint feature list is fixed; a blind (description/website-only) subsample; second labeller on ~50 pairs with Cohen's κ; stated pooling fallback; counts reported as achieved.
- FR-68: Description embeddings computed in batch only and used as one optional layer in the SM-1 ablation; never user-facing in v1, no peer reaches a group by embedding; the one v1 item that may be cut (last).
- FR-21: The engine computes and displays every key figure exactly as `docs/key-figures.md` defines; tests assert the two identities exactly (ROA = margin × revenue/assets; personnel cost share = cost per FTE ÷ revenue per FTE); total cost share is a check row; cash share is an unranked diagnostic with no kroner; amounts in øre, ratios in decimal, rounded only for display (% 1 dp, days whole, kroner whole).
- FR-22: No aggregate for a key figure unless ≥10 peers have a defined value for that figure (counted per figure); below the floor the row keeps the subject's own value and states "n of 10"; no kroner; synthetic cohorts at/below 10 assert nothing escapes.
- FR-23: A zero/negative denominator or an underivable missing component makes a figure undefined (never zero); missing components are first derived from stated totals; the company leaves only that figure's distribution; the left-out count is shown; nothing estimated or imputed.
- FR-24: A figure's comparison (median, favourable quartile, percentile, kroner) is shown only if computable for subject and ≥10 peers from the same source; otherwise the subject's own value stays with the reason, displayed as in FR-22.
- FR-25: The benchmark year is the subject's latest filed year; peers without a filing for that year are excluded.
- FR-26: Two decomposition views: margin vs capital efficiency, and pay level vs productivity (via the FR-21 identity). Stage split: both open in v1; behind the account wall from stage 2.
- FR-27: Each key figure shows subject value, peer median, favourable quartile (direction-aware) and percentile `(worse + 0.5 × equal)/peers × 100`; median always shown, never the kroner target; no-direction figures (revenue growth, personnel cost per FTE, equity ratio, cash share) get no favourable quartile and no percentile.
- FR-29: Each key figure with a kroner translation converts its gap exactly per `docs/key-figures.md`; only gaps worse than target produce kroner, otherwise shown as a strength; cost shares (3–5) have no kroner of their own.
- FR-30: No double counting, tested in two clusters: no cost share produces its own kroner and no total adds a margin-decomposition bar to annual profit uplift; the four decomposition bars sum exactly to (margin − peer-group-as-a-whole margin) × revenue and displayed bars (largest remainder) sum to the displayed total; decomposition not shown with <10 in the common set; never scaled by closable share; working capital released = receivable days + payable days only; operating-asset capital never summed with receivable days.
- FR-31: One closable-share control (0 to full convergence) live-recomputes four separate amounts (profit uplift, working capital released, operating-asset capital released, implied EV); target is always the favourable quartile; median marked on the control, never the target; no favourable quartile → no amount.
- FR-32: Implied EV = annual profit uplift × a user-entered EV/EBIT multiple; no default, field starts empty, EV hidden until entered; engine never looks up or suggests a multiple; based on API-sourced `driftsresultat`.
- FR-69: All visitor state — orgnr, active tab, excluded peers, size-band step, closable share, EV/EBIT multiple — lives in the URL, never the database or browser storage; refresh/bookmark/share reproduces the analysis; no anonymous write to any table. Stage split: holds for every visitor in v1; anonymous-session wording and write into a workspace on registration are stage 2.
- FR-52: Stored explanation text names the largest kroner gaps and strengths; persistence decided by the engine, never the model; every figure links to its calculation; generated and cached for the default peer group only; an adjusted group hides it with "Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den." and a reset action; no generation from any request. Stage split: v1 shows stored text (batch or test mode); regeneration for an adjusted group by a signed-in user is stage 2.
- FR-53: An automated test (never weakened) rejects generated text containing any figure absent from the engine output, or a present figure attached to the wrong figure/company/year/direction; parses Norwegian number formats (space/NBSP/narrow-space thousands, decimal comma, `kr` before/after, `%`); unparseable = fail; runs on stored fixtures in CI without a model key.
- FR-54: A recommending/imperative phrase list ("bør", "anbefaler", "må redusere", …) lives in one reviewable file; a hit at generation → regenerate; a hit at seed load → withheld and reported; before publishing the demo seed, 30 random stored explanations are read and recorded in `docs/ai-sessions/`, missed phrasing added to the list.
- FR-55: The interface reflows to one column down to ~375px; the page body never scrolls horizontally; checked at phone width during development.
- FR-56: Ratio tables, distribution plots and the peer list scroll horizontally inside their own containers.
- FR-57: Each filing carries a data quality flag derived only from the two reconciliation checks, never OCR confidence.
- FR-58: A figure is accepted only if it reconciles (within-document absolute bound of a few kroner; document-vs-API proportional tolerance; never collapsed, never exact equality); a failure blocks the filing; no caveated or substituted figure.
- FR-59: No document is fetched or OCR'd during a user request; all document-derived figures come from pre-warmed storage; a covered industry is fully pre-warmed before it is offered.
- FR-60: Every kroner amount traces to its key figure and on to the filed values; degraded filings are reported unavailable, never estimated.
- FR-71: When the subject's own filing fails reconciliation, the three API figures keep full comparison, the twelve document-dependent figures are absent with a stated reason, nothing estimated/substituted, and the subject is not demoted to uncovered.
- FR-64: Every figure and aggregate states its filing year and register read date; no freshness guarantee; manual batch refresh. Stage split: on-screen disclosure is v1; carrying it into PDF export and saved analyses (and saved-analysis exceptions) is stage 2.
- FR-65: Brønnøysundregistrene credited as source, processing by Peerless declared, no implied endorsement; prescribed NLOD 2.0 credit claimed for API-sourced data only; document-derived figures credited without asserting a licence; the two distinguished; reachable from every page (may live on "Slik fungerer Peerless").
- FR-66: A company the register answers `410 Gone` is deleted (not flagged) from stored register data and the seed by the ingestion job, and disappears from every peer group and later aggregate. Stage split: removal from stored data and seed is v1; removal from saved analyses is stage 2.
- FR-61: The front page holds a description, the name-or-orgnr search field, "Slik fungerer det" in three steps and a link to FR-72. Stage split: front page is v1; industry overviews are stage 3.
- FR-62: An analysis is organised in tabs. Stage split: v1 has four open tabs — overview, peers, key figures and gaps, value; *Utvikling* is stage 2.
- FR-72: Public page "Slik fungerer Peerless" in plain Norwegian: the five funnel stages without formulas; the two model uses and that the model never calculates (enforced by FR-53 test); measured results (SM-1, SM-2) only once they exist, otherwise "pending" with no placeholder figures; sources and FR-65 licence distinction incl. NLOD credit; known limitations (VAT on receivable days, `smaaForetak` coverage limit); reachable from every footer and the front page.
- FR-73: Runs from a fresh clone on local Supabase (Docker) with every table/policy/function as a migration; one-command idempotent seed (`pnpm seed`, demo, committed) with register data, API figures, stored classifications for all `62.100`, fingerprint categories for every `62.100` candidate only if the licence gate opens (allow-listed companies keep theirs either way), full document figures for demo companies A and B, A's/B's peers at all three band steps and the OCR reference filings (check asserts no others; C needs API figures only), stored explanations for every `62.100` default group; `pnpm seed:full` local-only and gitignored; licence gate before the demo seed is published; AI test mode on stored output with FR-53 and digest checks at load; no runtime call to register/model (test asserts); no email; demo A (typical consultancy), B (loss-making product company), C (`69.202` uncovered); other `62.100` companies show "Ikke i demodataene" for document figures; README of ~five commands listing the three demo orgnrs; no secret needed.

**Stage 2 / Stage 3 (backlog only, not for v1 stories)**

- FR-3 (Stage 3 part): coverage of `69.202` and `43.210`, each after its own measurement.
- FR-5: User-entered subject description — Stage 2.
- FR-6 (Stage 2 part): per-session rate limit and CAPTCHA on anonymous sign-in.
- FR-17 (Stage 2 part): exclusions saved with a signed-in user's analysis.
- FR-18 (Stage 3 part): loosening segmentation by legal form or geography, when an industry that applies geography or admits more than `AS` is covered.
- FR-26 (Stage 2 part): decomposition views move behind the account wall.
- FR-28: Multi-year trend where available (*Utvikling*, sparklines) — Stage 2 (split: the view is stage 2; earlier-year extraction is batch work measured by SM-2 and "not held back").
- FR-33: "Egne tall – ikke levert" labelling everywhere — Stage 2.
- FR-34: Visibility of unfiled figures — Stage 2.
- FR-35: Period difference stated — Stage 2.
- FR-36: Filed figures take precedence — Stage 2.
- FR-37: Unfiled figures never enter an aggregate — Stage 2.
- FR-38: Which figures may be entered — Stage 2.
- FR-39: Anonymous session on arrival — Stage 2.
- FR-40: Conversion in place — Stage 2.
- FR-41: Magic-link sign-in — Stage 2.
- FR-42: The account wall — Stage 2 (its own text: "v1 has no wall: every tab is open").
- FR-43: Workspaces — Stage 2.
- FR-44: Invitation — Stage 2.
- FR-45: Cross-workspace isolation — Stage 2.
- FR-46: Immediate revocation — Stage 2.
- FR-47: The anonymous boundary in policy — Stage 2.
- FR-48: Audit log — Stage 2.
- FR-49: Save an analysis — Stage 2.
- FR-50: History — Stage 2.
- FR-51: PDF export — Stage 2.
- FR-52 (Stage 2 part): rate-limited regeneration of the explanation for an adjusted group by a signed-in user.
- FR-61 (Stage 3 part): industry overviews on the front page.
- FR-62 (Stage 2 part): *Utvikling* tab; account-gated tabs visible but locked.
- FR-63: Portfolio front page — Stage 2.
- FR-64 (Stage 2 part): filing year and read date carried into PDF export and saved analyses.
- FR-66 (Stage 2 part): withdrawn company removed from saved analyses (subject and peer notices).
- FR-67: Year-to-date figures against the same period last year — Stage 2.
- FR-69 (Stage 2 part): anonymous-session wording; URL state written into a workspace at registration.

### NonFunctional Requirements

- NFR1: Peer group assembly under 1 s (PRD §7 Performance; TN "Performance targets"; FR-20).
- NFR2: A complete analysis renders within a few seconds, reading only stored figures (PRD §7; TN "Performance targets").
- NFR3: Money is never a float: filed amounts integer øre, derived amounts/ratios exact decimals, including intermediates; rounding only at display (AGENTS.md non-negotiable; PRD §7 Correctness of money; AD-8).
- NFR4: The model never calculates: only fixed-category classification and explanatory text; enforced by the FR-53 test, never weakened (AGENTS.md; PRD §8 Safety of generated text).
- NFR5: Rules before model: deterministic first, model only on the remainder; both layers measured separately (AGENTS.md; TN Guiding principles).
- NFR6: Never select peers on a benchmarked measure; banded measures only in coarse bands and benchmarked within the band (AGENTS.md; FR-13).
- NFR7: Peerless runs without our keys: fresh clone, README, local DB, seed; no API key, paid account, email or hosted service; test mode for anything that would call a model or the register (AGENTS.md; PRD §7 Runnability; FR-73).
- NFR8: Secrets never reach the client; `.env` gitignored from commit one; service role never used in a request (AGENTS.md; PRD §7 Secrets; AD-19).
- NFR9: Calculation integrity: engine is pure functions with no DB/framework imports, tested against hand-calculated reference cases from real filings (negative equity, zero revenue, missing components, non-calendar year) (PRD §7; AGENTS.md Code conventions).
- NFR10: Privacy: v1 stores nothing about users — no accounts, no stored lookups, no user-entered figures, no IP in DB or logs (PRD §8 Privacy; AD-10, AD-19).
- NFR11: Safety of generated text: classification only in fixed categories; explanation rejected by test if it contains an uncomputed figure (PRD §8).
- NFR12: Cost: bounded by one covered industry; OCR once per filing at ingestion; explanations generated once per default group; zero model calls at request time in v1 (PRD §8 Cost).
- NFR13: Data sourcing: only the free public register interfaces in v1; paid bulk subscription out of scope; SSB only from stage 3 after its licence is checked and recorded (PRD §8 Data sourcing).
- NFR14: Freshness disclosed, not promised: no automatic refresh in v1; manual batch run; filing year and read date on every figure; automatic cadence is a pre-deployment gate (PRD §8 Data freshness; FR-64).
- NFR15: Licence: NLOD 2.0 credit for API data only; filed documents carry no stated licence → committed repo holds document figures for the declared sample only; resolving it is a gate before any public/commercial deployment, not a v1 blocker (PRD §8 Licence).
- NFR16: Architecture boundary: nothing user-reachable depends on the batch pipeline being up; the pipeline is never a service and never in a request path (PRD §7; AGENTS.md Stack).
- NFR17: Authorisation in the database (RLS keyed to workspace membership, `is_anonymous` false on saved/user data) — applies from stage 2; in v1 the boundary is DB grants (AD-3) and no user-scoped table exists (PRD §7 Authorisation; AGENTS.md).
- NFR18: Responsive: designed at 1200 and 375 CSS px, no breakage down to the 320 CSS px floor; page body never scrolls horizontally; checked at 375 and 320 in every UI story (FR-55, FR-56; EXPERIENCE Foundation; TN Schedule).
- NFR19: Norwegian bokmål UI, `lang="nb"`; documentation, identifiers and comments English; register field names untranslated (AGENTS.md; PRD §11 q2).
- NFR20: Accessibility floor WCAG 2.2 AA (EXPERIENCE Accessibility Floor; DESIGN Colors verified contrast).
- NFR21: TypeScript strict; no `any` (AGENTS.md Stack).
- NFR22: Documentation tracks code: a key-figure formula changes in `docs/key-figures.md` and code in the same commit; AGENTS.md updated in the same commit as any change that makes it wrong (AGENTS.md).
- NFR23 (measurement, not feature): SM-1 — layer-by-layer ablation, precision and recall per funnel layer standalone and cumulative (3 layers, 4 with embeddings), `62.100`, split by description informativeness (PRD §9).
- NFR24 (measurement): SM-1b — full funnel vs industry-code-only baseline on the labelled set, a sanity check not a claim (PRD §9).
- NFR25 (measurement): SM-2 — OCR recognition accuracy: share of figures exact and share of filings passing the consistency check, recent vs older scans, against a hand-transcribed reference set (PRD §9).
- NFR26 (measurement): SM-4 — no generated text contains a figure absent from engine output, by automated test (PRD §9).
- NFR27 (measurement): SM-5 — latency: assembly <1 s, analysis within a few seconds (PRD §9).
- NFR28 (measurement): SM-6 — engine correctness: all reference cases pass and both identities hold exactly (PRD §9).
- NFR29 (measurement): SM-7 — no horizontal page scroll at any width ≥375px (PRD §9; EXPERIENCE raises the floor to 320).
- NFR30 (measurement): SM-8 — a complete analysis needs nothing but an organisation number (PRD §9).
- NFR31 (measurement): SM-9 — fresh clone on a clean machine with no keys reaches a complete analysis via README alone, test suite (incl. AI test mode) passes (PRD §9).
- NFR32 (measurement): No numeric thresholds are committed for SM-1/SM-2; v1 commits to measuring and reporting (PRD §9, §11 q11). Counter-metrics SM-C1–C4 (peer group size, figures displayed, share classified, industries covered) are not optimised upward. SM-3 (authorisation suite) is stage 2.

### Additional Requirements

**NO STARTER TEMPLATE.** The architecture names no starter template. The first story is project setup per the technical note's week 1: Next.js App Router, local Supabase (CLI, Docker), migrations, seed loader, CI. Test runner and CI provider are chosen in that story (TN "Deferred"); AD-6's identity test needs a real browser engine.

**Schedule anchor.** Week 2 "first working analysis page": organisation number → API figures → peer group (funnel stages 1–3) → table (TN Schedule; matches EXPERIENCE Build order slice 0). Labelled set and OCR hand-transcription start in week 1 and run alongside the code.

**Architecture invariants (TN, all adopted)**

- AD-1: All derived-figure arithmetic lives in `src/engine` (pure TS, no DB/framework imports), imported by server, browser (share/EV scaling only), batch step 2 and the seed loader; Python never computes a ratio, distribution or amount.
- AD-2: Two batch steps, one writer per table: step 1 (Python, Docker) writes register data, API figures, document figures as filed with per-filing status, and deletes `410 Gone` companies (step-2 tables `ON DELETE CASCADE`); step 2 (Node scripts) writes fingerprints, classifications, explanations; default analyses computed in memory, not stored; loader is the only other writer, and the only writer of `register.covered_industry`, declared in the committed file `seed/coverage.json` (one entry per covered code with its FR-3 measurement status, e.g. `{"code": "62.100", "measured": false}`; Epic 5 sets true with a report reference); step 1 reads the same file to decide which industries to fetch.
- AD-3: All DDL in `supabase/migrations`; `CREATE ROLE` only in `supabase/roles.sql` (no passwords); roles `ingest`, `derive`, `loader`, `reader` with write grants per AD-2, each via `<ROLE>_DATABASE_URL`; public data in schema `register`; `anon`/`authenticated` have no `USAGE` on `register`; stage-2 user data in `app` behind RLS with `is_anonymous` false.
- AD-4: `register` not exposed via Supabase REST; Next.js reads server-side via SELECT-only `reader`; no open JSON endpoints except `/api/sok`; server-rendered pages embed only the figures of the shown analysis (incl. every peer value behind each figure); service role never used in a request.
- AD-5: One module `src/url/analysis-state.ts` exports `parse`/`serialize`; all URL reading/building goes through it; canonical grammar (see UX-DR79; `/analyse/{orgnr}` is the result for an uncovered company and for one with no filing in the loaded data, and any `{fane}` redirects to it); invalid values fall back to defaults with a notice, nothing dropped silently.
- AD-6: Server computes peer group, distributions, full-convergence amounts and exact s_med; exclude/restore/widen/reset are `router.push` soft navigations rendered on the server, previous figures dimmed while pending, last good state kept on failure; share and EV scaled in-browser by the same engine function and written via `window.history.replaceState` through one hook; `src/engine/wire.ts` codec with branded `WireDecimal` (decimal strings, never `number`); test asserts identical server/browser output in Node and a real browser engine.
- AD-7: Model called only from batch step 2 with pinned model id; rows store model id + prompt hash; every `62.100` company has a stored default-group explanation; FR-53 at generation and seed load; FR-54 phrase list (e.g. `src/explanation/recommending-phrases.ts`) at generation (regenerate) and load (withhold+report); explanation shown only beside its default group with matching digest; test asserts no network request to register or model host during an analysis.
- AD-8: Filed amounts `bigint` øre; derived values in decimal.js 10.6.0 pinned exactly via one configured `Decimal.clone` exported from `src/engine`; postgres.js `int8`/`numeric` strings parsed to `bigint`/`Decimal`, never `Number()`; rounding only in the one formatter, per key-figures.md incl. whole-percent percentile and largest-remainder waterfall.
- AD-9: One dataset per database; `pnpm seed`/`seed:full` truncate and replace; document rows, fingerprints and explanations carry a provenance dataset tag; CI allow-list test reads every committed seed file regardless of tag against `seed/allow-list.json` (A, B, C + A's/B's peers at all band steps + the OCR reference filings), and the committed OCR reference set; peer-group-subset test; idempotence test; committing fingerprints outside the allow-list waits for the licence gate.
- AD-10: In-memory per-IP counters on `globalThis` in one process; applied at the Next.js proxy for every AD-12 surface incl. RSC payloads and soft navigations; separate budgets for search and analysis in one config module; refusal renders the refusal state; no IP written anywhere; README runs `pnpm start`, not `next dev`.
- AD-11: Stage-2 user data read/written only with the user's JWT under RLS, never via `reader` or service role; authorisation suite exists before the first feature storing user data.
- AD-12: v1 surfaces are exactly `GET /`, `/slik-fungerer-peerless`, `/analyse/{orgnr}`, `/analyse/{orgnr}/{fane}` (with RSC payloads) and `GET /api/sok?q=` (identification fields only, max 8, `pg_trgm` over IMMUTABLE `unaccent` wrapper, exact orgnr index, rate-limited); server actions banned; a route-manifest test fails on any unlisted surface.
- AD-13: Stored explanations store a digest of the wire-encoded default analysis and are shown only when the current engine yields the same digest (else hidden as missing); fingerprints store an input digest, rebuilt every run, CI recomputes them for allow-listed companies; classifications store a description-text digest; one digest function in `src/engine`.
- AD-14: Every `register` amount column is `bigint` øre named `<field>_ore` with a unit comment; step 1 resolves the reporting unit (kr/thousands/millions), converts to øre and stores the unit per filing; contract test runs step 1's writer on fixture 979607008/2025 against a fresh migrated DB with hand-checked øre values.
- AD-15: Step 1 stores figures as filed (øre, NULL for empty element) with stated totals, never a derived value; per filing: filing year, read date, reporting unit, status (`reconciled`/`failed_reconciliation`/`not_extracted`/`paper`), each check's result; engine types name absence reasons (not in dataset, failed reconciliation, undefined, below floor), each mapped to exactly one EXPERIENCE state.
- AD-16: Postgres is the only hand-off between batch steps; seed files written only by deterministic `pnpm seed:export`, read only by the loader; manifest records seed-format version, latest migration id, dataset, industry codes fetched (from `seed/coverage.json`), orgnrs with document figures, read-date range, files+checksums; loader refuses mismatches/unlisted/bad checksum, stores manifest in `register.dataset`, checks explanations by FR-53 and digest; `seed/coverage.json` is the one hand-edited seed file (data, not code: adding an industry is one line), the loader writes `register.covered_industry` from it and refuses a code the manifest did not fetch; `measured: true` accepted only with a `report` path in `analysis/output/` and matching `sha256`, else the loader fails loudly and loads nothing; Supabase CLI auto-seed disabled; CI migrates fresh and loads the demo seed on every PR from Story 1.3b.
- AD-17: (Stage 2) `app.purge_withdrawn(orgnr)` SECURITY DEFINER is the only batch path into `app`, executable only by step 1's role, audit-logged; other system writes only through named SECURITY DEFINER functions; tests assert `anon`/`authenticated` cannot call it or insert into `app`.
- AD-18: Step 1 stamps `read_at timestamptz` per filing, preserved through export/load; filing year from returned `regnskapsperiode`; no clock in the engine (benchmark year from latest filing); dates formatted on the server only, in `Europe/Oslo`; refresh is a manual batch run.
- AD-19: All env vars server-only; no `NEXT_PUBLIC_` variable in v1 (CI grep fails on any; stage 2 allows exactly the two Supabase URL/anon key); `.env.example` mirrors this; `READER_DATABASE_URL` read only in `src/server/db.ts` (`import 'server-only'`, one postgres.js client); model key only in step 2; ESLint `no-restricted-imports` bans `src/server/**` and `postgres` in `'use client'` modules and `src/engine/**`; role passwords from `.env`, never committed; one structured server logger with no IP/personal data/headers; request-path errors render the lookup-error state, no partial figures.
- Dependency direction: `src/engine` depends on nothing; URL module only on the engine; app, step 2 and loader on the engine; step 1 on neither; browser reaches data only via the rendered page and `/api/sok`.

**Stack seed (TN, verified 2026-10-10)**

- Node 24 LTS, `.nvmrc` 24.21.0; Next.js 16.4 App Router, Cache Components off; React 19.3; TypeScript 6.x strict; Tailwind 4.3, shadcn 4.21, Recharts 3.10; pnpm 12 via `packageManager`; Supabase CLI 2.120 pinned exactly; local Postgres 17 with `pg_trgm` + `unaccent`; postgres.js 3.4.9 (no ORM); decimal.js 10.6.0 exact; step 1 Python 3.14 (`.python-version`), `uv` from a pinned image tag with committed `uv.lock`, Tesseract 5.5 with `nor` from `tessdata_best` pinned by commit, in Docker.
- Deferred: hosted deployment (stage 2, behind licence, persistent rate-limit and refresh-cadence gates); render caching; automatic refresh; test runner/CI provider (setup story); embeddings via pgvector.

**Consistency conventions (TN)**

- `src/engine/format.ts` is the only display formatter: takes decimal strings, pins separators and minus sign explicitly (does not trust ICU); used by server render, browser, step-2 prompt builder and FR-53 checker.
- Covered industries read from `register.covered_industry` (written only by the loader, from the committed declaration `seed/coverage.json`; AD-2, AD-16); the literal `62.100` appears in no application code.
- One fingerprint type in `src/engine/fingerprint.ts` with the five FR-73 categories; a migration check mirrors it.
- Classification status ∈ `classified`/`no_text`/`failed`/`pending`; `seed:export` refuses while a covered-industry row is `failed`/`pending`; each batch run writes a run record (start, end, counts per status; step 2 also model id and prompt hash). Each step has its own run-record table with one writer (AD-2), never shared: step 1's is created by Story 2.4 and written only by `ingest`, step 2's by Story 2.6 and written only by `derive`. `pnpm seed` prints the latest record from each (Story 2.6, the first story in which both tables exist).
- Classification/explanation rows store model id and prompt hash; batch failures written to that step's own run record, never swallowed.

**Test strategy (TN)**

- Engine reference cases from real filings with hand-calculated values: negative equity, zero revenue, missing components, non-calendar year asserted as excluded.
- OCR accuracy against a hand-transcribed set, field by field; reported exact share and consistency-pass share, recent vs older.
- Labelled classification set (FR-70) with layer-by-layer reporting stratified by description quality.
- Synthetic cohorts at and below the minimum group size.
- FR-53 figure-validation test.
- FR-30 two-cluster no-double-counting assertions; FR-21 two exact identities.
- FR-13 per-industry within-band spread test; FR-18 no loosening admits a comparability failure.
- FR-73 no outbound register/model request during an analysis; seed load twice = same state.
- AD-6 server/browser identity (Node + real browser engine); AD-9 allow-list and peer-group-subset tests; AD-13 fingerprint recomputation; AD-12 route-manifest test; AD-14 step-1 contract test; AD-16 CI fresh migrate + demo seed load.
- Authorisation suite (stage 2, before the first user-data feature), incl. AD-17 cases.

**Process (AGENTS.md "Git workflow"; TN Schedule)**

- [All code stories] One GitHub issue, one branch `story/<id>-<slug>`, one PR per story; PR links the issue (`Closes #n`), lists FRs, states test evidence, links the AI session file and records review findings on AI-generated code. Planning docs may go straight to `main`.
- [All stories] AI sessions saved in `docs/ai-sessions/`; lessons in `docs/ai-log.md`; changes touching auth, data access or money state what could go wrong.
- [All UI stories] Phone width checked at 375 and 320 px as part of acceptance.
- [All stories] No stage 2/3 work starts until v1 runs from a fresh clone.

**User-specified requirements**

- [Setup] Exact versions pinned — no `^` or `~` in any dependency spec.
- [Setup] TypeScript 6.x.
- [Setup] Next.js with Cache Components off; confirm the exact `next.config` flag in the current Next.js docs.
- [Setup] Bump Next.js to the patched 16.4.x if the security release announced for 2026-10-14 has shipped.
- [Setup] An ESLint rule forbidding `Math.round` and `toFixed` in `src/engine` and in display formatting.
- [Engine] Rounding through decimal.js's half-away-from-zero mode (`ROUND_HALF_UP` in decimal.js), with tests on negative ties: −2.5 → −3, and −0.05 % → −0.1 %.
- [Formatter] `src/engine/format.ts` is the only number formatter (no `Intl.NumberFormat` for figures, since ICU output differs between Node and browsers). Unit tests pin the exact output characters — thousands separator, decimal comma, minus sign U+2212, thousands separator U+00A0 and U+00A0 before "kr" and "%" (decided 2026-10-10) — so server and browser output is compared byte for byte (AD-6).
- [Search] Wrong length → "Organisasjonsnummeret må ha 9 siffer"; nine digits with a wrong check digit → "Ugyldig organisasjonsnummer" (EXPERIENCE.md, AD-5).
- [Seed] A 62.100 company in the register with no filing in the loaded data: identification only, "Vi har ikke et levert regnskap for dette selskapet ennå." (EXPERIENCE.md, FR-73).
- [OCR] FR-28's batch part is v1: the OCR story extracts and reconciles 2021–2025 as data and as the SM-2 measurement; every display of multi-year data stays in the backlog.
- [Measurement] Embeddings (FR-68) are the last story in the measurement epic and the first v1 item cut; pgvector leaves Deferred when that story starts.
- [Search] Spaces stripped, nine digits, modulus-11 check digit with the message "Ugyldig organisasjonsnummer", unit-tested with valid, mistyped and spaced numbers; the listed `GET /api/sok` endpoint and the route-manifest test (AD-12).
- [Seed] A separate state for a `62.100` company that is in the register but has no filing in the seed.
- [Seed] The licence gate assessed (and recorded) before the demo seed is published.
- [Seed] 30 stored explanations read and recorded in `docs/ai-sessions/` before publishing (FR-54).
- [All code stories] One GitHub issue, one branch `story/<id>-<slug>`, one PR per story, per AGENTS.md "Git workflow".

**Deferred reconcile items (architecture memlog; revisit when the named story starts)**

1. [Seed] Fallback if the licence gate stays closed (fingerprint categories not committed → what stage 4 does for non-allow-listed `62.100` companies).
2. [Explanation] FR-52 explanations stored with slot references (figures/direction words as engine-provided slots).
3. [Performance] Latency check after a peer adjustment (soft-navigation re-render, not only first load).
4. [Funnel] "v1: AS only" segmentation wording (FR-9).
5. [OCR] The prior-year column for revenue growth (key figure 14's `sumDriftsinntekter` prior year).
6. [Embeddings] Move pgvector out of "Deferred" in the TN when embeddings are scheduled.
7. [Docs] A pointer from the technical note to the UI copy convention (EXPERIENCE vocabulary / message files).

### UX Design Requirements

v1 only; DESIGN.md is visual, EXPERIENCE.md behavioural; spines win over mocks.

**Tokens and foundations**

- UX-DR1: Colour tokens, light mode only (dark tokens unused in v1): navy-900 `#0B2340`, navy-700 `#1F3A5F`, primary-foreground `#FFFFFF`, link `#2F5D8C`, signature `#7399C6`, background `#FFFFFF`, surface `#F5F7FA`, surface-foldout `#FBFCFD`, divider `#D9E0E8`, band `#6C7F95`, input-border `#7B8BA0`, slate `#5B6B7F`, favourable `#1F6F8B`, unfavourable `#B45309`, median `#6B7C91`, peer-dot `#7B8BA0`, gridline `#E6EBF1`, connector `#B9C3CF`, disabled-text `#6F7E90`; as Tailwind/shadcn theme tokens.
- UX-DR2: Colour rules: no red or green anywhere; direction always an arrow or word, never colour alone; `signature` only for the company marker, always with 2px navy-900 outline; `unfavourable` means direction only; `divider` decorative only, inputs use `input-border`; `band` reaches 3.09:1 on the track; `disabled-text` only on disabled controls.
- UX-DR3: Typography: Inter for body, figures, tables, labels with `tabular-nums` wherever numbers sit in columns/axes/tooltips/amounts/inputs; Source Serif 4 for headings only (display-front, heading-page, company-name, heading-section, card-title); full ramp with `-phone` variants below `md`; a number never set in serif.
- UX-DR4: Spacing tokens (gutter 32/16, card padding 24/16, grid gap 24/16, front-hero-top 112/40, indent-group 30, target-min 24, target-phone 44); radii sm 3 / md 4 / lg 6 / full; flat elevation (1px divider borders, tooltip shadow only); focus 2px navy-700 `outline` with 2px offset (inset in segmented controls).
- UX-DR5: Chart markers by shape: company = signature circle + 2px navy-900 outline + 2px halo; median = 2px vertical tick, full 30px strip height, 1px halo across the band; beste fjerdedel = hollow downward 10px triangle, slate 1.5px; midtre halvdel = 6px band on divider track; peer = peer-dot circle with 2px background stroke.
- UX-DR6: Layouts: Oversikt 12-column card grid (hero 5, peer plot + list 7, three small cards 4 each, explanation 12), one column on phone; Peers/Nøkkeltall/Verdi full-width cards; no side rail or persistent summary bar; front page single centred column max ~720px; about page with sticky TOC on desktop, bordered box on phone.

**Components**

- UX-DR7: Header on every page: wordmark "Peerless" (links to `/`), compact search (hidden on front page), "Slik fungerer Peerless" link (wraps to two lines on phone); 1px divider bottom; no menu items for non-v1 features.
- UX-DR8: Search field: hero 60px (56 phone) joined to navy-700 submit (stacked full width, 52px button, on phone); visible label/hint "Navn eller organisasjonsnummer" in accessible name; validation on submit/blur only; error = 2px unfavourable border + glyph, `aria-invalid`, `aria-describedby`; loading = surface fill, read-only, button disabled.
- UX-DR9: Search results combobox (ARIA 1.2): `role="combobox"`, `aria-expanded`/`aria-controls`/`aria-activedescendant`, `listbox` of `option`s (name 600; orgnr · industry · municipality in slate); arrows move, Enter opens, Esc closes; navigation only on Enter/click/submit, never on input; nine-digit exact match submitted goes straight to analysis; ≤8 results; 300 ms debounce; polite "{n} treff" live region shared with no-match.
- UX-DR10: Company header: name in `company-name` (h1); slate meta line orgnr · industry · Omsetning x mill. kr · Regnskapsår YYYY · hentet D. mon. YYYY; slate data-quality subline in words when the filing is not fully reconciled (no badge).
- UX-DR11: Tabs as links (`/analyse/{orgnr}/{fane}`), not ARIA tabs, `aria-current="page"`; four labels fit on phone (wrap, no scroll strip); page titles "{Selskap} – {Fane} – Peerless" / "Peerless" / "Slik fungerer Peerless – Peerless"; h1 company, h2 panel/section, h3 cards/fold-outs.
- UX-DR12: Hero card (Oversikt): always driftsmargin; kicker "Største gap i kroner", direction tag, full-convergence amount in `hero-amount`, "per år ved full tilnærming til beste fjerdedel", own vs beste fjerdedel in `figure-pair`, context line (median, Plassering, pp), top note "Viser gap ved full tilnærming · Endre i Verdi", links "Hvordan er dette regnet?" and "Se alle nøkkeltall".
- UX-DR13: Three small cards at full convergence with the top note: "Største kapitalgap" (largest one-off capital amount, working capital 9+10 or operating-asset 11, full label + "engangsbeløp", mandatory "Ikke per år, og legges ikke til resultatet.", cost shares never qualify, never ranked against hero); "Største styrke" (highest Plassering at/beyond beste fjerdedel, ties by figure number, no kroner); "Mangler grunnlag" (first figure without comparison, own value + reason, "og {n} til" link).
- UX-DR14: Explanation card: full width; kicker "Forklaring" with ✦; stored default-group text clamped to two lines with "Les mer" expanding in place; every figure links to its calculation; source line "Skrevet av KI ut fra tall Peerless har regnet ut. Hvert tall finnes i analysen." with key "✦ KI-generert"; adjusted-group and no-stored-text states (UX-DR52).
- UX-DR15: Beeswarm (driftsmargin): axis in %, gridlines, packed peer dots, labelled company marker, median tick, beste fjerdedel triangle, "Bedre →"; legend with values; non-focusable SVG `role="img"` with summary `aria-label`, children hidden; tooltip on hover/tap only as convenience; compact list of five nearest peers + "Se alle {n}" → Peers; "Vis tallene" opens a full Selskap · Driftsmargin · Omsetning table (sorted, company row "(valgt selskap)") in a scroll container.
- UX-DR16: Distribution strip: 30px divider track, band, median tick, triangle, company marker; lower-is-better rows mirrored so better is right ("Bedre →", column head "Fordeling · bedre →"); no-direction/check rows unmirrored, no label; midtre halvdel as caption text under it; `aria-hidden`, not in tab order.
- UX-DR17: Benchmark row (desktop seven columns): name (600) with slate subline "direction · {n} sammenlignbare brukt · {k} utelatt"; own; median; beste fjerdedel; Plassering (whole %); strip; gap in kroner at full convergence; cost-share rows indented under a surface group row "Forklarer marginavviket – summeres ikke" with "Se forklaring av marginen" jumping to the waterfall (opens it, focus to heading); total cost share as check row (sr-only "ikke relevant"); no-direction rows show own, median, midtre halvdel, "Ingen retning", no kroner; table top note "Viser gap ved full tilnærming · Endre i Verdi".
- UX-DR18: Benchmark table semantics: real `<table>` with caption; cost-share rows in own `<tbody>` led by `<th scope="rowgroup">`; "Midtre halvdel:" prefix in no-direction rows; inapplicable cells sr-only "ikke relevant – ingen retning"; merged below-floor cell uses `headers` naming every spanned column (no `colspan` breaking association).
- UX-DR19: Fold-out: shadcn `Collapsible` with `button` trigger, `aria-expanded`, `aria-controls`, ▸/▾ caret `aria-hidden`, body on surface-foldout indented 30px, closed by default, full width below its row on phone (never nested in the row); placements: "Hva forklarer marginavviket?" under Driftsmargin, "Margin eller kapitalbruk?" under Totalkapitalrentabilitet, "Lønnsnivå eller produktivitet?" under Lønnskostnadsandel; all open in v1.
- UX-DR20: Margin waterfall ("Hva forklarer marginavviket?"): from "Peer-gruppen samlet" (median fill) through Varekostnad, Lønn, Andre driftskostnader, Avskrivninger og øvrige poster (residual, slate whatever its sign) to the company (navy-700); favourable petrol / unfavourable amber, each bar with signed kroner, ▲/▼ + word and "own mot samlet" shares; "Mot peer-gruppen samlet, ikke medianen" subline where row and bar disagree; leads with tag "Mot peer-gruppen samlet: x %, ikke beste fjerdedel" and mandatory "Dette forklarer avviket. Det er ikke et gap som skal lukkes, og det legges aldri til økt driftsresultat." directly above the bars; legend names all three bar kinds; displayed bars sum to the displayed total (largest remainder); never scaled; SVG `role="img"` summary; "Vis tallene" table (caption, `th scope="row"`, start, four parts, end, reference); <10 in common set → "Ingen forklaring av marginen: bare {n} sammenlignbare har alle kostnadslinjene (av 10 som trengs)."
- UX-DR21: Factor pair "Margin eller kapitalbruk?": driftsmargin and totalkapitalens omløpshastighet (derived factor; median + count only, never labelled key figure 11), each against its own median, never multiplied, each with its own strip and FR-22 gate ("For få sammenlignbare (n av 10)"); side by side, stacked on phone.
- UX-DR22: Factor pair "Lønnsnivå eller produktivitet?": lønnskostnad per årsverk (no direction, no beste fjerdedel) and omsetning per årsverk, same pattern and gating as UX-DR21.
- UX-DR23: Funnel: five stages "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", count in `count` (tabular), 8px navy-700 bar proportional to stage 1; always shown even below floor; "✦ {n} med usikker klassifisering"; "{n} ekskludert av deg → {m} i analysen"; vertical list on phone.
- UX-DR24: Size-band control: segmented `radiogroup` with roving tabindex, steps "0,5–2× / Standard", "0,33–3× / Utvidet", "0,25–4× / Utvidet"; shows resulting revenue range; beyond Standard tags "Utvidet" and shows the widened notice; states that comparability is never loosenable; full-width three-column grid on phone.
- UX-DR25: Peer list: Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag · action; caption key "✦ KI-generert"; "Ekskluder {Navn}" keeps the row (slate text, struck through, tag "Ekskludert", action "Ta med igjen"), focus stays on the same button; "Tilbakestill til standard" clears all; one card per peer on phone with "Vis alle {n}".
- UX-DR26: Closable-share control: segmented `radiogroup` 0/25/50/75/100 % plus "Til medianen for driftsmargin (n %)" in its ordered place; n = exact s_med shown whole percent, amounts use exact s; exists only where r < median < beste fjerdedel, else `aria-disabled="true"` (still focusable) with `aria-describedby` reason; median line with 2×12px tick and "Medianen gjelder driftsmargin." always; starts at 50 %; moves only Verdi amount cards; wraps to two rows on phone.
- UX-DR27: Amount cards (Verdi), three always: "Økt driftsresultat per år" ("585 000 kr av 1 170 000 kr per år"); "Frigjort arbeidskapital" with kundefordringsdager and leverandørgjeldsdager lines and a total only when both clear the floor ("Ingen sum – én del mangler grunnlag" otherwise); "Frigjort kapital i driftseiendeler" beside, never added; capital amounts "engangsbeløp"; per-card median line ("Median nås ved x %" / "Median: allerede over"); no target → "Ikke beregnet – for få sammenlignbare på …"; stacked on phone.
- UX-DR28: EV/EBIT multiple field: 90px numeric input "EV/EBIT-multippel", empty by default, no suggestion; accepts (0, 50] in 0,1 steps, comma or point; error "Skriv inn et tall større enn 0 og høyst 50, for eksempel 6 eller 6,5"; result "Økt selskapsverdi" = round(exact uplift × m), product line prefixed "≈" when it differs; carried in URL; announced on Enter/blur.
- UX-DR29: Provenance drill-down "Hvordan er dette regnet?" on every kroner amount, inline: (1) formula (share factor only from Verdi); (2) key figure and beste fjerdedel derivation ("… = øvre kvartil av 23 verdier (lineær interpolasjon, som PERCENTILE.INC i Excel)") with "Vis fordelingen"; (3) filed values with register field names in monospace; (4) source, filing year, read date, data-quality line ("Avstemt mot innsendt årsregnskap" / "Ikke avstemt – årsregnskapet er ikke i demodataene" / "Avvik ved avstemming: {felt}"); calc chips on surface; focus to heading on open, "Lukk"/Esc returns focus to trigger.
- UX-DR30: State block component: surface, 4px navy-700 left accent, kicker + one or two sentences, at most one link/action; the only banner-like component (no separate banner).
- UX-DR31: Info button: real `button` ("Mer om dette", visible ⓘ, ≥24px) opening shadcn `Popover`; toggles on tap/click/Enter/Space, Esc/outside closes, stays open while hovered; never the only place a caveat lives.
- UX-DR32: Tag (non-interactive state label, never sole carrier of a number; soft variant); uncertain flag "✦ Usikker klassifisering" (slate, `tag` type) beside match basis; tooltip (background, divider border, shadow, value 13px/600 tabular; supplementary only; one open at a time on touch; phone: opens above plot with leader line).
- UX-DR33: AI marking: ✦ only on the explanation as a whole, a match basis resting on a classification ("Beskrivelse og regnskap", "Kun beskrivelse"), and "Usikker klassifisering"; never on "Hvorfor med" or any number; glyph `aria-hidden`, screen readers hear "KI-generert" once per cell; SVG fallback if Inter lacks U+2726.
- UX-DR34: Footer source line on every page: "Data fra Brønnøysundregistrene, bearbeidet av Peerless · Kilder og lisens", "Kilder og lisens" linking to the about page's sources section.
- UX-DR35: About page `/slik-fungerer-peerless`, sections with a TOC: funnel in plain words; where AI is used and the FR-53 test sentence ("En automatisk test sjekker hver lagrede forklaring …"); what is measured (SM-1, SM-2) or "Målingen pågår …"; sources and licence (NLOD credit for API figures; separate document-figure paragraph); limitations (VAT on receivable days, `smaaForetak` coverage); data age.
- UX-DR36: Front page `/`: one honest headline plus one sentence stating v1 covers 62.100; hero search; "Slik fungerer det" in three numbered steps (1px navy-900 top rule, `label-strong` title, one sentence), stacked on phone; link to the about page; no SaaS buttons, no "Kom i gang".
- UX-DR37: Scroll container for every overflowable table/chart: `overflow-x: auto`, `tabindex="0"`, `role="region"`, descriptive `aria-label` (e.g. "Nøkkeltall, kan rulles sideveis"), visible focus, edge-fade cue.

**States (EXPERIENCE State Patterns)**

- UX-DR38: Below the 10-peer floor: row keeps own value; comparison cells merged into one italic slate "For få sammenlignbare (n av 10)" (phone "For få (n av 10)"); no kroner; funnel still shows counts.
- UX-DR39: Own value undefined: "Kan ikke beregnes" + reason ("omsetningen er null eller negativ" / "en regnskapslinje mangler"); no comparison; subline keeps peer count.
- UX-DR40: `62.100` company outside the demo seed: full funnel/peer group; API rows compared normally; document rows read "Ikke i demodataene" with info popover; one State block above the table referenced by `aria-describedby`; waterfall and pay/productivity not shown, margin/capital shown; Oversikt "Største kapitalgap" and Verdi capital cards read "Ikke i demodataene"; explanation shown; provenance line "Ikke avstemt – årsregnskapet er ikke i demodataene".
- UX-DR41: Uncovered industry (demo C): `/analyse/{orgnr}` with no tabs; company header; State block "Bransjen er ikke dekket ennå" + "{Bransjenavn} ({kode}) er ikke dekket ennå. Foreløpig sammenligner Peerless bare selskaper innen programmeringstjenester (62.100). Her er selskapets egne nøkkeltall fra Brønnøysundregistrene."; three API figures with year and read date; "Uten sammenlignbare selskaper viser vi ingen median, plassering eller kroner."; link "Søk på et annet selskap".
- UX-DR42: Orgnr not in the database: "Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi programmeringstjenester (62.100)." + links to demo A and B.
- UX-DR43: Search no match: "Ingen treff på «{q}». Peerless har foreløpig bare selskaper i programmeringstjenester (62.100)." + demo links.
- UX-DR44: Empty search submitted: "Skriv inn et navn eller et organisasjonsnummer"; no request.
- UX-DR45: Malformed number (digits only, spaces ignored, count ≠ 9): "Organisasjonsnummeret må ha 9 siffer"; error border + glyph, `aria-invalid`, live region.
- UX-DR46: Invalid URL state: bad orgnr (not nine digits / fails mod-11) → front page with malformed-number message; tab on uncovered or no-filing company → `/analyse/{orgnr}`; unknown tab → Oversikt; exclusion outside candidate pool or beyond 20 → dropped; impossible "Til medianen" → 50 %; invalid band/share/multiple → Standard/50 %/empty; one slate notice "Noen innstillinger i lenken var ugyldige og er satt tilbake til standard."; no year in URL.
- UX-DR47: Hero, no profit gap: at/beyond beste fjerdedel → "▲ Styrke" + "Driftsmarginen er på eller over beste fjerdedel. Det er ikke noe gap å regne om til kroner."; below floor → own value + "For få sammenlignbare (n av 10)"; no amount.
- UX-DR48: Small cards empty: "Ingen kapitalgap: ingen av kapitalnøkkeltallene ligger under beste fjerdedel." / "Ingen nøkkeltall ligger på eller over beste fjerdedel." / "Alle nøkkeltall har grunnlag for sammenligning."; cards keep their place.
- UX-DR49: Peer group too small (Peers, above funnel): "<10 after stage 5 at Standard" block with action "Utvid størrelsesintervallet"; at 0,25–4× same without action ("… også med det videste intervallet"); zero → "Fant ingen sammenlignbare selskaper."; counts always shown.
- UX-DR50: Own filing fails reconciliation (FR-71): API figures keep full comparison; document figures absent with "Regnskapet for {år} kunne ikke leses sikkert"; not demoted to uncovered.
- UX-DR51: Non-small subject below the floor: "Peerless sammenligner foreløpig bare små foretak", only when a non-`smaaForetak` subject's comparison falls below the floor.
- UX-DR52: Explanation states: adjusted group (any exclusion or widened band) → "Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den." with "Tilbakestill" (clears exclusions, band to Standard, keeps share/multiple); no stored text or digest mismatch → "Det finnes ingen lagret forklaring for dette selskapet."; nothing generated.
- UX-DR53: Widened size band: tag "Utvidet"; State block "Utvidet størrelsesintervall (0,33–3×). Dette er ikke standard peer-gruppe." + "Tilbake til standard (0,5–2×)"; explanation shows adjusted state.
- UX-DR54: Recompute: pending → `aria-busy="true"`, previous figures dimmed with slate "Oppdaterer …"; failure → `role="alert"` "Kunne ikke oppdatere analysen. Prøv igjen." and figures/URL revert to last good state; never animated.
- UX-DR55: Verdi median states: below median → "Til medianen for driftsmargin (n %)" enabled, "Median nås ved n % av gapet. Medianen gjelder driftsmargin."; above → disabled, "{Selskap} ligger allerede over medianen. Medianen gjelder driftsmargin.", each amount "Median: allerede over".
- UX-DR56: Driftsmargin is a strength (Verdi): profit card "▲ Styrke. Driftsmarginen er på eller over beste fjerdedel, så det er ikke noe økt driftsresultat å regne ut."; EV field disabled with the same reason; "Til medianen" disabled.
- UX-DR57: EV empty ("Verdi beregnes når du legger inn en multippel. Peerless foreslår ingen multippel.", no value) and EV invalid (inline error tied to field, no value).
- UX-DR58: Strength in a row or card: "▲ Styrke", no kroner.
- UX-DR59: Rate-limit refusal: `role="alert"` "Det er gjort mange oppslag fra denne adressen på kort tid. Vent litt, og prøv igjen."; no figures.
- UX-DR60: Loading: search field read-only, button disabled, static "Henter analysen …" announced once (spinner only when motion allowed); analysis `aria-busy` on `main` with shadcn `Skeleton` in card layout.
- UX-DR61: Lookup error: `role="alert"` "Noe gikk galt. Prøv igjen om litt."; no partial figures.
- UX-DR62: Data date "Regnskapsår YYYY · hentet D. mon. YYYY" in company header and every provenance drill-down.
- UX-DR63: Source attribution: footer line on every page; about page NLOD credit for API figures plus separate document-figure paragraph ("Tall fra innsendte årsregnskap er lest av Peerless …"), publication gated on the licence assessment; "Ikke i demodataene" popover links to it.
- UX-DR64: Measurement pending (about page): "Målingen pågår. Resultatene publiseres her når de foreligger." as a plain paragraph, no placeholder figures, replaced by results once SM-1/SM-2 exist.

**Accessibility**

- UX-DR65: Live regions present empty from page load and filled on change; one action → one debounced announcement, polite unless `role="alert"`; announcements per the Status table (search, results count, exclude/restore "{Navn} er ekskludert. {m} sammenlignbare i analysen.", reset, widen/narrow, share step "Økt driftsresultat per år: {a} av {full}.", multiple, recompute failure, invalid URL notice).
- UX-DR66: Focus management per the Status table: route change → h1; tab change → panel h2; exclude/restore → same button; reset → Peers h2 (or explanation heading); steps stay; provenance → its heading and back to trigger; "Se forklaring av marginen" → waterfall heading; focus ring never clipped by a container.
- UX-DR67: Keyboard primitives: tab order follows reading order; Enter/Space toggle fold-outs, info buttons, steps; arrow keys in segmented controls (roving tabindex) and search results; Esc closes popovers, results, drill-downs; charts are not keyboard stops.
- UX-DR68: Reflow to 320 CSS px with no body horizontal scroll; no fixed phone-table column widths that cannot shrink.
- UX-DR69: Target size ≥24×24 px everywhere (inline "Ekskluder", "Ta med igjen", "Les mer", "Lukk" padded); 44×44 recommended on phone.
- UX-DR70: `<html lang="nb">`; standalone tab label "Peers" may carry `lang="en"`.
- UX-DR71: Reduced motion: honour `prefers-reduced-motion` (Recharts `isAnimationActive={false}`, no recompute transitions, static loading text); recompute never animates in any mode.
- UX-DR72: Charts: non-focusable `role="img"` SVG with `aria-label` summary plus an adjacent table or "Vis tallene"/"Skjul tallene" toggle; direction glyphs `aria-hidden` with words for screen readers ("bedre mot høyre"); markers and bars tested under `forced-colors: active`.
- UX-DR73: Caveats inline: key text always on the page, long text behind an info-button popover, never only in a tooltip; hover-only affordances banned.

**Responsive**

- UX-DR74: Switch point Tailwind `md` 768px; every screen designed at 1200 and 375; header search flexes; Oversikt one column (hero, plot + list, small cards, explanation); front page left-aligned with stacked field/button/steps.
- UX-DR75: Phone benchmark table: real three-column table (Nøkkeltall · own · Gap i kroner); row name is a `button` with `aria-expanded`/`aria-controls` opening a full-width expansion row (median, beste fjerdedel, Plassering, midtre halvdel, direction, count, kroner); fold-outs full width below the row group.
- UX-DR76: Phone funnel as vertical list (name left, count right, bar beneath); phone waterfall as vertical rows (name + signed value, subline, 10px floating bar on a shared kroner scale; reference tag then never-added sentence); peer list as cards; segmented controls full-width grids; amount cards stacked; beeswarm compact list primary.

**Copy, formatting, URL and interaction**

- UX-DR77: All copy in message files keyed by dotted ids (`front.title`, `gap.wf.title`, `fig.*` per the key-figure label table), no hard-coded strings in components; EXPERIENCE's Vocabulary table and quoted copy are authoritative; `mockups/messages-v1.nb.json` is regenerated from the spine before use (listed superseded keys not shipped); key-figure labels one per figure (Driftsmargin … Omsetningsvekst, Kontantandel, Totalkapitalens omløpshastighet).
- UX-DR78: Number formatting (nb-NO) via the one formatter: kroner whole with space thousands + "kr"; signed with true minus `−` and `+`; millions one decimal "mill. kr"; percent one decimal; Plassering whole percent; "Til medianen" whole percent; pp one decimal; days whole; turnover two decimals; multiple up to one decimal with comma; orgnr grouped 3-3-3; non-breaking space before units.
- UX-DR79: URL grammar: `/analyse/{orgnr}/{fane}` with `fane` ∈ `oversikt|peers|nokkeltall|verdi`; covered `/analyse/{orgnr}` → redirect to `oversikt`; uncovered or no-filing `/analyse/{orgnr}` is the result and any `{fane}` redirects to it; `ekskl` sorted, de-duplicated comma list ≤20 within the candidate pool; `band` ∈ 0|1|2; `andel` ∈ 0|25|50|75|100|median; `multippel` (0,50] step 0.1 (point written, point or comma read); defaults omitted; `serialize(parse(url))` canonical; routes `/` and `/slik-fungerer-peerless`.
- UX-DR80: Interaction primitives: peer-group and tab changes push history; share and multiple replace; fixed steps not sliders; fold-outs not dialogs (no modal in v1); banned: sliders for money, infinite scroll, hover-only affordances, autoplaying motion, browser storage for state that matters.

**Later stages (backlog only, not for v1 stories; EXPERIENCE "Later stages")**

- Dark mode (stage 2); account wall with locked tabs and open sparklines (stage 2); *Utvikling* tab and charts (stage 2); explanation regeneration for an adjusted group (stage 2); own figures "Egne tall – ikke levert" (stage 2); portfolio front page (stage 2); explicit save "Lagre i arbeidsområde" (stage 2); viewer what-if (stage 2); withdrawn-company notices in saved analyses (stage 2); live register lookup for unknown orgnr (stage 2, may be considered); front-page industry overviews (stage 3).

### FR Coverage Map

FR-1: Epic 1 — Search by name or orgnr (Story 1.5)
FR-2: Epic 1 — Company identification and analysed year (Story 1.6b; year from `regnskapsperiode` stored by Story 1.3a)
FR-3: Epic 1, 5 — Covered-industry gate (62.100) from `register.covered_industry`, loaded from `seed/coverage.json`, in Epic 1 (SN2025 only, with the SN2007 test, in Story 1.3a; the loader's `measured`/`report`/`sha256` validation in Story 1.3b; the gate on the analysis route in Story 1.6b); `measured: true` with its report reference set in Epic 5 (Story 5.2); stage-3 industries in Epic 6
FR-4: Epic 1 — Uncovered-industry state (demo C chosen in Story 1.3a; the state in Story 1.6b)
FR-6: Epic 1 — Per-IP rate limit (stage-2 part in Epic 6)
FR-7: Epic 1 — Funnel stage 1
FR-8: Epic 1 — Funnel stage 2, comparability
FR-9: Epic 1 — Funnel stage 3, segmentation
FR-10: Epic 2 — Funnel stage 4, fingerprint
FR-11: Epic 2 — Funnel stage 5, classification
FR-12: Epic 2 — Unclassified companies stay eligible
FR-13: Epic 2 — Never select on a benchmarked measure
FR-14: Epic 2 — Text/fingerprint disagreement flagged
FR-15: Epic 2 — Funnel counts
FR-16: Epic 2 — Inclusion reason and match basis
FR-17: Epic 2 — Exclude a peer (saving in Epic 6)
FR-18: Epic 2 — Widen the size band in three steps (segmentation loosening, stage 3, in Epic 6)
FR-19: Epic 2 — Recompute after a peer-group change
FR-20: Epic 1 — Peer group under one second
FR-21: Epic 1, 3 — Key figures per key-figures.md and identities (API figures in Story 1.4; every formula, the identities and the reference cases in Story 3.1a)
FR-22: Epic 1 — Ten-peer floor per figure
FR-23: Epic 2, 3 — Undefined is not zero (engine and API figures in Epic 2; document figures in the engine in Story 3.1a, their rows in Story 3.1b)
FR-24: Epic 1, 3 — Same basis for subject and peers (API rows in Epic 1; document figures in Story 3.1a, their rows in Story 3.1b)
FR-25: Epic 1 — Benchmark year
FR-26: Epic 3 — Decomposition views (stage-2 wall in Epic 6)
FR-27: Epic 1, 3 — Distribution row: API rows in Epic 1, the rest in Epic 3 (Story 3.1b, and the Oversikt cards in Story 3.4)
FR-28: Epic 2, 6 — Multi-year extraction as data in Epic 2; the view in Epic 6
FR-29: Epic 1, 3 — Kroner gaps: driftsmargin in Epic 1, document figures in Epic 3 (kroner functions for (9), (10), (11) in Story 3.1a, their cells in Story 3.1b)
FR-30: Epic 3 — No double counting
FR-31: Epic 3 — Closable-share control and four amounts
FR-32: Epic 3 — EV at a user multiple
FR-52: Epic 4 — Stored explanation (regeneration in Epic 6)
FR-53: Epic 4 — The model never calculates — figure test
FR-54: Epic 4, 5 — Explains, never recommends — phrase test in Epic 4; the 30-explanation review in Epic 5
FR-55: Epic 1 — Reflow to phone width
FR-56: Epic 1 — Tables and charts scroll in their own containers
FR-57: Epic 2 — Data quality flag per filing
FR-58: Epic 2 — Reconciliation rules
FR-59: Epic 1 — No OCR or fetch at query time (Stories 1.3a, 1.7)
FR-60: Epic 3 — Traceability to filed values
FR-61: Epic 1 — Front page (industry overviews in Epic 6)
FR-62: Epic 1, 3 — Tabs: Oversikt, Peers and Nøkkeltall og gap in Epic 1 (three tabs during Epics 1–2); Verdi added in Epic 3, so four open tabs once Epic 3 is done (Utvikling in Epic 6)
FR-64: Epic 1, 3 — Filing year and read date (stored by Story 1.3a, shown by Story 1.6b); in every provenance drill-down in Epic 3 (PDF and saved parts in Epic 6)
FR-65: Epic 1, 5 — Source credit in Story 1.6b; the document-figure paragraph published in Story 5.4, with the licence assessment
FR-66: Epic 2 — Withdrawn company removed from stored data (saved-analysis part in Epic 6)
FR-68: Epic 5 — Embeddings for the ablation, cut first
FR-69: Epic 1 — URL is the state: the URL module in Story 1.6a, the route in Story 1.6b (stage-2 part in Epic 6)
FR-70: Epic 5 — Labelled set, from week 1
FR-71: Epic 2, 3 — Subject's filing fails reconciliation (engine and header in Epic 2; document rows in Story 3.1b)
FR-72: Epic 1, 5 — Slik fungerer Peerless: the page and its "Kilder og lisens" section in Story 1.6b; the document-figure paragraph in Story 5.4; the rest in Story 5.6, and the four-layer result in Story 5.3
FR-73: Epic 1, 5 — Running locally: step-1 ingest in Story 1.3a and the seed path in Story 1.3b; complete in Epic 5 (demo seed 5.4, explanations in the seed 5.5, `pnpm seed:full` and the fresh clone 5.7)
FR-5, FR-33 to FR-51, FR-63, FR-67: Epic 6 — backlog (stage 2)

## Epic List

### Epic 1: Look up a company and see where it stands — API figures and the first gap in kroner (slice 0)
Kari or Anders searches by name or organisation number and gets the company header, a peer group from funnel stages 1–3, and the key-figure table for the three API figures (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) with median, beste fjerdedel and Plassering. The driftsmargin gap is already in kroner — (beste fjerdedel − own margin) × `sumDriftsinntekter` at full convergence — shown in the table and in the Oversikt hero card "Største gap i kroner". Uncovered, no-filing and invalid-number states, URL state, rate limit, data date, source line, the front page and responsive layout from the first story. Delivers the teacher's "organisasjonsnummer → peer-gruppe → nøkkeltall og gap i kroner" early.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-6, FR-7, FR-8, FR-9, FR-20, FR-21 (API figures), FR-22, FR-24, FR-25, FR-27 (API rows), FR-29 (API part: driftsmargin), FR-55, FR-56, FR-59, FR-61, FR-62 (three tabs; Verdi in Epic 3), FR-64, FR-65, FR-69, FR-72 (page with "Kilder og lisens" only), FR-73 (local run on the API seed)

### Epic 2: Trust the peer group
The user sees why each company was chosen: funnel counts per stage, "Hvorfor med", "Grunnlag for treff" and "Usikker klassifisering" per peer, and can exclude a peer or widen the size band. Behind it: OCR, reconciliation and per-filing status (batch step 1, 2021–2025 as data and SM-2 measurement), fingerprint and classification (batch step 2), `410 Gone` deletion, and the state for a subject whose own filing fails reconciliation.
**FRs covered:** FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-23, FR-57, FR-58, FR-66, FR-71, FR-28 (batch part)

### Epic 3: See every gap in kroner and what closing it is worth
The full Nøkkeltall og gap table with document figures and their kroner, both decompositions and the margin waterfall, the remaining Oversikt cards (beeswarm, Største kapitalgap, Største styrke, Mangler grunnlag), the Verdi tab (the fourth tab, added here with no placeholder before it) with the closable-share steps, "Til medianen" and EV/EBIT, the provenance drill-down "Hvordan er dette regnet?" including the hero card's link to it (left out of Story 1.9), and the no-double-counting tests.
**FRs covered:** FR-21, FR-23 (document rows), FR-24 (document rows), FR-26, FR-27 (remaining rows), FR-29 (document figures), FR-30, FR-31, FR-32, FR-60, FR-62 (Verdi tab), FR-64 (provenance), FR-71 (document rows)

### Epic 4: Understand the gaps — the explanation
Every 62.100 company has a stored explanation marked ✦, generated in batch step 2 and guarded by the FR-53 figure test, the FR-54 phrase list and the input digest; hidden when the peer group is adjusted ("Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den."), an acceptance criterion moved here from Story 2.8 because the explanation card first exists in this epic.
**FRs covered:** FR-52, FR-53, FR-54

### Epic 5: Prove it and make it runnable — measurement, demo seed and About page
The labelled set (30 × 30 in 62.100, started in week 1 as calendar work, in parallel with Epics 1–4) and the layer-by-layer ablation, with embeddings last and cut first; the demo seed with companies A, B and C, the licence gate, the allow-list test and the 30-explanation review recorded in `docs/ai-sessions/`; "Slik fungerer Peerless" completed around the "Kilder og lisens" section Story 1.6b created, with the document-figure paragraph published with the licence assessment (Story 5.4) and results once they exist; the 62.100 entry in `seed/coverage.json` set to measured: true with a reference to its measurement report (FR-3); the README proven from a fresh clone.
**FRs covered:** FR-3 (62.100 measured), FR-13 (each band kept or dropped against the labelled set), FR-54 (the 30-explanation review), FR-65 (document-figure paragraph), FR-68, FR-70, FR-72 (remaining sections), FR-73 (complete)

### Epic 6 (backlog, no stories): Stage 2 and stage 3
Every stage-2 and stage-3 FR, and the stage-2/3 parts of split FRs, as listed under "Stage 2 / Stage 3" above. Not broken into stories; AGENTS.md: no stage 2 or 3 work until v1 runs from a fresh clone.
**FRs covered:** FR-5, FR-28 (view), FR-33 to FR-51, FR-63, FR-67, and the stage-2/3 parts of FR-3, FR-6, FR-17, FR-18, FR-26, FR-52, FR-61, FR-62, FR-64, FR-66, FR-69

## Delivery order

For sprint planning. Story numbers stay as they are; three stories are split into halves numbered a and b (1.3a/1.3b, 1.6a/1.6b, 3.1a/3.1b), each half its own issue, branch and PR, built in that order. This section sets the sequence in which they are built.

- **Week 1, in parallel, calendar work:** Story 5.1 (the labelled set) and the hand-transcribed OCR reference set (the input to Story 2.3) start in week 1 and run alongside Epic 1. Both are labelling and transcription, not coding, and both must be complete before the story that consumes them starts. The reference set is a seeded random draw from all of 62.100's generated filings (Story 2.3), not from the demo set, so it does not wait for demo companies A and B, which are chosen in Story 5.4.
- **The OCR reference set has its own issue from week 1** ([#14](https://github.com/IBE160-2026/G97-meinich/issues/14)). It is not a story with a branch and PR of its own, but it is tracked as its own GitHub issue, opened in week 1, so its progress is visible before Story 2.3 starts; Story 2.3 links that issue.
- **Sequence:**
  1. Epic 1 (1.1 → 1.2 → 1.3a → 1.3b → 1.4 → 1.5 → 1.6a → 1.6b → 1.7 → 1.8 → 1.9 → 1.10)
  2. Epic 2 (2.1 → 2.9)
  3. Story 5.2, the layer-by-layer measurement, directly after Epic 2: it needs only the funnel and the labelled set, and the teacher calls the measurement the core of the project.
  4. Epic 3 (3.1a → 3.1b → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7)
  5. Story 5.4, the demo seed, directly after Epic 3, so the sensor sees document figures and kroner even if Epic 4 or the rest of Epic 5 slips.
  6. Epic 4 (4.1 → 4.4)
  7. Story 5.5, the 30-explanation review
  8. Story 5.6, "Slik fungerer Peerless" in full
  9. Story 5.3, embeddings (cut first)
  10. Story 5.7, the final fresh-clone confirmation
- **Runnability:** from Story 1.3b, CI migrates a fresh database and loads the committed seed on every pull request (AD-16), so whether Peerless runs from a fresh database is known throughout, not discovered at the end. Story 5.7 is the final confirmation on a clean machine.
- **The cut order** follows the technical note: stage 3 first, then stage 2, then embeddings (Story 5.3). The labelled set (5.1), the OCR measurement (2.3) and v1 itself are never cut.

## Epic 1: Look up a company and see where it stands — API figures and the first gap in kroner (slice 0)

Kari or Anders searches by name or organisation number and gets the company header, a peer group from funnel stages 1–3, and the key-figure table for the three API figures (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) with median, beste fjerdedel and Plassering. The driftsmargin gap is already in kroner — (beste fjerdedel − own margin) × `sumDriftsinntekter` at full convergence — shown in the table and in the Oversikt hero card "Største gap i kroner". Uncovered, no-filing and invalid-number states, URL state, rate limit, data date, source line, the front page and responsive layout from the first story. Delivers the teacher's "organisasjonsnummer → peer-gruppe → nøkkeltall og gap i kroner" early.

### Story 1.1: Toolchain and app shell from a fresh clone

As a developer or sensor cloning the repository,
I want a pinned toolchain, CI and an empty app shell that builds and renders,
So that every later story starts from the same versions, the same guards and a layout that already works at phone width.

**Implements:** FR-55, FR-73 (fresh clone, toolchain part) · **Invariants:** AD-8, AD-19 · **UX:** UX-DR1, UX-DR3, UX-DR4, UX-DR7, UX-DR34, UX-DR68, UX-DR70, UX-DR74, UX-DR77 · **Issue / branch / PR:** one issue, branch `story/1.1-toolchain-and-shell`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a fresh clone with Node from `.nvmrc` (24.21.0)
**When** the dependencies are installed with pnpm
**Then** pnpm is exactly 12.11.2, pinned in `package.json` `packageManager`
**And** `next` is exactly 16.4.0, `react` and `react-dom` exactly 19.3.0, `typescript` exactly 6.0.3 and `tailwindcss` exactly 4.3.3, each written without a range — the latest releases in those lines on 2026-10-10, checked against the npm registry (TypeScript's overall latest is 7.x; the project stays on 6.x)
**And** when a later story adds them, `shadcn` is exactly 4.21.4, `recharts` exactly 3.10.1, `postgres` exactly 3.4.9 and `decimal.js` exactly 10.6.0, unless the PR adding one records a newer patch release and why
**And** no dependency spec in `package.json` contains `^` or `~` (a CI check fails on either)

**Given** the Next.js security release announced for 2026-10-14
**When** the story's PR is reviewed before merge
**Then** the PR records whether the advisory has shipped, and if it has, `next` is pinned to the patched 16.4.x

**Given** `next.config.ts`
**When** it is read
**Then** it sets `cacheComponents: false` explicitly, using the flag name confirmed against the current Next.js docs (cited in the PR)

**Given** the ESLint configuration
**When** `Math.round` or `toFixed` appears in `src/engine/**` or in display formatting code
**Then** lint fails
**And** a fixture file using each triggers the rule in a lint test

**Given** the ESLint `no-restricted-imports` rule
**When** a `'use client'` module or a file under `src/engine/**` imports from `src/server/**` or imports `postgres`
**Then** lint fails, shown by a fixture for each of the four cases

**Given** CI on a pull request
**When** it runs
**Then** it runs lint, typecheck (`strict`, no `any`) and the test suite, and fails if any fails
**And** a grep fails on any `NEXT_PUBLIC_` variable in source or configuration; the only allowed occurrences are the two commented-out stage-2 lines in `.env.example` (AD-19)
**And** the test runner and CI provider are named in the PR, with a test runner able to run tests in a real browser engine (needed by AD-6 later)

**Given** the Tailwind theme
**When** it is read
**Then** it defines the light-mode colour tokens from DESIGN.md (including `band` `#6C7F95`), Inter with `tabular-nums` for figures, Source Serif 4 for headings only, the spacing tokens and the radii sm 3 / md 4 / lg 6 / full
**And** no dark-mode tokens are applied

**Given** any page of the app
**When** it renders
**Then** `<html lang="nb">` is set
**And** the header shows the wordmark "Peerless" linking to `/` and the link "Slik fungerer Peerless", with a 1px divider below and no menu item for a non-v1 feature
**And** the footer holds the placeholder for the source line
**And** every user-facing string comes from a message file keyed by dotted ids; a test fails on a hard-coded string in a component

**Given** the shell at 375 px and at 320 px CSS width
**When** it is rendered in a browser test
**Then** the body has no horizontal scroll (`scrollWidth` ≤ viewport width) and the header link wraps to two lines rather than overflowing

**Given** this story
**When** it is merged
**Then** no database, migration or database client exists yet

### Story 1.2: Local Supabase with roles and grants — the read boundary

As a developer,
I want local Supabase with the four batch and request roles and the `register` schema closed to the public API,
So that the read boundary is enforced by database grants before any data exists.

**Implements:** FR-73 (local Supabase, migrations) · **Invariants:** AD-3, AD-4, AD-16, AD-19 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/1.2-supabase-roles-grants`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the repository
**When** the Supabase CLI is installed through the project
**Then** its version is exactly 2.120.0, pinned without a range

**Given** `supabase/roles.sql`
**When** it is read
**Then** it creates the roles `reader`, `ingest`, `derive` and `loader`
**And** it contains no password; role passwords come from `.env` and are never committed

**Given** a freshly started local Supabase
**When** the migrations in `supabase/migrations` run
**Then** the schemas `register` and `app` exist, and `app` has no tables in v1
**And** no DDL exists outside `supabase/migrations`, apart from `CREATE ROLE` in `supabase/roles.sql`

**Given** `supabase/config.toml`
**When** it is read
**Then** `api.schemas` does not include `register`
**And** CLI auto-seeding is disabled

**Given** a migrated database
**When** the grants test runs
**Then** it asserts that `register` is not in `api.schemas`
**And** that `anon` and `authenticated` have no `USAGE` on `register`
**And** that `reader` has `SELECT` and no `INSERT`, `UPDATE`, `DELETE` or `TRUNCATE` on every table in `register`, so tables added by later migrations are covered by the same test

**Given** `.env.example`
**When** it is compared with the roles
**Then** it lists `READER_DATABASE_URL`, `INGEST_DATABASE_URL`, `DERIVE_DATABASE_URL` and `LOADER_DATABASE_URL`, and no value needs a secret to run locally

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with these grants (AGENTS.md Working style), the reasoning is recorded in `docs/ai-log.md`, and the session file is in `docs/ai-sessions/`

### Story 1.3a: Step 1 ingests register data for 62.100 and demo company C

As the owner of Peerless,
I want batch step 1 to fetch register data and API key figures for every company in a covered industry, plus demo company C, and store them as returned, in øre,
So that the seed rests on figures whose year, unit and missing values are handled correctly, and nothing is fetched at query time.

**Implements:** FR-3 (SN2025 codes only; SN2007 returns nothing), FR-4 (demo company C chosen), FR-59, FR-64 (filing year and read date stored), FR-73 (API seed: the step-1 part) · **Invariants:** AD-1, AD-2, AD-3, AD-14, AD-15, AD-18 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/1.3a-step1-register-ingest`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** batch step 1
**When** its project files are read
**Then** it is Python with `.python-version` 3.14, managed by `uv` with a committed `uv.lock`, and runs in a Docker image pinned by tag
**And** it writes through `INGEST_DATABASE_URL` as the `ingest` role and runs no DDL

**Given** the committed declaration file `seed/coverage.json`
**When** it is read
**Then** it is a JSON list of entries, each with `code` (an SN2025 code) and `measured` (boolean), plus `report` (a path under `analysis/output/`) and `sha256` (the report's checksum), both required when `measured` is true and absent otherwise; this story commits one entry, `{"code": "62.100", "measured": false}` (the loader's validation of that shape is Story 1.3b)
**And** it is the only hand-edited file under `seed/`: adding an industry means adding one line there, data and not code, and no application code names an industry (the literal `62.100` appears in no application code)

**Given** the 69.202 companies in the register
**When** demo company C is chosen
**Then** a real `69.202` company is chosen that meets every one of these criteria: an active AS (`organisasjonsform` `AS`, not bankrupt and not under liquidation or forced dissolution in Enhetsregisteret); a filing in the key-figures API for the latest filing year; `smaaForetak` true and `regnskapsregler` `regnskapslovenAlminneligRegler`; an unremarkable company, with positive `sumDriftsinntekter` and `sumEiendeler` so all three API figures are defined, and nothing in its name or figures that draws attention away from the uncovered state; and not the developer's own employer — Statement AS (979 607 008) is in `69.202` and is excluded, to keep the demo neutral
**And** its orgnr is recorded, with how it meets each criterion, in step 1's committed configuration file, which this story names (for example `ingest/config.toml`) and which step 1 reads
**And** C needs only API figures: step 1 fetches no filed document for it
**And** Story 5.4 confirms C and does not choose it again

**Given** a step-1 run
**When** it starts
**Then** it reads `seed/coverage.json` to decide which industries to fetch, and fetches the codes listed there plus demo company C from its configuration file

**Given** a step-1 run
**When** it completes
**Then** it has loaded Enhetsregisteret data and API key figures for every company whose `naeringskode1.kode` is a code in `seed/coverage.json` — in this story the SN2025 code `62.100`
**And** a company with `62.100` only as `naeringskode2` or `naeringskode3` is not loaded as a 62.100 company
**And** it has loaded demo company C's register data and API key figures (`69.202`)
**And** it has written no ratio, distribution or amount derived from the figures (AD-1)

**Given** an SN2007 code (for example `62.010`) in a fixture coverage declaration
**When** step 1 runs against a recorded register response for it
**Then** the register returns nothing for that code, step 1 loads no company for it, and the code is never treated as covered: no company is matched to it as its primary industry and the run's output names it as returning nothing (FR-3, test)

**Given** the migrations for this story
**When** they run
**Then** they create only the tables step 1 writes: the company table, the key-figure table and the per-filing table
**And** the grants give `ingest` the write grants on these tables and `reader` `SELECT` only, and `derive` and `loader` none in this story (grants test, extending Story 1.2's)
**And** every amount column is `bigint` named `<field>_ore` with a column comment stating the unit (AD-14)
**And** each filing row stores the filing year, `read_at timestamptz`, the reporting unit, a status from `reconciled` / `failed_reconciliation` / `not_extracted` / `paper`, and the comparability fields `valuta`, `regnskapsregler`, `smaaForetak`, `avviklingsregnskap`, financial period and `regnskapstype`; the company row stores `organisasjonsform`

**Given** an API response, including one from a company that reports in thousands or millions
**When** step 1 writes it
**Then** each amount is parsed as a whole number (never through a float), multiplied by 100 to øre, and an amount that is not a whole number is rejected
**And** `reporting_unit` is stored as the fixed label `api_whole_units`: the key-figures API returns whole currency units and has no unit field (verified 2026-10-11 — 923609016, which reports in USD millions, returns `sumEiendeler` 127 220 000 000), so step 1 never guesses a unit; how precise an amount is, for example when reconciling against a document in Epic 2, is computed where it is needed and not stored as a register fact

**Given** the contract test
**When** it runs step 1's writer on fixture 979607008/2025 against a freshly migrated database
**Then** the stored øre values equal the hand-checked values in the test

**Given** a request to the key-figures API for an earlier year that returns the current filing
**When** step 1 stores it
**Then** the filing year is taken from the returned `regnskapsperiode` / `id`, never the requested `år` (fixture test)

**Given** an empty XML or JSON element such as `<langsiktigGjeld/>`
**When** step 1 stores it
**Then** the column is NULL, never 0, and the stated totals are stored as filed (fixture test)

**Given** the same orgnr under two different names in two filings
**When** step 1 stores both
**Then** one company row exists, keyed on orgnr only (fixture test)

**Given** the API fields `sumInnskuttEgenkaptial` and `regnkapsprinsipper`
**When** step 1 parses them
**Then** they are read under their misspelled names, and `smaaForetak` and `regnskapsregler` come from `regnkapsprinsipper`

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with the money columns and step 1's writes (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 1.3b: The seed path — export, load and CI

As a developer or sensor running Peerless locally,
I want one deterministic export and one idempotent seed command, checked in CI on every pull request,
So that a fresh database reaches the same data every time, without calling the register.

Run records are not printed by `pnpm seed` in this story: the loader exists here, but neither step's run-record table exists until Stories 2.4 (step 1) and 2.6 (step 2), so the print is an acceptance criterion of Story 2.6.

**Implements:** FR-3 ("measured" means a referenced report exists), FR-73 (one-command idempotent seed, demo level, the committed-seed check) · **Invariants:** AD-2, AD-3, AD-9, AD-16, AD-18 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/1.3b-seed-export-load`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the migrations for this story
**When** they run
**Then** they create the seed-manifest table `register.dataset` and `register.covered_industry` (industry code, measured true/false, and the report path and checksum when measured)
**And** the grants give `loader` the write grants it needs to truncate and replace every `register` table, and the only write grant on `register.dataset` and `register.covered_industry`; `ingest` and `derive` have none on those two (grants test)

**Given** a database loaded by step 1 (Story 1.3a)
**When** `pnpm seed:export` runs
**Then** it writes the seed files deterministically (sorted, stable formatting) with a manifest recording the seed-format version, the latest migration id, the dataset `demo`, the industry codes step 1 fetched (`62.100`), the orgnrs with document figures (none in this story), the read-date range, and every file with its checksum
**And** it never writes `seed/coverage.json`

**Given** the committed seed and a freshly migrated database
**When** `pnpm seed` runs
**Then** it truncates and replaces through `LOADER_DATABASE_URL`, loads only manifest-listed files, and stores the manifest as one row in `register.dataset`
**And** `read_at` survives export and load unchanged (AD-18)
**And** the loader writes `register.covered_industry` from `seed/coverage.json` — one row, `62.100`, measured: false — and no batch step writes that table (AD-2)
**And** a schema check in the loader rejects any `seed/coverage.json` whose shape differs from Story 1.3a's definition
**And** the loader refuses a declared code that is not among the manifest's fetched codes, so an industry is never offered before its data is loaded (test)
**And** running `pnpm seed` twice leaves the same state (idempotence test)

**Given** a manifest whose version or migration id does not match, or a seed file that is unlisted or fails its checksum
**When** `pnpm seed` runs
**Then** it refuses and loads nothing

**Given** a `seed/coverage.json` entry with `measured: true`
**When** `pnpm seed` runs
**Then** the loader accepts it only if the entry has a `report` path under `analysis/output/` and a `sha256`, the file exists, and its SHA-256 matches
**And** loader tests cover three fixtures — `measured: true` with no report reference, with a reference to a missing file, and with a checksum mismatch — and in each the loader fails loudly (non-zero exit, a message naming the entry and the failed check) and loads nothing, leaving the database as it was
**And** a fourth fixture with a matching report is accepted

**Given** CI on every pull request, from this story on
**When** the seed job runs
**Then** it starts a fresh local database, applies every migration, and loads the committed demo seed with `pnpm seed`, failing the PR if any step fails, so runnability from a fresh database is known throughout development (AD-16); Story 5.7 is then the final confirmation on a clean machine
**And** `seed:export` writes `seed/allow-list.json` from this story on, each entry an orgnr with its reason; it is an empty list until Story 2.3 adds the OCR reference filings and Story 5.4 adds A, B, C and A's and B's peers
**And** the allow-list test reads every committed seed file against `seed/allow-list.json` and fails on a document figure for any unlisted orgnr; it passes now (no document figures) and a fixture with an unlisted document figure makes it fail

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with the loader's writes and its refusals (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 1.4: The engine calculates and formats correctly

As a sensor checking the arithmetic,
I want a pure engine that computes the three API key figures and their distributions exactly, and one formatter that renders them identically everywhere,
So that every figure on screen can be traced to a hand calculation and no float or locale difference creeps in.

**Implements:** FR-21 (API figures), FR-22, FR-24, FR-27 (API rows), NFR28 (SM-6: the reference cases for the API figures) · **Invariants:** AD-1, AD-8 · **UX:** UX-DR78 · **Issue / branch / PR:** one issue, branch `story/1.4-engine-format`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** `src/engine`
**When** its imports are checked
**Then** it imports nothing from the database, Next.js, React or `src/server/**`
**And** it exports the one configured decimal.js constructor, a `Decimal.clone` from decimal.js exactly 10.6.0 with precision and rounding mode fixed there, and no other decimal constructor is used in the project

**Given** `sumDriftsinntekter`, `driftsresultat`, `sumEiendeler` and `sumEgenkapital` in øre
**When** the engine computes the key figures
**Then** operating margin = `driftsresultat / sumDriftsinntekter`, return on assets = `driftsresultat / sumEiendeler`, equity ratio = `sumEgenkapital / sumEiendeler`, as exact decimals per `docs/key-figures.md`

**Given** a denominator that is zero or negative, or a component that is missing and cannot be derived from its stated total
**When** the figure is computed
**Then** it is undefined, never zero, and the engine's result type names the absence reason (undefined, below floor, not in dataset, failed reconciliation — AD-15)
**And** an undefined peer leaves only that figure's distribution, and the left-out count is returned

**Given** a list of peer values
**When** median and quartiles are computed
**Then** they match Excel `PERCENTILE.INC` (linear interpolation, inclusive) on test vectors with odd and even counts and ties
**And** beste fjerdedel is the upper quartile where higher is better and the lower quartile where lower is better; equity ratio (no direction) gets neither beste fjerdedel nor percentile

**Given** a subject value and peer values with a direction
**When** the percentile is computed
**Then** it equals `(worse + 0.5 × equal) / n × 100` in the favourable direction, exact, and formats as a whole percent (e.g. "61 %")

**Given** a figure with fewer than 10 peers with a defined value, counted per figure after undefined peers are left out
**When** its comparison is requested
**Then** no median, beste fjerdedel, percentile or kroner amount is returned, the subject's own value is returned with the count, and synthetic cohorts of 9 and 10 assert that nothing escapes at 9 and the comparison exists at 10
**And** a comparison is returned only when subject and peers have the figure from the same source

**Given** the rounding function
**When** it rounds ties
**Then** it rounds half away from zero via decimal.js: −2.5 → −3, 2.5 → 3, −0.05 % → "−0,1 %", 0.05 % → "0,1 %"

**Given** `src/engine/format.ts`
**When** its unit tests run
**Then** they pin the exact bytes: U+00A0 as thousands separator and before "kr" and "%", a decimal comma, U+2212 as minus — e.g. "1 170 000 kr", "−501 428 kr", "2,1 %", "16,7 mill. kr", "7,0 pp", orgnr grouped 3-3-3
**And** the formatter takes decimal strings, and `Intl.NumberFormat` is not used for any figure (a test or lint rule fails on it)

**Given** reference cases hand-calculated from real filed accounts, chosen in this story and not tied to the demo companies (C is chosen in Story 1.3a, A and B in Story 5.4)
**When** the engine runs them
**Then** every expected value matches, including a company with negative equity, one with zero revenue and one with a missing component
**And** each case records its orgnr and filing year, and the PR lists the hand calculation behind each expected value

**Given** postgres.js returning `int8` and `numeric` as strings
**When** the read layer maps them to engine inputs
**Then** they are parsed to `bigint` or `Decimal`, never through `Number()`, and a value above 2^53 øre survives exactly (test)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with money handling (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 1.5: Find a company by name or organisation number

As Kari or Anders,
I want one search field that finds a company by name or organisation number,
So that I can reach a company's analysis without knowing anything but its name or number.

**Implements:** FR-1, FR-61, NFR30 (SM-8: an organisation number is all a complete analysis needs) · **Invariants:** AD-4, AD-5, AD-12, AD-19 · **UX:** UX-DR8, UX-DR9, UX-DR34, UX-DR36, UX-DR42, UX-DR43, UX-DR44, UX-DR45, UX-DR60, UX-DR61, UX-DR63, UX-DR65, UX-DR67, UX-DR69, UX-DR71 · **Issue / branch / PR:** one issue, branch `story/1.5-search`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the front page `/`
**When** it renders
**Then** its title is "Peerless" and it shows one headline (`h1`) plus one sentence stating that v1 covers 62.100, the hero search field, "Slik fungerer det" as three numbered steps, and a link to "Slik fungerer Peerless"
**And** the header search is hidden, and there is no "Kom i gang" or other SaaS button
**And** the footer shows "Data fra Brønnøysundregistrene, bearbeidet av Peerless · Kilder og lisens", with "Kilder og lisens" linking to the sources section of `/slik-fungerer-peerless`

**Given** `GET /api/sok?q=`
**When** it is called with a name or a nine-digit orgnr
**Then** it returns at most 8 rows, each with name, orgnr, primary industry (`naeringskode1`) and municipality, and no other field (a test asserts the response keys)
**And** it reads through `reader` from Peerless's own database, matching names with `pg_trgm` over an index on an IMMUTABLE `unaccent` wrapper and orgnrs by an exact index, and never calls the register (no-network test)
**And** it never filters on a financial criterion

**Given** the built route manifest
**When** the route-manifest test runs
**Then** it fails on any surface other than `GET /`, `/slik-fungerer-peerless`, `/analyse/{orgnr}`, `/analyse/{orgnr}/{fane}` (with RSC payloads) and `GET /api/sok`
**And** it fails on any server action

**Given** search input
**When** it is validated on submit or blur (never while typing)
**Then** spaces are stripped; digits-only input with a count other than nine shows "Organisasjonsnummeret må ha 9 siffer"; nine digits failing the modulus-11 check (weights 3, 2, 7, 6, 5, 4, 3, 2) show "Ugyldig organisasjonsnummer"; any other input is a name search
**And** unit tests cover a valid orgnr, a mistyped one, one with spaces ("912 345 678" form), eight and ten digits, and a name containing digits
**And** an error sets a 2px unfavourable border and glyph, `aria-invalid="true"`, `aria-describedby` to the message, and the message in the field's live region

**Given** an empty field
**When** it is submitted
**Then** "Skriv inn et navn eller et organisasjonsnummer" is shown and no request is made

**Given** typing in the field
**When** input pauses for 300 ms
**Then** one request is made and up to 8 results show in an ARIA 1.2 combobox: the input has `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`; results are a `listbox` of `option`s showing name, then orgnr · industry · municipality
**And** arrow keys move, Enter opens the active result, Esc closes the list, and nothing navigates on input alone (typing the ninth digit opens nothing)
**And** a polite live region, present empty from page load, announces "{n} treff"

**Given** a result chosen by Enter or click, or a submitted nine-digit orgnr that matches exactly
**When** it is acted on
**Then** the app navigates to that company's analysis resolved on orgnr

**Given** a name search with no match
**When** results return
**Then** "Ingen treff på «{q}». Peerless har foreløpig bare selskaper i programmeringstjenester (62.100)." is shown in the same live region, with links to demo companies A and B

**Given** a valid nine-digit orgnr not in the database
**When** it is submitted
**Then** "Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi programmeringstjenester (62.100)." is shown with links to demo companies A and B, and no register call is made
**And** until Story 5.4 chooses demo A and B, the links are placeholders; the AC is met with placeholders and the PR says so

**Given** a submitted search
**When** it is loading
**Then** the field is read-only, the button disabled, and "Henter analysen …" is announced once; a spinner shows only when `prefers-reduced-motion` is not set

**Given** a failed search request
**When** it fails
**Then** `role="alert"` shows "Noe gikk galt. Prøv igjen om litt." and no partial result

**Given** the front page at 375 px and 320 px
**When** it renders
**Then** the field and a full-width button stack, the steps stack, every target is at least 24 × 24 px, and the body does not scroll horizontally

**Given** the request path's database access, first introduced by `/api/sok` in this story
**When** the codebase is checked
**Then** `READER_DATABASE_URL` is read only in `src/server/db.ts`, which begins with `import 'server-only'` and holds one postgres.js client per process (AD-19)
**And** a grep test fails if `READER_DATABASE_URL` appears in any other source file, or if `src/server/db.ts` does not begin with `import 'server-only'`

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — the search endpoint's data access and what it may return (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 1.6a: One module reads and writes the analysis URL

As a developer building every later control,
I want one module that parses and serializes the analysis URL, with every parameter and fallback under test,
So that a link reproduces the analysis exactly, and no invalid value reaches the engine or is dropped silently.

**Implements:** FR-69 · **Invariants:** AD-5 · **UX:** UX-DR46, UX-DR79 · **Issue / branch / PR:** one issue, branch `story/1.6a-url-module`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** `src/url/analysis-state.ts`
**When** the codebase is checked
**Then** it is the only module that parses or builds an analysis URL, exporting `parse` and `serialize`, and it imports only from `src/engine`

**Given** the URL grammar
**When** the unit tests run
**Then** they cover as input every parameter and every fallback: path `/analyse/{orgnr}/{fane}` with `fane` ∈ `oversikt`, `peers`, `nokkeltall`, `verdi`; `ekskl` (sorted, de-duplicated, at most 20, each nine digits passing modulus 11); `band` ∈ `0`, `1`, `2`; `andel` ∈ `0`, `25`, `50`, `75`, `100`, `median`; `multippel` in (0, 50] in steps of 0.1, written with a point and read with a point or a decimal comma
**And** a parameter at its default is omitted, and `serialize(parse(url))` is canonical for every test URL
**And** an unknown tab falls back to Oversikt; exclusions beyond 20 are dropped; an invalid `band`, `andel` or `multippel` falls back to Standard / 50 % / empty; each fallback sets the invalid-settings flag
**And** these tests exist before Epic 2 adds any control

**Given** `andel=median`
**When** it is parsed
**Then** whether a median step exists is an input to the module — a predicate supplied by the caller, because no engine computes s_med until Story 3.5 — and the test supplies it both ways: where it is false, `andel` falls back to 50 % and sets the invalid-settings flag; where it is true, `median` is kept

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — URL input reaching the engine (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 1.6b: Open an analysis in the right state

As Kari or Anders,
I want an analysis URL that always opens in the right state for the company,
So that a link I copy reproduces what I saw, and a company Peerless cannot analyse says why instead of showing an empty page.

This story builds on the URL module from Story 1.6a.

**Implements:** FR-2, FR-3, FR-4, FR-62 (three tabs), FR-64, FR-65, FR-69, FR-72 ("Kilder og lisens" section only) · **Invariants:** AD-2, AD-4, AD-5, AD-12, AD-15, AD-18, AD-19 · **UX:** UX-DR10, UX-DR11, UX-DR30, UX-DR34, UX-DR35 (sources section only), UX-DR41, UX-DR42, UX-DR46, UX-DR60, UX-DR61, UX-DR62, UX-DR63, UX-DR66, UX-DR79, UX-DR80 · **Issue / branch / PR:** one issue, branch `story/1.6b-analysis-route-states`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** an analysis URL with any fallback applied
**When** the page renders
**Then** one slate notice under the company header reads "Noen innstillinger i lenken var ugyldige og er satt tilbake til standard." and is announced once after load

**Given** an orgnr in the URL that is not nine digits, or fails modulus 11
**When** the URL is requested
**Then** the front page shows the search field with "Organisasjonsnummeret må ha 9 siffer" or "Ugyldig organisasjonsnummer" respectively

**Given** a covered company (its `naeringskode1.kode` has a row in `register.covered_industry`, which the loader writes from `seed/coverage.json`; the literal `62.100` appears in no application code)
**When** `/analyse/{orgnr}` is requested
**Then** it redirects to `/analyse/{orgnr}/oversikt`
**And** the company header shows the name (`h1`, `company-name`), orgnr grouped 3-3-3, primary industry, "Omsetning x mill. kr", and "Regnskapsår YYYY · hentet D. mon. YYYY"
**And** the filing year comes from the stored `regnskapsperiode`, and the read date is formatted on the server in `Europe/Oslo` (test: `read_at` 2026-10-02T23:30Z renders "hentet 3. okt. 2026")
**And** a company renamed between filings shows as one company under its current name

**Given** a covered company's analysis
**When** it renders
**Then** during Epics 1–2 three tabs — Oversikt, Peers, Nøkkeltall og gap — are links to `/analyse/{orgnr}/{fane}`, all open, with `aria-current="page"` on the active one, fitting at phone width by wrapping with no scroll strip
**And** no Verdi tab or placeholder for it is rendered; Verdi is added by Epic 3, and until then a `verdi` path renders Oversikt as an unknown tab would
**And** the page title is "{Selskap} – {Fane} – Peerless"
**And** a tab change pushes a history entry, keeps the other URL parameters, and moves focus to the panel's `h2`; a route change moves focus to `h1`

**Given** demo company C (`69.202`, uncovered), chosen in Story 1.3a and read from step 1's configuration file
**When** `/analyse/{orgnr}` is requested
**Then** it shows the company header with no tabs, a State block with kicker "Bransjen er ikke dekket ennå" and "{Bransjenavn} ({kode}) er ikke dekket ennå. Foreløpig sammenligner Peerless bare selskaper innen programmeringstjenester (62.100). Her er selskapets egne nøkkeltall fra Brønnøysundregistrene." (for C: its industry name and `69.202`), the three API figures (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) from the latest year with filing year and read date, "Uten sammenlignbare selskaper viser vi ingen median, plassering eller kroner." and the link "Søk på et annet selskap"
**And** no peer group, median, beste fjerdedel, Plassering or kroner is computed or shown
**And** `/analyse/{orgnr}/{fane}` for C redirects to `/analyse/{orgnr}`
**And** C's real orgnr is used throughout; unlike A and B, C needs no placeholder

**Given** a 62.100 company in the register with no filing in the loaded seed
**When** its analysis is requested
**Then** the header shows identification only (name, orgnr, industry, municipality), no figures and no tabs, with "Vi har ikke et levert regnskap for dette selskapet ennå."
**And** `/analyse/{orgnr}` is the result, and `/analyse/{orgnr}/{fane}` for that company redirects to it, as for an uncovered company

**Given** a valid nine-digit orgnr not in the database
**When** its analysis URL is requested
**Then** it shows "Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi programmeringstjenester (62.100)." with links to demo companies A and B, and makes no register call
**And** the links are placeholders until Story 5.4 chooses demo A and B; the AC is met with placeholders and the PR says so

**Given** an analysis being rendered
**When** it is loading or the request path errors
**Then** loading sets `aria-busy` on `main` with `Skeleton` placeholders in the card layout; an error renders `role="alert"` "Noe gikk galt. Prøv igjen om litt." with no partial figures

**Given** any analysis request
**When** it is served
**Then** nothing is written to any table and nothing to browser storage (test), and the state lives in the URL only

**Given** the request path
**When** the service-role test runs
**Then** it asserts that the service-role key is never read by request-path code: no service-role variable is set in v1 (`.env.example` has `SUPABASE_SERVICE_ROLE_KEY` only as a commented-out stage-2 line), and a grep over `src/app`, `src/server` and the proxy fails on any reference to `SUPABASE_SERVICE_ROLE_KEY` or any reference to the service-role key (AD-4, AD-19)

**Given** `/slik-fungerer-peerless`
**When** it renders
**Then** its title is "Slik fungerer Peerless – Peerless", its `h1` is "Slik fungerer Peerless", and it holds only the section "Kilder og lisens" (`h2`); every other section is added by Epic 5, with no placeholder before then
**And** the section credits Brønnøysundregistrene as the source, gives the NLOD credit for API figures verbatim — "Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene" — declares that Peerless has processed the data, and states that Brønnøysundregistrene does not endorse Peerless (FR-65)
**And** the NLOD credit is attached to the API figures only; no document-derived figure is shown in Epic 1, and the document-figure paragraph is added by Story 5.4 with the licence assessment
**And** the header link "Slik fungerer Peerless" and the footer link "Kilder og lisens" resolve on every page, the latter to the section's anchor (link test)
**And** at 375 px and 320 px the body does not scroll horizontally

**Given** each state above at 375 px and 320 px
**When** it renders
**Then** the body does not scroll horizontally

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — the read path, the payload and the service-role boundary (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 1.7: Peerless finds comparable companies, stages 1–3

As Kari or Anders,
I want Peerless to assemble a peer group of genuinely comparable companies from stored data,
So that every comparison is against companies of the same industry, size and accounting basis.

**Implements:** FR-7, FR-8, FR-9, FR-20, FR-25, FR-56, FR-59, NFR1, NFR27 (SM-5: assembly under 1 s) · **Invariants:** AD-1, AD-4, AD-5, AD-6, AD-7 · **UX:** UX-DR37, UX-DR68, UX-DR78 · **Issue / branch / PR:** one issue, branch `story/1.7-funnel-stages-1-3`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a covered subject
**When** the benchmark year is determined
**Then** it is the subject's latest filed year from stored data, with no clock involved
**And** a candidate without a filing for that year is excluded

**Given** funnel stage 1
**When** it runs
**Then** candidates have the subject's `naeringskode1.kode` and a `sumDriftsinntekter` from the benchmark-year filing within the size band of the subject's `sumDriftsinntekter` from the same filing: 0.5–2× at `band=0` (default), 0.33–3× at `band=1`, 0.25–4× at `band=2`, read from the URL
**And** every band includes both bounds — [0.5×, 2×], [0.33×, 3×], [0.25×, 4×] — computed exactly in decimals: a bound test puts candidates at exactly 0.5× and 2× of the subject's revenue (in øre) inside the default band, and candidates one øre below 0.5× and one øre above 2× outside it, and does the same at the other two steps
**And** neither `sumEiendeler` nor the register's employee count is used (test)

**Given** funnel stage 2
**When** it runs
**Then** it hard-excludes every candidate that differs from the subject on `valuta`, `regnskapsregler`, `smaaForetak`, `avviklingsregnskap`, financial period or `regnskapstype`, and only calendar-year filings pass (a test per field with a candidate differing on that field alone)

**Given** funnel stage 3
**When** it runs
**Then** it applies legal form only, admitting `AS` only; it does not segment by size again (stage 1's band is the only size step) and applies no geography, since `62.100` does not call for it (FR-9)
**And** the engine returns the count surviving each stage-3 criterion separately — in v1 one criterion, legal form — so a later industry that adds geography adds a count, not a code path (the user-facing "AS only" wording is shown with the funnel in Story 2.7)

**Given** a subject in a covered industry whose `organisasjonsform` is not `AS`
**When** `/analyse/{orgnr}` is requested
**Then** it shows the company header with no tabs, a State block with kicker "Peerless sammenligner foreløpig bare aksjeselskaper" and "Her er selskapets egne nøkkeltall fra Brønnøysundregistrene.", the three API figures from its latest filing with filing year and read date (or, with no filing, the no-filing state from Story 1.6b), "Uten sammenlignbare selskaper viser vi ingen median, plassering eller kroner." and the link "Søk på et annet selskap"
**And** no peer group, median, beste fjerdedel, Plassering or kroner is computed or shown, and `/analyse/{orgnr}/{fane}` redirects to `/analyse/{orgnr}` (tests, and at 375 px and 320 px the body does not scroll horizontally)

**Given** `ekskl` in the URL
**When** the peer group is assembled
**Then** the excluded orgnrs leave the group used for every aggregate
**And** an excluded orgnr outside the candidate pool (stages 1–3 at the current band step) is dropped and raises the invalid-settings notice; the URL module's tests cover this case with a supplied pool

**Given** the analysis header
**When** a peer group exists
**Then** it shows the number of comparable companies in the group

**Given** the Peers tab of a covered subject
**When** it renders
**Then** its panel (`h2`) lists the stages 1–3 peer group, one row per peer with name, revenue ("x mill. kr" from `sumDriftsinntekter` of the benchmark-year filing, via the one formatter) and municipality, sorted by revenue, and the count of peers
**And** the list sits in a scroll container (`overflow-x: auto`, `tabindex="0"`, `role="region"`, descriptive `aria-label`), and at 375 px and 320 px it reflows to one entry per row with no horizontal body scroll
**And** the page payload carries no field for these peers beyond what the list and the shown figures need (AD-4)
**And** funnel counts, "Hvorfor med", match basis, exclude and widen are not part of this story (Epic 2 builds on this list)

**Given** the seeded 62.100 dataset
**When** a peer group is assembled for a subject
**Then** it returns in under 1 s from stored key figures (timed test)
**And** no document is fetched or OCR'd, no register call and no model call is made; a test asserts no outbound request to the register or a model host during an analysis

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — the data the request path reads, the peers the payload exposes, and selection on the wrong basis (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 1.8: The key-figure table with the three API figures and the margin in kroner

As Kari or Anders,
I want the Nøkkeltall og gap tab to show where the company stands on the three API figures, with the driftsmargin gap in kroner,
So that I see how far the company is from beste fjerdedel and what that gap is worth per year.

**Implements:** FR-22, FR-24, FR-27 (API rows), FR-29 (API part: driftsmargin), FR-55, FR-56 · **Invariants:** AD-1, AD-4, AD-8 · **UX:** UX-DR2, UX-DR5, UX-DR16, UX-DR17, UX-DR18, UX-DR37, UX-DR38, UX-DR39, UX-DR51, UX-DR58, UX-DR72, UX-DR75 · **Issue / branch / PR:** one issue, branch `story/1.8-key-figure-table-api`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a covered subject with at least 10 comparable peers per figure
**When** the Nøkkeltall og gap tab renders
**Then** a real `<table>` with a caption shows rows for Driftsmargin, Totalkapitalrentabilitet and Egenkapitalandel, each with own value, median, beste fjerdedel, Plassering ("bedre enn 61 %", whole percent), a distribution strip and the gap in kroner
**And** each row's subline reads direction · "{n} sammenlignbare brukt · {k} utelatt"
**And** each row with a band shows its midtre halvdel as text ("midtre halvdel 18,4–49,0 %"; "midtre halvdel −6,3 til 9,1 %" when a bound is negative)
**And** the table carries the top note "Viser gap ved full tilnærming" (the "· Endre i Verdi" part and its link are added by Story 3.5, when the Verdi tab exists; no dead reference before then)

**Given** the distribution strip
**When** it renders
**Then** it shows the company dot in `signature` with a 2px navy-900 outline, the median as a vertical tick, beste fjerdedel as a hollow downward triangle, and the midtre halvdel as a `band` on the divider track
**And** a lower-is-better row is mirrored so better is to the right with "Bedre →" (component test with a lower-is-better fixture)
**And** the strip is `aria-hidden` and not in the tab order; the cells and the midtre halvdel text carry every value, so the table is the strip's text alternative and no "Vis tallene" toggle is added (EXPERIENCE, Distribution strip)
**And** no red or green is used, and direction is always an arrow or a word

**Given** driftsmargin worse than beste fjerdedel
**When** its kroner cell renders
**Then** it shows (beste fjerdedel − own margin) × `sumDriftsinntekter` at full convergence, computed on the exact revenue in øre and rounded once to whole kroner (test: margin 351 000 / 16 714 286 and beste fjerdedel 0,091 give "1 170 000 kr"; the same with a revenue rounded to 16,7 mill. kr gives a different amount and is not what is shown)

**Given** driftsmargin at or above beste fjerdedel
**When** its kroner cell renders
**Then** it shows "▲ Styrke" and no amount (test includes own = beste fjerdedel)

**Given** Totalkapitalrentabilitet
**When** its row renders
**Then** its kroner cell reads "Ingen kronebeløp" and shows no amount (`docs/key-figures.md`: none), on desktop and in the phone expansion row

**Given** Egenkapitalandel
**When** its row renders
**Then** it shows own, median, "Midtre halvdel: x–y %", "Ingen retning", no beste fjerdedel, no Plassering and no kroner; inapplicable cells carry sr-only "ikke relevant – ingen retning"; its strip is unmirrored with no "Bedre" label

**Given** a figure with fewer than 10 comparable peers
**When** its row renders
**Then** it keeps the own value, and the comparison cells are one merged italic slate cell "For få sammenlignbare (n av 10)" whose `headers` names every spanned column (no `colspan` breaking header association), with no kroner
**And** the subline keeps the count and "{k} utelatt"

**Given** a subject whose filing has `smaaForetak` false
**When** any of its comparisons falls below the 10-peer floor
**Then** the tab shows "Peerless sammenligner foreløpig bare små foretak" once, in a State block above the table, in addition to the below-floor cells
**And** it is not shown for a `smaaForetak` subject below the floor, nor for a non-small subject whose comparisons all clear the floor (component tests for all three)

**Given** the subject's own value undefined (e.g. zero revenue)
**When** its row renders
**Then** the own cell reads "Kan ikke beregnes" with "omsetningen er null eller negativ" or "en regnskapslinje mangler", with no median, beste fjerdedel, Plassering or kroner, and the subline keeps the peer count

**Given** the table at desktop width
**When** it overflows
**Then** it sits in a scroll container with `overflow-x: auto`, `tabindex="0"`, `role="region"`, `aria-label` "Nøkkeltall, kan rulles sideveis", a visible focus style and an edge fade

**Given** the table at 375 px and 320 px
**When** it renders
**Then** it is a real three-column table (Nøkkeltall · own · Gap i kroner) whose row name is a `button` with `aria-expanded` / `aria-controls` opening a full-width expansion row with median, beste fjerdedel, Plassering, midtre halvdel, direction, count and kroner
**And** below-floor cells read "For få (n av 10)"
**And** no column has a fixed width that cannot shrink, and the body does not scroll horizontally

**Given** the rendered page
**When** its payload is inspected
**Then** it contains only the figures of this analysis, including each peer value behind each shown figure (AD-4)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — the kroner amount, its rounding, and what the payload exposes (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 1.9: Oversikt shows the biggest gap first

As Kari or Anders,
I want the Oversikt tab to lead with the driftsmargin gap in kroner,
So that the most important number is the first thing I see, on a laptop or a phone.

**Implements:** FR-29 (API part: driftsmargin), FR-55 · **Invariants:** AD-4, AD-8 · **UX:** UX-DR6, UX-DR12, UX-DR47, UX-DR74 · **Issue / branch / PR:** one issue, branch `story/1.9-oversikt-hero`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** driftsmargin worse than beste fjerdedel with at least 10 comparable peers
**When** Oversikt renders
**Then** the hero card shows kicker "Største gap i kroner", a direction tag, the full-convergence amount, "per år ved full tilnærming til beste fjerdedel", own vs beste fjerdedel, and a context line with median, Plassering and the pp to beste fjerdedel
**And** the top note "Viser gap ved full tilnærming" (the "· Endre i Verdi" part and its link are added by Story 3.5, when the Verdi tab exists; no dead reference before then) and the link "Se alle nøkkeltall" to the `nokkeltall` tab
**And** the amount is byte-identical to the driftsmargin kroner cell in the Nøkkeltall og gap table for the same URL

**Given** driftsmargin at or beyond beste fjerdedel
**When** the hero renders
**Then** the kicker is unchanged, it shows "▲ Styrke", own vs beste fjerdedel, the context line and "Driftsmarginen er på eller over beste fjerdedel. Det er ikke noe gap å regne om til kroner.", and no amount

**Given** driftsmargin below the 10-peer floor
**When** the hero renders
**Then** it shows the own value and "For få sammenlignbare (n av 10)", and no amount

**Given** the seeded database
**When** the end-to-end test runs in a real browser
**Then** it searches for a 62.100 company, opens it, lands on `/analyse/{orgnr}/oversikt` with focus on `h1`, and finds the hero amount equal to the engine's output for that company

**Given** Oversikt at 375 px and 320 px
**When** it renders
**Then** it is one column with the hero first, and the body does not scroll horizontally

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — the hero amount differing from the table's, and its rounding (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 1.10: The open route is rate-limited without storing anyone

As the owner of Peerless,
I want every open surface limited per IP without recording any IP,
So that the dataset cannot be harvested through the open route, and v1 still stores nothing about its visitors.

**Implements:** FR-6 · **Invariants:** AD-10, AD-12, AD-19 · **UX:** UX-DR59 · **Issue / branch / PR:** one issue, branch `story/1.10-rate-limit`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the Next.js proxy
**When** any AD-12 surface is requested (pages, RSC payloads, soft navigations and `/api/sok`)
**Then** it passes through one per-IP in-memory counter held on `globalThis`
**And** search and analysis renders count against separate budgets set in one config module

**Given** requests from one IP within budget
**When** they arrive
**Then** they are served normally (test)

**Given** requests from one IP over its budget
**When** the next one arrives
**Then** it is refused with `role="alert"` "Det er gjort mange oppslag fra denne adressen på kort tid. Vent litt, og prøv igjen." and no figures, never a partial analysis (test for an analysis page and for `/api/sok`)

**Given** the search budget exhausted
**When** the same IP requests an analysis within the analysis budget
**Then** it is served, and the reverse holds (test that the budgets are separate)

**Given** the server logger
**When** requests are served or refused
**Then** it writes structured logs with no IP address, no personal data and no request headers
**And** a test with a sentinel IP asserts that it appears in no log output, no database table and no file after requests within and over budget

**Given** the README
**When** it is read
**Then** it runs the app with `pnpm start`, not `next dev`
**And** it documents the limiter as a known v1 limitation (one process, not shared across instances) and states that persistent rate limiting is a gate before any public deployment

**Given** the refusal state at 375 px and 320 px
**When** it renders
**Then** the body does not scroll horizontally

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with the limiter and the logger (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

## Epic 2: Trust the peer group

The user sees why each company was chosen: funnel counts per stage, "Hvorfor med", "Grunnlag for treff" and "Usikker klassifisering" per peer, and can exclude a peer or widen the size band. Behind it: OCR, reconciliation and per-filing status (batch step 1, 2021–2025 as data and SM-2 measurement), fingerprint and classification (batch step 2), `410 Gone` deletion, and the state for a subject whose own filing fails reconciliation.

### Story 2.1: Read the filed accounts (OCR)

As the owner of Peerless,
I want batch step 1 to read the figures from every filed 62.100 document for 2021–2025 and store them exactly as filed,
So that the document-derived key figures rest on pre-warmed, traceable figures and nothing is ever read at query time.

This story builds on the spike in `analysis/ocr/` (`ocr_accuracy.py`, `era_screening.py`, `Dockerfile`) and its measurement in `analysis/output/ocr-consistency.md`; it does not start from scratch.

**Implements:** FR-28 (batch part: 2021–2025 extracted as data), FR-59, FR-64 (read date per filing) · **Invariants:** AD-1, AD-2, AD-3, AD-9, AD-14, AD-15, AD-18 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/2.1-ocr-filed-accounts`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the repository
**When** its Dockerfiles are listed
**Then** exactly one image installs Tesseract: the existing `analysis/ocr/Dockerfile` is moved into step 1's image or step 1's image (Story 1.3a) is extended with it, never duplicated, and the spike scripts in `analysis/ocr/` run against that one image (a CI check fails on a second Dockerfile installing Tesseract)
**And** the image runs Tesseract 5.5 (`tesseract --version` reports 5.5.x in a container test) with `nor.traineddata` from `tessdata_best`, fetched at a pinned commit and verified against a recorded checksum

**Given** step 1 run over 62.100
**When** it completes
**Then** it has fetched every filed document for 2021–2025 of every company whose `naeringskode1.kode` is `62.100`, matched to the company on orgnr only, never on name
**And** each document's filing year is taken from the document and the returned filing `id` / `regnskapsperiode`, never from a requested `år`
**And** no document is fetched or OCR'd outside a batch run; the no-outbound-request test of Story 1.7 still passes during an analysis

**Given** a filed document
**When** its first page is classified
**Then** it is generated only if the heading of the generated section ("GENERELL INFORMASJON") is found, and paper if the paper cover form ("VEDLEGG TIL") is found; a paper filing is stored with status `paper` and never read
**And** a paper cover form is never classified as generated, even though it contains "regnskapsåret" (regression test: spike error 1, a fixture of a paper cover form)

**Given** a generated filing
**When** its pages are read
**Then** words are grouped into rows by vertical position and into the two figure columns (this year, last year) by position against the column edges taken from the year header, as in the spike
**And** a figure is assembled only from digit groups of the generated layout (a leading group of 1–3 digits, then groups of exactly 3, at most one space apart); anything else yields no figure, never a guess

**Given** the combined read
**When** a page is processed
**Then** the plain pass runs first; the digits-only pass (`tessedit_char_whitelist`) is used only for a figure the plain pass did not yield, and its figure is kept only if the column then reconciles within the document; otherwise the figure is absent
**And** a regression test reproduces spike error 4: a fixture where the digits-only pass drops a digit in the older font ("622821" for 6 228 521) and the stored figure is the plain pass's 6 228 521, or absent, never 622 821

**Given** a row label
**When** it is matched to a target field
**Then** exact matches on the normalised label (joined with label-only lines directly above it) are tried first across all pages; a fuzzy match is tried only for a field no row matched exactly, and only against the row's own label when its normalised length is within one character of the target
**And** the matcher tolerates the older font's s→o substitution: "Driftoreoultat" matches `driftsresultat` (test)
**And** regression tests reproduce spike error 3: "Annen driftskostnad" never matches "Sum driftskostnad", and "Sum innskutt egenkapital" never matches "Sum egenkapital"

**Given** OCR look-alikes in figures and labels — `이`, `o` or `O` for `0`, `l` for `1`, a Cyrillic `Р` inside `RESULTATREGNSKAP`, lost Norwegian diacritics ("Lonnskostnad", "Arsresultat")
**When** step 1 parses them
**Then** label and heading normalisation folds diacritics and known look-alike letters so that the heading and labels still match (tests for the Cyrillic heading and the diacritic-free labels)
**And** a figure token containing any non-digit character is never repaired into a digit: the figure is absent (tests for `이`, `o` and `l` in a figure)
**And** split or merged figures are not trusted on recognition alone: fixtures reproducing `722 632 310` for 72 632 310 and `8 335 514` for 833 514 make their column fail the within-document check used by the combined read, and that result is stored with the filing (acceptance itself is Story 2.2)

**Given** files passed into the container (todo lists, filenames)
**When** step 1 writes them on any host
**Then** they are written with LF line endings, and the repository's `.gitattributes` keeps step 1's files LF (regression test: spike error 2, a list written on Windows reaches the container without `\r`)

**Given** an extracted filing
**When** step 1 stores it
**Then** every figure is stored as filed in `bigint` øre (`<field>_ore`, unit comment), NULL for an element that is absent or unreadable, never 0, with its stated totals and never a derived value (AD-14, AD-15)
**And** both columns are stored: this year's, and the prior-year column with its own reference to the year it states, so that `sumDriftsinntekter` for the prior year is available to revenue growth (deferred reconcile item 5)
**And** each filing stores its filing year, `read_at`, reporting unit, and per-check results, written through `INGEST_DATABASE_URL` with no DDL
**And** every document-figure row carries the provenance dataset tag recording which dataset produced it (AD-9); the tag is provenance only, and the allow-list test of Story 1.3b reads every committed seed file regardless of it
**And** Python computes no ratio, distribution or amount; its only arithmetic is the reconciliation checks (AD-1)

**Given** the contract test (AD-14)
**When** step 1's document writer runs on fixture 979607008/2025 against a freshly migrated database
**Then** the stored øre values for both columns equal hand-checked values in the test

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with figures read by OCR and written as money (AGENTS.md Working style) and links the AI session file, and the reasoning is recorded in `docs/ai-log.md`

### Story 2.2: Accept only figures that reconcile

As Kari or Anders,
I want a document figure used only when it reconciles, with each filing's data quality stated,
So that a misread figure never reaches a key figure, a median or a kroner amount.

**Implements:** FR-57, FR-58 · **Invariants:** AD-1, AD-15 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/2.2-reconciliation`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** an extracted filing
**When** the within-document checks run on each column — sum inntekter − sum kostnader = driftsresultat; driftsresultat + netto finans = ordinært resultat før skattekostnad; sum eiendeler = sum egenkapital og gjeld; sum egenkapital + sum gjeld = sum egenkapital og gjeld
**Then** each holds only within a tight absolute bound of a few kroner, set once in configuration
**And** the PR states the value (the spike used 5 kr absolute) and records it, with its reason, in `docs/data-sources-brreg.md` in the same PR
**And** the 2025 filing for 979607008, where `Sum inntekter`, `Årsresultat` and `Sum gjeld` are each one krone off, passes (test)
**And** a column with `722 632 310` in place of 72 632 310, or `8 335 514` in place of 833 514, fails (test)

**Given** an extracted filing whose figures the key-figures API also holds
**When** the between-source check runs
**Then** each such document figure is compared with the API figure under a proportional tolerance, set once in configuration
**And** the PR states the value and records it, with its reason, in `docs/data-sources-brreg.md` in the same PR
**And** a company reporting in millions (923609016 pattern, a deviation of 1 000 000 from rounding) passes, and a figure wrong by a factor of 10 fails (tests)
**And** neither rule is exact equality, and the two are never collapsed into one: a test shows a within-document deviation that a proportional tolerance would admit is rejected by the absolute bound

**Given** a filing where any check fails
**When** its status is set
**Then** the status is `failed_reconciliation` and none of its document figures is passed to the engine as a value; no figure is caveated, substituted or estimated
**And** a filing where every evaluable check passes and both core checks (income statement, balance) were evaluable is `reconciled`
**And** the prior-year column is accepted only if its own column checks pass

**Given** the per-filing data-quality flag
**When** it is derived
**Then** it comes only from the results of the two reconciliation rules, and the function deriving it takes no OCR confidence as input (a test changes every confidence value and the flag does not change)
**And** each check's result is stored on the filing (AD-15)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with the tolerances and the blocking rule (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 2.3: Measure OCR accuracy (SM-2)

As a sensor assessing the project,
I want OCR accuracy measured field by field against a hand-transcribed reference set, and consistency re-measured after the engine change,
So that the claim about which document figures Peerless can offer rests on a measurement, not an assumption.

**Calendar dependency:** this story depends on the hand-transcribed OCR reference set — 15–20 filings across 2021–2025, every figure of the generated section transcribed by hand. Like the labelled set (FR-70), that is calendar work, not coding: it **starts in week 1, in parallel with Epic 1**, so that it is complete when this story starts.

**Implements:** FR-28 (batch part: the SM-2 measurement of 2021–2025), NFR25 (SM-2), NFR15 (the reference filings as part of the declared sample) · **Invariants:** AD-15 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/2.3-ocr-accuracy-sm2`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the hand-transcribed reference set
**When** its history is checked
**Then** it has been tracked as its own GitHub issue since week 1 (Delivery order), separate from this story's issue, and this story's PR links that issue

**Given** the reference set
**When** it is drawn (week 1)
**Then** it is a seeded random draw of 15–20 filings from 62.100's generated filings, paper filings excluded, stratified across the filing years 2021–2025 and across size bands of `sumDriftsinntekter`, with the strata written down before the draw
**And** the draw script, the random seed and the drawn orgnrs and years are committed, so the draw can be reproduced
**And** the report states that the sample is the whole industry, not the demo companies and their peers

**Given** the reference set
**When** it is committed
**Then** it holds the drawn filings, each with orgnr, filing year, both columns and the date and transcriber of each transcription
**And** each reference orgnr is on `seed/allow-list.json` with the reason "OCR-referansesett" — `seed:export` reads the committed draw and writes those entries — and the allow-list test reads the committed reference set as well as the seed files, so its document figures are part of the declared sample (NFR15)

**Given** step 1's output for the reference filings
**When** the measurement runs
**Then** it compares every field with the hand transcription and reports the share of figures recovered exactly and the share of filings passing the consistency check, split between recent and older filings, with the boundary between them stated in the report before the comparison is run
**And** every mismatch is listed with orgnr, year, column, field, expected and read value

**Given** the spike's baseline in `analysis/output/ocr-consistency.md` (Tesseract 5, combined read, 2021–2025)
**When** consistency is re-measured with Tesseract 5.5 and `tessdata_best` on the same 2021–2025 filings
**Then** the report gives both denominators: passing columns over all columns (two per filing) and passing columns over evaluable columns
**And** passing / all columns is at least the baseline 156 of 178 (≈ 88 %), and passing / evaluable columns is at least the baseline 156 of 168 (93 %), or the report explains each difference

**Given** the measurement
**When** it finishes
**Then** the report is written to `analysis/output/` with its generation date and the script that produced it, and makes no claim beyond what it measured (no numeric target is committed, NFR32)

### Story 2.4: Withdrawn companies disappear

As the owner of Peerless,
I want a company the register has withdrawn removed from Peerless's data,
So that no peer group or aggregate is built from a company that no longer exists in the register.

**Implements:** FR-66 (v1 part: stored data and seed) · **Invariants:** AD-2, AD-3, AD-9, AD-16 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/2.4-withdrawn-410`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a step-1 run
**When** the register answers `410 Gone` for a stored orgnr
**Then** step 1 deletes the company row, as its one declared deletion (AD-2), and every row referencing it in `register` goes with it through `ON DELETE CASCADE` (key figures, filings, document figures)
**And** the company is deleted, not flagged (test: no row for the orgnr remains in any `register` table)

**Given** a `404`, a `5xx`, a timeout or any answer other than `410 Gone`
**When** step 1 handles it
**Then** nothing is deleted, and the failure is written to step 1's run record (test for each)

**Given** the migrations for this story
**When** they run
**Then** they create step 1's run-record table — start, end, counts per outcome and every failure — written only by `ingest`; `derive` and `loader` have no write grant on it (grants test), and step 2 never writes it (AD-2: one writer per table; step 2 has its own run-record table, Story 2.6)
**And** every step-1 run from this story on writes one record to it, failures included, never swallowed

**Given** a company deleted after a `410 Gone`
**When** `pnpm seed:export` runs next
**Then** the orgnr appears in no seed file, in the manifest's list of orgnrs with document figures, or in `seed/allow-list.json`

**Given** a company deleted after a `410 Gone`
**When** a peer group or any aggregate is computed after the removal
**Then** the company is in no peer group and no aggregate (test with a subject that had it as a peer)
**And** an analysis URL with that orgnr in `ekskl` drops it with the invalid-settings notice, because it is outside the candidate pool

**Given** the grants
**When** the grants test runs
**Then** `ingest` may delete from the company table and `reader`, `derive` and `loader` may not

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with an automated delete (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 2.5: The business-model fingerprint (stage 4)

As Kari or Anders,
I want candidates grouped by what kind of business their own accounts show,
So that a reseller, a product company and a consultancy are not compared as if they were the same.

**Implements:** FR-10, FR-13 · **Invariants:** AD-1, AD-2, AD-9, AD-13 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/2.5-fingerprint-stage-4`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** `src/engine/fingerprint.ts`
**When** it is read
**Then** it holds the one fingerprint type with the five categories — inventory yes/no, cost-of-goods band, capitalised intangibles yes/no, asset-intensity band, personnel-cost band — and a migration check mirrors it in the fingerprint table
**And** cost-of-goods share and personnel-cost share enter only as coarse band ids, never as values

**Given** batch step 2
**When** it computes fingerprints
**Then** it is a Node script that reads reconciled figures from Postgres, computes each category with `src/engine` only (Python computes none), and writes through `DERIVE_DATABASE_URL`
**And** each row stores a digest of its raw inputs from the one digest function in `src/engine` (AD-13) and the dataset tag (AD-9), and every run rebuilds all fingerprints
**And** a CI test recomputes the fingerprints of the allow-listed companies from committed figures and fails on a digest mismatch
**And** the fingerprint table references the company `ON DELETE CASCADE`, and Story 2.4's deletion test covers it

**Given** funnel stage 4
**When** it runs in the request path
**Then** it reads stored fingerprints only, and each fingerprint derives one business type from the shared set of business types defined once in `src/engine` and used by Story 2.6's classification as well (proposed: produkt, konsulent, forhandler, annet)
**And** the story fixes that set, what each type means, and the rule deriving a type from the five fingerprint categories, and records them in the technical note's "Peer group — a five-stage funnel" section ("Rules fixed by the stories") in the same PR
**And** fixtures of a reseller, a product company and a consultancy with the same industry code derive three different types
**And** stage 4 removes a candidate whose fingerprint type differs from the subject's; until Story 2.6 stores classifications every text signal is absent, so the fingerprint decides alone, and Story 2.6 completes the combination rule recorded in the technical note ("Combining the fingerprint and the text")
**And** a candidate with no reconciled filing has no fingerprint and is not excluded at stage 4; a subject with no fingerprint leaves stage 4's count equal to stage 3's (tests)

**Given** the rule never to select on a benchmarked measure
**When** the selection test runs
**Then** it asserts that no stage-1-to-5 function takes driftsmargin, EBITDA-margin, totalkapitalrentabilitet, any productivity figure or any other margin or return as input, and that cost-of-goods and personnel-cost shares reach selection only as band ids
**And** a per-industry within-band spread test runs for 62.100 and asserts non-trivial spread of each banded figure within its band, with the spread measure and threshold written in the test before it is run on data, and recorded in the technical note ("Rules fixed by the stories") in the same PR; if spread collapses, the test fails and the PR records that the band is dropped (FR-13); Story 5.2 then confirms or drops each band against the labelled set

**Given** the licence-gate file `docs/licence-gate.json` (written by Story 5.4)
**When** `pnpm seed:export` runs for the demo seed
**Then** it reads that file to decide whether fingerprint categories for companies outside `seed/allow-list.json` are exported: they are written into the committed demo seed only when the file records the gate as open
**And** allow-listed companies keep their fingerprint categories whatever the gate says: the allow-list is its own accepted sample, and the gate covers only the categories for every other candidate — so B shows fingerprint separation with the gate closed
**And** when the file is absent, unreadable or records the gate as closed, the demo seed carries fingerprint categories for allow-listed companies only; until Story 5.4 writes the file it is absent (tests for absent, closed and open, each asserting that an allow-listed company keeps its categories)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with banding and with selection (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 2.6: Classification (stage 5)

As Kari or Anders,
I want each candidate's type of business judged from its own text, in fixed categories, ahead of time,
So that companies that describe the same work are matched, without any model call while I wait.

**Implements:** FR-11, FR-12, FR-14 · **Invariants:** AD-2, AD-7, AD-13, AD-16, AD-19 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/2.6-classification-stage-5`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** batch step 2
**When** it classifies a company
**Then** it sends the model only the company name, secondary industry codes, statement of purpose and business description, and accepts an answer only in the fixed category set defined once in code; the response schema has no free-text field
**And** the category set is the shared set of business types fixed in Story 2.5 and defined once in `src/engine`; the model's response schema is generated from it, so the fingerprint and the text cannot drift apart
**And** an answer outside the category set is never coerced: the row is `failed` and the failure is written to step 2's run record
**And** the model id is pinned in configuration, and each row stores the model id, a prompt hash and a digest of the description text (AD-7, AD-13)
**And** the model key is read only by step 2 and appears in no other module or env var the app reads (AD-19)

**Given** a company whose description text is unchanged since its stored classification
**When** step 2 runs again
**Then** no model call is made for it; changed text is reclassified on the next run (test with a stubbed model)

**Given** a company with nothing to classify on beyond its name (no secondary codes, statement of purpose or description)
**When** step 2 handles it
**Then** it is stored with status `no_text`, unclassified, never guessed, and stays eligible through stages 1–4 (test)

**Given** classification status
**When** a run finishes
**Then** each row is `classified`, `no_text`, `failed` or `pending`; a record in step 2's run-record table holds start, end, counts per status, model id and prompt hash; and `seed:export` refuses while a covered-industry row is `failed` or `pending`

**Given** the migrations for this story
**When** they run
**Then** they create step 2's run-record table, written only by `derive`; `ingest` and `loader` have no write grant on it (grants test), and step 1 never writes it — the two steps never share a run record (AD-2)
**And** every step-2 run (fingerprints, classifications and, from Epic 4, explanations) writes one record to it, failures included

**Given** both run-record tables (step 1's from Story 2.4, step 2's from this story)
**When** `pnpm seed` runs
**Then** it prints the latest run record of each step, labelled by step, and says so when a step has none (test)

**Given** funnel stage 5
**When** it runs in the request path
**Then** it reads stored classifications only and, together with stage 4, applies the combination rule recorded in the technical note ("Combining the fingerprint and the text"): both signals present and agreeing on whether the candidate is the subject's type decide; both present and disagreeing keep the candidate and flag it "Usikker klassifisering", resolved by neither (the model never adjudicates); only one present decides alone
**And** in the funnel counts, stage 4 removes a candidate whose fingerprint gives another type unless its text gives the subject's type, and stage 5 removes a candidate whose text gives another type and that has no fingerprint; an unclassified candidate stays at stage 5
**And** a subject with no classification leaves stage 5's count equal to stage 4's, and the fingerprint alone decides at stage 4
**And** a test per case — both agree (subject's type; another type, including two different other types), both disagree (each way round), fingerprint only, text only, neither, and a subject missing each signal — asserts kept, removed or flagged; the flag is stored and the flagged count is available to the funnel

**Given** no model key
**When** the test suite and an analysis run
**Then** step 2's tests run on stored model responses, the app uses stored classifications, and no request to a model host leaves the app during an analysis (AD-7 no-network test)

**Given** the classification table
**When** it is migrated
**Then** it references the company `ON DELETE CASCADE`, and Story 2.4's deletion test covers it

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with the model's input and output and with the key (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 2.7: The Peers tab shows why

As Kari or Anders,
I want to see how the peer group narrowed at each stage and why each peer is in it,
So that I can judge the group myself before I trust any comparison.

This story builds on the simple Peers list from Story 1.7.

**Implements:** FR-9 (the "AS only" wording), FR-14 (flagged count shown), FR-15, FR-16 · **Invariants:** AD-1, AD-4 · **UX:** UX-DR23, UX-DR25, UX-DR32, UX-DR33, UX-DR37, UX-DR68, UX-DR69, UX-DR70, UX-DR76 · **Issue / branch / PR:** one issue, branch `story/2.7-peers-why`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a covered subject
**When** the Peers tab renders
**Then** the funnel shows the five stages "Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering", each with its surviving count in tabular figures and an 8px navy-700 bar proportional to stage 1
**And** the Segment stage shows the count for each criterion it applies separately — in v1 legal form only (FR-9); a later industry's geography would be shown and named the same way
**And** the copy for the Segment stage says that v1 admits AS only, worded consistently with PRD FR-9 (deferred reconcile item 4)
**And** "✦ {n} med usikker klassifisering" shows the flagged count
**And** the funnel and its counts are shown whether or not the group clears the 10-peer floor (test with a group of 7)

**Given** the peer list
**When** it renders
**Then** its columns are Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag, and its caption carries the key "✦ KI-generert"
**And** "Hvorfor med" is written by a deterministic function from the profile fields the peer shares with the subject, carries no ✦, and takes no model output as input (test: same inputs give the same text; the function's input type has no model field)
**And** "Grunnlag for treff" shows exactly one of four, derived by one `src/engine` function in this order: classified and fingerprinted → "Beskrivelse og regnskap" (✦); fingerprinted, unclassified → "Kun regnskap"; classified from its description with no fingerprint (no reconciled accounts) → "Kun beskrivelse" (✦); neither → "Kun bransje og størrelse" (a test per basis, and a test that the function is exhaustive over the four combinations)
**And** ✦ appears on exactly the two bases that rest on a classification, "Beskrivelse og regnskap" and "Kun beskrivelse", and on neither "Kun regnskap" nor "Kun bransje og størrelse" (component test)
**And** a flagged peer shows the tag "✦ Usikker klassifisering" in slate beside its match basis and stays in the group
**And** ✦ is `aria-hidden` and screen readers hear "KI-generert" once per cell, once for both where a basis and a flag share a cell; ✦ appears on no number and not on "Hvorfor med"

**Given** the Peers tab at 375 px and 320 px
**When** it renders
**Then** the funnel is a vertical list (name left, count right, bar beneath), the peer list is one card per peer with "Vis alle {n}", every target is at least 24 × 24 px, and the body does not scroll horizontally
**And** at desktop width the peer list sits in a scroll container with a descriptive `aria-label`

**Given** the rendered page
**When** its payload is inspected
**Then** it carries no peer field beyond what the funnel, the list and the shown figures need (AD-4)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with what the page payload exposes (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 2.8: Adjust the peer group

As Kari or Anders,
I want to exclude a peer I know is wrong and widen the size band when the group is thin,
So that the comparison is against a group I accept, with every figure recomputed.

The adjusted-group state of the explanation ("Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den.") is not in this story: the explanation card first exists in Epic 4, which carries that criterion.

**Implements:** FR-17 (v1: in the URL), FR-18 (v1: the size band), FR-19, FR-55, FR-56, NFR1, NFR2, NFR27 (SM-5: recompute and render times) · **Invariants:** AD-5, AD-6, AD-10, AD-12 · **UX:** UX-DR24, UX-DR25, UX-DR30, UX-DR37, UX-DR46, UX-DR49, UX-DR53, UX-DR54, UX-DR65, UX-DR66, UX-DR67, UX-DR68, UX-DR71, UX-DR80 · **Issue / branch / PR:** one issue, branch `story/2.8-adjust-peer-group`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a peer in the list
**When** "Ekskluder {Navn}" is pressed
**Then** the app soft-navigates (`router.push`) to the URL from `serialize` with the orgnr added to `ekskl`, rendered on the server; nothing is written to any table
**And** the row stays in the list in slate, struck through, with the tag "Ekskludert" and the action "Ta med igjen"; focus stays on the same button while its label changes
**And** "{Navn} er ekskludert. {m} sammenlignbare i analysen." is announced; restoring announces "{Navn} er tatt med igjen. {m} sammenlignbare i analysen."
**And** the funnel shows "{n} ekskludert av deg → {m} i analysen"

**Given** one or more exclusions or a widened band
**When** "Tilbakestill til standard" is pressed
**Then** exclusions are cleared and the band returns to Standard, "Standard peer-gruppe er gjenopprettet. {n} sammenlignbare." is announced, and focus moves to the Peers `h2`

**Given** the size-band control
**When** it renders
**Then** it is a `radiogroup` with roving tabindex and three steps "0,5–2× / Standard", "0,33–3× / Utvidet", "0,25–4× / Utvidet", showing the resulting revenue range; on phone it is a full-width three-column grid
**And** choosing a step soft-navigates to the URL with `band` set, announces "Størrelsesintervall {b}. {n} sammenlignbare." and keeps focus on the step
**And** beyond Standard the group is tagged "Utvidet" and a State block reads "Utvidet størrelsesintervall (0,33–3×). Dette er ikke standard peer-gruppe." (with the range of the chosen step) and the link "Tilbake til standard (0,5–2×)"
**And** the page states that comparability is never loosened, and no control offers any comparability field
**And** no control loosens legal form or geography: in v1 the size band is the only loosenable criterion (FR-18 stage split; segmentation loosening is stage 3)

**Given** every widening step
**When** the FR-18 test runs
**Then** no step admits a candidate that fails any of the six comparability fields

**Given** fewer than 10 comparable peers after stage 5
**When** the Peers tab renders
**Then** above the funnel a State block reads "Peer-gruppen har bare {n} sammenlignbare. Med under 10 viser vi ingen median eller kroner." with the action "Utvid størrelsesintervallet" at Standard; at 0,25–4× the same block without the action and with "… også med det videste intervallet"; with zero peers "Fant ingen sammenlignbare selskaper."

**Given** a change that moves the band so that excluded orgnrs fall outside the candidate pool
**When** the new URL is rendered
**Then** those exclusions are dropped and the notice "Noen innstillinger i lenken var ugyldige og er satt tilbake til standard." is shown once

**Given** any peer-group change
**When** it is pending
**Then** affected regions carry `aria-busy="true"` and keep their previous figures dimmed with a slate "Oppdaterer …", with no animation in any motion mode
**And** once the new figures arrive every key figure, aggregate, percentile and kroner amount on every tab is recomputed, with no stale value shown as current
**And** a figure can cross the 10-peer floor either way: a test excludes a peer to take a figure from 10 to 9 (below-floor state) and restores it (comparison back)

**Given** a peer-group change that fails
**When** the failure is detected
**Then** `role="alert"` shows "Kunne ikke oppdatere analysen. Prøv igjen." and the figures and the URL stay at the last good state (test)

**Given** the seeded 62.100 dataset
**When** a peer-group change is made in a real browser (deferred reconcile item 3)
**Then** peer-group assembly for the new URL completes in under 1 s (timed test) and the time to the re-rendered analysis is measured and recorded in the PR against the "within a few seconds" target (NFR1, NFR2)

**Given** the history
**When** exclude, restore, widen or reset is used
**Then** each pushes one history entry, and back returns the previous peer group

**Given** the Peers tab with the size-band control, an excluded peer, the widened-band and too-small State blocks, at 375 px and 320 px
**When** it renders
**Then** the body does not scroll horizontally, and the peer list and every other table or chart sits in its own scroll container

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with URL state reaching the engine and with recompute failures (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 2.9: Missing figures say why

As Kari or Anders,
I want every missing figure to state why it is missing,
So that I never mistake an unreadable filing, an undefined ratio or a thin group for a zero.

**Implements:** FR-23, FR-55, FR-56, FR-71 · **Invariants:** AD-1, AD-8, AD-15 · **UX:** UX-DR10, UX-DR37, UX-DR38, UX-DR39, UX-DR50, UX-DR68 · **Issue / branch / PR:** one issue, branch `story/2.9-missing-figures-reasons`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the engine's input and output types
**When** they are read
**Then** each figure is a discriminated union of a value or an absence with exactly one reason: undefined; failed reconciliation; not in this dataset; below the floor
**And** each reason maps to exactly one EXPERIENCE state — "Kan ikke beregnes" with its reason, "Regnskapet for {år} kunne ikke leses sikkert", "Ikke i demodataene", "For få sammenlignbare (n av 10)" — through an exhaustive switch that fails to compile if a reason is added without a state

**Given** a zero or negative denominator, or a missing component that cannot be derived
**When** the figure is computed
**Then** it is undefined, never zero; the company leaves only that figure's distribution, and the left-out count is returned
**And** a missing component is first derived from its stated total, in `src/engine` only (test: `langsiktigGjeld` NULL with `sumGjeld` and `sumKortsiktigGjeld` present is derived; with `sumGjeld` also NULL it is undefined)
**And** no derived component is stored by step 1 (test over the document-figure table)

**Given** a subject whose own latest filing has status `failed_reconciliation` (FR-71)
**When** its analysis renders
**Then** the three API figures keep full comparison and the driftsmargin kroner amount
**And** each of the twelve document-dependent figures is absent with the reason failed reconciliation, and nothing is estimated or substituted
**And** the company header shows a slate subline in words, "Regnskapet for {år} kunne ikke leses sikkert", with no badge
**And** the subject keeps its tabs and peer group and is not shown as uncovered (test)
**And** each document row renders this reason when Epic 3 adds the document rows; this story delivers the engine output and the header subline

**Given** a peer whose filing has status `failed_reconciliation`
**When** aggregates are computed
**Then** the peer is left out of every document-derived figure's distribution and still counts for the API figures

**Given** a 62.100 company with no document figures in the loaded manifest
**When** its figures are computed
**Then** every document-dependent figure carries the reason not in this dataset, decided from the manifest's list of orgnrs with document figures and never inferred from a missing row (AD-15)

**Given** a figure with fewer than 10 comparable peers
**When** it is computed
**Then** its reason is below the floor, with the count

**Given** the analysis of a subject whose filing failed reconciliation, with the header subline, at 375 px and 320 px
**When** it renders
**Then** the subline wraps, the body does not scroll horizontally, and every table sits in its own scroll container

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with absence reasons and derived components in money figures (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

## Epic 3: See every gap in kroner and what closing it is worth

The full Nøkkeltall og gap table with document figures and their kroner, both decompositions and the margin waterfall, the remaining Oversikt cards (beeswarm, Største kapitalgap, Største styrke, Mangler grunnlag), the Verdi tab (the fourth tab, added here with no placeholder before it) with the closable-share steps, "Til medianen" and EV/EBIT, the provenance drill-down "Hvordan er dette regnet?" including the hero card's link to it (left out of Story 1.9), and the no-double-counting tests.

### Story 3.1a: The engine computes every key figure

As a sensor checking the arithmetic,
I want the engine to compute every key figure in `docs/key-figures.md`, the document figures included, with their kroner, exactly and against hand-calculated reference cases,
So that every figure the table will show can be traced to a formula and a hand calculation before any of it is rendered.

**Implements:** FR-21, NFR28 (SM-6: every reference case and both identities), FR-23 (document figures), FR-24 (document figures), FR-29 (document figures: kroner for (9), (10), (11)) · **Invariants:** AD-1, AD-8, AD-15 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/3.1a-engine-key-figures`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** reconciled document figures and API figures for a subject and its peers
**When** the engine computes the key figures
**Then** it computes every key figure in `docs/key-figures.md` — 1 to 14 and cash share — by the formula written there, as exact decimals from øre, with missing components derived first from stated totals (Story 2.9) and nothing else
**And** each figure has a formula test against a hand-calculated value, and a figure whose formula differs from the document fails its test

**Given** the two identities in `docs/key-figures.md`
**When** the identity tests run (FR-21)
**Then** return on assets = operating margin × (`sumDriftsinntekter` / `sumEiendeler`) and personnel cost share = personnel cost per FTE ÷ revenue per FTE hold exactly — `Decimal` equality, no tolerance — over every reference case and over generated øre inputs

**Given** the reference cases of Story 1.4, extended with document figures
**When** the engine runs them
**Then** every expected value matches, hand-calculated from real filed accounts, including negative equity, zero revenue and a missing component
**And** a reference case with a non-calendar financial year is asserted excluded by funnel stage 2 and absent from every distribution, never adjusted
**And** each case records its orgnr and filing year, and the PR lists the hand calculation behind each expected value

**Given** the cost shares (3–5), total cost share (6), the no-direction figures — lønnskostnad per årsverk (8), egenkapitalandel (13), omsetningsvekst (14) — and kontantandel
**When** the engine computes their comparison and amounts
**Then** no cost share yields a kroner value (test), total cost share yields a distribution and no kroner, and the no-direction figures yield median and midtre halvdel with no beste fjerdedel, no Plassering and no kroner
**And** kontantandel is a diagnostic: the engine never ranks it (never eligible for Største styrke, never a sort key) and produces no kroner for it (test)
**And** omsetningsvekst is context, computed from the prior-year column of the same document (Story 2.1), and undefined when that column did not reconcile

**Given** receivable days (9), payable days (10) or operating-asset turnover (11) worse than beste fjerdedel
**When** the engine computes the kroner amount at full convergence
**Then** it returns (r − T) / 365 × `salgsinntekt`, (T − r) / 365 × (`varekostnad` + `annenDriftskostnad`), and ((`sumEiendeler` − `bankinnskudd`) − `sumDriftsinntekter` / T) respectively, as exact decimals, each marked as a one-off amount and rounded once to whole kroner only in the formatter (tests with hand-calculated vectors)
**And** at or beyond beste fjerdedel it returns a strength and no amount
**And** a figure with no kroner translation in `docs/key-figures.md` returns no amount

**Given** a document figure the subject has and fewer than 10 peers have from the same source
**When** its comparison is requested
**Then** the engine returns the below-floor absence with the count, and no comparison and no kroner (FR-22, FR-24)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — the document-figure formulas and their kroner (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 3.1b: The full key-figure table

As Kari or Anders,
I want every key figure in the table, the document figures included, with their gaps in kroner,
So that I see every gap the accounts can show, not only the three the API gives.

This story renders what Story 3.1a computes.

**Implements:** FR-23 (document rows), FR-24 (document rows), FR-27 (remaining rows), FR-29 (document figures shown), FR-55, FR-56, FR-71 (document rows) · **Invariants:** AD-4, AD-8, AD-15 · **UX:** UX-DR17, UX-DR18, UX-DR31, UX-DR37, UX-DR38, UX-DR39, UX-DR40, UX-DR50, UX-DR58, UX-DR68, UX-DR73, UX-DR75, UX-DR77, UX-DR78 · **Issue / branch / PR:** one issue, branch `story/3.1b-full-key-figure-table`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a covered subject
**When** the Nøkkeltall og gap tab renders
**Then** the table holds a row for every key figure, grouped as in `docs/key-figures.md` (margin, cost structure, productivity, working capital, capital efficiency and strength, context), each label from the message file's `fig.*` keys

**Given** the cost-share rows (3–5)
**When** they render
**Then** they sit indented under Driftsmargin in their own `<tbody>`, led by `<th scope="rowgroup">` "Forklarer marginavviket – summeres ikke"
**And** each shows own value, median, beste fjerdedel (the lower quartile), Plassering and a mirrored strip, and its kroner cell reads "Se forklaring av marginen", never an amount (the cell becomes a link once Story 3.3 adds the waterfall)

**Given** Total kostnadsandel (6)
**When** its row renders
**Then** it is a check row as EXPERIENCE defines it: own value and distribution with no kroner, inapplicable cells sr-only "ikke relevant", an unmirrored strip with no "Bedre" label

**Given** the no-direction rows — lønnskostnad per årsverk (8), egenkapitalandel (13), omsetningsvekst (14) and kontantandel
**When** they render
**Then** each shows own, median, "Midtre halvdel: x–y %" and "Ingen retning", with no beste fjerdedel, no Plassering and no kroner
**And** kontantandel is shown as a diagnostic row: it is not sortable and carries no kroner cell (component test)

**Given** receivable days (9), payable days (10) or operating-asset turnover (11)
**When** the kroner cell renders at full convergence
**Then** it shows the engine's amount from Story 3.1a rounded once to whole kroner, with "engangsbeløp"
**And** at or beyond beste fjerdedel it shows "▲ Styrke" and no amount
**And** a figure with no kroner translation in `docs/key-figures.md` reads "Ingen kronebeløp"

**Given** a document figure the subject has and fewer than 10 peers have from the same source
**When** its row renders
**Then** it shows the below-floor state "For få sammenlignbare (n av 10)" with no comparison and no kroner (FR-22, FR-24), and the subline keeps "{n} sammenlignbare brukt · {k} utelatt"

**Given** a subject whose own latest filing failed reconciliation (FR-71)
**When** the table renders
**Then** every document row keeps its label and reads "Regnskapet for {år} kunne ikke leses sikkert" in place of own value and comparison, completing Story 2.9, and the API rows keep full comparison

**Given** a 62.100 company outside the demo seed (absence reason not in this dataset)
**When** the table renders
**Then** every document row keeps its label and reads "Ikke i demodataene" with an info button ("Mer om dette", a real `button` opening a `Popover`) carrying EXPERIENCE's popover text
**And** one State block above the table says "Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen.", and every "Ikke i demodataene" cell points to it with `aria-describedby`; the caveat's key text is on the page, never only in the popover
**And** a figure that needs peers' document figures is withheld the same way

**Given** the table at 375 px and 320 px
**When** it renders
**Then** every row, the cost-share row group included, follows the phone pattern of Story 1.8 (three columns, row-name button opening a full-width expansion row), and the body does not scroll horizontally

**Given** the rendered page
**When** its payload is inspected
**Then** it carries only the figures of this analysis, including each peer value behind each shown figure (AD-4)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — what the payload exposes and how the kroner cells are displayed (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 3.2: The two decompositions

As Kari or Anders,
I want to see whether a weak return comes from margin or from capital use, and whether a high personnel share comes from pay or from productivity,
So that I know which lever the gap sits on.

**Implements:** FR-26 (v1: both open) · **Invariants:** AD-1, AD-8 · **UX:** UX-DR19, UX-DR21, UX-DR22, UX-DR40, UX-DR67, UX-DR76 · **Issue / branch / PR:** one issue, branch `story/3.2-decompositions`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the fold-out component
**When** it renders
**Then** it is a shadcn `Collapsible` with a `button` trigger, `aria-expanded`, `aria-controls` and a ▸/▾ caret that is `aria-hidden`; its body sits on `surface-foldout` indented 30px; it is closed by default; Enter and Space toggle it
**And** on phone it opens full width below its row group, never nested inside the row

**Given** the row Totalkapitalrentabilitet
**When** "Margin eller kapitalbruk?" is opened
**Then** it shows driftsmargin and totalkapitalens omløpshastighet (`sumDriftsinntekter` / `sumEiendeler`), each against its own median, each with its own strip and its own 10-peer gate ("For få sammenlignbare (n av 10)")
**And** the factors are never multiplied: no product of the subject's factors against a product of medians is computed or shown (test)
**And** totalkapitalens omløpshastighet is a derived factor: it shows a median and the count of peers behind it, with no beste fjerdedel, no Plassering and no kroner, and it is never labelled as key figure 11 or as driftsmidlenes omløpshastighet (test on label and on absent fields)

**Given** the row Lønnskostnadsandel
**When** "Lønnsnivå eller produktivitet?" is opened
**Then** it shows lønnskostnad per årsverk (no direction, no beste fjerdedel) and omsetning per årsverk, each against its own median with its own strip and gate, in the same pattern

**Given** either fold-out
**When** it renders
**Then** it is open to every visitor in v1 (no account wall), its two factors sit side by side on desktop and stacked on phone, and the body does not scroll horizontally at 375 px and 320 px

**Given** a 62.100 company outside the demo seed
**When** the table renders
**Then** "Margin eller kapitalbruk?" is shown (both factors come from the API) and "Lønnsnivå eller produktivitet?" reads "Ikke i demodataene"

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — factors of money figures shown side by side, and any temptation to multiply them (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 3.3: The margin waterfall

As Kari or Anders,
I want to see which cost lines explain the difference between the company's margin and the peer group's,
So that I understand the margin gap without it being counted twice.

**Implements:** FR-29 (cost shares through the decomposition), FR-30 · **Invariants:** AD-1, AD-8 · **UX:** UX-DR19, UX-DR20, UX-DR37, UX-DR40, UX-DR66, UX-DR72, UX-DR76 · **Issue / branch / PR:** one issue, branch `story/3.3-margin-waterfall`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a subject and its peer group
**When** the engine builds the common peer set *P*
**Then** *P* holds the peers whose `driftsresultat`, `varekostnad`, `lonnskostnad` and `annenDriftskostnad` all come from the same reconciled benchmark-year filing with `sumDriftsinntekter` > 0, and every bar uses that one set
**And** with fewer than 10 in *P*, or a component missing for the subject, no decomposition is computed, and "Hva forklarer marginavviket?" reads "Ingen forklaring av marginen: bare {n} sammenlignbare har alle kostnadslinjene (av 10 som trengs)." (test at 9 and 10)

**Given** *P*
**When** the bars are computed
**Then** they are varekostnad, lønn, andre driftskostnader and "Avskrivninger og øvrige poster", the last defined as the residual so that margin = 1 − the four shares holds exactly for every company
**And** peer-gruppen samlet is revenue-weighted (Σ numerator / Σ `sumDriftsinntekter`), never a mean of ratios
**And** each bar is (Aₓ − cₓ) × the subject's `sumDriftsinntekter`, and the four exact bars sum exactly to (subject margin − M) × `sumDriftsinntekter` (test, `Decimal` equality)

**Given** the exact bars
**When** they are rounded for display
**Then** the total `driftsresultat` − M × `sumDriftsinntekter` is rounded once to whole kroner, half away from zero; the start bar is `driftsresultat` − the displayed total; each bar is rounded towards negative infinity and the remaining kroner go one at a time to the largest fractional parts (signed largest remainder)
**And** the displayed bars sum to the displayed total and start plus bars equals the end exactly (tests including negative bars, ties and a residual of either sign)

**Given** the fold-out "Hva forklarer marginavviket?" under Driftsmargin
**When** it is opened
**Then** the waterfall runs from "Peer-gruppen samlet" (median fill) through the four bars to the company (navy-700); favourable bars in petrol and unfavourable in amber, each with signed kroner, ▲/▼ and a word, and "own mot samlet" shares; "Avskrivninger og øvrige poster" is slate whatever its sign
**And** it leads with the tag "Mot peer-gruppen samlet: x %, ikke beste fjerdedel" and, directly above the bars, "Dette forklarer avviket. Det er ikke et gap som skal lukkes, og det legges aldri til økt driftsresultat."
**And** where a bar's direction disagrees with its row's, the subline "Mot peer-gruppen samlet, ikke medianen" is shown
**And** the legend names all three bar kinds

**Given** the closable share
**When** it changes (Story 3.5) or is absent
**Then** the waterfall's amounts are identical at every share: it is never scaled (test over every `andel` value)

**Given** the FR-30 no-double-counting tests
**When** they run
**Then** cluster 1 asserts that no cost share produces kroner of its own, and that no total — annual profit uplift, implied EV, any card total — includes a waterfall bar
**And** cluster 2 asserts that working capital released is receivable days (9) plus payable days (10) and nothing else, and that the operating-asset amount (11) is never summed with (9) or with the working-capital total
**And** both run against the engine's amount functions, so Story 3.5's display inherits them

**Given** a cost-share row's "Se forklaring av marginen"
**When** it is activated
**Then** it is a link that opens the waterfall fold-out and moves focus to its heading

**Given** the waterfall chart
**When** it renders
**Then** it is a non-focusable SVG `role="img"` with a summary `aria-label`, followed by a "Vis tallene" / "Skjul tallene" toggle opening a table (caption, `th scope="row"`, start, four parts, end, reference); its bars and markers stay distinguishable under `forced-colors: active`
**And** on phone it is vertical rows (name and signed value, subline, a 10px floating bar on a shared kroner scale, the reference tag, then the never-added sentence), with no horizontal body scroll at 375 px and 320 px

**Given** a 62.100 company outside the demo seed
**When** the Driftsmargin row renders
**Then** the waterfall is not shown, and the fold-out reads "Ikke i demodataene"

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with the decomposition, its rounding and double counting (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 3.4: The rest of Oversikt

As Kari or Anders,
I want the overview to show where the company sits among its peers, its largest capital gap, its largest strength and what lacks a basis,
So that the first page gives the whole picture before I open the table.

**Implements:** FR-27, FR-29 · **Invariants:** AD-4, AD-8 · **UX:** UX-DR6, UX-DR13, UX-DR15, UX-DR32, UX-DR37, UX-DR40, UX-DR48, UX-DR72, UX-DR76 · **Issue / branch / PR:** one issue, branch `story/3.4-oversikt-cards`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** Oversikt for a covered subject
**When** it renders
**Then** it is the 12-column card grid of DESIGN (hero 5, peer plot and list 7, three small cards of 4, the explanation row of 12 left for Epic 4), one column on phone in the order hero, plot and list, small cards

**Given** the beeswarm of driftsmargin
**When** it renders
**Then** every peer is a dot on a % axis with gridlines, packed without overlap; the company marker is labelled; the median tick and the beste fjerdedel triangle are drawn; "Bedre →" marks direction; a legend gives the values
**And** a peer's name and value show in a tooltip on hover or tap, as a convenience only (one open at a time on touch; on phone above the plot with a leader line)
**And** the chart is a non-focusable SVG `role="img"` with a summary `aria-label`, children hidden, with a "Vis tallene" toggle opening a Selskap · Driftsmargin · Omsetning table, sorted, with the company row marked "(valgt selskap)", in a scroll container
**And** beside it a compact list of the five nearest peers carries a Driftsmargin column and "Se alle {n}" linking to Peers; on phone the compact list is primary
**And** the Driftsmargin values in the compact list, the "Vis tallene" table and the Peers list are byte-identical for the same URL (test)

**Given** the card "Største kapitalgap"
**When** it renders at full convergence
**Then** it shows the largest one-off capital amount among working capital released ((9)+(10)) and operating-asset capital (11), with its full label and "Frigjort kapital: … kr (engangsbeløp)", the top note "Viser gap ved full tilnærming" (the "· Endre i Verdi" part and its link are added by Story 3.5, when the Verdi tab exists; no dead reference before then) and the mandatory sentence "Ikke per år, og legges ikke til resultatet."
**And** cost shares never qualify, and the card is never ranked against the hero (test)
**And** with no capital figure below beste fjerdedel it reads "Ingen kapitalgap: ingen av kapitalnøkkeltallene ligger under beste fjerdedel."

**Given** the card "Største styrke"
**When** it renders
**Then** it shows the figure with the highest Plassering at or beyond beste fjerdedel, ties broken by figure number, with no kroner; no-direction figures and kontantandel never qualify
**And** with none it reads "Ingen nøkkeltall ligger på eller over beste fjerdedel."

**Given** the card "Mangler grunnlag"
**When** it renders
**Then** it shows the first figure without a comparison, its own value and its reason, and "og {n} til" linking to the table
**And** with none it reads "Alle nøkkeltall har grunnlag for sammenligning."
**And** every card keeps its place in the grid in its empty state

**Given** a 62.100 company outside the demo seed
**When** Oversikt renders
**Then** the hero and the beeswarm show as normal (driftsmargin is API) and "Største kapitalgap" reads "Ikke i demodataene"

**Given** Oversikt at 375 px and 320 px
**When** it renders
**Then** it is one column, and the body does not scroll horizontally

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — which capital amount is chosen for the card, and the card being read as an annual amount (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 3.5: Verdi — how much is closable

As Kari or Anders,
I want to choose how much of each gap I think the company can close and see what that is worth,
So that the kroner reflect a realistic ambition, not only full convergence.

**Implements:** FR-31, FR-62 (Verdi tab, four tabs) · **Invariants:** AD-5, AD-6, AD-8 · **UX:** UX-DR11, UX-DR26, UX-DR27, UX-DR55, UX-DR56, UX-DR65, UX-DR66, UX-DR67, UX-DR76, UX-DR78, UX-DR80 · **Issue / branch / PR:** one issue, branch `story/3.5-verdi-closable-share`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a covered subject's analysis
**When** it renders
**Then** the tabs are four — Oversikt, Peers, Nøkkeltall og gap, Verdi — all open, `verdi` renders the Verdi panel instead of falling back to Oversikt, and they still fit at phone width by wrapping
**And** the top note "Viser gap ved full tilnærming" gains "· Endre i Verdi", linking to the Verdi tab, everywhere it appears: the Nøkkeltall og gap table (Story 1.8), the Oversikt hero (Story 1.9) and the Oversikt cards (Story 3.4) (test over all three)

**Given** the closable-share control
**When** it renders
**Then** it is a segmented `radiogroup` with roving tabindex and the steps 0, 25, 50, 75 and 100 %, plus "Til medianen for driftsmargin (n %)" in its ordered place, where n is the exact s_med from the server shown in whole percent
**And** it starts at 50 % when `andel` is absent
**And** "Til medianen" exists only where r < median < beste fjerdedel for driftsmargin; otherwise it is `aria-disabled="true"`, still focusable, with `aria-describedby` giving the reason ("{Selskap} ligger allerede over medianen. Medianen gjelder driftsmargin."), and every amount card reads "Median: allerede over"
**And** below the median the step reads "Median nås ved n % av gapet. Medianen gjelder driftsmargin.", and the median line with its 2×12px tick and "Medianen gjelder driftsmargin." is always shown
**And** it wraps to two rows on phone

**Given** a share s
**When** the amounts are computed
**Then** the target is beste fjerdedel at every step, and s scales the gap to it; "Til medianen" uses the exact s_med, never the rounded n (test: amounts at the median step differ from those at the rounded share)
**And** three amount cards are always shown and never summed:
- "Økt driftsresultat per år", shown as "585 000 kr av 1 170 000 kr per år" (the scaled amount of the full-convergence amount);
- "Frigjort arbeidskapital", with a receivable-days line and a payable-days line, and a total only when both clear the floor; where only one clears it, that part is its own line and the card reads "Ingen sum – én del mangler grunnlag";
- "Frigjort kapital i driftseiendeler", beside the others and never added to them
**And** capital amounts say "engangsbeløp"; each card has its median line ("Median nås ved x %" or "Median: allerede over"); a card without a target reads "Ikke beregnet – for få sammenlignbare på …"
**And** a test asserts that no displayed total adds any two of the three cards

**Given** driftsmargin at or beyond beste fjerdedel
**When** Verdi renders
**Then** the profit card reads "▲ Styrke. Driftsmarginen er på eller over beste fjerdedel, så det er ikke noe økt driftsresultat å regne ut.", and "Til medianen" is disabled

**Given** a step chosen
**When** the share changes
**Then** the browser scales the amounts with the same `src/engine` function the server uses and writes `andel` with `window.history.replaceState` through the one URL hook (never `router.replace`); client components read it from `useSearchParams`
**And** only the Verdi amount cards move; the table, the hero and the cards on Oversikt stay at full convergence
**And** "Økt driftsresultat per år: {a} av {full}." is announced once, and focus stays on the step
**And** every link and navigation built afterwards keeps `andel` and `multippel` (test: a tab change after a share change keeps both)

**Given** exact values passed from the server to the browser
**When** they cross the boundary
**Then** they go through `src/engine/wire.ts` as full-precision decimal strings with the branded `WireDecimal` type, and a `number` for money or a ratio in client props is a type error (type test)
**And** the server-versus-browser identity test asserts byte-identical formatted output for the same wire values in Node and in a real browser engine (AD-6)

**Given** Verdi at 375 px and 320 px
**When** it renders
**Then** the control is a full-width grid, the cards stack, every target is at least 24 × 24 px, and the body does not scroll horizontally

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with in-browser scaling of money and the wire codec (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 3.6: EV/EBIT — what the uplift is worth

As Anders,
I want to enter an EV/EBIT multiple and see the implied value of the profit uplift,
So that I can put the gap in enterprise-value terms with a multiple I choose.

**Implements:** FR-32, FR-55 · **Invariants:** AD-5, AD-6, AD-8 · **UX:** UX-DR28, UX-DR56, UX-DR57, UX-DR65, UX-DR68 · **Issue / branch / PR:** one issue, branch `story/3.6-ev-ebit`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the Verdi tab
**When** it renders without `multippel`
**Then** the field "EV/EBIT-multippel" (90px numeric input) is empty, with no default, no placeholder value and no suggestion, and the card reads "Verdi beregnes når du legger inn en multippel. Peerless foreslår ingen multippel." with no value
**And** the engine never looks up or suggests a multiple (test: no code path produces a multiple)

**Given** input in the field
**When** it is validated on Enter or blur
**Then** values in (0, 50] in steps of 0.1 are accepted, written with a decimal comma or a point, using the bounds imported from the URL module
**And** anything else shows the inline error "Skriv inn et tall større enn 0 og høyst 50, for eksempel 6 eller 6,5", tied to the field with `aria-invalid` and `aria-describedby`, and no value is shown

**Given** a valid multiple m
**When** "Økt selskapsverdi" is computed
**Then** it equals round(exact annual profit uplift at the current share × m), from API-sourced `driftsresultat`, and shows the visible product line, prefixed "≈" when the product of the displayed values differs from the result
**And** it rescales in the browser with the current share through the same engine function, writes `multippel` (with a point) via `replaceState`, and is announced once on Enter or blur

**Given** driftsmargin at or beyond beste fjerdedel
**When** Verdi renders
**Then** the field is disabled with the same reason as the profit card

**Given** the EV field, its error and the "Økt selskapsverdi" card with its product line, at 375 px and 320 px
**When** they render
**Then** the body does not scroll horizontally, and any table or chart sits in its own scroll container

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with a user-entered multiple applied to money (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 3.7: "Hvordan er dette regnet?"

As a sensor checking the arithmetic, or Anders checking a number before using it,
I want every kroner amount to trace back to the key figure, the filed values and their source,
So that I can verify any number on screen by hand.

**Implements:** FR-60, FR-64 · **Invariants:** AD-15, AD-18 · **UX:** UX-DR12 (the hero's link), UX-DR29, UX-DR40, UX-DR62, UX-DR66, UX-DR67 · **Issue / branch / PR:** one issue, branch `story/3.7-provenance`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** any kroner amount — table cells, the hero, Oversikt cards, Verdi cards and EV
**When** its "Hvordan er dette regnet?" is opened
**Then** an inline drill-down shows, in order: the formula (the share factor only from Verdi); the key figure and how beste fjerdedel was derived ("… = øvre kvartil av 23 verdier (lineær interpolasjon, som PERCENTILE.INC i Excel)", with the actual quartile, n and method) with "Vis fordelingen" linking to the distribution; the filed values with register field names in monospace and their filing year and read date; and the source
**And** the hero card gains its link "Hvordan er dette regnet?" (left out of Story 1.9), opening the same drill-down for the hero amount

**Given** the drill-down's data-quality line
**When** it renders
**Then** it reads "Avstemt mot innsendt årsregnskap" for a reconciled filing, "Ikke avstemt – årsregnskapet er ikke i demodataene" for a company outside the demo seed, and "Avvik ved avstemming: {felt}" for a failed check, decided from the stored per-filing status and the manifest, never inferred (AD-15)
**And** the line is true for a 62.100 company outside the demo seed (test with such a company: no claim of reconciliation is made)

**Given** an amount whose filing is degraded (failed reconciliation, paper, not extracted)
**When** its provenance is requested
**Then** the figure is reported unavailable with its reason, never estimated or substituted

**Given** the drill-down
**When** it opens and closes
**Then** focus moves to its heading on open, and "Lukk" or Esc returns focus to the trigger; calc chips sit on `surface`; at 375 px and 320 px the body does not scroll horizontally

**Given** a figure in the drill-down
**When** its values are compared with the engine
**Then** every value shown equals the engine's output for that URL, through the one formatter (test)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — what the drill-down exposes from the filed values, and a reconciliation claim that is not true (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

## Epic 4: Understand the gaps — the explanation

Every 62.100 company has a stored explanation marked ✦, generated in batch step 2 and guarded by the FR-53 figure test, the FR-54 phrase list and the input digest; hidden when the peer group is adjusted ("Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den."), an acceptance criterion moved here from Story 2.8 because the explanation card first exists in this epic.

### Story 4.1: Explanations generated in batch

As the owner of Peerless,
I want an explanation of each 62.100 company's default analysis written ahead of time from the engine's own output,
So that the text can only talk about figures Peerless computed, and no model is called while a user waits.

**Implements:** FR-52 (v1: stored text) · **Invariants:** AD-1, AD-7, AD-9, AD-13, AD-19 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/4.1-explanations-batch`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** batch step 2
**When** it prepares an explanation for a company
**Then** it computes the company's default analysis in memory with `src/engine` and builds the prompt payload from that output only, every figure formatted by `src/engine/format.ts`
**And** the payload names the largest kroner gaps and the strengths, chosen by the engine; which gaps and strengths are named, and their direction and rank words, is decided by the engine, never by the model
**And** the model writes text with slot references — figures, direction words and rank words are engine-provided slots, not free numbers — and the stored row keeps those references (deferred reconcile item 2)
**And** v1 explanations make no claim about persistence over years

**Given** a stored explanation row
**When** it is written
**Then** it holds the model id (pinned in configuration), the prompt hash, the digest of the wire-encoded default analysis from the one digest function in `src/engine` (AD-13) and the dataset tag (AD-9), written through `DERIVE_DATABASE_URL`
**And** the table references the company `ON DELETE CASCADE`, and Story 2.4's deletion test covers it

**Given** a step-2 run over the loaded dataset
**When** it finishes
**Then** every 62.100 company has a stored explanation for its default peer group, built against the dataset it ships in, or a failure written to step 2's run record
**And** for a company outside the demo set the payload holds only the API figures present there (test: a non-allow-listed company's payload contains no document figure)

**Given** the request path
**When** any analysis is served
**Then** no explanation is generated, the model key is read only by step 2 (AD-19), and the no-network test still passes; without a key, step 2's tests run on stored model responses (test mode)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with the model's input and output (AGENTS.md Working style), and the reasoning is recorded in `docs/ai-log.md`

### Story 4.2: The figure test (FR-53)

As a sensor assessing whether the model calculates,
I want an automated test that rejects any explanation containing a figure the engine did not compute,
So that "the model never calculates" is enforced, not hoped for.

**Implements:** FR-53, NFR26 (SM-4) · **Invariants:** AD-7, AD-8, AD-13, AD-16 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/4.2-figure-test`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a stored explanation with its slot references resolved against the engine output for its company, year and dataset
**When** the figure test runs
**Then** it rejects the text if it contains any figure absent from the engine's output, or a present figure attached to the wrong key figure, company, year or direction
**And** a text it cannot parse fails; nothing is skipped

**Given** the test's number parser
**When** it reads text
**Then** it recognises Norwegian formats exactly as `src/engine/format.ts` writes them — U+00A0 as thousands separator and before "kr" and "%", a decimal comma, U+2212 as minus — so "−501 428 kr" is read as the number −501 428 (test)
**And** it also recognises the variants a model might write — hyphen-minus for minus, a regular or narrow space as thousands separator, "kr" before or after, "%" — so "-501 428 kr" or "1 170 000 kr" with regular spaces cannot slip through as text (tests for each variant, each caught when the figure is absent from the engine output)

**Given** the test
**When** CI runs
**Then** it runs on stored fixtures with no model key

**Given** step 2 generating an explanation
**When** the figure test rejects it
**Then** the explanation is regenerated or, after the configured attempts, not stored and written to step 2's run record as failed

**Given** the loader
**When** `pnpm seed` loads explanations
**Then** it runs the figure test on each against the loaded dataset, writes only those that pass, and reports the rest (AD-16)
**And** it checks each explanation's stored input digest against the digest of the engine output for the loaded dataset (AD-13); on a mismatch the explanation is not written, so it is never shown, and the mismatch is reported with the orgnr (test)

**Given** this test
**When** any later change touches it
**Then** it is never weakened: a fixture set of known-bad texts is committed with it, and each must still fail (AGENTS.md)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — a figure the parser misses, and a check that could be weakened later (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 4.3: The phrase test (FR-54)

As the owner of Peerless,
I want explanations that explain and never recommend,
So that Peerless never tells a company what it should do.

**Implements:** FR-54 · **Invariants:** AD-7, AD-16 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/4.3-phrase-test`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the recommending and imperative phrase list ("bør", "anbefaler", "må redusere", …)
**When** the repository is read
**Then** it lives in one reviewable file (e.g. `src/explanation/recommending-phrases.ts`), and no other file holds phrases

**Given** step 2 generating an explanation
**When** the text contains a listed phrase
**Then** it is regenerated, and after the configured attempts it is not stored and written to step 2's run record

**Given** the loader
**When** a stored explanation contains a listed phrase
**Then** it is withheld and reported, never shown (test)

**Given** the phrase check
**When** it matches
**Then** it matches case-insensitively and on word boundaries, so "bør" matches "Selskapet bør" but not a word containing it (tests)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — recommending phrasing the list misses, and false matches that withhold valid text (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 4.4: The explanation card

As Kari or Anders,
I want a short written explanation of the largest gaps and strengths beside the figures,
So that I understand what the numbers mean without reading every row.

**Implements:** FR-52 · **Invariants:** AD-7, AD-13 · **UX:** UX-DR6, UX-DR14, UX-DR33, UX-DR40, UX-DR52, UX-DR65, UX-DR66 · **Issue / branch / PR:** one issue, branch `story/4.4-explanation-card`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a covered subject with its default peer group and a stored explanation whose digest matches the current engine output for that company and dataset
**When** Oversikt renders
**Then** the full-width explanation card shows the kicker "Forklaring" with ✦, the text clamped to two lines with "Les mer" expanding in place, and the source line "Skrevet av KI ut fra tall Peerless har regnet ut. Hvert tall finnes i analysen." with the key "✦ KI-generert"
**And** ✦ is `aria-hidden` and screen readers hear "KI-generert" once for the card; no number in the text carries ✦
**And** every figure in the text is a link to its calculation ("Hvordan er dette regnet?", Story 3.7)

**Given** a stored explanation whose digest does not match, or no stored explanation
**When** Oversikt renders
**Then** the card reads "Det finnes ingen lagret forklaring for dette selskapet." and nothing is generated

**Given** an adjusted peer group (any exclusion or a widened band)
**When** Oversikt renders
**Then** the explanation is hidden and the card reads "Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den." with the action "Tilbakestill", which clears exclusions, returns the band to Standard and keeps `andel` and `multippel` (the criterion moved here from Story 2.8)
**And** after the reset the explanation is shown, and focus moves to the explanation heading

**Given** a 62.100 company outside the demo seed
**When** Oversikt renders
**Then** the stored explanation built from its API figures is shown as normal

**Given** the card at 375 px and 320 px
**When** it renders
**Then** it is full width, "Les mer" is at least 24 × 24 px, and the body does not scroll horizontally

## Epic 5: Prove it and make it runnable — measurement, demo seed and About page

The labelled set (30 × 30 in 62.100, started in week 1 as calendar work, in parallel with Epics 1–4) and the layer-by-layer ablation, with embeddings last and cut first; the demo seed with companies A, B and C, the licence gate, the allow-list test and the 30-explanation review recorded in `docs/ai-sessions/`; "Slik fungerer Peerless" completed around the "Kilder og lisens" section Story 1.6b created, with the document-figure paragraph published with the licence assessment (Story 5.4) and results once they exist; the 62.100 entry in `seed/coverage.json` set to measured: true with a reference to its measurement report (FR-3); the README proven from a fresh clone.

### Story 5.1: The labelled set

**Calendar work: this story starts in week 1, in parallel with Epic 1**, so that it is complete when Story 5.2 starts directly after Epic 2.

As a sensor assessing the peer selection,
I want a hand-labelled set of genuine comparables built to a stated sampling frame,
So that the funnel is measured against judgements made independently of it.

**Implements:** FR-70 · **Invariants:** – · **UX:** – · **Issue / branch / PR:** one issue, branch `story/5.1-labelled-set`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the sampling frame
**When** the set is drawn
**Then** it holds 30 subjects in 62.100 and, for each, 30 candidates drawn at random from the subject's size band — never from funnel output — about 900 judgements, with the random seed and the draw script committed
**And** the subjects are stratified by description quality (informative / uninformative), with the rule for each written before labelling

**Given** the labelling rubric
**When** it is committed
**Then** it is written and dated before the fingerprint's feature list is fixed in Story 2.5 (the commit dates show the order)

**Given** a blind subsample
**When** it is labelled
**Then** it is labelled from description and website only, without accounts, and marked as such in the data

**Given** a second labeller
**When** they label about 50 pairs
**Then** Cohen's κ is reported with the pairs used

**Given** the set as achieved
**When** it is committed
**Then** the counts actually achieved are reported (subjects, pairs, blind subsample, κ pairs), and the stated pooling fallback is applied and reported if a stratum falls short

### Story 5.2: Layer-by-layer measurement

As a sensor assessing the project,
I want precision and recall reported for each funnel layer, alone and cumulatively,
So that the report shows where the improvement comes from, and whether the model earns its place.

**Implements:** FR-3 (62.100 measured), FR-13 (each band confirmed or dropped against the labelled set), NFR23 (SM-1), NFR24 (SM-1b), NFR32 · **Invariants:** AD-2, AD-13, AD-16 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/5.2-layer-measurement`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the labelled set and the funnel from Epic 2
**When** the measurement runs
**Then** it reports precision and recall per layer — industry code and size; adding the fingerprint; adding classification — standalone and cumulative, split by informative and uninformative descriptions
**And** flagged candidates (FR-14) are reported apart from the rest
**And** SM-1b compares the full funnel with an industry-code-only baseline, as a sanity check and not a claim

**Given** the two banded measures in the fingerprint — the cost-of-goods share band and the personnel-cost share band (FR-13)
**When** the measurement runs
**Then** it reports precision and recall with and without each band, and the report records for each band whether it is kept or dropped, with the reason
**And** if a band is dropped, this story's PR updates Story 2.5's rule — the fingerprint type in `src/engine/fingerprint.ts`, its migration check and the rule deriving a business type from the fingerprint — and the technical note's "Rules fixed by the stories" in the same PR, and step 2 rebuilds the fingerprints (their input digests change, AD-13)

**Given** the report
**When** it is written
**Then** it goes to `analysis/output/` with its generation date and the script that produced it, and states no numeric target (NFR32)

**Given** the finished report
**When** this story completes
**Then** `seed/coverage.json` has the 62.100 entry `{"code": "62.100", "measured": true, "report": "analysis/output/<file>.md", "sha256": "…"}`, with the report path and its SHA-256, not only the flag
**And** `pnpm seed` accepts the entry, and the CI seed job passes with it

### Story 5.3: Embeddings — last, and cut first

As a sensor assessing the project,
I want description embeddings measured as one optional layer,
So that the ablation shows whether embeddings beat classification, without them ever choosing a peer.

**Implements:** FR-68, FR-72 (the measurement section, four layers), NFR23 (SM-1 with four layers) · **Invariants:** AD-2, AD-3, AD-7 · **UX:** UX-DR35 · **Issue / branch / PR:** one issue, branch `story/5.3-embeddings`, one PR (AGENTS.md Git workflow)

This is the last story in v1 and the first cut if time runs short.

**Acceptance Criteria:**

**Given** the technical note
**When** this story starts
**Then** pgvector moves from "Deferred" to the stack in the technical note, in this story's PR (deferred reconcile item 6)

**Given** batch step 2
**When** it computes embeddings
**Then** they are computed in batch only, stored with pgvector, and read by no request path (test: no module under `src/app` or `src/server` queries the embedding table)
**And** no peer reaches a user's group by embedding similarity

**Given** the embedding table
**When** it is migrated
**Then** it is written only by `derive` and references the company `ON DELETE CASCADE` (AD-2), and Story 2.4's deletion test covers it

**Given** SM-1
**When** it is re-run
**Then** the report shows three layers without embeddings and four with them, so a reader can see both

**Given** the measurement section of `/slik-fungerer-peerless` (Story 5.6)
**When** this story's report exists
**Then** the section is updated with the four-layer result, read from the committed report like the other measurement figures (Story 5.6's test still passes)

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — an embedding reaching a peer group or the request path (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 5.4: The demo seed

As a sensor or developer running Peerless from a fresh clone,
I want a committed demo seed with three demo companies that show everything v1 does,
So that the full analysis runs locally without any key, within what the licence allows.

**Implements:** FR-73, FR-65 (document-figure credit paragraph), FR-72 (the document-figure paragraph in "Kilder og lisens") · **Invariants:** AD-9, AD-16 · **UX:** UX-DR35, UX-DR40, UX-DR42, UX-DR43, UX-DR63 · **Issue / branch / PR:** one issue, branch `story/5.4-demo-seed`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the 62.100 data
**When** the demo companies are settled
**Then** A is chosen as a typical consultancy with a full analysis and B as a loss-making product company showing fingerprint separation and a large gap, each recorded with the reason it was chosen
**And** C is not chosen again: this story confirms the `69.202` company chosen in Story 1.3a, recorded in step 1's configuration file, still shows the uncovered state from API figures alone
**And** the placeholders for A and B from Stories 1.5 and 1.6b are replaced with their links (tests for the not-in-database and no-match states)

**Given** the licence gate
**When** it is assessed
**Then** a short assessment is recorded in the repository of whether committing derived categories (fingerprint categories) is low risk, and the gate opens only if it concludes so
**And** the result is written as the committed, machine-readable file `docs/licence-gate.json` — whether the gate is open or closed, the assessment's path and date — which `pnpm seed:export` reads (Story 2.5) to decide whether fingerprint categories are exported; it sits outside `seed/` because `seed/coverage.json` is the one hand-edited file there (AD-16)

**Given** `/slik-fungerer-peerless`
**When** this story is merged
**Then** the "Kilder og lisens" section from Story 1.6b holds the document-figure paragraph, published in this story whether the gate opens or not (FR-65): figures from the filed documents are credited to Brønnøysundregistrene as their source, read by Peerless, with no licence asserted, distinguished from the NLOD credit for API figures
**And** only its wording about fingerprint categories depends on the assessment: with the gate open it keeps EXPERIENCE's "og for resten av bransjen bare avledede kategorier"; with it closed that phrase is dropped
**And** the "Ikke i demodataene" popover links to the paragraph (link test)

**Given** the gate stays closed (deferred reconcile item 1)
**When** the demo seed is exported
**Then** it contains fingerprint categories for allow-listed companies only — A, B, their peers and the OCR reference filings keep theirs, so B still shows fingerprint separation — and a 62.100 company outside the allow-list gets funnel stages 1–3 plus classification, with match basis "Kun beskrivelse" or "Kun bransje og størrelse"
**And** EXPERIENCE's outside-the-demo-seed state is edited in this PR to say what is shown then: stage 4 "Forretningsmodell" reads "Ikke kjørt – regnskapstall ikke i demodataene" with its count equal to stage 3's, and the about page's document-figure paragraph drops "for resten av bransjen bare avledede kategorier"
**And** with the gate open, fingerprint categories for every 62.100 candidate are committed and stage 4 runs as in Story 2.5

**Given** `seed/allow-list.json`
**When** it is written by `pnpm seed:export`
**Then** it lists A, B, C, A's and B's peers at all three band steps, and the OCR reference filings from Story 2.3 (reason "OCR-referansesett"), each entry with its reason, and a reviewer approves it in the PR
**And** the allow-list test reads every committed seed file regardless of its tag and fails on document figures for any unlisted orgnr, and the peer-group test asserts A's and B's groups at every step are subsets of the list

**Given** the committed demo seed
**When** `pnpm seed` loads it
**Then** it holds register data and API figures for every 62.100 company, stored classifications for all of them, full document figures for A, B and the allow-listed peers, API figures for C, and stored explanations for every 62.100 default group once Epic 4 and Story 5.5 are done (until then the seed carries none, and the explanation card shows its no-stored-explanation state)
**And** loading twice leaves the same state, and the CI seed job passes

**Given** the README
**When** it is read
**Then** it lists the three demo orgnrs and what each demonstrates

**Given** the PR
**When** it is opened
**Then** it states what could go wrong with this change — document figures beyond the declared sample reaching the public repository, and a licence claim the register does not make (AGENTS.md Working style) — and the reasoning is recorded in `docs/ai-log.md`

### Story 5.5: 30 explanations read by a person

As the owner of Peerless,
I want a sample of stored explanations read by a person before they are published,
So that recommending phrasing the list missed is caught and added.

**Implements:** FR-54, FR-73 (stored explanations in the demo seed) · **Invariants:** AD-7, AD-9, AD-13, AD-16 · **UX:** – · **Issue / branch / PR:** one issue, branch `story/5.5-explanation-review`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** the stored explanations for the demo seed
**When** the review is done, before they are committed to the demo seed
**Then** 30 are drawn at random (the seed of the draw recorded) and read by a person

**Given** the review
**When** it is recorded
**Then** the result is in `docs/ai-sessions/`: which texts were read, any recommending or otherwise problematic phrasing, and what was done about it

**Given** recommending phrasing the list missed
**When** it is found
**Then** it is added to the phrase list file, the explanations are regenerated or withheld under Story 4.3's rules, and the 30 texts pass the phrase test afterwards

**Given** the finished review
**When** `pnpm seed:export` runs
**Then** it writes the stored explanations into the committed demo seed, and every 62.100 default group has one, or a failure recorded in step 2's run record
**And** `pnpm seed` loads them with the FR-53 figure test, the FR-54 phrase check and the digest check all passing, and the CI seed job is green

### Story 5.6: "Slik fungerer Peerless" in full

As Kari, Anders or a sensor,
I want one page that explains in plain Norwegian how Peerless chooses peers, where AI is used, what has been measured and what it cannot do,
So that I can judge how far to trust the analysis.

**Implements:** FR-72 · **Invariants:** AD-7 · **UX:** UX-DR6, UX-DR34, UX-DR35, UX-DR63, UX-DR64, UX-DR66 · **Issue / branch / PR:** one issue, branch `story/5.6-about-page`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** `/slik-fungerer-peerless`
**When** it renders
**Then** it builds on the "Kilder og lisens" section from Story 1.6b, with the document-figure paragraph Story 5.4 published, adding sections with a table of contents (sticky on desktop, a bordered box on phone):
- the five funnel stages in plain language, without formulas;
- where AI is used — classification and the explanation — and that it never calculates, with the test sentence "En automatisk test sjekker hver lagrede forklaring mot tallene Peerless har regnet ut. En tekst med et tall som ikke finnes i beregningen, kommer ikke gjennom testen og tas ikke med.";
- the measurement: the SM-1 and SM-2 results once their reports exist, otherwise "Målingen pågår. Resultatene publiseres her når de foreligger." as a plain paragraph with no placeholder figures;
- the limitations: VAT in receivable days, cost-line classification, FTEs from the notes, the `smaaForetak` limit, and that only 62.100 is covered;
- data age
**And** the "Kilder og lisens" section and its document-figure paragraph are kept as Story 5.4 left them

**Given** the measurement section
**When** a report exists
**Then** the figures shown are read from the committed reports, and a test fails if the page shows a measurement figure with no report behind it

**Given** the technical note
**When** this story's PR is merged
**Then** the note points to EXPERIENCE's vocabulary and the message files as the UI copy convention (deferred reconcile item 7)

**Given** the page at 375 px and 320 px
**When** it renders
**Then** the body does not scroll horizontally, and the header and footer links resolve

### Story 5.7: Runs from a fresh clone

As a sensor,
I want to clone the repository on a clean machine and reach a complete analysis by following the README,
So that the project is demonstrably runnable without the authors' keys or accounts.

**Implements:** FR-73, NFR31 (SM-9), NFR29 (SM-7) · **Invariants:** AD-2, AD-9, AD-16, AD-19 · **UX:** UX-DR68 · **Issue / branch / PR:** one issue, branch `story/5.7-fresh-clone`, one PR (AGENTS.md Git workflow)

**Acceptance Criteria:**

**Given** a clean machine with only the README's prerequisites and no keys
**When** the README's five commands are run
**Then** they reach a complete analysis for demo companies A, B and C, and the full test suite, AI test mode included, passes
**And** the result is recorded in the PR (machine, date, commands, output)

**Given** a running analysis
**When** the no-network test runs
**Then** no request leaves for the register or a model host

**Given** the seed
**When** `pnpm seed` runs twice
**Then** the state is the same

**Given** `pnpm seed:full`
**When** it runs
**Then** it runs both batch steps (step 1 in Docker, then step 2), exports with `pnpm seed:export` to a gitignored path (listed in `.gitignore`, never committed), and loads through the same loader as `pnpm seed`, with the manifest's dataset `full`, truncating and replacing the loaded dataset (AD-9, AD-16)
**And** the README says that `pnpm seed:full` restores the full set, and that it takes hours
**And** the "Ikke i demodataene" popover text stays as EXPERIENCE gives it — "Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen. Hele datasettet bygges lokalt med pnpm seed:full." — naming the same command the README documents (test on the message file)

**Given** every page and state
**When** it is checked at 320 px
**Then** the body does not scroll horizontally

**Given** the PR
**When** it is written
**Then** it notes that CI has migrated a fresh database and loaded the committed seed on every pull request since Story 1.3b, so this is the final confirmation on a clean machine, not the first run

## Epic 6 (backlog, no stories): Stage 2 and stage 3

Not broken into stories. AGENTS.md: no stage 2 or stage 3 work starts until v1 runs from a fresh clone (Story 5.7).

**Stage 2:** FR-5, FR-28 (the view), FR-33 to FR-51, FR-63, FR-67, and the stage-2 parts of FR-6, FR-17, FR-26, FR-52, FR-62, FR-64, FR-66, FR-69.

**Stage 3:** FR-3 (`69.202` and `43.210`, each a line in `seed/coverage.json` once measured), FR-18 (loosening legal form and geography), FR-61 (industry overviews).
