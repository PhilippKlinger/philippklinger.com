import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { notFoundPage, pages } from './support/site';

// axe cannot see through the canvas and answers "incomplete" for text above it, so text on
// the haze is checked here against a plain background in its brightest colour. The shader
// limits its colour to .115, .315, .275 and adds at most .006 of grain: 31, 82, 72 in 8 bit,
// also the highest value measured on the running shader. (Spec 8.1, WCAG 1.4.3)
const brightestHaze = 'rgb(31 82 72)';

for (const path of [...pages, notFoundPage]) {
  test(`[Spec 8.1 · WCAG 1.4.3] Kontrast auf dem hellsten Haze: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    // Without the darker gradients of the sections, which axe could not judge either.
    await page.addStyleTag({
      content: `app-haze { display: none; } body { background: ${brightestHaze}; }
        * { background-image: none !important; }`,
    });
    const { violations, passes, incomplete } = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();
    const readable = violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')));
    expect(readable, 'Text unter 4,5:1').toEqual([]);
    expect(passes.flatMap((p) => p.nodes).length, 'der Lauf hat Text geprüft').toBeGreaterThan(0);
    // Decorative characters such as arrows are no text for axe.
    const undecided = incomplete
      .flatMap((v) => v.nodes)
      .filter((n) => !n.any.some((check) => check.data?.messageKey === 'nonBmp'))
      .map((n) => n.target.join(' '));
    expect(undecided, 'axe konnte nicht urteilen').toEqual([]);
  });
}
