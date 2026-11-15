// The committed inputs of the reference cases (Story 3.1a; NFR28, SM-6): a
// company's document basis built from the demo seed exactly as the request
// path builds it (seed/demo/document.csv, document_column.csv and the
// key-figures filing in register.document.brreg_id for R3), its API inputs
// from seed/demo/key_figures.csv, and Meinich's hand transcriptions of the
// printed pages (analysis/ocr-reference/transcriptions.csv, whole kroner).
// Read-only; no figure is computed here.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../../scripts/seed-format.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentBasis,
  type DocumentColumnRow,
  type DocumentField,
  documentBasis,
} from '../../src/engine/document-inputs.ts';
import { API_KEY_FIGURE_COLUMNS, type ApiKeyFiguresRow, apiInputsFromRow } from '../../src/engine/inputs.ts';
import type { ApiInputs } from '../../src/engine/types.ts';

const root = path.resolve(import.meta.dirname, '../..');

type Row = Record<string, string>;

function table(file: string, delimiter: ',' | ';' = ','): Row[] {
  const text = readFileSync(path.join(root, file), 'utf8');
  const lines: string[][] =
    delimiter === ',' ? parseCsv(text) : text.split(/\r?\n/).filter((line) => line !== '').map((line) => line.split(';'));
  const [header, ...rows] = lines;
  if (header === undefined) throw new Error(`${file} is empty`);
  return rows.map((row) => {
    if (row.length !== header.length) throw new Error(`${file}: a row has ${row.length} fields, the header ${header.length}`);
    return Object.fromEntries(header.map((column, i) => [column, row[i] ?? '']));
  });
}

// COPY csv writes NULL as an empty unquoted field.
const orNull = (text: string | undefined): string | null => (text === undefined || text === '' ? null : text);

let cache: { documents: Row[]; columns: Row[]; keyFigures: Row[]; transcriptions: Row[] } | null = null;
function data() {
  cache ??= {
    documents: table('seed/demo/document.csv'),
    columns: table('seed/demo/document_column.csv'),
    keyFigures: table('seed/demo/key_figures.csv'),
    transcriptions: table('analysis/ocr-reference/transcriptions.csv', ';'),
  };
  return cache;
}

function one(rows: Row[], what: string): Row {
  if (rows.length !== 1) throw new Error(`${what}: expected one row, found ${rows.length}`);
  return rows[0] as Row;
}

function columnRow(row: Row): DocumentColumnRow {
  const figures = Object.fromEntries(Object.values(DOCUMENT_FIGURE_COLUMNS).map((column) => [column, orNull(row[column])]));
  return { status: orNull(row.status), ...figures } as DocumentColumnRow;
}

/** A Postgres text[] as COPY csv writes it: `{}` or `{a,b}`. */
function textArray(text: string | undefined): string[] | null {
  if (text === undefined || text === '') return null;
  if (!text.startsWith('{') || !text.endsWith('}')) throw new Error(`not a text[]: ${text}`);
  const inner = text.slice(1, -1);
  return inner === '' ? [] : inner.split(',');
}

/** The key-figures filing `brregId` of the seed, as the engine reads it. */
export function seedApiInputs(brregId: string): ApiInputs {
  const row = one(
    data().keyFigures.filter((r) => r.brreg_id === brregId),
    `key_figures ${brregId}`,
  );
  return apiInputsFromRow(Object.fromEntries(API_KEY_FIGURE_COLUMNS.map((column) => [column, orNull(row[column])])) as ApiKeyFiguresRow);
}

/** The document's `brreg_id` (the key-figures filing it belongs to), or null. */
export function seedDocumentBrregId(orgnr: string, filingYear: number): string | null {
  const document = one(
    data().documents.filter((r) => r.orgnr === orgnr && r.filing_year === String(filingYear)),
    `document ${orgnr} ${filingYear}`,
  );
  return orNull(document.brreg_id);
}

/** A company's document basis for `filingYear`, from the seed, as `documentBasisOf` builds it from the database. */
export function seedDocumentBasis(orgnr: string, filingYear: number): DocumentBasis {
  const { documents, columns } = data();
  const document = one(
    documents.filter((r) => r.orgnr === orgnr && r.filing_year === String(filingYear)),
    `document ${orgnr} ${filingYear}`,
  );
  const of = (role: string) => columns.find((r) => r.orgnr === orgnr && r.filing_year === String(filingYear) && r.role === role);
  const current = of('current');
  const prior = of('prior');
  const brregId = orNull(document.brreg_id);
  const subtotal =
    brregId === null ? null : orNull(one(data().keyFigures.filter((r) => r.brreg_id === brregId), `key_figures ${brregId}`).sum_omloepsmidler_ore);
  return documentBasis({
    inManifest: true,
    filingYear,
    document: {
      status: document.status ?? '',
      current: current === undefined ? null : columnRow(current),
      prior: prior === undefined ? null : columnRow(prior),
      priorApiFailFields: prior === undefined ? null : textArray(prior.api_fail_fields),
    },
    sumOmloepsmidler: subtotal === null ? null : BigInt(subtotal),
  });
}

/** The seed's stored figure in øre, or null. */
export function seedFigure(orgnr: string, filingYear: number, column: 'current' | 'prior', field: DocumentField): bigint | null {
  const row = one(
    data().columns.filter((r) => r.orgnr === orgnr && r.filing_year === String(filingYear) && r.role === column),
    `document_column ${orgnr} ${filingYear} ${column}`,
  );
  const value = orNull(row[DOCUMENT_FIGURE_COLUMNS[field]]);
  return value === null ? null : BigInt(value);
}

/** The hand transcription of a printed figure in øre (whole kroner × 100), or null where nothing is printed. */
export function transcribed(orgnr: string, filingYear: number, column: 'current' | 'prior', field: DocumentField): bigint | null {
  const row = one(
    data().transcriptions.filter((r) => r.orgnr === orgnr && r.filing_year === String(filingYear) && r.column === column),
    `transcription ${orgnr} ${filingYear} ${column}`,
  );
  const name = DOCUMENT_FIGURE_COLUMNS[field].replace(/_ore$/, '');
  if (!(name in row)) throw new Error(`the transcriptions have no column ${name}`);
  const value = orNull(row[name]);
  return value === null ? null : BigInt(value) * 100n;
}
