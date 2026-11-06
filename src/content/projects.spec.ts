import { portfolioProject, projects } from './projects';

describe('projects', () => {
  it('lists the four projects of phase 1 in order', () => {
    expect(projects.map((project) => project.slug)).toEqual([
      'neuro-check-in',
      'videoflix',
      'conduit',
      'developer-workspace-kit',
    ]);
  });

  it.each(projects)('"$title" has a URL-safe slug, a label and a summary', (project) => {
    expect(project.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(project.label).toBeTruthy();
    expect(project.summary).toBeTruthy();
  });

  it('keeps health topics out of the project texts (DECISIONS 2026-11-04)', () => {
    for (const project of projects) {
      expect(project.summary).not.toMatch(/neurodiv/i);
      expect(project.description).not.toMatch(/neurodiv/i);
    }
  });

  it.each(projects)('"$title" has a project page', (project) => {
    expect(project.hasPage).toBe(true);
  });

  it.each(projects)('"$title" has a meta description of 50 to 160 characters', (project) => {
    expect(project.description.length).toBeGreaterThanOrEqual(50);
    expect(project.description.length).toBeLessThanOrEqual(160);
  });

  it('keeps the site itself out of the list, with a page and a valid description', () => {
    expect(projects).not.toContain(portfolioProject);
    expect(portfolioProject.slug).toBe('portfolio');
    expect(portfolioProject.hasPage).toBe(true);
    expect(portfolioProject.description.length).toBeGreaterThanOrEqual(50);
    expect(portfolioProject.description.length).toBeLessThanOrEqual(160);
  });

  it('links Videoflix live first, then both repositories', () => {
    const videoflix = projects.find((project) => project.slug === 'videoflix');
    expect(videoflix?.links.map((link) => link.url)).toEqual([
      'https://videoflix.philipp-klinger.com',
      'https://github.com/PhilippKlinger/videoflix-backend',
      'https://github.com/PhilippKlinger/videoflix-frontend',
    ]);
  });

  it.each(projects)('"$title" has at least one https link', (project) => {
    expect(project.links.length).toBeGreaterThan(0);
    for (const link of project.links) {
      expect(link.url).toMatch(/^https:\/\//);
    }
  });
});
