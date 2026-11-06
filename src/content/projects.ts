// DRAFT: project texts and links until Philipp delivers the final versions.
import type { ProjectKey } from './status';

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
  /** Short terms on the card. */
  chips: string[];
  links: ProjectLink[];
  /** Short line of the evidence chain, only for projects that have one. */
  proof?: string;
  /**
   * The project page /projekte/<slug>/ exists (stage 3). Without one the row
   * links straight to the first link, so no row ever points to a 404.
   */
  hasPage?: boolean;
  preview?: ProjectPreview;
  /** Project in status.json whose evidence chain the page shows. */
  evidence?: ProjectKey;
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
      'Eigene Android-App zur Selbstreflexion im Google Play Store mit React Native und TypeScript; Offline-Datenspeicherung mit SQLite, PDF-Export sowie automatisierte Unit- und E2E-Tests.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Neuro Check-in: eigene Android-App zur Selbstreflexion im Google Play Store mit React Native und TypeScript, SQLite, PDF-Export und automatisierten Tests.',
    stack: ['React Native', 'Expo', 'TypeScript', 'SQLite', 'Sentry'],
    chips: ['React Native', 'TypeScript', 'SQLite', 'E2E-Tests'],
    hasPage: true,
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
    slug: 'videoflix',
    title: 'Videoflix',
    label: 'Weiterbildung',
    summary:
      'Fullstack-Streaming-Plattform mit Angular, Django REST Framework und PostgreSQL; asynchrone Videoverarbeitung mit Redis/RQ, JWT-Auth und rollenbasierte Zugriffe.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Videoflix: Fullstack-Streaming-Plattform mit Angular, Django REST Framework und PostgreSQL, asynchrone Videoverarbeitung, JWT-Auth und Rollen.',
    stack: ['Angular', 'Django', 'PostgreSQL', 'Redis', 'Docker', 'GitHub Actions'],
    chips: ['CI/CD', 'Docker', 'Security-Checks', 'SBOM', 'Monitoring'],
    hasPage: true,
    // DRAFT: link labels.
    links: [
      { label: 'Live ansehen', url: 'https://videoflix.philipp-klinger.com' },
      { label: 'Code auf GitHub', url: 'https://github.com/PhilippKlinger/videoflix-backend' },
    ],
    proof: 'CI → Image → Deploy → Betrieb',
    evidence: 'videoflix',
    preview: { src: 'images/projects/videoflix.webp', width: 640, height: 336 },
  },
  {
    slug: 'conduit',
    title: 'Conduit',
    label: 'Weiterbildung',
    summary:
      'Bestehende Fullstack-Anwendung mit Docker Compose containerisiert; GitHub Actions für Image-Builds, GHCR-Publishing und automatisiertes Staging-Deployment mit Healthchecks.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Conduit: bestehende Fullstack-Anwendung mit Docker Compose, GitHub Actions für Image-Builds und GHCR-Publishing sowie Staging-Deployment mit Healthchecks.',
    stack: ['Angular', 'Django', 'Docker', 'GitHub Actions'],
    chips: ['Docker Compose', 'GitHub Actions', 'GHCR', 'Healthchecks'],
    hasPage: true,
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
    label: 'Eigenes Projekt',
    summary:
      'Node.js-Plugin für Claude Code zur geführten, automatisierten Einrichtung neuer und bestehender Fullstack- und DevSecOps-Workspaces; konfigurierbare Projektregeln, Skills, Hooks und CI/CD-Vorlagen für Agentic Coding.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Developer Workspace Kit: Node.js-Plugin für Claude Code zur geführten Einrichtung von Fullstack- und DevSecOps-Workspaces mit Regeln, Skills und Hooks.',
    stack: ['Node.js', 'Claude Code', 'GitHub Actions'],
    chips: ['Node.js', 'Claude Code', 'GitHub Actions'],
    hasPage: true,
    // No link until a public repository exists (PK-25).
    links: [],
    // DRAFT: placeholder image until a real terminal capture exists
    preview: { src: 'images/projects/developer-workspace-kit.webp', width: 640, height: 336 },
  },
];

/**
 * The site itself, with its own evidence chain (Grill 2026-11-04, option A). Not a row of the
 * list: that stays the four projects of the CV. The footer links here.
 */
// DRAFT: texts of this page, wording to be approved.
export const portfolioProject: Project = {
  slug: 'portfolio',
  title: 'Diese Website',
  label: 'Eigenes Projekt',
  summary:
    'Vorgerenderte Angular-Seite, ausgeliefert als statische Dateien: Jede Änderung läuft per Pull Request durch Tests und Sicherheitsscans, jeder Merge geht automatisch auf die Vorschau, die Hauptdomain nur nach Freigabe. Die ausgelieferten Dateien sind signiert.',
  description:
    'Wie philipp-klinger.com gebaut ist: Angular mit Prerendering, CI/CD mit Tests und Security-Scans, signierte Dateien und eine öffentliche Nachweiskette.',
  stack: ['Angular', 'TypeScript', 'SCSS', 'Playwright', 'GitHub Actions'],
  chips: [],
  hasPage: true,
  links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger/philippklinger.com' }],
  evidence: 'portfolio',
};
