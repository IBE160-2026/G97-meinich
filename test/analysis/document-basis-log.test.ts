// The document basis of a company as the analysis reads it (Story 2.9): the
// row's document columns into the engine's basis, and the warnings the reads
// log. `documentBasisOf` logs nothing; one subject read logs at most one
// `analysis.documentMissing` and one `analysis.datasetMissing`, and one
// candidate read at most one `analysis.documentMissing`, however many
// candidates lack a document. No line carries an orgnr. The rows are
// synthetic; the reader client is replaced by one that returns them.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DocumentBasisColumns, documentBasisOf } from '../../src/analysis/document-basis.ts';
import { DOCUMENT_FIGURE_COLUMNS } from '../../src/engine/document-inputs.ts';

const ORGNR = '999999905';

const database = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock('server-only', () => ({}));
vi.mock('../../src/server/db.ts', () => ({
  readerSql: () => ({ unsafe: async () => database.rows }),
}));

const { loadCandidates, loadSubject } = await import('../../src/server/analysis.ts');

function row(overrides: Partial<DocumentBasisColumns>): DocumentBasisColumns {
  const figures: Record<string, string | null> = {};
  for (const column of Object.values(DOCUMENT_FIGURE_COLUMNS)) {
    figures[`cur_${column}`] = '100000';
    figures[`pri_${column}`] = '100000';
  }
  return {
    in_manifest: true,
    document_status: 'reconciled',
    has_current: true,
    current_status: 'reconciled',
    has_prior: true,
    prior_status: 'reconciled',
    sum_omloepsmidler_ore: null,
    ...figures,
    ...overrides,
  } as DocumentBasisColumns;
}

const NO_DOCUMENT: Partial<DocumentBasisColumns> = { document_status: null, has_current: false, has_prior: false };

/** A synthetic company's subject or candidate row: a 62.100 AS with a 2025 filing, no fingerprint, no classification. */
function companyRow(orgnr: string, documents: Partial<DocumentBasisColumns>, datasetLoaded = true): Record<string, unknown> {
  return {
    ...row(documents),
    dataset_loaded: datasetLoaded,
    orgnr,
    navn: 'SYNTETISK TESTSELSKAP AS',
    organisasjonsform: 'AS',
    naeringskode1: '62.100',
    naeringskode1_beskrivelse: 'Dataprogrammeringstjenester',
    forretningsadresse_kommune: 'OSLO',
    covered: true,
    brreg_id: '1',
    filing_year: 2025,
    regnskapstype: 'SELSKAP',
    periode_fra: '2025-01-01',
    periode_til: '2025-12-31',
    valuta: 'NOK',
    regnskapsregler: 'regnskapslovenAlminneligRegler',
    smaa_foretak: true,
    avviklingsregnskap: false,
    filing_read_at: new Date('2026-10-11T10:09:57Z'),
    sum_driftsinntekter_ore: '250000000',
    driftsresultat_ore: '-12500000',
    sum_driftskostnad_ore: '262500000',
    sum_eiendeler_ore: '120000000',
    sum_egenkapital_gjeld_ore: '120000000',
    sum_egenkapital_ore: '40000000',
    sum_gjeld_ore: '80000000',
    classification: null,
    cost_of_goods_lo: null,
    cost_of_goods_hi: null,
    personnel_cost_lo: null,
    personnel_cost_hi: null,
    asset_intensity_lo: null,
    asset_intensity_hi: null,
    inventory: null,
    capitalised_intangibles: null,
  };
}

const DOCUMENT_MISSING = '{"level":"warn","event":"analysis.documentMissing"}';
const DATASET_MISSING = '{"level":"warn","event":"analysis.datasetMissing"}';

function spyLog() {
  return {
    out: vi.spyOn(console, 'log').mockImplementation(() => {}),
    err: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  database.rows = [];
});

