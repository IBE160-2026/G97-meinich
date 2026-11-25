// Demo companies A and B (src/demo-companies.ts, Story 5.4) exist in the
// loaded seed under the stated names, with a SELSKAP filing in NOK for 2025
// from which all three API key figures are computable, and their groups lie
// inside the allow-list. Read as reader; read-only.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { DEMO_COMPANIES } from '../../src/demo-companies.ts';
import { isValidOrgnr } from '../../src/engine/orgnr.ts';
import { ALLOW_LIST_FILE, parseAllowList } from '../../scripts/seed-format.ts';
import { root, setting } from './db-env.ts';

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

// Story 5.4 (AD-9): every member of A's and B's groups at every band step is
// on seed/allow-list.json, so the committed seed may hold their document
// figures. The group is computed by the request path's own reads and the v1
// funnel (src/engine/peers.ts). Fails with a count per company and band,
// never an orgnr.
describe('the allow-list and the demo groups', () => {
  it('A’s and B’s groups at every band step are subsets of the allow-list', async () => {
    process.env.READER_DATABASE_URL = readerUrl;
    const { loadCandidates, loadSubject } = await import('../../src/server/analysis.ts');
    const { funnelSubject } = await import('../../src/analysis/view.ts');
    const { assemblePeerGroup } = await import('../../src/engine/peers.ts');
    const { readerSql } = await import('../../src/server/db.ts');
    const listed = new Set(
      parseAllowList(JSON.parse(readFileSync(path.join(root, ALLOW_LIST_FILE), 'utf8'))),
    );
    try {
      const unlisted: Record<string, number> = {};
      const sizes: Record<string, number> = {};
      for (const demo of DEMO_COMPANIES) {
        expect(listed.has(demo.orgnr)).toBe(true);
        const subject = await loadSubject(demo.orgnr);
        const funnel = subject === null ? null : funnelSubject(subject);
        if (funnel === null || funnel.naeringskode1 === null) throw new Error(`${demo.navn}: no benchmark filing`);
        const candidates = await loadCandidates(funnel.orgnr, funnel.naeringskode1, funnel.filingYear);
        for (const band of [0, 1, 2] as const) {
          const { group } = assemblePeerGroup(funnel, candidates, band);
          sizes[`${demo.navn} band ${band}`] = group.length;
          unlisted[`${demo.navn} band ${band}`] = group.filter((peer) => !listed.has(peer.orgnr)).length;
        }
      }
      for (const [key, size] of Object.entries(sizes)) expect(size, key).toBeGreaterThan(0);
      expect(unlisted).toEqual(Object.fromEntries(Object.keys(unlisted).map((key) => [key, 0])));
    } finally {
      await readerSql().end();
      delete (globalThis as { peerlessReaderSql?: unknown }).peerlessReaderSql;
    }
  });
});
