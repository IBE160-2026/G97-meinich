// The seed format (Story 1.3b; technical note AD-16): the tables a seed
// holds, the manifest, and every check the loader runs before it opens a
// connection. No database access here: `pnpm seed:export`
// (scripts/seed-export.ts) and `pnpm seed` (scripts/seed-load.ts) build on it.
//
// A seed is a directory of CSV files, one per table in SEED_TABLES, plus
// manifest.json. The files are written by COPY … TO STDOUT and read back by
// COPY … FROM STDIN: no amount is ever parsed in JS.
//
// Every refusal is a SeedRefusal whose message names the entry and the check
// that failed.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const SEED_VERSION = 1;
export const MANIFEST_FILE = 'manifest.json';
export const DATASET = 'demo';

// Relative to the repository root.
export const SEED_DIR = 'seed/demo';
export const COVERAGE_FILE = 'seed/coverage.json';
export const ALLOW_LIST_FILE = 'seed/allow-list.json';
export const MIGRATIONS_DIR = 'supabase/migrations';
export const REPORT_DIR = 'analysis/output';

export interface SortColumn {
  name: string;
  // true for text and char columns: they sort with COLLATE "C".
  text: boolean;
}

export interface SeedTable {
  name: string;
  // The primary key, in key order. The export checks it against the catalog.
  primaryKey: readonly SortColumn[];
}

// The step-1 tables, in foreign-key order: each references only tables
// before it.
export const SEED_TABLES: readonly SeedTable[] = [
  { name: 'company', primaryKey: [{ name: 'orgnr', text: true }] },
  {
    name: 'filing',
    primaryKey: [
      { name: 'orgnr', text: true },
      { name: 'regnskapstype', text: true },
      { name: 'periode_fra', text: false },
      { name: 'periode_til', text: false },
    ],
  },
  { name: 'key_figures', primaryKey: [{ name: 'brreg_id', text: false }] },
  // Story 2.1b: the filed documents read by OCR. Empty in the committed
  // seed until Story 2.3's allow-list names the orgnrs whose document
  // figures may be committed.
  {
    name: 'document',
    primaryKey: [
      { name: 'orgnr', text: true },
      { name: 'filing_year', text: false },
    ],
  },
  {
    name: 'document_column',
    primaryKey: [
      { name: 'orgnr', text: true },
      { name: 'filing_year', text: false },
      { name: 'role', text: true },
    ],
  },
];

// Written by the loader from the manifest and seed/coverage.json, never
// exported.
export const LOADER_TABLES: readonly string[] = ['dataset', 'covered_industry'];

export const seedFileName = (table: SeedTable): string => `${table.name}.csv`;

export class SeedRefusal extends Error {}

