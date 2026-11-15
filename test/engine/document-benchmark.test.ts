// The document figures against the peer group (Story 3.1a; FR-24, FR-29):
// the capital kroner of 9, 10 and 11 at full convergence to beste fjerdedel,
// a strength at or beyond it, no amount outside NOK (decision 6), the
// figures with no translation or no direction, and the 10-peer floor.
// Every company here is synthetic, built so that each figure is a whole
// number of days or an exact multiple and each quartile can be redone by
// hand (PERCENTILE.INC over ten peers: rank (n − 1) × p).
import { describe, expect, it } from 'vitest';
import { benchmarkApiFigures, benchmarkDocumentFigures } from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentBasis,
  type DocumentColumnRow,
  type DocumentField,
  documentBasis,
} from '../../src/engine/document-inputs.ts';
import { DOCUMENT_FIGURE_DIRECTIONS } from '../../src/engine/document-key-figures.ts';
import type { ApiInputs } from '../../src/engine/types.ts';

const REVENUE = 1_000_000_000n; // 10 000 000 kr
const BANK = 100_000_000n; // 1 000 000 kr

// salgsinntekt and varekostnad + annenDriftskostnad are each 365 000 kr
// (36 500 000 øre), so receivable and payable days are the line in øre / 100 000.
const FIGURES: Record<DocumentField, string | null> = {
  salgsinntekt: '36500000',
  sumDriftsinntekter: REVENUE.toString(),
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
  kundefordringer: null,
  bankinnskudd: BANK.toString(),
  sumEiendeler: null,
  sumEgenkapital: null,
  leverandorgjeld: null,
  sumKortsiktigGjeld: null,
  sumGjeld: null,
  sumEgenkapitalGjeld: null,
  forskningOgUtvikling: null,
  konsesjonerPatenter: null,
  goodwill: null,
  utsattSkattefordel: null,
};

/**
 * A company with receivable days and payable days `days` each, and
 * operating asset turnover `turnover` (revenue / (sumEiendeler − bank)).
 */
function company(days: bigint, turnover: bigint, overrides: Partial<Record<DocumentField, string | null>> = {}): DocumentBasis {
  const figures: Record<DocumentField, string | null> = {
    ...FIGURES,
    kundefordringer: (days * 100_000n).toString(),
    leverandorgjeld: (days * 100_000n).toString(),
    sumEiendeler: (BANK + REVENUE / turnover).toString(),
    ...overrides,
  };
  const columns = Object.fromEntries(
    (Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[]).map((field) => [DOCUMENT_FIGURE_COLUMNS[field], figures[field]]),
  );
  return documentBasis({
    inManifest: true,
    filingYear: 2025,
    document: { status: 'reconciled', current: { status: 'reconciled', ...columns } as DocumentColumnRow, prior: null, priorApiFailFields: null },
    sumOmloepsmidler: 360_000_000n,
  });
}

// Ten peers: days 10, 20, …, 100; turnover 1, 2, 4, 5, 8, 10, 16, 20, 25, 40.
// Receivable days, lower is better: T = P25 = x[2] + 0.25 × (x[3] − x[2]) = 30 + 2.5 = 32.5.
// Payable days, higher is better: T = P75 = x[6] + 0.75 × (x[7] − x[6]) = 70 + 7.5 = 77.5.
// Turnover, higher is better: T = P75 = 16 + 0.75 × (20 − 16) = 19.
const TURNOVERS = [1n, 2n, 4n, 5n, 8n, 10n, 16n, 20n, 25n, 40n];
const PEERS = TURNOVERS.map((turnover, i) => company(BigInt(i + 1) * 10n, turnover));

