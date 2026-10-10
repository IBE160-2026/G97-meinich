# Adversarial review — Architecture invariants (AD-1 to AD-11)

- **Target:** `technical-note-architecture.md`, section "Architecture invariants" (AD-1 to AD-11, data-flow diagram, stack seed, Deferred)
- **Context read:** the rest of the technical note, `AGENTS.md`, `docs/key-figures.md`, PRD FR-52/53/66/69/73, `EXPERIENCE.md`, run memlog
- **Date:** 2026-10-10
- **Method:** for each hole, two units one level down that each obey every AD to the letter and still build incompatibly. Each finding ends with a proposed rule in Binds / Prevents / Rule form.

## Verdict

**Not yet a sound spine; it needs changes before stories cite it.** The paradigm is right: a batch-built read model, one engine, no model call in a request, and grants as the boundary. Most ADs prevent what they claim to prevent. The weak points are the **seams**. The ADs say who computes, but not what crosses each boundary:

- Python → Postgres → TypeScript: units, nulls, derivation.
- Batch → request: engine version, inputs an explanation was written against.
- Server → browser: the wire format of "exact values".
- URL → parser: tokens and canonical form.
- Seed file → database: format, loader role, which dataset is loaded.

Every critical and high finding sits on one of those seams. Two dimensions are silent, secrets/config and the time of data. Observability is barely covered.

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 7 |
| Medium | 10 |
| Low | 5 |

---

## Critical

### C-1 — The money unit and the shape of a raw figure are unbound at the Python → TypeScript seam

**Pair.** Step-1 developer (Python) and step-2 / request developer (TypeScript).

- AD-8 binds integer øre only "everywhere the engine runs", and the engine never runs in Python.
- The step-1 developer stores the register's values as filed: whole kroner from the document, and API values as the JSON gives them. For a filing "i hele tusen", the developer either stores the printed number or scales it.
- The TypeScript developer reads `bigint` columns and, obeying AD-8, treats them as øre.
- Every AD holds, and every amount is off by 100. Thousands-reporters are off by another 1 000, or not, depending on a choice nobody owns.
- Nothing crashes. The reconciliation still passes, because it runs inside one unit system. This is the exact failure AGENTS.md warns about ("Nothing crashes; the number is just wrong").

**Proposed rule — AD-12 "The raw-figure contract".**
- **Binds:** every `register` column holding an amount, step 1, step 2, the seed files, the request path.
- **Prevents:** a factor-100 or factor-1000 error between the writer and the reader of a raw figure.
- **Rule:**
  - Every amount column in `register` is `bigint` in øre, and its name ends in `_ore`. A migration `CHECK` and a column comment state the unit.
  - Step 1 converts to øre and resolves the filing's reporting unit before writing. The scale factor is stored in its own column (`rapporteringsenhet`) for provenance.
  - Nothing is ever written as `numeric` or `double precision`.
  - A contract test runs step 1 against a migrated database and a fixed fixture filing, the 2025 filing for 979607008. It asserts that `sumDriftsinntekter_ore` equals the hand value × 100.

### C-2 — Stored explanations and fingerprints are not bound to the engine version or the inputs they were made from

**Pair 1.** Batch step 2 at commit X, and the request path at commit Y. Both obey AD-1: same module, different versions.

- Step 2 generates the explanation and the fingerprint categories at X. These are committed in the demo seed.
- A later story changes a formula in `docs/key-figures.md` and `src/engine` in the same commit, as AGENTS.md demands.
- The request path at Y renders new figures next to text written against X's figures.
- The FR-53 re-check "when a seed is loaded" only runs when someone reloads. It checks containment and attachment, not that the text was written for *this* peer group and *these* inputs.
- A text saying "the largest gap is X" can therefore pass every check and still be false. Example: the full seed adds document figures, and a document-based gap is now larger.
- Fingerprint categories are worse. Outside the demo set the request path cannot recompute them, because it has no document figures. A changed band threshold leaves stale categories in stage 4, and nothing can detect it.

**Pair 2.** The seed loader and the request path.

