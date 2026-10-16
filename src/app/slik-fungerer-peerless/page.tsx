// "Slik fungerer Peerless" (FR-72, FR-65; Story 1.6b). In Epic 1 it holds
// only the section "Kilder og lisens", which the footer links to (#kilder):
// the source, the NLOD credit for the API figures verbatim with links to the
// licence and the source, that Peerless has processed the data, and that
// Brønnøysundregistrene does not endorse Peerless. Every other section, and
// the document-figure paragraph (Story 5.4), is added by Epic 5, with no
// placeholder before then.
import type { Metadata } from 'next';
import { t, tParts } from '@/messages';

export const metadata: Metadata = {
  title: t('about.pageTitle'),
};

const NLOD_URL = 'https://data.norge.no/nlod/no/2.0';
const SOURCE_URL = 'https://data.brreg.no';

export default function AboutPage() {
  return (
    <main id="innhold" className="flex-1 px-gutter-phone pt-8 pb-6 md:px-gutter-desktop md:pt-12">
      <div className="mx-auto max-w-[720px]">
        <h1 tabIndex={-1} className="m-0 mb-6 text-[28px] leading-[1.15] md:text-[34px]">
          {t('about.title')}
        </h1>
        <section aria-labelledby="kilder" className="text-[15px] leading-[1.55]">
          <h2 id="kilder" tabIndex={-1} className="m-0 mb-3 text-xl md:text-[22px]">
            {t('about.sources.title')}
          </h2>
          <p className="m-0 mb-3">{t('about.sources.origin')}</p>
          <p className="m-0 mb-3 break-words" data-testid="nlod-credit">
            {tParts('about.sources.nlod', {
              lisens: (
                <a key="lisens" href={NLOD_URL}>
                  {t('about.sources.nlodLicence')}
                </a>
              ),
              lisensgiver: (
                <a key="lisensgiver" href={SOURCE_URL}>
                  {t('about.sources.nlodLicensor')}
                </a>
              ),
            })}
          </p>
          <p className="m-0 mb-3">{t('about.sources.processed')}</p>
          <p className="m-0">{t('about.sources.endorsement')}</p>
        </section>
      </div>
    </main>
  );
}