const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`;

// ORDER BY over the primary key. Text columns sort in byte order, so the
// row order (and the checksums) never depend on the database's collation.
export function orderByClause(table: SeedTable): string {
  const keys = table.primaryKey.map((column) =>
    column.text ? `${quoteIdent(column.name)} COLLATE "C"` : quoteIdent(column.name),
  );
  return `ORDER BY ${keys.join(', ')}`;
}

// The paths, relative to the repository root, that the export writes. It
// never writes seed/coverage.json: that file is hand-edited.
export function exportPaths(): string[] {
  return [
    ...SEED_TABLES.map((table) => `${SEED_DIR}/${seedFileName(table)}`),
    `${SEED_DIR}/${MANIFEST_FILE}`,
    ALLOW_LIST_FILE,
  ];
}

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

// JSON with object keys sorted at every level, 2-space indent and a final LF.
export function stableJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v !== null && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return Object.fromEntries(entries.map(([k, inner]) => [k, sort(inner)]));
    }
    return v;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

// Byte-order comparison of two strings, as COLLATE "C" sorts UTF-8 text.
export function compareBytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

// The latest migration: the last .sql file name in supabase/migrations in
// byte order, without the extension. Neither reader nor loader can read
// supabase_migrations.schema_migrations, so the file name is the id both at
// export and at load.
export function latestMigrationId(root: string): string {
  const files = readdirSync(path.join(root, MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort(compareBytes);
  const last = files[files.length - 1];
  if (last === undefined) throw new SeedRefusal(`${MIGRATIONS_DIR}: no migration found`);
  return last.slice(0, -'.sql'.length);
}

// --- seed/coverage.json ---------------------------------------------------

export interface CoverageEntry {
  code: string;
  measured: boolean;
  report?: string;
  sha256?: string;
}

const INDUSTRY_CODE = /^\d{2}\.\d{3}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const COVERAGE_KEYS: readonly string[] = ['code', 'measured', 'report', 'sha256'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// The shape Story 1.3a defined: an array of {code, measured}, plus report
// and sha256 only when measured is true. Whether a measured entry's report
// exists is checkMeasured's job.
export function validateCoverage(json: unknown): CoverageEntry[] {
  if (!Array.isArray(json)) throw new SeedRefusal(`${COVERAGE_FILE}: must be an array of entries`);
  const entries: CoverageEntry[] = [];
  const seen = new Set<string>();
  json.forEach((raw: unknown, index) => {
    const name = `${COVERAGE_FILE} entry ${index}`;
    if (!isRecord(raw)) throw new SeedRefusal(`${name}: must be an object`);
    for (const key of Object.keys(raw)) {
      if (!COVERAGE_KEYS.includes(key)) throw new SeedRefusal(`${name}: unknown key "${key}"`);
    }
    const { code, measured, report, sha256: digest } = raw;
    if (typeof code !== 'string' || !INDUSTRY_CODE.test(code)) {
      throw new SeedRefusal(`${name}: code must be a string NN.NNN`);
    }
    const label = `${COVERAGE_FILE} entry ${code}`;
    if (seen.has(code)) throw new SeedRefusal(`${label}: code is declared twice`);
    seen.add(code);
    if (typeof measured !== 'boolean') throw new SeedRefusal(`${label}: measured must be true or false`);
    if (!measured && (report !== undefined || digest !== undefined)) {
      throw new SeedRefusal(`${label}: report and sha256 are allowed only when measured is true`);
    }
    if (report !== undefined && typeof report !== 'string') throw new SeedRefusal(`${label}: report must be a string`);
    if (digest !== undefined && typeof digest !== 'string') throw new SeedRefusal(`${label}: sha256 must be a string`);
    const entry: CoverageEntry = { code, measured };
    if (report !== undefined) entry.report = report;
    if (digest !== undefined) entry.sha256 = digest;
    entries.push(entry);
  });
  return entries;
}

export function readCoverage(file: string): CoverageEntry[] {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new SeedRefusal(`${COVERAGE_FILE}: cannot be read as JSON (${(error as Error).message})`);
  }
  return validateCoverage(json);
}

// A measured entry must cite its report: a path under analysis/output/ that
// exists, with a matching SHA-256 (FR-3). root is the directory report
// paths resolve against, the repository root in use.
export function checkMeasured(root: string, entries: readonly CoverageEntry[]): void {
  for (const entry of entries) {
    if (!entry.measured) continue;
    const label = `${COVERAGE_FILE} entry ${entry.code}`;
    if (entry.report === undefined || entry.sha256 === undefined) {
      throw new SeedRefusal(`${label}: measured is true but report or sha256 is missing`);
    }
    if (!SHA256_HEX.test(entry.sha256)) {
      throw new SeedRefusal(`${label}: sha256 must be 64 lower-case hex digits`);
    }
    const normalised = path.posix.normalize(entry.report);
    if (entry.report.includes('\\') || normalised !== entry.report || !normalised.startsWith(`${REPORT_DIR}/`)) {
      throw new SeedRefusal(`${label}: report must be a plain path under ${REPORT_DIR}/`);
    }
    const file = path.join(root, ...normalised.split('/'));
    if (!existsSync(file) || !statSync(file).isFile()) {
      throw new SeedRefusal(`${label}: report ${entry.report} does not exist`);
    }
    if (sha256(readFileSync(file)) !== entry.sha256) {
      throw new SeedRefusal(`${label}: report ${entry.report} does not match its sha256`);
    }
  }
}

// An industry is never offered before its data is loaded (FR-59).
export function checkDeclaredFetched(entries: readonly CoverageEntry[], fetchedCodes: readonly string[]): void {
  for (const entry of entries) {
    if (!fetchedCodes.includes(entry.code)) {
      throw new SeedRefusal(`${COVERAGE_FILE} entry ${entry.code}: declared but not among the manifest's fetched_codes`);
    }
  }
}

