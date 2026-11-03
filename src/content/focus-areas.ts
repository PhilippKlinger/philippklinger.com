// DRAFT: focus areas of the start page, wording to be approved.
export interface FocusArea {
  title: string;
  description: string;
  tools: string[];
}

export const focusAreas: FocusArea[] = [
  {
    title: 'Entwicklung',
    description: 'Webanwendungen mit klarer Struktur, getestet und barrierearm.',
    tools: ['Angular', 'TypeScript', 'Python', 'Django', 'REST-APIs'],
  },
  {
    title: 'Auslieferung & Sicherheit',
    description: 'Jede Änderung über Pull Request, automatische Prüfungen und Container.',
    tools: ['GitHub Actions', 'Docker', 'CodeQL', 'gitleaks', 'Dependabot'],
  },
  {
    title: 'Betrieb',
    description: 'Server einrichten, überwachen und im Fehlerfall wiederherstellen.',
    tools: ['Linux', 'Caddy', 'Sentry', 'Uptime Kuma', 'Backups'],
  },
];
