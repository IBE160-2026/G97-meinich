// The browser half of the identity test (Story 3.5; AD-6): bundled by vite
// in e2e/wire-identity.spec.ts and run in Chromium. It exposes the one
// function both sides run: every text `verdiCards` writes for each wire at
// each closable share, with no multiple and with each multiple (Story 3.6),
// as JSON. The multiples cross as the text a user types and are read by
// `parseMultippel` on each side, the one function that makes a `Multiple`.
import { verdiCards, type VerdiWire } from '../../src/analysis/verdi-view.ts';
import { FIXED_SHARES, type ClosableShare, type Multiple } from '../../src/engine/closable.ts';
import { parseMultippel } from '../../src/url/analysis-state.ts';

export function texts(wires: readonly VerdiWire[], typed: readonly string[]): string {
  const shares: readonly ClosableShare[] = [...FIXED_SHARES, 'median'];
  const multiples: (Multiple | null)[] = [
    null,
    ...typed.map((text) => {
      const parsed = parseMultippel(text);
      if (parsed === null) throw new Error(`not a multiple: ${text}`);
      return parsed;
    }),
  ];
  return JSON.stringify(
    wires.map((wire) =>
      shares
        .filter((share) => share !== 'median' || wire.step.kind === 'exists')
        .map((share) => multiples.map((multiple) => verdiCards(wire, share, multiple))),
    ),
  );
}
