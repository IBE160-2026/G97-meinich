// The funnel (Story 2.7; FR-15, FR-9; DESIGN.md "Funnel"): the stages with
// the count each one leaves, shown whether or not the group clears the
// 10-peer floor, under the heading "Slik ble peer-gruppen valgt", which
// names the list. Segment names each criterion it applies with its own
// count (in v1 legal form only) and says that v1 admits AS only, in FR-9's
// words.
//
// The stages follow the funnel's options (default V1_FUNNEL): stage 4 is
// shown only when the fingerprint signal is on, stage 5 only when the text
// signal is, and the note `peers.funnel.notApplied` only when both are off.
// In v1 both are off (Story 5.2, Meinich 2026-11-15): stages 1–3 and the
// note. The flagged count stays in nb.json, unrendered.
//
// One column per stage from `md`, a vertical list below it (name left, count right,
// bar beneath). Each bar is an 8px navy-700 bar proportional to stage 1,
// its width `calc(100% * n / stage1)` from the integer counts, so no
// fraction is computed here. Bars are decorative (`aria-hidden`): the count
// beside each is the value. Counts are identification, not benchmarked
// figures, so they carry no median.
//
// Story 2.8: with exclusions, "{n} ekskludert av deg → {m} i analysen"
// follows the stages.
import type { ReactNode } from 'react';
import { V1_FUNNEL, type FunnelCounts, type FunnelOptions } from '@/engine/peers';
import { t, type MessageId } from '@/messages';

type Stage = {
  readonly name: MessageId;
  readonly count: number;
  /** Each criterion the stage applies, with the count left after it. */
  readonly criteria?: readonly { readonly name: MessageId; readonly count: number }[];
  /** A sentence under the criteria. */
  readonly note?: MessageId;
};

function stages(counts: FunnelCounts, options: FunnelOptions): readonly Stage[] {
  const shown: Stage[] = [
    { name: 'peers.funnel.stage1', count: counts.stage1 },
    { name: 'peers.funnel.stage2', count: counts.stage2 },
    {
      name: 'peers.funnel.stage3',
      count: counts.stage3.legalForm,
      criteria: [{ name: 'peers.funnel.segment.legalForm', count: counts.stage3.legalForm }],
      note: 'peers.funnel.segment.note',
    },
  ];
  if (options.fingerprintSignal) shown.push({ name: 'peers.funnel.stage4', count: counts.stage4.businessModel });
  if (options.textSignal) shown.push({ name: 'peers.funnel.stage5', count: counts.stage5.classification });
  return shown;
}

/** The grid's columns from `md`, one per stage: whole class names, so Tailwind finds them. */
const GRID_COLUMNS: Readonly<Record<number, string>> = { 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5' };

/** The bar's width: n of stage 1, in CSS, from integers. An empty stage 1 draws no bar. */
export function barWidth(count: number, stage1: number): string {
  return stage1 === 0 ? '0%' : `calc(100% * ${count} / ${stage1})`;
}

function Bar({ count, stage1 }: { readonly count: number; readonly stage1: number }): ReactNode {
  return (
    <div aria-hidden="true" className="mt-1.5 h-2 w-full" data-testid="funnel-bar">
      <div className="h-2 bg-navy-700" style={{ width: barWidth(count, stage1) }} />
    </div>
  );
}

const HEADING_ID = 'trakt-tittel';

export function PeerFunnel({
  counts,
  excluded = 0,
  analysisCount = counts.stage5.classification,
  options = V1_FUNNEL,
}: {
  readonly counts: FunnelCounts;
  /** Which signals the funnel read: the stages shown follow them. */
  readonly options?: FunnelOptions;
  /** Group peers the user has excluded. */
  readonly excluded?: number;
  /** The peers left in the analysis. */
  readonly analysisCount?: number;
}) {
  const shown = stages(counts, options);
  return (
    <div className="mt-4" data-testid="peer-funnel">
      <h3 id={HEADING_ID} className="m-0 mb-2 text-base font-semibold">
        {t('peers.funnel.heading')}
      </h3>
      <ol aria-labelledby={HEADING_ID} className={`m-0 list-none p-0 md:grid ${GRID_COLUMNS[shown.length] ?? ''}`}>
        {shown.map((stage) => (
          <li
            key={stage.name}
            className="border-b border-divider py-2.5 md:border-b-0 md:border-l md:px-3 md:py-0 md:first:border-l-0 md:first:pl-0"
            data-testid="funnel-stage"
          >
            <div className="flex items-baseline justify-between gap-3 md:block">
              <span className="text-[13px] text-slate">{t(stage.name)}</span>
              <span className="figure text-[19px] font-semibold md:block md:text-[24px]" data-testid="funnel-count">
                {String(stage.count)}
              </span>
            </div>
            <Bar count={stage.count} stage1={counts.stage1} />
            {stage.criteria?.map((criterion) => (
              <p key={criterion.name} className="m-0 mt-1.5 flex justify-between gap-3 text-[12px] text-slate md:block">
                <span>{t(criterion.name)}</span>{' '}
                <span className="figure" data-testid="funnel-criterion-count">
                  {String(criterion.count)}
                </span>
              </p>
            ))}
            {stage.note === undefined ? null : (
              <p className="m-0 mt-1 text-[12px] text-slate" data-testid="funnel-note">
                {t(stage.note)}
              </p>
            )}
          </li>
        ))}
      </ol>
      {options.fingerprintSignal || options.textSignal ? null : (
        <p className="m-0 mt-3 text-[13px] text-slate" data-testid="funnel-not-applied">
          {t('peers.funnel.notApplied')}
        </p>
      )}
      {excluded > 0 ? (
        <p className="figure m-0 mt-3 text-[13px] text-slate" data-testid="funnel-excluded">
          {t('peers.funnel.excluded', { n: String(excluded), m: String(analysisCount) })}
        </p>
      ) : null}
    </div>
  );
}
