// The analysis subject read (Story 1.6b) against the loaded demo seed,
// through the app's own reader client: a covered company (demo A), demo
// company C (uncovered), a covered company with no filing, and an absent
// orgnr. The reader connection is read-only. Read-only itself.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { DEMO_COMPANIES } from '../../src/demo-companies.ts';
import type { CandidateRow, SubjectRow } from '../../src/server/analysis.ts';
import { setting, supabaseDbUrl } from './db-env.ts';

const url = setting('READER_DATABASE_URL');
if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
process.env.READER_DATABASE_URL = url;

const { readerSql } = await import('../../src/server/db.ts');
const { CANDIDATES_SQL, SUBJECT_SQL, loadSubject, lookupSubject, toCandidate, toSubject } = await import(
  '../../src/server/analysis.ts'
);

// The owner, for the one test that writes, in a transaction it always rolls back.
const owner = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });

afterAll(async () => {
  await owner.end();
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
    expect(await lookupSubject(ABSENT)).toBeNull();
  });

  it('picks the newest filing by filing_year among several', async () => {
    const [row] = await readerSql()<{ newest: number }[]>`
      select max(filing_year) as newest from register.filing
       where orgnr = ${DEMO_C}::char(9) and regnskapstype = 'SELSKAP'`;
    expect((await loadSubject(DEMO_C))?.filing?.filingYear).toBe(row?.newest);
  });

  // Story 3.7 (D2): SUBJECT_SQL returns every SELSKAP filing and the engine
  // chooses. Against the order the query itself used before (filing_year,
  // periode_til, periode_fra, brreg_id, each descending, LIMIT 1), for every
  // stored company with more than one SELSKAP filing. Totals only.
  it('chooses the same filing the old SQL chose, for every company with several filings', async () => {
    const expected = await readerSql()<{ orgnr: string; filing_year: number; periode_fra: string; periode_til: string }[]>`
      select distinct on (orgnr) orgnr, filing_year, periode_fra::text as periode_fra, periode_til::text as periode_til
        from register.filing
       where regnskapstype = 'SELSKAP'
         and orgnr in (select orgnr from register.filing where regnskapstype = 'SELSKAP' group by orgnr having count(*) > 1)
       order by orgnr, filing_year desc, periode_til desc, periode_fra desc, brreg_id desc`;
    expect(expected.length).toBeGreaterThan(0);
    const differing: string[] = [];
    for (const row of expected) {
      const filing = (await loadSubject(row.orgnr))?.filing;
      const got = filing === null || filing === undefined ? null : [filing.filingYear, filing.periodeFra, filing.periodeTil];
      if (JSON.stringify(got) !== JSON.stringify([row.filing_year, row.periode_fra, row.periode_til])) differing.push(row.orgnr);
    }
    expect(differing.length).toBe(0);
  });

  // Two filings in one year, in a rolled-back transaction: a second filing
  // ending on the same day but starting later is chosen over the stored one.
  it('chooses between two filings in one year by the later period start', async () => {
    class Rollback extends Error {}
    let chosen: readonly [number, string, string] | null = null;
    let year = 0;
    await expect(
      owner.begin(async (tx) => {
        const [base] = await tx<{ brreg_id: string; filing_year: number; periode_fra: string }[]>`
          select brreg_id::text, filing_year, periode_fra::text from register.filing
           where orgnr = ${DEMO_A.orgnr}::char(9) and regnskapstype = 'SELSKAP'
           order by filing_year desc limit 1`;
        if (base === undefined) throw new Error('demo A has no filing');
        year = base.filing_year;
        expect(base.periode_fra).toBe(`${year}-01-01`);
        await tx`
          insert into register.filing (orgnr, regnskapstype, periode_fra, periode_til, brreg_id, filing_year, valuta,
                                       regnskapsregler, smaa_foretak, avviklingsregnskap, reporting_unit, status, read_at)
          select orgnr, regnskapstype, make_date(${year}, 7, 1), periode_til, 1, filing_year, valuta,
                 regnskapsregler, smaa_foretak, avviklingsregnskap, reporting_unit, status, read_at
            from register.filing where brreg_id = ${base.brreg_id}::bigint`;
        const rows = await tx.unsafe<SubjectRow[]>(SUBJECT_SQL, [DEMO_A.orgnr]);
        expect(rows.filter((row) => row.filing_year === year).length).toBe(2);
        const filing = toSubject(rows).filing;
        chosen = filing === null ? null : [filing.filingYear, filing.periodeFra, filing.periodeTil];
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
    expect(chosen).toEqual([year, `${year}-07-01`, `${year}-12-31`]);
  });

  it('is one parameterised query that reads only the register tables it needs', () => {
    expect(SUBJECT_SQL).toContain('$1::char(9)');
    const tables = [...SUBJECT_SQL.matchAll(/register\.(\w+)/g)].map((m) => m[1]);
    expect(new Set(tables)).toEqual(
      new Set([
        'company',
        'covered_industry',
        'filing',
        'key_figures',
        'fingerprint',
        'classification',
        // Story 2.9: the manifest's list, and the filing year's document and its columns.
        'dataset',
        'document',
        'document_column',
      ]),
    );
  });

  // Story 2.9: the document basis comes from the manifest's list, never from
  // a missing row. Totals only: no company on the list is named.
  it('reads the document basis from the manifest list and the stored document', async () => {
    const listed = await readerSql()<{ orgnr: string }[]>`
      select jsonb_array_elements_text(manifest -> 'document_figure_orgnrs') as orgnr from register.dataset`;
    expect(listed.length).toBeGreaterThan(0);
    const kinds = new Map<string, number>();
    for (const { orgnr } of listed) {
      const kind = (await loadSubject(orgnr))?.filing?.documentBasis.kind ?? 'no filing';
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
    expect(kinds.get('not_in_dataset')).toBeUndefined();
    expect(kinds.get('read') ?? 0).toBeGreaterThan(0);
    // Demo A is not on the list: not in the dataset, whatever rows a local
    // document run left behind.
    expect((await loadSubject(DEMO_A.orgnr))?.filing?.documentBasis).toEqual({ kind: 'not_in_dataset' });
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

// Story 2.9's deferred entry, taken in by Story 3.1b (decision 6): a year's
// document figures come from that year's own document, its current column,
// and a later document's prior column never stands in for it. A synthetic
// company in a transaction that is always rolled back, as the database
// owner: its newest filing is 2024, and the 2025 document holds a
// reconciled prior column for 2024. Read through the request path's own
// queries and row mappers.
describe('the document basis of a year', () => {
  class Rollback extends Error {}
  const ORGNR = '999998143';
  const BRREG_ID = '9999981430';
  const COMMIT = 'b'.repeat(40);

  async function documentFor(tx: postgres.TransactionSql, year: number, columns: readonly ('current' | 'prior')[], revenue: string) {
    await tx`
      insert into register.document (orgnr, filing_year, layout, status, valuta, unit_text, read_at, dataset, reader_commit)
      values (${ORGNR}, ${year}, 'generated', 'reconciled', 'NOK', 'NOK', now(), 'demo', ${COMMIT})`;
    for (const role of columns) {
      await tx`
        insert into register.document_column (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, c5, status, api_check,
                                              api_fail_fields, digits_pass_fields, dataset, sum_driftsinntekter_ore,
                                              sum_driftskostnad_ore, driftsresultat_ore)
        values (${ORGNR}, ${year}, ${role}, ${role === 'current' ? year : year - 1}, 'pass', 'not_evaluable', 'pass',
                'not_evaluable', 'not_evaluable', 'reconciled', 'not_evaluable', '{}', '{}', 'demo', ${revenue}, '0', ${revenue})`;
    }
  }

  async function bases(withOwnDocument: boolean) {
    let read: { subject: unknown; candidate: unknown } = { subject: null, candidate: null };
    try {
      await owner.begin(async (tx) => {
        await tx`
          insert into register.company (orgnr, navn, organisasjonsform, naeringskode1, read_at)
          values (${ORGNR}, 'SYNTETISK ÅRSTEST AS', 'AS', '62.100', now())`;
        await tx`
          insert into register.filing (orgnr, regnskapstype, periode_fra, periode_til, brreg_id, filing_year, valuta,
                                       regnskapsregler, smaa_foretak, avviklingsregnskap, reporting_unit, status, read_at)
          values (${ORGNR}, 'SELSKAP', '2024-01-01', '2024-12-31', ${BRREG_ID}, 2024, 'NOK',
                  'regnskapslovenAlminneligRegler', true, false, 'api_whole_units', 'not_extracted', now())`;
        await tx`insert into register.key_figures (brreg_id, sum_driftsinntekter_ore) values (${BRREG_ID}, '200000000')`;
        // The 2025 document, whose prior column states 2024 (revenue 1 111 111 kr).
        await documentFor(tx, 2025, ['current', 'prior'], '111111100');
        // The year's own document (revenue 2 000 000 kr), when there is one.
        if (withOwnDocument) await documentFor(tx, 2024, ['current'], '200000000');
        const listed = await tx`
          update register.dataset
             set manifest = jsonb_set(manifest, '{document_figure_orgnrs}',
                                      (manifest -> 'document_figure_orgnrs') || to_jsonb(${ORGNR}::text))`;
        expect(listed.count).toBe(1);
        const subjectRows = await tx.unsafe<SubjectRow[]>(SUBJECT_SQL, [ORGNR]);
        const candidateRows = await tx.unsafe<CandidateRow[]>(CANDIDATES_SQL, ['000000000', '62.100', 2024]);
        const candidateRow = candidateRows.find((row) => row.orgnr === ORGNR);
        if (subjectRows.length === 0 || candidateRow === undefined) throw new Error('the synthetic company was not read');
        read = { subject: toSubject(subjectRows).filing?.documentBasis, candidate: toCandidate(candidateRow).documentBasis };
        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
    return read;
  }

  const revenueOf = (basis: unknown): string | null => {
    const read = basis as { kind: string; current?: { sumDriftsinntekter: { kind: string; ore?: bigint } } };
    if (read.kind !== 'read') return null;
    const figure = read.current?.sumDriftsinntekter;
    return figure?.kind === 'value' ? String(figure.ore) : null;
  };

  it('a prior column never stands in for its year', async () => {
    // No 2024 document: the 2025 document's prior column is not used.
    const without = await bases(false);
    expect(without.subject).toEqual({ kind: 'document_missing', filingYear: 2024 });
    expect(without.candidate).toEqual({ kind: 'document_missing', filingYear: 2024 });
    // With its own document, the year reads that document's current column.
    const own = await bases(true);
    expect(revenueOf(own.subject)).toBe('200000000');
    expect(revenueOf(own.candidate)).toBe('200000000');
    // Rolled back: nothing of it is left.
    expect(await owner`select 1 from register.company where orgnr = ${ORGNR}`).toHaveLength(0);
  });
});
