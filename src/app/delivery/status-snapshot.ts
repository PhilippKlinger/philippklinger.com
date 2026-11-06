import { InjectionToken } from '@angular/core';
import { StatusDocument } from '../../content/status';

/** status.json of the build. Only the prerender provides it (app.config.server.ts). */
export const STATUS_SNAPSHOT = new InjectionToken<StatusDocument | null>('status of the build', {
  factory: () => null,
});
