'use client';
// The closable-share control (Story 3.5; FR-31; EXPERIENCE.md "Closable-share
// control", DESIGN.md "Closable-share control"): a `radiogroup` of fixed
// steps, never a slider, 0 / 25 / 50 / 75 / 100 % and "Til medianen for
// driftsmargin (n %)" in its ordered place, with roving tabindex. Only the
// checked step is in the tab order; the arrow keys move to the next or
// previous step and choose it, Space and Enter choose the focused one.
//
// The median step where none exists is `aria-disabled="true"`, never
// `disabled`, so it stays focusable and the arrow keys reach it; it is
// described by the line under the control, which gives the reason, and
// choosing it does nothing. That line, with its 2 × 12 px median tick, shows
// in every state, and "Medianen gjelder driftsmargin." with it.
//
// Presentational: every label and line arrives as a string
// (src/analysis/verdi-view.ts); the panel (verdi-panel.tsx) writes the URL.
// A three-column grid wrapping to two rows on the phone, six columns from
// `md`; the focus ring is drawn inset, so no container clips it.
import { useRef, type KeyboardEvent } from 'react';
import type { StepView } from '@/analysis/verdi-view';
import type { ClosableShare } from '@/engine/closable';
import { t } from '@/messages';

const LABEL_ID = 'verdi-andel';
/** The line under the control, which describes a disabled median step. */
export const MEDIAN_LINE_ID = 'verdi-median-linje';

export function ClosableShareControl({
  steps,
  current,
  line,
  applies,
  onChoose,
}: {
  readonly steps: readonly StepView[];
  readonly current: ClosableShare;
  /** "Median nås ved n % av gapet. …", or the reason there is no median step. */
  readonly line: string;
  /** "Medianen gjelder driftsmargin." when `line` does not say it. */
  readonly applies: string | null;
  readonly onChoose: (share: ClosableShare) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (step: StepView) => {
    if (step.disabled || step.share === current) return;
    onChoose(step.share);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const move = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (move === 0) return;
    event.preventDefault();
    const nextIndex = (index + move + steps.length) % steps.length;
    const next = steps[nextIndex];
    if (next === undefined) return;
    buttons.current[nextIndex]?.focus();
    choose(next);
  };

  return (
    <div className="mt-4" data-testid="closable-share">
      <p id={LABEL_ID} className="m-0 mb-1.5 text-[13px] font-semibold">
        {t('verdi.control.label')}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={LABEL_ID}
        className="grid w-full grid-cols-3 overflow-visible rounded-lg border border-input-border md:max-w-3xl md:grid-cols-6"
      >
        {steps.map((step, index) => {
          const checked = step.share === current;
          return (
            <button
              key={String(step.share)}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={step.disabled ? 'true' : undefined}
              aria-describedby={step.disabled ? MEDIAN_LINE_ID : undefined}
              tabIndex={checked ? 0 : -1}
              data-share-step={String(step.share)}
              onClick={() => choose(step)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-11 min-w-0 border-input-border px-1.5 py-2 text-center text-[12px] leading-[1.25] break-words focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-navy-700 md:px-2 md:text-[13px] ${
                index % 3 > 0 ? 'border-l' : ''
              } ${index >= 3 ? 'border-t md:border-t-0' : ''} ${index > 0 && index % 3 === 0 ? 'md:border-l' : ''} ${
                step.disabled
                  ? 'cursor-not-allowed bg-surface text-disabled-text'
                  : checked
                    ? 'bg-navy-700 font-semibold text-primary-foreground focus-visible:outline-primary-foreground'
                    : 'bg-background text-navy-900'
              }`}
            >
              <span className="figure">{step.label}</span>
            </button>
          );
        })}
      </div>
      <p className="m-0 mt-2 flex items-start gap-2 text-[13px] text-slate" data-testid="verdi-median-line">
        <span aria-hidden="true" className="mt-[3px] inline-block h-3 w-0.5 shrink-0 bg-median" />
        <span>
          <span id={MEDIAN_LINE_ID}>{line}</span>
          {applies !== null ? <span>{` ${applies}`}</span> : null}
        </span>
      </p>
    </div>
  );
}
