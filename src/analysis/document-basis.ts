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
import { log } from '../logger.ts';

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
  /** The key-figures filing's sum_omloepsmidler, for R3. */
  readonly sum_omloepsmidler_ore: string | null;
} & { readonly [C in FigureColumn as `cur_${C}`]: string | null } & {
  readonly [C in FigureColumn as `pri_${C}`]: string | null;
};

/**
 * The select list for `DocumentBasisColumns`. Needs `c` (register.company),
 * `k` (register.key_figures) and the joins in `DOCUMENT_JOINS`.
 */
export const DOCUMENT_SELECT = [
  `coalesce((select ds.manifest -> 'document_figure_orgnrs' @> to_jsonb(c.orgnr::text) from register.dataset ds), false) as in_manifest`,
  'd.status as document_status',
  'cur.orgnr is not null as has_current',
  'cur.status as current_status',
  'pri.orgnr is not null as has_prior',
  'pri.status as prior_status',
  'k.sum_omloepsmidler_ore',
  ...FIGURE_COLUMNS.map((column) => `cur.${column} as cur_${column}`),
  ...FIGURE_COLUMNS.map((column) => `pri.${column} as pri_${column}`),
].join(',\n       ');

/** The document of the filing year `f.filing_year` and its two columns. Needs `c` and `f`. */
export const DOCUMENT_JOINS = `
  left join register.document d on d.orgnr = c.orgnr and d.filing_year = f.filing_year
  left join register.document_column cur
         on cur.orgnr = d.orgnr and cur.filing_year = d.filing_year and cur.role = 'current'
  left join register.document_column pri
         on pri.orgnr = d.orgnr and pri.filing_year = d.filing_year and pri.role = 'prior'`;

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
          },
    sumOmloepsmidler: parseOre(row.sum_omloepsmidler_ore),
  });
  return basis;
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
