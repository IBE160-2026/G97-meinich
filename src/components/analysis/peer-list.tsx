// The Peers tab (Stories 1.7, 2.7; FR-15, FR-16, UX-DR37, UX-DR68): the
// count, the funnel, then one row per peer — Selskap · Omsetning ·
// Driftsmargin · Hvorfor med · action — by revenue descending, then orgnr.
// A server component: it renders the display rows of
// src/analysis/peer-rows.ts, so only the strings shown reach the page
// (AD-4). Rows are never keyed by orgnr, because a React key travels in the
// RSC payload, and no row carries one.
//
// v1 (Story 5.2, Meinich 2026-11-15): no "Grunnlag for treff" column, no
// flag column and no ✦ "KI-generert" key. The funnel reads neither the
// fingerprint nor the classification, so nothing here rests on a model.
//
// From `md` the list is a table in its own horizontal scroll region
// (`.scroll-region` in globals.css), so it may be wider than the screen
// while the page body never scrolls sideways. Below `md` it is one card per
// peer, the first PHONE_CARDS shown and the rest sent as strings to
// "Vis alle {n}", which draws them in the client only when pressed.
// A subject that cannot have peers shows its sentence and no funnel: the
// zeros would only repeat it. A group stage 2 emptied for the subject's own
// fields (Story 2.10) shows its sentence in the empty-group block, where
// "Fant ingen …" would stand, with the funnel.
//
// Story 2.8 (FR-17, FR-18): the rows are the whole group; an excluded peer
// keeps its row, in slate, struck through, tagged "Ekskludert", with "Ta med
// igjen" in the action column. Above the funnel: the widened notice beyond
// Standard, the too-small block under 10 peers in the analysis (or the
// all-excluded sentence), then the size-band control and the sentence that
// nothing else loosens. "Tilbakestill til standard" shows whenever the
// group is not the standard one. Every change link's href is `serialize`
// of the state the change asks for (src/analysis/peer-change.ts).
//
// Story 2.10: with MAX_EKSKL exclusions in the URL, the cap text is shown
// once, above the list, with EXCLUSION_CAP_ID, and every "Ekskluder" in the
// table and the cards is aria-disabled and described by it.
import { exclusionCapReached, isStandardGroup, nextState } from '@/analysis/peer-change';
import type { PeerDisplayRow } from '@/analysis/peer-rows';
import { bandFactors, groupTooSmall, widerBand, type BandStep } from '@/analysis/size-band';
import { isKnownCurrency, type EmptyReason, type FunnelCounts, type StatedField } from '@/engine/peers';
import { t } from '@/messages';
import { DEFAULT_BAND, serialize, type AnalysisState } from '@/url/analysis-state';
import { EXCLUSION_CAP_ID, PeerAction, PeerChangeLink } from './peer-action';
import { CARD_LIST_CLASS, PeerCard, PeerName, type PeerCardLabels } from './peer-card';
import { PeerFunnel } from './peer-funnel';
import { PHONE_CARDS } from './phone-cards';
import { ShowAllToggle } from './show-all-toggle';
import { SizeBandControl } from './size-band';
import { StateBlock } from './state-block';

export { PHONE_CARDS };

const HIDDEN_CARDS_ID = 'flere-sammenlignbare';

/** What an empty group's sentence names besides its reason. */
export type EmptyContext = {
  /** The subject's benchmark year. */
  readonly filingYear: number;
  /** The subject's `valuta`, named by `subject_currency`. */
  readonly valuta: string | null;
  /** The first stage-2 field the subject leaves unstated, named by `subject_field_not_stated`. */
  readonly unstatedField: StatedField | null;
};

/**
 * The sentence for an empty group's reason (Stories 1.7, 2.10). The
 * Oversikt hero shows the same sentence (Story 1.9). One case per reason
 * and no default, so a new reason fails typecheck until it has its copy.
 */
export function emptyText(reason: NonNullable<EmptyReason>, { filingYear, valuta, unstatedField }: EmptyContext): string {
  const aar = String(filingYear);
  switch (reason) {
    case 'subject_no_revenue':
      return t('peers.noRevenue', { aar });
    case 'subject_revenue_not_stated':
      return t('peers.revenueNotStated', { aar });
    case 'subject_non_calendar':
      return t('peers.nonCalendar');
    case 'subject_field_not_stated':
      if (unstatedField === null) throw new TypeError('emptyText: subject_field_not_stated without an unstated field');
      return t('peers.fieldNotStated', { aar, felt: t(`peers.field.${unstatedField}`) });
    case 'subject_currency':
      if (valuta === null) throw new TypeError('emptyText: subject_currency without a valuta');
      return t('peers.currency', { aar, valuta });
    case 'subject_not_comparable':
      return t('peers.notComparable', { aar });
  }
}

/**
 * Whether a wider size band can help a group stage 2 emptied (Story 2.10,
 * decision 2 as amended): a known currency no stage-1 candidate shares, or
 * any other not-comparable reason, may meet a match further out; an
 * unstated field or an unknown currency matches nothing at any band.
 */
function wideningHelps(reason: NonNullable<EmptyReason>, valuta: string | null): boolean {
  switch (reason) {
    case 'subject_currency':
      return isKnownCurrency(valuta);
    case 'subject_not_comparable':
      return true;
    case 'subject_no_revenue':
    case 'subject_revenue_not_stated':
    case 'subject_non_calendar':
    case 'subject_field_not_stated':
      return false;
  }
}

/**
 * Whether the reason means the subject cannot have peers at any band (no
 * revenue, revenue not stated, a non-calendar year): the Peers tab then
 * shows the sentence alone, because the funnel's zeros would only repeat
 * it. A stage-2 reason keeps the funnel (Story 2.10, decision 2).
 */
