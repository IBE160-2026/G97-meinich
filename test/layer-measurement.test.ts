// `pnpm analysis:layers` (Story 5.2): the spec's I/O matrix on synthetic
// labels and synthetic funnel inputs. No stored company, no label file of
// analysis/labelled-set/ and no database is read here; `main` runs on a
// temporary root with its database read replaced.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CompanyFacts,
  type Dependencies,
  type Label,
  type LabelledSubject,
  type Metrics,
  type ModelLetter,
  type PairOutcome,
  type SubjectData,
  assertNoLabelledOrgnr,
  bandDecision,
  decisionApplies,
  subjectSignalCoverage,
  bandRule,
  CLEAN_PATHS,
  gitCommit,
  commonIndustry,
  documentCause,
  layerMetrics,
  main,
  measureLabels,
  measureSubject,
  metricsOf,
  pairKey,
  pairLabel,
  readRevenueModels,
  renderReport,
  reportFile,
  ruleVerdict,
  stageFive,
  widenBand,
} from '../scripts/layer-measurement.ts';
import { Decimal } from '../src/engine/decimal.ts';
import { businessType, BANDS, type BusinessType, type Fingerprint } from '../src/engine/fingerprint.ts';
import { formatPercent, formatPercentagePoints, formatPercentagePointsFine } from '../src/engine/format.ts';
import type { CandidateFiling, FunnelSubject } from '../src/engine/peers.ts';

// ------------------------------------------------------- synthetic world

const KONSULENT: Fingerprint = {
  costOfGoods: { lo: 'low', hi: 'low' },
  personnelCost: { lo: 'mid', hi: 'mid' },
  assetIntensity: { lo: 'low', hi: 'low' },
  inventory: false,
  capitalisedIntangibles: false,
};
const PRODUKT: Fingerprint = { ...KONSULENT, capitalisedIntangibles: true };
/** Cost of goods low–high: konsulent, annet or forhandler, so no type. */
const UNDETERMINED: Fingerprint = { ...KONSULENT, costOfGoods: { lo: 'low', hi: 'high' } };

const COMPARABLE = {
  regnskapstype: 'SELSKAP',
  periodeFra: '2025-01-01',
  periodeTil: '2025-12-31',
  valuta: 'NOK',
  regnskapsregler: 'regnskapslovenKlassifisering',
  smaaForetak: true,
  avviklingsregnskap: false,
} as const;

function funnelOf(orgnr: string, fingerprint: Fingerprint | null, classification: BusinessType | null): FunnelSubject {
  return { ...COMPARABLE, orgnr, naeringskode1: '62.100', filingYear: 2025, sumDriftsinntekter: 100_000_00n, fingerprint, classification };
}

function filing(
  orgnr: string,
  fingerprint: Fingerprint | null,
  classification: BusinessType | null,
  revenue = 100_000_00n,
): CandidateFiling {
  return {
    ...COMPARABLE,
    orgnr,
    naeringskode1: '62.100',
    organisasjonsform: 'AS',
    brregId: BigInt(orgnr),
    filingYear: 2025,
    sumDriftsinntekter: revenue,
    fingerprint,
    classification,
  };
}

function facts(candidate: Pick<CandidateFiling, 'fingerprint' | 'classification'>, over: Partial<CompanyFacts> = {}): CompanyFacts {
  return {
    companyExists: true,
    documentStatus: 'reconciled',
    currentStatus: 'reconciled',
    hasFingerprint: candidate.fingerprint !== null,
    classificationStatus: 'classified',
    classificationType: candidate.classification,
    ...over,
  };
}

// Subject A (blind, informative): konsulent by both signals. Its seven
// candidates, with the label each pair gets:
//   1 both konsulent                 → every layer          ja
//   2 both produkt                   → only L1              nei
//   3 fingerprint yes, text no       → L2, group, flagged   ja
//   4 fingerprint no, text yes       → L3, group, flagged   nei
//   5 no fingerprint, text no        → L2 only (null kept)  nei
//   6 fingerprint yes, uklart        → L2, L3, group        usikker
//   7 ten times the revenue          → outside the pool     ja
const A = '900000000';
const a = (n: number) => `90000000${n}`;
const A_CANDIDATES: CandidateFiling[] = [
  filing(a(1), KONSULENT, 'konsulent'),
  filing(a(2), PRODUKT, 'produkt'),
  filing(a(3), KONSULENT, 'produkt'),
  filing(a(4), PRODUKT, 'konsulent'),
  filing(a(5), null, 'produkt'),
  filing(a(6), KONSULENT, null),
  filing(a(7), KONSULENT, 'konsulent', 1_000_000_00n),
];
const A_LABELS: Label[] = ['ja', 'nei', 'ja', 'nei', 'nei', 'usikker', 'ja'];
const SUBJECT_A: LabelledSubject = {
  orgnr: A,
  filingYear: 2025,
  informative: true,
  blind: true,
  candidates: A_CANDIDATES.map((c) => c.orgnr),
};

function dataA(funnel: FunnelSubject = funnelOf(A, KONSULENT, 'konsulent')): SubjectData {
  const own = new Map<string, CompanyFacts>([[A, facts(funnel)]]);
  for (const c of A_CANDIDATES) own.set(c.orgnr, facts(c));
  // Candidate 5 has no document row; candidate 6's model answered uklart.
  own.set(a(5), facts(A_CANDIDATES[4] as CandidateFiling, { documentStatus: null, currentStatus: null }));
  return { orgnr: A, funnel, candidates: A_CANDIDATES, facts: own };
}

const labelsA = new Map(SUBJECT_A.candidates.map((c, i) => [pairKey(A, c), A_LABELS[i] as Label]));

