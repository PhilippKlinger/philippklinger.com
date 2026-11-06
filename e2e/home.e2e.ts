import { expect, test, type Page } from '@playwright/test';
import { about } from '../src/content/profile';

// Start page against the template "Version 2" (docs/design in the private
// workspace), spec 3.4 (sections, tokens, motion) and spec 5 (content).

const width = (page: Page) => page.viewportSize()?.width ?? 0;
const isMobile = (page: Page) => width(page) < 768;

/** Template colours as computed by the browser (spec 3.4). */
const colors = {
  bg: 'rgb(28, 28, 28)',
  accent: 'rgb(61, 207, 182)',
  templateGrey: 'rgb(113, 113, 113)',
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test.describe('Aufbau', () => {
  test('[Spec 3.4] Abschnitte in der Reihenfolge der Vorlage', async ({ page }) => {
    const ids = await page.locator('main section[id]').evaluateAll((s) => s.map((el) => el.id));
    expect(ids).toEqual(['ueber-mich', 'skills', 'projekte', 'kontakt']);
  });

  test('[Spec 3.4] jeder Navigationseintrag hat ein Ziel auf der Startseite', async ({ page }) => {
    for (const id of ['ueber-mich', 'skills', 'projekte', 'kontakt']) {
      await expect(page.locator(`#${id}`), `#${id}`).toHaveCount(1);
    }
  });

  test('[Verhalten] Anker-Sprung zeigt die Überschrift unverdeckt', async ({ page }) => {
    for (const id of ['ueber-mich', 'skills', 'projekte']) {
      await page.goto(`/#${id}`);
      const heading = page.locator(`#${id} h2`);
      await expect(heading).toBeInViewport();
      const covered = await heading.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + 4, box.top + box.height / 2);
        return !(hit && (el === hit || el.contains(hit)));
      });
      expect(covered, `#${id} h2 ist verdeckt`).toBe(false);
    }
  });
});

