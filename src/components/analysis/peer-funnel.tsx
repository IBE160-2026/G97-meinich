// The funnel (Story 2.7; FR-15, FR-9, FR-14; DESIGN.md "Funnel"): the five
// stages with the count each one leaves, shown whether or not the group
// clears the 10-peer floor. Segment names each criterion it applies with
// its own count (in v1 legal form only, worded so the user learns v1 admits
// AS only). Below it, the flagged count with ✦.
//
// Five columns from `md`, a vertical list below it (name left, count right,
// bar beneath). Each bar is an 8px navy-700 bar proportional to stage 1,
// its width `calc(100% * n / stage1)` from the integer counts, so no
// fraction is computed here. Bars are decorative (`aria-hidden`): the count
// beside each is the value. Counts are identification, not benchmarked
// figures, so they carry no median.
import type { ReactNode } from 'react';
import type { FunnelCounts } from '@/engine/peers';
import { t, type MessageId } from '@/messages';
import { AiMark } from './ai-mark';

type Stage = {
  readonly name: MessageId;
  readonly count: number;
  /** Each criterion the stage applies, with the count left after it. */
  readonly criteria?: readonly { readonly name: MessageId; readonly count: number }[];
};

function stages(counts: FunnelCounts): readonly Stage[] {
  return [
    { name: 'peers.funnel.stage1', count: counts.stage1 },
    { name: 'peers.funnel.stage2', count: counts.stage2 },
    {
      name: 'peers.funnel.stage3',
      count: counts.stage3.legalForm,
      criteria: [{ name: 'peers.funnel.segment.legalForm', count: counts.stage3.legalForm }],
    },
    { name: 'peers.funnel.stage4', count: counts.stage4.businessModel },
    { name: 'peers.funnel.stage5', count: counts.stage5.classification },
  ];
}

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

export function PeerFunnel({ counts }: { readonly counts: FunnelCounts }) {
  return (
    <div className="mt-4" data-testid="peer-funnel">
      <ol aria-label={t('peers.funnel.label')} className="m-0 list-none p-0 md:grid md:grid-cols-5">
        {stages(counts).map((stage) => (
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
          </li>
        ))}
      </ol>
      <p className="m-0 mt-3 text-[13px] text-slate" data-testid="funnel-flagged">
        <AiMark />
        {t('peers.funnel.flagged', { n: String(counts.stage5.flagged) })}
      </p>
    </div>
  );
}
