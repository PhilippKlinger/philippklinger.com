import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { deliveryPlans } from '../src/content/delivery-plans';
import { projects } from '../src/content/projects';
import type { StatusDocument } from '../src/content/status';
import { pages } from './support/site';

// Software Delivery on the project pages (spec 5, 6, 16.3). A real snapshot of status.json from
// the preview, with a time set per test. The local build has no snapshot of its own, so what shows
// up after loading came from the request these tests answer.
const fixtureText = readFileSync('e2e/fixtures/status.json', 'utf8');
// The file the server keeps after the deploy until status.yml runs again: conduit, no VPS.
const beforeVpsText = readFileSync('e2e/fixtures/status-before-vps.json', 'utf8');
const refreshFailed = 'Der aktuelle Stand ist gerade nicht abrufbar.';
const stale = 'Dieser Stand ist älter als einen Tag.';
const DAY_MS = 24 * 60 * 60 * 1000;
const PIPELINE_BREAKPOINT = 1100;
const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Change = (document: StatusDocument) => void;

function statusDocument(change: Change = () => undefined): StatusDocument {
  const document = JSON.parse(fixtureText) as StatusDocument;
  document.generatedAt = new Date().toISOString();
  change(document);
  return document;
}

/** Answers /status.json and counts how often the page asks. */
async function serveStatus(page: Page, change?: Change): Promise<() => number> {
  const document = statusDocument(change);
  let requests = 0;
  await page.route('**/status.json', (route) => {
    requests += 1;
    return route.fulfill({ json: document });
  });
  return () => requests;
}

/** Marks a document, so a test can tell which one the page shows. */
function markWithPullRequests(document: StatusDocument, merged: number): void {
  const [first, ...others] = document.projects.videoflix.code.signals.repos;
  first.mergedPullRequests = merged;
  for (const repo of others) repo.mergedPullRequests = 0;
}

/**
 * Serves the page as if the build had carried this snapshot: the prerender writes it into the
 * transfer state under this key, the browser reads it from there.
 */
async function serveBuildSnapshot(page: Page, change: Change): Promise<void> {
  const { generatedAt, projects } = statusDocument(change);
  const snapshot = { generatedAt, status: projects.videoflix };
  await page.route('**/projekte/videoflix/', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      /(<script id="ng-state" type="application\/json">)\{/,
      `$1{"status-snapshot-videoflix":${JSON.stringify(snapshot).replaceAll('<', '\\u003C')},`,
    );
    const { 'content-encoding': _encoding, ...headers } = response.headers();
    await route.fulfill({ status: response.status(), headers, body: html });
  });
}

const delivery = (page: Page) => page.locator('app-delivery-chain');
const notice = (page: Page) => delivery(page).locator('[role="status"]');
// The same items before and after hydration: a list first, then tabs.
const stations = (page: Page) => delivery(page).locator('.tab');
const station = (page: Page, name: string) =>
  stations(page).filter({ has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }) });
