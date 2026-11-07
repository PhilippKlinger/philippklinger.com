import { readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { ProjectStatus, StatusDocument } from '../src/content/status';
import { holdHero } from './support/motion';

// The delivery chain in the hero (docs/plan-hero.md, H1 to H7). A real snapshot of status.json
// with a time set per test, completed by what the collector writes for this website since #46.
const fixtureText = readFileSync('e2e/fixtures/status.json', 'utf8');
const NEWER_SHA = 'ddfaedb5786de39377d4dc470f5f9fa800dda8e2';
const ALL_DONE = ['done', 'done', 'done', 'done', 'done', 'done'];
// One full run: 6 × 0.9 s ring, 5 × 0.8 s travel, 3.5 s hold, 0.4 s fade, plus some slack.
const ONE_RUN_MS = 16_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Change = (status: ProjectStatus) => void;

function statusDocument(change: Change = () => undefined): StatusDocument {
  const document = JSON.parse(fixtureText) as StatusDocument;
  document.generatedAt = new Date().toISOString();
  const status = document.projects.portfolio;
  const [ci] = status.checks.signals.workflows;
  status.checks.signals.workflows.push({
    ...ci,
    workflow: 'Deploy preview',
    file: 'deploy.yml',
    kind: 'deploy',
  });
  status.stability = {
    reachable: true,
    signals: {
      ...status.stability.signals,
      monitorsTotal: 1,
      monitorsUp: 1,
      uptime24h: 0.9985,
    },
    links: [
      { kind: 'status-page', source: 'portfolio', url: 'https://status.example.com/portfolio' },
    ],
  };
  change(status);
  return document;
}

const openWith = async (page: Page, change?: Change) => {
  const served = statusDocument(change);
  await page.route('**/status.json', (route) => route.fulfill({ json: served }));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
};

const station = (page: Page) => page.locator('.hero .station');
const states = (page: Page) =>
  station(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-state')));
const pause = (page: Page) => page.locator('.hero .pause');
const note = (page: Page) => page.locator('.hero .note');
const progress = (page: Page) =>
  page.locator('app-hero-pipeline').evaluate((el) => el.style.getPropertyValue('--p'));
const hiddenValues = (page: Page) =>
  page
    .locator('.hero .value')
    .evaluateAll((values) => values.filter((v) => getComputedStyle(v).opacity !== '1').length);
const desktopOnly = (testInfo: TestInfo) =>
  test.skip(testInfo.project.name !== 'desktop', 'Breiten stellt der Test selbst ein');

const expectHeld = async (page: Page) => {
  await expect.poll(() => hiddenValues(page)).toBe(0);
  const held = await progress(page);
  await page.waitForTimeout(500);
  expect(await progress(page), 'die Linie steht').toBe(held);
  return held;
};

test.describe('Zustände', () => {
  test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

  test('[H1] alles grün: sechs Stationen bis Monitoring, kein Satz', async ({ page }) => {
    await openWith(page);
    await expect.poll(() => states(page)).toEqual(ALL_DONE);
    await expect(note(page)).toHaveCount(0);
    await expect(station(page).locator('.label')).toHaveText([
      'Code',
      'Tests & Security',
      'Signed Build',
      'Preview',
      'Production',
      'Monitoring',
    ]);
    await expect(station(page).locator('.value')).toHaveText([
      '28 merged PRs',
      'CI · CodeQL passing',
      'Attestation · SBOM',
      'Smoke test passing',
      '82dcf43',
      'Uptime 99.85 %',
    ]);
  });

  test('[H1] Station rot: hält dort an, Production bleibt online, Satz in Rot', async ({
    page,
  }) => {
    await openWith(page, (status) => {
      status.checks.signals.workflows[0].conclusion = 'failure';
    });
    await expect
      .poll(() => states(page))
      .toEqual(['done', 'failed', 'open', 'open', 'held', 'held']);
    await expect(station(page).nth(1).locator('.value')).toContainText('CI failing');
    await expect(station(page).nth(1).locator('.cross')).toHaveCSS('opacity', '1');
    await expect(station(page).nth(2).locator('.value')).toHaveText('—');
    await expect(station(page).nth(4).locator('.value')).toHaveText('82dcf43');
    await expect(note(page)).toHaveText(
      'Gestoppt bei Tests & Security, Production bleibt auf 82dcf43.',
    );
    await expect(note(page)).toHaveClass(/alert/);
  });

  test('[H1] Preview neuer als Production: wartet, ohne Rot', async ({ page }) => {
    await openWith(page, (status) => {
      status.checks.signals.workflows[2].headSha = NEWER_SHA;
    });
    await expect.poll(() => states(page)).toEqual(['done', 'done', 'done', 'done', 'held', 'held']);
    await expect(note(page)).toHaveText('Production wartet auf Freigabe, online ist 82dcf43.');
    await expect(note(page)).not.toHaveClass(/alert/);
  });

  test('[H1] Monitoring meldet einen Ausfall: nur die letzte Station ist rot', async ({ page }) => {
    await openWith(page, (status) => {
      status.stability.signals.monitorsUp = 0;
    });
    await expect
      .poll(() => states(page))
      .toEqual(['done', 'done', 'done', 'done', 'done', 'failed']);
    await expect(station(page).nth(5).locator('.value')).toHaveText('down');
    await expect(note(page)).toHaveText('Monitoring meldet einen Ausfall.');
  });

  test('[H1] noch keine Kuma-Daten: Monitoring hohl mit Strich, kein Satz', async ({ page }) => {
    await openWith(page, (status) => {
      status.stability.signals.monitorsTotal = null;
    });
    await expect.poll(() => states(page)).toEqual(['done', 'done', 'done', 'done', 'done', 'held']);
    await expect(station(page).nth(5).locator('.value')).toHaveText('—');
    await expect(note(page)).toHaveCount(0);
  });

  test('[H1] Daten älter als einen Tag: nennt es auch im Hero', async ({ page }) => {
    const document = statusDocument();
    document.generatedAt = new Date(Date.now() - 2 * DAY_MS).toISOString();
    await page.route('**/status.json', (route) => route.fulfill({ json: document }));
    await page.goto('/');
    await expect(page.locator('.hero .title')).toContainText(
      'Dieser Stand ist älter als einen Tag.',
    );
  });

  test('[H1] keine Daten: keine Häkchen, freundlicher Satz, Links bleiben', async ({ page }) => {
    await page.route('**/status.json', (route) => route.fulfill({ status: 500, body: 'error' }));
    await page.goto('/');
    await expect(page.locator('.hero .title')).toContainText(
      'Dieser Stand ist gerade nicht abrufbar.',
    );
    await expect(page.locator('.hero [data-state="done"]')).toHaveCount(0);
    await expect(page.locator('.hero .value a')).toHaveText([
      'Repository',
      'Workflows',
      'Attestation',
      'SBOM',
    ]);
  });
});

test.describe('Schleife', () => {
  test('[H3] läuft Station für Station bis Monitoring und beginnt von vorn', async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo);
    test.slow();
    await openWith(page);
    await expect(page.locator('.hero .pipe')).toHaveClass(/loop/);
    // On the way: the station in work spins, its value is not there yet.
    const running = page.locator('.hero [data-state="running"]');
    await expect(running).toHaveCount(1);
    await expect(running.locator('.spin')).toHaveCSS('opacity', '1');
    await expect(running.locator('.value')).toHaveCSS('opacity', '0');

    await expect.poll(() => states(page), { timeout: ONE_RUN_MS }).toEqual(ALL_DONE);
    await expect
      .poll(async () => (await states(page))[0], { timeout: ONE_RUN_MS })
      .not.toBe('done');
  });

  test('[H3 · WCAG 2.2.2] Pause hält an, zeigt alle Werte und setzt fort', async ({ page }) => {
    await openWith(page);
    await expect(pause(page)).toHaveAccessibleName('Bewegung anhalten');
    await expect(pause(page)).toHaveAttribute('aria-pressed', 'false');
    await pause(page).click();
    await expect(pause(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(pause(page)).toHaveAccessibleName('Bewegung fortsetzen');
    const held = await expectHeld(page);

    // Pointer and focus stay on the control, as after any click: the run must continue anyway.
    await pause(page).click();
    await expect.poll(() => progress(page)).not.toBe(held);
  });

  test('[H3] Hover hält an und zeigt alle Werte', async ({ page }) => {
    test.skip(page.viewportSize()!.width < 768, 'kein Hover auf Touch');
    await openWith(page);
    await expect(page.locator('.hero .pipe')).toHaveClass(/loop/);
    await page.locator('.hero .box').hover();
    const held = await expectHeld(page);
    await page.mouse.move(0, 0);
    await expect.poll(() => progress(page)).not.toBe(held);
  });

  test('[H3] Tastaturfokus auf einem Link hält an und zeigt alle Werte', async ({ page }) => {
    await openWith(page);
    await pause(page).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('.hero .value a').first()).toBeFocused();
    await expectHeld(page);
  });
});

test.describe('Ohne Bewegung', () => {
  test('[H4] Reduced Motion: Endzustand, kein Pause-Knopf, keine Animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWith(page);
    await expect.poll(() => states(page)).toEqual(ALL_DONE);
    await expect(pause(page)).toHaveCount(0);
    expect(await hiddenValues(page)).toBe(0);
    const running = await page
      .locator('.hero')
      .evaluate((hero) => hero.getAnimations({ subtree: true }).length);
    expect(running).toBe(0);
  });

  test.describe('ohne JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('[H4] zeigt den Stand aus dem Prerender vollständig', async ({ page }) => {
      await page.goto('/');
      await expect(station(page)).toHaveCount(6);
      await expect(pause(page)).toHaveCount(0);
      for (const value of await page.locator('.hero .value').all()) {
        await expect(value).toBeVisible();
        await expect(value).toHaveCSS('opacity', '1');
      }
    });
  });
});

