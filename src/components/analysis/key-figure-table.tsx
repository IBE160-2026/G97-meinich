// The Nøkkeltall og gap tab's table (Stories 1.8, 3.1b; FR-21–FR-24, FR-27,
// FR-29, FR-55, FR-56, FR-71; EXPERIENCE.md "Benchmark row", "Benchmark
// table semantics", "Distribution strip", "Scroll container", "Responsive",
// "State Patterns"): every key figure of `docs/key-figures.md` against the
// shown group, in its order, one `<tbody>` per group. Each row has own
// value, median, beste fjerdedel, Plassering, a distribution strip with the
// midtre halvdel as text, and the gap in kroner at full convergence; the
// cost shares sit in their own row group under a `th scope="rowgroup"`
// heading. No sort control and no `aria-sort` (decision 8).
//
// A server component. The rows come from `keyFigureTableView`
// (src/analysis/key-figure-rows.ts) as strings and strip geometry only
// (AD-4): no peer value, orgnr, document line or filing id reaches the page.
// The two client modules it renders, the phone row toggle and the info
// popover, receive only those strings.
//
// Two tables, one shown at a time (display: none hides the other from
// assistive technology too): seven columns in a horizontal scroll region
// from `md` up, and below it a three-column table (Nøkkeltall · own · Gap i
// kroner) whose row names open a full-width expansion row.
import type { ReactNode } from 'react';
import type { ApiBenchmark, DocumentBenchmark } from '@/engine/benchmark';
import { t } from '@/messages';
import {
  keyFigureTableView,
  type CellText,
  type GapCell,
  type KeyFigureRow,
} from '@/analysis/key-figure-rows';
import { DistributionStrip } from './distribution-strip';
import { InfoPopover } from './info-popover';
import { PhoneRowToggle } from './phone-row-toggle';
import { StateBlock } from './state-block';

const DASH = '–';

/** The State block every "Ikke i demodataene" cell points to with aria-describedby. */
export const NOT_IN_DATASET_ID = 'kf-not-in-dataset';

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

/** The own cell's content: the value or the absence's words, and the info button outside the demo data. */
function Own({ row, popoverId, detail }: { readonly row: KeyFigureRow; readonly popoverId: string; readonly detail: boolean }) {
  return (
    <>
      {row.own.text}
      {row.own.notInDataset ? (
        <InfoPopover id={popoverId} label={t('keyFigures.moreAbout')} text={t('keyFigures.notInDataset.popover')} />
      ) : null}
      {detail && row.own.detail !== null ? (
        <span className="mt-1 block text-[13px] text-slate">{row.own.detail}</span>
      ) : null}
    </>
  );
}

const describedBy = (row: KeyFigureRow): string | undefined => (row.own.notInDataset ? NOT_IN_DATASET_ID : undefined);

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
const DESKTOP_COLUMNS = 7;
const PHONE_COLUMNS = 3;

const cell = 'py-3 pr-4 align-top';
const headCell = 'py-2 pr-4 text-left align-bottom font-semibold';
// The rule between two groups (decision 1).
const groupRule = 'border-t-2 border-divider';

