import 'server-only';
// The subject of one analysis (Story 1.6b), read as `reader`: the company,
// whether its primary industry is covered, its SELSKAP filings with their
// key figures, of which the engine picks the benchmark filing (Story 3.7,
// D2: `subjectBenchmarkFiling`). One parameterised query ($1 is the orgnr the
// URL module has already checked: nine digits, modulus 11). Peerless's own
// database only, never the register.
//
// lookupSubject is wrapped in React's cache(): the layout decides the 404
// from it, and the page and its metadata read the same row within the
// request. A failed read throws (see lookupSubject).
//
// Story 2.5: both reads left-join the stored fingerprint of the filing year
// (register.fingerprint, written by batch step 2) for funnel stage 4. Its
// categories are parsed by the engine's one validator, which throws on a
// value outside a category's set; no fingerprint is null, never a default.
//
// Story 2.9: both reads also left-join the stored document of the filing
// year and its two columns, and read whether the orgnr is on the loaded
// dataset's list of orgnrs with document figures (register.dataset), so the
// engine can decide each company's document basis (src/analysis/
// document-basis.ts, which logs a listed company with no stored document).
import { cache } from 'react';
import {
  DOCUMENT_JOINS,
  DOCUMENT_SELECT,
  documentBasisOf,
  documentFactsOf,
  logCandidatesRead,
  logSubjectRead,
  type DocumentBasisColumns,
} from '../analysis/document-basis.ts';
import type { Subject, SubjectKeyFigures } from '../analysis/view.ts';
import type { DocumentBasis } from '../engine/document-inputs.ts';
import { businessTypeFromColumn, fingerprintFromColumns, type FingerprintColumns } from '../engine/fingerprint.ts';
import { API_KEY_FIGURE_COLUMNS, apiKeyFigures, parseOre, type ApiKeyFiguresRow } from '../engine/inputs.ts';
import { subjectBenchmarkFiling, type CandidateFiling } from '../engine/peers.ts';
import { failureKind, log } from '../logger.ts';
import { readerSql } from './db.ts';

export type SubjectRow = SubjectRowFields & DocumentBasisColumns;

interface SubjectRowFields extends SubjectKeyFigures, FingerprintColumns {
  /** A register.dataset row exists: without one, every company is outside the dataset (Story 2.9). */
  dataset_loaded: boolean;
  classification: string | null;
  orgnr: string;
  navn: string | null;
  organisasjonsform: string | null;
  naeringskode1: string | null;
  naeringskode1_beskrivelse: string | null;
  forretningsadresse_kommune: string | null;
  covered: boolean;
  /** The filing's register id (int8 as a string); null when the company has no SELSKAP filing. */
  brreg_id: string | null;
  /** Null when the company has no SELSKAP filing. */
  filing_year: number | null;
  regnskapstype: string | null;
  /** "YYYY-MM-DD": cast to text in SQL, so no time zone touches it. */
  periode_fra: string | null;
  periode_til: string | null;
  valuta: string | null;
  regnskapsregler: string | null;
  smaa_foretak: boolean | null;
  avviklingsregnskap: boolean | null;
  filing_read_at: Date | null;
}

// The key-figure columns both reads select: the seven the engine's API
// inputs read (API_KEY_FIGURE_COLUMNS in src/engine/inputs.ts), from the
// join aliased `k`. `bigint` arrives as a string.
const KEY_FIGURE_SELECT = API_KEY_FIGURE_COLUMNS.map((column) => `k.${column}`).join(',\n       ');

// Every SELSKAP filing of the subject, one row each with its key figures
// (KEY_FIGURE_SELECT), its year's fingerprint and its year's document; a
// company with no SELSKAP filing gives one row whose filing columns are all
// NULL. The query chooses no filing: the engine's `subjectBenchmarkFiling`
// does (Story 3.7, D2), on the one order `benchmarkFiling` writes.
export const SUBJECT_SQL = `
select c.orgnr,
       c.navn,
       c.organisasjonsform,
       c.naeringskode1,
       c.naeringskode1_beskrivelse,
       c.forretningsadresse_kommune,
       exists (select 1 from register.covered_industry ci where ci.code = c.naeringskode1) as covered,
       exists (select 1 from register.dataset) as dataset_loaded,
       f.brreg_id,
       f.filing_year,
       f.regnskapstype,
       f.periode_fra::text as periode_fra,
       f.periode_til::text as periode_til,
       f.valuta,
       f.regnskapsregler,
       f.smaa_foretak,
       f.avviklingsregnskap,
       f.read_at as filing_read_at,
       ${KEY_FIGURE_SELECT},
       fp.cost_of_goods_lo,
       fp.cost_of_goods_hi,
       fp.personnel_cost_lo,
       fp.personnel_cost_hi,
       fp.asset_intensity_lo,
       fp.asset_intensity_hi,
       fp.inventory,
       fp.capitalised_intangibles,
       cl.business_type as classification,
       ${DOCUMENT_SELECT}
  from register.company c
  left join register.filing f on f.orgnr = c.orgnr and f.regnskapstype = 'SELSKAP'
  left join register.key_figures k on k.brreg_id = f.brreg_id
  left join register.fingerprint fp on fp.orgnr = c.orgnr and fp.filing_year = f.filing_year
  left join register.classification cl on cl.orgnr = c.orgnr${DOCUMENT_JOINS}
 where c.orgnr = $1::char(9)`;

