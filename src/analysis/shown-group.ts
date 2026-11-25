// The peer group as the analysis page shows it, the funnel's counts and
// flagged peers (Story 2.7), and the subject's three API
// figures benchmarked against it (Stories 1.7–1.8, 2.5). Pure: the peer
// group at the URL's band, the `ekskl` list and the subject's filing in;
// the shown group (the group after funnel stages 4 and 5, minus `ekskl`, the
// same group the Peers tab lists) and the benchmark out. The choice of the
// group after stages 4 and 5 over the stage 1–3 pool is made here, where it is tested
// (test/analysis/shown-group.test.ts). Story 2.8: the Peers tab lists the
// whole group, excluded peers marked, so `members` keeps them, while
// `peers`, the benchmark, `analysisCount` and the funnel's flagged count
// leave them out. The subject's
// own `valuta` goes to the engine, which gives no kroner amount for a filing
// not in NOK.
//
// Story 3.1b: the twelve document figures are benchmarked here too, from
// the subject's and each peer's document basis, against the same peers (the
// group minus `ekskl`): the engine's `benchmarkDocumentFigures`, as Story
// 3.1a left it. The bases stay on the server; only the key-figure table's
// strings reach the page (src/analysis/key-figure-rows.ts).
//
// Story 3.2: total asset turnover, the return-on-assets decomposition's
// second factor, is benchmarked beside them, over the same peers.
//
// Story 3.3: the margin waterfall against the same peers' document bases,
// for the benchmark year, in the subject's currency.
//
// Story 3.8: what the waterfall's drill-downs say about P beyond the engine's
// result: the group's size, how many peers are outside P by reason, and the
// range of P's document read dates. Counts and two dates only; no peer's
// date, line or name leaves here.
//
// Story 5.4 (FR-64): the same for each capital figure's comparison, (9),
// (10) and (11): how many peers it counts and the range of their document
// read dates, for the drill-down's "Peer-gruppen: Regnskapsår …" line.
import {
  benchmarkApiFigures,
  benchmarkDocumentFigures,
  benchmarkTotalAssetTurnover,
  type ApiBenchmark,
  type DocumentBenchmark,
  type TurnoverBenchmark,
} from '../engine/benchmark.ts';
import type { CapitalFigure } from '../engine/benchmark.ts';
import type { DocumentBasis } from '../engine/document-inputs.ts';
import { documentKeyFigureFractions } from '../engine/document-key-figures.ts';
import type { Comparison } from '../engine/types.ts';
import { commonSetEntry, marginWaterfall, outsideCommonSet, type MarginWaterfall, type OutsideCounts } from '../engine/waterfall.ts';
import { apiInputsFromRow } from '../engine/inputs.ts';
import { firstUnstatedField, withoutExcluded, type EmptyReason, type FunnelCounts, type StatedField } from '../engine/peers.ts';
import type { SubjectFiling, SubjectKeyFigures } from './view.ts';

/** The earliest and latest of a set of document read dates. */
export type ReadDates = { readonly from: Date; readonly to: Date };

/**
 * What a capital figure's drill-down says about the peers its comparison
 * counts (Story 5.4, FR-64): how many, and the range of their document read
 * dates (null when it counts none). Never a peer's own date.
 */
export type ComparedPeerDates = { readonly count: number; readonly readDates: ReadDates | null };

/** What the waterfall's drill-downs say about P (Story 3.8): counts and a date range, never a peer's own. */
export type WaterfallFacts = {
  /** The peers in the analysis (the group minus `ekskl`): "{n} av {gruppe}". */
  readonly groupSize: number;
  /** The peers outside P, by reason. */
  readonly outside: OutsideCounts;
  /** The earliest and latest `register.document.read_at` over P; null when P is empty (decision 5). */
  readonly readDates: ReadDates | null;
};

