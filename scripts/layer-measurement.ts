// `pnpm analysis:layers` (Story 5.2, issue #64; FR-3, FR-13, NFR23, NFR24,
// NFR32): how much each funnel layer adds against the labelled set
// (analysis/labelled-set/, Story 5.1), whether stage 5 is kept by the rule
// fixed in the PRD (§9), and what the fingerprint layer does with and
// without each banded cost share. The definitions are the spec's
// (_bmad-output/implementation-artifacts/spec-5-2-layer-by-layer-measurement.md,
// "Definitions"), fixed before the first run on the real labels.
//
// - The labels: the 180 blind pairs (labels-blind.csv) and the 720 round-2
//   pairs, each computed from labels-revenue-model.csv by the README rule
//   (`pairLabel`): 900 pairs, the measure. Round 1 (labels.csv) is reported
//   as "den strengere lesningen" and decides nothing.
// - The groups: each subject is read as the analysis page reads it
//   (scripts/layer-measurement-compute.ts) and assembled by
//   `assemblePeerGroup(…, 0, MEASURED)` from src/engine/peers.ts: both
//   signals on, stages 4 and 5 as built, although the v1 funnel switches
//   both off (V1_TEXT_SIGNAL, V1_FINGERPRINT_SIGNAL, after this
//   measurement). L2 (the
//   fingerprint alone) is that funnel with the subject's classification
//   switched off, L3 (the text alone) with its fingerprint switched off; a
//   missing subject signal is missing for every candidate (peers.ts), so
//   this is exactly "the signal is not false". The bands are left out by
//   widening one category to low–high in memory (`widenBand`).
// - Precision and recall are exact decimals (src/engine/decimal.ts), and
//   the 3 pp rule compares decimals, never floats (`ruleVerdict`).
// - Totals only: no orgnr, label, classification or fingerprint per
//   company is written or printed, and the report is refused if it holds a
//   labelled orgnr (`assertNoLabelledOrgnr`).
// - Refuses when no labelled company has a fingerprint (the document dump is
//   not restored: `pnpm restore:documents`), when the label files do not
//   cover the draw exactly, and when scripts/, src/ or
//   analysis/labelled-set/ has uncommitted changes, so the report's commit
//   is the code that wrote it.
//
// Reads the loaded database as `reader` (READER_DATABASE_URL, from the
// environment, then .env), read-only, through Vite's module runner (as
// scripts/document-set.ts). Writes analysis/output/layer-measurement-<code
// without the dot>.md for the labelled subjects' industry, which must be
// declared in seed/coverage.json; no industry is named in code (AD-16).
//
// Run: node scripts/layer-measurement.ts   (from the repository root)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Decimal } from '../src/engine/decimal.ts';
import { BANDS, type BandedCategory, businessType, type Fingerprint } from '../src/engine/fingerprint.ts';
import { formatPercent, formatPercentagePoints, formatPercentagePointsFine } from '../src/engine/format.ts';
import { assemblePeerGroup, type CandidateFiling, type FunnelOptions, type FunnelSubject } from '../src/engine/peers.ts';
import { parseSemicolonCsv } from './ocr-sm2-compare.ts';
import { setting } from './run-ingest.ts';
import { COVERAGE_FILE, REPORT_DIR, readCoverage } from './seed-format.ts';

/** The report of one industry: its code without the dot. */
export const reportFile = (code: string): string => `${REPORT_DIR}/layer-measurement-${code.replace('.', '')}.md`;
const LABELLED_DIR = 'analysis/labelled-set';
export const DRAWN_FILE = `${LABELLED_DIR}/drawn.json`;
export const LABELS_BLIND_FILE = `${LABELLED_DIR}/labels-blind.csv`;
export const LABELS_ROUND1_FILE = `${LABELLED_DIR}/labels.csv`;
export const REVENUE_MODEL_FILE = `${LABELLED_DIR}/labels-revenue-model.csv`;
const SCRIPT = 'scripts/layer-measurement.ts';
const COMMAND = 'pnpm analysis:layers';
/** The paths whose uncommitted changes refuse a run: the code and the labels. */
const CLEAN_PATHS = ['scripts', 'src', LABELLED_DIR];
const ORGNR = /^[0-9]{9}$/;

// ---------------------------------------------------------------- labels

export const LABELS = ['ja', 'nei', 'usikker'] as const;
export type Label = (typeof LABELS)[number];

/** The revenue models of the second round (README "Second round"). */
export const MODEL_LETTERS = ['p', 'k', 'b', 'v', 'd', 'i', 'u'] as const;
export type ModelLetter = (typeof MODEL_LETTERS)[number];

/**
 * A round-2 pair's label from its two companies' revenue models, by the
 * README rule: `nei` if either is not operating (`i`); otherwise `usikker`
 * if either cannot be decided (`u`); otherwise `ja` for the same letter and
 * `nei` for different letters.
 */
export function pairLabel(subject: ModelLetter, candidate: ModelLetter): Label {
  if (subject === 'i' || candidate === 'i') return 'nei';
  if (subject === 'u' || candidate === 'u') return 'usikker';
  return subject === candidate ? 'ja' : 'nei';
}

export interface LabelledSubject {
  readonly orgnr: string;
  readonly filingYear: number;
  readonly informative: boolean;
  readonly blind: boolean;
  readonly candidates: readonly string[];
}

export const pairKey = (subject: string, candidate: string): string => `${subject}/${candidate}`;

/** drawn.json's subjects, validated: nine-digit orgnrs, a whole filing year, the two flags, and no pair twice. */
export function parseDrawn(json: unknown): LabelledSubject[] {
  const subjects = (json as { subjects?: unknown } | null)?.subjects;
  if (!Array.isArray(subjects) || subjects.length === 0) throw new Error(`${DRAWN_FILE}: no subjects list`);
  const pairs = new Set<string>();
  return subjects.map((raw: unknown, index) => {
    const at = `${DRAWN_FILE}: subject ${index + 1}`;
    const s = raw as Partial<Record<keyof LabelledSubject, unknown>> | null;
    if (s === null || typeof s !== 'object') throw new Error(`${at} is not an object`);
    if (typeof s.orgnr !== 'string' || !ORGNR.test(s.orgnr)) throw new Error(`${at}: orgnr is not nine digits`);
    if (typeof s.filingYear !== 'number' || !Number.isInteger(s.filingYear)) throw new Error(`${at}: filingYear is not a year`);
    if (typeof s.informative !== 'boolean' || typeof s.blind !== 'boolean') throw new Error(`${at}: informative and blind must be booleans`);
    if (!Array.isArray(s.candidates) || !s.candidates.every((c): c is string => typeof c === 'string' && ORGNR.test(c))) {
      throw new Error(`${at}: candidates are not nine-digit orgnrs`);
    }
    for (const candidate of s.candidates) {
      const key = pairKey(s.orgnr, candidate);
      if (pairs.has(key)) throw new Error(`${at}: a pair is drawn twice`);
      pairs.add(key);
    }
    return { orgnr: s.orgnr, filingYear: s.filingYear, informative: s.informative, blind: s.blind, candidates: s.candidates };
  });
}

