import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
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

  describe('preview', () => {
    // jsdom has no matchMedia; without the ring the preview stands in the row.
    beforeEach(() =>
      vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined })),
    );
    afterEach(() => vi.unstubAllGlobals());

    function renderList() {
      const fixture = TestBed.createComponent(ProjectList);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const preview = host.querySelector('app-row-preview')!;
      const point = (title: string, pointerType: string) => {
        const heading = [...host.querySelectorAll('a.row h3')].find((h) => h.textContent === title);
        heading!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType }));
        fixture.detectChanges();
      };
      return { host, preview, point };
    }

    it('is one element for the whole list, hidden from screen readers', () => {
      const { host, preview } = renderList();
      expect(host.querySelectorAll('app-row-preview')).toHaveLength(1);
      expect(preview.getAttribute('aria-hidden')).toBe('true');
    });

    it('shows the image of the row under the mouse', () => {
      const neuro = projects.find((project) => project.slug === 'neuro-check-in')!;
      const { preview, point } = renderList();
      point(neuro.title, 'mouse');
      expect(preview.classList).toContain('is-on');
      expect(preview.querySelector('img')?.getAttribute('src')).toBe(neuro.preview!.src);
    });

    it('stays off for a touch, the row shows its small image', () => {
      const { preview, point } = renderList();
      point(projects[0].title, 'touch');
      expect(preview.classList).not.toContain('is-on');
    });

    it('hides when the pointer leaves the list', () => {
      const { host, preview, point } = renderList();
      point(projects[0].title, 'mouse');
      host.querySelector('.list')!.dispatchEvent(new PointerEvent('pointerleave'));
      expect(preview.classList).not.toContain('is-on');
    });
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
