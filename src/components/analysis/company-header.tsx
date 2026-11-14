// The company header (FR-2, FR-64; DESIGN.md "Company header"): the name as
// the page's h1, then a slate meta line of items separated by "·". With a
// filing: orgnr · industry · revenue · "Regnskapsår YYYY · hentet D. mon.
// YYYY", with "{n} sammenlignbare" after the revenue when the subject has a
// peer group (Story 1.7), also when n is 0. Without one: identification only — orgnr · industry ·
// municipality. The read date is formatted here, on the server, in
// Europe/Oslo (formatReadDate); the year is the stored filing_year.
//
// Story 2.8: the count is the peers in the analysis (the group minus
// `ekskl`), marked busy and dimmed while a peer-group change is in flight,
// and a widened size band adds the tag "Utvidet" after it.
import { Fragment, type ReactNode } from 'react';
import { displayName, type Subject } from '@/analysis/view';
import { formatKommune, formatMillions, formatOrgnr, formatReadDate } from '@/engine/format';
import { t } from '@/messages';
import { industryNamed } from '@/messages/industry';
import { PendingCount } from './peer-change';

/** "{kode} {navn}", the code alone, the name alone, or null when the register gives neither. */
export function industryText(subject: Pick<Subject, 'naeringskode1' | 'naeringskode1Beskrivelse'>): string | null {
  if (subject.naeringskode1 !== null) {
    return industryNamed({ code: subject.naeringskode1, beskrivelse: subject.naeringskode1Beskrivelse });
  }
  return subject.naeringskode1Beskrivelse;
}

type MetaItem = { readonly key: string; readonly node: ReactNode };

const text = (value: string): MetaItem => ({ key: value, node: value });

function metaItems(subject: Subject, peerCount: number | undefined, widened: boolean): MetaItem[] {
  const items = [text(formatOrgnr(subject.orgnr))];
  const industry = industryText(subject);
  if (industry !== null) items.push(text(industry));
  const filing = subject.filing;
  if (filing === null) {
    if (subject.kommune !== null) items.push(text(formatKommune(subject.kommune)));
    return items;
  }
  // Kroner only for a NOK filing: the formatter writes "kr" whatever the
  // currency, so another valuta shows no revenue rather than a wrong unit.
  const revenue = filing.keyFigures.sum_driftsinntekter_ore;
  if (filing.valuta === 'NOK' && revenue !== null) {
    items.push(text(t('analysis.revenue', { belop: formatMillions(revenue) })));
  }
  if (peerCount !== undefined) {
    const count = peerCount === 1 ? t('analysis.peerCountOne') : t('analysis.peerCount', { n: String(peerCount) });
    items.push({
      key: 'peer-count',
      node: (
        <PendingCount>
          {count}
          {widened ? (
            <span
              className="ml-1.5 inline-flex items-center rounded-sm border border-input-border px-1.5 text-[11.5px] font-semibold text-navy-900"
              data-testid="widened-tag"
            >
              {t('peers.band.widened')}
            </span>
          ) : null}
        </PendingCount>
      ),
    });
  }
  items.push(text(t('analysis.dataDate', { aar: String(filing.filingYear), dato: formatReadDate(filing.readAt) })));
  return items;
}

export function CompanyHeader({
  subject,
  peerCount,
  widened = false,
}: {
  readonly subject: Subject;
  /** The peer group's size, excluded peers removed; omitted when there is no peer group. */
  readonly peerCount?: number;
  /** The size band is beyond Standard: the count is tagged "Utvidet". */
  readonly widened?: boolean;
}) {
  const items = metaItems(subject, peerCount, widened);
  return (
    <div className="px-gutter-phone pt-4 md:px-gutter-desktop md:pt-[22px]">
      <h1 tabIndex={-1} className="m-0 mb-1 text-[21px] leading-[1.2] break-words md:text-2xl">
        {displayName(subject)}
      </h1>
      <p className="figure m-0 flex flex-wrap gap-y-0.5 text-[13px] text-slate" data-testid="company-meta">
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? (
              <span aria-hidden="true" className="mx-[7px] text-input-border">
                ·
              </span>
            ) : null}
            {typeof item.node === 'string' ? <span>{item.node}</span> : item.node}
          </Fragment>
        ))}
      </p>
    </div>
  );
}
