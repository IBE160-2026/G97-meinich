// Funnel stages 1–3 (Story 1.7; FR-8): which companies are comparable with
// the subject, decided by rules only. Pure: the subject's benchmark-year
// filing and every same-industry company's filings for that year in, the
// candidate pool at one size band and a count per stage out.
//
//   stage 1  same naeringskode1, and sumDriftsinntekter inside the size band
//            around the subject's (both bounds included, exact in øre)
//   stage 2  equal and known valuta, regnskapsregler, smaaForetak,
//            avviklingsregnskap, financial period and regnskapstype; both
//            filings run 1 January – 31 December
//   stage 3  legal form AS
//
// Selection never reads a benchmarked measure: no margin, no return, no
// assets and no employee count (the register's is today's, not the year's).
// The input types carry no such field, so the funnel cannot read one.
// Stages 4–5 (fingerprint, classification) are Epic 2's; each adds a count.
import { Decimal } from './decimal.ts';

/** The size-band step: 0 Standard, 1 and 2 widened (Epic 2's control). */
export type SizeBand = 0 | 1 | 2;

/** Revenue bounds as multiples of the subject's revenue, exact decimals. */
export const SIZE_BANDS: Readonly<Record<SizeBand, { readonly lo: Decimal; readonly hi: Decimal }>> = {
  0: { lo: new Decimal('0.5'), hi: new Decimal('2') },
  1: { lo: new Decimal('0.33'), hi: new Decimal('3') },
  2: { lo: new Decimal('0.25'), hi: new Decimal('4') },
};

/** The one legal form stage 3 keeps. `ASA` is a different form. */
export const PEER_LEGAL_FORM = 'AS';

/** The fields stage 2 compares, as register.filing holds them. */
export type Comparability = {
  readonly regnskapstype: string;
  /** ISO date, "YYYY-MM-DD". */
  readonly periodeFra: string;
  /** ISO date, "YYYY-MM-DD". */
  readonly periodeTil: string;
  readonly valuta: string | null;
  readonly regnskapsregler: string | null;
  readonly smaaForetak: boolean | null;
  readonly avviklingsregnskap: boolean | null;
};

/** The subject's benchmark-year filing: the newest SELSKAP filing. */
export type SubjectFiling = Comparability & {
  readonly orgnr: string;
  readonly naeringskode1: string | null;
  readonly filingYear: number;
  /** Øre, as filed; null when the register's element is empty. */
  readonly sumDriftsinntekter: bigint | null;
};

/** One filing of one candidate company. A company may have several in a year. */
export type CandidateFiling = Comparability & {
  readonly orgnr: string;
  readonly naeringskode1: string | null;
  readonly organisasjonsform: string | null;
  /** The register's own filing id; the last tie-break between filings. */
  readonly brregId: bigint;
  readonly filingYear: number;
  /** Øre, as filed; null when the register's element is empty. */
  readonly sumDriftsinntekter: bigint | null;
};

export type FunnelCounts = {
  /** Companies left after stage 1. */
  readonly stage1: number;
  /** Companies left after stage 2, counted on stage 1's. */
  readonly stage2: number;
  /** Companies left after each stage-3 criterion, in order. */
  readonly stage3: { readonly legalForm: number };
};

/**
 * Why the group is empty when the subject itself cannot have peers:
 * `subject_no_revenue` — its revenue is null, zero or negative (stage 1);
 * `subject_non_calendar` — its filing does not run 1 January – 31 December
 * (stage 2). Null otherwise, also when the group is empty for another reason.
 */
export type EmptyReason = 'subject_no_revenue' | 'subject_non_calendar' | null;

export type PeerGroup<C extends CandidateFiling> = {
  /** Stages 1–3 at the band, one filing per company, by revenue descending, then orgnr. */
  readonly pool: readonly C[];
  readonly counts: FunnelCounts;
  readonly emptyReason: EmptyReason;
};

// ISO 4217 active currency codes, from ISO 4217 List One (current
// currency and funds), as of 2026; funds, precious metals and testing codes
// (X…, except the CFA franc, CFP franc, East Caribbean dollar and
// Caribbean guilder) are left out. A `valuta` outside this list (the
// register has filed `EDT`) cannot be compared and is never read as NOK.
const ISO_4217 = new Set(
  (
    'AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD ' +
    'CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP ' +
    'GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD ' +
    'KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN ' +
    'NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP ' +
    'SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VED VES VND ' +
    'VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG'
  ).split(' '),
);

/** Whether `valuta` is an ISO 4217 currency code. */
export function isKnownCurrency(valuta: string | null): boolean {
  return valuta !== null && ISO_4217.has(valuta);
}

/** Whether a period runs 1 January – 31 December of one year. */
export function isCalendarYear(filing: Pick<Comparability, 'periodeFra' | 'periodeTil'>): boolean {
  const from = /^(\d{4})-01-01$/.exec(filing.periodeFra);
  const to = /^(\d{4})-12-31$/.exec(filing.periodeTil);
  return from !== null && to !== null && from[1] === to[1];
}

