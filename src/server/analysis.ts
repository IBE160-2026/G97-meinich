import 'server-only';
// The subject of one analysis (Story 1.6b), read as `reader`: the company,
// whether its primary industry is covered, its newest SELSKAP filing and
// that filing's key figures. One parameterised query ($1 is the orgnr the
// URL module has already checked: nine digits, modulus 11). Peerless's own
// database only, never the register.
//
// lookupSubject is wrapped in React's cache(): the layout decides the 404
// from it, and the page and its metadata read the same row within the
// request. A failed read throws (see lookupSubject).
import { cache } from 'react';
import type { Subject, SubjectKeyFigures } from '../analysis/view.ts';
import { parseOre } from '../engine/inputs.ts';
import type { CandidateFiling } from '../engine/peers.ts';
import { readerSql } from './db.ts';

interface SubjectRow extends SubjectKeyFigures {
  orgnr: string;
  navn: string | null;
  organisasjonsform: string | null;
  naeringskode1: string | null;
  naeringskode1_beskrivelse: string | null;
  forretningsadresse_kommune: string | null;
  covered: boolean;
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

// The newest SELSKAP filing by filing_year (then by period end, should two
// periods end in one year, then by period start and the register's id, so
// the choice is deterministic). The key-figure columns are the seven the engine's
// API inputs read (src/engine/inputs.ts); `bigint` arrives as a string.
export const SUBJECT_SQL = `
select c.orgnr,
       c.navn,
       c.organisasjonsform,
       c.naeringskode1,
       c.naeringskode1_beskrivelse,
       c.forretningsadresse_kommune,
       exists (select 1 from register.covered_industry ci where ci.code = c.naeringskode1) as covered,
       f.filing_year,
       f.regnskapstype,
       f.periode_fra::text as periode_fra,
       f.periode_til::text as periode_til,
       f.valuta,
       f.regnskapsregler,
       f.smaa_foretak,
       f.avviklingsregnskap,
       f.read_at as filing_read_at,
       k.sum_driftsinntekter_ore,
       k.driftsresultat_ore,
       k.sum_driftskostnad_ore,
       k.sum_eiendeler_ore,
       k.sum_egenkapital_gjeld_ore,
       k.sum_egenkapital_ore,
       k.sum_gjeld_ore
  from register.company c
  left join lateral (
        select fi.brreg_id, fi.filing_year, fi.regnskapstype, fi.periode_fra, fi.periode_til, fi.valuta,
               fi.regnskapsregler, fi.smaa_foretak, fi.avviklingsregnskap, fi.read_at
          from register.filing fi
         where fi.orgnr = c.orgnr and fi.regnskapstype = 'SELSKAP'
         order by fi.filing_year desc, fi.periode_til desc, fi.periode_fra desc, fi.brreg_id desc
         limit 1
       ) f on true
  left join register.key_figures k on k.brreg_id = f.brreg_id
 where c.orgnr = $1::char(9)`;

function toSubject(row: SubjectRow): Subject {
  const filing =
    row.filing_year === null ||
    row.filing_read_at === null ||
    row.regnskapstype === null ||
    row.periode_fra === null ||
    row.periode_til === null
      ? null
      : {
          filingYear: row.filing_year,
          regnskapstype: row.regnskapstype,
          periodeFra: row.periode_fra,
          periodeTil: row.periode_til,
          valuta: row.valuta,
          regnskapsregler: row.regnskapsregler,
          smaaForetak: row.smaa_foretak,
          avviklingsregnskap: row.avviklingsregnskap,
          readAt: row.filing_read_at,
          keyFigures: {
            sum_driftsinntekter_ore: row.sum_driftsinntekter_ore,
            driftsresultat_ore: row.driftsresultat_ore,
            sum_driftskostnad_ore: row.sum_driftskostnad_ore,
            sum_eiendeler_ore: row.sum_eiendeler_ore,
            sum_egenkapital_gjeld_ore: row.sum_egenkapital_gjeld_ore,
            sum_egenkapital_ore: row.sum_egenkapital_ore,
            sum_gjeld_ore: row.sum_gjeld_ore,
          },
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
  return row === undefined ? null : toSubject(row);
}

/** "PostgresError 57014", "Error": the class name and a five-character SQLSTATE when there is one. */
export function failureKind(error: unknown): string {
  const name = error instanceof Error ? error.constructor.name : typeof error;
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? `${name} ${code}` : name;
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
    console.error(`analysis: subject lookup failed (${failureKind(error)})`);
    throw new Error('analysis: subject lookup failed');
  }
});

