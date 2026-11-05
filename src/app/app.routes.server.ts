import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { projectPages } from './pages/project-page/project-route';

// Static site on shared hosting: every route is prerendered at build time,
// there is no Node server at runtime (outputMode "static" in angular.json).
export const serverRoutes: ServerRoute[] = [
  {
    path: 'projekte/:slug',
    renderMode: RenderMode.Prerender,
    // No fallback: an unknown slug has no file on the host and stays a real 404.
    fallback: PrerenderFallback.None,
    getPrerenderParams: async () => projectPages.map(({ slug }) => ({ slug })),
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
