// The business-model fingerprint (Story 2.5; FR-10, FR-13): every row of the
// spec's I/O matrix the engine decides. Synthetic figures only, in øre; no
// stored company's fingerprint appears here.
import { describe, expect, it } from 'vitest';
import { digest } from '../../src/engine/digest.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentColumnRow,
  type DocumentField,
  documentFigures,
  guardCurrentAssets,
} from '../../src/engine/document-inputs.ts';
import {
  BAND_EDGES,
  BUSINESS_TYPES,
  INTANGIBLES_SHARE,
  type ApiSubtotals,
  type BandRange,
  type Fingerprint,
  apiSubtotalsFromRow,
  businessType,
  fingerprintColumns,
  fingerprintFromColumns,
  fingerprintOf,
  readShare,
} from '../../src/engine/fingerprint.ts';

// Revenue 10 000 000 kr in øre: 1 % of it is 10 000 000 øre.
const R = 1_000_000_000n;
const pct = (percent: number): bigint => (R * BigInt(percent * 100)) / 10_000n;

type Figures = Partial<Record<DocumentField, bigint | null>>;

// A consistent column: every cost line read and summing to sumDriftskostnad,
// every asset line read. Each test overrides what it is about.
const BASE: Record<DocumentField, bigint | null> = {
  salgsinntekt: R,
  sumDriftsinntekter: R,
  varekostnad: 0n,
  lonnskostnad: pct(50),
  avskrivninger: pct(2),
  nedskrivninger: 0n,
  annenDriftskostnad: pct(38),
  sumDriftskostnad: pct(90),
  driftsresultat: pct(10),
  nettoFinans: 0n,
  ordinaertResultatFoerSkattekostnad: pct(10),
  aarsresultat: pct(8),
  sumImmaterielleEiendeler: 0n,
  sumVarigeDriftsmidler: pct(2),
  varer: 0n,
  kundefordringer: pct(15),
  bankinnskudd: pct(20),
  sumEiendeler: pct(40),
  sumEgenkapital: pct(20),
  leverandorgjeld: pct(5),
  sumKortsiktigGjeld: pct(20),
  sumGjeld: pct(20),
  sumEgenkapitalGjeld: pct(40),
  // The parts of intangible assets (Story 2.5b): stored, never read by the fingerprint.
  forskningOgUtvikling: 0n,
  konsesjonerPatenter: 0n,
  goodwill: 0n,
  utsattSkattefordel: 0n,
};

// The API subtotals of the same filing, consistent with BASE.
const SUBTOTALS: ApiSubtotals = { sumAnleggsmidler: pct(5), sumOmloepsmidler: pct(35) };

function row(status: string | null, figures: Figures): DocumentColumnRow {
  const all = { ...BASE, ...figures };
  const columns = Object.fromEntries(
    (Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[]).map((field) => {
      const value = all[field];
      return [DOCUMENT_FIGURE_COLUMNS[field], value === null ? null : value.toString()];
    }),
  );
  return { status, ...columns } as DocumentColumnRow;
}

function fp(figures: Figures, subtotals: Partial<ApiSubtotals> = {}) {
  return fingerprintOf(documentFigures(row('reconciled', figures)), { ...SUBTOTALS, ...subtotals });
}

function fingerprint(figures: Figures, subtotals: Partial<ApiSubtotals> = {}): Fingerprint {
  const result = fp(figures, subtotals);
  if (result.kind !== 'fingerprint') throw new Error(`expected a fingerprint, got skip ${result.reason}`);
  return result.fingerprint;
}

const known = (band: BandRange['lo']): BandRange => ({ lo: band, hi: band });