/**
 * A candidate's filing as the funnel reads it, with what the Peers list
 * shows (the name and the municipality) and the seven key-figure inputs the
 * three API figures are computed from (Story 1.8). Selection never reads
 * those inputs (src/engine/peers.ts takes a CandidateFiling, which has no
 * such field); they are compared only after the group is formed. Nothing
 * else per peer is read (AD-4): no employee count, no other register field.
 * None of it reaches the browser as a value: the page sends only the
 * formatted statistics.
 */
export type Candidate = CandidateFiling & {
  readonly navn: string | null;
  readonly kommune: string | null;
  readonly keyFigures: SubjectKeyFigures;
};

interface CandidateRow {
  orgnr: string;
  navn: string | null;
  organisasjonsform: string | null;
  naeringskode1: string | null;
  forretningsadresse_kommune: string | null;
  brreg_id: string;
  regnskapstype: string;
  periode_fra: string;
  periode_til: string;
  filing_year: number;
  valuta: string | null;
  regnskapsregler: string | null;
  smaa_foretak: boolean | null;
  avviklingsregnskap: boolean | null;
  sum_driftsinntekter_ore: string | null;
  driftsresultat_ore: string | null;
  sum_driftskostnad_ore: string | null;
  sum_eiendeler_ore: string | null;
  sum_egenkapital_gjeld_ore: string | null;
  sum_egenkapital_ore: string | null;
  sum_gjeld_ore: string | null;
}

// Every filing in the benchmark year ($3) of every company with the
// subject's primary industry ($2), other than the subject ($1). The engine
// picks each company's benchmark filing and runs stages 1–3; the band is
// applied there, so one read serves every band. The key-figure columns are
// the seven the engine's API inputs read, as in SUBJECT_SQL.
export const CANDIDATES_SQL = `
select c.orgnr,
       c.navn,
       c.organisasjonsform,
       c.naeringskode1,
       c.forretningsadresse_kommune,
       f.brreg_id,
       f.regnskapstype,
       f.periode_fra::text as periode_fra,
       f.periode_til::text as periode_til,
       f.filing_year,
       f.valuta,
       f.regnskapsregler,
       f.smaa_foretak,
       f.avviklingsregnskap,
       k.sum_driftsinntekter_ore,
       k.driftsresultat_ore,
       k.sum_driftskostnad_ore,
       k.sum_eiendeler_ore,
       k.sum_egenkapital_gjeld_ore,
       k.sum_egenkapital_ore,
       k.sum_gjeld_ore
  from register.company c
  join register.filing f on f.orgnr = c.orgnr and f.filing_year = $3::smallint
  left join register.key_figures k on k.brreg_id = f.brreg_id
 where c.naeringskode1 = $2::text
   and c.orgnr <> $1::char(9)`;

function toCandidate(row: CandidateRow): Candidate {
  // brreg_id is int8 like the amounts: parseOre reads any int8 string
  // exactly, never through a JavaScript number.
  const brregId = parseOre(row.brreg_id);
  if (brregId === null) throw new TypeError('filing without brreg_id');
  return {
    orgnr: row.orgnr,
    navn: row.navn,
    kommune: row.forretningsadresse_kommune,
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
    keyFigures: {
      sum_driftsinntekter_ore: row.sum_driftsinntekter_ore,
      driftsresultat_ore: row.driftsresultat_ore,
      sum_driftskostnad_ore: row.sum_driftskostnad_ore,
      sum_eiendeler_ore: row.sum_eiendeler_ore,
      sum_egenkapital_gjeld_ore: row.sum_egenkapital_gjeld_ore,
      sum_egenkapital_ore: row.sum_egenkapital_ore,
      sum_gjeld_ore: row.sum_gjeld_ore,
    },
  };
}

/** The candidate filings for a subject: same naeringskode1, the benchmark year. Throws when the read fails. */
export async function loadCandidates(orgnr: string, naeringskode1: string, filingYear: number): Promise<Candidate[]> {
  const rows = await readerSql().unsafe<CandidateRow[]>(CANDIDATES_SQL, [orgnr, naeringskode1, filingYear]);
  return rows.map(toCandidate);
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
      console.error(`analysis: candidate lookup failed (${failureKind(error)})`);
      throw new Error('analysis: candidate lookup failed');
    }
  },
);
