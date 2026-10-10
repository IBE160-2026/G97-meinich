# AGENTS.md

Project instructions for Peerless. Read this before writing code. `CLAUDE.md` imports this file, so Claude Code picks it up automatically.

## What this is

Peerless benchmarks a Norwegian company against genuinely comparable peers using public accounts data. The user enters an organisation number; the app assembles a peer group, computes ratios, converts every deviation into kroner, and lets the user explore what closing each gap would be worth.


**Read alongside this file:**
- `_bmad-output/planning-artifacts/briefs/brief-Peerless-2026-09-17/brief.md` — what the product is and who it serves
- `_bmad-output/planning-artifacts/technical-note-architecture.md` — architecture, test strategy, schedule
- `docs/data-sources-brreg.md` — data sources, verified field sets, API pitfalls
- `docs/key-figures.md` — every key figure's formula, source, direction and kroner translation

**These four are hand-written and authoritative.** They were not produced by a BMAD workflow, but they sit where BMAD expects its own output, so its skills read and update them instead of creating rivals.

The brief in particular occupies a canonical run folder — `brief-Peerless-2026-09-17/` holding `brief.md` with frontmatter and a seeded `.memlog.md`, matching `{planning_artifacts}/briefs/brief-{project_name}-{date}`. `bmad-product-brief` in **Update** or **Validate** intent therefore targets it directly. The same folder holds `addendum.md`: detail moved out of the brief to keep it short. It is kept, not authoritative — where it disagrees with the brief or the other three documents, they win. Do not invoke it with **Create** intent: that opens a second run folder and leaves two briefs that do not know about each other. If a workflow does produce a parallel artifact anyway, fold anything worth keeping back into the document above and delete the generated one rather than maintaining both.

The same applies to changes: when a finding or decision makes one of these wrong, edit it. Do not append a correction elsewhere and leave the original standing.

## Stack

**The application:** Next.js (App Router) + TypeScript. Supabase for Postgres, auth and row-level security. v1 runs locally from the README; Vercel and hosted Supabase come with stage 2. No request-serving backend service — all server-side code a user can reach lives in the Next.js app.

**The ingestion pipeline, in two batch steps.** Step 1 is Python, managed with `uv`, containerised because Tesseract needs a system binary: it bulk-loads register data, OCRs and reconciles the filed documents, and writes raw figures. Step 2 is Node scripts in this repository: it uses `src/engine` to compute fingerprints and default analyses, calls the model for classification and explanation, and runs the figure-validation test against the same engine. Both write to Postgres directly, are never in a user's request path, and nothing a user can reach may depend on either being up.

Keep that boundary. Python earns its place on OCR and document processing only and never computes a ratio — there is one engine, `src/engine`. Next.js reads public data server-side as a SELECT-only role; from stage 2, user data is reached through Next.js with the user's own token under row-level security. The binding decisions are AD-1 to AD-19 in the technical note's "Architecture invariants".

Use TypeScript strictly. Types are how we keep financial data from drifting; do not reach for `any`.

*The stack may change as the course progresses. If it does, update this file.*

## Non-negotiable rules

**Money is never a float.** Store and compute in integer øre, or use a decimal library. `0.1 + 0.2 !== 0.3` and the error compounds across periods. This applies to every monetary value, including intermediate results.

**Authorisation lives in the database.** Every table with user-scoped data gets row-level security policies. Never rely on the application layer filtering correctly — assume it will eventually fail and make that insufficient to leak data. Do not write an endpoint whose security depends on remembering to add a `where user_id = ...`. Anonymous visitors are Supabase anonymous users and hold the `authenticated` role — a policy that only checks for an authenticated user lets them in. Every policy on saved or user-entered data must also require `is_anonymous` to be false.

**The model never calculates.** The LLM is used for exactly two things: classifying what a company does, and writing explanatory text about figures the engine already computed. Any number appearing in generated text must exist in the calculation output. This is to be enforced by an automated test that rejects generated text containing figures absent from the engine's output — not by instructing the model and hoping. Once that test exists, do not weaken it.

**Rules before model.** If something can be solved deterministically, solve it deterministically and give the model only what is left over. Both layers are measured separately; that measurement is the project's main result.

**Never select peers on a measure that is benchmarked.** Peer matching may use what kind of business a company is — cost composition, inventory, capitalised intangibles, asset intensity — never how well it performs. Selecting on margin or return makes every gap in that measure close to zero. Any measure used in selection enters only in coarse bands — today cost of goods share and personnel cost share — and is benchmarked within its band.

**Peerless runs without our keys.** A fresh clone must run from the README on a local database with seed data — no API key, paid account, email or hosted service. Anything that calls a model or the register at runtime needs a test mode backed by stored output.

**Secrets never reach the client.** API keys, service-role credentials and database connection strings stay server-side. `.env` is gitignored from commit one.

**This file must match the code.** When a change makes something here wrong — the stack, a rule, a filename — update this file in the same commit. A stale instruction file is worse than none, because it is trusted.

## Known API traps

These are verified behaviours of the Brønnøysund API, not guesses. Full detail in `docs/data-sources-brreg.md`.

**The `år` parameter is silently ignored.** Requesting an earlier year returns the current filing with status 200 and no error. Never trust the requested year — always match on the returned `id` or `regnskapsperiode`.

**An empty XML element is not zero.** `<langsiktigGjeld/>` can come back empty while the real amount is recoverable from the difference against its stated sum. Derive missing components — in `src/engine` only; step 1 stores figures as filed (AD-15) — and do not default to zero.

**The filed documents contain no text layer — every page is an image.** Verified on 264 pages across all 15 available years for the test company. There is no rule-based parsing path; document figures require OCR. And note: a Chromium browser will show you selectable, searchable text anyway, because it runs its own OCR as an accessibility feature. That text is not in the file. Never verify a text layer in a browser.

