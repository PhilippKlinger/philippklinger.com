import { PrerenderFallback, RenderMode } from '@angular/ssr';
import { projects } from '../content/projects';
import { serverRoutes } from './app.routes.server';

describe('serverRoutes', () => {
  const route = serverRoutes.find((entry) => entry.path === 'projekte/:slug');

  it('prerenders the project pages without a fallback, so unknown slugs stay a 404', () => {
    expect(route?.renderMode).toBe(RenderMode.Prerender);
    expect(route && 'fallback' in route && route.fallback).toBe(PrerenderFallback.None);
  });

  it('takes the slugs from the content data', async () => {
    const params = route && 'getPrerenderParams' in route && (await route.getPrerenderParams?.());
    expect(params).toEqual(projects.map(({ slug }) => ({ slug })));
  });
});
