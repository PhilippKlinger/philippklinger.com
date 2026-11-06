import { InjectionToken } from '@angular/core';
import { BuildInfo } from '../../../content/build-info';

/** Commit and run of this build. Only the prerender provides it (app.config.server.ts). */
export const BUILD_INFO = new InjectionToken<BuildInfo | null>('build of this page', {
  factory: () => null,
});
