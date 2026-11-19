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
import type { WaterfallView } from '@/analysis/waterfall-view';
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

function NumbersTable({ view, companyName }: { readonly view: Shown; readonly companyName: string }) {
  const cell = 'py-1.5 pr-2 align-top break-words';
  return (
    <table className="w-full table-fixed border-collapse text-left text-[13px]" data-testid="waterfall-table">
      <caption className="pb-1 text-left text-slate">{view.table.caption}</caption>
      <thead>
        <tr className="border-b border-divider text-slate">
          <th scope="col" className={`${cell} w-[34%] font-semibold`}>
            {view.table.heads.post}
          </th>
          <th scope="col" className={`${cell} font-semibold`}>
            {companyName}
          </th>
          <th scope="col" className={`${cell} font-semibold`}>
            {view.table.heads.all}
          </th>
          <th scope="col" className={`${cell} w-[30%] font-semibold`}>
            {view.table.heads.kroner}
          </th>
        </tr>
      </thead>
      <tbody>
        {view.table.rows.map((row) => (
          <tr key={row.head} className="border-b border-divider">
            <th scope="row" className={`${cell} font-normal`}>
              {row.head}
            </th>
            <td className={`figure ${cell}`}>{row.own}</td>
            <td className={`figure ${cell}`}>{row.all}</td>
            <td className={`figure ${cell}`}>{row.kroner}</td>
          </tr>
        ))}
        <tr className="border-b border-divider">
          <th scope="row" className={`${cell} font-normal`}>
            {companyName}
          </th>
          <td className={`figure ${cell}`}>{view.table.end.own}</td>
          <td className={`figure ${cell}`} />
          <td className={`figure ${cell}`}>{view.table.end.kroner}</td>
        </tr>
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
  );
}

export function Waterfall({
  view,
  companyName,
  layout,
}: {
  readonly view: WaterfallView;
  readonly companyName: string;
  /** The desktop chart in the table's scroll region, or the phone rows. */
  readonly layout: 'desktop' | 'phone';
}) {
  if (view.kind === 'absent') {
    return (
      <p className="m-0 text-[13px] text-slate" data-testid="waterfall-absent">
        {view.text}
      </p>
    );
  }
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
      <ShowNumbers show={view.showNumbers} hide={view.hideNumbers} tableId={`kf-${layout === 'desktop' ? 'd' : 'p'}-wf-numbers`}>
        <NumbersTable view={view} companyName={companyName} />
      </ShowNumbers>
    </div>
  );
}
