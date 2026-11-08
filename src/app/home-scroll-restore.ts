import { EnvironmentProviders, PLATFORM_ID, inject, provideAppInitializer } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const storageKey = 'home-scroll';
const readerInput = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

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

function restoreHomeScroll(): void {
  window.scrollTo(0, savedHomeScroll());
}

/**
 * Web fonts change the line breaks and so the page height, the saved value fits the final one.
 * Every height change restores again, the browser's scroll anchoring would only keep the old
 * content in view. It stops with the first input of the reader, who then owns the position.
 */
function restoreWhilePageSettles(): void {
  const observer = new ResizeObserver(restoreHomeScroll);
  const stop = () => observer.disconnect();
  observer.observe(document.documentElement);
  readerInput.forEach((type) => addEventListener(type, stop, { once: true, passive: true }));
}

/**
 * Cards open the detail page as a full document load, so the router has no stored position and
 * history.scrollRestoration is "manual". The position is kept in sessionStorage and applied on
 * start, so the page does not flash at the top. The router does not scroll during the hydrating
 * first navigation.
 */
export function provideHomeScrollRestore(): EnvironmentProviders {
  return provideAppInitializer(() => {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    addEventListener('pagehide', saveHomeScroll);
    if (!cameBackByHistory() || location.pathname !== '/') return;
    restoreHomeScroll();
    restoreWhilePageSettles();
  });
}
