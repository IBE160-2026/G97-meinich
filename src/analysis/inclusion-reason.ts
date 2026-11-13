// "Hvorfor med" (Story 2.7; FR-16): why a peer is in the group, written by
// rules from the profile fields it shares with the subject. The model
// classifies; it never writes the justification, so the input type holds no
// classification and the text carries no ✦. Same inputs, same text.
//
//   "Samme bransje, omsetning {forhold}× {selskap}"
//
// then at most two fingerprint categories that are known and equal on both
// sides, in the type rule's order (src/engine/fingerprint.ts): cost of
// goods, inventory, capitalised intangibles, personnel cost, asset
// intensity. {forhold} is the peer's revenue over the subject's, an exact
// Decimal shown with formatMultiple; {andel} is INTANGIBLES_SHARE as a
// whole percent. Bands are named only as "i samme bånd": no share, and no
// band, reaches the page as a value.
import { Decimal } from '../engine/decimal.ts';
import { INTANGIBLES_SHARE, type BandRange, type Fingerprint } from '../engine/fingerprint.ts';
import { formatMultiple, formatWholePercent } from '../engine/format.ts';
import type { SubjectFiling } from '../engine/peers.ts';
import { t, type MessageId } from '../messages/index.ts';

/** The profile fields the reason reads: no model field. */
export type ProfileFields = Pick<SubjectFiling, 'naeringskode1' | 'sumDriftsinntekter' | 'fingerprint'>;

/** At most this many shared categories are named. */
export const MAX_TRAITS = 2;

const sameBand = (a: BandRange, b: BandRange): boolean => a.lo === a.hi && b.lo === b.hi && a.lo === b.lo;

/** The shared categories' message ids and values, in the type rule's order. */
function sharedTraits(subject: Fingerprint, peer: Fingerprint): string[] {
  const andel = formatWholePercent(INTANGIBLES_SHARE.mul(100).toString());
  const traits: { readonly shared: boolean; readonly id: MessageId; readonly vars?: Record<string, string> }[] = [
    { shared: sameBand(subject.costOfGoods, peer.costOfGoods), id: 'peers.reason.costOfGoods' },
    {
      shared: subject.inventory !== null && subject.inventory === peer.inventory,
      id: subject.inventory === true ? 'peers.reason.inventory.yes' : 'peers.reason.inventory.no',
    },
    {
      shared: subject.capitalisedIntangibles !== null && subject.capitalisedIntangibles === peer.capitalisedIntangibles,
      id: subject.capitalisedIntangibles === true ? 'peers.reason.intangibles.yes' : 'peers.reason.intangibles.no',
      vars: { andel },
    },
    { shared: sameBand(subject.personnelCost, peer.personnelCost), id: 'peers.reason.personnelCost' },
    { shared: sameBand(subject.assetIntensity, peer.assetIntensity), id: 'peers.reason.assetIntensity' },
  ];
  return traits
    .filter((trait) => trait.shared)
    .slice(0, MAX_TRAITS)
    .map((trait) => t(trait.id, trait.vars));
}

/**
 * The reason for one peer of the group. `subjectName` is the subject as the
 * page names it (its name, or its orgnr grouped 3-3-3). Throws a TypeError
 * when the two are not in one industry or either lacks positive revenue:
 * funnel stage 1 admits no such peer, so it would be a bug, never a row.
 */
export function inclusionReason(subject: ProfileFields, peer: ProfileFields, subjectName: string): string {
  if (subject.naeringskode1 === null || subject.naeringskode1 !== peer.naeringskode1) {
    throw new TypeError('inclusionReason: the peer is not in the subject’s industry');
  }
  const s = subject.sumDriftsinntekter;
  const p = peer.sumDriftsinntekter;
  if (s === null || p === null || s <= 0n || p <= 0n) {
    throw new TypeError('inclusionReason: revenue missing or not positive');
  }
  const forhold = new Decimal(p.toString()).div(new Decimal(s.toString()));
  const parts = [t('peers.reason.base', { forhold: formatMultiple(forhold.toString()), selskap: subjectName })];
  if (subject.fingerprint !== null && peer.fingerprint !== null) {
    parts.push(...sharedTraits(subject.fingerprint, peer.fingerprint));
  }
  return parts.join(', ');
}