// --- manifest.json --------------------------------------------------------

export interface Manifest {
  dataset: string;
  document_figure_orgnrs: string[];
  fetched_codes: string[];
  // File name in the seed directory → SHA-256 of its bytes.
  files: Record<string, string>;
  format_version: number;
  migration_id: string;
  // Min and max read_at over company, filing and document, as Postgres prints
  // timestamptz with TimeZone UTC and DateStyle ISO.
  read_at: { max: string; min: string };
}

const MANIFEST_KEYS: readonly string[] = [
  'dataset',
  'document_figure_orgnrs',
  'fetched_codes',
  'files',
  'format_version',
  'migration_id',
  'read_at',
];

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function manifestShape(json: unknown): Manifest {
  const name = MANIFEST_FILE;
  if (!isRecord(json)) throw new SeedRefusal(`${name}: must be an object`);
  for (const key of Object.keys(json)) {
    if (!MANIFEST_KEYS.includes(key)) throw new SeedRefusal(`${name}: unknown field "${key}"`);
  }
  for (const key of MANIFEST_KEYS) {
    if (!(key in json)) throw new SeedRefusal(`${name}: field ${key} is missing`);
  }
  const { dataset, document_figure_orgnrs, fetched_codes, files, format_version, migration_id, read_at } = json;
  if (typeof format_version !== 'number') throw new SeedRefusal(`${name}: field format_version must be a number`);
  if (typeof migration_id !== 'string') throw new SeedRefusal(`${name}: field migration_id must be a string`);
  if (typeof dataset !== 'string') throw new SeedRefusal(`${name}: field dataset must be a string`);
  if (!isStringArray(fetched_codes)) throw new SeedRefusal(`${name}: field fetched_codes must be a list of codes`);
  if (!isStringArray(document_figure_orgnrs)) {
    throw new SeedRefusal(`${name}: field document_figure_orgnrs must be a list of orgnrs`);
  }
  if (!isRecord(files) || !Object.values(files).every((v) => typeof v === 'string')) {
    throw new SeedRefusal(`${name}: field files must map file names to checksums`);
  }
  if (
    !isRecord(read_at) ||
    Object.keys(read_at).sort().join(',') !== 'max,min' ||
    typeof read_at.min !== 'string' ||
    typeof read_at.max !== 'string'
  ) {
    throw new SeedRefusal(`${name}: field read_at must be {min, max}`);
  }
  return {
    dataset,
    document_figure_orgnrs,
    fetched_codes,
    files: files as Record<string, string>,
    format_version,
    migration_id,
    read_at: { max: read_at.max, min: read_at.min },
  };
}

// Checks the manifest against the format and the schema, and every file in
// dir against the manifest. Returns the manifest and the bytes of each
// checked seed file, so the loader sends exactly the bytes that were checked.
export function checkManifest(
  root: string,
  json: unknown,
  dir: string,
): { manifest: Manifest; files: Map<string, Buffer> } {
  const manifest = manifestShape(json);
  if (manifest.format_version !== SEED_VERSION) {
    throw new SeedRefusal(
      `${MANIFEST_FILE}: field format_version is ${manifest.format_version}, this loader reads ${SEED_VERSION}`,
    );
  }
  const latest = latestMigrationId(root);
  if (manifest.migration_id !== latest) {
    throw new SeedRefusal(
      `${MANIFEST_FILE}: field migration_id is ${manifest.migration_id}, the latest migration is ${latest}; re-export the seed`,
    );
  }
  if (manifest.dataset !== DATASET) {
    throw new SeedRefusal(`${MANIFEST_FILE}: field dataset is ${manifest.dataset}, expected ${DATASET}`);
  }

  const expected = SEED_TABLES.map(seedFileName);
  const listed = Object.keys(manifest.files);
  for (const file of listed) {
    if (!expected.includes(file)) throw new SeedRefusal(`${MANIFEST_FILE}: lists ${file}, which is not a seed table`);
  }
  for (const file of expected) {
    if (!listed.includes(file)) throw new SeedRefusal(`${MANIFEST_FILE}: does not list ${file}`);
  }
  for (const file of readdirSync(dir)) {
    if (file !== MANIFEST_FILE && !listed.includes(file)) {
      throw new SeedRefusal(`${file}: not listed in ${MANIFEST_FILE}`);
    }
  }
  const files = new Map<string, Buffer>();
  for (const file of expected) {
    const full = path.join(dir, file);
    if (!existsSync(full)) throw new SeedRefusal(`${file}: listed in ${MANIFEST_FILE} but missing`);
    const bytes = readFileSync(full);
    if (sha256(bytes) !== manifest.files[file]) throw new SeedRefusal(`${file}: checksum does not match ${MANIFEST_FILE}`);
    files.set(file, bytes);
  }
  return { manifest, files };
}

