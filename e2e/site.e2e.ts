import { expect, test } from '@playwright/test';
import { isOwnOrigin, notFoundPage, pages } from './support/site';

// Site-wide checks for every prerendered page and every viewport.
// The source of each rule is named in brackets: spec section, WCAG criterion
// or the hosting behaviour (Apache on All-Inkl).

for (const path of pages) {
  test.describe(`Seite ${path}`, () => {
    test('[Spec 3.3] ist vorgerendert und ohne JavaScript lesbar', async ({ browser, baseURL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
      const page = await context.newPage();
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      await context.close();
    });

    test('[WCAG 3.1.1] Sprache ist Deutsch', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    });

    test('[SEO] Titel und Meta-Description sind gesetzt', async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(/Philipp Klinger/);
      const meta = page.locator('meta[name="description"]');
      await expect(meta, 'meta description fehlt').toHaveCount(1);
      const description = (await meta.getAttribute('content')) ?? '';
      expect(description.length, 'meta description: 50 bis 160 Zeichen').toBeGreaterThanOrEqual(50);
      expect(description.length, 'meta description: 50 bis 160 Zeichen').toBeLessThanOrEqual(160);
    });

    test('[SEO · Regel web-quality] canonical und Open Graph passen zur Seite', async ({
      page,
    }) => {
      await page.goto(path);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, 'canonical fehlt').toBeTruthy();
      const url = new URL(canonical!);
      expect(url.protocol, 'canonical: absolute https-URL').toBe('https:');
      expect(url.pathname, 'canonical: Pfad dieser Seite mit Slash am Ende').toBe(path);
      expect(url.search + url.hash, 'canonical: ohne Query und Anker').toBe('');
      const og = async (property: string) =>
        page.locator(`meta[property="og:${property}"]`).getAttribute('content');
      expect(await og('url')).toBe(canonical);
      expect(await og('title')).toBe(await page.title());
      expect(await og('description')).toBe(
        await page.locator('meta[name="description"]').getAttribute('content'),
      );
      expect(await og('type')).toBe('website');
      expect(await og('locale')).toBe('de_DE');
    });

    test('[WCAG 1.3.1] genau eine h1 und ein main', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main')).toHaveCount(1);
    });

    test('[WCAG 2.4.1] Skip-Link ist der erste Tab-Stopp und springt zum Inhalt', async ({
      page,
    }) => {
      await page.goto(path);
      await page.keyboard.press('Tab');
      const skip = page.getByRole('link', { name: 'Zum Inhalt springen' });
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
    });

    test('[Spec 5] keine Drittanbieter-Abrufe und keine Fehler in der Konsole', async ({
      page,
      baseURL,
    }) => {
      const foreign: string[] = [];
      const errors: string[] = [];
      page.on('request', (request) => {
        if (!isOwnOrigin(request.url(), baseURL!)) foreign.push(request.url());
      });
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(foreign, 'Abrufe fremder Server').toEqual([]);
      expect(errors, 'Fehler in der Konsole').toEqual([]);
    });

    test('[Responsive] kein horizontales Scrollen', async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        // Name the widest offenders, so a failure says where to look.
        return [...document.querySelectorAll('body *')]
          .filter((el) => el.getBoundingClientRect().right > width + 1)
          .filter((el) => getComputedStyle(el).position !== 'fixed')
          .slice(0, 5)
          .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
      });
      const scrolls = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(scrolls, `breiter als der Viewport: ${overflow.join(', ')}`).toBe(false);
    });

    test('[Performance] Bilder haben Alternativtext und feste Maße', async ({ page }) => {
      await page.goto(path);
      const images = await page.locator('img').evaluateAll((imgs) =>
        imgs.map((img) => ({
          src: img.getAttribute('src'),
          alt: img.hasAttribute('alt'),
          size: img.hasAttribute('width') && img.hasAttribute('height'),
        })),
      );
      for (const image of images) {
        expect(image.alt, `alt fehlt: ${image.src}`).toBe(true);
        expect(image.size, `width/height fehlen: ${image.src}`).toBe(true);
      }
    });

    test('[Hosting] interne Links führen ohne Umleitung auf eine Seite', async ({
      page,
      request,
      baseURL,
    }) => {
      await page.goto(path);
      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
      const internal = [
        ...new Set(
          hrefs
            .filter((href) => href.startsWith(baseURL!))
            .map((href) => href.split('#')[0])
            .filter(Boolean),
        ),
      ];
      for (const href of internal) {
        // A link without trailing slash costs a 301 on Apache (DirectorySlash).
        const response = await request.get(href, { maxRedirects: 0 });
        expect(response.status(), `${href} (Link auf ${path})`).toBe(200);
      }
    });

    test('[Sicherheit] Links in neuem Tab haben rel="noopener"', async ({ page }) => {
      await page.goto(path);
      const unsafe = await page
        .locator('a[target="_blank"]')
        .evaluateAll((links) =>
          links
            .filter((link) => !/noopener|noreferrer/.test(link.getAttribute('rel') ?? ''))
            .map((link) => link.getAttribute('href')),
        );
      expect(unsafe).toEqual([]);
    });

    // S9 (13.11.): links to other sites open in a new tab and say so; own links stay.
    test('[S9] externe Links öffnen in neuem Tab mit Hinweis, eigene nicht', async ({ page }) => {
      await page.goto(path);
      const links = await page.locator('a[href]').evaluateAll((all) =>
        all.map((link) => ({
          href: link.getAttribute('href') ?? '',
          target: link.getAttribute('target'),
          hint: link.getAttribute('aria-describedby'),
        })),
      );
      const external = (href: string) =>
        /^https?:\/\//.test(href) && new URL(href).origin !== 'https://philipp-klinger.com';
      expect(links.filter((l) => external(l.href) && l.target !== '_blank')).toEqual([]);
      expect(links.filter((l) => external(l.href) && l.hint !== 'new-tab-hint')).toEqual([]);
      expect(links.filter((l) => !external(l.href) && l.target)).toEqual([]);
      await expect(page.locator('#new-tab-hint')).toHaveText('öffnet in neuem Tab');
    });
  });
}