const valueOf = (page: Page, name: string) => station(page, name).locator('.value');
const panel = (page: Page) => delivery(page).getByRole('tabpanel');
const statesOf = (page: Page) =>
  stations(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-state')));

/** Waits until hydration has turned the list into tabs, then opens one station. */
async function choose(page: Page, name: string): Promise<void> {
  await expect(stations(page).first()).toHaveAttribute('role', 'tab');
  await station(page, name).click();
  await expect(station(page, name)).toHaveAttribute('aria-selected', 'true');
}

const stepNames = {
  videoflix: [
    'Code',
    'Tests & Security-Checks',
    'Signed Build',
    'Deployment',
    'Monitoring',
    'Restore-Test',
  ],
  portfolio: ['Code', 'Tests & Security-Checks', 'Signed Build', 'Deployment', 'Monitoring'],
  'vps-plattform': ['Code', 'CI & Security-Checks', 'Betrieb'],
};

/** Keeps the fresh time, so only the projects are those of the old collector. */
const beforeVps: Change = (document) => {
  document.projects = (JSON.parse(beforeVpsText) as StatusDocument).projects;
};

/** Pages whose chain waits for status.json; only they show a stand. */
const isMeasured = (path: string) => !!deliveryPlans[path.split('/')[2]]?.statusKey;

/** Neither a tick for what is not proven nor an empty frame where data is missing (D8). */
async function expectNoFalseProof(page: Page, ticks: number): Promise<void> {
  await expect(delivery(page).locator('.tick')).toHaveCount(ticks);
  await expect(delivery(page).locator('table:not(:has(td))')).toHaveCount(0);
}

/** From the pipeline breakpoint on one row ending at the right content edge, below upright. */
async function expectLayout(page: Page): Promise<void> {
  const nodes: DOMRect[] = await stations(page)
    .locator('.node')
    .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON()));
  const edge = (await panel(page).boundingBox())!;
  const [first, ...rest] = nodes;
  if (page.viewportSize()!.width >= PIPELINE_BREAKPOINT) {
    for (const node of rest) expect(Math.abs(node.y - first.y), 'one row').toBeLessThanOrEqual(1);
    const end = rest.at(-1)!.right - (edge.x + edge.width);
    expect(Math.abs(end), 'last node on the right edge').toBeLessThanOrEqual(1);
  } else {
    for (const node of rest)
      expect(Math.abs(node.x - first.x), 'one column').toBeLessThanOrEqual(1);
    rest.forEach((node, index) => expect(node.y, 'top to bottom').toBeGreaterThan(nodes[index].y));
  }
}

