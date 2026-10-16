// The peer group as the analysis page shows it, and the subject's three API
// figures benchmarked against it (Stories 1.7–1.8). Pure: the pool at the
// URL's band, the `ekskl` list and the subject's filing in; the shown group
// (the pool minus `ekskl`, the same group the Peers tab lists) and the
// benchmark out. The subject's own `valuta` goes to the engine, which gives
// no kroner amount for a filing not in NOK.
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

export function shownGroup<P extends { readonly orgnr: string; readonly keyFigures: SubjectKeyFigures }>(
  pool: readonly P[],
  ekskl: readonly string[],
  emptyReason: EmptyReason,
  filing: Pick<SubjectFiling, 'keyFigures' | 'valuta' | 'smaaForetak' | 'filingYear'>,
): ShownGroup<P> {
  const peers = withoutExcluded(pool, ekskl);
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
