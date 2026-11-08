import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectBehindContent, expectOneDecorativeLayer } from './support/haze';
import { countFrames, expectFramesRunning, expectNoFrames } from './support/motion';

// The only tests with WebGL: a software GPU gives a real context even with
// failIfMajorPerformanceCaveat. Reaching the "slow" state takes 120 frames, so about
// 5 seconds at the earliest. In parallel the shaders slow each other down until they
// get there, so these tests run one after the other.
test.describe.configure({ mode: 'serial' });
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
});

declare global {
  interface Window {
    hazeEnergy: number;
    linkReadsWhileLinking: boolean[];
  }
}

// Far above the grain of 1.5 steps per channel, far below the measured gain of 20.
const POINTER_GAIN = 8;

const desktopOnly = (testInfo: TestInfo) =>
  test.skip(testInfo.project.name !== 'desktop', 'SwiftShader nur auf einer Breite');
const haze = (page: Page) => page.locator('app-haze');
const canvas = (page: Page) => page.locator('app-haze canvas');
// Other animations stop for the picture, so only the canvas can make a difference.
const picture = (page: Page) => page.screenshot({ animations: 'disabled' });
const expectStillRunning = async (page: Page, moment: string) =>
  expect(
    await haze(page).getAttribute('data-haze-state'),
    `Der Haze muss ${moment} noch laufen`,
  ).toBe('running');

/**
 * Fewer pixels and nothing else to paint, so the frames stay far below the limit of 40 ms on
 * every machine, also next to other work, and the "slow" state cannot end the measurement.
 */
const openQuietPage = async (page: Page) => {
  await page.setViewportSize({ width: 600, height: 400 });
  await page.goto('/');
  await page.addStyleTag({ content: 'app-header, main, app-footer { display: none; }' });
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');
};

/** Resolves after this many real frames of the page. */
const waitForFrames = (page: Page, count: number) =>
  page.evaluate(
    (left) =>
      new Promise<void>((resolve) => {
        const step = () => (--left > 0 ? requestAnimationFrame(step) : resolve());
        requestAnimationFrame(step);
      }),
    count,
  );
/**
 * Mean brightness (0 to 255) of the painted canvas around a viewport position. The buffer
 * is only readable in the frame that drew it, and this callback runs after the one of the
 * haze. The mean of many pixels evens out the grain.
 */
const brightnessAround = (page: Page, x: number, y: number) =>
  canvas(page).evaluate(
    (el, [viewportX, viewportY]) =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          const element = el as HTMLCanvasElement;
          const gl = element.getContext('webgl')!;
          const size = 30;
          const left = Math.round((viewportX * element.width) / innerWidth - size / 2);
          const fromTop = (viewportY * element.height) / innerHeight;
          const bottom = Math.round(element.height - fromTop - size / 2);
          const pixels = new Uint8Array(size * size * 4);
          gl.readPixels(left, bottom, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          const colours = pixels.filter((_, index) => index % 4 !== 3);
          resolve(colours.reduce((sum, value) => sum + value, 0) / colours.length);
        });
      }),
    [x, y],
  );
/** Mean brightness (0 to 255) of what the screen shows behind the content. */
const backdropBrightness = async (page: Page) => {
  await page.addStyleTag({ content: 'app-header, main, app-footer { visibility: hidden; }' });
  const png = (await page.screenshot({ animations: 'disabled' })).toString('base64');
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const board = document.createElement('canvas');
    board.width = image.width;
    board.height = image.height;
    const context = board.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data: pixels } = context.getImageData(0, 0, image.width, image.height);
    const colours = pixels.filter((_, index) => index % 4 !== 3);
    return colours.reduce((sum, value) => sum + value, 0) / colours.length;
  }, png);
};

