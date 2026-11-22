// The synthetic companies of the e2e suite, each with its orgnr and every
// figure set here and only here:
//
// - SYNTHETIC (Story 2.9, decision 7): a 62.100 AS whose own 2025 document
//   failed reconciliation, for the FR-71 state, which no company in the
//   committed seed is in on the demo pools;
// - SYNTHETIC_USD (Story 2.10, decision 7 as amended): a 62.100 AS filing in
//   USD, whose stage 1 finds the seed's small NOK companies and no company
//   in USD, so its empty reason is `subject_currency`. It has no document
//   and is not on the manifest's list;
// - SYNTHETIC_DOCUMENTS (Story 3.1b, decision 4): one subject and ten peers,
//   each a 62.100 AS with a reconciled current and prior document column
//   for 2025, all on the manifest's list while their spec runs, so every
//   document row of the subject's key-figure table is compared, which no
//   company in the committed seed is (Story 5.4 commits the demo pools).
//
// They are the e2e fixtures that commit rows: the production server reads
// only committed data, so a rolled-back transaction would show it nothing.
// It writes as the database owner (SUPABASE_DB_URL, read as the database
// tests read it), refuses any host but localhost or 127.0.0.1, and removes
// everything it adds before and after its spec (idempotently, so a crashed
// run is cleaned up by the next one): the company row, which takes its
// filing, key figures, document and column by ON DELETE CASCADE, and its
// orgnr on the manifest's list of orgnrs with document figures.
//
// SYNTHETIC's revenue, 2 500 000 kr, and SYNTHETIC_USD's, 500 000, lie
// outside demo A's (26,2 mill. kr) and demo B's (24,9 mill. kr) size bands
// at every step, the widest 0,25–4×, so neither enters a demo pool while it
// exists. SYNTHETIC has a pool of its own among the seed's small 62.100
// companies; SYNTHETIC_USD's widest band, 125 000 – 2 000 000, holds seeded
// NOK companies and none filing in USD (the seed's smallest USD filing in
// 62.100 for 2025 is about 4,2 million).
//
// SYNTHETIC_DOCUMENTS' revenues, 1,1–2,0 milliards for the peers and 1,5 for
// the subject, lie above demo A's and B's widest bands (at most 104,8 mill.
// kr), so none enters a demo pool. The subject's widest band (the widest
// step of SIZE_BANDS, 0,25–4× today: from 375 mill. kr) lies above every
// other company on the manifest's list (the largest has 269 mill. kr in
// 2025), so its document figures are compared
// against exactly the ten synthetic peers; `insertSyntheticDocuments`
// refuses to run otherwise. The seed's companies in its band have no
// document figures, so they are left out of the document rows.
import postgres from 'postgres';
import { Decimal } from '../src/engine/decimal.ts';
import { DOCUMENT_FIGURE_COLUMNS, type DocumentField } from '../src/engine/document-inputs.ts';
import { SIZE_BANDS } from '../src/engine/peers.ts';
import { supabaseDbUrl } from '../test/db/db-env.ts';

export const SYNTHETIC = {
  orgnr: '999999905',
  navn: 'SYNTETISK TESTSELSKAP AS',
  filingYear: 2025,
  brregId: '999999905',
  // Øre. Revenue 2 500 000 kr, driftsresultat −125 000 kr (−5,0 %).
  sumDriftsinntekterOre: '250000000',
  driftsresultatOre: '-12500000',
  sumDriftskostnadOre: '262500000',
  sumEiendelerOre: '120000000',
  sumEgenkapitalOre: '40000000',
  sumGjeldOre: '80000000',
  sumOmloepsmidlerOre: '100000000',
} as const;

export const SYNTHETIC_USD = {
  orgnr: '999999913',
  navn: 'SYNTETISK USD-SELSKAP AS',
  filingYear: 2025,
  brregId: '999999913',
  valuta: 'USD',
  // Hundredths of the filing's currency, stored as øre are. Revenue 500 000, driftsresultat 25 000.
  sumDriftsinntekterOre: '50000000',
  driftsresultatOre: '2500000',
  sumDriftskostnadOre: '47500000',
  sumEiendelerOre: '30000000',
  sumEgenkapitalOre: '10000000',
  sumGjeldOre: '20000000',
} as const;

