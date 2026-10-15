# Story 1.5b: find a company by name or organisation number

**Date:** 2026-10-15
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #6, Story 1.5b
**Result:** branch `story/1.5b-search`; PR to follow.

## Goal

Make the front page work: a hero search over Peerless's own database by name or orgnr, through `GET /api/sok` and the request path's first database client, with the guards that keep that path closed. Built on the columns and index from Story 1.5a; no migration.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-5b-company-search.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human decisions frozen in the spec (2026-10-14 and 2026-10-15): demo links A and B as placeholders in one constant until Story 5.4; companies without a municipality or industry name still returned, shown without an empty separator; the front-page copy; the industry name and code read from the register, never a literal; municipality title-cased at display only; `/api/sok` validating `q` itself and escaping `LIKE` wildcards; the compact variant built and tested by markup now, mounted by 1.6b.

## What came back, and what was done with it

- **Accepted:**
  - `src/engine/orgnr.ts`: `classifySearchInput` (empty, name, orgnr, length, checksum) and `isValidOrgnr`, shared with the 1.6a URL module. `src/engine/format.ts` gains `formatKommune` and `lowerFirst`.
  - `src/messages`: `t(id, vars)` with `{name}` placeholders (a missing value throws; values are not re-expanded), all the new copy in `nb.json`, and `industry.ts`, which writes covered industries as "62.100 Dataprogrammeringstjenester" (lead) or "dataprogrammeringstjenester (62.100)" (mid-sentence) from `register.covered_industry` and the register's description.
  - `src/server/db.ts` (`readerSql()`, `import 'server-only'` on line 1, one client on `globalThis`, throws when the URL is unset) and `src/server/search.ts` (`searchCompanies`, `coveredIndustries`). The name query is the spec's: substring `LIKE` on the folded name plus `<%` word similarity, ordered by `word_similarity`, `navn`, `orgnr`, limit 8; operators and functions of `pg_trgm` qualified with `extensions`, which is not on `reader`'s search_path. Wildcards are escaped after folding, inside the SQL.
  - `src/search-contract.ts`: the endpoint, the limits and the four-field result type, shared by route, query and field without a client importing `src/server`.
  - `GET /api/sok`: 400 for `q` over 100 characters and for digits only that are not a valid orgnr, `[]` for empty or one character, 500 `{}` on a database error; it copies exactly the four fields and cuts to eight again.
  - `SearchField` (`hero` | `compact`): ARIA 1.2 combobox, 300 ms debounce with an aborted previous request, validation on submit and blur only, one polite live region for count, messages and loading, a separate alert for failure, demo links under the no-match and unknown-orgnr copy.
  - The front page (dynamic, `connection()`), the footer link "Kilder og lisens", `src/demo-companies.ts` (A = 813235552 ADMMIT AS, B = 814739082 EXEBENUS AS, both 2025 SELSKAP NOK filings with all three API figures computable, checked by `test/db/demo-companies.test.ts`).
  - `scripts/check-routes.ts` and `pnpm check:routes`, run in CI after `pnpm build`.
- **Decided in implementation, for review:**
  - Digits only with a count other than nine also get 400 from the API. The spec names only the mod-11 case; FR-1 says digits only are never a name, so the API follows the field.
  - The route exports only `GET` (Next.js refuses other exports from a route file), so the limits live in `src/search-contract.ts`.
  - A typed nine-digit valid orgnr shows its one result (or the unknown-orgnr copy) after the pause but never navigates; only Enter, a click or submit do.
  - The option line shows "62.100 Dataprogrammeringstjenester" (code and name, as in the lead), and the code alone when the name is NULL.
  - The compact variant's label is visually hidden and it has no placeholder; 1.6b decides its visible hint when it mounts it.
  - CI now loads the seed before `pnpm test:db`, because the search tests search the seed. Every database test still rolls back.
- **Corrected during implementation, and how it was caught:**
  - The first unknown orgnr in the e2e test, 910000014, fails modulus 11; the end-to-end test showed "Ugyldig organisasjonsnummer". It is 910000004 now, with a unit test that it is valid.
  - Two wildcard cases in the first database test ("_a_", "a%s") returned eight rows through word similarity on their letters, not through `LIKE`. They were replaced by punctuation-only inputs and by "dm%t" and "d_mit", which would match ADMMIT AS only if the wildcards were live.
  - **Found by the human:** the first e2e test of "%" against `/api/sok` passed for the wrong reason: a one-character `q` returns `[]` before any query runs, so escaping was never exercised. The test now sends "%%" and "_%".
- **Settled from Story 1.5a's deferred items:** NULL `naeringskode1_beskrivelse` shows the code alone (920768695 in the tests); the `EXPLAIN` test shows `company_navn_trgm` for names and `company_pkey` for an orgnr, run with `enable_seqscan = off` on the exact SQL the app runs. The ENK municipality question is not decided away: the spec returns the municipality for every company; the risk is in `docs/ai-log.md`.

## Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (22 files, 323 tests), `pnpm check:pins`, `pnpm check:env`: pass.
- `pnpm test:db` on the seeded local database (7 files, 105 tests): pass.
- `pnpm build`, `pnpm check:routes`, `pnpm test:e2e` (30 tests, including 375 and 320 px): pass.
- Screenshots of the front page, the list and an error state at 1200 and 375 px were checked by eye.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-1-5b-company-search.md`
- `docs/ai-log.md`, "Story 1.5b: the request path's first database read, and what search can return"
- `epics.md` Story 1.5b and issue #6: the no-match and unknown-orgnr ACs now say the industry comes from the register.
- `deferred-work.md`: the compact variant mounted by 1.6b; the hand-built `/analyse/` links for 1.6a; the remaining "programmeringstjenester (62.100)" literals in the planning documents.
