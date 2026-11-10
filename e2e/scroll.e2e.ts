import { expect, test, type Page } from '@playwright/test';

// Scroll paths of the start page (feedback FB-02, FB-03 from 2026-11-10): every jump lands on
// the content of its section with a small gap, not on the padding above it, and a button
// brings the reader back to the top.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
/** --space-lg: the gap between the top of the viewport and the content after a jump. */
const GAP = 32;
const sections = ['ueber-mich', 'skills', 'projekte', 'kontakt'];

/** Distance from the viewport top to the first content of the section (inside its padding). */
const contentTop = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((el) => {
    const padding = parseFloat(getComputedStyle(el).paddingTop);
    return Math.round(el.getBoundingClientRect().top + padding);
  });

/** The last section may sit too low to reach the gap; it then ends at the bottom of the page. */
const atPageEnd = (page: Page) =>
  page.evaluate(
    () => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight,
  );

async function expectLandedOn(page: Page, id: string) {
  await expect.poll(() => contentTop(page, id), `#${id}`).toBeLessThanOrEqual(GAP + 2);
  const top = await contentTop(page, id);
  expect(top, `#${id} liegt über dem Bildschirmrand`).toBeGreaterThanOrEqual(0);
  if (!(await atPageEnd(page)))
    expect(Math.abs(top - GAP), `#${id}: Abstand oben`).toBeLessThanOrEqual(2);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test.describe('Sprungziele (FB-03)', () => {
  test('[FB-03] „Projekte ansehen“ im Hero landet am Inhalt, die erste Karte beginnt im Bild', async ({
    page,
  }) => {
    await page.locator('.hero').getByRole('link', { name: 'Projekte ansehen' }).click();
    await expectLandedOn(page, 'projekte');
    const card = page.locator('#projekte .cards > li').first();
    const box = await card.boundingBox();
    const viewport = page.viewportSize()?.height ?? 0;
    expect(box && box.y < viewport / 2, 'erste Karte beginnt in der oberen Bildhälfte').toBe(true);
  });

  test('[FB-03] „Kontakt“ im Hero landet am Inhalt', async ({ page }) => {
    await page.locator('.hero').getByRole('link', { name: 'Kontakt', exact: true }).click();
    await expectLandedOn(page, 'kontakt');
  });

  test('[FB-03] jeder Navigationseintrag landet am Inhalt seines Abschnitts', async ({ page }) => {
    const labels = ['Über mich', 'Skills', 'Projekte', 'Kontakt'];
    for (const [index, label] of labels.entries()) {
      if (isMobile(page)) await page.getByRole('button', { name: 'Menü' }).click();
      await page
        .getByRole('navigation', { name: 'Hauptnavigation' })
        .getByRole('link', { name: label, exact: true })
        .click();
      await expectLandedOn(page, sections[index]);
    }
  });

  test('[FB-03] Aufruf mit Anker landet am Inhalt', async ({ page }) => {
    for (const id of sections) {
      await page.goto(`/#${id}`);
      await page.evaluate(() => document.fonts.ready);
      await expectLandedOn(page, id);
    }
  });
});

test.describe('Nach oben (FB-02)', () => {
  const button = (page: Page) => page.getByRole('button', { name: 'Nach oben' });

  test('[FB-02] Button fehlt, solange der Hero im Bild ist', async ({ page }) => {
    // Present in the page, so the check below cannot pass on a missing button.
    await expect(page.getByRole('button', { name: 'Nach oben', includeHidden: true })).toHaveCount(
      1,
    );
    await expect(button(page)).toBeHidden();
    await page.keyboard.press('Tab');
    await expect(button(page)).not.toBeFocused();
  });

  test('[FB-02] Button erscheint, sobald der Hero aus dem Bild ist', async ({ page }) => {
    await page.locator('#ueber-mich').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const hero = document.querySelector('.hero')!;
      window.scrollTo(0, hero.getBoundingClientRect().bottom + window.scrollY + 1);
    });
    await expect(button(page)).toBeVisible();
    await expect(button(page)).toBeInViewport({ ratio: 1 });
  });

  test('[FB-02] Klick bringt an den Seitenanfang und setzt den Fokus dorthin', async ({ page }) => {
    await page.locator('#kontakt').scrollIntoViewIfNeeded();
    await button(page).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('#main')).toBeFocused();
    await expect(button(page)).toBeHidden();
  });

  test('[FB-02] Bei reduzierter Bewegung springt die Seite sofort nach oben', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#kontakt').scrollIntoViewIfNeeded();
    await button(page).click();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('[FB-02] nur auf der Startseite', async ({ page }) => {
    await page.goto('/impressum/');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(button(page)).toHaveCount(0);
  });
});
