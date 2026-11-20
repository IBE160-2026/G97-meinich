// "Hvordan er dette regnet?" as a view (Story 3.7): the data-quality line in
// every state of decision 4, the {felt} of a failure, the compared-input rule,
// that every value shown is the engine's, and that beste fjerdedel can be
// computed again from the values "Vis fordelingen" shows. Every company is
// synthetic; each fixture's state is asserted before what it shows.
import { describe, expect, it } from 'vitest';
import {
  capitalProvenance,
  largestCapitalProvenance,
  lineText,
  profitProvenance,
  provenanceSubject,
  qualityLine,
  tableProvenance,
  viewFields,
  workingCapitalProvenance,
  type ProvenanceSubject,
  type ProvenanceView,
} from '../../src/analysis/provenance.ts';
import { capitalAmountText, kronerAmountText } from '../../src/analysis/kroner-amount.ts';
import { benchmarkApiFigures, benchmarkDocumentFigures, type ApiBenchmark, type DocumentBenchmark } from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import type { DocumentBasis } from '../../src/engine/document-inputs.ts';
import { formatDays, formatKroner, formatPercent, formatReadDate, formatTurnover } from '../../src/engine/format.ts';
import {
  CHECKS,
  type CheckId,
  type CheckResult,
  type CurrentReconciliation,
  dataQuality,
  type StoredDocumentFacts,
} from '../../src/engine/provenance.ts';
import { percentileInc } from '../../src/engine/statistics.ts';
import type { ApiInputs } from '../../src/engine/types.ts';
import { t } from '../../src/messages/index.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };
import { BASE_LINES, column, FAILED, NOT_IN_DATASET, readBasis, TEN_PEERS, type Lines } from './document-fixture.ts';

const NBSP = ' ';
const N = (text: string) => text.replaceAll(' ', NBSP);
/** A line with its no-break spaces as plain spaces: the formatter's bytes are format.test.ts's; here the words and numbers. */
const plain = (text: string) => text.replaceAll(NBSP, ' ');

// The subject: revenue 10 000 000 kr, driftsresultat 200 000 kr (2,0 %).
const SUBJECT: ApiInputs = {
  sumDriftsinntekter: 1_000_000_000n,
  driftsresultat: 20_000_000n,
  sumDriftskostnad: 980_000_000n,
  sumEiendeler: 300_000_000n,
  sumEgenkapitalGjeld: 300_000_000n,
  sumEgenkapital: 100_000_000n,
  sumGjeld: 200_000_000n,
};
// Ten peers with margins 1 %, 2 %, …, 10 % on the same revenue: beste fjerdedel P75 = 7,75 %.
const PEERS: readonly ApiInputs[] = Array.from({ length: 10 }, (_, i) => ({ ...SUBJECT, driftsresultat: BigInt(i + 1) * 10_000_000n }));

const READ_AT = new Date('2026-10-03T08:00:00Z');
const DOCUMENT_READ_AT = new Date('2026-10-21T08:00:00Z');

function reconciliation(overrides: Partial<CurrentReconciliation> = {}, lines: Lines = {}): CurrentReconciliation {
  const pass = Object.fromEntries(CHECKS.map((check) => [check, 'pass'])) as Record<CheckId, CheckResult>;
  return { checks: pass, apiCheck: 'pass', apiFailFields: [], figures: column(lines), ...overrides };
}

function subjectOf(api: ApiInputs, basis: DocumentBasis, facts: StoredDocumentFacts): ProvenanceSubject {
  return provenanceSubject(api, { filingYear: 2025, readAt: READ_AT, documentBasis: basis, documentFacts: facts });
}

const READ_FACTS: StoredDocumentFacts = { readAt: DOCUMENT_READ_AT, current: reconciliation() };

function benchmarks(api: ApiInputs = SUBJECT, basis: DocumentBasis = readBasis()): { api: ApiBenchmark; document: DocumentBenchmark } {
  return { api: benchmarkApiFigures(api, PEERS, 'NOK'), document: benchmarkDocumentFigures(basis, TEN_PEERS, 'NOK') };
}

function profitView(subject: ProvenanceSubject, api: ApiInputs = SUBJECT): ProvenanceView {
  const view = profitProvenance(subject, benchmarks(api).api.driftsmargin);
  if (view === null) throw new Error('the fixture has a profit amount');
  return view;
}

