// The one server logger (Story 1.10; technical note, AD-10, AD-19). Every
// log line in src goes through log(); no other module calls console.
//
// A line is one JSON object: the level, the event and a closed set of
// fields. There is no free-form text and no field that could take an
// address, a header, a path or a query (an orgnr looked up is visitor
// activity). The fields are copied one by one and checked at run time too,
// so a value forced past the types (`as`) is dropped, never written.
import type { BudgetName } from './rate-limit/budgets.ts';

export type LogLevel = 'info' | 'warn' | 'error';

export type LogEvent =
  | 'request'
  | 'search.failed'
  | 'notFound.coverageFailed'
  | 'headerSearch.coverageFailed'
  | 'analysis.subjectFailed'
  | 'analysis.candidatesFailed';

/** An error's class and, when it has one, its Postgres SQLSTATE: made only by failureKind. */
export type FailureKind = string & { readonly __brand: 'FailureKind' };

export interface LogFields {
  readonly budget?: BudgetName;
  readonly outcome?: 'served' | 'refused';
  readonly status?: number;
  readonly failure?: FailureKind;
}

const LEVELS: readonly string[] = ['info', 'warn', 'error'];
const EVENTS: readonly string[] = [
  'request',
  'search.failed',
  'notFound.coverageFailed',
  'headerSearch.coverageFailed',
  'analysis.subjectFailed',
  'analysis.candidatesFailed',
];
const BUDGET_NAMES: readonly string[] = ['search', 'analysis'];
const OUTCOMES: readonly string[] = ['served', 'refused'];
const FAILURE = /^[A-Za-z]{1,64}(?: [0-9A-Z]{5})?$/;

/**
 * The error's class name, and its SQLSTATE when its `code` is one: never its
 * message, which can carry the query, an address or a parameter.
 */
export function failureKind(error: unknown): FailureKind {
  const name = error instanceof Error ? error.constructor.name : typeof error;
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  const kind = typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? `${name} ${code}` : name;
  return (FAILURE.test(kind) ? kind : 'unknown') as FailureKind;
}

/** The line log() writes, or null for a level or event it does not know. */
export function logLine(level: LogLevel, event: LogEvent, fields: LogFields = {}): string | null {
  if (!LEVELS.includes(level) || !EVENTS.includes(event)) return null;
  const record: Record<string, string | number> = { level, event };
  if (typeof fields.budget === 'string' && BUDGET_NAMES.includes(fields.budget)) record.budget = fields.budget;
  if (typeof fields.outcome === 'string' && OUTCOMES.includes(fields.outcome)) record.outcome = fields.outcome;
  if (Number.isInteger(fields.status) && (fields.status as number) >= 100 && (fields.status as number) <= 599) {
    record.status = fields.status as number;
  }
  if (typeof fields.failure === 'string' && FAILURE.test(fields.failure)) record.failure = fields.failure;
  return JSON.stringify(record);
}

/** Writes one structured line: errors to stderr, the rest to stdout. */
export function log(level: LogLevel, event: LogEvent, fields: LogFields = {}): void {
  const line = logLine(level, event, fields);
  if (line === null) return;
  if (level === 'error') console.error(line);
  else console.log(line);
}
