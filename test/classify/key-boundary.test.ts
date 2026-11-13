// The model key and the SDK stay in batch step 2 (Story 2.6; AD-7, AD-19). The
// request path cannot call a model when no file it can reach names the SDK.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const CLIENT = path.join('scripts', 'classify', 'model-client.ts');

function sources(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(relative);
    return /\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('the model key', () => {
  it('is named only in the model client', () => {
    const naming = [...sources('src'), ...sources('scripts')].filter((file) => read(file).includes('ANTHROPIC_API_KEY'));
    expect(naming).toEqual([CLIENT]);
  });

  it('the SDK is imported only by the model client', () => {
    const importing = [...sources('src'), ...sources('scripts')].filter((file) => read(file).includes('@anthropic-ai/sdk'));
    expect(importing).toEqual([CLIENT]);
  });

  it('nothing in the request path names a model host or batch step 2', () => {
    for (const file of sources('src')) {
      const text = read(file);
      expect(text, file).not.toMatch(/api\.anthropic\.com|scripts\/classify/);
    }
  });
});
