import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { readStatusSnapshot } from './delivery/read-status-snapshot';
import { STATUS_SNAPSHOT } from './delivery/status-snapshot';
import { BUILD_INFO } from './layout/footer/build-info-token';
import { readBuildInfo } from './layout/footer/read-build-info';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: STATUS_SNAPSHOT, useFactory: readStatusSnapshot },
    { provide: BUILD_INFO, useFactory: readBuildInfo },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
