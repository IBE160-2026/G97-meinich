'use client';
// The Verdi tab (Story 3.5; FR-30, FR-31, FR-62; EXPERIENCE.md
// "Closable-share control", "Amount card", "Behaviour on share change";
// DESIGN.md "Amount card"): the closable-share control and three amount
// cards, never summed: "Økt driftsresultat per år", "Frigjort
// arbeidskapital" and "Frigjort kapital i driftseiendeler".
//
// The share lives in the URL. The panel reads it from the URL hook
// (`useAnalysisUrl`, the live `andel`) and writes it with `replaceShare`,
// one `history.replaceState`: no server render, no history entry. The cards
// are rescaled here, in the browser, by `verdiCards` from the server's wire
// values (AD-6): the same engine functions and the same formatter as the
// server's render of this component, so both write the same bytes. Only the
// Verdi cards move; the hero, the small cards and the table stay at full
// convergence. Focus stays on the chosen step, and the live region, empty
// from load, announces the change once.
import { useEffect, useRef, useState } from 'react';
import { verdiCards, type CardView, type VerdiWire, type WorkingCapitalView } from '@/analysis/verdi-view';
import type { ClosableShare } from '@/engine/closable';
import { t } from '@/messages';
import { useAnalysisUrl } from './analysis-url';
import { ClosableShareControl } from './closable-share';

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
}: {
  readonly id: string;
  readonly kicker: string;
  readonly card: CardView;
  readonly parts?: WorkingCapitalView['parts'] | null;
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

export function VerdiPanel({ wire }: { readonly wire: VerdiWire }) {
  const url = useAnalysisUrl();
  const share = url.state.andel;
  const view = verdiCards(wire, share, url.state.multippel);
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const choose = (next: ClosableShare) => {
    url.replaceShare(next);
    // Cleared first, so the same sentence twice in a row is announced again; one announcement per change.
    setMessage('');
    if (timer.current !== null) clearTimeout(timer.current);
    const text = verdiCards(wire, next, url.state.multippel).announcement;
    timer.current = setTimeout(() => setMessage(text), 50);
  };

  return (
    <div className="mt-2" data-testid="verdi">
      <ClosableShareControl steps={view.steps} current={share} line={view.line} applies={view.applies} onChoose={choose} />
      <div className="mt-6 grid grid-cols-1 gap-grid-gap-phone md:grid-cols-3 md:gap-grid-gap" data-testid="verdi-cards">
        <Card id="verdi-profit" kicker={t('verdi.profit.kicker')} card={view.profit} />
        <Card id="verdi-working-capital" kicker={t('verdi.workingCapital.kicker')} card={view.workingCapital} parts={view.workingCapital.parts} />
        <Card id="verdi-oml" kicker={t('verdi.oml.kicker')} card={view.oml} />
      </div>
      <div role="status" className="sr-only" data-testid="verdi-status">
        {message}
      </div>
    </div>
  );
}
