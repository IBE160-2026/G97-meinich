// How a covered industry is written in copy. The code comes from
// register.covered_industry and the name from the register's own
// naeringskode1_beskrivelse, so no industry is a literal in src/ (AD-16).
import { lowerFirst } from '../engine/format.ts';
import { t } from './index.ts';

export interface CoveredIndustry {
  /** register.covered_industry.code, e.g. the SN2025 code. */
  readonly code: string;
  /** The register's naeringskode1_beskrivelse for that code; null when no stored company has one. */
  readonly beskrivelse: string | null;
}

/** "{kode} {navn}", as in the front-page lead; the code alone without a name. */
export function industryNamed(industry: CoveredIndustry): string {
  if (industry.beskrivelse === null) return industry.code;
  return t('industry.named', { kode: industry.code, navn: industry.beskrivelse });
}

/** "{navn} ({kode})" with the name's first letter lower-cased, for use mid-sentence. */
export function industryInSentence(industry: CoveredIndustry): string {
  if (industry.beskrivelse === null) return industry.code;
  return t('industry.inSentence', { kode: industry.code, navn: lowerFirst(industry.beskrivelse) });
}

/** "a", "a og b", "a, b og c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return t('list.and', { first: items.slice(0, -1).join(', '), last: items[items.length - 1] ?? '' });
}
