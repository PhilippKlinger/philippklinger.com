import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { profile } from '../../../content/profile';
import { Imprint } from './imprint';

describe('Imprint', () => {
  let page: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Imprint);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  });

  it('names the provider with postal address as required by § 5 DDG', () => {
    expect(page.querySelector('h1')?.textContent).toContain('Impressum');
    expect(page.textContent).toContain('§ 5 DDG');
    expect(page.textContent).toContain('Philipp Klinger');
    expect(page.textContent).toContain('Ostlandstraße 11');
    expect(page.textContent).toContain('49504 Lotte');
  });

  it('links the contact email from the profile', () => {
    const mail = page.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
    expect(mail?.getAttribute('href')).toBe(`mailto:${profile.email}`);
  });

  it('names no design template or school (DECISIONS 2026-11-07)', () => {
    expect(page.textContent).not.toMatch(/Developer Akademie|Vorlage/);
  });
  // S10 (13.11.): the legal pages lead back to the footer of the start page, where they are linked.
  it('links back to the footer of the start page', () => {
    const back = page.querySelector<HTMLAnchorElement>('a.back');
    expect(back?.getAttribute('href')).toBe('/#fusszeile');
    expect(back?.textContent).toContain('Zurück zur Startseite');
  });
});
