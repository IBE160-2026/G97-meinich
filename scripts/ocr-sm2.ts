// `pnpm analysis:sm2`: the SM-2 report (Story 2.3; NFR25, FR-28, NFR15).
//
// Reads only committed files, so a fresh clone with the seed loaded rewrites
// the report byte for byte apart from its generation date:
//
// - analysis/ocr-reference/drawn.json and transcriptions.csv: the
//   hand-transcribed reference set (issue #14), and README.md's
//   "Corrections" log, from which the headline before the corrections is
//   reconstructed;
// - seed/demo/document.csv and document_column.csv: step 1's output for the
//   reference filings, committed by `pnpm seed:export` (the reference orgnrs
//   are on seed/allow-list.json);
// - analysis/output/ocr-consistency-2026.json: the spike's 2021–2025
//   filings read again by analysis/ocr/consistency.py in step 1's image;
// - seed/demo/key_figures.csv: the API subtotals the fingerprint reads, for
//   the undetermined share of Story 2.5b's section and R3 in Story 2.5c's;
// - the before copies and run counts under analysis/output/ named below.
//
// Writes analysis/output/ocr-sm2.md. Amounts and percentages go through
// src/engine/format.ts; every amount is a bigint, never a float. The
// comparison itself is in scripts/ocr-sm2-compare.ts.
//
// Run: node scripts/ocr-sm2.ts   (from the repository root)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Decimal } from '../src/engine/decimal.ts';
import type { ApiSubtotals } from '../src/engine/fingerprint.ts';
import { formatKroner, formatPercent } from '../src/engine/format.ts';
import {
  BASELINE,
  BASELINE_FAILING,
  type CheckResult,
  type CheckedColumn,
  type Comparison,
  type Correction,
  CORRECTIONS_HEADING,
  type FieldResult,
  GROUPS,
  type Group,
  NOT_EVALUABLE_CAUSES,
  ORE_PER_KRONE,
  RECENT_FROM,
  SM2_FIELDS,
  SM2_FIELDS_BEFORE_2_5B,
  SM2_PARTS,
  type StoredColumn,
  type StoredDocument,
  type TypeTotals,
  baselineDiff,
  checkBaselineCoverage,
  classesByField,
  compareReference,
  consistencyDenominators,
  costSumCounts,
  countClasses,
  countNotRead,
  currentAssetsEmptied,
  r3Emptied,
  withoutR3Emptied,
  groupOf,
  lacksPartColumns,
  mismatches,
  misreadsReachingEngine,
  newResults,
  onlyFields,
  parseCorrections,
  parseKeyFigureSubtotals,
  phantomsReachingEngine,
  parseStoredColumns,
  parseStoredDocuments,
  parseTranscriptions,
  totalReadIn,
  totalShownMissing,
  totalShownRead,
  transcriptionsBefore,
  typeTotals,
} from './ocr-sm2-compare.ts';
import { type DrawnFiling, REFERENCE_DRAW_FILE, SEED_DIR, parseDrawn } from './seed-format.ts';
import { type GateCounts, SUM_GATES, type SumGate, gateCounts } from './sum-gates.ts';
import { type VarerRoleCounts, VARER_DUMP_FILE, varerAgainstDump } from './document-run-counts.ts';

export const TRANSCRIPTIONS_FILE = 'analysis/ocr-reference/transcriptions.csv';
export const CORRECTIONS_FILE = 'analysis/ocr-reference/README.md';
// Written by analysis/ocr-reference/blind-check-draw.ts: which cells the blind
// check suspected. A correction of any other cell was made later.
export const BLIND_CHECK_KEY_FILE = 'analysis/ocr-reference/blind-check-key.csv';
export const CONSISTENCY_FILE = 'analysis/output/ocr-consistency-2026.json';
export const REPORT_FILE = 'analysis/output/ocr-sm2.md';

// --- The consistency file ------------------------------------------------------------

export interface ConsistencyFiling {
  orgnr: string;
  filingYear: number;
  layout: string | null;
  status: string;
  refusal: string | null;
  columns: (CheckedColumn & { role: 'current' | 'prior'; statedYear: number })[];
}

export interface Consistency {
  generated: string;
  script: string;
  tesseract: string;
  boundKr: number;
  filings: ConsistencyFiling[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function check(value: unknown, where: string): CheckResult {
  if (value === 'pass' || value === 'fail' || value === 'not_evaluable') return value;
  throw new Error(`${CONSISTENCY_FILE}: ${where} is not a check result`);
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string') throw new Error(`${CONSISTENCY_FILE}: ${where} must be a string`);
  return value;
}

function whole(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`${CONSISTENCY_FILE}: ${where} must be a whole number`);
  return value;
}

/** analysis/output/ocr-consistency-2026.json, as consistency.py writes it. */
export function parseConsistency(json: unknown): Consistency {
  if (!isRecord(json) || !Array.isArray(json.filings)) throw new Error(`${CONSISTENCY_FILE}: must be an object with filings`);
  return {
    generated: text(json.generated, 'generated'),
    script: text(json.script, 'script'),
    tesseract: text(json.tesseract, 'tesseract'),
    boundKr: whole(json.within_document_bound_kr, 'within_document_bound_kr'),
    filings: json.filings.map((raw: unknown, i) => {
      if (!isRecord(raw) || !Array.isArray(raw.columns)) throw new Error(`${CONSISTENCY_FILE}: filing ${i} is malformed`);
      return {
        orgnr: text(raw.orgnr, `filing ${i} orgnr`),
        filingYear: whole(raw.filing_year, `filing ${i} filing_year`),
        layout: raw.layout === null ? null : text(raw.layout, `filing ${i} layout`),
        status: text(raw.status, `filing ${i} status`),
        refusal: raw.refusal === null ? null : text(raw.refusal, `filing ${i} refusal`),
        columns: raw.columns.map((c: unknown, j) => {
          const where = `filing ${i} column ${j}`;
          if (!isRecord(c) || (c.role !== 'current' && c.role !== 'prior')) throw new Error(`${CONSISTENCY_FILE}: ${where} is malformed`);
          return {
            role: c.role,
            statedYear: whole(c.stated_year, `${where} stated_year`),
            c1: check(c.c1, `${where} c1`),
            c2: check(c.c2, `${where} c2`),
            c3: check(c.c3, `${where} c3`),
            c4: check(c.c4, `${where} c4`),
            c5: check(c.c5, `${where} c5`),
            status: text(c.column_status, `${where} column_status`),
          };
        }),
      };
    }),
  };
}

// --- Rendering ---------------------------------------------------------------------------

const GROUP_NAME: Record<Group, string> = { recent: 'Recent (2023–2025)', older: 'Older (2021–2022)' };
const ROLE_NAME = { current: 'this year', prior: 'last year' } as const;

const share = (part: number, whole: number): string =>
  whole === 0 ? '–' : formatPercent(new Decimal(part).div(whole).toString());

const kroner = (kr: bigint | null): string => (kr === null ? 'blank' : formatKroner((kr * ORE_PER_KRONE).toString()));
const ore = (value: bigint | null): string => (value === null ? 'NULL' : formatKroner(value.toString()));

function storedChecked(column: StoredColumn): CheckedColumn {
  const need = (name: 'c1' | 'c2' | 'c3' | 'c4' | 'c5'): CheckResult => {
    const value = column.checks[name];
    if (value === null) throw new Error(`document_column.csv: ${column.orgnr}/${column.filingYear}/${column.role} has no ${name}`);
    return value;
  };
  return { c1: need('c1'), c2: need('c2'), c3: need('c3'), c4: need('c4'), c5: need('c5'), status: column.status };
}

// "not read" is split by what the transcription holds: a transcribed 0
// (often a line the document prints as 0 or as a dash) or a real figure.
export const CLASS_TABLE_HEADER =
  '| Group | correct | not read (transcribed 0) | not read (transcribed non-zero) | misread | phantom | Counted | Recovered exactly |';

export function classRow(name: string, results: readonly FieldResult[]): string {
  const counts = countClasses(results);
  const notRead = countNotRead(results);
  const counted = results.length;
  return `| ${name} | ${counts.correct} | ${notRead.zero} | ${notRead.nonZero} | ${counts.misread} | ${counts.phantom} | ${counted} | ${share(counts.correct, counted)} |`;
}

// Story 2.3, README "Transcription check": the within-document checks run on
// the transcriptions alone found six transcription errors before the first
// measurement. Not derivable from the committed files, so stated here.
export const FIRST_CHECK_ERRORS = 6;

// The one correction that was not blind (README, "Blind check"): blind-check
// cell 6 was re-read after the build session said its first entry equalled
// the other column's figure.
export const PROMPTED_RECHECK = '995318733/2021/prior/sum_kortsiktig_gjeld';
const correctionKey = (c: Correction) => `${c.orgnr}/${c.filingYear}/${c.role}/${c.field}`;

function resultRow(r: FieldResult): string {
  return `| ${r.orgnr} | ${r.filingYear} | ${ROLE_NAME[r.role]} | ${r.field} | ${kroner(r.expectedKr)} | ${ore(r.readOre)} | ${r.class} | ${r.columnStatus ?? 'no column'} |`;
}

// --- Before and after Story 2.3b -----------------------------------------------------

// Story 2.3's step-1 output and consistency file, copied byte for byte before
// any re-read (Story 2.3b), and the 2.1b run's counts before and after it.
export const BEFORE_2_3B_DIR = 'analysis/output/ocr-sm2-before-2.3b';
export const RUN_COUNTS_BEFORE_FILE = 'analysis/output/document-run-counts-before-2.3b.json';
export const RUN_COUNTS_AFTER_FILE = 'analysis/output/document-run-counts-after-2.3b.json';

// Story 2.5b: the committed seed's document rows as they stood before any
// Story 2.5b re-read (the state after Story 2.3b), copied byte for byte, and
// the 2.1b run's counts before and after its re-read.
export const BEFORE_2_5B_DIR = 'analysis/output/ocr-sm2-before-2.5b';
export const RUN_COUNTS_BEFORE_2_5B_FILE = 'analysis/output/document-run-counts-before-2.5b.json';
export const RUN_COUNTS_AFTER_2_5B_FILE = 'analysis/output/document-run-counts-after-2.5b.json';

// Story 2.5c: the committed seed's document rows as Story 2.5b's re-read left
// them, copied byte for byte before any Story 2.5c re-read, and the 2.1b
// run's counts before and after its re-read. The copy is also the "after" of
// the Story 2.5b section, so a later re-read does not move that section.
export const BEFORE_2_5C_DIR = 'analysis/output/ocr-sm2-before-2.5c';
export const RUN_COUNTS_BEFORE_2_5C_FILE = 'analysis/output/document-run-counts-before-2.5c.json';
export const RUN_COUNTS_AFTER_2_5C_FILE = 'analysis/output/document-run-counts-after-2.5c.json';

/** What `pnpm derive`'s engine made of the 2.1b current columns, from a counts JSON written since Story 2.5c. */
export interface RunEngineTotals {
  columns: number;
  fingerprints: number;
  costLinesShortOfTotal: number;
  shortWithNedskrivningerEmpty: number;
  negativeUnexplained: number;
  emptiedKundefordringer: number;
  emptiedBankinnskudd: number;
}

/** The 2.1b rows' varer against the Story 2.5b dump, per role, from a counts JSON written since Story 2.5c. */
export type RunVarer = Record<'current' | 'prior', VarerRoleCounts>;

/** The stored fingerprints by business type, from a counts JSON written since Story 2.5b. */
export interface RunTypeTotals {
  fingerprints: number;
  undetermined: number;
  companies: number;
  companiesUndetermined: number;
}

/** What the report reads from a document-run-counts JSON (scripts/document-run-counts.ts). */
export interface RunCounts {
  documents: number;
  currentColumns: number;
  currentTotalRead: number;
  priorColumns: number;
  priorTotalRead: number;
  currentReconciled: number;
  readerCommits: Record<string, number>;
  /** Non-NULL figures per field in the current columns; a field the counts predate is absent. */
  currentNonNull: Record<string, number>;
  /** Null in counts written before Story 2.5b, which hold no fingerprints. */
  types: RunTypeTotals | null;
  /** What the sum gates admitted, both column roles together; null in counts written before Story 2.5b. */
  gates: GateCounts | null;
  /** Null in counts written before Story 2.5c. */
  engine: RunEngineTotals | null;
  /** Null in counts written before Story 2.5c, or when the dump was not there. */
  varer: RunVarer | null;
}

const VARER_COUNT_KEYS = [
  'compared',
  'unchanged',
  'emptied',
  'changed',
  'newly_read',
  'emptied_or_changed_negative_before',
  'negative_before',
  'negative_after',
  'only_in_dump',
  'only_now',
] as const satisfies readonly (keyof VarerRoleCounts)[];

function count(value: unknown, file: string, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`${file}: ${where} must be a count`);
  return value;
}

