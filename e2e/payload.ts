// The AD-4 payload scan every analysis tab uses (Story 2.7, Epic 1 retro
// action 11): the page's HTML and its RSC payload carry no peer field
// beyond what the shown analysis needs. Each body is scanned for
//
//   - every pool peer's orgnr (the group and the peers stages 4–5 removed),
//     except those the page may carry (`inUrl`): on Oversikt and Nøkkeltall
//     the ones the URL itself holds (`ekskl`, which the tab links keep); on
//     Peers every group member's, excluded or not, which its exclude action
//     writes into the URL (Story 2.8, AD-4 as amended on 2026-11-13). A pool
//     peer stage 4 or 5 removed is never allowed;
//   - every pool peer's key-figure amounts in øre, as digits without the
//     sign; amounts under 6 digits (below 10 000 kr) are skipped, because
//     such short digit runs occur in ordinary page text, ids and hashes;
//   - the server's field names for what it reads per peer: amounts,
//     fingerprint categories, the classification, the municipality, the
//     match basis ids. The display rows' own keys (`hvorforMed`,
//     `driftsmargin`) are not among them: "Vis alle" receives those rows as
//     strings, so they are in the RSC payload by design.
//
// `marker` is a string the tab always renders, so an empty or failed page
// cannot pass the scan.
//
// Story 3.1b: both scans also look for the server's document fields (the
// document lines' names as the engine and the read call them, the
// `cur_`/`pri_` columns, the document basis), and `expectNoDocumentFields`
// scans a page for every document line in øre of its subject and its peers.
import type { APIRequestContext } from '@playwright/test';
import { DOCUMENT_FIGURE_COLUMNS, type DocumentField } from '../src/engine/document-inputs.ts';
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

const DOCUMENT_FIELDS = Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[];

/**
 * The document fields of the server's reads that must never reach the
 * browser, as names that cannot be ordinary page text: the columns
 * (`kundefordringer_ore`), the engine's names made of more than one word
 * (`annenDriftskostnad`), and the document basis and its parts.
 */
export const DOCUMENT_SERVER_FIELDS: readonly string[] = [
  ...Object.values(DOCUMENT_FIGURE_COLUMNS),
  ...DOCUMENT_FIELDS.filter((field) => /[A-Z]/.test(field)),
  'documentBasis',
  'documentBenchmark',
  'turnoverBenchmark',
  'document_status',
  'current_status',
  'prior_status',
  'prior_api_fail_fields',
  'in_manifest',
  'priorRevenueFailsApi',
  'numeratorOre',
  'denominatorOre',
];

/**
 * The single-word engine names (`kundefordringer`, `varekostnad`), which
 * Norwegian copy may contain ("varekostnad og andre driftskostnader …"):
 * found only as an object key, `"kundefordringer":` in the RSC payload and
 * `\"kundefordringer\":` inside the HTML's inline payload.
 */
const DOCUMENT_KEYS = DOCUMENT_FIELDS.filter((field) => !/[A-Z]/.test(field)).map(
  (field) => new RegExp(`"${field}\\\\?"\\s*:`),
);

/** The document fields found in `body`: names, keys and the `cur_`/`pri_` columns. */
function documentFieldsIn(body: string): string[] {
  return [
    ...DOCUMENT_SERVER_FIELDS.filter((field) => body.includes(field)),
    ...DOCUMENT_KEYS.filter((key) => key.test(body)).map(String),
    ...(/\b(cur|pri)_[a-z]/.test(body) ? ['cur_/pri_'] : []),
  ];
}

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
    /** Orgnrs the page may carry: those the URL names, and on Peers the group's. */
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
    expect(documentFieldsIn(body), label).toEqual([]);
  }
}

/**
 * The page at `url` and its RSC payload carry no document field and none of
 * `ore`, the document lines in øre of its subject and its peers, as digits
 * without the sign; amounts under 6 digits are skipped, as above.
 */
export async function expectNoDocumentFields(
  request: APIRequestContext,
  url: string,
  { ore, marker }: { readonly ore: readonly string[]; readonly marker: string },
): Promise<void> {
  const html = await (await request.get(url)).text();
  const rsc = await request.get(url, { headers: { RSC: '1' } });
  expect(rsc.headers()['content-type']).toContain('text/x-component');
  const payload = await rsc.text();
  const amounts = [...new Set(ore.map((amount) => amount.replace(/^-/, '')).filter((digits) => digits.length >= 6))];
  expect(amounts.length).toBeGreaterThan(10);
  for (const [label, body] of [
    ['html', html],
    ['rsc', payload],
  ] as const) {
    expect(body, label).toContain(marker);
    expect(amounts.filter((digits) => new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(body)), label).toEqual([]);
    expect(SERVER_FIELDS.filter((field) => body.includes(field)), label).toEqual([]);
    expect(documentFieldsIn(body), label).toEqual([]);
  }
}
