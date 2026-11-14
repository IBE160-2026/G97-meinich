// The size-band control's steps (Story 2.8; FR-18; EXPERIENCE.md "Size-band
// control"): each step's factors ("0,33–3×"), whether it is Standard or
// widened, and the revenue range it admits around the subject's revenue
// ("Omsetning 3,1–12,4 mill. kr"). Pure, and built on the server, so the
// client control receives strings only. The factors come from the engine's
// SIZE_BANDS, the one place the band is defined; no literal here.
import { Decimal } from '../engine/decimal.ts';
import { formatBandFactor, formatMillionsNumber } from '../engine/format.ts';
import { SIZE_BANDS, type SizeBand } from '../engine/peers.ts';
import { MIN_PEERS } from '../engine/types.ts';
import { t } from '../messages/index.ts';
import { BANDS, DEFAULT_BAND } from '../url/analysis-state.ts';

export type BandStep = {
  readonly band: SizeBand;
  /** "0,5–2×". */
  readonly factors: string;
  /** "Standard" or "Utvidet". */
  readonly kind: string;
  /** "Omsetning 5,0–20,0 mill. kr"; null when the subject's revenue is not a positive NOK amount. */
  readonly range: string | null;
};

/** "0,5–2×", "0,33–3×", "0,25–4×". */
export function bandFactors(band: SizeBand): string {
  const { lo, hi } = SIZE_BANDS[band];
  return t('peers.band.factors', { fra: formatBandFactor(lo.toString()), til: formatBandFactor(hi.toString()) });
}

/**
 * The three steps, in order. `revenueOre` is the subject's
 * sumDriftsinntekter in øre; the range is exact (lo × revenue, hi ×
 * revenue) and rounded once, for display, by the formatter.
 */
export function bandSteps(revenueOre: bigint | null, valuta: string | null): readonly BandStep[] {
  return BANDS.map((band) => {
    const { lo, hi } = SIZE_BANDS[band];
    const range =
      revenueOre !== null && revenueOre > 0n && valuta === 'NOK'
        ? t('peers.band.range', {
            fra: formatMillionsNumber(lo.mul(new Decimal(revenueOre.toString())).toString()),
            til: formatMillionsNumber(hi.mul(new Decimal(revenueOre.toString())).toString()),
          })
        : null;
    return {
      band,
      factors: bandFactors(band),
      kind: band === DEFAULT_BAND ? t('peers.band.standard') : t('peers.band.widened'),
      range,
    };
  });
}

/** The band one step wider than `band`, or null at the widest. */
export function widerBand(band: SizeBand): SizeBand | null {
  const index = BANDS.indexOf(band);
  return BANDS[index + 1] ?? null;
}

/**
 * The State block above the funnel when the analysis has fewer than
 * MIN_PEERS peers (EXPERIENCE.md "Peer group too small"), or null. `text`
 * is the block's sentence; `widen` the band its "Utvid
 * størrelsesintervallet" action goes to, null at the widest band, for an
 * empty group ("Fant ingen sammenlignbare selskaper." alone, EXPERIENCE.md)
 * and when the user has excluded every peer (widening is not what they
 * asked for).
 */
export type TooSmall = { readonly text: string; readonly widen: SizeBand | null };

export function groupTooSmall(memberCount: number, analysisCount: number, band: SizeBand): TooSmall | null {
  if (analysisCount >= MIN_PEERS) return null;
  const wider = widerBand(band);
  if (memberCount === 0) return { text: t('peers.none'), widen: null };
  if (analysisCount === 0) return { text: t('peers.allExcluded'), widen: null };
  const one = analysisCount === 1;
  const n = String(analysisCount);
  if (wider === null) {
    return { text: one ? t('peers.tooSmallWidestOne') : t('peers.tooSmallWidest', { n }), widen: null };
  }
  return { text: one ? t('peers.tooSmallOne') : t('peers.tooSmall', { n }), widen: wider };
}
