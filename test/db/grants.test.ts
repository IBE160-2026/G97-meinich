// The read boundary (Story 1.2; technical note AD-3, AD-4, AD-16), tested
// against the local Supabase Postgres by querying the catalog and by
// attempting each forbidden action as the role. Never by reading SQL text.
//
// Connects as the CLI's local `postgres` role (SUPABASE_DB_URL). Objects the
// tests create live in a transaction that is always rolled back.
//
// Every later migration that adds a table, view, materialized view or foreign
// table to `register` is covered by the pg_catalog.pg_class loop below
// without editing this file.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { root, setting, supabaseDbUrl } from './db-env.ts';

const PEERLESS_ROLES = ['reader', 'ingest', 'derive', 'loader'] as const;
const API_ROLES = ['anon', 'authenticated', 'service_role'] as const;
const TABLE_WRITES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] as const;
const ALL_TABLE_PRIVILEGES = ['SELECT', ...TABLE_WRITES, 'REFERENCES', 'TRIGGER'] as const;
const INSUFFICIENT_PRIVILEGE = '42501';

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });
type Tx = postgres.TransactionSql;

afterAll(async () => {
  await sql.end();
});

const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`;

class Rollback extends Error {}

// Runs fn in a transaction and always rolls it back.
async function rolledBack(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (error instanceof Rollback) return;
    throw error;
  }
  throw new Error('transaction was not rolled back');
}

// Attempts a statement as role inside a savepoint. Returns the Postgres
// error code, or undefined when the statement succeeded.
async function attemptAs(tx: Tx, role: string, statement: string): Promise<string | undefined> {
  try {
    await tx.savepoint(async (sp) => {
      await sp.unsafe(`set local role ${quoteIdent(role)}`);
      await sp.unsafe(statement);
    });
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'unknown';
  }
  await tx.unsafe('reset role');
  return undefined;
}

let migrationRole: string;

beforeAll(async () => {
  const [row] = await sql<{ owner: string }[]>`
    select nspowner::regrole::text as owner from pg_catalog.pg_namespace where nspname = 'register'
  `;
  if (row === undefined) throw new Error('schema register does not exist; run the migrations');
  migrationRole = row.owner;
});

// Creates objects in register as the migration role, the way a later
// migration would, so they pick up its default privileges.
async function asMigrationRole(tx: Tx, statement: string): Promise<void> {
  await tx.unsafe(`set local role ${quoteIdent(migrationRole)}`);
  await tx.unsafe(statement);
  await tx.unsafe('reset role');
}

describe('supabase/config.toml', () => {
  const config = readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');

  // The body of one [section], up to the next section header.
  function section(name: string): string {
    const lines = config.split(/\r?\n/);
    const start = lines.findIndex((line) => line.trim() === `[${name}]`);
    if (start === -1) throw new Error(`[${name}] not found in config.toml`);
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^\s*\[/.test(line));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n');
  }

  function setting(sectionName: string, key: string): string {
    const match = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm').exec(section(sectionName));
    if (match?.[1] === undefined) throw new Error(`${sectionName}.${key} not set`);
    return match[1];
  }

  it('does not expose register through api.schemas', () => {
    const schemas: unknown = JSON.parse(setting('api', 'schemas'));
    expect(Array.isArray(schemas)).toBe(true);
    expect(schemas).toContain('public');
    expect(schemas).not.toContain('register');
    expect(schemas).not.toContain('app');
  });

  it('disables CLI seeding', () => {
    expect(setting('db.seed', 'enabled')).toBe('false');
  });
});

describe('roles', () => {
  it('has the four Peerless roles, able to log in and nothing more', async () => {
    const rows = await sql<
      { rolname: string; rolcanlogin: boolean; elevated: boolean }[]
    >`
      select rolname, rolcanlogin,
             (rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls) as elevated
      from pg_catalog.pg_roles
      where rolname in ${sql([...PEERLESS_ROLES])}
      order by rolname
    `;
    expect(rows.map((r) => r.rolname)).toEqual([...PEERLESS_ROLES].sort());
    for (const row of rows) {
      expect(row.rolcanlogin, row.rolname).toBe(true);
      expect(row.elevated, row.rolname).toBe(false);
    }
  });

  it('gives reader no membership in another role', async () => {
    const rows = await sql<{ granted: string }[]>`
      select roleid::regrole::text as granted
      from pg_catalog.pg_auth_members
      where member = 'reader'::regrole
    `;
    expect(rows).toEqual([]);
  });

  it('grants reader to postgres with SET only: no INHERIT, no ADMIN from the migration', async () => {
    const rows = await sql<
      { grantor: string; admin_option: boolean; inherit_option: boolean; set_option: boolean }[]
    >`
      select grantor::regrole::text as grantor, admin_option, inherit_option, set_option
      from pg_catalog.pg_auth_members
      where roleid = 'reader'::regrole and member = 'postgres'::regrole
    `;
    expect(rows.filter((r) => r.grantor === migrationRole)).toEqual([
      { grantor: migrationRole, admin_option: false, inherit_option: false, set_option: true },
    ]);
    // No grant of reader to postgres, from any grantor, inherits.
    expect(rows.filter((r) => r.inherit_option)).toEqual([]);
  });

  // Verified in Story 1.2: on Supabase's Postgres the CLI's `postgres` role is
  // not a superuser and holds ADMIN but not SET on roles.sql's roles, so the
  // migration grants reader to postgres WITH SET TRUE, INHERIT FALSE.
  it('lets the test connection SET ROLE to reader and the API roles', async () => {
    await rolledBack(async (tx) => {
      for (const role of ['reader', ...API_ROLES]) {
        await tx.unsafe(`set local role ${quoteIdent(role)}`);
        const [row] = await tx<{ current_user: string }[]>`select current_user`;
        expect(row?.current_user).toBe(role);
        await tx.unsafe('reset role');
      }
    });
  });
});

describe('schemas register and app', () => {
  it('exist, owned by the migration role, and app has no relations', async () => {
    const owners = await sql<{ nspname: string; owner: string }[]>`
      select nspname, nspowner::regrole::text as owner
      from pg_catalog.pg_namespace
      where nspname in ('register', 'app')
      order by nspname
    `;
    expect(owners).toEqual([
      { nspname: 'app', owner: migrationRole },
      { nspname: 'register', owner: migrationRole },
    ]);
    const [app] = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_catalog.pg_class where relnamespace = 'app'::regnamespace
    `;
    expect(app?.n).toBe(0);
  });

  it('gives the Peerless roles USAGE on register', async () => {
    for (const role of PEERLESS_ROLES) {
      const [row] = await sql<{ ok: boolean }[]>`
        select has_schema_privilege(${role}, 'register', 'USAGE') as ok
      `;
      expect(row?.ok, role).toBe(true);
    }
  });

  it('gives anon, authenticated and service_role no privilege on register or app', async () => {
    for (const role of API_ROLES) {
      for (const schema of ['register', 'app']) {
        const [row] = await sql<{ usage: boolean; create: boolean }[]>`
          select has_schema_privilege(${role}, ${schema}, 'USAGE') as usage,
                 has_schema_privilege(${role}, ${schema}, 'CREATE') as create
        `;
        expect(row, `${role} on ${schema}`).toEqual({ usage: false, create: false });
      }
    }
  });

  it('grants nothing on register or app to PUBLIC, and CREATE to no one but the owner', async () => {
    const rows = await sql<{ schema: string; grantee: string; privilege: string }[]>`
      select n.nspname as schema,
             case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
             a.privilege_type as privilege
      from pg_catalog.pg_namespace n, aclexplode(n.nspacl) a
      where n.nspname in ('register', 'app') and a.grantee <> n.nspowner
      order by 1, 2, 3
    `;
    expect(rows).toEqual(
      [...PEERLESS_ROLES].sort().map((grantee) => ({ schema: 'register', grantee, privilege: 'USAGE' })),
    );
  });
});

