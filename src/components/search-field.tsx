'use client';

// The search field (FR-1; EXPERIENCE.md "Search field", "Search results"):
// one field for a name or an organisation number, an ARIA 1.2 combobox over
// GET /api/sok. Two variants share every behaviour: `hero` on the front page
// and `compact` in the header on every other page (Story 1.6b).
//
// - Validation runs on submit and blur only, never while typing.
// - Typing searches after a 300 ms pause, one request at a time; nothing
//   navigates on input alone. Enter on an option, a click, or a submitted
//   nine-digit orgnr that matches exactly navigates to the company's analysis,
//   whose URL is written by src/url/analysis-state.ts.
// - One polite live region, present empty from page load, carries the count,
//   the no-match and unknown-orgnr copy, validation messages and loading.
//   A failed request fills a separate role="alert" and shows no results.
// - The header field outlives a navigation, so a change of pathname resets
//   its loading state and notice; opening the company already shown does
//   not set the loading state at all.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { PATH_CONTEXT } from '@/analysis/view';
import { DEMO_COMPANIES } from '@/demo-companies';
import { formatKommune, formatOrgnr } from '@/engine/format';
import { classifySearchInput, type SearchInput } from '@/engine/orgnr';
import { t } from '@/messages';
import { industryNamed } from '@/messages/industry';
import { MAX_SEARCH_LENGTH, SEARCH_ENDPOINT, type SearchResult } from '@/search-contract';
import { defaultState, parse, serialize } from '@/url/analysis-state';

export const SEARCH_DEBOUNCE_MS = 300;
const MIN_NAME_LENGTH = 2;

type Result = SearchResult;

export type ValidationId = 'search.empty' | 'search.orgnrLength' | 'search.orgnrChecksum';

type Notice =
  | { readonly kind: 'none' }
  | { readonly kind: 'count'; readonly n: number }
  | { readonly kind: 'noMatch'; readonly q: string }
  | { readonly kind: 'unknownOrgnr' }
  | { readonly kind: 'invalid'; readonly id: ValidationId }
  | { readonly kind: 'loading' };

const NONE: Notice = { kind: 'none' };

