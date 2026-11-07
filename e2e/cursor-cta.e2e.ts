import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

// The ring at the pointer (spec 8.2). It only ever adds to the visible CTA.
declare global {
  interface Window {
    frameRequests: number;
  }
}

interface Point {
  x: number;
  y: number;
}

const desktopOnly = (testInfo: TestInfo) =>
  test.skip(testInfo.project.name !== 'desktop', 'Maus auf einer Breite genügt');

// The router drops the trailing slash of the static URL after hydration.
const detailPage = /\/projekte\/[a-z-]+\/?$/;
const ring = (page: Page) => page.locator('app-cursor-cta');
const projectCard = (page: Page) => page.locator('#projekte article.card').first();
const reportCard = (page: Page) => page.locator('#projekte article.card').last();

async function hoverCenter(page: Page, element: Locator): Promise<Point> {
  await element.scrollIntoViewIfNeeded();
  const box = await element.boundingBox();
  if (!box) throw new Error('element has no box');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  return point;
}

async function expectRingOn(page: Page, text: string): Promise<void> {
  await expect(ring(page)).toHaveText(text);
  await expect(ring(page)).toHaveCSS('opacity', '1');
}

const expectRingOff = (page: Page) => expect(ring(page)).toHaveCSS('opacity', '0');

// home.e2e.ts skips position: fixed, so the ring has to prove this for itself.
async function expectLabelFits(page: Page): Promise<void> {
  const label = await ring(page).evaluate(async (host) => {
    await document.fonts.ready;
    const circle = host.getBoundingClientRect();
    const center = { x: circle.x + circle.width / 2, y: circle.y + circle.height / 2 };
    const range = document.createRange();
    range.selectNodeContents(host);
    const reach = [...range.getClientRects()].flatMap((line) =>
      [line.left, line.right].flatMap((x) =>
        [line.top, line.bottom].map((y) => Math.hypot(x - center.x, y - center.y)),
      ),
    );
    return {
      fontSize: parseFloat(getComputedStyle(host).fontSize),
      reach: Math.max(...reach),
      radius: circle.width / 2,
    };
  });
  expect(label.fontSize).toBeGreaterThanOrEqual(14);
  expect(label.reach, 'der Text passt in den Kreis').toBeLessThan(label.radius);
}

async function scrollUnderPointer(page: Page, element: Locator, pointer: Point): Promise<void> {
  const box = await element.boundingBox();
  if (!box) throw new Error('element has no box');
  await page.mouse.wheel(0, box.y + box.height / 2 - pointer.y);
}

async function expectRingAt(page: Page, { x, y }: Point): Promise<void> {
  await expect(async () => {
    const box = await ring(page).boundingBox();
    expect(Math.abs(box!.x + box!.width / 2 - x)).toBeLessThan(2);
    expect(Math.abs(box!.y + box!.height / 2 - y)).toBeLessThan(2);
  }, 'der Ring sitzt am Zeiger').toPass({ timeout: 3000 });
}

// Only counts and still calls the original, so the page runs as usual.
const countFrames = (page: Page) =>
  page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    window.frameRequests = 0;
    window.requestAnimationFrame = (callback) => {
      window.frameRequests += 1;
      return request(callback);
    };
  });

const frameRequests = (page: Page) => page.evaluate(() => window.frameRequests);

async function expectFramesRunning(page: Page): Promise<void> {
  const before = await frameRequests(page);
  await expect.poll(() => frameRequests(page)).toBeGreaterThan(before + 5);
}

async function expectNoFrames(page: Page): Promise<void> {
  // Angular's scheduler may ask for one more frame right after the last state change.
  await page.waitForTimeout(200);
  const settled = await frameRequests(page);
  await page.waitForTimeout(300);
  expect(await frameRequests(page)).toBe(settled);
}

async function hoverProjectCard(page: Page): Promise<Point> {
  const point = await hoverCenter(page, projectCard(page).locator('h3'));
  await expectRingOn(page, 'Projekt ansehen');
  return point;
}

// Stays on the same element, so the browser reports a pointermove but no pointerover.
const moveWithinElement = (page: Page, { x, y }: Point) => page.mouse.move(x + 3, y + 1);