// Subject B (not blind, uninformative): three konsulent candidates, labelled
// in round 2 through the revenue models k/k, k/p, k/u.
const B = '910000000';
const b = (n: number) => `91000000${n}`;
const B_CANDIDATES = [1, 2, 3].map((n) => filing(b(n), KONSULENT, 'konsulent'));
const SUBJECT_B: LabelledSubject = { orgnr: B, filingYear: 2025, informative: false, blind: false, candidates: B_CANDIDATES.map((c) => c.orgnr) };
const B_MODELS: [string, ModelLetter][] = [[B, 'k'], [b(1), 'k'], [b(2), 'p'], [b(3), 'u']];

function dataB(): SubjectData {
  const funnel = funnelOf(B, KONSULENT, 'konsulent');
  const own = new Map<string, CompanyFacts>([[B, facts(funnel)]]);
  for (const c of B_CANDIDATES) own.set(c.orgnr, facts(c));
  return { orgnr: B, funnel, candidates: B_CANDIDATES, facts: own };
}

/** The database state a report records: synthetic values only. */
const DB_STATE = {
  classificationModels: ['claude-haiku-5-5'],
  promptHashes: ['ab'.repeat(32)],
  subjectSignals: { subjects: 1, fingerprintType: 1, textType: 1, both: 1 },
} as const;

/** Metrics with the given precision and recall (the counts do not enter the rule). */
function m(precision: string, recall: string): Metrics {
  const zero = { ja: 0, nei: 0, usikker: 0 };
  return { included: zero, all: zero, precision: new Decimal(precision), recall: new Decimal(recall), precisionFraction: null, recallFraction: null };
}

/** `n` pairs with one label, each included or not. */
const pairs = (n: number, label: Label, isIncluded: boolean) => Array.from({ length: n }, () => ({ label, included: isIncluded }));

// ------------------------------------------------------------------ tests

it('pair label rule', () => {
  expect(pairLabel('p', 'p')).toBe('ja');
  expect(pairLabel('p', 'k')).toBe('nei');
  expect(pairLabel('i', 'p')).toBe('nei');
  expect(pairLabel('u', 'p')).toBe('usikker');
  expect(pairLabel('u', 'i')).toBe('nei');
  expect(() => readRevenueModels('﻿orgnr;model\r\n900000001;x\r\n', 'models.csv')).toThrow('data row 1 has no model');
});

describe('layer metrics on synthetic labels', () => {
  const outcomes = measureSubject(SUBJECT_A, dataA());
  const byLayer = (include: (o: PairOutcome) => boolean) => metricsOf(outcomes, labelsA, include);
  const frac = (n: number, d: number) => new Decimal(n).div(d);

  it('includes each candidate in the layers worked out by hand', () => {
    const at = (n: number) => outcomes[n - 1] as PairOutcome;
    expect(outcomes.map((o) => o.inPool)).toEqual([true, true, true, true, true, true, false]);
    expect(outcomes.map((o) => o.l2)).toEqual([true, false, true, false, true, true, false]);
    expect(outcomes.map((o) => o.l3)).toEqual([true, false, false, true, false, true, false]);
    expect(outcomes.map((o) => o.group)).toEqual([true, false, true, true, false, true, false]);
    expect(outcomes.map((o) => o.flagged)).toEqual([false, false, true, true, false, false, false]);
    expect(at(1).l2Without.costOfGoods).toBe(true);
  });

  it('gives each layer the precision and recall worked out by hand', () => {
    // all: 3 ja, 3 nei, 1 usikker.
    const l1 = byLayer((o) => o.inPool);
    expect(l1.included).toEqual({ ja: 2, nei: 3, usikker: 1 });
    expect(l1.precision?.eq(frac(2, 5))).toBe(true);
    expect(l1.recall?.eq(frac(2, 3))).toBe(true);
    const l2 = byLayer((o) => o.l2);
    expect(l2.precision?.eq(frac(2, 3))).toBe(true);
    expect(l2.recall?.eq(frac(2, 3))).toBe(true);
    const l3 = byLayer((o) => o.l3);
    expect(l3.precision?.eq(frac(1, 2))).toBe(true);
    expect(l3.recall?.eq(frac(1, 3))).toBe(true);
    const group = byLayer((o) => o.group);
    expect(group.precision?.eq(frac(2, 3))).toBe(true);
    expect(group.recall?.eq(frac(2, 3))).toBe(true);
    const unflagged = byLayer((o) => o.group && !o.flagged);
    expect(unflagged.precision?.eq(1)).toBe(true);
    expect(unflagged.recall?.eq(frac(1, 3))).toBe(true);
    const flagged = byLayer((o) => o.flagged);
    expect(flagged.precision?.eq(frac(1, 2))).toBe(true);
    expect(flagged.recall?.eq(frac(1, 3))).toBe(true);
  });

  it('writes the same figures in the report table', () => {
    const report = renderReport({
      industry: '62.100',
      subjects: [SUBJECT_A],
      outcomes,
      measure: labelsA,
      roundOne: new Map(),
      companies: 8,
      fingerprinted: 7,
      ...DB_STATE,
      generated: '2026-11-15',
      commit: 'c'.repeat(40),
    });
    expect(report).toContain(`| L1 industry code and size (the stage 1–3 pool) | 6 | 2 | 3 | 1 | ${formatPercent('0.4')} | ${formatPercent(frac(2, 3).toString())} |`);
    expect(report).toContain(`| L3 classification alone | 3 | 1 | 1 | 1 | ${formatPercent('0.5')} | ${formatPercent(frac(1, 3).toString())} |`);
  });
});

