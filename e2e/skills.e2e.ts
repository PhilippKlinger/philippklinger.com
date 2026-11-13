import { expect, test, type Page } from '@playwright/test';
import { focusAreas } from '../src/content/focus-areas';

// Skills with tool icons (B13, reference R8, spec 3.2): icon plus visible name.

const width = (page: Page) => page.viewportSize()?.width ?? 0;
const tools = (page: Page) => page.locator('#skills .tools li');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test('[B13] jedes Werkzeug zeigt ein dekoratives Icon und seinen Namen', async ({ page }) => {
  // The visible name is the only text, the icon adds nothing to it.
  await expect(tools(page)).toHaveText(focusAreas.flatMap((area) => area.tools));
  for (const tool of await tools(page).all()) {
    await expect(tool.locator('svg[aria-hidden="true"]')).toBeVisible();
  }
});

test('[B13] alle Icons kommen aus einer Sprite-Datei und existieren dort', async ({ page }) => {
  const hrefs = await tools(page)
    .locator('use')
    .evaluateAll((uses) => uses.map((use) => use.getAttribute('href') ?? ''));
  expect(hrefs.length).toBe(focusAreas.flatMap((area) => area.tools).length);
  const sprite = await page.request.get('/images/tools.svg');
  expect(sprite.status()).toBe(200);
  expect(sprite.headers()['content-type']).toContain('image/svg+xml');
  const body = await sprite.text();
  for (const href of hrefs) {
    const [file, id] = href.split('#');
    expect(file).toBe('/images/tools.svg');
    expect(body, `Symbol ${id} fehlt`).toContain(`id="${id}"`);
  }
  // No path data on the page itself: it would count against every page view.
  await expect(page.locator('#skills .tools path')).toHaveCount(0);
});

test('[B13] Icon steht links in einer Zeile mit dem Namen', async ({ page }) => {
  const rows = await tools(page).evaluateAll((items) =>
    items.map((li) => {
      const icon = li.querySelector('svg')!.getBoundingClientRect();
      const range = document.createRange();
      const name = [...li.childNodes].find(
        (node) => node.nodeType === 3 && node.textContent?.trim(),
      );
      range.selectNodeContents(name!);
      const text = range.getBoundingClientRect();
      return {
        text: li.textContent?.trim(),
        offset: Math.abs(icon.top + icon.height / 2 - (text.top + text.height / 2)),
        iconLeft: icon.right <= text.left,
        // Distinct line tops; collapsed spaces may add empty rects.
        nameLines: new Set(
          [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)),
        ).size,
      };
    }),
  );
  for (const row of rows) {
    expect(row.offset, `Icon und „${row.text}“ nicht auf einer Höhe`).toBeLessThanOrEqual(4);
    expect(row.iconLeft, `Icon von „${row.text}“ steht nicht links`).toBe(true);
    expect(row.nameLines, `„${row.text}“ bricht um`).toBe(1);
  }
});

test('[B13] kein horizontaler Überlauf bei 390 px', async ({ page }) => {
  test.skip(width(page) !== 390, 'nur bei 390 px');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const outside = await page.locator('#skills .card').evaluateAll((cards) =>
    cards.flatMap((card) => {
      const box = card.getBoundingClientRect();
      return [...card.querySelectorAll('.tools li')]
        .filter((li) => {
          const item = li.getBoundingClientRect();
          return item.left < box.left || item.right > box.right;
        })
        .map((li) => li.textContent?.trim());
    }),
  );
  expect(outside, 'Werkzeug ragt aus der Karte').toEqual([]);
});

// Calm list (S6, variant B, 13.11.): one tool per row, rows divided by a faint line, no pills.
test('[S6] Werkzeuge stehen als ruhige Liste: gleich hoch, bündig, ohne Pille', async ({
  page,
}) => {
  const cards = await page.locator('#skills .card').evaluateAll((all) =>
    all.map((card) => {
      const list = card.querySelector('.tools')!.getBoundingClientRect();
      return [...card.querySelectorAll('.tools li')].map((li) => {
        const box = li.getBoundingClientRect();
        const style = getComputedStyle(li);
        return {
          text: li.textContent?.trim(),
          height: box.height,
          indent: box.left - list.left,
          width: list.width - box.width,
          radius: parseFloat(style.borderTopLeftRadius),
          sides: [style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
          top: style.borderTopStyle === 'none' ? 0 : parseFloat(style.borderTopWidth),
        };
      });
    }),
  );
  for (const tools of cards) {
    const heights = tools.map((tool) => tool.height);
    expect(Math.max(...heights) - Math.min(...heights), heights.join(', ')).toBeLessThanOrEqual(1);
    expect(tools[0].top, `erste Zeile „${tools[0].text}“ mit Linie`).toBe(0);
    for (const [index, tool] of tools.entries()) {
      expect(tool.indent, `„${tool.text}“ nicht bündig`).toBeLessThanOrEqual(1);
      expect(tool.width, `„${tool.text}“ nicht über die ganze Breite`).toBeLessThanOrEqual(1);
      expect(tool.radius, `„${tool.text}“ ist eine Pille`).toBe(0);
      expect(tool.sides, `„${tool.text}“ hat einen Rahmen`).toEqual(['none', 'none', 'none']);
      if (index > 0) expect(tool.top, `„${tool.text}“ ohne Trennlinie`).toBe(1);
    }
  }
});

test('[S6] nebeneinanderstehende Karten beginnen ihre Werkzeuge auf gleicher Höhe', async ({
  page,
}) => {
  test.skip(width(page) < 1440, 'Karten stehen erst ab Desktop nebeneinander');
  const tops = await page
    .locator('#skills .tools')
    .evaluateAll((lists) => lists.map((list) => list.getBoundingClientRect().top));
  expect(tops).toHaveLength(focusAreas.length);
  expect(Math.max(...tops) - Math.min(...tops), tops.join(', ')).toBeLessThanOrEqual(1);
});