export type ShownGroup<P> = {
  /** The group minus `ekskl`: the peers in the analysis, which every figure uses. */
  readonly peers: readonly P[];
  /** The whole group after stage 5, in funnel order, excluded peers included: the rows of the Peers list. */
  readonly members: readonly P[];
  /** The `ekskl` orgnrs that are in the group, in group order. An `ekskl` peer stage 4 or 5 removed is not among them. */
  readonly excludedInGroup: readonly string[];
  /** `peers.length`: "{m} i analysen" and the header's count. */
  readonly analysisCount: number;
  /**
   * The funnel's five stage counts (Story 2.7), with the flagged count
   * taken over the peers in the analysis only (Story 2.8): an excluded
   * flagged peer is not counted.
   */
  readonly counts: FunnelCounts;
  /** The funnel's flagged orgnrs, excluded peers included: the Peers list tags them, nothing else reads them. */
  readonly flagged: readonly string[];
  /** The subject's three API figures against `peers` (Story 1.8). */
  readonly benchmark: ApiBenchmark;
  /** Total asset turnover against `peers`: the decomposition's second factor, with its own gate (Story 3.2). */
  readonly turnoverBenchmark: TurnoverBenchmark;
  /** The subject's twelve document figures against `peers`, each from its document basis (Story 3.1b). */
  readonly documentBenchmark: DocumentBenchmark;
  /** The margin waterfall against the peer group as a whole, over `peers` (Story 3.3). */
  readonly waterfall: MarginWaterfall;
  /** What its drill-downs say about P (Story 3.8). */
  readonly waterfallFacts: WaterfallFacts;
  /** Per capital figure, the peers its comparison counts and their read-date range (Story 5.4, FR-64). */
  readonly capitalPeerDates: Readonly<Record<CapitalFigure, ComparedPeerDates>>;
  /** The subject's filing's smaaForetak, for the non-small notice. */
  readonly smaaForetak: boolean | null;
  /** The group's currency, the subject's: stage 2 makes every peer's equal. */
  readonly valuta: string | null;
  readonly emptyReason: EmptyReason;
  /** The first stage-2 field the subject's filing leaves unstated, which `subject_field_not_stated` names; null when all are stated. */
  readonly unstatedField: StatedField | null;
  /** The subject's benchmark year. */
  readonly filingYear: number;
};

/** What shownGroup reads of a peer group (src/engine/peers.ts PeerGroup). */
export type FunnelResult<P> = {
  /** Stages 1–3: never shown or aggregated here. */
  readonly pool: readonly P[];
  /** The pool after stages 4 and 5. */
  readonly group: readonly P[];
  readonly flagged: readonly string[];
  readonly counts: FunnelCounts;
  readonly emptyReason: EmptyReason;
};

/**
 * The subject's driftsmargin compared with the group minus `ekskl`, as
 * `shownGroup` compares it: what the URL module's median-step predicate
 * reads for `andel=median` (Story 3.5, `urlContext`), computed without the
 * rest of the analysis.
 */
export function driftsmarginComparison<P extends { readonly orgnr: string; readonly keyFigures: SubjectKeyFigures }>(
  funnel: Pick<FunnelResult<P>, 'group'>,
  ekskl: readonly string[],
  filing: Pick<SubjectFiling, 'keyFigures' | 'valuta'>,
): Comparison {
  return benchmarkApiFigures(
    apiInputsFromRow(filing.keyFigures),
    withoutExcluded(funnel.group, ekskl).map((peer) => apiInputsFromRow(peer.keyFigures)),
    filing.valuta,
  ).driftsmargin.comparison;
}

type DatedPeer = { readonly documentBasis: DocumentBasis; readonly documentReadAt: Date | null };

/**
 * The earliest and latest read date of `peers`, null when there are none. A
 * peer counted here always has a document row, so one without a date is a
 * bug and throws, naming `what`.
 */
