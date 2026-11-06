import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Evidence chain on /projekte/videoflix/ and /projekte/portfolio/ (spec stage 4).
// A real snapshot of status.json from the preview, with a time set per test.
const fixtureText = readFileSync('e2e/fixtures/status.json', 'utf8');

type Change = (document: {
  generatedAt: string;
  projects: Record<string, { live: { signals: { components: Record<string, unknown>[] } } }>;
}) => void;

function serveStatus(page: Page, change: Change = () => undefined) {
  const document = JSON.parse(fixtureText);
  document.generatedAt = new Date().toISOString();
  change(document);
  return page.route('**/status.json', (route) => route.fulfill({ json: document }));
}

const chain = (page: Page) => page.locator('app-evidence-chain');
const station = (page: Page, title: string) =>
  chain(page)
    .locator('.stations > li')
    .filter({ has: page.locator('.station-title', { hasText: new RegExp(`^${title}$`) }) });

test.describe('Nachweiskette', () => {
  test('[Stufe 4] zeigt Videoflix ehrlich: belegt ist nur, was die Daten belegen', async ({
    page,
  }) => {
    await serveStatus(page);
    await page.goto('/projekte/videoflix/');
    await expect(chain(page).locator('.summary')).toContainText('2 von 6 belegt');
    await expect(chain(page).locator('.stations > li')).toHaveCount(6);
    await expect(station(page, 'Code')).toContainText('Belegt');
    await expect(station(page, 'Wiederherstellung getestet')).toContainText('Nicht abrufbar');
    await expect(chain(page).locator('.notice')).toBeEmpty();
  });

  test('[Stufe 4] zeigt die Seite selbst, Restore-Test ausdrücklich nicht vorgesehen', async ({
    page,
  }) => {
    await serveStatus(page);
    await page.goto('/projekte/portfolio/');
    await expect(chain(page).locator('.summary')).toContainText('4 von 6 belegt');
    await expect(station(page, 'Wiederherstellung getestet')).toContainText('Nicht vorgesehen');
  });

  test('[Stufe 4] eine Abweichung erscheint als Abweichung und zählt nicht', async ({ page }) => {
    await serveStatus(page, (document) => {
      document.projects['portfolio'].live.signals.components[0]['matchesLatestGreen'] = false;
    });
    await page.goto('/projekte/portfolio/');
    await expect(station(page, 'Live = geprüfter Stand')).toContainText('Abweichung');
    await expect(chain(page).locator('.summary')).toContainText('3 von 6 belegt');
  });

  test('[Stufe 4] veralteter Stand wird benannt', async ({ page }) => {
    await serveStatus(page, (document) => {
      document.generatedAt = '2026-01-01T00:00:00Z';
    });
    await page.goto('/projekte/videoflix/');
    await expect(chain(page).locator('.notice')).toHaveText(
      'Dieser Stand ist älter als einen Tag.',
    );
  });

  for (const [name, respond] of [
    ['Serverfehler', { status: 500, body: 'error' }],
    ['abgeschnittener Upload', { status: 200, body: '{"schemaVersion":1,"genera' }],
    ['HTML statt JSON', { status: 200, contentType: 'text/html', body: '<!doctype html>' }],
  ] as const) {
    test(`[Stufe 4] ${name}: freundlicher Hinweis, Kette bleibt vollständig`, async ({ page }) => {
      await page.route('**/status.json', (route) => route.fulfill(respond));
      await page.goto('/projekte/videoflix/');
      await expect(chain(page).locator('.notice')).toHaveText(
        'Der aktuelle Stand ist gerade nicht abrufbar.',
      );
      await expect(chain(page).locator('.stations > li')).toHaveCount(6);
    });
  }

  test('[Stufe 4] Details per Tastatur, mit Kennzahlen und Link aufs Artefakt', async ({
    page,
  }) => {
    await serveStatus(page);
    await page.goto('/projekte/videoflix/');
    const code = station(page, 'Code');
    const artifact = code.locator('.artifacts a').first();
    await expect(artifact).toBeHidden();
    await code.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(artifact).toBeVisible();
    await expect(artifact).toHaveAttribute('href', /^https:\/\/github\.com\/PhilippKlinger\//);
    await expect(code.locator('.facts')).toContainText('gemergte Pull Requests');
    const box = (await artifact.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('[Regel web-quality] Stationen sind Touch-Ziele ab 44 px', async ({ page }) => {
    await page.goto('/projekte/videoflix/');
    for (const summary of await chain(page).locator('summary').all()) {
      expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('[Spec 5] der Stand kommt von der eigenen Domain', async ({ page, baseURL }) => {
    const response = page.waitForResponse('**/status.json');
    await page.goto('/projekte/videoflix/');
    expect(new URL((await response).url()).origin).toBe(baseURL);
  });

  test('[Stufe 3] Projekte ohne Kette zeigen keine', async ({ page }) => {
    await page.goto('/projekte/conduit/');
    await expect(chain(page)).toHaveCount(0);
  });

  test('[Grill 04.11. Option A] die Seite ist über den Footer erreichbar', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer').getByRole('link', { name: 'So ist diese Seite gebaut' }).click();
    await expect(page).toHaveURL(/\/projekte\/portfolio\/?$/);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(chain(page)).toBeVisible();
  });

  test('[Stufe 4] die Startseite listet weiter vier Projekte', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#projekte a.project')).toHaveCount(4);
  });
});

test.describe('Nachweiskette ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('[Stufe 4] vollständig lesbar, Details lassen sich öffnen', async ({ page }) => {
    await page.goto('/projekte/videoflix/');
    await expect(chain(page).locator('.summary')).toContainText('von 6 belegt');
    await expect(chain(page).locator('.summary')).toContainText('Stand');
    await expect(chain(page).locator('.stations > li')).toHaveCount(6);
    const summary = chain(page).locator('summary').first();
    await summary.click();
    await expect(chain(page).locator('details').first()).toHaveAttribute('open', '');
  });
});
