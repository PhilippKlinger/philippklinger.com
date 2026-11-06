import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.use({ launchOptions: { args: ['--disable-3d-apis'] } });

test('[AK9] ohne WebGL bleibt die statische Ebene', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  const hasWebGl = await page.evaluate(
    () => document.createElement('canvas').getContext('webgl') !== null,
  );
  expect(hasWebGl, 'this browser must really lack WebGL').toBe(false);
  // Longer than the idle start falls back to, so the final state is the one checked.
  await page.waitForTimeout(1000);

  await expect(page.locator('app-haze')).toHaveAttribute('data-haze-state', 'off');
  await expect(page.locator('app-haze canvas')).toHaveCSS('opacity', '0');
  await expect(page.locator('.haze-static')).toBeVisible();
  expect(errors).toEqual([]);
  const { violations } = await new AxeBuilder({ page }).withTags(wcag).analyze();
  expect(violations).toEqual([]);
});