/** The index of each named column of a sheet's header; a missing one refuses. */
function columns(header: readonly string[] | undefined, names: readonly string[], file: string): number[] {
  return names.map((name) => {
    const at = header?.indexOf(name) ?? -1;
    if (at < 0) throw new Error(`${file}: no ${name} column`);
    return at;
  });
}

/** A pair sheet's labels (`subject_orgnr`, `candidate_orgnr`, `label`). Refuses an empty or unknown label and a pair twice. */
export function readPairLabels(text: string, file: string): Map<string, Label> {
  const [header, ...rows] = parseSemicolonCsv(text);
  const [s, c, l] = columns(header, ['subject_orgnr', 'candidate_orgnr', 'label'], file) as [number, number, number];
  const out = new Map<string, Label>();
  rows.forEach((row, index) => {
    const label = (row[l] ?? '').trim();
    if (!(LABELS as readonly string[]).includes(label)) {
      throw new Error(`${file}: data row ${index + 1} has no label of ${LABELS.join(', ')}`);
    }
    const key = pairKey((row[s] ?? '').trim(), (row[c] ?? '').trim());
    if (out.has(key)) throw new Error(`${file}: data row ${index + 1} repeats a pair`);
    out.set(key, label as Label);
  });
  return out;
}

/** The second round's revenue model per company (`orgnr`, `model`). Refuses an empty or unknown letter and an orgnr twice. */
export function readRevenueModels(text: string, file: string): Map<string, ModelLetter> {
  const [header, ...rows] = parseSemicolonCsv(text);
  const [o, m] = columns(header, ['orgnr', 'model'], file) as [number, number];
  const out = new Map<string, ModelLetter>();
  rows.forEach((row, index) => {
    const letter = (row[m] ?? '').trim();
    if (!(MODEL_LETTERS as readonly string[]).includes(letter)) {
      throw new Error(`${file}: data row ${index + 1} has no model of ${MODEL_LETTERS.join(', ')}`);
    }
    const orgnr = (row[o] ?? '').trim();
    if (out.has(orgnr)) throw new Error(`${file}: data row ${index + 1} repeats a company`);
    out.set(orgnr, letter as ModelLetter);
  });
  return out;
}

/** Throws unless `labels` holds exactly `expected`. */
function exactly(labels: ReadonlyMap<string, unknown>, expected: ReadonlySet<string>, file: string, what: string): void {
  const missing = [...expected].filter((key) => !labels.has(key)).length;
  const extra = [...labels.keys()].filter((key) => !expected.has(key)).length;
  if (missing > 0 || extra > 0) throw new Error(`${file}: ${missing} ${what} of the draw missing, ${extra} not in the draw`);
}

/**
 * The measure: the blind subjects' pairs from the blind sheet, the other
 * subjects' pairs computed from the revenue models. Each file must cover
 * its part of the draw exactly.
 */
export function measureLabels(
  subjects: readonly LabelledSubject[],
  blind: ReadonlyMap<string, Label>,
  models: ReadonlyMap<string, ModelLetter>,
): Map<string, Label> {
  const blindPairs = new Set(subjects.filter((s) => s.blind).flatMap((s) => s.candidates.map((c) => pairKey(s.orgnr, c))));
  exactly(blind, blindPairs, LABELS_BLIND_FILE, 'pairs');
  const others = subjects.filter((s) => !s.blind);
  exactly(models, new Set(others.flatMap((s) => [s.orgnr, ...s.candidates])), REVENUE_MODEL_FILE, 'companies');
  const out = new Map<string, Label>(blind);
  for (const subject of others) {
    for (const candidate of subject.candidates) {
      out.set(pairKey(subject.orgnr, candidate), pairLabel(models.get(subject.orgnr) as ModelLetter, models.get(candidate) as ModelLetter));
    }
  }
  return out;
}

/** Round 1, the stricter reading: the non-blind subjects' pairs, exactly. */
export function roundOneLabels(subjects: readonly LabelledSubject[], round1: ReadonlyMap<string, Label>): Map<string, Label> {
  const pairs = new Set(subjects.filter((s) => !s.blind).flatMap((s) => s.candidates.map((c) => pairKey(s.orgnr, c))));
  exactly(round1, pairs, LABELS_ROUND1_FILE, 'pairs');
  return new Map(round1);
}

// ------------------------------------------------------- what is read

/** A labelled company's stored facts for the filing year (scripts/layer-measurement-compute.ts). */
export interface CompanyFacts {
  readonly companyExists: boolean;
  /** register.document.status, or null without a document row. */
  readonly documentStatus: string | null;
  /** The current column's status, or null without one (or with a null status). */
  readonly currentStatus: string | null;
  readonly hasFingerprint: boolean;
  /** register.classification.status, or null without a row. */
  readonly classificationStatus: string | null;
  readonly classificationType: string | null;
}

export interface SubjectData {
  readonly orgnr: string;
  readonly funnel: FunnelSubject;
  /** Every candidate filing the analysis page reads for the subject. */
  readonly candidates: readonly CandidateFiling[];
  /** The facts of the subject and each of its labelled candidates. */
  readonly facts: ReadonlyMap<string, CompanyFacts>;
}

export interface MeasurementData {
  /** Distinct labelled companies (subjects and candidates). */
  readonly companies: number;
  /** Of them, those with a fingerprint for the labelled year. */
  readonly fingerprinted: number;
  /** In drawn.json order. */
  readonly subjects: readonly SubjectData[];
}

/** Why a company has no fingerprint, from its stored document. */
export const DOCUMENT_CAUSES = [
  'document_absent',
  'document_refused',
  'document_paper',
  'document_failed',
  'document_not_reconciled',
  'reconciled_not_derived',
] as const;
export type DocumentCause = (typeof DOCUMENT_CAUSES)[number];

