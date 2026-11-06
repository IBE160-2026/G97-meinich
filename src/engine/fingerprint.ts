// The business-model fingerprint (Story 2.5; FR-10, FR-13): what kind of
// business a company's own accounts show, read from the reconciled current
// column of one filed document. Pure: figures in, five categories out, and a
// business type derived from them by a fixed rule. Funnel stage 4
// (src/engine/peers.ts) compares types; nothing here reads a margin, a
// return or any other benchmarked measure.
//
// Five categories (D1, Meinich 2026-11-01; fixed before any share was seen):
//
//   cost of goods      varekostnad / sum_driftsinntekter           low < 10 %, mid < 40 %, high
//   personnel cost     lonnskostnad / sum_driftsinntekter          low < 30 %, mid < 60 %, high
//   asset intensity    sum_varige_driftsmidler / sum_driftsinntekter low < 10 %, mid < 50 %, high
//   inventory          varer > 0
//   intangibles        sum_immaterielle_eiendeler ≥ 5 % of sum_driftsinntekter
//
// Each band's lower edge is inclusive: a share exactly on an edge is in the
// band above. Cost of goods and personnel cost are benchmarked as well, so
// they leave this module only as band ids, never as values.
//
// An empty line is not 0 (D2). It lies in an interval [0, bound]:
//
//   cost lines      U = sum_driftskostnad − every cost line that was read
//                   (varekostnad, lonnskostnad, avskrivninger, nedskrivninger,
//                   annen_driftskostnad); unbounded when sum_driftskostnad is
//                   empty.
//   intangibles,    sum_anleggsmidler (the key-figures API filing the document
//   fixed assets    belongs to) − whichever of the two was read
//   varer           sum_omloepsmidler (the same filing) − whichever of
//                   kundefordringer and bankinnskudd was read
//
// A NULL API subtotal is not 0: the bound is then the column's
// sum_eiendeler minus every asset line that was read (unbounded if that is
// empty too). The subtotals are only ever upper bounds.
//
// A negative U or bound down to −5 kr is the register's rounding (it prints
// whole kroner rounded from øre, so a stated total can be a krone or two off
// its lines) and counts as 0; below −5 kr there is no fingerprint (Spec
// Change Log, Meinich 2026-11-01). The 5 kr is within_document_bound_kr in
// ingest/config.toml; test/engine/fingerprint-tolerance.test.ts fails if
// ROUNDING_TOLERANCE_ORE differs from it.
//
// Two rules on stored figures (Story 2.5c; Meinich 2026-11-06), with no
// re-read and no change to D1:
//
//   R2  When the four main cost lines are read (varekostnad, lonnskostnad,
//       avskrivninger, annen_driftskostnad; nedskrivninger read or empty, an
//       empty one counted as 0) and they fall short of sum_driftskostnad by
//       more than 5 kr, there is no fingerprint (`cost_lines_short_of_total`):
//       the probe found one digit of a read line misread (8 read as 3, 6 as
//       5), so a read line is wrong and its share cannot be trusted. A
//       column with a main line empty keeps the interval rule. Lines over
//       the total stay `negative_unexplained`.
//   R3  A current column's kundefordringer or bankinnskudd above the API's
//       sum_omloepsmidler + 5 kr is absent (`guardCurrentAssets` in
//       document-inputs.ts) and read here as an empty line, so the inputs
//       and their digest hold it as null.
//
// A category whose interval fits one band (or one answer) is known;
// otherwise it is a band range, or null for yes/no. `businessType` runs the
// rule over every value a category can still take and gives a type only
// when all of them agree.
import { Decimal } from './decimal.ts';
import type { DocumentField, DocumentFigures } from './document-inputs.ts';
import { parseOre } from './inputs.ts';

