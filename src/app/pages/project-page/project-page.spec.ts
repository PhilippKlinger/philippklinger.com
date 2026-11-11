import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { deliveryPlans } from '../../../content/delivery-plans';
import { projectPageContent, ProjectPageContent } from '../../../content/project-pages';
import { portfolioProject, Project, projects } from '../../../content/projects';
import { buildDeliveryView, deliveryTexts } from '../../../content/software-delivery';
import { PROJECT_PAGE_CONTENT, ProjectPage } from './project-page';

const bySlug = (slug: string) => projects.find((project) => project.slug === slug)!;
const texts = (nodes: Iterable<Element>) => [...nodes].map((node) => node.textContent?.trim());

// Own sample data: the real texts arrive separately and must not decide these tests.
const sampleContent: ProjectPageContent = {
  architecture: {
    summary: 'Beispiel-Architektur in einem Satz.',
    parts: ['Frontend', 'API'],
  },
  decisions: [{ title: 'Entscheidung A', reason: 'Grund A', price: 'Preis A' }],
  failure: { title: 'Der Fehler', found: 'Wie er auffiel', changed: 'Was anders wurde' },
};

async function renderPage(project: Project, content: ProjectPageContent | null = null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: PROJECT_PAGE_CONTENT,
        useValue: content ? { [project.slug]: content } : {},
      },
    ],
  });
  const fixture = TestBed.createComponent(ProjectPage);
  fixture.componentRef.setInput('project', project);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ProjectPage', () => {
  it.each(projects)('shows title and summary of "$title"', async (project) => {
    const page = await renderPage(project);
    expect(page.querySelector('h1')?.textContent).toContain(project.title);
    expect(page.querySelector('.summary')?.textContent).toContain(project.summary);
  });

  it.each(projects)('shows exactly one h1 on "$title"', async (project) => {
    expect((await renderPage(project)).querySelectorAll('h1')).toHaveLength(1);
  });

  it.each([...projects, portfolioProject])(
    'shows the status line of the list on "$title"',
    async (project) => {
      const { signal } = buildDeliveryView(deliveryPlans[project.slug], null);
      const line = (await renderPage(project)).querySelector('.signal');
      expect(line?.querySelector(`app-state-badge .state-${signal.state}`)).not.toBeNull();
      expect(line?.querySelector('app-state-badge')?.textContent?.trim()).toBe(signal.status);
      expect(line?.querySelector('.signal-when')?.textContent?.trim() ?? '').toBe(signal.when);
    },
  );

  it.each(projects)('shows the stack of "$title" in one line', async (project) => {
    const tech = (await renderPage(project)).querySelector('.tech');
    expect(tech?.textContent?.trim()).toBe(project.stack.join(' · '));
  });

  it.each(projects)(
    'has the links of "$title" as buttons, the first one filled',
    async (project) => {
      const links = [...(await renderPage(project)).querySelectorAll('.links a')];
      expect(links.map((link) => link.getAttribute('href'))).toEqual(
        project.links.map((link) => link.url),
      );
      expect(texts(links.map((link) => link.querySelector('.link-label')!))).toEqual(
        project.links.map((link) => link.label),
      );
      expect(links.map((link) => link.classList.contains('button-primary'))).toEqual(
        project.links.map((_link, index) => index === 0),
      );
    },
  );

  it('shows no empty link block for a project without links', async () => {
    const page = await renderPage(bySlug('developer-workspace-kit'));
    expect(page.querySelector('.links')).toBeNull();
    expect(texts(page.querySelectorAll('h2'))).not.toContain('Links');
  });

  it.each(projects.filter((project) => project.slug !== 'developer-workspace-kit'))(
    'shows the software delivery chain of "$title"',
    async (project) => {
      const page = await renderPage(project);
      expect(texts(page.querySelectorAll('app-delivery-chain .tab .name'))).toEqual(
        deliveryPlans[project.slug].steps.map((step) => step.name),
      );
    },
  );

  it('shows the chain of the kit as one private line', async () => {
    const page = await renderPage(bySlug('developer-workspace-kit'));
    expect(page.querySelector('app-delivery-chain .private')).not.toBeNull();
    expect(page.querySelector('app-delivery-chain .tab')).toBeNull();
  });

  it('shows neither label, proof nor stack any more', async () => {
    const project = bySlug('videoflix');
    const page = await renderPage(project);
    expect(page.querySelector('.label')).toBeNull();
    expect(page.querySelector('.proof')).toBeNull();
    expect(page.querySelector('.stack')).toBeNull();
    expect(page.textContent).not.toMatch(/Weiterbildung|Eigenes (Produkt|Projekt)/);
  });

  it('shows "Wie es gebaut ist" only with content', async () => {
    const without = await renderPage(bySlug('vps-plattform'));
    expect(without.textContent).not.toContain(deliveryTexts.howBuilt);
    expect(without.querySelector('.how-built')).toBeNull();
    TestBed.resetTestingModule();
    const page = await renderPage(bySlug('vps-plattform'), sampleContent);
    expect(texts(page.querySelectorAll('h2'))).toEqual([
      deliveryTexts.title,
      deliveryTexts.howBuilt,
    ]);
  });

  it('takes the content of the real file by default', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    expect(TestBed.inject(PROJECT_PAGE_CONTENT)).toBe(projectPageContent);
  });

  it('shows three cards: architecture, decision and failure', async () => {
    const page = await renderPage(bySlug('vps-plattform'), sampleContent);
    expect(texts(page.querySelectorAll('.how-built .card h3'))).toEqual([
      deliveryTexts.architecture,
      deliveryTexts.decision,
      deliveryTexts.failure,
    ]);
  });

  it('shows the architecture as the summary and then its parts in order', async () => {
    const page = await renderPage(bySlug('vps-plattform'), sampleContent);
    const card = page.querySelector('.card-architecture')!;
    expect(card.querySelector('p')?.textContent).toContain(sampleContent.architecture.summary);
    expect(texts(card.querySelectorAll('.parts li'))).toEqual(['Frontend', 'API']);
  });

  it('shows the decision with title, reason and price', async () => {
    const page = await renderPage(bySlug('vps-plattform'), sampleContent);
    const card = page.querySelector('.card-decision')!;
    const [{ title, reason, price }] = sampleContent.decisions;
    expect(card.querySelector('h4')?.textContent).toContain(title);
    expect(texts(card.querySelectorAll('dd'))).toEqual([reason, price]);
  });

  it('shows the failure with title, found and changed', async () => {
    const page = await renderPage(bySlug('vps-plattform'), sampleContent);
    const card = page.querySelector('.card-failure')!;
    const { title, found, changed } = sampleContent.failure;
    expect(card.querySelector('h4')?.textContent).toContain(title);
    expect(texts(card.querySelectorAll('dt'))).toEqual(['Gefunden', 'Geändert']);
    expect(texts(card.querySelectorAll('dd'))).toEqual([found, changed]);
  });

  it('shows the portfolio page without the content blocks', async () => {
    const page = await renderPage(portfolioProject);
    expect(page.querySelector('.how-built')).toBeNull();
    expect(page.querySelectorAll('app-delivery-chain .tab')).toHaveLength(5);
  });

  it('shows the preview with its size when there is one', async () => {
    const project = bySlug('videoflix');
    const image = (await renderPage(project)).querySelector('.media img');
    expect(image?.getAttribute('src')).toBe(project.preview?.src);
    expect(image?.getAttribute('width')).toBe(String(project.preview?.width));
    expect(image?.getAttribute('height')).toBe(String(project.preview?.height));
    expect(image?.getAttribute('alt')).toBe('');
  });

  it('shows a placeholder hidden from screen readers without a preview', async () => {
    const page = await renderPage({ ...bySlug('vps-plattform'), preview: undefined });
    expect(page.querySelector('img')).toBeNull();
    expect(page.querySelector('.media .placeholder')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('leads back to the project list', async () => {
    const back = (await renderPage(bySlug('vps-plattform'))).querySelector('a.back');
    expect(back?.getAttribute('href')).toBe('/#projekte');
    expect(back?.textContent?.trim()).toBeTruthy();
  });
});
