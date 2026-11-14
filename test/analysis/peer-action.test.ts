// The exclude button's own guard (Story 2.10, triage 25): at the cap a press
// does nothing, before the provider is asked. The provider refuses as well,
// so the e2e cap tests pass without this guard; only this test shows it.
// The tests run in Node without a DOM, so the button's click handler is taken
// from the element PeerAction returns, rendered inside a provider whose
// `change` is a spy, and called as a press would call it.
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PeerAction } from '../../src/components/analysis/peer-action.tsx';
import { PeerChangeContext, type PeerChange, type PeerChangeValue } from '../../src/components/analysis/peer-change.tsx';

type Props = Parameters<typeof PeerAction>[0];

/** Renders PeerAction with a spy as the provider's `change`; returns the button's onClick and the spy. */
function pressable(props: Props): { readonly press: () => void; readonly change: ReturnType<typeof vi.fn> } {
  const change = vi.fn<(requested: PeerChange) => void>();
  const value: PeerChangeValue = {
    isPending: false,
    failed: false,
    change,
    commit: () => {},
    hasChangeInFlight: () => false,
    fail: () => {},
    showAllBand: null,
    openShowAll: () => {},
  };
  let button: ReactElement<{ onClick: () => void }> | null = null;
  // Called as a function inside a component, so its hook reads this provider.
  function Capture() {
    button = PeerAction(props) as ReactElement<{ onClick: () => void }>;
    return button;
  }
  renderToString(createElement(PeerChangeContext.Provider, { value }, createElement(Capture)));
  const captured = button as ReactElement<{ onClick: () => void }> | null;
  if (captured === null) throw new Error('PeerAction rendered nothing');
  return { press: () => captured.props.onClick(), change };
}

describe('PeerAction at the exclusion cap', () => {
  it('a press on a capped "Ekskluder" does not call the provider', () => {
    const { press, change } = pressable({ orgnr: '900000001', navn: 'STOR AS', excluded: false, capReached: true });
    press();
    expect(change).not.toHaveBeenCalled();
  });

  it('below the cap a press asks the provider to exclude', () => {
    const { press, change } = pressable({ orgnr: '900000001', navn: 'STOR AS', excluded: false, capReached: false });
    press();
    expect(change).toHaveBeenCalledWith({ kind: 'exclude', orgnr: '900000001', navn: 'STOR AS' });
  });

  it('at the cap "Ta med igjen" still asks the provider to restore', () => {
    const { press, change } = pressable({ orgnr: '900000001', navn: 'STOR AS', excluded: true, capReached: true });
    press();
    expect(change).toHaveBeenCalledWith({ kind: 'restore', orgnr: '900000001', navn: 'STOR AS' });
  });
});
