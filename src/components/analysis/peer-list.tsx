// The Peers tab's peer group (Story 1.7; FR-8, UX-DR37, UX-DR68): the count,
// then one row per peer — name, benchmark-year revenue, municipality — by
// revenue descending, then orgnr. A server component: only the strings
// shown reach the page (AD-4). An orgnr is rendered only for a peer with no
// name, grouped 3-3-3 in its place, as the spec allows; rows are never keyed
// by orgnr, because a React key travels in the RSC payload.
//
// The table sits in its own horizontal scroll region, so it may be wider
// than a phone while the page body never scrolls sideways.
import type { EmptyReason } from '@/engine/peers';
import { formatKommune, formatMillions, formatOrgnr } from '@/engine/format';
import { t } from '@/messages';

/** What the list reads of one peer. */
export type PeerRow = {
  readonly orgnr: string;
  readonly navn: string | null;
  readonly kommune: string | null;
  /** Øre; never null in a peer group (stage 1 requires revenue). */
  readonly sumDriftsinntekter: bigint | null;
};

/** The Peers tab's sentence for an empty group: the subject's own reason, or none found. */
function emptyText(emptyReason: EmptyReason, filingYear: number): string {
  if (emptyReason === 'subject_no_revenue') return t('peers.noRevenue', { aar: String(filingYear) });
  if (emptyReason === 'subject_non_calendar') return t('peers.nonCalendar');
  return t('peers.none');
}

function revenueText(peer: PeerRow, valuta: string | null): string {
  // The formatter writes "kr" whatever the currency: another valuta shows
  // the words, never a wrong unit.
  if (valuta !== 'NOK' || peer.sumDriftsinntekter === null) return t('peers.otherCurrency');
  return formatMillions(peer.sumDriftsinntekter.toString());
}

export function PeerList({
  peers,
  valuta,
  emptyReason,
  filingYear,
}: {
  readonly peers: readonly PeerRow[];
  /** The group's currency: every peer's equals the subject's (stage 2). */
  readonly valuta: string | null;
  readonly emptyReason: EmptyReason;
  /** The subject's benchmark year, named when it has no revenue to compare. */
  readonly filingYear: number;
}) {
  const rows = peers.map((peer) => ({
    navn: peer.navn ?? formatOrgnr(peer.orgnr),
    omsetning: revenueText(peer, valuta),
    kommune: peer.kommune === null ? t('peers.unknownKommune') : formatKommune(peer.kommune),
  }));
  return (
    <div className="mt-2">
      <p className="m-0 text-slate" data-testid="peer-count">
        {rows.length === 1 ? t('peers.countOne') : t('peers.count', { n: String(rows.length) })}
      </p>
      {rows.length === 0 ? (
        <p className="m-0 mt-4">{emptyText(emptyReason, filingYear)}</p>
      ) : (
        <div
          role="region"
          tabIndex={0}
          aria-label={t('peers.regionLabel')}
          className="mt-4 max-w-full overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
        >
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{t('peers.regionLabel')}</caption>
            <thead>
              <tr className="border-b border-divider text-[13px] text-slate">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  {t('peers.col.selskap')}
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold whitespace-nowrap">
                  {t('peers.col.omsetning')}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {t('peers.col.kommune')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                // The position is the key: the list is static per render,
                // and an orgnr key would reach the payload.
                <tr key={index} className="border-b border-divider">
                  <td className="py-2 pr-4 break-words">{row.navn}</td>
                  <td className="figure py-2 pr-4 text-right whitespace-nowrap">{row.omsetning}</td>
                  <td className="py-2">{row.kommune}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