describe('three kinds of business in one industry code', () => {
  it('a reseller, a product company and a consultancy derive three types', () => {
    // Resells hardware: cost of goods 65 %, stock on hand.
    const reseller = fingerprint({
      varekostnad: pct(65),
      lonnskostnad: pct(15),
      annenDriftskostnad: pct(10),
      sumDriftskostnad: pct(92),
      varer: pct(8),
      kundefordringer: pct(12),
      sumEiendeler: pct(45),
    }, { sumOmloepsmidler: pct(40) });
    // Sells its own software: capitalised development, low cost of goods.
    const product = fingerprint({
      varekostnad: pct(3),
      lonnskostnad: pct(45),
      annenDriftskostnad: pct(32),
      sumDriftskostnad: pct(82),
      sumImmaterielleEiendeler: pct(25),
      sumEiendeler: pct(65),
    }, { sumAnleggsmidler: pct(27) });
    // Sells its staff's hours: personnel cost 70 %, nothing capitalised.
    const consultancy = fingerprint({
      varekostnad: 0n,
      lonnskostnad: pct(70),
      annenDriftskostnad: pct(18),
      sumDriftskostnad: pct(90),
    });

    expect(reseller).toEqual({
      costOfGoods: known('high'),
      personnelCost: known('low'),
      assetIntensity: known('low'),
      inventory: true,
      capitalisedIntangibles: false,
    });
    expect(businessType(reseller)).toBe('forhandler');
    expect(businessType(product)).toBe('produkt');
    expect(product.capitalisedIntangibles).toBe(true);
    expect(businessType(consultancy)).toBe('konsulent');
    expect(consultancy.personnelCost).toEqual(known('high'));
  });

  it('fixes the type set', () => {
    expect([...BUSINESS_TYPES]).toEqual(['produkt', 'konsulent', 'forhandler', 'annet']);
  });
});

describe('bands', () => {
  it('defines the edges as exact decimals (D1)', () => {
    const edges = Object.fromEntries(
      Object.entries(BAND_EDGES).map(([category, e]) => [category, [e.mid.toString(), e.high.toString()]]),
    );
    expect(edges).toEqual({
      costOfGoods: ['0.1', '0.4'],
      personnelCost: ['0.3', '0.6'],
      assetIntensity: ['0.1', '0.5'],
    });
    expect(INTANGIBLES_SHARE.toString()).toBe('0.05');
  });

  // Each edge exactly, and one øre below it. The cost lines move with
  // sumDriftskostnad so U stays 0.
  it.each([
    ['cost of goods', 'costOfGoods', 'varekostnad', 10, 'low', 'mid'],
    ['cost of goods', 'costOfGoods', 'varekostnad', 40, 'mid', 'high'],
    ['personnel cost', 'personnelCost', 'lonnskostnad', 30, 'low', 'mid'],
    ['personnel cost', 'personnelCost', 'lonnskostnad', 60, 'mid', 'high'],
  ] as const)('band edges are inclusive below: %s at %i %%', (_label, category, line, edge, belowBand, atBand) => {
    const others = { varekostnad: 0n, lonnskostnad: 0n, avskrivninger: 0n, nedskrivninger: 0n, annenDriftskostnad: 0n };
    const at = fingerprint({ ...others, [line]: pct(edge), sumDriftskostnad: pct(edge) });
    const justBelow = fingerprint({ ...others, [line]: pct(edge) - 1n, sumDriftskostnad: pct(edge) - 1n });
    expect(at[category]).toEqual(known(atBand));
    expect(justBelow[category]).toEqual(known(belowBand));
  });

  it.each([
    [10, 'low', 'mid'],
    [50, 'mid', 'high'],
  ] as const)('band edges are inclusive below: asset intensity at %i %%', (edge, belowBand, atBand) => {
    const at = fingerprint({ sumVarigeDriftsmidler: pct(edge), sumEiendeler: pct(edge + 40) });
    const justBelow = fingerprint({ sumVarigeDriftsmidler: pct(edge) - 1n, sumEiendeler: pct(edge + 40) });
    expect(at.assetIntensity).toEqual(known(atBand));
    expect(justBelow.assetIntensity).toEqual(known(belowBand));
  });

  it('band edges are inclusive below: intangibles at exactly 5 % are capitalised, one øre less are not', () => {
    expect(fingerprint({ sumImmaterielleEiendeler: pct(5) }).capitalisedIntangibles).toBe(true);
    expect(fingerprint({ sumImmaterielleEiendeler: pct(5) - 1n }).capitalisedIntangibles).toBe(false);
  });

  it('compares edges exactly, not as floats: revenue 3 øre, varekostnad 1.2 øre would be 40 %', () => {
    // 0.4 × 3 = 1.2 exactly; 1 øre is below it, 2 øre above.
    const tiny = { sumDriftsinntekter: 3n, lonnskostnad: 0n, avskrivninger: 0n, annenDriftskostnad: 0n };
    expect(fingerprint({ ...tiny, varekostnad: 1n, sumDriftskostnad: 1n }).costOfGoods).toEqual(known('mid'));
    expect(fingerprint({ ...tiny, varekostnad: 2n, sumDriftskostnad: 2n }).costOfGoods).toEqual(known('high'));
  });

  it('puts a negative cost line in the low band', () => {
    expect(fingerprint({ varekostnad: -pct(1), annenDriftskostnad: pct(39) }).costOfGoods).toEqual(known('low'));
  });

  it('reads inventory as varer > 0: zero and negative are none', () => {
    expect(fingerprint({ varer: 1n }).inventory).toBe(true);
    expect(fingerprint({ varer: 0n }).inventory).toBe(false);
    expect(fingerprint({ varer: -1n }).inventory).toBe(false);
  });
});

