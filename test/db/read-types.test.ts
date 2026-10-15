// What postgres.js hands the engine (Story 1.4; AD-8). As `reader`, with the
// client's default options, `int8` and `numeric` arrive as strings and NULL
// as null, so the engine's parsers see every digit. Read-only: no writes.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { apiInputsFromRow, parseDecimal, parseOre } from '../../src/engine/inputs.ts';
import { setting } from './db-env.ts';

const readerUrl = setting('READER_DATABASE_URL');
if (readerUrl === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
const reader = postgres(readerUrl, { max: 1, onnotice: () => {} });

afterAll(async () => {
  await reader.end();
});

describe('read types as reader', () => {
  it('returns bigint and numeric as strings and NULL as null, parsed exactly', async () => {
    const [row] = await reader<{ who: string; amount: unknown; ratio: unknown; empty: unknown }[]>`
      select current_user as who,
             9007199254740993::bigint as amount,
             12.345::numeric as ratio,
             null::bigint as empty`;
    if (row === undefined) throw new Error('no row');
    expect(row.who).toBe('reader');
    expect(typeof row.amount).toBe('string');
    expect(typeof row.ratio).toBe('string');
    expect(row.empty).toBeNull();
    expect(parseOre(row.amount as string)).toBe(9007199254740993n);
    expect(parseDecimal(row.ratio as string)?.toString()).toBe('12.345');
    expect(parseOre(row.empty as null)).toBeNull();
  });

  it('has every column apiInputsFromRow reads in register.key_figures, as bigint', async () => {
    const columns = [
      'sum_driftsinntekter_ore',
      'driftsresultat_ore',
      'sum_driftskostnad_ore',
      'sum_eiendeler_ore',
      'sum_egenkapital_gjeld_ore',
      'sum_egenkapital_ore',
      'sum_gjeld_ore',
    ] as const satisfies readonly (keyof Parameters<typeof apiInputsFromRow>[0])[];
    const rows = await reader<{ column_name: string; data_type: string }[]>`
      select column_name, data_type
        from information_schema.columns
       where table_schema = 'register' and table_name = 'key_figures'`;
    const types = new Map(rows.map((r) => [r.column_name, r.data_type]));
    for (const column of columns) expect([column, types.get(column)]).toEqual([column, 'bigint']);
  });
});

// The same checks through the app's own client (src/server/db.ts), so an
// option there that parses int8 or numeric to a number fails here (deferred
// from Story 1.4 to Story 1.5b).
describe('read types through src/server/db.ts', () => {
  it('returns bigint and numeric as strings, connected as reader', async () => {
    process.env.READER_DATABASE_URL = readerUrl;
    const { readerSql } = await import('../../src/server/db.ts');
    const app = readerSql();
    try {
      const [row] = await app<{ who: string; amount: unknown; ratio: unknown; empty: unknown }[]>`
        select current_user as who,
               9007199254740993::bigint as amount,
               12.345::numeric as ratio,
               null::numeric as empty`;
      expect(row?.who).toBe('reader');
      expect(row?.amount).toBe('9007199254740993');
      expect(row?.ratio).toBe('12.345');
      expect(row?.empty).toBeNull();
      expect(readerSql()).toBe(app);
    } finally {
      await app.end();
      delete (globalThis as { peerlessReaderSql?: unknown }).peerlessReaderSql;
    }
  });
});
