import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { pages } from './support/site';

// Responsive pass over cards, project rows, steps and footer (spec 11, 16.1, AK15). Runs in every project; on the
// phone it also checks 320 px, the narrowest width a page has to reflow to (WCAG 1.4.10).
const fixtureText = readFileSync('e2e/fixtures/status.json', 'utf8');
const projectPages = pages.filter((path) => path.startsWith('/projekte/'));
const narrowest = 320;
const boxes = '.card, .row, .panel, .block, .part, footer .footer';

/** Real snapshot with a fresh time, so every step shows its longest real label. */
async function serveStatus(page: Page): Promise<void> {
  const document = JSON.parse(fixtureText) as { generatedAt: string };
  document.generatedAt = new Date().toISOString();
  await page.route('**/status.json', (route) => route.fulfill({ json: document }));
}

async function open(page: Page, path: string): Promise<void> {
  await serveStatus(page);
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  // After hydration the chain shows one field, so its links stay where they were measured.
  await page.waitForFunction(() => !document.querySelector('app-delivery-chain .tab:not([role])'));
}

/** The project width, and on the phone the narrowest width as well. */
function widths(page: Page): number[] {
  const width = page.viewportSize()!.width;
  return width < 768 ? [width, narrowest] : [width];
}

async function atEachWidth(page: Page, check: (width: number) => Promise<void>): Promise<void> {
  const { height } = page.viewportSize()!;
  for (const width of widths(page)) {
    await page.setViewportSize({ width, height });
    await check(width);
  }
}

/** Elements that leave the content box of their nearest card, row or panel, or clip their text. */
function outsideTheirBox(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((boxSelector) => {
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
    const offenders: string[] = [];
    for (const el of document.querySelectorAll(`:is(${boxSelector}) *`)) {
      const box = el.parentElement!.closest(boxSelector)!;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const frame = box.getBoundingClientRect();
      const style = getComputedStyle(box);
      // Clipped on purpose: the tech line ends in an ellipsis, the CTA text is for screen readers.
      const { textOverflow, clipPath } = getComputedStyle(el);
      const intended = textOverflow === 'ellipsis' || clipPath !== 'none';
      const right =
        frame.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
      const left = frame.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
      const clips = !intended && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1;
      if (rect.right > right + 1 || rect.left < left - 1 || clips) offenders.push(name(el));
    }
    return offenders;
  }, selector);
}

test.describe('Responsive', () => {
  for (const path of ['/', ...projectPages]) {
    test(`[AK15] kein horizontaler Überlauf bei langen Bezeichnungen: ${path}`, async ({
      page,
    }) => {
      await open(page, path);
      await atEachWidth(page, async (width) => {
        const offenders = await outsideTheirBox(page, boxes);
        expect(offenders, `bei ${width} px`).toEqual([]);
        const scrolls = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(scrolls, `bei ${width} px breiter als der Viewport`).toBe(false);
      });
    });

    test(`[AK15] alle Links in Zeilen und Schritten ab 44 px: ${path}`, async ({ page }) => {
      await open(page, path);
      const links = page.locator(
        '#projekte a.row, app-delivery-chain .panel:not([hidden]) a, .project .back, .project .links a',
      );
      expect(await links.count()).toBeGreaterThan(0);
      await atEachWidth(page, async (width) => {
        for (const link of await links.all()) {
          const box = (await link.boundingBox())!;
          const label = `${await link.innerText()} bei ${width} px`;
          expect(box.height, label).toBeGreaterThanOrEqual(44);
          expect(box.width, label).toBeGreaterThanOrEqual(44);
        }
      });
    });
  }

  // Only the project pages show steps; the start page shows one status per row.
  for (const path of projectPages) {
    test(`[AK15] Schrittzustand bleibt in einer Zeile oder bricht sauber um: ${path}`, async ({
      page,
    }) => {
      await open(page, path);
      // On a project page the value of a station carries its state, the kit has one private line.
      const states = page.locator('.tab .value, app-delivery-chain .private');
      expect(await states.count()).toBeGreaterThan(0);
      await atEachWidth(page, async (width) => {
        const offenders = await outsideTheirBox(page, '.tab');
        const stateOffenders = offenders.filter((entry) => /\.value\b|^svg/.test(entry));
        expect(stateOffenders, `bei ${width} px`).toEqual([]);
      });
    });
  }

  test('[AK15] Footer-Zeile bleibt lesbar', async ({ page }) => {
    await open(page, '/');
    const line = page.locator('footer .built');
    await atEachWidth(page, async (width) => {
      expect(await outsideTheirBox(page, 'footer .footer'), `bei ${width} px`).toEqual([]);
      const size = await line.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size, 'no smaller than 14 px').toBeGreaterThanOrEqual(14);
      for (const link of await line.locator('a').all()) {
        const box = (await link.boundingBox())!;
        expect(box.height, `${await link.innerText()} bei ${width} px`).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test('[Spec 11] Header-Logo ist ein Touch-Ziel ab 44 px', async ({ page }) => {
    await open(page, '/');
    const logo = page.locator('header .logo');
    await atEachWidth(page, async (width) => {
      const box = (await logo.boundingBox())!;
      expect(box.height, `Logo bei ${width} px`).toBeGreaterThanOrEqual(44);
      expect(box.width, `Logo bei ${width} px`).toBeGreaterThanOrEqual(44);
    });
  });

  test('[Spec 11] Footer-Links sind Touch-Ziele ab 44 px, © bricht nicht um', async ({ page }) => {
    await open(page, '/');
    const copyright = page.locator('footer .copyright');
    await atEachWidth(page, async (width) => {
      for (const link of await page.locator('footer a').all()) {
        const box = (await link.boundingBox())!;
        const label = `${await link.innerText()} bei ${width} px`;
        expect(box.height, label).toBeGreaterThanOrEqual(44);
        expect(box.width, label).toBeGreaterThanOrEqual(44);
      }
      const lines = await copyright.evaluate((el) => {
        const { height } = el.getBoundingClientRect();
        return Math.round(height / parseFloat(getComputedStyle(el).lineHeight));
      });
      expect(lines, `© in einer Zeile bei ${width} px`).toBe(1);
    });
  });
});