describe('capital kroner, 9, 10 and 11', () => {
  it('receivable / payable / turnover capital at full convergence', () => {
    const b = benchmarkDocumentFigures(company(50n, 5n), PEERS, 'NOK');
    // 9: (50 − 32.5) / 365 × 36 500 000 øre = 1 750 000 øre (17 500 kr).
    expect(b.kfd.gap).toEqual({ kind: 'amount', ore: new Decimal('1750000'), oneOff: true });
    // 10: (77.5 − 50) / 365 × 36 500 000 øre = 2 750 000 øre (27 500 kr).
    expect(b.lgd.gap).toEqual({ kind: 'amount', ore: new Decimal('2750000'), oneOff: true });
    // 11: (sumEiendeler − bank) − revenue / T = 200 000 000 − 1 000 000 000 / 19 øre.
    const turnover = b.oml.gap;
    if (turnover.kind !== 'amount') throw new Error(`expected an amount, got ${turnover.kind}`);
    expect(turnover.oneOff).toBe(true);
    expect(turnover.ore.eq(new Decimal(200_000_000).minus(new Decimal(1_000_000_000).div(19)))).toBe(true);
  });

  it('capital kroner outside NOK: not_nok', () => {
    const b = benchmarkDocumentFigures(company(50n, 5n), PEERS, 'USD');
    for (const key of ['kfd', 'lgd', 'oml'] as const) expect(b[key].gap, key).toEqual({ kind: 'not_nok' });
    expect(benchmarkDocumentFigures(company(50n, 5n), PEERS, null).kfd.gap).toEqual({ kind: 'not_nok' });
  });

  it('at or beyond beste fjerdedel: strength', () => {
    // Exactly at T: 32.5 receivable days, 77.5 payable days.
    const at = benchmarkDocumentFigures(company(0n, 20n, { kundefordringer: '3250000', leverandorgjeld: '7750000' }), PEERS, 'NOK');
    expect(at.kfd.gap).toEqual({ kind: 'strength' });
    expect(at.lgd.gap).toEqual({ kind: 'strength' });
    // Beyond T: turnover 20 > 19. A strength in any currency.
    expect(at.oml.gap).toEqual({ kind: 'strength' });
    expect(benchmarkDocumentFigures(company(10n, 40n), PEERS, 'USD').kfd.gap).toEqual({ kind: 'strength' });
  });

  it('turnover target not positive: no amount', () => {
    // Every peer has revenue 0, so turnover 0 and T = 0; the subject's revenue is negative, worse than T.
    const zero = TURNOVERS.map((turnover) => company(10n, turnover, { sumDriftsinntekter: '0' }));
    const b = benchmarkDocumentFigures(company(10n, 5n, { sumDriftsinntekter: '-100000000' }), zero, 'NOK');
    expect(b.oml.comparison).toMatchObject({ kind: 'compared' });
    expect(b.oml.gap).toEqual({ kind: 'none', reason: 'target_not_positive' });
  });

  it('below the floor: no comparison, no kroner', () => {
    const b = benchmarkDocumentFigures(company(50n, 5n), PEERS.slice(0, 9), 'NOK');
    for (const key of ['kfd', 'lgd', 'oml'] as const) {
      expect(b[key].comparison, key).toMatchObject({ kind: 'below_floor', count: 9, absence: { reason: 'below_floor', count: 9 } });
      expect(b[key].gap, key).toEqual({ kind: 'none', reason: 'no_comparison' });
    }
  });
});

describe('figures with no kroner, no direction, or no rank', () => {
  const b = benchmarkDocumentFigures(company(50n, 5n), PEERS, 'NOK');

  it('no kroner without a translation', () => {
    for (const key of ['vare', 'lonn', 'andre', 'total', 'lonnArsverk', 'vekst', 'kontant'] as const) {
      expect(b[key].gap, key).toEqual({ kind: 'none', reason: 'no_translation' });
    }
    // 13, equity ratio, is an API figure.
    const api: ApiInputs = {
      sumDriftsinntekter: 100n,
      driftsresultat: 10n,
      sumDriftskostnad: 90n,
      sumEiendeler: 100n,
      sumEgenkapitalGjeld: 100n,
      sumEgenkapital: 40n,
      sumGjeld: 60n,
    };
    expect(benchmarkApiFigures(api, Array.from({ length: 10 }, () => api), 'NOK').egenkapitalandel.gap.kind).toBe('none');
  });

  it('no direction: median and midtre halvdel only', () => {
    for (const key of ['total', 'kontant'] as const) {
      const comparison = b[key].comparison;
      expect(comparison.kind, key).toBe('compared');
      if (comparison.kind === 'compared') {
        expect(comparison.best, key).toBeNull();
        expect(comparison.median, key).toBeDefined();
        expect(comparison.lowerQuartile.lte(comparison.upperQuartile), key).toBe(true);
      }
    }
    // 8 and 14 have no direction (8 is not read in v1, and growth needs a prior column, which these companies lack).
    expect(DOCUMENT_FIGURE_DIRECTIONS.lonnArsverk).toBe('none');
    expect(DOCUMENT_FIGURE_DIRECTIONS.vekst).toBe('none');
    expect(b.vekst.direction).toBe('none');
  });

  it('kontantandel is never ranked', () => {
    expect(b.kontant.rankable).toBe(false);
    expect(b.kontant.direction).toBe('none');
    const comparison = b.kontant.comparison;
    expect(comparison.kind === 'compared' && comparison.best === null).toBe(true);
    expect(b.kfd.rankable).toBe(true);
  });
});
