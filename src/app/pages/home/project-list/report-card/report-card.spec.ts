import { TestBed } from '@angular/core/testing';
import { ReportCard } from './report-card';

const reportBase = 'https://philippklinger.github.io/my-dso-blog/docs/projects';
const repoBase = 'https://github.com/PhilippKlinger';

function render(): HTMLElement {
  const fixture = TestBed.createComponent(ReportCard);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ReportCard', () => {
  it('shows signal, title, text and chips', () => {
    const host = render();
    expect(host.querySelector('.signal b')?.textContent).toBe('Projektberichte');
    expect(host.querySelector('.signal span')?.textContent).toBe('mit Belegen');
    expect(host.querySelector('.card h3')?.textContent).toBe('Security, Linux und Container');
    expect(host.querySelectorAll('ul.chips > li')).toHaveLength(4);
  });

  it('shows the four reports with their links and no arrows', () => {
    const host = render();
    const reports = [...host.querySelectorAll('.report')].map((report) => [
      report.querySelector('strong')?.textContent,
      [...report.querySelectorAll('a')].map((link) => [link.textContent, link.href]),
    ]);
    expect(reports).toEqual([
      ['OWASP Juice Shop', [['Bericht lesen', `${reportBase}/Juice%20Shop%20Master/`]]],
      [
        'V-Server Setup',
        [
          ['Bericht lesen', `${reportBase}/v-server-setup`],
          ['Repo', `${repoBase}/v-server-setup`],
        ],
      ],
      [
        'Truck Signs API',
        [
          ['Bericht lesen', `${reportBase}/truck-signs-api`],
          ['Repo', `${repoBase}/truck-signs-api`],
        ],
      ],
      [
        'WordPress Multi-Container',
        [
          ['Bericht lesen', `${reportBase}/wordpress-multicontainer-setup`],
          ['Repo', `${repoBase}/wordpress-multicontainer-setup`],
        ],
      ],
    ]);
    expect(host.querySelector('.flow-arrow')).toBeNull();
    expect(host.querySelector('.flow-title')?.textContent).toBe('Direkt zum Beleg');
  });

  it('has the CTA to all reports with data-cursor "Berichte ansehen"', () => {
    const cta = render().querySelector('article.card[data-card-link] a[data-card-cta]');
    expect(cta?.getAttribute('href')).toBe(reportBase);
    expect(cta?.getAttribute('data-cursor')).toBe('Berichte ansehen');
    expect(cta?.textContent?.trim()).toBe('Alle Projektberichte ansehen');
  });
});
