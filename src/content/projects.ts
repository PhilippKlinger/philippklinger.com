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
    summary:
      'App für kurze tägliche Check-ins, entwickelt aus eigener Erfahrung mit Neurodivergenz.',
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
      'Videoplattform mit Django-Backend, HLS-Streaming und Auslieferung per CI/CD auf einen eigenen Server.',
    stack: ['Django', 'PostgreSQL', 'Redis', 'Docker', 'GitHub Actions'],
    links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger/videoflix-backend' }],
    proof: 'CI → Image → Deploy → Betrieb',
  },
  {
    slug: 'conduit',
    title: 'Conduit',
    label: 'Weiterbildung',
    summary:
      'Fullstack-Anwendung, containerisiert und mit einer Pipeline von Build bis Deployment.',
    stack: ['Angular', 'Django', 'Docker', 'GitHub Actions'],
    links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger/conduit-container' }],
  },
  {
    slug: 'truck-signs-api',
    title: 'Truck Signs API',
    label: 'Weiterbildung',
    summary:
      'REST-API für einen Online-Shop, containerisiert und mit automatischen Prüfungen abgesichert.',
    stack: ['Django REST', 'PostgreSQL', 'Docker'],
    links: [{ label: 'GitHub', url: 'https://github.com/PhilippKlinger/truck-signs-api' }],
    preview: { src: 'images/projects/truck-signs-api.webp', width: 640, height: 306 },
  },
];