export function parseRunCounts(json: unknown, file: string): RunCounts {
  const at = (value: unknown, key: string, where: string): unknown => {
    if (!isRecord(value)) throw new Error(`${file}: ${where} must be an object`);
    return value[key];
  };
  const columns = at(json, 'columns', '.');
  const role = (name: 'current' | 'prior') => at(columns, name, 'columns');
  const total = (name: 'current' | 'prior') =>
    count(at(at(role(name), 'non_null', `columns.${name}`), 'sum_egenkapital_gjeld', `columns.${name}.non_null`), file, `columns.${name}.non_null.sum_egenkapital_gjeld`);
  const documents = at(json, 'documents', '.');
  const commits = at(documents, 'reader_commit', 'documents');
  if (!isRecord(commits)) throw new Error(`${file}: documents.reader_commit must be an object`);
  const nonNull = at(role('current'), 'non_null', 'columns.current');
  if (!isRecord(nonNull)) throw new Error(`${file}: columns.current.non_null must be an object`);
  const fingerprints = isRecord(json) ? json.fingerprints : undefined;
  const typeCount = (group: unknown, key: string, where: string) => count(at(group, key, where), file, `${where}.${key}`);
  const types = (): RunTypeTotals => {
    const byType = at(fingerprints, 'types', 'fingerprints');
    const companies = at(fingerprints, 'companies', 'fingerprints');
    if (!isRecord(companies)) throw new Error(`${file}: fingerprints.companies must be an object`);
    return {
      fingerprints: count(at(fingerprints, 'total', 'fingerprints'), file, 'fingerprints.total'),
      undetermined: typeCount(byType, 'undetermined', 'fingerprints.types'),
      companies: Object.entries(companies).reduce((sum, [k, v]) => sum + count(v, file, `fingerprints.companies.${k}`), 0),
      companiesUndetermined: typeCount(companies, 'undetermined', 'fingerprints.companies'),
    };
  };
  return {
    documents: count(at(documents, 'total', 'documents'), file, 'documents.total'),
    currentColumns: count(at(role('current'), 'columns', 'columns.current'), file, 'columns.current.columns'),
    currentTotalRead: total('current'),
    priorColumns: count(at(role('prior'), 'columns', 'columns.prior'), file, 'columns.prior.columns'),
    priorTotalRead: total('prior'),
    currentReconciled: count(at(at(role('current'), 'status', 'columns.current'), 'reconciled', 'columns.current.status') ?? 0, file, 'columns.current.status.reconciled'),
    readerCommits: Object.fromEntries(Object.entries(commits).map(([k, v]) => [k, count(v, file, `documents.reader_commit.${k}`)])),
    currentNonNull: Object.fromEntries(Object.entries(nonNull).map(([k, v]) => [k, count(v, file, `columns.current.non_null.${k}`)])),
    types: fingerprints === undefined ? null : types(),
    gates: gatesOf(),
    engine: engineOf(),
    varer: varerOf(),
  };

  function engineOf(): RunEngineTotals | null {
    if (!isRecord(json) || json.engine === undefined) return null;
    const engine = json.engine;
    const skipped = at(engine, 'skipped', 'engine');
    const emptied = at(engine, 'emptied_above_api_subtotal', 'engine');
    return {
      columns: count(at(engine, 'columns', 'engine'), file, 'engine.columns'),
      fingerprints: count(at(engine, 'fingerprints', 'engine'), file, 'engine.fingerprints'),
      costLinesShortOfTotal: count(at(skipped, 'cost_lines_short_of_total', 'engine.skipped'), file, 'engine.skipped.cost_lines_short_of_total'),
      shortWithNedskrivningerEmpty: count(
        at(engine, 'cost_lines_short_of_total_nedskrivninger_empty', 'engine'),
        file,
        'engine.cost_lines_short_of_total_nedskrivninger_empty',
      ),
      negativeUnexplained: count(at(skipped, 'negative_unexplained', 'engine.skipped'), file, 'engine.skipped.negative_unexplained'),
      emptiedKundefordringer: count(at(emptied, 'kundefordringer', 'engine.emptied_above_api_subtotal'), file, 'engine.emptied_above_api_subtotal.kundefordringer'),
      emptiedBankinnskudd: count(at(emptied, 'bankinnskudd', 'engine.emptied_above_api_subtotal'), file, 'engine.emptied_above_api_subtotal.bankinnskudd'),
    };
  }

  function varerOf(): RunVarer | null {
    if (!isRecord(json) || json.varer_against_dump === undefined || json.varer_against_dump === null) return null;
    const byRole = at(json.varer_against_dump, 'columns', 'varer_against_dump');
    const one = (name: 'current' | 'prior'): VarerRoleCounts => {
      const where = `varer_against_dump.columns.${name}`;
      const counts = at(byRole, name, 'varer_against_dump.columns');
      return Object.fromEntries(VARER_COUNT_KEYS.map((k) => [k, count(at(counts, k, where), file, `${where}.${k}`)])) as VarerRoleCounts;
    };
    return { current: one('current'), prior: one('prior') };
  }

  function gatesOf(): GateCounts | null {
    const byRole = (['current', 'prior'] as const).map((name) => at(role(name), 'gates', `columns.${name}`));
    if (byRole.every((g) => g === undefined)) return null;
    const out = {} as GateCounts;
    for (const gate of SUM_GATES) {
      let admitted = 0;
      let zero = 0;
      for (const [i, g] of byRole.entries()) {
        const where = `columns.${i === 0 ? 'current' : 'prior'}.gates.${gate}`;
        const one = at(g, gate, where.replace(`.${gate}`, ''));
        admitted += count(at(one, 'admitted', where), file, `${where}.admitted`);
        zero += count(at(one, 'operand_counted_as_zero', where), file, `${where}.operand_counted_as_zero`);
      }
      out[gate] = { admitted, withOperandCountedAsZero: zero };
    }
    return out;
  }
}

