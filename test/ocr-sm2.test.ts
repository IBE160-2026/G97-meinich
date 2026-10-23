// The SM-2 measurement (Story 2.3; NFR25): classifying each compared field,
// the headline count, the scope of the comparison, reading the
// transcriptions by header name, and the consistency denominators. Pure
// functions on small fixtures; the committed report is checked against the
// committed inputs at the end.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASELINE,
  BASELINE_FAILING,
  type CheckedColumn,
  SM2_FIELDS,
  type Sm2Field,
  type StoredColumn,
  type TranscribedColumn,
  classify,
  compareReference,
  consistencyDenominators,
  countClasses,
  groupOf,
  mismatches,
  misreadsReachingEngine,
  parseStoredColumns,
  parseTranscriptions,
} from '../scripts/ocr-sm2-compare.ts';
import { REPORT_FILE, readInputs, renderReport } from '../scripts/ocr-sm2.ts';
import { parseCsv } from '../scripts/seed-format.ts';

const root = path.resolve(import.meta.dirname, '..');

const figures = <T>(values: Partial<Record<Sm2Field, T | null>>): Map<Sm2Field, T | null> =>
  new Map(SM2_FIELDS.map((field) => [field, values[field] ?? null]));

const truth = (orgnr: string, filingYear: number, role: 'current' | 'prior', kr: Partial<Record<Sm2Field, bigint>>): TranscribedColumn => ({
  orgnr,
  filingYear,
  role,
  statedYear: role === 'current' ? filingYear : filingYear - 1,
  figuresKr: figures(kr),
});

const NO_CHECKS = { c1: 'pass', c2: 'pass', c3: 'pass', c4: 'pass', c5: 'pass' } as const;
const read = (
  orgnr: string,
  filingYear: number,
  role: 'current' | 'prior',
  ore: Partial<Record<Sm2Field, bigint>>,
  status = 'reconciled',
): StoredColumn => ({
  orgnr,
  filingYear,
  role,
  statedYear: role === 'current' ? filingYear : filingYear - 1,
  status,
  checks: NO_CHECKS,
  figuresOre: figures(ore),
});

describe('classifying a compared field', () => {
  it('classifies a correct figure', () => {
    expect(classify(26395800n, 263958n)).toBe('correct');
    expect(classify(-136400n, -1364n)).toBe('correct');
  });

  it('classifies a misread figure', () => {
    expect(classify(72263231000n, 72632310n)).toBe('misread');
    const { results } = compareReference(
      [{ orgnr: '921716257', year: 2021 }],
      [truth('921716257', 2021, 'current', { sum_driftsinntekter: 72632310n }), truth('921716257', 2021, 'prior', {})],
      [read('921716257', 2021, 'current', { sum_driftsinntekter: 72263231000n }), read('921716257', 2021, 'prior', {})],
    );
    // Listed among the mismatches with orgnr, year, column, field, expected and read.
    expect(mismatches(results)).toEqual([
      expect.objectContaining({
        orgnr: '921716257',
        filingYear: 2021,
        role: 'current',
        field: 'sum_driftsinntekter',
        expectedKr: 72632310n,
        readOre: 72263231000n,
        class: 'misread',
      }),
    ]);
  });

  it('NULL is not zero', () => {
    expect(classify(null, 0n)).toBe('not read');
    expect(classify(0n, 0n)).toBe('correct');
    expect(classify(0n, null)).toBe('phantom');
  });

  it('classifies a phantom figure', () => {
    expect(classify(500n, null)).toBe('phantom');
    const { results } = compareReference(
      [{ orgnr: '921716257', year: 2021 }],
      [truth('921716257', 2021, 'current', {}), truth('921716257', 2021, 'prior', {})],
      [read('921716257', 2021, 'current', { varer: 500n }), read('921716257', 2021, 'prior', {})],
    );
    expect(mismatches(results)).toEqual([expect.objectContaining({ field: 'varer', class: 'phantom', expectedKr: null })]);
  });

  it('ignores a field neither holds', () => {
    expect(classify(null, null)).toBeNull();
    const { results } = compareReference(
      [{ orgnr: '921716257', year: 2021 }],
      [truth('921716257', 2021, 'current', { varer: 1n }), truth('921716257', 2021, 'prior', {})],
      [read('921716257', 2021, 'current', { varer: 100n }), read('921716257', 2021, 'prior', {})],
    );
    expect(results).toHaveLength(1);
    expect(countClasses(results)).toEqual({ correct: 1, 'not read': 0, misread: 0, phantom: 0 });
  });
});

