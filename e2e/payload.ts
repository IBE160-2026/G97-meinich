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
// Story 3.4: `exact` adds strings the page must never carry, such as each
// peer's exact driftsmargin: Oversikt's beeswarm places peers by it on the
// server and sends only formatted strings and plot coordinates.
//
// Story 3.1b: both scans also look for the server's document fields (the
// document lines' names as the engine and the read call them, the
// `cur_`/`pri_` columns, the document basis), and `expectNoDocumentFields`
// scans a page for every document line in øre of its subject and its peers.
//
// Story 3.7 (decision 6): the drill-down's field names are allowed only as
// `<code data-provenance-field>` (or its RSC form); `provenanceFields` takes
// those out first, and every scan below runs on the rest unchanged. The
// names it took out must be exactly `fields`, the subject's inputs for the
// tab's amounts. `expectNoDocumentFields` also refuses a peer's document
// line written in kroner, and both refuse the stored reconciliation
// (`api_check`, `api_fail_fields`, `c1`–`c5`): e2e/payload-scan.ts, whose
// probes are test/payload-scan.test.ts.
import type { APIRequestContext } from '@playwright/test';
import { expect } from './fixtures.ts';
import { SERVER_FIELDS, documentFieldsIn, formattedPeerLinesIn, provenanceFields } from './payload-scan.ts';
import { keyFigureRow, type SeedCandidate } from './seed.ts';

export { SERVER_FIELDS } from './payload-scan.ts';

export async function expectNoPeerFields(
  request: APIRequestContext,
  url: string,
  {
    pool,
    marker,
    inUrl = [],
    exact = [],
    fields,
  }: {
    readonly pool: readonly SeedCandidate[];
    readonly marker: string;
    /** The field names the tab's drill-downs show: exactly the subject's inputs for its amounts (Story 3.7). */
    readonly fields: readonly string[];
    /** Orgnrs the page may carry: those the URL names, and on Peers the group's. */
    readonly inUrl?: readonly string[];
    /** Strings that must not occur at all, such as exact values (Story 3.4). */
    readonly exact?: readonly string[];
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
  for (const [label, full] of [
    ['html', html],
    ['rsc', payload],
  ] as const) {
    const { rest: body, fields: shown } = provenanceFields(full);
    expect(shown, label).toEqual([...new Set(fields)].sort());
    expect(body, label).toContain(marker);
    expect(scanned.filter((peer) => body.includes(peer.orgnr)).map((peer) => peer.orgnr), label).toEqual([]);
    expect(amounts.filter((digits) => new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(body)), label).toEqual([]);
    expect(SERVER_FIELDS.filter((field) => body.includes(field)), label).toEqual([]);
    expect(documentFieldsIn(body), label).toEqual([]);
    expect(exact.filter((value) => body.includes(value)), label).toEqual([]);
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
  {
    ore,
    marker,
    fields,
    peerOre,
    subjectOre,
  }: {
    readonly ore: readonly string[];
    readonly marker: string;
    /** The field names the tab's drill-downs show: exactly the subject's inputs for its amounts (Story 3.7). */
    readonly fields: readonly string[];
    /** The peers' document lines in øre, never on the page even as kroner, and the subject's own (Story 3.7). */
    readonly peerOre: readonly string[];
    readonly subjectOre: readonly string[];
  },
): Promise<void> {
  const html = await (await request.get(url)).text();
  const rsc = await request.get(url, { headers: { RSC: '1' } });
  expect(rsc.headers()['content-type']).toContain('text/x-component');
  const payload = await rsc.text();
  const amounts = [...new Set(ore.map((amount) => amount.replace(/^-/, '')).filter((digits) => digits.length >= 6))];
  expect(amounts.length).toBeGreaterThan(10);
  expect(peerOre.length).toBeGreaterThan(10);
  for (const [label, full] of [
    ['html', html],
    ['rsc', payload],
  ] as const) {
    const { rest: body, fields: shown } = provenanceFields(full);
    expect(shown, label).toEqual([...new Set(fields)].sort());
    expect(formattedPeerLinesIn(full, peerOre, subjectOre), label).toEqual([]);
    expect(body, label).toContain(marker);
    expect(amounts.filter((digits) => new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(body)), label).toEqual([]);
    expect(SERVER_FIELDS.filter((field) => body.includes(field)), label).toEqual([]);
    expect(documentFieldsIn(body), label).toEqual([]);
  }
}

/**
 * Story 3.5 (decision 5): the page's HTML and its RSC payload hold exactly `wire` as long decimal
 * strings and quoted integers of 6 or more digits, besides the subject's
 * orgnr (the route segment): no other exact value, rounded or not.
 */
export async function expectWireSet(request: APIRequestContext, url: string, orgnr: string, wire: readonly string[]): Promise<void> {
  const html = await (await request.get(url)).text();
  const payload = await (await request.get(url, { headers: { RSC: '1' } })).text();
  for (const [label, body] of [
    ['html', html],
    ['rsc', payload],
  ] as const) {
    const quoted = [...body.matchAll(/\\?"(-?\d+(?:\.\d+)?)\\?"/g)]
      .map((match) => match[1] ?? '')
      .filter((value) => value.replace(/[-.]/g, '').length >= 6 || /\.\d{6,}/.test(value));
    // And a long decimal anywhere, quoted or not.
    const decimals = [...body.matchAll(/(?<![\d.])-?\d+\.\d{6,}(?!\d)/g)].map((match) => match[0]);
    const found = new Set([...quoted, ...decimals].filter((value) => value !== orgnr));
    expect([...found].sort(), label).toEqual(wire);
  }
}