export function documentCause(facts: CompanyFacts): DocumentCause {
  if (!facts.companyExists || facts.documentStatus === null) return 'document_absent';
  if (facts.documentStatus === 'not_extracted') return 'document_refused';
  if (facts.documentStatus === 'paper') return 'document_paper';
  const status = facts.currentStatus ?? (facts.documentStatus === 'failed_reconciliation' ? 'failed_reconciliation' : null);
  if (status === 'failed_reconciliation') return 'document_failed';
  // A reconciled current column without a fingerprint was skipped by
  // `pnpm derive` (R2, or an unexplained negative remainder).
  if (status === 'reconciled') return 'reconciled_not_derived';
  return 'document_not_reconciled';
}

/** Why the fingerprint signal is null for a pair. */
export const FINGERPRINT_NULL_CAUSES = [
  'subject_no_type',
  'undetermined',
  ...DOCUMENT_CAUSES.map((cause) => `no_fingerprint:${cause}` as const),
] as const;
export type FingerprintNullCause = (typeof FINGERPRINT_NULL_CAUSES)[number];

/** Why the text signal is null for a pair. */
export const TEXT_NULL_CAUSES = ['subject_no_type', 'uklart', 'no_row', 'no_text', 'failed', 'pending'] as const;
export type TextNullCause = (typeof TEXT_NULL_CAUSES)[number];

function classificationCause(facts: CompanyFacts): Exclude<TextNullCause, 'subject_no_type'> {
  switch (facts.classificationStatus) {
    case null:
      return 'no_row';
    case 'classified':
      if (facts.classificationType !== null) throw new Error('a classified type was read as no classification');
      return 'uklart';
    case 'no_text':
    case 'failed':
    case 'pending':
      return facts.classificationStatus;
    default:
      throw new Error(`unknown classification status ${JSON.stringify(facts.classificationStatus)}`);
  }
}

/** The two categories whose band may be left out (FR-13). */
export const WIDENED_CATEGORIES = ['costOfGoods', 'personnelCost'] as const satisfies readonly BandedCategory[];
export type WidenedCategory = (typeof WIDENED_CATEGORIES)[number];

/** The fingerprint with one category's band widened to low–high: that band no longer tells anything. */
export function widenBand(fingerprint: Fingerprint, category: WidenedCategory): Fingerprint {
  return { ...fingerprint, [category]: { lo: BANDS[0], hi: BANDS[BANDS.length - 1] } };
}

function widened<T extends { readonly fingerprint: Fingerprint | null }>(item: T, category: WidenedCategory): T {
  return item.fingerprint === null ? item : { ...item, fingerprint: widenBand(item.fingerprint, category) };
}

// -------------------------------------------------------------- per pair

export interface PairOutcome {
  readonly subject: string;
  readonly candidate: string;
  readonly informative: boolean;
  readonly blind: boolean;
  /** In today's stage 1–3 pool (L1). A labelled candidate outside it is in no layer. */
  readonly inPool: boolean;
  readonly l2: boolean;
  readonly l3: boolean;
  readonly group: boolean;
  readonly flagged: boolean;
  /** Why the fingerprint signal is null, or null when it has a value (or the pair is outside the pool). */
  readonly fingerprintNull: FingerprintNullCause | null;
  /** Why the text signal is null, or null when it has a value (or the pair is outside the pool). */
  readonly textNull: TextNullCause | null;
  /** L2 with the category's band widened to low–high. */
  readonly l2Without: Readonly<Record<WidenedCategory, boolean>>;
  /** With the category's band widened, the fingerprint signal is null (the subject's or the candidate's type undetermined, or no fingerprint). */
  readonly l2WithoutNull: Readonly<Record<WidenedCategory, boolean>>;
}

/**
 * The funnel as built, both signals on: what the measurement measures. The
 * v1 funnel reads neither (V1_TEXT_SIGNAL, V1_FINGERPRINT_SIGNAL) since this
 * measurement, so both are passed explicitly here.
 */
export const MEASURED: FunnelOptions = { textSignal: true, fingerprintSignal: true };

const typeOf = (fingerprint: Fingerprint | null) => (fingerprint === null ? null : businessType(fingerprint));

/** Every labelled pair of one subject, through the funnel as the app runs it and its four variants. */
export function measureSubject(subject: LabelledSubject, data: SubjectData): PairOutcome[] {
  const { funnel, candidates } = data;
  if (funnel.orgnr !== subject.orgnr) throw new Error('subject data out of drawn.json order');
  if (funnel.filingYear !== subject.filingYear) {
    throw new Error(`a labelled subject's benchmark filing is no longer of ${subject.filingYear}`);
  }
  const ids = (list: readonly { readonly orgnr: string }[]) => new Set(list.map((c) => c.orgnr));
  const full = assemblePeerGroup(funnel, candidates, 0, MEASURED);
  const pool = new Map(full.pool.map((c) => [c.orgnr, c]));
  const group = ids(full.group);
  const flagged = new Set(full.flagged);
  const l2 = ids(assemblePeerGroup({ ...funnel, classification: null }, candidates, 0, MEASURED).group);
  const l3 = ids(assemblePeerGroup({ ...funnel, fingerprint: null }, candidates, 0, MEASURED).group);
  const without = Object.fromEntries(
    WIDENED_CATEGORIES.map((category) => [
      category,
      ids(
        assemblePeerGroup(
          { ...widened(funnel, category), classification: null },
          candidates.map((c) => widened(c, category)),
          0,
          MEASURED,
        ).group,
      ),
    ]),
  ) as Record<WidenedCategory, Set<string>>;

  const subjectType = typeOf(funnel.fingerprint);
  const nullWithout = (category: WidenedCategory, peer: CandidateFiling): boolean =>
    typeOf(widened(funnel, category).fingerprint) === null || typeOf(widened(peer, category).fingerprint) === null;
  return subject.candidates.map((orgnr) => {
    const peer = pool.get(orgnr);
    const base = { subject: subject.orgnr, candidate: orgnr, informative: subject.informative, blind: subject.blind };
    if (peer === undefined) {
      return {
        ...base,
        inPool: false,
        l2: false,
        l3: false,
        group: false,
        flagged: false,
        fingerprintNull: null,
        textNull: null,
        l2Without: { costOfGoods: false, personnelCost: false },
        l2WithoutNull: { costOfGoods: false, personnelCost: false },
      };
    }
    const facts = data.facts.get(orgnr);
    if (facts === undefined) throw new Error('no facts for a labelled candidate');
    if (facts.hasFingerprint !== (peer.fingerprint !== null)) throw new Error('the fingerprint read and the facts disagree');
    let fingerprintNull: FingerprintNullCause | null = null;
    if (subjectType === null) fingerprintNull = 'subject_no_type';
    else if (peer.fingerprint === null) fingerprintNull = `no_fingerprint:${documentCause(facts)}`;
    else if (typeOf(peer.fingerprint) === null) fingerprintNull = 'undetermined';
    let textNull: TextNullCause | null = null;
    if (funnel.classification === null) textNull = 'subject_no_type';
    else if (peer.classification === null) textNull = classificationCause(facts);
    return {
      ...base,
      inPool: true,
      l2: l2.has(orgnr),
      l3: l3.has(orgnr),
      group: group.has(orgnr),
      flagged: flagged.has(orgnr),
      fingerprintNull,
      textNull,
      l2Without: { costOfGoods: without.costOfGoods.has(orgnr), personnelCost: without.personnelCost.has(orgnr) },
      l2WithoutNull: { costOfGoods: nullWithout('costOfGoods', peer), personnelCost: nullWithout('personnelCost', peer) },
    };
  });
}