describe('an empty cost line lies in [0, U] (D2)', () => {
  it('an empty line whose interval fits one band is known', () => {
    // U = 90 % − (0 + 2 + 0 + 70) % read = 18 % < 30 %: personnel cost is low.
    const result = fingerprint({ lonnskostnad: null, annenDriftskostnad: pct(70) });
    expect(result.personnelCost).toEqual(known('low'));
  });

  it('an empty line spanning bands is unknown', () => {
    // U = 90 % − 40 % read = 50 %: [0, 50 %] spans low and mid.
    expect(fingerprint({ lonnskostnad: null }).personnelCost).toEqual({ lo: 'low', hi: 'mid' });
    // U = 90 % − 2 % = 88 %: low to high.
    expect(fingerprint({ lonnskostnad: null, annenDriftskostnad: 0n }).personnelCost).toEqual({ lo: 'low', hi: 'high' });
  });

  it('an empty line with U on an edge reaches the band above', () => {
    // U = 30 % exactly: [0, 30 %] reaches mid.
    expect(fingerprint({ lonnskostnad: null, annenDriftskostnad: pct(58) }).personnelCost).toEqual({ lo: 'low', hi: 'mid' });
  });

  it('an empty sumDriftskostnad leaves U unbounded', () => {
    expect(fingerprint({ lonnskostnad: null, sumDriftskostnad: null }).personnelCost).toEqual({ lo: 'low', hi: 'high' });
    // A read line is still a point.
    expect(fingerprint({ sumDriftskostnad: null }).personnelCost).toEqual(known('mid'));
  });

  it('two empty lines each get the whole U', () => {
    const result = fingerprint({ varekostnad: null, lonnskostnad: null, annenDriftskostnad: pct(83) });
    // U = 90 − 85 = 5 %: both low.
    expect(result.costOfGoods).toEqual(known('low'));
    expect(result.personnelCost).toEqual(known('low'));
  });

  it('negative unexplained gives no fingerprint', () => {
    // Read lines 0 + 50 + 2 + 0 + 38 = 90 % against a stated 89 %.
    expect(fp({ sumDriftskostnad: pct(89) })).toEqual({ kind: 'skip', reason: 'negative_unexplained' });
    // One øre beyond the 5 kr rounding is enough.
    expect(fp({ sumDriftskostnad: pct(90) - 501n })).toEqual({ kind: 'skip', reason: 'negative_unexplained' });
    // Equal is U = 0, not negative.
    expect(fp({ sumDriftskostnad: pct(90) }).kind).toBe('fingerprint');
  });

  // Spec Change Log (Meinich, 2026-11-01): the register's rounding.
  it('a negative unexplained cost of exactly −5 kr counts as 0, and −5.01 kr gives no fingerprint', () => {
    // lonnskostnad empty; the read lines (0 + 2 + 0 + 88 %) exceed the stated 90 % by 5 kr.
    const atBound = fp({ lonnskostnad: null, annenDriftskostnad: pct(88), sumDriftskostnad: pct(90) - 500n });
    if (atBound.kind !== 'fingerprint') throw new Error(`expected a fingerprint, got skip ${atBound.reason}`);
    // U = 0, so the empty line lies in [0, 0]: personnel cost is known low.
    expect(atBound.fingerprint.personnelCost).toEqual(known('low'));
    expect(fp({ lonnskostnad: null, annenDriftskostnad: pct(88), sumDriftskostnad: pct(90) - 501n })).toEqual({
      kind: 'skip',
      reason: 'negative_unexplained',
    });
  });
});

