import 'server-only';
// The subject of one analysis (Story 1.6b), read as `reader`: the company,
// whether its primary industry is covered, its newest SELSKAP filing and
// that filing's key figures. One parameterised query ($1 is the orgnr the
// URL module has already checked: nine digits, modulus 11). Peerless's own
// database only, never the register.
//
// lookupSubject is wrapped in React's cache(): the layout decides the 404
// from it, and the page and its metadata read the same row within the
// request.
import { cache } from 'react';
import type { Subject, SubjectKeyFigures } from '../analysis/view.ts';
import { readerSql } from './db.ts';

interface SubjectRow extends SubjectKeyFigures {
  orgnr: string;
  navn: string | null;
  naeringskode1: string | null;
  naeringskode1_beskrivelse: string | null;
  forretningsadresse_kommune: string | null;
  covered: boolean;
  /** Null when the company has no SELSKAP filing. */
  filing_year: number | null;
  valuta: string | null;
  filing_read_at: Date | null;
}

// The newest SELSKAP filing by filing_year (then by period end, should two
// periods end in one year, then by period start and the register's id, so
// the choice is deterministic). The key-figure columns are the seven the engine's
// API inputs read (src/engine/inputs.ts); `bigint` arrives as a string.
export const SUBJECT_SQL = `
select c.orgnr,
       c.navn,
       c.naeringskode1,
       c.naeringskode1_beskrivelse,
       c.forretningsadresse_kommune,
       exists (select 1 from register.covered_industry ci where ci.code = c.naeringskode1) as covered,
       f.filing_year,
       f.valuta,
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
        select fi.brreg_id, fi.filing_year, fi.valuta, fi.read_at
          from register.filing fi
         where fi.orgnr = c.orgnr and fi.regnskapstype = 'SELSKAP'
         order by fi.filing_year desc, fi.periode_til desc, fi.periode_fra desc, fi.brreg_id desc
         limit 1
       ) f on true
  left join register.key_figures k on k.brreg_id = f.brreg_id
 where c.orgnr = $1::char(9)`;

function toSubject(row: SubjectRow): Subject {
  const filing =
    row.filing_year === null || row.filing_read_at === null
      ? null
      : {
          filingYear: row.filing_year,
          valuta: row.valuta,
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

export type SubjectLookup =
  | { readonly kind: 'found'; readonly subject: Subject }
  | { readonly kind: 'absent' }
  /** The read failed; nothing about the cause leaves the server. */
  | { readonly kind: 'failed' };

/**
 * loadSubject for the request path, once per request. A failed read is a
 * value, not a throw: the lookup runs before any Suspense boundary (so a 404
 * or a 307 can be decided first), where a thrown error would bypass the
 * analysis error state and end in Next.js's global error page. The caller
 * renders the lookup-error state instead.
 */
export const lookupSubject = cache(async (orgnr: string): Promise<SubjectLookup> => {
  try {
    const subject = await loadSubject(orgnr);
    return subject === null ? { kind: 'absent' } : { kind: 'found', subject };
  } catch (error) {
    // Only the error's class and its Postgres SQLSTATE reach the log: never
    // its message, the query or the orgnr. Nothing reaches the client.
    console.error(`analysis: subject lookup failed (${failureKind(error)})`);
    return { kind: 'failed' };
  }
});