test('[AK9] läuft und bewegt sich mit dem Zeiger', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openQuietPage(page);
  await expect(canvas(page)).toHaveCSS('opacity', '1');

  const [nearX, nearY, farX, farY] = [100, 300, 560, 40];
  const before = await brightnessAround(page, nearX, nearY);
  await expectStillRunning(page, 'beim ersten Bild');
  await page.mouse.move(nearX, nearY);
  // At 0.07 per frame the light covers 96 % of its way in 45 frames.
  await waitForFrames(page, 45);
  const near = await brightnessAround(page, nearX, nearY);
  await page.mouse.move(farX, farY);
  await waitForFrames(page, 45);
  const after = await brightnessAround(page, nearX, nearY);
  await expectStillRunning(page, 'beim letzten Bild');

  // Far, near, far again: only the pointer explains a rise and a fall on this short time.
  expect(near, 'heller, wenn der Zeiger dort ist').toBeGreaterThan(before + POINTER_GAIN);
  expect(near, 'wieder dunkler, wenn er weg ist').toBeGreaterThan(after + POINTER_GAIN);
});

// Only records and still calls the original. The shader compiler drops a uniform that has no
// effect on the colour, so a shader that ignores the energy leaves nothing to record here.
const recordEnergy = (page: Page) =>
  page.addInitScript(() => {
    const { getUniformLocation, uniform1f } = WebGLRenderingContext.prototype;
    let energyLocation: WebGLUniformLocation | null = null;
    WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
      const location = getUniformLocation.call(this, program, name);
      if (name === 'uEnergy') energyLocation = location;
      return location;
    };
    WebGLRenderingContext.prototype.uniform1f = function (location, value) {
      if (location && location === energyLocation) window.hazeEnergy = value;
      uniform1f.call(this, location, value);
    };
  });

const hazeEnergy = (page: Page) => page.evaluate(() => window.hazeEnergy);

test('[PK-36] schnelle Bewegung gibt dem Haze einen Impuls, der abklingt', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo);
  await recordEnergy(page);
  await openQuietPage(page);
  await waitForFrames(page, 2);
  expect(await hazeEnergy(page), 'ohne Bewegung kein Impuls').toBe(0);

  await page.mouse.move(10, 10);
  await waitForFrames(page, 2);
  const after = await hazeEnergy(page);
  expect(after, 'die Strecke kommt an').toBeGreaterThan(0.2);

  await waitForFrames(page, 45);
  expect(await hazeEnergy(page), 'klingt von allein ab').toBeLessThan(after * 0.5);
  await expectStillRunning(page, 'beim letzten Bild');
});

// Only records and still calls the original. Reading the result of the link waits for the GPU
// to compile; in the task that links, the main thread would stand still for it.
const recordLinkReads = (page: Page) =>
  page.addInitScript(() => {
    const { linkProgram, getProgramParameter } = WebGLRenderingContext.prototype;
    let linking = false;
    window.linkReadsWhileLinking = [];
    WebGLRenderingContext.prototype.linkProgram = function (program) {
      linking = true;
      setTimeout(() => (linking = false));
      linkProgram.call(this, program);
    };
    WebGLRenderingContext.prototype.getProgramParameter = function (program, name) {
      if (name === this.LINK_STATUS) window.linkReadsWhileLinking.push(linking);
      return getProgramParameter.call(this, program, name);
    };
  });

test('[Spec 11 · TBT] liest das Ergebnis des Shaders erst nach dem Kompilieren', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo);
  await recordLinkReads(page);
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');
  expect(await page.evaluate(() => window.linkReadsWhileLinking)).toEqual([false]);
});

test('[AK9] liegt auch im Lauf als eine Ebene hinter dem Inhalt', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');
  await expect(canvas(page)).toHaveCSS('opacity', '1');

  await expectOneDecorativeLayer(page);
  await expectBehindContent(page);
});

test('[AK9] Reduced Motion: ein Standbild', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'still');
  await expect(canvas(page)).toHaveCSS('opacity', '1');

  await page.mouse.move(200, 300);
  const before = await picture(page);
  await page.mouse.move(1200, 600);
  await page.waitForTimeout(1000);

  expect(before.equals(await picture(page))).toBe(true);
  // An opaque canvas that was never drawn on shows as black, 0 here.
  expect(await backdropBrightness(page), 'das Standbild ist gezeichnet').toBeGreaterThan(15);
});