const quality = (view: ProvenanceView) => lineText(view.quality);

describe('the data-quality line (decision 4)', () => {
  it('Avstemt only where every input was compared', () => {
    // The fixture's state: a reconciled column whose api_check passed, with driftsresultat and
    // sumDriftsinntekter read, both stated in the API.
    expect(READ_FACTS.current?.apiCheck).toBe('pass');
    expect(BASE_LINES.driftsresultat).not.toBeNull();
    expect(BASE_LINES.sumDriftsinntekter).not.toBeNull();
    expect(quality(profitView(subjectOf(SUBJECT, readBasis(), READ_FACTS)))).toBe(nb['provenance.quality.reconciled']);
    // api_check not_evaluable: nothing was compared.
    const notEvaluable = { readAt: DOCUMENT_READ_AT, current: reconciliation({ apiCheck: 'not_evaluable' }) };
    expect(quality(profitView(subjectOf(SUBJECT, readBasis(), notEvaluable)))).toBe(
      t('provenance.quality.notCompared', { felt: 'driftsresultat, sumDriftsinntekter' }),
    );
    // A line the document did not read is not compared.
    const unread = { readAt: DOCUMENT_READ_AT, current: reconciliation({}, { driftsresultat: null }) };
    expect(quality(profitView(subjectOf(SUBJECT, readBasis(), unread)))).toBe(
      t('provenance.quality.notCompared', { felt: 'driftsresultat' }),
    );
  });

  it('a derived input is not compared', () => {
    // The fixture's state: driftsresultat is empty in the API filing, derived from sumDriftsinntekter − sumDriftskostnad.
    const derived: ApiInputs = { ...SUBJECT, driftsresultat: null };
    const view = profitView(subjectOf(derived, readBasis(), READ_FACTS), derived);
    expect(view.filed.api.find((value) => value.name === 'driftsresultat')?.rule).not.toBeNull();
    expect(quality(view)).toBe(t('provenance.quality.notCompared', { felt: 'driftsresultat' }));
  });

  it('a document line no check covers is never Avstemt', () => {
    // The fixture's state: the column reconciled and its API comparison passed.
    const subject = subjectOf(SUBJECT, readBasis(), READ_FACTS);
    const { document } = benchmarks();
    const kfd = capitalProvenance(subject, 'kfd', document.kfd);
    const lgd = capitalProvenance(subject, 'lgd', document.lgd);
    const oml = capitalProvenance(subject, 'oml', document.oml);
    const wc = workingCapitalProvenance(subject, document);
    const largest = largestCapitalProvenance(subject, document);
    expect([kfd, lgd, oml, wc, largest].every((view) => view !== null)).toBe(true);
    expect(quality(kfd as ProvenanceView)).toBe(t('provenance.quality.notCompared', { felt: 'kundefordringer, salgsinntekt' }));
    expect(quality(lgd as ProvenanceView)).toBe(
      t('provenance.quality.notCompared', { felt: 'leverandorgjeld, varekostnad, annenDriftskostnad' }),
    );
    // sumDriftsinntekter and sumEiendeler are compared; bankinnskudd is not.
    expect(quality(oml as ProvenanceView)).toBe(t('provenance.quality.notCompared', { felt: 'bankinnskudd' }));
    for (const view of [kfd, lgd, oml, wc, largest]) expect(quality(view as ProvenanceView)).not.toBe(nb['provenance.quality.reconciled']);
  });

  const failedFacts: StoredDocumentFacts = {
    readAt: DOCUMENT_READ_AT,
    current: reconciliation({ apiCheck: 'fail', apiFailFields: ['sum_driftsinntekter', 'sum_eiendeler'] }),
  };
  const notReadInV1: DocumentBasis = { kind: 'not_read_in_v1', scope: 'filing_year', filingYear: 2019 };
  const paper: DocumentBasis = { kind: 'not_read_in_v1', scope: 'paper', filingYear: 2025 };
  const states: readonly [string, DocumentBasis, StoredDocumentFacts, string][] = [
    ['not on the manifest', NOT_IN_DATASET, { readAt: null, current: null }, nb['provenance.quality.notInDataset']],
    ['a year outside 2021–2025', notReadInV1, { readAt: null, current: null }, t('provenance.quality.notReadInV1', { aar: '2019' })],
    ['paper', paper, { readAt: DOCUMENT_READ_AT, current: null }, t('provenance.quality.notReadInV1', { aar: '2025' })],
    ['no document', { kind: 'document_missing', filingYear: 2025 }, { readAt: null, current: null }, t('provenance.quality.documentMissing', { aar: '2025' })],
    ['not_extracted', { kind: 'refused', filingYear: 2025 }, { readAt: DOCUMENT_READ_AT, current: null }, t('provenance.quality.notReadSafely', { aar: '2025' })],
    ['status NULL', { kind: 'not_reconciled', filingYear: 2025 }, { readAt: DOCUMENT_READ_AT, current: null }, t('provenance.quality.notReadSafely', { aar: '2025' })],
    ['failed_reconciliation', FAILED, failedFacts, t('provenance.quality.failed', { felt: 'sumDriftsinntekter, sumEiendeler' })],
    ['reconciled, every input compared', readBasis(), READ_FACTS, nb['provenance.quality.reconciled']],
    [
      'reconciled, an input not compared',
      readBasis(),
      { readAt: DOCUMENT_READ_AT, current: reconciliation({ apiCheck: 'not_evaluable' }) },
      t('provenance.quality.notCompared', { felt: 'driftsresultat, sumDriftsinntekter' }),
    ],
  ];

  it.each(states)('%s: its line on the profit', (_label, basis, facts, expected) => {
    expect(quality(profitView(subjectOf(SUBJECT, basis, facts)))).toBe(expected);
  });

  // The seven states without a read document: a document amount is absent, with no drill-down.
  it.each(states.filter(([label]) => !label.startsWith('reconciled')))('%s: no capital amount and no drill-down', (_label, basis, facts) => {
    expect(basis.kind).not.toBe('read');
    const subject = subjectOf(SUBJECT, basis, facts);
    const { api, document } = benchmarks(SUBJECT, basis);
    expect(document.kfd.gap.kind).not.toBe('amount');
    expect(dataQuality({ basis, facts, api: SUBJECT, inputs: [], amount: 'document' })).toEqual({ kind: 'absent' });
    for (const key of ['kfd', 'lgd', 'oml'] as const) expect(capitalProvenance(subject, key, document[key])).toBeNull();
    expect(workingCapitalProvenance(subject, document)).toBeNull();
    expect(largestCapitalProvenance(subject, document)).toBeNull();
    expect(Object.keys(tableProvenance(subject, api, document))).toEqual(['driftsmargin']);
  });

  it('felt names the failing fields or equation', () => {
    const failed = (current: CurrentReconciliation) =>
      lineText(qualityLine(dataQuality({ basis: FAILED, facts: { readAt: DOCUMENT_READ_AT, current }, api: SUBJECT, inputs: [], amount: 'api' })));
    // An API failure: the fields in register names, in step 1's order.
    expect(failed(reconciliation({ apiCheck: 'fail', apiFailFields: ['sum_driftsinntekter', 'ordinaert_resultat_foer_skattekostnad'] }))).toBe(
      t('provenance.quality.failed', { felt: 'sumDriftsinntekter, ordinaertResultatFoerSkattekostnad' }),
    );
    // Each check as its equation in register names.
    const equations: Readonly<Record<CheckId, string>> = {
      c1: 'sumDriftsinntekter − sumDriftskostnad ≠ driftsresultat',
      c2: 'driftsresultat + nettoFinans ≠ ordinaertResultatFoerSkattekostnad',
      c3: 'sumEiendeler ≠ sumEgenkapitalGjeld',
      c4: 'sumEgenkapital + sumGjeld ≠ sumEgenkapitalGjeld',
      c5: 'sumEiendeler ≠ sumEgenkapital + sumGjeld',
    };
    for (const check of CHECKS) {
      const current = reconciliation({ checks: { ...reconciliation().checks, [check]: 'fail' } });
      expect(failed(current), check).toBe(t('provenance.quality.failed', { felt: equations[check] }));
    }
    // Both: the API fields first, then the equations, joined with "; ".
    const both = reconciliation({
      apiCheck: 'fail',
      apiFailFields: ['sum_gjeld'],
      checks: { ...reconciliation().checks, c3: 'fail', c5: 'fail' },
    });
    expect(failed(both)).toBe(t('provenance.quality.failed', { felt: `sumGjeld; ${equations.c3}; ${equations.c5}` }));
    // Nothing failed outright: a required check could not be read; the lines it could not read, never "≠".
    const unread = reconciliation({ checks: { ...reconciliation().checks, c1: 'not_evaluable' } }, { driftsresultat: null });
    expect(failed(unread)).toBe(t('provenance.quality.failed', { felt: 'driftsresultat' }));
    expect(failed(unread)).not.toContain('≠');
  });
});

