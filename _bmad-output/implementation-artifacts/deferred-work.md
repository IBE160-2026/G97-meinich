# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-roles-grants.md`
  summary: Align AGENTS.md's "every other DDL is a migration" with what the DDL-placement test checks (CREATE/ALTER/DROP in `.sql` files only), or widen the test to GRANT/REVOKE/COMMENT and DDL issued from code.
  evidence: Story 1.2 review: `scripts/set-role-passwords.ts` runs `ALTER ROLE` and the DB tests run `create table` via `unsafe`, while AGENTS.md's wording covers all DDL; a stray `seed.sql` with GRANT would pass the test. The fix edits agent-context files, so it is deferred for the human.
