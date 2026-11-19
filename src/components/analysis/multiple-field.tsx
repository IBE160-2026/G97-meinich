'use client';
// The EV/EBIT multiple field (Story 3.6, decisions 4–7; FR-32, FR-55;
// EXPERIENCE.md "Multiple field", DESIGN.md "Multiple field"): a 90 px text
// input with `inputMode="decimal"`, labelled "EV/EBIT-multippel", empty by
// default, with no placeholder and no suggestion. It is validated on Enter or
// blur, never per keystroke: the text is trimmed and read by
// `parseMultippel`, the URL module's own reader with its bounds, so the field
// and the URL accept exactly the same values. A valid entry is shown as the
// page writes a multiple ("6.50" → "6,5") and handed to `onCommit`, which
// writes it with the one URL hook; an empty or invalid one hands over null,
// so `multippel` leaves the URL. An entry that changes nothing writes and
// announces nothing.
//
// One announcement per entry, in a `role="status"` region empty from load:
// the value's sentence, the error (shown under the field and tied to it with
// `aria-invalid` and `aria-describedby`, as in the search field), or the
// empty sentence when the field is cleared.
//
// Where the profit card has no amount the field is `aria-disabled="true"`
// and read-only, never `disabled`, so it stays focusable, and is described
// by the profit card's own words under it; a multiple in the URL shows
// read-only there.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { EvView } from '@/analysis/verdi-view';
import type { Multiple } from '@/engine/closable';
import { formatMultiple } from '@/engine/format';
import { t } from '@/messages';
import { parseMultippel } from '@/url/analysis-state';

const INPUT_ID = 'verdi-multippel';
/** The error under the field, inside the status region. */
export const MULTIPLE_ERROR_ID = 'verdi-multippel-feil';
/** The reason the field is disabled, under it. */
export const MULTIPLE_REASON_ID = 'verdi-multippel-grunn';

export function MultipleField({
  ev,
  current,
  onCommit,
  announcementFor,
}: {
  readonly ev: EvView;
  /** The multiple the URL holds now. */
  readonly current: Multiple | null;
  /** Writes the multiple into the URL (null: removes it). */
  readonly onCommit: (multiple: Multiple | null) => void;
  /** "Økt selskapsverdi: {v}." for a multiple, at the current share. */
  readonly announcementFor: (multiple: Multiple) => string;
}) {
  const [text, setText] = useState(ev.field);
  const [invalid, setInvalid] = useState(false);
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disabled = ev.kind === 'disabled';

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const announce = (sentence: string) => {
    // Cleared first, so the same sentence twice in a row is announced again; one announcement per entry.
    setMessage('');
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(sentence), 50);
  };

  const commit = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (trimmed === '') {
      // Nothing in the field and nothing in the URL: unchanged.
      if (current === null && !invalid) return;
      setText('');
      setInvalid(false);
      if (current !== null) onCommit(null);
      announce(ev.cleared);
      return;
    }
    const parsed = parseMultippel(trimmed);
    if (parsed === null) {
      // Already showing the error: unchanged.
      if (invalid) return;
      setInvalid(true);
      // The error, shown in the status region, is this entry's announcement.
      setMessage('');
      if (timer.current !== null) clearTimeout(timer.current);
      if (current !== null) onCommit(null);
      return;
    }
    setText(formatMultiple(parsed.toString()));
    if (!invalid && current !== null && current.toString() === parsed.toString()) return;
    setInvalid(false);
    onCommit(parsed);
    announce(announcementFor(parsed));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commit();
  };

  return (
    <div className="mt-2" data-testid="multiple-field">
      <label htmlFor={INPUT_ID} className="m-0 mb-1.5 block text-[13px] font-semibold">
        {t('verdi.ev.label')}
      </label>
      <input
        id={INPUT_ID}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        value={disabled ? ev.field : text}
        readOnly={disabled}
        aria-disabled={disabled ? true : undefined}
        aria-invalid={!disabled && invalid ? true : undefined}
        aria-describedby={disabled ? MULTIPLE_REASON_ID : invalid ? MULTIPLE_ERROR_ID : undefined}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        className={[
          'figure h-9 w-[90px] rounded-md bg-background px-2 text-base',
          disabled ? 'border border-divider text-slate' : invalid ? 'border-2 border-unfavourable' : 'border border-input-border',
        ].join(' ')}
      />
      {disabled ? (
        <p id={MULTIPLE_REASON_ID} className="m-0 mt-1.5 text-[13px] text-slate" data-ev="reason">
          {ev.reason}
        </p>
      ) : null}
      <div role="status" className="text-[13px]" data-testid="multiple-status">
        {!disabled && invalid ? (
          <p id={MULTIPLE_ERROR_ID} className="m-0 mt-1.5 flex items-start gap-2">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-unfavourable">
              <circle cx="8" cy="8" r="7" fill="currentColor" />
              <rect x="7.1" y="3.5" width="1.8" height="6" fill="white" />
              <rect x="7.1" y="10.8" width="1.8" height="1.8" fill="white" />
            </svg>
            <span>{ev.error}</span>
          </p>
        ) : (
          <span className="sr-only">{message}</span>
        )}
      </div>
    </div>
  );
}
