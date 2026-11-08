import { expect, test } from '@playwright/test';
import { profile } from '../src/content/profile';
import { projects } from '../src/content/projects';
import { docsUrl, siteUrl } from '../src/content/site';
import { pages } from './support/site';

// Crawler files, structured data and share images (spec 3.2, PK-26).
// They always name the real domain; the preview host stays hidden from search
// engines by the X-Robots-Tag header in public/.htaccess.

const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

interface ProfilePage {
  '@type': string;
  url: string;
  mainEntity: { '@type': string; name: string; sameAs: string[] };
}

test.describe('llms.txt', () => {
  test('[SEO · Spec Stufe 3] /llms.txt ist UTF-8-Text und nennt jedes Projekt aus den Daten', async ({
    request,
  }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(response.headers()['content-type']).toContain('charset=utf-8');
    const body = await response.text();
    expect(body).toContain(profile.claim);
    // Decoded correctly only if the umlaut survives ("Raum Osnabrück").
    expect(body).toContain(profile.location);
    for (const project of projects) {
      expect(body).toContain(project.title);
    }
  });
});

test.describe('robots.txt und Sitemap', () => {
  test('[SEO · Spec 3.2] robots.txt erlaubt alles und nennt die Sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    const body = await response.text();
    expect(body).toMatch(/^User-agent: \*$/m);
    expect(body, 'die ganze Seite ist gesperrt').not.toMatch(/^Disallow: \/\s*$/m);
    expect(body).toContain(`Sitemap: ${siteUrl}/sitemap.xml`);
  });

  test('[SEO · Spec 3.2] sitemap.xml ist gültiges XML mit genau den vorgerenderten Seiten', async ({
    page,
    request,
  }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('xml');
    const xml = await response.text();
    const wellFormed = await page.evaluate(
      (text) =>
        !new DOMParser().parseFromString(text, 'application/xml').querySelector('parsererror'),
      xml,
    );
    expect(wellFormed, 'sitemap.xml lässt sich nicht als XML lesen').toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect([...locations].sort()).toEqual(pages.map((path) => siteUrl + path).sort());
  });
});

test.describe('Strukturierte Daten', () => {
  test('[SEO · Spec 3.2] Startseite liefert ProfilePage mit Person im vorgerenderten HTML', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text();
    const blocks = [...html.matchAll(jsonLdPattern)];
    expect(blocks, 'genau ein JSON-LD-Block im HTML').toHaveLength(1);
    const data = JSON.parse(blocks[0][1]) as ProfilePage;
    expect(data['@type']).toBe('ProfilePage');
    expect(data.url).toBe(`${siteUrl}/`);
    expect(data.mainEntity['@type']).toBe('Person');
    expect(data.mainEntity.name).toBe(profile.name);
    expect(data.mainEntity.sameAs).toEqual(
      expect.arrayContaining([profile.github, profile.linkedin, docsUrl]),
    );
  });

  test('[SEO] nach dem Laden bleibt es bei einem JSON-LD-Block', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  for (const path of pages.filter((path) => path !== '/')) {
    test(`[SEO] ${path} trägt keine ProfilePage`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      expect([...html.matchAll(jsonLdPattern)]).toHaveLength(0);
    });
  }
});

test.describe('Open Graph', () => {
  for (const path of pages) {
    test(`[SEO · Spec 3.2] ${path} hat Vorschaubild und Twitter-Karte`, async ({ page }) => {
      await page.goto(path);
      const meta = (attribute: string) =>
        page.locator(`meta[${attribute}]`).getAttribute('content');
      expect(await meta('property="og:image"'), 'og:image: absolute URL').toBe(
        `${siteUrl}/images/og.png`,
      );
      expect(await meta('property="og:image:width"')).toBe('1200');
      expect(await meta('property="og:image:height"')).toBe('630');
      expect(await meta('property="og:image:alt"'), 'og:image:alt fehlt').toBeTruthy();
      expect(await meta('name="twitter:card"')).toBe('summary_large_image');
    });
  }

  test('[SEO] og:image ist ein PNG mit 1200 × 630 Pixeln', async ({ page, request }) => {
    await page.goto('/');
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    const response = await request.get(new URL(image!).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
    const png = await response.body();
    // Width and height are the first fields of the IHDR chunk after the signature.
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});

test.describe('Favicon und Tab-Titel', () => {
  // The Angular scaffold ships a favicon.ico of exactly this size.
  const scaffoldFaviconBytes = 15086;

  test('[SEO · Go-live] Startseite verlinkt SVG-Favicon und Apple-Touch-Icon, beide liefern ein Bild', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    for (const selector of [
      'link[rel="icon"][type="image/svg+xml"]',
      'link[rel="apple-touch-icon"]',
    ]) {
      const href = await page.locator(selector).getAttribute('href');
      expect(href, selector).toBeTruthy();
      const response = await request.get(new URL(href ?? '', page.url()).toString());
      expect(response.status(), selector).toBe(200);
      expect(response.headers()['content-type'], selector).toContain('image/');
    }
  });

  test('[SEO · Go-live] favicon.ico ist nicht mehr das Angular-Standardicon', async ({
    request,
  }) => {
    const response = await request.get('/favicon.ico');
    expect(response.status()).toBe(200);
    expect((await response.body()).length).not.toBe(scaffoldFaviconBytes);
  });

  test('[SEO · Go-live] Titel der Startseite folgt aus Name und Rolle im Profil', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(`${profile.name} – ${profile.role}`);
  });
});