test.describe('Software Delivery', () => {
  test('[AK3] [D2] Videoflix: eine Station je Schritt, Zustand mit Zeichen und Wort', async ({
    page,
  }) => {
    await serveStatus(page);
    await page.goto('/projekte/videoflix/');
    await expect(delivery(page).getByRole('tab')).toHaveCount(6);
    await expect(stations(page).locator('.name')).toHaveText(stepNames.videoflix);
    await expect(stations(page).locator('.value')).toHaveText([
      '75 merged PRs',
      '6 von 6 passing',
      'nicht abrufbar',
      'nicht abrufbar',
      'noch nicht eingerichtet',
      'noch nicht eingerichtet',
    ]);
    await expect
      .poll(() => statesOf(page))
      .toEqual(['verified', 'verified', 'partial', 'unavailable', 'notSetUp', 'notSetUp']);
    await expect(stations(page).locator('.tick')).toHaveCount(2);
    await expect(delivery(page).locator('.via')).toHaveText([
      '→ CI',
      '→ Image',
      '→ Deploy',
      '→ Betrieb',
      '→ Backup',
    ]);
    await expect(delivery(page).locator('.stand')).toContainText('· 3 Repos');
    await expectLayout(page);
    await choose(page, 'Signed Build');
    await expect(panel(page)).toContainText('die Signatur fehlt noch');
    await expect(notice(page)).toBeEmpty();
  });

  test('[AK3] die Website hat keinen Restore-Schritt', async ({ page }) => {
    await serveStatus(page);
    await page.goto('/projekte/portfolio/');
    await expect(stations(page).locator('.name')).toHaveText(stepNames.portfolio);
    await expect(delivery(page).locator('.stand')).toContainText('· 1 Repo');
    await expect(page.locator('main .how-built')).toHaveCount(0);
  });

  test('[AK4] eine Abweichung erscheint als Abweichung, mit Kreuz und Wort', async ({ page }) => {
    await serveStatus(page, (document) => {
      document.projects.portfolio.live.signals.components[0].matchesLatestGreen = false;
    });
    await page.goto('/projekte/portfolio/');
    const deployment = station(page, 'Deployment');
    await expect(deployment).toHaveAttribute('data-state', 'deviation');
    await expect(deployment.locator('.cross')).toBeVisible();
    await expect(deployment.locator('.value')).toHaveText('live ≠ geprüfter Stand');
    await choose(page, 'Deployment');
    await expect(panel(page)).toContainText('weicht vom zuletzt geprüften Commit ab');
    await expect(panel(page).getByRole('img', { name: 'failed' })).toBeVisible();
  });

  test('[Plan VPS E4] VPS-Plattform: Code, CI & Security-Checks, Betrieb', async ({ page }) => {
    await serveStatus(page);
    await page.goto('/projekte/vps-plattform/');
    await expect(stations(page).locator('.name')).toHaveText(stepNames['vps-plattform']);
    await expect(delivery(page).locator('.via')).toHaveText(['→ CI', '→ Betrieb']);
    await expect.poll(() => statesOf(page)).toEqual(['verified', 'verified', 'notSetUp']);
    await choose(page, 'CI & Security-Checks');
    await expect(panel(page)).toContainText(
      'Jede Änderung startet die echte Konfiguration und wird auf Schwachstellen geprüft.',
    );
    const runs = panel(page).locator('a');
    await expect(runs).toHaveCount(6);
    for (const link of await runs.all()) {
      await expect(link).toHaveAttribute('href', /\/vps-(edge|monitoring)\/actions\/runs\/\d+$/);
    }
    await expect(delivery(page)).not.toContainText(/getestet/);
    // Plan VPS E5: no Kuma slug of its own yet.
    await expect(valueOf(page, 'Betrieb')).toHaveText('noch nicht eingerichtet');
  });

  test('[Spec 6.4] grüner Deploy-Lauf ohne Live-Nachweis wird genau so benannt', async ({
    page,
  }) => {
    await serveStatus(page, (document) => {
      document.projects.videoflix.checks.signals.workflows.push({
        repo: 'PhilippKlinger/videoflix-deploy',
        workflow: 'Deploy',
        file: 'deploy.yml',
        kind: 'deploy',
        reachable: true,
        conclusion: 'success',
        headSha: 'fda73f26ff7880681f05ad4aa1409bf6b4eeeeb2',
        completedAt: '2026-11-06T10:42:00Z',
      });
    });
    await page.goto('/projekte/videoflix/');
    await expect(station(page, 'Deployment')).toHaveAttribute('data-state', 'partial');
    await choose(page, 'Deployment');
    await expect(panel(page)).toContainText(
      'Der letzte Deploy-Lauf war erfolgreich, der laufende Stand ist nicht abrufbar.',
    );
    await expect(panel(page).locator('tbody tr')).toContainText(['Deploy-Lauf']);
    await expect(panel(page)).toContainText('06.11., 11:42');
  });

  test('[Spec 6.1] [D8] veralteter Stand wird benannt', async ({ page }) => {
    await serveStatus(page, (document) => {
      document.generatedAt = '2026-01-01T00:00:00Z';
    });
    await page.goto('/projekte/videoflix/');
    await expect(notice(page)).toHaveText(stale);
    await expect(stations(page)).toHaveCount(6);
  });

  test('[AK8] [AK17] von der Karte über die Station beim Lauf', async ({ page }) => {
    await serveStatus(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Projektdetails ansehen: VPS-Plattform' }).click();
    await expect(page).toHaveURL(/\/projekte\/vps-plattform\/?$/);
    await choose(page, 'CI & Security-Checks');
    await expect(panel(page).locator('a').first()).toHaveAttribute('href', /\/actions\/runs\/\d+$/);
  });

  test('[Spec 6.1] der Stand kommt von der eigenen Domain', async ({ page, baseURL }) => {
    const response = page.waitForResponse('**/status.json');
    await page.goto('/projekte/videoflix/');
    expect(new URL((await response).url()).origin).toBe(baseURL);
  });

  test('[Grill 04.11. Option A] die Website ist über den Footer erreichbar', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer').getByRole('link', { name: 'So ist diese Seite gebaut' }).click();
    await expect(page).toHaveURL(/\/projekte\/portfolio\/?$/);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(stations(page)).toHaveCount(5);
  });
});