describe('a null signal is kept and counted', () => {
  it('keeps a candidate without a fingerprint in L2 and an uklart one in L3, each under its cause', () => {
    const outcomes = measureSubject(SUBJECT_A, dataA());
    const five = outcomes[4] as PairOutcome;
    expect(five.l2).toBe(true);
    expect(five.fingerprintNull).toBe('no_fingerprint:document_absent');
    const six = outcomes[5] as PairOutcome;
    expect(six.l3).toBe(true);
    expect(six.textNull).toBe('uklart');
    expect(outcomes.filter((o) => o.fingerprintNull === null && o.inPool)).toHaveLength(5);
  });

  it('keeps every pair of a subject without a type, counted as such', () => {
    const outcomes = measureSubject(SUBJECT_A, dataA(funnelOf(A, UNDETERMINED, null)));
    const inPool = outcomes.filter((o) => o.inPool);
    expect(inPool.every((o) => o.l2 && o.l3 && o.group)).toBe(true);
    expect(inPool.every((o) => o.fingerprintNull === 'subject_no_type' && o.textNull === 'subject_no_type')).toBe(true);
  });

  it('counts an undetermined candidate fingerprint apart', () => {
    const data = dataA();
    const candidates = data.candidates.map((c) => (c.orgnr === a(2) ? { ...c, fingerprint: UNDETERMINED } : c));
    const outcomes = measureSubject(SUBJECT_A, { ...data, candidates });
    expect(outcomes[1]?.fingerprintNull).toBe('undetermined');
    expect(outcomes[1]?.l2).toBe(true);
  });

  it('names why a fingerprint is missing from the stored document', () => {
    const base = facts({ fingerprint: null, classification: null });
    expect(documentCause({ ...base, companyExists: false })).toBe('document_absent');
    expect(documentCause({ ...base, documentStatus: 'not_extracted', currentStatus: null })).toBe('document_refused');
    expect(documentCause({ ...base, documentStatus: 'paper', currentStatus: null })).toBe('document_paper');
    expect(documentCause({ ...base, documentStatus: 'reconciled', currentStatus: 'failed_reconciliation' })).toBe('document_failed');
    expect(documentCause({ ...base, documentStatus: 'failed_reconciliation', currentStatus: null })).toBe('document_failed');
    expect(documentCause({ ...base, documentStatus: 'extracted', currentStatus: null })).toBe('document_not_reconciled');
    expect(documentCause(base)).toBe('reconciled_not_derived');
  });

  it('refuses a document or column status outside the known set', () => {
    const base = facts({ fingerprint: null, classification: null });
    expect(() => documentCause({ ...base, documentStatus: 'scanned' })).toThrow('unknown document status "scanned"');
    expect(() => documentCause({ ...base, currentStatus: 'extracted' })).toThrow('unknown document column status "extracted"');
  });

  it('prints the cause counts in the report', () => {
    const report = renderReport({
      industry: '62.100',
      subjects: [SUBJECT_A],
      outcomes: measureSubject(SUBJECT_A, dataA()),
      measure: labelsA,
      roundOne: new Map(),
      companies: 8,
      fingerprinted: 7,
      ...DB_STATE,
      generated: '2026-11-15',
      commit: 'c'.repeat(40),
    });
    expect(report).toContain('| `no_fingerprint:document_absent` | 1 |');
    expect(report).toContain('| `uklart` | 1 |');
  });
});

it('usikker left out, and both sensitivities', () => {
  const list = [...pairs(1, 'ja', true), ...pairs(1, 'nei', true), ...pairs(1, 'usikker', true), ...pairs(1, 'usikker', false), ...pairs(1, 'ja', false)];
  const out = layerMetrics(list);
  expect(out.included).toEqual({ ja: 1, nei: 1, usikker: 1 });
  expect(out.precision?.eq(new Decimal(1).div(2))).toBe(true);
  expect(out.recall?.eq(new Decimal(1).div(2))).toBe(true);
  const asJa = layerMetrics(list, 'ja');
  expect(asJa.precision?.eq(new Decimal(2).div(3))).toBe(true);
  expect(asJa.recall?.eq(new Decimal(2).div(4))).toBe(true);
  const asNei = layerMetrics(list, 'nei');
  expect(asNei.precision?.eq(new Decimal(1).div(3))).toBe(true);
  expect(asNei.recall?.eq(new Decimal(1).div(2))).toBe(true);
});

it('stage-5 rule is inclusive at 3 pp', () => {
  const fingerprintAlone = m('0.25', '0.50');
  expect(ruleVerdict(fingerprintAlone, m('0.28', '0.47')).kind).toBe('kept');
  expect(ruleVerdict(fingerprintAlone, m('0.279', '0.47')).kind).toBe('not_kept');
  expect(ruleVerdict(fingerprintAlone, m('0.28', '0.469')).kind).toBe('not_kept');
  const verdict = ruleVerdict(fingerprintAlone, m('0.28', '0.47'));
  expect(verdict.precisionDelta?.eq('0.03')).toBe(true);
  expect(verdict.recallDelta?.eq('-0.03')).toBe(true);
});

it('rule bounds compare in Decimal', () => {
  // Precision 26/100 → 29/100: exactly +3 pp, which floats put below it.
  expect(29 / 100 - 26 / 100).toBeLessThan(0.03);
  const before = layerMetrics([...pairs(26, 'ja', true), ...pairs(74, 'nei', true), ...pairs(74, 'ja', false)]);
  const after = layerMetrics([...pairs(29, 'ja', true), ...pairs(71, 'nei', true), ...pairs(71, 'ja', false)]);
  expect(ruleVerdict(before, after).kind).toBe('kept');
  // Recall 14/100 → 11/100: exactly −3 pp, which floats put below it.
  expect(11 / 100 - 14 / 100).toBeLessThan(-0.03);
  const recallBefore = layerMetrics([...pairs(14, 'ja', true), ...pairs(86, 'nei', true), ...pairs(86, 'ja', false)]);
  const recallAfter = layerMetrics([...pairs(11, 'ja', true), ...pairs(20, 'nei', true), ...pairs(89, 'ja', false)]);
  expect(ruleVerdict(recallBefore, recallAfter).kind).toBe('kept');
});

