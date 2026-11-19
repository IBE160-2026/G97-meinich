// The Oversikt tab (Stories 1.9, 3.4; FR-27, FR-29, FR-30; EXPERIENCE.md
// "Oversikt", "Beeswarm", "Small card"; DESIGN.md "Layout & Spacing"): the
// 12-column card grid — the hero (5 columns), the driftsmargin beeswarm with
// its compact list (7), and three small cards of 4 each, which keep their
// place when empty. One column below `md`, in that order. No explanation row
// and no placeholder for it in v1 (Epic 4), and no "· Endre i Verdi" until
// Story 3.5.
//
// A server component. Every view is built here from the shown group the
// table reads (src/analysis/beeswarm.ts, src/analysis/oversikt-cards.ts);
// only their strings and plot coordinates reach the page (AD-4), and the
// one client module, the chart, receives exactly those.
import Link from 'next/link';
import { groupBeeswarm, type BeeswarmView, type MarginRow } from '@/analysis/beeswarm';
import { oversiktCards } from '@/analysis/oversikt-cards';
import type { ShownGroup } from '@/analysis/shown-group';
import type { DocumentBasis } from '@/engine/document-inputs';
import { t } from '@/messages';
import type { Candidate } from '@/server/analysis';
import { serialize, type AnalysisState } from '@/url/analysis-state';
import type { SubjectKeyFigures } from '@/analysis/view';
import { BeeswarmChart } from './beeswarm-chart';
import { OversiktHero } from './oversikt-hero';
import { emptyText } from './peer-list';
import { ShowNumbers } from './show-numbers';
import { SmallCard } from './small-card';

const HEADING_ID = 'beeswarm-heading';
const NUMBERS_ID = 'beeswarm-numbers';

/** A row's company name, marked when it is the company's own. */
function Name({ row, selected }: { readonly row: MarginRow; readonly selected: string }) {
  return (
    <>
      {row.name}
      {row.selected ? <span className="font-normal text-slate">{` ${selected}`}</span> : null}
    </>
  );
}

function Legend({ view }: { readonly view: Extract<BeeswarmView, { readonly kind: 'shown' }> }) {
  const swatch = 'block shrink-0';
  return (
    <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-[12px]">
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0" data-testid="beeswarm-legend">
        <li className="flex items-center gap-1.5">
          <svg aria-hidden="true" width={14} height={14} viewBox="0 0 14 14" className={swatch}>
            <circle className="bs-mark" data-mark="company" cx={7} cy={7} r={5} fill="var(--color-signature)" stroke="var(--color-navy-900)" strokeWidth={2} />
          </svg>
          <span className="figure">{view.legend.company}</span>
        </li>
        <li className="flex items-center gap-1.5">
          <svg aria-hidden="true" width={6} height={14} viewBox="0 0 6 14" className={swatch}>
            <line className="bs-mark" data-mark="median" x1={3} x2={3} y1={0} y2={14} stroke="var(--color-median)" strokeWidth={2} />
          </svg>
          <span className="figure">{view.legend.median}</span>
        </li>
        <li className="flex items-center gap-1.5">
          <svg aria-hidden="true" width={12} height={10} viewBox="0 0 12 10" className={swatch}>
            <path className="bs-mark" data-mark="best" d="M1 1h10l-5 8z" fill="var(--color-background)" stroke="var(--color-slate)" strokeWidth={1.5} strokeLinejoin="round" />
          </svg>
          <span className="figure">{view.legend.best}</span>
        </li>
      </ul>
      <span className="whitespace-nowrap text-slate">{view.betterRight}</span>
    </div>
  );
}

/** The compact list's caption, which names its scroll region. */
const NEAREST_CAPTION_ID = 'beeswarm-nearest-caption';

