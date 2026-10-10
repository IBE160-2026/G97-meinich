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

  it('leaves Math.round alone outside the engine and formatting code', async () => {
    expect(await ruleIds('engine-math-round.ts', 'src/components/layout-maths.ts')).toEqual([]);
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
