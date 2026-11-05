import { expect, test, type Page } from '@playwright/test';
import { projects } from '../src/content/projects';

// Project pages /projekte/<slug>/ (spec 3.2, stage 3). The site-wide checks in
// site, layout, seo and a11y cover them through the prerender manifest.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

for (const project of projects) {
  test.describe(`Projektseite ${project.slug}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/projekte/${project.slug}/`);
    });

    test('[Spec 3.2] zeigt Titel, Etikett, Summary, Stack und alle Links', async ({ page }) => {
      const main = page.locator('main');
      await expect(main.locator('h1')).toHaveText(project.title);
      await expect(main).toContainText(project.label);
      await expect(main).toContainText(project.summary);
      await expect(main.locator('.stack li')).toHaveText(project.stack);
      const links = main.locator('.links a');
      await expect(links).toHaveText(project.links.map((link) => link.label));
      for (const [index, link] of project.links.entries()) {
        await expect(links.nth(index)).toHaveAttribute('href', link.url);
      }
    });

    test('[Spec 3.2] Vorschaubild ist geladen', async ({ page }) => {
      const image = page.locator('main img');
      await expect(image).toBeVisible();
      await expect
        .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBe(project.preview?.width);
    });

    test('[Regel web-quality] Links und Rückweg sind Touch-Ziele ab 44 px', async ({ page }) => {
      for (const link of await page.locator('main a').all()) {
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

test('[Spec 3.2] Nachweis-Kurzzeile nur auf Projekten, die einen haben', async ({ page }) => {
  for (const project of projects) {
    await page.goto(`/projekte/${project.slug}/`);
    await expect(page.locator('main .proof')).toHaveCount(project.proof ? 1 : 0);
  }
});

test('[Hosting] unbekannter Slug liefert Status 404', async ({ page }) => {
  const response = await page.goto('/projekte/gibts-nicht/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Seite nicht gefunden');
});

test('[Spec 3.4] jede Zeile der Liste führt auf ihre Projektseite', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#projekte a.project');
  await expect(rows).toHaveCount(projects.length);
  for (const [index, project] of projects.entries()) {
    await expect(rows.nth(index)).toHaveAttribute('href', `/projekte/${project.slug}/`);
  }
  await rows.first().click();
  // The hydrated router drops the trailing slash from the address bar (all subpages).
  await expect(page).toHaveURL(new RegExp(`/projekte/${projects[0].slug}/?$`));
  await expect(page.locator('h1')).toHaveText(projects[0].title);
});

test('[Vorlage] Vorschau ab Tablet neben dem Text, mobil darunter', async ({ page }) => {
  await page.goto('/projekte/videoflix/');
  const text = (await page.locator('main .intro').boundingBox())!;
  const image = (await page.locator('main img').boundingBox())!;
  if (isMobile(page)) {
    expect(image.y).toBeGreaterThanOrEqual(text.y + text.height);
  } else {
    expect(image.x).toBeGreaterThanOrEqual(text.x + text.width);
  }
});
