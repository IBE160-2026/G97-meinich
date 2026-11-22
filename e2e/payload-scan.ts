// The pure half of the AD-4 payload scan (e2e/payload.ts), with no
// Playwright and no seed, so test/payload-scan.test.ts can run its probes.
//
// Story 3.7 (decision 6): the drill-down writes register field names, which
// the scans otherwise refuse. A field name is allowed only as
// `<code data-provenance-field="">name</code>` in the HTML, or as that
// element in the RSC payload (`["$","code",…,{"data-provenance-field":"",
// "children":"name"}]`, escaped inside the HTML's inline payload). Those
// occurrences are removed first and returned; every existing substring scan
// then runs over what is left, unchanged.
import { DOCUMENT_FIGURE_COLUMNS, type DocumentField } from '../src/engine/document-inputs.ts';
import { Decimal } from '../src/engine/decimal.ts';
import { formatKroner, formatMillions } from '../src/engine/format.ts';

/** Field names of the server's subject and candidate reads that must never reach the browser. */
export const SERVER_FIELDS = [
  'sumDriftsinntekter',
  'sum_driftsinntekter_ore',
  'driftsresultat_ore',
  'sum_eiendeler_ore',
  'sum_egenkapital_ore',
  'keyFigures',
  'brregId',
  'fingerprint',
  'costOfGoods',
  'personnelCost',
  'assetIntensity',
  'capitalisedIntangibles',
  'classification',
  'business_type',
  'forretningsadresse_kommune',
  'organisasjonsform',
  // Story 2.7: the match basis reaches the page as its label, never as its id.
  'matchBasis',
  'description_and_accounts',
  'accounts_only',
  'description_only',
  'industry_and_size_only',
  // Story 3.2: the turnover benchmark stays on the server; the page gets the factor view's strings.
  'turnoverBenchmark',
  // Story 3.3: the engine's margin waterfall stays on the server; the page gets its view's strings and geometry.
  'totalOre',
  'totalKroner',
  'startKroner',
  'endKroner',
  'barKroner',
  'subjectMargin',
  'aggregateMargin',
] as const;

const HTML_FIELD = /<code data-provenance-field="">(\w+)<\/code>/g;
const RSC_FIELD = /\[\\?"\$\\?",\\?"code\\?",(?:null|\\?"\w+\\?"),\{\\?"data-provenance-field\\?":\\?"\\?",\\?"children\\?":\\?"(\w+)\\?"\}\]/g;

/** The body with every marked field name removed, and the names, each once, sorted. */
export function provenanceFields(body: string): { readonly rest: string; readonly fields: readonly string[] } {
  const fields = new Set<string>();
  const rest = body
    .replace(HTML_FIELD, (_match, name: string) => {
      fields.add(name);
      return '';
    })
    .replace(RSC_FIELD, (_match, name: string) => {
      fields.add(name);
      return '';
    });
  return { rest, fields: [...fields].sort() };
}

const DOCUMENT_FIELDS = Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[];

/**
 * The document fields of the server's reads that must never reach the
 * browser, as names that cannot be ordinary page text: the columns
 * (`kundefordringer_ore`), the engine's names made of more than one word
 * (`annenDriftskostnad`), the document basis and its parts, and (Story 3.7)
 * the stored reconciliation the data-quality line is decided from.
 */
export const DOCUMENT_SERVER_FIELDS: readonly string[] = [
  ...Object.values(DOCUMENT_FIGURE_COLUMNS),
  ...DOCUMENT_FIELDS.filter((field) => /[A-Z]/.test(field)),
  'documentBasis',
  'documentBenchmark',
  'document_status',
  'current_status',
  'prior_status',
  'prior_api_fail_fields',
  'in_manifest',
  'priorRevenueFailsApi',
  'numeratorOre',
  'denominatorOre',
  // Story 3.7, decision 6.
  'api_check',
  'api_fail_fields',
  'apiCheck',
  'apiFailFields',
  'documentFacts',
  'document_read_at',
];

/**
 * The single-word engine names (`kundefordringer`, `varekostnad`), which
 * Norwegian copy may contain ("varekostnad og andre driftskostnader …"):
 * found only as an object key, `"kundefordringer":` in the RSC payload and
 * `\"kundefordringer\":` inside the HTML's inline payload. Story 3.7: the
 * within-document checks `c1`–`c5` the same way, as keys.
 */
const DOCUMENT_KEYS = [...DOCUMENT_FIELDS.filter((field) => !/[A-Z]/.test(field)), 'c1', 'c2', 'c3', 'c4', 'c5'].map(
  (field) => new RegExp(`"${field}\\\\?"\\s*:`),
);