/** A full 40-hex commit for `reader_commit`; no reader read this row. */
const READER_COMMIT = '0'.repeat(40);

/** The owner connection, refused unless it points at the local database. */
function ownerSql(): postgres.Sql {
  const url = supabaseDbUrl();
  const host = new URL(url).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`the synthetic e2e company is written only to a local database, not ${host}`);
  }
  return postgres(url, { max: 1, onnotice: () => {} });
}

/**
 * Takes the synthetic orgnrs off the manifest's list of orgnrs with document
 * figures, those that are on it, keeping the others in their order.
 */
async function unlistAll(tx: postgres.TransactionSql, orgnrs: readonly string[]): Promise<void> {
  await tx`
    update register.dataset
       set manifest = jsonb_set(
             manifest,
             '{document_figure_orgnrs}',
             coalesce(
               (select jsonb_agg(l.o order by l.n)
                  from jsonb_array_elements_text(manifest -> 'document_figure_orgnrs') with ordinality l (o, n)
                 where l.o <> all(${orgnrs as string[]}::text[])),
               '[]'::jsonb))
     where manifest -> 'document_figure_orgnrs' ?| ${orgnrs as string[]}::text[]`;
}

/** Puts the synthetic orgnrs on the list, in byte order as the export writes it. */
async function listAll(tx: postgres.TransactionSql, orgnrs: readonly string[]): Promise<void> {
  await unlistAll(tx, orgnrs);
  const listed = await tx`
    update register.dataset
       set manifest = jsonb_set(
             manifest,
             '{document_figure_orgnrs}',
             (select jsonb_agg(o order by o collate "C")
                from (select jsonb_array_elements_text(manifest -> 'document_figure_orgnrs') o
                      union all select unnest(${orgnrs as string[]}::text[])) l))`;
  if (listed.count !== 1) throw new Error('no loaded dataset to list the synthetic companies in; run `pnpm seed`');
}

const unlist = (tx: postgres.TransactionSql) => unlistAll(tx, [SYNTHETIC.orgnr]);
const list = (tx: postgres.TransactionSql) => listAll(tx, [SYNTHETIC.orgnr]);

/**
 * Deletes a synthetic company (its rows go by cascade). Never deletes a real
 * company that happens to hold the orgnr: refuses, with nothing deleted.
 */
async function removeCompany(tx: postgres.TransactionSql, company: { readonly orgnr: string; readonly navn: string }): Promise<void> {
  const held = await tx<{ navn: string | null }[]>`select navn from register.company where orgnr = ${company.orgnr}`;
  const holder = held[0];
  if (holder !== undefined && holder.navn !== company.navn) {
    throw new Error(`orgnr ${company.orgnr} is held by another company; the synthetic e2e company refuses to delete it`);
  }
  await tx`delete from register.company where orgnr = ${company.orgnr}`;
}

async function remove(tx: postgres.TransactionSql): Promise<void> {
  await removeCompany(tx, SYNTHETIC);
  await unlist(tx);
}

/**
 * Whether the synthetic orgnr is on the manifest's list: off it, the company
 * is outside the dataset and its document is not read, whatever its status.
 */
export async function setSyntheticListed(listed: boolean): Promise<void> {
  const sql = ownerSql();
  try {
    await sql.begin((tx) => (listed ? list(tx) : unlist(tx)));
  } finally {
    await sql.end();
  }
}

/** Removes the synthetic company, if present. Safe to run any number of times. */
export async function removeSynthetic(): Promise<void> {
  const sql = ownerSql();
  try {
    await sql.begin(remove);
  } finally {
    await sql.end();
  }
}

