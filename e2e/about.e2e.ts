import { expect, test, type Page } from '@playwright/test';
import { about } from '../src/content/profile';

// About (FB-06, mockup docs/mockups/2026-11-11-ueber-mich/runde-5.html): the path in the line
// language of the hero pipeline. Across from 1100 px (breakpoint pipeline), upright below.

const ACROSS = 1100;
const width = (page: Page) => page.viewportSize()?.width ?? 0;
const path = (page: Page) => page.locator('#ueber-mich .path');
/** Share of the line that is drawn, 0 to 1: the fill scales along X across and along Y upright. */
const drawn = (page: Page) =>
  path(page)
    .locator('.fill')
    .evaluate((fill) => {
      const { a, d } = new DOMMatrix(getComputedStyle(fill).transform);
      return a * d;
    });

/** Per station: offset of the title against its node, at the left edge, centre and right edge. */
const offsets = (page: Page) =>
  path(page)
    .locator('li')
    .evaluateAll((items) =>
      items.map((item) => {
        const node = item.querySelector('.node')!.getBoundingClientRect();
        const name = item.querySelector('.name')!.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(item.querySelector('.name')!).lineHeight);
        return {
          left: name.left - node.left,
          centre: (name.left + name.right) / 2 - (node.left + node.right) / 2,
          right: name.right - node.right,
          lines: Math.round(name.height / lineHeight),
          nodeTop: node.top,
        };
      }),
    );

test('[FB-06] ab 1100 px: Titel links, mittig und rechts an ihrem Knoten, je eine Zeile', async ({
  page,
}) => {
  await page.goto('/');
  test.skip(width(page) < ACROSS, 'senkrecht unter 1100 px');
  await page.evaluate(() => document.fonts.ready);
  const [first, middle, last] = await offsets(page);
  expect(Math.abs(first.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(middle.centre)).toBeLessThanOrEqual(1);
  expect(Math.abs(last.right)).toBeLessThanOrEqual(1);
  for (const station of [first, middle, last]) {
    expect(station.lines).toBe(1);
    expect(Math.abs(station.nodeTop - first.nodeTop), 'Knoten auf einer Linie').toBeLessThanOrEqual(
      1,
    );
  }
});

test('[FB-06] unter 1100 px: Knoten untereinander, Titel rechts daneben', async ({ page }) => {
  await page.goto('/');
  test.skip(width(page) >= ACROSS, 'waagrecht ab 1100 px');
  const stations = await offsets(page);
  for (const [index, station] of stations.entries()) {
    expect(station.left, 'Titel rechts vom Knoten').toBeGreaterThan(0);
    if (index > 0) expect(station.nodeTop).toBeGreaterThan(stations[index - 1].nodeTop);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'kein waagrechtes Scrollen').toBe(0);
});

test('[FB-06] die Linie füllt sich einmal, wenn der Weg ins Bild kommt, ohne Layout-Sprung', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Bewegung auf einer Breite genügt');
  await page.goto('/');
  await expect(path(page)).toHaveAttribute('data-line', 'armed');
  expect(await drawn(page)).toBe(0);
  const height = await page.locator('#ueber-mich').evaluate((section) => section.offsetHeight);
  await path(page).scrollIntoViewIfNeeded();
  await expect.poll(() => drawn(page)).toBe(1);
  await expect(path(page)).toHaveAttribute('data-line', 'run');
  expect(await page.locator('#ueber-mich').evaluate((section) => section.offsetHeight)).toBe(
    height,
  );
});

test.describe('ohne Bewegung', () => {
  test.use({ reducedMotion: 'reduce' });

  test('[FB-06] Reduced Motion: die Linie steht fertig, ohne zu warten', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-about')).toBeAttached();
    expect(await drawn(page)).toBe(1);
    await expect(path(page)).not.toHaveAttribute('data-line', 'armed');
  });
});

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('[FB-06] die vorgerenderte Seite zeigt den ganzen Weg', async ({ page }) => {
    await page.goto('/');
    await expect(path(page).locator('li')).toHaveText(about.path);
    expect(await drawn(page)).toBe(1);
  });
});
