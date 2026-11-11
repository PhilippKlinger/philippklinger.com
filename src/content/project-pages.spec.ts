import { projectPageContent, ProjectPageContent } from './project-pages';
import { projects } from './projects';
import { TOPIC_A, TOPIC_B, TOPIC_C, findForbiddenTerm } from './testing/forbidden-terms';

const pages = Object.entries(projectPageContent) as [string, ProjectPageContent][];
const allText = JSON.stringify(projectPageContent);

const isFilled = (text: string) => text.trim().length > 0;
const wordsOf = (value: object) => JSON.stringify(Object.values(value)).match(/[\p{L}\d]+/gu);

// Spec 16.3 (D9): every card at 70 words or less.
const MAX_CARD_WORDS = 70;
const cardsOf = ({ architecture, decisions, failure }: ProjectPageContent): [string, object][] => [
  ['architecture', [architecture.summary, ...architecture.parts]],
  ['decision', decisions[0]],
  ['failure', failure],
];

describe('projectPageContent', () => {
  it('covers exactly the four projects of the routes', () => {
    expect(Object.keys(projectPageContent)).toEqual(projects.map((project) => project.slug));
  });

  it.each(pages)('%s has exactly one decision and one failure', (_slug, content) => {
    expect(content.decisions).toHaveLength(1);
    expect(Object.values(content.decisions[0]).every(isFilled)).toBe(true);
    expect(Object.keys(content.failure)).toEqual(['title', 'found', 'changed']);
    expect(Object.values(content.failure).every(isFilled)).toBe(true);
  });

  it.each(pages)('%s keeps every card at 70 words or less', (_slug, content) => {
    for (const [name, card] of cardsOf(content)) {
      expect(wordsOf(card)?.length ?? 0, name).toBeLessThanOrEqual(MAX_CARD_WORDS);
    }
  });

  describe('the VPS platform', () => {
    const content = projectPageContent['vps-plattform']!;

    it('tells the real Trivy finding as its failure', () => {
      expect(JSON.stringify(content.failure)).toContain('CVE-2026-111497');
    });

    it('leaves out what is not proven yet', () => {
      expect(JSON.stringify(content)).not.toMatch(/incident|assistent|llm|ollama|telegram/i);
    });
  });

  it.each(pages)('%s has an architecture with a summary and 2 to 6 parts', (_slug, content) => {
    expect(isFilled(content.architecture.summary)).toBe(true);
    expect(content.architecture.parts.length).toBeGreaterThanOrEqual(2);
    expect(content.architecture.parts.length).toBeLessThanOrEqual(6);
    expect(content.architecture.parts.every(isFilled)).toBe(true);
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
