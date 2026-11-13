import { TestBed } from '@angular/core/testing';
import { ProjectRow, RowContent } from './project-row';

const projectRow: RowContent = {
  slug: 'vps-plattform',
  title: 'VPS-Plattform',
  summary: 'Gemeinsame Infrastruktur für die Projekte auf einem VPS.',
  tech: ['Docker Compose', 'Caddy', 'Uptime Kuma', 'GitHub Actions'],
  href: '/projekte/vps-plattform/',
  external: false,
  signal: { state: 'verified', status: 'CI grün', when: 'zuletzt 10.11.' },
  ring: 'Details',
};

const reportRow: RowContent = {
  ...projectRow,
  slug: 'projektberichte',
  title: 'Security, Linux und Container',
  href: 'https://philippklinger.github.io/my-dso-blog/docs/projects',
  external: true,
  signal: { state: 'verified', status: '4 Berichte', when: '' },
  ring: 'Zum Blog ↗',
};

function render(row: RowContent): HTMLElement {
  const fixture = TestBed.createComponent(ProjectRow);
  fixture.componentRef.setInput('row', row);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ProjectRow', () => {
  it('renders one link per row', () => {
    const host = render(projectRow);
    const links = host.querySelectorAll('a');
    expect(links).toHaveLength(1);
    const [link] = links;
    expect(link.getAttribute('href')).toBe('/projekte/vps-plattform/');
    expect(link.getAttribute('data-cursor')).toBe('Details');
    expect(link.hasAttribute('target')).toBe(false);
    expect(link.querySelector('.signal .state')?.textContent?.trim()).toBe('CI grün');
    expect(link.querySelector('.signal-when')?.textContent).toBe('zuletzt 10.11.');
    expect(link.querySelector('h3')?.textContent).toBe('VPS-Plattform');
    expect(link.querySelector('.text')?.textContent).toBe(projectRow.summary);
    expect(link.querySelector('.tech')?.textContent).toBe(
      'Docker Compose · Caddy · Uptime Kuma · GitHub Actions',
    );
  });

  it('opens the reports row in a new tab', () => {
    const link = render(reportRow).querySelector('a')!;
    expect(link.getAttribute('href')).toBe(reportRow.href);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(link.getAttribute('data-cursor')).toBe('Zum Blog ↗');
    expect(link.querySelector('.cta-text')?.textContent).toBe('Alle Berichte ansehen');
    expect(link.querySelector('.arrow')?.textContent).toBe('↗');
    expect(link.querySelector('.signal-when')).toBeNull();
  });

  it('shows the small image with its fixed size, as decoration', () => {
    const preview = { src: 'images/projects/videoflix.webp', width: 640, height: 336 };
    const thumb = render({ ...projectRow, preview }).querySelector('a .thumb')!;
    expect(thumb.getAttribute('aria-hidden')).toBe('true');
    const image = thumb.querySelector('img')!;
    expect(image.getAttribute('src')).toBe(preview.src);
    expect(image.getAttribute('width')).toBe('640');
    expect(image.getAttribute('height')).toBe('336');
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('loading')).toBe('lazy');
  });

  it('keeps the place of the small image for a row without one', () => {
    const thumb = render(projectRow).querySelector('a .thumb');
    expect(thumb).not.toBeNull();
    expect(thumb!.querySelector('img')).toBeNull();
  });

  // Phones fold image, text and tech away (c, 13.11.); a disclosure inside the link would navigate.
  it('repeats image, text and tech in a closed disclosure beside the link', () => {
    const preview = { src: 'images/projects/videoflix.webp', width: 640, height: 336 };
    const host = render({ ...projectRow, preview });
    const fold = host.querySelector('details')!;
    expect(fold.closest('a')).toBeNull();
    expect(fold.querySelector('a')).toBeNull();
    expect(fold.open).toBe(false);
    expect(fold.querySelector('summary')?.textContent?.trim()).toBe('Details');
    expect(fold.querySelector('.fold-text')?.textContent).toBe(projectRow.summary);
    expect(fold.querySelector('.fold-tech')?.textContent).toBe(
      'Docker Compose · Caddy · Uptime Kuma · GitHub Actions',
    );
    const image = fold.querySelector('img')!;
    expect(image.getAttribute('src')).toBe(preview.src);
    expect(image.getAttribute('width')).toBe('640');
    expect(image.getAttribute('height')).toBe('336');
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('loading')).toBe('lazy');
  });

  it('folds no empty image place for a row without one', () => {
    expect(render(projectRow).querySelector('details img')).toBeNull();
  });

  it('keeps the cta text for screen readers', () => {
    const link = render(projectRow).querySelector('a')!;
    const text = link.querySelector('.cta-text')!;
    expect(text.textContent).toBe('Details ansehen');
    expect(text.closest('[aria-hidden="true"]')).toBeNull();
    expect(link.querySelector('.arrow')?.getAttribute('aria-hidden')).toBe('true');
    expect(link.querySelector('.arrow')?.textContent).toBe('→');
    expect(link.hasAttribute('aria-label')).toBe(false);
  });
});
