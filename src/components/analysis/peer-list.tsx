// The Peers tab (Stories 1.7, 2.7; FR-15, FR-16, UX-DR37, UX-DR68): the
// count, the funnel, then one row per peer — Selskap · Omsetning ·
// Driftsmargin · Hvorfor med · Grunnlag for treff · flag — by revenue
// descending, then orgnr. A server component: it renders the display rows
// of src/analysis/peer-rows.ts, so only the strings shown reach the page
// (AD-4). Rows are never keyed by orgnr, because a React key travels in the
// RSC payload, and no row carries one.
//
// ✦ (ai-mark.tsx) marks the two bases that rest on a classification and
// the flag, never the reason or a number; screen readers hear "KI-generert"
// once per cell. The caption carries the visible key.
//
// From `md` the list is a table in its own horizontal scroll region
// (`.scroll-region` in globals.css), so it may be wider than the screen
// while the page body never scrolls sideways. Below `md` it is one card per
// peer, the first PHONE_CARDS shown and the rest sent as strings to
// "Vis alle {n}", which draws them in the client only when pressed.
// A subject that cannot have peers shows its sentence and no funnel: the
// zeros would only repeat it.
import type { PeerDisplayRow } from '@/analysis/peer-rows';
import type { EmptyReason, FunnelCounts } from '@/engine/peers';
import { t } from '@/messages';
import { AiMark } from './ai-mark';
import { Basis, CARD_LIST_CLASS, Flag, PeerCard, type PeerCardLabels } from './peer-card';
import { PeerFunnel } from './peer-funnel';
import { ShowAllToggle } from './show-all-toggle';

/** Cards shown on the phone before "Vis alle {n}" (Meinich, 2026-11-13). */
export const PHONE_CARDS = 8;

const HIDDEN_CARDS_ID = 'flere-sammenlignbare';

/**
 * The Peers tab's sentence for an empty group: the subject's own reason, or
 * none found. The Oversikt hero shows the same sentence (Story 1.9).
 */
export function emptyText(emptyReason: EmptyReason, filingYear: number): string {
  if (emptyReason === 'subject_no_revenue') return t('peers.noRevenue', { aar: String(filingYear) });
  if (emptyReason === 'subject_non_calendar') return t('peers.nonCalendar');
  return t('peers.none');
}

// The table's cells are styled from the table, not cell by cell, so a large
// group's page stays small: columns 2 and 3 are figures, right-aligned.
const TABLE_CLASS =
  'w-full border-collapse text-left text-[13px] [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold [&_td]:py-2 [&_td]:pr-4 ' +
  '[&_tbody_tr]:border-b [&_tbody_tr]:border-divider [&_tbody_tr]:align-top [&_td:first-child]:min-w-40 [&_td:first-child]:break-words ' +
  '[&_:is(td,th):is(:nth-child(2),:nth-child(3))]:text-right [&_:is(td,th):is(:nth-child(2),:nth-child(3),:nth-child(5))]:whitespace-nowrap ' +
  '[&_td:is(:nth-child(2),:nth-child(3))]:figure [&_td:nth-child(4)]:min-w-56';

function PeerTable({ rows }: { readonly rows: readonly PeerDisplayRow[] }) {
  const ki = t('peers.ai');
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={t('peers.regionLabel')}
      className="scroll-region mt-4 hidden md:block"
    >
      <table className={TABLE_CLASS}>
        <caption className="caption-bottom pt-2 text-left text-[12px] text-slate">
          <span className="sr-only">{`${t('peers.regionLabel')}. `}</span>
          <AiMark spoken={false} />
          {ki}
        </caption>
        <thead>
          <tr className="border-b border-divider text-slate">
            <th scope="col">{t('peers.col.selskap')}</th>
            <th scope="col">{t('peers.col.omsetning')}</th>
            <th scope="col">{t('fig.driftsmargin')}</th>
            <th scope="col">{t('peers.col.reason')}</th>
            <th scope="col">{t('peers.col.basis')}</th>
            <th scope="col">
              <span className="sr-only">{t('peers.col.flag')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // The position is the key: the list is static per render.
            <tr key={index}>
              <td>{row.navn}</td>
              <td>{row.omsetning}</td>
              <td>{row.driftsmargin}</td>
              <td>{row.hvorforMed}</td>
              <td>
                <Basis row={row} ki={ki} />
              </td>
              <td>{row.flagg === null ? null : <Flag text={row.flagg} ki={ki} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The labels every card shows, from the messages, as strings the client toggle can take. */
function cardLabels(): PeerCardLabels {
  return {
    omsetning: t('peers.col.omsetning'),
    driftsmargin: t('fig.driftsmargin'),
    reason: t('peers.col.reason'),
    basis: t('peers.col.basis'),
    ki: t('peers.ai'),
  };
}

function PeerCards({ rows }: { readonly rows: readonly PeerDisplayRow[] }) {
  const labels = cardLabels();
  const rest = rows.slice(PHONE_CARDS);
  return (
    <div className="mt-4 md:hidden" data-testid="peer-cards">
      <ul className={CARD_LIST_CLASS}>
        {rows.slice(0, PHONE_CARDS).map((row, index) => (
          <PeerCard key={index} row={row} labels={labels} first={false} />
        ))}
      </ul>
      {/* The rest reach the client as strings and are drawn only on "Vis alle". */}
      {rest.length > 0 ? (
        <ShowAllToggle
          listId={HIDDEN_CARDS_ID}
          label={t('peers.showAll', { n: String(rows.length) })}
          rows={rest}
          labels={labels}
        />
      ) : null}
      <p className="m-0 mt-2 text-[12px] text-slate">
        <AiMark spoken={false} />
        {labels.ki}
      </p>
    </div>
  );
}


export function PeerList({
  rows,
  counts,
  emptyReason,
  filingYear,
}: {
  readonly rows: readonly PeerDisplayRow[];
  readonly counts: FunnelCounts;
  readonly emptyReason: EmptyReason;
  /** The subject's benchmark year, named when it has no revenue to compare. */
  readonly filingYear: number;
}) {
  return (
    <div className="mt-2">
      <p className="m-0 text-slate" data-testid="peer-count">
        {rows.length === 1 ? t('peers.countOne') : t('peers.count', { n: String(rows.length) })}
      </p>
      {emptyReason !== null ? (
        <p className="m-0 mt-4">{emptyText(emptyReason, filingYear)}</p>
      ) : (
        <>
          <PeerFunnel counts={counts} />
          {rows.length === 0 ? (
            <p className="m-0 mt-4">{emptyText(emptyReason, filingYear)}</p>
          ) : (
            <>
              <PeerTable rows={rows} />
              <PeerCards rows={rows} />
            </>
          )}
        </>
      )}
    </div>
  );
}
