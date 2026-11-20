// A subject whose document rows are all compared (Story 3.1b, decision 4;
// FR-21, FR-22, FR-24, FR-29), against the production build: the synthetic
// subject and its ten synthetic peers of e2e/synthetic.ts, each with a
// reconciled 2025 document, committed for this spec only and removed before
// and after it. It runs in the `synthetic` project, after every other spec
// (playwright.config.ts), so no other spec sees them.
//
// Every document row is checked against the engine run on the fixture's own
// figures here (an oracle independent of the page's view builder), one
// exclusion takes every document row below the floor, and the page carries
// no document field and no document line in øre.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  allFilings,
  companyByOrgnr,
  comparability,
  keyFigureRow,
  keyFigures,
  noSidewaysScroll,
  ore,
  orNull,
  rendered,
  type SeedCandidate,
} from './seed.ts';
import { assemblePeerGroup, V1_FUNNEL, type FunnelSubject } from '../src/engine/peers.ts';
import { expectNoDocumentFields, expectWireSet } from './payload.ts';
import {
  SYNTHETIC_DOCUMENTS,
  insertSyntheticDocuments,
  removeSyntheticDocuments,
  syntheticDocumentCompanies,
  type SyntheticDocumentCompany,
} from './synthetic.ts';
import { benchmarkApiFigures, benchmarkDocumentFigures, largestCapitalGap, workingCapitalReleased } from '../src/engine/benchmark.ts';
import { medianStep } from '../src/engine/closable.ts';
import { Decimal } from '../src/engine/decimal.ts';
import { apiInputsFromRow } from '../src/engine/inputs.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  documentBasis,
  type DocumentBasis,
  type DocumentColumnRow,
  type DocumentField,
} from '../src/engine/document-inputs.ts';
import {
  formatDays,
  formatKroner,
  formatKronerExact,
  formatPercent,
  formatSignedKroner,
  formatTurnover,
  formatWholePercent,
} from '../src/engine/format.ts';
import { BAR_FIGURE, marginWaterfall } from '../src/engine/waterfall.ts';
import { MAX_EKSKL } from '../src/url/analysis-state.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };

const { subject, peers, filingYear } = SYNTHETIC_DOCUMENTS;
const base = `/analyse/${subject.orgnr}`;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await insertSyntheticDocuments();
});

test.afterAll(async () => {
  await removeSyntheticDocuments();
});

/** A column as the read returns it: every figure column, null where the fixture leaves it empty. */
function column(lines: SyntheticDocumentCompany['current']): DocumentColumnRow {
  const fields = Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[];
  return {
    status: 'reconciled',
    ...Object.fromEntries(fields.map((field) => [DOCUMENT_FIGURE_COLUMNS[field], lines[field] ?? null])),
  } as DocumentColumnRow;
}

/** The fixture company's document basis, as the server decides it from the committed rows. */
function basisOf(company: SyntheticDocumentCompany): DocumentBasis {
  return documentBasis({
    inManifest: true,
    filingYear,
    document: { status: 'reconciled', current: column(company.current), prior: column(company.prior), priorApiFailFields: [] },
    sumOmloepsmidler: BigInt(company.keyFigures.sum_omloepsmidler_ore),
  });
}

const expected = benchmarkDocumentFigures(basisOf(subject), peers.map(basisOf), 'NOK');

/** The margin waterfall over the fixture (Story 3.3): the seed's companies in the band have no document, so P is the ten. */
const expectedWaterfall = marginWaterfall(basisOf(subject), peers.map(basisOf), filingYear, 'NOK');

/** The document rows with a comparison, each with how its values are written. 7 and 8 are not read in v1. */
const ROWS = [
  ['ebitda', formatPercent],
  ['vare', formatPercent],
  ['lonn', formatPercent],
  ['andre', formatPercent],
  ['total', formatPercent],
  ['kfd', formatDays],
  ['lgd', formatDays],
  ['oml', formatTurnover],
  ['kontant', formatPercent],
  ['vekst', formatPercent],
] as const;

const region = (page: Page) => page.getByRole('region', { name: nb['keyFigures.regionLabel'] });
const desktopRow = (page: Page, figure: string) => region(page).locator(`tr[data-figure="${figure}"]`);
const cell = (page: Page, figure: string, name: string) => desktopRow(page, figure).locator(`td[data-cell="${name}"]`);

/** The group's size, from the header: the synthetic peers and the seed's companies in the band. */
async function groupSize(page: Page): Promise<number> {
  const count = page.getByTestId('header-peer-count');
  await expect(count).toHaveText(/^\d+ sammenlignbare$/);
  return Number((await count.innerText()).split(' ')[0]);
}

