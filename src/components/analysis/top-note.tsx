// The top note "Viser gap ved full tilnærming · Endre i Verdi" (Story 3.5;
// EXPERIENCE.md "Table top note"): on the key-figure table, the Oversikt hero
// and Oversikt's capital card, each of which shows its gap at full
// convergence whatever the share; the link goes to Verdi with every other
// setting kept.
import { t, tParts } from '@/messages';
import { AnalysisLink } from './analysis-link';

export function TopNote({ className }: { readonly className: string }) {
  return (
    <p className={className} data-testid="top-note">
      {tParts('keyFigures.topNoteWithEdit', {
        endre: (
          <AnalysisLink key="endre" target={{ fane: 'verdi' }} className="inline-flex min-h-6 items-center" data-testid="top-note-verdi">
            {t('keyFigures.editInVerdi')}
          </AnalysisLink>
        ),
      })}
    </p>
  );
}
