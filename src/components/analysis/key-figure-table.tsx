// The Nøkkeltall og gap tab's table (Story 1.8; FR-22, FR-24, FR-27, FR-29;
// EXPERIENCE.md "Benchmark row", "Benchmark table semantics",
// "Distribution strip", "Scroll container", "Responsive"): the three API
// figures against the shown group, each with own value, median, beste
// fjerdedel, Plassering, a distribution strip with the midtre halvdel as
// text, and the gap in kroner at full convergence.
//
// A server component. The engine's benchmark comes in; only formatted
// strings and the strip's mark positions go out (AD-4): no peer value, orgnr
// or filing id reaches the page. Every number goes through format.ts and
// every word through t().
//
// Two tables, one shown at a time (display: none hides the other from
// assistive technology too): seven columns in a horizontal scroll region
// from `md` up, and below it a three-column table (Nøkkeltall · own · Gap i
// kroner) whose row names open a full-width expansion row.
import type { ReactNode } from 'react';
import { stripPosition, type ApiBenchmark, type FigureBenchmark } from '@/engine/benchmark';
import { formatPercent, formatPercentNumber, formatWholePercent } from '@/engine/format';
import { MIN_PEERS, type ApiKeyFigures, type Comparison } from '@/engine/types';
import { t, type MessageId } from '@/messages';
import { DIRECTION_WORDS, FIGURES, undefinedText } from './api-figures';
import { DistributionStrip, type StripMarks } from './distribution-strip';
import { kronerAmountText } from './kroner-amount';
import { PhoneRowToggle } from './phone-row-toggle';
import { StateBlock } from './state-block';

type FigureKey = keyof ApiKeyFigures;
type Compared = Extract<Comparison, { readonly kind: 'compared' }>;

/** A cell's visible text and, where it shows only a dash, what a screen reader hears instead. */
type CellText = { readonly text: string; readonly srOnly?: string };

/** The kroner cell: the main text (an amount is 600), an optional slate subline. */
type GapCell = { readonly text: string; readonly sub?: string; readonly srOnly?: string; readonly amount: boolean };

type RowModel = {
  readonly key: FigureKey;
  readonly label: string;
  readonly subline: string;
  readonly direction: string;
  readonly counts: string;
  /** The own value, or "Kan ikke beregnes: …". */
  readonly own: string;
  readonly ownDefined: boolean;
  readonly comparison:
    | {
        readonly kind: 'compared';
        readonly median: string;
        readonly best: CellText;
        readonly placement: CellText;
        readonly middleHalf: string;
        readonly strip: StripMarks;
      }
    | { readonly kind: 'below_floor'; readonly text: string; readonly short: string }
    | { readonly kind: 'subject_absent' };
  readonly gap: GapCell | null;
};

const DASH = '–';

/** "midtre halvdel 18,4–49,0 %", or "… −6,3 til 9,1 %" when a bound is negative; "Midtre halvdel: …" with no direction. */
export function middleHalfText(lower: string, upper: string, labelled: boolean): string {
  const lo = formatPercentNumber(lower);
  const hi = formatPercentNumber(upper);
  const negative = lo.startsWith('−') || hi.startsWith('−');
  const id: MessageId = labelled
    ? negative
      ? 'keyFigures.middleHalfLabelledNegative'
      : 'keyFigures.middleHalfLabelled'
    : negative
      ? 'keyFigures.middleHalfNegative'
      : 'keyFigures.middleHalf';
  return t(id, { lo, hi });
}

/** The strip's marks from the engine's positions; `toNumber` only for geometry. */
export function stripMarks(comparison: Compared, direction: FigureBenchmark['direction']): StripMarks {
  const at = (value: Compared['median']) => stripPosition(value, comparison, direction).at.toNumber();
  const own = stripPosition(comparison.subject, comparison, direction);
  return {
    own: { at: own.at.toNumber(), clipped: own.clipped !== null },
    median: at(comparison.median),
    bandFrom: at(comparison.lowerQuartile),
    bandTo: at(comparison.upperQuartile),
    best: comparison.best === null ? null : at(comparison.best.quartile),
    mirrored: direction === 'lower_is_better',
  };
}

