// One decimal constructor in the project (Story 1.4; AD-8): only
// src/engine/decimal.ts imports decimal.js or changes its configuration, and
// no second decimal library is a dependency. Everything else takes Decimal
// from the engine.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRepositoryFiles } from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const OWNER = 'src/engine/decimal.ts';
const SELF = 'test/no-other-decimal.test.ts';
const CODE = /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

// A module specifier naming decimal.js, in an import, export, require or
// dynamic import: the package name inside quotes.
const IMPORTS_DECIMAL_JS = /["'`]decimal\.js(?:\/[^"'`]*)?["'`]/;
// Changing a decimal constructor's configuration or making another one.
const CONFIGURES_DECIMAL = /\bDecimal\w*\s*\.\s*(?:clone|config|set)\s*\(/;
// The engine's Decimal under another name, which the pattern above would miss.
const ALIASES_DECIMAL = /\bDecimal\s+as\s+\w+/;
// Assigning a setting directly on the shared constructor.
const ASSIGNS_DECIMAL_SETTING =
  /\bDecimal\w*\s*\.\s*(?:precision|rounding|toExpNeg|toExpPos|minE|maxE|modulo|crypto)\s*=(?!=)/;

const OTHER_LIBRARIES = ['big.js', 'bignumber.js', 'decimal.js-light', 'dinero.js', 'currency.js', 'js-big-decimal'];

const files = listRepositoryFiles(root).filter((file) => CODE.test(file) && file !== SELF);

function read(file: string): string {
  return readFileSync(path.join(root, file), 'utf8');
}

describe('one decimal constructor', () => {
  it('finds the code it checks', () => {
    expect(files).toContain(OWNER);
    expect(files.some((file) => file.startsWith('test/engine/'))).toBe(true);
  });

  it('is the only module importing decimal.js', () => {
    expect(files.filter((file) => IMPORTS_DECIMAL_JS.test(read(file)))).toEqual([OWNER]);
  });

  it('is the only module calling clone, config or set on a Decimal', () => {
    expect(files.filter((file) => CONFIGURES_DECIMAL.test(read(file)))).toEqual([OWNER]);
  });

  it('is the only module aliasing Decimal', () => {
    expect(files.filter((file) => file !== OWNER && ALIASES_DECIMAL.test(read(file)))).toEqual([]);
  });

  it('is the only module assigning a Decimal setting', () => {
    expect(files.filter((file) => file !== OWNER && ASSIGNS_DECIMAL_SETTING.test(read(file)))).toEqual([]);
  });

  it('detects what it looks for', () => {
    expect(ALIASES_DECIMAL.test("import { Decimal as D } from '../src/engine/index.ts';")).toBe(true);
    expect(ASSIGNS_DECIMAL_SETTING.test('Decimal.rounding = 6;')).toBe(true);
    expect(ASSIGNS_DECIMAL_SETTING.test('if (Decimal.precision === 40) {}')).toBe(false);
    expect(IMPORTS_DECIMAL_JS.test("import Decimal from 'decimal.js';")).toBe(true);
    expect(IMPORTS_DECIMAL_JS.test('const D = require("decimal.js/decimal.mjs");')).toBe(true);
    expect(CONFIGURES_DECIMAL.test('const D2 = Decimal.clone({ precision: 20 });')).toBe(true);
    expect(CONFIGURES_DECIMAL.test('DecimalJs.set({ rounding: 4 })')).toBe(true);
  });

  it('pins decimal.js 10.6.0 and no second decimal library', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps['decimal.js']).toBe('10.6.0');
    expect(OTHER_LIBRARIES.filter((name) => name in deps)).toEqual([]);
  });
});
