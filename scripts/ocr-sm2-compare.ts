// The SM-2 measurement's pure parts (Story 2.3; NFR25, FR-28): reading the
// hand transcriptions and the stored document rows, classifying every
// compared field, and the consistency denominators. No file or database
// access here; scripts/ocr-sm2.ts reads the committed files and writes the
// report.
//
// Every amount is a bigint: stored figures in øre (parseOre), transcribed
// figures in whole kroner, compared as øre = kroner × 100. A blank cell and a
// NULL column are absent, never 0.
import { parseOre } from '../src/engine/inputs.ts';
import { type DrawnFiling, compareBytes, parseCsv } from './seed-format.ts';

/** The 23 lines `read_document` targets (ingest/src/peerless_ingest/layout.py, TARGETS), in its order. */
export const SM2_FIELDS = [
  'salgsinntekt',
  'sum_driftsinntekter',
  'varekostnad',
  'lonnskostnad',
  'avskrivninger',
  'nedskrivninger',
  'annen_driftskostnad',
  'sum_driftskostnad',
  'driftsresultat',
  'netto_finans',
  'ordinaert_resultat_foer_skattekostnad',
  'aarsresultat',
  'sum_immaterielle_eiendeler',
  'sum_varige_driftsmidler',
  'varer',
  'kundefordringer',
  'bankinnskudd',
  'sum_eiendeler',
  'sum_egenkapital',
  'leverandorgjeld',
  'sum_kortsiktig_gjeld',
  'sum_gjeld',
  'sum_egenkapital_gjeld',
] as const;
export type Sm2Field = (typeof SM2_FIELDS)[number];

export type Role = 'current' | 'prior';
const ROLES: readonly Role[] = ['current', 'prior'];

// --- Recent and older filings ------------------------------------------------

// Decided before the comparison (Meinich, 2026-10-23): the key-figures API
// holds filings from 2023 on, so a recent filing's current column can be
// checked against the register and an older one's cannot.
export const RECENT_FROM = 2023;
export type Group = 'recent' | 'older';
export const GROUPS: readonly Group[] = ['recent', 'older'];

/** The group of a filing, by its filing year (the document's year, not a column's stated year). */
export function groupOf(filingYear: number): Group {
  return filingYear >= RECENT_FROM ? 'recent' : 'older';
}

// --- Reading -------------------------------------------------------------------

/** One transcribed column: figures in whole kroner as printed, null for a blank cell. */
export interface TranscribedColumn {
  orgnr: string;
  filingYear: number;
  role: Role;
  statedYear: number | null;
  figuresKr: ReadonlyMap<Sm2Field, bigint | null>;
}

/** One stored column (register.document_column): figures in øre, null for NULL. */
export interface StoredColumn {
  orgnr: string;
  filingYear: number;
  role: Role;
  statedYear: number | null;
  status: string | null;
  /** c1–c5 as stored; null on a row from before Story 2.2. */
  checks: Readonly<Record<CheckName, CheckResult | null>>;
  figuresOre: ReadonlyMap<Sm2Field, bigint | null>;
}

/** One stored document (register.document). */
export interface StoredDocument {
  orgnr: string;
  filingYear: number;
  layout: string;
  status: string;
  refusal: string | null;
}

export type CheckResult = 'pass' | 'fail' | 'not_evaluable';
export const CHECK_NAMES = ['c1', 'c2', 'c3', 'c4', 'c5'] as const;
export type CheckName = (typeof CHECK_NAMES)[number];

/** A stored or exported check result; '' (NULL) is null. */
export function checkResult(file: string, value: string, line: number): CheckResult | null {
  if (value === '') return null;
  if (value === 'pass' || value === 'fail' || value === 'not_evaluable') return value;
  throw new Error(`${file} row ${line}: a check must be pass, fail or not_evaluable, got ${JSON.stringify(value)}`);
}

const WHOLE = /^-?\d+$/;
const YEAR = /^\d{4}$/;

