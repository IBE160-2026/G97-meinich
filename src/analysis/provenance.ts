// "Hvordan er dette regnet?" as a view (Story 3.7; FR-57, FR-60, FR-64;
// EXPERIENCE.md "Provenance drill-down"): for each displayed kroner amount,
// its four steps — the formula, the key figure and how beste fjerdedel was
// found, the filed values with their names, filing year and read date, and
// the source with the data-quality line — as lines of text and field names.
//
// Pure, on the server: the engine's benchmarks and the subject's own filing
// in, strings out (AD-4). Every number goes through format.ts once; every
// word through t(). A field name is a `field` token, never text, so the page
// marks every one up (`<code data-provenance-field>`), and the payload scan
// can tell a drill-down's names from a leak (e2e/payload.ts). The values are
// the engine's: an amount is the same `ore` the table, the hero and the
// cards round, and every input is the value the engine computed it from
// (src/engine/provenance.ts). Only the subject's own filed values appear; a
// peer appears only as a value in "Vis fordelingen", sorted, with no name.
//
// Formula lines hold only numbers, field names and symbols, plus "per år"
// and "engangsbeløp". A line of displayed numbers reads "≈" in place of "="
// exactly where its expression, from the displayed operands, is not the
// displayed result (`lineIsApproximate`).
import {
  type ApiBenchmark,
  type CapitalChoice,
  type CapitalFigure,
  type DocumentBenchmark,
  type DocumentFigureBenchmark,
  type FigureBenchmark,
  largestCapitalGap,
  workingCapitalReleased,
} from '../engine/benchmark.ts';
import { Decimal } from '../engine/decimal.ts';
import type { DocumentBasis } from '../engine/document-inputs.ts';
import { DAYS_PER_YEAR, documentKeyFigureFractions } from '../engine/document-key-figures.ts';
import {
  formatDays,
  formatFactor,
  formatKroner,
  formatKronerExact,
  formatPercent,
  formatReadDate,
  formatTurnover,
  shownDays,
  shownPercent,
  shownTurnover,
  wholeKroner,
} from '../engine/format.ts';
import { apiKeyFigureFractions } from '../engine/key-figures.ts';
import {
  CHECK_EQUATIONS,
  type DataQuality,
  type ProvenanceInput,
  type StoredDocumentFacts,
  bestQuartile,
  dataQuality,
  figureInputs,
  lineIsApproximate,
  quartileLine,
} from '../engine/provenance.ts';
import type { ApiInputs, Comparison, Direction } from '../engine/types.ts';
import { type MessageId, t, tSegments } from '../messages/index.ts';

/** A piece of a line: text (numbers, symbols, copy) or a register field name, which the page marks up. */
export type Token = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'field'; readonly name: string };
export type Line = readonly Token[];

/** A group of formula lines, under the name of the figure it computes (null: the amount's own). */
export type FormulaGroup = { readonly label: string | null; readonly lines: readonly Line[] };

/** "Vis fordelingen": the n values, sorted, the one or two beste fjerdedel is read from marked, and the line. */
export type DistributionView = {
  readonly caption: string;
  readonly values: readonly { readonly text: string; readonly marked: boolean }[];
  readonly line: string;
};

/** Step 2 for one figure: its own value r, (for driftsmargin) its median M, beste fjerdedel T and how T was found. */
export type FigureStepView = {
  readonly label: string;
  readonly lines: readonly Line[];
  readonly best: string;
  readonly distribution: DistributionView;
};

/** One filed value: its name, its value and, for a derived one, the rule it was derived by. */
export type FiledValue = { readonly name: string; readonly value: string; readonly rule: Line | null };

export type ProvenanceView = {
  /** Step 1. */
  readonly formula: readonly FormulaGroup[];
  /** Step 2: one per figure the amount reads. */
  readonly figures: readonly FigureStepView[];
  /** Step 3: the API values, then the document's lines ("Fra årsregnskapet"), each source with its data date. */
  readonly filed: {
    readonly api: readonly FiledValue[];
    readonly apiDate: string | null;
    readonly document: readonly FiledValue[];
    readonly documentDate: string | null;
  };
  /** Step 4: the source of each kind of value shown, and the data-quality line. */
  readonly sources: readonly string[];
  readonly quality: Line;
};

