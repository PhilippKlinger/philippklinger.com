import { expect, test, type Page } from '@playwright/test';
import { projects } from '../src/content/projects';

// Project pages /projekte/<slug>/ (spec 7). The site-wide checks in
// site, layout, seo and a11y cover them through the prerender manifest.

// Breakpoint card of src/styles/_breakpoints.scss: head and cards side by side from here.
const isBeside = (page: Page) => (page.viewportSize()?.width ?? 0) >= 960;

// Breakpoints of src/styles/_breakpoints.scss: decision and failure side by side from tablet,
// the architecture card in two columns from desktop.
const isTablet = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1440;

/** [g3] Architecture over the full width; decision and failure below, of the same height. */
async function expectThreeCards(page: Page) {
  const cards = page.locator('main .how-built .card');
  await expect(cards).toHaveCount(3);
  const grid = (await page.locator('main .how-built .cards').boundingBox())!;
  const [architecture, decision, failure] = await Promise.all(
    (await cards.all()).map(async (card) => (await card.boundingBox())!),
  );
  expect(architecture.width).toBeCloseTo(grid.width, 0);
  expect(decision.y).toBeGreaterThanOrEqual(architecture.y + architecture.height);
  if (!isTablet(page)) {
    expect(failure.y).toBeGreaterThanOrEqual(decision.y + decision.height);
    return;
  }
  expect(failure.y).toBeCloseTo(decision.y, 0);
  expect(failure.height).toBeCloseTo(decision.height, 0);
  expect(failure.x).toBeGreaterThanOrEqual(decision.x + decision.width);
}

/** [g3] An arrow hangs at the end of the previous part and no part breaks inside. */
async function expectArrowsAtLineEnd(page: Page, { noBreak = true } = {}) {
  const parts = await page.locator('main .parts li').evaluateAll((items) =>
    items.map((item, index) => ({
      before: getComputedStyle(item, '::before').content,
      after: getComputedStyle(item, '::after').content,
      last: index === items.length - 1,
      oneLine:
        item.getBoundingClientRect().height <
        item.firstElementChild!.getBoundingClientRect().height * 1.5,
    })),
  );
  for (const part of parts) {
    expect(['none', 'normal']).toContain(part.before);
    expect(part.after.startsWith('"→"')).toBe(!part.last);
    if (noBreak) expect(part.oneLine).toBe(true);
  }
}

for (const project of projects) {
  test.describe(`Projektseite ${project.slug}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/projekte/${project.slug}/`);
    });

    test('[D1] [D9] Kopf, Software Delivery und drei Karten in dieser Reihenfolge', async ({
      page,
    }) => {
      const main = page.locator('main');
      await expect(main.locator(':is(h1, h2)')).toHaveText([
        project.title,
        'Software Delivery',
        'Wie es gebaut ist',
      ]);
      await expect(main.locator('.signal .state')).toBeVisible();
      await expect(main.locator('.summary')).toHaveText(project.summary);
      await expect(main.locator('.tech')).toHaveCount(0);
      await expect(main.locator('.media')).toBeVisible();
      const links = main.locator('.links a');
      await expect(links).toHaveCount(project.links.length);
      for (const [index, link] of project.links.entries()) {
        await expect(links.nth(index)).toHaveAccessibleName(link.label);
        await expect(links.nth(index)).toHaveAttribute('href', link.url);
      }
      if (project.links.length > 0) await expect(links.first()).toHaveClass(/button-primary/);
      await expectThreeCards(page);
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

test('[Spec 16.3] Bild ab 960 px neben dem Text, darunter unter dem Text', async ({ page }) => {
  await page.goto('/projekte/videoflix/');
  const text = (await page.locator('main .intro').boundingBox())!;
  const media = (await page.locator('main .media').boundingBox())!;
  if (isBeside(page)) {
    expect(media.x).toBeGreaterThanOrEqual(text.x + text.width);
  } else {
    expect(media.y).toBeGreaterThanOrEqual(text.y + text.height);
  }
});

test('[g3] Architektur: Bausteine ohne Pfeil am Zeilenanfang, Videoflix ab 1440 px in einer Zeile', async ({
  page,
}) => {
  await page.goto('/projekte/videoflix/');
  await expectArrowsAtLineEnd(page);
  if (!isDesktop(page)) return;
  const tops = await page
    .locator('main .parts li')
    .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  const text = (await page.locator('main .card-architecture p').boundingBox())!;
  const parts = (await page.locator('main .parts').boundingBox())!;
  expect(parts.x).toBeGreaterThanOrEqual(text.x + text.width);
});

test('[g3] Architektur bei 320 px ohne horizontales Scrollen, Pfeile am Zeilenende', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const project of projects) {
    await page.goto(`/projekte/${project.slug}/`);
    // At 320 px the longest part of vps-plattform may break; nothing may pass the edge.
    await expectArrowsAtLineEnd(page, { noBreak: false });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, project.slug).toBeLessThanOrEqual(0);
  }
});

test('[a2] Bildrahmen folgt dem Bild: keine Fläche über oder unter dem Bild', async ({ page }) => {
  await page.goto('/projekte/videoflix/');
  // clientHeight leaves out the border of the frame.
  const frame = await page.locator('main .media').evaluate((el) => el.clientHeight);
  const image = (await page.locator('main .media img').boundingBox())!;
  expect(Math.abs(frame - image.height)).toBeLessThanOrEqual(1);
});
