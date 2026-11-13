// The AD-4 payload scan every analysis tab uses (Story 2.7, Epic 1 retro
// action 11): the page's HTML and its RSC payload carry no peer field
// beyond what the shown analysis needs. Each body is scanned for
//
//   - every pool peer's orgnr (the group and the peers stages 4–5 removed),
//     except those the URL itself holds (`ekskl`, which the tab links keep);
//   - every pool peer's key-figure amounts in øre, as digits without the
//     sign; amounts under 6 digits (below 10 000 kr) are skipped, because
//     such short digit runs occur in ordinary page text, ids and hashes;
//   - the server's field names for what it reads per peer: amounts,
//     fingerprint categories, the classification, the municipality, the
//     match basis ids. The display rows' own keys (`hvorforMed`,
//     `grunnlagKi`) are not among them: "Vis alle" receives those rows as
//     strings, so they are in the RSC payload by design.
//
// `marker` is a string the tab always renders, so an empty or failed page
// cannot pass the scan.
import type { APIRequestContext } from '@playwright/test';
import { expect } from './fixtures.ts';
import { keyFigureRow, type SeedCandidate } from './seed.ts';

/** Field names of the server's subject and candidate reads that must never reach the browser. */
export const SERVER_FIELDS = [
  'sumDriftsinntekter',
  'sum_driftsinntekter_ore',
  'driftsresultat_ore',
  'sum_eiendeler_ore',
  'sum_egenkapital_ore',
  'keyFigures',
  'brregId',
  'fingerprint',
  'costOfGoods',
  'personnelCost',
  'assetIntensity',
  'capitalisedIntangibles',
  'classification',
  'business_type',
  'forretningsadresse_kommune',
  'organisasjonsform',
  // Story 2.7: the match basis reaches the page as its label, never as its id.
  'matchBasis',
  'description_and_accounts',
  'accounts_only',
  'description_only',
  'industry_and_size_only',
] as const;

export async function expectNoPeerFields(
  request: APIRequestContext,
  url: string,
  {
    pool,
    marker,
    inUrl = [],
  }: {
    readonly pool: readonly SeedCandidate[];
    readonly marker: string;
    /** Orgnrs the URL names, which the page may echo in its links. */
    readonly inUrl?: readonly string[];
  },
): Promise<void> {
  const html = await (await request.get(url)).text();
  const rsc = await request.get(url, { headers: { RSC: '1' } });
  expect(rsc.headers()['content-type']).toContain('text/x-component');
  const payload = await rsc.text();
  const amounts = pool
    .flatMap((peer) => Object.values(keyFigureRow(String(peer.brregId))))
    .filter((ore): ore is string => ore !== null)
    .map((ore) => ore.replace(/^-/, ''))
    .filter((digits) => digits.length >= 6);
  expect(amounts.length).toBeGreaterThan(pool.length);
  const scanned = pool.filter((peer) => !inUrl.includes(peer.orgnr));
  for (const [label, body] of [
    ['html', html],
    ['rsc', payload],
  ] as const) {
    expect(body, label).toContain(marker);
    expect(scanned.filter((peer) => body.includes(peer.orgnr)).map((peer) => peer.orgnr), label).toEqual([]);
    expect(amounts.filter((digits) => new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(body)), label).toEqual([]);
    expect(SERVER_FIELDS.filter((field) => body.includes(field)), label).toEqual([]);
  }
}
