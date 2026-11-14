// The two synthetic companies of the e2e suite, each with its orgnr and every
// figure set here and only here:
//
// - SYNTHETIC (Story 2.9, decision 7): a 62.100 AS whose own 2025 document
//   failed reconciliation, for the FR-71 state, which no company in the
//   committed seed is in on the demo pools;
// - SYNTHETIC_USD (Story 2.10, decision 7 as amended): a 62.100 AS filing in
//   USD, whose stage 1 finds the seed's small NOK companies and no company
//   in USD, so its empty reason is `subject_currency`. It has no document
//   and is not on the manifest's list.
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
import postgres from 'postgres';
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
 * Takes the synthetic orgnr off the manifest's list of orgnrs with document
 * figures, if it is on it, keeping the others in their order.
 */
async function unlist(tx: postgres.TransactionSql): Promise<void> {
  await tx`
    update register.dataset
       set manifest = jsonb_set(
             manifest,
             '{document_figure_orgnrs}',
             coalesce(
               (select jsonb_agg(l.o order by l.n)
                  from jsonb_array_elements_text(manifest -> 'document_figure_orgnrs') with ordinality l (o, n)
                 where l.o <> ${SYNTHETIC.orgnr}),
               '[]'::jsonb))
     where manifest -> 'document_figure_orgnrs' @> to_jsonb(${SYNTHETIC.orgnr}::text)`;
}

/** Puts the synthetic orgnr on the list, in byte order as the export writes it. */
async function list(tx: postgres.TransactionSql): Promise<void> {
  await unlist(tx);
  const listed = await tx`
    update register.dataset
       set manifest = jsonb_set(
             manifest,
             '{document_figure_orgnrs}',
             (select jsonb_agg(o order by o collate "C")
                from (select jsonb_array_elements_text(manifest -> 'document_figure_orgnrs') o
                      union all select ${SYNTHETIC.orgnr}::text) l))`;
  if (listed.count !== 1) throw new Error('no loaded dataset to list the synthetic company in; run `pnpm seed`');
}

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