// R2 (Story 2.5c; Meinich 2026-11-06): read cost lines that fall short of
// the total hold a misread line, so there is no fingerprint.
describe('the cost lines short of the total (R2)', () => {
  it('cost lines short of the total: four main lines read, nedskrivninger NULL, 500 kr under', () => {
    // 0 + 50 + 2 + 38 % = 90 % read; the stated total is 500 kr (50 000 øre) more.
    expect(fp({ nedskrivninger: null, sumDriftskostnad: pct(90) + 50_000n })).toEqual({
      kind: 'skip',
      reason: 'cost_lines_short_of_total',
    });
    // nedskrivninger read: the same.
    expect(fp({ sumDriftskostnad: pct(90) + 50_000n })).toEqual({ kind: 'skip', reason: 'cost_lines_short_of_total' });
    // A printed write-down the read missed (the probe's 1 649 988 kr) is the cost of the rule.
    expect(fp({ nedskrivninger: null, sumDriftskostnad: pct(90) + 164_998_800n })).toEqual({
      kind: 'skip',
      reason: 'cost_lines_short_of_total',
    });
  });

  it('cost lines short of the total: within 5 kr is the register rounding, and gives a fingerprint', () => {
    expect(fp({ nedskrivninger: null, sumDriftskostnad: pct(90) + 500n }).kind).toBe('fingerprint');
    expect(fp({ sumDriftskostnad: pct(90) + 500n }).kind).toBe('fingerprint');
    expect(fp({ nedskrivninger: null, sumDriftskostnad: pct(90) + 501n })).toEqual({
      kind: 'skip',
      reason: 'cost_lines_short_of_total',
    });
  });

  it('a main line empty keeps the interval rule', () => {
    for (const line of ['varekostnad', 'lonnskostnad', 'avskrivninger', 'annenDriftskostnad'] as const) {
      // The rest under the total: the empty line lies in [0, U], as before Story 2.5c.
      const result = fp({ [line]: null, sumDriftskostnad: pct(95) });
      expect(result.kind, line).toBe('fingerprint');
    }
    // U = 95 − 40 % read = 55 %: personnel cost spans low to mid.
    expect(fingerprint({ lonnskostnad: null, sumDriftskostnad: pct(95) }).personnelCost).toEqual({ lo: 'low', hi: 'mid' });
  });

  it('lines over the total stay negative_unexplained', () => {
    expect(fp({ nedskrivninger: null, sumDriftskostnad: pct(90) - 501n })).toEqual({ kind: 'skip', reason: 'negative_unexplained' });
  });

  it('an empty total leaves the rule out', () => {
    expect(fp({ sumDriftskostnad: null }).kind).toBe('fingerprint');
  });
});