/** What the drill-down reads of the subject: its filing's API inputs and date, and its document. */
export type ProvenanceSubject = {
  readonly api: ApiInputs;
  readonly basis: DocumentBasis;
  readonly facts: StoredDocumentFacts;
  readonly filingYear: number;
  /** When step 1 read the filing (`register.filing.read_at`). */
  readonly readAt: Date;
  /** The filing's register id: the document's comparison counts only against this filing (review B1). */
  readonly filingBrregId: bigint;
};

// ---- Lines ------------------------------------------------------------------

const text = (value: string): Token => ({ kind: 'text', text: value });
const field = (name: string): Token => ({ kind: 'field', name });

/** Adjacent text tokens joined, so a line is as short as it can be. */
function line(...tokens: readonly (Token | string)[]): Line {
  const out: Token[] = [];
  for (const token of tokens) {
    const next = typeof token === 'string' ? text(token) : token;
    const last = out[out.length - 1];
    if (next.kind === 'text' && last?.kind === 'text') out[out.length - 1] = text(last.text + next.text);
    else if (next.kind !== 'text' || next.text !== '') out.push(next);
  }
  return out;
}

/** A copy line whose placeholders are text or lines (field names stay marked). */
function copyLine(id: MessageId, vars: Readonly<Record<string, string | Line>>): Line {
  const pieces: (Token | string)[] = [];
  for (const segment of tSegments<string | Line>(id, vars)) {
    if (typeof segment === 'string') pieces.push(segment);
    else pieces.push(...segment);
  }
  return line(...pieces);
}

/** A line's text, for tests and for the page's plain reading. */
export function lineText(value: Line): string {
  return value.map((token) => (token.kind === 'text' ? token.text : token.name)).join('');
}

/** Lines joined by `separator`. */
function joinLines(lines: readonly Line[], separator: string): Line {
  const pieces: (Token | string)[] = [];
  lines.forEach((item, i) => {
    if (i > 0) pieces.push(separator);
    pieces.push(...item);
  });
  return line(...pieces);
}

/** A displayed number after an operator: a negative one in parentheses, "(−4,9 %)". */
function operand(value: string): string {
  return value.startsWith('−') ? `(${value})` : value;
}

/** "=" or "≈". */
const equals = (approximate: boolean): string => (approximate ? ' ≈ ' : ' = ');

/** A filed amount in øre (a whole number) as kroner, and as the whole kroner it shows. */
const kr = (ore: bigint): string => formatKroner(ore.toString());
const krShown = (ore: bigint): Decimal => wholeKroner(ore.toString());

/** The figure's value as its row writes it, and as a value. */
type Unit = 'percent' | 'days' | 'turnover';
function shown(unit: Unit, value: Decimal): { readonly text: string; readonly value: Decimal } {
  switch (unit) {
    case 'percent':
      return { text: formatPercent(value.toString()), value: shownPercent(value.toString()) };
    case 'days':
      return { text: formatDays(value.toString()), value: shownDays(value.toString()) };
    case 'turnover':
      return { text: formatTurnover(value.toString()), value: shownTurnover(value.toString()) };
  }
}

// ---- Step 2: the key figure and beste fjerdedel ------------------------------

type Compared = Extract<Comparison, { readonly kind: 'compared' }>;

function compared(comparison: Comparison): Compared & { readonly best: NonNullable<Compared['best']> } {
  if (comparison.kind !== 'compared' || comparison.best === null) throw new Error('an amount needs a compared figure with beste fjerdedel');
  if (comparison.sorted.length !== comparison.count) throw new Error('the distribution is not the compared values');
  return { ...comparison, best: comparison.best };
}

type WithBest = Compared & { readonly best: NonNullable<Compared['best']> };

