// Engine result types (AD-8, AD-15). A key figure is either a value with the
// source it was computed from, or an absence naming exactly one reason; it is
// never zero in place of a missing value (`docs/key-figures.md`, "Undefined
// is not zero").
import type { Decimal } from './decimal.ts';

/**
 * The four register inputs to the API key figures and the three totals they
 * can be derived from, in øre, as filed. `null` is an empty element in the
 * filing, never zero.
 */
export type ApiInputs = {
  readonly sumDriftsinntekter: bigint | null;
  readonly driftsresultat: bigint | null;
  readonly sumDriftskostnad: bigint | null;
  readonly sumEiendeler: bigint | null;
  readonly sumEgenkapitalGjeld: bigint | null;
  readonly sumEgenkapital: bigint | null;
  readonly sumGjeld: bigint | null;
};

/** Where a figure's inputs come from: the key-figures API, or OCR of the filed document (Story 2.9). */
export type Source = 'api' | 'document';

/** ↑ higher is better, ↓ lower is better, or no direction (`docs/key-figures.md`). */
export type Direction = 'higher_is_better' | 'lower_is_better' | 'none';

export type UndefinedCause = 'denominator_not_positive' | 'component_missing';

/** Why a figure or its comparison is absent. Exactly one reason. */
export type Absence =
  | { readonly reason: 'undefined'; readonly cause: UndefinedCause }
  | { readonly reason: 'below_floor'; readonly count: number }
  | { readonly reason: 'not_in_dataset' } // produced from Story 2.9
  | { readonly reason: 'failed_reconciliation' }; // produced from Story 2.9

/** A single company's figure cannot be below the floor; that is a comparison's absence. */
export type FigureAbsence = Exclude<Absence, { readonly reason: 'below_floor' }>;

export type FigureResult =
  | {
      readonly kind: 'value';
      /** The ratio as a fraction (0.021 is 2.1 %): a Decimal to 40 significant digits, rounded only at display. */
      readonly value: Decimal;
      readonly source: Source;
      /** True when the denominator was derived from a stated total, not stated itself. */
      readonly denominatorDerived: boolean;
    }
  | { readonly kind: 'absent'; readonly absence: FigureAbsence };

export type ApiKeyFigures = {
  readonly driftsmargin: FigureResult;
  readonly totalkapitalrentabilitet: FigureResult;
  readonly egenkapitalandel: FigureResult;
};

/** The minimum number of peers with a defined value, per figure, for any comparison (FR-22). */
export const MIN_PEERS = 10;

/**
 * A subject's figure against its peers. `count` is the number of peers with
 * a defined value from the subject's source; `leftOut` is every other peer.
 */
export type Comparison =
  | {
      readonly kind: 'subject_absent';
      readonly absence: FigureAbsence;
      /** Peers with a defined value, whatever their source. */
      readonly count: number;
      readonly leftOut: number;
    }
  | {
      readonly kind: 'below_floor';
      readonly subject: Decimal;
      readonly source: Source;
      readonly absence: { readonly reason: 'below_floor'; readonly count: number };
      readonly count: number;
      readonly leftOut: number;
    }
  | {
      readonly kind: 'compared';
      readonly subject: Decimal;
      readonly source: Source;
      readonly count: number;
      readonly leftOut: number;
      readonly median: Decimal;
      readonly lowerQuartile: Decimal;
      readonly upperQuartile: Decimal;
      /**
       * The 5th and 95th percentiles (PERCENTILE.INC) of the peer values
       * used: the distribution strip's domain, so one extreme peer cannot
       * squeeze the others into a corner. Every quartile lies inside them.
       */
      readonly p5: Decimal;
      readonly p95: Decimal;
      /**
       * Beste fjerdedel and Plassering, in the favourable direction; null for
       * a figure with no direction. `percentile` is in percent (0–100).
       */
      readonly best: { readonly quartile: Decimal; readonly percentile: Decimal } | null;
    };
