// Linted as src/engine/fixture.ts: Math.round is banned in the engine.
export function wholeKroner(ore: number): number {
  return Math.round(ore / 100);
}