test.describe('Kette bedienen', () => {
  test('[D4] ein Tab-Stopp, Pfeile, Pos1 und Ende, dann Feld und sein erster Link; axe', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Tastatur auf einer Breite genügt');
    await serveStatus(page);
    await page.goto('/projekte/vps-plattform/');
    const tabs = delivery(page).getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(delivery(page).locator('[role="tab"][tabindex="0"]')).toHaveCount(1);

    // A click on the heading sets where the Tab key goes on from, whatever the page head holds.
    await delivery(page).locator('h2').click();
    await page.keyboard.press('Tab');
    await expect(tabs.first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tabs.last()).toBeFocused();
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(tabs.first()).toBeFocused();
    await page.keyboard.press('ArrowRight');

    await page.keyboard.press('Tab');
    await expect(panel(page)).toBeFocused();
    await expect(panel(page)).toHaveAccessibleName(/^CI & Security-Checks/);
    await page.keyboard.press('Tab');
    await expect(panel(page).locator('a').first()).toBeFocused();

    const { violations } = await new AxeBuilder({ page })
      .include('app-delivery-chain')
      .withTags(wcag)
      .analyze();
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });

  test('[D6] Zeiger auf einen Commit hebt ihn überall im Feld hervor', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Maus auf einer Breite genügt');
    await serveStatus(page);
    await page.goto('/projekte/portfolio/');
    await choose(page, 'Deployment');
    const shas = panel(page).locator('[data-sha]');
    await expect(shas).toHaveCount(2);
    await expect(panel(page).locator('th')).toContainText(['letzter grüner CI-Lauf']);
    await shas.first().hover();
    const sha = await shas.first().getAttribute('data-sha');
    await expect(panel(page).locator(`[data-sha="${sha}"][data-match]`)).toHaveCount(2);
    await expect(panel(page).locator('[data-sha][tabindex], a [data-sha]')).toHaveCount(0);
  });

  test('[D7] [AK8] 320 px: kein horizontales Scrollen auf allen Detailseiten, je Station', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Breite stellt der Test selbst ein');
    await serveStatus(page);
    await page.setViewportSize({ width: 320, height: 844 });
    const scrolls = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
    for (const path of pages.filter((each) => each.startsWith('/projekte/'))) {
      await page.goto(path);
      await page.waitForFunction(
        () => !document.querySelector('app-delivery-chain .tab:not([role])'),
      );
      // A measured page fills its tables from status.json; measure only once the data is in.
      if (isMeasured(path)) await expect(delivery(page).locator('.stand')).toBeVisible();
      for (const item of await stations(page).all()) {
        await item.click();
        await expect(item).toHaveAttribute('aria-selected', 'true');
        // Opened, so the verify command is measured too.
        for (const summary of await panel(page).locator('details.verify summary').all()) {
          await summary.click();
        }
        const label = `${path} ${await item.locator('.name').innerText()}`;
        expect(await scrolls(), label).toBe(false);
        for (const link of await panel(page).locator('a').all()) {
          await expect(link, label).toHaveAttribute('href', /^https:\/\//);
          expect((await link.boundingBox())!.height, label).toBeGreaterThanOrEqual(44);
        }
      }
      expect(await scrolls(), path).toBe(false);
    }
  });
});

