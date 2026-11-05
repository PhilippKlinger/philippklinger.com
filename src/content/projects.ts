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
  /** Meta description of the project page, 50 to 160 characters. */
  description: string;
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

// DRAFT: labels of the project page, wording to be approved.
export const projectPageTexts = {
  back: 'Zurück zur Projektliste',
  stack: 'Stack',
  links: 'Links',
};

export const projects: Project[] = [
  {
    slug: 'neuro-check-in',
    title: 'Neuro Check-in',
    label: 'Eigenes Produkt',
    // Wording of the final CV, without health topics (DECISIONS 2026-11-04).
    summary:
      'Eigene Android-App zur Selbstreflexion im Google Play Store: Offline-Datenspeicherung mit SQLite, PDF-Export sowie automatisierte Unit- und E2E-Tests.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Neuro Check-in: eigene Android-App zur Selbstreflexion im Google Play Store, mit Offline-Speicherung in SQLite, PDF-Export und automatisierten Tests.',
    stack: ['React Native', 'Expo', 'TypeScript', 'SQLite', 'Sentry'],
    hasPage: true,
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
    // DRAFT: meta description, shortened from the summary.
    description:
      'Videoflix: Videoplattform mit Angular, Django REST Framework und PostgreSQL, HLS-Streaming, CI mit Tests und Security-Checks, Deployment auf eigenen Server.',
    stack: ['Angular', 'Django', 'PostgreSQL', 'Redis', 'Docker', 'GitHub Actions'],
    hasPage: true,
    // DRAFT: link labels.
    links: [
      { label: 'Live', url: 'https://videoflix.philipp-klinger.com' },
      { label: 'GitHub Backend', url: 'https://github.com/PhilippKlinger/videoflix-backend' },
      { label: 'GitHub Frontend', url: 'https://github.com/PhilippKlinger/videoflix-frontend' },
    ],
    proof: 'CI → Image → Deploy → Betrieb',
    preview: { src: 'images/projects/videoflix.webp', width: 640, height: 336 },
  },
  {
    slug: 'conduit',
    title: 'Conduit',
    label: 'Weiterbildung',
    summary:
      'Fullstack-Anwendung, mit Docker Compose containerisiert; GitHub Actions für Image-Builds, GHCR-Publishing und automatisiertes Staging-Deployment mit Healthchecks.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Conduit: Fullstack-Anwendung mit Docker Compose, GitHub Actions für Image-Builds und GHCR-Publishing sowie Staging-Deployment mit Healthchecks.',
    stack: ['Angular', 'Django', 'Docker', 'GitHub Actions'],
    hasPage: true,
    links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger/conduit-container' }],
    preview: { src: 'images/projects/conduit.webp', width: 640, height: 336 },
  },
  {
    slug: 'developer-workspace-kit',
    title: 'Developer Workspace Kit',
    label: 'Eigenes Projekt',
    summary:
      'Node.js-basiertes Plugin für Claude Code zur geführten, automatisierten Einrichtung neuer und bestehender Fullstack- und DevSecOps-Workspaces, mit konfigurierbaren Projektregeln, Skills, Hooks und CI/CD-Vorlagen für Agentic Coding.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Developer Workspace Kit: Node.js-Plugin für Claude Code zur geführten Einrichtung von Fullstack- und DevSecOps-Workspaces mit Regeln, Skills und Hooks.',
    stack: ['Node.js', 'Claude Code', 'GitHub Actions'],
    hasPage: true,
    // TODO(before production): replace with the public kit repository (PK-25).
    links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger' }],
    // DRAFT: placeholder image until a real terminal capture exists
    preview: { src: 'images/projects/developer-workspace-kit.webp', width: 640, height: 336 },
  },
];