test.describe('Hero', () => {
  test('[Spec 5] Rolle, Name und Kernsatz', async ({ page }) => {
    const hero = page.locator('.hero');
    await expect(hero.locator('h1')).toHaveText('Philipp Klinger');
    await expect(hero).toContainText('Software Engineer · Fullstack & DevSecOps');
    // Kernsatz only; the AI sentence moved to "Über mich" (Grill 2026-11-04).
    const claim = hero.locator('h1 ~ p, .claim');
    await expect(claim.first(), 'Kernsatz fehlt').toBeVisible();
    expect((await claim.allInnerTexts()).join(' ').length).toBeGreaterThan(40);
  });

  test('[Vorlage] zwei Buttons: Projekte ansehen → #projekte, Kontakt → #kontakt', async ({
    page,
  }) => {
    const hero = page.locator('.hero');
    await expect(hero.getByRole('link', { name: 'Projekte ansehen' })).toHaveAttribute(
      'href',
      /#projekte$/,
    );
    await expect(hero.getByRole('link', { name: 'Kontakt', exact: true })).toHaveAttribute(
      'href',
      /#kontakt$/,
    );
  });

  test('[Vorlage] füllt den ersten Bildschirm, Band unten noch sichtbar', async ({ page }) => {
    const viewport = page.viewportSize()!;
    const hero = await page.locator('.hero').boundingBox();
    const band = await page.locator('.band').boundingBox();
    expect(hero!.height).toBeGreaterThanOrEqual(viewport.height * 0.9);
    expect(
      band!.y + band!.height / 2,
      'Band liegt unter dem ersten Bildschirm',
    ).toBeLessThanOrEqual(viewport.height);
  });

  test('[Vorlage] E-Mail und Social-Links senkrecht am rechten Rand', async ({ page }) => {
    const social = await page.locator('.social').boundingBox();
    expect(social!.x, 'Social-Leiste steht nicht rechts').toBeGreaterThan(width(page) * 0.75);
    if (!isMobile(page)) {
      await expect(page.locator('.social .email')).toHaveCSS('writing-mode', 'vertical-rl');
    }
  });

  test('[Vorlage] Pfeil, E-Mail und Social-Links sind sichtbar und nicht vom Band verdeckt', async ({
    page,
  }) => {
    const targets = [
      // The visible arrow; its line runs behind the band on purpose.
      page.getByRole('link', { name: 'Weiter zu Über mich' }).locator('span'),
      page.locator('.social a'),
    ];
    for (const target of targets) {
      for (const link of await target.all()) {
        await expect(link).toBeVisible();
        const hidden = await link.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return !(hit && (el === hit || el.contains(hit)));
        });
        expect(
          hidden,
          `${(await link.getAttribute('aria-label')) ?? (await link.innerText())} ist verdeckt`,
        ).toBe(false);
      }
    }
  });

  test('[Vorlage] Seitenleisten überlappen Text und Buttons des Hero nicht', async ({ page }) => {
    // Line boxes of the texts plus the buttons: the real content, not the wide containers.
    const content = await page.locator('.hero .intro').evaluate((intro) => {
      const rects: { left: number; right: number; top: number; bottom: number }[] = [];
      for (const text of intro.querySelectorAll('p, h1')) {
        const range = document.createRange();
        range.selectNodeContents(text);
        rects.push(...range.getClientRects());
      }
      for (const button of intro.querySelectorAll('.button'))
        rects.push(button.getBoundingClientRect());
      return rects.map(({ left, right, top, bottom }) => ({ left, right, top, bottom }));
    });
    const sides = [page.locator('.scroll-down span'), ...(await page.locator('.social a').all())];
    for (const side of sides) {
      const b = (await side.boundingBox())!;
      const hit = content.some(
        (c) => b.x < c.right && b.x + b.width > c.left && b.y < c.bottom && b.y + b.height > c.top,
      );
      const name = (await side.getAttribute('aria-label')) ?? (await side.innerText());
      expect(hit, `${name} liegt über dem Hero-Text`).toBe(false);
    }
  });

  test('[Vorlage] Band-Einträge stehen einzeilig in einer Reihe', async ({ page }) => {
    // Visible copy of the marquee; the screen-reader list is 1px and not measured.
    const items = await page.locator('.band-track li').evaluateAll((lis) =>
      lis.map((li) => {
        const style = getComputedStyle(li);
        return {
          text: li.textContent?.trim(),
          lines: Math.round(li.getBoundingClientRect().height / parseFloat(style.lineHeight)),
          top: li.getBoundingClientRect().top,
        };
      }),
    );
    for (const item of items) expect(item.lines, `„${item.text}“ bricht um`).toBeLessThanOrEqual(1);
    // One row: a second row would move items by a whole line.
    const tops = items.map((item) => item.top);
    expect(Math.max(...tops) - Math.min(...tops), 'Einträge stehen untereinander').toBeLessThan(80);
  });

  test('[Vorlage] Pfeil führt zu Über mich', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Weiter zu Über mich' })).toHaveAttribute(
      'href',
      /#ueber-mich$/,
    );
  });

  test('[Spec 3.4] Verfügbarkeitszeile ist statisch oder hat einen Pause-Knopf', async ({
    page,
  }) => {
    const running = await page
      .locator('.band')
      .evaluate(
        (band) =>
          band.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
      );
    const pause = await page
      .locator('.band')
      .getByRole('button', { name: /pause|anhalten/i })
      .count();
    expect(running === 0 || pause === 1).toBe(true);
  });

  test('[Vorlage Widescreen] Band läuft über die volle Breite', async ({ page }) => {
    const band = await page.locator('.band').boundingBox();
    expect(band!.x).toBeLessThanOrEqual(1);
    expect(band!.x + band!.width).toBeGreaterThanOrEqual(width(page) - 1);
  });
});