export interface SearchFieldProps {
  readonly variant: 'hero' | 'compact';
  /** The covered industries as written mid-sentence, e.g. "name (code)", from the register. */
  readonly coverage: string;
  /** The field's value on first render: the input of an invalid analysis URL. */
  readonly initialValue?: string;
  /** A validation message shown on first render, with the error state. */
  readonly initialError?: ValidationId;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

// The response is checked rather than trusted: anything unexpected is a
// failure, never a partial list.
function parseResults(body: unknown): Result[] | null {
  if (!Array.isArray(body)) return null;
  const results: Result[] = [];
  for (const item of body as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const row = item as Record<string, unknown>;
    const code = row.naeringskode1;
    if (typeof code !== 'object' || code === null) return null;
    const { kode, beskrivelse } = code as Record<string, unknown>;
    if (
      typeof row.orgnr !== 'string' ||
      !/^\d{9}$/.test(row.orgnr) ||
      !nullableString(row.navn) ||
      !nullableString(row.kommune) ||
      !nullableString(kode) ||
      !nullableString(beskrivelse)
    ) {
      return null;
    }
    results.push({ navn: row.navn, orgnr: row.orgnr, naeringskode1: { kode, beskrivelse }, kommune: row.kommune });
  }
  return results;
}

function analysisHref(orgnr: string): string {
  return serialize(defaultState(orgnr));
}

// "orgnr · industry · municipality", leaving out what the register lacks:
// no empty separator and no placeholder.
function resultDetail(result: Result): string {
  const { kode, beskrivelse } = result.naeringskode1;
  const parts = [formatOrgnr(result.orgnr)];
  if (kode !== null) parts.push(industryNamed({ code: kode, beskrivelse }));
  else if (beskrivelse !== null) parts.push(beskrivelse);
  if (result.kommune !== null) parts.push(formatKommune(result.kommune));
  return parts.join(' · ');
}

function validationId(input: SearchInput): ValidationId | null {
  if (input.kind === 'empty') return 'search.empty';
  if (input.kind === 'length') return 'search.orgnrLength';
  if (input.kind === 'checksum') return 'search.orgnrChecksum';
  return null;
}

function searchable(input: SearchInput): input is Extract<SearchInput, { kind: 'orgnr' | 'name' }> {
  return input.kind === 'orgnr' || (input.kind === 'name' && Array.from(input.name).length >= MIN_NAME_LENGTH);
}

/** The orgnr of the analysis at `pathname`, or null on any other page. */
function shownOrgnr(pathname: string): string | null {
  const parsed = parse(pathname, PATH_CONTEXT);
  return parsed.kind === 'analysis' ? parsed.state.orgnr : null;
}

export function SearchField({ variant, coverage, initialValue = '', initialError }: SearchFieldProps) {
  const router = useRouter();
  const pathname = usePathname();
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const messageId = `${baseId}-message`;
  const labelId = `${baseId}-label`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [value, setValue] = useState(initialValue);
  const [results, setResults] = useState<readonly Result[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  const [notice, setNotice] = useState<Notice>(initialError === undefined ? NONE : { kind: 'invalid', id: initialError });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // A navigation has happened under the field (it lives in the header, which
  // stays mounted): what it was showing belongs to the previous page.
  // Adjusted during render, the pattern React documents for state that
  // follows a prop, so no stale "Henter analysen …" is ever painted.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setBusy(false);
    setNotice(NONE);
    setFailed(false);
    setResults([]);
    setExpanded(false);
    setActive(-1);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cancelPending = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    request.current?.abort();
    request.current = null;
  };

  useEffect(() => cancelPending, []);

  const clearResults = () => {
    setResults([]);
    setExpanded(false);
    setActive(-1);
  };

  // One request; a newer one aborts it. Returns null when superseded.
  const fetchResults = async (q: string): Promise<Result[] | 'failed' | null> => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return 'failed';
      return parseResults(await response.json()) ?? 'failed';
    } catch {
      return controller.signal.aborted ? null : 'failed';
    } finally {
      if (request.current === controller) request.current = null;
    }
  };

  const showFailure = () => {
    clearResults();
    setNotice(NONE);
    setFailed(true);
  };

  // `typing`: a debounced search may land after the field lost focus; it
  // then updates the results but does not re-open the list.
  const showResults = (
    input: Extract<SearchInput, { kind: 'orgnr' | 'name' }>,
    rows: readonly Result[],
    typing = false,
  ) => {
    setFailed(false);
    setResults(rows);
    setActive(-1);
    setExpanded(rows.length > 0 && (!typing || inputRef.current === document.activeElement));
    if (rows.length > 0) setNotice({ kind: 'count', n: rows.length });
    else if (input.kind === 'orgnr') setNotice({ kind: 'unknownOrgnr' });
    else setNotice({ kind: 'noMatch', q: input.name });
  };

  const open = (orgnr: string) => {
    cancelPending();
    setExpanded(false);
    if (shownOrgnr(pathname) === orgnr) {
      // The company is already on screen: the URL may not change, so a
      // loading state would never be cleared.
      setBusy(false);
      setNotice(NONE);
    } else {
      setBusy(true);
      setNotice({ kind: 'loading' });
    }
    router.push(analysisHref(orgnr));
  };

  const onChange = (next: string) => {
    setValue(next);
    cancelPending();
    // Results belong to the previous value: collapse them, so Enter during
    // the pause never opens an option fetched for older input.
    setExpanded(false);
    setActive(-1);
    // Typing never validates; it only clears an earlier message.
    if (notice.kind === 'invalid' || notice.kind === 'noMatch' || notice.kind === 'unknownOrgnr') setNotice(NONE);
    setFailed(false);
    const input = classifySearchInput(next);
    if (!searchable(input)) {
      clearResults();
      if (notice.kind === 'count') setNotice(NONE);
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      void fetchResults(next).then((outcome) => {
        if (outcome === null) return;
        if (outcome === 'failed') showFailure();
        else showResults(input, outcome, true);
      });
    }, SEARCH_DEBOUNCE_MS);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const chosen = expanded && active >= 0 ? results[active] : undefined;
    if (chosen !== undefined) {
      open(chosen.orgnr);
      return;
    }
    cancelPending();
    const input = classifySearchInput(value);
    const invalid = validationId(input);
    if (invalid !== null || !searchable(input)) {
      clearResults();
      setFailed(false);
      setNotice(invalid !== null ? { kind: 'invalid', id: invalid } : { kind: 'noMatch', q: value.trim() });
      return;
    }
    setBusy(true);
    setFailed(false);
    setNotice({ kind: 'loading' });
    const outcome = await fetchResults(input.kind === 'orgnr' ? input.orgnr : input.name);
    if (outcome === null) {
      setBusy(false);
      return;
    }
    if (outcome === 'failed') {
      setBusy(false);
      showFailure();
      return;
    }
    if (input.kind === 'orgnr') {
      const exact = outcome.find((row) => row.orgnr === input.orgnr);
      if (exact !== undefined) {
        open(exact.orgnr);
        return;
      }
    }
    setBusy(false);
    showResults(input, outcome);
  };

  const onBlur = (relatedTarget: EventTarget | null, form: HTMLFormElement) => {
    if (relatedTarget instanceof Node && form.contains(relatedTarget)) return;
    setExpanded(false);
    setActive(-1);
    if (busy || value.trim() === '') return;
    const invalid = validationId(classifySearchInput(value));
    if (invalid !== null) {
      cancelPending();
      clearResults();
      setNotice({ kind: 'invalid', id: invalid });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (results.length === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (!expanded) {
        setExpanded(true);
        setActive(step === 1 ? 0 : results.length - 1);
        return;
      }
      setActive((current) => {
        if (current < 0) return step === 1 ? 0 : results.length - 1;
        return (current + step + results.length) % results.length;
      });
      return;
    }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      setExpanded(false);
      setActive(-1);
    }
    // Enter submits the form; onSubmit opens the active option if there is one.
  };

  const invalid = notice.kind === 'invalid';
  const hero = variant === 'hero';
  const showDemoLinks = notice.kind === 'noMatch' || notice.kind === 'unknownOrgnr';
  const activeOption = expanded && active >= 0 ? optionId(active) : undefined;

  const inputClass = [
    'block w-full min-w-0 bg-background text-navy-900 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700',
    hero
      ? 'h-14 rounded-lg px-3.5 text-base md:h-[60px] md:rounded-r-none md:px-[18px] md:text-xl'
      : 'h-11 rounded-l-md px-2.5 text-[14px] md:h-9',
    invalid ? 'border-2 border-unfavourable' : 'border border-input-border',
    hero && !invalid ? 'md:border-r-0' : '',
    busy ? 'bg-surface text-slate' : '',
  ].join(' ');

  const buttonClass = [
    'inline-flex shrink-0 items-center justify-center gap-2 bg-navy-700 font-semibold whitespace-nowrap text-primary-foreground disabled:bg-band',
    hero
      ? 'h-[52px] w-full rounded-lg px-7 text-base md:h-[60px] md:w-auto md:rounded-l-none'
      : 'h-11 w-11 rounded-r-md text-[13px] md:h-9 md:w-auto md:px-3',
  ].join(' ');

  return (
    <form
      role="search"
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      onBlur={(event) => onBlur(event.relatedTarget, event.currentTarget)}
      className={hero ? 'w-full text-left' : 'relative w-full min-w-0'}
      data-variant={variant}
    >
      <label id={labelId} htmlFor={inputId} className={hero ? 'mb-1.5 block text-[13px] text-slate' : 'sr-only'}>
        {t('search.label')}
      </label>
      <div className={hero ? 'flex flex-col gap-2.5 md:flex-row md:gap-0' : 'flex'}>
        <div className="relative min-w-0 flex-1">
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            role="combobox"
            name="q"
            value={value}
            maxLength={MAX_SEARCH_LENGTH}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={hero ? undefined : t('search.label')}
            readOnly={busy}
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={listboxId}
            aria-activedescendant={activeOption}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? messageId : undefined}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            className={inputClass}
          />
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            hidden={!expanded}
            className="absolute top-full right-0 left-0 z-20 m-0 mt-1 list-none overflow-hidden rounded-md border border-divider bg-background p-0 shadow-md"
          >
            {results.map((result, index) => (
              <li
                key={result.orgnr}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => open(result.orgnr)}
                className={`block min-h-11 cursor-pointer px-3 py-2 ${index === active ? 'bg-surface' : ''}`}
              >
                <span className="block font-semibold break-words">{result.navn ?? formatOrgnr(result.orgnr)}</span>
                <span className="figure block text-[13px] break-words text-slate">{resultDetail(result)}</span>
              </li>
            ))}
          </ul>
        </div>
        <button type="submit" disabled={busy} className={buttonClass}>
          <span
            aria-hidden="true"
            className={busy ? 'hidden size-3.5 rounded-full border-2 border-divider border-t-primary-foreground motion-safe:inline-block motion-safe:animate-spin' : 'hidden'}
          />
          {hero ? (
            t('search.submit')
          ) : (
            <>
              {/* Below md the compact button is a 44 × 44 px magnifier that
                  keeps "Sammenlign" as its name for assistive technology, so
                  the field keeps at least 200 px at 320 px. */}
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 md:hidden">
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="sr-only md:not-sr-only">{t('search.submit')}</span>
            </>
          )}
        </button>
      </div>
      <div role="status" className={hero ? 'mt-2.5 text-[14px]' : 'text-[13px]'}>
        {notice.kind === 'count' ? <span className="sr-only">{t('search.count', { n: String(notice.n) })}</span> : null}
        {notice.kind === 'loading' ? <span className="text-slate">{t('search.loading')}</span> : null}
        {notice.kind === 'invalid' ? (
          <p id={messageId} className="m-0 flex items-start gap-2">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-unfavourable">
              <circle cx="8" cy="8" r="7" fill="currentColor" />
              <rect x="7.1" y="3.5" width="1.8" height="6" fill="white" />
              <rect x="7.1" y="10.8" width="1.8" height="1.8" fill="white" />
            </svg>
            <span>{t(notice.id)}</span>
          </p>
        ) : null}
        {notice.kind === 'noMatch' ? (
          <p className="m-0">{t('search.noMatch', { q: notice.q, industry: coverage })}</p>
        ) : null}
        {notice.kind === 'unknownOrgnr' ? (
          <p className="m-0">{t('search.unknownOrgnr', { industry: coverage })}</p>
        ) : null}
      </div>
      {showDemoLinks ? (
        <p className="m-0 mt-1 flex flex-wrap gap-x-4 text-[14px]">
          {DEMO_COMPANIES.map((company) => (
            <Link key={company.orgnr} href={analysisHref(company.orgnr)} className="inline-flex min-h-6 items-center">
              {company.navn}
            </Link>
          ))}
        </p>
      ) : null}
      <div role="alert" className="text-[14px]">
        {failed ? <p className="m-0 mt-2.5">{t('search.failed')}</p> : null}
      </div>
    </form>
  );
}
