import { expect, test, type Page } from '@playwright/test';

// S5 (13.11.): each section of the start page fades in as it comes into view. Only browser code
// after hydration hides a section, and only one still below the view: without JavaScript, with
// reduced motion and for everything already on screen the page is there at once.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const sections = ['ueber-mich', 'skills', 'projekte', 'kontakt'];
const section = (page: Page, id: string) => page.locator(`#${id}`);
const opacity = (page: Page, id: string) =>
  section(page, id).evaluate((el) => getComputedStyle(el).opacity);

/** Two frames after hydration: by then the browser code of the start page has run. */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('[ngh]')).toHaveCount(0);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

/** Sections whose content reaches into the view but is not fully shown. */
const hiddenInView = (page: Page) =>
  page.locator('main .section').evaluateAll((all) =>
    all
      .filter((el) => {
        const { top, bottom } = el.getBoundingClientRect();
        return top + parseFloat(getComputedStyle(el).paddingTop) < innerHeight && bottom > 0;
      })
      .filter((el) => getComputedStyle(el).opacity !== '1')
      .map((el) => el.id),
  );

const expectNothingHiddenInView = (page: Page) =>
  expect.poll(() => hiddenInView(page), 'verborgen im Bild').toEqual([]);

async function jumpVia(page: Page, label: string): Promise<void> {
  if (isMobile(page)) await page.getByRole('button', { name: 'Menü' }).click();
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: label, exact: true })
    .click();
}

test.describe('Einblenden (S5)', () => {
  test('[S5] Abschnitte unter dem Bild warten verborgen und blenden beim Hineinscrollen ein', async ({
    page,
  }) => {
    await page.goto('/');
    for (const id of sections) {
      await expect(section(page, id), `#${id} wartet`).toHaveCSS('opacity', '0');
    }
    for (const id of sections) {
      await section(page, id).locator('h2').scrollIntoViewIfNeeded();
      await expect(section(page, id), `#${id} blendet ein`).toHaveCSS('opacity', '1');
      for (const child of await section(page, id).locator(':scope > *').all()) {
        await expect(child, `#${id}: Inhalt an seinem Platz`).toHaveCSS('translate', 'none');
      }
    }
  });

  // The content rises, the section stays in place, so jumps measure it where it ends up.
  test('[S5] einblenden heißt: 0,6 s Übergang, der Inhalt steigt 24 px auf', async ({ page }) => {
    await page.goto('/');
    const skills = section(page, 'skills');
    const heading = skills.locator('h2');
    await expect(heading).toHaveCSS('translate', '0px 24px');
    await expect(skills).toHaveCSS('translate', 'none');
    await heading.scrollIntoViewIfNeeded();
    await expect(skills).toHaveCSS('transition-property', 'opacity');
    await expect(skills).toHaveCSS('transition-duration', '0.6s');
    await expect(heading).toHaveCSS('transition-property', 'translate');
    await expect(heading).toHaveCSS('transition-duration', '0.6s');
  });

  test('[S5] Abschnitt im Bild beim Laden steht sofort da, ohne einzublenden', async ({ page }) => {
    await page.goto('/#skills');
    // Proof that the browser code ran: the last section, far below, waits.
    await expect(section(page, 'kontakt')).toHaveCSS('opacity', '0');
    for (const id of ['ueber-mich', 'skills']) {
      await expect(section(page, id), `#${id}`).not.toHaveClass(/\breveal\b/);
      expect(await opacity(page, id), `#${id}`).toBe('1');
    }
  });

  for (const [index, label] of ['Über mich', 'Skills', 'Projekte', 'Kontakt'].entries()) {
    test(`[S5] Sprung über die Navigation zu „${label}“: das Ziel steht sichtbar da`, async ({
      page,
    }) => {
      await page.goto('/');
      await expect(section(page, 'kontakt')).toHaveCSS('opacity', '0');
      await jumpVia(page, label);
      await expect(section(page, sections[index]).locator('h2')).toBeInViewport();
      await expect(section(page, sections[index])).toHaveCSS('opacity', '1');
      await expectNothingHiddenInView(page);
    });
  }

  test('[S5] Aufruf mit Anker: nichts im Bild bleibt verborgen', async ({ page }) => {
    for (const id of sections) {
      await page.goto(`/#${id}`);
      await hydrated(page);
      await expectNothingHiddenInView(page);
    }
  });

  test('[S5] Zurück-Link der Rechtsseiten zum Footer: nichts im Bild bleibt verborgen', async ({
    page,
  }) => {
    await page.goto('/impressum/');
    await page.getByRole('link', { name: 'Zurück zur Startseite' }).click();
    await expect(page).toHaveURL(/\/#fusszeile$/);
    await expect(page.locator('footer#fusszeile')).toBeInViewport();
    await expectNothingHiddenInView(page);
  });

  test('[S5] erst ans Seitenende, dann zurück nach oben: kein Abschnitt bleibt verborgen', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expectNothingHiddenInView(page);
    for (let y = await page.evaluate(() => window.scrollY); y > 0; y -= 300) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await expectNothingHiddenInView(page);
    }
    for (const id of sections) expect(await opacity(page, id), `#${id}`).toBe('1');
  });

  test('[S5] Reduced Motion nachträglich an: wartende Abschnitte stehen sofort da', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(section(page, 'kontakt')).toHaveCSS('opacity', '0');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Reduced motion shortens every transition to 0.01 ms, so the change lands with the next
    // frame; the short wait would still catch a fade of 0.6 s.
    for (const id of sections) {
      await expect(section(page, id), `#${id}`).toHaveCSS('opacity', '1', { timeout: 300 });
    }
  });
});

test.describe('Einblenden mit Reduced Motion (S5)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('[S5] Reduced Motion: alle Abschnitte stehen sofort da, ohne Übergang', async ({ page }) => {
    await page.goto('/');
    await hydrated(page);
    for (const id of sections) {
      await expect(section(page, id), `#${id}`).not.toHaveClass(/\breveal\b/);
      expect(await opacity(page, id), `#${id}`).toBe('1');
    }
  });
});

test.describe('Einblenden ohne JavaScript (S5)', () => {
  test.use({ javaScriptEnabled: false });

  test('[S5] ohne JavaScript steht jeder Abschnitt da', async ({ page }) => {
    await page.goto('/');
    for (const id of sections) {
      await section(page, id).scrollIntoViewIfNeeded();
      await expect(section(page, id), `#${id}`).not.toHaveClass(/\breveal\b/);
      expect(await opacity(page, id), `#${id}`).toBe('1');
    }
  });
});
