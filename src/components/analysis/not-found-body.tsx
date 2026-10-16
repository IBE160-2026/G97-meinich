'use client';

// What a 404 shows (Story 1.6b). The path is read by the URL module:
//
// - an analysis URL with an invalid orgnr (not nine digits, or failing
//   modulus 11): the front page's content, the hero field holding the input
//   with the length or checksum message in its error state;
// - an analysis URL with a valid orgnr Peerless has no data for: a State
//   block with "Peerless har ikke data for dette organisasjonsnummeret ennå.
//   …" and the demo company links under the h1 "Ingen data for dette
//   selskapet". No register call;
// - any other unknown path: the h1 "Fant ikke siden" and a State block
//   saying the page does not exist.
// The h1 is focusable (tabIndex -1), so a client navigation focuses it.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PATH_CONTEXT } from '@/analysis/view';
import { StateBlock } from '@/components/analysis/state-block';
import { FrontPageBody } from '@/components/front-page-body';
import { DEMO_COMPANIES } from '@/demo-companies';
import { t } from '@/messages';
import { defaultState, parse, serialize } from '@/url/analysis-state';

export interface NotFoundBodyProps {
  /** The covered industries as "{kode} {navn}", for the front page's lead. */
  readonly lead: string;
  /** The covered industries as written mid-sentence. */
  readonly coverage: string;
}

export function NotFoundBody({ lead, coverage }: NotFoundBodyProps) {
  const pathname = usePathname();
  const parsed = parse(pathname, PATH_CONTEXT);

  if (parsed.kind === 'invalid-orgnr') {
    return (
      <FrontPageBody
        key={pathname}
        lead={lead}
        coverage={coverage}
        initialValue={parsed.input}
        initialError={parsed.reason === 'length' ? 'search.orgnrLength' : 'search.orgnrChecksum'}
      />
    );
  }

  return (
    <main id="innhold" className="flex-1 px-gutter-phone pt-6 md:px-gutter-desktop md:pt-8">
      <h1 tabIndex={-1} className="m-0 mb-4 text-[21px] leading-[1.2] md:text-2xl">
        {t(parsed.kind === 'analysis' ? 'notFound.noDataTitle' : 'notFound.pageTitle')}
      </h1>
      {parsed.kind === 'analysis' ? (
        <StateBlock>
          <p className="m-0">{t('search.unknownOrgnr', { industry: coverage })}</p>
          <p className="m-0 mt-2 flex flex-wrap gap-x-4">
            {DEMO_COMPANIES.map((company) => (
              <Link
                key={company.orgnr}
                href={serialize(defaultState(company.orgnr))}
                className="inline-flex min-h-6 items-center"
              >
                {company.navn}
              </Link>
            ))}
          </p>
        </StateBlock>
      ) : (
        <StateBlock>
          <p className="m-0">{t('notFound.page')}</p>
          <p className="m-0 mt-2">
            <Link href="/" className="inline-flex min-h-6 items-center">
              {t('notFound.home')}
            </Link>
          </p>
        </StateBlock>
      )}
    </main>
  );
}
