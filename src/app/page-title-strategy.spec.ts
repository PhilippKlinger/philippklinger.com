import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { Component, DOCUMENT } from '@angular/core';
import { PageTitleStrategy } from './page-title-strategy';

@Component({ template: '' })
class Blank {}

describe('PageTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'a',
            component: Blank,
            title: 'Seite A',
            data: { description: 'Beschreibung A' },
          },
          { path: 'b', component: Blank, title: 'Seite B', data: { canonical: false } },
        ]),
        { provide: TitleStrategy, useClass: PageTitleStrategy },
      ],
    });
  });

  it('sets title and meta description from the route', async () => {
    await TestBed.inject(Router).navigateByUrl('/a');
    expect(TestBed.inject(Title).getTitle()).toBe('Seite A');
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe('Beschreibung A');
  });

  it('removes the description of the previous page when the next has none', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    expect(TestBed.inject(Meta).getTag('name="description"')).toBeNull();
  });

  it('sets canonical and Open Graph tags with a trailing slash', async () => {
    await TestBed.inject(Router).navigateByUrl('/a#x');
    const meta = TestBed.inject(Meta);
    const canonical = TestBed.inject(DOCUMENT).querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://philippklinger.com/a/');
    expect(meta.getTag('property="og:url"')?.content).toBe('https://philippklinger.com/a/');
    expect(meta.getTag('property="og:title"')?.content).toBe('Seite A');
    expect(meta.getTag('property="og:description"')?.content).toBe('Beschreibung A');
  });

  it('drops the canonical URL on pages that opt out (404)', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    expect(TestBed.inject(DOCUMENT).querySelector('link[rel="canonical"]')).toBeNull();
    expect(TestBed.inject(Meta).getTag('property="og:url"')).toBeNull();
  });
});
