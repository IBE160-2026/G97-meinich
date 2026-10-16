// The analysis tabs (FR-62; EXPERIENCE.md "Tabs"): links, not ARIA tabs,
// one per open tab, each to its own path with every other URL setting kept,
// aria-current="page" on the active one. Three in Epics 1–2; no Verdi tab
// or placeholder until Epic 3. They wrap at phone width, never scroll.
import Link from 'next/link';
import { OPEN_FANER, type OpenFane } from '@/analysis/view';
import { t } from '@/messages';
import { serialize, type AnalysisState } from '@/url/analysis-state';

export function TabLinks({ state, active }: { readonly state: AnalysisState; readonly active: OpenFane }) {
  return (
    <nav aria-label={t('tabs.label')} className="mt-4 border-b border-divider px-2 md:px-gutter-desktop">
      <ul className="m-0 flex list-none flex-wrap p-0 md:gap-0.5">
        {OPEN_FANER.map((fane) => {
          const current = fane === active;
          return (
            <li key={fane} className="min-w-0">
              <Link
                href={serialize({ ...state, fane })}
                aria-current={current ? 'page' : undefined}
                lang={fane === 'peers' ? 'en' : undefined}
                className={`inline-flex min-h-11 items-center px-[7px] py-2 text-[13px] leading-[1.2] no-underline md:px-3 md:text-[14px] ${
                  current ? 'font-semibold text-navy-900 shadow-[inset_0_-2px_0_var(--color-navy-700)]' : 'text-slate'
                }`}
              >
                {t(`tabs.${fane}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
