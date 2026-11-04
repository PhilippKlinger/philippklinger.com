import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { pages } from './support/site';

// Header and footer on every page, checked against the template "Version 2"
// (docs/design in the private workspace) and spec 3.4.

const navLabels = ['Über mich', 'Schwerpunkte', 'Projekte', 'Kontakt'];
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

for (const path of pages) {
  test.describe(`Layout ${path}`, () => {
    test('[Spec 3.4] Navigation: Über mich · Schwerpunkte · Projekte · Kontakt', async ({
      page,
    }) => {
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
      for (const name of ['GitHub', 'LinkedIn', 'E-Mail', 'Impressum', 'Datenschutz']) {
        await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
      }
      await expect(footer.getByRole('link', { name: 'Impressum', exact: true })).toHaveAttribute(
        'href',
        '/impressum/',
      );
      await expect(footer.getByRole('link', { name: 'Datenschutz', exact: true })).toHaveAttribute(
        'href',
        '/datenschutz/',
      );
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
  test('[Vorlage] Mobil Menü-Knopf statt Navigation, ab Tablet Navigation sichtbar', async ({
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

  test('[Vorlage] Logo „PK“ führt zur Startseite', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Menü' }).click();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.length, violations.map((v) => `${v.id}: ${v.help}`).join(' ; ')).toBe(0);
  });
});