test('every document row is compared against the engine', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/nokkeltall`);
  await expect(rendered(page)).toBeVisible();
  // The seed's companies in the band have no document figures: left out of every document row.
  const leftOut = (await groupSize(page)) - peers.length;
  expect(leftOut).toBeGreaterThanOrEqual(0);
  await expect(page.getByText(nb['keyFigures.notInDataset.state'])).toHaveCount(0);
  for (const [key, format] of ROWS) {
    const figure = expected[key];
    const c = figure.comparison;
    if (c.kind !== 'compared') throw new Error(`the fixture's ${key} is not compared`);
    expect(c.count, key).toBe(peers.length);
    await expect(cell(page, key, 'own'), key).toHaveText(format(c.subject.toString()));
    await expect(cell(page, key, 'median'), key).toHaveText(format(c.median.toString()));
    await expect(desktopRow(page, key).locator('th'), key).toContainText(`${c.count} sammenlignbare brukt · ${leftOut} utelatt`);
    if (c.best !== null) {
      await expect(cell(page, key, 'best'), key).toHaveText(format(c.best.quartile.toString()));
      await expect(cell(page, key, 'placement'), key).toHaveText(`bedre enn ${formatWholePercent(c.best.percentile.toString())}`);
    } else {
      await expect(cell(page, key, 'best'), key).not.toContainText(/\d/);
      await expect(cell(page, key, 'placement'), key).not.toContainText(/bedre enn/);
    }
  }
  // The kroner: a capital amount for 9, 10 and 11, each rounded once from the engine's exact øre.
  for (const key of ['kfd', 'lgd', 'oml'] as const) {
    const gap = expected[key].gap;
    if (gap.kind !== 'amount') throw new Error(`the fixture's ${key} has no capital amount`);
    // Story 3.7: followed by its "Hvordan er dette regnet?".
    await expect(cell(page, key, 'gap'), key).toHaveText(`${formatKronerExact(gap.ore.toString())}${nb['keyFigures.oneOff']}${nb['provenance.trigger']}`);
  }
  for (const key of ['vare', 'lonn', 'andre']) {
    await expect(cell(page, key, 'gap'), key).toHaveText(nb['keyFigures.costShare.kroner']);
  }
  await expect(cell(page, 'ebitda', 'gap')).toHaveText(nb['keyFigures.noKroner']);
  // 7 and 8 are not read in v1, whatever the document.
  for (const key of ['omsArsverk', 'lonnArsverk']) {
    await expect(cell(page, key, 'own'), key).toContainText(nb['analysis.figures.notReadInV1']);
  }
  // Story 3.2: a subject in the demo data. The pay fold-out is not read in v1
  // either, with no median; the margin fold-out compares both factors.
  const pay = region(page).locator('tr[data-foldout="pay"]');
  await pay.getByRole('button', { name: nb['keyFigures.foldout.pay'] }).click();
  const payFactors = pay.locator('[data-factor]');
  await expect(payFactors).toHaveCount(2);
  for (const i of [0, 1]) await expect(payFactors.nth(i)).toContainText(nb['analysis.figures.notReadInV1']);
  await expect(pay).not.toContainText(nb['keyFigures.col.median']);
  const margin = region(page).locator('tr[data-foldout="margin"]');
  await margin.getByRole('button', { name: nb['keyFigures.foldout.margin'] }).click();
  const marginFactors = margin.locator('[data-factor]');
  await expect(marginFactors).toHaveCount(2);
  for (const i of [0, 1]) {
    await expect(marginFactors.nth(i)).toContainText(nb['keyFigures.col.median']);
    await expect(marginFactors.nth(i).getByTestId('distribution-strip')).toHaveCount(1);
  }
});

test('excluding one peer puts the document rows below the floor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/peers`);
  const peer = peers[0];
  if (peer === undefined) throw new Error('the fixture has no peers');
  const action = page.locator(`[data-peer-action="${peer.orgnr}"]:visible`);
  await expect(action).toHaveText(nb['peers.action.exclude']);
  await action.click();
  await expect.poll(() => new URL(page.url()).search).toBe(`?ekskl=${peer.orgnr}`);
  await page.getByRole('link', { name: nb['tabs.nokkeltall'] }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(nb['tabs.nokkeltall']);
  for (const [key] of ROWS) {
    await expect(cell(page, key, 'merged'), key).toHaveText('For få sammenlignbare (9 av 10)');
    await expect(desktopRow(page, key).locator('th'), key).toContainText('9 sammenlignbare brukt');
  }
  await expect(region(page).locator('tr[data-figure="kfd"]')).not.toContainText(/\d\skr/);
  // The subject is not a small enterprise (smaa_foretak false), so a document row below the floor shows the notice.
  await expect(page.getByTestId('non-small-notice')).toHaveText(nb['keyFigures.nonSmall']);
});