test.describe('Abruf von /status.json', () => {
  test('[Spec 6.1] der Abruf ersetzt den vorgerenderten Stand', async ({ page }) => {
    await serveStatus(page, (document) => markWithPullRequests(document, 4711));
    await page.goto('/projekte/videoflix/');
    await expect(valueOf(page, 'Code')).toHaveText('4711 merged PRs');
    await expect(station(page, 'Code')).toHaveAttribute('data-state', 'verified');
    await expect(panel(page).locator('a').first()).toHaveAttribute(
      'href',
      'https://github.com/PhilippKlinger/videoflix-backend/pulls?q=is%3Apr+is%3Amerged',
    );
  });

  test('[Spec 6.1] die Seite fragt genau einmal', async ({ page }) => {
    const requests = await serveStatus(page);
    await page.goto('/projekte/videoflix/');
    await expect(valueOf(page, 'Code')).toHaveText('75 merged PRs');
    await page.waitForLoadState('networkidle');
    expect(requests()).toBe(1);
  });

  test('[Spec 6.1] der neuere Stand aus der Datei gewinnt', async ({ page }) => {
    await serveBuildSnapshot(page, (document) => {
      document.generatedAt = new Date(Date.now() - 2 * DAY_MS).toISOString();
      markWithPullRequests(document, 1000);
    });
    await serveStatus(page, (document) => markWithPullRequests(document, 2000));
    await page.goto('/projekte/videoflix/');
    await expect(valueOf(page, 'Code')).toHaveText('2000 merged PRs');
    await expect(notice(page)).toBeEmpty();
  });

  test('[Spec 6.1] der Stand der Seite bleibt, wenn die Datei älter ist', async ({ page }) => {
    await serveBuildSnapshot(page, (document) => {
      document.generatedAt = new Date(Date.now() - 2 * DAY_MS).toISOString();
      markWithPullRequests(document, 1000);
    });
    await serveStatus(page, (document) => {
      document.generatedAt = new Date(Date.now() - 3 * DAY_MS).toISOString();
      markWithPullRequests(document, 2000);
    });
    await page.goto('/projekte/videoflix/');
    // The notice appears only after the request is done, so the file had its chance by then.
    await expect(notice(page)).toHaveText(stale);
    await expect(valueOf(page, 'Code')).toHaveText('1000 merged PRs');
  });

  for (const [name, respond] of [
    ['Serverfehler', { status: 500, body: 'error' }],
    ['abgeschnittener Upload', { status: 200, body: '{"schemaVersion":1,"genera' }],
    ['HTML statt JSON', { status: 200, contentType: 'text/html', body: '<!doctype html>' }],
    ['anderes Schema', { status: 200, json: { schemaVersion: 2, generatedAt: 'x', projects: {} } }],
  ] as const) {
    test(`[AK6] [D8] ${name}: freundlicher Hinweis, Kette bleibt vollständig`, async ({ page }) => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await page.route('**/status.json', (route) => route.fulfill(respond));
      await page.goto('/projekte/videoflix/');
      await expect(notice(page)).toHaveText(refreshFailed);
      await expect(stations(page).locator('.name')).toHaveText(stepNames.videoflix);
      await expect(valueOf(page, 'Code')).toHaveText('nicht abrufbar');
      await expect(station(page, 'Code')).toHaveAttribute('data-state', 'unavailable');
      await expectNoFalseProof(page, 0);
      expect(errors).toEqual([]);
    });
  }

  test('[AK6] kaputter VPS-Block: die ganze Datei gilt als unbrauchbar', async ({ page }) => {
    await serveStatus(page, (document) => {
      (document.projects as unknown as Record<string, unknown>)['vps-plattform'] = { code: {} };
    });
    await page.goto('/projekte/videoflix/');
    await expect(notice(page)).toHaveText(refreshFailed);
    await expect(stations(page)).toHaveCount(6);
  });

  test('[WCAG 4.1.3] die Hinweiszeile steht vor dem Abruf im Accessibility-Baum', async ({
    page,
  }) => {
    let failRequest = () => {};
    const requestMayFail = new Promise<void>((resolve) => (failRequest = resolve));
    await page.route('**/status.json', async (route) => {
      await requestMayFail;
      await route.fulfill({ status: 500, body: 'error' });
    });
    await page.goto('/projekte/videoflix/');
    // getByRole skips what is hidden from assistive technology, display: none included.
    const region = delivery(page).getByRole('status');
    await expect(region).toHaveCount(1);
    await expect(region).toBeEmpty();
    failRequest();
    await expect(region).toHaveText(refreshFailed);
  });

  test('[AK6] Abbruch der Verbindung: freundlicher Hinweis', async ({ page }) => {
    await page.route('**/status.json', (route) => route.abort());
    await page.goto('/projekte/videoflix/');
    await expect(notice(page)).toHaveText(refreshFailed);
    await expect(stations(page)).toHaveCount(6);
  });

  test.describe('später Abruf nach einem Seitenwechsel im Browser', () => {
    const homeCard = (page: Page, title: string) =>
      page.locator('#projekte article.card').filter({ hasText: title });

    /** Keeps the answer back until the test has left the VPS platform page. */
    async function holdStatus(page: Page, change: Change) {
      let answer = () => {};
      const answered = new Promise<void>((resolve) => (answer = resolve));
      let requests = 0;
      await page.route('**/status.json', async (route) => {
        requests += 1;
        await answered;
        await route.fulfill({ json: statusDocument(change) });
      });
      return { answer: () => answer(), requests: () => requests };
    }

    async function leavePlatformForHome(page: Page): Promise<void> {
      await page.goto('/projekte/vps-plattform/');
      await expect(stations(page)).toHaveCount(3);
      await page.locator('main a.back').click();
      await expect(page.locator('#projekte article.card')).toHaveCount(5);
      await expect(delivery(page)).toHaveCount(0);
    }

    // The home page shows the VPS card itself, so without vps-plattform this notice is its own.
    test('[AK6] die Startseite meldet nur, was ihre eigenen Karten betrifft', async ({ page }) => {
      const held = await holdStatus(page, beforeVps);
      await leavePlatformForHome(page);
      await expect(page.locator('#projekte .notice')).toBeEmpty();
      held.answer();
      await expect(homeCard(page, 'VPS-Plattform').locator('.signal .state')).toHaveText(
        'Stand nicht abrufbar',
      );
      await expect(homeCard(page, 'Videoflix').locator('.signal .state')).toHaveText('CI grün');
      await expect(page.getByRole('status')).toHaveText(refreshFailed);
      expect(held.requests()).toBe(1);
    });

    test('[AK6] mit vps-plattform im Stand bleibt auf der Startseite kein Hinweis', async ({
      page,
    }) => {
      const held = await holdStatus(page, () => undefined);
      await leavePlatformForHome(page);
      held.answer();
      await expect(homeCard(page, 'VPS-Plattform').locator('.signal .state')).toHaveText('CI grün');
      await expect(page.getByRole('status')).toBeEmpty();
      expect(held.requests()).toBe(1);
    });

    test('[AK6] der Hinweis der Startseite folgt nicht zurück auf Videoflix', async ({ page }) => {
      await serveStatus(page, beforeVps);
      await page.goto('/projekte/videoflix/');
      await expect(notice(page)).toBeEmpty();
      await page.locator('main a.back').click();
      await expect(page.locator('#projekte .notice')).toHaveText(refreshFailed);
      await page.goBack();
      await expect(page.locator('main h1')).toHaveText('Videoflix');
      await expect(valueOf(page, 'Code')).toContainText('merged PRs');
      await expect(notice(page)).toBeEmpty();
    });

    test('[Spec 6.1] der Hinweis der Startseite folgt nicht auf festen Inhalt', async ({
      page,
    }) => {
      await page.route('**/status.json', (route) => route.fulfill({ status: 500, body: 'error' }));
      await page.goto('/projekte/developer-workspace-kit/');
      await page.locator('main a.back').click();
      await expect(page.locator('#projekte .notice')).toHaveText(refreshFailed);
      await page.goBack();
      await expect(page.locator('main h1')).toHaveText('Developer Workspace Kit');
      await expect(notice(page)).toBeEmpty();
    });
  });

  // Rollout: until the next status.yml run the server serves the file of the old collector.
  test.describe('alter Stand mit conduit, ohne vps-plattform', () => {
    test('[AK6] [D8] die VPS-Seite meldet es und bleibt vollständig', async ({ page }) => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await serveStatus(page, beforeVps);
      await page.goto('/projekte/vps-plattform/');
      await expect(notice(page)).toHaveText(refreshFailed);
      await expect(stations(page).locator('.name')).toHaveText(stepNames['vps-plattform']);
      await expect.poll(() => statesOf(page)).toEqual(['unavailable', 'unavailable', 'notSetUp']);
      await expectNoFalseProof(page, 0);
      expect(errors).toEqual([]);
    });

    test('[AK6] Videoflix zeigt denselben Stand normal', async ({ page }) => {
      await serveStatus(page, beforeVps);
      await page.goto('/projekte/videoflix/');
      await expect(valueOf(page, 'Code')).toContainText('merged PRs');
      await expect(notice(page)).toBeEmpty();
    });
  });

  for (const [slug, count] of [
    ['neuro-check-in', 3],
    ['developer-workspace-kit', 0],
  ] as const) {
    test(`[Spec 6.1] fester Inhalt fragt nichts ab: ${slug}`, async ({ page }) => {
      const requests = await serveStatus(page);
      await page.goto(`/projekte/${slug}/`);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(stations(page)).toHaveCount(count);
      await page.waitForLoadState('networkidle');
      expect(requests()).toBe(0);
      await expect(notice(page)).toBeEmpty();
    });
  }
});