describe('an empty balance line is bounded by its API subtotal (D2)', () => {
  it('anleggsmidler bounds an empty intangibles line', () => {
    // sum_anleggsmidler 6 % − fixed assets 2 % read = 4 % < 5 %: not capitalised,
    // although sum_eiendeler (40 %) alone would leave it unknown.
    expect(fingerprint({ sumImmaterielleEiendeler: null }, { sumAnleggsmidler: pct(6) }).capitalisedIntangibles).toBe(false);
    // 8 % − 2 % = 6 %: [0, 6 %] could be either.
    expect(fingerprint({ sumImmaterielleEiendeler: null }, { sumAnleggsmidler: pct(8) }).capitalisedIntangibles).toBeNull();
  });

  it('anleggsmidler bounds an empty fixed-assets line', () => {
    // 6 % − intangibles 0 read = 6 %: [0, 6 %] is low (< 10 %).
    expect(fingerprint({ sumVarigeDriftsmidler: null }, { sumAnleggsmidler: pct(6) }).assetIntensity).toEqual(known('low'));
    // Both empty: each is bounded by the whole subtotal.
    const both = fingerprint({ sumVarigeDriftsmidler: null, sumImmaterielleEiendeler: null }, { sumAnleggsmidler: pct(4) });
    expect(both.assetIntensity).toEqual(known('low'));
    expect(both.capitalisedIntangibles).toBe(false);
  });

  it('omloepsmidler bounds empty varer', () => {
    // sum_omloepsmidler 35 % − kundefordringer 15 % − bank 20 % = 0: no stock.
    expect(fingerprint({ varer: null }).inventory).toBe(false);
    // 36 %: up to 1 % of stock, unknown.
    expect(fingerprint({ varer: null }, { sumOmloepsmidler: pct(36) }).inventory).toBeNull();
  });

  it('a NULL subtotal falls back to sum eiendeler', () => {
    // sum_eiendeler 40 % − fixed 2 − varer 0 − kundefordringer 15 − bank 20 = 3 % < 5 %.
    expect(fingerprint({ sumImmaterielleEiendeler: null }, { sumAnleggsmidler: null }).capitalisedIntangibles).toBe(false);
    // sum_eiendeler 50 %: 13 %, unknown.
    expect(
      fingerprint({ sumImmaterielleEiendeler: null, sumEiendeler: pct(50) }, { sumAnleggsmidler: null }).capitalisedIntangibles,
    ).toBeNull();
    // varer: 40 − 0 − 2 − 15 − 20 = 3 %, unknown; with 37 % it is 0, none.
    expect(fingerprint({ varer: null }, { sumOmloepsmidler: null }).inventory).toBeNull();
    expect(fingerprint({ varer: null, sumEiendeler: pct(37) }, { sumOmloepsmidler: null }).inventory).toBe(false);
  });

  it('a NULL subtotal and an empty sum eiendeler leave the line unbounded', () => {
    expect(
      fingerprint({ sumImmaterielleEiendeler: null, sumEiendeler: null }, { sumAnleggsmidler: null }).capitalisedIntangibles,
    ).toBeNull();
  });

  it('a balance remainder of exactly −5 kr counts as 0, and −5.01 kr gives no fingerprint', () => {
    // sum_omloepsmidler − kundefordringer 15 % − bank 20 % = −5 kr: no stock.
    expect(fingerprint({ varer: null }, { sumOmloepsmidler: pct(35) - 500n }).inventory).toBe(false);
    expect(fp({ varer: null }, { sumOmloepsmidler: pct(35) - 501n })).toEqual({
      kind: 'skip',
      reason: 'negative_balance_remainder',
    });
    // The same for the fixed-asset bound: sum_anleggsmidler − fixed assets 2 %.
    expect(fingerprint({ sumImmaterielleEiendeler: null }, { sumAnleggsmidler: pct(2) - 500n }).capitalisedIntangibles).toBe(false);
    expect(fp({ sumImmaterielleEiendeler: null }, { sumAnleggsmidler: pct(2) - 501n })).toEqual({
      kind: 'skip',
      reason: 'negative_balance_remainder',
    });
  });

  it('a negative balance remainder gives no fingerprint', () => {
    // sum_anleggsmidler 1 % − fixed assets 2 % read.
    expect(fp({ sumImmaterielleEiendeler: null }, { sumAnleggsmidler: pct(1) })).toEqual({
      kind: 'skip',
      reason: 'negative_balance_remainder',
    });
    // sum_omloepsmidler 30 % − 15 − 20.
    expect(fp({ varer: null }, { sumOmloepsmidler: pct(30) })).toEqual({ kind: 'skip', reason: 'negative_balance_remainder' });
    // The fallback: sum_eiendeler 30 % − 37 % read.
    expect(fp({ varer: null, sumEiendeler: pct(30) }, { sumOmloepsmidler: null })).toEqual({
      kind: 'skip',
      reason: 'negative_balance_remainder',
    });
  });

  it('uses a subtotal only to bound an empty line: with every line read, it is not checked', () => {
    expect(fp({}, { sumAnleggsmidler: pct(1), sumOmloepsmidler: pct(1) }).kind).toBe('fingerprint');
  });
});