describe('every value is the engine’s', () => {
  const subject = subjectOf(SUBJECT, readBasis(), READ_FACTS);
  const { api, document } = benchmarks();

  it('the profit: amount, r, T, n, M and the filed values', () => {
    const c = api.driftsmargin.comparison;
    if (c.kind !== 'compared' || c.best === null || api.driftsmargin.gap.kind !== 'amount') throw new Error('the fixture has an amount');
    const view = profitView(subject);
    const formula = view.formula.flatMap((group) => group.lines).map((item) => plain(lineText(item)));
    expect(formula).toEqual([
      '(T − r) × sumDriftsinntekter',
      // (7,8 % − 2,0 %) × 10 000 000 kr = 580 000 kr, the engine's 575 000 kr: "≈".
      plain(`(7,8 % − 2,0 %) × 10 000 000 kr ≈ ${kronerAmountText(api.driftsmargin.gap)} per år`),
    ]);
    expect(kronerAmountText(api.driftsmargin.gap)).toBe(N('575 000 kr'));
    const [figure] = view.figures;
    expect(figure?.label).toBe(nb['fig.driftsmargin']);
    expect(figure?.lines.map((item) => plain(lineText(item)))).toEqual([
      plain(`r = driftsresultat / sumDriftsinntekter = 200 000 kr / 10 000 000 kr = ${formatPercent(c.subject.toString())}`),
      plain(`M = ${formatPercent(c.median.toString())}`),
      plain(`T = ${formatPercent(c.best.quartile.toString())}`),
    ]);
    expect(figure?.best).toBe(
      t('provenance.best', { T: formatPercent(c.best.quartile.toString()), kvartil: nb['provenance.quartile.upper'], n: String(c.count) }),
    );
    expect(view.filed.api).toEqual([
      { name: 'driftsresultat', value: formatKroner('20000000'), rule: null },
      { name: 'sumDriftsinntekter', value: formatKroner('1000000000'), rule: null },
    ]);
    expect(view.sources).toEqual([nb['provenance.source.api']]);
  });

  it('the capital figures: amount, r, T and the filed values', () => {
    const kfd = capitalProvenance(subject, 'kfd', document.kfd);
    const c = document.kfd.comparison;
    if (kfd === null || c.kind !== 'compared' || c.best === null || document.kfd.gap.kind !== 'amount') throw new Error('the fixture has (9)');
    // 50 000 kr − 33 dager × 365 000 kr / 365 = 17 000 kr; the engine's, from T = 32,5 dager, is 17 500 kr: "≈".
    expect(kfd.formula.flatMap((group) => group.lines).map((item) => plain(lineText(item)))).toEqual([
      'kundefordringer − T × salgsinntekt / 365',
      plain(`50 000 kr − ${formatDays(c.best.quartile.toString())} × 365 000 kr / 365 ≈ ${capitalAmountText(document.kfd.gap)} engangsbeløp`),
    ]);
    expect(capitalAmountText(document.kfd.gap)).toBe(N('17 500 kr'));
    expect(plain(lineText(kfd.figures[0]?.lines[0] ?? []))).toBe(
      plain(`r = kundefordringer / salgsinntekt × 365 = 50 000 kr / 365 000 kr × 365 = ${formatDays(c.subject.toString())}`),
    );
    expect(kfd.filed.document.map((value) => value.name)).toEqual(['kundefordringer', 'salgsinntekt']);
    expect(kfd.filed.api).toEqual([]);
    expect(kfd.sources).toEqual([nb['provenance.source.document']]);
    const oml = capitalProvenance(subject, 'oml', document.oml);
    const co = document.oml.comparison;
    if (oml === null || co.kind !== 'compared' || co.best === null) throw new Error('the fixture has (11)');
    expect(oml.figures[0]?.lines.map(lineText).at(-1)).toBe(`T = ${formatTurnover(co.best.quartile.toString())}`);
  });

  it('every field a view shows is an input, a rule operand or a failure name', () => {
    const fields = new Set(Object.values(tableProvenance(subject, api, document)).flatMap((view) => (view === undefined ? [] : viewFields(view))));
    expect([...fields].sort()).toEqual(
      ['annenDriftskostnad', 'bankinnskudd', 'driftsresultat', 'kundefordringer', 'leverandorgjeld', 'salgsinntekt', 'sumDriftsinntekter', 'sumEiendeler', 'varekostnad'].sort(),
    );
  });
});

