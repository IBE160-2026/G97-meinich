// The route-manifest matcher of `pnpm check:routes` (Story 1.5b). CI runs the
// script itself against the real build, right after `pnpm build`.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSurfaceViolations, readBuildManifests, type BuildManifests } from '../scripts/check-routes.ts';

// The manifests of the Story 1.5b build, plus the routes Story 1.6b adds.
const CLEAN: BuildManifests = {
  appPaths: {
    '/_global-error/page': '/_global-error',
    '/_not-found/page': '/_not-found',
    '/api/sok/route': '/api/sok',
    '/page': '/',
    '/slik-fungerer-peerless/page': '/slik-fungerer-peerless',
    '/analyse/[orgnr]/page': '/analyse/[orgnr]',
    '/analyse/[orgnr]/[fane]/page': '/analyse/[orgnr]/[fane]',
  },
  pages: { '/404': 'pages/404.html', '/500': 'pages/500.html' },
  serverReferences: { node: {}, edge: {} },
  prerendered: { routes: { '/_global-error': {}, '/_not-found': {} } },
};

function withEntries(extra: Partial<BuildManifests>): BuildManifests {
  return {
    appPaths: { ...CLEAN.appPaths, ...extra.appPaths },
    pages: { ...CLEAN.pages, ...extra.pages },
    serverReferences: extra.serverReferences ?? CLEAN.serverReferences,
    prerendered: extra.prerendered ?? CLEAN.prerendered,
  };
}

describe('findSurfaceViolations', () => {
  it('accepts the closed list of surfaces and the framework error pages', () => {
    expect(findSurfaceViolations(CLEAN)).toEqual([]);
  });

  it('accepts an allowed page inside a route group', () => {
    expect(findSurfaceViolations(withEntries({ appPaths: { '/(analyse)/analyse/[orgnr]/page': '/analyse/[orgnr]' } }))).toEqual([]);
  });

  it('rejects any other page', () => {
    expect(findSurfaceViolations(withEntries({ appPaths: { '/admin/page': '/admin' } }))).toEqual([
      'page /admin (/admin/page) is not on the request surface',
    ]);
  });

  it('rejects a route handler other than /api/sok, including a page path served as JSON', () => {
    expect(
      findSurfaceViolations(
        withEntries({ appPaths: { '/api/export/route': '/api/export', '/analyse/[orgnr]/route': '/analyse/[orgnr]' } }),
      ),
    ).toEqual([
      'route handler /api/export (/api/export/route) is not on the request surface',
      'route handler /analyse/[orgnr] (/analyse/[orgnr]/route) is not on the request surface',
    ]);
  });

  it('rejects a metadata route such as /favicon.ico or /sitemap.xml', () => {
    expect(
      findSurfaceViolations(withEntries({ appPaths: { '/sitemap.xml/route': '/sitemap.xml' } })),
    ).toEqual(['route handler /sitemap.xml (/sitemap.xml/route) is not on the request surface']);
  });

  it('rejects a pages-router page or API route', () => {
    expect(findSurfaceViolations(withEntries({ pages: { '/api/legacy': 'pages/api/legacy.js' } }))).toEqual([
      'pages-router page /api/legacy is not allowed',
    ]);
  });

  it('rejects any server action, node or edge', () => {
    expect(
      findSurfaceViolations(
        withEntries({ serverReferences: { node: { '7f00ab': { workers: {} } }, edge: { '7f00cd': {} } } }),
      ),
    ).toEqual(['server action 7f00ab (node) is not allowed', 'server action 7f00cd (edge) is not allowed']);
  });
});

describe('findSurfaceViolations, rendering', () => {
  it('rejects a prerendered front page, which would freeze the coverage at build time', () => {
    expect(
      findSurfaceViolations(withEntries({ prerendered: { routes: { '/': {}, '/_not-found': {} } } })),
    ).toEqual(['page / is prerendered; it must render per request']);
  });
});

describe('readBuildManifests', () => {
  it('fails, naming pnpm build, when the app is not built', () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'peerless-routes-'));
    try {
      expect(() => readBuildManifests(empty)).toThrow(/run `pnpm build`/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