- AD-7 says an explanation that fails at load "is not shown". To hide it, either the loader writes a flag into step 2's table, which breaks AD-2's one-writer rule, or the request path re-checks, which no AD assigns. Two developers will pick differently.

**Proposed rule — AD-13 "Derived rows are stamped and bound".**
- **Binds:** fingerprint categories, classifications, stored explanations, default analyses, the seed, the request path.
- **Prevents:** text or categories produced by one engine or dataset being shown beside another's figures.
- **Rule:**
  - `src/engine` exports `ENGINE_VERSION`, a hash of `src/engine/**` checked by a test, or a semver bumped by any change to `docs/key-figures.md`.
  - Every derived row stores `engine_version`.
  - Every stored explanation also stores `input_digest`: a canonical hash of the subject's and default peers' engine inputs and the dataset tag.
  - The request path shows an explanation **only if** its `engine_version` equals the running engine's and its `input_digest` equals the digest of the inputs it is about to render. This is the single place "not shown" is decided, and nothing writes a hidden flag.
  - CI fails if any committed derived row's `engine_version` differs from the current one, which forces a regeneration in the same PR as an engine change.
  - The FR-53 check at load becomes a loud gate: the load reports failures and exits non-zero. It is not a silent hide.

---

## High

### H-1 — Two owners of "derive a missing component" and three meanings of NULL

**Pair.** The Python reconciliation and the engine's "Undefined is not zero" rule.

- AGENTS.md says to derive a missing component from its stated sum. `docs/key-figures.md` makes that derivation part of the key-figure definition, so it belongs to the engine.
- AD-1 says Python never computes "a ratio, distribution or amount". Step 1 must still do the subtotal arithmetic to reconcile.
- The step-1 developer derives `langsiktigGjeld` while reconciling and stores the derived value. The engine developer also derives when the value is null. Two derivations then exist, and they can disagree on rounding.
- The worse case: Python stores NULL for four different states:
  - an empty element,
  - a figure not extracted because the company is outside the demo set,
  - a filing that failed reconciliation (FR-71),
  - a figure that is not in the filing at all.
- The UI has three distinct copies for these states: "Kan ikke beregnes", "Ikke i demodataene" and "Regnskapet … kunne ikke leses sikkert". The engine cannot tell them apart.

**Proposed rule — AD-14 "Figures are stored as filed, with a state".**
- **Binds:** step 1's output tables, the engine's input type.
- **Prevents:** double derivation, and a NULL rendered as the wrong state, or as zero.
- **Rule:**
  - Step 1 stores each figure exactly as filed (`_ore` or NULL for an empty element) together with its stated totals. It never stores a derived value.
  - Each filing row carries `extraction_status ∈ {reconciled, failed_reconciliation, not_extracted, paper}`, plus the per-check results.
  - Derivation of missing components lives only in `src/engine`.
  - The engine's input type is a discriminated union per figure, `{kind: 'value', ore} | {kind: 'empty'} | {kind: 'not_in_dataset'} | {kind: 'unreadable'}`. Each kind maps to exactly one UI state.

### H-2 — "Exact values the server sent" has no wire format, so server and browser round differently

**Pair.** The server render and the browser scaler.

- AD-6 lets the server send "integer øre or decimal strings".
- The full-convergence profit uplift, (T − r) × revenue, is not a whole number of øre. The server developer sends it rounded to øre, because that is "integer øre", and computes the 50 % Verdi card for the server render from the unrounded Decimal it holds in memory.
- The browser scales the rounded øre value. On a .5-krone boundary, the first paint and the post-hydration value differ by one krone.
- AD-6's identity test passes, because it feeds both sides the "same inputs", and the server's real path does not use those inputs.
- A second variant: Decimal objects do not cross the RSC boundary, so a developer passes `.toNumber()`. That is a float, and nothing in AD-8 catches it at the boundary.
- The precision of `s_med`, a non-terminating quotient, is unspecified.

