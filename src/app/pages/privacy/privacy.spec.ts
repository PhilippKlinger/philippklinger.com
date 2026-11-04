import { TestBed } from '@angular/core/testing';
import { profile } from '../../../content/profile';
import { Privacy } from './privacy';

describe('Privacy', () => {
  let page: HTMLElement;

  beforeEach(async () => {
    const fixture = TestBed.createComponent(Privacy);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  });

  const headings = () => [...page.querySelectorAll('h2')].map((h) => h.textContent?.trim());

  it('covers controller, hosting, email contact and the rights of visitors', () => {
    expect(page.querySelector('h1')?.textContent).toContain('Datenschutz');
    expect(headings()).toEqual(
      expect.arrayContaining([
        'Verantwortlicher',
        'Hosting und Server-Logfiles',
        'Kontakt per E-Mail',
        'Ihre Rechte',
      ]),
    );
  });

  it('names the hoster and the legal basis of the server logs', () => {
    expect(page.textContent).toContain('ALL-INKL.COM');
    expect(page.textContent).toContain('Art. 6 Abs. 1 lit. f DSGVO');
  });

  it('names the controller with address and links the contact email', () => {
    expect(page.textContent).toContain('49504 Lotte');
    const mail = page.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
    expect(mail?.getAttribute('href')).toBe(`mailto:${profile.email}`);
  });

  it('shows the date of the current version', () => {
    expect(page.textContent).toMatch(/Stand: \w+ \d{4}/);
  });
});
