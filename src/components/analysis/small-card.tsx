// One of Oversikt's three small cards (Story 3.4; EXPERIENCE.md "Small
// card", "Small cards, nothing to show"; DESIGN.md "Small card"): a kicker
// as the card's h3, the key figure's name, its value, one or two slate
// lines, or one slate sentence in place of the value. The card keeps its
// place when empty.
//
// A server component: the view arrives as strings only
// (src/analysis/oversikt-cards.ts, AD-4). Story 3.5: the capital card's top
// note links to Verdi, and "og {n} til" is an AnalysisLink.
import type { SmallCardView } from '@/analysis/oversikt-cards';
import type { AnalysisTarget } from '@/analysis/peer-change';
import { AnalysisLink } from './analysis-link';
import { TopNote } from './top-note';

export function SmallCard({
  id,
  kicker,
  view,
  valueSize = 'amount',
  more = null,
}: {
  /** The kicker's id, unique on the page: the section is labelled by it. */
  readonly id: string;
  readonly kicker: string;
  readonly view: SmallCardView;
  /** `amount`: DESIGN.md `amount-small` (22 px); `figure`: `figure-pair` (18 px), for words in place of a value. */
  readonly valueSize?: 'amount' | 'figure';
  /** "og {n} til", linking to the table. */
  readonly more?: { readonly text: string; readonly target: AnalysisTarget } | null;
}) {
  return (
    <section
      aria-labelledby={id}
      data-testid={id}
      className="min-w-0 rounded-lg border border-divider p-card-padding-phone md:col-span-4 md:p-card-padding"
    >
      <h3 id={id} className="m-0 font-sans text-[11px] font-semibold tracking-[0.06em] text-slate uppercase">
        {kicker}
      </h3>
      {view.kind === 'shown' ? (
        <>
          <p className="m-0 mt-1.5 text-[15px] font-semibold" data-card="name">
            {view.name}
          </p>
          <p
            className={`figure m-0 mt-2 font-semibold break-words ${valueSize === 'amount' ? 'text-[22px] leading-[1.1]' : 'text-[18px]'}`}
            data-card="value"
          >
            {view.value}
          </p>
          {view.topNote ? <TopNote className="m-0 mt-1.5 text-[13px] text-slate" /> : null}
          {view.lines.map((line) => (
            <p key={line} className="m-0 mt-1.5 text-[13px] text-slate" data-card="line">
              {line}
            </p>
          ))}
        </>
      ) : (
        <>
          <p className="m-0 mt-2 text-slate" data-card="empty">
            {view.text}
          </p>
          {view.detail !== null ? <p className="m-0 mt-1.5 text-[13px] text-slate">{view.detail}</p> : null}
        </>
      )}
      {more !== null ? (
        <p className="m-0 mt-3 text-[13px]">
          <AnalysisLink target={more.target} className="inline-flex min-h-6 items-center" data-card="more">
            {more.text}
          </AnalysisLink>
        </p>
      ) : null}
    </section>
  );
}