/** Removes any leftover, then inserts the synthetic company with its failed 2025 document. */
export async function insertSynthetic(): Promise<void> {
  const s = SYNTHETIC;
  const sql = ownerSql();
  try {
    await sql.begin(async (tx) => {
      await remove(tx);
      await tx`
        insert into register.company (orgnr, navn, organisasjonsform, naeringskode1, naeringskode1_beskrivelse,
                                      konkurs, under_avvikling, under_tvangsavvikling, read_at,
                                      forretningsadresse_kommune)
        values (${s.orgnr}, ${s.navn}, 'AS', '62.100', 'Dataprogrammeringstjenester',
                false, false, false, now(), 'OSLO')`;
      await tx`
        insert into register.filing (orgnr, regnskapstype, periode_fra, periode_til, brreg_id, filing_year, valuta,
                                     regnskapsregler, smaa_foretak, avviklingsregnskap, reporting_unit, status, read_at)
        values (${s.orgnr}, 'SELSKAP', '2025-01-01', '2025-12-31', ${s.brregId}, ${s.filingYear}, 'NOK',
                'regnskapslovenAlminneligRegler', true, false, 'api_whole_units', 'not_extracted', now())`;
      await tx`
        insert into register.key_figures (brreg_id, sum_driftsinntekter_ore, driftsresultat_ore, sum_driftskostnad_ore,
                                          sum_eiendeler_ore, sum_egenkapital_gjeld_ore, sum_egenkapital_ore,
                                          sum_gjeld_ore, sum_omloepsmidler_ore)
        values (${s.brregId}, ${s.sumDriftsinntekterOre}, ${s.driftsresultatOre}, ${s.sumDriftskostnadOre},
                ${s.sumEiendelerOre}, ${s.sumEiendelerOre}, ${s.sumEgenkapitalOre}, ${s.sumGjeldOre},
                ${s.sumOmloepsmidlerOre})`;
      await tx`
        insert into register.document (orgnr, filing_year, brreg_id, layout, status, valuta, unit_text, read_at,
                                       dataset, reader_commit)
        values (${s.orgnr}, ${s.filingYear}, ${s.brregId}, 'generated', 'failed_reconciliation', 'NOK', 'NOK', now(),
                'demo', ${READER_COMMIT})`;
      // c1 fails (sum inntekter − sum kostnader is not driftsresultat), so
      // the column fails reconciliation, as the status CHECK requires.
      await tx`
        insert into register.document_column (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, c5, status,
                                              api_check, api_fail_fields, digits_pass_fields, dataset,
                                              sum_driftsinntekter_ore, sum_driftskostnad_ore, driftsresultat_ore)
        values (${s.orgnr}, ${s.filingYear}, 'current', ${s.filingYear}, 'fail', 'not_evaluable', 'not_evaluable',
                'not_evaluable', 'not_evaluable', 'failed_reconciliation', 'not_evaluable', '{}', '{}', 'demo',
                ${s.sumDriftsinntekterOre}, ${s.sumDriftskostnadOre}, '1')`;
      await list(tx);
    });
  } finally {
    await sql.end();
  }
}

/** Removes the USD synthetic company, if present. Safe to run any number of times. */
export async function removeSyntheticUsd(): Promise<void> {
  const sql = ownerSql();
  try {
    await sql.begin((tx) => removeCompany(tx, SYNTHETIC_USD));
  } finally {
    await sql.end();
  }
}

/** Removes any leftover, then inserts the USD synthetic company with its 2025 filing and key figures. */
export async function insertSyntheticUsd(): Promise<void> {
  const s = SYNTHETIC_USD;
  const sql = ownerSql();
  try {
    await sql.begin(async (tx) => {
      await removeCompany(tx, s);
      await tx`
        insert into register.company (orgnr, navn, organisasjonsform, naeringskode1, naeringskode1_beskrivelse,
                                      konkurs, under_avvikling, under_tvangsavvikling, read_at,
                                      forretningsadresse_kommune)
        values (${s.orgnr}, ${s.navn}, 'AS', '62.100', 'Dataprogrammeringstjenester',
                false, false, false, now(), 'OSLO')`;
      await tx`
        insert into register.filing (orgnr, regnskapstype, periode_fra, periode_til, brreg_id, filing_year, valuta,
                                     regnskapsregler, smaa_foretak, avviklingsregnskap, reporting_unit, status, read_at)
        values (${s.orgnr}, 'SELSKAP', '2025-01-01', '2025-12-31', ${s.brregId}, ${s.filingYear}, ${s.valuta},
                'regnskapslovenAlminneligRegler', true, false, 'api_whole_units', 'not_extracted', now())`;
      await tx`
        insert into register.key_figures (brreg_id, sum_driftsinntekter_ore, driftsresultat_ore, sum_driftskostnad_ore,
                                          sum_eiendeler_ore, sum_egenkapital_gjeld_ore, sum_egenkapital_ore, sum_gjeld_ore)
        values (${s.brregId}, ${s.sumDriftsinntekterOre}, ${s.driftsresultatOre}, ${s.sumDriftskostnadOre},
                ${s.sumEiendelerOre}, ${s.sumEiendelerOre}, ${s.sumEgenkapitalOre}, ${s.sumGjeldOre})`;
    });
  } finally {
    await sql.end();
  }
}

