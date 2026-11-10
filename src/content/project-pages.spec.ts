import { projectPageContent, ProjectPageContent } from './project-pages';
import { projects } from './projects';
import { TOPIC_A, TOPIC_B, TOPIC_C, findForbiddenTerm } from './testing/forbidden-terms';

const pages = Object.entries(projectPageContent) as [string, ProjectPageContent][];
const allText = JSON.stringify(projectPageContent);

const isFilled = (text: string) => text.trim().length > 0;
const wordsOf = (value: object) => JSON.stringify(Object.values(value)).match(/[\p{L}\d]+/gu);

// Written in the cut of Block C (DECISIONS 2026-11-10): one decision, cards of about 60 words.
const BLOCK_C_PAGES = ['vps-plattform'];
const olderPages = pages.filter(([slug]) => !BLOCK_C_PAGES.includes(slug));

describe('projectPageContent', () => {
  it('covers exactly the four projects of the routes', () => {
    expect(Object.keys(projectPageContent)).toEqual(projects.map((project) => project.slug));
  });

  it.each(olderPages)('%s has 2 to 3 decisions with reason and price', (_slug, content) => {
    expect(content.decisions.length).toBeGreaterThanOrEqual(2);
    expect(content.decisions.length).toBeLessThanOrEqual(3);
    for (const decision of content.decisions) {
      expect(Object.values(decision).every(isFilled)).toBe(true);
    }
  });

  describe('the VPS platform in the cut of Block C', () => {
    const content = projectPageContent['vps-plattform']!;

    it('has exactly one decision with reason and price', () => {
      expect(content.decisions).toHaveLength(1);
      expect(Object.values(content.decisions[0]).every(isFilled)).toBe(true);
    });

    it.each<[string, () => object]>([
      [
        'architecture',
        () => [
          content.architecture.summary,
          ...content.architecture.parts.flatMap(({ name, role }) => [name, role]),
        ],
      ],
      ['decision', () => content.decisions[0]],
      ['failure', () => content.failure],
    ])('keeps the %s card at about 60 words', (_name, card) => {
      const words = wordsOf(card()) ?? [];
      expect(words.length).toBeGreaterThanOrEqual(40);
      expect(words.length).toBeLessThanOrEqual(80);
    });

    it('tells the real Trivy finding as its failure', () => {
      expect(JSON.stringify(content.failure)).toContain('CVE-2026-111497');
    });

    it('leaves out what is not proven yet', () => {
      expect(JSON.stringify(content)).not.toMatch(/incident|assistent|llm|ollama|telegram/i);
    });
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