// --------------------------------------------------------------- metrics

export interface Metrics {
  readonly included: { readonly ja: number; readonly nei: number; readonly usikker: number };
  readonly all: { readonly ja: number; readonly nei: number; readonly usikker: number };
  /** ja / (ja + nei) among the included; null ("ikke definert") without either. */
  readonly precision: Decimal | null;
  /** Included ja / all ja; null ("ikke definert") without a ja. */
  readonly recall: Decimal | null;
  /** The counts behind `precision` and `recall`, after `usikkerAs`; null when they are. */
  readonly precisionFraction: Fraction | null;
  readonly recallFraction: Fraction | null;
}

/** A count over a count, as the report writes it: "157/397". */
export interface Fraction {
  readonly num: number;
  readonly den: number;
}

/** How `usikker` counts: left out (the measure), or as `ja` or `nei` (the sensitivity). */
export type UsikkerAs = 'excluded' | 'ja' | 'nei';

/** Precision and recall of one layer, exact. */
export function layerMetrics(
  pairs: readonly { readonly label: Label; readonly included: boolean }[],
  usikkerAs: UsikkerAs = 'excluded',
): Metrics {
  const all = { ja: 0, nei: 0, usikker: 0 };
  const included = { ja: 0, nei: 0, usikker: 0 };
  for (const pair of pairs) {
    all[pair.label] += 1;
    if (pair.included) included[pair.label] += 1;
  }
  const counted = (side: typeof all) =>
    usikkerAs === 'excluded'
      ? { ja: side.ja, nei: side.nei }
      : usikkerAs === 'ja'
        ? { ja: side.ja + side.usikker, nei: side.nei }
        : { ja: side.ja, nei: side.nei + side.usikker };
  const inc = counted(included);
  const tot = counted(all);
  return {
    included,
    all,
    precision: inc.ja + inc.nei === 0 ? null : new Decimal(inc.ja).div(inc.ja + inc.nei),
    recall: tot.ja === 0 ? null : new Decimal(inc.ja).div(tot.ja),
    precisionFraction: inc.ja + inc.nei === 0 ? null : { num: inc.ja, den: inc.ja + inc.nei },
    recallFraction: tot.ja === 0 ? null : { num: inc.ja, den: tot.ja },
  };
}

/** The rule's bound, 3.0 percentage points, as a fraction. */
export const RULE_BOUND = new Decimal('0.03');

export interface Verdict {
  readonly kind: 'kept' | 'not_kept' | 'undecidable';
  /** with − without, as fractions; null when either is undefined. */
  readonly precisionDelta: Decimal | null;
  readonly recallDelta: Decimal | null;
}

/**
 * The stage-5 rule (PRD §9), also the band rule: `withIt` is kept if and
 * only if its precision is at least 3.0 pp above `without`'s and its recall
 * at most 3.0 pp below, both bounds inclusive, compared in Decimal.
 * Undecidable when a precision or recall is not defined.
 */
export function ruleVerdict(without: Metrics, withIt: Metrics): Verdict {
  const delta = (a: Decimal | null, b: Decimal | null) => (a === null || b === null ? null : b.minus(a));
  const precisionDelta = delta(without.precision, withIt.precision);
  const recallDelta = delta(without.recall, withIt.recall);
  if (precisionDelta === null || recallDelta === null) return { kind: 'undecidable', precisionDelta, recallDelta };
  const kept = precisionDelta.gte(RULE_BOUND) && recallDelta.gte(RULE_BOUND.neg());
  return { kind: kept ? 'kept' : 'not_kept', precisionDelta, recallDelta };
}

// ---------------------------------------------------------------- report

export const LAYERS = ['l1', 'l2', 'l3', 'group', 'unflagged', 'flagged'] as const;
export type Layer = (typeof LAYERS)[number];

const LAYER_NAME: Readonly<Record<Layer, string>> = {
  l1: 'L1 industry code and size (the stage 1–3 pool)',
  l2: 'L2 fingerprint alone',
  l3: 'L3 classification alone',
  group: 'L2+L3 the funnel (`group`)',
  unflagged: '`group`, not flagged',
  flagged: 'flagged ("Usikker klassifisering")',
};

export function included(outcome: PairOutcome, layer: Layer): boolean {
  switch (layer) {
    case 'l1':
      return outcome.inPool;
    case 'l2':
      return outcome.l2;
    case 'l3':
      return outcome.l3;
    case 'group':
      return outcome.group;
    case 'unflagged':
      return outcome.group && !outcome.flagged;
    case 'flagged':
      return outcome.flagged;
  }
}

/** The labelled pairs of `outcomes` with their label under `labels`, and whether `include` takes them. */
function scored(
  outcomes: readonly PairOutcome[],
  labels: ReadonlyMap<string, Label>,
  include: (outcome: PairOutcome) => boolean,
): { label: Label; included: boolean }[] {
  return outcomes.flatMap((outcome) => {
    const label = labels.get(pairKey(outcome.subject, outcome.candidate));
    return label === undefined ? [] : [{ label, included: include(outcome) }];
  });
}

