// Story 5.4 review: the committed seed's documents read as the server reads
// them (src/analysis/document-basis.ts), from the seed CSVs, so the specs
// can compute the engine's document benchmark and margin waterfall for a
// demo company on the committed seed, and the read dates of its peers'
// documents (FR-64) without the app's own date code. Companies outside the
// demo data have no rows here; the manifest's list decides, as on the
// server.
import { benchmarkDocumentFigures, type DocumentBenchmark } from '../src/engine/benchmark.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentBasis,
  type DocumentColumnRow,
  type DocumentField,
  documentBasis,
} from '../src/engine/document-inputs.ts';
import { marginWaterfall, type MarginWaterfall } from '../src/engine/waterfall.ts';
import type { SizeBand } from '../src/engine/peers.ts';
import { csv, documentFigureOrgnrs, expectedGroup, keyFigures, newestFiling, ore, orNull, timestamp } from './seed.ts';

const documents = new Map(csv('document.csv').map((d) => [`${d.orgnr}/${d.filing_year}`, d]));
const columns = new Map(csv('document_column.csv').map((c) => [`${c.orgnr}/${c.filing_year}/${c.role}`, c]));

/** A text[] as COPY writes it ("{a,b}"), or null when empty. */
function textArray(text: string | undefined): string[] | null {
  if (text === undefined || text === '') return null;
  const inner = text.replace(/^\{/, '').replace(/\}$/, '');
  return inner === '' ? [] : inner.split(',');
}

function columnRow(row: Record<string, string>): DocumentColumnRow {
  const figures = Object.fromEntries(Object.values(DOCUMENT_FIGURE_COLUMNS).map((name) => [name, orNull(row[name])]));
  return { status: orNull(row.status), ...figures } as DocumentColumnRow;
}

/** A company's document basis for `filingYear`, as `documentBasisOf` builds it from the database row. */
export function seedDocumentBasis(orgnr: string, filingYear: number): DocumentBasis {
  const document = documents.get(`${orgnr}/${filingYear}`);
  const current = columns.get(`${orgnr}/${filingYear}/current`);
  const prior = columns.get(`${orgnr}/${filingYear}/prior`);
  return documentBasis({
    inManifest: documentFigureOrgnrs.has(orgnr),
    filingYear,
    document:
      document === undefined
        ? null
        : {
            status: document.status ?? '',
            current: current === undefined ? null : columnRow(current),
            prior: prior === undefined ? null : columnRow(prior),
            priorApiFailFields: prior === undefined ? null : textArray(prior.api_fail_fields),
          },
    // The key-figures filing the document belongs to (DOCUMENT_FILING_JOIN).
    sumOmloepsmidler: ore(keyFigures.get(document?.brreg_id ?? '')?.sum_omloepsmidler_ore),
  });
}

/** When step 1 read the company's document for `filingYear`, or null without one. */
export function seedDocumentReadAt(orgnr: string, filingYear: number): Date | null {
  const text = documents.get(`${orgnr}/${filingYear}`)?.read_at;
  return text === undefined || text === '' ? null : timestamp(text);
}

/** The subject's and its shown peers' document bases at `band`, less `ekskl`. */
function bases(orgnr: string, band: SizeBand, ekskl: readonly string[]) {
  const year = Number(newestFiling(orgnr).filing_year);
  const peers = expectedGroup(orgnr, band).filter((peer) => !ekskl.includes(peer.orgnr));
  return { year, subject: seedDocumentBasis(orgnr, year), peers, peerBases: peers.map((peer) => seedDocumentBasis(peer.orgnr, year)) };
}

/** The engine's twelve document figures for the subject against its shown group, on the committed seed. */
export function expectedDocumentBenchmark(orgnr: string, band: SizeBand, ekskl: readonly string[] = []): DocumentBenchmark {
  const { subject, peerBases } = bases(orgnr, band, ekskl);
  return benchmarkDocumentFigures(subject, peerBases, orNull(newestFiling(orgnr).valuta));
}

/** The engine's margin waterfall for the subject against its shown group, on the committed seed. */
export function expectedWaterfall(orgnr: string, band: SizeBand, ekskl: readonly string[] = []): MarginWaterfall {
  const { year, subject, peerBases } = bases(orgnr, band, ekskl);
  return marginWaterfall(subject, peerBases, year, orNull(newestFiling(orgnr).valuta));
}

/** The shown peers' orgnrs, each with its document basis, at `band` less `ekskl`. */
export function peerDocumentBases(orgnr: string, band: SizeBand, ekskl: readonly string[] = []) {
  const { peers, peerBases, year } = bases(orgnr, band, ekskl);
  return { year, peers: peers.map((peer, i) => ({ orgnr: peer.orgnr, basis: peerBases[i] as DocumentBasis })) };
}

/** Every document line in øre of `orgnr`'s stored columns for `filingYear`, as digit strings. */
export function documentLines(orgnr: string, filingYear: number): string[] {
  return (['current', 'prior'] as const).flatMap((role) => {
    const row = columns.get(`${orgnr}/${filingYear}/${role}`);
    if (row === undefined) return [];
    return (Object.values(DOCUMENT_FIGURE_COLUMNS) as string[]).flatMap((name) => {
      const value = orNull(row[name]);
      return value === null ? [] : [value];
    });
  });
}

export type { DocumentField };
