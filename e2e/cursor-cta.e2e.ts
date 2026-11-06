import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

// The ring at the pointer (spec 8.2). It only ever adds to the visible CTA.
declare global {
  interface Window {
    frameRequests: number;
  }
}

interface Point {
  x: number;
  y: number;
}

const desktopOnly = (testInfo: TestInfo) =>
  test.skip(testInfo.project.name !== 'desktop', 'Maus auf einer Breite genügt');

// The router drops the trailing slash of the static URL after hydration.
const detailPage = /\/projekte\/[a-z-]+\/?$/;
const ring = (page: Page) => page.locator('app-cursor-cta');
const projectCard = (page: Page) => page.locator('#projekte article.card').first();
const reportCard = (page: Page) => page.locator('#projekte article.card').last();

async function hoverCenter(page: Page, element: Locator): Promise<Point> {
  await element.scrollIntoViewIfNeeded();
  const box = await element.boundingBox();
  if (!box) throw new Error('element has no box');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  return point;
}

async function expectRingOn(page: Page, text: string): Promise<void> {
  await expect(ring(page)).toHaveText(text);
  await expect(ring(page)).toHaveCSS('opacity', '1');
}

const expectRingOff = (page: Page) => expect(ring(page)).toHaveCSS('opacity', '0');

async function expectRingAt(page: Page, { x, y }: Point): Promise<void> {
  await expect(async () => {
    const box = await ring(page).boundingBox();
    expect(Math.abs(box!.x + box!.width / 2 - x)).toBeLessThan(2);
    expect(Math.abs(box!.y + box!.height / 2 - y)).toBeLessThan(2);
  }, 'der Ring sitzt am Zeiger').toPass({ timeout: 3000 });
}

// Only counts and still calls the original, so the page runs as usual.
const countFrames = (page: Page) =>
  page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    window.frameRequests = 0;
    window.requestAnimationFrame = (callback) => {
      window.frameRequests += 1;
      return request(callback);
    };
  });

const frameRequests = (page: Page) => page.evaluate(() => window.frameRequests);

async function expectFramesRunning(page: Page): Promise<void> {
  const before = await frameRequests(page);
  await expect.poll(() => frameRequests(page)).toBeGreaterThan(before + 5);
}

async function expectNoFrames(page: Page): Promise<void> {
  // Angular's scheduler may ask for one more frame right after the last state change.
  await page.waitForTimeout(200);
  const settled = await frameRequests(page);
  await page.waitForTimeout(300);
  expect(await frameRequests(page)).toBe(settled);
}

async function hoverProjectCard(page: Page): Promise<Point> {
  const point = await hoverCenter(page, projectCard(page).locator('h3'));
  await expectRingOn(page, 'Projekt ansehen');
  return point;
}

test.describe('mit Maus', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await countFrames(page);
    await page.goto('/');
  });

  test('[AK10] über der Karte erscheint der Ring und folgt dem Zeiger', async ({ page }) => {
    await expectRingAt(page, await hoverProjectCard(page));

    const next = await hoverCenter(page, projectCard(page).locator('.card-main > p'));
    await expectRingAt(page, next);
    await expectRingOn(page, 'Projekt ansehen');
  });

  test('[AK10] Berichtskarte hat ihren eigenen Text', async ({ page }) => {
    await hoverCenter(page, reportCard(page).locator('h3'));
    await expectRingOn(page, 'Berichte ansehen');
  });

  test('[AK10] über einem Link ist der Ring aus', async ({ page }) => {
    await hoverProjectCard(page);
    await hoverCenter(page, projectCard(page).locator('a[data-card-cta]'));
    await expectRingOff(page);
  });

  test('[AK10] außerhalb der Karten ist der Ring aus', async ({ page }) => {
    await hoverProjectCard(page);
    await hoverCenter(page, page.locator('#projekte h2'));
    await expectRingOff(page);
  });

  test('[AK10] ausgeblendet läuft keine Schleife mehr', async ({ page }) => {
    await hoverProjectCard(page);
    await expectFramesRunning(page);

    await hoverCenter(page, page.locator('#projekte h2'));
    await expectRingOff(page);
    await expectNoFrames(page);
  });

  test('[AK10] verlässt der Zeiger das Fenster, ist der Ring aus', async ({ page }) => {
    await hoverProjectCard(page);
    await page.mouse.move(-5, -5);
    await expectRingOff(page);
  });

  test('[AK10] Berührung auf einem Gerät mit Maus bringt keinen Ring', async ({ page }) => {
    const title = projectCard(page).locator('h3');
    await title.dispatchEvent('pointerover', { bubbles: true, pointerType: 'touch' });
    await expect(ring(page)).toHaveText('');
    await expectRingOff(page);
  });

  test('[AK10] Klick durch den Ring öffnet die Detailseite', async ({ page }) => {
    const { x, y } = await hoverProjectCard(page);
    await expect(ring(page)).toHaveCSS('pointer-events', 'none');

    await page.mouse.click(x, y);
    await expect(page).toHaveURL(detailPage);
  });

  test('[AK10] aria-hidden, kein Tab-Stopp', async ({ page }) => {
    await hoverProjectCard(page);

    await expect(ring(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(ring(page)).not.toHaveAttribute('tabindex');
    await expect(ring(page).locator('a, button, [tabindex]')).toHaveCount(0);
  });

  test('[AK10] Tastatur braucht den Ring nicht', async ({ page }) => {
    const cta = projectCard(page).locator('a[data-card-cta]');
    for (let tabs = 0; tabs < 40; tabs++) {
      await page.keyboard.press('Tab');
      if (await cta.evaluate((link) => link === document.activeElement)) break;
    }
    await expect(cta).toBeFocused();
    await expectRingOff(page);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(detailPage);
    await expectRingOff(page);
  });
});

test('[AK10] Reduced Motion: kein Ring', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await hoverCenter(page, projectCard(page).locator('h3'));
  await expect(ring(page)).toHaveCount(1);
  await expect(ring(page)).toHaveText('');
  await expect(ring(page)).toBeHidden();
});

test('[AK10] Touch: kein Ring, CTA sichtbar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Nur das Gerät mit Touch');
  await page.goto('/');

  await expect(ring(page)).toHaveCount(1);
  await expect(ring(page)).toBeHidden();
  await expect(projectCard(page).locator('a[data-card-cta]')).toBeVisible();
});
