'use client';
// The Verdi tab (Story 3.5; FR-30, FR-31, FR-62; EXPERIENCE.md
// "Closable-share control", "Amount card", "Behaviour on share change";
// DESIGN.md "Amount card"): the closable-share control and three amount
// cards, never summed: "Økt driftsresultat per år", "Frigjort
// arbeidskapital" and "Frigjort kapital i driftseiendeler".
//
// The share lives in the URL. The panel reads it from the URL hook
// (`useAnalysisUrl`, the live `andel`) and writes it with `replaceSettings`,
// one `history.replaceState`: no server render, no history entry. The cards
// are rescaled here, in the browser, by `verdiCards` from the server's wire
// values (AD-6): the same engine functions and the same formatter as the
// server's render of this component, so both write the same bytes. Only the
// Verdi cards move; the hero, the small cards and the table stay at full
// convergence. Focus stays on the chosen step, and the live region, empty
// from load, announces the change once.
//
// Story 3.6 (FR-32, FR-55): under the three cards, the EV section, "Økt
// selskapsverdi": the multiple field and, with a multiple in the URL, the
// value round(exact profit uplift at the share × m), its product line and
// E3, computed here by `verdiCards` like the cards, so it rescales with the
// share. The multiple is written by the same `replaceSettings`. The value is
// its own amount, never added to a card.
//
// Story 3.7: "Hvordan er dette regnet?" under each card's amount and under
// EV's value. The server renders each drill-down (verdi-provenance.tsx); its
// share line and EV's product line are this panel's `verdiCards` at the live
// share, read through VerdiViewContext. A card without an amount has no
// trigger.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { verdiCards, type CardView, type EvView, type VerdiWire, type WorkingCapitalView } from '@/analysis/verdi-view';
import type { ClosableShare, Multiple } from '@/engine/closable';
import { t } from '@/messages';
import { useAnalysisUrl } from './analysis-url';
import { ClosableShareControl } from './closable-share';
import { MultipleField } from './multiple-field';
import { Provenance } from './provenance';
import { VerdiViewContext } from './verdi-formula-slot';
import { VERDI_PROVENANCE_IDS } from './verdi-provenance-ids';
import type { VerdiProvenance } from './verdi-provenance';

function MedianTickLine({ text }: { readonly text: string }) {
  return (
    <p className="m-0 mt-1.5 flex items-start gap-2 text-[13px] text-slate" data-card="median">
      <span aria-hidden="true" className="mt-[3px] inline-block h-3 w-0.5 shrink-0 bg-median" />
      <span>{text}</span>
    </p>
  );
}

function Value({ card }: { readonly card: CardView }) {
  if (card.value === null) return null;
  return card.value.kind === 'amount' ? (
    <p className="figure m-0 mt-2 text-[26px] leading-[1.1] font-semibold break-words md:text-[30px]" data-card="amount">
      {card.value.text}
    </p>
  ) : (
    <p className="m-0 mt-2 text-slate" data-card="text">
      {card.value.text}
    </p>
  );
}

function Card({
  id,
  kicker,
  card,
  parts = null,
  provenance = null,
}: {
  readonly id: string;
  readonly kicker: string;
  readonly card: CardView;
  readonly parts?: WorkingCapitalView['parts'] | null;
  /** The drill-down, where the card shows an amount (Story 3.7). */
  readonly provenance?: { readonly id: string; readonly node: ReactNode } | null;
}) {
  return (
    <section aria-labelledby={id} data-testid={id} className="min-w-0 rounded-lg border border-divider p-card-padding-phone md:p-card-padding">
      <h3 id={id} className="m-0 font-sans text-[11px] font-semibold tracking-[0.06em] text-slate uppercase">
        {kicker}
      </h3>
      {parts === null || parts.length === 0 ? null : (
        <ul className="m-0 mt-2 list-none p-0 text-[13px]" data-card="parts">
          {parts.map((part) => (
            <li key={part.text} className="figure mt-1 first:mt-0">
              {part.text}
              {part.median === null ? null : <MedianTickLine text={part.median} />}
            </li>
          ))}
        </ul>
      )}
      <Value card={card} />
      {provenance === null ? null : <Provenance id={provenance.id}>{provenance.node}</Provenance>}
      {card.detail === null ? null : <p className="m-0 mt-1.5 text-[13px] text-slate">{card.detail}</p>}
      {card.share === null ? null : (
        <p className="m-0 mt-1 text-[13px] text-slate" data-card="share">
          {card.share}
        </p>
      )}
      {card.median === null ? null : <MedianTickLine text={card.median} />}
    </section>
  );
}