/** Story 2.5b's inputs: the state after Story 2.3b, before any Story 2.5b re-read. */
export interface Story25bInputs {
  /** The corrected transcriptions against the stored columns before Story 2.5b. */
  comparison: Comparison;
  stored: readonly StoredColumn[];
  documents: readonly StoredDocument[];
  /** The before copy was exported before Story 2.5b's migration: no part columns. */
  lacksParts: boolean;
  runBefore: RunCounts;
  /** Null until the re-read of the 2.1b rows has been counted. */
  runAfter: RunCounts | null;
}

/** Story 2.5c's inputs: the state Story 2.5b's re-read left, before any Story 2.5c re-read. */
export interface Story25cInputs {
  /** The corrected transcriptions against the stored columns before Story 2.5c. */
  comparison: Comparison;
  stored: readonly StoredColumn[];
  documents: readonly StoredDocument[];
  runBefore: RunCounts;
  /** Null until the re-read of the 2.1b rows has been counted. */
  runAfter: RunCounts | null;
}

export interface StoryBInputs {
  /** The corrected transcriptions against Story 2.3's stored columns. */
  comparison: Comparison;
  /** The transcriptions before the logged corrections against the same: what the blind check's selection was made from. */
  beforeCorrections: Comparison;
  stored: readonly StoredColumn[];
  consistency: Consistency;
  runBefore: RunCounts;
  /** Null until the re-read of the 2.1b run has been counted. */
  runAfter: RunCounts | null;
}

export interface ReportInputs {
  drawn: readonly DrawnFiling[];
  comparison: Comparison;
  /** The same comparison against the transcriptions before the logged corrections. */
  before: Comparison;
  corrections: readonly Correction[];
  /** The corrections of cells the blind check did not suspect: made later, on prompting. */
  laterCorrections: readonly Correction[];
  documents: readonly StoredDocument[];
  stored: readonly StoredColumn[];
  consistency: Consistency;
  /** Story 2.3's output, for the section "Before and after Story 2.3b". */
  before23b: StoryBInputs;
  /** The state before Story 2.5b: "after" of the Story 2.3b section, "before" of the Story 2.5b section. */
  before25b: Story25bInputs;
  /** The state before Story 2.5c: "after" of the Story 2.5b section, "before" of the Story 2.5c section. */
  before25c: Story25cInputs;
  /** The committed seed was exported before Story 2.5b's migration, so it holds no part columns. */
  seedLacksParts: boolean;
  /** The API subtotals by brreg_id (seed/demo/key_figures.csv), for the fingerprints. */
  subtotals: ReadonlyMap<string, ApiSubtotals>;
}

const ratio = (part: number, whole: number): string => `${part} of ${whole} (${share(part, whole)})`;

/**
 * The section "Before and after Story 2.3b" (the bold balance total). Its
 * "after" is the state Story 2.3b left, which Story 2.5b copied before its
 * own re-read (`BEFORE_2_5B_DIR`), over the 23 fields compared then, so a
 * later re-read does not move this section.
 */
export function renderBeforeAfter(inputs: ReportInputs): string[] {
  const { consistency, before23b: b, before25b } = inputs;
  const stored = before25b.stored;
  const before = onlyFields(b.comparison.results, SM2_FIELDS_BEFORE_2_5B);
  const after = onlyFields(before25b.comparison.results, SM2_FIELDS_BEFORE_2_5B);
  const lines: string[] = [];
  const push = (...more: string[]) => lines.push(...more);
  const refBefore = { current: totalReadIn(b.stored, 'current'), prior: totalReadIn(b.stored, 'prior') };
  const refAfter = { current: totalReadIn(stored, 'current'), prior: totalReadIn(stored, 'prior') };
  const spikeColumns = (c: Consistency) => c.filings.flatMap((f) => f.columns);
  const spikeRead = (c: Consistency) => spikeColumns(c).filter(totalShownRead).length;
  const spikeMissing = (c: Consistency) => spikeColumns(c).filter(totalShownMissing).length;
  const spikeAll = (c: Consistency) => c.filings.length * 2;
  const runAfter = b.runAfter;
  const notYet = 'not yet counted';

  push(
    '## Before and after Story 2.3b',
    '',
    'Story 2.3b reads the bold "SUM EGENKAPITAL OG GJELD" row, which Tesseract reads as "50M EGENKAPITAL OG GJELD", with a second label fold (`layout.fold_mixed`), and re-reads every stored document (`pnpm ingest --reread`). ' +
      `"Before" is Story 2.3's output, copied byte for byte into \`${BEFORE_2_3B_DIR}/\` before any re-read, and \`${RUN_COUNTS_BEFORE_FILE}\`; "after" is the seed as Story 2.3b left it, copied into \`${BEFORE_2_5B_DIR}/\` before Story 2.5b's re-read, \`${CONSISTENCY_FILE}\` and \`${RUN_COUNTS_AFTER_FILE}\`. ` +
      `Both are compared with the corrected transcriptions, over the ${SM2_FIELDS_BEFORE_2_5B.length} fields compared then.`,
    '',
    '### "Sum egenkapital og gjeld" read',
    '',
    '| Data set | Columns | Before | After |',
    '|---|---|---|---|',
    `| Reference set, every stored document (this year) | ${refAfter.current.columns} | ${ratio(refBefore.current.read, refBefore.current.columns)} | ${ratio(refAfter.current.read, refAfter.current.columns)} |`,
    `| Reference set, every stored document (last year) | ${refAfter.prior.columns} | ${ratio(refBefore.prior.read, refBefore.prior.columns)} | ${ratio(refAfter.prior.read, refAfter.prior.columns)} |`,
    `| The spike's ${consistency.filings.length} filings, shown read (c3 or c4 evaluable) | ${spikeAll(consistency)} | ${ratio(spikeRead(b.consistency), spikeAll(b.consistency))} | ${ratio(spikeRead(consistency), spikeAll(consistency))} |`,
    `| The spike's filings, shown missing (c3 not evaluable, c5 evaluable) | ${spikeAll(consistency)} | ${spikeMissing(b.consistency)} | ${spikeMissing(consistency)} |`,
    `| Story 2.1b run, local data (this year) | ${b.runBefore.currentColumns} | ${ratio(b.runBefore.currentTotalRead, b.runBefore.currentColumns)} | ${runAfter === null ? notYet : ratio(runAfter.currentTotalRead, runAfter.currentColumns)} |`,
    `| Story 2.1b run, local data (last year) | ${b.runBefore.priorColumns} | ${ratio(b.runBefore.priorTotalRead, b.runBefore.priorColumns)} | ${runAfter === null ? notYet : ratio(runAfter.priorTotalRead, runAfter.priorColumns)} |`,
    '',
    `- **The Story 2.1b run is local data.** Its ${b.runBefore.documents} documents are in the local database and a gitignored dump, not in the seed, until Story 5.4's allow-list; its counts come from \`pnpm analysis:document-run\` and cannot be reproduced from a fresh clone. ` +
      `Reconciled current columns: ${b.runBefore.currentReconciled} before, ${runAfter === null ? notYet : runAfter.currentReconciled} after. Reader versions before: ${Object.entries(b.runBefore.readerCommits).map(([k, v]) => `${k.slice(0, 7)} ${v}`).join(', ')}` +
      `${runAfter === null ? '' : `; after: ${Object.entries(runAfter.readerCommits).map(([k, v]) => `${k.slice(0, 7)} ${v}`).join(', ')}`}.`,
    '- **The spike\'s filings hold no figures here**, only check results, so "shown read" is a lower bound: a total read beside a missing sum eiendeler and a missing sum egenkapital or sum gjeld shows in neither c3 nor c4.',
    '',
  );

  const spikeBefore = consistencyDenominators(b.consistency.filings.length, spikeColumns(b.consistency));
  const spikeNow = consistencyDenominators(consistency.filings.length, spikeColumns(consistency));
  push(
    '### The spike\'s filings: evaluable and passing',
    '',
    '| | Columns | Evaluable | Passing | Passing / evaluable | Reconciled (c1–c5) |',
    '|---|---|---|---|---|---|',
    `| Before | ${spikeBefore.all} | ${spikeBefore.evaluable} | ${spikeBefore.pass} | ${share(spikeBefore.pass, spikeBefore.evaluable)} | ${spikeBefore.reconciled} |`,
    `| After | ${spikeNow.all} | ${spikeNow.evaluable} | ${spikeNow.pass} | ${share(spikeNow.pass, spikeNow.evaluable)} | ${spikeNow.reconciled} |`,
    '',
  );

  push(
    '### The reference set, every class',
    '',
    CLASS_TABLE_HEADER,
    '|---|---|---|---|---|---|---|---|',
    classRow('Before', before),
    classRow('After', after),
    '',
    'Per field, before → after:',
    '',
    '| Field | correct | not read | misread | phantom |',
    '|---|---|---|---|---|',
    ...classesByField(before, SM2_FIELDS_BEFORE_2_5B).map(({ field, counts }, i) => {
      const now = classesByField(after, SM2_FIELDS_BEFORE_2_5B)[i]?.counts ?? counts;
      const cell = (name: keyof typeof counts) => (counts[name] === now[name] ? `${now[name]}` : `${counts[name]} → ${now[name]}`);
      return `| ${field} | ${cell('correct')} | ${cell('not read')} | ${cell('misread')} | ${cell('phantom')} |`;
    }),
    '',
  );

  const misreadsBefore = misreadsReachingEngine(before);
  const misreadsAfter = misreadsReachingEngine(after);
  const phantomsBefore = phantomsReachingEngine(before);
  const phantomsAfter = phantomsReachingEngine(after);
  const fresh = [...newResults(misreadsBefore, misreadsAfter), ...newResults(phantomsBefore, phantomsAfter)];
  push(
    '### Errors that reach the engine, before and after',
    '',
    'More figures read must not be paid for with new errors. Misread and phantom figures in reconciled columns of the drawn filings:',
    '',
    '| | Before | After |',
    '|---|---|---|',
    `| Misread, reaching the engine | ${misreadsBefore.length} | ${misreadsAfter.length} |`,
    `| Phantom, reaching the engine | ${phantomsBefore.length} | ${phantomsAfter.length} |`,
    '',
    'New ones (after, not before):',
    '',
  );
  if (fresh.length === 0) {
    push('None.', '');
  } else {
    push(
      '| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |',
      '|---|---|---|---|---|---|---|---|',
      ...fresh.map(resultRow),
      '',
    );
  }
  return lines;
}