function gapCell(key: FigureKey, figure: FigureBenchmark): GapCell | null {
  if (figure.comparison.kind !== 'compared') return null;
  if (figure.direction === 'none') {
    return { text: DASH, srOnly: t('keyFigures.notApplicableNoDirection'), amount: false };
  }
  if (key !== 'driftsmargin') return { text: t('keyFigures.noKroner'), amount: false };
  const gap = figure.gap;
  if (gap.kind === 'amount') {
    return { text: kronerAmountText(gap), sub: t('keyFigures.perYear'), amount: true };
  }
  if (gap.kind === 'strength') return { text: t('keyFigures.strength'), amount: false };
  if (gap.kind === 'not_nok') return { text: t('keyFigures.notInKroner'), amount: false };
  return null;
}

function rowModel(key: FigureKey, label: MessageId, denominator: MessageId, figure: FigureBenchmark): RowModel {
  const c = figure.comparison;
  const direction = t(DIRECTION_WORDS[figure.direction]);
  const counts = t('keyFigures.counts', { n: String(c.count), k: String(c.leftOut) });
  const own = c.kind === 'subject_absent' ? undefinedText(c.absence, denominator) : formatPercent(c.subject.toString());
  const noDirection: CellText = { text: DASH, srOnly: t('keyFigures.notApplicableNoDirection') };
  let comparison: RowModel['comparison'];
  if (c.kind === 'compared') {
    comparison = {
      kind: 'compared',
      median: formatPercent(c.median.toString()),
      best: c.best === null ? noDirection : { text: formatPercent(c.best.quartile.toString()) },
      placement:
        c.best === null
          ? noDirection
          : { text: t('keyFigures.placement', { v: formatWholePercent(c.best.percentile.toString()) }) },
      middleHalf: middleHalfText(c.lowerQuartile.toString(), c.upperQuartile.toString(), figure.direction === 'none'),
      strip: stripMarks(c, figure.direction),
    };
  } else if (c.kind === 'below_floor') {
    const vars = { n: String(c.count), min: String(MIN_PEERS) };
    comparison = {
      kind: 'below_floor',
      text: t('keyFigures.belowFloor', vars),
      short: t('keyFigures.belowFloorShort', vars),
    };
  } else {
    comparison = { kind: 'subject_absent' };
  }
  return {
    key,
    label: t(label),
    subline: `${direction} · ${counts}`,
    direction,
    counts,
    own,
    ownDefined: c.kind !== 'subject_absent',
    comparison,
    gap: gapCell(key, figure),
  };
}

/** Whether the non-small notice is shown: a subject that is not a small enterprise, with any figure below the floor. */
export function showNonSmallNotice(benchmark: ApiBenchmark, smaaForetak: boolean | null): boolean {
  return smaaForetak === false && FIGURES.some((figure) => benchmark[figure.key].comparison.kind === 'below_floor');
}

function Text({ cell, className }: { readonly cell: CellText; readonly className?: string }) {
  if (cell.srOnly === undefined) return <span className={className}>{cell.text}</span>;
  return (
    <>
      <span aria-hidden="true" className={className}>
        {cell.text}
      </span>
      <span className="sr-only">{cell.srOnly}</span>
    </>
  );
}

function Gap({ gap }: { readonly gap: GapCell }) {
  return (
    <>
      <Text cell={gap} className={gap.amount ? 'font-semibold whitespace-nowrap' : undefined} />
      {gap.sub !== undefined ? <span className="block text-[13px] text-slate">{gap.sub}</span> : null}
    </>
  );
}