/** The business types, shared by stage 4 and Story 2.6's classification. */
export const BUSINESS_TYPES = ['produkt', 'konsulent', 'forhandler', 'annet'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** The bands, in ascending order. */
export const BANDS = ['low', 'mid', 'high'] as const;
export type Band = (typeof BANDS)[number];

/** The bands a category can lie in, `lo` ≤ `hi`. Known when `lo === hi`. */
export type BandRange = { readonly lo: Band; readonly hi: Band };

/** The three banded categories. */
export type BandedCategory = 'costOfGoods' | 'personnelCost' | 'assetIntensity';

/**
 * Each banded category's two edges as shares of sum_driftsinntekter: a
 * share below `mid` is low, below `high` mid, otherwise high.
 */
export const BAND_EDGES: Readonly<Record<BandedCategory, { readonly mid: Decimal; readonly high: Decimal }>> = {
  costOfGoods: { mid: new Decimal('0.10'), high: new Decimal('0.40') },
  personnelCost: { mid: new Decimal('0.30'), high: new Decimal('0.60') },
  assetIntensity: { mid: new Decimal('0.10'), high: new Decimal('0.50') },
};

/** Capitalised intangibles: sum_immaterielle_eiendeler at or above this share of revenue. */
export const INTANGIBLES_SHARE = new Decimal('0.05');

/** The five categories. Nothing else; in particular no share as a value. */
export type Fingerprint = {
  readonly costOfGoods: BandRange;
  readonly personnelCost: BandRange;
  readonly assetIntensity: BandRange;
  /** varer > 0; null when unknown. */
  readonly inventory: boolean | null;
  /** sum_immaterielle_eiendeler ≥ 5 % of revenue; null when unknown. */
  readonly capitalisedIntangibles: boolean | null;
};

/** The two key-figures API subtotals of the filing the document belongs to, in øre. */
export type ApiSubtotals = {
  readonly sumAnleggsmidler: bigint | null;
  readonly sumOmloepsmidler: bigint | null;
};

/** The subtotals from a `register.key_figures` row (or a left join that found none: both null). */
export function apiSubtotalsFromRow(row: {
  readonly sum_anleggsmidler_ore: string | null;
  readonly sum_omloepsmidler_ore: string | null;
}): ApiSubtotals {
  return {
    sumAnleggsmidler: parseOre(row.sum_anleggsmidler_ore),
    sumOmloepsmidler: parseOre(row.sum_omloepsmidler_ore),
  };
}

/** The document figures a fingerprint reads, in the order the digest lists them. */
export const FINGERPRINT_FIELDS = [
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
] as const satisfies readonly DocumentField[];

type FingerprintField = (typeof FINGERPRINT_FIELDS)[number];

/** Every raw input of one fingerprint, in øre: what its digest is computed over. */
export type FingerprintInputs = { readonly [F in FingerprintField]: bigint | null } & ApiSubtotals;

/**
 * Why a reconciled-or-not column gives no fingerprint:
 * - `not_reconciled`: the column did not reconcile (or is not yet reconciled);
 * - `no_revenue`: sum_driftsinntekter is empty, zero or negative;
 * - `cost_lines_short_of_total`: the four main cost lines are read and, with
 *   nedskrivninger (an empty one as 0), fall short of sum_driftskostnad by more than 5 kr (R2, Story 2.5c);
 * - `negative_unexplained`: the read cost lines exceed sum_driftskostnad by more than 5 kr;
 * - `negative_balance_remainder`: the bound for an empty balance line is below −5 kr.
 */
export type SkipReason =
  | 'not_reconciled'
  | 'no_revenue'
  | 'cost_lines_short_of_total'
  | 'negative_unexplained'
  | 'negative_balance_remainder';

export type FingerprintResult =
  | { readonly kind: 'fingerprint'; readonly fingerprint: Fingerprint; readonly inputs: FingerprintInputs }
  | { readonly kind: 'skip'; readonly reason: SkipReason };

/** A closed interval of øre; `hi` null is unbounded above. */
type Interval = { readonly lo: bigint; readonly hi: bigint | null };

const COST_LINES = ['varekostnad', 'lonnskostnad', 'avskrivninger', 'nedskrivninger', 'annenDriftskostnad'] as const;
/** The cost lines R2 needs read; nedskrivninger may be empty, counted as 0. */
export const MAIN_COST_LINES = ['varekostnad', 'lonnskostnad', 'avskrivninger', 'annenDriftskostnad'] as const;
const ASSET_LINES = ['sumImmaterielleEiendeler', 'sumVarigeDriftsmidler', 'varer', 'kundefordringer', 'bankinnskudd'] as const;

/**
 * The register's rounding, in øre: within_document_bound_kr (5 kr) of
 * ingest/config.toml, the same bound step 1 reconciles with. A remainder in
 * [−this, 0) counts as 0.
 */
export const ROUNDING_TOLERANCE_ORE = 500n;

/** A remainder within the rounding counts as 0; one below it is 'negative'; null (unbounded) stays null. */
function settled(rest: bigint | null): bigint | null | 'negative' {
  if (rest === null || rest >= 0n) return rest;
  return rest >= -ROUNDING_TOLERANCE_ORE ? 0n : 'negative';
}

/** `total` minus every read amount; null (unbounded) when `total` is empty. */
function remainder(total: bigint | null, read: readonly (bigint | null)[]): bigint | null {
  if (total === null) return null;
  return read.reduce<bigint>((rest, amount) => (amount === null ? rest : rest - amount), total);
}

/** A read line is a point; an empty one lies in [0, bound]. */
function interval(value: bigint | null, bound: bigint | null): Interval {
  return value !== null ? { lo: value, hi: value } : { lo: 0n, hi: bound };
}

/** Whether amount / revenue < share, exactly: amount < share × revenue. `revenue` > 0. */
function below(amount: bigint, revenue: bigint, share: Decimal): boolean {
  return new Decimal(amount.toString()).lt(share.mul(new Decimal(revenue.toString())));
}

function bandOf(category: BandedCategory, amount: bigint, revenue: bigint): Band {
  const edges = BAND_EDGES[category];
  if (below(amount, revenue, edges.mid)) return 'low';
  if (below(amount, revenue, edges.high)) return 'mid';
  return 'high';
}

function bandRange(category: BandedCategory, range: Interval, revenue: bigint): BandRange {
  return {
    lo: bandOf(category, range.lo, revenue),
    hi: range.hi === null ? 'high' : bandOf(category, range.hi, revenue),
  };
}

/** True when every value in `range` is > 0, false when none is, null otherwise. */
function positive(range: Interval): boolean | null {
  if (range.lo > 0n) return true;
  if (range.hi !== null && range.hi <= 0n) return false;
  return null;
}

/** True when every value in `range` is ≥ 5 % of revenue, false when none is, null otherwise. */
function atLeastIntangiblesShare(range: Interval, revenue: bigint): boolean | null {
  if (!below(range.lo, revenue, INTANGIBLES_SHARE)) return true;
  if (range.hi !== null && below(range.hi, revenue, INTANGIBLES_SHARE)) return false;
  return null;
}

/**
 * The figures, or null when the column passes none (not reconciled). A
 * figure absent because it exceeds its API subtotal (R3) is an empty line.
 */
function readValues(figures: DocumentFigures): { readonly [F in FingerprintField]: bigint | null } | null {
  const values: Partial<Record<FingerprintField, bigint | null>> = {};
  for (const field of FINGERPRINT_FIELDS) {
    const figure = figures[field];
    if (figure.kind === 'absent') {
      if (figure.absence.reason !== 'exceeds_api_subtotal') return null;
      values[field] = null;
      continue;
    }
    values[field] = figure.ore;
  }
  return values as { readonly [F in FingerprintField]: bigint | null };
}

/**
 * The fingerprint of one document column, from its figures (through
 * `documentFigures`) and the API subtotals of the filing it belongs to.
 */
export function fingerprintOf(figures: DocumentFigures, subtotals: ApiSubtotals): FingerprintResult {
  const values = readValues(figures);
  if (values === null) return { kind: 'skip', reason: 'not_reconciled' };
  const revenue = values.sumDriftsinntekter;
  if (revenue === null || revenue <= 0n) return { kind: 'skip', reason: 'no_revenue' };

  // Cost lines: an empty line lies in [0, U].
  const rest = remainder(
    values.sumDriftskostnad,
    COST_LINES.map((line) => values[line]),
  );
  // R2: every main line read and the lines short of the total (an empty
  // nedskrivninger counts as 0, as `remainder` skips it).
  if (rest !== null && rest > ROUNDING_TOLERANCE_ORE && MAIN_COST_LINES.every((line) => values[line] !== null)) {
    return { kind: 'skip', reason: 'cost_lines_short_of_total' };
  }
  const unexplained = settled(rest);
  if (unexplained === 'negative') return { kind: 'skip', reason: 'negative_unexplained' };

  // Balance lines: an empty line lies in [0, bound]; the bound is computed
  // only for a line that is empty.
  const allAssets = (): bigint | null =>
    remainder(
      values.sumEiendeler,
      ASSET_LINES.map((line) => values[line]),
    );
  const fixedBound = (other: bigint | null): bigint | null =>
    subtotals.sumAnleggsmidler !== null ? remainder(subtotals.sumAnleggsmidler, [other]) : allAssets();
  let negativeBound = false;
  const bounded = (value: bigint | null, bound: () => bigint | null): Interval => {
    if (value !== null) return interval(value, null);
    const upper = settled(bound());
    if (upper === 'negative') {
      negativeBound = true;
      return interval(null, 0n);
    }
    return interval(null, upper);
  };
  const intangibles = bounded(values.sumImmaterielleEiendeler, () => fixedBound(values.sumVarigeDriftsmidler));
  const fixed = bounded(values.sumVarigeDriftsmidler, () => fixedBound(values.sumImmaterielleEiendeler));
  const varer = bounded(values.varer, () =>
    subtotals.sumOmloepsmidler !== null
      ? remainder(subtotals.sumOmloepsmidler, [values.kundefordringer, values.bankinnskudd])
      : allAssets(),
  );
  if (negativeBound) {
    return { kind: 'skip', reason: 'negative_balance_remainder' };
  }

  const fingerprint: Fingerprint = {
    costOfGoods: bandRange('costOfGoods', interval(values.varekostnad, unexplained), revenue),
    personnelCost: bandRange('personnelCost', interval(values.lonnskostnad, unexplained), revenue),
    assetIntensity: bandRange('assetIntensity', fixed, revenue),
    inventory: positive(varer),
    capitalisedIntangibles: atLeastIntangiblesShare(intangibles, revenue),
  };
  return { kind: 'fingerprint', fingerprint, inputs: { ...values, ...subtotals } };
}

/** The bands from `range.lo` to `range.hi`. */
function bandsIn(range: BandRange): Band[] {
  return BANDS.slice(BANDS.indexOf(range.lo), BANDS.indexOf(range.hi) + 1);
}

function answers(value: boolean | null): boolean[] {
  return value === null ? [true, false] : [value];
}

/** One combination of known category values. */
type Known = {
  readonly costOfGoods: Band;
  readonly personnelCost: Band;
  readonly assetIntensity: Band;
  readonly inventory: boolean;
  readonly capitalisedIntangibles: boolean;
};

/** The rule (D1), first match wins. */
function ruleType(known: Known): BusinessType {
  if (known.costOfGoods === 'high' || (known.costOfGoods === 'mid' && known.inventory)) return 'forhandler';
  if (known.capitalisedIntangibles) return 'produkt';
  if (known.assetIntensity === 'high') return 'annet';
  if (known.personnelCost !== 'low' && known.costOfGoods === 'low') return 'konsulent';
  return 'annet';
}

/**
 * The business type the fingerprint shows, or null (undetermined) when the
 * unknown categories could still give different types. Runs the rule over
 * every combination of the values each category can take.
 */
export function businessType(fingerprint: Fingerprint): BusinessType | null {
  const types = new Set<BusinessType>();
  for (const costOfGoods of bandsIn(fingerprint.costOfGoods)) {
    for (const personnelCost of bandsIn(fingerprint.personnelCost)) {
      for (const assetIntensity of bandsIn(fingerprint.assetIntensity)) {
        for (const inventory of answers(fingerprint.inventory)) {
          for (const capitalisedIntangibles of answers(fingerprint.capitalisedIntangibles)) {
            types.add(ruleType({ costOfGoods, personnelCost, assetIntensity, inventory, capitalisedIntangibles }));
          }
        }
      }
    }
  }
  const [only, ...others] = types;
  return only !== undefined && others.length === 0 ? only : null;
}

/** A `register.fingerprint` row as postgres.js (or the seed CSV) gives its categories; all null when a left join found none. */
export type FingerprintColumns = {
  readonly cost_of_goods_lo: string | null;
  readonly cost_of_goods_hi: string | null;
  readonly personnel_cost_lo: string | null;
  readonly personnel_cost_hi: string | null;
  readonly asset_intensity_lo: string | null;
  readonly asset_intensity_hi: string | null;
  readonly inventory: boolean | null;
  readonly capitalised_intangibles: boolean | null;
};

function isBand(value: string): value is Band {
  return (BANDS as readonly string[]).includes(value);
}

function rangeOf(name: string, lo: string | null, hi: string | null): BandRange {
  if (lo === null || hi === null || !isBand(lo) || !isBand(hi) || BANDS.indexOf(lo) > BANDS.indexOf(hi)) {
    throw new TypeError(`not a band range: ${name} ${JSON.stringify(lo)}–${JSON.stringify(hi)}`);
  }
  return { lo, hi };
}

/**
 * The one validator for stored categories: the fingerprint of a row, or
 * null when there is no row (every column null). A value outside a
 * category's set, a range with lo above hi, or a partial row throws.
 */
export function fingerprintFromColumns(row: FingerprintColumns): Fingerprint | null {
  const bands = [
    row.cost_of_goods_lo,
    row.cost_of_goods_hi,
    row.personnel_cost_lo,
    row.personnel_cost_hi,
    row.asset_intensity_lo,
    row.asset_intensity_hi,
  ];
  if (bands.every((value) => value === null)) {
    if (row.inventory !== null || row.capitalised_intangibles !== null) {
      throw new TypeError('a fingerprint row without bands');
    }
    return null;
  }
  for (const flag of [row.inventory, row.capitalised_intangibles]) {
    if (flag !== null && typeof flag !== 'boolean') throw new TypeError(`not a yes/no category: ${JSON.stringify(flag)}`);
  }
  return {
    costOfGoods: rangeOf('cost_of_goods', row.cost_of_goods_lo, row.cost_of_goods_hi),
    personnelCost: rangeOf('personnel_cost', row.personnel_cost_lo, row.personnel_cost_hi),
    assetIntensity: rangeOf('asset_intensity', row.asset_intensity_lo, row.asset_intensity_hi),
    inventory: row.inventory,
    capitalisedIntangibles: row.capitalised_intangibles,
  };
}

/** The columns of a fingerprint, as `register.fingerprint` stores them. */
export function fingerprintColumns(fingerprint: Fingerprint): FingerprintColumns {
  return {
    cost_of_goods_lo: fingerprint.costOfGoods.lo,
    cost_of_goods_hi: fingerprint.costOfGoods.hi,
    personnel_cost_lo: fingerprint.personnelCost.lo,
    personnel_cost_hi: fingerprint.personnelCost.hi,
    asset_intensity_lo: fingerprint.assetIntensity.lo,
    asset_intensity_hi: fingerprint.assetIntensity.hi,
    inventory: fingerprint.inventory,
    capitalised_intangibles: fingerprint.capitalisedIntangibles,
  };
}

/** The two banded cost lines the within-band spread test measures (FR-13). */
export const SPREAD_CATEGORIES = ['costOfGoods', 'personnelCost'] as const satisfies readonly BandedCategory[];
export type SpreadCategory = (typeof SPREAD_CATEGORIES)[number];

const SPREAD_LINE: Readonly<Record<SpreadCategory, 'varekostnad' | 'lonnskostnad'>> = {
  costOfGoods: 'varekostnad',
  personnelCost: 'lonnskostnad',
};

/**
 * The share of a banded cost line and its band, only when the line was read
 * (a point, not an interval) and revenue is positive; null otherwise. For
 * the within-band spread analysis only: selection never sees it.
 */
export function readShare(figures: DocumentFigures, category: SpreadCategory): { readonly band: Band; readonly share: Decimal } | null {
  const revenue = figures.sumDriftsinntekter;
  const line = figures[SPREAD_LINE[category]];
  if (revenue.kind !== 'value' || line.kind !== 'value' || revenue.ore === null || line.ore === null) return null;
  if (revenue.ore <= 0n) return null;
  return {
    band: bandOf(category, line.ore, revenue.ore),
    share: new Decimal(line.ore.toString()).div(new Decimal(revenue.ore.toString())),
  };
}
