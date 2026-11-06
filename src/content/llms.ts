// Pure formatter for /llms.txt: factual summary, no instructions to AI systems
// (DECISIONS 2026-11-03). Only type imports here, because scripts/generate-llms-txt.mjs
// loads this file with Node's type stripping, which cannot resolve extensionless imports.
import type { FocusArea } from './focus-areas';
import type { Project } from './projects';

export interface LlmsTxtData {
  profile: {
    name: string;
    role: string;
    location: string;
    email: string;
    github: string;
    linkedin: string;
    claim: string;
  };
  focusAreas: FocusArea[];
  projects: Pick<Project, 'title' | 'summary' | 'stack' | 'links'>[];
  contact: { availability: string };
  siteUrl: string;
  repositoryUrl: string;
  docsUrl: string;
}

export function formatLlmsTxt(data: LlmsTxtData): string {
  const { profile, focusAreas, projects, contact, siteUrl, repositoryUrl, docsUrl } = data;

  const lines = [
    `# ${profile.name}`,
    '',
    `> ${profile.claim}`,
    '',
    profile.role,
    '',
    '## Schwerpunkte',
    '',
    ...focusAreas.map((area) => `- ${area.title}: ${area.description}`),
    '',
    '## Projekte',
    ...projects.flatMap((project) => [
      '',
      `### ${project.title}`,
      '',
      project.summary,
      '',
      `Stack: ${project.stack.join(', ')}`,
      '',
      ...project.links.map((link) => `- [${link.label}](${link.url})`),
    ]),
    '',
    '## Links',
    '',
    `- [Website](${siteUrl})`,
    `- [Docs](${docsUrl})`,
    `- [Source on GitHub](${repositoryUrl})`,
    `- [GitHub](${profile.github})`,
    `- [LinkedIn](${profile.linkedin})`,
    '',
    '## Kontakt',
    '',
    `- E-Mail: [${profile.email}](mailto:${profile.email})`,
    `- Standort: ${profile.location}`,
    `- ${contact.availability}`,
  ];

  return `${lines.join('\n')}\n`;
}