/** A SUBJECT_SQL row that holds a filing, with what `subjectBenchmarkFiling` orders it by. */
type FilingRow = {
  readonly row: SubjectRow & { readonly filing_year: number; readonly regnskapstype: string; readonly periode_fra: string; readonly periode_til: string; readonly filing_read_at: Date };
  readonly filingYear: number;
  readonly regnskapstype: string;
  readonly periodeFra: string;
  readonly periodeTil: string;
  readonly brregId: bigint;
};

function filingRow(row: SubjectRow): FilingRow | null {
  const { filing_year, regnskapstype, periode_fra, periode_til, filing_read_at } = row;
  if (filing_year === null || regnskapstype === null || periode_fra === null || periode_til === null || filing_read_at === null) {
    return null;
  }
  // brreg_id is int8: parseOre reads any int8 string exactly. A filing row always has one.
  const brregId = parseOre(row.brreg_id);
  if (brregId === null) throw new TypeError('filing without brreg_id');
  return {
    row: { ...row, filing_year, regnskapstype, periode_fra, periode_til, filing_read_at },
    filingYear: filing_year,
    regnskapstype,
    periodeFra: periode_fra,
    periodeTil: periode_til,
    brregId,
  };
}

/**
 * The subject from SUBJECT_SQL's rows: the company (the same on every row)
 * and its benchmark filing, chosen by the engine (`subjectBenchmarkFiling`,
 * Story 3.7, D2). Throws on no rows: the caller decides "not found".
 */
export function toSubject(rows: readonly SubjectRow[]): Subject {
  const first = rows[0];
  if (first === undefined) throw new RangeError('toSubject needs the company row');
  const chosen = subjectBenchmarkFiling(rows.map(filingRow).filter((filing) => filing !== null));
  const row = chosen?.row ?? first;
  const filing =
    chosen === null
      ? null
      : {
          filingYear: chosen.row.filing_year,
          regnskapstype: chosen.row.regnskapstype,
          periodeFra: chosen.row.periode_fra,
          periodeTil: chosen.row.periode_til,
          valuta: row.valuta,
          regnskapsregler: row.regnskapsregler,
          smaaForetak: row.smaa_foretak,
          avviklingsregnskap: row.avviklingsregnskap,
          readAt: chosen.row.filing_read_at,
          brregId: chosen.brregId,
          fingerprint: fingerprintFromColumns(row),
          classification: businessTypeFromColumn(row.classification),
          documentBasis: documentBasisOf(row, chosen.row.filing_year),
          documentFacts: documentFactsOf(row),
          keyFigures: apiKeyFigures(row),
        };
  return {
    orgnr: row.orgnr,
    navn: row.navn,
    organisasjonsform: row.organisasjonsform,
    naeringskode1: row.naeringskode1,
    naeringskode1Beskrivelse: row.naeringskode1_beskrivelse,
    kommune: row.forretningsadresse_kommune,
    covered: row.covered,
    filing,
  };
}

/** The subject for a valid orgnr, or null when Peerless has no such company. Throws when the read fails. */
export async function loadSubject(orgnr: string): Promise<Subject | null> {
  const rows = await readerSql().unsafe<SubjectRow[]>(SUBJECT_SQL, [orgnr]);
  const row = rows[0];
  if (row === undefined) return null;
  const subject = toSubject(rows);
  logSubjectRead(row.dataset_loaded, subject.filing?.documentBasis ?? null);
  return subject;
}

/**
 * loadSubject for the request path, once per request (React's cache()): the
 * layout decides the 404 from it, and the page and its metadata read the
 * same row. A failed read throws a new error with a fixed message, so the
 * driver's error (its message, the query, the address) goes no further than
 * the one log line below. Thrown before streaming, it makes Next.js answer
 * 500; the analysis error boundary (the analysis segment's error.tsx) shows only
 * the alert.
 */
export const lookupSubject = cache(async (orgnr: string): Promise<Subject | null> => {
  try {
    return await loadSubject(orgnr);
  } catch (error) {
    // Only the error's class and its Postgres SQLSTATE reach the log: never
    // its message, the query or the orgnr.
    log('error', 'analysis.subjectFailed', { failure: failureKind(error) });
    throw new Error('analysis: subject lookup failed');
  }
});

