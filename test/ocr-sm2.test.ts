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
  type RereadFiling,
  SM2_FIELDS,
  SM2_FIELDS_BEFORE_2_5B,
  SM2_PARTS,
  type Sm2Field,
  type StoredColumn,
  type StoredDocument,
  type TranscribedColumn,
  baselineDiff,
  checkBaselineCoverage,
  classesByField,
  classify,
  compareReference,
  consistencyDenominators,
  costSumCounts,
  countClasses,
  countNotRead,
  currentAssetsEmptied,
  r3Emptied,
  withoutR3Emptied,
  groupOf,
  lacksPartColumns,
  mismatches,
  misreadsReachingEngine,
  newResults,
  parseCorrections,
  parseStoredColumns,
  parseTranscriptions,
  phantomsReachingEngine,
  totalReadIn,
  totalShownMissing,
  totalShownRead,
  transcriptionsBefore,
  typeTotals,
} from '../scripts/ocr-sm2-compare.ts';
import {
  REPORT_FILE,
  RUN_COUNTS_BEFORE_2_5B_FILE,
  RUN_COUNTS_BEFORE_2_5C_FILE,
  RUN_COUNTS_BEFORE_FILE,
  classRow,
  parseRunCounts,
  readInputs,
  renderBeforeAfter,
  renderBeforeAfter25b,
  renderBeforeAfter25c,
  renderReport,
  storedGateCounts,
} from '../scripts/ocr-sm2.ts';
import { parseCsv } from '../scripts/seed-format.ts';
import { DOCUMENT_FIGURE_COLUMNS } from '../src/engine/document-inputs.ts';
import { businessType, fingerprintFromColumns } from '../src/engine/fingerprint.ts';

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
  digitsPassFields: [],
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
        truth('921716257', 2022, 'prior', { varer: 5n }),
      ],
      [
        read('921716257', 2021, 'current', { varer: 100n }),
        read('921716257', 2021, 'prior', {}),
        read('921716257', 2022, 'current', { varer: 999n }),
        read('921716257', 2022, 'prior', { varer: 999n }),
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

describe('the corrections log', () => {
  const log = (rows: string[]) =>
    [
      '# OCR reference set',
      '',
      '## Corrections',
      '',
      '| Date | Orgnr | Filing year | Column | Field | Old | New |',
      '|---|---|---|---|---|---|---|',
      ...rows,
      '',
      '## Next',
    ].join('\r\n');

  it('reads the table under the Corrections heading', () => {
    expect(parseCorrections(log(['| 2026-10-23 | 922184534 | 2025 | current | bankinnskudd | 429329 | 9429329 |']))).toEqual([
      { date: '2026-10-23', orgnr: '922184534', filingYear: 2025, role: 'current', field: 'bankinnskudd', oldKr: 429329n, newKr: 9429329n },
    ]);
  });

  it('refuses a README without the heading, a field outside the comparison, and a cell corrected twice', () => {
    expect(() => parseCorrections('# OCR reference set\n')).toThrow(/no "## Corrections" heading/);
    expect(() => parseCorrections(log(['| 2026-10-23 | 922184534 | 2025 | current | notes | 1 | 2 |']))).toThrow(/not a compared field/);
    const row = '| 2026-10-23 | 922184534 | 2025 | current | bankinnskudd | 429329 | 9429329 |';
    expect(() => parseCorrections(log([row, row]))).toThrow(/corrected twice/);
    // A refusal names the README line of the row (the first row is line 7).
    expect(() => parseCorrections(log(['| 2026-10-23 | 92218453 | 2025 | current | bankinnskudd | 1 | 2 |']))).toThrow(
      /^README\.md row 7: orgnr must be nine digits/,
    );
    expect(() => parseCorrections(log([row, '| 2026-10-23 | 922184534 | 2025 | next | varer | 1 | 2 |']))).toThrow(
      /^README\.md row 8: column must be current or prior/,
    );
  });

  it('counts the blind check apart from a correction made later', () => {
    // Only the six cells the blind check suspected (blind-check-key.csv) were
    // checked blind; 915648479/2021 was corrected later, on prompting (2.3b).
    const inputs = readInputs(root);
    expect(inputs.laterCorrections.map((c) => `${c.orgnr}/${c.filingYear}/${c.role}/${c.field}`)).toEqual(['915648479/2021/prior/salgsinntekt']);
    expect(inputs.corrections.length - inputs.laterCorrections.length).toBe(6);
    const report = renderReport(inputs, '2026-10-28');
    expect(report).toContain('a blind check against the PDFs found 6 transcription errors; 1 more was found later, on prompting');
    expect(report).toContain('and 6 by the blind check, 1 later, across');
  });

  it('reconstructs the headline before the corrections', () => {
    const drawn = [{ orgnr: '922184534', year: 2025 }];
    const corrected = [
      truth('922184534', 2025, 'current', { bankinnskudd: 9429329n }),
      truth('922184534', 2025, 'prior', {}),
    ];
    const stored = [read('922184534', 2025, 'current', { bankinnskudd: 942932900n }), read('922184534', 2025, 'prior', {})];
    const corrections = parseCorrections(log(['| 2026-10-23 | 922184534 | 2025 | current | bankinnskudd | 429329 | 9429329 |']));
    const after = misreadsReachingEngine(compareReference(drawn, corrected, stored).results);
    const before = misreadsReachingEngine(compareReference(drawn, transcriptionsBefore(corrected, corrections), stored).results);
    expect(after).toEqual([]);
    expect(before).toEqual([expect.objectContaining({ field: 'bankinnskudd', expectedKr: 429329n, class: 'misread' })]);
    // The corrected input is not changed in place.
    expect(corrected[0]?.figuresKr.get('bankinnskudd')).toBe(9429329n);
  });

  it('refuses a log that transcriptions.csv does not match', () => {
    const corrections = parseCorrections(log(['| 2026-10-23 | 922184534 | 2025 | current | bankinnskudd | 429329 | 9429329 |']));
    expect(() => transcriptionsBefore([truth('922184534', 2025, 'current', { bankinnskudd: 1n })], corrections)).toThrow(
      /does not hold the logged new value/,
    );
    expect(() => transcriptionsBefore([], corrections)).toThrow(/no column 922184534\/2025\/current/);
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
    const csvHeader = ['orgnr', 'filing_year', 'role', 'stated_year', 'c1', 'c2', 'c3', 'c4', 'c5', 'status', 'digits_pass_fields', ...SM2_FIELDS.map((f) => `${f}_ore`)];
    const values: Record<string, string> = {
      orgnr: '921716257', filing_year: '2021', role: 'prior', stated_year: '2020', digits_pass_fields: '"{driftsresultat,goodwill}"',
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
    expect(column?.digitsPassFields).toEqual(['driftsresultat', 'goodwill']);
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

describe('phantoms and not-read fields', () => {
  it('counts phantoms in reconciled columns, which reach the engine too', () => {
    const drawn = [
      { orgnr: '921716257', year: 2021 },
      { orgnr: '919470992', year: 2024 },
    ];
    const { results } = compareReference(
      drawn,
      [
        truth('921716257', 2021, 'current', {}),
        truth('921716257', 2021, 'prior', {}),
        truth('919470992', 2024, 'current', {}),
        truth('919470992', 2024, 'prior', {}),
      ],
      [
        read('921716257', 2021, 'current', { varer: 100n }), // phantom, reconciled: counts
        read('921716257', 2021, 'prior', { varer: 100n }, 'failed_reconciliation'), // phantom, never used
        read('919470992', 2024, 'current', { varer: 100n }), // phantom, reconciled, recent
        read('919470992', 2024, 'prior', {}),
      ],
    );
    const phantoms = phantomsReachingEngine(results);
    expect(phantoms.map((r) => `${r.orgnr}/${r.role}`)).toEqual(['921716257/current', '919470992/current']);
    expect(phantoms.filter((r) => r.group === 'older')).toHaveLength(1);
    expect(misreadsReachingEngine(results)).toEqual([]);
  });

  it('splits not-read fields into transcribed 0 and transcribed non-zero', () => {
    const { results } = compareReference(
      [{ orgnr: '921716257', year: 2021 }],
      [truth('921716257', 2021, 'current', { varer: 0n, salgsinntekt: 5n, aarsresultat: -3n }), truth('921716257', 2021, 'prior', { varer: 0n })],
      [read('921716257', 2021, 'current', {}), read('921716257', 2021, 'prior', { varer: 0n })],
    );
    expect(countNotRead(results)).toEqual({ zero: 1, nonZero: 2 });
    expect(classRow('All', results)).toBe('| All | 1 | 1 | 2 | 0 | 0 | 4 | 25,0 % |');
  });
});

describe('the baseline, column by column', () => {
  const column = (role: 'current' | 'prior', c1: CheckedColumn['c1'], c3: CheckedColumn['c3'], c5: CheckedColumn['c5'] = 'pass', c4: CheckedColumn['c4'] = 'pass') => ({
    role,
    c1,
    c2: 'pass' as const,
    c3,
    c4,
    c5,
    status: 'reconciled',
  });
  // One column per bucket, a missing role and a missing-total column.
  const filings: RereadFiling[] = [
    { orgnr: '900000001', filingYear: 2021, columns: [column('current', 'pass', 'pass'), column('prior', 'fail', 'pass')] },
    { orgnr: '900000002', filingYear: 2022, columns: [column('current', 'pass', 'not_evaluable', 'pass', 'fail'), column('prior', 'fail', 'pass', 'pass', 'fail')] },
    { orgnr: '900000003', filingYear: 2023, columns: [column('current', 'pass', 'pass'), column('prior', 'pass', 'not_evaluable', 'not_evaluable')] },
    { orgnr: '900000004', filingYear: 2024, columns: [column('current', 'not_evaluable', 'pass')] },
  ];
  const failing = ['900000001/2021/current', '900000001/2021/prior', '900000002/2022/current'];

  it('puts each column in exactly one bucket', () => {
    const diff = baselineDiff(filings, failing);
    expect(diff.fixed).toEqual(['900000001/2021/current']);
    expect(diff.stillFailing).toEqual([{ key: '900000001/2021/prior', checks: ['c1'] }]);
    // Failing c4 but not evaluable: not evaluable, never also failing.
    expect(diff.failingToNotEvaluable).toEqual([{ key: '900000002/2022/current', cause: 'missing total' }]);
    expect(diff.newlyFailing).toEqual([{ key: '900000002/2022/prior', checks: ['c1', 'c4'] }]);
    expect(diff.notEvaluable).toEqual([
      { key: '900000003/2023/prior', cause: 'c3 and c5 not evaluable' },
      { key: '900000004/2024/current', cause: 'c1 not evaluable' },
      { key: '900000004/2024/prior', cause: 'no column' },
    ]);
    expect(diff.passing).toBe(1);
    // The buckets add up to the denominators.
    const d = consistencyDenominators(filings.length, filings.flatMap((f) => f.columns));
    const total = diff.fixed.length + diff.stillFailing.length + diff.failingToNotEvaluable.length + diff.newlyFailing.length + diff.notEvaluable.length + diff.passing;
    expect(total).toBe(d.all);
    expect(diff.fixed.length + diff.passing).toBe(d.pass);
    expect(d.all - diff.failingToNotEvaluable.length - diff.notEvaluable.length).toBe(d.evaluable);
  });

  it('refuses a re-read that does not cover the baseline', () => {
    expect(() => checkBaselineCoverage(filings, 4, failing)).not.toThrow();
    expect(() => checkBaselineCoverage(filings.slice(1), 4, [])).toThrow(/holds 3 filings; the baseline has 4/);
    expect(() => checkBaselineCoverage(filings, 4, ['900000009/2021/current'])).toThrow(/lacks 900000009\/2021/);
    const inputs = readInputs(root);
    const short = { ...inputs, consistency: { ...inputs.consistency, filings: inputs.consistency.filings.slice(1) } };
    expect(() => renderReport(short, '2026-10-23')).toThrow(/holds 88 filings; the baseline has 89/);
  });
});

describe('before and after Story 2.3b', () => {
  const drawn = [{ orgnr: '921716257', year: 2021 }];
  const transcribed = [
    truth('921716257', 2021, 'current', { sum_eiendeler: 100n, sum_egenkapital_gjeld: 100n, bankinnskudd: 7n }),
    truth('921716257', 2021, 'prior', { sum_eiendeler: 90n, sum_egenkapital_gjeld: 90n }),
  ];

  it('lists only the errors reaching the engine that are new after', () => {
    // Before: the total not read. After: read, and bankinnskudd misread in
    // the same reconciled column: one new misread, listed.
    const beforeRun = compareReference(drawn, transcribed, [
      read('921716257', 2021, 'current', { sum_eiendeler: 10000n, bankinnskudd: 700n }),
      read('921716257', 2021, 'prior', { sum_eiendeler: 9000n, sum_egenkapital_gjeld: 9000n }),
    ]).results;
    const afterRun = compareReference(drawn, transcribed, [
      read('921716257', 2021, 'current', { sum_eiendeler: 10000n, sum_egenkapital_gjeld: 10000n, bankinnskudd: 7000n }),
      read('921716257', 2021, 'prior', { sum_eiendeler: 9000n, sum_egenkapital_gjeld: 9000n }),
    ]).results;
    const fresh = newResults(misreadsReachingEngine(beforeRun), misreadsReachingEngine(afterRun));
    expect(fresh.map((r) => `${r.role}/${r.field}/${r.class}`)).toEqual(['current/bankinnskudd/misread']);
    // A misread present before and after is not new.
    expect(newResults(misreadsReachingEngine(afterRun), misreadsReachingEngine(afterRun))).toEqual([]);
    // A field misread before and misread to another figure after is new.
    const otherMisread = compareReference(drawn, transcribed, [
      read('921716257', 2021, 'current', { sum_eiendeler: 10000n, sum_egenkapital_gjeld: 10000n, bankinnskudd: 8000n }),
      read('921716257', 2021, 'prior', { sum_eiendeler: 9000n, sum_egenkapital_gjeld: 9000n }),
    ]).results;
    expect(
      newResults(misreadsReachingEngine(afterRun), misreadsReachingEngine(otherMisread)).map((r) => `${r.field}/${r.readOre}`),
    ).toEqual(['bankinnskudd/8000']);
    const byField = new Map(classesByField(afterRun).map(({ field, counts }) => [field, counts]));
    expect(byField.get('sum_egenkapital_gjeld')).toEqual({ correct: 2, 'not read': 0, misread: 0, phantom: 0 });
    expect(new Map(classesByField(beforeRun).map(({ field, counts }) => [field, counts])).get('sum_egenkapital_gjeld')).toEqual({
      correct: 1,
      'not read': 1,
      misread: 0,
      phantom: 0,
    });
  });

  it('counts the total read per role, and shows it read or missing from the checks alone', () => {
    const columns = [
      read('921716257', 2021, 'current', { sum_egenkapital_gjeld: 1n }),
      read('921716257', 2022, 'current', {}),
      read('921716257', 2022, 'prior', { sum_egenkapital_gjeld: 1n }),
    ];
    expect(totalReadIn(columns, 'current')).toEqual({ read: 1, columns: 2 });
    expect(totalReadIn(columns, 'prior')).toEqual({ read: 1, columns: 1 });
    const checked = (c3: 'pass' | 'not_evaluable', c4: 'pass' | 'not_evaluable', c5: 'pass' | 'not_evaluable'): CheckedColumn => ({
      c1: 'pass',
      c2: 'pass',
      c3,
      c4,
      c5,
      status: null,
    });
    expect(totalShownRead(checked('pass', 'not_evaluable', 'pass'))).toBe(true);
    expect(totalShownRead(checked('not_evaluable', 'pass', 'not_evaluable'))).toBe(true);
    expect(totalShownRead(checked('not_evaluable', 'not_evaluable', 'pass'))).toBe(false);
    expect(totalShownMissing(checked('not_evaluable', 'not_evaluable', 'pass'))).toBe(true);
    expect(totalShownMissing(checked('not_evaluable', 'not_evaluable', 'not_evaluable'))).toBe(false);
  });

  it('reads the 2.1b counts, and says when the after counts do not exist yet', () => {
    const counts = parseRunCounts(JSON.parse(readFileSync(path.join(root, RUN_COUNTS_BEFORE_FILE), 'utf8')), RUN_COUNTS_BEFORE_FILE);
    expect(counts.currentColumns - counts.currentTotalRead).toBe(836);
    expect(() => parseRunCounts({ columns: {} }, 'x.json')).toThrow(/x.json/);
    const inputs = readInputs(root);
    const section = renderBeforeAfter({ ...inputs, before23b: { ...inputs.before23b, runAfter: null } }).join('\n');
    // formatPercent puts a no-break space before the percent sign.
    expect(section).toMatch(/\| Story 2\.1b run, local data \(this year\) \| 1946 \| 1110 of 1946 \(57,0\s%\) \| not yet counted \|/);
    expect(section).toContain('local data');
  });
});

describe('before and after Story 2.5b', () => {
  const header = ['orgnr', 'filing_year', 'role', 'stated_year', 'c1', 'c2', 'c3', 'c4', 'c5', 'status', 'digits_pass_fields'];
  const csv = (fields: readonly string[], values: Record<string, string>) => {
    const names = [...header, ...fields.map((f) => `${f}_ore`)];
    return `${names.join(',')}\n${names.map((name) => values[name] ?? '').join(',')}\n`;
  };
  const values = {
    orgnr: '921716257', filing_year: '2021', role: 'current', stated_year: '2021',
    c1: 'pass', c2: 'pass', c3: 'pass', c4: 'pass', c5: 'pass', status: 'reconciled', digits_pass_fields: '{}',
    sum_eiendeler_ore: '14413500', goodwill_ore: '500',
  };

  it('compares the four parts like every other field, and the engine stores the same 27 figures', () => {
    expect(SM2_PARTS).toEqual(['forskning_og_utvikling', 'konsesjoner_patenter', 'goodwill', 'utsatt_skattefordel']);
    expect(SM2_FIELDS.slice(-4)).toEqual([...SM2_PARTS]);
    expect(SM2_FIELDS_BEFORE_2_5B).toHaveLength(23);
    expect(SM2_FIELDS.map((f) => `${f}_ore`)).toEqual(Object.values(DOCUMENT_FIGURE_COLUMNS));
  });

  it('reads an export from before the migration with the parts as null, and refuses one with only some of them', () => {
    const old = csv(SM2_FIELDS_BEFORE_2_5B, values);
    expect(lacksPartColumns(old)).toBe(true);
    const [column] = parseStoredColumns(old);
    expect(column?.figuresOre.get('goodwill')).toBeNull();
    expect(column?.figuresOre.get('sum_eiendeler')).toBe(14413500n);
    const now = csv(SM2_FIELDS, values);
    expect(lacksPartColumns(now)).toBe(false);
    expect(parseStoredColumns(now)[0]?.figuresOre.get('goodwill')).toBe(500n);
    const some = csv([...SM2_FIELDS_BEFORE_2_5B, 'goodwill'], values);
    expect(() => parseStoredColumns(some)).toThrow(/only some of the parts' columns: goodwill/);
    // Any other missing column still refuses.
    expect(() => parseStoredColumns(csv(SM2_FIELDS.filter((f) => f !== 'varer'), values))).toThrow(/no column varer_ore/);
  });

  it('counts undetermined fingerprints and companies at their newest year, totals only', () => {
    const R = 1_000_000_000n;
    // A consultancy, every line read: konsulent. The same company a year
    // later with lonnskostnad empty and the rest of the costs leaving it
    // anywhere from 0 to 60 %: undetermined.
    const base: Partial<Record<Sm2Field, bigint>> = {
      sum_driftsinntekter: R, varekostnad: 0n, lonnskostnad: 700_000_000n, avskrivninger: 20_000_000n, nedskrivninger: 0n,
      annen_driftskostnad: 180_000_000n, sum_driftskostnad: 900_000_000n, sum_immaterielle_eiendeler: 0n,
      sum_varige_driftsmidler: 20_000_000n, varer: 0n, kundefordringer: 150_000_000n, bankinnskudd: 200_000_000n, sum_eiendeler: 400_000_000n,
    };
    const open = { ...base, lonnskostnad: undefined };
    const columns = [
      read('921716257', 2021, 'current', base),
      read('921716257', 2022, 'current', { ...open, annen_driftskostnad: 300_000_000n, sum_driftskostnad: 900_000_000n }),
      read('921716257', 2022, 'prior', base),
      read('912197905', 2022, 'current', base, 'failed_reconciliation'),
    ];
    const totals = typeTotals(columns, [], new Map());
    expect(totals).toEqual({ columns: 3, fingerprints: 2, undetermined: 1, companies: 1, companiesUndetermined: 1 });
  });

  it('gives the seed the same fingerprints as pnpm derive stored in it', () => {
    // Every committed fingerprint is the derivation of a seed column: the
    // totals from the engine here equal the stored rows' totals.
    const inputs = readInputs(root);
    const totals = typeTotals(inputs.stored, inputs.documents, inputs.subtotals);
    const [head, ...rows] = parseCsv(readFileSync(path.join(root, 'seed/demo/fingerprint.csv'), 'utf8'));
    const at = (name: string) => head?.indexOf(name) ?? -1;
    const cell = (row: string[], name: string) => {
      const value = row[at(name)];
      return value === undefined || value === '' ? null : value;
    };
    const flag = (value: string | null) => (value === null ? null : value === 't' || value === 'true');
    const stored = rows.map((row) =>
      fingerprintFromColumns({
        cost_of_goods_lo: cell(row, 'cost_of_goods_lo'), cost_of_goods_hi: cell(row, 'cost_of_goods_hi'),
        personnel_cost_lo: cell(row, 'personnel_cost_lo'), personnel_cost_hi: cell(row, 'personnel_cost_hi'),
        asset_intensity_lo: cell(row, 'asset_intensity_lo'), asset_intensity_hi: cell(row, 'asset_intensity_hi'),
        inventory: flag(cell(row, 'inventory')), capitalised_intangibles: flag(cell(row, 'capitalised_intangibles')),
      }),
    );
    expect(totals.fingerprints).toBe(stored.length);
    expect(totals.undetermined).toBe(stored.filter((f) => f !== null && businessType(f) === null).length);
  });

  it('reads the 2.1b fingerprint totals from counts written since Story 2.5b, and none from older counts', () => {
    const before = parseRunCounts(JSON.parse(readFileSync(path.join(root, RUN_COUNTS_BEFORE_2_5B_FILE), 'utf8')), RUN_COUNTS_BEFORE_2_5B_FILE);
    expect(before.types).toEqual({ fingerprints: 1791, undetermined: 893, companies: 401, companiesUndetermined: 184 });
    expect(before.currentNonNull.lonnskostnad).toBe(1398);
    expect(before.currentNonNull.goodwill).toBeUndefined();
    const older = parseRunCounts(JSON.parse(readFileSync(path.join(root, RUN_COUNTS_BEFORE_FILE), 'utf8')), RUN_COUNTS_BEFORE_FILE);
    expect(older.types).toBeNull();
    expect(() => parseRunCounts({ ...JSON.parse(readFileSync(path.join(root, RUN_COUNTS_BEFORE_2_5B_FILE), 'utf8')), fingerprints: {} }, 'y.json')).toThrow(/y.json/);
  });

  it('renders every class per field, the new errors, and the undetermined share as totals; the 2.1b after says not yet counted', () => {
    const inputs = readInputs(root);
    const section = renderBeforeAfter25b({ ...inputs, before25b: { ...inputs.before25b, runAfter: null } }).join('\n');
    expect(section).toContain('## Before and after Story 2.5b');
    for (const field of SM2_FIELDS) expect(section).toMatch(new RegExp(`^\\| ${field} \\|`, 'm'));
    expect(section).toMatch(/\| Story 2\.1b run, local data: fingerprints undetermined \| 893 of 1791 \(49,9\s%\) \| not yet counted \|/);
    expect(section).toMatch(/\| goodwill \| not a field then \| not yet counted \|/);
    // No orgnr in the fingerprint table: totals only.
    const types = section.slice(section.indexOf('### Fingerprints without a business type'), section.indexOf('### The Story 2.1b run'));
    expect(types).not.toMatch(/\d{9}/);
    // A new misread reaching the engine after is listed.
    const fake = inputs.comparison.results.find((r) => r.class === 'correct' && r.columnStatus === 'reconciled');
    if (fake === undefined) throw new Error('no correct field in a reconciled column');
    const misread = { ...fake, class: 'misread' as const, readOre: (fake.readOre ?? 0n) + 100n };
    // The section's "after" is the state Story 2.5b left (the Story 2.5c before copy).
    const after = inputs.before25c;
    const withNew = renderBeforeAfter25b({
      ...inputs,
      before25c: { ...after, comparison: { ...after.comparison, results: [...after.comparison.results, misread] } },
    }).join('\n');
    expect(withNew).toContain(`| ${fake.orgnr} | ${fake.filingYear} |`);
  });

  it('counts the figures each gate admitted, and those resting on an operand counted as 0, totals only', () => {
    const cost = { varekostnad: 1n, lonnskostnad: 2n, avskrivninger: 3n, annen_driftskostnad: 4n, sum_driftskostnad: 10n };
    const columns: StoredColumn[] = [
      // nedskrivninger NULL: lonnskostnad admitted on an operand counted as 0.
      { ...read('921716257', 2021, 'current', cost), digitsPassFields: ['lonnskostnad'] },
      // Every operand held; driftsresultat is c1's, no gate's.
      { ...read('921716257', 2022, 'current', { ...cost, nedskrivninger: 0n }), digitsPassFields: ['annen_driftskostnad', 'driftsresultat'] },
      // Every part held but one admitted.
      {
        ...read('921716257', 2022, 'prior', { forskning_og_utvikling: 1n, konsesjoner_patenter: 1n, goodwill: 1n, utsatt_skattefordel: 1n }),
        digitsPassFields: ['goodwill'],
      },
    ];
    expect(storedGateCounts(columns)).toEqual({
      cost_lines: { admitted: 2, withOperandCountedAsZero: 1 },
      intangible_parts: { admitted: 1, withOperandCountedAsZero: 0 },
    });
    const inputs = readInputs(root);
    const section = renderBeforeAfter25b({ ...inputs, before25b: { ...inputs.before25b, runAfter: null } }).join('\n');
    const gates = section.slice(section.indexOf('### Figures the sum gates admitted'), section.indexOf('### The Story 2.1b run'));
    expect(gates).toContain('an operand counted as 0 (a blank row or no row)');
    expect(gates).toContain('cannot tell a row printed with no figure in either pass from a line the document does not print');
    expect(gates).toMatch(/\| Cost lines against sum kostnader \| Story 2\.1b run, local data \| no gate then \| no gate then \| not yet counted \| not yet counted \|/);
    expect(gates).not.toMatch(/\d{9}/);
    // The section counts the stored columns it is given.
    const counted = renderBeforeAfter25b({ ...inputs, before25c: { ...inputs.before25c, stored: columns } }).join('\n');
    expect(counted).toMatch(/\| Cost lines against sum kostnader \| Reference set \| \d+ \| \d+ \| 2 \| 1 \|/);
  });

  it('reads the gate counts of the 2.1b rows, both roles together', () => {
    const json = JSON.parse(readFileSync(path.join(root, RUN_COUNTS_BEFORE_2_5B_FILE), 'utf8'));
    expect(parseRunCounts(json, 'x.json').gates).toBeNull();
    const gate = (admitted: number, zero: number) => ({ admitted, operand_counted_as_zero: zero });
    json.columns.current.gates = { cost_lines: gate(5, 2), intangible_parts: gate(1, 0) };
    json.columns.prior.gates = { cost_lines: gate(3, 1), intangible_parts: gate(0, 0) };
    expect(parseRunCounts(json, 'x.json').gates).toEqual({
      cost_lines: { admitted: 8, withOperandCountedAsZero: 3 },
      intangible_parts: { admitted: 1, withOperandCountedAsZero: 0 },
    });
    delete json.columns.prior.gates.cost_lines;
    expect(() => parseRunCounts(json, 'x.json')).toThrow(/x\.json/);
  });

  it('keeps the Story 2.5b section on the state Story 2.5b left, whatever the seed holds now (Story 2.5c)', () => {
    const inputs = readInputs(root);
    const section = renderBeforeAfter25b(inputs).join('\n');
    expect(renderBeforeAfter25b({ ...inputs, comparison: { results: [], notes: [] }, stored: [], documents: [] }).join('\n')).toBe(section);
  });

  it('keeps the Story 2.3b section on the state Story 2.3b left, whatever the seed holds now', () => {
    const inputs = readInputs(root);
    const section = renderBeforeAfter(inputs).join('\n');
    expect(renderBeforeAfter({ ...inputs, comparison: { results: [], notes: [] }, stored: [] }).join('\n')).toBe(section);
    expect(section).not.toMatch(/goodwill/);
  });
});

describe('before and after Story 2.5c', () => {
  const R = 1_000_000_000n;
  const cost = { sum_driftsinntekter: R, varekostnad: 0n, lonnskostnad: 700_000_000n, avskrivninger: 20_000_000n, annen_driftskostnad: 180_000_000n };

  it('counts the reconciled columns whose cost lines do not sum, nedskrivninger empty as 0, both roles', () => {
    const columns = [
      read('921716257', 2021, 'current', { ...cost, sum_driftskostnad: 900_000_000n }), // sums
      read('921716257', 2022, 'current', { ...cost, sum_driftskostnad: 900_000_500n }), // 5 kr under: the rounding
      read('921716257', 2023, 'current', { ...cost, sum_driftskostnad: 900_050_000n }), // 500 kr under
      read('921716257', 2023, 'prior', { ...cost, nedskrivninger: 0n, sum_driftskostnad: 800_000_000n }), // over
      read('921716257', 2024, 'current', { ...cost, lonnskostnad: undefined, sum_driftskostnad: 990_000_000n }), // a main line empty
      read('921716257', 2025, 'current', { ...cost, sum_driftskostnad: 1n }, 'failed_reconciliation'),
      // No revenue: the engine skips it as no_revenue before R2, so it is not counted.
      read('921716257', 2026, 'current', { ...cost, sum_driftsinntekter: 0n, sum_driftskostnad: 900_050_000n }),
    ];
    expect(costSumCounts(columns)).toEqual({
      current: { evaluable: 3, under: 1, over: 0 },
      prior: { evaluable: 1, under: 0, over: 1 },
    });
  });

  it('counts the current asset lines R3 keeps from the engine, with the filing\'s API subtotal only', () => {
    const column = read('921716257', 2025, 'current', { kundefordringer: 1_500_000_000n, bankinnskudd: 200_000_000n });
    const documents = [{ orgnr: '921716257', filingYear: 2025, brregId: '1', layout: 'generated', status: 'reconciled' }] as unknown as StoredDocument[];
    const subtotals = new Map([['1', { sumAnleggsmidler: null, sumOmloepsmidler: 350_000_000n }]]);
    expect(currentAssetsEmptied([column], documents, subtotals)).toEqual({ kundefordringer: 1, bankinnskudd: 0 });
    expect(currentAssetsEmptied([{ ...column, role: 'prior' }], documents, subtotals)).toEqual({ kundefordringer: 0, bankinnskudd: 0 });
    expect(currentAssetsEmptied([column], documents, new Map())).toEqual({ kundefordringer: 0, bankinnskudd: 0 });
    // A misread R3 empties does not reach the engine; any other field still does.
    const emptied = r3Emptied([column], documents, subtotals);
    expect([...emptied]).toEqual(['921716257/2025/current/kundefordringer']);
    const misread = (field: Sm2Field) =>
      ({ orgnr: '921716257', filingYear: 2025, role: 'current', field, class: 'misread', columnStatus: 'reconciled' }) as unknown as Parameters<typeof withoutR3Emptied>[0][number];
    const results = [misread('kundefordringer'), misread('bankinnskudd')];
    expect(misreadsReachingEngine(withoutR3Emptied(results, emptied)).map((r) => r.field)).toEqual(['bankinnskudd']);
  });

  it('reads the engine and varer counts from counts written since Story 2.5c, and none from older counts', () => {
    const before = parseRunCounts(JSON.parse(readFileSync(path.join(root, RUN_COUNTS_BEFORE_2_5C_FILE), 'utf8')), RUN_COUNTS_BEFORE_2_5C_FILE);
    expect(before.engine).toEqual({
      columns: 1946,
      fingerprints: 1757,
      costLinesShortOfTotal: 27,
      shortWithNedskrivningerEmpty: 27,
      negativeUnexplained: 35,
      emptiedKundefordringer: 8,
      emptiedBankinnskudd: 0,
    });
    expect(before.varer?.current.negative_before).toBe(18);
    const older = parseRunCounts(JSON.parse(readFileSync(path.join(root, RUN_COUNTS_BEFORE_2_5B_FILE), 'utf8')), RUN_COUNTS_BEFORE_2_5B_FILE);
    expect([older.engine, older.varer]).toEqual([null, null]);
    const json = JSON.parse(readFileSync(path.join(root, RUN_COUNTS_BEFORE_2_5C_FILE), 'utf8'));
    expect(parseRunCounts({ ...json, varer_against_dump: null }, 'z.json').varer).toBeNull();
    delete json.engine.skipped.cost_lines_short_of_total;
    expect(() => parseRunCounts(json, 'z.json')).toThrow(/z\.json/);
  });

  it('renders the classes, the new errors, the columns that do not sum, R3 and R4 as totals; the 2.1b after says not yet counted', () => {
    const inputs = readInputs(root);
    const section = renderBeforeAfter25c({ ...inputs, before25c: { ...inputs.before25c, runAfter: null } }).join('\n');
    expect(section).toContain('## Before and after Story 2.5c');
    for (const field of SM2_FIELDS) expect(section).toMatch(new RegExp(`^\\| ${field} \\|`, 'm'));
    expect(section).toMatch(/\| Story 2\.1b run, local data: `cost_lines_short_of_total` \(R2\) \| 27 \| not yet counted \|/);
    expect(section).toMatch(/\| Story 2\.1b run, local data \| kundefordringer \| 8 \| not yet counted \|/);
    expect(section).toMatch(/\| Story 2\.1b run, local data \(this year\) \| not yet counted \| not yet counted \| not yet counted \| 18 \| not yet counted \|/);
    // Totals only below the error list: no orgnr.
    const totals = section.slice(section.indexOf('### Cost lines that do not sum'));
    expect(totals).not.toMatch(/\d{9}/);
    // A new misread reaching the engine after is listed.
    const fake = inputs.comparison.results.find((r) => r.class === 'correct' && r.columnStatus === 'reconciled');
    if (fake === undefined) throw new Error('no correct field in a reconciled column');
    const misread = { ...fake, class: 'misread' as const, readOre: (fake.readOre ?? 0n) + 100n };
    const withNew = renderBeforeAfter25c({ ...inputs, comparison: { ...inputs.comparison, results: [...inputs.comparison.results, misread] } }).join('\n');
    expect(withNew).toContain(`| ${fake.orgnr} | ${fake.filingYear} |`);
    expect(withNew).toMatch(/\| Misread, reaching the engine \| 0 \| 1 \|/);
    // The after side counts the stored columns it is given: a varer the re-read empties.
    const varerBefore = inputs.before25c.stored.find((c) => c.role === 'current' && c.status === 'reconciled' && c.figuresOre.get('varer') != null);
    if (varerBefore === undefined) throw new Error('no current column with varer');
    const emptied = inputs.stored.map((c) =>
      c.orgnr === varerBefore.orgnr && c.filingYear === varerBefore.filingYear && c.role === 'current'
        ? { ...c, figuresOre: new Map([...c.figuresOre, ['varer', null]]) as StoredColumn['figuresOre'] }
        : c,
    );
    expect(renderBeforeAfter25c({ ...inputs, stored: emptied }).join('\n')).toMatch(/\| Reference set \(this year\) \| 1 \| 0 \| 0 \| 0 \| 0 \|/);
  });
});
