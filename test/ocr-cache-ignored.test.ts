// Story 2.5d: the OCR word cache stays local. Its entries hold the words of
// filed documents, which are not committed until the licence assessment
// (Story 5.4): `.local/ocr-cache/` is gitignored, nothing under `.local/` is
// tracked, and the step-1 image's build context (ingest/) holds no cache.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OCR_CACHE_DIR } from '../scripts/run-ingest.ts';

const root = path.resolve(import.meta.dirname, '..');

function git(args: string[]): { status: number | null; stdout: string } {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout };
}

describe('the OCR word cache is never committed', () => {
  it('is the directory pnpm ingest mounts', () => {
    expect(OCR_CACHE_DIR).toBe(path.join('.local', 'ocr-cache'));
  });

  it('matches .gitignore for an entry under .local/ocr-cache/', () => {
    // --no-index: whether a file at this path would be ignored, whether or
    // not it exists.
    const entry = path.posix.join('.local', 'ocr-cache', `${'0'.repeat(64)}.json.gz`);
    expect(git(['check-ignore', '-q', '--no-index', entry]).status).toBe(0);
  });

  it('tracks no file under .local/', () => {
    const tracked = git(['ls-files', '.local']);
    expect(tracked.status).toBe(0);
    expect(tracked.stdout).toBe('');
  });

  it('tracks no cache entry anywhere', () => {
    const tracked = git(['ls-files', '*.json.gz']);
    expect(tracked.status).toBe(0);
    expect(tracked.stdout).toBe('');
  });
});
