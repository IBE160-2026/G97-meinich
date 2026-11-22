// The margin waterfall fold-out as a view (Story 3.3; FR-29, FR-30;
// EXPERIENCE.md "Margin waterfall"): every state's words, the bars' sign,
// glyph, word and shares, "Mot peer-gruppen samlet, ikke medianen" where a
// cost-share row and its bar disagree, the document's margin against the
// Driftsmargin row (decision 10), the same strings at every closable share,
// and the payload boundary (AD-4). Every company is synthetic.
import { describe, expect, it } from 'vitest';
import { keyFigureTableView } from '../../src/analysis/key-figure-rows.ts';
import { shownGroup } from '../../src/analysis/shown-group.ts';
import type { SubjectKeyFigures } from '../../src/analysis/view.ts';
import { waterfallView, type WaterfallView } from '../../src/analysis/waterfall-view.ts';
import {
  benchmarkApiFigures,
  benchmarkDocumentFigures,
  benchmarkTotalAssetTurnover,
} from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import type { DocumentBasis } from '../../src/engine/document-inputs.ts';
import { formatKroner, formatPercent, formatSignedKroner } from '../../src/engine/format.ts';
import type { ApiInputs } from '../../src/engine/types.ts';
import { marginWaterfall, type MarginWaterfall } from '../../src/engine/waterfall.ts';
import { ANDELER, parse } from '../../src/url/analysis-state.ts';
import { t } from '../../src/messages/index.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };
import { FAILED, NOT_IN_DATASET, readBasis, type Lines } from './document-fixture.ts';

const NBSP = ' ';
const YEAR = 2025;

/** A read company: revenue and its parts in whole kroner, `driftsresultat` revenue less them. */
function company(revenueKr: bigint, vareKr: bigint, lonnKr: bigint, annenKr: bigint, avskrKr: bigint, lines: Lines = {}): DocumentBasis {
  const kr = (amount: bigint) => (amount * 100n).toString();
  const costs = vareKr + lonnKr + annenKr + avskrKr;
  return readBasis({
    sumDriftsinntekter: kr(revenueKr),
    salgsinntekt: kr(revenueKr),
    varekostnad: kr(vareKr),
    lonnskostnad: kr(lonnKr),
    annenDriftskostnad: kr(annenKr),
    avskrivninger: kr(avskrKr),
    nedskrivninger: '0',
    sumDriftskostnad: kr(costs),
    driftsresultat: kr(revenueKr - costs),
    ...lines,
  });
}

// Nine peers of 10 mill. kr at 30 % varekostnad and one of 100 mill. kr at 5 %:
// the median varekostnadsandel is 30 %, the peer group as a whole's 16,8 %.
const PEERS: readonly DocumentBasis[] = [
  ...Array.from({ length: 9 }, () => company(10_000_000n, 3_000_000n, 5_000_000n, 1_000_000n, 500_000n)),
  company(100_000_000n, 5_000_000n, 50_000_000n, 10_000_000n, 5_000_000n),
];
// The subject: varekostnad 20 % (better than the median, worse than samlet), lønn 40 % (better on both),
// andre 15 % (worse on both), avskrivninger 5 %; margin 20 %.
const SUBJECT = company(20_000_000n, 4_000_000n, 8_000_000n, 3_000_000n, 1_000_000n);

function view(subject: DocumentBasis = SUBJECT, peers: readonly DocumentBasis[] = PEERS, valuta = 'NOK'): WaterfallView {
  return waterfallView({
    waterfall: marginWaterfall(subject, peers, YEAR, valuta),
    document: benchmarkDocumentFigures(subject, peers, valuta),
    filingYear: YEAR,
  });
}

function shown(v: WaterfallView): Extract<WaterfallView, { readonly kind: 'shown' }> {
  if (v.kind !== 'shown') throw new Error(`no waterfall: ${v.text}`);
  return v;
}

/** The subject's own Varekostnadsandel cell, as the key-figure table words it. */
function vareRowText(subject: DocumentBasis): string {
  const none: ApiInputs = { sumDriftsinntekter: null, driftsresultat: null, sumDriftskostnad: null, sumEiendeler: null, sumEgenkapitalGjeld: null, sumEgenkapital: null, sumGjeld: null };
  const table = keyFigureTableView({
    api: benchmarkApiFigures(none, [], 'NOK'),
    turnover: benchmarkTotalAssetTurnover(none, []),
    document: benchmarkDocumentFigures(subject, PEERS, 'NOK'),
    waterfall: marginWaterfall(subject, PEERS, YEAR, 'NOK'),
    filingYear: YEAR,
    smaaForetak: true,
  });
  const vare = table.groups.flatMap((group) => group.rows).find((row) => row.key === 'vare');
  if (vare === undefined) throw new Error('no vare row');
  return vare.own.text;
}