describe('no fingerprint', () => {
  it.each(['failed_reconciliation', null])('unreconciled or no revenue: no fingerprint (status %s)', (status) => {
    expect(fingerprintOf(documentFigures(row(status, {})), SUBTOTALS)).toEqual({ kind: 'skip', reason: 'not_reconciled' });
  });

  it.each([
    ['empty', null],
    ['zero', 0n],
    ['negative', -1n],
  ] as const)('unreconciled or no revenue: no fingerprint (revenue %s)', (_label, revenue) => {
    expect(fp({ sumDriftsinntekter: revenue })).toEqual({ kind: 'skip', reason: 'no_revenue' });
  });
});

describe('businessType: the rule, first match wins (D1)', () => {
  const all = (overrides: Partial<Fingerprint>): Fingerprint => ({
    costOfGoods: known('low'),
    personnelCost: known('low'),
    assetIntensity: known('low'),
    inventory: false,
    capitalisedIntangibles: false,
    ...overrides,
  });

  it.each([
    ['cost of goods high', all({ costOfGoods: known('high'), capitalisedIntangibles: true }), 'forhandler'],
    ['cost of goods mid with inventory', all({ costOfGoods: known('mid'), inventory: true, capitalisedIntangibles: true }), 'forhandler'],
    ['cost of goods mid without inventory, intangibles', all({ costOfGoods: known('mid'), capitalisedIntangibles: true }), 'produkt'],
    ['intangibles before asset intensity', all({ capitalisedIntangibles: true, assetIntensity: known('high') }), 'produkt'],
    ['asset intensity high', all({ assetIntensity: known('high'), personnelCost: known('high') }), 'annet'],
    ['personnel mid, cost of goods low', all({ personnelCost: known('mid') }), 'konsulent'],
    ['personnel high, cost of goods low', all({ personnelCost: known('high') }), 'konsulent'],
    ['personnel high, cost of goods mid', all({ personnelCost: known('high'), costOfGoods: known('mid') }), 'annet'],
    ['nothing matches', all({}), 'annet'],
  ] as const)('%s → %s', (_label, input, type) => {
    expect(businessType(input)).toBe(type);
  });

  it('an unknown that decides the rule gives no type', () => {
    // Personnel cost low or mid: annet or konsulent.
    expect(businessType(all({ personnelCost: { lo: 'low', hi: 'mid' } }))).toBeNull();
    // Inventory unknown with cost of goods mid: forhandler or annet.
    expect(businessType(all({ costOfGoods: known('mid'), inventory: null }))).toBeNull();
    // Intangibles unknown, personnel high: produkt or konsulent.
    expect(businessType(all({ personnelCost: known('high'), capitalisedIntangibles: null }))).toBeNull();
    // And from figures: an empty lonnskostnad spanning low to high.
    expect(businessType(fingerprint({ lonnskostnad: null, annenDriftskostnad: 0n }))).toBeNull();
  });

  it('an unknown that does not decide still gives a type', () => {
    // Unknown personnel cost, cost of goods high: forhandler whatever it is.
    expect(businessType(all({ costOfGoods: known('high'), personnelCost: { lo: 'low', hi: 'high' } }))).toBe('forhandler');
    expect(
      businessType(fingerprint({ varekostnad: pct(60), lonnskostnad: null, annenDriftskostnad: 0n, sumDriftskostnad: pct(100) })),
    ).toBe('forhandler');
    // Unknown inventory with cost of goods low: inventory is never read.
    expect(businessType(all({ personnelCost: known('high'), inventory: null }))).toBe('konsulent');
  });
});

