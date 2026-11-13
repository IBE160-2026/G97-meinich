// The peer group as the analysis page shows it, the funnel's counts and
// flagged peers (Story 2.7), and the subject's three API
// figures benchmarked against it (Stories 1.7–1.8, 2.5). Pure: the peer
// group at the URL's band, the `ekskl` list and the subject's filing in;
// the shown group (the group after funnel stage 4, minus `ekskl`, the same
// group the Peers tab lists) and the benchmark out. The choice of the
// stage-4 group over the stage 1–3 pool is made here, where it is tested
// (test/analysis/shown-group.test.ts). Story 2.8: the Peers tab lists the
// whole group, excluded peers marked, so `members` keeps them, while
// `peers`, the benchmark, `analysisCount` and the funnel's flagged count
// leave them out. The subject's
// own `valuta` goes to the engine, which gives no kroner amount for a filing
// not in NOK.
import { benchmarkApiFigures, type ApiBenchmark } from '../engine/benchmark.ts';
import { apiInputsFromRow } from '../engine/inputs.ts';
import { withoutExcluded, type EmptyReason, type FunnelCounts } from '../engine/peers.ts';
import type { SubjectFiling, SubjectKeyFigures } from './view.ts';

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
  /** The subject's filing's smaaForetak, for the non-small notice. */
  readonly smaaForetak: boolean | null;
  /** The group's currency, the subject's: stage 2 makes every peer's equal. */
  readonly valuta: string | null;
  readonly emptyReason: EmptyReason;
  /** The subject's benchmark year. */
  readonly filingYear: number;
};

/** What shownGroup reads of a peer group (src/engine/peers.ts PeerGroup). */
export type FunnelResult<P> = {
  /** Stages 1–3: never shown or aggregated here. */
  readonly pool: readonly P[];
  /** The pool after stage 4. */
  readonly group: readonly P[];
  readonly flagged: readonly string[];
  readonly counts: FunnelCounts;
  readonly emptyReason: EmptyReason;
};

export function shownGroup<P extends { readonly orgnr: string; readonly keyFigures: SubjectKeyFigures }>(
  funnel: FunnelResult<P>,
  ekskl: readonly string[],
  filing: Pick<SubjectFiling, 'keyFigures' | 'valuta' | 'smaaForetak' | 'filingYear'>,
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
    smaaForetak: filing.smaaForetak,
    valuta: filing.valuta,
    emptyReason,
    filingYear: filing.filingYear,
  };
}
