// TEMPORARY diagnostics for PK-49, never to be merged: which pointer event reaches the page
// before the first mouse move of a test, in CI only (cursor-cta.e2e.ts:356).
import { expect, test } from '@playwright/test';

interface Seen {
  type: string;
  trusted: boolean;
  pointerType: string;
  x: number;
  y: number;
  target: string;
  at: number;
  readyState: string;
  dot: boolean;
}

declare global {
  interface Window {
    pk49: Seen[];
  }
}

for (let run = 0; run < 30; run++) {
  test(`diag PK-49 pointer outside before goto #${run}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    await page.addInitScript(() => {
      window.pk49 = [];
      const note = (event: Event) => {
        const pointer = event as PointerEvent;
        const target = event.target as Element | null;
        window.pk49.push({
          type: event.type,
          trusted: event.isTrusted,
          pointerType: pointer.pointerType ?? '',
          x: pointer.clientX,
          y: pointer.clientY,
          target: target?.tagName
            ? `${target.tagName}.${typeof target.className === 'string' ? target.className : ''}`
            : String(target),
          at: Math.round(performance.now()),
          readyState: document.readyState,
          dot: !!document.querySelector('app-cursor-dot'),
        });
      };
      for (const type of ['pointerover', 'pointermove', 'pointerenter', 'mouseover', 'mousemove'])
        addEventListener(type, note, { capture: true, passive: true });
    });
    await page.mouse.move(-5, -5);
    await page.goto('/');
    await page.waitForTimeout(1000);
    const seen = await page.evaluate(() => window.pk49);
    const html = await page.locator('html').getAttribute('class');
    expect(JSON.stringify({ html, seen }), 'no pointer event before the first move').toBe(
      JSON.stringify({ html: null, seen: [] }),
    );
  });
}
