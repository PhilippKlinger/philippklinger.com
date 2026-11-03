import { RenderMode, ServerRoute } from '@angular/ssr';

// Static site on shared hosting: every route is prerendered at build time,
// there is no Node server at runtime (outputMode "static" in angular.json).
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
