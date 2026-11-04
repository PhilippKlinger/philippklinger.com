import { projects } from './projects';

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
    }
  });

  it.each(projects)('"$title" has at least one https link', (project) => {
    expect(project.links.length).toBeGreaterThan(0);
    for (const link of project.links) {
      expect(link.url).toMatch(/^https:\/\//);
    }
  });
});
