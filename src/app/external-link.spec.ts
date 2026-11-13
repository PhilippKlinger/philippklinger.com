import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExternalLink, NEW_TAB_HINT_ID } from './external-link';

@Component({
  imports: [ExternalLink],
  template: `
    <a id="github" [href]="'https://github.com/PhilippKlinger'">GitHub</a>
    <a id="own" href="https://philipp-klinger.com/impressum/">Impressum</a>
    <a id="relative" href="/projekte/portfolio/">Portfolio</a>
    <a id="mail" href="mailto:mail@example.org">E-Mail</a>
  `,
})
class Host {}

describe('ExternalLink', () => {
  let page: HTMLElement;
  const link = (id: string) => page.querySelector<HTMLAnchorElement>(`#${id}`)!;

  beforeEach(async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  });

  it('opens a link to another site in a new tab, without opener, and says so', () => {
    expect(link('github').getAttribute('href')).toBe('https://github.com/PhilippKlinger');
    expect(link('github').getAttribute('target')).toBe('_blank');
    expect(link('github').getAttribute('rel')).toBe('noopener');
    expect(link('github').getAttribute('aria-describedby')).toBe(NEW_TAB_HINT_ID);
  });

  it.each(['own', 'relative', 'mail'])('keeps "%s" in the same tab', (id) => {
    expect(link(id).hasAttribute('href')).toBe(true);
    expect(link(id).hasAttribute('target')).toBe(false);
    expect(link(id).hasAttribute('rel')).toBe(false);
    expect(link(id).hasAttribute('aria-describedby')).toBe(false);
  });
});
