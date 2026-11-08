// The run-record schema (Story 2.4, D1; technical note AD-2, AD-3), tested
// against the local Supabase Postgres from the catalog. Each batch step's run
// record is written only by its own role: ingest writes run.step1 and derive
// run.step2 (Story 2.6); loader has no write on any relation in `run`; reader
// has no access at all, not even USAGE on the schema, since nothing on the
// request path reads a run record yet.
//
// Loops over every relation in schema `run` (pg_class).
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
/** Each table's one writer; the other batch role holds nothing on it. */
const WRITER: Record<string, 'ingest' | 'derive'> = { 'run.step1': 'ingest', 'run.step2': 'derive' };
const writerOf = (name: string): 'ingest' | 'derive' => {
  const writer = WRITER[name];
  if (writer === undefined) throw new Error(`no writer declared for ${name}`);
  return writer;
};

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

  it('holds run.step2 (Story 2.6)', async () => {
    expect(await relations()).toContain('run.step2');
  });

  it('gives USAGE to ingest and derive only among the Peerless and API roles', async () => {
    for (const role of ['reader', 'ingest', 'derive', 'loader', ...API_ROLES]) {
      const [row] = await sql<{ usage: boolean; create: boolean }[]>`
        select has_schema_privilege(${role}, 'run', 'USAGE') as usage,
               has_schema_privilege(${role}, 'run', 'CREATE') as create
      `;
      expect(row, role).toEqual({ usage: role === 'ingest' || role === 'derive', create: false });
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
  it('lets its one writer SELECT, INSERT and UPDATE, and nothing more', async () => {
    for (const name of await relations()) {
      const writer = writerOf(name);
      for (const privilege of ALL_TABLE_PRIVILEGES) {
        expect(await has(writer, name, privilege), `${writer} ${privilege} on ${name}`).toBe(
          ['SELECT', 'INSERT', 'UPDATE'].includes(privilege),
        );
      }
    }
  });

  it('gives the other batch role and loader no write', async () => {
    for (const name of await relations()) {
      const other = writerOf(name) === 'ingest' ? 'derive' : 'ingest';
      for (const role of [other, 'loader']) {
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

  it('grants exactly its writer SELECT, INSERT and UPDATE in the ACL, besides the owner', async () => {
    for (const name of await relations()) {
      const rows = await sql<{ grantee: string; privilege: string }[]>`
        select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
               a.privilege_type as privilege
        from pg_catalog.pg_class c, aclexplode(c.relacl) a
        where c.oid = ${name}::regclass and a.grantee <> c.relowner
        order by 1, 2
      `;
      const writer = writerOf(name);
      expect(rows, name).toEqual([
        { grantee: writer, privilege: 'INSERT' },
        { grantee: writer, privilege: 'SELECT' },
        { grantee: writer, privilege: 'UPDATE' },
      ]);
    }
  });
});
