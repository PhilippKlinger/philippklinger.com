import { expect, test, type Page } from '@playwright/test';
import { projects } from '../src/content/projects';

// Project pages /projekte/<slug>/ (spec 7). The site-wide checks in
// site, layout, seo and a11y cover them through the prerender manifest.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

for (const project of projects) {
  test.describe(`Projektseite ${project.slug}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/projekte/${project.slug}/`);
    });

    test('[Spec 7] zeigt Titel, Summary und alle Links', async ({ page }) => {
      const main = page.locator('main');
      await expect(main.locator('h1')).toHaveText(project.title);
      await expect(main).toContainText(project.summary);
      const links = main.locator('.links a');
      await expect(links).toHaveCount(project.links.length);
      for (const [index, link] of project.links.entries()) {
        await expect(links.nth(index)).toHaveText(link.label);
        await expect(links.nth(index)).toHaveAttribute('href', link.url);
      }
    });

    const preview = project.preview;
    if (preview) {
      test('[Spec 7] Vorschaubild ist geladen und hat die angegebenen Maße', async ({ page }) => {
        const image = page.locator('main img');
        await expect(image).toBeVisible();
        await expect
          .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBe(preview.width);
        expect(await image.evaluate((el: HTMLImageElement) => el.naturalHeight)).toBe(
          preview.height,
        );
      });
    }

    test('[Regel web-quality] Links und Rückweg sind Touch-Ziele ab 44 px', async ({ page }) => {
      for (const link of await page.locator('main a:visible').all()) {
        const box = (await link.boundingBox())!;
        expect(box.height, await link.innerText()).toBeGreaterThanOrEqual(44);
      }
    });

    test('[Spec 3.4] Rückweg führt zur Projektliste', async ({ page }) => {
      await page.locator('main a.back').click();
      await expect(page).toHaveURL(/\/#projekte$/);
      await expect(page.locator('#projekte h2')).toBeInViewport();
    });

    test('[Spec 3.4 Motion] Reduced Motion: nichts bewegt sich', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/projekte/${project.slug}/`);
      const moving = await page
        .locator('main')
        .evaluate(
          (main) =>
            main
              .getAnimations({ subtree: true })
              .filter((a) => Number(a.effect?.getTiming().duration ?? 0) > 1).length,
        );
      expect(moving).toBe(0);
    });
  });
}

test('[Hosting] unbekannter Slug liefert Status 404', async ({ page }) => {
  const response = await page.goto('/projekte/gibts-nicht/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Seite nicht gefunden');
});

test('[Design] Vorschau ab Tablet neben dem Text, mobil darunter', async ({ page }) => {
  await page.goto('/projekte/videoflix/');
  const text = (await page.locator('main .intro').boundingBox())!;
  const image = (await page.locator('main img').boundingBox())!;
  if (isMobile(page)) {
    expect(image.y).toBeGreaterThanOrEqual(text.y + text.height);
  } else {
    expect(image.x).toBeGreaterThanOrEqual(text.x + text.width);
  }
});