/** Every document line in øre of the fixture, and the waterfall's aggregate, exact total and bars in øre (Story 3.3). */
function documentOre(): string[] {
  if (expectedWaterfall.kind !== 'decomposition') throw new Error('the fixture has a waterfall');
  const sum = (field: 'sumDriftsinntekter' | 'driftsresultat' | 'varekostnad' | 'lonnskostnad' | 'annenDriftskostnad') =>
    String(peers.reduce((total, peer) => total + BigInt(peer.current[field] ?? '0'), 0n));
  const aggregate = [
    sum('sumDriftsinntekter'),
    sum('driftsresultat'),
    sum('varekostnad'),
    sum('lonnskostnad'),
    sum('annenDriftskostnad'),
    expectedWaterfall.totalOre.numerator.toString(),
    ...expectedWaterfall.steps.map((step) => step.ore.numerator.toString()),
  ];
  return [
    ...syntheticDocumentCompanies().flatMap((company) => [...Object.values(company.current), ...Object.values(company.prior)]),
    ...aggregate,
  ];
}

// Story 3.7, decision 6: the field names each drill-down shows, written out from
// docs/key-figures.md's formulas (the subject's inputs; the fixture states every line,
// so nothing is derived), and every company's document lines, which no peer's may
// reach the page even as kroner.
const PROFIT_FIELDS = ['driftsresultat', 'sumDriftsinntekter'];
const KFD_FIELDS = ['kundefordringer', 'salgsinntekt'];
const LGD_FIELDS = ['leverandorgjeld', 'varekostnad', 'annenDriftskostnad'];
const OML_FIELDS = ['sumDriftsinntekter', 'sumEiendeler', 'bankinnskudd'];
const linesOf = (company: SyntheticDocumentCompany) => [...Object.values(company.current), ...Object.values(company.prior)];
const LINES = { peerOre: peers.flatMap(linesOf), subjectOre: linesOf(subject) };

test('no document øre reaches the page', async ({ request }) => {
  // The fixture's state: 9, 10 and 11 each have an amount, so each gap cell has its drill-down.
  expect([expected.kfd.gap.kind, expected.lgd.gap.kind, expected.oml.gap.kind]).toEqual(['amount', 'amount', 'amount']);
  await expectNoDocumentFields(request, `${base}/nokkeltall`, {
    ore: documentOre(),
    marker: nb['keyFigures.regionLabel'],
    fields: [...PROFIT_FIELDS, ...KFD_FIELDS, ...LGD_FIELDS, ...OML_FIELDS],
    ...LINES,
  });
});