test.describe('Vorschaubild', () => {
  for (const { slug, preview } of projects) {
    if (!preview) continue;

    test(`[Regel web-quality] ${slug}: Höhe ist reserviert, nichts springt`, async ({ page }) => {
      let deliver = () => {};
      const delivered = new Promise<void>((resolve) => (deliver = resolve));
      await page.route(`**/${preview.src}`, async (route) => {
        await delivered;
        await route.continue();
      });
      await page.goto(`/projekte/${slug}/`, { waitUntil: 'domcontentloaded' });
      const image = page.locator('main .media img');
      await expect(image).toBeVisible();
      expect(await image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(0);
      const before = (await image.boundingBox())!;
      const chainBefore = (await delivery(page).boundingBox())!;
      expect(before.height).toBeCloseTo((before.width * preview.height) / preview.width, 0);

      deliver();
      await expect
        .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBe(preview.width);
      const after = (await image.boundingBox())!;
      const chainAfter = (await delivery(page).boundingBox())!;
      expect(after.height).toBeCloseTo(before.height, 0);
      expect(chainAfter.y).toBeCloseTo(chainBefore.y, 0);
    });
  }
});

test.describe('Fester Inhalt', () => {
  test('[AK3] Neuro Check-in: Release mit Link, der Rest Code privat', async ({ page }) => {
    await page.goto('/projekte/neuro-check-in/');
    await expect.poll(() => statesOf(page)).toEqual(['private', 'private', 'verified']);
    await expect(valueOf(page, 'Code')).toHaveText('Code privat');
    await expect(station(page, 'Code').locator('.lock')).toBeVisible();
    await expect(valueOf(page, 'Release im Play Store')).toHaveText('Version 1.11.2');
    await choose(page, 'Release im Play Store');
    await expect(panel(page).locator('a')).toHaveAttribute(
      'href',
      /^https:\/\/play\.google\.com\//,
    );
  });

  test('[D1] Kit: drei Blöcke, die Kette als eine Zeile „Code privat“', async ({ page }) => {
    await page.goto('/projekte/developer-workspace-kit/');
    await expect(page.locator('main :is(h1, h2)')).toHaveText([
      'Developer Workspace Kit',
      'Software Delivery',
      'Wie es gebaut ist',
    ]);
    await expect(delivery(page).locator('.private')).toHaveText(
      'Code privat. Die Läufe zeige ich im Gespräch.',
    );
    await expect(stations(page)).toHaveCount(0);
    await expect(page.locator('main .links')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Links', exact: true })).toHaveCount(0);
  });
});

test.describe('Ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('[AK7] [D4] alle Stationen mit Wert und Feld untereinander', async ({ page }) => {
    await page.goto('/projekte/videoflix/');
    await expect(page.locator('main h1')).toHaveText('Videoflix');
    await expect(stations(page).locator('.name')).toHaveText(stepNames.videoflix);
    for (const value of await stations(page).locator('.value').all()) {
      await expect(value).toBeVisible();
    }
    const fields = delivery(page).locator('.panel');
    await expect(fields).toHaveCount(6);
    for (const field of await fields.all()) await expect(field).toBeVisible();
    await expect(delivery(page).locator('[role="tab"], [role="tablist"]')).toHaveCount(0);
    await expect(page.locator('main .links a')).toHaveCount(2);
    await expect(page.locator('main a.back')).toHaveAttribute('href', '/#projekte');
  });

  test('[AK7] fester Inhalt samt Beleg ohne JavaScript', async ({ page }) => {
    await page.goto('/projekte/neuro-check-in/');
    const release = delivery(page).locator('.panel').filter({ hasText: 'Release im Play Store' });
    await expect(release.locator('a')).toBeVisible();
    await expect(notice(page)).toBeEmpty();
  });
});
