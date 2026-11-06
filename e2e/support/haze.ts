import { expect, type Page } from '@playwright/test';

/** One decorative layer per page that nobody can read or click, whatever state it is in. */
export async function expectOneDecorativeLayer(page: Page): Promise<void> {
  const haze = page.locator('app-haze');
  await expect(haze).toHaveCount(1);
  await expect(haze).toHaveAttribute('aria-hidden', 'true');
  const canvas = haze.locator('canvas');
  for (const layer of [canvas, haze.locator('.haze-static')]) {
    await expect(layer).toHaveCSS('position', 'fixed');
    await expect(layer).toHaveCSS('pointer-events', 'none');
  }
  const zIndex = await canvas.evaluate((el) => getComputedStyle(el).zIndex);
  expect(Number(zIndex)).toBeLessThan(0);
}

export async function expectBehindContent(page: Page): Promise<void> {
  const hit = await page.evaluate(() =>
    document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('app-haze'),
  );
  expect(hit, 'der Inhalt nimmt den Klick an, nicht die Ebene').toBeNull();
  // Hit testing skips pointer-events: none, so only with it switched on does the
  // order prove the stacking, and the canvas has to be in the list to pass.
  const order = await page.locator('app-haze canvas').evaluate((canvas) => {
    canvas.style.pointerEvents = 'auto';
    const stack = document.elementsFromPoint(innerWidth / 2, innerHeight / 2);
    canvas.style.pointerEvents = '';
    return { canvas: stack.indexOf(canvas), main: stack.indexOf(document.querySelector('main')!) };
  });
  expect(order.main, 'Inhalt an dieser Stelle').toBeGreaterThanOrEqual(0);
  expect(order.canvas, 'das Canvas liegt unter dem Inhalt').toBeGreaterThan(order.main);
}
