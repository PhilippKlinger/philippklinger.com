// DRAFT: project texts and links until Philipp delivers the final versions.
// Missing links point to platzhalter.invalid; the CI blocks them from going live.
export interface ProjectLink {
  label: string;
  url: string;
}

/** Decorative screenshot next to the row on hover and focus (template). */
export interface ProjectPreview {
  src: string;
  width: number;
  height: number;
}

export interface Project {
  slug: string;
  title: string;
  /** Origin of the project: own product, client or training. */
  label: string;
  summary: string;
  stack: string[];
  links: ProjectLink[];
  /** Short line of the evidence chain, only for projects that have one. */
  proof?: string;
  /**
   * The project page /projekte/<slug>/ exists (stage 3). Without one the row
   * links straight to the first link, so no row ever points to a 404.
   */
  hasPage?: boolean;
  preview?: ProjectPreview;
}

export const projects: Project[] = [
  {
    slug: 'neuro-check-in',
    title: 'Neuro Check-in',
    label: 'Eigenes Produkt',
    // Wording of the final CV, without health topics (DECISIONS 2026-11-04).
    summary:
      'Eigene Android-App zur Selbstreflexion im Google Play Store: Offline-Datenspeicherung mit SQLite, PDF-Export sowie automatisierte Unit- und E2E-Tests.',
    stack: ['React Native', 'Expo', 'TypeScript', 'SQLite', 'Sentry'],
    // The row links to the website; the store link follows on the project page.
    links: [
      { label: 'Website', url: 'https://neurocheckin.de' },
      {
        label: 'Google Play',
        url: 'https://play.google.com/store/apps/details?id=com.philippklinger.neurocheckin',
      },
    ],
    preview: { src: 'images/projects/neuro-check-in.webp', width: 640, height: 336 },
  },
  {
    slug: 'videoflix',
    title: 'Videoflix',
    label: 'Weiterbildung',
    summary:
      'Videoplattform mit Angular, Django REST Framework und PostgreSQL: asynchrone Videoverarbeitung mit Redis/RQ, HLS-Streaming, JWT-Auth und rollenbasierte Zugriffe; CI mit automatisierten Tests und Security-Checks, Deployment auf einen eigenen Server.',
    stack: ['Angular', 'Django', 'PostgreSQL', 'Redis', 'Docker', 'GitHub Actions'],
    links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger/videoflix-backend' }],
    proof: 'CI → Image → Deploy → Betrieb',
  },
  {
    slug: 'conduit',
    title: 'Conduit',
    label: 'Weiterbildung',
    summary:
      'Fullstack-Anwendung, mit Docker Compose containerisiert; GitHub Actions für Image-Builds, GHCR-Publishing und automatisiertes Staging-Deployment mit Healthchecks.',
    stack: ['Angular', 'Django', 'Docker', 'GitHub Actions'],
    links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger/conduit-container' }],
  },
  {
    slug: 'developer-workspace-kit',
    title: 'Developer Workspace Kit',
    label: 'Eigenes Projekt',
    summary:
      'Node.js-basiertes Plugin für Claude Code zur geführten, automatisierten Einrichtung neuer und bestehender Fullstack- und DevSecOps-Workspaces, mit konfigurierbaren Projektregeln, Skills, Hooks und CI/CD-Vorlagen für Agentic Coding.',
    stack: ['Node.js', 'Claude Code', 'GitHub Actions'],
    // TODO(before production): replace with the public kit repository (PK-25).
    links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger' }],
  },
];