**Proposed rule — tighten AD-6 with a "wire codec".**
- **Binds:** every exact value passed from a server component to a client component.
- **Prevents:** server and browser starting the same scaling from different values.
- **Rule:**
  - `src/engine/wire.ts` defines `toWire` and `fromWire`: amounts as decimal strings at full Decimal precision, never pre-rounded to øre, and the decimal library's precision fixed in one config.
  - The server computes its own rendering of scaled amounts by calling `scale(fromWire(toWire(x)), s, m)`, the same call the browser makes.
  - A type-level ban stops a `number` from appearing in the props of a client component that receives money or ratios: a branded `WireDecimal` string type.

### H-3 — The search story needs an endpoint that AD-4 forbids, and AD-10 does not say what it covers

**Pair.** The search story and the analysis story.

- EXPERIENCE.md's combobox debounces queries at 300 ms and shows 8 results. That requires a request surface returning data: a route handler, a server action, or an RSC fetch.
- AD-4 says "v1 has no open JSON endpoints". The search developer uses a server action, because "it is not a JSON endpoint". A server action is a publicly callable POST endpoint.
- The analysis developer applies AD-10's limiter "on the open route", meaning `/analyse/*`.
- The result is an unthrottled enumeration interface: prefix queries harvest every name, orgnr and municipality in the seed. Peer lists then harvest revenue and margin, 25 at a time.
- RSC navigation payloads (`?_rsc=`) are also data responses that a limiter scoped to page routes might miss.

**Proposed rule — AD-15 "The request surface is enumerated".**
- **Binds:** every HTTP surface the Next.js app exposes.
- **Prevents:** an unlisted endpoint escaping the rate limit or the "figures of this analysis only" rule.
- **Rule:**
  - v1 exposes exactly these surfaces:
    - `GET /`, `/om`, `/analyse/{orgnr}[/{fane}]`, including their RSC payloads;
    - one search handler `GET /api/sok?q=`, with a minimum of 2 characters, at most 8 rows, and fields name, orgnr, primary industry and municipality.
  - Server actions are not used in v1.
  - The AD-10 limiter is applied at one choke point, the Next.js proxy/middleware, matching every path above.
  - A test lists the built route manifest and fails on any surface not in this list.

### H-4 — The seed has two hand-off paths, a third writer, and a bypassable load

**Pair.** The step-1 developer and the seed-loader developer.

- The technical note says "the ingestion pipeline writes its output … to seed files". AD-2 says the steps write to Postgres. The diagram shows `REG <--> SEED`.
- The step-1 developer writes CSV seed files directly from Python. The step-2 developer reads Postgres.
- The loader, which needs a role that writes every `register` table, is a third writer. AD-2 says "each table has exactly one writing step", and AD-3 grants writes only to "batch roles".
- The Supabase CLI auto-runs `supabase/seed.sql` on `supabase db reset`. If the demo seed is placed there, which is the CLI convention, it loads without the FR-53 load check, because SQL cannot run `src/engine`.
- Neither the seed format nor its compatibility with the migration level is versioned. A migration that adds a column makes the committed seed fail to load, or load partially.

**Proposed rule — AD-16 "One seed path".**
- **Binds:** `pnpm seed`, `pnpm seed:full`, `pnpm seed:export`, the Supabase config, migrations.
- **Prevents:** a second producer of seed files, a load that skips FR-53, and a seed that does not match the schema.
- **Rule:**
  - Postgres is the only hand-off between steps.
  - Seed files are produced only by `pnpm seed:export` from a database. The export is deterministic: sorted, stable formatting, so diffs review cleanly.
  - Seed files are consumed only by `pnpm seed`. It runs as a dedicated `seed_loader` role that may only `TRUNCATE` and `COPY` into `register`, and it runs the FR-53 / AD-13 gate.
  - Each seed carries a manifest with the latest migration id, `ENGINE_VERSION`, the dataset tag and the read-date range. The loader refuses a manifest that does not match.
  - `supabase/config.toml` disables the CLI's automatic seeding.
  - CI migrates a fresh database and loads the committed demo seed.

### H-5 — The dataset tag has no defined meaning, so demo and full collide, and the allow-list test can be fooled

**Pair 1.** The loader developer and the CI allow-list developer.