/** One synthetic company of SYNTHETIC_DOCUMENTS: its key figures and its 2025 document's two columns, in øre. */
export type SyntheticDocumentCompany = {
  readonly orgnr: string;
  readonly navn: string;
  readonly brregId: string;
  readonly keyFigures: {
    readonly sum_driftsinntekter_ore: string;
    readonly driftsresultat_ore: string;
    readonly sum_driftskostnad_ore: string;
    readonly sum_eiendeler_ore: string;
    readonly sum_egenkapital_gjeld_ore: string;
    readonly sum_egenkapital_ore: string;
    readonly sum_gjeld_ore: string;
    readonly sum_omloepsmidler_ore: string;
  };
  /** The current column's lines; every other line is empty. */
  readonly current: Readonly<Partial<Record<DocumentField, string>>>;
  /** The prior column's lines (revenue growth reads its sum_driftsinntekter). */
  readonly prior: Readonly<Partial<Record<DocumentField, string>>>;
};

/**
 * The shape of one company, each line a share of revenue in thousandths, or
 * days of a base: whole øre, so every row's figure can be redone by hand.
 */
function documentCompany(
  orgnr: string,
  navn: string,
  revenueKr: bigint,
  shape: {
    readonly vare: bigint;
    readonly lonn: bigint;
    readonly annen: bigint;
    readonly avskrivninger: bigint;
    /** Receivable days on salgsinntekt (= revenue). */
    readonly kfdDays: bigint;
    /** Payable days on varekostnad + annenDriftskostnad. */
    readonly lgdDays: bigint;
    readonly bank: bigint;
    readonly assets: bigint;
    /** The prior year's revenue, in thousandths of this year's. */
    readonly prior: bigint;
  },
): SyntheticDocumentCompany {
  const revenue = revenueKr * 100n;
  const share = (thousandths: bigint) => (revenue * thousandths) / 1000n;
  const varekostnad = share(shape.vare);
  const lonnskostnad = share(shape.lonn);
  const annenDriftskostnad = share(shape.annen);
  const avskrivninger = share(shape.avskrivninger);
  const sumDriftskostnad = varekostnad + lonnskostnad + annenDriftskostnad + avskrivninger;
  const driftsresultat = revenue - sumDriftskostnad;
  const sumEiendeler = share(shape.assets);
  const sumEgenkapital = (sumEiendeler * 40n) / 100n;
  const lines = {
    salgsinntekt: revenue,
    sumDriftsinntekter: revenue,
    varekostnad,
    lonnskostnad,
    avskrivninger,
    nedskrivninger: 0n,
    annenDriftskostnad,
    sumDriftskostnad,
    driftsresultat,
    kundefordringer: (revenue * shape.kfdDays) / 365n,
    bankinnskudd: share(shape.bank),
    sumEiendeler,
    sumEgenkapital,
    leverandorgjeld: ((varekostnad + annenDriftskostnad) * shape.lgdDays) / 365n,
    sumGjeld: sumEiendeler - sumEgenkapital,
    sumEgenkapitalGjeld: sumEiendeler,
  } satisfies Partial<Record<DocumentField, bigint>>;
  const priorRevenue = (revenue * shape.prior) / 1000n;
  return {
    orgnr,
    navn,
    brregId: orgnr,
    keyFigures: {
      sum_driftsinntekter_ore: String(revenue),
      driftsresultat_ore: String(driftsresultat),
      sum_driftskostnad_ore: String(sumDriftskostnad),
      sum_eiendeler_ore: String(sumEiendeler),
      sum_egenkapital_gjeld_ore: String(sumEiendeler),
      sum_egenkapital_ore: String(sumEgenkapital),
      sum_gjeld_ore: String(sumEiendeler - sumEgenkapital),
      sum_omloepsmidler_ore: String(share(400n)),
    },
    current: Object.fromEntries(Object.entries(lines).map(([field, ore]) => [field, String(ore)])),
    prior: {
      sumDriftsinntekter: String(priorRevenue),
      sumDriftskostnad: String(priorRevenue - share(50n)),
      driftsresultat: String(share(50n)),
    },
  };
}

