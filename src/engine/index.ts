// The calculation engine (AD-8): pure functions, figures in, figures out.
// Imports only decimal.js (through decimal.ts) and its own modules.
// roundHalfAwayFromZero is not re-exported: rounding happens only in format.ts.
export { Decimal } from './decimal.ts';
export * from './types.ts';
export * from './key-figures.ts';
export * from './statistics.ts';
export * from './inputs.ts';
export * from './format.ts';
