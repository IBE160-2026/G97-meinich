// A decomposition's two factors (Story 3.2; FR-26; EXPERIENCE.md "Factor
// pair"): side by side from `md`, stacked below it. Each factor stands
// alone: the subject's value labelled with the company's name, its own
// median, its own distribution strip, its direction and its own count, or
// "For få sammenlignbare (n av 10)" below the floor, or the absence's words
// ("Ikke lest i denne versjonen" and why). No beste fjerdedel, Plassering or
// kroner, and nothing combines the two factors.
//
// A server component: the factors arrive from `decompositionView`
// (src/analysis/decomposition-view.ts) as strings and strip marks only.
import type { ReactNode } from 'react';
import { t } from '@/messages';
import type { FactorView } from '@/analysis/decomposition-view';
import { DistributionStrip } from './distribution-strip';

function Item({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 py-1">
      <dt className="text-slate">{label}</dt>
      <dd className="figure m-0 text-right">{children}</dd>
    </div>
  );
}

function Factor({ factor, companyName }: { readonly factor: FactorView; readonly companyName: string }) {
  return (
    <div className="min-w-0" data-factor>
      <p className="m-0 font-semibold">{factor.label}</p>
      <dl className="m-0 mt-1 text-[13px]">
        <Item label={companyName}>{factor.own}</Item>
        {'median' in factor ? <Item label={t('keyFigures.col.median')}>{factor.median}</Item> : null}
      </dl>
      {'strip' in factor ? (
        <div className="mt-1">
          <DistributionStrip marks={factor.strip} fluid />
          <span className="figure mt-1 block text-[13px] text-slate">{factor.middleHalf}</span>
        </div>
      ) : null}
      {'belowFloor' in factor ? <p className="m-0 mt-1 text-[13px] text-slate italic">{factor.belowFloor}</p> : null}
      {'detail' in factor && factor.detail !== null ? (
        <p className="m-0 mt-1 text-[13px] text-slate">{factor.detail}</p>
      ) : null}
      {'counts' in factor ? (
        <p className="m-0 mt-1 text-[13px] text-slate">
          {factor.direction} · {factor.counts}
        </p>
      ) : null}
    </div>
  );
}

export function FactorPair({
  factors,
  companyName,
}: {
  readonly factors: readonly [FactorView, FactorView];
  readonly companyName: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6" data-testid="factor-pair">
      <Factor factor={factors[0]} companyName={companyName} />
      <Factor factor={factors[1]} companyName={companyName} />
    </div>
  );
}
