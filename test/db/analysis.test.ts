// The analysis subject read (Story 1.6b) against the loaded demo seed,
// through the app's own reader client: a covered company (demo A), demo
// company C (uncovered), a covered company with no filing, and an absent
// orgnr. The reader connection is read-only. Read-only itself.
import { afterAll, describe, expect, it } from 'vitest';
import { DEMO_COMPANIES } from '../../src/demo-companies.ts';
import { setting } from './db-env.ts';

const url = setting('READER_DATABASE_URL');
if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
process.env.READER_DATABASE_URL = url;

const { readerSql } = await import('../../src/server/db.ts');
const { SUBJECT_SQL, loadSubject, lookupSubject } = await import('../../src/server/analysis.ts');

afterAll(async () => {
  await readerSql().end();
  delete (globalThis as { peerlessReaderSql?: unknown }).peerlessReaderSql;
});

const [DEMO_A] = DEMO_COMPANIES;
const DEMO_C = '967534579'; // ingest/config.toml [demo_company_c]
const NO_FILING = '813228262'; // OVERRATED GAMES DA: 62.100, no filing in the seed
const ABSENT = '910000004';

describe('loadSubject', () => {
  it('reads a covered company with its newest SELSKAP filing and key figures as strings', async () => {
    const subject = await loadSubject(DEMO_A.orgnr);
    expect(subject).toMatchObject({
      orgnr: DEMO_A.orgnr,
      navn: DEMO_A.navn,
      naeringskode1: '62.100',
      naeringskode1Beskrivelse: 'Dataprogrammeringstjenester',
      kommune: 'VINDAFJORD',
      covered: true,
    });
    expect(subject?.filing?.filingYear).toBe(2025);
    expect(subject?.filing?.valuta).toBe('NOK');
    expect(subject?.filing?.readAt).toBeInstanceOf(Date);
    // int8 stays a string (AD-8): never a JavaScript number.
    expect(typeof subject?.filing?.keyFigures.sum_driftsinntekter_ore).toBe('string');
  });

  it('reads demo company C as uncovered, with its 2025 filing', async () => {
    const subject = await loadSubject(DEMO_C);
    expect(subject).toMatchObject({ orgnr: DEMO_C, navn: 'KANTALL AS', naeringskode1: '69.202', covered: false });
    expect(subject?.filing).toMatchObject({
      filingYear: 2025,
      valuta: 'NOK',
      keyFigures: { sum_driftsinntekter_ore: '5039246000', sum_eiendeler_ore: '2554181600' },
    });
  });

  it('reads a covered company with no filing as filing null', async () => {
    const subject = await loadSubject(NO_FILING);
    expect(subject).toMatchObject({ orgnr: NO_FILING, covered: true, filing: null });
  });

  it('returns null for an orgnr not in the database', async () => {
    expect(await loadSubject(ABSENT)).toBeNull();
    expect(await lookupSubject(ABSENT)).toEqual({ kind: 'absent' });
  });

  it('picks the newest filing by filing_year among several', async () => {
    const [row] = await readerSql()<{ newest: number }[]>`
      select max(filing_year) as newest from register.filing
       where orgnr = ${DEMO_C}::char(9) and regnskapstype = 'SELSKAP'`;
    expect((await loadSubject(DEMO_C))?.filing?.filingYear).toBe(row?.newest);
  });

  it('is one parameterised query that reads only the register tables it needs', () => {
    expect(SUBJECT_SQL).toContain('$1::char(9)');
    const tables = [...SUBJECT_SQL.matchAll(/register\.(\w+)/g)].map((m) => m[1]);
    expect(new Set(tables)).toEqual(new Set(['company', 'covered_industry', 'filing', 'key_figures']));
  });
});

describe('the reader connection', () => {
  it('is read-only', async () => {
    const [row] = await readerSql()<{ transaction_read_only: string }[]>`show transaction_read_only`;
    expect(row?.transaction_read_only).toBe('on');
  });

  it('refuses a write even where reader would have a grant', async () => {
    await expect(readerSql()`create temporary table peerless_write_probe (x int)`).rejects.toThrow(/read-only/);
  });
});
