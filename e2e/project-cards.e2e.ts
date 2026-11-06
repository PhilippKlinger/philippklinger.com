import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Five cards on the start page (spec 4, 5, 6.1, 10). Status data comes from a real snapshot of
// status.json through page.route, with a time and changes set per test.
const fixtureText = readFileSync('e2e/fixtures/status.json', 'utf8');

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

const reportBase = 'https://philippklinger.github.io/my-dso-blog/docs/projects';
const repoBase = 'https://github.com/PhilippKlinger';
const failedNotice = 'Der aktuelle Stand ist gerade nicht abrufbar.';
const staleNotice = 'Dieser Stand ist älter als einen Tag.';

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

function dropConduit(document: StatusFile): void {
  delete document.projects['conduit'];
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

const cards = (page: Page) => page.locator('#projekte .cards > li');
const card = (page: Page, title: string) =>
  cards(page).filter({ has: page.locator('h3', { hasText: new RegExp(`^${title}$`) }) });
const notice = (page: Page) => page.locator('#projekte .notice');
const stepNames = (locator: Locator) => locator.locator('.flow-step strong');
const stepOf = (locator: Locator, name: string) =>
  locator.locator('.flow-step').filter({ has: locator.page().getByText(name, { exact: true }) });
/** The surface click waits for a possible second click, so "nothing happened" takes this long. */
const afterSelectionWindow = (page: Page) => page.waitForTimeout(500);

test.describe('Karten', () => {
  test('[AK1] fünf Karten in fester Reihenfolge', async ({ page }) => {
    await page.goto('/');
    await expect(cards(page).locator('h3')).toHaveText([
      'Videoflix',
      'Neuro Check-in',
      'Conduit',
      'Developer Workspace Kit',
      'Security, Linux und Container',
    ]);
    await expect(cards(page).locator('article.card[data-card-link]')).toHaveCount(5);
  });

  test('[AK1] jede Karte hat Signal, Titel, Text, Chips, Aktionen und Panel', async ({ page }) => {
    await page.goto('/');
    for (const item of await cards(page).all()) {
      await expect(item.locator('.signal b')).toBeVisible();
      await expect(item.locator('.card-main > p')).toBeVisible();
      await expect(item.locator('.chips li').first()).toBeVisible();
      await expect(item.locator('.actions a').first()).toBeVisible();
      await expect(item.locator('.flow')).toBeVisible();
    }
  });

  test('[AK2] jede Karte hat eine sichtbare CTA ab 44 px', async ({ page }) => {
    await page.goto('/');
    const ctas = page.locator('#projekte a[data-card-cta][data-cursor]');
    await expect(ctas).toHaveCount(5);
    for (const cta of await ctas.all()) {
      await expect(cta).toBeVisible();
      expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('[Regel web-quality] ruhige Links und Bericht-Links sind Touch-Ziele ab 44 px', async ({
    page,
  }) => {
    await page.goto('/');
    const links = page.locator('#projekte .cta-quiet, #projekte .report-links a');
    await expect(links).toHaveCount(6 + 7);
    for (const link of await links.all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('[AK2] Klick auf die Kartenfläche öffnet die Detailseite', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Conduit').locator('.card-main > p').click();
    await expect(page).toHaveURL(/\/projekte\/conduit\/?$/);
    await expect(page.locator('h1')).toHaveText('Conduit');
  });

  test('[AK2] Klick auf die Fläche der Berichtskarte führt zu allen Berichten', async ({
    page,
  }) => {
    await page.route(`${reportBase}`, (route) => route.fulfill({ body: 'Berichte' }));
    await page.goto('/');
    await card(page, 'Security, Linux und Container').locator('.card-main > p').click();
    await expect(page).toHaveURL(reportBase);
  });

  test('[AK2] ein ruhiger Link öffnet nur sein eigenes Ziel', async ({ page }) => {
    const target = 'https://videoflix.philipp-klinger.com/';
    await page.route(target, (route) => route.fulfill({ body: 'Videoflix' }));
    const details: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/projekte/')) details.push(request.url());
    });
    await page.goto('/');
    await card(page, 'Videoflix').getByRole('link', { name: 'Live ansehen' }).click();
    await expect(page).toHaveURL(target);
    await afterSelectionWindow(page);
    await expect(page).toHaveURL(target);
    expect(details).toEqual([]);
  });

  test('[AK2] markierter Text navigiert nicht', async ({ page }) => {
    await page.goto('/');
    const text = card(page, 'Videoflix').locator('.card-main > p');
    await text.click({ clickCount: 3 });
    await afterSelectionWindow(page);
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => document.getSelection()?.toString())).toContain(
      'Fullstack-Streaming-Plattform',
    );
  });

  test('[AK2] mit der Maus aufgezogene Markierung navigiert nicht', async ({ page }) => {
    await page.goto('/');
    const text = card(page, 'Videoflix').locator('.card-main > p');
    await text.scrollIntoViewIfNeeded();
    const box = (await text.boundingBox())!;
    await page.mouse.move(box.x + 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 10, { steps: 5 });
    await page.mouse.up();
    await afterSelectionWindow(page);
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => document.getSelection()?.toString())).not.toBe('');
  });

  test('[AK2] Tastatur erreicht jede CTA in Lesereihenfolge', async ({ page }) => {
    await page.goto('/');
    await page.locator('#projekte a[data-card-cta]').first().focus();
    const reached: (string | null)[] = [];
    for (let press = 0; press < 25 && reached.length < 5; press++) {
      const name = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active?.hasAttribute('data-card-cta')) return null;
        return active.getAttribute('aria-label') ?? active.textContent;
      });
      if (name) reached.push(name);
      await page.keyboard.press('Tab');
    }
    expect(reached).toEqual([
      'Projektdetails ansehen: Videoflix',
      'Projektdetails ansehen: Neuro Check-in',
      'Projektdetails ansehen: Conduit',
      'Projektdetails ansehen: Developer Workspace Kit',
      'Alle Projektberichte ansehen',
    ]);
  });

  test('[AK3] Videoflix zeigt sechs Schritte, Neuro drei, Conduit vier, Kit drei', async ({
    page,
  }) => {
    await serveStatus(page);
    await page.goto('/');
    await expect(stepNames(card(page, 'Videoflix'))).toHaveText([
      'Code',
      'Tests & Security-Checks',
      'Signed Build',
      'Deployment',
      'Monitoring',
      'Restore-Test',
    ]);
    await expect(stepNames(card(page, 'Neuro Check-in'))).toHaveText([
      'Code',
      'Unit- & E2E-Tests',
      'Release im Play Store',
    ]);
    await expect(stepNames(card(page, 'Conduit'))).toHaveText([
      'Code',
      'CI',
      'Image in GHCR',
      'Staging-Deployment',
    ]);
    await expect(stepNames(card(page, 'Developer Workspace Kit'))).toHaveText([
      'Code',
      'CI',
      'Release',
    ]);
  });

  test('[AK3] Pfeile tragen ihre Bezeichnung, nach dem letzten Schritt keiner', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(card(page, 'Videoflix').locator('.flow-arrow')).toHaveText([
      'CI',
      'Image',
      'Deploy',
      'Betrieb',
      'Backup',
    ]);
    await expect(card(page, 'Conduit').locator('.flow-arrow')).toHaveText([
      'CI',
      'Image',
      'Deploy',
    ]);
  });

  test('[AK3] Fußzeile und Signal folgen den Daten', async ({ page }) => {
    await serveStatus(page);
    await page.goto('/');
    const videoflix = card(page, 'Videoflix');
    await expect(videoflix.locator('.signal b')).toHaveText('CI grün');
    await expect(videoflix.locator('.signal span')).toHaveText('zuletzt 05.11.');
    await expect(videoflix.locator('.flow-foot')).toHaveText('2 von 6 belegt');
    const neuro = card(page, 'Neuro Check-in');
    await expect(neuro.locator('.signal b')).toHaveText('Live im Play Store');
    await expect(neuro.locator('.signal span')).toHaveText('Version 1.11.2');
    await expect(neuro.locator('.flow-foot')).toHaveText('1 von 3 öffentlich belegt, Code privat');
    const kit = card(page, 'Developer Workspace Kit');
    await expect(kit.locator('.signal b')).toHaveText('Code privat');
    await expect(kit.locator('.signal span')).toHaveText('Version 0.5.0');
    await expect(kit.locator('.flow-foot')).toHaveText('Öffentliches Repo folgt');
  });

  test('[AK3] Kit und Neuro zeigen Code privat', async ({ page }) => {
    await page.goto('/');
    await expect(card(page, 'Developer Workspace Kit').locator('.flow-step .state')).toHaveText([
      'Code privat',
      'Code privat',
      'Code privat',
    ]);
    await expect(card(page, 'Neuro Check-in').locator('.flow-step .state')).toHaveText([
      'Code privat',
      'Code privat',
      'Belegt',
    ]);
  });

  test('[AK4] Zustand steht in Worten, nicht nur als Farbe', async ({ page }) => {
    await serveStatus(page, statusFile(failChecks));
    await page.goto('/');
    const check = stepOf(card(page, 'Videoflix'), 'Tests & Security-Checks');
    await expect(check.locator('.state-deviation')).toHaveText('Abweichung');
    await expect(check.locator('.state svg')).toHaveAttribute('aria-hidden', 'true');
    for (const state of await page.locator('#projekte .flow-step .state').all()) {
      await expect(state).toHaveText(
        /^\s*(Belegt|Teilweise|Abweichung|Nicht abrufbar|Noch nicht eingerichtet|Code privat)\s*$/,
      );
    }
  });

  test('[Spec 10] keine Etiketten, keine Vorschau, kein Textlink unter der Liste', async ({
    page,
  }) => {
    await page.goto('/');
    const section = page.locator('#projekte');
    await expect(section.locator('.label, .preview, .preview-media, .more, a.project')).toHaveCount(
      0,
    );
    await expect(section.locator('img')).toHaveCount(0);
    await expect(section).not.toContainText('Weitere Projekte und technische Dokumentation');
    await expect(section).not.toContainText(/Eigenes Produkt|Eigenes Projekt|Weiterbildung/);
  });

  test('[Regel] Berichte verlinken genau die vier Ziele', async ({ page }) => {
    await page.goto('/');
    const panel = card(page, 'Security, Linux und Container');
    await expect(panel.locator('a[data-card-cta]')).toHaveAttribute('href', reportBase);
    await expect(panel.locator('.report strong')).toHaveText([
      'OWASP Juice Shop',
      'V-Server Setup',
      'Truck Signs API',
      'WordPress Multi-Container',
    ]);
    const hrefs = await panel
      .locator('.report a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).toEqual([
      `${reportBase}/Juice%20Shop%20Master/`,
      `${reportBase}/v-server-setup`,
      `${repoBase}/v-server-setup`,
      `${reportBase}/truck-signs-api`,
      `${repoBase}/truck-signs-api`,
      `${reportBase}/wordpress-multicontainer-setup`,
      `${repoBase}/wordpress-multicontainer-setup`,
    ]);
    await expect(panel.locator('.flow-arrow')).toHaveCount(0);
  });
});