function distribution(c: WithBest, direction: Exclude<Direction, 'none'>, unit: Unit): { best: string; view: DistributionView } {
  const quartile = bestQuartile(direction);
  const quartileLineView = quartileLine(c.sorted, quartile.p, (value) => shown(unit, value).value);
  // The engine's beste fjerdedel is the quartile this line computes.
  if (!quartileLineView.quartile.eq(c.best.quartile)) throw new Error('the quartile line is not beste fjerdedel');
  const T = shown(unit, quartileLineView.quartile).text;
  const marked = new Set<number>([quartileLineView.k - 1]);
  if (quartileLineView.kind === 'between') marked.add(quartileLineView.k);
  const lineText =
    quartileLineView.kind === 'at'
      ? t('provenance.distribution.at', { k: String(quartileLineView.k), T })
      : t(quartileLineView.approximate ? 'provenance.distribution.betweenApprox' : 'provenance.distribution.between', {
          k: String(quartileLineView.k),
          k1: String(quartileLineView.k + 1),
          a: operand(shown(unit, quartileLineView.a).text),
          b: shown(unit, quartileLineView.b).text,
          f: formatFactor(quartileLineView.f.toString()),
          T,
        });
  return {
    best: t('provenance.best', {
      T,
      kvartil: t(quartile.which === 'upper' ? 'provenance.quartile.upper' : 'provenance.quartile.lower'),
      n: String(c.count),
    }),
    view: {
      caption: t('provenance.distribution.caption', { n: String(c.count) }),
      values: c.sorted.map((value, i) => ({ text: shown(unit, value).text, marked: marked.has(i) })),
      line: lineText,
    },
  };
}

function figureStep(
  label: MessageId,
  c: WithBest,
  direction: Exclude<Direction, 'none'>,
  unit: Unit,
  own: Line,
  withMedian: boolean,
): FigureStepView {
  const { best, view } = distribution(c, direction, unit);
  const T = shown(unit, c.best.quartile).text;
  return {
    label: t(label),
    lines: [own, ...(withMedian ? [line(`M = ${shown(unit, c.median).text}`)] : []), line(`T = ${T}`)],
    best,
    distribution: view,
  };
}

// ---- Step 3: the filed values -----------------------------------------------

/** "avledet: {regel}", or "avledet: {regel} = {rest}, innenfor ±5 kr, satt til 0". */
function ruleLine(input: ProvenanceInput): Line | null {
  const derivation = input.derivation;
  if (derivation === null) return null;
  const names = derivation.operands.flatMap((op, i): (Token | string)[] => [
    i === 0 ? (op.sign === -1 ? '−' : '') : op.sign === 1 ? ' + ' : ' − ',
    field(op.field),
  ]);
  const values = derivation.operands.map((op, i) => {
    const value = i === 0 ? kr(op.ore) : operand(kr(op.ore));
    return i === 0 ? (op.sign === -1 ? `−${operand(value)}` : value) : `${op.sign === 1 ? ' + ' : ' − '}${value}`;
  });
  const regel = line(...names, ' = ', values.join(''));
  return derivation.kind === 'sum'
    ? copyLine('provenance.derived', { regel })
    : copyLine('provenance.derivedZero', { regel, rest: kr(derivation.rest) });
}

function filedValues(inputs: readonly ProvenanceInput[]): FiledValue[] {
  const seen = new Set<string>();
  const out: FiledValue[] = [];
  for (const input of inputs) {
    if (seen.has(input.field)) continue;
    seen.add(input.field);
    out.push({ name: input.field, value: kr(input.ore), rule: ruleLine(input) });
  }
  return out;
}

// ---- Step 4: the data-quality line ------------------------------------------

/** A within-document check as its equation in register names, "sumEiendeler ≠ sumEgenkapitalGjeld". */
function equation(check: keyof typeof CHECK_EQUATIONS): Line {
  const { left, leftSigns, right } = CHECK_EQUATIONS[check];
  const side = (names: readonly string[], signs: readonly (1 | -1)[]) =>
    names.flatMap((name, i): (Token | string)[] => [i === 0 ? '' : signs[i] === -1 ? ' − ' : ' + ', field(name)]);
  return line(...side(left, leftSigns), ' ≠ ', ...side(right, right.map(() => 1 as const)));
}

const names = (fields: readonly string[]): Line => joinLines(fields.map((name) => line(field(name))), ', ');

