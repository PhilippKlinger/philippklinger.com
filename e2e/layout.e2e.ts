import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { contrast } from './support/colour';
import { revealSections } from './support/motion';
import { pages } from './support/site';

// Header and footer on every page, checked against the design
// (docs/design in the private workspace) and spec 3.4.

const navLabels = ['Über mich', 'Skills', 'Projekte', 'Kontakt'];
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const buildLine = 'Diese Seite: getestet und deployt per GitHub Actions';
const brightestHaze = 'rgb(31, 83, 74)'; // #1f534a

for (const path of pages) {
  test.describe(`Layout ${path}`, () => {
    test('[Spec 3.4] Navigation: Über mich · Skills · Projekte · Kontakt', async ({ page }) => {
      await page.goto(path);
      const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
      if (isMobile(page)) await page.getByRole('button', { name: 'Menü' }).click();
      await expect(nav.getByRole('link')).toHaveText(navLabels);
    });

    test('[Spec 3.4 · WCAG 3.2.6] Footer mit Rolle, Ort, © und festen Links', async ({ page }) => {
      await page.goto(path);
      const footer = page.locator('footer');
      await expect(footer).toContainText('Software Engineer · Fullstack & DevSecOps');
      await expect(footer).toContainText(`© Philipp Klinger ${new Date().getFullYear()}`);
      for (const name of ['GitHub', 'LinkedIn', 'E-Mail', 'Docs', 'Impressum', 'Datenschutz']) {
        await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
      }
      await expect(footer.locator('.built')).toContainText(buildLine);
      await expect(footer.getByRole('link', { name: 'So ist diese Seite gebaut' })).toHaveAttribute(
        'href',
        '/projekte/portfolio/',
      );
      await expect(footer.getByRole('link', { name: 'Impressum', exact: true })).toHaveAttribute(
        'href',
        '/impressum/',
      );
      await expect(footer.getByRole('link', { name: 'Datenschutz', exact: true })).toHaveAttribute(
        'href',
        '/datenschutz/',
      );
    });

    test('[AK11] Footer hat einen festen Hintergrund', async ({ page }) => {
      await page.goto(path);
      const host = page.locator('app-footer');
      await expect(host).toHaveCSS('background-color', 'rgb(28, 28, 28)');
      await expect(host).toHaveCSS('border-top-style', 'solid');
      const { width, pageWidth } = await host.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        pageWidth: document.documentElement.clientWidth,
      }));
      expect(width).toBe(pageWidth);
    });

    // CI builds without build-info.json, so this is the state every run here sees.
    test('[AK11] Build-Zeile ohne Build-Daten liest sich normal', async ({ page }) => {
      await page.goto(path);
      const footer = page.locator('footer');
      await expect(footer.locator('.built')).toHaveText(`${buildLine} · So ist diese Seite gebaut`);
      await expect(footer).not.toContainText('undefined');
      await expect(footer.locator('.built')).not.toContainText('Build');
      await expect(footer.getByRole('link', { name: buildLine })).toHaveAttribute(
        'href',
        'https://github.com/PhilippKlinger/philippklinger.com/actions',
      );
    });

    test('[AK11] Build-Zeile hält 4,5:1 auf dem hellsten Haze-Wert', async ({ page }) => {
      await page.goto(path);
      const colors = await page
        .locator('footer .built, footer .built a')
        .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color));
      for (const color of colors) {
        expect(contrast(color, brightestHaze)).toBeGreaterThanOrEqual(4.5);
      }
    });

    test('[WCAG 2.4.7] jeder Tab-Stopp hat einen sichtbaren Fokus', async ({ page }) => {
      await page.goto(path);
      const missing: string[] = [];
      for (let stop = 0; stop < 40; stop++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          const visible =
            (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
            style.boxShadow !== 'none';
          return {
            name: `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`,
            visible,
          };
        });
        if (!info) break;
        if (!info.visible) missing.push(info.name);
      }
      expect(missing, `ohne sichtbaren Fokus: ${missing.join(', ')}`).toEqual([]);
    });
  });
}

test.describe('Header je Breite', () => {
  test('[Design] Mobil Menü-Knopf statt Navigation, ab Tablet Navigation sichtbar', async ({
    page,
  }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Menü' });
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    if (isMobile(page)) {
      await expect(button).toBeVisible();
      await expect(nav).toBeHidden();
    } else {
      await expect(button).toBeHidden();
      await expect(nav).toBeVisible();
    }
  });

  test('[Design] Logo „PK“ führt zur Startseite', async ({ page }) => {
    await page.goto('/impressum/');
    await page
      .locator('header')
      .getByRole('link', { name: /Philipp Klinger|PK/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('Mobilmenü', () => {
  test.beforeEach(({ page }) => {
    test.skip(!isMobile(page), 'nur mobil');
  });

  test('[WCAG 4.1.2] öffnet und schließt mit aria-expanded', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Menü' });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('[WCAG 2.1.2] Escape schließt das Menü, Fokus geht zurück auf den Knopf', async ({
    page,
  }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Menü' });
    await button.click();
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link')
      .first()
      .focus();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
  });

  test('[Verhalten] Klick auf einen Eintrag schließt das Menü und springt zum Abschnitt', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menü' }).click();
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Projekte' })
      .click();
    await expect(page.getByRole('button', { name: 'Menü' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(page.locator('#projekte h2')).toBeInViewport();
  });

  test('[Spec 4 · WCAG 2.2 AA] axe ohne Verstöße bei offenem Menü', async ({ page }) => {
    await page.goto('/');
    await revealSections(page);
    await page.getByRole('button', { name: 'Menü' }).click();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.length, violations.map((v) => `${v.id}: ${v.help}`).join(' ; ')).toBe(0);
  });
});