/** -1, 0 or 1 as `a` sorts before, with or after `b` when ordered descending. */
function descending(a: string | bigint, b: string | bigint): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

/**
 * A company's benchmark filing among its filings: one with the benchmark
 * year, preferring the subject's `regnskapstype`, then the latest
 * `periodeTil`, `periodeFra` and `brregId`. Null when it has none that year.
 */
export function benchmarkFiling<C extends CandidateFiling>(
  filings: readonly C[],
  year: number,
  regnskapstype: string,
): C | null {
  const inYear = filings.filter((filing) => filing.filingYear === year);
  inYear.sort(
    (a, b) =>
      (b.regnskapstype === regnskapstype ? 1 : 0) - (a.regnskapstype === regnskapstype ? 1 : 0) ||
      descending(a.periodeTil, b.periodeTil) ||
      descending(a.periodeFra, b.periodeFra) ||
      descending(a.brregId, b.brregId),
  );
  return inYear[0] ?? null;
}

/** Stage 1's revenue test: r in [lo×s, hi×s], both bounds included. `s` > 0. */
function inBand(revenue: bigint | null, subjectRevenue: bigint, band: SizeBand): boolean {
  if (revenue === null) return false;
  const s = new Decimal(subjectRevenue.toString());
  const r = new Decimal(revenue.toString());
  const { lo, hi } = SIZE_BANDS[band];
  return r.gte(lo.mul(s)) && r.lte(hi.mul(s));
}

/** Equal and non-null on both sides. */
function same<T extends string | boolean>(a: T | null, b: T | null): boolean {
  return a !== null && b !== null && a === b;
}

/** Stage 2: every comparability field equal, a known currency, and both calendar years. */
export function isComparable(subject: Comparability, candidate: Comparability): boolean {
  return (
    isKnownCurrency(subject.valuta) &&
    same(subject.valuta, candidate.valuta) &&
    same(subject.regnskapsregler, candidate.regnskapsregler) &&
    same(subject.smaaForetak, candidate.smaaForetak) &&
    same(subject.avviklingsregnskap, candidate.avviklingsregnskap) &&
    same(subject.regnskapstype, candidate.regnskapstype) &&
    subject.periodeFra === candidate.periodeFra &&
    subject.periodeTil === candidate.periodeTil &&
    isCalendarYear(subject) &&
    isCalendarYear(candidate)
  );
}

/**
 * Funnel stages 1–3 at `band`. `candidates` are the filings of the companies
 * to consider, any number per company; the subject's own are ignored, and a
 * company without a filing in the subject's year is out before stage 1.
 */
export function assemblePeerGroup<C extends CandidateFiling>(
  subject: SubjectFiling,
  candidates: readonly C[],
  band: SizeBand,
): PeerGroup<C> {
  const byOrgnr = new Map<string, C[]>();
  for (const filing of candidates) {
    if (filing.orgnr === subject.orgnr) continue;
    const own = byOrgnr.get(filing.orgnr);
    if (own === undefined) byOrgnr.set(filing.orgnr, [filing]);
    else own.push(filing);
  }
  const benchmark: C[] = [];
  for (const filings of byOrgnr.values()) {
    const chosen = benchmarkFiling(filings, subject.filingYear, subject.regnskapstype);
    if (chosen !== null) benchmark.push(chosen);
  }

  // A subject with no positive revenue has no size band, so no peers: a
  // dormant subject is not compared with other dormant companies.
  const s = subject.sumDriftsinntekter;
  const subjectHasRevenue = s !== null && s > 0n;
  const stage1 =
    s !== null && subjectHasRevenue
      ? benchmark.filter(
          (filing) =>
            same(subject.naeringskode1, filing.naeringskode1) && inBand(filing.sumDriftsinntekter, s, band),
        )
      : [];
  const stage2 = stage1.filter((filing) => isComparable(subject, filing));
  const legalForm = stage2.filter((filing) => filing.organisasjonsform === PEER_LEGAL_FORM);

  // Every pool member has revenue (stage 1); orgnr ascending breaks ties.
  const pool = [...legalForm].sort(
    (a, b) =>
      descending(a.sumDriftsinntekter ?? 0n, b.sumDriftsinntekter ?? 0n) || -descending(a.orgnr, b.orgnr),
  );

  let emptyReason: EmptyReason = null;
  if (!subjectHasRevenue) emptyReason = 'subject_no_revenue';
  else if (!isCalendarYear(subject)) emptyReason = 'subject_non_calendar';

  return {
    pool,
    counts: { stage1: stage1.length, stage2: stage2.length, stage3: { legalForm: legalForm.length } },
    emptyReason,
  };
}

/** The pool with the `ekskl` companies removed: the group every aggregate uses. */
export function withoutExcluded<C extends { readonly orgnr: string }>(pool: readonly C[], ekskl: readonly string[]): C[] {
  const excluded = new Set(ekskl);
  return pool.filter((peer) => !excluded.has(peer.orgnr));
}
