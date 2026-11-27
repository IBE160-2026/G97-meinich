// What batch step 2 tells the model about one company's default analysis
// (Story 4.1; FR-52; AD-7, AD-13): a closed table of slots and the payload
// built from it, and the digest of the analysis's wire encoding.
//
// - The default analysis: funnel stages 1–5 at the standard band (0), with
//   no `ekskl`, under `V1_FUNNEL`, the shown group as the page computes it
//   (`shownGroup`), and the key-figure table's own rows (`keyFigureRows`),
//   so a slot says exactly what the page says.
// - A slot is `{{id}}` in the model's text. Its id is `<figure>.<field>`
//   (fields `SLOT_FIELDS`), or `aar`, `antall` or `mangler.dokument`. Its
//   text comes from `src/engine/format.ts` (through the rows) or from
//   `src/messages/nb.json`; its value is the engine's exact value on the
//   wire (`toWire`), or null for a word.
// - The engine chooses what is named, and in which order, never the model:
//   - the profit gap per year: driftsmargin's, when the engine gives an
//     amount (`driftsmarginGap`);
//   - the one-off capital gaps: `largestCapitalGap`'s candidates (the
//     working-capital total, or (9) or (10) alone, and (11)), with (9) and
//     (10) beside the total when both are amounts, largest exact amount
//     first, ties in figure order, at most three, since there are three rank
//     words. They are never ranked against the profit gap;
//   - the strengths: the rule of Største styrke (`atOrBeyondBest`,
//     `NEVER_STRENGTH` in `oversikt-cards.ts`), every figure that meets it,
//     ranked on the whole percent of its Plassering, ties to the lower
//     figure number, so the first is the card's.
// - The payload holds slot ids, their texts, figure names from nb.json, each
//   figure's better direction, the slot fields' meanings stated once
//   (`SLOT_FIELD_MEANINGS`, no digit) and fixed structural keys. Never an orgnr, a company name, register text, a
//   peer's identity, a fingerprint, a classification or anything from
//   stages 4 and 5 (test/explain/payload.test.ts).
// - A subject outside the dataset (`not_in_dataset`) has no document figure
//   to name and gets `mangler.dokument`, the page's own sentence.
//
// Pure, and it imports nothing from scripts/ or the model's SDK: the request
// path can compute the same digest in Story 4.4.
import {
  atOrBeyondBest,
  largestCapitalGap,
  type ApiBenchmark,
  type CapitalChoice,
  type CapitalGap,
  type DocumentBenchmark,
} from '../engine/benchmark.ts';
import { Decimal } from '../engine/decimal.ts';
import { digest } from '../engine/digest.ts';
import type { DocumentBasis } from '../engine/document-inputs.ts';
import { formatKronerExact, wholePercent } from '../engine/format.ts';
import { assemblePeerGroup, V1_FUNNEL, type CandidateFiling, type EmptyReason, type FunnelSubject, type SizeBand } from '../engine/peers.ts';
import type { Comparison } from '../engine/types.ts';
import { toWire, type WireDecimal } from '../engine/wire.ts';
import { t, type MessageId } from '../messages/index.ts';
import { KEY_FIGURE_ROWS, keyFigureRows, rowBenchmark, type FigureKey, type KeyFigureRow } from './key-figure-rows.ts';
import { NEVER_STRENGTH } from './oversikt-cards.ts';
import { shownGroup, type ShownGroup } from './shown-group.ts';
import type { SubjectFiling, SubjectKeyFigures } from './view.ts';

/** The default analysis's band: the standard one. */
export const DEFAULT_BAND: SizeBand = 0;

/** The fields of a figure's slot ids. */
export const SLOT_FIELDS = ['egen', 'median', 'beste', 'plassering', 'gap', 'retning', 'rang'] as const;
export type SlotField = (typeof SLOT_FIELDS)[number];

