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
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Decimal } from '../src/engine/decimal.ts';
import { formatKroner, formatPercent } from '../src/engine/format.ts';
import {
  BASELINE,
  BASELINE_FAILING,
  type CheckResult,
  type CheckedColumn,
  type ClassCounts,
  type Comparison,
  type Correction,
  CORRECTIONS_HEADING,
  FIELD_CLASSES,
  type FieldResult,
  GROUPS,
  type Group,
  ORE_PER_KRONE,
  RECENT_FROM,
  SM2_FIELDS,
  type StoredColumn,
  type StoredDocument,
  compareReference,
  consistencyDenominators,
  countClasses,
  groupOf,
  mismatches,
  misreadsReachingEngine,
  parseCorrections,
  parseStoredColumns,
  parseStoredDocuments,
  parseTranscriptions,
  transcriptionsBefore,
} from './ocr-sm2-compare.ts';
import { type DrawnFiling, REFERENCE_DRAW_FILE, SEED_DIR, compareBytes, parseDrawn } from './seed-format.ts';

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

function classRow(name: string, counts: ClassCounts): string {
  const counted = FIELD_CLASSES.reduce((sum, c) => sum + counts[c], 0);
  return `| ${name} | ${FIELD_CLASSES.map((c) => counts[c]).join(' | ')} | ${counted} | ${share(counts.correct, counted)} |`;
}

function resultRow(r: FieldResult): string {
  return `| ${r.orgnr} | ${r.filingYear} | ${ROLE_NAME[r.role]} | ${r.field} | ${kroner(r.expectedKr)} | ${ore(r.readOre)} | ${r.class} | ${r.columnStatus ?? 'no column'} |`;
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
    `Each was found by the blind check and confirmed against the PDF (\`${CORRECTIONS_FILE}\`).`,
    '',
    '| Date | Orgnr | Year | Column | Field | Transcribed | Corrected |',
    '|---|---|---|---|---|---|---|',
    ...corrections.map(
      (c) =>
        `| ${c.date} | ${c.orgnr} | ${c.filingYear} | ${ROLE_NAME[c.role]} | ${c.field} | ${kroner(c.oldKr)} | ${kroner(c.newKr)} |`,
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
    'A field neither holds is not a figure and is not counted. "Recovered exactly" is correct over counted.',
    '',
    `| Group | ${FIELD_CLASSES.join(' | ')} | Counted | Recovered exactly |`,
    '|---|---|---|---|---|---|---|',
    ...GROUPS.map((g) => classRow(GROUP_NAME[g], countClasses(inGroup(g)))),
    classRow('All', countClasses(results)),
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

  // The spike's filings, read again.
  const generatedFilings = consistency.filings;
  const columns = generatedFilings.flatMap((f) => f.columns);
  const now = consistencyDenominators(generatedFilings.length, columns);
  const key = (f: ConsistencyFiling, role: 'current' | 'prior') => `${f.orgnr}/${f.filingYear}/${role}`;
  const failingNow = new Set<string>();
  const passingNow = new Set<string>();
  for (const f of generatedFilings) {
    for (const c of f.columns) {
      const evaluable = c.c1 !== 'not_evaluable' && c.c3 !== 'not_evaluable';
      const failed = [c.c1, c.c2, c.c3, c.c4].includes('fail');
      if (failed) failingNow.add(key(f, c.role));
      if (evaluable && !failed) passingNow.add(key(f, c.role));
    }
  }
  const baselineFailing = new Set(BASELINE_FAILING);
  const fixed = [...baselineFailing].filter((k) => passingNow.has(k)).sort(compareBytes);
  const stillFailing = [...baselineFailing].filter((k) => failingNow.has(k)).sort(compareBytes);
  const neither = [...baselineFailing].filter((k) => !passingNow.has(k) && !failingNow.has(k)).sort(compareBytes);
  const newlyFailing = [...failingNow].filter((k) => !baselineFailing.has(k)).sort(compareBytes);
  const notEvaluableNow = generatedFilings
    .flatMap((f) => (['current', 'prior'] as const).map((role) => ({ f, role, c: f.columns.find((c) => c.role === role) })))
    .filter(({ c }) => c === undefined || c.c1 === 'not_evaluable' || c.c3 === 'not_evaluable')
    .map(({ f, role, c }) => ({
      key: key(f, role),
      why: c === undefined ? `${f.status}${f.refusal === null ? '' : `, ${f.refusal}`}` : `c1 ${c.c1}, c3 ${c.c3}`,
    }))
    .sort((a, b) => compareBytes(a.key, b.key));
  const totalUnread = columns.filter((c) => c.c3 === 'not_evaluable' && c.c5 !== 'not_evaluable').length;
  const describeKey = (k: string) => {
    const [o, y, r] = k.split('/');
    return `${o}/${y}, ${r === 'current' ? 'this year' : 'last year'}`;
  };

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
    `- Failing in the baseline, passing now (${fixed.length}): ${fixed.length === 0 ? 'none' : fixed.map(describeKey).join('; ')}.`,
    `- Failing in the baseline and now (${stillFailing.length}): ${stillFailing.length === 0 ? 'none' : stillFailing.map(describeKey).join('; ')}.`,
    `- Failing in the baseline, not evaluable now (${neither.length}): ${neither.length === 0 ? 'none' : neither.map(describeKey).join('; ')}.`,
    `- Failing now, not in the baseline's failure table (${newlyFailing.length}): ${newlyFailing.length === 0 ? 'none' : newlyFailing.map(describeKey).join('; ')}.`,
    `- Not evaluable now (${notEvaluableNow.length}): ${notEvaluableNow.length === 0 ? 'none' : notEvaluableNow.map((n) => `${describeKey(n.key)} (${n.why})`).join('; ')}.`,
    '',
    'The baseline report does not list its non-evaluable columns, so a change in the evaluable count cannot be traced column by column; the list above is every column not evaluable now. ' +
      `Of those, ${totalUnread} ha${totalUnread === 1 ? 's' : 've'} c3 not evaluable while c5 is evaluable: sum eiendeler was read, so the figure missing is "Sum egenkapital og gjeld", the fault Story 2.3b takes up.`,
    '',
  );
  return lines.join('\n');
}

// --- Main --------------------------------------------------------------------------------

export function readInputs(root: string): ReportInputs {
  const read = (relative: string) => readFileSync(path.join(root, ...relative.split('/')), 'utf8');
  const drawn = parseDrawn(JSON.parse(read(REFERENCE_DRAW_FILE)));
  const stored = parseStoredColumns(read(`${SEED_DIR}/document_column.csv`));
  const transcribed = parseTranscriptions(read(TRANSCRIPTIONS_FILE));
  const corrections = parseCorrections(read(CORRECTIONS_FILE));
  return {
    drawn,
    comparison: compareReference(drawn, transcribed, stored),
    before: compareReference(drawn, transcriptionsBefore(transcribed, corrections), stored),
    corrections,
    documents: parseStoredDocuments(read(`${SEED_DIR}/document.csv`)),
    stored,
    consistency: parseConsistency(JSON.parse(read(CONSISTENCY_FILE))),
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
