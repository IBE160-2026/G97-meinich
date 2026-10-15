// CI guard on the request surface (technical note, request surface;
// Story 1.5b). Reads the manifests of the built app (`pnpm build` first) and
// fails on any surface outside the closed list:
//   pages   GET /, /slik-fungerer-peerless, /analyse/{orgnr},
//           /analyse/{orgnr}/{fane} (with their RSC payloads)
//   route   GET /api/sok, the only JSON endpoint
// plus Next.js's own error pages. It also fails on any server action: v1 has
// none, so the server-reference manifest must be empty.
// It also fails when / is prerendered: the front page reads coverage from
// the database at request time (`connection()`), never at build time.
// That /api/sok answers GET only is tested on the module (test/api-sok.test.ts).
// Run: node scripts/check-routes.ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ALLOWED_PAGES: readonly string[] = [
  '/',
  '/slik-fungerer-peerless',
  '/analyse/[orgnr]',
  '/analyse/[orgnr]/[fane]',
];
export const ALLOWED_ROUTE_HANDLERS: readonly string[] = ['/api/sok'];
// Rendered by Next.js itself for unknown URLs and errors; not a surface we add.
export const FRAMEWORK_PAGES: readonly string[] = ['/_not-found', '/_global-error'];
// Static error pages Next.js writes into the pages manifest of an App Router build.
export const FRAMEWORK_PAGES_ROUTER: readonly string[] = ['/404', '/500', '/_app', '/_document', '/_error'];

export interface BuildManifests {
  /** .next/app-path-routes-manifest.json: "/analyse/[orgnr]/page" → "/analyse/[orgnr]". */
  readonly appPaths: Readonly<Record<string, string>>;
  /** .next/server/pages-manifest.json. */
  readonly pages: Readonly<Record<string, string>>;
  /** .next/server/server-reference-manifest.json. */
  readonly serverReferences: { readonly node?: object; readonly edge?: object };
  /** .next/prerender-manifest.json: the routes rendered at build time. */
  readonly prerendered: { readonly routes?: object };
}

// Pages that must be rendered per request, never at build time.
export const DYNAMIC_PAGES: readonly string[] = ['/'];

export function findSurfaceViolations(manifests: BuildManifests): string[] {
  const violations: string[] = [];
  for (const [entry, route] of Object.entries(manifests.appPaths)) {
    if (entry.endsWith('/page')) {
      if (!ALLOWED_PAGES.includes(route) && !FRAMEWORK_PAGES.includes(route)) {
        violations.push(`page ${route} (${entry}) is not on the request surface`);
      }
    } else if (entry.endsWith('/route')) {
      if (!ALLOWED_ROUTE_HANDLERS.includes(route)) {
        violations.push(`route handler ${route} (${entry}) is not on the request surface`);
      }
    } else {
      violations.push(`unknown app entry ${entry} → ${route}`);
    }
  }
  for (const page of Object.keys(manifests.pages)) {
    if (!FRAMEWORK_PAGES_ROUTER.includes(page)) violations.push(`pages-router page ${page} is not allowed`);
  }
  for (const runtime of ['node', 'edge'] as const) {
    const actions = Object.keys(manifests.serverReferences[runtime] ?? {});
    for (const action of actions) violations.push(`server action ${action} (${runtime}) is not allowed`);
  }
  const prerendered = Object.keys(manifests.prerendered.routes ?? {});
  for (const page of DYNAMIC_PAGES) {
    if (prerendered.includes(page)) violations.push(`page ${page} is prerendered; it must render per request`);
  }
  return violations;
}

function readJson(file: string): unknown {
  if (!existsSync(file)) {
    throw new Error(`${file} not found: run \`pnpm build\` before \`pnpm check:routes\``);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function readBuildManifests(distDir: string): BuildManifests {
  return {
    appPaths: readJson(path.join(distDir, 'app-path-routes-manifest.json')) as BuildManifests['appPaths'],
    pages: readJson(path.join(distDir, 'server', 'pages-manifest.json')) as BuildManifests['pages'],
    serverReferences: readJson(
      path.join(distDir, 'server', 'server-reference-manifest.json'),
    ) as BuildManifests['serverReferences'],
    prerendered: readJson(path.join(distDir, 'prerender-manifest.json')) as BuildManifests['prerendered'],
  };
}

function main(): void {
  let manifests: BuildManifests;
  try {
    manifests = readBuildManifests(path.resolve('.next'));
  } catch (error) {
    console.error(`check:routes: ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }
  if (Object.keys(manifests.appPaths).length === 0) {
    console.error('check:routes: the build has no app routes; is .next a complete build?');
    process.exitCode = 1;
    return;
  }
  const violations = findSurfaceViolations(manifests);
  if (violations.length === 0) {
    console.log(`check:routes: ${Object.keys(manifests.appPaths).length} app entries, all on the request surface; no server action.`);
    return;
  }
  for (const violation of violations) console.error(`check:routes: ${violation}`);
  process.exitCode = 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