export function metricsOf(
  outcomes: readonly PairOutcome[],
  labels: ReadonlyMap<string, Label>,
  include: (outcome: PairOutcome) => boolean,
  usikkerAs: UsikkerAs = 'excluded',
): Metrics {
  return layerMetrics(scored(outcomes, labels, include), usikkerAs);
}

const share = (value: Decimal | null): string => (value === null ? 'ikke definert' : formatPercent(value.toString()));
const signedPp = (value: Decimal | null): string =>
  value === null ? 'ikke definert' : `${value.gt(0) ? '+' : ''}${formatPercentagePoints(value.toString())}`;
const ofShare = (part: number, whole: number): string => (whole === 0 ? 'ikke definert' : formatPercent(new Decimal(part).div(whole).toString()));

function layerTable(outcomes: readonly PairOutcome[], labels: ReadonlyMap<string, Label>): string[] {
  const lines = ['| Layer | Included | ja | nei | usikker | Precision | Recall |', '|---|---:|---:|---:|---:|---:|---:|'];
  for (const layer of LAYERS) {
    const m = metricsOf(outcomes, labels, (o) => included(o, layer));
    const n = m.included.ja + m.included.nei + m.included.usikker;
    lines.push(`| ${LAYER_NAME[layer]} | ${n} | ${m.included.ja} | ${m.included.nei} | ${m.included.usikker} | ${share(m.precision)} | ${share(m.recall)} |`);
  }
  return lines;
}

/** The layer table for all pairs, then per cohort (and the blind pairs, when `withBlind`). */
function layerSection(outcomes: readonly PairOutcome[], labels: ReadonlyMap<string, Label>, withBlind: boolean): string[] {
  const labelled = outcomes.filter((o) => labels.has(pairKey(o.subject, o.candidate)));
  const subjectsIn = (list: readonly PairOutcome[]) => new Set(list.map((o) => o.subject)).size;
  const all = layerMetrics(scored(labelled, labels, () => true));
  const cohorts: [string, readonly PairOutcome[]][] = [
    ['All pairs', labelled],
    ['Informative descriptions', labelled.filter((o) => o.informative)],
    ['Uninformative descriptions', labelled.filter((o) => !o.informative)],
  ];
  if (withBlind) cohorts.push(['Blind pairs (labelled by a person)', labelled.filter((o) => o.blind)]);
  const lines = [
    `${labelled.length} pairs of ${subjectsIn(labelled)} subjects: ${all.all.ja} ja, ${all.all.nei} nei, ${all.all.usikker} usikker (left out of precision and recall, and counted).`,
  ];
  for (const [name, list] of cohorts) {
    lines.push(
      '',
      `### ${name}`,
      '',
      `${subjectsIn(list)} subjects, ${list.length} pairs (${ofShare(list.length, labelled.length)} of the pairs).`,
      '',
      ...layerTable(list, labels),
    );
  }
  return lines;
}

function countTable<K extends string>(title: string, causes: readonly K[], values: readonly (K | null)[]): string[] {
  const lines = [`| ${title} | Pairs |`, '|---|---:|'];
  for (const cause of causes) lines.push(`| \`${cause}\` | ${values.filter((v) => v === cause).length} |`);
  lines.push(`| signal present | ${values.filter((v) => v === null).length} |`);
  return lines;
}

function verdictText(verdict: Verdict, kept: string, notKept: string): string {
  if (verdict.kind === 'undecidable') return 'not decidable: a precision or recall is ikke definert';
  return verdict.kind === 'kept' ? kept : notKept;
}

export interface ReportInputs {
  /** The labelled subjects' industry, NN.NNN. */
  readonly industry: string;
  readonly subjects: readonly LabelledSubject[];
  readonly outcomes: readonly PairOutcome[];
  readonly measure: ReadonlyMap<string, Label>;
  readonly roundOne: ReadonlyMap<string, Label>;
  readonly companies: number;
  readonly fingerprinted: number;
  /** YYYY-MM-DD. */
  readonly generated: string;
  readonly commit: string;
}

export interface StageFiveResult {
  readonly fingerprintAlone: Metrics;
  readonly fingerprintAndText: Metrics;
  readonly verdict: Verdict;
}

/**
 * The stage-5 decision on all measure pairs, `usikker` left out: L2 against
 * `group`. `usikkerAs` other than `excluded` is the sensitivity, which
 * decides nothing.
 */
export function stageFive(
  outcomes: readonly PairOutcome[],
  measure: ReadonlyMap<string, Label>,
  usikkerAs: UsikkerAs = 'excluded',
): StageFiveResult {
  const fingerprintAlone = metricsOf(outcomes, measure, (o) => o.l2, usikkerAs);
  const fingerprintAndText = metricsOf(outcomes, measure, (o) => o.group, usikkerAs);
  return { fingerprintAlone, fingerprintAndText, verdict: ruleVerdict(fingerprintAlone, fingerprintAndText) };
}

/** The band rule on L2 only: L2 without the band against L2 with it. */
export function bandRule(
  outcomes: readonly PairOutcome[],
  measure: ReadonlyMap<string, Label>,
  category: WidenedCategory,
  usikkerAs: UsikkerAs = 'excluded',
) {
  const withBand = metricsOf(outcomes, measure, (o) => o.l2, usikkerAs);
  const withoutBand = metricsOf(outcomes, measure, (o) => o.l2Without[category], usikkerAs);
  return { withBand, withoutBand, verdict: ruleVerdict(withoutBand, withBand) };
}

const BAND_NAME: Readonly<Record<WidenedCategory, string>> = {
  costOfGoods: 'Cost of goods share band',
  personnelCost: 'Personnel cost share band',
};

const fraction = (f: Fraction | null): string => (f === null ? 'ikke definert' : `${f.num}/${f.den}`);
/** A deciding value: one decimal, and the exact fraction behind it. */
const exactShare = (value: Decimal | null, f: Fraction | null): string => (value === null ? 'ikke definert' : `${share(value)} (${fraction(f)})`);
/** A deciding difference: three decimals in pp, and the two fractions it is computed from. */
const exactDelta = (value: Decimal | null, minuend: Fraction | null, subtrahend: Fraction | null): string =>
  value === null ? 'ikke definert' : `${formatPercentagePointsFine(value.toString())} (${fraction(minuend)} − ${fraction(subtrahend)})`;