// Valid orgnrs (modulus 11) in a range the register does not use for these names.
const PEER_ORGNRS = ['999998011', '999998038', '999998046', '999998054', '999998062', '999998070', '999998089', '999998097', '999998100', '999998119'];

/**
 * SYNTHETIC_DOCUMENTS (Story 3.1b, decision 4). The subject is worse than
 * beste fjerdedel on receivable days (9), payable days (10) and operating
 * asset turnover (11), so each has a capital amount in kroner.
 */
export const SYNTHETIC_DOCUMENTS = {
  filingYear: 2025,
  subject: documentCompany('999998003', 'SYNTETISK DOKUMENTSELSKAP AS', 1_500_000_000n, {
    vare: 70n,
    lonn: 470n,
    annen: 220n,
    avskrivninger: 20n,
    kfdDays: 75n,
    lgdDays: 12n,
    bank: 60n,
    assets: 1200n,
    prior: 950n,
  }),
  peers: PEER_ORGNRS.map((orgnr, index) => {
    const i = BigInt(index + 1);
    return documentCompany(orgnr, `SYNTETISK SAMMENLIGNBAR ${String(index + 1).padStart(2, '0')} AS`, 1_000_000_000n + 100_000_000n * i, {
      vare: 50n + 5n * i,
      lonn: 400n + 10n * i,
      annen: 200n,
      avskrivninger: 30n,
      kfdDays: 20n + 5n * i,
      lgdDays: 15n + 4n * i,
      bank: 50n + 5n * i,
      assets: 500n + 40n * i,
      prior: 900n + 10n * i,
    });
  }),
} as const;

/** Every company of SYNTHETIC_DOCUMENTS, the subject first. */
export const syntheticDocumentCompanies = (): readonly SyntheticDocumentCompany[] => [
  SYNTHETIC_DOCUMENTS.subject,
  ...SYNTHETIC_DOCUMENTS.peers,
];

const documentOrgnrs = () => syntheticDocumentCompanies().map((company) => company.orgnr);

async function removeDocuments(tx: postgres.TransactionSql): Promise<void> {
  for (const company of syntheticDocumentCompanies()) await removeCompany(tx, company);
  await unlistAll(tx, documentOrgnrs());
}

/** Removes the SYNTHETIC_DOCUMENTS companies, if present. Safe to run any number of times. */
export async function removeSyntheticDocuments(): Promise<void> {
  const sql = ownerSql();
  try {
    await sql.begin(removeDocuments);
  } finally {
    await sql.end();
  }
}

/** A column's figure columns and their values, for an insert. */
function columnValues(lines: Readonly<Partial<Record<DocumentField, string>>>): { readonly names: string[]; readonly values: string[] } {
  const fields = Object.keys(lines) as DocumentField[];
  return {
    names: fields.map((field) => DOCUMENT_FIGURE_COLUMNS[field]),
    values: fields.map((field) => lines[field] ?? ''),
  };
}

/**
 * Removes any leftover, then inserts the subject and its ten peers, each with
 * its 2025 filing, key figures and a reconciled 2025 document, and lists
 * them all. Refuses, inserting nothing, when another listed company with a
 * 2025 filing in 62.100 lies in the subject's widest band: its document
 * figures would join the comparison.
 */
