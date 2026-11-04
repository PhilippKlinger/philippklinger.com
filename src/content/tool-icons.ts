// Tool icons of the skills section (B13, spec 3.2): symbol ids in public/images/tools.svg.
// Not under /icons/: the host maps that path to Apache's own icon folder.
// One cached sprite instead of inline paths, which would land in the HTML and the JS bundle.
// Logos: Simple Icons 16.36.0, CC0 1.0 (https://simpleicons.org), paths copied unchanged from
// https://cdn.jsdelivr.net/npm/simple-icons@16.36.0/icons/<slug>.svg. Tools without a Simple Icon
// (CodeQL, gitleaks, Backups) get a plain icon drawn for this site; DRF uses the Django logo.
export const toolIcons = {
  Angular: 'angular',
  TypeScript: 'typescript',
  'React / React Native': 'react',
  Python: 'python',
  'Django REST Framework': 'django',
  PostgreSQL: 'postgresql',
  'GitHub Actions': 'githubactions',
  'Docker / Compose': 'docker',
  CodeQL: 'codeql',
  gitleaks: 'gitleaks',
  Dependabot: 'dependabot',
  Linux: 'linux',
  Proxmox: 'proxmox',
  Caddy: 'caddy',
  Sentry: 'sentry',
  'Uptime Kuma': 'uptimekuma',
  Backups: 'backups',
} as const;

export type ToolName = keyof typeof toolIcons;
