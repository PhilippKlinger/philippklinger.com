import { readFileSync } from 'node:fs';

// Routes come from the build itself, so every new prerendered page is covered
// by the site-wide checks without touching the tests.
const manifest = JSON.parse(
  readFileSync('dist/philippklinger/prerendered-routes.json', 'utf8'),
) as { routes: Record<string, unknown> };

/** Public pages with a trailing slash, the canonical form on Apache (see e2e/server.mjs). */
export const pages: string[] = Object.keys(manifest.routes)
  .filter((route) => route !== '/404')
  .map((route) => (route.endsWith('/') ? route : `${route}/`));

/** Page used as Apache ErrorDocument for unknown paths. */
export const notFoundPage = '/404/';

/** All origins the site may load from. Spec 5: no third-party requests. */
export function isOwnOrigin(url: string, baseURL: string): boolean {
  const { protocol, origin } = new URL(url);
  return protocol === 'data:' || protocol === 'blob:' || origin === new URL(baseURL).origin;
}
