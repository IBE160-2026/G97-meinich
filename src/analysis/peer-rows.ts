// The Peers tab's rows (Stories 2.7, 2.8; FR-16, FR-17, AD-4): each peer of
// the group as the strings the list shows, and nothing else. No
// municipality, no øre amount, no fingerprint category and no business
// type leaves this module: the components render these rows, so the page
// can carry only what is on it. The orgnr does (Story 2.8, AD-4 as amended
// on 2026-11-13): "Ekskluder" writes it into the URL. Only a group member
// gets a row; a pool peer stage 4 or 5 removed never does.
//
//   orgnr         the peer's orgnr, for the exclude and restore actions
//   excluded      whether `ekskl` holds it: the row stays, drawn as excluded
//   navn          the name, or the orgnr grouped 3-3-3 when it has none
//   omsetning     revenue in millions, or "Ikke i kroner" outside NOK
//   driftsmargin  the value the benchmark uses (computeApiKeyFigures), or
//                 "Kan ikke beregnes: …" with its reason
//   hvorforMed    the rules-written reason (inclusion-reason.ts)
//
// No match basis ("Grunnlag for treff") and no flag ("Usikker
// klassifisering"): the v1 funnel reads neither signal (V1_FUNNEL, Story
// 5.2), so every basis would be industry and size and no peer is flagged;
// the Peers tab shows neither column (Meinich, 2026-11-15). matchBasis
// stays in the engine for a later stage.
import { apiInputsFromRow } from '../engine/inputs.ts';
import { computeApiKeyFigures } from '../engine/key-figures.ts';
import { formatMillions, formatOrgnr, formatPercent } from '../engine/format.ts';
import { V1_FUNNEL, type CandidateFiling, type FunnelOptions, type FunnelSubject } from '../engine/peers.ts';
import { absenceText } from './figure-text.ts';
import { t } from '../messages/index.ts';
import { inclusionReason } from './inclusion-reason.ts';
import type { SubjectKeyFigures } from './view.ts';

/** What a row is built from: a group member as the candidate read gives it. */
export type PeerInput = CandidateFiling & {
  readonly navn: string | null;
  readonly keyFigures: SubjectKeyFigures;
};

export type PeerDisplayRow = {
  /** Nine digits: what "Ekskluder" adds to `ekskl` and "Ta med igjen" removes. */
  readonly orgnr: string;
  /** In `ekskl`: shown struck through with "Ekskludert" and "Ta med igjen", left out of every figure. */
  readonly excluded: boolean;
  readonly navn: string;
  readonly omsetning: string;
  readonly driftsmargin: string;
  readonly hvorforMed: string;
};

/**
 * A company's Omsetning as every peer list writes it (Story 3.4: the Peers
 * list, Oversikt's compact list, its "Vis tallene" table and the beeswarm's
 * tooltip all call this one function): revenue in millions, or "Ikke i
 * kroner" outside NOK. The formatter writes "kr" whatever the currency:
 * another valuta shows the words, never a wrong unit.
 */
export function peerRevenueText(sumDriftsinntekter: bigint | null, valuta: string | null): string {
  if (valuta !== 'NOK' || sumDriftsinntekter === null) return t('peers.otherCurrency');
  return formatMillions(sumDriftsinntekter.toString());
}

/**
 * A company's Driftsmargin as every peer list writes it (Story 3.4: one
 * string per peer, byte-identical in the Peers list, the compact list and
 * "Vis tallene"): the value the benchmark uses (computeApiKeyFigures), or
 * "Kan ikke beregnes: …" with its reason.
 */
export function peerMarginText(keyFigures: SubjectKeyFigures, filingYear: number): string {
  const result = computeApiKeyFigures(apiInputsFromRow(keyFigures)).driftsmargin;
  if (result.kind === 'value') return formatPercent(result.value.toString());
  return absenceText(result.absence, { denominator: 'analysis.figures.reason.revenueNotPositive', filingYear });
}

/**
 * The rows for `peers`, in their order. `subject` is the funnel's subject
 * filing, `subjectName` its name as the page shows it, `valuta` the group's
 * currency and `ekskl` the URL's exclusions. "Hvorfor med" follows
 * `options` (default V1_FUNNEL): it names fingerprint categories only when
 * the fingerprint signal is on.
 */
export function peerRows(
  subject: FunnelSubject,
  subjectName: string,
  peers: readonly PeerInput[],
  valuta: string | null,
  ekskl: readonly string[] = [],
  options: FunnelOptions = V1_FUNNEL,
): PeerDisplayRow[] {
  const isExcluded = new Set(ekskl);
  return peers.map((peer) => {
    return {
      orgnr: peer.orgnr,
      excluded: isExcluded.has(peer.orgnr),
      navn: peer.navn ?? formatOrgnr(peer.orgnr),
      omsetning: peerRevenueText(peer.sumDriftsinntekter, valuta),
      driftsmargin: peerMarginText(peer.keyFigures, subject.filingYear),
      hvorforMed: inclusionReason(subject, peer, subjectName, options),
    };
  });
}
