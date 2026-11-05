// What the sum gates of the digits-only pass admitted, counted from stored
// columns (Story 2.5b; spec change log, Meinich 2026-11-05, addition b).
//
// The gates themselves are in step 1 (`SUM_GATES` in
// ingest/src/peerless_ingest/documents.py); this mirrors their operands so
// the report and the 2.1b counts can count, from what is stored, how many
// figures each gate admitted. test/sum-gates.test.ts checks the mirror
// against the Python source.
//
// - A gate-admitted figure is a field in a column's `digits_pass_fields`
//   that is an operand of a gate: no other rule lets a digits-only figure of
//   an operand in (the c1–c4 rule never confirms one).
// - It rested on an operand counted as 0 when another operand of the same
//   gate is NULL in the stored column. The gate counted that operand as 0,
//   so its row was blank (printed with no figure in either pass) or absent:
//   the stored data cannot tell the two apart.
//
// Totals only: nothing here names a company.

export const SUM_GATE_OPERANDS = {
  cost_lines: ['varekostnad', 'lonnskostnad', 'avskrivninger', 'nedskrivninger', 'annen_driftskostnad'],
  intangible_parts: ['forskning_og_utvikling', 'konsesjoner_patenter', 'goodwill', 'utsatt_skattefordel'],
} as const;
export type SumGate = keyof typeof SUM_GATE_OPERANDS;
export const SUM_GATES: readonly SumGate[] = ['cost_lines', 'intangible_parts'];

/** One stored column: the fields taken from the digits-only pass, and whether a field holds a figure. */
export interface GateColumn {
  readonly digitsPassFields: readonly string[];
  readonly hasFigure: (field: string) => boolean;
}

export interface GateCount {
  /** Figures the gate admitted. */
  admitted: number;
  /** Of those, the ones in a column where another operand of the gate is NULL: counted as 0 (a blank row or no row). */
  withOperandCountedAsZero: number;
}

export type GateCounts = Record<SumGate, GateCount>;

/** Per gate, the figures it admitted and how many rested on an operand counted as 0. */
export function gateCounts(columns: readonly GateColumn[]): GateCounts {
  const out = {} as GateCounts;
  for (const gate of SUM_GATES) {
    const operands: readonly string[] = SUM_GATE_OPERANDS[gate];
    let admitted = 0;
    let withZero = 0;
    for (const column of columns) {
      for (const field of column.digitsPassFields.filter((f) => operands.includes(f))) {
        admitted += 1;
        if (operands.some((other) => other !== field && !column.hasFigure(other))) withZero += 1;
      }
    }
    out[gate] = { admitted, withOperandCountedAsZero: withZero };
  }
  return out;
}

/** A Postgres text[] as COPY writes it in CSV: `{}` or `{a,b}`, the names unquoted. */
export function parseTextArray(value: string, where: string): string[] {
  const match = /^\{([a-z_,]*)\}$/.exec(value);
  if (match === null) throw new Error(`${where}: not a field list: ${JSON.stringify(value)}`);
  const inner = match[1] ?? '';
  return inner === '' ? [] : inner.split(',');
}
