// The run-record schema (Story 2.4, D1; technical note AD-2, AD-3), tested
// against the local Supabase Postgres from the catalog. Each batch step's run
// record is written only by its own role: ingest writes run.step1; derive
// and loader have no write on any relation in `run`; reader has no access
// at all, not even USAGE on the schema, since nothing on the request path
// reads a run record yet.
//
// Loops over every relation in schema `run` (pg_class), so run.step2
// (Story 2.6) is covered without editing this file; that story changes the
// expected writer for its own table.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { supabaseDbUrl } from './db-env.ts';

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });

afterAll(async () => {
  await sql.end();
});

const WRITES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] as const;
const ALL_TABLE_PRIVILEGES = ['SELECT', ...WRITES, 'REFERENCES', 'TRIGGER'] as const;
const API_ROLES = ['anon', 'authenticated', 'service_role'] as const;

async function has(role: string, relation: string, privilege: string): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`select has_table_privilege(${role}, ${relation}, ${privilege}) as ok`;
  return row?.ok ?? false;
}

async function relations(): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select format('%I.%I', n.nspname, c.relname) as name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'run' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    order by 1
  `;
  return rows.map((r) => r.name);
}

describe('schema run', () => {
  it('exists and holds run.step1', async () => {
    expect(await relations()).toContain('run.step1');
  });

  it('gives USAGE to ingest only among the Peerless and API roles', async () => {
    for (const role of ['reader', 'ingest', 'derive', 'loader', ...API_ROLES]) {
      const [row] = await sql<{ usage: boolean; create: boolean }[]>`
        select has_schema_privilege(${role}, 'run', 'USAGE') as usage,
               has_schema_privilege(${role}, 'run', 'CREATE') as create
      `;
      expect(row, role).toEqual({ usage: role === 'ingest', create: false });
    }
  });

  it('has no default privileges that would open a later table to reader', async () => {
    const rows = await sql<{ grantee: string }[]>`
      select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee
      from pg_catalog.pg_default_acl d, aclexplode(d.defaclacl) a
      where d.defaclnamespace = 'run'::regnamespace
    `;
    expect(rows.filter((r) => r.grantee === 'reader' || r.grantee === 'PUBLIC')).toEqual([]);
  });
});

describe('every relation in run', () => {
  it('lets ingest SELECT, INSERT and UPDATE, and nothing more', async () => {
    for (const name of await relations()) {
      for (const privilege of ALL_TABLE_PRIVILEGES) {
        expect(await has('ingest', name, privilege), `ingest ${privilege} on ${name}`).toBe(
          ['SELECT', 'INSERT', 'UPDATE'].includes(privilege),
        );
      }
    }
  });

  it('gives derive and loader no write', async () => {
    for (const name of await relations()) {
      for (const role of ['derive', 'loader']) {
        for (const privilege of WRITES) {
          expect(await has(role, name, privilege), `${role} ${privilege} on ${name}`).toBe(false);
        }
      }
    }
  });

  it('gives reader and the API roles no privilege at all', async () => {
    for (const name of await relations()) {
      for (const role of ['reader', ...API_ROLES]) {
        for (const privilege of ALL_TABLE_PRIVILEGES) {
          expect(await has(role, name, privilege), `${role} ${privilege} on ${name}`).toBe(false);
        }
      }
    }
  });

  it('grants exactly ingest SELECT, INSERT and UPDATE in the ACL, besides the owner', async () => {
    for (const name of await relations()) {
      const rows = await sql<{ grantee: string; privilege: string }[]>`
        select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
               a.privilege_type as privilege
        from pg_catalog.pg_class c, aclexplode(c.relacl) a
        where c.oid = ${name}::regclass and a.grantee <> c.relowner
        order by 1, 2
      `;
      expect(rows, name).toEqual([
        { grantee: 'ingest', privilege: 'INSERT' },
        { grantee: 'ingest', privilege: 'SELECT' },
        { grantee: 'ingest', privilege: 'UPDATE' },
      ]);
    }
  });
});
