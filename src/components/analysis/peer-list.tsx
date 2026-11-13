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
// peer, the first PHONE_CARDS shown and the rest behind "Vis alle {n}".
// A subject that cannot have peers shows its sentence and no funnel: the
// zeros would only repeat it.
import type { PeerDisplayRow } from '@/analysis/peer-rows';
import type { EmptyReason, FunnelCounts } from '@/engine/peers';
import { t } from '@/messages';
import { AiMark } from './ai-mark';
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

/** The basis, ✦ first when it rests on a classification. */
function Basis({ row }: { readonly row: PeerDisplayRow }) {
  return (
    <span data-testid="peer-basis">
      {row.grunnlagKi ? <AiMark /> : null}
      {row.grunnlag}
    </span>
  );
}

/** The flag as a slate tag. `spoken` false when its cell has said "KI-generert" already. */
function Flag({ text, spoken }: { readonly text: string; readonly spoken: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-sm border border-input-border px-1.5 text-[11.5px] font-semibold whitespace-nowrap text-slate"
      data-testid="peer-flag"
    >
      <AiMark spoken={spoken} />
      {text}
    </span>
  );
}

function PeerTable({ rows }: { readonly rows: readonly PeerDisplayRow[] }) {
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={t('peers.regionLabel')}
      className="scroll-region mt-4 hidden md:block"
    >
      <table className="w-full border-collapse text-left text-[13px]">
        <caption className="caption-bottom pt-2 text-left text-[12px] text-slate">
          <span className="sr-only">{`${t('peers.regionLabel')}. `}</span>
          <AiMark spoken={false} />
          {t('peers.ai')}
        </caption>
        <thead>
          <tr className="border-b border-divider text-slate">
            <th scope="col" className="py-2 pr-4 font-semibold">
              {t('peers.col.selskap')}
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold whitespace-nowrap">
              {t('peers.col.omsetning')}
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold whitespace-nowrap">
              {t('fig.driftsmargin')}
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              {t('peers.col.reason')}
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold whitespace-nowrap">
              {t('peers.col.basis')}
            </th>
            <th scope="col" className="py-2 font-semibold">
              <span className="sr-only">{t('peers.col.flag')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // The position is the key: the list is static per render.
            <tr key={index} className="border-b border-divider align-top">
              <td className="min-w-40 py-2 pr-4 break-words">{row.navn}</td>
              <td className="figure py-2 pr-4 text-right whitespace-nowrap">{row.omsetning}</td>
              <td className="figure py-2 pr-4 text-right whitespace-nowrap">{row.driftsmargin}</td>
              <td className="min-w-56 py-2 pr-4">{row.hvorforMed}</td>
              <td className="py-2 pr-4 whitespace-nowrap">
                <Basis row={row} />
              </td>
              <td className="py-2">{row.flagg === null ? null : <Flag text={row.flagg} spoken />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeerCard({ row, first }: { readonly row: PeerDisplayRow; readonly first: boolean }) {
  return (
    <li className="border-b border-divider py-3" data-testid="peer-card">
      {/* The first card behind "Vis alle" takes focus when it opens. */}
      <p className="m-0 font-semibold break-words" tabIndex={first ? -1 : undefined}>
        {row.navn}
      </p>
      <dl className="m-0 mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-slate">{t('peers.col.omsetning')}</dt>
        <dd className="figure m-0">{row.omsetning}</dd>
        <dt className="text-slate">{t('fig.driftsmargin')}</dt>
        <dd className="figure m-0">{row.driftsmargin}</dd>
        <dt className="text-slate">{t('peers.col.reason')}</dt>
        <dd className="m-0 break-words">{row.hvorforMed}</dd>
        <dt className="text-slate">{t('peers.col.basis')}</dt>
        {/* Basis and flag share this cell: "KI-generert" is said once for both. */}
        <dd className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Basis row={row} />
          {row.flagg === null ? null : <Flag text={row.flagg} spoken={!row.grunnlagKi} />}
        </dd>
      </dl>
    </li>
  );
}

function PeerCards({ rows }: { readonly rows: readonly PeerDisplayRow[] }) {
  const shown = rows.slice(0, PHONE_CARDS);
  const rest = rows.slice(PHONE_CARDS);
  return (
    <div className="mt-4 md:hidden" data-testid="peer-cards">
      <ul className="m-0 list-none p-0">
        {shown.map((row, index) => (
          <PeerCard key={index} row={row} first={false} />
        ))}
      </ul>
      {rest.length > 0 ? (
        <ShowAllToggle listId={HIDDEN_CARDS_ID} label={t('peers.showAll', { n: String(rows.length) })}>
          {rest.map((row, index) => (
            <PeerCard key={index} row={row} first={index === 0} />
          ))}
        </ShowAllToggle>
      ) : null}
      <p className="m-0 mt-2 text-[12px] text-slate">
        <AiMark spoken={false} />
        {t('peers.ai')}
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