test.describe('Abschnitte', () => {
  test('[Spec 3.4] Über mich: Porträt und Karte mit 3 Punkten', async ({ page }) => {
    const about = page.locator('#ueber-mich');
    await expect(about.getByRole('img', { name: /Philipp Klinger/ })).toBeVisible();
    await expect(about.locator('.card li')).toHaveCount(3);
    await expect(about.locator('.card')).toContainText('KI nutze ich als Werkzeug');
    await expect(page.locator('.hero')).not.toContainText('KI nutze ich');
  });

  test('[B14] Über mich: jeder Punkt zeigt ein dekoratives Icon und seinen Text', async ({
    page,
  }) => {
    const points = page.locator('#ueber-mich .points li');
    await expect(points).toHaveCount(3);
    await expect(points).toHaveText(about.points.map((point) => point.text));
    for (const point of await points.all()) {
      await expect(point.locator('svg[aria-hidden="true"]')).toBeVisible();
    }
  });

  test('[Spec 3.4/5] Skills: 3 Karten mit je 4–6 Werkzeugen', async ({ page }) => {
    const areas = page.locator('#skills .areas > li');
    await expect(areas.locator('h3')).toHaveText(['Development', 'CI/CD & Security', 'Operations']);
    for (const count of await areas.evaluateAll((cards) =>
      cards.map((card) => card.querySelectorAll('.tools li').length),
    )) {
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(6);
    }
  });

  test('[Spec 5] Projekte in fester Reihenfolge, Zeile = Link', async ({ page }) => {
    const rows = page.locator('#projekte .projects a.project');
    await expect(rows.locator('.title')).toHaveText([
      'Neuro Check-in',
      'Videoflix',
      'Conduit',
      'Developer Workspace Kit',
    ]);
    for (const row of await rows.all()) {
      await expect(row.locator('.label')).not.toBeEmpty();
      await expect(row.locator('.stack')).not.toBeEmpty();
    }
  });

  test('[Spec 3.4] Projekt-Vorschau erscheint bei Hover und bei Fokus, rein dekorativ', async ({
    page,
  }) => {
    test.skip(isMobile(page), 'Vorschau nur ab Tablet (Vorlage)');
    const row = page.locator('#projekte a.project').first();
    const preview = row.locator('.preview');
    await expect(preview, 'keine Vorschau vorhanden').toHaveCount(1);
    await expect(preview).toHaveAttribute('aria-hidden', 'true');
    await expect(preview).toBeHidden();
    await row.hover();
    await expect(preview).toBeVisible();
    await expect(preview).toBeInViewport();
    await page.mouse.move(0, 0);
    await expect(preview).toBeHidden();
    // Keyboard focus shows it too (:focus-visible needs a real Tab).
    await row.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(preview).toBeVisible();
  });

  test('[PK-27] Link auf Dokumentation und weitere Projekte unter der Liste', async ({ page }) => {
    await expect(
      page
        .locator('#projekte .more')
        .getByRole('link', { name: 'Weitere Projekte und technische Dokumentation' }),
    ).toHaveAttribute('href', 'https://philippklinger.github.io/my-dso-blog/');
  });

  test('[Spec 3.4/5] Kontakt mit E-Mail, LinkedIn, GitHub und Verfügbarkeit', async ({ page }) => {
    const contact = page.locator('#kontakt');
    await expect(contact.locator('h2')).toBeVisible();
    await expect(contact.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(contact.locator('a[href*="linkedin.com"]')).toBeVisible();
    await expect(contact.locator('a[href*="github.com/PhilippKlinger"]')).toBeVisible();
    await expect(contact.locator('.availability')).not.toBeEmpty();
  });
});

test.describe('Design-Tokens', () => {
  test('[Spec 3.4] Hintergrund Anthrazit, Überschriften Türkis in Fira Code', async ({ page }) => {
    await expect(page.locator('body')).toHaveCSS('background-color', colors.bg);
    for (const heading of await page.locator('main section h2').all()) {
      await expect(heading).toHaveCSS('color', colors.accent);
      await expect(heading).toHaveCSS('font-family', /Fira Code/);
    }
  });

  test('[Spec 3.4] Fließtext in Karla, beide Schriften geladen', async ({ page }) => {
    await expect(page.locator('#ueber-mich .intro')).toHaveCSS('font-family', /Karla/);
    const loaded = await page.evaluate(() => [
      document.fonts.check('16px "Fira Code Variable"'),
      document.fonts.check('16px "Karla Variable"'),
    ]);
    expect(loaded).toEqual([true, true]);
  });

  test('[Spec 3.4 Kontrast] Grau #717171 der Vorlage kommt nicht vor', async ({ page }) => {
    const grey = await page.evaluate(
      (templateGrey) =>
        [...document.querySelectorAll('body *')]
          .filter((el) => getComputedStyle(el).color === templateGrey)
          .map((el) => el.tagName.toLowerCase()),
      colors.templateGrey,
    );
    expect(grey).toEqual([]);
  });

  test('[Lesbarkeit] keine Schrift unter 14 px', async ({ page }) => {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        // Screen-reader-only text (1px box) is not read on screen.
        .filter((el) => el.getBoundingClientRect().width > 1)
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`),
    );
    expect(small, small.join(', ')).toEqual([]);
  });

  test('[Vorlage Widescreen] Inhalt ab 1440 px gleich breit und mittig', async ({ page }) => {
    test.skip(width(page) < 1440, 'nur ab 1440 px');
    for (const section of await page.locator('main section.section').all()) {
      const box = (await section.boundingBox())!;
      // 78rem content plus two 6rem gutters (tokens).
      expect(box.width).toBeLessThanOrEqual(1248 + 2 * 96 + 1);
      expect(Math.abs(box.x - (width(page) - box.x - box.width))).toBeLessThanOrEqual(2);
    }
  });
});

test.describe('Zustände und Bewegung', () => {
  test('[Vorlage Components] Buttons und Navigation ändern sich bei Hover', async ({ page }) => {
    test.skip(isMobile(page), 'kein Hover auf Touch');
    const targets = [
      page.locator('.hero').getByRole('link', { name: 'Projekte ansehen' }),
      page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link').first(),
    ];
    for (const target of targets) {
      const style = () =>
        target.evaluate((el) => {
          const s = getComputedStyle(el);
          return [s.color, s.backgroundColor, s.borderColor, s.textDecorationLine].join('|');
        });
      await page.mouse.move(0, 0);
      const before = await style();
      await target.hover();
      await expect.poll(style, { timeout: 2000 }).not.toBe(before);
    }
  });

  test('[Spec 3.4 Motion] Reduced-Motion: keine laufende Animation, Lichtfleck still', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.mouse.move(200, 300);
    await page.mouse.move(900, 500);
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) => a.playState === 'running' && Number(a.effect?.getTiming().duration ?? 0) > 1,
          ).length,
    );
    expect(running).toBe(0);
  });
});

test.describe('Band (PK-21)', () => {
  const runningIn = (page: Page) =>
    page
      .locator('.band-track')
      .evaluate(
        (track) =>
          track.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
      );

  test('[PK-21] gerade, ohne Hintergrundblock, mit Haarlinien oben und unten', async ({ page }) => {
    const band = page.locator('.band');
    await expect(band).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(band).toHaveCSS('transform', 'none');
    await expect(band).toHaveCSS('border-top-width', '1px');
    await expect(band).toHaveCSS('border-bottom-width', '1px');
    await expect(band).toHaveCSS('mask-image', /gradient/);
    await expect(page.locator('.band-track li').first()).toHaveCSS('font-family', /Fira Code/);
  });

  test('[PK-21] läuft von rechts nach links', async ({ page }) => {
    const x = () =>
      page
        .locator('.band-items')
        .first()
        .evaluate((el) => el.getBoundingClientRect().x);
    const before = await x();
    await page.waitForTimeout(600);
    expect(await x(), 'Band bewegt sich nicht nach links').toBeLessThan(before);
  });

  test('[PK-21 · WCAG 2.2.2] Pause-Knopf hält an und setzt fort', async ({ page }) => {
    expect(await runningIn(page)).toBeGreaterThan(0);
    const pause = page.locator('.band').getByRole('button', { name: 'Laufband anhalten' });
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(0, 0);
    await expect.poll(() => runningIn(page)).toBe(0);
    await pause.click();
    // Focus inside the band pauses too, so leave it for the resume check.
    await pause.blur();
    await page.mouse.move(0, 0);
    await expect.poll(() => runningIn(page)).toBeGreaterThan(0);
  });

  test('[PK-21] Hover und Tastaturfokus pausieren', async ({ page }) => {
    test.skip(isMobile(page), 'kein Hover auf Touch');
    await page.locator('.band').hover();
    await expect.poll(() => runningIn(page)).toBe(0);
    await page.mouse.move(0, 0);
    await expect.poll(() => runningIn(page)).toBeGreaterThan(0);
    await page.locator('.band').getByRole('button').focus();
    await expect.poll(() => runningIn(page)).toBe(0);
  });

  test('[PK-21] Text einmal für Screenreader, die Laufschrift ist dekorativ', async ({ page }) => {
    await expect(page.locator('.band-track')).toHaveAttribute('aria-hidden', 'true');
    const read = page.locator('.band > ul li');
    await expect(read).toHaveText([
      'Offen für Festanstellung',
      'DevSecOps & Fullstack',
      'Remote oder hybrid',
      'Verfügbar ab sofort',
    ]);
  });

  test('[PK-21] Reduced Motion: Band steht, kein Pause-Knopf nötig', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    expect(await runningIn(page)).toBe(0);
    await expect(page.locator('.band').getByRole('button')).toBeHidden();
  });
});

test.describe('Mikro-Interaktionen (PK-28)', () => {
  const dot = (link: ReturnType<Page['locator']>) =>
    link.evaluate((el) => getComputedStyle(el, '::before').opacity);

  test('[PK-28] Scroll-Pfeil schwebt, höchstens 5 Sekunden (WCAG 2.2.2)', async ({ page }) => {
    const timing = await page
      .locator('.scroll-down span')
      .evaluate((el) => el.getAnimations().map((a) => a.effect?.getComputedTiming()));
    expect(timing.length, 'Pfeil ist nicht animiert').toBeGreaterThan(0);
    for (const t of timing) expect(Number(t?.endTime)).toBeLessThanOrEqual(5000);
  });

  test('[PK-28] Punkt neben Social-Icons bei Hover und gleich bei Fokus', async ({ page }) => {
    for (const link of await page.locator('.social a').all()) {
      expect(await dot(link)).toBe('0');
      await link.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect.poll(() => dot(link)).toBe('1');
      if (!isMobile(page)) {
        await page.locator('body').click({ position: { x: 1, y: 1 } });
        await link.hover();
        await expect.poll(() => dot(link)).toBe('1');
        await page.mouse.move(0, 0);
      }
    }
  });

  test('[PK-28] Button-Text läuft bei Hover und Fokus durch', async ({ page }) => {
    const button = page.locator('.hero .button').first();
    const label = button.locator('.button-label');
    const offset = () => label.evaluate((el) => getComputedStyle(el).translate);
    const rest = await offset();
    await button.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect.poll(offset).not.toBe(rest);
    await expect(button).toHaveAccessibleName('Projekte ansehen');
  });

  test('[PK-28] Reduced Motion: Pfeil steht still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const count = await page
      .locator('.scroll-down span')
      .evaluate((el) => el.getAnimations().length);
    expect(count).toBe(0);
  });
});

test.describe('Hover-Grafiken (PK-29)', () => {
  const stripes = (element: ReturnType<Page['locator']>) =>
    element.evaluate((el) => {
      const style = getComputedStyle(el, '::before');
      return { image: style.backgroundImage, opacity: style.opacity };
    });
  /** Stable reference points: nothing may move when a graphic appears. */
  const layout = (page: Page) =>
    page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      list: document.querySelector('.projects')?.getBoundingClientRect().height,
      about: document.querySelector('.about')?.getBoundingClientRect().height,
    }));

  test('[PK-29] Porträt in Graustufen', async ({ page }) => {
    await expect(page.locator('.portrait')).toHaveCSS('filter', 'grayscale(1)');
  });

  test('[PK-29] Streifen hinter dem Porträt erscheinen bei Hover', async ({ page }) => {
    test.skip(isMobile(page), 'kein Hover auf Touch');
    const media = page.locator('.portrait-media');
    expect((await stripes(media)).opacity).toBe('0');
    expect((await stripes(media)).image).toContain('repeating-linear-gradient');
    await media.scrollIntoViewIfNeeded();
    const before = await layout(page);
    await media.hover();
    await expect.poll(async () => (await stripes(media)).opacity).toBe('1');
    expect(await layout(page), 'Hover verschiebt das Layout').toEqual(before);
  });

  test('[PK-29] Streifen hinter der Projekt-Vorschau bei Hover und bei Fokus', async ({ page }) => {
    test.skip(isMobile(page), 'Vorschau nur ab Tablet (Vorlage)');
    for (const row of await page.locator('#projekte a.project').all()) {
      const preview = row.locator('.preview-media');
      await row.scrollIntoViewIfNeeded();
      const before = await layout(page);
      await row.hover();
      await expect(preview).toBeVisible();
      expect((await stripes(preview)).image).toContain('repeating-linear-gradient');
      await expect.poll(async () => (await stripes(preview)).opacity).toBe('1');
      expect(await layout(page), 'Hover verschiebt das Layout').toEqual(before);
      await page.mouse.move(0, 0);
      await row.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(preview).toBeVisible();
    }
  });

  test('[PK-29] Vorschau sitzt je Zeile anders: oben, Mitte, unten', async ({ page }) => {
    test.skip(isMobile(page), 'Vorschau nur ab Tablet (Vorlage)');
    const rows = await page.locator('#projekte .projects > li').all();
    // Hovering scrolls the row into view, so measure the list afterwards.
    const place = async (index: number) => {
      await rows[index].locator('a.project').hover();
      return {
        box: (await rows[index].locator('.preview-media').boundingBox())!,
        list: (await page.locator('.projects').boundingBox())!,
      };
    };
    const { box: first, list: top } = await place(0);
    expect(Math.abs(first.y - top.y), 'erste Vorschau beginnt nicht oben').toBeLessThanOrEqual(2);
    const { box: last, list } = await place(rows.length - 1);
    expect(
      Math.abs(last.y + last.height - (list.y + list.height)),
      'letzte Vorschau endet nicht unten',
    ).toBeLessThanOrEqual(2);
  });

  test('[PK-29] Reduced Motion: Streifen erscheinen ohne Bewegung', async ({ page }) => {
    test.skip(isMobile(page), 'kein Hover auf Touch');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const row = page.locator('#projekte a.project').first();
    await row.hover();
    await expect(row.locator('.preview-media')).toBeVisible();
    const moving = await row
      .locator('.preview-media')
      .evaluate(
        (el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
      );
    expect(moving).toBe(0);
  });
});