export function qualityLine(quality: DataQuality): Line {
  switch (quality.kind) {
    case 'absent':
      throw new Error('an amount that does not exist has no data-quality line');
    case 'not_in_dataset':
      return line(t('provenance.quality.notInDataset'));
    case 'not_read_in_v1':
      return line(t('provenance.quality.notReadInV1', { aar: String(quality.filingYear) }));
    case 'document_missing':
      return line(t('provenance.quality.documentMissing', { aar: String(quality.filingYear) }));
    case 'not_read_safely':
      return line(t('provenance.quality.notReadSafely', { aar: String(quality.filingYear) }));
    case 'failed': {
      const parts: Line[] = [];
      if (quality.apiFields.length > 0) parts.push(names(quality.apiFields));
      for (const check of quality.checks) parts.push(equation(check));
      return copyLine('provenance.quality.failed', { felt: joinLines(parts, '; ') });
    }
    case 'lines_not_read':
      return copyLine('provenance.quality.linesNotRead', { felt: names(quality.fields), aar: String(quality.filingYear) });
    case 'reconciled':
      return line(t('provenance.quality.reconciled'));
    case 'not_compared':
      return copyLine('provenance.quality.notCompared', { felt: names(quality.fields) });
  }
}

// ---- The amounts -------------------------------------------------------------

/** What one figure contributes: its formula lines, its step 2 and its inputs. */
type FigurePart = { readonly formula: readonly Line[]; readonly step: FigureStepView; readonly inputs: readonly ProvenanceInput[] };

function byField(inputs: readonly ProvenanceInput[], name: string): ProvenanceInput {
  const found = inputs.find((input) => input.field === name);
  if (found === undefined) throw new Error(`the figure has no input ${name}`);
  return found;
}

function view(
  subject: ProvenanceSubject,
  formula: readonly FormulaGroup[],
  parts: readonly FigurePart[],
  amount: 'api' | 'document',
): ProvenanceView {
  const inputs = parts.flatMap((part) => part.inputs);
  const api = inputs.filter((input) => input.source === 'api');
  const document = inputs.filter((input) => input.source === 'document');
  const quality = dataQuality({
    basis: subject.basis,
    facts: subject.facts,
    api: subject.api,
    inputs,
    amount,
    filingBrregId: subject.filingBrregId,
  });
  if (document.length > 0 && subject.facts.readAt === null) throw new Error('a document line without the document');
  const date = (id: MessageId, readAt: Date) => t(id, { aar: String(subject.filingYear), dato: formatReadDate(readAt) });
  return {
    formula,
    figures: parts.map((part) => part.step),
    filed: {
      api: filedValues(api),
      apiDate: api.length > 0 ? date('provenance.date.api', subject.readAt) : null,
      document: filedValues(document),
      documentDate: document.length > 0 && subject.facts.readAt !== null ? date('provenance.date.document', subject.facts.readAt) : null,
    },
    sources: [
      ...(api.length > 0 ? [t('provenance.source.api')] : []),
      ...(document.length > 0 ? [t('provenance.source.document')] : []),
    ],
    quality: qualityLine(quality),
  };
}

/** The driftsmargin figure and its profit formula lines, at full convergence. */
function profitPart(subject: ProvenanceSubject, figure: FigureBenchmark): { readonly part: FigurePart; readonly amount: Decimal } | null {
  if (figure.gap.kind !== 'amount') return null;
  const c = compared(figure.comparison);
  const exact = apiKeyFigureFractions(subject.api).driftsmargin;
  if (exact.kind !== 'value') throw new Error('a compared driftsmargin has its inputs');
  const inputs = figureInputs(exact.inputs, subject.api, null);
  const result = byField(inputs, 'driftsresultat');
  const revenue = byField(inputs, 'sumDriftsinntekter');
  const T = shown('percent', c.best.quartile);
  const r = shown('percent', c.subject);
  const amount = figure.gap.ore;
  const approximate = lineIsApproximate(T.value.minus(r.value).mul(krShown(revenue.ore)), wholeKroner(amount.toString()));
  const ownApproximate = lineIsApproximate(krShown(result.ore).div(krShown(revenue.ore)), r.value);
  const own = line(
    'r = ',
    field('driftsresultat'),
    ' / ',
    field('sumDriftsinntekter'),
    ` = ${kr(result.ore)} / ${operand(kr(revenue.ore))}${equals(ownApproximate)}${r.text}`,
  );
  return {
    amount,
    part: {
      formula: [
        line('(T − r) × ', field('sumDriftsinntekter')),
        line(
          `(${T.text} − ${operand(r.text)}) × ${kr(revenue.ore)}${equals(approximate)}${formatKronerExact(amount.toString())} ${t('keyFigures.perYear')}`,
        ),
      ],
      step: figureStep('fig.driftsmargin', c, 'higher_is_better', 'percent', own, true),
      inputs,
    },
  };
}

