// Story 5.4 review: the payload scans (AD-4, e2e/payload.ts) on the real
// demo companies, whose peers have committed document figures: demo A's and
// demo B's Oversikt, Nøkkeltall and Verdi at the default band, and demo A's
// Nøkkeltall with one peer excluded, where each capital figure's drill-down
// counts one peer fewer for its read dates (FR-64). The drill-down field
// names each tab shows are written out from docs/key-figures.md's formulas
// for the amounts the engine gives on the committed seed, plus the
// operands of a derived input (the engine's derivation rule); every
// fixture state is asserted before it is used.
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { largestCapitalGap, type DocumentBenchmark } from '../src/engine/benchmark.ts';
import type { DocumentField } from '../src/engine/document-inputs.ts';
import { documentInput } from '../src/engine/provenance.ts';
import { expectNoDocumentFields, expectNoPeerFields } from './payload.ts';
import { documentLines, expectedDocumentBenchmark, expectedWaterfall, peerDocumentBases, seedDocumentBasis } from './seed-documents.ts';
import { PROFIT_DRILL_FIELDS, expectProfitInputsStated, expectedGroup, expectedPool } from './seed.ts';

const KFD = ['kundefordringer', 'salgsinntekt'] as const;
const LGD = ['leverandorgjeld', 'varekostnad', 'annenDriftskostnad'] as const;
const OML = ['sumDriftsinntekter', 'sumEiendeler', 'bankinnskudd'] as const;
const WATERFALL = ['sumDriftsinntekter', 'driftsresultat', 'varekostnad', 'lonnskostnad', 'annenDriftskostnad'] as const;

/** `fields` and, for each one the subject's current column derives, the operands of its rule. */
function withDerivations(orgnr: string, fields: readonly DocumentField[]): string[] {
  const basis = seedDocumentBasis(orgnr, 2025);
  if (basis.kind !== 'read') throw new Error(`${orgnr}: the demo company's 2025 document is read`);
  return fields.flatMap((field) => [field, ...(documentInput(basis.current, field)?.derivation?.operands.map((op) => op.field) ?? [])]);
}

/** The capital parts with a drill-down on the tab: (9)–(11) with an amount; the capital card's choice on Oversikt. */
function capitalFields(orgnr: string, document: DocumentBenchmark, tab: 'oversikt' | 'nokkeltall' | 'verdi'): string[] {
  const amount = (key: 'kfd' | 'lgd' | 'oml') => document[key].gap.kind === 'amount';
  const lists = { kfd: KFD, lgd: LGD, oml: OML } as const;
  let keys: ('kfd' | 'lgd' | 'oml')[];
  if (tab === 'oversikt') {
    const choice = largestCapitalGap(document.kfd.gap, document.lgd.gap, document.oml.gap);
    if (choice.kind !== 'amount') throw new Error(`${orgnr}: the capital card has an amount`);
    // Working capital's drill-down shows each part that is an amount or a strength; (11) its own.
    keys = choice.figure === 'oml' ? ['oml'] : (['kfd', 'lgd'] as const).filter((key) => document[key].gap.kind !== 'none');
  } else {
    // Nøkkeltall: each gap cell with an amount; Verdi: the working-capital card's parts and (11)'s card.
    keys = (['kfd', 'lgd', 'oml'] as const).filter(amount);
  }
  return withDerivations(
    orgnr,
    keys.flatMap((key) => [...lists[key]]),
  );
}

/** Every document line in øre of the subject and its shown peers, for the document scan. */
function lines(orgnr: string, ekskl: readonly string[] = []) {
  const { year, peers } = peerDocumentBases(orgnr, 0, ekskl);
  const peerOre = peers.flatMap((peer) => documentLines(peer.orgnr, year));
  const subjectOre = documentLines(orgnr, year);
  return { ore: [...peerOre, ...subjectOre], peerOre, subjectOre };
}

for (const demo of DEMO_COMPANIES) {
  test.describe(`${demo.navn}: the payload scans on the committed seed`, () => {
    const document = expectedDocumentBenchmark(demo.orgnr, 0);
    const waterfall = expectedWaterfall(demo.orgnr, 0);

    for (const [tab, marker] of [
      ['oversikt', nb['oversikt.capital.kicker']],
      ['nokkeltall', nb['keyFigures.regionLabel']],
      ['verdi', 'VerdiPanel'],
    ] as const) {
      test(`${tab}: no peer field, no document line in øre, exactly the drill-downs' names`, async ({ request }) => {
        expectProfitInputsStated(demo.orgnr);
        const fields = [
          ...PROFIT_DRILL_FIELDS,
          ...capitalFields(demo.orgnr, document, tab),
          ...(tab === 'nokkeltall' && waterfall.kind === 'decomposition' ? withDerivations(demo.orgnr, [...WATERFALL]) : []),
        ];
        const url = `/analyse/${demo.orgnr}/${tab}`;
        await expectNoPeerFields(request, url, { pool: expectedPool(demo.orgnr, 0), marker, fields });
        await expectNoDocumentFields(request, url, { ...lines(demo.orgnr), marker, fields });
      });
    }
  });
}

test('demo A with one peer excluded: Nøkkeltall answers 200 and carries no peer field', async ({ request }) => {
  const [demo] = DEMO_COMPANIES;
  // The first group member with a read document, so the capital figures count one peer fewer.
  const { peers } = peerDocumentBases(demo.orgnr, 0);
  const excluded = peers.find((peer) => peer.basis.kind === 'read')?.orgnr;
  if (excluded === undefined) throw new Error('demo A has a peer with a read document');
  expect(expectedGroup(demo.orgnr, 0).map((peer) => peer.orgnr)).toContain(excluded);
  const document = expectedDocumentBenchmark(demo.orgnr, 0, [excluded]);
  const waterfall = expectedWaterfall(demo.orgnr, 0, [excluded]);
  const url = `/analyse/${demo.orgnr}/nokkeltall?ekskl=${excluded}`;
  expect((await request.get(url)).status()).toBe(200);
  const fields = [
    ...PROFIT_DRILL_FIELDS,
    ...capitalFields(demo.orgnr, document, 'nokkeltall'),
    ...(waterfall.kind === 'decomposition' ? withDerivations(demo.orgnr, [...WATERFALL]) : []),
  ];
  const marker = nb['keyFigures.regionLabel'];
  await expectNoPeerFields(request, url, { pool: expectedPool(demo.orgnr, 0), marker, fields, inUrl: [excluded] });
  await expectNoDocumentFields(request, url, { ...lines(demo.orgnr, [excluded]), marker, fields });
});