function DesktopRow({ row, groupHeadingId }: { readonly row: KeyFigureRow; readonly groupHeadingId: string | null }) {
  const rowId = `kf-d-row-${row.key}`;
  const c = row.comparison;
  return (
    <tr className="border-b border-divider" data-figure={row.key}>
      <th scope="row" id={rowId} className={`${cell} text-left font-normal ${row.indent ? 'pl-[30px]' : ''}`}>
        <span className="block font-semibold">{row.label}</span>
        <span className="block text-[13px] text-slate">{row.subline}</span>
      </th>
      <td
        className={`figure ${cell} ${row.own.defined ? 'whitespace-nowrap' : 'min-w-40'}`}
        data-cell="own"
        aria-describedby={describedBy(row)}
      >
        <Own row={row} popoverId={`kf-d-pop-${row.key}`} detail />
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
          headers={[...SPANNED, rowId, ...(groupHeadingId === null ? [] : [groupHeadingId])].join(' ')}
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

function PhoneRow({ row }: { readonly row: KeyFigureRow }) {
  const c = row.comparison;
  let gap: ReactNode;
  if (c.kind === 'below_floor') gap = <span className="text-slate italic">{c.short}</span>;
  else if (c.kind === 'subject_absent') gap = <Text cell={{ text: DASH, srOnly: t('keyFigures.notApplicable') }} />;
  else gap = row.gap !== null ? <Gap gap={row.gap} /> : null;
  return (
    <PhoneRowToggle
      expansionId={`kf-p-exp-${row.key}`}
      indent={row.indent}
      label={<span className="font-semibold hyphens-auto">{row.label}</span>}
      cells={
        <>
          <td className="figure py-2 pr-2 align-top break-words hyphens-auto" data-cell="own" aria-describedby={describedBy(row)}>
            <Own row={row} popoverId={`kf-p-pop-${row.key}`} detail={false} />
          </td>
          <td className="figure py-2 align-top break-words" data-cell="gap">
            {gap}
          </td>
        </>
      }
      expansion={
        <td colSpan={PHONE_COLUMNS} className="px-2 py-2">
          {c.kind === 'below_floor' ? <p className="m-0 py-1 text-[13px] text-slate italic">{c.text}</p> : null}
          {row.own.detail !== null ? <p className="m-0 py-1 text-[13px] text-slate">{row.own.detail}</p> : null}
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

/** A row group's heading row: `th scope="rowgroup"` across the table. */
function GroupHeading({ id, heading, columns }: { readonly id: string; readonly heading: string; readonly columns: number }) {
  return (
    <tr className="border-b border-divider">
      <th scope="rowgroup" id={id} colSpan={columns} className="py-2 pr-4 text-left text-[13px] font-semibold text-slate">
        {heading}
      </th>
    </tr>
  );
}

export function KeyFigureTable({
  benchmark,
  documentBenchmark,
  companyName,
  smaaForetak,
  filingYear,
}: {
  readonly benchmark: ApiBenchmark;
  readonly documentBenchmark: DocumentBenchmark;
  /** The own column's head: the company's name. */
  readonly companyName: string;
  /** The subject's filing's smaaForetak: false shows the notice when any figure is below the floor. */
  readonly smaaForetak: boolean | null;
  /** The benchmark filing's year, for an absence's words. */
  readonly filingYear: number;
}) {
  const view = keyFigureTableView({ api: benchmark, document: documentBenchmark, filingYear, smaaForetak });
  return (
    <div className="mt-2" data-testid="key-figure-table">
      <p className="m-0 text-[13px] text-slate">{t('keyFigures.topNote')}</p>
      {view.nonSmall ? (
        <div className="mt-4" data-testid="non-small-notice">
          <StateBlock>
            <p className="m-0">{t('keyFigures.nonSmall')}</p>
          </StateBlock>
        </div>
      ) : null}
      {view.notInDataset ? (
        <div className="mt-4" data-testid="not-in-dataset-notice">
          <StateBlock>
            <p className="m-0" id={NOT_IN_DATASET_ID}>
              {t('keyFigures.notInDataset.state')}
            </p>
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
          {view.groups.map((group, i) => (
            <tbody key={group.id} data-group={group.id} className={i > 0 ? groupRule : undefined}>
              {group.heading !== null ? (
                <GroupHeading id={`kf-d-group-${group.id}`} heading={group.heading} columns={DESKTOP_COLUMNS} />
              ) : null}
              {group.rows.map((row) => (
                <DesktopRow
                  key={row.key}
                  row={row}
                  groupHeadingId={group.heading !== null ? `kf-d-group-${group.id}` : null}
                />
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <table className="mt-4 w-full table-fixed border-collapse text-left md:hidden" data-layout="phone">
        <caption className="sr-only">{t('keyFigures.caption')}</caption>
        <thead>
          <tr className="border-b border-divider text-[13px] text-slate">
            {/* The gap column is the widest, so a one-off amount of nine digits and "engangsbeløp" fit at 320 px. */}
            <th scope="col" id="kf-p-col-figure" className="w-[34%] py-2 pr-3 text-left align-bottom font-semibold">
              {t('keyFigures.col.figure')}
            </th>
            <th scope="col" id="kf-p-col-own" className="w-[26%] py-2 pr-2 text-left align-bottom font-semibold break-words">
              {companyName}
            </th>
            <th scope="col" id="kf-p-col-gap" className="py-2 text-left align-bottom font-semibold">
              {t('keyFigures.col.gap')}
            </th>
          </tr>
        </thead>
        {view.groups.map((group, i) => (
          <tbody key={group.id} data-group={group.id} className={i > 0 ? groupRule : undefined}>
            {group.heading !== null ? (
              <GroupHeading id={`kf-p-group-${group.id}`} heading={group.heading} columns={PHONE_COLUMNS} />
            ) : null}
            {group.rows.map((row) => (
              <PhoneRow key={row.key} row={row} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
