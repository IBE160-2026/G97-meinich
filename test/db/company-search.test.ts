// The data company search stands on (Story 1.5a): the three columns step 1
// stores, their read time, and the name index over the IMMUTABLE unaccent
// wrapper. Checked as `reader`, the role search will run as, by querying
// the catalog and by calling the wrapper. Writes are attempted only inside
// transactions that roll back.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { setting, supabaseDbUrl } from './db-env.ts';

const INSUFFICIENT_PRIVILEGE = '42501';
const WRAPPER = 'register.immutable_unaccent(text)';
const SEARCH_COLUMNS = [
  'forretningsadresse_kommunenummer',
  'forretningsadresse_kommune',
  'naeringskode1_beskrivelse',
  'search_fields_read_at',
] as const;

const readerUrl = setting('READER_DATABASE_URL');
if (readerUrl === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
const reader = postgres(readerUrl, { max: 1, onnotice: () => {} });
const admin = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });

afterAll(async () => {
  await reader.end();
  await admin.end();
});

class Rollback extends Error {}

// The Postgres error code of a statement run as reader in a transaction
// that is always rolled back, or undefined when it succeeded.
async function attemptAsReader(statement: string): Promise<string | undefined> {
  try {
    await reader.begin(async (tx) => {
      await tx.unsafe(statement);
      throw new Rollback();
    });
  } catch (error) {
    if (error instanceof Rollback) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'unknown';
  }
  throw new Error('transaction was not rolled back');
}

describe('register.immutable_unaccent as reader', () => {
  it('folds Norwegian letters and accents', async () => {
    const [row] = await reader<{ who: string; folded: string }[]>`
      select current_user as who, register.immutable_unaccent(lower('Ærlig Søndre')) as folded`;
    expect(row).toEqual({ who: 'reader', folded: 'aerlig sondre' });
  });

  it('returns the same result with an empty search_path', async () => {
    const results = await reader.begin(async (tx) => {
      await tx.unsafe(`set local search_path = ''`);
      return tx<{ folded: string }[]>`select register.immutable_unaccent(lower('Ærlig Søndre')) as folded`;
    });
    expect(results.map((r) => r.folded)).toEqual(['aerlig sondre']);
  });

  it('is IMMUTABLE, STRICT and PARALLEL SAFE SQL', async () => {
    const [row] = await reader<{ volatility: string; strict: boolean; parallel: string; language: string }[]>`
      select p.provolatile as volatility, p.proisstrict as strict, p.proparallel as parallel, l.lanname as language
        from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid = p.prolang
       where p.oid = ${WRAPPER}::regprocedure`;
    expect(row).toEqual({ volatility: 'i', strict: true, parallel: 's', language: 'sql' });
  });

  it('names the function and the dictionary extensions.unaccent by schema', async () => {
    const [row] = await reader<{ body: string }[]>`
      select prosrc as body from pg_catalog.pg_proc where oid = ${WRAPPER}::regprocedure`;
    const body = row?.body ?? '';
    expect(body).toMatch(/extensions\.unaccent\s*\(/);
    expect(body).toContain(`'extensions.unaccent'::regdictionary`);
  });
});

describe('who may execute the wrapper', () => {
  // reader searches; ingest and loader write register.company, and Postgres
  // evaluates the index expression as the writing role.
  it('grants EXECUTE to reader, ingest and loader only, and never to PUBLIC', async () => {
    const rows = await admin<{ grantee: string }[]>`
      select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee
        from pg_catalog.pg_proc p, aclexplode(p.proacl) a
       where p.oid = ${WRAPPER}::regprocedure and a.grantee <> p.proowner and a.privilege_type = 'EXECUTE'
       order by 1`;
    expect(rows.map((r) => r.grantee)).toEqual(['ingest', 'loader', 'reader']);
    for (const role of ['anon', 'authenticated', 'service_role', 'derive']) {
      const [row] = await admin<{ ok: boolean }[]>`select has_function_privilege(${role}, ${WRAPPER}, 'EXECUTE') as ok`;
      expect(row?.ok, role).toBe(false);
    }
  });
});

describe('USAGE on schema extensions', () => {
  // The wrapper's body runs as the caller, so each role granted EXECUTE also
  // needs to reach extensions.unaccent and its dictionary. No one gets CREATE.
  it('is granted to reader, ingest and loader by this migration, not to derive', async () => {
    for (const [role, expected] of [
      ['reader', true],
      ['ingest', true],
      ['loader', true],
      ['derive', false],
    ] as const) {
      const [row] = await admin<{ usage: boolean; create: boolean }[]>`
        select has_schema_privilege(${role}, 'extensions', 'USAGE') as usage,
               has_schema_privilege(${role}, 'extensions', 'CREATE') as create`;
      expect(row, role).toEqual({ usage: expected, create: false });
    }
  });

  // Supabase's own grant on its extensions schema, not this migration's:
  // the API roles already had USAGE before Story 1.5a. They still have no
  // EXECUTE on the wrapper (above) and nothing in register.
  it('is held by anon, authenticated and service_role through Supabase, without CREATE', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const [row] = await admin<{ usage: boolean; create: boolean }[]>`
        select has_schema_privilege(${role}, 'extensions', 'USAGE') as usage,
               has_schema_privilege(${role}, 'extensions', 'CREATE') as create`;
      expect(row, role).toEqual({ usage: true, create: false });
    }
  });
});

describe('the name-search index', () => {
  it('exists on register.company as a GIN trigram index over the wrapper', async () => {
    const rows = await reader<{ indexdef: string }[]>`
      select indexdef from pg_catalog.pg_indexes
       where schemaname = 'register' and tablename = 'company' and indexname = 'company_navn_trgm'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.indexdef).toBe(
      'CREATE INDEX company_navn_trgm ON register.company USING gin (register.immutable_unaccent(lower(navn)) extensions.gin_trgm_ops)',
    );
  });
});

describe('the search columns of register.company', () => {
  it('exist and are nullable', async () => {
    const rows = await reader<{ column_name: string; data_type: string; is_nullable: string }[]>`
      select column_name, data_type, is_nullable from information_schema.columns
       where table_schema = 'register' and table_name = 'company' and column_name in ${reader([...SEARCH_COLUMNS])}
       order by column_name`;
    expect(rows).toEqual(
      [
        { column_name: 'forretningsadresse_kommune', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'forretningsadresse_kommunenummer', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'naeringskode1_beskrivelse', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'search_fields_read_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      ],
    );
  });

  it('cannot be updated by reader', async () => {
    for (const column of SEARCH_COLUMNS) {
      expect(await attemptAsReader(`update register.company set ${column} = null`), column).toBe(
        INSUFFICIENT_PRIVILEGE,
      );
    }
  });
});