// Story 3.7 (decision 4): the fixture's current column reconciled and its API comparison passed
// (e2e/synthetic.ts), so the profit, whose two inputs both sources hold, is "Avstemt"; a capital
// amount reads lines no check covers, so it never is, and names them. Each amount is the engine's.
test('the drill-downs: the profit Avstemt, each capital amount not checked, with its lines', async ({ page }) => {
  const { kfd, lgd, oml } = expected;
  if (kfd.gap.kind !== 'amount' || lgd.gap.kind !== 'amount' || oml.gap.kind !== 'amount') {
    throw new Error('the fixture has an amount on 9, 10 and 11');
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/nokkeltall`);
  await expect(region(page)).toBeVisible();
  const opened = async (key: string) => {
    await region(page).locator(`[data-provenance-trigger="kf-d-prov-${key}"]`).click();
    const body = region(page).locator(`[data-provenance-body="kf-d-prov-${key}"]`);
    await expect(body).toBeVisible();
    return body;
  };
  await expect((await opened('driftsmargin')).locator('[data-provenance-quality]')).toHaveText(nb['provenance.quality.reconciled']);
  const notCompared = (felt: string) => nb['provenance.quality.notCompared'].replace('{felt}', felt);
  for (const [key, gap, felt] of [
    ['kfd', kfd.gap, 'kundefordringer, salgsinntekt'],
    ['lgd', lgd.gap, 'leverandorgjeld, varekostnad, annenDriftskostnad'],
    ['oml', oml.gap, 'bankinnskudd'],
  ] as const) {
    const body = await opened(key);
    await expect(body.locator('[data-provenance-quality]'), key).toHaveText(notCompared(felt));
    await expect(body, key).toContainText(`${formatKronerExact(gap.ore.toString())} ${nb['keyFigures.oneOff']}`);
    await expect(body, key).toContainText(nb['provenance.fromDocument']);
    await expect(body, key).toContainText(nb['provenance.source.document']);
  }
  // Verdi's working-capital card: one drill-down, both parts.
  await page.goto(`${base}/verdi`);
  const card = rendered(page).getByTestId('verdi-working-capital');
  await card.locator('[data-provenance-trigger="verdi-prov-working-capital"]').click();
  const wc = card.locator('[data-provenance-body="verdi-prov-working-capital"]');
  await expect(wc).toBeVisible();
  await expect(wc).toContainText(nb['fig.kfd']);
  await expect(wc).toContainText(nb['fig.lgd']);
  await expect(wc).toContainText(`${formatKronerExact(kfd.gap.ore.plus(lgd.gap.ore).toString())} ${nb['keyFigures.oneOff']}`);
  await noSidewaysScroll(page);
});

// Story 3.4: Oversikt's "Største kapitalgap" over the fixture.
const CAPITAL_LABEL = { working_capital: nb['oversikt.capital.workingCapital'], kfd: nb['fig.kfd'], lgd: nb['fig.lgd'], oml: nb['fig.oml'] };

test('the capital card shows the engine’s largest amount', async ({ page }) => {
  // Fixture (e2e/synthetic.ts, in its own words): the subject is worse than beste fjerdedel on
  // receivable days (9), payable days (10) and operating asset turnover (11), so each has a
  // capital amount, and 9 and 10 make a working-capital total.
  const { kfd, lgd, oml } = expected;
  if (kfd.gap.kind !== 'amount' || lgd.gap.kind !== 'amount' || oml.gap.kind !== 'amount') {
    throw new Error('the fixture has an amount on 9, 10 and 11');
  }
  // The oracle, written out here rather than taken from the engine's choice: the working-capital
  // total (9 + 10) against (11), the larger exact amount, the total on a tie.
  const total = kfd.gap.ore.plus(lgd.gap.ore);
  const largest = oml.gap.ore.gt(total) ? { figure: 'oml' as const, ore: oml.gap.ore } : { figure: 'working_capital' as const, ore: total };
  const choice = largestCapitalGap(kfd.gap, lgd.gap, oml.gap);
  expect(choice).toMatchObject({ kind: 'amount', figure: largest.figure });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/oversikt`);
  const capital = rendered(page).getByTestId('card-capital');
  await expect(capital.locator('[data-card="name"]')).toHaveText(CAPITAL_LABEL[largest.figure]);
  await expect(capital.locator('[data-card="value"]')).toHaveText(
    nb['oversikt.capital.amount'].replace('{belop}', formatKronerExact(largest.ore.toString())),
  );
  // Story 3.5: the top note, with "· Endre i Verdi", then the separation line.
  const note = capital.getByTestId('top-note');
  await expect(note).toHaveText(`${nb['keyFigures.topNote']} · ${nb['keyFigures.editInVerdi']}`);
  await expect(note.getByRole('link', { name: nb['keyFigures.editInVerdi'] })).toHaveAttribute('href', `${base}/verdi`);
  await expect(capital.locator('[data-card="line"]')).toHaveText([nb['oversikt.capital.notPerYear']]);
  // One amount: never a second figure's, never a sum with 11.
  await expect(capital).toContainText(/\d\skr/);
  expect((await capital.innerText()).match(/\d\skr/g)).toHaveLength(1);
});

test('no document øre reaches Oversikt', async ({ request }) => {
  // Fixture: the synthetic subject and its ten peers; the exact øre of (9), (10), (11) and the
  // working-capital total added to the scan, each as its whole part and as its digits without the point.
  const { kfd, lgd, oml } = expected;
  if (kfd.gap.kind !== 'amount' || lgd.gap.kind !== 'amount' || oml.gap.kind !== 'amount') {
    throw new Error('the fixture has an amount on 9, 10 and 11');
  }
  const capital = [kfd.gap.ore, lgd.gap.ore, oml.gap.ore, kfd.gap.ore.plus(lgd.gap.ore)].flatMap((ore) => [
    ore.floor().toString(),
    ore.toString().replace('.', ''),
  ]);
  const choice = largestCapitalGap(kfd.gap, lgd.gap, oml.gap);
  if (choice.kind !== 'amount') throw new Error('the fixture has a capital amount');
  await expectNoDocumentFields(request, `${base}/oversikt`, {
    ore: [...documentOre(), ...capital],
    marker: nb['oversikt.capital.kicker'],
    // Story 3.7: the hero's drill-down and the capital card's, of the amount it shows.
    fields: [...PROFIT_FIELDS, ...(choice.figure === 'oml' ? OML_FIELDS : [...KFD_FIELDS, ...LGD_FIELDS])],
    ...LINES,
  });
});

// Story 3.5: Verdi on the synthetic subject, whose 9, 10 and 11 each have an amount.
// The profit oracle is the engine's benchmark over the group the funnel gives the
// subject here: the ten synthetic peers and the seed's companies in its band, rebuilt
// from the seed's files and the fixture (the server reads the same rows), and the
// group's size is asserted against the page's first.
const SYNTHETIC_FILING = {
  regnskapstype: 'SELSKAP',
  periodeFra: '2025-01-01',
  periodeTil: '2025-12-31',
  valuta: 'NOK',
  regnskapsregler: 'regnskapslovenAlminneligRegler',
  smaaForetak: false,
  avviklingsregnskap: false,
} as const;

