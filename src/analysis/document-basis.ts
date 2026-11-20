// The document basis of one company as the analysis reads it (Story 2.9):
// the columns SUBJECT_SQL and CANDIDATES_SQL (src/server/analysis.ts) select
// for the benchmark filing's document, turned into the engine's input, and
// the engine's `documentBasis` decided from them. Pure: the reads in
// src/server/analysis.ts log (`logSubjectRead`, `logCandidatesRead`): one
// `analysis.documentMissing` for a subject read whose subject is listed with
// no stored document, one per candidate read when any candidate is, and one
// `analysis.datasetMissing` for a subject read with no loaded dataset, when
// every company is outside the dataset. No orgnr is logged (an orgnr looked
// up is visitor activity; src/logger.ts).
//
// The SQL fragments live here, next to the row type they fill, so the two
// queries select the same columns under the same names.
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentBasis,
  type DocumentColumnRow,
  type DocumentField,
  documentBasis,
} from '../engine/document-inputs.ts';
import { parseOre } from '../engine/inputs.ts';
import { CHECKS, type CheckResult, type CurrentReconciliation, type StoredDocumentFacts } from '../engine/provenance.ts';
import { log } from '../logger.ts';
import { DOCUMENT_FILING_JOIN } from './document-filing.ts';

type FigureColumn = (typeof DOCUMENT_FIGURE_COLUMNS)[DocumentField];

const FIGURE_COLUMNS = Object.values(DOCUMENT_FIGURE_COLUMNS) as FigureColumn[];

/** The document columns of one company's row, as postgres.js returns them (`bigint` as a string). */
export type DocumentBasisColumns = {
  /** The orgnr is on `register.dataset.manifest->'document_figure_orgnrs'`. */
  readonly in_manifest: boolean;
  /** `register.document.status`, or null when there is no document row for the filing year. */
  readonly document_status: string | null;
  readonly has_current: boolean;
  readonly current_status: string | null;
  readonly has_prior: boolean;
  readonly prior_status: string | null;
  /**
   * The prior column's stored `api_fail_fields` (a text[]), whatever its
   * status: NULL when the column's status is NULL, null when there is no
   * prior column; an empty list means no figure failed or none could be
   * checked.
   */
  readonly prior_api_fail_fields: readonly string[] | null;
  /** sum_omloepsmidler of the key-figures filing the document belongs to (`DOCUMENT_FILING_JOIN`), for R3. */
  readonly sum_omloepsmidler_ore: string | null;
  /** `register.document.read_at` (Story 3.7: the drill-down's data date); null without a document row. */
  readonly document_read_at: Date | null;
  /** The current column's stored checks c1–c5 and its API comparison (Story 3.7: the data-quality line). */
  readonly current_c1: string | null;
  readonly current_c2: string | null;
  readonly current_c3: string | null;
  readonly current_c4: string | null;
  readonly current_c5: string | null;
  readonly current_api_check: string | null;
  readonly current_api_fail_fields: readonly string[] | null;
} & { readonly [C in FigureColumn as `cur_${C}`]: string | null } & {
  readonly [C in FigureColumn as `pri_${C}`]: string | null;
};

/**
 * The select list for `DocumentBasisColumns`. Needs `c` (register.company)
 * and the joins in `DOCUMENT_JOINS`.
 */
export const DOCUMENT_SELECT = [
  `coalesce((select ds.manifest -> 'document_figure_orgnrs' @> to_jsonb(c.orgnr::text) from register.dataset ds), false) as in_manifest`,
  'd.status as document_status',
  'cur.orgnr is not null as has_current',
  'cur.status as current_status',
  'pri.orgnr is not null as has_prior',
  'pri.status as prior_status',
  'pri.api_fail_fields as prior_api_fail_fields',
  'dk.sum_omloepsmidler_ore',
  'd.read_at as document_read_at',
  ...CHECKS.map((check) => `cur.${check} as current_${check}`),
  'cur.api_check as current_api_check',
  'cur.api_fail_fields as current_api_fail_fields',
  ...FIGURE_COLUMNS.map((column) => `cur.${column} as cur_${column}`),
  ...FIGURE_COLUMNS.map((column) => `pri.${column} as pri_${column}`),
].join(',\n       ');

/**
 * The document of the filing year `f.filing_year`, its two columns, and the
 * key-figures filing it belongs to (`dk`, B2). Needs `c` and `f`.
 */
export const DOCUMENT_JOINS = `
  left join register.document d on d.orgnr = c.orgnr and d.filing_year = f.filing_year
  left join register.document_column cur
         on cur.orgnr = d.orgnr and cur.filing_year = d.filing_year and cur.role = 'current'
  left join register.document_column pri
         on pri.orgnr = d.orgnr and pri.filing_year = d.filing_year and pri.role = 'prior'
  ${DOCUMENT_FILING_JOIN}`;

function column(row: DocumentBasisColumns, prefix: 'cur_' | 'pri_', status: string | null): DocumentColumnRow {
  const figures = Object.fromEntries(
    FIGURE_COLUMNS.map((name) => [name, row[`${prefix}${name}` as keyof DocumentBasisColumns] as string | null]),
  );
  return { status, ...figures } as DocumentColumnRow;
}

/** The company's document basis for `filingYear`, its benchmark filing's year. */
export function documentBasisOf(row: DocumentBasisColumns, filingYear: number): DocumentBasis {
  const basis = documentBasis({
    inManifest: row.in_manifest,
    filingYear,
    document:
      row.document_status === null
        ? null
        : {
            status: row.document_status,
            current: row.has_current ? column(row, 'cur_', row.current_status) : null,
            prior: row.has_prior ? column(row, 'pri_', row.prior_status) : null,
            priorApiFailFields: row.prior_api_fail_fields,
          },
    sumOmloepsmidler: parseOre(row.sum_omloepsmidler_ore),
  });
  return basis;
}

/** A stored check result, or null; any other value is not one and throws. */
function checkResult(value: string | null): CheckResult | null {
  if (value === null || value === 'pass' || value === 'fail' || value === 'not_evaluable') return value;
  throw new TypeError(`not a check result: ${JSON.stringify(value)}`);
}

/**
 * What the drill-down reads about the subject's document beyond its basis
 * (Story 3.7): when it was read, and its current column's stored checks and
 * figures. Server only: none of it reaches the page except through the
 * drill-down's strings.
 */
export function documentFactsOf(row: DocumentBasisColumns): StoredDocumentFacts {
  const current: CurrentReconciliation | null = row.has_current
    ? {
        checks: {
          c1: checkResult(row.current_c1),
          c2: checkResult(row.current_c2),
          c3: checkResult(row.current_c3),
          c4: checkResult(row.current_c4),
          c5: checkResult(row.current_c5),
        },
        apiCheck: checkResult(row.current_api_check),
        apiFailFields: row.current_api_fail_fields,
        figures: column(row, 'cur_', row.current_status),
      }
    : null;
  return { readAt: row.document_read_at, current };
}

/**
 * The warnings of one subject read: no `register.dataset` row (every
 * company is then outside the dataset), and a subject listed with no stored
 * document. At most one line each.
 */
export function logSubjectRead(datasetLoaded: boolean, basis: DocumentBasis | null): void {
  if (!datasetLoaded) log('warn', 'analysis.datasetMissing');
  if (basis?.kind === 'document_missing') log('warn', 'analysis.documentMissing');
}

/** The warning of one candidate read: one line when any candidate is listed with no stored document. */
export function logCandidatesRead(bases: readonly DocumentBasis[]): void {
  if (bases.some((basis) => basis.kind === 'document_missing')) log('warn', 'analysis.documentMissing');
}
