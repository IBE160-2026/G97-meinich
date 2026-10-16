import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Each fixture is linted through the real eslint.config.mjs under a virtual
// file path, so the path-scoped rules apply exactly as they would in src/.
const root = path.resolve(import.meta.dirname, '..');
const eslint = new ESLint({ cwd: root });

async function ruleIds(fixture: string, virtualPath: string): Promise<string[]> {
  const code = readFileSync(path.join(root, 'test/fixtures/lint', fixture), 'utf8');
  const [result] = await eslint.lintText(code, { filePath: path.join(root, virtualPath) });
  if (!result) throw new Error(`no lint result for ${fixture}`);
  return result.messages.filter((m) => m.severity === 2).map((m) => m.ruleId ?? 'parse-error');
}

async function inlineRuleIds(code: string, virtualPath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, virtualPath) });
  if (!result) throw new Error(`no lint result for ${virtualPath}`);
  return result.messages.filter((m) => m.severity === 2).map((m) => m.ruleId ?? 'parse-error');
}

describe('rounding ban (AD-8)', () => {
  it('rejects Math.round in src/engine', async () => {
    expect(await ruleIds('engine-math-round.ts', 'src/engine/fixture.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it('rejects toFixed in a formatting file', async () => {
    expect(await ruleIds('format-to-fixed.ts', 'src/lib/format-fixture.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it("rejects Math['round'] in src/engine", async () => {
    const code = "export const r = (x: number): number => Math['round'](x);\n";
    expect(await inlineRuleIds(code, 'src/engine/fixture.ts')).toContain('no-restricted-properties');
  });

  it('rejects toFixed in a camel-case formatting file', async () => {
    expect(await ruleIds('format-to-fixed.ts', 'src/lib/kronerFormat.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it('leaves Math.round alone outside the engine and formatting code', async () => {
    expect(await ruleIds('engine-math-round.ts', 'src/components/layout-maths.ts')).toEqual([]);
  });
});

describe('display rounding ban (Story 1.8, AD-6)', () => {
  async function messages(virtualPath: string) {
    const code = readFileSync(path.join(root, 'test/fixtures/lint/display-rounding.tsx'), 'utf8');
    const [result] = await eslint.lintText(code, { filePath: path.join(root, virtualPath) });
    if (!result) throw new Error(`no lint result for ${virtualPath}`);
    return result.messages.filter((m) => m.severity === 2);
  }

  for (const virtualPath of ['src/components/fixture.tsx', 'src/app/fixture-page.tsx', 'src/components/kroner-format.tsx']) {
    it(`rejects toFixed, toDecimalPlaces, toDP, toSignificantDigits and toLocaleString in ${virtualPath}`, async () => {
      const found = await messages(virtualPath);
      expect(found.map((m) => m.ruleId)).toEqual(Array(5).fill('no-restricted-properties'));
      expect(found.map((m) => m.line)).toEqual([9, 10, 11, 12, 13]);
    });
  }

  it('keeps Intl.NumberFormat banned in src/components alongside the display list', async () => {
    expect(await ruleIds('intl-number-format.ts', 'src/components/fixture.ts')).toContain('no-restricted-properties');
  });

  it('keeps Math.round banned in a formatting file under src/components', async () => {
    expect(await ruleIds('engine-math-round.ts', 'src/components/kroner-format.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it('leaves the methods alone outside src/app and src/components (scripts, tests)', async () => {
    expect((await messages('scripts/fixture.tsx')).map((m) => m.ruleId)).not.toContain('no-restricted-properties');
  });
});

describe('Intl.NumberFormat ban (AD-6)', () => {
  it('rejects Intl.NumberFormat in src/', async () => {
    expect(await ruleIds('intl-number-format.ts', 'src/components/fixture.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it('rejects Intl.NumberFormat in scripts/', async () => {
    expect(await ruleIds('intl-number-format.ts', 'scripts/fixture.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it('rejects Intl.NumberFormat in src/engine, where the rounding list replaces the options', async () => {
    expect(await ruleIds('intl-number-format.ts', 'src/engine/fixture.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it('rejects Intl.NumberFormat in a formatting file outside src/', async () => {
    expect(await ruleIds('intl-number-format.ts', 'test/helpers/format-fixture.ts')).toContain(
      'no-restricted-properties',
    );
  });
});

describe('restricted imports (AD-8, AD-19)', () => {
  it('rejects src/server in the engine', async () => {
    expect(await ruleIds('engine-imports-server.ts', 'src/engine/fixture.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it('rejects postgres in the engine', async () => {
    expect(await ruleIds('engine-imports-postgres.ts', 'src/engine/fixture.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it("rejects a relative src/server import in a 'use client' module", async () => {
    expect(await ruleIds('client-imports-server.tsx', 'src/components/fixture.tsx')).toContain(
      'local/client-restricted-imports',
    );
  });

  it("rejects postgres in a 'use client' module", async () => {
    expect(await ruleIds('client-imports-postgres.tsx', 'src/components/fixture.tsx')).toContain(
      'local/client-restricted-imports',
    );
  });

  it('rejects a nested src/server path in the engine', async () => {
    const code = "import { db } from '@/server/db/client';\nexport const handle = db;\n";
    expect(await inlineRuleIds(code, 'src/engine/fixture.ts')).toContain('no-restricted-imports');
  });

  it('rejects a postgres subpath in the engine', async () => {
    const code = "import postgres from 'postgres/cjs/src/index.js';\nexport const client = postgres;\n";
    expect(await inlineRuleIds(code, 'src/engine/fixture.ts')).toContain('no-restricted-imports');
  });

  it("allows react-dom/server in a 'use client' module", async () => {
    const code =
      "'use client';\nimport { renderToString } from 'react-dom/server';\nexport const render = renderToString;\n";
    expect(await inlineRuleIds(code, 'src/components/fixture.tsx')).toEqual([]);
  });

  it('allows a server component to import src/server', async () => {
    const code = "import { db } from '@/server/db';\nexport const handle = db;\n";
    const [result] = await eslint.lintText(code, {
      filePath: path.join(root, 'src/app/fixture-page.tsx'),
    });
    expect(result?.messages.filter((m) => m.severity === 2)).toEqual([]);
  });
});

describe('clean fixture', () => {
  it('passes every rule', async () => {
    expect(await ruleIds('clean-engine.ts', 'src/engine/fixture.ts')).toEqual([]);
  });
});
