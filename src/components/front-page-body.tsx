// The front page's content (FR-61; EXPERIENCE.md "Forside"): one headline,
// one sentence on what Peerless covers, the hero search, "Slik fungerer det"
// in three numbered steps and the link to "Slik fungerer Peerless".
//
// Rendered by `/` and, for an analysis URL whose orgnr is invalid, by the
// analysis not-found page with the input and its message in the field
// (Story 1.6b). No hooks and no server import, so it renders on either side.
import Link from 'next/link';
import { SearchField, type ValidationId } from '@/components/search-field';
import { t } from '@/messages';

const STEPS = [
  { title: 'front.steps.1.title', body: 'front.steps.1.body' },
  { title: 'front.steps.2.title', body: 'front.steps.2.body' },
  { title: 'front.steps.3.title', body: 'front.steps.3.body' },
] as const;

export interface FrontPageBodyProps {
  /** The covered industries as "{kode} {navn}", for the lead sentence. */
  readonly lead: string;
  /** The covered industries as written mid-sentence, for the search's messages. */
  readonly coverage: string;
  readonly initialValue?: string;
  readonly initialError?: ValidationId;
}

export function FrontPageBody({ lead, coverage, initialValue, initialError }: FrontPageBodyProps) {
  return (
    <main id="innhold" className="flex-1">
      <section className="px-gutter-phone pt-front-hero-top-phone pb-11 md:px-10 md:pt-front-hero-top md:pb-[88px] md:text-center">
        <div className="mx-auto max-w-[720px]">
          <h1
            tabIndex={-1}
            className="m-0 mb-3 text-[28px] leading-[1.15] tracking-[-0.01em] md:mb-4 md:text-[40px]"
          >
            {t('front.title')}
          </h1>
          {lead !== '' ? (
            <p className="m-0 mb-6 text-base text-slate md:mx-auto md:mb-9 md:max-w-[600px] md:text-lg">
              {t('front.lead', { industry: lead })}
            </p>
          ) : null}
          <div className="mx-auto max-w-[620px]">
            <SearchField variant="hero" coverage={coverage} initialValue={initialValue} initialError={initialError} />
          </div>
        </div>
      </section>
      <section
        aria-labelledby="slik-fungerer-det"
        className="mx-auto max-w-[1120px] px-gutter-phone pt-2 pb-11 md:px-10 md:pt-6 md:pb-[72px]"
      >
        <h2 id="slik-fungerer-det" className="m-0 mb-4 text-xl md:mb-6 md:text-[22px]">
          {t('front.steps.title')}
        </h2>
        <ol className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 border-t border-navy-900 pt-4">
              <span aria-hidden="true" className="figure w-[22px] flex-none text-[28px] leading-none font-light text-slate">
                {index + 1}
              </span>
              <div>
                <p className="m-0 mb-1 text-base font-semibold">{t(step.title)}</p>
                <p className="m-0 text-slate">{t(step.body)}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="m-0 mt-9 text-[15px]">
          <Link href="/slik-fungerer-peerless" className="inline-flex min-h-6 items-center">
            {t('front.howLink')}
          </Link>
        </p>
      </section>
    </main>
  );
}
