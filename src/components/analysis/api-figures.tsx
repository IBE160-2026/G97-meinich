// The three API key figures of one filing, on their own (FR-4): driftsmargin,
// totalkapitalrentabilitet and egenkapitalandel from computeApiKeyFigures,
// each a percent from format.ts, or "Kan ikke beregnes" with its reason.
// No median, beste fjerdedel, Plassering or kroner: there is no peer group.
import type { SubjectFiling } from '@/analysis/view';
import { formatPercent, formatReadDate } from '@/engine/format';
import { apiInputsFromRow } from '@/engine/inputs';
import { computeApiKeyFigures } from '@/engine/key-figures';
import type { ApiKeyFigures, FigureAbsence, FigureResult } from '@/engine/types';
import { t, type MessageId } from '@/messages';

export const FIGURES: readonly {
  readonly key: keyof ApiKeyFigures;
  readonly label: MessageId;
  /** Why the figure is undefined when its denominator is zero or negative. */
  readonly denominator: MessageId;
}[] = [
  { key: 'driftsmargin', label: 'fig.driftsmargin', denominator: 'analysis.figures.reason.revenueNotPositive' },
  { key: 'totalkapitalrentabilitet', label: 'fig.tkr', denominator: 'analysis.figures.reason.assetsNotPositive' },
  { key: 'egenkapitalandel', label: 'fig.ek', denominator: 'analysis.figures.reason.assetsNotPositive' },
];

/** "Kan ikke beregnes: {reason}" for a figure the company's own filing cannot give. */
export function undefinedText(absence: FigureAbsence, denominator: MessageId): string {
  const reason: MessageId =
    absence.reason === 'undefined' && absence.cause === 'denominator_not_positive'
      ? denominator
      : 'analysis.figures.reason.componentMissing';
  return t('analysis.figures.undefined', { grunn: t(reason) });
}

function shown(result: FigureResult, denominator: MessageId): string {
  if (result.kind === 'value') return formatPercent(result.value.toString());
  return undefinedText(result.absence, denominator);
}

export function ApiFigures({ filing }: { readonly filing: SubjectFiling }) {
  const figures = computeApiKeyFigures(apiInputsFromRow(filing.keyFigures));
  return (
    <section aria-labelledby="nokkeltall-tittel" className="mt-6">
      <h2 id="nokkeltall-tittel" className="m-0 mb-1 text-lg md:text-xl">
        {t('analysis.figures.title')}
      </h2>
      <p className="m-0 mb-3 text-[13px] text-slate">
        {t('analysis.dataDate', { aar: String(filing.filingYear), dato: formatReadDate(filing.readAt) })}
      </p>
      <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FIGURES.map((figure) => (
          <div key={figure.key} className="min-w-0 rounded-lg border border-divider p-4">
            <dt className="text-[13px] text-slate">{t(figure.label)}</dt>
            <dd className="figure m-0 mt-1 text-[22px] font-semibold break-words" data-testid={`figure-${figure.key}`}>
              {shown(figures[figure.key], figure.denominator)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="m-0 mt-3 text-slate">{t('analysis.figures.noPeers')}</p>
    </section>
  );
}
