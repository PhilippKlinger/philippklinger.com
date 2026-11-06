import { expect, test } from '@playwright/test';
import { expectBehindContent, expectOneDecorativeLayer } from './support/haze';

// The decorative layer on every page (spec 8.1). The suite runs without WebGL, so these
// tests see the state "off". The running canvas is covered in haze-webgl.e2e.ts, because
// launchOptions are only allowed at file level.

test('[AK9] genau eine dekorative Ebene auf jeder Seite', async ({ page }) => {
  for (const path of ['/', '/impressum/']) {
    await page.goto(path);
    await expectOneDecorativeLayer(page);
  }
});

test('[AK9] liegt hinter dem Inhalt', async ({ page }) => {
  await page.goto('/');
  await expectBehindContent(page);
});

test('[AK9] Reduced Motion: keine Schleife', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // Longer than the idle start falls back to, so the final state is the one checked.
  await page.waitForTimeout(1000);
  await expect(page.locator('app-haze')).toHaveAttribute('data-haze-state', 'off');
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