/** The profit uplift's drill-down at full convergence (Nøkkeltall, the hero, and Verdi's fixed part); null without an amount. */
export function profitProvenance(subject: ProvenanceSubject, figure: FigureBenchmark): ProvenanceView | null {
  const profit = profitPart(subject, figure);
  if (profit === null) return null;
  return view(subject, [{ label: null, lines: profit.part.formula }], [profit.part], 'api');
}

/**
 * Verdi at the median step (decision 1's table): (M − r) × sumDriftsinntekter
 * and its value, the profit `profitAtMedian` gives, never full × s_med.
 * `atMedianOre` is that profit, exact.
 */
export function profitAtMedianLines(subject: ProvenanceSubject, figure: FigureBenchmark, atMedianOre: Decimal): readonly Line[] {
  const c = compared(figure.comparison);
  const revenue = byField(figureInputs(apiDriftsmarginInputs(subject), subject.api, null), 'sumDriftsinntekter');
  const M = shown('percent', c.median);
  const r = shown('percent', c.subject);
  const approximate = lineIsApproximate(M.value.minus(r.value).mul(krShown(revenue.ore)), wholeKroner(atMedianOre.toString()));
  return [
    line('(M − r) × ', field('sumDriftsinntekter')),
    line(
      `(${M.text} − ${operand(r.text)}) × ${kr(revenue.ore)}${equals(approximate)}${formatKronerExact(atMedianOre.toString())} ${t('keyFigures.perYear')}`,
    ),
  ];
}

function apiDriftsmarginInputs(subject: ProvenanceSubject) {
  const exact = apiKeyFigureFractions(subject.api).driftsmargin;
  if (exact.kind !== 'value') throw new Error('a compared driftsmargin has its inputs');
  return exact.inputs;
}

const CAPITAL_LABELS: Readonly<Record<CapitalFigure, MessageId>> = { kfd: 'fig.kfd', lgd: 'fig.lgd', oml: 'fig.oml' };
const CAPITAL_UNITS: Readonly<Record<CapitalFigure, Unit>> = { kfd: 'days', lgd: 'days', oml: 'turnover' };

