import { EnvironmentProviders, PLATFORM_ID, inject, provideAppInitializer } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const storageKey = 'home-scroll';

function saveHomeScroll(): void {
  if (location.pathname !== '/') return;
  try {
    sessionStorage.setItem(storageKey, String(window.scrollY));
  } catch {
    // Storage can be blocked; the page then simply opens at the top.
  }
}

function savedHomeScroll(): number {
  try {
    return Number(sessionStorage.getItem(storageKey)) || 0;
  } catch {
    return 0;
  }
}

function cameBackByHistory(): boolean {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return entry?.type === 'back_forward';
}

/**
 * Cards open the detail page as a full document load, so the router has no stored position and
 * history.scrollRestoration is "manual". The position is kept in sessionStorage and applied on
 * start: the prerendered page already has its final height, and the router does not scroll
 * during the hydrating first navigation.
 */
export function provideHomeScrollRestore(): EnvironmentProviders {
  return provideAppInitializer(() => {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    addEventListener('pagehide', saveHomeScroll);
    if (cameBackByHistory() && location.pathname === '/') window.scrollTo(0, savedHomeScroll());
  });
}
