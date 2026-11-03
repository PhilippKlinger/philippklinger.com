// DRAFT: project texts and links until Philipp delivers the final versions.
// Missing links point to platzhalter.invalid; the CI blocks them from going live.
export interface ProjectLink {
  label: string;
  url: string;
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
  /** Card only: links straight to the repository instead of a project page. */
  cardOnly?: boolean;
}

export const projects: Project[] = [
  {
    slug: 'neuro-check-in',
    title: 'Neuro Check-in',
    label: 'Eigenes Produkt',
    summary:
      'App für kurze tägliche Check-ins, entwickelt aus eigener Erfahrung mit Neurodivergenz.',
    stack: ['Angular', 'TypeScript', 'Firebase'],
    links: [{ label: 'Store', url: 'https://platzhalter.invalid/neuro-check-in/store' }],
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
    cardOnly: true,
  },
];