describe('documentBasisOf', () => {
  it('decides the basis and logs nothing, whatever the basis', () => {
    const { out, err } = spyLog();
    const bases = [
      documentBasisOf(row({}), 2025),
      documentBasisOf(row(NO_DOCUMENT), 2025),
      documentBasisOf(row({ in_manifest: false, document_status: null }), 2025),
      documentBasisOf(row({ document_status: null }), 2026),
      documentBasisOf(row({ document_status: 'paper', has_current: false, has_prior: false }), 2025),
      documentBasisOf(row({ document_status: 'not_extracted', has_current: false, has_prior: false }), 2025),
      documentBasisOf(row({ document_status: 'failed_reconciliation', current_status: 'failed_reconciliation' }), 2025),
    ];
    expect(bases.map((basis) => basis.kind)).toEqual([
      'read',
      'document_missing',
      'not_in_dataset',
      'not_read_in_v1',
      'not_read_in_v1',
      'refused',
      'failed_reconciliation',
    ]);
    expect(out).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });

  it('reads the current and the prior column from their prefixed columns', () => {
    const basis = documentBasisOf(
      row({ cur_sum_driftsinntekter_ore: '1000000000', pri_sum_driftsinntekter_ore: '900000000', has_prior: true }),
      2025,
    );
    if (basis.kind !== 'read') throw new Error(`expected read, got ${basis.kind}`);
    expect(basis.current.sumDriftsinntekter).toEqual({ kind: 'value', ore: 1_000_000_000n });
    expect(basis.prior?.sumDriftsinntekter).toEqual({ kind: 'value', ore: 900_000_000n });
    expect(documentBasisOf(row({ has_prior: false }), 2025)).toMatchObject({ kind: 'read', prior: null });
  });

  it('applies R3 with the filing’s sum_omloepsmidler', () => {
    const basis = documentBasisOf(row({ cur_kundefordringer_ore: '100000000', sum_omloepsmidler_ore: '50000000' }), 2025);
    if (basis.kind !== 'read') throw new Error(`expected read, got ${basis.kind}`);
    expect(basis.current.kundefordringer).toEqual({ kind: 'absent', absence: { reason: 'exceeds_api_subtotal' } });
  });
});

describe('the reads’ warnings', () => {
  it('a missing document logs once without the orgnr', async () => {
    const { out, err } = spyLog();
    database.rows = [companyRow(ORGNR, NO_DOCUMENT)];
    expect((await loadSubject(ORGNR))?.filing?.documentBasis).toEqual({ kind: 'document_missing', filingYear: 2025 });
    expect(out.mock.calls).toEqual([[DOCUMENT_MISSING]]);
    expect(JSON.stringify(out.mock.calls)).not.toContain(ORGNR);
    expect(err).not.toHaveBeenCalled();
  });

  it('a subject with its document logs nothing', async () => {
    const { out } = spyLog();
    database.rows = [companyRow(ORGNR, {})];
    expect((await loadSubject(ORGNR))?.filing?.documentBasis.kind).toBe('read');
    expect(out).not.toHaveBeenCalled();
  });

  it('a candidate read logs once, however many candidates lack a document', async () => {
    const { out } = spyLog();
    database.rows = [
      companyRow('999999891', NO_DOCUMENT),
      companyRow('999999883', NO_DOCUMENT),
      companyRow('999999875', {}),
    ];
    const candidates = await loadCandidates(ORGNR, '62.100', 2025);
    expect(candidates.map((candidate) => candidate.documentBasis.kind)).toEqual(['document_missing', 'document_missing', 'read']);
    expect(out.mock.calls).toEqual([[DOCUMENT_MISSING]]);
    expect(JSON.stringify(out.mock.calls)).not.toMatch(/\d{9}/);
  });

  it('a candidate read with every document stored logs nothing', async () => {
    const { out } = spyLog();
    database.rows = [companyRow('999999891', {}), companyRow('999999883', { in_manifest: false })];
    await loadCandidates(ORGNR, '62.100', 2025);
    expect(out).not.toHaveBeenCalled();
  });

  it('a subject read with no loaded dataset logs it once', async () => {
    const { out } = spyLog();
    database.rows = [companyRow(ORGNR, { in_manifest: false }, false)];
    expect((await loadSubject(ORGNR))?.filing?.documentBasis).toEqual({ kind: 'not_in_dataset' });
    expect(out.mock.calls).toEqual([[DATASET_MISSING]]);
  });
});