// R3 (Story 2.5c): a current asset line above the API's sum_omloepsmidler is
// absent, and the fingerprint reads it as an empty line.
describe('a current asset line above the API subtotal (R3)', () => {
  function guarded(figures: Figures, subtotals: ApiSubtotals) {
    return fingerprintOf(guardCurrentAssets(documentFigures(row('reconciled', figures)), 'current', subtotals.sumOmloepsmidler), subtotals);
  }

  it('reads an emptied line as empty: varer is bounded without it, and the digest input is null', () => {
    // kundefordringer read as 106 % (a digit read as two) against sum_omloepsmidler 35 %.
    const subtotals = { ...SUBTOTALS, sumOmloepsmidler: pct(35) };
    const result = guarded({ kundefordringer: pct(106), varer: null }, subtotals);
    if (result.kind !== 'fingerprint') throw new Error(`expected a fingerprint, got skip ${result.reason}`);
    expect(result.inputs.kundefordringer).toBeNull();
    // varer lies in [0, 35 − 20 %]: unknown, where the misread 106 % made it a negative remainder.
    expect(result.fingerprint.inventory).toBeNull();
    expect(fp({ kundefordringer: pct(106), varer: null }, subtotals)).toEqual({ kind: 'skip', reason: 'negative_balance_remainder' });
  });

  it('still skips a column that did not reconcile', () => {
    const figures = guardCurrentAssets(documentFigures(row('failed_reconciliation', {})), 'current', pct(35));
    expect(fingerprintOf(figures, SUBTOTALS)).toEqual({ kind: 'skip', reason: 'not_reconciled' });
  });
});

describe('the digest inputs', () => {
  it('lists every figure the fingerprint reads and the two subtotals', () => {
    const result = fp({ lonnskostnad: null });
    if (result.kind !== 'fingerprint') throw new Error('expected a fingerprint');
    expect(Object.keys(result.inputs).sort()).toEqual(
      [
        'sumDriftsinntekter',
        'varekostnad',
        'lonnskostnad',
        'avskrivninger',
        'nedskrivninger',
        'annenDriftskostnad',
        'sumDriftskostnad',
        'sumImmaterielleEiendeler',
        'sumVarigeDriftsmidler',
        'varer',
        'kundefordringer',
        'bankinnskudd',
        'sumEiendeler',
        'sumAnleggsmidler',
        'sumOmloepsmidler',
      ].sort(),
    );
    expect(result.inputs.lonnskostnad).toBeNull();
    expect(result.inputs.sumAnleggsmidler).toBe(SUBTOTALS.sumAnleggsmidler);
  });

  it('changes when a subtotal changes, and not when a figure the fingerprint ignores does', () => {
    const inputs = (figures: Figures, subtotals: Partial<ApiSubtotals> = {}) => {
      const result = fp(figures, subtotals);
      if (result.kind !== 'fingerprint') throw new Error('expected a fingerprint');
      return digest(result.inputs);
    };
    expect(inputs({}, { sumOmloepsmidler: pct(36) })).not.toBe(inputs({}));
    expect(inputs({ aarsresultat: 1n })).toBe(inputs({}));
  });

  it('the intangible parts do not enter the fingerprint', () => {
    // Story 2.5b stores the four parts of intangible assets; D1 is locked, so
    // neither the categories nor the digest change with them (spec I/O matrix).
    const read = (figures: Figures) => {
      const result = fp(figures);
      if (result.kind !== 'fingerprint') throw new Error('expected a fingerprint');
      return { fingerprint: result.fingerprint, digest: digest(result.inputs), keys: Object.keys(result.inputs) };
    };
    const parts = { sumImmaterielleEiendeler: pct(20) };
    const without = read({ ...parts, forskningOgUtvikling: null, konsesjonerPatenter: null, goodwill: null, utsattSkattefordel: null });
    const withParts = read({
      ...parts,
      forskningOgUtvikling: pct(1),
      konsesjonerPatenter: pct(2),
      goodwill: pct(15),
      utsattSkattefordel: pct(2),
    });
    expect(withParts).toEqual(without);
    for (const key of ['forskningOgUtvikling', 'konsesjonerPatenter', 'goodwill', 'utsattSkattefordel']) {
      expect(withParts.keys).not.toContain(key);
    }
  });

  it('parses the subtotals from a key-figures row exactly', () => {
    expect(apiSubtotalsFromRow({ sum_anleggsmidler_ore: '9007199254740993', sum_omloepsmidler_ore: null })).toEqual({
      sumAnleggsmidler: 9_007_199_254_740_993n,
      sumOmloepsmidler: null,
    });
    expect(() => apiSubtotalsFromRow({ sum_anleggsmidler_ore: '1.5', sum_omloepsmidler_ore: null })).toThrow(TypeError);
  });
});