function syntheticCandidate(company: SyntheticDocumentCompany): SeedCandidate {
  return {
    orgnr: company.orgnr,
    navn: company.navn,
    organisasjonsform: 'AS',
    naeringskode1: '62.100',
    brregId: BigInt(company.brregId),
    filingYear,
    sumDriftsinntekter: BigInt(company.keyFigures.sum_driftsinntekter_ore),
    fingerprint: null,
    classification: null,
    ...SYNTHETIC_FILING,
  };
}

const syntheticGroup = (() => {
  const seedCandidates: SeedCandidate[] = allFilings
    .filter((f) => f.filing_year === String(filingYear) && companyByOrgnr.get(f.orgnr ?? '')?.naeringskode1 === '62.100')
    .map((f) => {
      const c = companyByOrgnr.get(f.orgnr ?? '');
      return {
        orgnr: f.orgnr ?? '',
        navn: c?.navn ?? '',
        organisasjonsform: orNull(c?.organisasjonsform),
        naeringskode1: orNull(c?.naeringskode1),
        brregId: BigInt(f.brreg_id ?? '0'),
        filingYear,
        sumDriftsinntekter: ore(keyFigures.get(f.brreg_id ?? '')?.sum_driftsinntekter_ore),
        fingerprint: null,
        classification: null,
        ...comparability(f),
      };
    });
  const funnel: FunnelSubject = {
    orgnr: subject.orgnr,
    naeringskode1: '62.100',
    filingYear,
    sumDriftsinntekter: BigInt(subject.keyFigures.sum_driftsinntekter_ore),
    fingerprint: null,
    classification: null,
    ...SYNTHETIC_FILING,
  };
  return assemblePeerGroup(funnel, [...seedCandidates, ...peers.map(syntheticCandidate)], 0, V1_FUNNEL).group;
})();

const syntheticByOrgnr = new Map(peers.map((peer) => [peer.orgnr, peer]));
const apiExpected = benchmarkApiFigures(
  apiInputsFromRow(subject.keyFigures),
  syntheticGroup.map((member) => {
    const synthetic = syntheticByOrgnr.get(member.orgnr);
    return apiInputsFromRow(synthetic !== undefined ? synthetic.keyFigures : keyFigureRow(String(member.brregId)));
  }),
  'NOK',
);

function verdiOracle() {
  const c = apiExpected.driftsmargin.comparison;
  const gap = apiExpected.driftsmargin.gap;
  if (c.kind !== 'compared' || gap.kind !== 'amount') throw new Error('the fixture has a driftsmargin amount');
  const { kfd, lgd, oml } = expected;
  if (kfd.gap.kind !== 'amount' || lgd.gap.kind !== 'amount' || oml.gap.kind !== 'amount') {
    throw new Error('the fixture has an amount on 9, 10 and 11');
  }
  const total = workingCapitalReleased(kfd.gap, lgd.gap);
  if (total.kind !== 'amount') throw new Error('the fixture has a working-capital total');
  return { step: medianStep(c), profitFull: gap.ore, kfd: kfd.gap.ore, lgd: lgd.gap.ore, total: total.ore, oml: oml.gap.ore };
}

const kroner = (ore: Decimal) => formatKronerExact(ore.toString());
const capitalText = (ore: Decimal, factor: Decimal) => `${kroner(ore.mul(factor))} av ${kroner(ore)}`;

