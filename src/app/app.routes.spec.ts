import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { projects } from '../content/projects';
import { routes } from './app.routes';
import { PageTitleStrategy } from './page-title-strategy';

async function renderRouteComponent(path: string): Promise<HTMLElement> {
  const route = routes.find((entry) => entry.path === path);
  if (!route?.component) {
    throw new Error(`No component for route "${path}"`);
  }
  const fixture = TestBed.createComponent(route.component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const pagePaths = ['', 'impressum', 'datenschutz', '404', '**'];

  const projectPath = 'projekte/:slug';

  it('defines every page of phase 1', () => {
    expect(routes.map((route) => route.path)).toEqual([
      '',
      projectPath,
      'impressum',
      'datenschutz',
      '404',
      '**',
    ]);
  });

  it('gives every route a page title', () => {
    for (const route of routes) {
      expect(route.title, `route "${route.path}"`).toBeTruthy();
    }
  });

  // The project route resolves its description; see "project routes" below.
  it('gives every static route a meta description of 50 to 160 characters', () => {
    for (const route of routes.filter((entry) => entry.path !== projectPath)) {
      const description = route.data?.['description'] as string | undefined;
      expect(description?.length, `route "${route.path}"`).toBeGreaterThanOrEqual(50);
      expect(description?.length, `route "${route.path}"`).toBeLessThanOrEqual(160);
    }
  });

  it.each(pagePaths)('renders exactly one h1 on "%s"', async (path) => {
    const page = await renderRouteComponent(path);
    expect(page.querySelectorAll('h1')).toHaveLength(1);
  });
});

describe('project routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: TitleStrategy, useClass: PageTitleStrategy },
      ],
    });
  });

  it.each(projects)('renders /projekte/$slug with its own head tags', async (project) => {
    const harness = await RouterTestingHarness.create(`/projekte/${project.slug}`);
    const meta = TestBed.inject(Meta);
    const canonical = TestBed.inject(DOCUMENT).querySelector('link[rel="canonical"]');
    const url = `https://philipp-klinger.com/projekte/${project.slug}/`;
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(project.title);
    expect(TestBed.inject(Title).getTitle()).toBe(`${project.title} – Philipp Klinger`);
    expect(meta.getTag('name="description"')?.content).toBe(project.description);
    expect(meta.getTag('property="og:url"')?.content).toBe(url);
    expect(canonical?.getAttribute('href')).toBe(url);
  });

  it('shows the 404 page for an unknown slug', async () => {
    const harness = await RouterTestingHarness.create('/projekte/gibts-nicht');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Seite nicht gefunden',
    );
  });
});