/** The slot ids that name no figure. */
export const YEAR_SLOT = 'aar';
export const COUNT_SLOT = 'antall';
export const MISSING_DOCUMENT_SLOT = 'mangler.dokument';

/** The working-capital total's figure id (Story 3.4's "Arbeidskapital"). */
export const WORKING_CAPITAL = 'arbeidskapital';

/** One slot: the text the page shows and the exact value behind it, or null for a word. */
export type Slot = { readonly id: string; readonly text: string; readonly value: WireDecimal | null };

/** A slot as the model sees it: its id and its text. */
export type PayloadSlot = { readonly id: string; readonly text: string };

/**
 * One named gap or strength: its name from nb.json and its slots, and, for
 * a key figure, which way is better (the row's direction). The
 * working-capital total is no figure and has no `better`.
 */
export type PayloadItem = { readonly name: string; readonly better?: 'higher' | 'lower'; readonly slots: readonly PayloadSlot[] };

/** What a slot field means: stated once in the payload, never per slot. */
export type SlotFieldMeaning = { readonly field: string; readonly meaning: string };

/**
 * The meaning of every slot field, sent once with each payload (Meinich,
 * 2026-11-27, after sample run 181: the model read `beste` as one company,
 * `gap` as to the median, and wrote «medianen» after the direction slot).
 * It holds no digit (test/explain/payload.test.ts), so it can never be the
 * source of a figure in a template.
 */
export const SLOT_FIELD_MEANINGS: readonly SlotFieldMeaning[] = [
  { field: 'egen', meaning: "The company's own value of the figure." },
  { field: 'median', meaning: 'The median of the comparable companies.' },
  {
    field: 'beste',
    meaning:
      'The boundary of the best quartile of the comparable companies: the value a company must reach to be among the best quarter. It is a boundary, never one company and never the best value in the group. Where the item\'s "better" is "lower", as for a cost share, lower is better, so the boundary can lie below the company\'s own value. Where it is "higher", it can lie above.',
  },
  { field: 'plassering', meaning: 'The share of the comparable companies the company does better than. Its text is complete as written.' },
  {
    field: 'gap',
    meaning:
      'In "profit_gaps_per_year": the kroner per year the operating result would rise by if the figure reached the boundary of the best quartile. In "capital_gaps_one_off": the one-off kroner of capital released if it reached that boundary, not per year. Both are measured to the best quartile, never to the median.',
  },
  {
    field: 'retning',
    meaning: 'Whether the own value lies above, below or at the median. Its text already contains the word «medianen»: never write «medianen» again right after it.',
  },
  { field: 'rang', meaning: "The capital gap's place among the one-off capital gaps. Use it only beside its own capital gap." },
  { field: YEAR_SLOT, meaning: 'The filing year. Always write it as this slot, never as its text.' },
  { field: COUNT_SLOT, meaning: 'The number of comparable companies in the analysis. Always write it as this slot, never as its text.' },
  { field: MISSING_DOCUMENT_SLOT, meaning: "A sentence saying the company's document figures are not in the dataset." },
];

/** What the model is sent. Only slot ids, slot texts, names from nb.json, `SLOT_FIELD_MEANINGS` and these keys. */
export type ExplanationPayload = {
  readonly slot_fields: readonly SlotFieldMeaning[];
  readonly year: PayloadSlot;
  readonly peer_count: PayloadSlot;
  readonly profit_gaps_per_year: readonly PayloadItem[];
  readonly capital_gaps_one_off: readonly PayloadItem[];
  readonly strengths: readonly PayloadItem[];
  readonly notes: readonly PayloadSlot[];
};

/** One company's explanation input. */
export type ExplanationAnalysis = {
  readonly payload: ExplanationPayload;
  /** The closed slot table, every slot the payload names, sorted by id. */
  readonly slots: readonly Slot[];
  /** `digest()` of the analysis's wire encoding (`analysisWire`). */
  readonly digest: string;
  readonly filingYear: number;
};

