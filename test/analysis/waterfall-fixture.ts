// The margin waterfall's unit-test fixture (Story 3.8): the shapes of
// e2e/synthetic.ts's SYNTHETIC_DOCUMENTS as document bases, so the unit tests
// and the e2e oracle (`SYNTHETIC_WATERFALL`) recompute the same columns. A
// subject of 1 500 000 000 kr and ten peers of 1 100 000 000 … 2 000 000 000
// kr, each line a share of revenue in thousandths; nothing is derived.
// Every company is synthetic.
import type { DocumentBasis } from '../../src/engine/document-inputs.ts';
import { readBasis, type Lines } from './document-fixture.ts';

/** Øre of `kroner`. */
const ore = (kroner: bigint): bigint => kroner * 100n;

/** One company's lines: revenue in kroner and vare, lønn, andre and avskrivninger in thousandths of it. */
export function waterfallLines(revenueKr: bigint, vare: bigint, lonn: bigint, annen: bigint, avskr: bigint, extra: Lines = {}): Lines {
  const revenue = ore(revenueKr);
  const share = (thousandths: bigint) => (revenue * thousandths) / 1000n;
  const costs = share(vare) + share(lonn) + share(annen) + share(avskr);
  return {
    salgsinntekt: String(revenue),
    sumDriftsinntekter: String(revenue),
    varekostnad: String(share(vare)),
    lonnskostnad: String(share(lonn)),
    annenDriftskostnad: String(share(annen)),
    avskrivninger: String(share(avskr)),
    nedskrivninger: '0',
    sumDriftskostnad: String(costs),
    driftsresultat: String(revenue - costs),
    ...extra,
  };
}

export const WF_SUBJECT_LINES: Lines = waterfallLines(1_500_000_000n, 70n, 470n, 220n, 20n);
export const WF_SUBJECT: DocumentBasis = readBasis(WF_SUBJECT_LINES);

/** The ten peers: revenue 1 100 000 000 + 100 000 000 × (i − 1) kr, vare 50 + 5i, lønn 400 + 10i, andre 200, avskrivninger 30. */
export const WF_PEERS: readonly DocumentBasis[] = Array.from({ length: 10 }, (_, index) => {
  const i = BigInt(index + 1);
  return readBasis(waterfallLines(1_000_000_000n + 100_000_000n * i, 50n + 5n * i, 400n + 10n * i, 200n, 30n));
});