- AD-9 says rows "carry a dataset tag". It does not say whether the tag means *which build produced the row* or *which level may contain it*.
- Company A's document figures exist in both levels.
- One developer emits a row per level, which duplicates the key or breaks "loading twice leaves the same state". The other emits one row tagged `demo`.
- The CI developer filters committed files by `tag = 'demo'` and checks orgnrs. A row tagged `full` that is committed by accident passes.
- The allow-list "A's and B's peers at all three band steps" is *computed*. If the test derives it from the seed it is checking, a bug that adds a company to a peer group also widens the allow-list.

**Pair 2.** A stored explanation tagged `demo` after the user runs `pnpm seed:full`.

- AD-7 does not say whether it is shown, hidden or regenerated. Regenerating it needs a key, which a sensor does not have.

**Proposed rule — tighten AD-9.**
- **Rule:**
  - A database holds exactly one dataset at a time. `pnpm seed` and `pnpm seed:full` each truncate and replace, and the loaded tag is recorded in a one-row `register.dataset` table.
  - The row tag records the dataset that produced the row.
  - The CI test reads **every** committed seed file regardless of tag, keyed by orgnr. It checks against an explicit committed `seed/allow-list.json` (orgnrs), which `seed:export` writes and a reviewer approves. A second test asserts that the computed peer groups of A and B at all three steps are a subset of that list.
  - An explanation is shown only if its tag equals the loaded dataset (AD-13 digest). After `seed:full` without a key, explanations outside the demo set show the "no stored explanation" state.

### H-6 — The URL is two grammars: tokens, bounds and the "candidate pool" differ between the UX and AD-5

**Pair 1.** The URL schema (server) and the Verdi client (browser writer).

- AD-5: "share from fixed lists". The browser's "Til medianen" step must write *something*.
- One developer writes the exact `s_med` as a number via `replaceState`. The validator rejects it, as not on the list, and on reload falls back to 50 % with the "invalid settings" notice.
- The other writes `andel=median`. Then nobody defines what happens when the median step is disabled, because r ≥ M, perhaps after an exclusion: is that invalid, with the notice, or valid but unavailable?

**Pair 2.** The multiple field (EXPERIENCE: "any number > 0 with up to one decimal") and AD-5 ("(0, 50]").

- A user enters 75. The browser accepts it and writes it to the URL, and the server discards it on the next render. The page changes under the user.

**Pair 3.** "Candidate pool at the current band step" (AD-5) against "excluded orgnr not in the current group → ignored" (EXPERIENCE).

- An excluded peer is, by definition, not in the current group. One parser keeps exclusions that belong to the post-stage-5 pool, and the other drops them.
- Narrowing the band silently drops an exclusion that widening back cannot restore. The cap has no overflow rule: truncate or reject.

**Pair 4.** Two URL writers.

- An exclusion is a `router.push`, built from the search params at click time. A share change made while that navigation is in flight is a `replaceState`.
- When the push resolves it overwrites the share. Nothing owns ordering.

**Proposed rule — tighten AD-5 and AD-6.**
- **Rule:**
  - One module, `src/url/analysis-state.ts`, exports `parse` and `serialize` and is imported by server and client.
  - Canonical form:
    - path `/analyse/{orgnr}/{fane}`, where `fane ∈ {oversikt, peers, nokkeltall, verdi}`, and `/analyse/{orgnr}` redirects to `oversikt` for a covered company;
    - `ekskl=` as a comma-separated, sorted, de-duplicated orgnr list, capped at 20, with excess dropped from the end;
    - `band ∈ {0,1,2}`;
    - `andel ∈ {0,25,50,75,100,median}`, where `median` is valid only where s_med exists and otherwise falls back to 50 % with the notice;
    - `multippel` serialized with a point, parsed with a point or a comma, in (0, 50].
  - The client input validators import the same bounds.
  - Exclusions are validated against the stage-5 candidate pool at the **widest** step, so a band change never drops one. They apply only to peers present at the current step.
  - All URL writes go through one `useAnalysisUrl` hook that serializes from a single state object and uses Next's integrated `history.replaceState` / `router.push`.
  - "Default peer group" is a predicate on parsed state, not on the URL string.

### H-7 — Stage 2: FR-66 removal from saved analyses has no lawful writer

