import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { STATUS_SNAPSHOT } from './pages/project-page/evidence-chain/evidence-chain';
import { readStatusSnapshot } from './pages/project-page/evidence-chain/read-status-snapshot';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: STATUS_SNAPSHOT, useFactory: readStatusSnapshot },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