/** The document fields found in `body`: names, keys and the `cur_`/`pri_` columns. */
export function documentFieldsIn(body: string): string[] {
  return [
    ...DOCUMENT_SERVER_FIELDS.filter((field) => body.includes(field)),
    ...DOCUMENT_KEYS.filter((key) => key.test(body)).map(String),
    ...(/\b(cur|pri)_[a-z]/.test(body) ? ['cur_/pri_'] : []),
  ];
}

/**
 * Story 3.7, decision 6: a peer's document lines as the page would write
 * them in kroner ("1 234 567 kr"), found in `body`. `peerOre` are the
 * peers' lines in øre; a line under 10 000 kr is skipped (such short
 * amounts occur in ordinary page text), and so is one equal to a line of
 * the subject's own (`subjectOre`), which its drill-down may show.
 */
export function formattedPeerLinesIn(body: string, peerOre: readonly string[], subjectOre: readonly string[]): string[] {
  const own = new Set(subjectOre.map((ore) => formatKroner(ore)));
  const lines = [...new Set(peerOre.filter((ore) => ore.replace(/^-/, '').length >= 7).map((ore) => formatKroner(ore)))];
  // Not inside a longer number: "1 234 567 kr" is not found in "11 234 567 kr".
  return lines.filter((line) => !own.has(line) && standsAlone(body, line));
}

/** `digits` in `body` as a digit run of its own. */
const digitRun = (body: string, digits: string) => new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(body);

/** `value` ("8.016", "8,016") in `body`, not inside a longer number. */
const digitRunWithin = (body: string, value: string) => new RegExp(`(?<![\\d.,])${value.replace('.', '\\.')}`).test(body);

/**
 * Story 3.8: a sum over the common peer set P, which no page may carry in
 * any form (the margin waterfall's drill-downs show only shares and the
 * subject's own lines): in øre or kroner as digits, in kroner and in
 * millions as the page writes them. `sumsOre` are the sums in øre; each
 * form found is returned.
 */
export function groupSumsIn(body: string, sumsOre: readonly string[]): string[] {
  const found: string[] = [];
  for (const ore of sumsOre) {
    const digits = ore.replace(/^-/, '');
    const kroner = digits.endsWith('00') ? digits.slice(0, -2) : null;
    for (const form of [formatKroner(ore), formatMillions(ore)]) if (standsAlone(body, form)) found.push(form);
    for (const run of [digits, ...(kroner === null ? [] : [kroner])]) if (run.length >= 6 && digitRun(body, run)) found.push(run);
  }
  return found;
}

/**
 * Story 3.8: a share of P (Aₓ, M) beyond the two decimals the drill-down
 * shows: any percent written with three or more decimals, and each exact
 * share's own digits, as a percent with 3–8 decimals (comma or point) or as
 * the fraction's first six decimals. A share with no digit beyond two
 * decimals of percent has nothing more to leak and is skipped.
 */
export function finePercentsIn(body: string, sharesExact: readonly string[]): string[] {
  const found = [...body.matchAll(/(?<![\d,])\d+,\d{3,}[\s ]?%/g)].map((match) => match[0]);
  for (const share of sharesExact) {
    const percent = new Decimal(share).mul(100);
    if (percent.decimalPlaces() <= 2) continue;
    for (let places = 3; places <= 8; places += 1) {
      for (const rounding of [Decimal.ROUND_DOWN, Decimal.ROUND_HALF_UP]) {
        const fixed = percent.toDecimalPlaces(places, rounding).toFixed(places);
        for (const form of [fixed, fixed.replace('.', ',')]) if (digitRunWithin(body, form)) found.push(form);
      }
    }
    const [, decimals = ''] = new Decimal(share).toString().split('.');
    if (decimals.length >= 6) {
      const prefix = `0.${decimals.slice(0, 6)}`;
      if (body.includes(prefix)) found.push(prefix);
    }
  }
  return [...new Set(found)];
}

/** `needle` in `body`, not as the tail of a longer number ("1 234 567 kr" in "11 234 567 kr"). */
function standsAlone(body: string, needle: string): boolean {
  for (let at = body.indexOf(needle); at !== -1; at = body.indexOf(needle, at + 1)) {
    const before = at === 0 ? '' : body.charAt(at - 1);
    if (!/[0-9−]/.test(before) && before !== NBSP) return true;
  }
  return false;
}

const NBSP = String.fromCharCode(0xa0);
