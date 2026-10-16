import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import clientRestrictedImports from './eslint-rules/client-restricted-imports.mjs';

// Server-only code and the database client must never reach the engine
// (AD-8: pure functions) or a client bundle (AD-19: nothing server-side in
// the browser). The same option object feeds both rules.
const serverImportRestriction = {
  paths: [
    { name: 'postgres', message: 'The database client is server-only (src/server).' },
  ],
  patterns: [
    {
      // The project's own server code only: @/server, src/server, or a
      // relative path ending in or passing through a `server` segment.
      // Package subpaths such as react-dom/server and next/server stay allowed.
      regex: /^(?:@\/server|src\/server|(?:\.{1,2}\/)+(?:[^/]+\/)*server)(?:\/.*)?$/.source,
      message: 'src/server is server-only; the engine and client modules may not import it.',
    },
    {
      regex: '^postgres/',
      message: 'The database client is server-only (src/server).',
    },
  ],
};

// The engine is pure functions, figures in and figures out (AD-8; Story 1.4):
// on top of the server restriction it may import nothing from Next.js or
// React, subpaths included (next/server, react/jsx-runtime, react-dom/server).
// Client modules keep serverImportRestriction alone: they import React.
const engineImportRestriction = {
  paths: [
    ...serverImportRestriction.paths,
    { name: 'next', message: 'The engine is framework-free (AD-8): no Next.js import.' },
    { name: 'react', message: 'The engine is framework-free (AD-8): no React import.' },
    { name: 'react-dom', message: 'The engine is framework-free (AD-8): no React import.' },
  ],
  patterns: [
    ...serverImportRestriction.patterns,
    { regex: '^next/', message: 'The engine is framework-free (AD-8): no Next.js import.' },
    { regex: '^react/', message: 'The engine is framework-free (AD-8): no React import.' },
    { regex: '^react-dom/', message: 'The engine is framework-free (AD-8): no React import.' },
  ],
};

// Every displayed number goes through src/engine/format.ts (AD-6).
// Intl.NumberFormat writes different characters in Node and in browsers, so
// it is banned in all application code and scripts.
const intlRestriction = {
  object: 'Intl',
  property: 'NumberFormat',
  message: 'Format numbers with src/engine/format.ts (AD-6).',
};

// Money is rounded once, at display, half away from zero, by the engine's
// decimal formatter (AD-8). Math.round rounds half towards +Infinity and
// toFixed works on binary floats; both are banned where figures are handled.
// A later flat-config block replaces the rule's options rather than merging
// them, so this list repeats the Intl entry.
const mathRoundRestriction = { object: 'Math', property: 'round', message: 'Use the engine decimal rounding (AD-8).' };
const toFixedRestriction = { property: 'toFixed', message: 'Use the engine decimal formatter (AD-8).' };
const roundingRestriction = {
  'no-restricted-properties': ['error', intlRestriction, mathRoundRestriction, toFixedRestriction],
};

// Where numbers are displayed (src/app, src/components), format.ts stays the
// only formatter and the only rounding (Story 1.8): toFixed works on binary
// floats, Decimal's toDecimalPlaces/toDP/toSignificantDigits would round a
// second time outside the formatter, and toLocaleString uses Intl, whose
// output differs between Node and browsers. Math.round stays allowed here:
// layout code uses it for pixels. The list repeats the Intl entry, because a
// later block replaces the rule's options.
const displayRestrictions = [
  intlRestriction,
  toFixedRestriction,
  { property: 'toDecimalPlaces', message: 'Round only in src/engine/format.ts (AD-6, AD-8).' },
  { property: 'toDP', message: 'Round only in src/engine/format.ts (AD-6, AD-8).' },
  { property: 'toSignificantDigits', message: 'Round only in src/engine/format.ts (AD-6, AD-8).' },
  { property: 'toLocaleString', message: 'Format numbers with src/engine/format.ts (AD-6).' },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}', 'scripts/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    rules: { 'no-restricted-properties': ['error', intlRestriction] },
  },
  {
    files: ['src/app/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}', 'src/components/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    rules: { 'no-restricted-properties': ['error', ...displayRestrictions] },
  },
  {
    files: ['src/engine/**/*.{ts,tsx}', '**/*[fF]ormat*.{ts,tsx}'],
    rules: roundingRestriction,
  },
  {
    // A formatting file under src/app or src/components gets both lists.
    files: ['src/app/**/*[fF]ormat*.{ts,tsx}', 'src/components/**/*[fF]ormat*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': ['error', ...displayRestrictions, mathRoundRestriction],
    },
  },
  {
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', engineImportRestriction],
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    plugins: {
      local: { rules: { 'client-restricted-imports': clientRestrictedImports } },
    },
    rules: {
      'local/client-restricted-imports': ['error', serverImportRestriction],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'test/fixtures/**',
    'playwright-report/**',
    'test-results/**',
    '_bmad/**',
    '_bmad-output/**',
    '.claude/**',
    'analysis/**',
  ]),
]);
