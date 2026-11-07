import { expect, test, type Page } from '@playwright/test';
import { about } from '../src/content/profile';

// Start page against the design (docs/design in the private
// workspace), spec 3.4 (sections, tokens, motion) and spec 5 (content).

const width = (page: Page) => page.viewportSize()?.width ?? 0;
const isMobile = (page: Page) => width(page) < 768;

/** Design colours as computed by the browser (spec 3.4). */
const colors = {
  bg: 'rgb(28, 28, 28)',
  accent: 'rgb(61, 207, 182)',
  forbiddenGrey: 'rgb(113, 113, 113)',
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test.describe('Aufbau', () => {
  test('[Spec 3.4] Abschnitte in der festgelegten Reihenfolge', async ({ page }) => {
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

  test('[Design] zwei Buttons: Projekte ansehen → #projekte, Kontakt → #kontakt', async ({
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

  test('[Design] linksbündig an derselben Kante wie das Logo', async ({ page }) => {
    await expect(page.locator('.hero .intro')).toHaveCSS('text-align', 'start');
    const logo = (await page.locator('header .logo').boundingBox())!;
    const role = (await page.locator('.hero .role').boundingBox())!;
    expect(Math.abs(role.x - logo.x), 'Textkante').toBeLessThan(1);
  });

  test('[Design] Hero hat kein Band, keinen Pfeil und keine Socials mehr', async ({ page }) => {
    await expect(page.locator('.hero .band, .hero .scroll-down, .hero .social')).toHaveCount(0);
  });

  test('[Design] Jobtitel und Navigation in Fira Code, Logo in Karla', async ({ page }) => {
    await expect(page.locator('.hero .role')).toHaveCSS('font-family', /Fira Code/);
    await expect(page.locator('header .logo')).toHaveCSS('font-family', /Karla/);
    await expect(page.locator('header .logo')).toHaveText('PK');
    test.skip(isMobile(page), 'Navigation liegt im Menü');
    const link = page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link');
    await expect(link.first()).toHaveCSS('font-family', /Fira Code/);
    await expect(link.first()).toHaveCSS('font-size', '16px');
    const [logo, nav] = [
      await page.locator('header .logo').boundingBox(),
      await link.first().boundingBox(),
    ];
    const last = (await link.last().boundingBox())!;
    expect(nav!.x, 'Navigation steht rechts vom Logo').toBeGreaterThan(logo!.x + logo!.width);
    expect(last.x + last.width, 'Navigation endet am rechten Rand').toBeGreaterThan(
      width(page) * 0.9,
    );
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

  test('[Spec 3.4/5] Kontakt mit E-Mail, LinkedIn, GitHub und Verfügbarkeit', async ({ page }) => {
    const contact = page.locator('#kontakt');
    await expect(contact.locator('h2')).toBeVisible();
    await expect(contact.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(contact.locator('a[href*="linkedin.com"]')).toBeVisible();
    await expect(contact.locator('a[href*="github.com/PhilippKlinger"]')).toBeVisible();
    await expect(contact.locator('.availability')).toHaveText('Open to Work · remote oder hybrid');
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

  test('[Spec 3.4 Kontrast] Grau #717171 kommt nicht vor', async ({ page }) => {
    const grey = await page.evaluate(
      (forbiddenGrey) =>
        [...document.querySelectorAll('body *')]
          .filter((el) => getComputedStyle(el).color === forbiddenGrey)
          .map((el) => el.tagName.toLowerCase()),
      colors.forbiddenGrey,
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

  test('[Design Widescreen] Inhalt ab 1440 px gleich breit und mittig', async ({ page }) => {
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
  test('[Design Components] Buttons und Navigation ändern sich bei Hover', async ({ page }) => {
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

  test('[Spec 3.4 Motion] Reduced-Motion: keine laufende Animation, auch nicht bei Mausbewegung', async ({
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

test.describe('Mikro-Interaktionen (PK-28)', () => {
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
      list: document.querySelector('.cards')?.getBoundingClientRect().height,
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
});