describe('the headline and the scope', () => {
  it('counts misreads that reach the engine', () => {
    const drawn = [
      { orgnr: '921716257', year: 2021 },
      { orgnr: '919470992', year: 2024 },
    ];
    const transcribed = [
      truth('921716257', 2021, 'current', { driftsresultat: 10n }),
      truth('921716257', 2021, 'prior', { driftsresultat: 10n }),
      truth('919470992', 2024, 'current', { driftsresultat: 10n, aarsresultat: 7n }),
      truth('919470992', 2024, 'prior', { driftsresultat: 10n }),
    ];
    const stored = [
      read('921716257', 2021, 'current', { driftsresultat: 9900n }), // misread, reconciled: counts
      read('921716257', 2021, 'prior', { driftsresultat: 9900n }, 'failed_reconciliation'), // misread, not used
      read('919470992', 2024, 'current', { driftsresultat: 9900n, aarsresultat: 700n }), // misread, reconciled: counts
      read('919470992', 2024, 'prior', {}), // not read: never in the headline
    ];
    const { results } = compareReference(drawn, transcribed, stored);
    const headline = misreadsReachingEngine(results);
    expect(headline.map((r) => `${r.orgnr}/${r.role}/${r.field}`)).toEqual([
      '921716257/current/driftsresultat',
      '919470992/current/driftsresultat',
    ]);
    expect(headline.filter((r) => r.group === 'older')).toHaveLength(1);
    expect(headline.filter((r) => r.group === 'recent')).toHaveLength(1);
    expect(groupOf(2022)).toBe('older');
    expect(groupOf(2023)).toBe('recent');
  });

  it('compares only drawn filings', () => {
    const { results, notes } = compareReference(
      [{ orgnr: '921716257', year: 2021 }],
      [
        truth('921716257', 2021, 'current', { varer: 1n }),
        truth('921716257', 2021, 'prior', {}),
        // A transcription and stored rows for a year that was not drawn.
        truth('921716257', 2022, 'current', { varer: 5n }),
      ],
      [
        read('921716257', 2021, 'current', { varer: 100n }),
        read('921716257', 2021, 'prior', {}),
        read('921716257', 2022, 'current', { varer: 999n }),
        read('921716257', 2023, 'current', { varer: 999n }),
      ],
    );
    expect(results.map((r) => `${r.orgnr}/${r.filingYear}`)).toEqual(['921716257/2021']);
    expect(notes).toEqual([]);
  });

  it('compares a drawn column step 1 did not store as all NULL, and notes it', () => {
    const { results, notes } = compareReference(
      [{ orgnr: '921716257', year: 2021 }],
      [truth('921716257', 2021, 'current', { varer: 1n }), truth('921716257', 2021, 'prior', {})],
      [],
    );
    expect(results).toEqual([expect.objectContaining({ class: 'not read', columnStatus: null })]);
    expect(notes).toHaveLength(2);
  });

  it('refuses a drawn filing with no transcription', () => {
    expect(() => compareReference([{ orgnr: '921716257', year: 2021 }], [], [])).toThrow(/no current column/);
  });
});

