import { expect, test, type Page, type TestInfo } from '@playwright/test';

// A software GPU gives a real WebGL context with failIfMajorPerformanceCaveat. It is
// too slow for the "slow" state only after about 4 seconds, these tests are done before.
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
});

const desktopOnly = (testInfo: TestInfo) =>
  test.skip(testInfo.project.name !== 'desktop', 'SwiftShader nur auf einer Breite');
const haze = (page: Page) => page.locator('app-haze');
const canvas = (page: Page) => page.locator('app-haze canvas');
// Other animations stop for the picture, so only the canvas can make a difference.
const picture = (page: Page) => page.screenshot({ animations: 'disabled' });

test('[AK9] läuft und bewegt sich mit dem Zeiger', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');
  await expect(canvas(page)).toHaveCSS('opacity', '1');

  await page.mouse.move(200, 300);
  const before = await picture(page);
  await page.mouse.move(1200, 600);
  await page.waitForTimeout(1000);

  expect(before.equals(await picture(page))).toBe(false);
});

test('[AK9] Reduced Motion: ein Standbild', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'still');
  await expect(canvas(page)).toHaveCSS('opacity', '1');

  await page.mouse.move(200, 300);
  const before = await picture(page);
  await page.mouse.move(1200, 600);
  await page.waitForTimeout(1000);

  expect(before.equals(await picture(page))).toBe(true);
});

test('[AK9] nach Kontextverlust bleibt die statische Ebene', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');

  await canvas(page).evaluate((el) =>
    (el as HTMLCanvasElement)
      .getContext('webgl')
      ?.getExtension('WEBGL_lose_context')
      ?.loseContext(),
  );

  await expect(haze(page)).toHaveAttribute('data-haze-state', 'off');
  await expect(canvas(page)).toHaveCSS('opacity', '0');
  await expect(page.locator('.haze-static')).toBeVisible();
});

test('[Spec 8.1] kein Fehler in der Konsole, kein Fremdabruf', async ({
  page,
  baseURL,
}, testInfo) => {
  desktopOnly(testInfo);
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(baseURL!)) foreign.push(request.url());
  });

  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');
  await page.waitForTimeout(1000);

  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});
