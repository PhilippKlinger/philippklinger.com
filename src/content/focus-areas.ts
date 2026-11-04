// DRAFT: skills of the start page, wording to be approved.
// Titles in English like the final CV (Grill 2026-11-04), text in German.
export interface FocusArea {
  title: string;
  description: string;
  tools: string[];
}

export const focusAreas: FocusArea[] = [
  {
    title: 'Development',
    description:
      'Fullstack-Webanwendungen mit klarer Architektur, automatisierten Tests und Accessibility.',
    tools: [
      'Angular',
      'TypeScript',
      'React / React Native',
      'Python',
      'Django REST Framework',
      'PostgreSQL',
    ],
  },
  {
    title: 'CI/CD & Security',
    description:
      'Jede Änderung über Pull Request, mit Quality Gates, automatisierten Tests und Security-Checks.',
    tools: ['GitHub Actions', 'Docker / Compose', 'CodeQL', 'gitleaks', 'Dependabot'],
  },
  {
    title: 'Operations',
    description:
      'Linux-Server einrichten, per Monitoring überwachen und aus Backups wiederherstellen.',
    tools: ['Linux', 'Proxmox', 'Caddy', 'Sentry', 'Uptime Kuma', 'Backups'],
  },
];
