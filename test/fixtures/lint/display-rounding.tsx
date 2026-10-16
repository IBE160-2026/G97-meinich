// Linted as src/components/fixture.tsx and src/app/fixture.tsx: every way of
// rounding or formatting a number outside src/engine/format.ts is banned
// where numbers are displayed.
import { Decimal } from '@/engine/decimal';

export function Shown({ value, ratio }: { readonly value: number; readonly ratio: Decimal }) {
  return (
    <p>
      {value.toFixed(1)}
      {ratio.toDecimalPlaces(1).toString()}
      {ratio.toDP(1).toString()}
      {ratio.toSignificantDigits(3).toString()}
      {value.toLocaleString('nb-NO')}
    </p>
  );
}
