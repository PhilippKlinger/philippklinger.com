import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { routes } from './app.routes';
import { PageTitleStrategy } from './page-title-strategy';
import { provideHomeScrollRestore } from './home-scroll-restore';
import {
  provideClientHydration,
  withI18nSupport,
  withNoIncrementalHydration,
} from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Scrolls to #fragment links (navigation) and to the top on page changes.
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      // Passes the resolved project to the input of the project page.
      withComponentInputBinding(),
    ),
    // The default incremental hydration adds event replay, whose inline scripts the CSP
    // (script-src 'self') blocks. No template uses @defer, so nothing depends on it.
    provideClientHydration(withI18nSupport(), withNoIncrementalHydration()),
    provideHomeScrollRestore(),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
  ],
};
