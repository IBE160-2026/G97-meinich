// The Peers tab's rows (Story 2.7; FR-16, AD-4): each peer of the shown
// group as the strings the list shows, and nothing else. No orgnr, no
// municipality, no øre amount, no fingerprint category and no business
// type leaves this module: the components render these rows, so the page
// can carry only what is on it.
//
//   navn          the name, or the orgnr grouped 3-3-3 when it has none
//   omsetning     revenue in millions, or "Ikke i kroner" outside NOK
//   driftsmargin  the value the benchmark uses (computeApiKeyFigures), or
//                 "Kan ikke beregnes: …" with its reason
//   hvorforMed    the rules-written reason (inclusion-reason.ts)
//   grunnlag      the match basis (src/engine/peers.ts matchBasis)
//   grunnlagKi    whether the basis rests on a classification (✦)
//   flagg         "Usikker klassifisering", or null
import { apiInputsFromRow } from '../engine/inputs.ts';
import { computeApiKeyFigures } from '../engine/key-figures.ts';
import { formatMillions, formatOrgnr, formatPercent } from '../engine/format.ts';
import { matchBasis, type CandidateFiling, type MatchBasis, type SubjectFiling } from '../engine/peers.ts';
import { undefinedText } from '../components/analysis/api-figures.tsx';
import { t, type MessageId } from '../messages/index.ts';
import { inclusionReason } from './inclusion-reason.ts';
import type { SubjectKeyFigures } from './view.ts';

/** What a row is built from: a group member as the candidate read gives it. */
export type PeerInput = CandidateFiling & {
  readonly navn: string | null;
  readonly keyFigures: SubjectKeyFigures;
};

export type PeerDisplayRow = {
  readonly navn: string;
  readonly omsetning: string;
  readonly driftsmargin: string;
  readonly hvorforMed: string;
  readonly grunnlag: string;
  /** The basis rests on the model's classification: shown with ✦ and "KI-generert". */
  readonly grunnlagKi: boolean;
  /** "Usikker klassifisering" for a flagged peer; null otherwise. */
  readonly flagg: string | null;
};

/** Each basis's label, and whether it rests on a classification. Exhaustive by type. */
export const BASIS_DISPLAY: Readonly<Record<MatchBasis, { readonly label: MessageId; readonly ki: boolean }>> = {
  description_and_accounts: { label: 'peers.basis.description_and_accounts', ki: true },
  accounts_only: { label: 'peers.basis.accounts_only', ki: false },
  description_only: { label: 'peers.basis.description_only', ki: true },
  industry_and_size_only: { label: 'peers.basis.industry_and_size_only', ki: false },
};

function revenueText(peer: PeerInput, valuta: string | null): string {
  // The formatter writes "kr" whatever the currency: another valuta shows
  // the words, never a wrong unit.
  if (valuta !== 'NOK' || peer.sumDriftsinntekter === null) return t('peers.otherCurrency');
  return formatMillions(peer.sumDriftsinntekter.toString());
}

function marginText(peer: PeerInput): string {
  const result = computeApiKeyFigures(apiInputsFromRow(peer.keyFigures)).driftsmargin;
  if (result.kind === 'value') return formatPercent(result.value.toString());
  return undefinedText(result.absence, 'analysis.figures.reason.revenueNotPositive');
}

/**
 * The rows for `peers`, in their order. `subject` is the funnel's subject
 * filing, `subjectName` its name as the page shows it, `flagged` the
 * funnel's flagged orgnrs and `valuta` the group's currency.
 */
export function peerRows(
  subject: SubjectFiling,
  subjectName: string,
  peers: readonly PeerInput[],
  flagged: readonly string[],
  valuta: string | null,
): PeerDisplayRow[] {
  const isFlagged = new Set(flagged);
  return peers.map((peer) => {
    const basis = BASIS_DISPLAY[matchBasis(subject, peer)];
    return {
      navn: peer.navn ?? formatOrgnr(peer.orgnr),
      omsetning: revenueText(peer, valuta),
      driftsmargin: marginText(peer),
      hvorforMed: inclusionReason(subject, peer, subjectName),
      grunnlag: t(basis.label),
      grunnlagKi: basis.ki,
      flagg: isFlagged.has(peer.orgnr) ? t('peers.flag') : null,
    };
  });
}