// --- the whole check before a load ----------------------------------------

export interface SeedPaths {
  // supabase/migrations is read from here.
  root: string;
  seedDir: string;
  coverageFile: string;
  // Report paths in coverage.json resolve against this; root when absent.
  reportRoot?: string;
}

export const defaultSeedPaths = (root: string): SeedPaths => ({
  root,
  seedDir: path.join(root, ...SEED_DIR.split('/')),
  coverageFile: path.join(root, ...COVERAGE_FILE.split('/')),
});

export interface SeedPlan {
  manifest: Manifest;
  files: Map<string, Buffer>;
  coverage: CoverageEntry[];
}

// Every check, in order, before the loader opens a connection: manifest
// version, migration id, file list and checksums, coverage shape, declared
// codes against fetched codes, measured reports.
export function prepareSeed(paths: SeedPaths): SeedPlan {
  const manifestFile = path.join(paths.seedDir, MANIFEST_FILE);
  if (!existsSync(manifestFile)) throw new SeedRefusal(`${MANIFEST_FILE}: not found in ${paths.seedDir}`);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch (error) {
    throw new SeedRefusal(`${MANIFEST_FILE}: cannot be read as JSON (${(error as Error).message})`);
  }
  const { manifest, files } = checkManifest(paths.root, json, paths.seedDir);
  const coverage = readCoverage(paths.coverageFile);
  checkDeclaredFetched(coverage, manifest.fetched_codes);
  checkMeasured(paths.reportRoot ?? paths.root, coverage);
  return { manifest, files, coverage };
}

// --- CSV and the allow-list -----------------------------------------------

// RFC 4180 as COPY … (FORMAT csv) writes it: comma, double quote, LF or
// CRLF row ends, quotes doubled inside quoted fields.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += ch;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
    } else {
      field += ch;
    }
    i += 1;
  }
  if (quoted) throw new SeedRefusal('CSV: unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface AllowListEntry {
  orgnr: string;
  reason: string;
}

// seed/allow-list.json: [{orgnr, reason}]. Returns the entries in file order.
export function parseAllowListEntries(json: unknown): AllowListEntry[] {
  if (!Array.isArray(json)) throw new SeedRefusal(`${ALLOW_LIST_FILE}: must be an array`);
  return json.map((raw: unknown, index) => {
    if (
      !isRecord(raw) ||
      Object.keys(raw).sort().join(',') !== 'orgnr,reason' ||
      typeof raw.orgnr !== 'string' ||
      !/^\d{9}$/.test(raw.orgnr) ||
      typeof raw.reason !== 'string'
    ) {
      throw new SeedRefusal(`${ALLOW_LIST_FILE} entry ${index}: must be {orgnr, reason}`);
    }
    return { orgnr: raw.orgnr, reason: raw.reason };
  });
}

// seed/allow-list.json: [{orgnr, reason}]. Returns the orgnrs.
export function parseAllowList(json: unknown): string[] {
  return parseAllowListEntries(json).map((entry) => entry.orgnr);
}

// --- The OCR reference set (Story 2.3) ----------------------------------------