/**
 * A candidate's filing as the funnel reads it, with what the Peers list
 * shows (the name; since Story 2.7 no municipality) and the seven
 * key-figure inputs the three API figures are computed from (Story 1.8). Selection never reads
 * those inputs (src/engine/peers.ts takes a CandidateFiling, which has no
 * such field); they are compared only after the group is formed. Nothing
 * else per peer is read (AD-4): no employee count, no other register field.
 * None of it reaches the browser as a value: the page sends only the
 * formatted statistics.
 */
export type Candidate = CandidateFiling & {
  readonly navn: string | null;
  readonly keyFigures: SubjectKeyFigures;
  /** Where its document figures come from for the benchmark year, or why none do (Story 2.9). */
  readonly documentBasis: DocumentBasis;
};

export type CandidateRow = CandidateRowFields & DocumentBasisColumns;

interface CandidateRowFields extends FingerprintColumns, ApiKeyFiguresRow {
  classification: string | null;
  orgnr: string;
  navn: string | null;
  organisasjonsform: string | null;
  naeringskode1: string | null;
  brreg_id: string;
  regnskapstype: string;
  periode_fra: string;
  periode_til: string;
  filing_year: number;
  valuta: string | null;
  regnskapsregler: string | null;
  smaa_foretak: boolean | null;
  avviklingsregnskap: boolean | null;
}

// Every filing in the benchmark year ($3) of every company with the
// subject's primary industry ($2), other than the subject ($1). The engine
// picks each company's benchmark filing and runs stages 1–3; the band is
// applied there, so one read serves every band. The key-figure columns are
// KEY_FIGURE_SELECT, as in SUBJECT_SQL.
export const CANDIDATES_SQL = `
select c.orgnr,
       c.navn,
       c.organisasjonsform,
       c.naeringskode1,
       f.brreg_id,
       f.regnskapstype,
       f.periode_fra::text as periode_fra,
       f.periode_til::text as periode_til,
       f.filing_year,
       f.valuta,
       f.regnskapsregler,
       f.smaa_foretak,
       f.avviklingsregnskap,
       ${KEY_FIGURE_SELECT},
       fp.cost_of_goods_lo,
       fp.cost_of_goods_hi,
       fp.personnel_cost_lo,
       fp.personnel_cost_hi,
       fp.asset_intensity_lo,
       fp.asset_intensity_hi,
       fp.inventory,
       fp.capitalised_intangibles,
       cl.business_type as classification,
       ${DOCUMENT_SELECT}
  from register.company c
  join register.filing f on f.orgnr = c.orgnr and f.filing_year = $3::smallint
  left join register.key_figures k on k.brreg_id = f.brreg_id
  left join register.fingerprint fp on fp.orgnr = c.orgnr and fp.filing_year = f.filing_year
  left join register.classification cl on cl.orgnr = c.orgnr${DOCUMENT_JOINS}
 where c.naeringskode1 = $2::text
   and c.orgnr <> $1::char(9)`;

export function toCandidate(row: CandidateRow): Candidate {
  // brreg_id is int8 like the amounts: parseOre reads any int8 string
  // exactly, never through a JavaScript number.
  const brregId = parseOre(row.brreg_id);
  if (brregId === null) throw new TypeError('filing without brreg_id');
  return {
    orgnr: row.orgnr,
    navn: row.navn,
    organisasjonsform: row.organisasjonsform,
    naeringskode1: row.naeringskode1,
    brregId,
    regnskapstype: row.regnskapstype,
    periodeFra: row.periode_fra,
    periodeTil: row.periode_til,
    filingYear: row.filing_year,
    valuta: row.valuta,
    regnskapsregler: row.regnskapsregler,
    smaaForetak: row.smaa_foretak,
    avviklingsregnskap: row.avviklingsregnskap,
    sumDriftsinntekter: parseOre(row.sum_driftsinntekter_ore),
    fingerprint: fingerprintFromColumns(row),
    classification: businessTypeFromColumn(row.classification),
    documentBasis: documentBasisOf(row, row.filing_year),
    keyFigures: apiKeyFigures(row),
  };
}

/** The candidate filings for a subject: same naeringskode1, the benchmark year. Throws when the read fails. */
export async function loadCandidates(orgnr: string, naeringskode1: string, filingYear: number): Promise<Candidate[]> {
  const rows = await readerSql().unsafe<CandidateRow[]>(CANDIDATES_SQL, [orgnr, naeringskode1, filingYear]);
  const candidates = rows.map(toCandidate);
  logCandidatesRead(candidates.map((candidate) => candidate.documentBasis));
  return candidates;
}

/**
 * loadCandidates for the request path, once per request (React's cache()),
 * failing as lookupSubject does: a fixed message, and only the error's
 * class and SQLSTATE in the log.
 */
export const lookupCandidates = cache(
  async (orgnr: string, naeringskode1: string, filingYear: number): Promise<Candidate[]> => {
    try {
      return await loadCandidates(orgnr, naeringskode1, filingYear);
    } catch (error) {
      log('error', 'analysis.candidatesFailed', { failure: failureKind(error) });
      throw new Error('analysis: candidate lookup failed');
    }
  },
);
