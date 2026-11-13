import { test } from '@playwright/test';
import { revealSections } from './support/motion';
import { pages } from './support/site';

// Full-page screenshots of every page in every viewport, uploaded as CI artifact.
// They are the basis for the comparison with the design (docs/design/
// in the private workspace). Not a pass/fail check: baselines follow once the
// design is settled (implementation notes, 2026-11-04).
for (const path of pages) {
  test(`Screenshot ${path}`, async ({ page }, testInfo) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await revealSections(page);
    const name = path === '/' ? 'start' : path.replaceAll('/', '');
    await page.screenshot({
      path: `e2e-report/screens/${testInfo.project.name}-${name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    // First screen only: what a visitor sees before scrolling (the hero).
    await page.screenshot({
      path: `e2e-report/screens/${testInfo.project.name}-${name}-erster-bildschirm.png`,
      animations: 'disabled',
    });
  });
}
