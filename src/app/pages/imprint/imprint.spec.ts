import { TestBed } from '@angular/core/testing';
import { profile } from '../../../content/profile';
import { Imprint } from './imprint';

describe('Imprint', () => {
  let page: HTMLElement;

  beforeEach(async () => {
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
});
