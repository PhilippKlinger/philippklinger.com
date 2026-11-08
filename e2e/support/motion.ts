import { expect, type Page } from '@playwright/test';

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

declare global {
  interface Window {
    frameRequests: number;
  }
}

/** Counts the frame requests of the page, as in cursor-cta.e2e.ts; call before page.goto. */
export const countFrames = (page: Page) =>
  page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    window.frameRequests = 0;
    window.requestAnimationFrame = (callback) => {
      window.frameRequests += 1;
      return request(callback);
    };
  });

const frameRequests = (page: Page) => page.evaluate(() => window.frameRequests);

export async function expectFramesRunning(page: Page): Promise<void> {
  const before = await frameRequests(page);
  await expect.poll(() => frameRequests(page)).toBeGreaterThan(before + 5);
}

export async function expectNoFrames(page: Page): Promise<void> {
  // Angular's scheduler may ask for one more frame right after the last state change.
  await page.waitForTimeout(200);
  const settled = await frameRequests(page);
  await page.waitForTimeout(300);
  expect(await frameRequests(page), 'keine Frames').toBe(settled);
}
