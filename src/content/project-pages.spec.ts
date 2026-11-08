import { projectPageContent, ProjectPageContent } from './project-pages';
import { projects } from './projects';
import { TOPIC_A, TOPIC_B, TOPIC_C, findForbiddenTerm } from './testing/forbidden-terms';

const pages = Object.entries(projectPageContent) as [string, ProjectPageContent][];
const allText = JSON.stringify(projectPageContent);

const isFilled = (text: string) => text.trim().length > 0;

describe('projectPageContent', () => {
  it('covers exactly the four projects of the routes', () => {
    expect(Object.keys(projectPageContent)).toEqual(projects.map((project) => project.slug));
  });

  it.each(pages)('%s has 2 to 3 decisions with reason and price', (_slug, content) => {
    expect(content.decisions.length).toBeGreaterThanOrEqual(2);
    expect(content.decisions.length).toBeLessThanOrEqual(3);
    for (const decision of content.decisions) {
      expect(Object.values(decision).every(isFilled)).toBe(true);
    }
  });

  it.each(pages)('%s has an architecture with 3 to 6 parts', (_slug, content) => {
    expect(isFilled(content.architecture.summary)).toBe(true);
    expect(content.architecture.parts.length).toBeGreaterThanOrEqual(3);
    expect(content.architecture.parts.length).toBeLessThanOrEqual(6);
    for (const part of content.architecture.parts) {
      expect(Object.values(part).every(isFilled)).toBe(true);
    }
  });

  it.each(pages)('%s has a complete failure', (_slug, content) => {
    expect(Object.values(content.failure).every(isFilled)).toBe(true);
  });

  it('has no internal values', () => {
    expect(allText).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
    expect(allText).not.toMatch(/\b[a-z][\w.-]*:\d{2,5}\b/i);
    expect(allText).not.toMatch(
      /\b[a-z]:[\\/]|\.\.[\\/]|\/(home|users|mnt)\/|\.worktrees|_claude-kit|bewerbungsprojekte|nd_app|docs\/|decisions\.md|backlog\.md|handoff\.md/i,
    );
  });

  it('has no private topics', async () => {
    expect(await findForbiddenTerm(allText, [TOPIC_A, TOPIC_B, TOPIC_C])).toBe(false);
  });

  it('does not suggest a foreign review', () => {
    expect(allText).not.toMatch(/reviewer|vier-augen|code review durch/i);
  });
});
