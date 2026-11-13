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
//
// Story 2.8 (FR-17, FR-18): the rows are the whole group; an excluded peer
// keeps its row, in slate, struck through, tagged "Ekskludert", with "Ta med
// igjen" in the action column. Above the funnel: the widened notice beyond
// Standard, the too-small block under 10 peers in the analysis (or the
// all-excluded sentence), then the size-band control and the sentence that
// nothing else loosens. "Tilbakestill til standard" shows whenever the
// group is not the standard one. Every change link's href is `serialize`
// of the state the change asks for (src/analysis/peer-change.ts).
import { isStandardGroup, nextState } from '@/analysis/peer-change';
import type { PeerDisplayRow } from '@/analysis/peer-rows';
import { bandFactors, groupTooSmall, type BandStep } from '@/analysis/size-band';
import type { EmptyReason, FunnelCounts } from '@/engine/peers';
import { t } from '@/messages';
import { DEFAULT_BAND, serialize, type AnalysisState } from '@/url/analysis-state';
import { AiMark } from './ai-mark';
import { PeerAction, PeerChangeLink } from './peer-action';
import { Basis, CARD_LIST_CLASS, Flag, PeerCard, PeerName, type PeerCardLabels } from './peer-card';
import { PeerFunnel } from './peer-funnel';
import { ShowAllToggle } from './show-all-toggle';
import { SizeBandControl } from './size-band';
import { StateBlock } from './state-block';

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
// group's page stays small: columns 2 and 3 are figures, right-aligned. An
// excluded row is slate (`data-excluded`).
const TABLE_CLASS =
  'w-full border-collapse text-left text-[13px] [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold [&_td]:py-2 [&_td]:pr-4 ' +
  '[&_tbody_tr]:border-b [&_tbody_tr]:border-divider [&_tbody_tr]:align-top [&_td:first-child]:min-w-40 [&_td:first-child]:break-words ' +
  '[&_:is(td,th):is(:nth-child(2),:nth-child(3))]:text-right [&_:is(td,th):is(:nth-child(2),:nth-child(3),:nth-child(5))]:whitespace-nowrap ' +
  '[&_td:is(:nth-child(2),:nth-child(3))]:figure [&_td:nth-child(4)]:min-w-56';

function PeerTable({ rows }: { readonly rows: readonly PeerDisplayRow[] }) {
  const ki = t('peers.ai');
  const excludedTag = t('peers.excluded');
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
            <th scope="col">
              <span className="sr-only">{t('peers.col.action')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // The position is the key: the list is static per render.
            <tr key={index} data-excluded={row.excluded ? 'true' : undefined} className={row.excluded ? 'text-slate' : undefined}>
              <td>
                <PeerName row={row} excludedTag={excludedTag} />
              </td>
              <td>{row.omsetning}</td>
              <td>{row.driftsmargin}</td>
              <td>{row.hvorforMed}</td>
              <td>
                <Basis row={row} ki={ki} />
              </td>
              <td>{row.flagg === null ? null : <Flag text={row.flagg} ki={ki} />}</td>
              <td>
                <PeerAction orgnr={row.orgnr} navn={row.navn} excluded={row.excluded} />
              </td>
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
    excluded: t('peers.excluded'),
  };
}

function PeerCards({ rows, band }: { readonly rows: readonly PeerDisplayRow[]; readonly band: AnalysisState['band'] }) {
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
          key={band}
          band={band}
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


/** The State blocks above the size-band control: widened, then too small or all excluded. */
function GroupBlocks({
  state,
  memberCount,
  analysisCount,
}: {
  readonly state: AnalysisState;
  readonly memberCount: number;
  readonly analysisCount: number;
}) {
  const tooSmall = groupTooSmall(memberCount, analysisCount, state.band);
  return (
    <>
      {state.band === DEFAULT_BAND ? null : (
        <div className="mt-4" data-testid="widened-block">
          <StateBlock>
            <p className="m-0">{t('peers.widened.body', { b: bandFactors(state.band) })}</p>
            <p className="m-0 mt-1">
              <PeerChangeLink
                href={serialize(nextState(state, { kind: 'band', band: DEFAULT_BAND }))}
                change={{ kind: 'band', band: DEFAULT_BAND }}
              >
                {t('peers.widened.back', { b: bandFactors(DEFAULT_BAND) })}
              </PeerChangeLink>
            </p>
          </StateBlock>
        </div>
      )}
      {tooSmall === null ? null : (
        <div className="mt-4" data-testid="too-small-block">
          <StateBlock>
            <p className="m-0">{tooSmall.text}</p>
            {tooSmall.widen === null ? null : (
              <p className="m-0 mt-1">
                <PeerChangeLink
                  href={serialize(nextState(state, { kind: 'band', band: tooSmall.widen }))}
                  change={{ kind: 'band', band: tooSmall.widen }}
                >
                  {t('peers.tooSmallWiden')}
                </PeerChangeLink>
              </p>
            )}
          </StateBlock>
        </div>
      )}
    </>
  );
}

export function PeerList({
  rows,
  counts,
  emptyReason,
  filingYear,
  state,
  steps,
  analysisCount,
  excludedCount,
}: {
  /** The whole group, excluded peers marked. */
  readonly rows: readonly PeerDisplayRow[];
  readonly counts: FunnelCounts;
  readonly emptyReason: EmptyReason;
  /** The subject's benchmark year, named when it has no revenue to compare. */
  readonly filingYear: number;
  /** The parsed URL state: the band, the exclusions, and every change link's base. */
  readonly state: AnalysisState;
  /** The size-band control's steps (src/analysis/size-band.ts). */
  readonly steps: readonly BandStep[];
  /** The peers in the analysis: the group minus `ekskl`. */
  readonly analysisCount: number;
  /** Group peers in `ekskl`. */
  readonly excludedCount: number;
}) {
  return (
    <div className="mt-2">
      <p className="m-0 text-slate" data-testid="peer-count">
        {analysisCount === 1 ? t('peers.countOne') : t('peers.count', { n: String(analysisCount) })}
      </p>
      {emptyReason !== null ? (
        <p className="m-0 mt-4">{emptyText(emptyReason, filingYear)}</p>
      ) : (
        <>
          <GroupBlocks state={state} memberCount={rows.length} analysisCount={analysisCount} />
          <SizeBandControl steps={steps} band={state.band} label={t('peers.band.label')} note={t('peers.band.fixed')} />
          <PeerFunnel counts={counts} excluded={excludedCount} analysisCount={analysisCount} />
          {isStandardGroup(state) ? null : (
            <p className="m-0 mt-3">
              <PeerChangeLink href={serialize(nextState(state, { kind: 'reset' }))} change={{ kind: 'reset' }}>
                {t('peers.reset')}
              </PeerChangeLink>
            </p>
          )}
          {rows.length === 0 ? null : (
            <>
              <PeerTable rows={rows} />
              <PeerCards rows={rows} band={state.band} />
            </>
          )}
        </>
      )}
    </div>
  );
}
