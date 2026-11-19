// The margin waterfall on the desktop (Story 3.3; EXPERIENCE.md "Margin
// waterfall"; DESIGN.md "Margin waterfall"): six columns from "Peer-gruppen
// samlet" (`median` fill) through the four bars to the company (`navy-700`).
// Favourable bars petrol, unfavourable amber, the residual slate whatever its
// sign; thin `connector` lines; a rounded data end and a square start.
//
// The SVG is a non-focusable `role="img"` with the summary as its
// `aria-label` and every child `aria-hidden`; the values are text in the
// grid around it and in the "Vis tallene" table. Under `forced-colors:
// active` each kind keeps its own fill and outline (`.wf-bar` in
// globals.css), so the bars stay apart without colour.
//
// A server component: every value arrives as a string, every position as a
// share of the shared kroner scale (src/analysis/waterfall-view.ts). Nothing
// here computes a figure; it only places what it is given.
import type { BarGeometry, WaterfallView } from '@/analysis/waterfall-view';

type Shown = Extract<WaterfallView, { readonly kind: 'shown' }>;

const COLUMN = 110;
const BAR = 56;
const PLOT_TOP = 8;
const PLOT_HEIGHT = 180;
const WIDTH = COLUMN * 6;
const HEIGHT = PLOT_TOP * 2 + PLOT_HEIGHT;
const RADIUS = 4;

/** A position on the scale (0 the lowest level, 1 the highest) → a y coordinate, to a tenth of a pixel. */
function y(at: number): number {
  return Math.round((PLOT_TOP + (1 - at) * PLOT_HEIGHT) * 10) / 10;
}

/** A bar's outline: square at its start, rounded at its data end (the top when it ends at its upper end). */
function barPath(column: number, geometry: BarGeometry): string {
  const left = column * COLUMN + (COLUMN - BAR) / 2;
  const right = left + BAR;
  const top = y(geometry.to);
  const bottom = Math.max(y(geometry.from), top + 1);
  const r = Math.min(RADIUS, (bottom - top) / 2);
  if (geometry.end === geometry.to) {
    return `M${left} ${bottom}V${top + r}Q${left} ${top} ${left + r} ${top}H${right - r}Q${right} ${top} ${right} ${top + r}V${bottom}Z`;
  }
  return `M${left} ${top}V${bottom - r}Q${left} ${bottom} ${left + r} ${bottom}H${right - r}Q${right} ${bottom} ${right} ${bottom - r}V${top}Z`;
}

const FILL = {
  start: 'var(--color-median)',
  favourable: 'var(--color-favourable)',
  unfavourable: 'var(--color-unfavourable)',
  residual: 'var(--color-slate)',
  end: 'var(--color-navy-700)',
} as const;

export function WaterfallChart({ view, companyName }: { readonly view: Shown; readonly companyName: string }) {
  const columns = [
    { key: 'start', kind: 'start' as const, geometry: view.start.geometry },
    ...view.steps.map((step) => ({ key: step.key, kind: step.kind, geometry: step.geometry })),
    { key: 'end', kind: 'end' as const, geometry: view.end.geometry },
  ];
  const labels = [
    { key: 'start', name: view.start.label, value: view.start.value, lines: [view.start.margin] },
    ...view.steps.map((step) => ({
      key: step.key,
      name: step.label,
      value: step.value,
      direction: step,
      lines: [step.shares, ...(step.notMedian === null ? [] : [step.notMedian])],
    })),
    { key: 'end', name: companyName, value: view.end.value, lines: [view.end.margin] },
  ];
  return (
    <div className="min-w-[660px]" data-testid="waterfall-chart">
      <div className="grid grid-cols-6 text-center text-[13px]">
        {labels.map((label) => (
          <span key={label.key} className="figure px-1 font-semibold whitespace-nowrap" data-wf-value={label.key}>
            {label.value}
          </span>
        ))}
      </div>
      <svg
        role="img"
        aria-label={view.summary}
        focusable="false"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-1 block h-auto w-full"
        data-testid="waterfall-svg"
      >
        <line
          aria-hidden="true"
          x1={0}
          x2={WIDTH}
          y1={y(view.zero)}
          y2={y(view.zero)}
          stroke="var(--color-gridline)"
          strokeWidth={1}
        />
        {columns.slice(0, -1).map((column, i) => (
          <line
            key={`c-${column.key}`}
            aria-hidden="true"
            x1={i * COLUMN + (COLUMN + BAR) / 2}
            x2={(i + 1) * COLUMN + (COLUMN - BAR) / 2}
            y1={y(column.geometry.end)}
            y2={y(column.geometry.end)}
            stroke="var(--color-connector)"
            strokeWidth={1}
          />
        ))}
        {columns.map((column, i) => (
          <path
            key={column.key}
            aria-hidden="true"
            className="wf-bar"
            data-kind={column.kind}
            data-bar={column.key}
            d={barPath(i, column.geometry)}
            fill={FILL[column.kind]}
          />
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-6 text-center text-[12px] leading-snug">
        {labels.map((label) => (
          <div key={label.key} className="px-1" data-wf-label={label.key}>
            <span className="block font-semibold break-words text-navy-900">{label.name}</span>
            {'direction' in label && label.direction.word !== null ? (
              <span className="block text-slate">
                {label.direction.glyph !== null ? <span aria-hidden="true">{`${label.direction.glyph} `}</span> : null}
                {label.direction.word}
              </span>
            ) : null}
            {label.lines.map((line) => (
              <span key={line} className="figure block text-slate">
                {line}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