test('[AK9] wird Bewegung abgeschaltet, bleibt das Standbild', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openQuietPage(page);
  await waitForFrames(page, 2);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'still');

  // The grain changes about 12 times a second, so 30 frames would show in the picture.
  const still = await picture(page);
  await waitForFrames(page, 30);
  expect(still.equals(await picture(page)), 'keine Frames mehr').toBe(true);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await waitForFrames(page, 30);
  await expect(haze(page), 'Zurückschalten startet nichts neu').toHaveAttribute(
    'data-haze-state',
    'still',
  );
  expect(still.equals(await picture(page)), 'Zurückschalten zeichnet nichts').toBe(true);
  expect(await backdropBrightness(page), 'das Standbild ist gezeichnet').toBeGreaterThan(15);
});

test('[WCAG 2.2.2] der Pause-Knopf des Hero hält auch den Haze an', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.setViewportSize({ width: 600, height: 400 });
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');

  const pause = page.locator('.hero .pause');
  await pause.click();
  await waitForFrames(page, 2);
  // The grain changes about 12 times a second, so 30 frames would show in the picture.
  const still = await picture(page);
  await waitForFrames(page, 30);
  expect(still.equals(await picture(page)), 'keine Frames mehr').toBe(true);
  await expectStillRunning(page, 'in der Pause');

  await pause.click();
  await waitForFrames(page, 30);
  expect(still.equals(await picture(page)), 'läuft weiter').toBe(false);
});

test('[WCAG 2.2.2] in der Pause fragt der Haze keine Frames an', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await countFrames(page);
  await page.setViewportSize({ width: 600, height: 400 });
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');

  const pause = page.locator('.hero .pause');
  await pause.click();
  await expectNoFrames(page);
  await pause.click();
  await expectFramesRunning(page);
  await expectStillRunning(page, 'nach der Pause');
});

test('[AK9] nach Kontextverlust bleibt die statische Ebene', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');

  await canvas(page).evaluate((el) =>
    (el as HTMLCanvasElement)
      .getContext('webgl')
      ?.getExtension('WEBGL_lose_context')
      ?.loseContext(),
  );

  await expect(haze(page)).toHaveAttribute('data-haze-state', 'off');
  await expect(canvas(page)).toHaveCSS('opacity', '0');
  await expect(page.locator('.haze-static')).toBeVisible();
});

test('[Spec 8.1] kein Fehler in der Konsole, kein Fremdabruf', async ({
  page,
  baseURL,
}, testInfo) => {
  desktopOnly(testInfo);
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(baseURL!)) foreign.push(request.url());
  });

  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');
  await page.waitForTimeout(1000);

  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('[Spec 8.1] kurze Tabwechsel zählen nicht als langsame Frames', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openQuietPage(page);

  // Headless pages never get hidden. Blocking right after a frame gives the same gap in
  // the frames, and the events are the ones a tab switch fires around it. Below one second,
  // because frameTime ignores longer gaps by itself, and together too slow without the events.
  for (let pause = 0; pause < 5; pause++) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            document.dispatchEvent(new Event('visibilitychange'));
            const end = performance.now() + 900;
            while (performance.now() < end);
            document.dispatchEvent(new Event('visibilitychange'));
            resolve();
          });
        }),
    );
  }
  await waitForFrames(page, 130);

  await expectStillRunning(page, 'nach fünf Tabwechseln');
});

test('[Spec 13] zu langsam: statische Ebene, Kontext frei', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(haze(page)).toHaveAttribute('data-haze-state', 'running');

  // Real load on the main thread: every frame takes longer than the limit of 40 ms.
  await page.evaluate(() => {
    const burn = () => {
      const end = performance.now() + 55;
      while (performance.now() < end);
      requestAnimationFrame(burn);
    };
    requestAnimationFrame(burn);
  });

  await expect(haze(page)).toHaveAttribute('data-haze-state', 'slow', { timeout: 30_000 });
  await expect(canvas(page)).toHaveCSS('opacity', '0');
  await expect(page.locator('.haze-static')).toBeVisible();
  const lost = await canvas(page).evaluate((el) =>
    (el as HTMLCanvasElement).getContext('webgl')?.isContextLost(),
  );
  expect(lost, 'der Kontext ist freigegeben').toBe(true);
  await expect(haze(page), 'die Freigabe ist kein Ausfall').toHaveAttribute(
    'data-haze-state',
    'slow',
  );
});
