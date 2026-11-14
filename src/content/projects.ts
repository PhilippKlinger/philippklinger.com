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
  // DRAFT: end of the page, wording to be approved.
  askTitle: 'Fragen zu',
  askButton: 'Schreib mir',
  listLink: 'Zur Projektliste',
  nextLabel: 'Nächstes Projekt',
  navLabel: 'Projekte',
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
    preview: { src: 'images/projects/videoflix.webp', width: 704, height: 378 },
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
    preview: { src: 'images/projects/neuro-check-in.webp', width: 704, height: 385 },
  },
  {
    slug: 'vps-plattform',
    title: 'VPS-Plattform',
    // DRAFT: card text after the proposal of the handover, without claims the repositories lack.
    summary:
      'Gemeinsame Infrastruktur für die Projekte auf einem VPS, als Code beschrieben: Edge-Proxy mit TLS und Sicherheits-Headern, Monitoring mit öffentlicher Statusseite und eine CI, die bei jeder Änderung die echte Konfiguration startet und auf Sicherheitszusagen prüft.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'VPS-Plattform als Code: Edge-Proxy mit Caddy, Monitoring mit Uptime Kuma und öffentlicher Statusseite, CI mit Smoke-Tests und Trivy-Scans.',
    stack: ['Docker Compose', 'Caddy', 'Uptime Kuma', 'GitHub Actions', 'Trivy'],
    chips: ['Docker Compose', 'Caddy', 'Uptime Kuma', 'GitHub Actions', 'Trivy'],
    // DRAFT: link labels.
    links: [
      { label: 'Statusseite', url: 'https://status.philipp-klinger.com' },
      { label: 'Edge-Proxy auf GitHub', url: 'https://github.com/PhilippKlinger/vps-edge' },
      { label: 'Monitoring auf GitHub', url: 'https://github.com/PhilippKlinger/vps-monitoring' },
    ],
    // No preview until Philipp confirms the screenshot of the status page (plan E7).
  },
  {
    slug: 'buildorder',
    title: 'Buildorder',
    // DRAFT: no version in the text, the release page and the measured CI stay current (kit2).
    summary:
      'Plugin für Claude Code, das um den Agenten herum die Engineering-Standards aufbaut: geführte Einrichtung eines Workspace mit Doc-Map in einem privaten Docs-Repo, Hooks als Leitplanken für Commits und Steuerdateien und eine CI-Pipeline mit Security-Checks für neue Projekte. Öffentlich auf GitHub veröffentlicht.',
    // DRAFT: meta description, shortened from the summary.
    description:
      'Buildorder: Plugin für Claude Code, das Workspace, Doc-Map, Hooks und eine CI-Pipeline mit Security-Checks einrichtet. Öffentlich auf GitHub.',
    stack: ['Node.js', 'Claude Code', 'GitHub Actions'],
    chips: ['Node.js', 'Claude Code', 'GitHub Actions'],
    // DRAFT: link labels.
    links: [
      { label: 'Code auf GitHub', url: 'https://github.com/PhilippKlinger/buildorder' },
      { label: 'Releases', url: 'https://github.com/PhilippKlinger/buildorder/releases' },
    ],
    // DRAFT: placeholder image until a real terminal capture exists (kit5)
    preview: { src: 'images/projects/buildorder.webp', width: 640, height: 336 },
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
