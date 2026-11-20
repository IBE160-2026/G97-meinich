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
  /** The invalid text the error is shown for, or null: no error. */
  const [invalidText, setInvalidText] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the field last wrote, or found in the URL ("6.5", or null for none), and the invalid text
  // it last showed the error for. Read by `commit` from refs, not from props or state, so Enter
  // followed at once by a blur, before Next.js renders the new URL, is one entry, not two.
  const committed = useRef<string | null>(current === null ? null : current.toString());
  const lastInvalid = useRef<string | null>(null);
  const disabled = ev.kind === 'disabled';

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  // The URL's multiple changed without this field writing it (back or forward, a link, a peer change
  // that keeps the panel mounted): the field shows it, and any error goes. The input is not
  // remounted, so focus stays where it is.
  const currentText = current === null ? null : current.toString();
  useEffect(() => {
    if (currentText === committed.current) return;
    committed.current = currentText;
    lastInvalid.current = null;
    setInvalidText(null);
    setText(currentText === null ? '' : formatMultiple(currentText));
  }, [currentText]);

  const announce = (sentence: string) => {
    // Cleared first, so the same sentence twice in a row is announced again; one announcement per entry.
    setMessage('');
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(sentence), 50);
  };

  /** Removes the multiple from the URL, if the field's last write or the URL holds one. */
  const removeCommitted = () => {
    if (committed.current === null) return;
    committed.current = null;
    onCommit(null);
  };

  const commit = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (trimmed === '') {
      // Nothing in the field, nothing in the URL and no error: unchanged.
      if (committed.current === null && lastInvalid.current === null) return;
      setText('');
      lastInvalid.current = null;
      setInvalidText(null);
      removeCommitted();
      announce(ev.cleared);
      return;
    }
    const parsed = parseMultippel(trimmed);
    if (parsed === null) {
      // The same invalid text again: unchanged. Another invalid text is a new entry and is
      // announced again: the error paragraph is keyed by the text, so the region changes once.
      if (trimmed === lastInvalid.current) return;
      lastInvalid.current = trimmed;
      setInvalidText(trimmed);
      // The error, shown in the status region, is this entry's announcement.
      setMessage('');
      if (timer.current !== null) clearTimeout(timer.current);
      removeCommitted();
      return;
    }
    const value = parsed.toString();
    setText(formatMultiple(value));
    if (lastInvalid.current === null && committed.current === value) return;
    lastInvalid.current = null;
    setInvalidText(null);
    if (committed.current !== value) {
      committed.current = value;
      onCommit(parsed);
    }
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
        aria-invalid={!disabled && invalidText !== null ? true : undefined}
        aria-describedby={disabled ? MULTIPLE_REASON_ID : invalidText !== null ? MULTIPLE_ERROR_ID : undefined}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        className={[
          'figure h-9 w-[90px] rounded-md px-2 text-base',
          disabled
            ? 'cursor-not-allowed border border-input-border bg-surface text-disabled-text'
            : invalidText !== null
              ? 'border-2 border-unfavourable bg-background'
              : 'border border-input-border bg-background',
        ].join(' ')}
      />
      {disabled ? (
        <p id={MULTIPLE_REASON_ID} className="m-0 mt-1.5 text-[13px] text-slate" data-ev="reason">
          {ev.reason}
        </p>
      ) : null}
      <div role="status" className="text-[13px]" data-testid="multiple-status">
        {!disabled && invalidText !== null ? (
          <p key={invalidText} id={MULTIPLE_ERROR_ID} className="m-0 mt-1.5 flex items-start gap-2">
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
