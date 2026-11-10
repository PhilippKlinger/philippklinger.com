import { expect, test, type Page } from '@playwright/test';

// The header stays reachable (feedback FB-13, 2026-11-10): always at the top on tablet and
// desktop; on mobile it leaves while the reader scrolls down and comes back on the way up.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const header = (page: Page) => page.locator('app-header');
const menuButton = (page: Page) => page.getByRole('button', { name: 'Menü' });

/** Scrolls in small steps like a reader, so every step fires its own scroll event. */
async function scrollInSteps(page: Page, distance: number) {
  const step = Math.sign(distance) * 120;
  for (let done = 0; Math.abs(done) < Math.abs(distance); done += step) {
    await page.evaluate((y) => window.scrollBy(0, y), step);
    await page.waitForTimeout(30);
  }
}

/** Fully on screen, not slid out above the viewport. */
const expectShown = (page: Page) => expect(header(page)).toBeInViewport({ ratio: 1 });
const expectGone = (page: Page) => expect(header(page)).not.toBeInViewport();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test.describe('Header erreichbar (FB-13)', () => {
  test('[FB-13] Tablet und Desktop: Navigation bleibt beim Scrollen oben und funktioniert', async ({
    page,
  }) => {
    test.skip(isMobile(page), 'mobil gilt das Verhalten unten');
    await scrollInSteps(page, 2400);
    await expectShown(page);
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Kontakt', exact: true })
      .click();
    await expect(page.locator('#kontakt h2')).toBeInViewport();
  });

  test('[FB-13] Mobil: oben sichtbar, beim Runterscrollen weg, beim Hochscrollen zurück', async ({
    page,
  }) => {
    test.skip(!isMobile(page), 'nur mobil');
    await expectShown(page);
    await scrollInSteps(page, 1200);
    await expectGone(page);
    await scrollInSteps(page, -240);
    await expectShown(page);
    await menuButton(page).click();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');
  });

  test('[FB-13] Mobil: bei offenem Menü bleibt der Header stehen', async ({ page }) => {
    test.skip(!isMobile(page), 'nur mobil');
    await scrollInSteps(page, 1200);
    await scrollInSteps(page, -240);
    await menuButton(page).click();
    await scrollInSteps(page, 480);
    await expectShown(page);
  });

  // Guards the new behaviour: the old header scrolled away and could not cover anything.
  test('[FB-13] Mobil: ein Sprung nach oben verdeckt die Überschrift nicht', async ({ page }) => {
    test.skip(!isMobile(page), 'nur mobil');
    await page.goto('/#kontakt');
    await scrollInSteps(page, -240);
    await menuButton(page).click();
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Über mich', exact: true })
      .click();
    await expectGone(page);
    await expect(page.locator('#ueber-mich')).toBeInViewport();
  });

  test('[FB-13 · WCAG 2.4.11] Mobil: Tastaturfokus holt den Header zurück', async ({ page }) => {
    test.skip(!isMobile(page), 'nur mobil');
    await scrollInSteps(page, 1200);
    await expectGone(page);
    // Without scrolling: a plain focus() would scroll the page to the button by itself.
    await menuButton(page).evaluate((el) => el.focus({ preventScroll: true }));
    await expectShown(page);
  });

  test('[FB-13] über dem Hero transparent, über dem Inhalt mit Hintergrund', async ({ page }) => {
    const background = () => header(page).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await background()).toBe('rgba(0, 0, 0, 0)');
    await scrollInSteps(page, 1200);
    if (isMobile(page)) await scrollInSteps(page, -240);
    await expect.poll(background).toBe('rgb(28, 28, 28)');
  });
});
