// Exactly one image installs Tesseract: batch step 1's (Story 2.1a). The
// spike's analysis/ocr/Dockerfile was folded into it; a second Dockerfile
// that installs Tesseract would let the measured engine and the production
// engine drift apart.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRepositoryFiles } from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const THE_IMAGE = 'ingest/Dockerfile';

// Dockerfile, Dockerfile.*, *.Dockerfile and Containerfile, anywhere outside
// node_modules (git ls-files already leaves out ignored paths).
function isDockerfile(file: string): boolean {
  if (file.split('/').includes('node_modules')) return false;
  const base = path.posix.basename(file);
  return /^(Dockerfile|Containerfile)(\..+)?$/i.test(base) || /\.(Dockerfile|Containerfile)$/i.test(base);
}

// Whether a Dockerfile mentions Tesseract outside its comments.
function installsTesseract(content: string): boolean {
  return content
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'))
    .some((line) => /tesseract/i.test(line));
}

const dockerfiles = listRepositoryFiles(root)
  .filter(isDockerfile)
  .filter((file) => existsSync(path.join(root, file)));

describe('one Tesseract image', () => {
  it('installs Tesseract in ingest/Dockerfile and in no other Dockerfile', () => {
    const installing = dockerfiles.filter((file) => installsTesseract(readFileSync(path.join(root, file), 'utf8')));
    expect(installing).toEqual([THE_IMAGE]);
  });

  it('no longer has the spike Dockerfile', () => {
    expect(dockerfiles).not.toContain('analysis/ocr/Dockerfile');
  });

  it('recognises Dockerfiles and installs the way the check relies on', () => {
    expect(isDockerfile('analysis/ocr/Dockerfile')).toBe(true);
    expect(isDockerfile('tools/Dockerfile.ocr')).toBe(true);
    expect(isDockerfile('tools/ocr.Dockerfile')).toBe(true);
    expect(isDockerfile('node_modules/x/Dockerfile')).toBe(false);
    expect(isDockerfile('docs/Dockerfiles.md')).toBe(false);
    expect(installsTesseract('FROM debian\nRUN apt-get install -y tesseract-ocr\n')).toBe(true);
    expect(installsTesseract('FROM debian\n# no tesseract here\nRUN true\n')).toBe(false);
  });
});