test('Verdi: the three cards against the engine, the median step disabled with its reason', async ({ page }) => {
  const o = verdiOracle();
  // The fixture's state: the subject's driftsmargin (22 %) is above the group's median, so there is no
  // median step, while every card has an amount.
  expect(o.step).toEqual({ kind: 'none', reason: 'above_median' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/verdi`);
  await expect(rendered(page).getByTestId('verdi')).toBeVisible();
  // And the page's group is the oracle's, the ten synthetic peers among it.
  expect(await groupSize(page)).toBe(syntheticGroup.length);
  expect(syntheticGroup.filter((member) => syntheticByOrgnr.has(member.orgnr))).toHaveLength(peers.length);
  const card = (id: string) => rendered(page).getByTestId(id);
  const check = async (factor: Decimal, share: string) => {
    await expect(card('verdi-profit').locator('[data-card="amount"]')).toHaveText(`${kroner(o.profitFull.mul(factor))} av ${kroner(o.profitFull)} per år`);
    const parts = card('verdi-working-capital').locator('[data-card="parts"] li');
    await expect(parts).toHaveCount(2);
    await expect(parts.first()).toContainText(`${nb['fig.kfd']}: ${capitalText(o.kfd, factor)}`);
    await expect(parts.nth(1)).toContainText(`${nb['fig.lgd']}: ${capitalText(o.lgd, factor)}`);
    await expect(card('verdi-working-capital').locator('[data-card="amount"]')).toHaveText(capitalText(o.total, factor));
    await expect(card('verdi-oml').locator('[data-card="amount"]')).toHaveText(capitalText(o.oml, factor));
    for (const id of ['verdi-working-capital', 'verdi-oml']) {
      await expect(card(id).locator('[data-card="share"]')).toHaveText(nb['verdi.capital.share'].replace('{andel}', formatWholePercent(share)));
    }
    // No displayed total adds two cards: the page shows no sum of any two or three of them.
    const text = await rendered(page).getByTestId('verdi-cards').innerText();
    for (const sum of [o.profitFull.plus(o.total), o.profitFull.plus(o.oml), o.total.plus(o.oml), o.profitFull.plus(o.total).plus(o.oml)]) {
      expect(text).not.toContain(kroner(sum.mul(factor)));
    }
  };
  await check(new Decimal('0.5'), '50');
  // The median step: last, aria-disabled, focusable, described by its reason; choosing it changes nothing.
  const median = page.locator('[data-share-step="median"]');
  await expect(median).toHaveText(nb['verdi.step.medianNone']);
  await expect(median).toHaveAttribute('aria-disabled', 'true');
  const reason = nb['verdi.median.above'].replace('{selskap}', subject.navn);
  await expect(page.locator(`#${await median.getAttribute('aria-describedby')}`)).toHaveText(reason);
  await page.locator('[data-share-step="100"]').click();
  // replaceState writes the URL before React renders the cards again (PR #78, CI): read them only once
  // the step is checked and the profit card is at 100 %.
  await expect(page.locator('[data-share-step="100"]')).toHaveAttribute('aria-checked', 'true');
  await expect(card('verdi-profit').locator('[data-card="share"]')).toHaveText(nb['verdi.profit.share'].replace('{andel}', formatWholePercent('100')));
  // The arrow keys reach the disabled step: focus on it, nothing chosen, the URL and the cards unchanged.
  const cardsBefore = await rendered(page).getByTestId('verdi-cards').innerText();
  await page.keyboard.press('ArrowRight');
  await expect(median).toBeFocused();
  await expect(median).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('[data-share-step="100"]')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => new URL(page.url()).search).toBe('?andel=100');
  await expect.poll(() => rendered(page).getByTestId('verdi-cards').innerText()).toBe(cardsBefore);
  // From the first step, ArrowLeft wraps to it too.
  await page.locator('[data-share-step="0"]').click();
  await page.keyboard.press('ArrowLeft');
  await expect(median).toBeFocused();
  await expect.poll(() => new URL(page.url()).search).toBe('?andel=0');
  // Clicking the step the control still shows as checked does nothing: wait for 0 to be rendered first.
  await expect(page.locator('[data-share-step="0"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('[data-share-step="100"]').click();
  await page.keyboard.press('ArrowRight');
  await expect(median).toBeFocused();
  // Space on it: Playwright counts aria-disabled as disabled and would not click it.
  await page.keyboard.press('Space');
  await expect.poll(() => new URL(page.url()).search).toBe('?andel=100');
  await check(new Decimal(1), '100');
  // Each card's median line is its own figure's: the profit card "allerede over".
  await expect(card('verdi-profit').locator('[data-card="median"]')).toHaveText(nb['verdi.cardMedian.above']);
  await page.locator('[data-share-step="75"]').click();
  await expect.poll(() => new URL(page.url()).search).toBe('?andel=75');
  await check(new Decimal('0.75'), '75');
});

test('Verdi carries exactly the wire set and no document øre', async ({ request }) => {
  const o = verdiOracle();
  // The fixture's state: no median step, so no s_med and no profit at the median cross.
  expect(o.step.kind).toBe('none');
  const wire = [o.profitFull, o.kfd, o.lgd, o.total, o.oml].map((value) => value.toString()).sort();
  await expectWireSet(request, `${base}/verdi`, subject.orgnr, wire);
  await expectNoDocumentFields(request, `${base}/verdi`, {
    ore: documentOre(),
    marker: 'VerdiPanel',
    // Story 3.7: the three cards' drill-downs (no multiple, so no EV).
    fields: [...PROFIT_FIELDS, ...KFD_FIELDS, ...LGD_FIELDS, ...OML_FIELDS],
    ...LINES,
  });
});

for (const width of [375, 320]) {
  test(`at ${width} px: every row on the phone, the capital amounts fit, no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/nokkeltall`);
    const phone = page.locator('table[data-layout="phone"]');
    await expect(phone).toBeVisible();
    await expect(phone.locator('button[aria-controls^="kf-p-exp-"]')).toHaveCount(15);
    await noSidewaysScroll(page);
    for (const key of ['kfd', 'lgd', 'oml']) {
      const gap = phone.locator(`tr:has(button[aria-controls="kf-p-exp-${key}"]) td[data-cell="gap"]`);
      await expect(gap, key).toContainText(nb['keyFigures.oneOff']);
      // The amount and its subline stay inside the screen, each on one line.
      for (const part of await gap.locator('span').all()) {
        const box = await part.boundingBox();
        if (box === null) throw new Error(`${key}: no box`);
        expect(box.x + box.width, key).toBeLessThanOrEqual(width);
        expect(box.height, key).toBeLessThan(30);
      }
      await phone.locator(`button[aria-controls="kf-p-exp-${key}"]`).click();
      await expect(page.locator(`[id="kf-p-exp-${key}"]`), key).toBeVisible();
      await noSidewaysScroll(page);
    }
  });
}

// Story 3.3: the margin waterfall fold-out under Driftsmargin.
const waterfallButton = (page: Page, layout: 'desktop' | 'phone') =>
  (layout === 'desktop' ? region(page) : page.locator('table[data-layout="phone"]')).getByRole('button', {
    name: nb['keyFigures.foldout.waterfall'],
  });
const waterfallBody = async (page: Page, layout: 'desktop' | 'phone') =>
  page.locator(`[id="${await waterfallButton(page, layout).getAttribute('aria-controls')}"]`);
/** Whole kroner as the formatter takes them: øre as a whole-number string. */
const kr = (kroner: bigint) => (kroner * 100n).toString();

test('Se forklaring av marginen opens the waterfall', async ({ page }) => {
  for (const [width, layout] of [
    [1280, 'desktop'],
    [375, 'phone'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/nokkeltall`);
    await expect(rendered(page)).toBeVisible();
    const button = waterfallButton(page, layout);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const before = page.url();
    const link =
      layout === 'desktop'
        ? cell(page, 'lonn', 'gap').getByRole('link', { name: nb['keyFigures.costShare.kroner'] })
        : page
            .locator('table[data-layout="phone"] tr:has(button[aria-controls="kf-p-exp-lonn"]) td[data-cell="gap"]')
            .getByRole('link', { name: nb['keyFigures.costShare.kroner'] });
    await link.click();
    // Opened, focus on its heading's button, and no route or URL state.
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toBeFocused();
    await expect(await waterfallBody(page, layout)).toBeVisible();
    expect(page.url()).toBe(before);
  }
});

test('the waterfall against the engine', async ({ page }) => {
  if (expectedWaterfall.kind !== 'decomposition') throw new Error(`the fixture has no waterfall: ${expectedWaterfall.kind}`);
  expect(expectedWaterfall.n).toBe(peers.length);
  const { display, steps } = expectedWaterfall;
  // Start + the four displayed bars = the end, in whole kroner.
  expect(display.startKroner + steps.reduce((total, step) => total + step.kroner, 0n)).toBe(display.endKroner);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/nokkeltall`);
  await waterfallButton(page, 'desktop').click();
  const body = await waterfallBody(page, 'desktop');
  await expect(body.getByTestId('waterfall-tag')).toHaveText(
    `Mot peer-gruppen samlet: ${formatPercent(expectedWaterfall.aggregateMargin.toString())}, ikke beste fjerdedel`,
  );
  await expect(body.getByTestId('waterfall-sentence')).toHaveText(nb['waterfall.neverAdded']);
  await expect(body.locator('[data-wf-value="start"]')).toHaveText(formatKroner(kr(display.startKroner)));
  await expect(body.locator('[data-wf-value="end"]')).toHaveText(formatKroner(kr(display.endKroner)));
  for (const step of steps) {
    // The page names a bar by its cost share's key, never by an engine field name.
    const id = BAR_FIGURE[step.bar] ?? 'residual';
    await expect(body.locator(`[data-wf-value="${id}"]`), step.bar).toHaveText(formatSignedKroner(kr(step.kroner)));
  }
  await expect(body.locator('[data-wf-label="end"]')).toContainText(`margin ${formatPercent(expectedWaterfall.subjectMargin.toString())}`);
  // The chart: a non-focusable image whose name is the summary.
  const chart = body.getByRole('img');
  await expect(chart).toHaveAttribute('focusable', 'false');
  await expect(chart).toHaveAccessibleName(
    `Fra ${formatKroner(kr(display.startKroner))} (peer-gruppen samlet) til ${formatKroner(kr(display.endKroner))}, fire poster, sum ${formatSignedKroner(kr(display.totalKroner))}`,
  );
  // "Vis tallene" opens the table, "Skjul tallene" closes it.
  await body.getByRole('button', { name: nb['chart.showNumbers'] }).click();
  const numbers = body.getByRole('table', { name: nb['waterfall.table.caption'] });
  await expect(numbers).toBeVisible();
  await expect(numbers.getByRole('rowheader')).toHaveText([
    nb['waterfall.start'],
    nb['waterfall.bar.varekostnad'],
    nb['waterfall.bar.lonnskostnad'],
    nb['waterfall.bar.annenDriftskostnad'],
    nb['waterfall.bar.residual'],
    subject.navn,
    nb['waterfall.table.reference'],
  ]);
  await body.getByRole('button', { name: nb['chart.hideNumbers'] }).click();
  await expect(numbers).toBeHidden();
});

test('forced colours keep the bars apart', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/nokkeltall`);
  await waterfallButton(page, 'desktop').click();
  const bars = (await waterfallBody(page, 'desktop')).locator('path.wf-bar');
  await expect(bars).toHaveCount(6);
  const styles = await bars.evaluateAll((paths) =>
    paths.map((path) => {
      const style = getComputedStyle(path);
      return {
        kind: path.getAttribute('data-kind') ?? '',
        stroke: style.stroke,
        look: `${style.fill}|${style.stroke}|${style.strokeDasharray}`,
      };
    }),
  );
  // Every bar has an outline in the system's colours (globals.css, `.wf-bar`): not the author's fill alone.
  for (const { kind, stroke } of styles) expect(stroke, kind).not.toBe('none');
  // Each kind drawn one way, and no two kinds alike.
  const byKind = new Map<string, Set<string>>();
  for (const { kind, look } of styles) byKind.set(kind, (byKind.get(kind) ?? new Set<string>()).add(look));
  for (const [kind, looks] of byKind) expect(looks.size, kind).toBe(1);
  const looks = [...byKind.values()].map((set) => [...set][0]);
  expect(new Set(looks).size).toBe(byKind.size);
  expect(byKind.size).toBeGreaterThanOrEqual(4);
});

test('excluding one peer leaves no waterfall', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const peer = peers[0];
  if (peer === undefined) throw new Error('the fixture has no peers');
  // The group's other members: the seed's companies in the band, outside the demo data.
  await page.goto(`${base}/peers`);
  await expect(rendered(page)).toBeVisible();
  const synthetic = new Set(syntheticDocumentCompanies().map((company) => company.orgnr));
  const members = await page
    .locator('[data-peer-action]')
    .evaluateAll((actions) => actions.map((action) => action.getAttribute('data-peer-action') ?? ''));
  const outside = [...new Set(members)].filter((orgnr) => !synthetic.has(orgnr));
  // The fixture's band holds seed companies outside the demo data, and all of
  // them plus the one peer fit under the exclusion cap, so neither step below
  // is a case the URL would refuse.
  expect(outside.length).toBeGreaterThan(0);
  expect(outside.length + 1).toBeLessThanOrEqual(MAX_EKSKL);
  // One synthetic peer excluded: P is 9. With peers outside the demo data making up the 10, N1 (decision 3).
  await page.goto(`${base}/nokkeltall?ekskl=${peer.orgnr}`);
  await waterfallButton(page, 'desktop').click();
  const body = await waterfallBody(page, 'desktop');
  const tooFew = 'Ingen forklaring av marginen: bare 9 sammenlignbare har alle kostnadslinjene (av 10 som trengs).';
  await expect(body.getByTestId('waterfall-absent')).toHaveText(nb['waterfall.notLoaded']);
  await expect(body.getByRole('img')).toHaveCount(0);
  // Those excluded too: 9 with all their lines, none outside the demo data, the too-few words with n.
  const ekskl = [peer.orgnr, ...outside].sort().join(',');
  await page.goto(`${base}/nokkeltall?ekskl=${ekskl}`);
  await waterfallButton(page, 'desktop').click();
  await expect((await waterfallBody(page, 'desktop')).getByTestId('waterfall-absent')).toHaveText(tooFew);
});

for (const width of [375, 320]) {
  test(`phone: the waterfall as rows (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/nokkeltall`);
    await waterfallButton(page, 'phone').click();
    const body = await waterfallBody(page, 'phone');
    const rows = body.locator('[data-wf-row]');
    await expect(rows).toHaveCount(6);
    // The tag, then the sentence, then the rows.
    const tag = await body.getByTestId('waterfall-tag').boundingBox();
    const sentence = await body.getByTestId('waterfall-sentence').boundingBox();
    const first = await rows.first().boundingBox();
    if (tag === null || sentence === null || first === null) throw new Error('the waterfall is not rendered');
    expect(sentence.y).toBeGreaterThan(tag.y);
    expect(first.y).toBeGreaterThan(sentence.y);
    // A 10 px bar per row, each on a track of the same width: one kroner scale.
    const tracks = await rows
      .locator('.wf-bar')
      .evaluateAll((bars) =>
        bars.map((bar) => ({ height: bar.getBoundingClientRect().height, track: bar.parentElement?.getBoundingClientRect().width ?? 0 })),
      );
    expect(tracks).toHaveLength(6);
    for (const { height, track } of tracks) {
      expect(height).toBe(10);
      expect(track).toBe(tracks[0]?.track);
    }
    await noSidewaysScroll(page);
    await body.getByRole('button', { name: nb['chart.showNumbers'] }).click();
    await expect(body.getByRole('table', { name: nb['waterfall.table.caption'] })).toBeVisible();
    await noSidewaysScroll(page);
  });
}