test.describe('Status im Browser', () => {
  test('[Spec 6.1] Startseite fragt status.json genau einmal', async ({ page }) => {
    const requests = await serveStatus(page);
    await page.goto('/');
    await expect(card(page, 'Conduit').locator('.signal b')).toHaveText('CI grün');
    await page.waitForLoadState('networkidle');
    expect(requests).toHaveLength(1);
  });

  test('[Spec 6.1] der Stand kommt von der eigenen Domain', async ({ page, baseURL }) => {
    const requests = await serveStatus(page);
    await page.goto('/');
    await expect.poll(() => requests).toEqual([`${baseURL}/status.json`]);
  });

  test('[Spec 6.1] der erfolgreiche Abruf erreicht die Karten', async ({ page }) => {
    await serveStatus(page, statusFile(failChecks));
    await page.goto('/');
    const videoflix = card(page, 'Videoflix');
    await expect(videoflix.locator('.signal b')).toHaveText('Prüfung rot');
    await expect(
      stepOf(videoflix, 'Tests & Security-Checks').locator('.state-deviation'),
    ).toBeVisible();
    await expect(card(page, 'Conduit').locator('.signal b')).toHaveText('CI grün');
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
    await expect(card(page, 'Videoflix').locator('.signal b')).toHaveText('CI grün');
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
    await expect(card(page, 'Videoflix').locator('.signal b')).toHaveText('CI grün');
  });

  test('[AK6] Status ohne conduit: Conduit nicht abrufbar, Videoflix normal', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await serveStatus(page, statusFile(dropConduit));
    await page.goto('/');
    await expect(card(page, 'Videoflix').locator('.signal b')).toHaveText('CI grün');
    await expect(card(page, 'Videoflix').locator('.flow-foot')).toHaveText('2 von 6 belegt');
    const conduit = card(page, 'Conduit');
    await expect(conduit.locator('.signal b')).toHaveText('Stand nicht abrufbar');
    await expect(conduit.locator('.signal span')).toHaveCount(0);
    await expect(conduit.locator('.flow-step .state')).toHaveText([
      'Nicht abrufbar',
      'Nicht abrufbar',
      'Nicht abrufbar',
      'Noch nicht eingerichtet',
    ]);
    await expect(notice(page)).toHaveText(failedNotice);
    await expect(cards(page)).toHaveCount(5);
    expect(errors).toEqual([]);
  });

  for (const [name, respond] of [
    ['Serverfehler', { status: 500, body: 'error' }],
    ['abgeschnittene Datei', { status: 200, body: '{"schemaVersion":1,"genera' }],
    ['HTML statt JSON', { status: 200, contentType: 'text/html', body: '<!doctype html>' }],
    ['fremdes Schema', { status: 200, json: { schemaVersion: 99 } }],
  ] as const) {
    test(`[AK6] kaputter Status (${name}): Karten vollständig, freundlicher Hinweis`, async ({
      page,
    }) => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await page.route('**/status.json', (route) => route.fulfill(respond));
      await page.goto('/');
      await expect(notice(page)).toHaveText(failedNotice);
      await expect(page.locator('#projekte [role="status"]')).toHaveCount(1);
      await expect(cards(page)).toHaveCount(5);
      await expect(page.locator('#projekte a[data-card-cta]')).toHaveCount(5);
      await expect(page.locator('#projekte .flow-step')).toHaveCount(6 + 3 + 4 + 3);
      await expect(card(page, 'Videoflix').locator('.signal b')).toHaveText('Stand nicht abrufbar');
      await expect(card(page, 'Neuro Check-in').locator('.signal b')).toHaveText(
        'Live im Play Store',
      );
      await expect(page.locator('#projekte')).not.toContainText(/undefined|null|NaN|Error/);
      expect(errors).toEqual([]);
    });
  }

  test('[AK6] veralteter Stand wird benannt', async ({ page }) => {
    await serveStatus(
      page,
      statusFile((document) => {
        document.generatedAt = hoursAgo(30);
      }),
    );
    await page.goto('/');
    await expect(notice(page)).toHaveText(staleNotice);
    await expect(card(page, 'Videoflix').locator('.signal b')).toHaveText('CI grün');
  });

  test.describe('Startseite → Detailseite → zurück', () => {
    async function goAndReturn(page: Page): Promise<void> {
      await page.goto('/');
      await card(page, 'Videoflix').locator('a[data-card-cta]').click();
      await expect(page).toHaveURL(/\/projekte\/videoflix\/?$/);
      await page.getByRole('link', { name: 'Zurück zur Projektliste' }).click();
      await expect(cards(page)).toHaveCount(5);
    }

    test('[Spec 6.1] gesunder Stand: Karten zeigen ihn, kein Hinweis', async ({ page }) => {
      await serveStatus(page);
      await goAndReturn(page);
      await expect(card(page, 'Conduit').locator('.signal b')).toHaveText('CI grün');
      await expect(card(page, 'Videoflix').locator('.signal b')).toHaveText('CI grün');
      await page.waitForLoadState('networkidle');
      await expect(notice(page)).toBeEmpty();
    });

    test('[AK6] Status ohne conduit: Hinweis steht auch nach dem Rückweg', async ({ page }) => {
      await serveStatus(page, statusFile(dropConduit));
      await goAndReturn(page);
      await expect(card(page, 'Conduit').locator('.signal b')).toHaveText('Stand nicht abrufbar');
      await expect(notice(page)).toHaveText(failedNotice);
    });

    test('[AK6] kaputter Status: Hinweis steht auch nach dem Rückweg', async ({ page }) => {
      await page.route('**/status.json', (route) => route.fulfill({ status: 500, body: 'error' }));
      await goAndReturn(page);
      await expect(notice(page)).toHaveText(failedNotice);
    });
  });
});

test.describe('Ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('[AK7] Karten, Schritte und CTA ohne JavaScript', async ({ page }) => {
    await page.goto('/');
    await expect(cards(page)).toHaveCount(5);
    for (const heading of await cards(page).locator('h3').all()) {
      await expect(heading).toBeVisible();
    }
    await expect(page.locator('#projekte .flow-step')).toHaveCount(6 + 3 + 4 + 3);
    await expect(page.locator('#projekte .flow-foot')).toHaveCount(4);
    const hrefs = await page
      .locator('#projekte a[data-card-cta]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).toEqual([
      '/projekte/videoflix/',
      '/projekte/neuro-check-in/',
      '/projekte/conduit/',
      '/projekte/developer-workspace-kit/',
      reportBase,
    ]);
    await card(page, 'Conduit').locator('a[data-card-cta]').click();
    await expect(page).toHaveURL(/\/projekte\/conduit\/$/);
  });
});
