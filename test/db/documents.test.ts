// The document tables (Story 2.1b; technical note AD-14, AD-15), tested
// against the migrated local database by attempting writes in a transaction
// that is always rolled back. Connects as the CLI's local `postgres` role.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { supabaseDbUrl } from './db-env.ts';

const CHECK_VIOLATION = '23514';
const ORGNR = '979607008';

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });
type Tx = postgres.TransactionSql;

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

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

// Runs a statement in a savepoint. Returns the Postgres error code, or
// undefined when it succeeded.
async function attempt(tx: Tx, statement: string): Promise<string | undefined> {
  try {
    await tx.savepoint((sp) => sp.unsafe(statement));
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'unknown';
  }
  return undefined;
}

const quote = (value: string | null): string => (value === null ? 'null' : `'${value}'`);

function insertDocument(year: number, status: string, layout: string | null, refusal: string | null, valuta: string | null): string {
  return `insert into register.document (orgnr, filing_year, layout, status, refusal, valuta, unit_text, read_at, dataset)
          values ('${ORGNR}', ${year}, ${quote(layout)}, '${status}', ${quote(refusal)}, ${quote(valuta)}, ${quote(valuta)}, now(), 'full')`;
}

async function withCompany(fn: (tx: Tx) => Promise<void>): Promise<void> {
  await rolledBack(async (tx) => {
    await tx`insert into register.company (orgnr, navn, read_at) values (${ORGNR}, 'TEST AS', now()) on conflict (orgnr) do nothing`;
    await fn(tx);
  });
}

describe('register.document', () => {
  it('status accepts exactly the five values', async () => {
    await withCompany(async (tx) => {
      const accepted: [string, string | null, string | null, string | null][] = [
        ['extracted', 'generated', null, 'NOK'],
        ['reconciled', 'generated', null, 'NOK'],
        ['failed_reconciliation', 'generated', null, 'NOK'],
        ['not_extracted', 'generated', 'reporting_unit', null],
        ['paper', 'paper', null, null],
      ];
      let year = 2001;
      for (const [status, layout, refusal, valuta] of accepted) {
        expect(await attempt(tx, insertDocument(year, status, layout, refusal, valuta)), status).toBeUndefined();
        year += 1;
      }
      for (const status of ['usable', 'Extracted', '', 'failed']) {
        expect(await attempt(tx, insertDocument(year, status, 'generated', null, 'NOK')), status).toBe(CHECK_VIOLATION);
        year += 1;
      }
    });
  });

  it('keeps status, layout and refusal consistent, even where a column is NULL', async () => {
    await withCompany(async (tx) => {
      const cases: [string, string | null, string | null, string | null, boolean][] = [
        ['not_extracted', 'unknown', null, null, true],
        ['not_extracted', null, 'ocr_error', null, true],
        ['not_extracted', 'generated', 'year_mismatch', 'NOK', true],
        ['not_extracted', 'generated', 'year_header', null, true],
        // A generated document with no refusal was read: not not_extracted.
        ['not_extracted', 'generated', null, null, false],
        ['not_extracted', 'unknown', 'ocr_error', null, false],
        ['not_extracted', null, null, null, false],
        ['paper', null, null, null, false],
        ['paper', 'generated', null, null, false],
        ['extracted', null, null, 'NOK', false],
        ['extracted', 'generated', 'reporting_unit', 'NOK', false],
        ['extracted', 'generated', null, null, false],
        ['not_extracted', 'generated', 'guessed', null, false],
      ];
      let year = 2001;
      for (const [status, layout, refusal, valuta, ok] of cases) {
        const label = `${status} ${String(layout)} ${String(refusal)} ${String(valuta)}`;
        expect(await attempt(tx, insertDocument(year, status, layout, refusal, valuta)), label).toBe(
          ok ? undefined : CHECK_VIOLATION,
        );
        year += 1;
      }
    });
  });

  it('refuses a dataset tag other than demo or full', async () => {
    await withCompany(async (tx) => {
      const statement = insertDocument(2025, 'paper', 'paper', null, null).replace("'full')", "'test')");
      expect(await attempt(tx, statement)).toBe(CHECK_VIOLATION);
    });
  });
});

