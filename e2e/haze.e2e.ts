import { expect, test } from '@playwright/test';

// The decorative layer on every page (spec 8.1). These tests hold with and without
// WebGL; the variants with a fixed GPU setup live in their own files, because
// launchOptions are only allowed at file level.

test('[AK9] genau eine dekorative Ebene auf jeder Seite', async ({ page }) => {
  for (const path of ['/', '/impressum/']) {
    await page.goto(path);
    const haze = page.locator('app-haze');
    await expect(haze, path).toHaveCount(1);
    await expect(haze).toHaveAttribute('aria-hidden', 'true');
    const canvas = haze.locator('canvas');
    for (const layer of [canvas, haze.locator('.haze-static')]) {
      await expect(layer).toHaveCSS('position', 'fixed');
      await expect(layer).toHaveCSS('pointer-events', 'none');
    }
    const zIndex = await canvas.evaluate((el) => getComputedStyle(el).zIndex);
    expect(Number(zIndex)).toBeLessThan(0);
  }
});

test('[AK9] liegt hinter dem Inhalt', async ({ page }) => {
  await page.goto('/');
  const hit = await page.evaluate(() =>
    document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('app-haze'),
  );
  expect(hit).toBeNull();
});

test('[AK9] Reduced Motion: keine Schleife', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // Longer than the idle start falls back to, so the final state is the one checked.
  await page.waitForTimeout(1000);
  const state = await page.locator('app-haze').getAttribute('data-haze-state');
  expect(['still', 'off']).toContain(state);
  const running = await page.evaluate(
    () => document.getAnimations().filter((a) => a.playState === 'running').length,
  );
  expect(running).toBe(0);
});

test('[Lighthouse] startet nicht vor dem ersten Inhalt', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('data-haze-state="off"');
  expect(html).not.toContain('data-haze-state="running"');
});