it('widens one band only', () => {
  const mid: Fingerprint = { ...KONSULENT, costOfGoods: { lo: 'mid', hi: 'mid' }, inventory: true };
  const out = widenBand(mid, 'costOfGoods');
  expect(out).toEqual({ ...mid, costOfGoods: { lo: 'low', hi: 'high' } });
  expect(mid.costOfGoods).toEqual({ lo: 'mid', hi: 'mid' });
  expect(widenBand(mid, 'personnelCost')).toEqual({ ...mid, personnelCost: { lo: 'low', hi: 'high' } });
  // A type that rested on the band becomes undetermined, so a candidate
  // L2 removed with the band is kept without it.
  const forhandler = filing(a(1), mid, null);
  // A produkt subject keeps its type when personnel cost is widened, and
  // loses it when cost of goods is (high would make it forhandler).
  const outcomes = measureSubject({ ...SUBJECT_A, candidates: [a(1)] }, {
    ...dataA(funnelOf(A, PRODUKT, null)),
    candidates: [forhandler],
  });
  expect(outcomes[0]?.l2).toBe(false);
  expect(outcomes[0]?.l2Without.costOfGoods).toBe(true);
  expect(outcomes[0]?.l2Without.personnelCost).toBe(false);
});

it('band rule on L2 at 3 pp', () => {
  // Each pair: label, in L2 with the band, in L2 without it.
  const build = (spec: [number, Label, boolean, boolean][]) => {
    const outcomes: PairOutcome[] = [];
    const labels = new Map<string, Label>();
    let n = 0;
    for (const [count, label, withBand, without] of spec) {
      for (let i = 0; i < count; i += 1) {
        n += 1;
        const candidate = String(800000000 + n);
        labels.set(pairKey(A, candidate), label);
        outcomes.push({
          subject: A, candidate, informative: true, blind: false, inPool: true,
          l2: withBand, l3: true, group: true, flagged: false, fingerprintNull: null, textNull: null,
          l2Without: { costOfGoods: without, personnelCost: true },
          l2WithoutNull: { costOfGoods: false, personnelCost: false },
        });
      }
    }
    return { outcomes, labels };
  };
  // Without: 25 ja + 75 nei of 100 ja (p 25 %, r 25 %); with: 28 ja + 72 nei (p 28 %, r 28 %).
  const atBound = build([[25, 'ja', true, true], [3, 'ja', true, false], [72, 'nei', true, true], [3, 'nei', false, true], [72, 'ja', false, false]]);
  expect(bandRule(atBound.outcomes, atBound.labels, 'costOfGoods').verdict.kind).toBe('kept');
  // With: 28 ja + 73 nei: precision +2.7 pp, dropped.
  const below = build([[25, 'ja', true, true], [3, 'ja', true, false], [73, 'nei', true, true], [2, 'nei', false, true], [72, 'ja', false, false]]);
  expect(bandRule(below.outcomes, below.labels, 'costOfGoods').verdict.kind).toBe('not_kept');
  // Without: 50 ja + 150 nei of 100 ja; with: 47 ja + 100 nei: recall −3.0 pp exactly, kept; 46 ja: dropped.
  const recall = (kept: number) =>
    build([[kept, 'ja', true, true], [50 - kept, 'ja', false, true], [100, 'nei', true, true], [50, 'nei', false, true], [50, 'ja', false, false]]);
  expect(bandRule(recall(47).outcomes, recall(47).labels, 'costOfGoods').verdict.kind).toBe('kept');
  expect(bandRule(recall(46).outcomes, recall(46).labels, 'costOfGoods').verdict.kind).toBe('not_kept');
});

describe('precision is undefined without ja or nei', () => {
  it('gives no precision, never 0, when the included pairs are all usikker, and no recall without a ja', () => {
    const out = layerMetrics([...pairs(2, 'usikker', true), ...pairs(1, 'nei', false)]);
    expect(out.precision).toBeNull();
    expect(out.recall).toBeNull();
    expect(ruleVerdict(out, out).kind).toBe('undecidable');
  });

  it('writes "ikke definert" in the report', () => {
    // Every pair usikker: no layer has a ja or nei.
    const allUsikker = new Map([...labelsA.keys()].map((key) => [key, 'usikker' as Label]));
    const outcomes = measureSubject(SUBJECT_A, dataA());
    const report = renderReport({
      industry: '62.100',
      subjects: [SUBJECT_A], outcomes, measure: allUsikker, roundOne: new Map(),
      companies: 8, fingerprinted: 7, ...DB_STATE, generated: '2026-11-15', commit: 'c'.repeat(40),
    });
    expect(report).toContain('| L2 fingerprint alone | 4 | 0 | 0 | 4 | ikke definert | ikke definert |');
    expect(stageFive(outcomes, allUsikker).verdict.kind).toBe('undecidable');
    expect(report).toContain('**Verdict: not decidable: a precision or recall is ikke definert.**');
  });
});

it('a labelled candidate outside the pool is counted', () => {
  const outcomes = measureSubject(SUBJECT_A, dataA());
  const seven = outcomes[6] as PairOutcome;
  expect(seven.inPool).toBe(false);
  expect([seven.l2, seven.l3, seven.group, seven.flagged]).toEqual([false, false, false, false]);
  expect(outcomes).toHaveLength(7);
  const report = renderReport({
    industry: '62.100',
    subjects: [SUBJECT_A], outcomes, measure: labelsA, roundOne: new Map(),
    companies: 8, fingerprinted: 7, ...DB_STATE, generated: '2026-11-15', commit: 'c'.repeat(40),
  });
  expect(report).toContain("Labelled candidates not in today's pool: 1 of 7.");
});

describe('label files', () => {
  const models = new Map(B_MODELS);
  const blind = labelsA;

  it('computes the round-2 pairs from the revenue models', () => {
    const measure = measureLabels([SUBJECT_A, SUBJECT_B], blind, models);
    expect(measure.size).toBe(10);
    expect([1, 2, 3].map((n) => measure.get(pairKey(B, b(n))))).toEqual(['ja', 'nei', 'usikker']);
  });

  it('refuses a blind sheet or a model list that does not cover the draw exactly', () => {
    const short = new Map([...blind].slice(1));
    expect(() => measureLabels([SUBJECT_A, SUBJECT_B], short, models)).toThrow('1 pairs of the draw missing');
    const extra = new Map([...models, ['999999999', 'p' as ModelLetter]]);
    expect(() => measureLabels([SUBJECT_A, SUBJECT_B], blind, extra)).toThrow('1 not in the draw');
  });
});

