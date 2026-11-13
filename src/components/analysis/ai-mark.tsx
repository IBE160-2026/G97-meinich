// The AI marker (Story 2.7; EXPERIENCE.md "AI marking (✦)"): the glyph in
// slate, `aria-hidden`, at the size of the label it precedes. Screen
// readers hear "KI-generert" once per cell instead: `spoken={false}` draws
// the glyph alone, for a second marker in a cell that has said it already
// (a phone card's basis and flag). Never on a number, never on "Hvorfor med".
import { t } from '@/messages';

/** The glyph, U+2726, kept here so every marker is the same. */
export const AI_GLYPH = '✦';

export function AiMark({ spoken = true }: { readonly spoken?: boolean }) {
  return (
    <>
      <span aria-hidden="true" className="mr-1 text-slate" data-testid="ai-mark">
        {AI_GLYPH}
      </span>
      {spoken ? <span className="sr-only">{`${t('peers.ai')} `}</span> : null}
    </>
  );
}
