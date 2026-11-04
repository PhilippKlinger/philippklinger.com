import { test } from '@playwright/test';
import { pages } from './support/site';

// Full-page screenshots of every page in every viewport, uploaded as CI artifact.
// They are the basis for the comparison with the design template (docs/design/
// in the private workspace). Not a pass/fail check: baselines follow once the
// design is settled (implementation notes, 2026-11-04).
for (const path of pages) {
  test(`Screenshot ${path}`, async ({ page }, testInfo) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const name = path === '/' ? 'start' : path.replaceAll('/', '');
    await page.screenshot({
      path: `e2e-report/screens/${testInfo.project.name}-${name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}