export async function insertSyntheticDocuments(): Promise<void> {
  const sql = ownerSql();
  const year = SYNTHETIC_DOCUMENTS.filingYear;
  try {
    await sql.begin(async (tx) => {
      await removeDocuments(tx);
      // The widest band of SIZE_BANDS around the subject's revenue, both bounds included, as the funnel applies it.
      const revenue = new Decimal(SYNTHETIC_DOCUMENTS.subject.keyFigures.sum_driftsinntekter_ore);
      const widest = Object.values(SIZE_BANDS).reduce((wide, band) => (band.hi.div(band.lo).gt(wide.hi.div(wide.lo)) ? band : wide));
      const from = widest.lo.mul(revenue).ceil().toString();
      const to = widest.hi.mul(revenue).floor().toString();
      const [{ others = '0' } = {}] = await tx<{ others: string }[]>`
        select count(*)::text as others
          from register.dataset ds
          cross join lateral jsonb_array_elements_text(ds.manifest -> 'document_figure_orgnrs') l (o)
          join register.company c on c.orgnr = l.o and c.naeringskode1 = '62.100'
          join register.filing f on f.orgnr = c.orgnr and f.filing_year = ${year}
          join register.key_figures k on k.brreg_id = f.brreg_id
         where k.sum_driftsinntekter_ore between ${from} and ${to}`;
      if (others !== '0') {
        throw new Error(`${others} listed companies lie in the synthetic subject's band; its document rows would not be the ten peers'`);
      }
      for (const company of syntheticDocumentCompanies()) {
        const k = company.keyFigures;
        await tx`
          insert into register.company (orgnr, navn, organisasjonsform, naeringskode1, naeringskode1_beskrivelse,
                                        konkurs, under_avvikling, under_tvangsavvikling, read_at,
                                        forretningsadresse_kommune)
          values (${company.orgnr}, ${company.navn}, 'AS', '62.100', 'Dataprogrammeringstjenester',
                  false, false, false, now(), 'OSLO')`;
        await tx`
          insert into register.filing (orgnr, regnskapstype, periode_fra, periode_til, brreg_id, filing_year, valuta,
                                       regnskapsregler, smaa_foretak, avviklingsregnskap, reporting_unit, status, read_at)
          values (${company.orgnr}, 'SELSKAP', '2025-01-01', '2025-12-31', ${company.brregId}, ${year}, 'NOK',
                  'regnskapslovenAlminneligRegler', false, false, 'api_whole_units', 'reconciled', now())`;
        await tx`
          insert into register.key_figures (brreg_id, sum_driftsinntekter_ore, driftsresultat_ore, sum_driftskostnad_ore,
                                            sum_eiendeler_ore, sum_egenkapital_gjeld_ore, sum_egenkapital_ore,
                                            sum_gjeld_ore, sum_omloepsmidler_ore)
          values (${company.brregId}, ${k.sum_driftsinntekter_ore}, ${k.driftsresultat_ore}, ${k.sum_driftskostnad_ore},
                  ${k.sum_eiendeler_ore}, ${k.sum_egenkapital_gjeld_ore}, ${k.sum_egenkapital_ore}, ${k.sum_gjeld_ore},
                  ${k.sum_omloepsmidler_ore})`;
        await tx`
          insert into register.document (orgnr, filing_year, brreg_id, layout, status, valuta, unit_text, read_at,
                                         dataset, reader_commit)
          values (${company.orgnr}, ${year}, ${company.brregId}, 'generated', 'reconciled', 'NOK', 'NOK', now(),
                  'demo', ${READER_COMMIT})`;
        for (const [role, lines] of [
          ['current', company.current],
          ['prior', company.prior],
        ] as const) {
          // c1 and c3 pass, nothing fails: the column is reconciled, as the status CHECK requires.
          // Story 3.7: the current column's lines equal the key figures (both are built from the
          // same amounts above), so its comparison with the API passes, as step 1 would store it;
          // the prior column has no API filing of its own year here.
          const { names, values } = columnValues(lines);
          const apiCheck = role === 'current' ? 'pass' : 'not_evaluable';
          await tx.unsafe(
            `insert into register.document_column (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, c5, status,
                                                   api_check, api_fail_fields, digits_pass_fields, dataset, ${names.join(', ')})
             values ($1, $2, $3, $4, 'pass', 'not_evaluable', 'pass', 'not_evaluable', 'not_evaluable', 'reconciled',
                     '${apiCheck}', '{}', '{}', 'demo', ${names.map((_, i) => `$${i + 5}`).join(', ')})`,
            [company.orgnr, year, role, role === 'current' ? year : year - 1, ...values],
          );
        }
      }
      await listAll(tx, documentOrgnrs());
    });
  } finally {
    await sql.end();
  }
}

/**
 * Story 3.8: the margin waterfall of SYNTHETIC_DOCUMENTS by hand (the spec's
 * Design Notes), the oracle its drill-downs are read against. Exact, in
 * kroner, from the shapes above: P is the ten peers, Σ revenue over P
 * 15 500 000 000 kr; the subject's R 1 500 000 000 kr. Not computed by the
 * engine: each number is written out, and the lines are the page's text
 * with plain spaces.
 */