function EvSection({
  ev,
  current,
  onCommit,
  announcementFor,
  provenance,
}: {
  readonly ev: EvView;
  readonly current: Multiple | null;
  readonly onCommit: (multiple: Multiple | null) => void;
  readonly announcementFor: (multiple: Multiple) => string;
  /** EV's drill-down: the profit's, with the product line (Story 3.7). */
  readonly provenance: ReactNode | null;
}) {
  return (
    <section
      aria-labelledby="verdi-ev"
      data-testid="verdi-ev"
      className="mt-6 min-w-0 rounded-lg border border-divider p-card-padding-phone md:max-w-xl md:p-card-padding"
    >
      <h3 id="verdi-ev" className="m-0 font-sans text-[11px] font-semibold tracking-[0.06em] text-slate uppercase">
        {t('verdi.ev.kicker')}
      </h3>
      <MultipleField ev={ev} current={current} onCommit={onCommit} announcementFor={announcementFor} />
      {ev.kind === 'value' ? (
        <>
          <p className="figure m-0 mt-3 text-[26px] leading-[1.1] font-semibold break-words md:text-[30px]" data-ev="value">
            {ev.value}
          </p>
          <p className="figure m-0 mt-1.5 text-[13px] break-words" data-ev="product">
            {ev.product}
          </p>
          <p className="m-0 mt-1 text-[13px] text-slate" data-ev="explanation">
            {ev.explanation}
          </p>
          {provenance === null ? null : <Provenance id={VERDI_PROVENANCE_IDS.ev}>{provenance}</Provenance>}
        </>
      ) : ev.kind === 'empty' ? (
        <p className="m-0 mt-3 text-slate" data-ev="empty">
          {ev.text}
        </p>
      ) : null}
    </section>
  );
}

/** A card's drill-down where it shows an amount; an amount the server gave no drill-down is a bug. */
function shown(amount: boolean, id: string, node: ReactNode | null): { readonly id: string; readonly node: ReactNode } | null {
  if (!amount) return null;
  if (node === null) throw new Error(`the Verdi card ${id} shows an amount with no drill-down`);
  return { id, node };
}

export function VerdiPanel({ wire, provenance }: { readonly wire: VerdiWire; readonly provenance: VerdiProvenance }) {
  const url = useAnalysisUrl();
  const share = url.state.andel;
  const multiple = url.state.multippel;
  const view = verdiCards(wire, share, multiple);
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const choose = (next: ClosableShare) => {
    url.replaceSettings({ andel: next });
    // Cleared first, so the same sentence twice in a row is announced again; one announcement per change.
    setMessage('');
    if (timer.current !== null) clearTimeout(timer.current);
    const text = verdiCards(wire, next, multiple).announcement;
    timer.current = setTimeout(() => setMessage(text), 50);
  };

  return (
    <VerdiViewContext.Provider value={{ view, share }}>
    <div className="mt-2" data-testid="verdi">
      <ClosableShareControl steps={view.steps} current={share} line={view.line} applies={view.applies} onChoose={choose} />
      <div className="mt-6 grid grid-cols-1 gap-grid-gap-phone md:grid-cols-3 md:gap-grid-gap" data-testid="verdi-cards">
        <Card
          id="verdi-profit"
          kicker={t('verdi.profit.kicker')}
          card={view.profit}
          provenance={shown(view.profit.value?.kind === 'amount', VERDI_PROVENANCE_IDS.profit, provenance.profit)}
        />
        <Card
          id="verdi-working-capital"
          kicker={t('verdi.workingCapital.kicker')}
          card={view.workingCapital}
          parts={view.workingCapital.parts}
          provenance={shown(view.workingCapital.shareLines.length > 0, VERDI_PROVENANCE_IDS.workingCapital, provenance.workingCapital)}
        />
        <Card
          id="verdi-oml"
          kicker={t('verdi.oml.kicker')}
          card={view.oml}
          provenance={shown(view.oml.value?.kind === 'amount', VERDI_PROVENANCE_IDS.oml, provenance.oml)}
        />
      </div>
      <EvSection
        ev={view.ev}
        current={multiple}
        onCommit={(next) => url.replaceSettings({ multippel: next })}
        announcementFor={(next) => {
          // The field is enabled only where the profit card has an amount, so a multiple gives a value.
          const ev = verdiCards(wire, share, next).ev;
          if (ev.kind !== 'value') throw new Error('a multiple on a profit amount gives a value');
          return ev.announcement;
        }}
        provenance={view.ev.kind === 'value' ? provenance.ev : null}
      />
      <div role="status" className="sr-only" data-testid="verdi-status">
        {message}
      </div>
    </div>
    </VerdiViewContext.Provider>
  );
}
