import { portfolioProject, projects } from './projects';
import { TOPIC_A, findForbiddenTerm } from './testing/forbidden-terms';

describe('projects', () => {
  it('lists the four projects of phase 1 in order', () => {
    expect(projects.map((project) => project.slug)).toEqual([
      'videoflix',
      'neuro-check-in',
      'vps-plattform',
      'buildorder',
    ]);
  });

  it.each(projects)('"$title" has a URL-safe slug and a summary', (project) => {
    expect(project.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(project.summary).toBeTruthy();
  });

  it('keeps private topics out of the project texts', async () => {
    for (const project of projects) {
      expect(await findForbiddenTerm(project.summary, [TOPIC_A])).toBe(false);
      expect(await findForbiddenTerm(project.description, [TOPIC_A])).toBe(false);
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

  it('links the VPS platform to the status page, then both measured repositories', () => {
    const platform = projects.find((project) => project.slug === 'vps-plattform');
    expect(platform?.title).toBe('VPS-Plattform');
    expect(platform?.links).toEqual([
      { label: 'Statusseite', url: 'https://status.philipp-klinger.com' },
      { label: 'Edge-Proxy auf GitHub', url: 'https://github.com/PhilippKlinger/vps-edge' },
      { label: 'Monitoring auf GitHub', url: 'https://github.com/PhilippKlinger/vps-monitoring' },
    ]);
  });

  it('no longer shows Conduit or links its report (plan VPS platform, E8)', () => {
    expect(JSON.stringify(projects)).not.toMatch(/conduit/i);
  });

  // No version in the text: the release page and the measured CI stay current by themselves.
  it('links Buildorder to its repository and its release page', () => {
    const buildorder = projects.find((project) => project.slug === 'buildorder');
    expect(buildorder?.title).toBe('Buildorder');
    expect(buildorder?.links).toEqual([
      { label: 'Code auf GitHub', url: 'https://github.com/PhilippKlinger/buildorder' },
      { label: 'Releases', url: 'https://github.com/PhilippKlinger/buildorder/releases' },
    ]);
  });

  it('no longer names the private kit', () => {
    const buildorder = JSON.stringify(projects.find((project) => project.slug === 'buildorder'));
    expect(buildorder).not.toMatch(/Developer Workspace Kit|kit\.mjs|\/kit:init|v\d+\.\d+/);
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
    ['vps-plattform', ['Docker Compose', 'Caddy', 'Uptime Kuma', 'GitHub Actions', 'Trivy']],
    ['buildorder', ['Node.js', 'Claude Code', 'GitHub Actions']],
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
      'vps-plattform',
      'Gemeinsame Infrastruktur für die Projekte auf einem VPS, als Code beschrieben: Edge-Proxy mit TLS und Sicherheits-Headern, Monitoring mit öffentlicher Statusseite und eine CI, die bei jeder Änderung die echte Konfiguration startet und auf Sicherheitszusagen prüft.',
    ],
    [
      'buildorder',
      'Plugin für Claude Code, das um den Agenten herum die Engineering-Standards aufbaut: geführte Einrichtung eines Workspace mit Doc-Map in einem privaten Docs-Repo, Hooks als Leitplanken für Commits und Steuerdateien und eine CI-Pipeline mit Security-Checks für neue Projekte. Öffentlich auf GitHub veröffentlicht.',
    ],
  ])('"%s" has the text of the spec', (slug, summary) => {
    expect(projects.find((project) => project.slug === slug)?.summary).toBe(summary);
  });

  // Buildorder 1.0.0 is a full release, so no text may still call it a pre-release.
  it('describes Buildorder as published, not as a pre-release', () => {
    const buildorder = projects.find((project) => project.slug === 'buildorder');
    expect(buildorder?.description).toBe(
      'Buildorder: Plugin für Claude Code, das Workspace, Doc-Map, Hooks und eine CI-Pipeline mit Security-Checks einrichtet. Öffentlich auf GitHub.',
    );
  });

  it('keeps chips off the site itself, it has no card', () => {
    expect(portfolioProject.chips).toEqual([]);
  });
});