const GATE_NAME: Record<SumGate, string> = {
  cost_lines: 'Cost lines against sum kostnader',
  intangible_parts: 'Parts against sum immaterielle eiendeler',
};

/** What the sum gates admitted in the stored columns, both roles. */
export function storedGateCounts(columns: readonly StoredColumn[]): GateCounts {
  return gateCounts(
    columns.map((c) => ({
      digitsPassFields: c.digitsPassFields,
      hasFigure: (field: string) => {
        const f = SM2_FIELDS.find((name) => name === field);
        if (f === undefined) throw new Error(`${field}: not a compared field`);
        return (c.figuresOre.get(f) ?? null) !== null;
      },
    })),
  );
}

const COST_LINES = ['varekostnad', 'lonnskostnad', 'avskrivninger', 'nedskrivninger', 'annen_driftskostnad'] as const;

/** "n of m (p %)" for the undetermined share, or the reason there is none. */
const undeterminedOf = (part: number, whole: number): string => (whole === 0 ? 'none' : ratio(part, whole));

/**
 * The section "Before and after Story 2.5b" (the cost lines and the parts of
 * intangible assets): every class per field, the errors that reach the
 * engine with each new one listed, and the undetermined share of the
 * fingerprints. Totals only: eight reference-set companies are in Story
 * 5.1's labelled set, so no fingerprint result is tied to an orgnr. Its
 * "after" is the state Story 2.5b left, which Story 2.5c copied before its
 * own re-read (`BEFORE_2_5C_DIR`), so a later re-read does not move it.
 */
export function renderBeforeAfter25b(inputs: ReportInputs): string[] {
  const { subtotals, before25b: b } = inputs;
  const { comparison, stored, documents } = inputs.before25c;
  const before = b.comparison.results;
  const after = comparison.results;
  const lines: string[] = [];
  const push = (...more: string[]) => lines.push(...more);
  const notYet = 'not yet counted';

  push(
    '## Before and after Story 2.5b',
    '',
    'Story 2.5b reads the cost lines in their other printed wordings (the depreciation row, plurals, note references read as letters), reads the four printed parts of intangible assets as fields of their own, ' +
      'and admits a digits-only figure of a cost line or a part through a sum gate (the five cost lines against sum kostnader, the four parts against sum immaterielle eiendeler, 5 kr), then re-reads every stored document. ' +
      `"Before" is the committed seed as Story 2.3b left it, copied byte for byte into \`${BEFORE_2_5B_DIR}/\` before any re-read, and \`${RUN_COUNTS_BEFORE_2_5B_FILE}\`; "after" is the seed as Story 2.5b left it, copied into \`${BEFORE_2_5C_DIR}/\` before Story 2.5c's re-read, and \`${RUN_COUNTS_AFTER_2_5B_FILE}\`. ` +
      'Both are compared with the corrected transcriptions, over every compared field.',
    '',
  );
  if (b.lacksParts) {
    push(
      `- **The parts before.** The before copy was exported before Story 2.5b's migration and has no columns for ${SM2_PARTS.join(', ')}: step 1 did not read them, so every transcribed part counts as not read before.`,
      '',
    );
  }

  push(
    '### The reference set, every class',
    '',
    CLASS_TABLE_HEADER,
    '|---|---|---|---|---|---|---|---|',
    classRow('Before', before),
    classRow('After', after),
    '',
    'Per field, before → after:',
    '',
    '| Field | correct | not read | misread | phantom |',
    '|---|---|---|---|---|',
    ...classesByField(before).map(({ field, counts }, i) => {
      const now = classesByField(after)[i]?.counts ?? counts;
      const cell = (name: keyof typeof counts) => (counts[name] === now[name] ? `${now[name]}` : `${counts[name]} → ${now[name]}`);
      return `| ${field} | ${cell('correct')} | ${cell('not read')} | ${cell('misread')} | ${cell('phantom')} |`;
    }),
    '',
  );

  const misreadsBefore = misreadsReachingEngine(before);
  const misreadsAfter = misreadsReachingEngine(after);
  const phantomsBefore = phantomsReachingEngine(before);
  const phantomsAfter = phantomsReachingEngine(after);
  const fresh = [...newResults(misreadsBefore, misreadsAfter), ...newResults(phantomsBefore, phantomsAfter)];
  push(
    '### Errors that reach the engine, before and after',
    '',
    'More figures read must not be paid for with new errors. Misread and phantom figures in reconciled columns of the drawn filings:',
    '',
    '| | Before | After |',
    '|---|---|---|',
    `| Misread, reaching the engine | ${misreadsBefore.length} | ${misreadsAfter.length} |`,
    `| Phantom, reaching the engine | ${phantomsBefore.length} | ${phantomsAfter.length} |`,
    '',
    'New ones (after, not before):',
    '',
  );
  if (fresh.length === 0) {
    push('None.', '');
  } else {
    push(
      '| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |',
      '|---|---|---|---|---|---|---|---|',
      ...fresh.map(resultRow),
      '',
    );
  }

  const refBefore: TypeTotals = typeTotals(b.stored, b.documents, subtotals);
  const refAfter: TypeTotals = typeTotals(stored, documents, subtotals);
  const runBefore = b.runBefore.types;
  const runAfter = b.runAfter === null ? null : b.runAfter.types;
  const runCell = (t: RunTypeTotals | null, pick: (t: RunTypeTotals) => [number, number]) => {
    if (t === null) return notYet;
    const [part, whole] = pick(t);
    return undeterminedOf(part, whole);
  };
  push(
    '### Fingerprints without a business type',
    '',
    'A fingerprint is undetermined when its unknown categories (an empty line spanning bands) allow more than one business type (Story 2.5). Totals only: no company is named. ' +
      `The reference set's fingerprints are computed here from every stored current column of its companies, with the engine (\`fingerprintOf\`, \`businessType\`) and the API subtotals of \`${SEED_DIR}/key_figures.csv\`, as \`pnpm derive\` computes them; the Story 2.1b run's come from the counts files, read from \`register.fingerprint\`.`,
    '',
    '| | Before | After |',
    '|---|---|---|',
    `| Reference set: current columns | ${refBefore.columns} | ${refAfter.columns} |`,
    `| Reference set: fingerprints undetermined | ${undeterminedOf(refBefore.undetermined, refBefore.fingerprints)} | ${undeterminedOf(refAfter.undetermined, refAfter.fingerprints)} |`,
    `| Reference set: companies undetermined at their newest fingerprinted year | ${undeterminedOf(refBefore.companiesUndetermined, refBefore.companies)} | ${undeterminedOf(refAfter.companiesUndetermined, refAfter.companies)} |`,
    `| Story 2.1b run, local data: fingerprints undetermined | ${runCell(runBefore, (t) => [t.undetermined, t.fingerprints])} | ${runCell(runAfter, (t) => [t.undetermined, t.fingerprints])} |`,
    `| Story 2.1b run, local data: companies undetermined at their newest fingerprinted year | ${runCell(runBefore, (t) => [t.companiesUndetermined, t.companies])} | ${runCell(runAfter, (t) => [t.companiesUndetermined, t.companies])} |`,
    '',
  );

  const gatesBefore = storedGateCounts(b.stored);
  const gatesAfter = storedGateCounts(stored);
  const runGates = (counts: RunCounts | null, gate: SumGate, pick: 'admitted' | 'withOperandCountedAsZero'): string => {
    if (counts === null) return notYet;
    if (counts.gates === null) return 'no gate then';
    return `${counts.gates[gate][pick]}`;
  };
  push(
    '### Figures the sum gates admitted',
    '',
    'A figure the digits-only pass gave for a line the plain pass refused, admitted because the lines summed to their plain-pass total: a field in a column\'s `digits_pass_fields` that is an operand of a gate. ' +
      'It **rested on an operand counted as 0 (a blank row or no row)** when another operand of the same gate is NULL in the stored column: the gate counted that line as 0. ' +
      'The stored data cannot tell a row printed with no figure in either pass from a line the document does not print, so the two are counted together. Both column roles, totals only.',
    '',
    '| Gate | Data set | Before: admitted | Before: on an operand counted as 0 | After: admitted | After: on an operand counted as 0 |',
    '|---|---|---|---|---|---|',
    ...SUM_GATES.flatMap((gate) => [
      `| ${GATE_NAME[gate]} | Reference set | ${gatesBefore[gate].admitted} | ${gatesBefore[gate].withOperandCountedAsZero} | ${gatesAfter[gate].admitted} | ${gatesAfter[gate].withOperandCountedAsZero} |`,
      `| ${GATE_NAME[gate]} | Story 2.1b run, local data | ${runGates(b.runBefore, gate, 'admitted')} | ${runGates(b.runBefore, gate, 'withOperandCountedAsZero')} | ${runGates(b.runAfter, gate, 'admitted')} | ${runGates(b.runAfter, gate, 'withOperandCountedAsZero')} |`,
    ]),
    '',
  );

  const runFields = [...COST_LINES, ...SM2_PARTS];
  const nonNull = (counts: RunCounts | null, field: string): string => {
    if (counts === null) return notYet;
    const n = counts.currentNonNull[field];
    return n === undefined ? 'not a field then' : ratio(n, counts.currentColumns);
  };
  push(
    '### The Story 2.1b run, local data: cost lines and parts read',
    '',
    `Current columns holding a figure, of all current columns. The run's ${b.runBefore.documents} documents are in the local database and a gitignored dump, not in the seed, until Story 5.4's allow-list; these counts come from \`pnpm analysis:document-run\` and cannot be reproduced from a fresh clone.`,
    '',
    '| Field | Before | After |',
    '|---|---|---|',
    ...runFields.map((field) => `| ${field} | ${nonNull(b.runBefore, field)} | ${nonNull(b.runAfter, field)} |`),
    '',
  );
  if (b.runAfter !== null) {
    // Checked by hand after the Story 2.5b re-read (2026-11-06), against the
    // local database and .local/document-run-2.4/; not computed from the
    // committed inputs, so stated here as found. Totals only.
    push(
      '- **Not every new depreciation figure is right.** Checked by hand after the re-read, totals only. 1 291 reconciled columns hold `avskrivninger` for the first time and all four main cost lines. In 48 of them, the lines do not sum to sum kostnader within 5 kr: 27 columns in 19 companies are over the total and 21 columns in 19 companies are under it. Across all 2 044 documents, 10 columns in 7 companies are exactly 21 000 000 kr over. In 9 of them, `avskrivninger` is read as 23.x million in the last-year column. The check of one PDF shows the cause: Tesseract reads the leading digit "2" as "23" in both passes, a token one character wide. No sum covers the cost lines, so the column reconciled.',
      '- **An over-read is stopped and an under-read is not.** `pnpm derive` skips a column over the total (`negative_unexplained`, 21 → 35), so none of the 12 current columns over the total has a fingerprint. All 17 current columns under the total have one, with the missing amount counted as unexplained. The fix needs a re-read and is deferred (`_bmad-output/implementation-artifacts/deferred-work.md`, Story 2.5b, "Tesseract reads one printed digit as two").',
      '',
    );
  }
  return lines;
}