/** The two rows of a rule and their difference, `second` − `first`. */
function decidingTable(first: readonly [string, Metrics], second: readonly [string, Metrics], difference: string, verdict: Verdict): string[] {
  const row = ([name, m]: readonly [string, Metrics]) =>
    `| ${name} | ${exactShare(m.precision, m.precisionFraction)} | ${exactShare(m.recall, m.recallFraction)} |`;
  return [
    '| | Precision | Recall |',
    '|---|---:|---:|',
    row(first),
    row(second),
    `| ${difference} | ${exactDelta(verdict.precisionDelta, second[1].precisionFraction, first[1].precisionFraction)} | ${exactDelta(verdict.recallDelta, second[1].recallFraction, first[1].recallFraction)} |`,
  ];
}

function stageFiveTable(five: StageFiveResult): string[] {
  return decidingTable(['Fingerprint alone (L2)', five.fingerprintAlone], ['Fingerprint and text (`group`)', five.fingerprintAndText], 'Difference', five.verdict);
}

function bandTable(band: ReturnType<typeof bandRule>): string[] {
  return decidingTable(['L2 without the band', band.withoutBand], ['L2 with the band', band.withBand], 'Difference (with − without)', band.verdict);
}

const stageFiveVerdict = (verdict: Verdict) => verdictText(verdict, 'stage 5 is kept', 'stage 5 is not kept');
const bandVerdict = (verdict: Verdict) => verdictText(verdict, 'kept', 'dropped');

/** Why "without the band" is close to "without the fingerprint", from the type rule and the counts. */
function bandCaveat(category: WidenedCategory, inPool: readonly PairOutcome[]): string {
  const without = inPool.filter((o) => o.l2WithoutNull[category]).length;
  const withIt = inPool.filter((o) => o.fingerprintNull !== null).length;
  const counts = `Without the band the fingerprint signal is null for ${without} of ${inPool.length} pairs in the pool, against ${withIt} with it.`;
  if (category === 'costOfGoods') {
    return (
      'In practice "without the band" here became "without the fingerprint". The type rule reads the cost-of-goods band first (high is `forhandler`, low never is), ' +
      `so a fingerprint with this band widened to low–high can always give \`forhandler\` and another type, and its type is undetermined. ${counts} ` +
      'This test therefore cannot tell the band apart from the fingerprint. No definition is changed.'
    );
  }
  return (
    'The type rule reads the personnel-cost band only to tell `konsulent` (personnel cost mid or high, cost of goods low) from `annet`, so widening it leaves those types undetermined and keeps `forhandler` and `produkt`. ' +
    `${counts} The closer the first count is to all pairs, the more "without the band" is again "without the fingerprint", and the less this test can tell the band apart from the fingerprint. No definition is changed.`
  );
}

/** The stage-5 note on L3: stated only when L3 alone has the highest precision of the four layers. */
function stageFiveNote(outcomes: readonly PairOutcome[], measure: ReadonlyMap<string, Label>): string[] {
  const precision = (layer: Layer) => metricsOf(outcomes, measure, (o) => included(o, layer)).precision;
  const l3 = precision('l3');
  if (l3 === null) return [];
  const others = (['l1', 'l2', 'group'] as const).map(precision);
  if (!others.every((p) => p === null || l3.gt(p))) return [];
  return [
    '',
    `L3, the classification alone, has the highest precision of the layers (${share(l3)}). The rule does not compare L3: it compares the funnel with and without the text over the fingerprint (L2 against \`group\`), and that is not changed now.`,
  ];
}

/**
 * Meinich's band decision (2026-11-15), with the blind pairs' cost-of-goods
 * band figures read from the computation, never written as literals.
 */
export function bandDecision(blind: readonly PairOutcome[], measure: ReadonlyMap<string, Label>): string[] {
  const band = bandRule(blind, measure, 'costOfGoods');
  return [
    '### The decision',
    '',
    'Meinich (2026-11-15) followed the band rule\'s recommendation in the form that changes the group least: the fingerprint signal is switched off in v1, like the text signal, instead of dropping the bands with a migration; ' +
      '`src/engine/fingerprint.ts`, the bands, the stored fingerprints and `pnpm derive` are unchanged, so a later stage can measure again. ' +
      `He decided it from the rule and the blind pairs (${share(band.withBand.precision)} against ${share(band.withoutBand.precision)} precision, ${signedPp(band.verdict.recallDelta)} recall, cost-of-goods band with against without), ` +
      'and because the band test cannot tell one band from the fingerprint. v1\'s group is therefore the stage 1–3 pool.',
  ];
}

const sameOrChanged = (decided: Verdict, other: Verdict) => (decided.kind === other.kind ? 'same' : 'changes');