describe('the waterfall’s states', () => {
  it('a subject without its lines says why', () => {
    const missing = company(20_000_000n, 400n, 800n, 300n, 100n, { varekostnad: null, lonnskostnad: null });
    const cases: readonly [string, DocumentBasis][] = [
      ['a line missing', missing],
      ['failed', FAILED],
      ['not reconciled', { kind: 'not_reconciled', filingYear: YEAR }],
      ['no document', { kind: 'document_missing', filingYear: YEAR }],
      ['paper', { kind: 'not_read_in_v1', scope: 'paper', filingYear: YEAR }],
      ['revenue zero', company(0n, 1n, 1n, 1n, 1n)],
      // A missing line is checked before the revenue's sign: component missing, not revenue not positive.
      ['revenue zero and a line missing', company(0n, 100n, 200n, 300n, 400n, { varekostnad: null, lonnskostnad: null })],
    ];
    for (const [name, basis] of cases) {
      const v = view(basis);
      expect(v.kind, name).toBe('absent');
      // The same words as its Varekostnadsandel row.
      if (v.kind === 'absent') expect(v.text, name).toBe(vareRowText(basis));
    }
    expect(view(missing)).toEqual({ kind: 'absent', text: `Kan ikke beregnes: ${nb['analysis.figures.reason.componentMissing']}` });
    expect(view(FAILED)).toEqual({ kind: 'absent', text: 'Regnskapet for 2025 kunne ikke leses sikkert' });
  });

  it('a subject failing R2 has its own reason', () => {
    // Every main line read, nedskrivninger empty, 100 kr short of sumDriftskostnad.
    const short = company(20_000_000n, 4_000_000n, 8_000_000n, 3_000_000n, 1_000_000n, {
      nedskrivninger: null,
      sumDriftskostnad: ((16_000_000n + 100n) * 100n).toString(),
    });
    const v = view(short);
    expect(v).toEqual({ kind: 'absent', text: t('waterfall.shortOfTotal', { aar: '2025' }) });
    if (v.kind === 'absent') expect(v.text).not.toContain(nb['analysis.figures.reason.componentMissing']);
  });

  it('peers not in the demo data: N1', () => {
    const four = PEERS.slice(0, 4);
    expect(view(SUBJECT, [...four, ...Array.from({ length: 6 }, () => NOT_IN_DATASET)])).toEqual({ kind: 'absent', text: nb['waterfall.notLoaded'] });
    // Below 10 even with them: the too-few sentence, with n = |P|.
    expect(view(SUBJECT, [...four, ...Array.from({ length: 5 }, () => NOT_IN_DATASET)])).toEqual({
      kind: 'absent',
      text: 'Ingen forklaring av marginen: bare 4 sammenlignbare har alle kostnadslinjene (av 10 som trengs).',
    });
    expect(view(SUBJECT, PEERS.slice(0, 9))).toEqual({
      kind: 'absent',
      text: 'Ingen forklaring av marginen: bare 9 sammenlignbare har alle kostnadslinjene (av 10 som trengs).',
    });
  });

  it('not in kroner: no waterfall', () => {
    expect(view(SUBJECT, PEERS, 'USD')).toEqual({ kind: 'absent', text: nb['keyFigures.notInKroner'] });
  });

  it('outside the demo data', () => {
    expect(view(NOT_IN_DATASET)).toEqual({ kind: 'absent', text: nb['analysis.figures.notInDataset'] });
  });
});