// Column ids, unique on the page: desktop `kf-d-…`, phone `kf-p-…`.
const COL = {
  figure: 'kf-d-col-figure',
  own: 'kf-d-col-own',
  median: 'kf-d-col-median',
  best: 'kf-d-col-best',
  placement: 'kf-d-col-placement',
  distribution: 'kf-d-col-distribution',
  gap: 'kf-d-col-gap',
} as const;
/** The five columns a merged comparison cell spans. */
const SPANNED = [COL.median, COL.best, COL.placement, COL.distribution, COL.gap] as const;

const cell = 'py-3 pr-4 align-top';
const headCell = 'py-2 pr-4 text-left align-bottom font-semibold';

function DesktopRow({ row }: { readonly row: RowModel }) {
  const rowId = `kf-d-row-${row.key}`;
  const c = row.comparison;
  return (
    <tr className="border-b border-divider" data-figure={row.key}>
      <th scope="row" id={rowId} className={`${cell} text-left font-normal`}>
        <span className="block font-semibold">{row.label}</span>
        <span className="block text-[13px] text-slate">{row.subline}</span>
      </th>
      <td className={`figure ${cell} ${row.ownDefined ? 'whitespace-nowrap' : 'min-w-40'}`} data-cell="own">
        {row.own}
      </td>
      {c.kind === 'compared' ? (
        <>
          <td className={`figure ${cell} whitespace-nowrap`} data-cell="median">
            {c.median}
          </td>
          <td className={`figure ${cell} whitespace-nowrap`} data-cell="best">
            <Text cell={c.best} />
          </td>
          <td className={`figure ${cell} whitespace-nowrap`} data-cell="placement">
            <Text cell={c.placement} />
          </td>
          <td className={cell} data-cell="distribution">
            <DistributionStrip marks={c.strip} />
            <span className="figure mt-1 block text-[13px] whitespace-nowrap text-slate">{c.middleHalf}</span>
          </td>
          <td className={`figure ${cell}`} data-cell="gap">
            {row.gap !== null ? <Gap gap={row.gap} /> : null}
          </td>
        </>
      ) : (
        <td
          colSpan={SPANNED.length}
          headers={`${SPANNED.join(' ')} ${rowId}`}
          className={`${cell} text-slate italic`}
          data-cell="merged"
        >
          {c.kind === 'below_floor' ? c.text : <Text cell={{ text: DASH, srOnly: t('keyFigures.notApplicable') }} />}
        </td>
      )}
    </tr>
  );
}

function ExpansionItem({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 py-1">
      <dt className="text-slate">{label}</dt>
      <dd className="figure m-0 text-right">{children}</dd>
    </div>
  );
}

function PhoneRow({ row }: { readonly row: RowModel }) {
  const c = row.comparison;
  let gap: ReactNode;
  if (c.kind === 'below_floor') gap = <span className="text-slate italic">{c.short}</span>;
  else if (c.kind === 'subject_absent') gap = <Text cell={{ text: DASH, srOnly: t('keyFigures.notApplicable') }} />;
  else gap = row.gap !== null ? <Gap gap={row.gap} /> : null;
  return (
    <PhoneRowToggle
      expansionId={`kf-p-exp-${row.key}`}
      label={<span className="font-semibold hyphens-auto">{row.label}</span>}
      cells={
        <>
          <td className="figure py-2 pr-3 align-top break-words" data-cell="own">
            {row.own}
          </td>
          <td className="figure py-2 align-top break-words" data-cell="gap">
            {gap}
          </td>
        </>
      }
      expansion={
        <td colSpan={3} className="px-2 py-2">
          {c.kind === 'below_floor' ? <p className="m-0 py-1 text-[13px] text-slate italic">{c.text}</p> : null}
          <dl className="m-0 text-[13px]">
            {c.kind === 'compared' ? (
              <>
                <ExpansionItem label={t('keyFigures.col.median')}>{c.median}</ExpansionItem>
                <ExpansionItem label={t('keyFigures.col.best')}>
                  <Text cell={c.best} />
                </ExpansionItem>
                <ExpansionItem label={t('keyFigures.col.placement')}>
                  <Text cell={c.placement} />
                </ExpansionItem>
                <ExpansionItem label={t('keyFigures.col.middleHalf')}>{c.middleHalf}</ExpansionItem>
              </>
            ) : null}
            <ExpansionItem label={t('keyFigures.col.direction')}>{row.direction}</ExpansionItem>
            <ExpansionItem label={t('keyFigures.col.count')}>{row.counts}</ExpansionItem>
            {row.gap !== null ? (
              <ExpansionItem label={t('keyFigures.col.gap')}>
                <Gap gap={row.gap} />
              </ExpansionItem>
            ) : null}
          </dl>
        </td>
      }
    />
  );
}

