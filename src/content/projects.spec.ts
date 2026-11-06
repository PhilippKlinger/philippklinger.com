import { portfolioProject, projects } from './projects';

describe('projects', () => {
  it('lists the four projects of phase 1 in order', () => {
    expect(projects.map((project) => project.slug)).toEqual([
      'videoflix',
      'neuro-check-in',
      'conduit',
      'developer-workspace-kit',
    ]);
  });

  it.each(projects)('"$title" has a URL-safe slug and a summary', (project) => {
    expect(project.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(project.summary).toBeTruthy();
  });

  it('keeps health topics out of the project texts (DECISIONS 2026-11-04)', () => {
    for (const project of projects) {
      expect(project.summary).not.toMatch(/neurodiv/i);
      expect(project.description).not.toMatch(/neurodiv/i);
    }
  });

  it.each(projects)('"$title" has a meta description of 50 to 160 characters', (project) => {
    expect(project.description.length).toBeGreaterThanOrEqual(50);
    expect(project.description.length).toBeLessThanOrEqual(160);
  });

  it('keeps the site itself out of the list, with a valid description', () => {
    expect(projects).not.toContain(portfolioProject);
    expect(portfolioProject.slug).toBe('portfolio');
    expect(portfolioProject.description.length).toBeGreaterThanOrEqual(50);
    expect(portfolioProject.description.length).toBeLessThanOrEqual(160);
  });

  it('has no origin labels', () => {
    for (const project of [...projects, portfolioProject]) {
      expect(project).not.toHaveProperty('label');
    }
  });

  it('keeps the description of the site free of the old term', () => {
    expect(portfolioProject.description).not.toMatch(/nachweiskette/i);
    expect(portfolioProject.description).toContain('Software Delivery');
  });

  it('links Videoflix live first, then the code', () => {
    const videoflix = projects.find((project) => project.slug === 'videoflix');
    expect(videoflix?.links).toEqual([
      { label: 'Live ansehen', url: 'https://videoflix.philipp-klinger.com' },
      { label: 'Code auf GitHub', url: 'https://github.com/PhilippKlinger/videoflix-backend' },
    ]);
  });

  it('links Neuro Check-in to the store first, then the website', () => {
    const neuro = projects.find((project) => project.slug === 'neuro-check-in');
    expect(neuro?.links).toEqual([
      {
        label: 'Im Play Store ansehen',
        url: 'https://play.google.com/store/apps/details?id=com.philippklinger.neurocheckin',
      },
      { label: 'Website', url: 'https://neurocheckin.de' },
    ]);
  });

  it('links Conduit to the code, then the report', () => {
    const conduit = projects.find((project) => project.slug === 'conduit');
    expect(conduit?.links).toEqual([
      { label: 'Code auf GitHub', url: 'https://github.com/PhilippKlinger/conduit-container' },
      {
        label: 'Bericht lesen',
        url: 'https://philippklinger.github.io/my-dso-blog/docs/projects/conduit-deployment',
      },
    ]);
  });

  it('shows the Kit without links until a public repository exists', () => {
    const kit = projects.find((project) => project.slug === 'developer-workspace-kit');
    expect(kit?.links).toEqual([]);
  });

  it.each(projects)('every link of "$title" is https', (project) => {
    for (const link of project.links) {
      expect(link.url).toMatch(/^https:\/\//);
    }
  });

  it.each(projects)('"$title" has chips', (project) => {
    expect(project.chips.length).toBeGreaterThan(0);
  });

  it.each<[string, string[]]>([
    ['videoflix', ['CI/CD', 'Docker', 'Security-Checks', 'SBOM', 'Monitoring']],
    ['neuro-check-in', ['React Native', 'TypeScript', 'SQLite', 'E2E-Tests']],
    ['conduit', ['Docker Compose', 'GitHub Actions', 'GHCR', 'Healthchecks']],
    ['developer-workspace-kit', ['Node.js', 'Claude Code', 'GitHub Actions']],
  ])('"%s" has the chips of the spec', (slug, chips) => {
    expect(projects.find((project) => project.slug === slug)?.chips).toEqual(chips);
  });

  it.each<[string, string]>([
    [
      'videoflix',
      'Fullstack-Streaming-Plattform mit Angular, Django REST Framework und PostgreSQL; asynchrone Videoverarbeitung mit Redis/RQ, JWT-Auth und rollenbasierte Zugriffe.',
    ],
    [
      'neuro-check-in',
      'Eigene Android-App zur Selbstreflexion im Google Play Store mit React Native und TypeScript; Offline-Datenspeicherung mit SQLite, PDF-Export sowie automatisierte Unit- und E2E-Tests.',
    ],
    [
      'conduit',
      'Bestehende Fullstack-Anwendung mit Docker Compose containerisiert; GitHub Actions für Image-Builds, GHCR-Publishing und automatisiertes Staging-Deployment mit Healthchecks.',
    ],
    [
      'developer-workspace-kit',
      'Node.js-Plugin für Claude Code zur geführten, automatisierten Einrichtung neuer und bestehender Fullstack- und DevSecOps-Workspaces; konfigurierbare Projektregeln, Skills, Hooks und CI/CD-Vorlagen für Agentic Coding.',
    ],
  ])('"%s" has the text of the spec', (slug, summary) => {
    expect(projects.find((project) => project.slug === slug)?.summary).toBe(summary);
  });

  it('keeps chips off the site itself, it has no card', () => {
    expect(portfolioProject.chips).toEqual([]);
  });
});