export function cannotHavePeers(reason: NonNullable<EmptyReason>): boolean {
  switch (reason) {
    case 'subject_no_revenue':
    case 'subject_revenue_not_stated':
    case 'subject_non_calendar':
      return true;
    case 'subject_field_not_stated':
    case 'subject_currency':
    case 'subject_not_comparable':
      return false;
  }
}

// The table's cells are styled from the table, not cell by cell, so a large
// group's page stays small: columns 2 and 3 are figures, right-aligned. An
// excluded row is slate (`data-excluded`).
const TABLE_CLASS =
  'w-full border-collapse text-left text-[13px] [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold [&_td]:py-2 [&_td]:pr-4 ' +
  '[&_tbody_tr]:border-b [&_tbody_tr]:border-divider [&_tbody_tr]:align-top [&_td:first-child]:min-w-40 [&_td:first-child]:break-words ' +
  '[&_:is(td,th):is(:nth-child(2),:nth-child(3))]:text-right [&_:is(td,th):is(:nth-child(2),:nth-child(3))]:whitespace-nowrap ' +
  '[&_td:is(:nth-child(2),:nth-child(3))]:figure [&_td:nth-child(4)]:min-w-56';

function PeerTable({ rows, capReached }: { readonly rows: readonly PeerDisplayRow[]; readonly capReached: boolean }) {
  const excludedTag = t('peers.excluded');
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={t('peers.regionLabel')}
      className="scroll-region mt-4 hidden md:block"
    >
      <table className={TABLE_CLASS}>
        <caption className="sr-only">{t('peers.regionLabel')}</caption>
        <thead>
          <tr className="border-b border-divider text-slate">
            <th scope="col">{t('peers.col.selskap')}</th>
            <th scope="col">{t('peers.col.omsetning')}</th>
            <th scope="col">{t('fig.driftsmargin')}</th>
            <th scope="col">{t('peers.col.reason')}</th>
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
                <PeerAction orgnr={row.orgnr} navn={row.navn} excluded={row.excluded} capReached={capReached} />
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
    excluded: t('peers.excluded'),
  };
}

function PeerCards({
  rows,
  band,
  capReached,
}: {
  readonly rows: readonly PeerDisplayRow[];
  readonly band: AnalysisState['band'];
  readonly capReached: boolean;
}) {
  const labels = cardLabels();
  const rest = rows.slice(PHONE_CARDS);
  return (
    <div className="mt-4 md:hidden" data-testid="peer-cards">
      <ul className={CARD_LIST_CLASS}>
        {rows.slice(0, PHONE_CARDS).map((row, index) => (
          <PeerCard key={index} row={row} labels={labels} first={false} capReached={capReached} />
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
          capReached={capReached}
        />
      ) : null}
    </div>
  );
}


/** The State blocks above the size-band control: widened, then the empty group's reason, too small or all excluded. */
function GroupBlocks({
  state,
  memberCount,
  analysisCount,
  emptySentence,
}: {
  readonly state: AnalysisState;
  readonly memberCount: number;
  readonly analysisCount: number;
  /** A stage-2 reason's sentence, in place of "Fant ingen …", and whether a wider band can help; null without one. */
  readonly emptySentence: { readonly text: string; readonly widen: boolean } | null;
}) {
  const tooSmall =
    emptySentence !== null
      ? { text: emptySentence.text, widen: emptySentence.widen ? widerBand(state.band) : null }
      : groupTooSmall(memberCount, analysisCount, state.band);
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
  valuta,
  unstatedField,
  state,
  steps,
  analysisCount,
  excludedCount,
}: {
  /** The whole group, excluded peers marked. */
  readonly rows: readonly PeerDisplayRow[];
  readonly counts: FunnelCounts;
  readonly emptyReason: EmptyReason;
  /** The subject's benchmark year, named by the empty group's sentence. */
  readonly filingYear: number;
  /** The subject's `valuta`, named by `subject_currency`. */
  readonly valuta: string | null;
  /** The subject's first unstated stage-2 field, named by `subject_field_not_stated`. */
  readonly unstatedField: StatedField | null;
  /** The parsed URL state: the band, the exclusions, and every change link's base. */
  readonly state: AnalysisState;
  /** The size-band control's steps (src/analysis/size-band.ts). */
  readonly steps: readonly BandStep[];
  /** The peers in the analysis: the group minus `ekskl`. */
  readonly analysisCount: number;
  /** Group peers in `ekskl`. */
  readonly excludedCount: number;
}) {
  const emptySentence = emptyReason === null ? null : emptyText(emptyReason, { filingYear, valuta, unstatedField });
  const capReached = exclusionCapReached(state);
  return (
    <div className="mt-2">
      <p className="m-0 text-slate" data-testid="peer-count">
        {analysisCount === 1 ? t('peers.countOne') : t('peers.count', { n: String(analysisCount) })}
      </p>
      {emptyReason !== null && cannotHavePeers(emptyReason) ? (
        <p className="m-0 mt-4">{emptySentence}</p>
      ) : (
        <>
          <GroupBlocks
            state={state}
            memberCount={rows.length}
            analysisCount={analysisCount}
            emptySentence={
              emptyReason === null || emptySentence === null
                ? null
                : { text: emptySentence, widen: wideningHelps(emptyReason, valuta) }
            }
          />
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
              {capReached ? (
                <p id={EXCLUSION_CAP_ID} className="m-0 mt-3 text-[13px] text-slate" data-testid="exclusion-cap">
                  {t('peers.exclusionCap')}
                </p>
              ) : null}
              <PeerTable rows={rows} capReached={capReached} />
              <PeerCards rows={rows} band={state.band} capReached={capReached} />
            </>
          )}
        </>
      )}
    </div>
  );
}
