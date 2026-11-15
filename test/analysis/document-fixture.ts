// Synthetic document bases for the analysis tests (Story 3.1b), built
// through the engine's own `documentBasis`, as the server builds them from
// the database row. Every company is synthetic; each line is chosen so a
// figure is a round number that can be redone by hand.
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentBasis,
  type DocumentColumnRow,
  type DocumentField,
  documentBasis,
} from '../../src/engine/document-inputs.ts';

export type Lines = Partial<Record<DocumentField, string | null>>;

/**
 * One reconciled current column: revenue 10 000 000 kr, salgsinntekt and
 * varekostnad + annenDriftskostnad 365 000 kr each, so receivable and payable
 * days are the line in øre / 100 000; bank 1 000 000 kr.
 */
export const BASE_LINES: Readonly<Record<DocumentField, string | null>> = {
  salgsinntekt: '36500000',
  sumDriftsinntekter: '1000000000',
  varekostnad: '16500000',
  lonnskostnad: '600000000',
  avskrivninger: '20000000',
  nedskrivninger: '0',
  annenDriftskostnad: '20000000',
  sumDriftskostnad: '656500000',
  driftsresultat: '343500000',
  nettoFinans: null,
  ordinaertResultatFoerSkattekostnad: null,
  aarsresultat: null,
  sumImmaterielleEiendeler: null,
  sumVarigeDriftsmidler: null,
  varer: null,
  kundefordringer: '5000000',
  bankinnskudd: '100000000',
  sumEiendeler: '300000000',
  sumEgenkapital: null,
  leverandorgjeld: '5000000',
  sumKortsiktigGjeld: null,
  sumGjeld: null,
  sumEgenkapitalGjeld: null,
  forskningOgUtvikling: null,
  konsesjonerPatenter: null,
  goodwill: null,
  utsattSkattefordel: null,
};

function column(lines: Lines): DocumentColumnRow {
  const figures: Record<DocumentField, string | null> = { ...BASE_LINES, ...lines };
  const columns = Object.fromEntries(
    (Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[]).map((field) => [DOCUMENT_FIGURE_COLUMNS[field], figures[field]]),
  );
  return { status: 'reconciled', ...columns } as DocumentColumnRow;
}

/** A listed company whose 2025 document has a reconciled current column (and, if given, a reconciled prior one). */
export function readBasis(lines: Lines = {}, prior: Lines | null = null): DocumentBasis {
  return documentBasis({
    inManifest: true,
    filingYear: 2025,
    document: {
      status: 'reconciled',
      current: column(lines),
      prior: prior === null ? null : column(prior),
      priorApiFailFields: prior === null ? null : [],
    },
    sumOmloepsmidler: 360_000_000n,
  });
}

/** Receivable and payable days `days` each, and operating asset turnover `turnover`. */
export function daysBasis(days: bigint, turnover: bigint, lines: Lines = {}): DocumentBasis {
  return readBasis({
    kundefordringer: (days * 100_000n).toString(),
    leverandorgjeld: (days * 100_000n).toString(),
    sumEiendeler: (100_000_000n + 1_000_000_000n / turnover).toString(),
    ...lines,
  });
}

export const NOT_IN_DATASET: DocumentBasis = { kind: 'not_in_dataset' };
export const FAILED: DocumentBasis = { kind: 'failed_reconciliation', filingYear: 2025 };

// Ten peers: days 10, 20, …, 100; turnover 1, 2, 4, 5, 8, 10, 16, 20, 25, 40.
// Receivable days (lower is better): T = P25 = 32.5. Payable days (higher):
// T = P75 = 77.5. Turnover (higher): T = P75 = 19.
const TURNOVERS = [1n, 2n, 4n, 5n, 8n, 10n, 16n, 20n, 25n, 40n];
export const TEN_PEERS: readonly DocumentBasis[] = TURNOVERS.map((turnover, i) => daysBasis(BigInt(i + 1) * 10n, turnover));
