// The Oversikt tab's hero card (Story 1.9; FR-29, FR-55; EXPERIENCE.md
// "Hero card", "Hero, no profit gap"; DESIGN.md "Hero card"): always
// driftsmargin, the only API figure with a per-year kroner amount, at full
// convergence to beste fjerdedel.
//
// A server component. It reads the same `group.benchmark.driftsmargin` the
// Nøkkeltall og gap table reads for the same URL and recomputes nothing: the
// amount is kronerAmountText, the function the table's gap cell calls, so
// the two strings are the same by construction; the context line's sides
// come from the engine's heroContext. Only formatted strings reach the page
// (AD-4), every number through format.ts, every word through t().
//
// A 12-column grid from `md` with the hero spanning 5 (the rest of the grid
// arrives in Epic 3), one column below it. The amount scales with the card
// (`.hero-amount` in globals.css), so it never wraps or overflows.
import Link from 'next/link';
import { heroContext, type FigureBenchmark } from '@/engine/benchmark';
import { formatPercent, formatPercentagePoints, formatWholePercent } from '@/engine/format';
import type { EmptyReason } from '@/engine/peers';
import { MIN_PEERS } from '@/engine/types';
import { t, type MessageId } from '@/messages';
import { serialize, type AnalysisState } from '@/url/analysis-state';
import { DIRECTION_WORDS, FIGURES, undefinedText } from './api-figures';
import { kronerAmountText } from './kroner-amount';
import { emptyText } from './peer-list';

const KICKER_ID = 'hero-kicker';

/** What the hero shows, decided once from the engine's result. */
type HeroModel =
  /** The group is empty for the subject's own reason: the Peers tab's sentence. */
  | { readonly kind: 'empty'; readonly own: string; readonly sentence: string }
  /** The own value is undefined: "Kan ikke beregnes: …" and nothing else. */
  | { readonly kind: 'absent'; readonly own: string }
  | { readonly kind: 'below_floor'; readonly own: string; readonly text: string }
  | {
      readonly kind: 'compared';
      readonly main:
        | { readonly kind: 'amount'; readonly text: string }
        | { readonly kind: 'strength' }
        | { readonly kind: 'not_nok' };
      readonly vs: string;
      readonly context: string;
    };

// Why an undefined driftsmargin is undefined, as the table words it.
function driftsmarginDenominator(): MessageId {
  const found = FIGURES.find((figure) => figure.key === 'driftsmargin');
  if (found === undefined) throw new Error('FIGURES has no driftsmargin');
  return found.denominator;
}

function heroModel(figure: FigureBenchmark, emptyReason: EmptyReason, filingYear: number): HeroModel {
  const c = figure.comparison;
  const own =
    c.kind === 'subject_absent'
      ? undefinedText(c.absence, driftsmarginDenominator())
      : formatPercent(c.subject.toString());
  if (emptyReason !== null) return { kind: 'empty', own, sentence: emptyText(emptyReason, filingYear) };
  if (c.kind === 'subject_absent') return { kind: 'absent', own };
  if (c.kind === 'below_floor') {
    return { kind: 'below_floor', own, text: t('keyFigures.belowFloor', { n: String(c.count), min: String(MIN_PEERS) }) };
  }
  const context = heroContext(c);
  // A compared driftsmargin always has a beste fjerdedel (it has a direction).
  if (context === null || c.best === null) throw new Error('a compared driftsmargin has no beste fjerdedel');
  const med = formatPercent(c.median.toString());
  const best =
    context.best === 'at'
      ? t('hero.ctx.best.at')
      : t(`hero.ctx.best.${context.best}`, { pp: formatPercentagePoints(context.toBest.toString()) });
  const gap = figure.gap;
  // A compared driftsmargin always has a kroner gap: an amount, a strength or not in NOK.
  if (gap.kind === 'none') throw new Error('a compared driftsmargin has no kroner gap');
  return {
    kind: 'compared',
    main: gap.kind === 'amount' ? { kind: 'amount', text: kronerAmountText(gap) } : { kind: gap.kind },
    vs: t('hero.vs', { own, best: formatPercent(c.best.quartile.toString()) }),
    context: t('hero.ctx', {
      median: t(`hero.ctx.median.${context.median}`, { med }),
      plassering: t('keyFigures.placement', { v: formatWholePercent(c.best.percentile.toString()) }),
      best,
    }),
  };
}

