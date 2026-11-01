// `pnpm analysis:spread`: the within-band spread of the two banded cost
// shares in 62.100 (Story 2.5, D3; FR-13). Cost of goods share and personnel
// cost share select peers only as bands (D1) and are benchmarked within
// their band; this measures whether they still spread inside each band.
// test/fingerprint-spread.test.ts holds the threshold, fixed before this
// script first ran: in every band with n >= 10, IQR >= 2 percentage points.
//
// - Reads the local database as `reader` (READER_DATABASE_URL, from the
//   environment, then .env), read-only: for each 62.100 company with a
//   stored fingerprint, its newest fingerprinted year's current document
//   column. Run after `pnpm derive`.
// - Counts only shares that were read (a point, not an interval): an empty
//   cost line gives no share. Every share, band and range is computed by the
//   engine (src/engine/fingerprint.ts readShare, src/engine/band-spread.ts).
// - Writes analysis/output/fingerprint-spread-62100.{json,md}: aggregates
//   only, n and the interquartile range per band. No company, orgnr or
//   individual share is written or printed. The files hold no date, so the
//   same database gives the same bytes.
//
// The fingerprints rest on the Story 2.1b acceptance run's documents, which
// live only in the local database until Story 5.4, so the output is the
// committed record of the measurement.
//
// Run: node scripts/fingerprint-spread.ts   (from the repository root)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { type BandSpread, bandSpread } from '../src/engine/band-spread.ts';
import { DOCUMENT_FIGURE_COLUMNS, type DocumentColumnRow, documentFigures } from '../src/engine/document-inputs.ts';
import { BANDS, type Band, SPREAD_CATEGORIES, type SpreadCategory, readShare } from '../src/engine/fingerprint.ts';
import { formatPercentagePoints } from '../src/engine/format.ts';
import { setting } from './run-ingest.ts';
import { REPORT_DIR, stableJson } from './seed-format.ts';

export const INDUSTRY = '62.100';
export const SPREAD_JSON = `${REPORT_DIR}/fingerprint-spread-62100.json`;
export const SPREAD_MD = `${REPORT_DIR}/fingerprint-spread-62100.md`;

const FIGURE_SELECT = Object.values(DOCUMENT_FIGURE_COLUMNS)
  .map((column) => `dc.${column}`)
  .join(', ');

// Each 62.100 company's newest fingerprinted year, and that year's current
// column. $1 is the industry code.
export const SPREAD_SQL = `
select dc.status, ${FIGURE_SELECT}
  from register.company c
  join lateral (
        select f.filing_year
          from register.fingerprint f
         where f.orgnr = c.orgnr
         order by f.filing_year desc
         limit 1
       ) newest on true
  join register.document_column dc
    on dc.orgnr = c.orgnr and dc.filing_year = newest.filing_year and dc.role = 'current'
 where c.naeringskode1 = $1::text`;

const LABEL: Readonly<Record<SpreadCategory, string>> = {
  costOfGoods: 'Cost of goods share (varekostnad / sum_driftsinntekter)',
  personnelCost: 'Personnel cost share (lonnskostnad / sum_driftsinntekter)',
};

type BandEntry = { n: number; iqr_pp: string | null };
export type SpreadOutput = {
  industry: string;
  companies: number;
  measure: string;
  categories: Record<SpreadCategory, Record<Band, BandEntry>>;
};

/** Each category's spread per band, from the read shares of the columns. */
export function spreads(columns: readonly DocumentColumnRow[]): Record<SpreadCategory, Record<Band, BandSpread>> {
  const figures = columns.map(documentFigures);
  const result = {} as Record<SpreadCategory, Record<Band, BandSpread>>;
  for (const category of SPREAD_CATEGORIES) {
    result[category] = bandSpread(
      figures.flatMap((f) => {
        const share = readShare(f, category);
        return share === null ? [] : [share];
      }),
    );
  }
  return result;
}

/** The committed JSON: aggregates only. */
export function spreadOutput(companies: number, spread: Record<SpreadCategory, Record<Band, BandSpread>>): SpreadOutput {
  const categories = {} as SpreadOutput['categories'];
  for (const category of SPREAD_CATEGORIES) {
    const bands = {} as Record<Band, BandEntry>;
    for (const band of BANDS) {
      const { n, iqrPercentagePoints } = spread[category][band];
      bands[band] = { n, iqr_pp: iqrPercentagePoints === null ? null : iqrPercentagePoints.toString() };
    }
    categories[category] = bands;
  }
  return {
    industry: INDUSTRY,
    companies,
    measure:
      'interquartile range (PERCENTILE.INC Q3 - Q1) of the read share in each band, in percentage points; shares from empty lines are not counted',
    categories,
  };
}

/** The report: one table per category, percentage points to one decimal. */
export function spreadMarkdown(companies: number, spread: Record<SpreadCategory, Record<Band, BandSpread>>): string {
  const lines = [
    `# Within-band spread, ${INDUSTRY}`,
    '',
    'Story 2.5 (D3; FR-13). Written by `pnpm analysis:spread` (scripts/fingerprint-spread.ts); do not edit.',
    '',
    `Each ${INDUSTRY} company with a stored fingerprint, at its newest fingerprinted year: ${companies} companies. ` +
      'Only shares that were read count; an empty cost line gives no share. ' +
      'The test (test/fingerprint-spread.test.ts) asserts that in every band with n ≥ 10 the interquartile range is at least 2 percentage points; a band below n 10 is reported only.',
    '',
    'The fingerprints rest on the Story 2.1b acceptance run, local data until Story 5.4.',
  ];
  for (const category of SPREAD_CATEGORIES) {
    lines.push('', `## ${LABEL[category]}`, '', '| Band | n | IQR |', '|---|---:|---:|');
    for (const band of BANDS) {
      const { n, iqr } = spread[category][band];
      lines.push(`| ${band} | ${n} | ${iqr === null ? '–' : formatPercentagePoints(iqr.toString())} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export async function main(root: string): Promise<number> {
  const url = setting(root, 'READER_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('analysis:spread: READER_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {}, connection: { default_transaction_read_only: true } });
  try {
    const columns = await sql.unsafe<DocumentColumnRow[]>(SPREAD_SQL, [INDUSTRY]);
    if (columns.length === 0) throw new Error(`no ${INDUSTRY} company has a stored fingerprint; run \`pnpm derive\``);
    const spread = spreads(columns);
    writeFileSync(path.join(root, ...SPREAD_JSON.split('/')), stableJson(spreadOutput(columns.length, spread)));
    writeFileSync(path.join(root, ...SPREAD_MD.split('/')), spreadMarkdown(columns.length, spread));
    process.stdout.write(`analysis:spread: wrote ${SPREAD_JSON} and ${SPREAD_MD} (${columns.length} companies)\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`analysis:spread: ${(error as Error).message}\n`);
    return 1;
  } finally {
    await sql.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd());
}
