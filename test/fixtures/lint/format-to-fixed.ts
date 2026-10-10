// Linted as src/lib/format-fixture.ts: toFixed is banned in formatting code.
export function percent(value: number): string {
  return `${value.toFixed(1)} %`;
}
