import { formatLlmsTxt, type LlmsTxtData } from './llms';
import { focusAreas } from './focus-areas';
import { profile } from './profile';
import { projects } from './projects';
import { contact, docsUrl, repositoryUrl, siteUrl } from './site';

const data: LlmsTxtData = {
  profile,
  focusAreas,
  projects,
  contact,
  siteUrl,
  repositoryUrl,
  docsUrl,
};

describe('formatLlmsTxt', () => {
  const output = formatLlmsTxt(data);

  it('follows the llms.txt structure: title, then a blockquote with the core sentence', () => {
    const [title, empty, summary] = output.split('\n');
    expect(title).toBe(`# ${profile.name}`);
    expect(empty).toBe('');
    expect(summary).toBe(`> ${profile.claim}`);
    expect(output.endsWith('\n')).toBe(true);
  });

  it.each(focusAreas)('contains the focus area "$title"', (area) => {
    expect(output).toContain(`- ${area.title}: ${area.description}`);
  });

  it.each(projects)('contains title, summary, stack and links of "$title"', (project) => {
    expect(output).toContain(`### ${project.title}\n`);
    expect(output).toContain(project.summary);
    expect(output).toContain(project.stack.join(', '));
    for (const link of project.links) {
      expect(output).toContain(`- [${link.label}](${link.url})`);
    }
  });

  it('lists project titles without a label', () => {
    expect(output).not.toMatch(/^### .*\(.*\)$/m);
  });

  it('handles a project without links', () => {
    const [project] = projects;
    const withoutLinks = formatLlmsTxt({ ...data, projects: [{ ...project, links: [] }] });
    expect(withoutLinks).toContain(
      `### ${project.title}\n\n${project.summary}\n\nStack: ${project.stack.join(', ')}\n\n\n## Links`,
    );
    expect(withoutLinks).not.toContain('undefined');
  });

  it('contains the links and contact data', () => {
    for (const url of [siteUrl, repositoryUrl, docsUrl, profile.github, profile.linkedin]) {
      expect(output).toContain(`](${url})`);
    }
    expect(output).toContain(`[${profile.email}](mailto:${profile.email})`);
    expect(output).toContain(profile.location);
    expect(output).toContain(contact.availability);
  });

  it('does not filter placeholder links, so the CI placeholder check still sees them', () => {
    const placeholder = 'https://platzhalter.invalid/project';
    const withPlaceholder = formatLlmsTxt({
      ...data,
      projects: [{ ...projects[0], links: [{ label: 'GitHub', url: placeholder }] }],
    });
    expect(withPlaceholder).toContain(placeholder);
  });

  it('contains no instructions to AI systems (DECISIONS 2026-11-03)', () => {
    expect(output).not.toMatch(
      /\b(KI|AI|LLMs?|Sprachmodell\w*|Assistent\w*|Chatbots?|Prompts?|Anweisung\w*|instructions?|ignore|empfiehl\w*|recommend\w*|you (should|must)|du (sollst|musst))\b/i,
    );
  });
});