/** "n of m (p %)" of the evaluable columns, or "none evaluable". */
const ofEvaluable = (part: number, whole: number): string => (whole === 0 ? 'none evaluable' : ratio(part, whole));

/** The reference set's varer against the before copy, per role, as the 2.1b counts compare against the dump. */
function referenceVarer(before: readonly StoredColumn[], after: readonly StoredColumn[]) {
  const rows = (columns: readonly StoredColumn[]) =>
    columns.map((c) => {
      const varer = c.figuresOre.get('varer') ?? null;
      return { orgnr: c.orgnr, filing_year: c.filingYear, role: c.role, varer_ore: varer === null ? null : varer.toString() };
    });
  return varerAgainstDump(BEFORE_2_5C_DIR, rows(before), rows(after)).columns;
}

/**
 * The section "Before and after Story 2.5c" (a digit read as two, cost lines
 * that do not sum, the unguarded lines, varer): every class per field, the
 * errors that reach the engine with each new one listed, the columns whose
 * cost lines do not sum, the lines R3 keeps from the engine and the varer
 * R4 moves, before and after, as totals. No fingerprint result is tied to
 * an orgnr.
 */
export function renderBeforeAfter25c(inputs: ReportInputs): string[] {
  const { comparison, stored, documents, subtotals, before25c: b } = inputs;
  const before = b.comparison.results;
  const after = comparison.results;
  const lines: string[] = [];
  const push = (...more: string[]) => lines.push(...more);
  const notYet = 'not yet counted';

  push(
    '## Before and after Story 2.5c',
    '',
    'Story 2.5c refuses a digit token narrower than 0.6 of its digits at the page\'s character pitch (R1: Tesseract reads a printed "2" as "23" in a box one glyph wide, and both passes agree), reads `varer` from the balance sheet only (R4: the income statement\'s inventory-change row ends in "varer" too), and re-reads every stored document. ' +
      'Two engine rules need no re-read: no fingerprint when the four main cost lines are read and fall short of sum kostnader by more than 5 kr (R2, `cost_lines_short_of_total`), and a current `kundefordringer` or `bankinnskudd` above the API\'s sum omløpsmidler + 5 kr is not used (R3). ' +
      `"Before" is the committed seed as Story 2.5b left it, copied byte for byte into \`${BEFORE_2_5C_DIR}/\` before any re-read, and \`${RUN_COUNTS_BEFORE_2_5C_FILE}\`; "after" is the committed seed and \`${RUN_COUNTS_AFTER_2_5C_FILE}\`. ` +
      'Both are compared with the corrected transcriptions, over every compared field. The engine rules are applied to both with this commit\'s engine, so "before" and "after" differ only by the re-read.',
    '',
    '### The reference set, every class',
    '',
    CLASS_TABLE_HEADER,
    '|---|---|---|---|---|---|---|---|',
    classRow('Before', before),
    classRow('After', after),
    '',
    'Per field, before → after:',
    '',
    '| Field | correct | not read | misread | phantom |',
    '|---|---|---|---|---|',
    ...classesByField(before).map(({ field, counts }, i) => {
      const now = classesByField(after)[i]?.counts ?? counts;
      const cell = (name: keyof typeof counts) => (counts[name] === now[name] ? `${now[name]}` : `${counts[name]} → ${now[name]}`);
      return `| ${field} | ${cell('correct')} | ${cell('not read')} | ${cell('misread')} | ${cell('phantom')} |`;
    }),
    '',
  );

  // R3 applies: a figure the engine does not use does not reach it.
  const usedBefore = withoutR3Emptied(before, r3Emptied(b.stored, b.documents, subtotals));
  const usedAfter = withoutR3Emptied(after, r3Emptied(stored, documents, subtotals));
  const misreadsBefore = misreadsReachingEngine(usedBefore);
  const misreadsAfter = misreadsReachingEngine(usedAfter);
  const phantomsBefore = phantomsReachingEngine(usedBefore);
  const phantomsAfter = phantomsReachingEngine(usedAfter);
  const fresh = [...newResults(misreadsBefore, misreadsAfter), ...newResults(phantomsBefore, phantomsAfter)];
  push(
    '### Errors that reach the engine, before and after',
    '',
    'Refusing a token must not let a new error in. Misread and phantom figures in reconciled columns of the drawn filings, less a current `kundefordringer` or `bankinnskudd` that R3 keeps from the engine:',
    '',
    '| | Before | After |',
    '|---|---|---|',
    `| Misread, reaching the engine | ${misreadsBefore.length} | ${misreadsAfter.length} |`,
    `| Phantom, reaching the engine | ${phantomsBefore.length} | ${phantomsAfter.length} |`,
    '',
    'New ones (after, not before):',
    '',
  );
  if (fresh.length === 0) {
    push('None.', '');
  } else {
    push(
      '| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |',
      '|---|---|---|---|---|---|---|---|',
      ...fresh.map(resultRow),
      '',
    );
  }

  const sumBefore = costSumCounts(b.stored);
  const sumAfter = costSumCounts(stored);
  const run = (counts: RunCounts | null, pick: (e: RunEngineTotals) => string): string => {
    if (counts === null) return notYet;
    return counts.engine === null ? 'not counted then' : pick(counts.engine);
  };
  push(
    '### Cost lines that do not sum',
    '',
    'Reconciled columns with positive sum driftsinntekter whose four main cost lines (varekostnad, lønnskostnad, avskrivninger, annen driftskostnad) and sum kostnader are read, nedskrivninger counted as 0 when empty; "under" and "over" are the lines short of the total or above it by more than 5 kr. ' +
      'Under is what R2 keeps from a fingerprint in a current column; over is `negative_unexplained`, as before. The Story 2.1b run\'s come from `pnpm analysis:document-run` (current columns only, with this commit\'s engine). Totals only.',
    '',
    '| Data set | Before | After |',
    '|---|---|---|',
    ...(['current', 'prior'] as const).flatMap((role) => [
      `| Reference set (${ROLE_NAME[role]}): under the total | ${ofEvaluable(sumBefore[role].under, sumBefore[role].evaluable)} | ${ofEvaluable(sumAfter[role].under, sumAfter[role].evaluable)} |`,
      `| Reference set (${ROLE_NAME[role]}): over the total | ${ofEvaluable(sumBefore[role].over, sumBefore[role].evaluable)} | ${ofEvaluable(sumAfter[role].over, sumAfter[role].evaluable)} |`,
    ]),
    `| Story 2.1b run, local data: \`cost_lines_short_of_total\` (R2) | ${run(b.runBefore, (e) => `${e.costLinesShortOfTotal}`)} | ${run(b.runAfter, (e) => `${e.costLinesShortOfTotal}`)} |`,
    `| Story 2.1b run, local data: of those, nedskrivninger empty | ${run(b.runBefore, (e) => `${e.shortWithNedskrivningerEmpty}`)} | ${run(b.runAfter, (e) => `${e.shortWithNedskrivningerEmpty}`)} |`,
    `| Story 2.1b run, local data: \`negative_unexplained\` | ${run(b.runBefore, (e) => `${e.negativeUnexplained}`)} | ${run(b.runAfter, (e) => `${e.negativeUnexplained}`)} |`,
    `| Story 2.1b run, local data: fingerprints, of current columns | ${run(b.runBefore, (e) => `${e.fingerprints} of ${e.columns}`)} | ${run(b.runAfter, (e) => `${e.fingerprints} of ${e.columns}`)} |`,
    '',
  );

  const emptiedBefore = currentAssetsEmptied(b.stored, b.documents, subtotals);
  const emptiedAfter = currentAssetsEmptied(stored, documents, subtotals);
  push(
    '### Current asset lines above the API subtotal (R3)',
    '',
    'Current columns whose `kundefordringer` or `bankinnskudd` is above the API\'s sum omløpsmidler of the same filing + 5 kr: the figure is stored, and the engine does not use it. `salgsinntekt` and `leverandorgjeld` get only R1. Totals only.',
    '',
    '| Data set | Line | Before | After |',
    '|---|---|---|---|',
    `| Reference set | kundefordringer | ${emptiedBefore.kundefordringer} | ${emptiedAfter.kundefordringer} |`,
    `| Reference set | bankinnskudd | ${emptiedBefore.bankinnskudd} | ${emptiedAfter.bankinnskudd} |`,
    `| Story 2.1b run, local data | kundefordringer | ${run(b.runBefore, (e) => `${e.emptiedKundefordringer}`)} | ${run(b.runAfter, (e) => `${e.emptiedKundefordringer}`)} |`,
    `| Story 2.1b run, local data | bankinnskudd | ${run(b.runBefore, (e) => `${e.emptiedBankinnskudd}`)} | ${run(b.runAfter, (e) => `${e.emptiedBankinnskudd}`)} |`,
    '',
  );

  const ref = referenceVarer(b.stored, stored);
  const runVarer = (counts: RunCounts | null, pick: (v: RunVarer) => string): string => {
    if (counts === null) return notYet;
    return counts.varer === null ? `not counted (no \`${VARER_DUMP_FILE}\`)` : pick(counts.varer);
  };
  push(
    '### varer read from the income statement (R4)',
    '',
    'Before R4, the income statement\'s inventory-change row ("… og ferdig tilvirkede varer") was stored as `varer`, negative or positive. The columns whose `varer` the re-read empties or changes are those it was read from, ' +
      `positive values included; for the Story 2.1b run they are counted against \`${VARER_DUMP_FILE}\`, the dump taken after Story 2.5b's re-read. Totals only.`,
    '',
    '| Data set | Emptied by the re-read | Changed by the re-read | Of those, negative before | Negative varer before | Negative varer after |',
    '|---|---|---|---|---|---|',
    ...(['current', 'prior'] as const).flatMap((role) => [
      `| Reference set (${ROLE_NAME[role]}) | ${ref[role].emptied} | ${ref[role].changed} | ${ref[role].emptied_or_changed_negative_before} | ${ref[role].negative_before} | ${ref[role].negative_after} |`,
      `| Story 2.1b run, local data (${ROLE_NAME[role]}) | ${runVarer(b.runAfter, (v) => `${v[role].emptied}`)} | ${runVarer(b.runAfter, (v) => `${v[role].changed}`)} | ${runVarer(b.runAfter, (v) => `${v[role].emptied_or_changed_negative_before}`)} | ${runVarer(b.runBefore, (v) => `${v[role].negative_before}`)} | ${runVarer(b.runAfter, (v) => `${v[role].negative_after}`)} |`,
    ]),
    '',
  );
  return lines;
}