const DIRECTION: Readonly<Record<'above' | 'below' | 'equal', MessageId>> = {
  above: 'explanation.direction.above',
  below: 'explanation.direction.below',
  equal: 'explanation.direction.equal',
};

const RANK: readonly MessageId[] = ['explanation.rank.1', 'explanation.rank.2', 'explanation.rank.3'];

/** The capital candidates' figure order: the tie-break. */
const CAPITAL_ORDER: readonly CapitalChoice[] = ['working_capital', 'kfd', 'lgd', 'oml'];

const CAPITAL_LABEL: Readonly<Record<CapitalChoice, MessageId>> = {
  working_capital: 'oversikt.capital.workingCapital',
  kfd: 'fig.kfd',
  lgd: 'fig.lgd',
  oml: 'fig.oml',
};

/** The slots of one item, in the order they were added. */
class SlotTable {
  readonly #slots = new Map<string, Slot>();

  add(id: string, text: string, value: Decimal | null): PayloadSlot {
    if (this.#slots.has(id)) throw new Error(`slot ${id} twice`);
    this.#slots.set(id, { id, text, value: value === null ? null : toWire(value) });
    return { id, text };
  }

  sorted(): Slot[] {
    return [...this.#slots.values()].sort((a, b) => compareBytes(a.id, b.id));
  }
}

function compareBytes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type Compared = Extract<Comparison, { readonly kind: 'compared' }>;

function rowOf(rows: readonly KeyFigureRow[], key: FigureKey): KeyFigureRow {
  const row = rows.find((candidate) => candidate.key === key);
  if (row === undefined) throw new Error(`the key-figure rows have no ${key}`);
  return row;
}

/** The side of the median the own value lies on, compared exactly (numeric, as `heroContext`). */
function directionText(comparison: Compared): string {
  const side = comparison.subject.gt(comparison.median) ? 'above' : comparison.subject.lt(comparison.median) ? 'below' : 'equal';
  return t(DIRECTION[side]);
}

/**
 * A compared figure's slots: own value, median, beste fjerdedel,
 * Plassering and direction, each worded by the table's row.
 */
function figureSlots(table: SlotTable, key: string, row: KeyFigureRow, comparison: Compared): PayloadSlot[] {
  const shown = row.comparison;
  if (shown.kind !== 'compared' || comparison.best === null) throw new Error(`${key} is compared with a beste fjerdedel`);
  return [
    table.add(`${key}.egen`, row.own.text, comparison.subject),
    table.add(`${key}.median`, shown.median, comparison.median),
    table.add(`${key}.beste`, shown.best.text, comparison.best.quartile),
    table.add(`${key}.plassering`, shown.placement.text, comparison.best.percentile),
    table.add(`${key}.retning`, directionText(comparison), null),
  ];
}

/** Which way is better, for the payload: a figure without a direction is never named. */
function betterOf(key: FigureKey, api: ApiBenchmark, document: DocumentBenchmark): 'higher' | 'lower' {
  const { direction } = rowBenchmark(key, api, document);
  if (direction === 'none') throw new Error(`${key} has no direction and is named`);
  return direction === 'higher_is_better' ? 'higher' : 'lower';
}

type CapitalAmount = { readonly figure: CapitalChoice; readonly ore: Decimal };

/**
 * The capital gaps the payload names, in order: `largestCapitalGap`'s
 * candidates, (9) and (10) beside the total when both are amounts, the
 * largest exact amount first, ties in figure order, at most three.
 */
export function capitalGapOrder(document: DocumentBenchmark): CapitalAmount[] {
  const kfd: CapitalGap = document.kfd.gap;
  const lgd: CapitalGap = document.lgd.gap;
  const choice = largestCapitalGap(kfd, lgd, document.oml.gap);
  if (choice.kind !== 'amount') return [];
  const amounts: CapitalAmount[] = [...choice.candidates];
  if (kfd.kind === 'amount' && lgd.kind === 'amount') {
    amounts.push({ figure: 'kfd', ore: kfd.ore }, { figure: 'lgd', ore: lgd.ore });
  }
  return amounts
    .sort((a, b) => b.ore.comparedTo(a.ore) || CAPITAL_ORDER.indexOf(a.figure) - CAPITAL_ORDER.indexOf(b.figure))
    .slice(0, RANK.length);
}

/** The strengths, ranked as Største styrke ranks them: whole percent of Plassering, ties to the lower figure number. */
export function strengthOrder(api: ApiBenchmark, document: DocumentBenchmark): FigureKey[] {
  const ranked: { readonly key: FigureKey; readonly rank: Decimal }[] = [];
  // KEY_FIGURE_ROWS is in figure-number order, as strengthCard reads it.
  for (const key of Object.keys(KEY_FIGURE_ROWS) as FigureKey[]) {
    if (NEVER_STRENGTH.has(key)) continue;
    const { direction, comparison } = rowBenchmark(key, api, document);
    if (direction === 'none' || comparison.kind !== 'compared' || comparison.best === null) continue;
    if (!atOrBeyondBest(comparison, direction)) continue;
    ranked.push({ key, rank: wholePercent(comparison.best.percentile.toString()) });
  }
  // Array.prototype.sort is stable: an equal rank keeps the lower figure number first.
  return ranked.sort((a, b) => b.rank.comparedTo(a.rank)).map((entry) => entry.key);
}

/** The analysis behind one company's payload, as the digest reads it. */
export type AnalysisWire = {
  readonly subject: string;
  readonly filing_year: number;
  readonly band: SizeBand;
  /** The peers in the analysis, in byte order. */
  readonly peers: readonly string[];
  readonly slots: readonly Slot[];
};

/** The digest of an analysis's wire encoding (AD-13): the one digest function. */
export function analysisDigest(wire: AnalysisWire): string {
  return digest({
    subject: wire.subject,
    filing_year: wire.filing_year,
    band: wire.band,
    peers: [...wire.peers],
    slots: wire.slots.map((slot) => ({ id: slot.id, text: slot.text, value: slot.value })),
  });
}

type Peer = { readonly orgnr: string };

/**
 * The payload of a shown group with at least one peer in the analysis. The
 * caller has the default group (`defaultAnalysis`); this reads only what
 * the engine computed over it.
 */
export function explanationAnalysis<P extends Peer>(
  subject: string,
  shown: ShownGroup<P>,
  basis: DocumentBasis['kind'],
  band: SizeBand = DEFAULT_BAND,
): ExplanationAnalysis {
  if (shown.analysisCount === 0) throw new RangeError('an empty group has no explanation');
  const api = shown.benchmark;
  const document = shown.documentBenchmark;
  const rows = keyFigureRows(api, document, shown.filingYear);
  const table = new SlotTable();

  const year = table.add(YEAR_SLOT, String(shown.filingYear), new Decimal(shown.filingYear));
  const peerCount = table.add(COUNT_SLOT, String(shown.analysisCount), new Decimal(shown.analysisCount));

  const profit: PayloadItem[] = [];
  const margin = api.driftsmargin;
  if (margin.gap.kind === 'amount' && margin.comparison.kind === 'compared') {
    const row = rowOf(rows, 'driftsmargin');
    profit.push({
      name: row.label,
      better: betterOf('driftsmargin', api, document),
      slots: [
        ...figureSlots(table, 'driftsmargin', row, margin.comparison),
        table.add('driftsmargin.gap', formatKronerExact(margin.gap.ore.toString()), margin.gap.ore),
      ],
    });
  }

  const capital: PayloadItem[] = capitalGapOrder(document).map((amount, at) => {
    const rank = RANK[at];
    if (rank === undefined) throw new Error('more capital gaps than rank words');
    const gap = table.add(`${idOf(amount.figure)}.gap`, formatKronerExact(amount.ore.toString()), amount.ore);
    const rang = table.add(`${idOf(amount.figure)}.rang`, t(rank), null);
    if (amount.figure === 'working_capital') return { name: t(CAPITAL_LABEL.working_capital), slots: [gap, rang] };
    const figure = document[amount.figure];
    if (figure.comparison.kind !== 'compared') throw new Error(`${amount.figure} has an amount and no comparison`);
    const row = rowOf(rows, amount.figure);
    return {
      name: row.label,
      better: betterOf(amount.figure, api, document),
      slots: [...figureSlots(table, amount.figure, row, figure.comparison), gap, rang],
    };
  });

  // A strength is named once: a figure already named as a gap is never a strength (a gap is worse than T).
  const strengths: PayloadItem[] = strengthOrder(api, document).map((key) => {
    const { comparison } = rowBenchmark(key, api, document);
    if (comparison.kind !== 'compared') throw new Error(`${key} is a strength without a comparison`);
    const row = rowOf(rows, key);
    return { name: row.label, better: betterOf(key, api, document), slots: figureSlots(table, key, row, comparison) };
  });

  const notes: PayloadSlot[] =
    basis === 'not_in_dataset' ? [table.add(MISSING_DOCUMENT_SLOT, t('keyFigures.notInDataset.state'), null)] : [];

  const slots = table.sorted();
  const peers = shown.peers.map((peer) => peer.orgnr).sort(compareBytes);
  return {
    payload: {
      slot_fields: SLOT_FIELD_MEANINGS,
      year,
      peer_count: peerCount,
      profit_gaps_per_year: profit,
      capital_gaps_one_off: capital,
      strengths,
      notes,
    },
    slots,
    digest: analysisDigest({ subject, filing_year: shown.filingYear, band, peers, slots }),
    filingYear: shown.filingYear,
  };
}

function idOf(figure: CapitalChoice): string {
  return figure === 'working_capital' ? WORKING_CAPITAL : figure;
}

/** The subject's filing as the default analysis reads it. */
export type DefaultFiling = Pick<
  SubjectFiling,
  'keyFigures' | 'valuta' | 'regnskapsregler' | 'smaaForetak' | 'avviklingsregnskap' | 'filingYear' | 'documentBasis'
>;

/** A candidate as `shownGroup` reads it. */
export type DefaultCandidate = CandidateFiling & {
  readonly keyFigures: SubjectKeyFigures;
  readonly documentBasis: DocumentBasis;
  readonly documentReadAt: Date | null;
};

/** One company's default analysis: empty (with the funnel's reason, null when no stage gave one), or its explanation input. */
export type DefaultAnalysis<P extends DefaultCandidate> =
  | { readonly kind: 'empty'; readonly reason: EmptyReason; readonly shown: ShownGroup<P> }
  | { readonly kind: 'analysis'; readonly analysis: ExplanationAnalysis; readonly shown: ShownGroup<P> };

/**
 * The default analysis of a subject with a peer group: stages 1–5 at the
 * standard band under `V1_FUNNEL`, no `ekskl`, as the analysis page
 * assembles it (src/components/analysis/analysis-page.tsx).
 */
export function defaultAnalysis<P extends DefaultCandidate>(
  funnel: FunnelSubject,
  filing: DefaultFiling,
  candidates: readonly P[],
): DefaultAnalysis<P> {
  const group = assemblePeerGroup(funnel, candidates, DEFAULT_BAND, V1_FUNNEL);
  const shown = shownGroup(group, [], filing);
  if (shown.analysisCount === 0) return { kind: 'empty', reason: shown.emptyReason, shown };
  return { kind: 'analysis', analysis: explanationAnalysis(funnel.orgnr, shown, filing.documentBasis.kind), shown };
}