describe('reading the transcriptions', () => {
  const header = ['orgnr', 'filing_year', 'column', 'stated_year', ...SM2_FIELDS];
  const row = (values: Record<string, string>) => header.map((name) => values[name] ?? '');

  it('reads by header name', () => {
    const values = { orgnr: '921716257', filing_year: '2021', column: 'current', stated_year: '2021', salgsinntekt: '263958', netto_finans: '-1364' };
    const plain = [header.join(';'), row(values).join(';')].join('\n');
    // Shuffled, with extra columns (the header's misspelt one included),
    // CRLF line ends, a BOM and a quoted note.
    const extra = ['finansielle_anleggsmider', 'notes', 'transcribed_by'];
    const shuffled = [...header].reverse();
    const withExtra = [...extra.slice(0, 1), ...shuffled, ...extra.slice(1)];
    const extraValues: Record<string, string> = { ...values, finansielle_anleggsmider: '777', notes: '"a; b"', transcribed_by: 'X' };
    const other = `﻿${[withExtra.join(';'), withExtra.map((name) => extraValues[name] ?? '').join(';')].join('\r\n')}\r\n`;
    const a = parseTranscriptions(plain);
    const b = parseTranscriptions(other);
    expect(b).toEqual(a);
    expect(a[0]?.figuresKr.get('salgsinntekt')).toBe(263958n);
    expect(a[0]?.figuresKr.get('netto_finans')).toBe(-1364n);
    expect(a[0]?.figuresKr.get('varer')).toBeNull();
  });

  it('refuses a missing field column and a figure that is not whole kroner', () => {
    const noField = header.filter((name) => name !== 'varer');
    expect(() => parseTranscriptions(`${noField.join(';')}\n`)).toThrow(/no column varer/);
    const bad = row({ orgnr: '921716257', filing_year: '2021', column: 'current', stated_year: '2021', varer: '1 000' });
    expect(() => parseTranscriptions(`${header.join(';')}\n${bad.join(';')}\n`)).toThrow(/varer must be blank or whole kroner/);
  });

  it('reads the committed transcriptions: 20 filings, two columns each', () => {
    const columns = parseTranscriptions(readFileSync(path.join(root, 'analysis/ocr-reference/transcriptions.csv'), 'utf8'));
    expect(columns).toHaveLength(40);
  });

  it('reads stored columns by header name, NULL as null', () => {
    const csvHeader = ['orgnr', 'filing_year', 'role', 'stated_year', 'c1', 'c2', 'c3', 'c4', 'c5', 'status', ...SM2_FIELDS.map((f) => `${f}_ore`)];
    const values: Record<string, string> = {
      orgnr: '921716257', filing_year: '2021', role: 'prior', stated_year: '2020',
      c1: 'pass', c2: 'pass', c3: 'not_evaluable', c4: 'not_evaluable', c5: 'pass', status: 'reconciled',
      varer_ore: '0', sum_eiendeler_ore: '14413500',
    };
    const csv = `${csvHeader.join(',')}\n${csvHeader.map((name) => values[name] ?? '').join(',')}\n`;
    expect(parseCsv(csv)).toHaveLength(2);
    const [column] = parseStoredColumns(csv);
    expect(column?.figuresOre.get('varer')).toBe(0n);
    expect(column?.figuresOre.get('sum_eiendeler')).toBe(14413500n);
    expect(column?.figuresOre.get('salgsinntekt')).toBeNull();
    expect(column?.checks.c3).toBe('not_evaluable');
  });
});

describe('the consistency denominators', () => {
  const column = (c1: CheckedColumn['c1'], c3: CheckedColumn['c3'], c4: CheckedColumn['c4'] = 'pass'): CheckedColumn => ({
    c1,
    c2: 'pass',
    c3,
    c4,
    c5: 'pass',
    status: 'reconciled',
  });

  it('computes both denominators', () => {
    // 89 filings: 178 columns, 168 evaluable, of which 11 fail a check.
    const columns: CheckedColumn[] = [
      ...Array.from({ length: 157 }, () => column('pass', 'pass')),
      ...Array.from({ length: 10 }, () => column('fail', 'pass')),
      column('pass', 'pass', 'fail'),
      ...Array.from({ length: 6 }, () => column('pass', 'not_evaluable')),
      // A failing check in a column that is not evaluable: not passing, not evaluable.
      ...Array.from({ length: 4 }, () => column('not_evaluable', 'pass', 'fail')),
    ];
    const d = consistencyDenominators(89, columns);
    expect(d).toEqual({ all: 178, evaluable: 168, pass: 157, reconciled: 178 });
    // Two refused filings' columns count in all, never as evaluable.
    expect(consistencyDenominators(90, columns).all).toBe(180);
  });

  it('keeps the baseline the spike report shows', () => {
    expect(BASELINE).toEqual({ filings: 89, all: 178, evaluable: 168, pass: 157 });
    expect(BASELINE.evaluable - BASELINE_FAILING.length).toBe(BASELINE.pass);
    const spike = readFileSync(path.join(root, 'analysis/output/ocr-consistency.md'), 'utf8');
    for (const key of BASELINE_FAILING) {
      const [orgnr, year, role] = key.split('/');
      expect(spike).toMatch(new RegExp(`\\| ${orgnr} \\| ${year} \\| ${role === 'current' ? 'this' : 'last'} year \\|`));
    }
    const rows = spike.match(/^\| \d{9} \| 202[1-5] \|/gm) ?? [];
    expect(rows).toHaveLength(BASELINE_FAILING.length);
  });
});

describe(REPORT_FILE, () => {
  it('is what pnpm analysis:sm2 writes from the committed inputs, apart from its date', () => {
    const committed = readFileSync(path.join(root, REPORT_FILE), 'utf8');
    const date = /^Generated (\d{4}-\d{2}-\d{2}) by /m.exec(committed)?.[1];
    expect(date).toBeDefined();
    expect(renderReport(readInputs(root), date ?? '')).toBe(committed);
  });
});
