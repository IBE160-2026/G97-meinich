// Company search against the loaded demo seed (Story 1.5b), through the
// app's own reader client and query module: accents, prefixes, exact orgnr,
// missing municipality or industry name, LIKE wildcards, the limit, and the
// indexes the queries use. Read-only.
import { afterAll, describe, expect, it } from 'vitest';
import { setting } from './db-env.ts';

const url = setting('READER_DATABASE_URL');
if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
process.env.READER_DATABASE_URL = url;

const { readerSql } = await import('../../src/server/db.ts');
const { NAME_SQL, ORGNR_SQL, coveredIndustries, searchCompanies } = await import('../../src/server/search.ts');

afterAll(async () => {
  await readerSql().end();
  delete (globalThis as { peerlessReaderSql?: unknown }).peerlessReaderSql;
});

const byName = (name: string) => searchCompanies({ kind: 'name', name });
const navn = (rows: { navn: string | null }[]) => rows.map((row) => row.navn);

describe('name search', () => {
  it('finds a company from a short prefix, best match first', async () => {
    const rows = await byName('admm');
    expect(rows[0]).toEqual({
      navn: 'ADMMIT AS',
      orgnr: '813235552',
      naeringskode1: { kode: '62.100', beskrivelse: 'Dataprogrammeringstjenester' },
      kommune: 'VINDAFJORD',
    });
  });

  it('ignores case', async () => {
    expect(navn(await byName('AdMmIt'))).toContain('ADMMIT AS');
  });

  it.each([
    ['algard data', 'ÅLGÅRD DATA AS'],
    ['aerka', 'ÆRKÅ Roy Guttorm Kvalvik'],
    ['sodermann', 'SØDERMANN AS'],
    ['Ålgård', 'ÅLGÅRD DATA AS'],
    ['søder', 'SØDERMANN AS'],
  ])('folds Norwegian letters and accents: %s finds %s', async (query, expected) => {
    expect(navn(await byName(query))).toContain(expected);
  });

  it('tolerates a near miss through word similarity', async () => {
    expect(navn(await byName('sodermanm'))).toContain('SØDERMANN AS');
  });

  it('returns at most 8 rows', async () => {
    expect(await byName('as')).toHaveLength(8);
  });

  it('orders deterministically', async () => {
    expect(await byName('data')).toEqual(await byName('data'));
  });

  it.each(['%', '_', '%%', '%_%', '\\'])('matches %s literally, not as a wildcard', async (query) => {
    const rows = await byName(query);
    expect(rows.length).toBeLessThan(8);
    // pg_trgm extracts no trigram from punctuation, so only a name that
    // contains the characters themselves could match.
    for (const row of rows) expect(row.navn).toContain(query);
  });

  it.each(['dm%t', 'd_mit'])('does not let %s match ADMMIT AS through a wildcard', async (query) => {
    // Unescaped, '%dm%t%' and '%d_mit%' would both match "admmit as".
    expect(navn(await byName(query))).not.toContain('ADMMIT AS');
  });

  it('returns no row for a name nobody has', async () => {
    expect(await byName('zzqxjvw')).toEqual([]);
  });
});

describe('orgnr search', () => {
  it('finds exactly one company by orgnr', async () => {
    expect(await searchCompanies({ kind: 'orgnr', orgnr: '814739082' })).toEqual([
      {
        navn: 'EXEBENUS AS',
        orgnr: '814739082',
        naeringskode1: { kode: '62.100', beskrivelse: 'Dataprogrammeringstjenester' },
        kommune: 'SOLA',
      },
    ]);
  });

  it('returns nothing for a valid orgnr not in the database', async () => {
    expect(await searchCompanies({ kind: 'orgnr', orgnr: '910000004' })).toEqual([]);
  });

  it('returns a company without a municipality, kommune null', async () => {
    // A NUF without a Norwegian business address.
    const [row] = await searchCompanies({ kind: 'orgnr', orgnr: '811873772' });
    expect(row).toEqual({
      navn: 'FUJITSU FINLAND OY',
      orgnr: '811873772',
      naeringskode1: { kode: '62.100', beskrivelse: 'Dataprogrammeringstjenester' },
      kommune: null,
    });
  });

  it('returns a company without an industry name, beskrivelse null', async () => {
    // Stored under 62.100 while the register's primary code has changed
    // since (Story 1.5a): the description is NULL, the code is kept.
    const [row] = await searchCompanies({ kind: 'orgnr', orgnr: '920768695' });
    expect(row?.naeringskode1).toEqual({ kode: '62.100', beskrivelse: null });
    expect(row?.kommune).toBe('BÆRUM');
  });
});

describe('the queries', () => {
  async function plan(sqlText: string, param: string): Promise<string> {
    const sql = readerSql();
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('set local enable_seqscan = off');
      return tx.unsafe<{ 'QUERY PLAN': unknown }[]>(`explain (format json) ${sqlText}`, [param]);
    });
    return JSON.stringify(rows);
  }

  it('use the trigram index for names', async () => {
    for (const query of ['admm', 'algard data', '%']) {
      expect(await plan(NAME_SQL, query), query).toContain('"Index Name":"company_navn_trgm"');
    }
  });

  it('use the primary key for an orgnr', async () => {
    expect(await plan(ORGNR_SQL, '813235552')).toContain('"Index Name":"company_pkey"');
  });

  it('read register.company and nothing else, no financial table', () => {
    for (const text of [NAME_SQL, ORGNR_SQL]) {
      const relations = new Set([...text.matchAll(/\bregister\.(\w+)/g)].map((m) => m[1]));
      expect([...relations].sort()).toEqual(text === NAME_SQL ? ['company', 'immutable_unaccent'] : ['company']);
      expect(text).not.toMatch(/_ore\b|key_figures|filing/);
    }
  });

  it('run as reader', async () => {
    const [row] = await readerSql()<{ who: string }[]>`select current_user as who`;
    expect(row?.who).toBe('reader');
  });
});

describe('coveredIndustries', () => {
  it('reads each covered code with the register name for it', async () => {
    expect(await coveredIndustries()).toEqual([{ code: '62.100', beskrivelse: 'Dataprogrammeringstjenester' }]);
  });
});