export function renderReport(inputs: ReportInputs): string {
  const { subjects, outcomes, measure, roundOne } = inputs;
  const inPool = outcomes.filter((o) => o.inPool);
  const outside = outcomes.length - inPool.length;
  const five = stageFive(outcomes, measure);
  const lines: string[] = [];
  const push = (...more: string[]) => lines.push(...more);

  push(
    `# Layer-by-layer measurement, ${inputs.industry} (SM-1)`,
    '',
    `Generated ${inputs.generated} by \`${SCRIPT}\` (\`${COMMAND}\`) at commit \`${inputs.commit}\`, with the reads in \`scripts/layer-measurement-compute.ts\`. ` +
      `Inputs: \`${DRAWN_FILE}\`, \`${LABELS_BLIND_FILE}\`, \`${REVENUE_MODEL_FILE}\` and \`${LABELS_ROUND1_FILE}\` (Story 5.1), and the local database read as \`reader\`. ` +
      'The definitions were fixed in the Story 5.2 spec before the first run on the real labels. Totals only: no company, label, classification or fingerprint is given per orgnr.',
    '',
    'This measures the funnel as it is and states no numeric target (NFR32).',
    '',
    '## The labels',
    '',
    `- ${subjects.length} subjects and ${outcomes.length} labelled pairs from \`${DRAWN_FILE}\`.`,
    `- The measure is ${measure.size} pairs: the blind pairs, labelled by Meinich from description and website only, and the other pairs, whose label is computed from \`${REVENUE_MODEL_FILE}\` by the README rule. ` +
      'A ChatGPT model (OpenAI, version not recorded) filled in those revenue models, and Meinich went through and accepted them; nobody else labelled. ' +
      'For those pairs, the text layer (stage 5, a Claude model) is therefore one AI measured against another; the fingerprint and the industry code are not AI.',
    '- There is no second labeller and no Cohen\'s κ in v1 (stage 2), so nothing here checks one labeller against another.',
    `- Round 1 (\`${LABELS_ROUND1_FILE}\`, ${roundOne.size} pairs) is shown below as "den strengere lesningen" and decides nothing.`,
    '- `usikker` is left out of precision and recall and counted; a sensitivity table counts it as `ja` and as `nei`.',
    '',
    '## How the layers are read',
    '',
    'Each subject is read as the analysis page reads it and assembled by `assemblePeerGroup(…, 0)` (`src/engine/peers.ts`) at the Standard size band, with both signals on: stage 4 and stage 5 as built, which is what is measured. ' +
      'In v1 both signals are switched off after this measurement (`V1_FUNNEL`), so v1\'s group is the stage 1–3 pool (L1).',
    '',
    '- **L1** includes a pair when the candidate is in today\'s stage 1–3 pool. Every labelled candidate was drawn from that pool.',
    '- **L2** includes it when the fingerprint signal is not `false`: the funnel with the subject\'s classification switched off. A missing fingerprint, an undetermined type or a subject with no type is a null signal, and the pair is kept.',
    '- **L3** includes it when the text signal is not `false`: the funnel with the subject\'s fingerprint switched off. `uklart`, a missing row and a subject with no type are null, and the pair is kept.',
    '- **L2+L3** is `group`, the funnel as the app runs it; flagged pairs are shown apart from the rest of `group`.',
    '- Precision is `ja` / (`ja` + `nei`) among the included pairs; recall is the included `ja` / all `ja`, so recall counts within the stage 1–3 pool. "ikke definert" means there is no pair to divide by, never 0.',
    '',
    `Labelled companies with a fingerprint for the labelled year: ${inputs.fingerprinted} of ${inputs.companies}.`,
    `Labelled candidates not in today's pool: ${outside} of ${outcomes.length}. They are in no layer, so a \`ja\` among them counts against every layer's recall.`,
    '',
    '**SM-1b.** An industry-code-only baseline also includes every labelled pair, so on these pairs it equals L1, the base rate. ' +
      'The size band and stage 2 cannot be judged with this draw. SM-1b is the funnel against that base rate: a check, not a claim.',
    '',
    '## The layers (the measure)',
    '',
    ...layerSection(outcomes, measure, true),
    '',
    '## Sensitivity: usikker as ja and as nei (the measure, all pairs)',
    '',
    '| Layer | Precision, as ja | Recall, as ja | Precision, as nei | Recall, as nei |',
    '|---|---:|---:|---:|---:|',
  );
  for (const layer of LAYERS) {
    const asJa = metricsOf(outcomes, measure, (o) => included(o, layer), 'ja');
    const asNei = metricsOf(outcomes, measure, (o) => included(o, layer), 'nei');
    push(`| ${LAYER_NAME[layer]} | ${share(asJa.precision)} | ${share(asJa.recall)} | ${share(asNei.precision)} | ${share(asNei.recall)} |`);
  }

  push(
    '',
    '## Why a signal is null (pairs in the pool)',
    '',
    ...countTable('Fingerprint signal (L2)', FINGERPRINT_NULL_CAUSES, inPool.map((o) => o.fingerprintNull)),
    '',
    ...countTable('Text signal (L3)', TEXT_NULL_CAUSES, inPool.map((o) => o.textNull)),
    '',
    '`no_fingerprint:reconciled_not_derived` is a reconciled document that `pnpm derive` gave no fingerprint (R2, or a negative unexplained remainder).',
    '',
    '## The stage-5 rule',
    '',
    'Fixed in the PRD (§9) before any result: on all measure pairs, `usikker` left out, *fingerprint alone* (L2) against *fingerprint and text* (`group`). ' +
      'Stage 5 is kept if and only if precision rises by at least 3,0 pp and recall falls by at most 3,0 pp, both bounds inclusive, compared exactly. The rule is never re-tuned.',
    '',
    ...stageFiveTable(five),
  );
  if (five.verdict.precisionDelta !== null) {
    push(
      '',
      `A difference of ${formatPercentagePointsFine(five.verdict.precisionDelta.toString())} shows as ${signedPp(five.verdict.precisionDelta)} at one decimal; the rule compares the exact value.`,
    );
  }
  push(
    ...stageFiveNote(outcomes, measure),
    '',
    `**Verdict: ${stageFiveVerdict(five.verdict)}.**`,
    '',
    '## The bands (FR-13)',
    '',
    'Each band is left out by widening it to low–high in memory, in the subject\'s fingerprint and every candidate\'s, before the funnel runs; the rule is unchanged, so a type that depended on the band becomes undetermined and the pair is kept. ' +
      'The rule is applied to L2 only, never to `group`, so the text cannot hide what the band does: a band is recommended kept if L2 with it has at least 3,0 pp higher precision and at most 3,0 pp lower recall than L2 without it, and dropped otherwise. ' +
      'The rule gives a recommendation; Meinich decides (FR-13). The stored fingerprints and `src/engine/fingerprint.ts` are unchanged.',
  );
  for (const category of WIDENED_CATEGORIES) {
    const band = bandRule(outcomes, measure, category);
    push(
      '',
      `### ${BAND_NAME[category]}`,
      '',
      ...bandTable(band),
      '',
      bandCaveat(category, inPool),
      '',
      `**Recommendation: ${bandVerdict(band.verdict)}.**`,
    );
  }
  push('', ...bandDecision(outcomes.filter((o) => o.blind), measure));

  const blind = outcomes.filter((o) => o.blind);
  const blindFive = stageFive(blind, measure);
  push(
    '',
    '## The rules on the blind pairs alone (informational)',
    '',
    `The ${blind.length} blind pairs, labelled by a person from description and website only. The rules are decided on all pairs; this decides nothing.`,
    '',
    '### Stage 5',
    '',
    ...stageFiveTable(blindFive),
    '',
    `Stage-5 rule on these pairs: ${stageFiveVerdict(blindFive.verdict)}.`,
  );
  for (const category of WIDENED_CATEGORIES) {
    const band = bandRule(blind, measure, category);
    push('', `### ${BAND_NAME[category]}`, '', ...bandTable(band), '', `Band rule on these pairs: ${bandVerdict(band.verdict)}.`);
  }

  push(
    '',
    '## The verdicts with usikker counted (informational)',
    '',
    'The same rules on all measure pairs with `usikker` counted as `ja` and as `nei`. The verdicts above leave `usikker` out and decide; these decide nothing.',
    '',
    '| Rule | usikker left out (decides) | usikker as ja | usikker as nei |',
    '|---|---|---|---|',
  );
  const sensitivity = (name: string, decided: Verdict, asJa: Verdict, asNei: Verdict, text: (v: Verdict) => string) =>
    `| ${name} | ${text(decided)} | ${text(asJa)} (${sameOrChanged(decided, asJa)}) | ${text(asNei)} (${sameOrChanged(decided, asNei)}) |`;
  push(sensitivity('Stage 5', five.verdict, stageFive(outcomes, measure, 'ja').verdict, stageFive(outcomes, measure, 'nei').verdict, stageFiveVerdict));
  for (const category of WIDENED_CATEGORIES) {
    push(
      sensitivity(
        BAND_NAME[category],
        bandRule(outcomes, measure, category).verdict,
        bandRule(outcomes, measure, category, 'ja').verdict,
        bandRule(outcomes, measure, category, 'nei').verdict,
        bandVerdict,
      ),
    );
  }

  push('', '## Round 1: den strengere lesningen', '', 'The first round of the non-blind pairs, labelled by a person more specifically than the rubric (README, "Labelling record"). Shown for comparison; it decides nothing.', '');
  push(...layerSection(outcomes, roundOne, false));
  return `${lines.join('\n')}\n`;
}

