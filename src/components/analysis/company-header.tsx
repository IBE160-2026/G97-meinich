// The company header (FR-2, FR-64; DESIGN.md "Company header"): the name as
// the page's h1, then a slate meta line of items separated by "·". With a
// filing: orgnr · industry · revenue · "Regnskapsår YYYY · hentet D. mon.
// YYYY", with "{n} sammenlignbare" after the revenue when the subject has a
// peer group (Story 1.7), also when n is 0. Without one: identification only — orgnr · industry ·
// municipality. The read date is formatted here, on the server, in
// Europe/Oslo (formatReadDate); the year is the stored filing_year.
import { Fragment } from 'react';
import { displayName, type Subject } from '@/analysis/view';
import { formatKommune, formatMillions, formatOrgnr, formatReadDate } from '@/engine/format';
import { t } from '@/messages';
import { industryNamed } from '@/messages/industry';

/** "{kode} {navn}", the code alone, the name alone, or null when the register gives neither. */
export function industryText(subject: Pick<Subject, 'naeringskode1' | 'naeringskode1Beskrivelse'>): string | null {
  if (subject.naeringskode1 !== null) {
    return industryNamed({ code: subject.naeringskode1, beskrivelse: subject.naeringskode1Beskrivelse });
  }
  return subject.naeringskode1Beskrivelse;
}

function metaItems(subject: Subject, peerCount: number | undefined): string[] {
  const items = [formatOrgnr(subject.orgnr)];
  const industry = industryText(subject);
  if (industry !== null) items.push(industry);
  const filing = subject.filing;
  if (filing === null) {
    if (subject.kommune !== null) items.push(formatKommune(subject.kommune));
    return items;
  }
  // Kroner only for a NOK filing: the formatter writes "kr" whatever the
  // currency, so another valuta shows no revenue rather than a wrong unit.
  const revenue = filing.keyFigures.sum_driftsinntekter_ore;
  if (filing.valuta === 'NOK' && revenue !== null) {
    items.push(t('analysis.revenue', { belop: formatMillions(revenue) }));
  }
  if (peerCount !== undefined) {
    items.push(peerCount === 1 ? t('analysis.peerCountOne') : t('analysis.peerCount', { n: String(peerCount) }));
  }
  items.push(t('analysis.dataDate', { aar: String(filing.filingYear), dato: formatReadDate(filing.readAt) }));
  return items;
}

export function CompanyHeader({
  subject,
  peerCount,
}: {
  readonly subject: Subject;
  /** The peer group's size, excluded peers removed; omitted when there is no peer group. */
  readonly peerCount?: number;
}) {
  const items = metaItems(subject, peerCount);
  return (
    <div className="px-gutter-phone pt-4 md:px-gutter-desktop md:pt-[22px]">
      <h1 tabIndex={-1} className="m-0 mb-1 text-[21px] leading-[1.2] break-words md:text-2xl">
        {displayName(subject)}
      </h1>
      <p className="figure m-0 flex flex-wrap gap-y-0.5 text-[13px] text-slate" data-testid="company-meta">
        {items.map((item, index) => (
          <Fragment key={item}>
            {index > 0 ? (
              <span aria-hidden="true" className="mx-[7px] text-input-border">
                ·
              </span>
            ) : null}
            <span>{item}</span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