test.describe('mit Maus', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await countFrames(page);
    await page.goto('/');
  });

  test('[AK10] über der Karte erscheint der Ring und folgt dem Zeiger', async ({ page }) => {
    await expectRingAt(page, await hoverProjectCard(page));

    const next = await hoverCenter(page, projectCard(page).locator('.card-main > p'));
    await expectRingAt(page, next);
    await expectRingOn(page, 'Projekt ansehen');
    await expectLabelFits(page);
  });

  test('[AK10] Berichtskarte hat ihren eigenen Text', async ({ page }) => {
    await hoverCenter(page, reportCard(page).locator('h3'));
    await expectRingOn(page, 'Berichte ansehen');
    await expectLabelFits(page);
  });

  test('[AK10] über einem Link ist der Ring aus', async ({ page }) => {
    await hoverProjectCard(page);
    await hoverCenter(page, projectCard(page).locator('a[data-card-cta]'));
    await expectRingOff(page);
  });

  test('[AK10] außerhalb der Karten ist der Ring aus', async ({ page }) => {
    await hoverProjectCard(page);
    await hoverCenter(page, page.locator('#projekte h2'));
    await expectRingOff(page);
  });

  test('[AK10] ausgeblendet läuft keine Schleife mehr', async ({ page }) => {
    await hoverProjectCard(page);
    await expectFramesRunning(page);

    await hoverCenter(page, page.locator('#projekte h2'));
    await expectRingOff(page);
    await expectNoFrames(page);
  });

  test('[AK10] wird Bewegung abgeschaltet, ist der Ring aus und startet nicht neu', async ({
    page,
  }) => {
    await hoverProjectCard(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expectRingOff(page);
    await expectNoFrames(page);

    await hoverCenter(page, page.locator('#projekte h2'));
    await hoverCenter(page, reportCard(page).locator('h3'));
    await expect(ring(page)).not.toHaveClass(/is-on/);
    await expect(ring(page)).toHaveText('Projekt ansehen');
    await expectNoFrames(page);
  });

  test('[AK10] Reduced Motion an und aus: die nächste Bewegung über der Karte bringt den Ring', async ({
    page,
  }) => {
    const pointer = await hoverProjectCard(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expectRingOff(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await moveWithinElement(page, pointer);
    await expectRingOn(page, 'Projekt ansehen');
  });

  test('[AK10] Scrollen unter dem ruhenden Zeiger schaltet den Ring passend', async ({ page }) => {
    const pointer = await hoverProjectCard(page);

    await scrollUnderPointer(page, page.locator('#projekte h2'), pointer);
    await expectRingOff(page);
    await expectNoFrames(page);

    await scrollUnderPointer(page, reportCard(page).locator('h3'), pointer);
    await expectRingOn(page, 'Berichte ansehen');
  });

  test('[AK10] Browser-Zurück unter dem ruhenden Zeiger: Ring aus, dann wieder an', async ({
    page,
  }) => {
    const pointer = await hoverProjectCard(page);
    await page.mouse.click(pointer.x, pointer.y);
    await expect(page).toHaveURL(detailPage);

    await page.goBack();
    await expect(projectCard(page)).toBeVisible();
    await expectRingOff(page);
    await expectNoFrames(page);

    await hoverCenter(page, reportCard(page).locator('h3'));
    await expectRingOn(page, 'Berichte ansehen');
  });

  // Playwright's browser never restores from the back/forward cache, so only the event is real here.
  test('[AK10] beim Verlassen der Seite geht der Ring aus', async ({ page }) => {
    await hoverProjectCard(page);
    await page.evaluate(() =>
      dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    );
    await expectRingOff(page);
    await expectNoFrames(page);
  });

  test('[AK10] nach pagehide: die nächste Bewegung über der Karte bringt den Ring', async ({
    page,
  }) => {
    const pointer = await hoverProjectCard(page);
    await page.evaluate(() =>
      dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    );
    await expectRingOff(page);

    await moveWithinElement(page, pointer);
    await expectRingOn(page, 'Projekt ansehen');
  });

  test('[AK10] verlässt der Zeiger das Fenster, ist der Ring aus', async ({ page }) => {
    await hoverProjectCard(page);
    await page.mouse.move(-5, -5);
    await expectRingOff(page);
  });

  test('[AK10] Berührung auf einem Gerät mit Maus bringt keinen Ring', async ({ page }) => {
    const title = projectCard(page).locator('h3');
    await title.dispatchEvent('pointerover', { bubbles: true, pointerType: 'touch' });
    await expect(ring(page)).toHaveText('');
    await expectRingOff(page);
  });

  test('[AK10] Klick durch den Ring öffnet die Detailseite', async ({ page }) => {
    const { x, y } = await hoverProjectCard(page);
    await expect(ring(page)).toHaveCSS('pointer-events', 'none');

    await page.mouse.click(x, y);
    await expect(page).toHaveURL(detailPage);
  });

  test('[AK10] aria-hidden, kein Tab-Stopp', async ({ page }) => {
    await hoverProjectCard(page);

    await expect(ring(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(ring(page)).not.toHaveAttribute('tabindex');
    await expect(ring(page).locator('a, button, [tabindex]')).toHaveCount(0);
  });

  test('[AK10] Tastatur braucht den Ring nicht', async ({ page }) => {
    const cta = projectCard(page).locator('a[data-card-cta]');
    for (let tabs = 0; tabs < 40; tabs++) {
      await page.keyboard.press('Tab');
      if (await cta.evaluate((link) => link === document.activeElement)) break;
    }
    await expect(cta).toBeFocused();
    await expectRingOff(page);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(detailPage);
    await expectRingOff(page);
  });
});

test('[AK10] Reduced Motion: kein Ring', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await hoverCenter(page, projectCard(page).locator('h3'));
  await expect(ring(page)).toHaveCount(1);
  await expect(ring(page)).toHaveText('');
  await expect(ring(page)).toBeHidden();
});

test('[AK10] Touch: kein Ring, CTA sichtbar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Nur das Gerät mit Touch');
  await page.goto('/');

  await expect(ring(page)).toHaveCount(1);
  await expect(ring(page)).toBeHidden();
  await expect(projectCard(page).locator('a[data-card-cta]')).toBeVisible();
});