describe('the shown waterfall', () => {
  it('bars carry sign, glyph, word and shares', () => {
    const engine = marginWaterfall(SUBJECT, PEERS, YEAR, 'NOK');
    if (engine.kind !== 'decomposition') throw new Error('a decomposition');
    const v = shown(view());
    expect(v.heading).toBe(nb['keyFigures.foldout.waterfall']);
    // M = (9 × 0,5 mill. + 30 mill.) / 190 mill. = 18,2 %.
    expect(v.tag).toBe(`Mot peer-gruppen samlet: 18,2${NBSP}%, ikke beste fjerdedel`);
    expect(v.sentence).toBe(nb['waterfall.neverAdded']);
    expect(v.start).toMatchObject({ label: 'Peer-gruppen samlet', margin: `margin 18,2${NBSP}%` });
    expect(v.end.margin).toBe(`margin 20,0${NBSP}%`);
    expect(v.steps.map((s) => s.label)).toEqual(['Varekostnad', 'Lønn', 'Andre driftskostnader', 'Avskrivninger og øvrige poster']);
    // Every value as the engine displays it, and start + bars = end.
    const kr = (k: bigint) => (k * 100n).toString();
    expect(v.start.value).toBe(formatKroner(kr(engine.display.startKroner)));
    expect(v.end.value).toBe(formatKroner(kr(engine.display.endKroner)));
    engine.steps.forEach((step, i) => expect(v.steps[i]?.value).toBe(formatSignedKroner(kr(step.kroner))));
    expect(engine.display.startKroner + engine.steps.reduce((a, s) => a + s.kroner, 0n)).toBe(engine.display.endKroner);
    // Geometry, from the displayed kroner: the levels after the start and each bar, on one scale from the lowest
    // level (or 0) to the highest.
    const levels = [engine.display.startKroner];
    for (const step of engine.steps) levels.push((levels[levels.length - 1] ?? 0n) + step.kroner);
    const all = [...levels, engine.display.endKroner, 0n];
    const lo = all.reduce((a, b) => (b < a ? b : a));
    const hi = all.reduce((a, b) => (b > a ? b : a));
    const position = (k: bigint) => new Decimal((k - lo).toString()).div(new Decimal((hi - lo).toString())).toNumber();
    const span = (from: bigint, to: bigint) => ({
      from: Math.min(position(from), position(to)),
      to: Math.max(position(from), position(to)),
      end: position(to),
    });
    expect(v.zero).toBe(position(0n));
    expect(v.start.geometry).toEqual(span(0n, engine.display.startKroner));
    v.steps.forEach((step, i) => expect(step.geometry, step.key).toEqual(span(levels[i] ?? 0n, levels[i + 1] ?? 0n)));
    expect(v.end.geometry).toEqual(span(0n, engine.display.endKroner));
    expect(v.summary).toBe(
      `Fra ${v.start.value} (peer-gruppen samlet) til ${v.end.value}, fire poster, sum ${formatSignedKroner(kr(engine.display.totalKroner))}`,
    );
    const [vare, lonn, andre, residual] = v.steps;
    // Varekostnad 20 % against samlet 16,8 %: lowers the margin; its row is a strength, so the subline says why.
    expect(vare).toMatchObject({ kind: 'unfavourable', glyph: '▼', word: 'høyere enn samlet', shares: `20,0${NBSP}% mot 16,8${NBSP}%`, notMedian: nb['waterfall.notMedian'] });
    expect(lonn).toMatchObject({ kind: 'favourable', glyph: '▲', word: 'lavere enn samlet', notMedian: null });
    expect(andre).toMatchObject({ kind: 'unfavourable', glyph: '▼', word: 'høyere enn samlet', notMedian: null });
    // The residual is slate whatever its sign, and has no row to disagree with. Here its
    // share equals samlet's (5 %), so the bar is exactly 0: no sign, glyph or word.
    expect(residual).toMatchObject({ kind: 'residual', value: `0${NBSP}kr`, glyph: null, word: null, notMedian: null });
    expect(v.legend).toEqual({
      favourable: 'Hever marginen mot samlet',
      unfavourable: 'Senker marginen mot samlet',
      residual: 'Restpost, uten retning',
    });
    // The table: start, four, the sum (Story 3.8), end, reference.
    expect(v.table.caption).toBe(nb['waterfall.table.caption']);
    expect(v.table.heads).toEqual({ post: 'Post', all: 'Samlet', kroner: 'Kroner' });
    expect(v.table.rows.map((r) => r.head)).toEqual([
      'Peer-gruppen samlet',
      'Varekostnad',
      'Lønn',
      'Andre driftskostnader',
      'Avskrivninger og øvrige poster',
      'Sum av postene',
    ]);
    // Each row names its drill-down; the sum is the shown total, signed, with no shares.
    expect(v.table.rows.map((r) => r.key)).toEqual(['start', 'vare', 'lonn', 'andre', 'residual', 'sum']);
    expect(v.table.rows[5]).toEqual({ key: 'sum', head: 'Sum av postene', own: '', all: '', kroner: v.summary.split('sum ')[1], glyph: null, word: null });
    expect(v.table.rows[1]).toMatchObject({ kroner: vare?.value, glyph: '▼', word: 'høyere enn samlet' });
    expect(v.table.rows[0]).toMatchObject({ glyph: null, word: null });
    expect(v.table.end).toEqual({ own: `20,0${NBSP}%`, kroner: v.end.value });
    expect(v.table.reference).toEqual({ head: 'Referanse', text: v.tag });
  });

  it('a favourable bar on a cost-share row worse than the median says so', () => {
    // Nine peers at 10 % andre driftskostnader and one large peer at 40 %: the median is 10 %, samlet 25,8 %.
    const peers = [
      ...Array.from({ length: 9 }, () => company(10_000_000n, 3_000_000n, 5_000_000n, 1_000_000n, 500_000n)),
      company(100_000_000n, 5_000_000n, 30_000_000n, 40_000_000n, 5_000_000n),
    ];
    // The subject's 20 %: worse than the median in its row, lower than samlet in the waterfall.
    const andre = shown(view(company(20_000_000n, 4_000_000n, 8_000_000n, 4_000_000n, 1_000_000n), peers)).steps[2];
    expect(andre).toMatchObject({ key: 'andre', kind: 'favourable', glyph: '▲', word: 'lavere enn samlet' });
    expect(andre?.notMedian).toBe(nb['waterfall.notMedian']);
  });

  it('a residual of either sign stays slate', () => {
    // Peers' avskrivninger 5 %; a subject with 1 % and one with 9 %.
    for (const avskr of [200_000n, 1_800_000n]) {
      const residual = shown(view(company(20_000_000n, 4_000_000n, 8_000_000n, 3_000_000n, avskr))).steps[3];
      expect(residual?.kind).toBe('residual');
      expect(residual?.value).toMatch(avskr < 1_000_000n ? /^\+/ : /^−/);
      expect(residual?.glyph).toBe(avskr < 1_000_000n ? '▲' : '▼');
    }
  });

  it('the waterfall’s margin reads as its row', () => {
    // The API states the same driftsresultat and revenue as the document.
    const api = (revenue: bigint, result: bigint): ApiInputs => ({
      sumDriftsinntekter: revenue,
      driftsresultat: result,
      sumDriftskostnad: null,
      sumEiendeler: 1_000_000_000n,
      sumEgenkapitalGjeld: null,
      sumEgenkapital: 400_000_000n,
      sumGjeld: null,
    });
    const peersApi = Array.from({ length: 10 }, (_, i) => api(1_000_000_000n, BigInt(i) * 10_000_000n));
    const row = (subjectApi: ApiInputs, basis: DocumentBasis) => {
      const table = keyFigureTableView({
        api: benchmarkApiFigures(subjectApi, peersApi, 'NOK'),
        turnover: benchmarkTotalAssetTurnover(subjectApi, peersApi),
        document: benchmarkDocumentFigures(basis, PEERS, 'NOK'),
        waterfall: marginWaterfall(basis, PEERS, YEAR, 'NOK'),
        filingYear: YEAR,
        smaaForetak: true,
      });
      const driftsmargin = table.groups.flatMap((g) => g.rows).find((r) => r.key === 'driftsmargin');
      return { own: driftsmargin?.own.text, waterfall: shown(table.waterfall) };
    };
    const same = row(api(2_000_000_000n, 400_000_000n), SUBJECT);
    expect(same.waterfall.end.margin).toBe(`margin ${same.own}`);
    expect(same.waterfall.table.end.own).toBe(same.own);
  });

  it('on a rounding boundary the waterfall keeps the document’s margin', () => {
    // The document: 4 009 999 kr on 20 mill. kr, 20,049995 % → "20,0 %". The API
    // states 4 010 000 kr, 1 kr apart (within max(5 kr, 0,001 %)): 20,05 % → "20,1 %".
    const document = company(20_000_000n, 4_000_000n, 8_000_000n, 3_000_000n, 990_001n);
    const api: ApiInputs = {
      sumDriftsinntekter: 2_000_000_000n,
      driftsresultat: 401_000_000n,
      sumDriftskostnad: null,
      sumEiendeler: 1_000_000_000n,
      sumEgenkapitalGjeld: null,
      sumEgenkapital: 400_000_000n,
      sumGjeld: null,
    };
    const peersApi = Array.from({ length: 10 }, (_, i) => ({ ...api, driftsresultat: BigInt(i) * 100_000_000n }));
    const table = keyFigureTableView({
      api: benchmarkApiFigures(api, peersApi, 'NOK'),
      turnover: benchmarkTotalAssetTurnover(api, peersApi),
      document: benchmarkDocumentFigures(document, PEERS, 'NOK'),
      waterfall: marginWaterfall(document, PEERS, YEAR, 'NOK'),
      filingYear: YEAR,
      smaaForetak: true,
    });
    const own = table.groups.flatMap((g) => g.rows).find((r) => r.key === 'driftsmargin')?.own.text;
    expect(own).toBe(`20,1${NBSP}%`);
    const w = shown(table.waterfall);
    expect(w.end.margin).toBe(`margin 20,0${NBSP}%`);
    expect(w.end.margin).toBe(`margin ${formatPercent('0.20049995')}`);
  });
});

