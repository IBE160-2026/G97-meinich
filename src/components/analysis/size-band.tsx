'use client';
// The size-band control (Story 2.8; FR-18; EXPERIENCE.md "Size-band
// control", DESIGN.md "Size-band control"): a `radiogroup` of three fixed
// steps, never a slider, with roving tabindex. Only the checked step is in
// the tab order; the arrow keys move to the next or previous step and choose
// it, Space and Enter choose the focused one, as a native radio group does.
// Choosing a step is a peer-group change (peer-change.tsx): a soft
// navigation to the URL with `band` set, one history entry, and focus stays
// on the step. Every label and range arrives as a string from the server
// (src/analysis/size-band.ts); this module formats nothing.
//
// A full-width three-column grid at every width, so the phone needs no
// sideways scroll. The focus ring is drawn inset, as DESIGN.md says for
// segmented controls, so no container clips it.
import { useRef, useState, type KeyboardEvent } from 'react';
import type { BandStep } from '@/analysis/size-band';
import type { Band } from '@/url/analysis-state';
import { usePeerChange } from './peer-change';

const LABEL_ID = 'storrelsesintervall';
const NOTE_ID = 'storrelsesintervall-merknad';

export function SizeBandControl({
  steps,
  band,
  label,
  note,
}: {
  readonly steps: readonly BandStep[];
  /** The band the page was rendered at. */
  readonly band: Band;
  /** "Størrelsesintervall". */
  readonly label: string;
  /** The sentence that comparability is never loosened. */
  readonly note: string;
}) {
  const peerChange = usePeerChange();
  // The step last chosen: checked at once, while the change is in flight.
  const [chosen, setChosen] = useState<Band>(band);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (next: Band) => {
    if (next === chosen) return;
    setChosen(next);
    peerChange?.change({ kind: 'band', band: next });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const nextIndex = (index + step + steps.length) % steps.length;
    const next = steps[nextIndex];
    if (next === undefined) return;
    buttons.current[nextIndex]?.focus();
    choose(next.band);
  };

  return (
    <div className="mt-4">
      <p id={LABEL_ID} className="m-0 mb-1.5 text-[13px] font-semibold">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={LABEL_ID}
        aria-describedby={NOTE_ID}
        className="grid w-full grid-cols-3 rounded-lg border border-input-border md:max-w-xl"
        data-testid="size-band"
      >
        {steps.map((step, index) => {
          const checked = step.band === chosen;
          return (
            <button
              key={step.band}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-band-step={step.band}
              onClick={() => choose(step.band)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-11 min-w-0 px-1.5 py-2 text-center text-[12px] leading-[1.25] break-words focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-navy-700 md:px-3 md:text-[13px] ${
                index > 0 ? 'border-l border-input-border' : ''
              } ${checked ? 'bg-navy-700 text-primary-foreground focus-visible:outline-primary-foreground' : 'bg-background text-navy-900'}`}
            >
              <span className="block font-semibold">
                {step.factors}
                <span aria-hidden="true"> / </span>
                <span className="sr-only"> </span>
                {step.kind}
              </span>
              {step.range === null ? null : <span className="figure mt-0.5 block">{step.range}</span>}
            </button>
          );
        })}
      </div>
      <p id={NOTE_ID} className="m-0 mt-2 text-[13px] text-slate" data-testid="size-band-note">
        {note}
      </p>
    </div>
  );
}
