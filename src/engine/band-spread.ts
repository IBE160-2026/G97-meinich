// The within-band spread of a banded measure (Story 2.5, D3; FR-13). Cost of
// goods share and personnel cost share select peers only as bands and are
// benchmarked within their band, which is worth something only if the
// shares still spread inside a band. Pure: read shares with their bands in,
// per band the count and the interquartile range in percentage points out.
// The measure (IQR, PERCENTILE.INC) and the threshold the test asserts
// (test/fingerprint-spread.test.ts) were fixed before any share was seen.
import { Decimal } from './decimal.ts';
import { BANDS, type Band } from './fingerprint.ts';
import { percentileInc } from './statistics.ts';

export type BandSpread = {
  readonly n: number;
  /** Q3 − Q1 of the shares × 100, exact; null when the band holds no share. */
  readonly iqrPercentagePoints: Decimal | null;
};

/** Each band's count and interquartile range, from the read shares in it. */
export function bandSpread(points: readonly { readonly band: Band; readonly share: Decimal }[]): Record<Band, BandSpread> {
  const spread = {} as Record<Band, BandSpread>;
  for (const band of BANDS) {
    const sorted = points
      .filter((point) => point.band === band)
      .map((point) => point.share)
      .sort((a, b) => a.comparedTo(b));
    spread[band] = {
      n: sorted.length,
      iqrPercentagePoints:
        sorted.length === 0
          ? null
          : percentileInc(sorted, '0.75').minus(percentileInc(sorted, '0.25')).mul(new Decimal(100)),
    };
  }
  return spread;
}
