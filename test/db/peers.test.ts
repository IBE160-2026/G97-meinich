// Funnel stages 1–3 against the loaded demo seed (Story 1.7), through the
// app's own reader client: demo A's peer group is assembled from stored
// figures within 1 s, with no outbound request on the way, and the request
// path names no register API or model host. Read-only.
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { funnelSubject, urlContext } from '../../src/analysis/view.ts';
import { DEMO_COMPANIES } from '../../src/demo-companies.ts';
import { benchmarkApiFigures } from '../../src/engine/benchmark.ts';
import { fingerprintFromColumns } from '../../src/engine/fingerprint.ts';
import { apiInputsFromRow } from '../../src/engine/inputs.ts';
import { assemblePeerGroup } from '../../src/engine/peers.ts';
import { defaultState, parse, serialize } from '../../src/url/analysis-state.ts';
import { listRepositoryFiles } from '../../scripts/check-no-public-env.ts';
import { root, setting, supabaseDbUrl } from './db-env.ts';

const url = setting('READER_DATABASE_URL');
if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
process.env.READER_DATABASE_URL = url;

const { readerSql } = await import('../../src/server/db.ts');
const { CANDIDATES_SQL, SUBJECT_SQL, loadCandidates, loadSubject, toCandidate, toSubject } = await import(
  '../../src/server/analysis.ts'
);
type CandidateRow = import('../../src/server/analysis.ts').CandidateRow;
type SubjectRow = import('../../src/server/analysis.ts').SubjectRow;

// The migration role, for the one test that deletes (Story 2.4), always in a
// transaction it rolls back.
const admin = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });

afterAll(async () => {
  await admin.end();
  await readerSql().end();
  delete (globalThis as { peerlessReaderSql?: unknown }).peerlessReaderSql;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const [DEMO_A] = DEMO_COMPANIES;

/** Demo A's subject read, candidate read and assembly at `band`, as the page does them. */
async function groupForDemoA(band: 0 | 1 | 2) {
  const subject = await loadSubject(DEMO_A.orgnr);
  const funnel = subject === null ? null : funnelSubject(subject);
  if (funnel === null || funnel.naeringskode1 === null) throw new Error('demo A has no benchmark filing');
  const candidates = await loadCandidates(funnel.orgnr, funnel.naeringskode1, funnel.filingYear);
  return { funnel, candidates, group: assemblePeerGroup(funnel, candidates, band) };
}

describe("demo A's peer group", () => {
  it('reads candidates of the subject’s industry and year only, never the subject', async () => {
    const { funnel, candidates } = await groupForDemoA(0);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.naeringskode1).toBe(funnel.naeringskode1);
      expect(candidate.filingYear).toBe(funnel.filingYear);
      expect(candidate.orgnr).not.toBe(funnel.orgnr);
      // int8 arrives as a string and is parsed to bigint, never a number.
      expect(typeof candidate.brregId).toBe('bigint');
      expect(candidate.sumDriftsinntekter === null || typeof candidate.sumDriftsinntekter === 'bigint').toBe(true);
      expect(candidate.periodeFra).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('carries each candidate’s seven key-figure inputs as int8 strings, so the API figures can be benchmarked', async () => {
    const { group } = await groupForDemoA(0);
    const keys = [
      'sum_driftsinntekter_ore',
      'driftsresultat_ore',
      'sum_driftskostnad_ore',
      'sum_eiendeler_ore',
      'sum_egenkapital_gjeld_ore',
      'sum_egenkapital_ore',
      'sum_gjeld_ore',
    ] as const;
    for (const peer of group.pool) {
      expect(Object.keys(peer.keyFigures).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        const value = peer.keyFigures[key];
        expect(value === null || /^-?\d+$/.test(value), `${key} = ${String(value)}`).toBe(true);
      }
      // The revenue the funnel read is the same column, parsed exactly.
      expect(apiInputsFromRow(peer.keyFigures).sumDriftsinntekter).toBe(peer.sumDriftsinntekter);
    }
    // Demo A's group is large enough that every figure clears the floor.
    const subject = await loadSubject(DEMO_A.orgnr);
    if (subject === null || subject.filing === null) throw new Error('demo A has no filing');
    const result = benchmarkApiFigures(
      apiInputsFromRow(subject.filing.keyFigures),
      group.pool.map((peer) => apiInputsFromRow(peer.keyFigures)),
      subject.filing.valuta,
    );
    expect(result.driftsmargin.comparison.kind).toBe('compared');
    expect(result.totalkapitalrentabilitet.comparison.kind).toBe('compared');
    expect(result.egenkapitalandel.comparison.kind).toBe('compared');
  });

  it('is a non-empty AS group whose pool widens with the band', async () => {
    const { funnel, candidates, group } = await groupForDemoA(0);
    expect(group.pool.length).toBeGreaterThan(0);
    expect(group.emptyReason).toBeNull();
    expect(group.counts.stage3.legalForm).toBe(group.pool.length);
    for (const peer of group.pool) expect(peer.organisasjonsform).toBe('AS');
    const wider = assemblePeerGroup(funnel, candidates, 2);
    expect(wider.pool.length).toBeGreaterThanOrEqual(group.pool.length);
  });

  it('comes back within 1 000 ms from stored figures, timed after one warm-up query', async () => {
    await readerSql()`select 1`;
    const started = performance.now();
    const { group } = await groupForDemoA(0);
    const elapsed = performance.now() - started;
    expect(group.pool.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });

  it('makes no outbound request: no fetch, http.request or https.request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const httpSpy = vi.spyOn(http, 'request');
    const httpsSpy = vi.spyOn(https, 'request');
    const httpGet = vi.spyOn(http, 'get');
    const httpsGet = vi.spyOn(https, 'get');
    await groupForDemoA(0);
    await groupForDemoA(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(httpSpy).not.toHaveBeenCalled();
    expect(httpsSpy).not.toHaveBeenCalled();
    expect(httpGet).not.toHaveBeenCalled();
    expect(httpsGet).not.toHaveBeenCalled();
  });
});

// Story 2.4: a company step 1 deletes after 410 Gone takes every register
// row that references it with it, so it leaves the candidates, the peer
// group and every aggregate over it, and an `ekskl` naming it is dropped
// with the invalid-settings notice. The delete runs as the migration role
// in a transaction that is rolled back; the candidate query is the one
// loadCandidates runs, read in that transaction, since the reader's own
// connection cannot see an uncommitted delete.
describe('a peer deleted after 410 Gone', () => {
  class Rollback extends Error {}

  it('leaves the candidates and the peer group, and an ekskl naming it sets the notice', async () => {
    const { funnel, group } = await groupForDemoA(0);
    const peer = group.pool[0]?.orgnr;
    if (peer === undefined || funnel.naeringskode1 === null) throw new Error("demo A's group is empty");
    const candidatesIn = async (tx: postgres.TransactionSql) =>
      (await tx.unsafe<CandidateRow[]>(CANDIDATES_SQL, [funnel.orgnr, funnel.naeringskode1, funnel.filingYear])).map(
        toCandidate,
      );

    await expect(
      admin.begin(async (tx) => {
        expect((await candidatesIn(tx)).map((c) => c.orgnr)).toContain(peer);
        await tx`delete from register.company where orgnr = ${peer}`;
        const candidates = await candidatesIn(tx);
        expect(candidates.map((c) => c.orgnr)).not.toContain(peer);
        for (const band of [0, 1, 2] as const) {
          const after = assemblePeerGroup(funnel, candidates, band);
          expect(after.pool.map((p) => p.orgnr)).not.toContain(peer);
        }
        const pool = new Set(assemblePeerGroup(funnel, candidates, 0).pool.map((p) => p.orgnr));
        const parsed = parse(serialize({ ...defaultState(funnel.orgnr), ekskl: [peer] }), urlContext(() => pool));
        expect(parsed.kind).toBe('analysis');
        if (parsed.kind !== 'analysis') return;
        expect(parsed.invalidSettings).toBe(true);
        expect(parsed.state.ekskl).toEqual([]);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
    // Rolled back: the peer is a candidate again.
    expect((await loadCandidates(funnel.orgnr, funnel.naeringskode1, funnel.filingYear)).map((c) => c.orgnr)).toContain(
      peer,
    );
  });
});

// Story 2.5: stage 4 reads the stored fingerprint of the benchmark year.
// The fingerprint (it references the company) is written as the migration role
// in a transaction that is rolled back, and read with the query
// loadCandidates runs, in that transaction. Synthetic categories only.
describe('stage 4 against stored fingerprints', () => {
  class Rollback extends Error {}

  const CONSULTANCY = {
    cost_of_goods_lo: 'low',
    cost_of_goods_hi: 'low',
    personnel_cost_lo: 'high',
    personnel_cost_hi: 'high',
    asset_intensity_lo: 'low',
    asset_intensity_hi: 'low',
    inventory: false,
    capitalised_intangibles: false,
  } as const;
  const RESELLER = { ...CONSULTANCY, cost_of_goods_lo: 'high', cost_of_goods_hi: 'high', personnel_cost_lo: 'low', personnel_cost_hi: 'low', inventory: true } as const;

  async function storeFingerprint(tx: postgres.TransactionSql, orgnr: string, year: number, columns: typeof CONSULTANCY | typeof RESELLER) {
    await tx`delete from register.fingerprint where orgnr = ${orgnr} and filing_year = ${year}`;
    await tx`
      insert into register.fingerprint ${tx({ orgnr, filing_year: year, ...columns, input_digest: '0'.repeat(64), dataset: 'full' })}`;
  }

  it('reads each candidate’s fingerprint for the benchmark year, removes another type from the group and keeps the pool', async () => {
    const { funnel, group } = await groupForDemoA(0);
    const [kept, removed] = group.pool;
    if (kept === undefined || removed === undefined || funnel.naeringskode1 === null) {
      throw new Error("demo A's pool has fewer than two peers");
    }
    const candidatesIn = async (tx: postgres.TransactionSql) =>
      (await tx.unsafe<CandidateRow[]>(CANDIDATES_SQL, [funnel.orgnr, funnel.naeringskode1, funnel.filingYear])).map(
        toCandidate,
      );

    await expect(
      admin.begin(async (tx) => {
        await storeFingerprint(tx, kept.orgnr, funnel.filingYear, CONSULTANCY);
        await storeFingerprint(tx, removed.orgnr, funnel.filingYear, RESELLER);
        const candidates = await candidatesIn(tx);
        const byOrgnr = new Map(candidates.map((c) => [c.orgnr, c]));
        expect(byOrgnr.get(kept.orgnr)?.fingerprint?.personnelCost).toEqual({ lo: 'high', hi: 'high' });
        expect(byOrgnr.get(removed.orgnr)?.fingerprint?.costOfGoods).toEqual({ lo: 'high', hi: 'high' });

        const subject = { ...funnel, fingerprint: fingerprintFromColumns(CONSULTANCY) };
        const after = assemblePeerGroup(subject, candidates, 0);
        expect(after.pool.map((p) => p.orgnr)).toEqual(group.pool.map((p) => p.orgnr));
        expect(after.group.map((p) => p.orgnr)).toContain(kept.orgnr);
        expect(after.group.map((p) => p.orgnr)).not.toContain(removed.orgnr);
        expect(after.counts.stage4.businessModel).toBe(after.group.length);
        expect(after.counts.stage3.legalForm).toBe(after.pool.length);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it('reads no fingerprint as null, and a subject without one keeps the whole pool', async () => {
    const { funnel, candidates, group } = await groupForDemoA(0);
    for (const candidate of candidates) {
      expect(candidate.fingerprint === null || typeof candidate.fingerprint === 'object').toBe(true);
    }
    if (funnel.fingerprint === null) {
      expect(group.group).toEqual(group.pool);
      expect(group.counts.stage4.businessModel).toBe(group.counts.stage3.legalForm);
    }
  });

  // Review pass 1 (triage 4): the subject read's join, through SUBJECT_SQL
  // and toSubject as the page runs them, in the rolled-back transaction.
  it('reads the subject’s fingerprint for its benchmark year, and none stored only for another year', async () => {
    const { funnel } = await groupForDemoA(0);
    const subjectIn = async (tx: postgres.TransactionSql) => {
      const [row] = await tx.unsafe<SubjectRow[]>(SUBJECT_SQL, [funnel.orgnr]);
      if (row === undefined) throw new Error('demo A is not stored');
      return toSubject(row);
    };
    await expect(
      admin.begin(async (tx) => {
        await tx`delete from register.fingerprint where orgnr = ${funnel.orgnr}`;
        await storeFingerprint(tx, funnel.orgnr, funnel.filingYear, CONSULTANCY);
        expect((await subjectIn(tx)).filing?.fingerprint).toEqual(fingerprintFromColumns(CONSULTANCY));

        await tx`delete from register.fingerprint where orgnr = ${funnel.orgnr}`;
        await storeFingerprint(tx, funnel.orgnr, funnel.filingYear - 1, RESELLER);
        const other = await subjectIn(tx);
        expect(other.filing?.filingYear).toBe(funnel.filingYear);
        expect(other.filing?.fingerprint).toBeNull();
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it('throws on a stored value outside a category’s set, never reads it as a default', () => {
    const row = { ...CONSULTANCY, cost_of_goods_lo: 'medium' } as unknown as typeof CONSULTANCY;
    expect(() => fingerprintFromColumns(row)).toThrow(TypeError);
  });
});

// Nothing in src/ names a register API or a model host. The bare
// origin https://data.brreg.no is allowed: it is the NLOD attribution link
// on "Slik fungerer Peerless", which a visitor follows, not a request the
// server makes. Any path under brreg.no (an API endpoint) fails.
describe('sources under src/', () => {
  const FORBIDDEN = [
    /brreg\.no\/[a-z]/i,
    /\bapi\.brreg\b/i,
    // API paths, not the registers' names, which the copy uses.
    /regnskapsregisteret\/regnskap|enhetsregisteret\/api/i,
    /anthropic\.com|openai\.com|googleapis\.com|generativelanguage|mistral\.ai|cohere\.(ai|com)|ollama/i,
  ];
  const files = listRepositoryFiles(root).filter((file) => /^src\/.*\.(ts|tsx|json)$/.test(file));

  it('finds the sources, so the scan is not empty', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('names no register API or model host', () => {
    const found = files.flatMap((file) => {
      const source = readFileSync(path.join(root, file), 'utf8');
      return FORBIDDEN.filter((pattern) => pattern.test(source)).map((pattern) => `${file}: ${pattern}`);
    });
    expect(found).toEqual([]);
  });
});