**Never trust an OCR digit.** Observed substitutions include `이` and `o` for `0`, `l` for `1`, a Cyrillic `Р` inside `RESULTATREGNSKAP`, and lost Norwegian diacritics. The expensive errors were worse: figures split or merged wrongly, giving `722 632 310` for `72 632 310` and `8 335 514` for `833 514`. Nothing crashes; the number is just wrong. Recognition confidence does not help — a generic engine averaged 0.974 while producing all of these.

**Reconcile with two rules, and neither is exact equality.** *Between* sources — document against API — a proportional tolerance, because reporting in thousands or millions introduces scaling error. *Within* a document, a tight absolute bound of a few kroner. Do not demand exactness: the register prints whole kroner rounded from øre, so a stated subtotal can legitimately be a krone off its components. Verified — in the 2025 filing for 979607008, `Sum inntekter`, `Årsresultat` and `Sum gjeld` are each one krone off, while `Sum kostnader` and `Sum kortsiktig gjeld` are exact. A few kroner of absolute slack admits that rounding and still catches recognition errors, which are wrong by orders of magnitude.

**Match companies on organisation number only.** Names change over time — the same orgnr can be a different company name in an older filing.

**Two field names are misspelled in the API.** `sumInnskuttEgenkaptial`, and the object `regnkapsprinsipper` that holds `smaaForetak` and `regnskapsregler`. Do not "fix" either in the parser.

**Industry codes are SN2025, and the filter matches secondary codes.** Old SN2007 codes return nothing. The search API's `naeringskode` filter also matches `naeringskode2` and `naeringskode3`; filter on `naeringskode1.kode` when the primary industry is what you mean.

**Filter for comparability before comparing.** Currency, accounting framework, `smaaForetak`, `avviklingsregnskap`, financial period and `regnskapstype` must match the subject. All are exposed as fields.

## Code conventions

Keep the calculation engine as pure functions — figures in, figures out, no database or framework imports. It must be testable in isolation and readable by someone checking the accounting.

**Key figures are implemented exactly as defined in `docs/key-figures.md`.** A formula changes in the document and the code in the same commit. Cost shares have no kroner amount of their own: they are explained through the margin decomposition against the peer group as a whole, which is never scaled by the closable share or added to the profit uplift.

**The interface is Norwegian (bokmål); everything else is English.** All user-facing copy is written in Norwegian. Documentation, code identifiers and comments are in English, except register field names, which keep the register's own Norwegian.

Name domain concepts in Norwegian where the register does (`driftsresultat`, `sumEgenkapital`), and everything else in English. Do not translate register field names.

Prefer explicit over clever. This code will be read by a sensor who is checking whether the arithmetic is right.

**The site must be responsive.** It has to work down to phone width (~375px), not only on desktop. This is a course requirement, not a preference. The hard part here is that this is a data-dense product — ratio tables with four columns, distribution plots, a peer group list. Let the page reflow and stack to one column when narrow; give tables and charts their own `overflow-x: auto` container so they can be wider than the screen. The page body itself must never scroll horizontally. Check at phone width as you build, not at the end — retrofitting a fixed-width table layout is far more work than designing for reflow from the start.

## Testing

Write the authorisation test suite as soon as user-scoped data exists (stage 2), before any feature that stores it. It attempts every forbidden access pattern — reading another user's data, reaching another workspace, an anonymous session reading or writing saved data, a viewer writing, calling an endpoint unauthenticated — and asserts rejection.

The engine is tested against hand-calculated reference cases built from real filed accounts, including edge cases: negative equity, zero revenue, missing components, non-calendar financial year.

Peer classification is measured as precision and recall against a labelled set, compared to what industry code alone achieves.

## Things not to do

Do not add features that are listed as out of scope in the brief. Scope discipline is part of what is being graded. Do not start stage 2 or stage 3 until v1 runs from a fresh clone.

Do not introduce a second request-serving service, a message queue, or an ORM abstraction layer. The ingestion pipeline is the exception: two batch steps, Python step 1 and Node step 2 (AD-2), and neither is a service — keep it that way.

Do not use browser storage for anything that matters. State that must survive belongs in Postgres.

Do not OCR or fetch documents at query time. OCR takes seconds to tens of seconds per filing; extraction is pre-warmed by the batch job and stored — see the technical note.

## Git workflow

**Planning and documentation may go straight to `main`.** The brief, PRD, technical note, `docs/`, analysis reports and memlogs are committed on `main` with descriptive messages.

**Code goes through issue → branch → pull request, one story at a time.**
- Every story has a GitHub issue that names the story and the FRs it implements.
- Work happens on a branch named `story/<story-id>-<short-slug>`, never directly on `main`.
- The pull request links the issue (`Closes #n`), lists the FRs, says how it was tested, and links the AI session file in `docs/ai-sessions/`.
- Review before merging: read the diff, run the tests, and record in the PR what was found and corrected in AI-generated code. The review comments are part of what is graded.
- Small, scoped commits with messages that say what and why.

**AI sessions are saved.** Each working session that produces or changes code or a planning decision gets a file in `docs/ai-sessions/`, following the README there: the goal, the prompts that mattered, what was accepted, rejected or corrected, and links to the issue, PR or commits. `docs/ai-log.md` records the lessons; `docs/ai-sessions/` records the sessions themselves.

## Working style

When you propose a change touching auth, data access or money handling, say what could go wrong with it. That reasoning goes into the project's AI log, `docs/ai-log.md`, following the rules at the top of that file.

If a request conflicts with something in this file, say so rather than following it silently.


