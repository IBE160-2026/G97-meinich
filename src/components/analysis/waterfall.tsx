// The body of "Hva forklarer marginavviket?" (Story 3.3; FR-29, FR-30;
// EXPERIENCE.md "Margin waterfall"): the reference tag first, then the
// never-added sentence directly above the bars, the chart (desktop) or the
// rows (phone), the legend's three kinds, and "Vis tallene" with its table
// (caption, `th scope="row"`: start, the four parts with sign and word, the
// end, the reference). Or one sentence when there is no waterfall.
//
// A server component: the view arrives as strings and geometry only
// (src/analysis/waterfall-view.ts, AD-4); the one client module it renders,
// the "Vis tallene" toggle, receives the server-rendered table.
//
// Story 3.8: every row of "Vis tallene" (start, the four bars, "Sum av
// postene" and the end) has "Hvordan er dette regnet?" in its kroner cell and
// its drill-down in a full-width row right under it, ids
// `kf-{d|p}-wf-prov-{column}`. The chart (`role="img"`) and the phone rows
// get none. The drill-downs are built on the server
// (src/analysis/provenance.ts `waterfallProvenance`) and reach the page as
// their rendered steps only.
import { Fragment } from 'react';
import type { WaterfallColumnKey, WaterfallProvenance } from '@/analysis/provenance';
import type { WaterfallView } from '@/analysis/waterfall-view';
import { ProvenanceRow, ProvenanceTrigger } from './provenance';
import { ProvenanceSteps } from './provenance-steps';
import { ShowNumbers } from './show-numbers';
import { WaterfallChart } from './waterfall-chart';
import { WaterfallRows } from './waterfall-rows';

type Shown = Extract<WaterfallView, { readonly kind: 'shown' }>;

const SWATCH = {
  favourable: 'bg-favourable',
  unfavourable: 'bg-unfavourable',
  residual: 'bg-slate',
} as const;

function Legend({ view }: { readonly view: Shown }) {
  return (
    <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] text-slate" data-testid="waterfall-legend">
      {(['favourable', 'unfavourable', 'residual'] as const).map((kind) => (
        <li key={kind} className="flex items-center gap-1.5" data-legend={kind}>
          <span aria-hidden="true" className={`wf-bar inline-block h-2.5 w-3 rounded-[2px] ${SWATCH[kind]}`} data-kind={kind} />
          {view.legend[kind]}
        </li>
      ))}
    </ul>
  );
}

/**
 * The "Vis tallene" table in its own scroll region (EXPERIENCE.md "Scroll
 * container"), labelled by the table's caption: at 320 px its four columns
 * can be wider than the screen, and the body never scrolls sideways. Figures
 * never break inside a number; names wrap at spaces.
 */
function NumbersTable({
  view,
  companyName,
  id,
  layout,
  provenance,
}: {
  readonly view: Shown;
  readonly companyName: string;
  readonly id: string;
  readonly layout: 'd' | 'p';
  readonly provenance: WaterfallProvenance | null;
}) {
  const cell = 'py-1.5 pr-3 align-top';
  const figure = `figure ${cell} whitespace-nowrap`;
  const captionId = `${id}-caption`;
  const provId = (key: WaterfallColumnKey) => `kf-${layout}-wf-prov-${key}`;
  /** The trigger under a row's kroner (Story 3.8). */
  const trigger = (key: WaterfallColumnKey) =>
    provenance === null ? null : (
      <>
        <br />
        <ProvenanceTrigger id={provId(key)} />
      </>
    );
  /** The row's drill-down, as the next row, across the table. */
  const drillDown = (key: WaterfallColumnKey) =>
    provenance === null ? null : (
      <ProvenanceRow id={provId(key)} colSpan={4}>
        <ProvenanceSteps id={provId(key)} view={provenance[key]} />
      </ProvenanceRow>
    );
  return (
    <div role="region" tabIndex={0} aria-labelledby={captionId} className="scroll-region">
      <table className="min-w-full border-collapse text-left text-[13px]" data-testid="waterfall-table">
        <caption id={captionId} className="pb-1 text-left text-slate">
          {view.table.caption}
        </caption>
        <thead>
          <tr className="border-b border-divider text-slate">
            <th scope="col" className={`${cell} font-semibold`}>
              {view.table.heads.post}
            </th>
            <th scope="col" className={`${cell} font-semibold`}>
              {companyName}
            </th>
            <th scope="col" className={`${cell} font-semibold`}>
              {view.table.heads.all}
            </th>
            <th scope="col" className={`${cell} font-semibold`}>
              {view.table.heads.kroner}
            </th>
          </tr>
        </thead>
        <tbody>
          {view.table.rows.map((row) => (
            <Fragment key={row.key}>
              <tr className="border-b border-divider" data-wf-table-row={row.key}>
                <th scope="row" className={`${cell} font-normal`}>
                  {row.head}
                </th>
                <td className={figure}>{row.own}</td>
                <td className={figure}>{row.all}</td>
                <td className={figure}>
                  {row.kroner}
                  {row.glyph !== null ? <span aria-hidden="true">{` ${row.glyph}`}</span> : null}
                  {row.word !== null ? ` ${row.word}` : null}
                  {trigger(row.key)}
                </td>
              </tr>
              {drillDown(row.key)}
            </Fragment>
          ))}
          <tr className="border-b border-divider" data-wf-table-row="end">
            <th scope="row" className={`${cell} font-normal`}>
              {companyName}
            </th>
            <td className={figure}>{view.table.end.own}</td>
            <td className={figure} />
            <td className={figure}>
              {view.table.end.kroner}
              {trigger('end')}
            </td>
          </tr>
          {drillDown('end')}
          <tr>
            <th scope="row" className={`${cell} font-normal`}>
              {view.table.reference.head}
            </th>
            <td colSpan={3} className={`figure ${cell}`}>
              {view.table.reference.text}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Waterfall({
  view,
  companyName,
  layout,
  provenance,
}: {
  readonly view: WaterfallView;
  readonly companyName: string;
  /** The desktop chart in the table's scroll region, or the phone rows. */
  readonly layout: 'desktop' | 'phone';
  /** Each column's drill-down (Story 3.8); null when there is no waterfall. */
  readonly provenance: WaterfallProvenance | null;
}) {
  if (view.kind === 'absent') {
    return (
      <p className="m-0 text-[13px] text-slate" data-testid="waterfall-absent">
        {view.text}
      </p>
    );
  }
  const numbersId = `kf-${layout === 'desktop' ? 'd' : 'p'}-wf-numbers`;
  return (
    <div data-testid="waterfall">
      <p className="m-0">
        <span className="inline-block rounded-sm border border-input-border px-1.5 py-0.5 text-[11.5px] font-semibold" data-testid="waterfall-tag">
          {view.tag}
        </span>
      </p>
      <p className="m-0 mt-2" data-testid="waterfall-sentence">
        {view.sentence}
      </p>
      <div className="mt-3">
        {layout === 'desktop' ? <WaterfallChart view={view} companyName={companyName} /> : <WaterfallRows view={view} companyName={companyName} />}
      </div>
      <Legend view={view} />
      <ShowNumbers show={view.showNumbers} hide={view.hideNumbers} tableId={numbersId}>
        <NumbersTable view={view} companyName={companyName} id={numbersId} layout={layout === 'desktop' ? 'd' : 'p'} provenance={provenance} />
      </ShowNumbers>
    </div>
  );
}
