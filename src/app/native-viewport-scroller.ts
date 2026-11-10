import { isPlatformBrowser, ViewportScroller } from '@angular/common';
import { DOCUMENT, Injectable, PLATFORM_ID, Provider, inject } from '@angular/core';

/**
 * Angular's own scroller jumps to an anchor with window.scrollTo and ignores CSS
 * scroll-margin, so a jump landed on the padding above a section (FB-03). This one lets the
 * browser scroll the element into view: scroll-margin-top in the styles alone decides where a
 * jump lands, for router links and for a direct load with a fragment alike.
 */
@Injectable()
class NativeViewportScroller implements ViewportScroller {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** A fixed offset would compete with scroll-margin-top, so it is refused loudly. */
  setOffset(): void {
    throw new Error('Set scroll-margin-top in the styles instead of a scroll offset.');
  }

  getScrollPosition(): [number, number] {
    return this.browser ? [window.scrollX, window.scrollY] : [0, 0];
  }

  scrollToPosition([left, top]: [number, number], options?: ScrollOptions): void {
    if (this.browser) window.scrollTo({ ...options, left, top });
  }

  scrollToAnchor(anchor: string, options?: ScrollOptions): void {
    if (!this.browser) return;
    const target =
      this.document.getElementById(anchor) ?? this.document.getElementsByName(anchor)[0];
    if (!target) return;
    target.scrollIntoView({ ...options, block: 'start' });
    // Same as Angular: focus moves along where the element can take it.
    target.focus({ preventScroll: true });
  }

  setHistoryScrollRestoration(scrollRestoration: 'auto' | 'manual'): void {
    if (!this.browser) return;
    try {
      history.scrollRestoration = scrollRestoration;
    } catch {
      // Sandboxed frames refuse it; the browser then keeps its own restoration.
    }
  }
}

export function provideNativeViewportScroller(): Provider {
  return { provide: ViewportScroller, useClass: NativeViewportScroller };
}
