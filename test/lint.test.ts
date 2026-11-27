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

  it('rejects next/server in the engine (Story 1.4: no framework import)', async () => {
    expect(await ruleIds('engine-imports-next.ts', 'src/engine/fixture.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it.each([
    "import { cache } from 'react';\nexport const c = cache;\n",
    "import { jsx } from 'react/jsx-runtime';\nexport const j = jsx;\n",
    "import { flushSync } from 'react-dom';\nexport const f = flushSync;\n",
    "import { renderToString } from 'react-dom/server';\nexport const r = renderToString;\n",
    "import type { Metadata } from 'next';\nexport type M = Metadata;\n",
    "import Link from 'next/link';\nexport const l = Link;\n",
  ])('rejects a framework import in the engine: %j', async (code) => {
    expect(await inlineRuleIds(code, 'src/engine/fixture.ts')).toContain('no-restricted-imports');
  });

  it('still allows the engine its own decimal module', async () => {
    const code = "import { Decimal } from './decimal.ts';\nexport const d = Decimal;\n";
    expect(await inlineRuleIds(code, 'src/engine/fixture.ts')).toEqual([]);
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

  it.each([
    "'use client';\nimport { digest } from '@/engine/digest';\nexport const d = digest;\n",
    "'use client';\nimport { digest } from '../engine/digest.ts';\nexport const d = digest;\n",
    "'use client';\nimport { digest } from '../../src/engine/digest';\nexport const d = digest;\n",
    // Review pass 1 (triage 16): a .js-style specifier for the .ts file.
    "'use client';\nimport { digest } from '../engine/digest.js';\nexport const d = digest;\n",
    "'use client';\nimport { digest } from '@/engine/digest.mjs';\nexport const d = digest;\n",
  ])("rejects the engine digest in a 'use client' module: %j", async (code) => {
    expect(await inlineRuleIds(code, 'src/components/fixture.tsx')).toContain('local/client-restricted-imports');
  });

  it('allows the engine digest in server code and scripts', async () => {
    const code = "import { digest } from '@/engine/digest';\nexport const d = digest;\n";
    expect(await inlineRuleIds(code, 'src/app/fixture-page.tsx')).toEqual([]);
    const script = "import { digest } from '../src/engine/digest.ts';\nexport const d = digest;\n";
    expect(await inlineRuleIds(script, 'scripts/fixture.ts')).toEqual([]);
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

// Epic 3 retro action 8 (issue #89): no expect inside a condition, and e2e
// reads a page value only through a retried assertion.
describe('test assertions (Epic 3 retro action 8)', () => {
  const header = "import { expect, test } from '@playwright/test';\n";

  it.each([
    ['an if', "if (Math.random() > 1) expect(1).toBe(1);"],
    ['an else', "if (Math.random() > 1) expect(1).toBe(1);\nelse expect(2).toBe(2);"],
    ['a ternary', "const x = Math.random() > 1 ? expect(1).toBe(1) : null;\nexport { x };"],
    ['a logical expression', "Math.random() > 1 && expect(1).toBe(1);"],
    ['a switch', "switch (Math.random()) {\n  case 1:\n    expect(1).toBe(1);\n}"],
    ['a catch', "try {\n  JSON.parse('x');\n} catch (error) {\n  expect(error).toBeDefined();\n}"],
    ['an if, on expect.soft', "if (Math.random() > 1) expect.soft(1).toBe(1);"],
  ])('rejects an expect inside %s, in Vitest and in Playwright', async (_, body) => {
    expect(await inlineRuleIds(`${header}${body}\n`, 'test/fixture.test.ts')).toContain('no-restricted-syntax');
    expect(await inlineRuleIds(`${header}${body}\n`, 'e2e/fixture.spec.ts')).toContain('no-restricted-syntax');
  });

  it('allows an expect outside a condition, and a throw inside one', async () => {
    const code = `${header}const v = { kind: 'a' as string };\nif (v.kind !== 'a') throw new Error('kind');\nexpect(v.kind).toBe('a');\n`;
    expect(await inlineRuleIds(code, 'test/fixture.test.ts')).toEqual([]);
    expect(await inlineRuleIds(code, 'e2e/fixture.spec.ts')).toEqual([]);
  });

  it.each([
    ['kept in a variable', "const text = await page.locator('h1').textContent();\nexport { text };"],
    ['passed to expect', "expect(await page.locator('h1').innerText()).toBe('x');"],
    ['passed to a function', "expect(Number(await page.locator('h1').innerText())).toBe(1);"],
    ['a box', "const box = await page.locator('h1').boundingBox();\nexport { box };"],
    ['an evaluate', "const n = await page.evaluate(() => window.history.length);\nexport { n };"],
    ['a count', "expect(await page.locator('li').count()).toBe(1);"],
    ['an attribute in a selector', "page.locator(`[id=\"${await page.locator('b').getAttribute('aria-controls')}\"]`);"],
    ['iterated', "for (const li of await page.locator('li').all()) await expect(li).toBeVisible();"],
    ['returned', "export const read = () => page.locator('h1').textContent();"],
  ])('rejects a snapshot read in e2e: %s', async (_, body) => {
    const code = `${header}import type { Page } from '@playwright/test';\ndeclare const page: Page;\n${body}\n`;
    expect(await inlineRuleIds(code, 'e2e/fixture.spec.ts')).toContain('no-restricted-syntax');
  });

  it('allows a read inside expect.poll or toPass, a DOM call inside evaluate, and an awaited call whose value is unused', async () => {
    const code = [
      header,
      "import type { Page } from '@playwright/test';",
      'declare const page: Page;',
      "await expect.poll(() => page.locator('h1').textContent()).toBe('x');",
      'await expect(async () => {',
      "  const box = await page.locator('h1').boundingBox();",
      '  expect(box).not.toBeNull();',
      '}).toPass();',
      "await expect.poll(() => page.locator('li').evaluateAll((items) => items.map((item) => item.getAttribute('id')))).toEqual([]);",
      'await page.evaluate(() => document.fonts.ready);',
      "await expect(page.locator('h1')).toHaveText('x');",
      '',
    ].join('\n');
    expect(await inlineRuleIds(code, 'e2e/fixture.spec.ts')).toEqual([]);
  });
});

describe('clean fixture', () => {
  it('passes every rule', async () => {
    expect(await ruleIds('clean-engine.ts', 'src/engine/fixture.ts')).toEqual([]);
  });
});