describe('the industry', () => {
  it('is the one the labelled subjects share, never a literal in the script', () => {
    expect(commonIndustry([dataA(), dataB()])).toBe('62.100');
    const other = { funnel: { ...funnelOf(B, KONSULENT, null), naeringskode1: '62.200' } };
    expect(() => commonIndustry([dataA(), other])).toThrow('do not share one primary industry');
    expect(reportFile('62.100')).toBe('analysis/output/layer-measurement-62100.md');
  });
});

// ------------------------------------------------- the deciding display

type Spec = { readonly n: number; readonly label: Label; readonly l2: boolean; readonly group: boolean; readonly l3?: boolean; readonly blind?: boolean };

/** Synthetic outcomes of subject A from counts, and their labels. */
function fromCounts(specs: readonly Spec[]): { outcomes: PairOutcome[]; labels: Map<string, Label> } {
  const outcomes: PairOutcome[] = [];
  const labels = new Map<string, Label>();
  let n = 0;
  for (const spec of specs) {
    for (let i = 0; i < spec.n; i += 1) {
      n += 1;
      const candidate = String(700000000 + n);
      labels.set(pairKey(A, candidate), spec.label);
      outcomes.push({
        subject: A, candidate, informative: true, blind: spec.blind ?? false, inPool: true,
        l2: spec.l2, l3: spec.l3 ?? true, group: spec.group, flagged: false, fingerprintNull: null, textNull: null,
        l2Without: { costOfGoods: true, personnelCost: true },
        l2WithoutNull: { costOfGoods: true, personnelCost: false },
      });
    }
  }
  return { outcomes, labels };
}

// L2: 154 ja, 267 nei; group: 157 ja, 240 nei; 211 ja in all. Precision
// +2,967 pp (157/397 − 154/421), recall +1,422 pp (157/211 − 154/211).
const NEAR_BOUND: Spec[] = [
  { n: 154, label: 'ja', l2: true, group: true, l3: true },
  { n: 3, label: 'ja', l2: false, group: true, l3: false },
  { n: 54, label: 'ja', l2: false, group: false, l3: false },
  { n: 240, label: 'nei', l2: true, group: true, l3: false },
  { n: 27, label: 'nei', l2: true, group: false, l3: false },
];

function reportOf(outcomes: readonly PairOutcome[], labels: ReadonlyMap<string, Label>): string {
  return renderReport({
    industry: '62.100', subjects: [SUBJECT_A], outcomes, measure: labels, roundOne: new Map(),
    companies: 8, fingerprinted: 7, ...DB_STATE, generated: '2026-11-15', commit: 'c'.repeat(40),
  });
}

describe('the deciding differences', () => {
  const { outcomes, labels } = fromCounts(NEAR_BOUND);
  const report = reportOf(outcomes, labels);

  it('shows each deciding difference to three decimals with the exact fractions behind both values', () => {
    expect(report).toContain(`| Fingerprint alone (L2) | ${formatPercent(new Decimal(154).div(421).toString())} (154/421) | ${formatPercent(new Decimal(154).div(211).toString())} (154/211) |`);
    expect(report).toContain('| Difference | +2,967 pp (157/397 − 154/421) | +1,422 pp (157/211 − 154/211) |');
    expect(report).toContain('A difference of +2,967 pp shows as +3,0 pp at one decimal; the rule compares the exact value.');
    expect(report).toContain('**Verdict: stage 5 is not kept.**');
  });

  it('shows the band differences the same way, with − without', () => {
    // Without the cost-of-goods band every pair is in L2: 211 ja, 267 nei.
    expect(report).toContain('| L2 without the band | ');
    expect(report).toMatch(/\| Difference \(with − without\) \| [+−]\d+,\d{3}\u00a0pp \(154\/421 − 211\/478\) \| −27,014\u00a0pp \(154\/211 − 211\/211\) \|/);
  });

  it('keeps the layer tables at one decimal', () => {
    expect(report).toContain(`| L2 fingerprint alone | 421 | 154 | 267 | 0 | ${formatPercent(new Decimal(154).div(421).toString())} | ${formatPercent(new Decimal(154).div(211).toString())} |`);
  });

  it('states that L3 had the highest precision only when it had', () => {
    expect(report).toContain('L3, the classification alone, has the highest precision of the layers');
    const lower = fromCounts(NEAR_BOUND.map((spec) => ({ ...spec, l3: spec.label === 'nei' || spec.l3 === true })));
    expect(reportOf(lower.outcomes, lower.labels)).not.toContain('has the highest precision');
  });
});

describe('the rules on the blind pairs alone', () => {
  it('applies stage 5 and both band rules to the blind pairs only, deciding nothing', () => {
    const { outcomes, labels } = fromCounts([
      ...NEAR_BOUND,
      { n: 20, label: 'nei', l2: true, group: false },
      { n: 10, label: 'ja', l2: true, group: true, blind: true },
      { n: 10, label: 'nei', l2: true, group: true, blind: true },
    ]);
    const report = reportOf(outcomes, labels);
    expect(report).toContain('## The rules on the blind pairs alone (informational)');
    expect(report).toContain('The 20 blind pairs');
    expect(report).toContain('| Difference | 0,000 pp (10/20 − 10/20) | 0,000 pp (10/10 − 10/10) |');
    expect(report).toContain('Stage-5 rule on these pairs: stage 5 is not kept.');
    expect(report).toContain('**Verdict: stage 5 is kept.**');
    expect(report.match(/Band rule on these pairs: /g)).toHaveLength(2);
  });
});

