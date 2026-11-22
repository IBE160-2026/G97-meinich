// The drill-downs' open state (Story 3.7, review): an id is forgotten when its
// body unmounts, so after a client navigation to another company a drill-down
// with the same id starts closed. The unmount itself is driven in a browser by
// e2e/provenance.spec.ts "a drill-down open on one company is closed on the next".
import { describe, expect, it } from 'vitest';
import { dispatchProvenance, forgetProvenance, nextProvenanceOpen, provenanceOpen } from '../../src/components/analysis/provenance.tsx';

describe('the drill-downs’ open state', () => {
  it('toggles, and Lukk and Esc close', () => {
    expect(nextProvenanceOpen(false, 'toggle')).toBe(true);
    expect(nextProvenanceOpen(true, 'toggle')).toBe(false);
    expect(nextProvenanceOpen(true, 'close')).toBe(false);
    expect(nextProvenanceOpen(true, 'escape')).toBe(false);
  });

  it('forgets an id, and only that id', () => {
    dispatchProvenance('hero-prov', 'toggle');
    dispatchProvenance('kf-d-prov-driftsmargin', 'toggle');
    expect(provenanceOpen('hero-prov')).toBe(true);
    forgetProvenance('hero-prov');
    expect(provenanceOpen('hero-prov')).toBe(false);
    expect(provenanceOpen('kf-d-prov-driftsmargin')).toBe(true);
    forgetProvenance('kf-d-prov-driftsmargin');
    expect(provenanceOpen('kf-d-prov-driftsmargin')).toBe(false);
  });
});
