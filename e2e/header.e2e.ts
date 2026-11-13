import { expect, test, type Locator, type Page } from '@playwright/test';
import { contrast, decodeRgba, luminance, pixelColours } from './support/colour';

// The header stays reachable (feedback FB-13, 2026-11-10): always at the top on tablet and
// desktop; on mobile it leaves while the reader scrolls down and comes back on the way up.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
type Clip = { x: number; y: number; width: number; height: number };
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
});

// S3 (13.11.): over the content the solid bar with its line was too dominant. Variant C of the
// mockup: slimmer, fading from the page colour at the top to transparent, without a line.
test.describe('Header über dem Inhalt (S3)', () => {
  /** White behind the bar, the worst case for its text; the bar shows only its background. */
  const whiteBehind = `body { background: #fff !important; }
    main, app-footer, app-haze, app-header .header > * { visibility: hidden; }`;

  const look = (page: Page) =>
    header(page).evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      background: getComputedStyle(el).backgroundColor,
      line: getComputedStyle(el).borderBottomStyle,
    }));

  async function scrollOverContent(page: Page) {
    await scrollInSteps(page, 1200);
    if (isMobile(page)) await scrollInSteps(page, -240);
    await expect(header(page)).toHaveClass(/over-content/);
    await expectShown(page);
    // The bar shrinks and slides over 0.2 s: judge where it ends.
    await header(page).evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
  }

  /** Colours of an area of the screen, in reading order. */
  async function screenPixels(page: Page, clip: Clip) {
    return pixelColours(await decodeRgba(page, await page.screenshot({ clip })));
  }

  test('[S3] über dem Hero transparent, über dem Inhalt schmaler (76 statt 96 px), ohne Linie', async ({
    page,
  }) => {
    expect(await look(page)).toEqual({ height: 96, background: 'rgba(0, 0, 0, 0)', line: 'none' });
    await expect(header(page)).toHaveCSS('background-image', 'none');
    await scrollOverContent(page);
    expect(await look(page)).toEqual({ height: 76, background: 'rgba(0, 0, 0, 0)', line: 'none' });
  });

  test('[S3] Verlauf: oben fast deckend, zum unteren Rand durchsichtig, keine Kante', async ({
    page,
  }) => {
    await scrollOverContent(page);
    await page.addStyleTag({ content: whiteBehind });
    // A column through the bar and a little below it; grey, so one channel tells the brightness.
    const column = await screenPixels(page, { x: 1, y: 0, width: 1, height: 84 });
    const grey = column.map((colour) => Number(colour.match(/\d+/)![0]));
    // 92 % of #1c1c1c over white gives 46; the last row of the bar is almost white.
    expect(grey[0], 'oben fast die Seitenfarbe').toBeLessThan(56);
    expect(grey[75], 'am unteren Rand fast durchsichtig').toBeGreaterThan(245);
    // Brighter row by row, so no line and no edge; 2 steps leave room for the dithering.
    for (let y = 1; y < grey.length; y++) {
      expect(grey[y], `Zeile ${y} dunkler als die darüber`).toBeGreaterThanOrEqual(grey[y - 1] - 2);
    }
    expect(Math.min(...grey.slice(76)), 'unter dem Balken weiß').toBeGreaterThan(250);
  });

  // The bar is most transparent at the lower edge of the glyphs, so the contrast is read there.
  test('[S3 · WCAG 1.4.3] auch über weißem Inhalt halten Logo und Navigation 4,5:1', async ({
    page,
  }) => {
    await scrollOverContent(page);
    const links = [header(page).getByRole('link', { name: /^PK/ })];
    // On the phone the navigation lies in the menu, on its solid background.
    if (!isMobile(page)) {
      links.push(
        ...(await page
          .getByRole('navigation', { name: 'Hauptnavigation' })
          .getByRole('link')
          .all()),
      );
    }
    const texts = [];
    for (const link of links)
      texts.push({ ...(await inkBottom(link)), name: await link.innerText() });
    await page.addStyleTag({ content: whiteBehind });
    for (const { color, row, name } of texts) {
      const behind = await screenPixels(page, { ...row, height: 1 });
      const brightest = behind.reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
      expect(contrast(color, brightest), `${name} über ${brightest}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('[S3] Mobil: bei offenem Menü ist der Balken über dem Inhalt deckend', async ({ page }) => {
    test.skip(!isMobile(page), 'nur mobil');
    await scrollOverContent(page);
    await menuButton(page).click();
    await expect(header(page)).toHaveCSS('background-color', 'rgb(28, 28, 28)');
    await expect(header(page)).toHaveCSS('background-image', 'none');
  });
});

/**
 * Colour of a link and the lowest screen row its glyphs reach, where the bar behind them is
 * lightest. The text box reaches down to the descent of the font; the glyphs end at their own
 * descent, below the baseline only for letters such as "j" and "p".
 */
const inkBottom = (link: Locator) =>
  link.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = getComputedStyle(el).font;
    const metrics = context.measureText(el.textContent!.trim());
    const bottom = text.bottom - metrics.fontBoundingBoxDescent + metrics.actualBoundingBoxDescent;
    return {
      color: getComputedStyle(el).color,
      row: { x: Math.ceil(text.left), y: Math.ceil(bottom) - 1, width: Math.floor(text.width) },
    };
  });

// S1 (13.11.): the initials stood out too little; Fira Code at 28 px, no new logo (PK-41).
test.describe('Logo (S1)', () => {
  test('[S1] Initialen „PK“ im Kopf in Fira Code mit 28 px', async ({ page }) => {
    const logo = header(page).getByRole('link', { name: /^PK/ });
    await expect(logo).toHaveCSS('font-size', '28px');
    expect(await logo.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Fira Code/);
  });
});