describe('default privileges of the migration role', () => {
  it('grant reader SELECT, and only SELECT, on tables later created in register', async () => {
    const rows = await sql<{ owner: string; grantee: string; privilege: string }[]>`
      select d.defaclrole::regrole::text as owner,
             case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
             a.privilege_type as privilege
      from pg_catalog.pg_default_acl d, aclexplode(d.defaclacl) a
      where d.defaclnamespace = 'register'::regnamespace and d.defaclobjtype = 'r'
    `;
    expect(rows).toEqual([{ owner: migrationRole, grantee: 'reader', privilege: 'SELECT' }]);
  });

  it('revoke EXECUTE from PUBLIC on functions it creates, globally', async () => {
    const rows = await sql<{ grantee: string; privilege: string }[]>`
      select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
             a.privilege_type as privilege
      from pg_catalog.pg_default_acl d, aclexplode(d.defaclacl) a
      where d.defaclrole = ${migrationRole}::regrole
        and d.defaclnamespace = 0
        and d.defaclobjtype = 'f'
    `;
    // The global entry exists and lists only the owner itself.
    expect(rows).toEqual([{ grantee: migrationRole, privilege: 'EXECUTE' }]);
  });
});

describe('reader cannot create objects', () => {
  it('has no CREATE on any non-system schema', async () => {
    const rows = await sql<{ nspname: string; can_create: boolean }[]>`
      select nspname, has_schema_privilege('reader', oid, 'CREATE') as can_create
      from pg_catalog.pg_namespace
      where nspname not in ('pg_catalog', 'information_schema')
        and nspname not like 'pg\\_toast%'
        and nspname not like 'pg\\_temp\\_%'
      order by nspname
    `;
    const names = rows.map((r) => r.nspname);
    expect(names).toEqual(expect.arrayContaining(['register', 'app', 'public']));
    expect(rows.filter((r) => r.can_create).map((r) => r.nspname)).toEqual([]);
  });

  it('is refused CREATE TABLE in register, app and public', async () => {
    await rolledBack(async (tx) => {
      for (const schema of ['register', 'app', 'public']) {
        expect(
          await attemptAs(tx, 'reader', `create table ${schema}.reader_was_here (id int)`),
          schema,
        ).toBe(INSUFFICIENT_PRIVILEGE);
      }
    });
  });
});

