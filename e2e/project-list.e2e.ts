import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

declare global {
  interface Window {
    layoutShift: number;
  }
}

/** Not in the DOM types of TypeScript yet. */
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

// The project list on the start page (spec 16.1, 16.2). Status data comes from a real snapshot
// of status.json through page.route, with a time and changes set per test.
const fixtureText = readFileSync('e2e/fixtures/status.json', 'utf8');
// The file the server keeps after the deploy until status.yml runs again: conduit, no VPS.
const beforeVpsText = readFileSync('e2e/fixtures/status-before-vps.json', 'utf8');

interface Workflow {
  conclusion: string;
}
interface ProjectEntry {
  checks: { signals: { workflows: Workflow[] } };
}
interface StatusFile {
  schemaVersion: number;
  generatedAt: string;
  projects: Record<string, ProjectEntry>;
}
type Change = (document: StatusFile) => void;

const reportBase = 'https://philippklinger.github.io/my-dso-blog/docs/projects/';
const failedNotice = 'Der aktuelle Stand ist gerade nicht abrufbar.';
const staleNotice = 'Dieser Stand ist älter als einen Tag.';
const titles = [
  'Videoflix',
  'Neuro Check-in',
  'VPS-Plattform',
  'Buildorder',
  'Security, Linux und Container',
];
const hrefs = [
  '/projekte/videoflix/',
  '/projekte/neuro-check-in/',
  '/projekte/vps-plattform/',
  '/projekte/buildorder/',
  reportBase,
];

function statusFile(change: Change = () => undefined): StatusFile {
  const document = JSON.parse(fixtureText) as StatusFile;
  document.generatedAt = new Date().toISOString();
  change(document);
  return document;
}

/** Answers /status.json and returns the requests it saw. */
async function serveStatus(page: Page, document: StatusFile = statusFile()): Promise<string[]> {
  const requests: string[] = [];
  await page.route('**/status.json', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ json: document });
  });
  return requests;
}

function failChecks(document: StatusFile): void {
  document.projects['videoflix'].checks.signals.workflows[0].conclusion = 'failure';
}

/** Keeps the fresh time, so only the projects are those of the old collector. */
function beforeVps(document: StatusFile): void {
  document.projects = (JSON.parse(beforeVpsText) as StatusFile).projects;
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

/**
 * Hands a Videoflix snapshot over as the prerender would. A local build has no status-snapshot.json,
 * so the transfer state of the page is filled here, the service in the browser runs unchanged.
 */
async function handOverSnapshot(page: Page, document: StatusFile): Promise<void> {
  const snapshot = { generatedAt: document.generatedAt, status: document.projects['videoflix'] };
  const anchor = '{"__nghData__"';
  await page.route('/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    expect(html, 'transfer state not found').toContain(anchor);
    const headers = { ...response.headers() };
    delete headers['content-encoding'];
    delete headers['content-length'];
    const filled = `{"status-snapshot-videoflix":${JSON.stringify(snapshot)},"__nghData__"`;
    await route.fulfill({ response, headers, body: html.replace(anchor, filled) });
  });
}

const items = (page: Page) => page.locator('#projekte .rows > li');
const links = (page: Page) => page.locator('#projekte a.row');
const row = (page: Page, title: string) =>
  links(page).filter({ has: page.locator('h3', { hasText: new RegExp(`^${title}$`) }) });
const signal = (page: Page, title: string) => row(page, title).locator('.signal .state');
const notice = (page: Page) => page.locator('#projekte .notice');

const onlyIn = (testInfo: TestInfo, project: string) =>
  test.skip(testInfo.project.name !== project, `nur ${project}`);

async function openList(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
}

/** Tab from the start of the section, so the first press lands on the first row. */
async function tabIntoList(page: Page): Promise<void> {
  await page.locator('#projekte').focus();
  await page.keyboard.press('Tab');
}