const figurePair = 'figure m-0 text-[18px] font-semibold break-words';

function Body({ model }: { readonly model: HeroModel }) {
  if (model.kind !== 'compared') {
    return (
      <>
        <p className={`${figurePair} mt-2.5`} data-testid="hero-own">
          {model.own}
        </p>
        {model.kind === 'below_floor' ? <p className="m-0 mt-1.5 text-slate italic">{model.text}</p> : null}
        {model.kind === 'empty' ? <p className="m-0 mt-1.5">{model.sentence}</p> : null}
      </>
    );
  }
  const main = model.main;
  return (
    <>
      {main.kind === 'amount' ? (
        <>
          <p className="hero-amount m-0 mt-2.5" data-testid="hero-amount">
            {main.text}
          </p>
          <p className="m-0 mt-1 text-slate">{t('hero.perYear')}</p>
        </>
      ) : null}
      {main.kind === 'strength' ? (
        <p className="m-0 mt-2.5 text-[22px] font-semibold" data-testid="hero-strength">
          {t('keyFigures.strength')}
        </p>
      ) : null}
      {main.kind === 'not_nok' ? (
        <p className={`${figurePair} mt-2.5`} data-testid="hero-not-nok">
          {t('keyFigures.notInKroner')}
        </p>
      ) : null}
      <p className={`${figurePair} mt-4`} data-testid="hero-vs">
        {model.vs}
      </p>
      <p className="m-0 mt-1.5 text-slate" data-testid="hero-context">
        {model.context}
      </p>
      {main.kind === 'strength' ? <p className="m-0 mt-3">{t('hero.noGap')}</p> : null}
    </>
  );
}

export function OversiktHero({
  figure,
  state,
  emptyReason,
  filingYear,
}: {
  /** The shown group's driftsmargin benchmark, the same the table reads. */
  readonly figure: FigureBenchmark;
  /** The URL's state; the link to the table keeps every setting. */
  readonly state: AnalysisState;
  readonly emptyReason: EmptyReason;
  /** The subject's benchmark year, named when it has no revenue to compare. */
  readonly filingYear: number;
}) {
  const model = heroModel(figure, emptyReason, filingYear);
  return (
    <div className="mt-2" data-testid="oversikt">
      {model.kind === 'compared' ? <p className="m-0 text-[13px] text-slate">{t('keyFigures.topNote')}</p> : null}
      <div className="mt-4 grid grid-cols-1 gap-grid-gap-phone md:grid-cols-12 md:gap-grid-gap">
        <section
          aria-labelledby={KICKER_ID}
          data-testid="hero"
          className="@container min-w-0 rounded-lg border border-divider p-card-padding-phone md:col-span-5 md:p-card-padding"
        >
          <h3
            id={KICKER_ID}
            className="m-0 font-sans text-[11px] font-semibold tracking-[0.06em] text-slate uppercase"
          >
            {t('hero.kicker')}
          </h3>
          <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
            <span>{t('fig.driftsmargin')}</span>
            <span className="rounded-sm border border-divider px-1.5 py-px text-[11.5px] font-normal whitespace-nowrap text-slate">
              {t(DIRECTION_WORDS[figure.direction])}
            </span>
          </p>
          <Body model={model} />
          <p className="m-0 mt-4 text-[13px]">
            <Link href={serialize({ ...state, fane: 'nokkeltall' })} className="inline-flex min-h-6 items-center">
              {t('hero.link')}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