/** The compact list: the five nearest and the company, highest driftsmargin first. */
function Nearest({ view, peersHref }: { readonly view: Extract<BeeswarmView, { readonly kind: 'shown' }>; readonly peersHref: string }) {
  const cell = 'py-1 pr-3 align-top';
  return (
    <div className="mt-4">
      {/* Its own scroll region, as every table on the page (UX-DR37): at 320 px a long name and two figures can be wider than the card. */}
      <div role="region" tabIndex={0} aria-labelledby={NEAREST_CAPTION_ID} className="scroll-region">
        <table className="w-full border-collapse text-left text-[13px]" data-testid="beeswarm-nearest">
          <caption id={NEAREST_CAPTION_ID} className="pb-1 text-left text-[13px] font-semibold">{view.nearest.caption}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{view.table.heads.name}</th>
              <th scope="col">{view.table.heads.margin}</th>
              <th scope="col">{view.table.heads.revenue}</th>
            </tr>
          </thead>
          <tbody>
            {view.nearest.rows.map((row, i) => (
              // The position is the key: two peers can share a name, and the list is static per render.
              <tr key={i} className={`border-t border-divider${row.selected ? ' bg-surface font-semibold' : ''}`} data-selected={row.selected}>
                <th scope="row" className={`${cell} font-[inherit] break-words`}>
                  <Name row={row} selected={view.selected} />
                </th>
                <td className={`figure ${cell} text-right whitespace-nowrap`} data-cell="margin">
                  {row.margin}
                </td>
                <td className={`figure ${cell} pr-0 text-right whitespace-nowrap text-slate`} data-cell="revenue">
                  {row.revenue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 mt-2 text-[13px]">
        <Link href={peersHref} className="inline-flex min-h-6 items-center" data-testid="beeswarm-see-all">
          {view.nearest.seeAll}
        </Link>
      </p>
    </div>
  );
}

/**
 * The "Vis tallene" table's look, set once on the table: it can hold
 * hundreds of rows, and every row's markup reaches the page twice (HTML and
 * RSC payload), so a row carries its text and nothing else. The margin is
 * the second column, the revenue the third.
 */
const NUMBERS_TABLE =
  'min-w-full border-collapse text-left text-[13px] [&_:is(th,td)]:py-1.5 [&_:is(th,td)]:pr-3 [&_:is(th,td)]:align-top ' +
  '[&_thead_th]:font-semibold [&_tr]:border-b [&_tr]:border-divider [&_tbody_tr:not([data-selected])_th]:font-normal ' +
  '[&_td]:figure [&_td]:whitespace-nowrap';

/** "Vis tallene": every peer in the analysis, by driftsmargin, the company marked; in its own scroll region. */
function NumbersTable({ view }: { readonly view: Extract<BeeswarmView, { readonly kind: 'shown' }> }) {
  const captionId = `${NUMBERS_ID}-caption`;
  return (
    <div role="region" tabIndex={0} aria-labelledby={captionId} className="scroll-region">
      <table className={NUMBERS_TABLE} data-testid="beeswarm-table">
        <caption id={captionId} className="pb-1 text-left text-slate">
          {view.table.caption}
        </caption>
        <thead>
          <tr className="text-slate">
            <th scope="col">{view.table.heads.name}</th>
            <th scope="col">{view.table.heads.margin}</th>
            <th scope="col">{view.table.heads.revenue}</th>
          </tr>
        </thead>
        <tbody>
          {view.table.rows.map((row, i) =>
            row.selected ? (
              <tr key={i} data-selected="true" className="font-semibold">
                <th scope="row">
                  <Name row={row} selected={view.selected} />
                </th>
                <td>{row.margin}</td>
                <td>{row.revenue}</td>
              </tr>
            ) : (
              // The position is the key: the table is static per render.
              <tr key={i}>
                <th scope="row">{row.name}</th>
                <td>{row.margin}</td>
                <td>{row.revenue}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function BeeswarmCard({ view, peersHref }: { readonly view: BeeswarmView; readonly peersHref: string }) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      data-testid="beeswarm"
      className="min-w-0 rounded-lg border border-divider p-card-padding-phone md:col-span-7 md:p-card-padding"
    >
      <h3 id={HEADING_ID} className="m-0 font-sans text-[15px] font-semibold">
        {view.heading}
      </h3>
      {view.kind === 'absent' ? (
        <p className="m-0 mt-2 text-slate" data-testid="beeswarm-absent">
          {view.text}
        </p>
      ) : (
        <>
          <Legend view={view} />
          <BeeswarmChart summary={view.summary} layouts={view.layouts} entries={view.entries} />
          {view.legend.edge !== null ? <p className="m-0 mt-1 text-[12px] text-slate">{view.legend.edge}</p> : null}
          {view.noMargin !== null ? (
            <p className="m-0 mt-1 text-[12px] text-slate" data-testid="beeswarm-no-margin">
              {view.noMargin}
            </p>
          ) : null}
          <Nearest view={view} peersHref={peersHref} />
          <ShowNumbers show={view.showNumbers} hide={view.hideNumbers} tableId={NUMBERS_ID}>
            <NumbersTable view={view} />
          </ShowNumbers>
        </>
      )}
    </section>
  );
}

export function Oversikt({
  group,
  subject,
  state,
}: {
  /** The shown group, the same the table and the Peers tab read. */
  readonly group: ShownGroup<Candidate>;
  readonly subject: {
    readonly name: string;
    readonly keyFigures: SubjectKeyFigures;
    /** The subject's document basis: the capital card names it when it is not read. */
    readonly documentBasis: DocumentBasis;
  };
  /** The URL's state; every link keeps every setting. */
  readonly state: AnalysisState;
}) {
  const context = { filingYear: group.filingYear, valuta: group.valuta, unstatedField: group.unstatedField };
  const empty = group.emptyReason === null ? null : emptyText(group.emptyReason, context);
  const beeswarm = groupBeeswarm(group, subject, empty);
  const cards = oversiktCards({
    api: group.benchmark,
    document: group.documentBenchmark,
    basis: subject.documentBasis.kind,
    filingYear: group.filingYear,
  });
  const table = serialize({ ...state, fane: 'nokkeltall' });
  return (
    <div className="mt-4 grid grid-cols-1 gap-grid-gap-phone md:grid-cols-12 md:gap-grid-gap" data-testid="oversikt">
      <OversiktHero
        figure={group.benchmark.driftsmargin}
        state={state}
        emptyReason={group.emptyReason}
        filingYear={group.filingYear}
        valuta={group.valuta}
        unstatedField={group.unstatedField}
      />
      <BeeswarmCard view={beeswarm} peersHref={serialize({ ...state, fane: 'peers' })} />
      <SmallCard id="card-capital" kicker={t('oversikt.capital.kicker')} view={cards.capital} />
      <SmallCard id="card-strength" kicker={t('oversikt.strength.kicker')} view={cards.strength} />
      <SmallCard
        id="card-missing"
        kicker={t('oversikt.missing.kicker')}
        view={cards.missing}
        valueSize="figure"
        more={cards.missing.more === null ? null : { text: cards.missing.more, href: table }}
      />
    </div>
  );
}