/** Refuses a text that holds a labelled company's orgnr. */
export function assertNoLabelledOrgnr(text: string, subjects: readonly LabelledSubject[]): void {
  const orgnrs = new Set(subjects.flatMap((s) => [s.orgnr, ...s.candidates]));
  const found = [...orgnrs].filter((orgnr) => text.includes(orgnr)).length;
  if (found > 0) throw new Error(`the report holds ${found} labelled orgnr(s); nothing was written`);
}

// ------------------------------------------------------------------ main

/** The one primary industry every labelled subject's benchmark filing has; refuses a mix or none. */
export function commonIndustry(subjects: readonly Pick<SubjectData, 'funnel'>[]): string {
  const codes = new Set(subjects.map((subject) => subject.funnel.naeringskode1));
  const [only, ...others] = codes;
  if (only === undefined || only === null || others.length > 0) {
    throw new Error('the labelled subjects do not share one primary industry');
  }
  return only;
}

export interface Dependencies {
  /** Reads the database for the labelled subjects. */
  readonly load: (root: string, subjects: readonly LabelledSubject[]) => Promise<MeasurementData>;
  /** The commit at HEAD, or an error when the code or labels have uncommitted changes. */
  readonly commit: (root: string) => string;
  /** Today, YYYY-MM-DD. */
  readonly today: () => string;
}

async function loadFromDatabase(root: string, subjects: readonly LabelledSubject[]): Promise<MeasurementData> {
  const url = setting(root, 'READER_DATABASE_URL');
  if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.');
  process.env.READER_DATABASE_URL = url;
  const { runnerImport } = await import('vite');
  const { module } = await runnerImport<typeof import('./layer-measurement-compute.ts')>(
    path.join(root, 'scripts', 'layer-measurement-compute.ts'),
    {
      root,
      configFile: false,
      logLevel: 'error',
      resolve: { alias: { 'server-only': path.join(root, 'node_modules', 'server-only', 'empty.js') } },
    },
  );
  try {
    return await module.loadMeasurementData(subjects);
  } finally {
    await module.closeReader();
  }
}

function gitCommit(root: string): string {
  const dirty = execFileSync('git', ['status', '--porcelain', '--', ...CLEAN_PATHS], { cwd: root, encoding: 'utf8' });
  if (dirty.trim() !== '') {
    throw new Error(`${CLEAN_PATHS.join(', ')} have uncommitted changes; commit them first, so the report names the code that wrote it`);
  }
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function localDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const DEFAULT_DEPENDENCIES: Dependencies = { load: loadFromDatabase, commit: gitCommit, today: localDate };

export async function main(root: string, deps: Dependencies = DEFAULT_DEPENDENCIES): Promise<number> {
  const read = (relative: string) => readFileSync(path.join(root, ...relative.split('/')), 'utf8');
  try {
    const commit = deps.commit(root);
    const subjects = parseDrawn(JSON.parse(read(DRAWN_FILE)));
    const measure = measureLabels(
      subjects,
      readPairLabels(read(LABELS_BLIND_FILE), LABELS_BLIND_FILE),
      readRevenueModels(read(REVENUE_MODEL_FILE), REVENUE_MODEL_FILE),
    );
    const roundOne = roundOneLabels(subjects, readPairLabels(read(LABELS_ROUND1_FILE), LABELS_ROUND1_FILE));
    const data = await deps.load(root, subjects);
    if (data.fingerprinted === 0) {
      throw new Error(
        `none of the ${data.companies} labelled companies has a fingerprint: the document dump is not restored in the local database; run \`pnpm restore:documents\``,
      );
    }
    if (data.subjects.length !== subjects.length) throw new Error('the database read did not return every labelled subject');
    const industry = commonIndustry(data.subjects);
    if (!readCoverage(path.join(root, ...COVERAGE_FILE.split('/'))).some((entry) => entry.code === industry)) {
      throw new Error(`the labelled subjects' industry ${industry} is not declared in ${COVERAGE_FILE}`);
    }
    const outcomes = subjects.flatMap((subject, index) => measureSubject(subject, data.subjects[index] as SubjectData));
    const report = renderReport({
      industry,
      subjects,
      outcomes,
      measure,
      roundOne,
      companies: data.companies,
      fingerprinted: data.fingerprinted,
      generated: deps.today(),
      commit,
    });
    assertNoLabelledOrgnr(report, subjects);
    const file = reportFile(industry);
    writeFileSync(path.join(root, ...file.split('/')), report);
    const outside = outcomes.filter((o) => !o.inPool).length;
    process.stdout.write(
      `analysis:layers: wrote ${file} (${subjects.length} subjects, ${outcomes.length} pairs, ${outside} outside today's pool; ` +
        `fingerprints for ${data.fingerprinted} of ${data.companies} companies)\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`analysis:layers: ${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd());
}
