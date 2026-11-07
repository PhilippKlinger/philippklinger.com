import type { Page } from '@playwright/test';

/**
 * Stops the pipeline of the hero and waits for its fades, on pages that have it. A value in the
 * middle of a fade has a contrast of its own that says nothing about the page.
 */
export async function holdHero(page: Page): Promise<void> {
  if ((await page.locator('app-hero-pipeline').count()) === 0) return;
  await page.locator('app-hero-pipeline .pause').click();
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}
