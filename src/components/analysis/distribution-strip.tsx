// The distribution strip in a benchmark row (Story 1.8; DESIGN.md "Chart
// markers", "Distribution strip"): a `divider` track, the midtre halvdel as
// a `band`, the median as a full-height tick with a `background` halo where
// it crosses the band, beste fjerdedel as a hollow downward triangle, and
// the company as a `signature` dot with a 2px `navy-900` outline. No peer
// dots, no tooltip.
//
// Decorative: `aria-hidden` and never focusable, because the row's cells and
// its midtre halvdel text carry every value. The marks arrive as positions
// in [0, 1] already mirrored by the engine (stripPosition), so better is
// always to the right; this component draws them and computes nothing
// about the figures. Colours are the theme's tokens, never a hex value.
import { t } from '@/messages';

/** Mark positions as a share of the strip's width from the left, 0–1. Geometry, not figures. */
export type StripMarks = {
  readonly own: { readonly at: number; readonly clipped: boolean };
  readonly median: number;
  /** The midtre halvdel's ends, left and right as drawn. */
  readonly bandFrom: number;
  readonly bandTo: number;
  /** Null for a figure with no direction. */
  readonly best: number | null;
  /** Lower is better: drawn mirrored and labelled "Bedre →". */
  readonly mirrored: boolean;
};

const WIDTH = 160;
const HEIGHT = 30;
/** Room at each end for the company dot and an out-of-range chevron. */
const PAD = 14;
const TRACK_Y = 15;
const TRACK_H = 6;
const MID_Y = TRACK_Y + TRACK_H / 2;

/** A position on the strip → an x coordinate, to a tenth of a pixel. */
function x(at: number): number {
  return Math.round((PAD + at * (WIDTH - 2 * PAD)) * 10) / 10;
}

export function DistributionStrip({ marks }: { readonly marks: StripMarks }) {
  const own = x(marks.own.at);
  const median = x(marks.median);
  const from = x(Math.min(marks.bandFrom, marks.bandTo));
  const to = x(Math.max(marks.bandFrom, marks.bandTo));
  // An own value outside [P5, P95] is drawn at the edge with a chevron pointing outwards.
  const outwards = marks.own.at <= 0.5 ? -1 : 1;
  return (
    <div aria-hidden="true" className="flex items-center gap-2" data-testid="distribution-strip">
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        focusable="false"
        className="block shrink-0"
      >
        <rect x={PAD} y={TRACK_Y} width={WIDTH - 2 * PAD} height={TRACK_H} rx={2} fill="var(--color-divider)" />
        <rect x={from} y={TRACK_Y} width={Math.max(to - from, 1)} height={TRACK_H} rx={2} fill="var(--color-band)" />
        <line x1={median} x2={median} y1={TRACK_Y - 1} y2={TRACK_Y + TRACK_H + 1} stroke="var(--color-background)" strokeWidth={4} />
        <line
          data-mark="median"
          x1={median}
          x2={median}
          y1={1}
          y2={HEIGHT - 1}
          stroke="var(--color-median)"
          strokeWidth={2}
        />
        {marks.best !== null ? (
          <path
            data-mark="best"
            d={`M${x(marks.best) - 5} 2h10l-5 8z`}
            fill="var(--color-background)"
            stroke="var(--color-slate)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ) : null}
        <circle cx={own} cy={MID_Y} r={7} fill="var(--color-background)" />
        <circle
          data-mark="own"
          cx={own}
          cy={MID_Y}
          r={5}
          fill="var(--color-signature)"
          stroke="var(--color-navy-900)"
          strokeWidth={2}
        />
        {marks.own.clipped ? (
          <path
            data-mark="clipped"
            d={`M${own + outwards * 9} ${MID_Y - 4}l${outwards * 3} 4l${-outwards * 3} 4`}
            fill="none"
            stroke="var(--color-navy-900)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
      {marks.mirrored ? (
        <span className="text-[11px] whitespace-nowrap text-slate">{t('keyFigures.betterRight')}</span>
      ) : null}
    </div>
  );
}
