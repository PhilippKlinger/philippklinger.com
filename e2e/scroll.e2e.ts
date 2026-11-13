import { expect, test, type Page } from '@playwright/test';

// Scroll paths of the start page (feedback FB-02, FB-03 from 2026-11-10): every jump lands on
// the content of its section with a small gap, not on the padding above it, and a button
// brings the reader back to the top.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
/** --space-lg: the gap between the top of the viewport and the content after a jump. */
const GAP = 32;
const sections = ['ueber-mich', 'skills', 'projekte', 'kontakt'];

/** Distance from the visible header (or the viewport top) to the first content of the section. */
const contentTop = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((el) => {
    const padding = parseFloat(getComputedStyle(el).paddingTop);
    const cover = Math.max(0, document.querySelector('app-header')!.getBoundingClientRect().bottom);
    return Math.round(el.getBoundingClientRect().top + padding - cover);
  });

/** The last section may sit too low to reach the gap; it then ends at the bottom of the page. */
const atPageEnd = (page: Page) =>
  page.evaluate(
    () => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight,
  );

async function expectLandedOn(page: Page, id: string) {
  // Waits for the resting state: on mobile the header slides out after a jump, so the gap is
  // only final once that has finished.
  const landed = async () =>
    Math.abs((await contentTop(page, id)) - GAP) <= 2 || (await atPageEnd(page));
  await expect.poll(landed, `#${id}`).toBe(true);
  const top = await contentTop(page, id);
  expect(top, `#${id} liegt unter dem Header oder über dem Bildschirmrand`).toBeGreaterThanOrEqual(
    0,
  );
  if (await atPageEnd(page)) {
    await expect(page.locator(`#${id} h2`), `#${id} am Seitenende`).toBeInViewport();
  } else {
    expect(Math.abs(top - GAP), `#${id}: Abstand oben`).toBeLessThanOrEqual(2);
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test.describe('Sprungziele (FB-03)', () => {
  test('[FB-03] „Projekte ansehen“ im Hero landet am Inhalt, die erste Zeile beginnt im Bild', async ({
    page,
  }) => {
    await page.locator('.hero').getByRole('link', { name: 'Projekte ansehen' }).click();
    await expectLandedOn(page, 'projekte');
    const row = page.locator('#projekte .rows > li').first();
    const box = await row.boundingBox();
    const viewport = page.viewportSize()?.height ?? 0;
    expect(box && box.y < viewport / 2, 'erste Zeile beginnt in der oberen Bildhälfte').toBe(true);
  });

  test('[FB-03] „Kontakt“ im Hero landet am Inhalt', async ({ page }) => {
    await page.locator('.hero').getByRole('link', { name: 'Kontakt', exact: true }).click();
    await expectLandedOn(page, 'kontakt');
  });

  test('[FB-03] jeder Navigationseintrag landet am Inhalt seines Abschnitts', async ({ page }) => {
    const labels = ['Über mich', 'Skills', 'Projekte', 'Kontakt'];
    const menuButton = page.getByRole('button', { name: 'Menü' });
    for (const [index, label] of labels.entries()) {
      if (isMobile(page)) {
        // After a jump the mobile header has slid out (FB-13); a reader scrolls up a little to
        // bring it back before opening the menu.
        if (index > 0) await page.evaluate(() => window.scrollBy(0, -120));
        await expect(menuButton).toBeInViewport({ ratio: 1 });
        await menuButton.click();
      }
      await page
        .getByRole('navigation', { name: 'Hauptnavigation' })
        .getByRole('link', { name: label, exact: true })
        .click();
      await expectLandedOn(page, sections[index]);
    }
  });

  test('[FB-03 · WCAG 2.4.3] nach einem Sprung führt Tab in den Abschnitt, nicht zurück in den Header', async ({
    page,
  }) => {
    if (isMobile(page)) await page.getByRole('button', { name: 'Menü' }).click();
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Projekte', exact: true })
      .click();
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => !!document.activeElement?.closest('#projekte'));
    expect(inside, 'Fokus liegt nach Tab im Abschnitt Projekte').toBe(true);
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
    const present = page.getByRole('button', { name: 'Nach oben', includeHidden: true });
    await expect(present).toHaveCount(1);
    await expect(present).toBeHidden();
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

  test('[FB-02] am Seitenende liegt der Button über dem Footer, nicht auf ihm', async ({
    page,
  }) => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(button(page)).toBeVisible();
    const [box, footer] = [
      await button(page).boundingBox(),
      await page.locator('app-footer').boundingBox(),
    ];
    expect(box!.y + box!.height, 'Button reicht in den Footer').toBeLessThanOrEqual(footer!.y);
  });

  // S11 (13.11.): the button sits in the corner and only shows while the reader rests.
  test('[S11] sitzt in der Ecke: höchstens 16 px Abstand rechts und unten', async ({ page }) => {
    await page.locator('#skills').scrollIntoViewIfNeeded();
    await expect(button(page)).toBeVisible();
    const box = (await button(page).boundingBox())!;
    const view = page.viewportSize()!;
    expect(view.width - (box.x + box.width), 'Abstand rechts').toBeLessThanOrEqual(16);
    expect(view.height - (box.y + box.height), 'Abstand unten').toBeLessThanOrEqual(16);
  });

  test('[S11] verschwindet beim Scrollen und kommt nach der Pause zurück', async ({ page }) => {
    await page.locator('#skills').scrollIntoViewIfNeeded();
    await expect(button(page)).toBeVisible();
    for (let step = 0; step < 6; step++) {
      await page.evaluate(() => window.scrollBy(0, 40));
      await page.waitForTimeout(50);
    }
    await expect(button(page)).toBeHidden();
    await expect(button(page)).toBeVisible();
  });

  test('[FB-02] nur auf der Startseite', async ({ page }) => {
    await page.goto('/impressum/');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(button(page)).toHaveCount(0);
  });
});

// S10 (13.11.): the legal pages lead back to the footer of the start page, where they are linked.
test.describe('Rechtliches (S10)', () => {
  for (const path of ['/impressum/', '/datenschutz/']) {
    test(`[S10] ${path}: Zurück führt zum Footer der Startseite`, async ({ page }) => {
      await page.goto(path);
      await page.getByRole('link', { name: 'Zurück zur Startseite' }).click();
      await expect(page).toHaveURL(/\/#fusszeile$/);
      await expect(page.locator('footer#fusszeile')).toBeInViewport();
    });
  }
});