const pct = (n: number, d: number) => formatPercent(new Decimal(n).div(d).toString());
const pp = (value: Decimal) => formatPercentagePoints(value.toString());
const ppFine = (value: Decimal) => formatPercentagePointsFine(value.toString());

describe("Meinich's band decision", () => {
  // NEAR_BOUND plus blind pairs: stage 5 not kept, both bands dropped, the
  // verdicts the decisions were made on.
  const decided = fromCounts([
    ...NEAR_BOUND,
    { n: 10, label: 'ja', l2: true, group: true, blind: true },
    { n: 30, label: 'nei', l2: true, group: true, blind: true },
    { n: 5, label: 'ja', l2: false, group: false, blind: true },
  ]);

  it('gives the order of the decisions with the all-pairs and blind figures from the computation', () => {
    const { outcomes, labels } = decided;
    expect(decisionApplies(outcomes, labels)).toBe(true);
    const text = bandDecision(outcomes, labels).join(' ');
    // 1: L2 164/461 against group 167/437; recall 164/226 against 167/226.
    const fivePrecision = new Decimal(167).div(437).minus(new Decimal(164).div(461));
    const fiveRecall = new Decimal(167).div(226).minus(new Decimal(164).div(226));
    expect(text).toContain(`1. **Stage 5 off, by the rule** fixed before the run (L2 against \`group\`: ${ppFine(fivePrecision)} precision, ${ppFine(fiveRecall)} recall).`);
    // 2: all pairs, cost-of-goods band with (L2, 164/461) against without (every pair, 226/523).
    expect(text).toContain(`from the rule on all pairs (cost-of-goods band, with against without: ${pct(164, 461)} against ${pct(226, 523)} precision, ${pp(new Decimal(164).div(226).minus(1))} recall)`);
    // and the blind pairs: with 10/40, without 15/45; recall 10/15 against 1.
    expect(text).toContain(`and the blind pairs (${pct(10, 40)} against ${pct(15, 45)} precision, ${pp(new Decimal(10).div(15).minus(1))} recall)`);
    // 3: text against L1: L3 (169 ja, 30 nei) against L1 (226 ja, 297 nei).
    expect(text).toContain('3. **Text against L1 reported, not used.** It would not pass the same bounds');
    expect(text).toContain('question 26 fixes text against L1 before the next measurement.');
    expect(text).toContain("v1's group is therefore the stage 1–3 pool.");
    const report = reportOf(outcomes, labels);
    expect(report).toContain('### The decision');
    expect(report).toContain('the fingerprint signal is switched off in v1, like the text signal, instead of dropping the bands with a migration');
  });

  it('says the decision is pending when the verdicts are not the ones it was made on', () => {
    // Stage 5 kept on these pairs (see "the rules on the blind pairs alone").
    const { outcomes, labels } = fromCounts([
      ...NEAR_BOUND,
      { n: 20, label: 'nei', l2: true, group: false },
      { n: 10, label: 'ja', l2: true, group: true, blind: true },
      { n: 10, label: 'nei', l2: true, group: true, blind: true },
    ]);
    expect(stageFive(outcomes, labels).verdict.kind).toBe('kept');
    expect(decisionApplies(outcomes, labels)).toBe(false);
    expect(bandDecision(outcomes, labels)).toEqual([
      '### The decision',
      '',
      'A decision on these verdicts is pending. The decisions recorded on 2026-11-15 were made on stage 5 not kept and both bands dropped, and the verdicts above differ.',
    ]);
    const report = reportOf(outcomes, labels);
    expect(report).toContain('A decision on these verdicts is pending.');
    expect(report).not.toContain('Stage 5 off, by the rule');
    expect(report).not.toContain('instead of dropping the bands with a migration');
  });

  it('says how the layers are read: both signals as built, v1 the pool, the two stages named apart', () => {
    const report = reportOf(decided.outcomes, decided.labels);
    expect(report).toContain('with both signals on: stage 4 and stage 5 as built, which is what is measured.');
    expect(report).toContain("so v1's group is the stage 1–3 pool (L1).");
    expect(report).toContain('- **L2+L3** is `group`, the funnel as built (both signals on): `assemblePeerGroup` is called with the measured options (`MEASURED`).');
    expect(report).not.toContain('the funnel as the app runs it');
    expect(report).toContain("no Cohen's κ in v1 (project stage 2)");
    expect(report).toContain('The size band and funnel stage 2 cannot be judged');
    expect(report.match(/(?<!funnel|project) stage 2/g)).toBeNull();
  });
});

describe('the noise and the text against L1', () => {
  const { outcomes, labels } = fromCounts(NEAR_BOUND);
  const report = reportOf(outcomes, labels);

  it('says after the stage-5 verdict that it sits within the noise, with the pairs and subjects it rests on', () => {
    // L2 or group, ja or nei: 157 ja and 267 nei, all from subject A.
    expect(report).toContain('The verdict sits within the noise (424 decided pairs in L2 or `group`, from 1 clustered subject), and the rule decides it by construction.');
    expect(report.indexOf('The verdict sits within the noise')).toBeGreaterThan(report.indexOf('**Verdict: stage 5 is not kept.**'));
  });

  it('compares L3 with L1 by the same bounds, with fractions, and decides nothing', () => {
    expect(report).toContain('## The text against L1 (informational)');
    expect(report).toContain('This comparison was not fixed before the run, so it decides nothing, and its differences lie within the noise (478 decided pairs in the pool, from 1 clustered subject).');
    expect(report).toContain(`| Difference | ${ppFine(new Decimal(1).minus(new Decimal(211).div(478)))} (154/154 − 211/478) | ${ppFine(new Decimal(154).div(211).minus(1))} (154/211 − 211/211) |`);
    expect(report).toContain('By the same bounds, the text against L1 would not pass.');
  });
});