export const SYNTHETIC_WATERFALL = {
  n: 10,
  /** The sums over P, in kroner: never on the page in any form. */
  groupSumsKr: {
    sumDriftsinntekter: 15_500_000_000n,
    varekostnad: 1_242_500_000n,
    lonnskostnad: 7_135_000_000n,
    annenDriftskostnad: 3_100_000_000n,
    residual: 465_000_000n,
    driftsresultat: 3_557_500_000n,
  },
  /** Aₓ and M exactly, as numerator / denominator of kroner: never on the page beyond two decimals. */
  shares: {
    varekostnad: [1_242_500_000n, 15_500_000_000n],
    lonnskostnad: [7_135_000_000n, 15_500_000_000n],
    margin: [3_557_500_000n, 15_500_000_000n],
  },
  /** Aₓ × R as shown, in kroner: 120 241 935,48, 690 483 870,97, 300 000 000 and 45 000 000. */
  pooledKr: { vare: 120_241_935n, lonn: 690_483_871n, andre: 300_000_000n, residual: 45_000_000n },
  /** The subject's own lines, in kroner. */
  ownKr: { vare: 105_000_000n, lonn: 705_000_000n, andre: 330_000_000n, residual: 30_000_000n, driftsresultat: 330_000_000n },
  /** The bars as shown; each is its own rounding. */
  barsKr: { vare: 15_241_935n, lonn: -14_516_129n, andre: -30_000_000n, residual: 15_000_000n },
  startKr: 344_274_194n,
  sumKr: -14_274_194n,
  endKr: 330_000_000n,
  /** The lines each drill-down shows, in its formula and its step 2. */
  lines: {
    start: [
      'M × R',
      '22,95 % × 1 500 000 000 kr ≈ 344 274 194 kr',
      'Vist som 330 000 000 kr − (−14 274 194 kr) = 344 274 194 kr, slik at start og postene til sammen gir 330 000 000 kr.',
      'R = sumDriftsinntekter = 1 500 000 000 kr',
      'M = 22,95 %',
    ],
    vare: [
      '(A − c) × R',
      '(8,02 % − 7,00 %) × 1 500 000 000 kr ≈ +15 241 935 kr',
      'A × R − varekostnad = 120 241 935 kr − 105 000 000 kr = +15 241 935 kr',
      'c = varekostnad / R = 105 000 000 kr / 1 500 000 000 kr = 7,00 %',
      'A = 8,02 %',
    ],
    lonn: [
      '(46,03 % − 47,00 %) × 1 500 000 000 kr ≈ −14 516 129 kr',
      'A × R − lonnskostnad = 690 483 871 kr − 705 000 000 kr = −14 516 129 kr',
      'c = lonnskostnad / R = 705 000 000 kr / 1 500 000 000 kr = 47,00 %',
      'A = 46,03 %',
    ],
    andre: [
      '(20,00 % − 22,00 %) × 1 500 000 000 kr = −30 000 000 kr',
      'A × R − annenDriftskostnad = 300 000 000 kr − 330 000 000 kr = −30 000 000 kr',
      'c = annenDriftskostnad / R = 330 000 000 kr / 1 500 000 000 kr = 22,00 %',
      'A = 20,00 %',
    ],
    residual: [
      '(3,00 % − 2,00 %) × 1 500 000 000 kr = +15 000 000 kr',
      'A × R − c × R = 45 000 000 kr − 30 000 000 kr = +15 000 000 kr',
      'c = (R − driftsresultat − varekostnad − lonnskostnad − annenDriftskostnad) / R = (1 500 000 000 kr − 330 000 000 kr − 105 000 000 kr − 705 000 000 kr − 330 000 000 kr) / 1 500 000 000 kr = 2,00 %',
      'M = 22,95 %',
      'A = 1 − M − ΣA = 100,00 % − 22,95 % − (8,02 % + 46,03 % + 20,00 %) = 3,00 %',
    ],
    sum: [
      '(m − M) × R',
      '(22,00 % − 22,95 %) × 1 500 000 000 kr ≈ −14 274 194 kr',
      '15 241 935 kr + (−14 516 129 kr) + (−30 000 000 kr) + 15 000 000 kr = −14 274 194 kr',
      'm = driftsresultat / R = 330 000 000 kr / 1 500 000 000 kr = 22,00 %',
    ],
    end: ['driftsresultat = 330 000 000 kr', 'm = driftsresultat / R = 330 000 000 kr / 1 500 000 000 kr = 22,00 %'],
  },
} as const;