test.describe('Aufbau', () => {
  const cases: [string, Change | undefined][] = [
    ['alles grün', undefined],
    [
      'zwei rote Prüfungen',
      (status) => {
        status.checks.signals.workflows[0].conclusion = 'failure';
        status.checks.signals.workflows[1].conclusion = 'failure';
      },
    ],
  ];

  for (const [name, change] of cases) {
    test(`[H5] kein Überlauf, keine Überlappung, letzte Station am Rand: ${name}`, async ({
      page,
    }, testInfo) => {
      desktopOnly(testInfo);
      await openWith(page, change);
      for (const width of [390, 768, 1099, 1100, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        const view = await page.locator('.hero').evaluate((hero) => {
          const edges = (selector: string, item: Element) => {
            const { left, right } = item.querySelector(selector)!.getBoundingClientRect();
            return { left, right };
          };
          const padding = parseFloat(getComputedStyle(hero).paddingRight);
          return {
            edge: hero.getBoundingClientRect().right - padding,
            stations: [...hero.querySelectorAll('.station')].map((item) => ({
              label: edges('.label', item),
              value: edges('.value', item),
              node: edges('.node', item),
            })),
            scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
        expect(view.scroll, `${width}: waagerechtes Scrollen`).toBeLessThanOrEqual(0);
        for (const { label, value } of view.stations) {
          expect(value.right, `${width}: Wert über dem Rand`).toBeLessThanOrEqual(view.edge + 1);
          if (width < 1100) {
            expect(value.left, `${width}: Wert auf der Beschriftung`).toBeGreaterThanOrEqual(
              label.right,
            );
          }
        }
        if (width >= 1100) {
          for (const [index, { value }] of view.stations.slice(1).entries()) {
            expect(value.left, `${width}: Werte überlappen`).toBeGreaterThanOrEqual(
              view.stations[index].value.right,
            );
          }
          const last = view.stations.at(-1)!.node.right;
          expect(Math.abs(last - view.edge), `${width}: Linie endet am Rand`).toBeLessThan(1);
        }
      }
    });
  }

  for (const size of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
  ]) {
    test(`[H6] genau eine Bildschirmhöhe bei ${size.width} × ${size.height}`, async ({
      page,
    }, testInfo) => {
      desktopOnly(testInfo);
      await page.setViewportSize(size);
      await openWith(page);
      const hero = (await page.locator('.hero').boundingBox())!;
      expect(hero.height).toBe(size.height);
      const next = (await page.locator('#ueber-mich').boundingBox())!;
      expect(next.y, 'nächster Abschnitt bleibt verdeckt').toBeGreaterThanOrEqual(size.height);
    });
  }
});

test('[H7] Linkziele der Werte mindestens 24 px', async ({ page }) => {
  await openWith(page);
  await holdHero(page);
  for (const link of await page.locator('.hero .value a').all()) {
    const size = (await link.boundingBox())!;
    expect(size.height, 'Linkziel').toBeGreaterThanOrEqual(24);
    expect(size.width, 'Linkziel').toBeGreaterThanOrEqual(24);
  }
});
