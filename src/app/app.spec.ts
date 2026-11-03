import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('offers a skip link to the main content', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    const skipLink = page.querySelector('a.skip-link');
    expect(skipLink?.getAttribute('href')).toBe('#main');
    expect(page.querySelector('main#main')).not.toBeNull();
  });

  // <base href="/"> would turn "#main" into a jump to the home page.
  it('moves focus to the main content without navigating', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const skipLink = page.querySelector<HTMLAnchorElement>('a.skip-link');
    const click = new MouseEvent('click', { cancelable: true });

    skipLink?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(page.querySelector('main'));
  });
});