**Pair.** The stage-2 saved-analysis story (AD-11: user data only via the user's JWT and RLS, never the service role) and the step-1 withdrawal check (FR-66: "the check belongs to the ingestion job"; removal reaches saved analyses).

- Step 1 may not write `app` (AD-2, AD-3). The user's JWT cannot reach other users' analyses.
- The only way through is the service role, which AD-11 forbids.
- One developer adds a service-role purge in the batch. Another leaves saved analyses untouched. Both cite an AD.

**Proposed rule — AD-17 "One cross-schema path".**
- **Binds:** FR-66 in stage 2, the `app` schema.
- **Prevents:** a batch holding the service role, and a withdrawn company surviving in saved work.
- **Rule:**
  - The only write from batch into `app` is `app.purge_withdrawn(orgnr)`, a `SECURITY DEFINER` function defined in a migration.
  - It is executable only by step 1's role. It is audit-logged with a system actor, and it performs exactly the FR-66 subject and peer edits.
  - The authorisation suite asserts that the function cannot be called by `authenticated` or `anon`.

---

## Medium

### M-1 — Two stored sources for the default analysis

AD-2 has step 2 write "default analyses". AD-6 has the server compute everything for the URL state.

- For the default URL, one developer renders the stored default analysis, which is fast and fits the performance target. Another recomputes it.
- They diverge after any engine or data change.

**Rule (in AD-13):** stored default analyses are batch-internal. They are inputs to explanation generation and the measurement, and the request path never displays them. The only stored derived values the request path reads are fingerprint categories and classifications, which it cannot recompute.

### M-2 — No single display formatter, while FR-53 depends on formatting

The FR-53 checker parses Norwegian formats, and the renderer formats with `Intl.NumberFormat('nb-NO')`.

- The batch prompt builder that hands figures to the model may format with a third routine.
- Node's ICU and the browser's ICU can differ on the group separator (U+00A0 or U+202F) and the minus sign. That causes hydration mismatches and checker misses.
- `Intl` on a converted Decimal (`toNumber()`) loses precision above 2^53, and that conversion is itself a float.

**Rule (extend AD-8):**
- `src/engine/format.ts` is the only formatter. It takes Decimal strings and pins the separators explicitly rather than trusting the ICU.
- The prompt builder, the server render, the browser and the FR-53 checker all use it.
- AD-6's identity test runs once in Node and once in a real browser engine.

### M-3 — Covered industries have two possible owners

FR-73 says adding an industry is "data, not code". EXPERIENCE.md's copy hard-codes "62.100", and AD-7 says "every 62.100 company".

- The analysis developer checks `naeringskode1 === '62.100'` in TypeScript. The batch developer reads a table.

**Rule:**
- `register.covered_industry(naeringskode, measured_at)` is written by step 2 only.
- Request code and copy interpolate from it.
- A lint rule bans the literal `62.100` outside `seed/`.

### M-4 — The fingerprint category shape disagrees between documents

PRD FR-73 lists five committed categories, including the **personnel-cost band**. The technical note's demo seed list names four and omits it.

- The step-2 developer writes four, and the funnel developer reads five. Stage 4 then breaks for every non-demo company.
- The band boundaries are also "proposed rather than settled" in the decision points, yet they are committed as categories.

**Rule:**
- The fingerprint is a single TypeScript type in `src/engine/fingerprint.ts`, mirrored by a migration enum or check, with an explicit band-boundary table versioned under `ENGINE_VERSION` (AD-13).
- Fix the technical note's list to match the PRD, or the reverse.

### M-5 — Batch failures have no owner, and "unclassified" conflates outage with no text

The technical note says a company with nothing to classify is stored as unclassified and still passes stages 1–4.

- A model outage halfway through step 2 produces the same state. The funnel then silently treats hundreds of companies as having nothing to classify, which contaminates SM-1.
- Step 1 also has no owner for a filing that fails reconciliation, beyond "blocks the filing".

**Rule:**
- Classification status is an enum: `classified`, `no_text`, `failed`, `pending`.
- `seed:export` refuses to export while any row in a covered industry is `failed` or `pending`.
- Each batch run writes a run record: start, end, counts per status, `ENGINE_VERSION`, model id and prompt hash. `pnpm seed` prints it.

### M-6 — The time of data is silent

Questions no AD answers:

- Who stamps the "read date" (FR-64)?
- In what time zone is it stamped?
- Does the seed preserve it, or does the loader overwrite it with the load time?
- Is the engine allowed a clock, for example a developer deriving "benchmark year" from `new Date()` rather than from the subject's latest filing?

A server in UTC and a browser in Europe/Oslo also format the same timestamp to different dates around midnight, which is a hydration mismatch.

**Rule — AD-18 "Data time".**
- `read_at timestamptz` is stamped by step 1 at fetch and preserved through export and load.
- The engine takes no clock; the benchmark year is derived only from data.
- Dates are formatted server-side only, in `Europe/Oslo`.
- The data date shown is the loaded dataset's manifest range (AD-16).

### M-7 — Deferred caching can let two renders of one URL diverge

"Caching of server renders" is deferred to the stories.

- A story that adds `use cache` keyed by path, forgetting the search params, serves another URL's figures.
- A cache that survives `pnpm seed` serves figures and explanations from the previous dataset, under a data date that is now wrong.

**Rule (constrain the Deferred item):** any render cache key includes the full canonical parsed state (H-6), the loaded dataset id and `ENGINE_VERSION`. Every seed load invalidates it.

### M-8 — Secrets and config are silent

Nothing names:

- the environment variables, or which ones are server-only;
- where the reader-role password is defined, given that migrations are committed;
- where the model key lives (a step-2 `.env`, never Next's);
- how the reader module is kept out of the client bundle.

The browser imports `src/engine`. A barrel file that re-exports a database helper beside the engine pulls `postgres` and the connection string into the client.

**Rule — AD-19 "Config and secrets".**
- Next.js reads `READER_DATABASE_URL` only in `src/server/db.ts`, which starts with `import 'server-only'`.
- No secret uses the `NEXT_PUBLIC_` prefix, and a CI grep fails on one.
- The model key is read only under `scripts/batch/`.
- An ESLint `no-restricted-imports` rule forbids `src/server/**` and `postgres` from any `'use client'` module and from `src/engine/**`.
- Role passwords for local work come from the Supabase CLI's local defaults or `.env`, never from a migration.

### M-9 — Stage-2 stories write as an anonymous session, which FR-69 forbids

FR-69 and the technical note state "No anonymous session writes to any table". Three stage-2 stories each write a row because of an anonymous request:

- the append-only audit log, where "every analysis, anonymous or not, resolves to an actor";
- the description-classification cache "against that text", open to anonymous sessions;
- persistent per-session rate limiting.

Each developer can cite their FR. Also, a description cache in a shared table stores one user's text where another user's request can hit it.

**Rule:**
- Distinguish *user writes* (through the JWT, never anonymous) from *system writes*.
- System writes go only through named `SECURITY DEFINER` functions listed in a migration, are never exposed through REST tables, and never hold user-entered text in plain form: cache by hash, scoped to the session.
- The authorisation suite asserts that an anonymous JWT cannot `INSERT` into any `app` table directly.

### M-10 — FR-66 in v1 crosses step boundaries and the committed seed

Step 1 deletes a withdrawn company. Its fingerprint, classification and any explanation *naming it as a peer* are step-2 rows, which step 1 may not touch under AD-2.

- The committed demo seed in git still holds it, and nothing makes the seed regenerate.

**Rule:**
- Every derived table references `register.company(orgnr)` `ON DELETE CASCADE`.
- Explanations store the peer orgnrs they name, and the AD-13 digest invalidates them automatically.
- A step-1 deletion marks the dataset manifest stale, and CI fails until the seed is re-exported.

---

## Low

### L-1 — The in-memory rate limiter is not one counter

AD-10 assumes "the single local server process".

- In Next.js 16 the proxy/middleware and the route bundles can hold separate module instances.
- `next dev` resets module state on HMR.
- AD-10 does not say what counts: tab switches are server renders and burn the budget, while `replaceState` changes do not.

**Rule:** one counter on `globalThis`, applied only at the AD-15 choke point. The threshold and what counts are stated. The README says `pnpm start`, not `dev`, for the documented run.

### L-2 — Observability is not covered

No AD says what is logged. A default request logger or an error handler that prints `x-forwarded-for` writes IPs, which breaks AD-10's "no IP is written anywhere".

**Rule:** the server logger is one module that redacts IPs. No request-level logging of client addresses.

### L-3 — The orgnr edge cases differ between AD-5 and EXPERIENCE.md

- Nine digits failing modulus 11: AD-5 treats it as invalid, while EXPERIENCE.md only covers "not nine digits" and "not in the database".
- An uncovered company with a tab in the path, `/analyse/C/verdi`, is unspecified.

**Rule:** fold both into the H-6 canonical form. A modulus-11 failure shows the malformed-number message, and an uncovered company with a tab redirects to `/analyse/{orgnr}`.

### L-4 — Python has no schema contract

AD-3 claims to prevent "schema drift between the batch steps and the app". Step 1 writes columns by name, from Python, with no generated types.

**Rule:** CI runs step 1's writer against a freshly migrated database on a fixture (C-1's contract test). A Python model is generated from, or tested against, `information_schema`.

### L-5 — The model and prompt are not recorded per row

AD-7 pins the model id in configuration but does not store it per explanation or classification. The measurement (SM-1) cannot later say which model produced which label.

**Rule:** every classification and explanation row stores the model id and a prompt hash (see M-5).

---

## Good-spine checklist

### Is every Rule enforceable?

| AD | Enforceable as written? | Gap |
|---|---|---|
| AD-1 | Partly | "Python never computes a ratio, distribution or amount" has no check, and reconciliation is arithmetic (H-1). Add: step-1 tables have no derived-figure columns, so the rule is enforced by the schema. "Only scaling in the browser" needs the ESLint import rule (M-8). |
| AD-2 | Partly | "One writer per table" is enforceable by grants, but no AD says the grants are per step. The seed loader is an unlisted third writer (H-4). Add per-step writer roles with table-level `INSERT/UPDATE/DELETE`. |
| AD-3 | Yes | Add a test: an anon-key REST call to `register` fails. `config.toml` `schemas` is config, not migration, so assert it. |
| AD-4 | Partly | "No open JSON endpoints" contradicts the search UX (H-3). Make it testable by enumerating routes. |
| AD-5 | No | "Fixed lists", "capped" and "candidate pool" are not concrete enough to test (H-6). |
| AD-6 | Partly | The identity test is vacuous if the server path does not go through the wire (H-2), and if it only runs in Node (M-2). |
| AD-7 | Partly | "Not shown" has no mechanism and no writer (C-2). "Key exists only there" needs M-8's rule. |
| AD-8 | Partly | "One decimal library" is not named in the stack seed. Name it (e.g. `decimal.js`), fix precision and rounding mode in one config, and ban `number` for money with branded types. Says nothing about Python or the database (C-1). |
| AD-9 | Partly | The allow-list must be explicit and the test tag-blind (H-5). |
| AD-10 | Yes, for v1 | It still needs its scope (H-3, L-1). |
| AD-11 | Yes | It conflicts with FR-66 (H-7). |

### Does each one prevent its stated divergence?

| AD | Verdict | Why |
|---|---|---|
| AD-1 | Mostly | It prevents two engines, but not two versions of one engine (C-2). |
| AD-2 | No | Not while the loader and FR-66 deletion bypass it (H-4, M-10). |
| AD-4 | Not against harvesting | Not until the search surface is rate-limited (H-3). |
| AD-5 | No | It says "two parsers disagreeing" is prevented, but it binds one *server* schema, and the browser is a second writer and parser (H-6). |
| AD-6 | Not "different amounts for the same URL" | Not without a wire codec (H-2). |
| AD-7 | Not "text that cites figures the user cannot see" | Not across engine or dataset changes (C-2, H-5). |
| AD-9 | Only if the test is tag-blind | It prevents leakage only if the test is tag-blind and the list explicit (H-5). |
| AD-3, AD-8, AD-10, AD-11 | Yes | Within their scope. |

### Could anything under Deferred let two units diverge?

- **Caching of server renders.** Yes, see M-7. Constrain the cache key in the AD, and leave only the choice of mechanism to the stories.
- **Test runner and CI provider.** The choice is harmless, but AD-6's identity test needs a real browser engine (M-2). State that requirement now so the runner choice does not quietly drop it.
- **Embeddings.** Low risk. The vectors still need `engine_version` and model stamps (AD-13, L-5) to be comparable in the measurement.
- **Hosted deployment.** Safe to defer. AD-4's reader password and AD-10 both change shape there, so make "migrations contain no credentials" a v1 rule now (M-8).

### Silent dimensions

| Dimension | Status | Finding |
|---|---|---|
| Deployment and environments | Silent | Which command runs v1 (L-1) and the local/hosted config split (M-8). |
| Secrets and config | Silent | M-8, the largest gap given AGENTS.md's "Secrets never reach the client". |
| Observability and error handling | Mostly silent | Batch run records and failure states (M-5), IP-free logging (L-2). Request-path error states exist only in EXPERIENCE.md. |
| Data refresh | Partly covered | A manual refresh is disclosed, but nothing says what a refresh of step 1 without step 2 does to stored explanations (C-2), or to the seed manifest (H-4, M-10). |
| Migrations and seed-format versioning | Silent | H-4. |
| Time and date of data | Silent | M-6. |

### Mermaid diagram — GitHub rendering

**Syntax: valid.** I found no construct that breaks GitHub's Mermaid renderer.

- Subgraph ids with quoted titles (`subgraph Batch["Batch, never in a request"]`) are valid.
- The cylinder nodes with quoted labels and `<br/>` (`REG[("register schema<br/>…")]`) are valid.
- `<--> ` bidirectional links are supported in Mermaid 9.3 and later, which GitHub ships.
- The chained links with an edge label (`BR -->|URL| VAL --> ENG`, `ENG --> RENDER -->|…| BR`) are valid.
- The labels contain commas, `+`, `·`, `:` and `ø`. All are fine inside `|…|` and quoted labels.
- The edge to a subgraph id (`APP -.->|…| Next`) is supported.
- No node is named `end`.

**Semantic gaps.** These are not errors, but the diagram should show the architecture it claims:

- The browser's use of `src/engine` is text only. There is no edge, so the second engine site is invisible.
- The search request path is missing (H-3).
- `REG <--> SEED` hides that the load runs `src/engine` for the FR-53 gate (H-4).
- `LLM` sits inside the "Batch" subgraph although it is an external service.
- The `APP` cylinder is drawn in v1's database without a "stage 2" style. Consider `classDef` dashed.

Suggested additions:

```
BR -.->|scaling only| ENG2["src/engine<br/>(browser bundle)"]
BR -->|search, rate-limited| VAL
SEED -->|pnpm seed, FR-53 gate| TS
```

## Summary of proposed rules

| New / tightened | Closes |
|---|---|
| AD-12 Raw-figure contract (øre, `_ore`, unit column, contract test) | C-1, L-4 |
| AD-13 Derived rows stamped with `ENGINE_VERSION` and input digest; display only on match | C-2, M-1, M-10, L-5 |
| AD-14 Figures stored as filed, with a state; derivation only in the engine | H-1 |
| AD-6 tightened: wire codec, server scales through it | H-2 |
| AD-15 Enumerated request surface, one limiter choke point | H-3, L-1 |
| AD-16 One seed path: export/load only, loader role, manifest, CLI seeding off | H-4 |
| AD-9 tightened: one dataset per database, tag-blind CI over an explicit allow-list | H-5 |
| AD-5 tightened: one shared parse/serialize module, canonical grammar, one URL writer | H-6, L-3 |
| AD-17 One cross-schema path (`app.purge_withdrawn`) | H-7 |
| AD-8 extended: named decimal library, one formatter, real-browser identity test | M-2 |
| AD-18 Data time | M-6 |
| AD-19 Config and secrets | M-8, L-2 |
| Coverage table, fingerprint type, status enums, system-write functions | M-3, M-4, M-5, M-9 |
| Deferred caching constrained by cache key | M-7 |