describe('stored categories', () => {
  const stored = fingerprint({ lonnskostnad: null });

  it('round-trip through the table columns', () => {
    expect(fingerprintFromColumns(fingerprintColumns(stored))).toEqual(stored);
  });

  it('read a row a left join did not find as no fingerprint', () => {
    expect(
      fingerprintFromColumns({
        cost_of_goods_lo: null,
        cost_of_goods_hi: null,
        personnel_cost_lo: null,
        personnel_cost_hi: null,
        asset_intensity_lo: null,
        asset_intensity_hi: null,
        inventory: null,
        capitalised_intangibles: null,
      }),
    ).toBeNull();
  });

  it.each([
    ['an unknown band', { cost_of_goods_lo: 'medium' }],
    ['lo above hi', { personnel_cost_lo: 'high', personnel_cost_hi: 'low' }],
    ['a partial row', { asset_intensity_hi: null }],
    ['a yes/no category that is not a boolean', { inventory: 't' as unknown as boolean }],
  ])('throw on %s', (_label, change) => {
    expect(() => fingerprintFromColumns({ ...fingerprintColumns(stored), ...change })).toThrow(TypeError);
  });

  it('throw on yes/no categories without bands', () => {
    expect(() =>
      fingerprintFromColumns({
        cost_of_goods_lo: null,
        cost_of_goods_hi: null,
        personnel_cost_lo: null,
        personnel_cost_hi: null,
        asset_intensity_lo: null,
        asset_intensity_hi: null,
        inventory: true,
        capitalised_intangibles: null,
      }),
    ).toThrow(TypeError);
  });
});

describe('readShare: the read shares the spread analysis measures', () => {
  it('gives the exact share and its band for a read line', () => {
    const share = readShare(documentFigures(row('reconciled', { varekostnad: pct(40) })), 'costOfGoods');
    expect(share?.band).toBe('high');
    expect(share?.share.toString()).toBe('0.4');
  });

  it('gives nothing for an empty line, an unreconciled column or no revenue', () => {
    expect(readShare(documentFigures(row('reconciled', { lonnskostnad: null })), 'personnelCost')).toBeNull();
    expect(readShare(documentFigures(row('failed_reconciliation', {})), 'personnelCost')).toBeNull();
    expect(readShare(documentFigures(row('reconciled', { sumDriftsinntekter: 0n })), 'personnelCost')).toBeNull();
  });
});