// The page's pipeline from a parsed URL: the shown group and the waterfall's view.
const keyFigures = (revenue: string, result: string): SubjectKeyFigures => ({
  sum_driftsinntekter_ore: revenue,
  driftsresultat_ore: result,
  sum_driftskostnad_ore: null,
  sum_eiendeler_ore: '200000000',
  sum_egenkapital_gjeld_ore: null,
  sum_egenkapital_ore: '80000000',
  sum_gjeld_ore: null,
});
const POOL = PEERS.map((documentBasis, i) => ({
  orgnr: `9000000${String(i).padStart(2, '0')}`,
  keyFigures: keyFigures('1000000000', String((i + 1) * 10_000_000)),
  documentBasis,
  documentReadAt: new Date('2026-10-21T08:00:00Z'),
}));
const COUNTS = { stage1: 10, stage2: 10, stage3: { legalForm: 10 }, stage4: { businessModel: 10 }, stage5: { classification: 10, flagged: 0 } };
const FUNNEL = { pool: POOL, group: POOL, flagged: [], counts: COUNTS, emptyReason: null };
const FILING = {
  keyFigures: keyFigures('2000000000', '400000000'),
  valuta: 'NOK',
  regnskapsregler: 'regnskapslovenAlminneligRegler',
  smaaForetak: true,
  avviklingsregnskap: false,
  filingYear: YEAR,
  documentBasis: SUBJECT,
};

