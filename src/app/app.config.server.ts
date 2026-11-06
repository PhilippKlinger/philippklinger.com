import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { readStatusSnapshot } from './delivery/read-status-snapshot';
import { STATUS_SNAPSHOT } from './delivery/status-snapshot';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: STATUS_SNAPSHOT, useFactory: readStatusSnapshot },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