// The dot that replaces the normal pointer (PK-36). Only an addition: without it the pointer stays.
const dot = (page: Page) => page.locator('app-cursor-dot');
const heading = (page: Page) => page.locator('#projekte h2');

const expectDotOn = (page: Page) => expect(dot(page)).toHaveCSS('opacity', '1');
const expectDotOff = (page: Page) => expect(dot(page)).toHaveCSS('opacity', '0');
const expectNormalPointer = (page: Page) =>
  expect(page.locator('html')).not.toHaveClass(/has-custom-cursor/);

const expectDotSize = async (page: Page, size: string) => {
  await expect(dot(page)).toHaveCSS('width', size);
  await expect(dot(page)).toHaveCSS('height', size);
};

const accentColor = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--color-accent)';
    document.body.append(probe);
    const { color } = getComputedStyle(probe);
    probe.remove();
    return color;
  });

/** Everything on this page that would still show a pointer of the browser. */
const elementsWithPointer = (page: Page) =>
  page.evaluate(() => {
    const shows = (element: Element, pseudo?: string) =>
      getComputedStyle(element, pseudo).cursor !== 'none';
    return [...document.querySelectorAll('html, body, body *')]
      .filter((element) => !element.matches('input, textarea'))
      .filter((el) => shows(el) || shows(el, '::before') || shows(el, '::after'))
      .map((el) => el.tagName + (typeof el.className === 'string' ? `.${el.className}` : ''));
  });

const addFields = (page: Page) =>
  heading(page).evaluate((title) => {
    title.insertAdjacentHTML('afterend', '<input aria-label="Feld"><textarea aria-label="Text">');
  });

