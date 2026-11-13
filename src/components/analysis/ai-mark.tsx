// The AI marker (Story 2.7; EXPERIENCE.md "AI marking (✦)") for server
// components: the glyph in slate, `aria-hidden`, at the size of the label it
// precedes, with "KI-generert" for screen readers once per cell.
// `spoken={false}` draws the glyph alone, for a marker whose text says
// "KI-generert" already. Never on a number, never on "Hvorfor med".
import { t } from '@/messages';
import { Mark } from './peer-card';

export function AiMark({ spoken = true }: { readonly spoken?: boolean }) {
  return <Mark ki={spoken ? t('peers.ai') : null} />;
}