/** The report, with `generated` (YYYY-MM-DD) as its only varying part. */
export function renderReport(inputs: ReportInputs, generated: string): string {
  const { drawn, comparison, before, corrections, laterCorrections, documents, stored, consistency } = inputs;
  const blindChecked = corrections.length - laterCorrections.length;
  const later =
    laterCorrections.length === 0
      ? ''
      : `; ${laterCorrections.length} more ${laterCorrections.length === 1 ? 'was' : 'were'} found later, on prompting, after the Story 2.3b report pointed to ${laterCorrections.length === 1 ? 'it' : 'them'}`;
  const { results, notes } = comparison;
  const inGroup = (g: Group) => results.filter((r) => r.group === g);
  const drawnIn = (g: Group) => drawn.filter((d) => groupOf(d.year) === g);
  const drawnKeys = new Set(drawn.map((d) => `${d.orgnr}/${d.year}`));
  const drawnDocuments = documents.filter((d) => drawnKeys.has(`${d.orgnr}/${d.filingYear}`));
  const drawnColumns = stored.filter((c) => drawnKeys.has(`${c.orgnr}/${c.filingYear}`));
  const headline = misreadsReachingEngine(results);
  const headlineBefore = misreadsReachingEngine(before.results);
  const phantoms = phantomsReachingEngine(results);
  const phantomsBefore = phantomsReachingEngine(before.results);
  const misreadsElsewhereBefore = before.results.filter((r) => r.class === 'misread' && r.columnStatus !== 'reconciled');
  const resultKey = (r: FieldResult) => `${r.orgnr}/${r.filingYear}/${r.role}/${r.field}`;
  const readByKey = new Map(results.map((r) => [resultKey(r), r.readOre]));
  const towardsOcr = corrections.filter((c) => {
    const read = readByKey.get(correctionKey(c));
    return read !== undefined && read !== null && c.newKr !== null && read === c.newKr * ORE_PER_KRONE;
  }).length;
  checkBaselineCoverage(consistency.filings, BASELINE.filings, BASELINE_FAILING);
  const lines: string[] = [];
  const push = (...more: string[]) => lines.push(...more);

  push(
    '# OCR accuracy against the hand-transcribed reference set (SM-2)',
    '',
    `Generated ${generated} by \`scripts/ocr-sm2.ts\` (\`pnpm analysis:sm2\`), with helpers in \`scripts/ocr-sm2-compare.ts\`. ` +
      `Inputs, all committed: \`${REFERENCE_DRAW_FILE}\` and \`${TRANSCRIPTIONS_FILE}\` (the reference set, issue #14) and the corrections log in \`${CORRECTIONS_FILE}\`; ` +
      `\`${SEED_DIR}/document.csv\` and \`${SEED_DIR}/document_column.csv\` (step 1's output, written by \`pnpm ingest --documents analysis/ocr-reference/document-run.json\` and committed by \`pnpm seed:export\`); ` +
      `\`${CONSISTENCY_FILE}\` (generated ${consistency.generated} by \`${consistency.script}\` in step 1's image, ${consistency.tesseract}).`,
    '',
    'This measures step 1 as it is: `read_document` (Tesseract 5.5, `nor` from `tessdata_best`) and Story 2.2\'s reconciliation. ' +
      'It states what was measured and commits to no numeric target (NFR32).',
    '',
    '## The sample',
    '',
    `- ${drawn.length} filings, one per cell of a seeded draw stratified by filing year (2021–2025) and by 2023 revenue band, from every company in the covered industry with positive 2023 revenue (\`analysis/ocr-reference/README.md\`). ` +
      'The sample is the whole industry, not the demo companies and their peers: those 407 companies were excluded before the draw.',
    `- Each filing has two columns (this year, last year), and each column the ${SM2_FIELDS.length} lines \`read_document\` targets. ` +
      'Only the drawn (orgnr, filing year) pairs are compared; the other documents step 1 stored for the same companies are left out.',
    '- Stored øre are compared exactly with the transcribed kroner × 100. A blank cell or a NULL figure is absent, never 0.',
    ...(inputs.seedLacksParts
      ? [
          `- **The committed seed predates Story 2.5b's migration**: it has no columns for ${SM2_PARTS.join(', ')}, so every transcribed part counts as not read in the sections below.`,
        ]
      : []),
    '',
    '## Recent and older filings',
    '',
    `The boundary was set before the comparison was run: **recent** is filing years ${RECENT_FROM}–2025, **older** is 2021–${RECENT_FROM - 1}. ` +
      'The key-figures API holds filings from 2023 on, so only a recent filing\'s current column can be checked against the register.',
    '',
    `- Recent: n = ${drawnIn('recent').length} filings. Older: n = ${drawnIn('older').length} filings.`,
    '- Samples this small carry no conclusion about a difference between the groups. The split is reported, not interpreted.',
    '',
  );

  push(
    '## Headline: misread figures that reach the engine',
    '',
    "A misread figure in a column that nevertheless reconciled. Only a reconciled column's figures reach the engine, so these are wrong figures Peerless would use.",
    '',
    `The transcriptions were corrected after the first measurement: a blind check against the PDFs found ${blindChecked} transcription ${blindChecked === 1 ? 'error' : 'errors'}${later} (\`${CORRECTIONS_FILE}\`, "${CORRECTIONS_HEADING.slice(3)}"). ` +
      'The headline is given against the transcriptions both before and after those corrections; every other section uses the corrected transcriptions.',
    '',
    '| Group | Filings | Before corrections | After corrections |',
    '|---|---|---|---|',
    ...GROUPS.map(
      (g) =>
        `| ${GROUP_NAME[g]} | ${drawnIn(g).length} | ${headlineBefore.filter((r) => r.group === g).length} | ${headline.filter((r) => r.group === g).length} |`,
    ),
    `| All | ${drawn.length} | ${headlineBefore.length} | ${headline.length} |`,
    '',
    `- **Phantoms reach the engine too.** The headline counts misreads only; phantom figures in reconciled columns: ${GROUPS.map((g) => `${GROUP_NAME[g].toLowerCase()} ${phantoms.filter((r) => r.group === g).length}`).join(', ')}, all ${phantoms.length} (after the corrections; ${phantomsBefore.length} before).`,
    `- **Prior columns overcount.** Of the headline cases, ${headlineBefore.filter((r) => r.role === 'prior').length} of ${headlineBefore.length} before and ${headline.filter((r) => r.role === 'prior').length} of ${headline.length} after the corrections are in a last-year column. Story 2.9 uses a last-year column only when that year has no document of its own, so the headline overcounts what reaches the engine by up to those.`,
    `- **How the blind check chose its cells.** It re-read only the cells where OCR and the transcription disagreed in reconciled columns (the ${blindChecked} headline cases of the first measurement), mixed with control cells where they agreed. ${towardsOcr} of the ${corrections.length} corrections set the transcription to the figure OCR read, so every correction moved towards OCR. The ${misreadsElsewhereBefore.length} misread ${misreadsElsewhereBefore.length === 1 ? 'figure' : 'figures'} in columns that did not reconcile ${misreadsElsewhereBefore.length === 1 ? 'was' : 'were'} not re-checked, and neither were the not-read fields.`,
    `- **Transcription error rate.** ${FIRST_CHECK_ERRORS} errors were found by the within-document checks on the transcriptions alone (\`${CORRECTIONS_FILE}\`, "Transcription check") and ${blindChecked} by the blind check${laterCorrections.length === 0 ? '' : `, ${laterCorrections.length} later`}, across ${drawn.length * 2} transcribed columns.`,
    '',
    '### After the corrections',
    '',
  );
  if (headline.length === 0) {
    push('None.', '');
  } else {
    push(
      '| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |',
      '|---|---|---|---|---|---|---|---|',
      ...headline.map(resultRow),
      '',
    );
  }
  push('### Before the corrections', '');
  if (headlineBefore.length === 0) {
    push('None.', '');
  } else {
    push(
      '"Expected" is the transcription as it stood before the corrections.',
      '',
      '| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |',
      '|---|---|---|---|---|---|---|---|',
      ...headlineBefore.map(resultRow),
      '',
    );
  }
  push(
    '### The corrections',
    '',
    `Each was found by the blind check and confirmed against the PDF (\`${CORRECTIONS_FILE}\`), blind except where the table says otherwise: ` +
      'blind-check cell 6 was re-read on prompting, after the build session said its first entry equalled the other column\'s figure, so its correction is not a blind result.',
    '',
    '| Date | Orgnr | Year | Column | Field | Transcribed | Corrected | Blind |',
    '|---|---|---|---|---|---|---|---|',
    ...corrections.map(
      (c) =>
        `| ${c.date} | ${c.orgnr} | ${c.filingYear} | ${ROLE_NAME[c.role]} | ${c.field} | ${kroner(c.oldKr)} | ${kroner(c.newKr)} | ${correctionKey(c) === PROMPTED_RECHECK ? 'no: re-read on prompting' : 'yes'} |`,
    ),
    '',
  );

  push(
    '## Every compared field, by class',
    '',
    '- **correct**: both hold the same figure;',
    '- **not read**: OCR is NULL and the transcription holds a figure;',
    '- **misread**: both hold a figure, and they differ;',
    '- **phantom**: OCR holds a figure and the transcription is blank.',
    '',
    'A field neither holds is not a figure and is not counted. "Recovered exactly" is correct over counted. ' +
      '"Not read" is split by what the transcription holds: a transcribed 0, or a non-zero figure.',
    '',
    CLASS_TABLE_HEADER,
    '|---|---|---|---|---|---|---|---|',
    ...GROUPS.map((g) => classRow(GROUP_NAME[g], inGroup(g))),
    classRow('All', results),
    '',
  );

  const refByGroup = (g: Group | 'all') => {
    const filings = g === 'all' ? drawn.length : drawnIn(g).length;
    const columns = drawnColumns.filter((c) => g === 'all' || groupOf(c.filingYear) === g).map(storedChecked);
    const docs = drawnDocuments.filter((d) => g === 'all' || groupOf(d.filingYear) === g);
    return { filings, d: consistencyDenominators(filings, columns), reconciledFilings: docs.filter((d) => d.status === 'reconciled').length };
  };
  push(
    '## Consistency of the reference filings',
    '',
    'Two definitions, never mixed. **Passing** is the spike baseline\'s: a column is evaluable when c1 (income statement) and c3 (balance) both are, and passes when it is evaluable and no check among c1–c4 fails (5 kr bound). ' +
      '**Reconciled** is Story 2.2\'s `column_status` (c1–c5 and, for this year\'s column, the API comparison). A filing is reconciled when its current column is.',
    '',
    '| Group | Filings | Columns | Evaluable | Passing | Passing / all | Passing / evaluable | Columns reconciled | Filings reconciled |',
    '|---|---|---|---|---|---|---|---|---|',
    ...[...GROUPS, 'all' as const].map((g) => {
      const { filings, d, reconciledFilings } = refByGroup(g);
      return `| ${g === 'all' ? 'All' : GROUP_NAME[g]} | ${filings} | ${d.all} | ${d.evaluable} | ${d.pass} | ${share(d.pass, d.all)} | ${share(d.pass, d.evaluable)} | ${d.reconciled} of ${d.all} | ${reconciledFilings} of ${filings} |`;
    }),
    '',
  );
  const unread = drawnDocuments.filter((d) => d.status !== 'reconciled' && d.status !== 'failed_reconciliation');
  const missingDocs = drawn.filter((d) => !documents.some((doc) => doc.orgnr === d.orgnr && doc.filingYear === d.year));
  if (unread.length > 0 || missingDocs.length > 0) {
    push(
      'Drawn filings with no read columns:',
      '',
      ...unread.map((d) => `- ${d.orgnr}/${d.filingYear}: ${d.status}${d.refusal === null ? '' : ` (${d.refusal})`}`),
      ...missingDocs.map((d) => `- ${d.orgnr}/${d.year}: no stored document`),
      '',
    );
  }
  if (notes.length > 0) {
    push('Column notes:', '', ...notes.map((n) => `- ${n.orgnr}/${n.filingYear}, ${ROLE_NAME[n.role]}: ${n.note}`), '');
  }

  const wrong = mismatches(results);
  push(
    '## Every mismatch',
    '',
    `${wrong.length} fields are not correct. Expected is the transcription, read is step 1's stored figure, both in whole kroner.`,
    '',
  );
  if (wrong.length > 0) {
    push(
      '| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |',
      '|---|---|---|---|---|---|---|---|',
      ...wrong.map(resultRow),
      '',
    );
  }

  // The spike's filings, read again. Each column in exactly one bucket of
  // baselineDiff, under the same predicates as the denominators.
  const generatedFilings = consistency.filings;
  const columns = generatedFilings.flatMap((f) => f.columns);
  const now = consistencyDenominators(generatedFilings.length, columns);
  const diff = baselineDiff(generatedFilings, BASELINE_FAILING);
  const notEvaluableAll = [...diff.failingToNotEvaluable, ...diff.notEvaluable];
  const describeKey = (k: string) => {
    const [o, y, r] = k.split('/');
    return `${o}/${y}, ${r === 'current' ? 'this year' : 'last year'}`;
  };
  const list = <T>(items: readonly T[], show: (item: T) => string) =>
    items.length === 0 ? 'none' : items.map(show).join('; ');
  const withChecks = (item: { key: string; checks: string[] }) => `${describeKey(item.key)} (fails ${item.checks.join(', ')})`;
  const withCause = (item: { key: string; cause: string }) => `${describeKey(item.key)} (${item.cause})`;

  push(
    '## Consistency re-measured on the spike\'s filings',
    '',
    `The baseline is \`analysis/output/ocr-consistency.md\` (Tesseract 5, combined read, 2021–2025): ${BASELINE.filings} generated filings, ${BASELINE.all} columns, ${BASELINE.evaluable} evaluable. ` +
      `That report states only "93 % of 168"; its failure table lists ${BASELINE_FAILING.length} failing 2021–2025 columns, so ${BASELINE.pass} pass. ` +
      '`epics.md` gave the baseline as 156, which matches 93 % of 168 (156,2) rounded down: a count read back from the rounded percentage rather than counted. The failure table gives 157, and 157 is used here.',
    '',
    `Now: the same companies and years (from each company's \`-aar.json\`) read again by \`read_document\` in step 1's image, ${consistency.tesseract}, checks within ${consistency.boundKr} kr. No figure is stored; the spike's old Tesseract output is not reused.`,
    '',
    '| | Filings | Columns | Evaluable | Passing | Passing / all | Passing / evaluable |',
    '|---|---|---|---|---|---|---|',
    `| Baseline (spike, Tesseract 5) | ${BASELINE.filings} | ${BASELINE.all} | ${BASELINE.evaluable} | ${BASELINE.pass} | ${share(BASELINE.pass, BASELINE.all)} | ${share(BASELINE.pass, BASELINE.evaluable)} |`,
    `| Now (\`read_document\`, Tesseract 5.5) | ${generatedFilings.length} | ${now.all} | ${now.evaluable} | ${now.pass} | ${share(now.pass, now.all)} | ${share(now.pass, now.evaluable)} |`,
    '',
    `Story 2.2's \`column_status\` (c1–c5, within the document only: these columns have no API filing at hand, so the API check is not evaluable): ${now.reconciled} of ${now.all} columns reconciled (${share(now.reconciled, now.all)}).`,
    '',
    '### The differences, column by column',
    '',
    'Each column is in exactly one line below, or among the passing columns that were not failing in the baseline. A column is evaluable when c1 and c3 both are; a failing check in a column that is not evaluable does not make it failing.',
    '',
    `- Failing in the baseline, passing now (${diff.fixed.length}): ${list(diff.fixed, describeKey)}.`,
    `- Failing in the baseline and now (${diff.stillFailing.length}): ${list(diff.stillFailing, withChecks)}.`,
    `- Failing in the baseline, not evaluable now (${diff.failingToNotEvaluable.length}): ${list(diff.failingToNotEvaluable, withCause)}.`,
    `- Failing now, not in the baseline's failure table (${diff.newlyFailing.length}): ${list(diff.newlyFailing, withChecks)}.`,
    `- Not evaluable now, not in the baseline's failure table (${diff.notEvaluable.length}): ${list(diff.notEvaluable, withCause)}.`,
    `- Passing now, and not in the baseline's failure table: ${diff.passing}.`,
    '',
    `Why the ${notEvaluableAll.length} columns not evaluable now are not (the baseline report does not list its own non-evaluable columns, so the change cannot be traced column by column):`,
    '',
    '| Cause | Columns |',
    '|---|---|',
    ...NOT_EVALUABLE_CAUSES.map((cause) => `| ${cause} | ${notEvaluableAll.filter((n) => n.cause === cause).length} |`),
    '',
    '"missing total" is c3 not evaluable while c5 is: sum eiendeler, sum egenkapital and sum gjeld were read, so the one figure missing is "Sum egenkapital og gjeld", the fault Story 2.3b takes up. ' +
      '"c1 not evaluable" is a missing income-statement figure; "c3 and c5 not evaluable" a missing sum eiendeler, or the total and another balance figure; "no column" a document that gave none.',
    '',
  );
  push(...renderBeforeAfter(inputs));
  push(...renderBeforeAfter25b(inputs));
  push(...renderBeforeAfter25c(inputs));
  return lines.join('\n');
}