/** One capital figure's part: its formula lines at full convergence (when it is an amount), its step 2 and its inputs. */
function capitalPart(subject: ProvenanceSubject, key: CapitalFigure, figure: DocumentFigureBenchmark): FigurePart | null {
  if (subject.basis.kind !== 'read' || figure.direction === 'none') return null;
  if (figure.gap.kind !== 'amount' && figure.gap.kind !== 'strength') return null;
  const c = compared(figure.comparison);
  const exact = documentKeyFigureFractions(subject.basis)[key];
  if (exact.kind !== 'value') throw new Error('a compared capital figure has its inputs');
  const inputs = figureInputs(exact.inputs, subject.api, subject.basis.current);
  const unit = CAPITAL_UNITS[key];
  const T = shown(unit, c.best.quartile);
  const r = shown(unit, c.subject);
  const days = String(DAYS_PER_YEAR);
  const daysValue = new Decimal(DAYS_PER_YEAR.toString());
  const v = (name: string) => byField(inputs, name);
  const k = (name: string) => krShown(v(name).ore);
  let symbolic: Line;
  let numbers: string;
  let expression: Decimal;
  let own: Line;
  switch (key) {
    case 'kfd': {
      symbolic = line(field('kundefordringer'), ' − T × ', field('salgsinntekt'), ` / ${days}`);
      numbers = `${kr(v('kundefordringer').ore)} − ${operand(T.text)} × ${operand(kr(v('salgsinntekt').ore))} / ${days}`;
      expression = k('kundefordringer').minus(T.value.mul(k('salgsinntekt')).div(daysValue));
      const ownApproximate = lineIsApproximate(k('kundefordringer').div(k('salgsinntekt')).mul(daysValue), r.value);
      own = line(
        'r = ',
        field('kundefordringer'),
        ' / ',
        field('salgsinntekt'),
        ` × ${days} = ${kr(v('kundefordringer').ore)} / ${operand(kr(v('salgsinntekt').ore))} × ${days}${equals(ownApproximate)}${r.text}`,
      );
      break;
    }
    case 'lgd': {
      symbolic = line('T × (', field('varekostnad'), ' + ', field('annenDriftskostnad'), `) / ${days} − `, field('leverandorgjeld'));
      const costs = `(${kr(v('varekostnad').ore)} + ${operand(kr(v('annenDriftskostnad').ore))})`;
      numbers = `${T.text} × ${costs} / ${days} − ${operand(kr(v('leverandorgjeld').ore))}`;
      const costsValue = k('varekostnad').plus(k('annenDriftskostnad'));
      expression = T.value.mul(costsValue).div(daysValue).minus(k('leverandorgjeld'));
      const ownApproximate = lineIsApproximate(k('leverandorgjeld').div(costsValue).mul(daysValue), r.value);
      own = line(
        'r = ',
        field('leverandorgjeld'),
        ' / (',
        field('varekostnad'),
        ' + ',
        field('annenDriftskostnad'),
        `) × ${days} = ${kr(v('leverandorgjeld').ore)} / ${costs} × ${days}${equals(ownApproximate)}${r.text}`,
      );
      break;
    }
    case 'oml': {
      symbolic = line('(', field('sumEiendeler'), ' − ', field('bankinnskudd'), ') − ', field('sumDriftsinntekter'), ' / T');
      const base = `(${kr(v('sumEiendeler').ore)} − ${operand(kr(v('bankinnskudd').ore))})`;
      numbers = `${base} − ${operand(kr(v('sumDriftsinntekter').ore))} / ${operand(T.text)}`;
      const baseValue = k('sumEiendeler').minus(k('bankinnskudd'));
      expression = baseValue.minus(k('sumDriftsinntekter').div(T.value));
      const ownApproximate = lineIsApproximate(k('sumDriftsinntekter').div(baseValue), r.value);
      own = line(
        'r = ',
        field('sumDriftsinntekter'),
        ' / (',
        field('sumEiendeler'),
        ' − ',
        field('bankinnskudd'),
        `) = ${kr(v('sumDriftsinntekter').ore)} / ${base}${equals(ownApproximate)}${r.text}`,
      );
      break;
    }
  }
  const formula =
    figure.gap.kind === 'amount'
      ? [
          symbolic,
          line(
            `${numbers}${equals(lineIsApproximate(expression, wholeKroner(figure.gap.ore.toString())))}${formatKronerExact(figure.gap.ore.toString())} ${t('keyFigures.oneOff')}`,
          ),
        ]
      : [line(t('provenance.strengthPart', { del: t(CAPITAL_LABELS[key]) }))];
  return {
    formula,
    step: figureStep(CAPITAL_LABELS[key], c, figure.direction, unit, own, false),
    inputs,
  };
}

/** One capital figure's drill-down, (9), (10) or (11) at full convergence; null without an amount. */
export function capitalProvenance(subject: ProvenanceSubject, key: CapitalFigure, figure: DocumentFigureBenchmark): ProvenanceView | null {
  if (figure.gap.kind !== 'amount') return null;
  const part = capitalPart(subject, key, figure);
  if (part === null) return null;
  return view(subject, [{ label: null, lines: part.formula }], [part], 'document');
}

/**
 * Working capital released (decision 1): (9) + (10), a strength counted as
 * 0, with both parts' drill-downs; when there is no total, each part that
 * is an amount. Null when no part is an amount.
 */
export function workingCapitalProvenance(subject: ProvenanceSubject, document: DocumentBenchmark): ProvenanceView | null {
  const { kfd, lgd } = document;
  if (kfd.gap.kind !== 'amount' && lgd.gap.kind !== 'amount') return null;
  const kfdPart = capitalPart(subject, 'kfd', kfd);
  const lgdPart = capitalPart(subject, 'lgd', lgd);
  const parts = [
    { key: 'kfd' as const, part: kfdPart },
    { key: 'lgd' as const, part: lgdPart },
  ].filter((entry): entry is { key: 'kfd' | 'lgd'; part: FigurePart } => entry.part !== null);
  const total = workingCapitalReleased(kfd.gap, lgd.gap);
  const groups: FormulaGroup[] = [];
  if (total.kind === 'amount') {
    const amountOf = (gap: typeof kfd.gap) => (gap.kind === 'amount' ? gap.ore : null);
    const terms = [amountOf(kfd.gap), amountOf(lgd.gap)];
    // A strength counts as 0.
    const shownTerms = terms.map((term) => (term === null ? kr(0n) : formatKronerExact(term.toString())));
    const sum = terms.reduce<Decimal>((acc, term) => (term === null ? acc : acc.plus(wholeKroner(term.toString()))), wholeKroner('0'));
    const approximate = lineIsApproximate(sum, wholeKroner(total.ore.toString()));
    groups.push({
      label: null,
      lines: [
        line(
          `${shownTerms[0]} + ${operand(shownTerms[1] ?? '')}${equals(approximate)}${formatKronerExact(total.ore.toString())} ${t('keyFigures.oneOff')}`,
        ),
      ],
    });
  }
  for (const { key, part } of parts) groups.push({ label: t(CAPITAL_LABELS[key]), lines: part.formula });
  return view(
    subject,
    groups,
    parts.map((entry) => entry.part),
    'document',
  );
}

