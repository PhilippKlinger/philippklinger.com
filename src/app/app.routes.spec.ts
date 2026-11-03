import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

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

  it('defines every page of phase 1', () => {
    expect(routes.map((route) => route.path)).toEqual(pagePaths);
  });

  it('gives every route a page title', () => {
    for (const route of routes) {
      expect(route.title, `route "${route.path}"`).toBeTruthy();
    }
  });

  it.each(pagePaths)('renders exactly one h1 on "%s"', async (path) => {
    const page = await renderRouteComponent(path);
    expect(page.querySelectorAll('h1')).toHaveLength(1);
  });
});
