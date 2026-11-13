// The peer group as the analysis page shows it, and the subject's three API
// figures benchmarked against it (Stories 1.7–1.8, 2.5). Pure: the peer
// group at the URL's band, the `ekskl` list and the subject's filing in;
// the shown group (the group after funnel stage 4, minus `ekskl`, the same
// group the Peers tab lists) and the benchmark out. The choice of the
// stage-4 group over the stage 1–3 pool is made here, where it is tested
// (test/analysis/shown-group.test.ts). The subject's
// own `valuta` goes to the engine, which gives no kroner amount for a filing
// not in NOK.
import { benchmarkApiFigures, type ApiBenchmark } from '../engine/benchmark.ts';
import { apiInputsFromRow } from '../engine/inputs.ts';
import { withoutExcluded, type EmptyReason } from '../engine/peers.ts';
import type { SubjectFiling, SubjectKeyFigures } from './view.ts';

export type ShownGroup<P> = {
  readonly peers: readonly P[];
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
  readonly emptyReason: EmptyReason;
};

export function shownGroup<P extends { readonly orgnr: string; readonly keyFigures: SubjectKeyFigures }>(
  funnel: FunnelResult<P>,
  ekskl: readonly string[],
  filing: Pick<SubjectFiling, 'keyFigures' | 'valuta' | 'smaaForetak' | 'filingYear'>,
): ShownGroup<P> {
  const emptyReason = funnel.emptyReason;
  const peers = withoutExcluded(funnel.group, ekskl);
  return {
    peers,
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