function readDateRange(peers: readonly DatedPeer[], what: string): ReadDates | null {
  let from: Date | null = null;
  let to: Date | null = null;
  for (const peer of peers) {
    const at = peer.documentReadAt;
    if (at === null) throw new Error(`${what} without its document read date`);
    if (from === null || at.getTime() < from.getTime()) from = at;
    if (to === null || at.getTime() > to.getTime()) to = at;
  }
  return from === null || to === null ? null : { from, to };
}

/**
 * The waterfall's facts about P (Story 3.8): the group's size, the counts
 * outside P by reason, and the range of P's document read dates. A member
 * of P always has a document row, so one without a date is a bug and throws.
 */
export function waterfallFacts(peers: readonly DatedPeer[], year: number): WaterfallFacts {
  return {
    groupSize: peers.length,
    outside: outsideCommonSet(
      peers.map((peer) => peer.documentBasis),
      year,
    ),
    readDates: readDateRange(
      peers.filter((peer) => commonSetEntry(peer.documentBasis, year).kind === 'in'),
      'a peer in P',
    ),
  };
}

/**
 * The peers a capital figure's comparison counts (Story 5.4, FR-64): those
 * whose document gives the figure a value, as `benchmarkDocumentFigures`
 * counts them, with the range of their read dates. A peer with a document
 * figure always has a document row, so one without a date throws.
 */
export function comparedPeerDates(peers: readonly DatedPeer[], figure: CapitalFigure): ComparedPeerDates {
  const counted = peers.filter((peer) => documentKeyFigureFractions(peer.documentBasis)[figure].kind === 'value');
  return { count: counted.length, readDates: readDateRange(counted, `a peer with ${figure}`) };
}

export function shownGroup<
  P extends {
    readonly orgnr: string;
    readonly keyFigures: SubjectKeyFigures;
    readonly documentBasis: DocumentBasis;
    readonly documentReadAt: Date | null;
  },
>(
  funnel: FunnelResult<P>,
  ekskl: readonly string[],
  filing: Pick<
    SubjectFiling,
    'keyFigures' | 'valuta' | 'regnskapsregler' | 'smaaForetak' | 'avviklingsregnskap' | 'filingYear' | 'documentBasis'
  >,
): ShownGroup<P> {
  const emptyReason = funnel.emptyReason;
  const peers = withoutExcluded(funnel.group, ekskl);
  const excluded = new Set(ekskl);
  const excludedInGroup = funnel.group.filter((peer) => excluded.has(peer.orgnr)).map((peer) => peer.orgnr);
  const flaggedInAnalysis = funnel.flagged.filter((orgnr) => !excluded.has(orgnr)).length;
  return {
    peers,
    members: funnel.group,
    excludedInGroup,
    analysisCount: peers.length,
    counts: { ...funnel.counts, stage5: { ...funnel.counts.stage5, flagged: flaggedInAnalysis } },
    flagged: funnel.flagged,
    benchmark: benchmarkApiFigures(
      apiInputsFromRow(filing.keyFigures),
      peers.map((peer) => apiInputsFromRow(peer.keyFigures)),
      filing.valuta,
    ),
    turnoverBenchmark: benchmarkTotalAssetTurnover(
      apiInputsFromRow(filing.keyFigures),
      peers.map((peer) => apiInputsFromRow(peer.keyFigures)),
    ),
    documentBenchmark: benchmarkDocumentFigures(
      filing.documentBasis,
      peers.map((peer) => peer.documentBasis),
      filing.valuta,
    ),
    waterfall: marginWaterfall(
      filing.documentBasis,
      peers.map((peer) => peer.documentBasis),
      filing.filingYear,
      filing.valuta,
    ),
    waterfallFacts: waterfallFacts(peers, filing.filingYear),
    capitalPeerDates: {
      kfd: comparedPeerDates(peers, 'kfd'),
      lgd: comparedPeerDates(peers, 'lgd'),
      oml: comparedPeerDates(peers, 'oml'),
    },
    smaaForetak: filing.smaaForetak,
    valuta: filing.valuta,
    emptyReason,
    unstatedField: firstUnstatedField(filing),
    filingYear: filing.filingYear,
  };
}
