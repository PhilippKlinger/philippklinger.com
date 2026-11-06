import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { StatusDocument } from '../src/content/status';

// Software Delivery on the project pages (spec 5, 6, 7). A real snapshot of status.json from the
// preview, with a time set per test. The local build has no snapshot of its own, so what shows up
// after loading came from the request these tests answer.
const fixtureText = readFileSync('e2e/fixtures/status.json', 'utf8');
const refreshFailed = 'Der aktuelle Stand ist gerade nicht abrufbar.';
const stale = 'Dieser Stand ist älter als einen Tag.';
const DAY_MS = 24 * 60 * 60 * 1000;

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

const delivery = (page: Page) => page.locator('app-delivery-steps');
const notice = (page: Page) => delivery(page).locator('[role="status"]');
const signal = (page: Page) => delivery(page).locator('.signal');
const steps = (page: Page) => delivery(page).locator('.step');
const step = (page: Page, name: string) =>
  steps(page).filter({ has: page.locator('h3', { hasText: new RegExp(`^${name}$`) }) });

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
  conduit: ['Code', 'CI', 'Image in GHCR', 'Staging-Deployment'],
};

test.describe('Software Delivery', () => {
  test('[AK3] Videoflix zeigt den Stand der Testdaten ehrlich', async ({ page }) => {
    await serveStatus(page);
    await page.goto('/projekte/videoflix/');
    await expect(signal(page)).toContainText('2 von 6 belegt');
    await expect(signal(page)).toContainText('zuletzt 05.11.');
    await expect(delivery(page).locator('.step h3')).toHaveText(stepNames.videoflix);
    await expect(delivery(page).locator('.step-arrow')).toHaveText([
      'CI',
      'Image',
      'Deploy',
      'Betrieb',
      'Backup',
    ]);
    await expect(step(page, 'Code').locator('.state')).toHaveText('Belegt');
    await expect(step(page, 'Signed Build').locator('.state')).toHaveText('Teilweise');
    await expect(step(page, 'Signed Build')).toContainText('die Signatur fehlt noch');
    await expect(step(page, 'Deployment').locator('.state')).toHaveText('Nicht abrufbar');
    await expect(step(page, 'Restore-Test').locator('.state')).toHaveText(
      'Noch nicht eingerichtet',
    );
    await expect(notice(page)).toBeEmpty();
  });

  test('[AK3] die Website hat keinen Restore-Schritt', async ({ page }) => {
    await serveStatus(page);
    await page.goto('/projekte/portfolio/');
    await expect(delivery(page).locator('.step h3')).toHaveText(stepNames.portfolio);
    await expect(signal(page)).toContainText('4 von 5 belegt');
    await expect(page.locator('main .how-built')).toHaveCount(0);
  });

  test('[AK4] eine Abweichung erscheint als Abweichung und zählt nicht', async ({ page }) => {
    await serveStatus(page, (document) => {
      document.projects.portfolio.live.signals.components[0].matchesLatestGreen = false;
    });
    await page.goto('/projekte/portfolio/');
    await expect(step(page, 'Deployment').locator('.state-deviation')).toHaveText('Abweichung');
    await expect(step(page, 'Deployment')).toContainText('weicht vom zuletzt geprüften Commit ab');
    await expect(signal(page)).toContainText('3 von 5 belegt');
  });

  test('[Spec 6.4] Conduit behauptet weder Tests noch Scan', async ({ page }) => {
    await serveStatus(page);
    await page.goto('/projekte/conduit/');
    await expect(delivery(page).locator('.step h3')).toHaveText(stepNames.conduit);
    await expect(step(page, 'CI')).toContainText(
      'Jede Änderung wird automatisch gebaut und validiert.',
    );
    await expect(delivery(page)).not.toContainText(/getestet|Schwachstellen/);
    await expect(step(page, 'Staging-Deployment').locator('.state')).toHaveText(
      'Noch nicht eingerichtet',
    );
    await expect(steps(page).last()).toHaveClass(/step-open/);
  });

  test('[Spec 6.4] grüner Deploy-Lauf ohne Live-Nachweis wird genau so benannt', async ({
    page,
  }) => {
    await serveStatus(page, (document) => {
      document.projects.conduit!.checks.signals.workflows.push({
        repo: 'PhilippKlinger/conduit-container',
        workflow: 'Deploy',
        file: 'deploy.yml',
        kind: 'deploy',
        reachable: true,
        conclusion: 'success',
        headSha: 'fda73f26ff7880681f05ad4aa1409bf6b4eeeeb2',
        completedAt: '2026-11-06T10:42:00Z',
      });
    });
    await page.goto('/projekte/conduit/');
    const staging = step(page, 'Staging-Deployment');
    await expect(staging).toContainText(
      'Der letzte Deploy-Lauf war erfolgreich, der laufende Stand ist nicht abrufbar.',
    );
    await expect(staging.locator('.state')).toHaveText('Teilweise');
    await expect(staging.locator('.step-event')).toContainText('06.11., 11:42');
  });

  test('[Spec 6.1] veralteter Stand wird benannt', async ({ page }) => {
    await serveStatus(page, (document) => {
      document.generatedAt = '2026-01-01T00:00:00Z';
    });
    await page.goto('/projekte/videoflix/');
    await expect(notice(page)).toHaveText(stale);
    await expect(steps(page)).toHaveCount(6);
  });

  test('[AK8] Artefakte sind direkte Links ab 44 px, höchstens 3 je Schritt', async ({ page }) => {
    await serveStatus(page);
    await page.goto('/projekte/videoflix/');
    await expect(signal(page)).toContainText('2 von 6 belegt');
    for (const item of await steps(page).all()) {
      const links = item.locator('.step-links a');
      expect(await links.count()).toBeLessThanOrEqual(3);
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute('href', /^https:\/\//);
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await expect(
      step(page, 'Tests & Security-Checks').locator('.step-links a').first(),
    ).toHaveAttribute('href', /\/actions\/runs\/\d+$/);
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
    await expect(steps(page)).toHaveCount(5);
  });
});

test.describe('Abruf von /status.json', () => {
  test('[Spec 6.1] der Abruf ersetzt den vorgerenderten Stand', async ({ page }) => {
    await serveStatus(page, (document) => markWithPullRequests(document, 4711));
    await page.goto('/projekte/videoflix/');
    await expect(step(page, 'Code').locator('.step-event')).toContainText(
      '4711 gemergte Pull Requests',
    );
    await expect(step(page, 'Code').locator('.state')).toHaveText('Belegt');
    await expect(step(page, 'Code').locator('.step-links a').first()).toHaveAttribute(
      'href',
      'https://github.com/PhilippKlinger/videoflix-backend',
    );
  });

  test('[Spec 6.1] die Seite fragt genau einmal', async ({ page }) => {
    const requests = await serveStatus(page);
    await page.goto('/projekte/videoflix/');
    await expect(signal(page)).toContainText('2 von 6 belegt');
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
    await expect(step(page, 'Code').locator('.step-event')).toContainText('2000 gemergte');
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
    await expect(step(page, 'Code').locator('.step-event')).toContainText('1000 gemergte');
  });

  for (const [name, respond] of [
    ['Serverfehler', { status: 500, body: 'error' }],
    ['abgeschnittener Upload', { status: 200, body: '{"schemaVersion":1,"genera' }],
    ['HTML statt JSON', { status: 200, contentType: 'text/html', body: '<!doctype html>' }],
    ['anderes Schema', { status: 200, json: { schemaVersion: 2, generatedAt: 'x', projects: {} } }],
  ] as const) {
    test(`[AK6] ${name}: freundlicher Hinweis, Schritte bleiben vollständig`, async ({ page }) => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await page.route('**/status.json', (route) => route.fulfill(respond));
      await page.goto('/projekte/videoflix/');
      await expect(notice(page)).toHaveText(refreshFailed);
      await expect(delivery(page).locator('.step h3')).toHaveText(stepNames.videoflix);
      await expect(steps(page).first().locator('.state')).toHaveText('Nicht abrufbar');
      expect(errors).toEqual([]);
    });
  }

  test('[AK6] kaputter Conduit-Block: die ganze Datei gilt als unbrauchbar', async ({ page }) => {
    await serveStatus(page, (document) => {
      (document.projects as unknown as Record<string, unknown>)['conduit'] = { code: {} };
    });
    await page.goto('/projekte/videoflix/');
    await expect(notice(page)).toHaveText(refreshFailed);
    await expect(steps(page)).toHaveCount(6);
  });

  test('[AK6] Abbruch der Verbindung: freundlicher Hinweis', async ({ page }) => {
    await page.route('**/status.json', (route) => route.abort());
    await page.goto('/projekte/videoflix/');
    await expect(notice(page)).toHaveText(refreshFailed);
    await expect(steps(page)).toHaveCount(6);
  });

  test.describe('alter Stand ohne Conduit', () => {
    const withoutConduit: Change = (document) => delete document.projects.conduit;

    test('[AK6] die Conduit-Seite meldet es und bleibt vollständig', async ({ page }) => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await serveStatus(page, withoutConduit);
      await page.goto('/projekte/conduit/');
      await expect(notice(page)).toHaveText(refreshFailed);
      await expect(delivery(page).locator('.step h3')).toHaveText(stepNames.conduit);
      await expect(step(page, 'CI').locator('.state')).toHaveText('Nicht abrufbar');
      await expect(signal(page)).toContainText('0 von 4 belegt');
      expect(errors).toEqual([]);
    });

    test('[AK6] Videoflix zeigt denselben Stand normal', async ({ page }) => {
      await serveStatus(page, withoutConduit);
      await page.goto('/projekte/videoflix/');
      await expect(signal(page)).toContainText('2 von 6 belegt');
      await expect(notice(page)).toBeEmpty();
    });
  });

  for (const slug of ['neuro-check-in', 'developer-workspace-kit']) {
    test(`[Spec 6.1] fester Inhalt fragt nichts ab: ${slug}`, async ({ page }) => {
      const requests = await serveStatus(page);
      await page.goto(`/projekte/${slug}/`);
      await expect(steps(page)).toHaveCount(3);
      await page.waitForLoadState('networkidle');
      expect(requests()).toBe(0);
      await expect(notice(page)).toBeEmpty();
    });
  }
});