// Semicolon-separated, as transcriptions.csv is (README, "Transcription"):
// double quotes around a field, quotes doubled inside, LF or CRLF row ends.
export function parseSemicolonCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const body = text.startsWith('﻿') ? text.slice(1) : text;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ';') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && body[i + 1] === '\n') i += 1;
    } else {
      field += ch;
    }
  }
  if (quoted) throw new Error('transcriptions.csv: unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

// The index of each named column; a missing one refuses.
function indexOf(file: string, header: readonly string[], names: readonly string[]): Map<string, number> {
  const at = new Map<string, number>();
  for (const name of names) {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`${file}: no column ${name}`);
    if (header.indexOf(name, i + 1) !== -1) throw new Error(`${file}: column ${name} appears twice`);
    at.set(name, i);
  }
  return at;
}

function cell(file: string, row: readonly string[], at: ReadonlyMap<string, number>, name: string, line: number): string {
  const i = at.get(name);
  const value = i === undefined ? undefined : row[i];
  if (value === undefined) throw new Error(`${file} row ${line}: no value for ${name}`);
  return value;
}

function role(file: string, value: string, line: number): Role {
  if (value === 'current' || value === 'prior') return value;
  throw new Error(`${file} row ${line}: column must be current or prior, got ${JSON.stringify(value)}`);
}

function year(file: string, value: string, line: number, name: string): number {
  if (!YEAR.test(value)) throw new Error(`${file} row ${line}: ${name} must be a year, got ${JSON.stringify(value)}`);
  return Number(value);
}

function orgnr(file: string, value: string, line: number): string {
  if (!/^\d{9}$/.test(value)) throw new Error(`${file} row ${line}: orgnr must be nine digits, got ${JSON.stringify(value)}`);
  return value;
}

/**
 * transcriptions.csv, read by header name: columns that are not in
 * SM2_FIELDS (the header's misspelt `finansielle_anleggsmider`,
 * `andre_kortsiktige_fordringer`, the transcriber's name, notes) are ignored.
 * A blank cell is null; a figure is whole kroner, digits with an optional
 * minus; anything else refuses.
 */
export function parseTranscriptions(text: string): TranscribedColumn[] {
  const file = 'transcriptions.csv';
  const [header, ...rows] = parseSemicolonCsv(text);
  if (header === undefined) throw new Error(`${file}: no header`);
  const at = indexOf(file, header, ['orgnr', 'filing_year', 'column', 'stated_year', ...SM2_FIELDS]);
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const line = index + 2;
    const column: TranscribedColumn = {
      orgnr: orgnr(file, cell(file, row, at, 'orgnr', line), line),
      filingYear: year(file, cell(file, row, at, 'filing_year', line), line, 'filing_year'),
      role: role(file, cell(file, row, at, 'column', line), line),
      statedYear: ((value) => (value === '' ? null : year(file, value, line, 'stated_year')))(
        cell(file, row, at, 'stated_year', line),
      ),
      figuresKr: new Map(
        SM2_FIELDS.map((field) => {
          const value = cell(file, row, at, field, line);
          if (value === '') return [field, null] as const;
          if (!WHOLE.test(value)) {
            throw new Error(`${file} row ${line}: ${field} must be blank or whole kroner, got ${JSON.stringify(value)}`);
          }
          return [field, BigInt(value)] as const;
        }),
      ),
    };
    const key = `${column.orgnr}/${column.filingYear}/${column.role}`;
    if (seen.has(key)) throw new Error(`${file} row ${line}: ${key} is transcribed twice`);
    seen.add(key);
    return column;
  });
}

/** One logged correction to transcriptions.csv: whole kroner, null for a blank cell. */
export interface Correction {
  date: string;
  orgnr: string;
  filingYear: number;
  role: Role;
  field: Sm2Field;
  oldKr: bigint | null;
  newKr: bigint | null;
}

export const CORRECTIONS_HEADING = '## Corrections';
const CORRECTIONS_HEADER = '| Date | Orgnr | Filing year | Column | Field | Old | New |';

/**
 * The corrections log in analysis/ocr-reference/README.md: the table under
 * "## Corrections", with exactly the columns of CORRECTIONS_HEADER. A README
 * without the heading refuses rather than reading as "no corrections", so a
 * renamed heading cannot silently drop the before/after comparison. The same
 * cell corrected twice refuses.
 */
