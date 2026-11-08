// DRAFT: project texts and links until Philipp delivers the final versions.

export interface ProjectLink {
  label: string;
  url: string;
}

/** Decorative screenshot on the project page. */
export interface ProjectPreview {
  src: string;
  width: number;
  height: number;
}

export interface Project {
  slug: string;
  title: string;
  summary: string;
  /** Meta description of the project page, 50 to 160 characters. */
  description: string;
  stack: string[];
  /** Short terms on the card. */
  chips: string[];
  links: ProjectLink[];
  preview?: ProjectPreview;
}

// DRAFT: labels of the project page, wording to be approved.
export const projectPageTexts = {
  back: 'Zurück zur Projektliste',
};

export const projects: Project[] = [
  {
    slug: 'videoflix',
    title: 'Videoflix',
    summary:
      'Fullstack-Streaming-Plattform mit Angular, Django REST Framework und PostgreSQL; asynchrone Videoverarbeitung mit Redis/RQ, JWT-Auth und rollenbasierte Zugriffe.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Videoflix: Fullstack-Streaming-Plattform mit Angular, Django REST Framework und PostgreSQL, asynchrone Videoverarbeitung, JWT-Auth und Rollen.',
    stack: ['Angular', 'Django', 'PostgreSQL', 'Redis', 'Docker', 'GitHub Actions'],
    chips: ['CI/CD', 'Docker', 'Security-Checks', 'SBOM', 'Monitoring'],
    // DRAFT: link labels.
    links: [
      { label: 'Live ansehen', url: 'https://videoflix.philipp-klinger.com' },
      { label: 'Code auf GitHub', url: 'https://github.com/PhilippKlinger/videoflix-backend' },
    ],
    preview: { src: 'images/projects/videoflix.webp', width: 640, height: 336 },
  },
  {
    slug: 'neuro-check-in',
    title: 'Neuro Check-in',
    // Wording of the final CV.
    summary:
      'Eigene Android-App zur Selbstreflexion im Google Play Store mit React Native und TypeScript; Offline-Datenspeicherung mit SQLite, PDF-Export sowie automatisierte Unit- und E2E-Tests.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Neuro Check-in: eigene Android-App zur Selbstreflexion im Google Play Store mit React Native und TypeScript, SQLite, PDF-Export und automatisierten Tests.',
    stack: ['React Native', 'Expo', 'TypeScript', 'SQLite', 'Sentry'],
    chips: ['React Native', 'TypeScript', 'SQLite', 'E2E-Tests'],
    // DRAFT: link labels.
    links: [
      {
        label: 'Im Play Store ansehen',
        url: 'https://play.google.com/store/apps/details?id=com.philippklinger.neurocheckin',
      },
      { label: 'Website', url: 'https://neurocheckin.de' },
    ],
    preview: { src: 'images/projects/neuro-check-in.webp', width: 640, height: 336 },
  },
  {
    slug: 'conduit',
    title: 'Conduit',
    summary:
      'Bestehende Fullstack-Anwendung mit Docker Compose containerisiert; GitHub Actions für Image-Builds, GHCR-Publishing und automatisiertes Staging-Deployment mit Healthchecks.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Conduit: bestehende Fullstack-Anwendung mit Docker Compose, GitHub Actions für Image-Builds und GHCR-Publishing sowie Staging-Deployment mit Healthchecks.',
    stack: ['Angular', 'Django', 'Docker', 'GitHub Actions'],
    chips: ['Docker Compose', 'GitHub Actions', 'GHCR', 'Healthchecks'],
    // DRAFT: link labels.
    links: [
      { label: 'Code auf GitHub', url: 'https://github.com/PhilippKlinger/conduit-container' },
      {
        label: 'Bericht lesen',
        url: 'https://philippklinger.github.io/my-dso-blog/docs/projects/conduit-deployment',
      },
    ],
    preview: { src: 'images/projects/conduit.webp', width: 640, height: 336 },
  },
  {
    slug: 'developer-workspace-kit',
    title: 'Developer Workspace Kit',
    summary:
      'Node.js-Plugin für Claude Code zur geführten, automatisierten Einrichtung neuer und bestehender Fullstack- und DevSecOps-Workspaces; konfigurierbare Projektregeln, Skills, Hooks und CI/CD-Vorlagen für Agentic Coding.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Developer Workspace Kit: Node.js-Plugin für Claude Code zur geführten Einrichtung von Fullstack- und DevSecOps-Workspaces mit Regeln, Skills und Hooks.',
    stack: ['Node.js', 'Claude Code', 'GitHub Actions'],
    chips: ['Node.js', 'Claude Code', 'GitHub Actions'],
    // No link until a public repository exists (PK-25).
    links: [],
    // DRAFT: placeholder image until a real terminal capture exists
    preview: { src: 'images/projects/developer-workspace-kit.webp', width: 640, height: 336 },
  },
];

/**
 * The site itself, with its own software delivery (Grill 2026-11-04, option A). Not a card of
 * the list: that stays the four projects of the CV. The footer links here.
 */
// DRAFT: texts of this page, wording to be approved.
export const portfolioProject: Project = {
  slug: 'portfolio',
  title: 'Diese Website',
  summary:
    'Vorgerenderte Angular-Seite, ausgeliefert als statische Dateien: Jede Änderung läuft per Pull Request durch Tests und Sicherheitsscans, jeder Merge geht automatisch auf die Vorschau, die Hauptdomain nur nach Freigabe. Die ausgelieferten Dateien sind signiert.',
  description:
    'Wie philipp-klinger.com gebaut ist: Angular-Prerendering, CI/CD mit Tests und Security-Scans, signierte Dateien und öffentlich nachprüfbare Software Delivery.',
  stack: ['Angular', 'TypeScript', 'SCSS', 'Playwright', 'GitHub Actions'],
  chips: [],
  links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger/philippklinger.com' }],
};