test.describe('Fester Inhalt', () => {
  test('[AK3] Neuro Check-in: Release mit Link, der Rest Code privat', async ({ page }) => {
    await page.goto('/projekte/neuro-check-in/');
    await expect(signal(page)).toContainText('1 von 3 öffentlich belegt, Code privat');
    await expect(signal(page)).toContainText('Version 1.11.2');
    await expect(step(page, 'Code').locator('.state-private')).toHaveText('Code privat');
    const release = step(page, 'Release im Play Store');
    await expect(release.locator('.state-verified')).toHaveText('Belegt');
    await expect(release.locator('.step-event')).toHaveText('Version 1.11.2');
    await expect(release.locator('.step-links a')).toHaveAttribute(
      'href',
      /^https:\/\/play\.google\.com\//,
    );
  });

  test('[AK3] Kit: alles Code privat, ohne leeren Link-Block', async ({ page }) => {
    await page.goto('/projekte/developer-workspace-kit/');
    await expect(signal(page)).toContainText('Öffentliches Repo folgt');
    await expect(signal(page)).toContainText('Version 0.5.0');
    await expect(delivery(page).locator('.state-private')).toHaveCount(3);
    await expect(page.locator('main .links')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Links', exact: true })).toHaveCount(0);
  });
});

test.describe('Ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('[AK7] vollständig lesbar ohne JavaScript', async ({ page }) => {
    await page.goto('/projekte/videoflix/');
    await expect(page.locator('main h1')).toHaveText('Videoflix');
    await expect(signal(page)).toContainText('von 6 belegt');
    await expect(delivery(page).locator('.step h3')).toHaveText(stepNames.videoflix);
    await expect(delivery(page).locator('.state')).toHaveCount(6);
    await expect(delivery(page).locator('.step-sentence')).toHaveCount(6);
    await expect(page.locator('main .links a')).toHaveCount(2);
    await expect(page.locator('main a.back')).toHaveAttribute('href', '/#projekte');
  });

  test('[AK7] fester Inhalt samt Beleg ohne JavaScript', async ({ page }) => {
    await page.goto('/projekte/neuro-check-in/');
    await expect(step(page, 'Release im Play Store').locator('.step-links a')).toBeVisible();
    await expect(notice(page)).toBeEmpty();
  });
});