test.describe('eigener Zeiger', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto('/');
  });

  test('[PK-36] der Punkt folgt dem Zeiger ohne Verzögerung', async ({ page }) => {
    await expectNormalPointer(page);

    const first = await hoverCenter(page, heading(page));
    await expectDotOn(page);
    await expectDotSize(page, '10px');
    await expect(dot(page)).toHaveCSS('background-color', await accentColor(page));
    await expect(dot(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(dot(page)).toHaveCSS('pointer-events', 'none');

    // Read right after the move, without polling: there is no frame and no easing in between.
    const [x, y] = [Math.round(first.x) + 40, Math.round(first.y) + 5];
    await page.mouse.move(x, y);
    expect(await dot(page).evaluate((el) => el.style.translate)).toBe(`${x}px ${y}px`);
    const box = await dot(page).boundingBox();
    expect(box!.x + box!.width / 2).toBeCloseTo(x);
    expect(box!.y + box!.height / 2).toBeCloseTo(y);
  });

  test('[PK-36] sobald der Ring an ist, ist der Punkt weg', async ({ page }) => {
    await hoverCenter(page, heading(page));
    await expectDotOn(page);

    await hoverProjectCard(page);
    await expectDotOff(page);

    await hoverCenter(page, heading(page));
    await expectDotOn(page);
    await expectRingOff(page);
  });

  test('[PK-36] über einem Link wird der Punkt zum Kreis', async ({ page }) => {
    await hoverCenter(page, projectCard(page).locator('a[data-card-cta]'));
    await expectDotOn(page);
    await expectDotSize(page, '20px');
    await expect(dot(page)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(dot(page)).toHaveCSS('border-top-width', '2px');
    await expect(dot(page)).toHaveCSS('border-top-color', await accentColor(page));
    // Centred on the pointer also while it is larger.
    await expect(dot(page)).toHaveCSS('margin-left', '-10px');

    await hoverCenter(page, heading(page));
    await expectDotSize(page, '10px');
  });

  test('[PK-36] über einem Knopf wird der Punkt zum Kreis', async ({ page }) => {
    await hoverCenter(page, page.locator('.band-pause'));
    await expectDotOn(page);
    await expectDotSize(page, '20px');
  });

  test('[PK-36] über Eingabefeldern bleibt der normale Zeiger', async ({ page }) => {
    await addFields(page);

    for (const field of ['#projekte input', '#projekte textarea']) {
      await hoverCenter(page, heading(page));
      await expectDotOn(page);
      await hoverCenter(page, page.locator(field));
      await expectDotOff(page);
      await expect(page.locator(field)).toHaveCSS('cursor', 'auto');
    }
  });

  test('[PK-36] auf der Startseite zeigt nichts mehr den Standardzeiger', async ({ page }) => {
    await hoverCenter(page, heading(page));
    await expect.poll(() => elementsWithPointer(page)).toEqual([]);
    await expect(projectCard(page)).toHaveCSS('cursor', 'none');
  });

  test('[PK-36] auf einer Detailseite zeigt nichts mehr den Standardzeiger', async ({ page }) => {
    await page.goto('/projekte/videoflix/');
    await page.mouse.move(300, 300);
    await expect.poll(() => elementsWithPointer(page)).toEqual([]);
  });

  test('[PK-36] im Header-Menü zeigt nichts mehr den Standardzeiger', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 800 });
    const menu = page.locator('app-header .menu-button');
    await hoverCenter(page, menu);
    await expect(menu).toHaveCSS('cursor', 'none');
    await page.mouse.down();
    await page.mouse.up();
    await hoverCenter(page, page.locator('#main-nav a').first());
    await expectDotSize(page, '20px');
    await expect.poll(() => elementsWithPointer(page)).toEqual([]);
  });

  test('[PK-36] außerhalb des Fensters ist der Punkt aus, danach wieder da', async ({ page }) => {
    await hoverCenter(page, heading(page));
    await expectDotOn(page);

    await page.mouse.move(-5, -5);
    await expectDotOff(page);
    await expectNormalPointer(page);

    await hoverCenter(page, heading(page));
    await expectDotOn(page);
  });

  test('[PK-36] beim Verlassen der Seite ist der Punkt aus', async ({ page }) => {
    await hoverCenter(page, heading(page));
    await page.evaluate(() =>
      dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    );
    await expectDotOff(page);
    await expectNormalPointer(page);
  });

  test('[PK-36] wird Bewegung abgeschaltet, kommt der normale Zeiger zurück', async ({ page }) => {
    await hoverCenter(page, heading(page));
    await expectDotOn(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expectNormalPointer(page);
    await expect(dot(page)).toBeHidden();

    await page.mouse.move(400, 400);
    await expectNormalPointer(page);
  });

  test('[PK-36] Berührung auf einem Gerät mit Maus bringt keinen Punkt', async ({ page }) => {
    await heading(page).dispatchEvent('pointermove', { bubbles: true, pointerType: 'touch' });
    await expectDotOff(page);
    await expectNormalPointer(page);
  });

  test('[PK-36] der Punkt am Fensterrand erzeugt keinen Überlauf', async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width - 1, height - 1);
    await expectDotOn(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

for (const [name, media] of [
  ['Reduced Motion', { reducedMotion: 'reduce' }],
  ['Forced Colors', { forcedColors: 'active' }],
] as const) {
  test(`[PK-36] ${name}: normaler Zeiger, kein Punkt`, async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await page.emulateMedia(media);
    await page.goto('/');

    await hoverCenter(page, heading(page));
    await expect(dot(page)).toHaveCount(1);
    await expect(dot(page)).toBeHidden();
    await expectNormalPointer(page);
    await expect(projectCard(page)).toHaveCSS('cursor', 'pointer');
  });
}

test('[PK-36] Touch: normaler Zeiger, kein Punkt', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Nur das Gerät mit Touch');
  await page.goto('/');

  await page.touchscreen.tap(195, 300);
  await expect(dot(page)).toHaveCount(1);
  await expect(dot(page)).toBeHidden();
  await expectNormalPointer(page);
});

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('[PK-36] normaler Zeiger, kein Punkt', async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto('/');

    await hoverCenter(page, projectCard(page).locator('h3'));
    await expectDotOff(page);
    await expect(projectCard(page)).toHaveCSS('cursor', 'pointer');
  });
});