test('[Hosting] unbekannte Adresse liefert Status 404 mit Weg zur Startseite', async ({ page }) => {
  const response = await page.goto('/gibt-es-nicht/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Seite nicht gefunden');
  await expect(page.locator('main a[href="/"]')).toBeVisible();
});

// Apache compresses text with mod_deflate; the .htaccess (ci/deploy) must keep it on.
test('[Hosting] HTML, JavaScript und CSS kommen komprimiert an', async ({ page, request }) => {
  const assets: string[] = ['/'];
  page.on('response', (response) => {
    if (/\.(js|css)$/.test(new URL(response.url()).pathname)) assets.push(response.url());
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(assets.length, 'keine Skripte oder Styles geladen').toBeGreaterThan(1);
  for (const url of assets) {
    const response = await request.get(url, { headers: { 'Accept-Encoding': 'gzip' } });
    expect(response.headers()['content-encoding'], url).toBe('gzip');
  }
});

test('[Hosting] die 404-Seite selbst ist erreichbar', async ({ request }) => {
  const response = await request.get(notFoundPage);
  expect(response.status()).toBe(200);
});

// The folder exists through the project pages, and "Options -Indexes" answers 403 without a rule.
for (const path of ['/projekte', '/projekte/']) {
  test(`[Hosting] ${path} leitet zum Projektbereich der Startseite um`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('/#projekte');
  });
}

// The kit page was live under its old address before it became Buildorder (kit2).
test('[Hosting] die alte Kit-Seite leitet auf Buildorder um', async ({ request }) => {
  for (const path of ['/projekte/developer-workspace-kit', '/projekte/developer-workspace-kit/']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('/projekte/buildorder/');
  }
});

test('[Hosting] eine echte Projektseite bleibt erreichbar', async ({ request }) => {
  const response = await request.get('/projekte/videoflix/', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
});

// The test server sends the CSP from public/.htaccess, so a violation shows up
// as a console error in the check "keine Konsolenfehler" on every page.
test('[Sicherheit · Spec 3.3] Content-Security-Policy aus der .htaccess ist gesetzt', async ({
  request,
}) => {
  const csp = (await request.get('/')).headers()['content-security-policy'] ?? '';
  expect(csp, 'CSP fehlt').toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp, 'Skripte nur vom eigenen Server').not.toMatch(/script-src[^;]*'unsafe-inline'/);
});
