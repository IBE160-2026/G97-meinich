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
//   filings read again by analysis/ocr/consistency.py in step 1's image.
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
  type StoredColumn,
  type StoredDocument,
  baselineDiff,
  checkBaselineCoverage,
  classesByField,
  compareReference,
  consistencyDenominators,
  countClasses,
  countNotRead,
  groupOf,
  mismatches,
  misreadsReachingEngine,
  newResults,
  parseCorrections,
  phantomsReachingEngine,
  parseStoredColumns,
  parseStoredDocuments,
  parseTranscriptions,
  totalReadIn,
  totalShownMissing,
  totalShownRead,
  transcriptionsBefore,
} from './ocr-sm2-compare.ts';
import { type DrawnFiling, REFERENCE_DRAW_FILE, SEED_DIR, parseDrawn } from './seed-format.ts';

export const TRANSCRIPTIONS_FILE = 'analysis/ocr-reference/transcriptions.csv';
export const CORRECTIONS_FILE = 'analysis/ocr-reference/README.md';
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

/** What the report reads from a document-run-counts JSON (scripts/document-run-counts.ts). */
export interface RunCounts {
  documents: number;
  currentColumns: number;
  currentTotalRead: number;
  priorColumns: number;
  priorTotalRead: number;
  currentReconciled: number;
  readerCommits: Record<string, number>;
}

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
  return {
    documents: count(at(documents, 'total', 'documents'), file, 'documents.total'),
    currentColumns: count(at(role('current'), 'columns', 'columns.current'), file, 'columns.current.columns'),
    currentTotalRead: total('current'),
    priorColumns: count(at(role('prior'), 'columns', 'columns.prior'), file, 'columns.prior.columns'),
    priorTotalRead: total('prior'),
    currentReconciled: count(at(at(role('current'), 'status', 'columns.current'), 'reconciled', 'columns.current.status') ?? 0, file, 'columns.current.status.reconciled'),
    readerCommits: Object.fromEntries(Object.entries(commits).map(([k, v]) => [k, count(v, file, `documents.reader_commit.${k}`)])),
  };
}

export interface StoryBInputs {
  /** The corrected transcriptions against Story 2.3's stored columns. */
  comparison: Comparison;
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
  documents: readonly StoredDocument[];
  stored: readonly StoredColumn[];
  consistency: Consistency;
  /** Story 2.3's output, for the section "Before and after Story 2.3b". */
  before23b: StoryBInputs;
}

const ratio = (part: number, whole: number): string => `${part} of ${whole} (${share(part, whole)})`;

/** The section "Before and after Story 2.3b" (the bold balance total). */
export function renderBeforeAfter(inputs: ReportInputs): string[] {
  const { comparison, stored, consistency, before23b: b } = inputs;
  const before = b.comparison.results;
  const after = comparison.results;
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
      `"Before" is Story 2.3's output, copied byte for byte into \`${BEFORE_2_3B_DIR}/\` before any re-read, and \`${RUN_COUNTS_BEFORE_FILE}\`; "after" is the committed seed, \`${CONSISTENCY_FILE}\` and \`${RUN_COUNTS_AFTER_FILE}\`. ` +
      'Both are compared with the corrected transcriptions.',
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
  return lines;
}

/** The report, with `generated` (YYYY-MM-DD) as its only varying part. */
export function renderReport(inputs: ReportInputs, generated: string): string {
  const { drawn, comparison, before, corrections, documents, stored, consistency } = inputs;
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
    `The transcriptions were corrected after the first measurement: a blind check against the PDFs found ${corrections.length} transcription ${corrections.length === 1 ? 'error' : 'errors'} (\`${CORRECTIONS_FILE}\`, "${CORRECTIONS_HEADING.slice(3)}"). ` +
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
    `- **How the blind check chose its cells.** It re-read only the cells where OCR and the transcription disagreed in reconciled columns (the ${headlineBefore.length} headline cases before the corrections), mixed with control cells where they agreed. ${towardsOcr} of the ${corrections.length} corrections set the transcription to the figure OCR read, so every correction moved towards OCR. The ${misreadsElsewhereBefore.length} misread ${misreadsElsewhereBefore.length === 1 ? 'figure' : 'figures'} in columns that did not reconcile ${misreadsElsewhereBefore.length === 1 ? 'was' : 'were'} not re-checked, and neither were the not-read fields.`,
    `- **Transcription error rate.** ${FIRST_CHECK_ERRORS} errors were found by the within-document checks on the transcriptions alone (\`${CORRECTIONS_FILE}\`, "Transcription check") and ${corrections.length} by the blind check, across ${drawn.length * 2} transcribed columns.`,
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
  return lines.join('\n');
}

// --- Main --------------------------------------------------------------------------------

export function readInputs(root: string): ReportInputs {
  const read = (relative: string) => readFileSync(path.join(root, ...relative.split('/')), 'utf8');
  const drawn = parseDrawn(JSON.parse(read(REFERENCE_DRAW_FILE)));
  const stored = parseStoredColumns(read(`${SEED_DIR}/document_column.csv`));
  const transcribed = parseTranscriptions(read(TRANSCRIPTIONS_FILE));
  const corrections = parseCorrections(read(CORRECTIONS_FILE));
  const beforeStored = parseStoredColumns(read(`${BEFORE_2_3B_DIR}/document_column.csv`));
  const afterFile = path.join(root, ...RUN_COUNTS_AFTER_FILE.split('/'));
  return {
    drawn,
    comparison: compareReference(drawn, transcribed, stored),
    before: compareReference(drawn, transcriptionsBefore(transcribed, corrections), stored),
    corrections,
    documents: parseStoredDocuments(read(`${SEED_DIR}/document.csv`)),
    stored,
    consistency: parseConsistency(JSON.parse(read(CONSISTENCY_FILE))),
    before23b: {
      comparison: compareReference(drawn, transcribed, beforeStored),
      stored: beforeStored,
      consistency: parseConsistency(JSON.parse(read(`${BEFORE_2_3B_DIR}/ocr-consistency-2026.json`))),
      runBefore: parseRunCounts(JSON.parse(read(RUN_COUNTS_BEFORE_FILE)), RUN_COUNTS_BEFORE_FILE),
      // Written by `pnpm analysis:document-run after-2.3b` once the 2.1b run
      // is re-read; until then the report says "not yet counted".
      runAfter: existsSync(afterFile) ? parseRunCounts(JSON.parse(read(RUN_COUNTS_AFTER_FILE)), RUN_COUNTS_AFTER_FILE) : null,
    },
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