/** Height of short line and tech line per row, in lines of their own line height. */
const lineCounts = (page: Page) =>
  links(page).evaluateAll((rows) =>
    rows.map((link) => {
      const lines = (selector: string) => {
        const element = link.querySelector(selector)!;
        const { lineHeight } = getComputedStyle(element);
        return element.getBoundingClientRect().height / parseFloat(lineHeight);
      };
      return { text: lines('.text'), tech: lines('.tech') };
    }),
  );

async function expectLineLimits(page: Page): Promise<void> {
  for (const { text, tech } of await lineCounts(page)) {
    expect(text, 'Kurzzeile').toBeLessThanOrEqual(2.05);
    expect(tech, 'Technik').toBeLessThanOrEqual(1.05);
  }
}

test.describe('Liste', () => {
  test('[L1] fünf gleich gebaute Zeilen in fester Reihenfolge, alle gleich hoch', async ({
    page,
  }) => {
    await openList(page);
    await expect(items(page).locator('h3')).toHaveText(titles);
    for (const link of await links(page).all()) {
      for (const part of ['.signal .state', 'h3', '.text', '.tech', '.cta']) {
        await expect(link.locator(part), part).toHaveCount(1);
      }
    }
    const heights = await links(page).evaluateAll((rows) =>
      rows.map((link) => link.getBoundingClientRect().height),
    );
    expect(heights).toHaveLength(5);
    expect(Math.max(...heights) - Math.min(...heights), heights.join(', ')).toBeLessThanOrEqual(1);
  });

  test('[L2] jede Zeile ist genau ein Link ab 44 px, ohne Link darin', async ({ page }) => {
    await page.goto('/');
    await expect(items(page)).toHaveCount(5);
    for (const item of await items(page).all()) {
      await expect(item.locator('a')).toHaveCount(1);
    }
    await expect(page.locator('#projekte a a')).toHaveCount(0);
    for (const link of await links(page).all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('[L2] Tab erreicht jede Zeile in Lesereihenfolge, mit sichtbarem Fokus', async ({
    page,
  }) => {
    await page.goto('/');
    await tabIntoList(page);
    const reached: { href: string | null; outline: boolean }[] = [];
    for (let press = 0; press < hrefs.length; press++) {
      if (press > 0) await page.keyboard.press('Tab');
      reached.push(
        await page.evaluate(() => {
          const active = document.activeElement!;
          const { outlineStyle, outlineWidth } = getComputedStyle(active);
          const outline = outlineStyle !== 'none' && parseFloat(outlineWidth) >= 2;
          return { href: active.getAttribute('href'), outline };
        }),
      );
    }
    expect(reached).toEqual(hrefs.map((href) => ({ href, outline: true })));
  });

  test('[L4] Maus: nur der Pfeil, der Text bleibt für Screenreader und kommt bei Fokus', async ({
    page,
  }, testInfo) => {
    onlyIn(testInfo, 'desktop');
    await page.goto('/');
    const first = links(page).first();
    const text = first.locator('.cta-text');
    expect((await text.boundingBox())!.width).toBeLessThanOrEqual(1);
    await expect(first.locator('.arrow')).toBeVisible();
    const list = page.locator('#projekte');
    await expect(list.getByRole('link', { name: /Details ansehen/ })).toHaveCount(4);
    await expect(list.getByRole('link', { name: /Alle Berichte ansehen/ })).toHaveCount(1);

    await tabIntoList(page);
    await expect(first).toBeFocused();
    await expect.poll(async () => (await text.boundingBox())!.width).toBeGreaterThan(1);
  });

  test('[L4] Touch: Pfeil mit Text', async ({ page }, testInfo) => {
    onlyIn(testInfo, 'mobile');
    await page.goto('/');
    for (const link of await links(page).all()) {
      const text = link.locator('.cta-text');
      await expect(text).toBeVisible();
      expect((await text.boundingBox())!.width).toBeGreaterThan(1);
    }
    await expect(links(page).first().locator('.cta')).toHaveText(/Details ansehen\s*→/);
    await expect(links(page).last().locator('.cta')).toHaveText(/Alle Berichte ansehen\s*↗/);
  });

  test('[L6] Kurzzeile höchstens zwei Zeilen, Technik eine Zeile', async ({ page }, testInfo) => {
    await openList(page);
    await expectLineLimits(page);
    if (testInfo.project.name !== 'mobile') return;

    await page.setViewportSize({ width: 320, height: 844 });
    await expectLineLimits(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'bei 320 px breiter als der Viewport').toBeLessThanOrEqual(0);
  });

  test('[L9] mobil höchstens zwei Bildschirme', async ({ page }, testInfo) => {
    onlyIn(testInfo, 'mobile');
    await openList(page);
    const { height } = (await page.locator('#projekte').boundingBox())!;
    expect(height).toBeLessThanOrEqual(2 * 844);
  });

  test('[L3] Statuszeile folgt den Daten, Berichte zählen ihre Liste', async ({ page }) => {
    await serveStatus(page);
    await page.goto('/');
    await expect(signal(page, 'Videoflix')).toHaveText('CI grün');
    await expect(row(page, 'Videoflix').locator('.signal-when')).toHaveText('zuletzt 05.11.');
    await expect(signal(page, 'VPS-Plattform')).toHaveText('CI grün');
    await expect(row(page, 'VPS-Plattform').locator('.signal-when')).toHaveText('zuletzt 10.11.');
    await expect(signal(page, 'Neuro Check-in')).toHaveText('Website erreichbar');
    await expect(row(page, 'Neuro Check-in').locator('.signal-when')).toHaveText('100 % (24 h)');
    await expect(signal(page, 'Buildorder')).toHaveText('CI grün');
    await expect(row(page, 'Buildorder').locator('.signal-when')).toHaveText('zuletzt 10.11.');
    await expect(signal(page, 'Security, Linux und Container')).toHaveText('4 Berichte');
  });

  test('[Spec 11] Browser-Zurück stellt die Scroll-Position der Startseite wieder her', async ({
    page,
  }) => {
    await openList(page);
    const target = row(page, 'Videoflix');
    await target.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before, 'the row must sit below the top').toBeGreaterThan(0);

    await target.click();
    await expect(page).toHaveURL(/\/projekte\/videoflix\/?$/);
    await page.goBack();

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect
      .poll(() => page.evaluate((y) => Math.abs(window.scrollY - y), before))
      .toBeLessThan(3);
    await expect(target).toBeInViewport();
  });
});

// The one preview image of the list (spec 16.1, L5, L10). On wide rows with a mouse it follows the
// pointer beside the ring; on keyboard focus and with reduced motion it stands in the row; touch
// and stacked rows (below 960 px, deviation from 768 px, see the row layout) show a small image.
test.describe('Vorschaubild', () => {
  interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  const preview = (page: Page) => page.locator('#projekte app-row-preview');
  const boxOf = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!;
  const overlaps = (a: Box, b: Box) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const twoFrames = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );

  // The listeners come with the app, the prerendered list alone does not answer the pointer yet.
  async function openHydrated(page: Page): Promise<void> {
    await openList(page);
    await expect(page.locator('[ngh]')).toHaveCount(0);
  }

  async function expectInRow(image: Box, link: Locator): Promise<void> {
    const rowBox = await boxOf(link);
    expect(image.x).toBeGreaterThanOrEqual(rowBox.x);
    expect(image.x + image.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
    const center = (box: Box) => box.y + box.height / 2;
    expect(Math.abs(center(image) - center(rowBox))).toBeLessThan(1);
    expect(overlaps(image, await boxOf(link.locator('h3'))), 'verdeckt den Titel').toBe(false);
  }

  test('[L5] Maus: Bild neben dem Zeiger, nie über dem Titel, am rechten Rand links davon', async ({
    page,
  }, testInfo) => {
    onlyIn(testInfo, 'desktop');
    await openHydrated(page);
    await expect(page.locator('#projekte .thumb').first()).toBeHidden();
    const videoflix = row(page, 'Videoflix');
    await videoflix.scrollIntoViewIfNeeded();
    const rowBox = await boxOf(videoflix);
    const title = await boxOf(videoflix.locator('h3'));
    const y = rowBox.y + rowBox.height / 2;
    for (const x of [title.x + 10, rowBox.x + rowBox.width / 2]) {
      await page.mouse.move(x, y);
      await expect(preview(page)).toHaveCSS('opacity', '1');
      expect(overlaps(await boxOf(preview(page)), title), `Zeiger bei ${x}`).toBe(false);
    }
    await expect(preview(page).locator('img')).toHaveAttribute('src', /videoflix/);

    const nearEdge = rowBox.x + rowBox.width - 20;
    await page.mouse.move(nearEdge, y);
    await expect
      .poll(async () => {
        const image = await boxOf(preview(page));
        return image.x + image.width <= nearEdge && !overlaps(image, title);
      }, 'links vom Zeiger')
      .toBe(true);
  });

  test('[L5] Tastatur: Bild fest in der Zeile', async ({ page }, testInfo) => {
    onlyIn(testInfo, 'desktop');
    await openHydrated(page);
    await tabIntoList(page);
    const first = links(page).first();
    await expect(first).toBeFocused();
    await expect(preview(page)).toHaveCSS('opacity', '1');
    await expectInRow(await boxOf(preview(page)), first);
  });

  test('[L5] Reduced Motion: Bild steht fest, die Maus bewegt es nicht', async ({
    page,
  }, testInfo) => {
    onlyIn(testInfo, 'desktop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      window.layoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as LayoutShift[]) {
          if (!entry.hadRecentInput) window.layoutShift += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await openHydrated(page);
    const neuro = row(page, 'Neuro Check-in');
    await neuro.scrollIntoViewIfNeeded();
    const rowBox = await boxOf(neuro);
    const y = rowBox.y + rowBox.height / 2;
    await page.mouse.move(rowBox.x + rowBox.width * 0.3, y);
    await expect(preview(page)).toHaveCSS('opacity', '1');
    const before = await boxOf(preview(page));
    await expectInRow(before, neuro);
    for (const [share, shift] of [
      [0.6, 10],
      [0.45, -10],
    ]) {
      await page.mouse.move(rowBox.x + rowBox.width * share, y + shift);
      await twoFrames(page);
      expect(await boxOf(preview(page))).toEqual(before);
    }
    // Moving on to other rows re-anchors the image; mouse movement is no input that excuses a shift.
    for (const other of [links(page).nth(0), links(page).nth(1), neuro]) {
      const box = await boxOf(other);
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
      await twoFrames(page);
    }
    expect(await page.evaluate(() => window.layoutShift)).toBeLessThan(0.01);
  });

  test('[L5] Touch und gestapelte Zeilen: kleines Bild links in jeder Zeile', async ({
    page,
  }, testInfo) => {
    test.skip(!['mobile', 'tablet'].includes(testInfo.project.name), 'nur gestapelte Zeilen');
    await openList(page);
    for (const link of await links(page).all()) {
      const thumb = link.locator('.thumb');
      await expect(thumb).toBeVisible();
      const image = await boxOf(thumb);
      expect(image.x + image.width).toBeLessThanOrEqual((await boxOf(link.locator('h3'))).x);
    }
    await expect(preview(page)).toBeHidden();
  });

  test('[L10] Bilder mit festen Maßen, kein Layout-Sprung beim Laden und beim Hover', async ({
    page,
  }, testInfo) => {
    test.skip(!['mobile', 'desktop'].includes(testInfo.project.name), 'Touch und Maus genügen');
    await page.addInitScript(() => {
      window.layoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as LayoutShift[]) {
          if (!entry.hadRecentInput) window.layoutShift += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await openHydrated(page);
    for (const link of await links(page).all()) await link.hover();
    // Ends on a row with an image, so the large one is loaded on the desktop as well.
    await links(page).first().hover();
    const images = page.locator('#projekte img:visible');
    await expect.poll(() => images.count()).toBeGreaterThan(0);
    for (const image of await images.all()) {
      await expect(image).toHaveAttribute('width', /^\d+$/);
      await expect(image).toHaveAttribute('height', /^\d+$/);
    }
    await expect
      .poll(() =>
        images.evaluateAll((all) => all.every((image) => (image as HTMLImageElement).complete)),
      )
      .toBe(true);
    await twoFrames(page);
    expect(await page.evaluate(() => window.layoutShift)).toBeLessThan(0.01);
  });
});

test.describe('Status im Browser', () => {
  test('[Spec 6.1] Startseite fragt status.json genau einmal', async ({ page }) => {
    const requests = await serveStatus(page);
    await page.goto('/');
    await expect(signal(page, 'VPS-Plattform')).toHaveText('CI grün');
    await page.waitForLoadState('networkidle');
    expect(requests).toHaveLength(1);
  });

  test('[Spec 6.1] der Stand kommt von der eigenen Domain', async ({ page, baseURL }) => {
    const requests = await serveStatus(page);
    await page.goto('/');
    await expect.poll(() => requests).toEqual([`${baseURL}/status.json`]);
  });

  test('[Spec 6.1] der erfolgreiche Abruf erreicht die Zeilen', async ({ page }) => {
    await serveStatus(page, statusFile(failChecks));
    await page.goto('/');
    await expect(signal(page, 'Videoflix')).toHaveText('Prüfung rot');
    await expect(row(page, 'Videoflix').locator('.signal .state-deviation')).toBeVisible();
    await expect(signal(page, 'VPS-Plattform')).toHaveText('CI grün');
    await expect(notice(page)).toBeEmpty();
  });

  test('[Spec 6.1] der neuere Stand aus status.json gewinnt gegen den vorgerenderten', async ({
    page,
  }) => {
    await handOverSnapshot(
      page,
      statusFile((document) => {
        document.generatedAt = hoursAgo(2);
        failChecks(document);
      }),
    );
    await serveStatus(page);
    await page.goto('/');
    await expect(signal(page, 'Videoflix')).toHaveText('CI grün');
  });

  test('[Spec 6.1] ein älterer Stand aus status.json verdrängt den vorgerenderten nicht', async ({
    page,
  }) => {
    const requests = await serveStatus(
      page,
      statusFile((document) => {
        document.generatedAt = hoursAgo(2);
        failChecks(document);
      }),
    );
    await handOverSnapshot(page, statusFile());
    await page.goto('/');
    await expect.poll(() => requests).toHaveLength(1);
    await page.waitForLoadState('networkidle');
    await expect(signal(page, 'Videoflix')).toHaveText('CI grün');
  });

  // Rollout: until the next status.yml run the server serves the file of the old collector.
  test('[L8] alter Stand mit conduit, ohne vps-plattform: Liste vollständig', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await serveStatus(page, statusFile(beforeVps));
    await page.goto('/');
    await expect(signal(page, 'Videoflix')).toHaveText('CI grün');
    await expect(signal(page, 'Neuro Check-in')).toHaveText('Stand nicht abrufbar');
    await expect(signal(page, 'Buildorder')).toHaveText('Stand nicht abrufbar');
    await expect(signal(page, 'VPS-Plattform')).toHaveText('Stand nicht abrufbar');
    await expect(row(page, 'VPS-Plattform').locator('.signal-when')).toHaveCount(0);
    await expect(notice(page)).toHaveText(failedNotice);
    await expect(links(page)).toHaveCount(5);
    await expect(page.locator('#projekte')).not.toContainText(/conduit/i);
    expect(errors).toEqual([]);
  });

  for (const [name, respond] of [
    ['Serverfehler', { status: 500, body: 'error' }],
    ['abgeschnittene Datei', { status: 200, body: '{"schemaVersion":1,"genera' }],
    ['HTML statt JSON', { status: 200, contentType: 'text/html', body: '<!doctype html>' }],
    ['fremdes Schema', { status: 200, json: { schemaVersion: 99 } }],
  ] as const) {
    test(`[L8] kaputter Status (${name}): Liste vollständig, freundlicher Hinweis`, async ({
      page,
    }) => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await page.route('**/status.json', (route) => route.fulfill(respond));
      await page.goto('/');
      await expect(notice(page)).toHaveText(failedNotice);
      await expect(page.locator('#projekte [role="status"]')).toHaveCount(1);
      await expect(links(page)).toHaveCount(5);
      await expect(items(page).locator('h3')).toHaveText(titles);
      await expect(signal(page, 'Videoflix')).toHaveText('Stand nicht abrufbar');
      await expect(signal(page, 'Neuro Check-in')).toHaveText('Stand nicht abrufbar');
      await expect(page.locator('#projekte')).not.toContainText(/undefined|null|NaN|Error/);
      expect(errors).toEqual([]);
    });
  }

  test('[WCAG 4.1.3] Statuszeile steht vor dem Abruf im Accessibility-Baum, danach mit Text', async ({
    page,
  }) => {
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/status.json', async (route) => {
      await released;
      await route.fulfill({ status: 500, body: 'error' });
    });
    const requested = page.waitForRequest('**/status.json');
    await page.goto('/');
    await requested;
    // getByRole only finds what is in the accessibility tree, so display: none would fail here.
    const region = page.locator('#projekte').getByRole('status');
    await expect(region).toHaveCount(1);
    await expect(region).toBeEmpty();
    release();
    await expect(region).toHaveText(failedNotice);
  });

  test('[L8] veralteter Stand wird benannt', async ({ page }) => {
    await serveStatus(
      page,
      statusFile((document) => {
        document.generatedAt = hoursAgo(30);
      }),
    );
    await page.goto('/');
    await expect(notice(page)).toHaveText(staleNotice);
    await expect(signal(page, 'Videoflix')).toHaveText('CI grün');
  });

  test.describe('Startseite → Detailseite → zurück', () => {
    async function goAndReturn(page: Page): Promise<void> {
      await page.goto('/');
      await row(page, 'Videoflix').click();
      await expect(page).toHaveURL(/\/projekte\/videoflix\/?$/);
      await page.getByRole('link', { name: 'Zurück zur Projektliste' }).click();
      await expect(links(page)).toHaveCount(5);
    }

    test('[Spec 6.1] gesunder Stand: Zeilen zeigen ihn, kein Hinweis', async ({ page }) => {
      await serveStatus(page);
      await goAndReturn(page);
      await expect(signal(page, 'VPS-Plattform')).toHaveText('CI grün');
      await expect(signal(page, 'Videoflix')).toHaveText('CI grün');
      await page.waitForLoadState('networkidle');
      await expect(notice(page)).toBeEmpty();
    });

    test('[L8] alter Stand ohne vps-plattform: Hinweis steht auch nach dem Rückweg', async ({
      page,
    }) => {
      await serveStatus(page, statusFile(beforeVps));
      await goAndReturn(page);
      await expect(signal(page, 'VPS-Plattform')).toHaveText('Stand nicht abrufbar');
      await expect(notice(page)).toHaveText(failedNotice);
    });

    test('[L8] kaputter Status: Hinweis steht auch nach dem Rückweg', async ({ page }) => {
      await page.route('**/status.json', (route) => route.fulfill({ status: 500, body: 'error' }));
      await goAndReturn(page);
      await expect(notice(page)).toHaveText(failedNotice);
    });
  });
});

test.describe('Ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('[L7] alle fünf Zeilen lesbar und als Link bedienbar', async ({ page }) => {
    await page.goto('/');
    await expect(items(page).locator('h3')).toHaveText(titles);
    for (const heading of await items(page).locator('h3').all()) {
      await expect(heading).toBeVisible();
    }
    const targets = await links(page).evaluateAll((rows) =>
      rows.map((link) => link.getAttribute('href')),
    );
    expect(targets).toEqual(hrefs);
    await row(page, 'VPS-Plattform').click();
    await expect(page).toHaveURL(/\/projekte\/vps-plattform\/$/);
  });
});