describe('never scaled by the closable share', () => {
  it('identical at every andel', () => {
    const views = ANDELER.map((andel) => {
      const parsed = parse(`/analyse/999999905/nokkeltall?andel=${andel}`, {
        isCandidate: () => true,
        medianStepExists: () => true,
      });
      if (parsed.kind !== 'analysis') throw new Error('an analysis URL');
      expect(parsed.state.andel).toBe(andel);
      const group = shownGroup(FUNNEL, parsed.state.ekskl, FILING);
      return JSON.stringify(waterfallView({ waterfall: group.waterfall, document: group.documentBenchmark, filingYear: group.filingYear }));
    });
    expect(shown(JSON.parse(views[0] ?? '{}') as WaterfallView).steps).toHaveLength(4);
    for (const v of views) expect(v).toBe(views[0]);
  });
});

/** Every leaf of `value` with its path; geometry is checked as numbers in [0, 1]. */
function leaves(value: unknown, path: string, out: { path: string; value: unknown }[]): void {
  if (path.endsWith('.geometry')) {
    const geometry = value as Record<string, unknown>;
    expect(Object.keys(geometry).sort(), path).toEqual(['end', 'from', 'to']);
    for (const key of ['end', 'from', 'to']) {
      const n = geometry[key];
      expect(typeof n === 'number' && n >= 0 && n <= 1, `${path}.${key}`).toBe(true);
    }
    return;
  }
  if (path === 'view.zero') {
    expect(typeof value === 'number' && value >= 0 && value <= 1, path).toBe(true);
    return;
  }
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    expect(proto === Object.prototype || proto === Array.prototype, `${path} is a plain object`).toBe(true);
    for (const [key, child] of Object.entries(value)) leaves(child, `${path}.${key}`, out);
    return;
  }
  out.push({ path, value });
}

describe('the payload boundary (AD-4)', () => {
  it('waterfall view holds only strings and geometry', () => {
    const cases: readonly WaterfallView[] = [view(), view(FAILED), view(SUBJECT, PEERS.slice(0, 9)), view(SUBJECT, PEERS, 'USD')];
    for (const v of cases) {
      const found: { path: string; value: unknown }[] = [];
      leaves(v, 'view', found);
      for (const { path, value } of found) {
        expect(typeof value === 'string' || value === null, `${path}: ${typeof value}`).toBe(true);
      }
      // No amount in øre of the subject, a peer or the aggregate reaches a string.
      const strings = found.map((leaf) => String(leaf.value)).join('\n');
      for (const ore of ['2000000000', '400000000', '1600000000', '1000000000', '19000000000', '3900000000']) {
        expect(strings).not.toMatch(new RegExp(`(?<!\\d)${ore}(?!\\d)`));
      }
    }
    const engine: MarginWaterfall = marginWaterfall(SUBJECT, PEERS, YEAR, 'NOK');
    if (engine.kind !== 'decomposition') throw new Error('a decomposition');
    // The exact total in øre is a Fraction on the server; the view only writes it in kroner.
    const strings = JSON.stringify(view());
    expect(strings).not.toContain(engine.totalOre.numerator.toString());
  });
});
