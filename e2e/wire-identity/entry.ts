// The browser half of the identity test (Story 3.5; AD-6): bundled by vite
// in e2e/wire-identity.spec.ts and run in Chromium. It exposes the one
// function both sides run: every text `verdiCards` writes for each wire at
// each closable share, as JSON.
import { verdiCards, type VerdiWire } from '../../src/analysis/verdi-view.ts';
import { FIXED_SHARES, type ClosableShare } from '../../src/engine/closable.ts';

export function texts(wires: readonly VerdiWire[]): string {
  const shares: readonly ClosableShare[] = [...FIXED_SHARES, 'median'];
  return JSON.stringify(
    wires.map((wire) => shares.filter((share) => share !== 'median' || wire.step.kind === 'exists').map((share) => verdiCards(wire, share))),
  );
}