describe('the quartile follows the direction', () => {
  const subject = subjectOf(SUBJECT, readBasis(), READ_FACTS);
  const { document } = benchmarks();
  it.each([
    ['kfd', 'lower', nb['provenance.quartile.lower']],
    ['lgd', 'upper', nb['provenance.quartile.upper']],
    ['oml', 'upper', nb['provenance.quartile.upper']],
  ] as const)('%s: the %s quartile, n = count', (key, _which, word) => {
    const view = capitalProvenance(subject, key, document[key]);
    const c = document[key].comparison;
    // The fixture's state: each figure is compared and below its beste fjerdedel, so it has an amount.
    if (view === null || c.kind !== 'compared') throw new Error(`the fixture compares ${key}`);
    expect(view.figures[0]?.best).toContain(` = ${word} kvartil av ${c.count} verdier`);
  });
});

describe('T recomputes from the shown values', () => {
  const subject = subjectOf(SUBJECT, readBasis(), READ_FACTS);
  const { document } = benchmarks();
  const parse = (text: string) => new Decimal(text.replace(/[^\d,−]/g, '').replace(',', '.').replace('−', '-'));
  // Each case names its figure, its quartile and how T is written; the views are built from the fixture above.
  it.each([
    ['driftsmargin, the upper quartile', () => profitView(subject), '0.75', (value: Decimal) => formatPercent(value.div(100).toString())],
    ['kundefordringsdager, the lower quartile', () => capitalProvenance(subject, 'kfd', document.kfd), '0.25', (value: Decimal) => formatDays(value.toString())],
  ] as const)('%s: n values sorted, no name, the two T is read from marked, and PERCENTILE.INC on them gives the shown T', (_label, view, p, write) => {
    const figure = view()?.figures[0];
    if (figure === undefined) throw new Error('a figure step');
    const values = figure.distribution.values.map((value) => parse(value.text));
    // The fixture's state: ten values, so h = 9 × p has the fraction 0,25 (lower) or 0,75 (upper), never 0.
    expect(values).toHaveLength(10);
    expect(new Decimal(9).mul(p).mod(1).isZero()).toBe(false);
    // Sorted, ascending, no name or orgnr: only formatted numbers.
    for (let i = 1; i < values.length; i += 1) expect((values[i] as Decimal).gte(values[i - 1] as Decimal)).toBe(true);
    expect(figure.distribution.values.every((value) => /^[−\d\s,]+(%|dager)?$/u.test(value.text.replaceAll(NBSP, ' ')))).toBe(true);
    expect(figure.lines.map(lineText)).toContain(`T = ${write(percentileInc(values, p))}`);
    expect(figure.distribution.caption).toBe(t('provenance.distribution.caption', { n: '10' }));
    expect(figure.distribution.values.filter((value) => value.marked)).toHaveLength(2);
  });
});

describe('one data-date line per source', () => {
  it('the API values carry the filing’s read date, the document’s lines the document’s', () => {
    const subject = subjectOf(SUBJECT, readBasis(), READ_FACTS);
    const { document } = benchmarks();
    const profit = profitView(subject);
    expect(profit.filed.apiDate).toBe(t('provenance.date.api', { aar: '2025', dato: formatReadDate(READ_AT) }));
    expect(profit.filed.documentDate).toBeNull();
    const kfd = capitalProvenance(subject, 'kfd', document.kfd);
    expect(kfd?.filed.documentDate).toBe(t('provenance.date.document', { aar: '2025', dato: formatReadDate(DOCUMENT_READ_AT) }));
    expect(kfd?.filed.apiDate).toBeNull();
    // The two dates differ in the fixture, so the test tells them apart.
    expect(formatReadDate(READ_AT)).not.toBe(formatReadDate(DOCUMENT_READ_AT));
  });
});