// --- Main --------------------------------------------------------------------------------

export function readInputs(root: string): ReportInputs {
  const read = (relative: string) => readFileSync(path.join(root, ...relative.split('/')), 'utf8');
  const drawn = parseDrawn(JSON.parse(read(REFERENCE_DRAW_FILE)));
  const storedText = read(`${SEED_DIR}/document_column.csv`);
  const stored = parseStoredColumns(storedText);
  const before25bText = read(`${BEFORE_2_5B_DIR}/document_column.csv`);
  const before25bStored = parseStoredColumns(before25bText);
  const after25bFile = path.join(root, ...RUN_COUNTS_AFTER_2_5B_FILE.split('/'));
  const after25cFile = path.join(root, ...RUN_COUNTS_AFTER_2_5C_FILE.split('/'));
  const before25cStored = parseStoredColumns(read(`${BEFORE_2_5C_DIR}/document_column.csv`));
  const transcribed = parseTranscriptions(read(TRANSCRIPTIONS_FILE));
  const corrections = parseCorrections(read(CORRECTIONS_FILE));
  const beforeStored = parseStoredColumns(read(`${BEFORE_2_3B_DIR}/document_column.csv`));
  const transcribedBefore = transcriptionsBefore(transcribed, corrections);
  const suspected = new Set(
    read(BLIND_CHECK_KEY_FILE)
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(';'))
      .filter((cells) => cells[5] === 'yes')
      .map(([, orgnr, year, role, field]) => `${orgnr}/${year}/${role}/${field}`),
  );
  const afterFile = path.join(root, ...RUN_COUNTS_AFTER_FILE.split('/'));
  return {
    drawn,
    comparison: compareReference(drawn, transcribed, stored),
    before: compareReference(drawn, transcribedBefore, stored),
    corrections,
    laterCorrections: corrections.filter((c) => !suspected.has(`${c.orgnr}/${c.filingYear}/${c.role}/${c.field}`)),
    documents: parseStoredDocuments(read(`${SEED_DIR}/document.csv`)),
    stored,
    consistency: parseConsistency(JSON.parse(read(CONSISTENCY_FILE))),
    before23b: {
      comparison: compareReference(drawn, transcribed, beforeStored),
      beforeCorrections: compareReference(drawn, transcribedBefore, beforeStored),
      stored: beforeStored,
      consistency: parseConsistency(JSON.parse(read(`${BEFORE_2_3B_DIR}/ocr-consistency-2026.json`))),
      runBefore: parseRunCounts(JSON.parse(read(RUN_COUNTS_BEFORE_FILE)), RUN_COUNTS_BEFORE_FILE),
      // Written by `pnpm analysis:document-run after-2.3b` once the 2.1b run
      // is re-read; until then the report says "not yet counted".
      runAfter: existsSync(afterFile) ? parseRunCounts(JSON.parse(read(RUN_COUNTS_AFTER_FILE)), RUN_COUNTS_AFTER_FILE) : null,
    },
    before25b: {
      comparison: compareReference(drawn, transcribed, before25bStored),
      stored: before25bStored,
      documents: parseStoredDocuments(read(`${BEFORE_2_5B_DIR}/document.csv`)),
      lacksParts: lacksPartColumns(before25bText),
      runBefore: parseRunCounts(JSON.parse(read(RUN_COUNTS_BEFORE_2_5B_FILE)), RUN_COUNTS_BEFORE_2_5B_FILE),
      // Written by `pnpm analysis:document-run after-2.5b` once the 2.1b rows
      // are re-read; until then the report says "not yet counted".
      runAfter: existsSync(after25bFile) ? parseRunCounts(JSON.parse(read(RUN_COUNTS_AFTER_2_5B_FILE)), RUN_COUNTS_AFTER_2_5B_FILE) : null,
    },
    before25c: {
      comparison: compareReference(drawn, transcribed, before25cStored),
      stored: before25cStored,
      documents: parseStoredDocuments(read(`${BEFORE_2_5C_DIR}/document.csv`)),
      runBefore: parseRunCounts(JSON.parse(read(RUN_COUNTS_BEFORE_2_5C_FILE)), RUN_COUNTS_BEFORE_2_5C_FILE),
      // Written by `pnpm analysis:document-run after-2.5c` once the 2.1b rows
      // are re-read; until then the report says "not yet counted".
      runAfter: existsSync(after25cFile) ? parseRunCounts(JSON.parse(read(RUN_COUNTS_AFTER_2_5C_FILE)), RUN_COUNTS_AFTER_2_5C_FILE) : null,
    },
    seedLacksParts: lacksPartColumns(storedText),
    subtotals: parseKeyFigureSubtotals(read(`${SEED_DIR}/key_figures.csv`)),
  };
}

export function main(root: string, today: string = new Date().toISOString().slice(0, 10)): number {
  try {
    const report = renderReport(readInputs(root), today);
    writeFileSync(path.join(root, ...REPORT_FILE.split('/')), report);
    process.stdout.write(`analysis:sm2: wrote ${REPORT_FILE}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`analysis:sm2: ${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.cwd());
}