describe('subject-level signal coverage', () => {
  it('counts the subjects with a fingerprint type, a text type and both', () => {
    const coverage = subjectSignalCoverage([
      dataA(),
      dataB(),
      { funnel: funnelOf('920000000', UNDETERMINED, null) },
      { funnel: funnelOf('930000000', null, 'produkt') },
      { funnel: funnelOf('940000000', KONSULENT, null) },
    ]);
    expect(coverage).toEqual({ subjects: 5, fingerprintType: 3, textType: 3, both: 2 });
  });

  it('states the coverage and what it means for the verdicts', () => {
    const report = reportOf(fromCounts(NEAR_BOUND).outcomes, fromCounts(NEAR_BOUND).labels);
    expect(report).toContain('Subjects with a type of their own: 1 of 1 on the fingerprint, 1 on the text, 1 on both.');
    expect(report).toContain('the verdicts rest on few subjects.');
  });
});

describe('round 1: the rules as information', () => {
  it('gives the stage-5, band and text-against-L1 verdicts and the two base rates', () => {
    const { outcomes, labels } = fromCounts(NEAR_BOUND);
    // The stricter reading: the 54 ja outside L3 read as nei (the same pairs, keyed alike).
    const roundOne = fromCounts(NEAR_BOUND.map((spec) => (spec.n === 54 ? { ...spec, label: 'nei' as const } : spec))).labels;
    const report = renderReport({
      industry: '62.100', subjects: [SUBJECT_A], outcomes, measure: labels, roundOne,
      companies: 8, fingerprinted: 7, ...DB_STATE, generated: '2026-11-15', commit: 'c'.repeat(40),
    });
    const round1 = report.slice(report.indexOf('## Round 1: den strengere lesningen'));
    expect(round1).toContain('### The rules on this reading (informational)');
    expect(round1).toContain('| Stage 5 (L2 against `group`) | stage 5 is not kept | ');
    // With the band 154/421 against 157/478 without it: kept on this reading.
    expect(round1).toContain('| Cost of goods share band | kept | ');
    // L3 154/154 against L1 157/478; recall 154/157: within the bounds on this reading.
    expect(round1).toContain(
      `| Text against L1 | would pass | ${ppFine(new Decimal(1).minus(new Decimal(157).div(478)))} (154/154 − 157/478) | ${ppFine(new Decimal(154).div(157).minus(1))} (154/157 − 157/157) |`,
    );
    expect(round1).toContain(`The base rate (L1 precision) is ${pct(211, 478)} in the measure and ${pct(157, 478)} in this reading.`);
    expect(round1).toContain('differ in how strictly "same main revenue model" was read');
  });
});

describe('the verdicts with usikker counted', () => {
  it('gives each verdict with usikker as ja and as nei, and whether it changes', () => {
    const { outcomes, labels } = fromCounts([...NEAR_BOUND, { n: 30, label: 'usikker', l2: false, group: true }]);
    const report = reportOf(outcomes, labels);
    expect(stageFive(outcomes, labels, 'ja').verdict.kind).toBe('kept');
    expect(stageFive(outcomes, labels, 'nei').verdict.kind).toBe('not_kept');
    expect(report).toContain('| Stage 5 | stage 5 is not kept | stage 5 is kept (changes) | stage 5 is not kept (same) |');
    expect(report).toContain('| Cost of goods share band | dropped | dropped (same) | dropped (same) |');
  });
});

describe('without the band', () => {
  it('leaves every type undetermined when cost of goods is widened', () => {
    for (const costOfGoods of BANDS) {
      for (const capitalisedIntangibles of [true, false, null]) {
        const fingerprint: Fingerprint = { ...KONSULENT, costOfGoods: { lo: costOfGoods, hi: costOfGoods }, capitalisedIntangibles };
        expect(businessType(widenBand(fingerprint, 'costOfGoods'))).toBeNull();
      }
    }
  });

  it('counts the pairs whose fingerprint signal is null without each band, and says what that means', () => {
    const outcomes = measureSubject(SUBJECT_A, dataA(funnelOf(A, PRODUKT, 'konsulent')));
    const inPool = outcomes.filter((o) => o.inPool);
    expect(inPool.map((o) => o.l2WithoutNull.costOfGoods)).toEqual([true, true, true, true, true, true]);
    // Personnel widened: produkt stays produkt; konsulent and no fingerprint are null.
    expect(inPool.map((o) => o.l2WithoutNull.personnelCost)).toEqual([true, false, true, false, true, true]);
    // A konsulent subject is itself undetermined with personnel widened, so every pair is null.
    const konsulentSubject = measureSubject(SUBJECT_A, dataA()).filter((o) => o.inPool);
    expect(konsulentSubject.every((o) => o.l2WithoutNull.personnelCost)).toBe(true);

    const report = reportOf(outcomes, labelsA);
    const bands = report.slice(report.indexOf('## The bands (FR-13)'), report.indexOf('## The rules on the blind pairs alone'));
    const costOfGoods = bands.slice(bands.indexOf('### Cost of goods share band'), bands.indexOf('### Personnel cost share band'));
    const personnel = bands.slice(bands.indexOf('### Personnel cost share band'));
    expect(costOfGoods).toContain('In practice "without the band" here became "without the fingerprint".');
    expect(costOfGoods).toContain('Without the band the fingerprint signal is null for 6 of 6 pairs in the pool, against 1 with it.');
    expect(personnel).not.toContain('here became');
    expect(personnel).toContain('Without the band the fingerprint signal is null for 4 of 6 pairs in the pool, against 1 with it.');
  });
});

// ------------------------------------------------------- main, end to end

const csv = (rows: string[][]) => `﻿${rows.map((r) => r.join(';')).join('\r\n')}\r\n`;
const PAIR_HEAD = ['subject_orgnr', 'candidate_orgnr', 'label', 'labelled_by', 'labelled_on', 'notes'];

function syntheticRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'layer-measurement-'));
  mkdirSync(path.join(root, 'analysis', 'labelled-set'), { recursive: true });
  mkdirSync(path.join(root, 'analysis', 'output'), { recursive: true });
  const write = (file: string, text: string) => writeFileSync(path.join(root, 'analysis', 'labelled-set', file), text);
  mkdirSync(path.join(root, 'seed'), { recursive: true });
  writeFileSync(path.join(root, 'seed', 'coverage.json'), '[{"code": "62.100", "measured": false}]');
  write('drawn.json', JSON.stringify({ seed: 1, subjects: [SUBJECT_A, SUBJECT_B] }));
  write('labels-blind.csv', csv([PAIR_HEAD, ...SUBJECT_A.candidates.map((c, i) => [A, c, A_LABELS[i] as string, 'x', '2026-11-01', ''])]));
  write('labels.csv', csv([PAIR_HEAD, ...SUBJECT_B.candidates.map((c, i) => [B, c, i === 0 ? 'ja' : 'nei', 'x', '2026-11-08', ''])]));
  write('labels-revenue-model.csv', csv([['orgnr', 'navn', 'beskrivelse', 'hjemmeside', 'model', 'notes'], ...B_MODELS.map(([o, l]) => [o, '', '', '', l, ''])]));
  return root;
}

describe('main on synthetic files', () => {
  let root: string;
  let stderr: string[];
  let stdout: string[];
  beforeEach(() => {
    root = syntheticRoot();
    stderr = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
    stdout = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout.push(String(chunk));
      return true;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  const deps = (fingerprinted: number): Dependencies => ({
    load: async () => ({ companies: 12, fingerprinted, subjects: [dataA(), dataB()], ...DB_STATE }),
    commit: () => 'c'.repeat(40),
    today: () => '2026-11-15',
  });

  it('the report names no labelled company', async () => {
    expect(await main(root, deps(11))).toBe(0);
    const report = readFileSync(path.join(root, ...reportFile('62.100').split('/')), 'utf8');
    expect(report).toContain('Generated 2026-11-15 by `scripts/layer-measurement.ts` (`pnpm analysis:layers`) at commit `cccc');
    expect(report).toContain('## Round 1: den strengere lesningen');
    // Triage 12: the database state the report rests on, as values only.
    expect(report).toContain(`Database state read: 11 fingerprints; classifications by model \`claude-haiku-5-5\` with prompt hash \`${'ab'.repeat(32)}\`.`);
    for (const orgnr of [SUBJECT_A, SUBJECT_B].flatMap((s) => [s.orgnr, ...s.candidates])) {
      expect(report.includes(orgnr), orgnr).toBe(false);
    }
    expect(() => assertNoLabelledOrgnr(`a table row naming ${a(3)}`, [SUBJECT_A])).toThrow('holds 1 labelled orgnr');
    expect(() => assertNoLabelledOrgnr('totals only', [SUBJECT_A])).not.toThrow();
  });

  // The v1 funnel switches the text signal off (Story 5.2, stage 5 not
  // kept); the measurement keeps stage 5 as built. Its report on these
  // synthetic files is held byte for byte, so a change of the funnel's
  // default cannot move it.
  it('writes the same report whatever the v1 funnel switches off', async () => {
    expect(await main(root, deps(11))).toBe(0);
    const report = readFileSync(path.join(root, ...reportFile('62.100').split('/')), 'utf8');
    await expect(report).toMatchFileSnapshot('./fixtures/layer-measurement/synthetic-report.md');
  });

  // Triage 14: the checksum seed/coverage.json must carry, so a rerun cannot leave it stale unnoticed.
  it('prints the new report\'s sha256', async () => {
    expect(await main(root, deps(11))).toBe(0);
    const bytes = readFileSync(path.join(root, ...reportFile('62.100').split('/')));
    const sha = createHash('sha256').update(bytes).digest('hex');
    expect(stdout.join('')).toContain(`analysis:layers: sha256 ${sha} analysis/output/layer-measurement-62100.md\n`);
  });

  it('refuses an industry seed/coverage.json does not declare', async () => {
    writeFileSync(path.join(root, 'seed', 'coverage.json'), '[{"code": "62.200", "measured": false}]');
    expect(await main(root, deps(11))).toBe(1);
    expect(stderr.join('')).toContain('industry 62.100 is not declared in seed/coverage.json');
  });

  it('refuses without the document dump', async () => {
    expect(await main(root, deps(0))).toBe(1);
    expect(stderr.join('')).toContain('none of the 12 labelled companies has a fingerprint: the document dump is not restored');
    expect(stderr.join('')).toContain('pnpm restore:documents');
    expect(existsSync(path.join(root, ...reportFile('62.100').split('/')))).toBe(false);
  });
});

// The report names the commit that wrote it (triage 12): a run with
// uncommitted changes in the code, the labels or the coverage refuses.
describe('gitCommit', () => {
  let repo: string;
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.autocrlf=false', ...args], { cwd: repo, encoding: 'utf8' });
  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'layer-git-'));
    git('init', '-q');
    mkdirSync(path.join(repo, 'scripts'));
    mkdirSync(path.join(repo, 'seed'));
    writeFileSync(path.join(repo, 'scripts', 'a.ts'), 'a');
    writeFileSync(path.join(repo, 'seed', 'coverage.json'), '[]');
    writeFileSync(path.join(repo, 'other.md'), 'x');
    git('add', '.');
    git('commit', '-q', '-m', 'one');
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('names HEAD when the checked paths are clean, whatever else changed', () => {
    writeFileSync(path.join(repo, 'other.md'), 'changed');
    expect(gitCommit(repo)).toBe(git('rev-parse', 'HEAD').trim());
    expect(CLEAN_PATHS).toContain('seed/coverage.json');
  });

  it.each([
    ['a changed script', 'scripts/a.ts'],
    ['a changed coverage file', 'seed/coverage.json'],
    ['an untracked file under src', 'src/new.ts'],
  ])('refuses %s', (_label, file) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), 'changed');
    expect(() => gitCommit(repo)).toThrow('have uncommitted changes; commit them first');
  });
});
