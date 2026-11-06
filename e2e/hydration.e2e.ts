import { expect, Page, test } from '@playwright/test';

// With ngskiphydration on the root the browser drops the prerendered DOM and renders it again.
// Production builds skip most mismatch checks, so the removed ngh markers prove the hydration:
// Angular takes each marker off the element it has hydrated.
const paths = ['/', '/projekte/videoflix/'];

function collectHydrationProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    const isProblem = message.type() === 'warning' || message.type() === 'error';
    const text = message.text();
    if (/NG05\d\d/.test(text) || (isProblem && /hydrat/i.test(text))) problems.push(text);
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

for (const path of paths) {
  test(`[Hydration] ${path} kommt vorgerendert mit ngh-Markern`, async ({ request }) => {
    const html = await (await request.get(path)).text();
    const appRoot = html.match(/<app-root[^>]*>/)?.[0];
    expect(appRoot).toBeDefined();
    expect(appRoot).not.toContain('ngskiphydration');
    expect(appRoot).toMatch(/\sngh="\d+"/);
  });

  test(`[Hydration] ${path} hydriert im Browser ohne Meldungen`, async ({ page }) => {
    const problems = collectHydrationProblems(page);
    await page.goto(path);
    await expect(page.locator('app-root')).not.toHaveAttribute('ngskiphydration');
    await expect(page.locator('[ngh]')).toHaveCount(0);
    await expect(page.locator('app-footer')).toBeVisible();
    expect(problems).toEqual([]);
  });
}
