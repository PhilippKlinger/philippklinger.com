import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let menuButton: HTMLButtonElement | null;

  async function click(element: HTMLElement | null): Promise<void> {
    element?.click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    menuButton = (fixture.nativeElement as HTMLElement).querySelector('button.menu-button');
  });

  it('opens and closes the mobile menu with the menu button', async () => {
    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');

    await click(menuButton);
    expect(menuButton?.getAttribute('aria-expanded')).toBe('true');

    await click(menuButton);
    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
  });

  // Over the content the bar is solid while the menu is open (S3).
  it('marks the host while the mobile menu is open', async () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).not.toContain('menu-open');

    await click(menuButton);
    expect(host.classList).toContain('menu-open');

    await click(menuButton);
    expect(host.classList).not.toContain('menu-open');
  });

  it('closes the mobile menu when a link is chosen', async () => {
    await click(menuButton);

    await click((fixture.nativeElement as HTMLElement).querySelector('nav a'));

    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
  });
});
