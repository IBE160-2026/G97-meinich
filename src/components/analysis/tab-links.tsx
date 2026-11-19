// The analysis tabs (FR-62; EXPERIENCE.md "Tabs"): links, not ARIA tabs,
// one per open tab, each to its own path with every other URL setting kept,
// aria-current="page" on the active one. Four since Story 3.5: Oversikt,
// Peers, Nøkkeltall og gap, Verdi. They wrap at phone width, never scroll.
// Each is an AnalysisLink, so a share chosen on Verdi is kept (Story 3.5),
// and none prefetches (Story 2.8): every peer-group change renders a new
// URL, and prefetching the other tabs would make each change cost several
// analysis requests against the rate limit instead of one.
import { OPEN_FANER, type OpenFane } from '@/analysis/view';
import { t } from '@/messages';
import { AnalysisLink } from './analysis-link';

export function TabLinks({ active }: { readonly active: OpenFane }) {
  return (
    <nav aria-label={t('tabs.label')} className="mt-4 border-b border-divider px-2 md:px-gutter-desktop">
      <ul className="m-0 flex list-none flex-wrap p-0 md:gap-0.5">
        {OPEN_FANER.map((fane) => {
          const current = fane === active;
          return (
            <li key={fane} className="min-w-0">
              <AnalysisLink
                target={{ fane }}
                aria-current={current ? 'page' : undefined}
                lang={fane === 'peers' ? 'en' : undefined}
                className={`inline-flex min-h-11 items-center px-[7px] py-2 text-[13px] leading-[1.2] no-underline md:px-3 md:text-[14px] ${
                  current ? 'font-semibold text-navy-900 shadow-[inset_0_-2px_0_var(--color-navy-700)]' : 'text-slate'
                }`}
              >
                {t(`tabs.${fane}`)}
              </AnalysisLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
