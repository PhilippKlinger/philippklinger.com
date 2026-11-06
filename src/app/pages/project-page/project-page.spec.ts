import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { deliveryPlans } from '../../../content/delivery-plans';
import { projectPageContent, ProjectPageContent } from '../../../content/project-pages';
import { portfolioProject, Project, projects } from '../../../content/projects';
import { deliveryTexts } from '../../../content/software-delivery';
import { PROJECT_PAGE_CONTENT, ProjectPage } from './project-page';

const bySlug = (slug: string) => projects.find((project) => project.slug === slug)!;
const texts = (nodes: Iterable<Element>) => [...nodes].map((node) => node.textContent?.trim());

// Own sample data: the real texts arrive separately and must not decide these tests.
const sampleContent: ProjectPageContent = {
  architecture: {
    summary: 'Beispiel-Architektur in einem Satz.',
    parts: [
      { name: 'Frontend', role: 'Rolle Frontend' },
      { name: 'API', role: 'Rolle API' },
    ],
  },
  decisions: [
    { title: 'Entscheidung A', reason: 'Grund A', price: 'Preis A' },
    { title: 'Entscheidung B', reason: 'Grund B', price: 'Preis B' },
    { title: 'Entscheidung C', reason: 'Grund C', price: 'Preis C' },
  ],
  failure: {
    title: 'Der Fehler',
    what: 'Was schief lief',
    found: 'Wie er auffiel',
    changed: 'Was anders wurde',
  },
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

  it.each(projects)('has the quiet links of "$title"', async (project) => {
    const links = [...(await renderPage(project)).querySelectorAll('.links a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      project.links.map((link) => link.url),
    );
    expect(texts(links)).toEqual(project.links.map((link) => link.label));
  });

  it('shows no empty link block for a project without links', async () => {
    const page = await renderPage(bySlug('developer-workspace-kit'));
    expect(page.querySelector('.links')).toBeNull();
    expect(texts(page.querySelectorAll('h2'))).not.toContain('Links');
  });

  it.each(projects)('shows the software delivery steps of "$title"', async (project) => {
    const page = await renderPage(project);
    expect(texts(page.querySelectorAll('app-delivery-steps .step h3'))).toEqual(
      deliveryPlans[project.slug].steps.map((step) => step.name),
    );
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
    const without = await renderPage(bySlug('conduit'));
    expect(without.textContent).not.toContain(deliveryTexts.howBuilt);
    expect(without.querySelector('.how-built')).toBeNull();
    TestBed.resetTestingModule();
    const page = await renderPage(bySlug('conduit'), sampleContent);
    expect(texts(page.querySelectorAll('h2'))).toEqual([
      deliveryTexts.title,
      deliveryTexts.howBuilt,
    ]);
  });

  it('takes the content of the real file by default', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    expect(TestBed.inject(PROJECT_PAGE_CONTENT)).toBe(projectPageContent);
  });

  it('shows the architecture as parts with their role and the summary', async () => {
    const page = await renderPage(bySlug('conduit'), sampleContent);
    const block = page.querySelector('.block-architecture')!;
    expect(block.querySelector('h3')?.textContent).toContain(deliveryTexts.architecture);
    expect(texts(block.querySelectorAll('.part strong'))).toEqual(['Frontend', 'API']);
    expect(texts(block.querySelectorAll('.part span'))).toEqual(['Rolle Frontend', 'Rolle API']);
    expect(block.textContent).toContain(sampleContent.architecture.summary);
  });

  it('shows 2 to 3 decisions with reason and price', async () => {
    const page = await renderPage(bySlug('conduit'), sampleContent);
    const block = page.querySelector('.block-decisions')!;
    expect(block.querySelector('h3')?.textContent).toContain(deliveryTexts.decisions);
    const decisions = [...block.querySelectorAll('.decision')];
    expect(decisions).toHaveLength(3);
    sampleContent.decisions.forEach(({ title, reason, price }, index) => {
      expect(decisions[index].querySelector('h4')?.textContent).toContain(title);
      expect(decisions[index].textContent).toContain(reason);
      expect(decisions[index].textContent).toContain(price);
    });
  });

  it('shows the failure with what, found and changed', async () => {
    const page = await renderPage(bySlug('conduit'), sampleContent);
    const block = page.querySelector('.block-failure')!;
    expect(block.querySelector('h3')?.textContent).toContain(deliveryTexts.failure);
    const { title, what, found, changed } = sampleContent.failure;
    expect(block.querySelector('h4')?.textContent).toContain(title);
    for (const text of [what, found, changed]) expect(block.textContent).toContain(text);
  });

  it('shows the portfolio page without the content blocks', async () => {
    const page = await renderPage(portfolioProject);
    expect(page.querySelector('.how-built')).toBeNull();
    expect(page.querySelectorAll('app-delivery-steps .step')).toHaveLength(5);
  });

  it('shows the preview with its size when there is one', async () => {
    const project = bySlug('videoflix');
    const image = (await renderPage(project)).querySelector('.media img');
    expect(image?.getAttribute('src')).toBe(project.preview?.src);
    expect(image?.getAttribute('width')).toBe(String(project.preview?.width));
    expect(image?.getAttribute('height')).toBe(String(project.preview?.height));
    expect(image?.getAttribute('alt')).toBe('');
  });

  it('shows no image for a project without a preview', async () => {
    const page = await renderPage({ ...bySlug('conduit'), preview: undefined });
    expect(page.querySelector('img')).toBeNull();
    expect(page.querySelector('.media')).toBeNull();
  });

  it('leads back to the project list', async () => {
    const back = (await renderPage(bySlug('conduit'))).querySelector('a.back');
    expect(back?.getAttribute('href')).toBe('/#projekte');
    expect(back?.textContent?.trim()).toBeTruthy();
  });
});