export function KeyFigureTable({
  benchmark,
  companyName,
  smaaForetak,
}: {
  readonly benchmark: ApiBenchmark;
  /** The own column's head: the company's name. */
  readonly companyName: string;
  /** The subject's filing's smaaForetak: false shows the notice when any figure is below the floor. */
  readonly smaaForetak: boolean | null;
}) {
  const rows = FIGURES.map((figure) => rowModel(figure.key, figure.label, figure.denominator, benchmark[figure.key]));
  return (
    <div className="mt-2" data-testid="key-figure-table">
      <p className="m-0 text-[13px] text-slate">{t('keyFigures.topNote')}</p>
      {showNonSmallNotice(benchmark, smaaForetak) ? (
        <div className="mt-4">
          <StateBlock>
            <p className="m-0">{t('keyFigures.nonSmall')}</p>
          </StateBlock>
        </div>
      ) : null}

      <div
        role="region"
        tabIndex={0}
        aria-label={t('keyFigures.regionLabel')}
        className="scroll-region mt-4 hidden md:block"
      >
        <table className="w-full border-collapse text-left" data-layout="desktop">
          <caption className="sr-only">{t('keyFigures.caption')}</caption>
          <thead>
            <tr className="border-b border-divider text-[13px] text-slate">
              <th scope="col" id={COL.figure} className={headCell}>
                {t('keyFigures.col.figure')}
              </th>
              <th scope="col" id={COL.own} className={`${headCell} break-words`}>
                {companyName}
              </th>
              <th scope="col" id={COL.median} className={`${headCell} whitespace-nowrap`}>
                {t('keyFigures.col.median')}
              </th>
              <th scope="col" id={COL.best} className={`${headCell} whitespace-nowrap`}>
                {t('keyFigures.col.best')}
              </th>
              <th scope="col" id={COL.placement} className={`${headCell} whitespace-nowrap`}>
                {t('keyFigures.col.placement')}
              </th>
              <th scope="col" id={COL.distribution} className={`${headCell} whitespace-nowrap`}>
                {t('keyFigures.col.distribution')}
              </th>
              <th scope="col" id={COL.gap} className={`${headCell} whitespace-nowrap`}>
                {t('keyFigures.col.gap')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <DesktopRow key={row.key} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <table className="mt-4 w-full table-fixed border-collapse text-left md:hidden" data-layout="phone">
        <caption className="sr-only">{t('keyFigures.caption')}</caption>
        <thead>
          <tr className="border-b border-divider text-[13px] text-slate">
            <th scope="col" id="kf-p-col-figure" className="w-[40%] py-2 pr-3 text-left align-bottom font-semibold">
              {t('keyFigures.col.figure')}
            </th>
            <th scope="col" id="kf-p-col-own" className="py-2 pr-3 text-left align-bottom font-semibold break-words">
              {companyName}
            </th>
            <th scope="col" id="kf-p-col-gap" className="py-2 text-left align-bottom font-semibold">
              {t('keyFigures.col.gap')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <PhoneRow key={row.key} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
