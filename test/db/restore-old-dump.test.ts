// Restoring a dump taken before Story 2.5b's migration (README, "Seed"). The
// acceptance run's rows live in CSV dumps under .local/ (gitignored) until
// Story 5.4; the newest, .local/document-run-2.4/, was taken before
// 20261105120000_document_intangible_parts.sql added four nullable columns
// at the end of register.document_column. The README's restore names the
// columns from the dump's own header line, so such a dump still loads, with
// the new columns NULL. Here, rows in that dump's exact pre-2.5b header are
// copied in the same way, in a transaction that is always rolled back, as
// the CLI's local `postgres` role.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { copyIn } from '../../scripts/seed-load.ts';
import { supabaseDbUrl } from './db-env.ts';

const ORGNR = '979607008';

// The header lines of .local/document-run-2.4/ (2026-10-30), copied verbatim,
// with one document of a year no run reads and its two columns.
const DOCUMENT_CSV = [
  'orgnr,filing_year,brreg_id,layout,status,refusal,valuta,unit_text,read_at,dataset,reader_commit',
  `${ORGNR},2019,,generated,reconciled,,NOK,NOK,2026-10-28 19:55:07.032503+00,full,${'a'.repeat(40)}`,
].join('\n');
const DOCUMENT_COLUMN_CSV = [
  'orgnr,filing_year,role,stated_year,c1,c2,c3,c4,digits_pass_fields,salgsinntekt_ore,sum_driftsinntekter_ore,varekostnad_ore,lonnskostnad_ore,avskrivninger_ore,nedskrivninger_ore,annen_driftskostnad_ore,sum_driftskostnad_ore,driftsresultat_ore,netto_finans_ore,ordinaert_resultat_foer_skattekostnad_ore,aarsresultat_ore,sum_immaterielle_eiendeler_ore,sum_varige_driftsmidler_ore,varer_ore,kundefordringer_ore,bankinnskudd_ore,sum_eiendeler_ore,sum_egenkapital_ore,leverandorgjeld_ore,sum_kortsiktig_gjeld_ore,sum_gjeld_ore,sum_egenkapital_gjeld_ore,dataset,c5,status,api_check,api_fail_fields',
  `${ORGNR},2019,current,2019,pass,pass,pass,pass,"{sum_egenkapital_gjeld}",1871006900,1979595100,29805400,,,,780635800,1809284700,170310500,-2819500,167491000,,656135500,4686700,,254759000,52165900,1282875100,606309000,,676566100,676566100,1282875100,full,pass,reconciled,not_evaluable,{}`,
  `${ORGNR},2019,prior,2018,not_evaluable,not_evaluable,not_evaluable,not_evaluable,{},,,,,,,,,,,,,,,,,,,,,,,,full,not_evaluable,failed_reconciliation,not_evaluable,{}`,
].join('\n');

const PARTS = ['forskning_og_utvikling_ore', 'konsesjoner_patenter_ore', 'goodwill_ore', 'utsatt_skattefordel_ore'];

/** The README's restore: the column list is the dump's own header line. */
const headerOf = (csv: string): string[] => (csv.split('\n')[0] ?? '').replace(/\r$/, '').split(',');

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

describe('a dump taken before Story 2.5b', () => {
  it('restores into the migrated tables with its own header as the column list, the new columns NULL', async () => {
    let rows: Record<string, string | null>[] = [];
    let tableColumns: string[] = [];
    try {
      await sql.begin(async (tx) => {
        tableColumns = (
          await tx<{ name: string }[]>`
            select attname as name from pg_attribute
             where attrelid = 'register.document_column'::regclass and attnum > 0 and not attisdropped
             order by attnum`
        ).map((r) => r.name);
        await tx`insert into register.company (orgnr, navn, read_at) values (${ORGNR}, 'TEST AS', now()) on conflict (orgnr) do nothing`;
        await copyIn(tx, 'document', headerOf(DOCUMENT_CSV), Buffer.from(DOCUMENT_CSV));
        await copyIn(tx, 'document_column', headerOf(DOCUMENT_COLUMN_CSV), Buffer.from(DOCUMENT_COLUMN_CSV));
        rows = await tx.unsafe<Record<string, string | null>[]>(
          `select role, sum_eiendeler_ore, status, ${PARTS.join(', ')} from register.document_column
            where orgnr = '${ORGNR}' and filing_year = 2019 order by role`,
        );
        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
    const nulls = Object.fromEntries(PARTS.map((c) => [c, null]));
    expect(rows).toEqual([
      { role: 'current', sum_eiendeler_ore: '1282875100', status: 'reconciled', ...nulls },
      { role: 'prior', sum_eiendeler_ore: null, status: 'failed_reconciliation', ...nulls },
    ]);
    // Why the column list is needed: the dump's header is not the table's
    // columns any more, so a copy without it would read the wrong number of
    // fields per line.
    expect(headerOf(DOCUMENT_COLUMN_CSV)).not.toEqual(tableColumns);
    expect(tableColumns.slice(-PARTS.length)).toEqual(PARTS);
  });
});