const CHOICE_LABELS: Readonly<Record<CapitalChoice, MessageId>> = {
  working_capital: 'oversikt.capital.workingCapital',
  kfd: 'fig.kfd',
  lgd: 'fig.lgd',
  oml: 'fig.oml',
};

/** "Største kapitalgap" (decision 1): the candidates compared, then the chosen amount's drill-down. Null without an amount. */
export function largestCapitalProvenance(subject: ProvenanceSubject, document: DocumentBenchmark): ProvenanceView | null {
  if (subject.basis.kind !== 'read') return null;
  const choice = largestCapitalGap(document.kfd.gap, document.lgd.gap, document.oml.gap);
  if (choice.kind !== 'amount') return null;
  const chosen =
    choice.figure === 'working_capital'
      ? workingCapitalProvenance(subject, document)
      : capitalProvenance(subject, choice.figure, document[choice.figure]);
  if (chosen === null) throw new Error('the chosen capital amount has a drill-down');
  if (choice.candidates.length < 2) return chosen;
  const items = choice.candidates.map((candidate) =>
    t('verdi.part', { figur: t(CHOICE_LABELS[candidate.figure]), verdi: formatKronerExact(candidate.ore.toString()) }),
  );
  const liste = items.length === 2 ? t('list.and', { first: items[0] ?? '', last: items[1] ?? '' }) : items.join(', ');
  return { ...chosen, formula: [{ label: null, lines: [line(t('provenance.largestOf', { liste }))] }, ...chosen.formula] };
}

/** The subject's own benchmark-year facts, as the drill-down reads them. */
export function provenanceSubject(
  api: ApiInputs,
  filing: {
    readonly filingYear: number;
    readonly readAt: Date;
    readonly brregId: bigint;
    readonly documentBasis: DocumentBasis;
    readonly documentFacts: StoredDocumentFacts;
  },
): ProvenanceSubject {
  return {
    api,
    basis: filing.documentBasis,
    facts: filing.documentFacts,
    filingYear: filing.filingYear,
    readAt: filing.readAt,
    filingBrregId: filing.brregId,
  };
}

/** Every field name a view shows, in order, each once: what the page marks up. */
export function viewFields(provenance: ProvenanceView): string[] {
  const lines: Line[] = [
    ...provenance.formula.flatMap((group) => group.lines),
    ...provenance.figures.flatMap((figure) => figure.lines),
    ...[...provenance.filed.api, ...provenance.filed.document].flatMap((value) => [
      line(field(value.name)),
      ...(value.rule === null ? [] : [value.rule]),
    ]),
    provenance.quality,
  ];
  return [...new Set(lines.flatMap((item) => item.flatMap((token) => (token.kind === 'field' ? [token.name] : []))))];
}

/** The table's drill-downs, by the row whose gap cell shows the amount. */
export type TableProvenance = Readonly<Partial<Record<'driftsmargin' | CapitalFigure, ProvenanceView>>>;

/** Nøkkeltall's four gap cells (decision 1): a view where the cell shows an amount. */
export function tableProvenance(subject: ProvenanceSubject, api: ApiBenchmark, document: DocumentBenchmark): TableProvenance {
  const out: Partial<Record<'driftsmargin' | CapitalFigure, ProvenanceView>> = {};
  const profit = profitProvenance(subject, api.driftsmargin);
  if (profit !== null) out.driftsmargin = profit;
  for (const key of ['kfd', 'lgd', 'oml'] as const) {
    const capital = capitalProvenance(subject, key, document[key]);
    if (capital !== null) out[key] = capital;
  }
  return out;
}
