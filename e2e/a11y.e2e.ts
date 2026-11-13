import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { holdHero, revealSections } from './support/motion';
import { notFoundPage, pages } from './support/site';

// Spec 4: axe-core on every route, WCAG 2.2 AA, 0 violations (blocking from stage 2).
// Runs in every viewport, because layout, menu and target sizes differ per breakpoint.
const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const path of [...pages, notFoundPage]) {
  test(`[Spec 4 · WCAG 2.2 AA] axe ohne Verstöße auf ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    // The hero first: held, it stays as it is while the sections are scrolled into view.
    await holdHero(page);
    await revealSections(page);
    const { violations } = await new AxeBuilder({ page }).withTags(wcag).analyze();
    const readable = violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} → ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(' | ')}`,
    );
    // The message is the first error line, so the CI summary names the rules.
    expect(violations.length, readable.join(' ; ')).toBe(0);
  });
}
