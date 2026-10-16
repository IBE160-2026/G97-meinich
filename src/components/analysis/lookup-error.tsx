// The lookup-error state for an analysis (EXPERIENCE.md "Lookup error"):
// role="alert" "Noe gikk galt. Prøv igjen om litt." and nothing else, so no
// partial figure is ever shown and nothing about the cause is rendered.
// Rendered by the analysis error boundary (the analysis segment's error.tsx), which
// a failed subject read reaches, by the global error page
// (src/app/global-error.tsx), and by the root not-found page when its
// coverage read fails.
import { StateBlock } from '@/components/analysis/state-block';
import { t } from '@/messages';

export function LookupError() {
  return (
    <main id="innhold" className="flex-1 px-gutter-phone pt-6 md:px-gutter-desktop md:pt-8">
      <div role="alert">
        <StateBlock>
          <p className="m-0">{t('search.failed')}</p>
        </StateBlock>
      </div>
    </main>
  );
}