// The committed draw of the hand-transcribed OCR reference set (issue #14).
export const REFERENCE_DRAW_FILE = 'analysis/ocr-reference/drawn.json';
// The reason seed:export writes for each reference orgnr on the allow-list.
export const REFERENCE_REASON = 'OCR-referansesett';

/** One drawn filing: a company and the filing year of its document. */
export interface DrawnFiling {
  orgnr: string;
  year: number;
}

// drawn.json: {cells: [{year, band, orgnr, …}], …}. Returns the drawn
// filings in file order; refuses a cell without a nine-digit orgnr and a
// whole year, and a filing drawn twice.
export function parseDrawn(json: unknown): DrawnFiling[] {
  if (!isRecord(json) || !Array.isArray(json.cells)) {
    throw new SeedRefusal(`${REFERENCE_DRAW_FILE}: must be an object with a cells array`);
  }
  const seen = new Set<string>();
  return json.cells.map((cell: unknown, index) => {
    if (
      !isRecord(cell) ||
      typeof cell.orgnr !== 'string' ||
      !/^\d{9}$/.test(cell.orgnr) ||
      typeof cell.year !== 'number' ||
      !Number.isInteger(cell.year)
    ) {
      throw new SeedRefusal(`${REFERENCE_DRAW_FILE} cell ${index}: must have a nine-digit orgnr and a whole year`);
    }
    const key = `${cell.orgnr}/${cell.year}`;
    if (seen.has(key)) throw new SeedRefusal(`${REFERENCE_DRAW_FILE} cell ${index}: ${key} is drawn twice`);
    seen.add(key);
    return { orgnr: cell.orgnr, year: cell.year };
  });
}

// The allow-list with every drawn orgnr on it (Story 2.3): an orgnr already
// listed keeps its entry, whatever its reason; each other drawn orgnr is
// added once, with REFERENCE_REASON, after the existing entries and in byte
// order. Existing entries keep their order, so a second export with the
// same draw writes the same list.
export function withReferenceOrgnrs(
  allowList: readonly AllowListEntry[],
  drawn: readonly DrawnFiling[],
): AllowListEntry[] {
  const listed = new Set(allowList.map((entry) => entry.orgnr));
  const added = [...new Set(drawn.map((filing) => filing.orgnr))]
    .filter((orgnr) => !listed.has(orgnr))
    .sort(compareBytes)
    .map((orgnr) => ({ orgnr, reason: REFERENCE_REASON }));
  return [...allowList.map((entry) => ({ orgnr: entry.orgnr, reason: entry.reason })), ...added];
}

// A document figure is a row of register.document_column: a figure column
// read from a filed document (Story 2.1b). Returns, sorted, the orgnrs that
// have one and are not on the allow-list. files maps seed file name →
// content.
export function unlistedDocumentFigures(files: ReadonlyMap<string, string>, allowList: readonly string[]): string[] {
  const file = 'document_column.csv';
  const columns = files.get(file);
  if (columns === undefined) throw new SeedRefusal(`${file}: missing`);
  const [header, ...rows] = parseCsv(columns);
  if (header === undefined) throw new SeedRefusal(`${file}: no header`);
  const orgnrAt = header.indexOf('orgnr');
  if (orgnrAt === -1) throw new SeedRefusal(`${file}: header lacks orgnr`);
  const unlisted = new Set<string>();
  for (const row of rows) {
    const orgnr = row[orgnrAt];
    if (orgnr === undefined) throw new SeedRefusal(`${file}: short row`);
    if (!allowList.includes(orgnr)) unlisted.add(orgnr);
  }
  return [...unlisted].sort(compareBytes);
}

// The export's refusal: no document figure for an orgnr that is not on
// seed/allow-list.json may reach a committed seed file (technical note,
// "Seed data").
export function refuseUnlistedDocumentFigures(files: ReadonlyMap<string, string>, allowList: readonly string[]): void {
  const unlisted = unlistedDocumentFigures(files, allowList);
  if (unlisted.length > 0) {
    throw new SeedRefusal(
      `document_column.csv: document figures for orgnrs not on ${ALLOW_LIST_FILE}: ${unlisted.join(', ')}`,
    );
  }
}