describe('a table added to register later', () => {
  const table = 'register.grants_test_later_table';

  async function withLaterTable(fn: (tx: Tx) => Promise<void>): Promise<void> {
    await rolledBack(async (tx) => {
      await asMigrationRole(tx, `create table ${table} (id int primary key, note text)`);
      await tx.unsafe(`insert into ${table} values (1, 'seeded by the migration role')`);
      await fn(tx);
    });
  }

  it('is readable by reader through the default privileges', async () => {
    await withLaterTable(async (tx) => {
      const [row] = await tx<{ ok: boolean }[]>`select has_table_privilege('reader', ${table}, 'SELECT') as ok`;
      expect(row?.ok).toBe(true);
      expect(await attemptAs(tx, 'reader', `select * from ${table}`)).toBeUndefined();
    });
  });

  it('refuses reader INSERT, UPDATE, DELETE and TRUNCATE', async () => {
    await withLaterTable(async (tx) => {
      const attempts: Record<(typeof TABLE_WRITES)[number], string> = {
        INSERT: `insert into ${table} values (2, 'x')`,
        UPDATE: `update ${table} set note = 'x'`,
        DELETE: `delete from ${table}`,
        TRUNCATE: `truncate ${table}`,
      };
      for (const privilege of TABLE_WRITES) {
        expect(await attemptAs(tx, 'reader', attempts[privilege]), privilege).toBe(INSUFFICIENT_PRIVILEGE);
      }
    });
  });

  it('is closed to anon, authenticated and service_role', async () => {
    await withLaterTable(async (tx) => {
      for (const role of API_ROLES) {
        expect(await attemptAs(tx, role, `select * from ${table}`), role).toBe(INSUFFICIENT_PRIVILEGE);
      }
    });
  });

  // Every table, partitioned table, view, materialized view and foreign
  // table in register, including those later migrations add: reader reads
  // and never writes; the API roles have nothing.
  it('is covered, with every other register relation, by the pg_class loop', async () => {
    await withLaterTable(async (tx) => {
      const tables = await tx<{ name: string }[]>`
        select format('%I.%I', n.nspname, c.relname) as name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'register' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      `;
      expect(tables.map((t) => t.name)).toContain(table);
      for (const { name } of tables) {
        const [reader] = await tx<{ select: boolean; write: boolean }[]>`
          select has_table_privilege('reader', ${name}, 'SELECT') as select,
                 has_table_privilege('reader', ${name}, 'INSERT')
                   or has_table_privilege('reader', ${name}, 'UPDATE')
                   or has_table_privilege('reader', ${name}, 'DELETE')
                   or has_table_privilege('reader', ${name}, 'TRUNCATE') as write
        `;
        expect(reader, `reader on ${name}`).toEqual({ select: true, write: false });
        for (const role of API_ROLES) {
          for (const privilege of ALL_TABLE_PRIVILEGES) {
            const [row] = await tx<{ ok: boolean }[]>`
              select has_table_privilege(${role}, ${name}, ${privilege}) as ok
            `;
            expect(row?.ok, `${role} ${privilege} on ${name}`).toBe(false);
          }
        }
      }
    });
  });
});