describe('register.document_column', () => {
  const insertColumn = (role: string, statedYear: number, digits = '{}'): string =>
    `insert into register.document_column (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, digits_pass_fields, dataset)
     values ('${ORGNR}', 2025, '${role}', ${statedYear}, 'pass', 'pass', 'pass', 'pass', '${digits}', 'full')`;

  it('ties each column to the year it states: the filing year, or the year before for prior', async () => {
    await withCompany(async (tx) => {
      await tx.unsafe(insertDocument(2025, 'extracted', 'generated', null, 'NOK'));
      expect(await attempt(tx, insertColumn('current', 2024))).toBe(CHECK_VIOLATION);
      expect(await attempt(tx, insertColumn('prior', 2025))).toBe(CHECK_VIOLATION);
      expect(await attempt(tx, insertColumn('other', 2025))).toBe(CHECK_VIOLATION);
      expect(await attempt(tx, insertColumn('current', 2025))).toBeUndefined();
      expect(await attempt(tx, insertColumn('prior', 2024))).toBeUndefined();
    });
  });

  it('accepts only field names in digits_pass_fields, and needs its document', async () => {
    await withCompany(async (tx) => {
      expect(await attempt(tx, insertColumn('current', 2025))).toBe('23503');
      await tx.unsafe(insertDocument(2025, 'extracted', 'generated', null, 'NOK'));
      expect(await attempt(tx, insertColumn('current', 2025, '{sum_driftsinntekter,guess}'))).toBe(CHECK_VIOLATION);
      expect(await attempt(tx, insertColumn('current', 2025, '{sum_driftsinntekter}'))).toBeUndefined();
    });
  });

  it('goes with its document, and the document with its company (ON DELETE CASCADE, for Story 2.4)', async () => {
    const rules = await sql<{ table: string; references: string; on_delete: string }[]>`
      select conrelid::regclass::text as table, confrelid::regclass::text as references, confdeltype as on_delete
        from pg_catalog.pg_constraint
       where contype = 'f' and conrelid in ('register.document'::regclass, 'register.document_column'::regclass)
       order by 1, 2
    `;
    expect([...rules]).toEqual([
      { table: 'register.document', references: 'register.company', on_delete: 'c' },
      { table: 'register.document', references: 'register.filing', on_delete: 'a' },
      { table: 'register.document_column', references: 'register.document', on_delete: 'c' },
    ]);
    await withCompany(async (tx) => {
      await tx.unsafe(insertDocument(2025, 'extracted', 'generated', null, 'NOK'));
      await tx.unsafe(insertColumn('current', 2025));
      await tx`delete from register.document where orgnr = ${ORGNR} and filing_year = 2025`;
      const [row] = await tx<{ n: number }[]>`select count(*)::int as n from register.document_column where orgnr = ${ORGNR}`;
      expect(row?.n).toBe(0);
    });
  });

  // Story 2.2: the reconciliation of each column. Columns are inserted with
  // c1-c5 given (c5 may be NULL), then status, api_check and api_fail_fields.
  type Checks = [string, string, string, string, string | null];
  const insertReconciled = (
    role: string,
    checks: Checks,
    status: string | null,
    apiCheck: string | null,
    failFields: string | null,
  ): string =>
    `insert into register.document_column
       (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, c5, digits_pass_fields, dataset, status, api_check, api_fail_fields)
     values ('${ORGNR}', 2025, '${role}', ${role === 'current' ? 2025 : 2024}, '${checks[0]}', '${checks[1]}', '${checks[2]}',
             '${checks[3]}', ${quote(checks[4])}, '{}', 'full', ${quote(status)}, ${quote(apiCheck)}, ${quote(failFields)})`;
  const PASS: Checks = ['pass', 'pass', 'pass', 'pass', 'pass'];

  it('accepts exactly the two column statuses, the three api_check and c5 values, or all four NULL', async () => {
    await withCompany(async (tx) => {
      await tx.unsafe(insertDocument(2025, 'reconciled', 'generated', null, 'NOK'));
      const cases: [string | null, string | null, string | null, string | null, boolean][] = [
        ['pass', 'reconciled', 'pass', '{}', true],
        ['pass', 'reconciled', 'not_evaluable', '{}', true],
        ['pass', 'failed_reconciliation', 'fail', '{sum_gjeld}', true],
        // Not yet reconciled (a restored extracted row): all four NULL.
        [null, null, null, null, true],
        ['pass', 'extracted', 'pass', '{}', false],
        ['pass', 'reconciled', 'passed', '{}', false],
        ['passed', 'reconciled', 'pass', '{}', false],
        // Written together, or not at all.
        ['pass', 'reconciled', null, '{}', false],
        ['pass', null, 'pass', '{}', false],
        ['pass', 'reconciled', 'pass', null, false],
        [null, 'reconciled', 'pass', '{}', false],
        ['pass', null, null, null, false],
        // api_fail_fields is non-empty exactly when api_check is fail, and
        // names only the eleven shared figures.
        ['pass', 'failed_reconciliation', 'fail', '{}', false],
        ['pass', 'reconciled', 'pass', '{sum_gjeld}', false],
        ['pass', 'failed_reconciliation', 'fail', '{salgsinntekt}', false],
      ];
      for (const [c5, status, api, fields, ok] of cases) {
        const label = `${String(c5)} ${String(status)} ${String(api)} ${String(fields)}`;
        const statement = insertReconciled('current', ['pass', 'pass', 'pass', 'pass', c5], status, api, fields);
        const code = await attempt(tx, statement);
        expect(code, label).toBe(ok ? undefined : CHECK_VIOLATION);
        if (code === undefined) await tx`delete from register.document_column where orgnr = ${ORGNR}`;
      }
    });
  });

  it('holds the status rule: reconciled exactly when no check fails, c1 passed, c3 or c5 passed, and (current only) the API did not fail', async () => {
    await withCompany(async (tx) => {
      await tx.unsafe(insertDocument(2025, 'reconciled', 'generated', null, 'NOK'));
      const NE = 'not_evaluable';
      const cases: [string, Checks, string, string, string, boolean][] = [
        ['current', PASS, 'reconciled', 'pass', '{}', true],
        ['current', ['pass', NE, 'pass', NE, 'pass'], 'reconciled', 'pass', '{}', true],
        ['current', ['fail', 'pass', 'pass', 'pass', 'pass'], 'reconciled', 'pass', '{}', false],
        ['current', ['fail', 'pass', 'pass', 'pass', 'pass'], 'failed_reconciliation', 'pass', '{}', true],
        // c1 not evaluable: never reconciled.
        ['current', [NE, 'pass', 'pass', 'pass', 'pass'], 'reconciled', 'pass', '{}', false],
        ['current', [NE, 'pass', 'pass', 'pass', 'pass'], 'failed_reconciliation', 'pass', '{}', true],
        // The balance by c3 or c5 (the total unread: c3 and c4 not evaluable).
        ['current', ['pass', 'pass', NE, NE, 'pass'], 'reconciled', 'pass', '{}', true],
        ['current', ['pass', 'pass', 'pass', 'pass', NE], 'reconciled', 'pass', '{}', true],
        ['current', ['pass', 'pass', NE, NE, NE], 'reconciled', 'pass', '{}', false],
        ['current', ['pass', 'pass', NE, NE, NE], 'failed_reconciliation', 'pass', '{}', true],
        // A failing c5 fails the column even when c3 passes.
        ['current', ['pass', 'pass', 'pass', 'pass', 'fail'], 'reconciled', 'pass', '{}', false],
        ['current', ['pass', 'pass', 'pass', 'pass', 'fail'], 'failed_reconciliation', 'pass', '{}', true],
        // The current column's API comparison decides; failed_reconciliation needs a reason.
        ['current', PASS, 'reconciled', 'fail', '{sum_gjeld}', false],
        ['current', PASS, 'failed_reconciliation', 'fail', '{sum_gjeld}', true],
        ['current', PASS, 'failed_reconciliation', 'pass', '{}', false],
        // A prior column's API comparison is information only.
        ['prior', PASS, 'reconciled', 'fail', '{sum_eiendeler,sum_gjeld}', true],
        ['prior', PASS, 'failed_reconciliation', 'fail', '{sum_gjeld}', false],
      ];
      for (const [role, checks, status, api, fields, ok] of cases) {
        const label = `${role} ${checks.join(',')} ${status} ${api}`;
        const code = await attempt(tx, insertReconciled(role, checks, status, api, fields));
        expect(code, label).toBe(ok ? undefined : CHECK_VIOLATION);
        if (code === undefined) await tx`delete from register.document_column where orgnr = ${ORGNR}`;
      }
    });
  });

  it('stores every figure as bigint øre with a unit comment', async () => {
    const rows = await sql<{ name: string; kind: string; comment: string | null }[]>`
      select a.attname as name, format_type(a.atttypid, a.atttypmod) as kind,
             col_description(a.attrelid, a.attnum) as comment
        from pg_catalog.pg_attribute a
       where a.attrelid = 'register.document_column'::regclass and a.attnum > 0 and not a.attisdropped
         and a.attname like '%\\_ore'
    `;
    expect(rows).toHaveLength(23);
    for (const row of rows) {
      expect(row.kind, row.name).toBe('bigint');
      expect(row.comment?.startsWith('øre (hundredths of document.valuta'), row.name).toBe(true);
    }
  });
});