export function parseCorrections(readme: string): Correction[] {
  const file = 'README.md';
  const lines = readme.split(/\r?\n/);
  const start = lines.indexOf(CORRECTIONS_HEADING);
  if (start === -1) throw new Error(`${file}: no "${CORRECTIONS_HEADING}" heading`);
  // Each table row with its 1-based line number in the README, for refusals.
  const table: { text: string; number: number }[] = [];
  for (const [offset, line] of lines.slice(start + 1).entries()) {
    if (line.startsWith('|')) table.push({ text: line, number: start + 2 + offset });
    else if (table.length > 0) break;
    else if (line.trim() !== '') throw new Error(`${file}: "${CORRECTIONS_HEADING}" must be followed by its table`);
  }
  const [header, separator, ...rows] = table.map((row) => row.text);
  const numbers = table.slice(2).map((row) => row.number);
  if (header !== CORRECTIONS_HEADER) throw new Error(`${file}: the corrections table header must be ${CORRECTIONS_HEADER}`);
  if (separator === undefined || !/^\|(-+\|)+$/.test(separator)) throw new Error(`${file}: the corrections table has no separator row`);
  const figure = (value: string, line: string): bigint | null => {
    if (value === '') return null;
    if (!WHOLE.test(value)) throw new Error(`${file}: correction ${line}: figures must be blank or whole kroner`);
    return BigInt(value);
  };
  const seen = new Set<string>();
  return rows.map((line, index) => {
    const number = numbers[index] ?? 0;
    const cells = line.slice(1, -1).split('|').map((c) => c.trim());
    if (cells.length !== 7) throw new Error(`${file}: correction ${line}: expected 7 columns`);
    const [date = '', orgnrValue = '', yearValue = '', roleValue = '', fieldValue = '', oldValue = '', newValue = ''] = cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${file}: correction ${line}: date must be YYYY-MM-DD`);
    const field = SM2_FIELDS.find((f) => f === fieldValue);
    if (field === undefined) throw new Error(`${file}: correction ${line}: ${JSON.stringify(fieldValue)} is not a compared field`);
    const correction: Correction = {
      date,
      orgnr: orgnr(file, orgnrValue, number),
      filingYear: year(file, yearValue, number, 'filing year'),
      role: role(file, roleValue, number),
      field,
      oldKr: figure(oldValue, line),
      newKr: figure(newValue, line),
    };
    const key = `${correction.orgnr}/${correction.filingYear}/${correction.role}/${field}`;
    if (seen.has(key)) throw new Error(`${file}: ${key} is corrected twice`);
    seen.add(key);
    return correction;
  });
}

/**
 * The transcriptions as they stood before the logged corrections: each
 * corrected cell set back to its old value. A cell that does not now hold
 * the logged new value refuses, so the log and transcriptions.csv cannot
 * drift apart unnoticed.
 */
export function transcriptionsBefore(
  transcribed: readonly TranscribedColumn[],
  corrections: readonly Correction[],
): TranscribedColumn[] {
  const byColumn = new Map<string, Correction[]>();
  for (const c of corrections) {
    const key = columnKey(c.orgnr, c.filingYear, c.role);
    byColumn.set(key, [...(byColumn.get(key) ?? []), c]);
  }
  const used = new Set<string>();
  const before = transcribed.map((column) => {
    const key = columnKey(column.orgnr, column.filingYear, column.role);
    const fixes = byColumn.get(key);
    if (fixes === undefined) return column;
    used.add(key);
    const figuresKr = new Map(column.figuresKr);
    for (const fix of fixes) {
      if ((figuresKr.get(fix.field) ?? null) !== fix.newKr) {
        throw new Error(`transcriptions.csv: ${key} ${fix.field} does not hold the logged new value ${fix.newKr ?? 'blank'}`);
      }
      figuresKr.set(fix.field, fix.oldKr);
    }
    return { ...column, figuresKr };
  });
  for (const key of byColumn.keys()) {
    if (!used.has(key)) throw new Error(`transcriptions.csv: no column ${key} for a logged correction`);
  }
  return before;
}

/** seed/demo/document_column.csv (COPY csv with header), read by header name. NULL is an empty unquoted field. */
export function parseStoredColumns(text: string): StoredColumn[] {
  const file = 'document_column.csv';
  const [header, ...rows] = parseCsv(text);
  if (header === undefined) throw new Error(`${file}: no header`);
  const oreColumns = SM2_FIELDS.map((field) => `${field}_ore`);
  const at = indexOf(file, header, ['orgnr', 'filing_year', 'role', 'stated_year', 'status', ...CHECK_NAMES, ...oreColumns]);
  return rows.map((row, index) => {
    const line = index + 2;
    const status = cell(file, row, at, 'status', line);
    const stated = cell(file, row, at, 'stated_year', line);
    return {
      orgnr: orgnr(file, cell(file, row, at, 'orgnr', line), line),
      filingYear: year(file, cell(file, row, at, 'filing_year', line), line, 'filing_year'),
      role: role(file, cell(file, row, at, 'role', line), line),
      statedYear: stated === '' ? null : year(file, stated, line, 'stated_year'),
      status: status === '' ? null : status,
      checks: {
        c1: checkResult(file, cell(file, row, at, 'c1', line), line),
        c2: checkResult(file, cell(file, row, at, 'c2', line), line),
        c3: checkResult(file, cell(file, row, at, 'c3', line), line),
        c4: checkResult(file, cell(file, row, at, 'c4', line), line),
        c5: checkResult(file, cell(file, row, at, 'c5', line), line),
      },
      figuresOre: new Map(
        SM2_FIELDS.map((field) => {
          const value = cell(file, row, at, `${field}_ore`, line);
          return [field, parseOre(value === '' ? null : value)] as const;
        }),
      ),
    };
  });
}

/** seed/demo/document.csv, read by header name. */
export function parseStoredDocuments(text: string): StoredDocument[] {
  const file = 'document.csv';
  const [header, ...rows] = parseCsv(text);
  if (header === undefined) throw new Error(`${file}: no header`);
  const at = indexOf(file, header, ['orgnr', 'filing_year', 'layout', 'status', 'refusal']);
  return rows.map((row, index) => {
    const line = index + 2;
    const refusal = cell(file, row, at, 'refusal', line);
    return {
      orgnr: orgnr(file, cell(file, row, at, 'orgnr', line), line),
      filingYear: year(file, cell(file, row, at, 'filing_year', line), line, 'filing_year'),
      layout: cell(file, row, at, 'layout', line),
      status: cell(file, row, at, 'status', line),
      refusal: refusal === '' ? null : refusal,
    };
  });
}

// --- Classifying ---------------------------------------------------------------

export const ORE_PER_KRONE = 100n;

export type FieldClass = 'correct' | 'not read' | 'misread' | 'phantom';
export const FIELD_CLASSES: readonly FieldClass[] = ['correct', 'not read', 'misread', 'phantom'];

/**
 * One field (approval, 2026-10-23): `correct` when both hold the same
 * figure, `not read` when OCR is NULL and the transcription holds a figure,
 * `misread` when both hold different figures, `phantom` when OCR holds a
 * figure and the transcription is blank. Both blank is not a figure: null,
 * never counted.
 */
export function classify(readOre: bigint | null, expectedKr: bigint | null): FieldClass | null {
  if (readOre === null && expectedKr === null) return null;
  if (readOre === null) return 'not read';
  if (expectedKr === null) return 'phantom';
  return readOre === expectedKr * ORE_PER_KRONE ? 'correct' : 'misread';
}

/** One compared field of a drawn filing. */
export interface FieldResult {
  orgnr: string;
  filingYear: number;
  group: Group;
  role: Role;
  field: Sm2Field;
  expectedKr: bigint | null;
  readOre: bigint | null;
  class: FieldClass;
  /** The stored column's status; null when no column was stored for it. */
  columnStatus: string | null;
}

/** A drawn column the comparison could not pair as expected. */
export interface ColumnNote {
  orgnr: string;
  filingYear: number;
  role: Role;
  note: string;
}

export interface Comparison {
  results: FieldResult[];
  notes: ColumnNote[];
}

const columnKey = (orgnr: string, filingYear: number, role: Role): string => `${orgnr}/${filingYear}/${role}`;

/**
 * Compares the stored columns with the transcriptions, field by field, for
 * the (orgnr, filing year) pairs in the draw only: any other stored document
 * of the same companies is left out (approval, 2026-10-23). A drawn column
 * with no stored row compares as all NULL and is noted; a drawn column with
 * no transcription refuses, since the reference set must cover the draw.
 */
export function compareReference(
  drawn: readonly DrawnFiling[],
  transcribed: readonly TranscribedColumn[],
  stored: readonly StoredColumn[],
): Comparison {
  const transcriptions = new Map(transcribed.map((t) => [columnKey(t.orgnr, t.filingYear, t.role), t]));
  const columns = new Map(stored.map((s) => [columnKey(s.orgnr, s.filingYear, s.role), s]));
  const results: FieldResult[] = [];
  const notes: ColumnNote[] = [];
  const ordered = [...drawn].sort((a, b) => a.year - b.year || compareBytes(a.orgnr, b.orgnr));
  for (const filing of ordered) {
    for (const r of ROLES) {
      const key = columnKey(filing.orgnr, filing.year, r);
      const truth = transcriptions.get(key);
      if (truth === undefined) throw new Error(`transcriptions.csv: no ${r} column for drawn filing ${filing.orgnr}/${filing.year}`);
      const column = columns.get(key);
      if (column === undefined) {
        notes.push({ orgnr: filing.orgnr, filingYear: filing.year, role: r, note: 'no stored column: every field compares as NULL' });
      } else if (column.statedYear !== truth.statedYear) {
        notes.push({
          orgnr: filing.orgnr,
          filingYear: filing.year,
          role: r,
          note: `stated year read ${column.statedYear ?? 'NULL'}, transcribed ${truth.statedYear ?? 'blank'}`,
        });
      }
      for (const field of SM2_FIELDS) {
        const expectedKr = truth.figuresKr.get(field) ?? null;
        const readOre = column?.figuresOre.get(field) ?? null;
        const cls = classify(readOre, expectedKr);
        if (cls === null) continue;
        results.push({
          orgnr: filing.orgnr,
          filingYear: filing.year,
          group: groupOf(filing.year),
          role: r,
          field,
          expectedKr,
          readOre,
          class: cls,
          columnStatus: column?.status ?? null,
        });
      }
    }
  }
  return { results, notes };
}

export type ClassCounts = Record<FieldClass, number>;

/** Counts per class over the given results. */
export function countClasses(results: readonly FieldResult[]): ClassCounts {
  const counts: ClassCounts = { correct: 0, 'not read': 0, misread: 0, phantom: 0 };
  for (const r of results) counts[r.class] += 1;
  return counts;
}

/** Not-read fields split by what the transcription holds: 0, or a non-zero figure. */
export function countNotRead(results: readonly FieldResult[]): { zero: number; nonZero: number } {
  const notRead = results.filter((r) => r.class === 'not read');
  const zero = notRead.filter((r) => r.expectedKr === 0n).length;
  return { zero, nonZero: notRead.length - zero };
}

/** Phantom figures in reconciled columns: they reach the engine too, though the headline counts misreads only. */
export function phantomsReachingEngine(results: readonly FieldResult[]): FieldResult[] {
  return results.filter((r) => r.class === 'phantom' && r.columnStatus === 'reconciled');
}

/** Every field that is not correct, in comparison order: each is listed in the report. */
export function mismatches(results: readonly FieldResult[]): FieldResult[] {
  return results.filter((r) => r.class !== 'correct');
}

/**
 * The headline (approval, 2026-10-23): misread figures in columns that
 * nevertheless reconciled. Only a reconciled column's figures reach the
 * engine, so these are the wrong figures Peerless would use.
 */
export function misreadsReachingEngine(results: readonly FieldResult[]): FieldResult[] {
  return results.filter((r) => r.class === 'misread' && r.columnStatus === 'reconciled');
}

// --- Consistency -----------------------------------------------------------------


/** One column's within-document checks, and its Story 2.2 status. */
export interface CheckedColumn {
  c1: CheckResult;
  c2: CheckResult;
  c3: CheckResult;
  c4: CheckResult;
  c5: CheckResult;
  status: string | null;
}

export interface Denominators {
  /** Every column: two per filing, a refused or unread document's included. */
  all: number;
  /** c1 (income statement) and c3 (balance) both evaluable. */
  evaluable: number;
  /** Evaluable, and no check among c1–c4 fails. */
  pass: number;
  /** Story 2.2's column status (c1–c5): reconciled. */
  reconciled: number;
}

/**
 * The spike baseline's own definition (analysis/ocr/ocr_accuracy.py,
 * `summarise`): a column is evaluable when c1 and c3 both are, and passes
 * when it is evaluable and no check among c1–c4 fails (each within the 5 kr
 * bound, applied where the checks were run). `all` counts two columns per
 * filing: `filings` × 2, whether or not a column was read. Story 2.2's
 * status is counted separately and never mixed in.
 */
export function consistencyDenominators(filings: number, columns: readonly CheckedColumn[]): Denominators {
  if (columns.length > filings * 2) throw new Error(`${columns.length} columns for ${filings} filings`);
  let evaluable = 0;
  let pass = 0;
  let reconciled = 0;
  for (const c of columns) {
    if (isEvaluable(c)) evaluable += 1;
    if (passes(c)) pass += 1;
    if (c.status === 'reconciled') reconciled += 1;
  }
  return { all: filings * 2, evaluable, pass, reconciled };
}

/** The baseline's evaluable: c1 (income statement) and c3 (balance) both evaluable. */
export function isEvaluable(c: CheckedColumn): boolean {
  return c.c1 !== 'not_evaluable' && c.c3 !== 'not_evaluable';
}

/** The checks among c1–c4 that fail, in order. */
export function failedChecks(c: CheckedColumn): ('c1' | 'c2' | 'c3' | 'c4')[] {
  return (['c1', 'c2', 'c3', 'c4'] as const).filter((name) => c[name] === 'fail');
}

/** The baseline's pass: evaluable, and no check among c1–c4 fails. */
export function passes(c: CheckedColumn): boolean {
  return isEvaluable(c) && failedChecks(c).length === 0;
}

/** Why a column is not evaluable now: the first cause that applies, in this order. */
export type NotEvaluableCause = 'no column' | 'c1 not evaluable' | 'missing total' | 'c3 and c5 not evaluable';
export const NOT_EVALUABLE_CAUSES: readonly NotEvaluableCause[] = [
  'no column',
  'c1 not evaluable',
  'missing total',
  'c3 and c5 not evaluable',
];

/**
 * - `no column`: the document gave no column (refused or not read);
 * - `c1 not evaluable`: an income-statement figure of c1 is missing;
 * - `missing total`: c3 not evaluable while c5 is, so sum eiendeler, sum
 *   egenkapital and sum gjeld were read and only "Sum egenkapital og gjeld"
 *   is missing (Story 2.3b);
 * - `c3 and c5 not evaluable`: sum eiendeler is missing, or the total and
 *   another balance figure.
 */
export function notEvaluableCause(c: CheckedColumn | undefined): NotEvaluableCause {
  if (c === undefined) return 'no column';
  if (c.c1 === 'not_evaluable') return 'c1 not evaluable';
  if (c.c3 !== 'not_evaluable') throw new Error('notEvaluableCause: the column is evaluable');
  return c.c5 === 'not_evaluable' ? 'c3 and c5 not evaluable' : 'missing total';
}

/** One filing of the re-read, as the consistency file gives it. */
export interface RereadFiling {
  orgnr: string;
  filingYear: number;
  columns: readonly (CheckedColumn & { role: Role })[];
}

/** Each column of the re-read in exactly one bucket, against the baseline's failing columns. Keys are orgnr/year/role. */
export interface BaselineDiff {
  /** Failing in the baseline, passing now. */
  fixed: string[];
  /** Failing in the baseline, and evaluable and failing now. */
  stillFailing: { key: string; checks: string[] }[];
  /** Failing in the baseline, not evaluable now. */
  failingToNotEvaluable: { key: string; cause: NotEvaluableCause }[];
  /** Evaluable and failing now, not in the baseline's failure table. */
  newlyFailing: { key: string; checks: string[] }[];
  /** Not evaluable now, not in the baseline's failure table. */
  notEvaluable: { key: string; cause: NotEvaluableCause }[];
  /** Passing now and not in the baseline's failure table: a count only. */
  passing: number;
}

/**
 * The re-read against the spike's failure table, column by column, in
 * orgnr and year order. Uses the predicates of `consistencyDenominators`
 * (`isEvaluable`, `passes`), so the buckets add up to its counts; a role
 * the document did not give is not evaluable (`no column`).
 */
export function baselineDiff(filings: readonly RereadFiling[], baselineFailing: readonly string[]): BaselineDiff {
  const failingBefore = new Set(baselineFailing);
  const diff: BaselineDiff = { fixed: [], stillFailing: [], failingToNotEvaluable: [], newlyFailing: [], notEvaluable: [], passing: 0 };
  const sorted = [...filings].sort((a, b) => compareBytes(a.orgnr, b.orgnr) || a.filingYear - b.filingYear);
  for (const f of sorted) {
    for (const r of ROLES) {
      const key = columnKey(f.orgnr, f.filingYear, r);
      const c = f.columns.find((column) => column.role === r);
      const was = failingBefore.has(key);
      if (c !== undefined && passes(c)) {
        if (was) diff.fixed.push(key);
        else diff.passing += 1;
      } else if (c !== undefined && isEvaluable(c)) {
        (was ? diff.stillFailing : diff.newlyFailing).push({ key, checks: failedChecks(c) });
      } else {
        (was ? diff.failingToNotEvaluable : diff.notEvaluable).push({ key, cause: notEvaluableCause(c) });
      }
    }
  }
  return diff;
}

/**
 * Refuses a re-read that does not hold exactly `expected` filings, or that
 * lacks the filing of one of the baseline's failing columns: a missing
 * filing would otherwise show as columns "not evaluable now".
 */
export function checkBaselineCoverage(filings: readonly RereadFiling[], expected: number, baselineFailing: readonly string[]): void {
  if (filings.length !== expected) {
    throw new Error(`the consistency file holds ${filings.length} filings; the baseline has ${expected}`);
  }
  const held = new Set(filings.map((f) => `${f.orgnr}/${f.filingYear}`));
  for (const key of baselineFailing) {
    const filing = key.split('/').slice(0, 2).join('/');
    if (!held.has(filing)) throw new Error(`the consistency file lacks ${filing}, a filing in the baseline's failure table`);
  }
}

/**
 * The spike's baseline for 2021–2025 (analysis/output/ocr-consistency.md,
 * combined read, Tesseract 5): 89 filings, 178 columns, 168 evaluable. The
 * report gives only "93 % of 168"; its failure table lists 11 failing
 * 2021–2025 columns, so 157 pass. These are those 11, as orgnr/year/role.
 */
export const BASELINE = { filings: 89, all: 178, evaluable: 168, pass: 157 } as const;
export const BASELINE_FAILING: readonly string[] = [
  '874350672/2023/current',
  '911586738/2021/current',
  '933565831/2021/prior',
  '950308508/2022/current',
  '950308508/2023/prior',
  '976570626/2022/current',
  '976570626/2023/prior',
  '979775377/2021/current',
  '979775377/2022/prior',
  '979775377/2024/prior',
  '987307749/2023/prior',
];

// --- Before and after Story 2.3b ---------------------------------------------------

/** Each field's class counts, in SM2_FIELDS order. */
export function classesByField(results: readonly FieldResult[]): { field: Sm2Field; counts: ClassCounts }[] {
  return SM2_FIELDS.map((field) => ({ field, counts: countClasses(results.filter((r) => r.field === field)) }));
}

const resultKey = (r: FieldResult): string => `${r.orgnr}/${r.filingYear}/${r.role}/${r.field}/${r.readOre ?? 'null'}`;

/**
 * The results in `after` not in `before`, by field and figure read: a new
 * misread or phantom, when both are such lists. A field misread before and
 * misread to another figure after is new.
 */
export function newResults(before: readonly FieldResult[], after: readonly FieldResult[]): FieldResult[] {
  const was = new Set(before.map(resultKey));
  return after.filter((r) => !was.has(resultKey(r)));
}

/** Stored columns of `role` holding a "Sum egenkapital og gjeld" figure, of all stored columns of that role. */
export function totalReadIn(columns: readonly StoredColumn[], role: Role): { read: number; columns: number } {
  const ofRole = columns.filter((c) => c.role === role);
  return { read: ofRole.filter((c) => (c.figuresOre.get('sum_egenkapital_gjeld') ?? null) !== null).length, columns: ofRole.length };
}

/**
 * The consistency file holds checks, not figures. The total is shown read
 * where c3 or c4 is evaluable (each needs it): a lower bound, since a total
 * read beside a missing sum eiendeler and a missing sum egenkapital or sum
 * gjeld shows in neither. It is shown missing ("missing total") where c3 is
 * not evaluable and c5 is: the other three balance figures were read.
 */
export function totalShownRead(c: CheckedColumn): boolean {
  return c.c3 !== 'not_evaluable' || c.c4 !== 'not_evaluable';
}

export function totalShownMissing(c: CheckedColumn): boolean {
  return c.c3 === 'not_evaluable' && c.c5 !== 'not_evaluable';
}
