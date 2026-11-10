import { TestBed } from '@angular/core/testing';
import { projects } from '../../../../content/projects';
import { reportCard } from '../../../../content/reports';
import { ProjectList } from './project-list';

function renderRows(): HTMLAnchorElement[] {
  const fixture = TestBed.createComponent(ProjectList);
  fixture.detectChanges();
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.row')];
}

describe('ProjectList', () => {
  it('shows one row per project and the reports row last', () => {
    const titles = renderRows().map((row) => row.querySelector('h3')?.textContent);
    expect(titles).toEqual([...projects.map((project) => project.title), reportCard.title]);
  });

  it('shows at most four tech entries per project', () => {
    const videoflix = projects.find((project) => project.slug === 'videoflix')!;
    expect(videoflix.chips.length).toBeGreaterThan(4);
    const [first] = renderRows();
    expect(first.querySelector('.tech')?.textContent).toBe(videoflix.chips.slice(0, 4).join(' · '));
  });

  it('links each project to its page with a trailing slash and the ring "Details"', () => {
    const rows = renderRows().slice(0, projects.length);
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(
      projects.map((project) => `/projekte/${project.slug}/`),
    );
    expect(rows.map((row) => row.getAttribute('data-cursor'))).toEqual(
      projects.map(() => 'Details'),
    );
  });

  it('marks only the reports row as external, with the ring "Zum Blog ↗"', () => {
    const rows = renderRows();
    expect(rows.map((row) => row.getAttribute('target'))).toEqual([
      ...projects.map(() => null),
      '_blank',
    ]);
    const reports = rows.at(-1)!;
    expect(reports.getAttribute('href')).toBe(reportCard.cta.url);
    expect(reports.getAttribute('data-cursor')).toBe('Zum Blog ↗');
  });

  // One report more in the list must show up in the count, so it cannot be a fixed number.
  it('counts the reports from their list', () => {
    reportCard.reports.push(reportCard.reports[0]);
    try {
      const reports = renderRows().at(-1)!;
      expect(reports.querySelector('.signal .state')?.textContent?.trim()).toBe(
        `${reportCard.reports.length} Berichte`,
      );
    } finally {
      reportCard.reports.pop();
    }
  });
});
