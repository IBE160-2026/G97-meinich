// Linted as src/engine/fixture.ts: nothing banned here.
export function sum(values: readonly bigint[]): bigint {
  let total = 0n;
  for (const value of values) {
    total += value;
  }
  return total;
}
