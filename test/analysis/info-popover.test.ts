// The info button (Story 3.1b, decision 3): a real button with a visible ⓘ
// that opens its text on tap, click, Enter or Space (the button's own
// activation) and closes it on the button, on Esc and on a tap outside.
// The open state's rule is the pure `nextOpen`; the markup is rendered on
// the server; e2e/key-figures.spec.ts drives the real button in a browser.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InfoPopover, nextOpen } from '../../src/components/analysis/info-popover.tsx';

describe('the info popover', () => {
  it('opens and closes on button, Esc and outside tap', () => {
    // The button toggles: open, then closed again.
    expect(nextOpen(false, 'toggle')).toBe(true);
    expect(nextOpen(true, 'toggle')).toBe(false);
    // Esc and a tap outside close an open popover, and leave a closed one closed.
    expect(nextOpen(true, 'escape')).toBe(false);
    expect(nextOpen(true, 'outside')).toBe(false);
    expect(nextOpen(false, 'escape')).toBe(false);
    expect(nextOpen(false, 'outside')).toBe(false);
  });

  it('renders a closed real button with a visible ⓘ, named "Mer om dette", controlling its hidden text', () => {
    const html = renderToString(createElement(InfoPopover, { id: 'pop-1', label: 'Mer om dette', text: 'Den lange teksten.' }));
    expect(html).toMatch(
      /<button type="button" aria-expanded="false" aria-controls="pop-1"[^>]*><span aria-hidden="true">ⓘ<\/span><span class="sr-only">Mer om dette<\/span><\/button>/,
    );
    expect(html).toMatch(/<span id="pop-1" hidden=""[^>]*><span data-popover-text="">Den lange teksten\.<\/span><\/span>/);
    // At least 24 × 24 px (min-h-6 min-w-6).
    expect(html).toMatch(/<button[^>]*class="[^"]*min-h-6 min-w-6/);
  });

  // Story 5.4: an optional link after the text, inside the hidden part.
  it('renders the link after the text when given one, and none without', () => {
    const html = renderToString(
      createElement(InfoPopover, { id: 'pop-2', label: 'Mer om dette', text: 'Teksten.', link: { href: '/om#avsnitt', label: 'Les mer' } }),
    );
    expect(html).toMatch(/<span id="pop-2" hidden=""[^>]*><span data-popover-text="">Teksten\.<\/span> <a [^>]*href="\/om#avsnitt"[^>]*>Les mer<\/a><\/span>/);
    expect(renderToString(createElement(InfoPopover, { id: 'pop-3', label: 'x', text: 'y' }))).not.toContain('<a ');
  });
});