// Story 1.3a: the three tables batch step 1 writes. ingest upserts (SELECT,
// INSERT, UPDATE) and never deletes; derive and loader get nothing yet;
// reader keeps SELECT through the default privileges.
describe('the step-1 tables', () => {
  const STEP1_TABLES = ['register.company', 'register.filing', 'register.key_figures'] as const;

  it('exist', async () => {
    const rows = await sql<{ name: string }[]>`
      select format('%I.%I', n.nspname, c.relname) as name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'register' and c.relkind = 'r'
      order by 1
    `;
    expect(rows.map((r) => r.name)).toEqual(expect.arrayContaining([...STEP1_TABLES]));
  });

  it('grant exactly reader SELECT and ingest SELECT, INSERT, UPDATE, and nothing to anyone else', async () => {
    for (const table of STEP1_TABLES) {
      const rows = await sql<{ grantee: string; privilege: string }[]>`
        select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
               a.privilege_type as privilege
        from pg_catalog.pg_class c, aclexplode(c.relacl) a
        where c.oid = ${table}::regclass and a.grantee <> c.relowner
        order by 1, 2
      `;
      expect(rows, table).toEqual([
        { grantee: 'ingest', privilege: 'INSERT' },
        { grantee: 'ingest', privilege: 'SELECT' },
        { grantee: 'ingest', privilege: 'UPDATE' },
        { grantee: 'reader', privilege: 'SELECT' },
      ]);
    }
  });

  it('give ingest no DELETE, TRUNCATE, REFERENCES or TRIGGER, and derive and loader nothing', async () => {
    for (const table of STEP1_TABLES) {
      for (const privilege of ['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        const [row] = await sql<{ ok: boolean }[]>`
          select has_table_privilege('ingest', ${table}, ${privilege}) as ok
        `;
        expect(row?.ok, `ingest ${privilege} on ${table}`).toBe(false);
      }
      for (const role of ['derive', 'loader']) {
        for (const privilege of ALL_TABLE_PRIVILEGES) {
          const [row] = await sql<{ ok: boolean }[]>`
            select has_table_privilege(${role}, ${table}, ${privilege}) as ok
          `;
          expect(row?.ok, `${role} ${privilege} on ${table}`).toBe(false);
        }
      }
    }
  });

  it('refuse reader a write on each of them', async () => {
    await rolledBack(async (tx) => {
      for (const table of STEP1_TABLES) {
        expect(await attemptAs(tx, 'reader', `delete from ${table}`), table).toBe(INSUFFICIENT_PRIVILEGE);
        expect(await attemptAs(tx, 'reader', `select * from ${table} limit 1`), table).toBeUndefined();
      }
    });
  });
});

describe('a function added to register later', () => {
  const fn = 'register.grants_test_later_function';

  it('is executable by neither anon nor reader', async () => {
    await rolledBack(async (tx) => {
      await asMigrationRole(tx, `create function ${fn}() returns int language sql as 'select 1'`);
      for (const role of ['anon', 'reader', 'authenticated', 'service_role']) {
        const [row] = await tx<{ ok: boolean }[]>`
          select has_function_privilege(${role}, ${`${fn}()`}, 'EXECUTE') as ok
        `;
        expect(row?.ok, role).toBe(false);
      }
      expect(await attemptAs(tx, 'anon', `select ${fn}()`)).toBe(INSUFFICIENT_PRIVILEGE);
      expect(await attemptAs(tx, 'reader', `select ${fn}()`)).toBe(INSUFFICIENT_PRIVILEGE);
    });
  });
});

describe('reader login', () => {
  it('connects through READER_DATABASE_URL as reader and cannot write', async () => {
    const url = setting('READER_DATABASE_URL');
    if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
    const reader = postgres(url, { max: 1, onnotice: () => {} });
    try {
      const [row] = await reader<{ current_user: string }[]>`select current_user`;
      expect(row?.current_user).toBe('reader');
      await expect(reader.unsafe('create table register.reader_login_test (id int)')).rejects.toMatchObject({
        code: INSUFFICIENT_PRIVILEGE,
      });
    } finally {
      await reader.end();
    }
  });
});
