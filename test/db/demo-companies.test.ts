// Demo companies A and B (src/demo-companies.ts, placeholders until Story
// 5.4) exist in the loaded seed under the stated names, with a SELSKAP
// filing in NOK for 2025 from which all three API key figures are
// computable. Read as reader; read-only.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { DEMO_COMPANIES } from '../../src/demo-companies.ts';
import { isValidOrgnr } from '../../src/engine/orgnr.ts';
import { setting } from './db-env.ts';

const readerUrl = setting('READER_DATABASE_URL');
if (readerUrl === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
const reader = postgres(readerUrl, { max: 1, onnotice: () => {} });

afterAll(async () => {
  await reader.end();
});

describe.each(DEMO_COMPANIES.map((company) => [company.navn, company] as const))('demo company %s', (_name, company) => {
  it('has a valid orgnr and is stored under that name', async () => {
    expect(isValidOrgnr(company.orgnr)).toBe(true);
    const [row] = await reader<{ navn: string; covered: boolean }[]>`
      select c.navn, exists (select 1 from register.covered_industry ci where ci.code = c.naeringskode1) as covered
        from register.company c where c.orgnr = ${company.orgnr}::char(9)`;
    expect(row).toEqual({ navn: company.navn, covered: true });
  });

  it('has a 2025 SELSKAP filing in NOK with all three API figures computable', async () => {
    const rows = await reader<{ ok: boolean }[]>`
      select k.sum_driftsinntekter_ore > 0 and k.sum_eiendeler_ore > 0
             and k.driftsresultat_ore is not null and k.sum_egenkapital_ore is not null as ok
        from register.filing f join register.key_figures k using (brreg_id)
       where f.orgnr = ${company.orgnr}::char(9) and f.regnskapstype = 'SELSKAP'
         and f.valuta = 'NOK' and f.filing_year = 2025`;
    expect(rows).toEqual([{ ok: true }]);
  });
});
