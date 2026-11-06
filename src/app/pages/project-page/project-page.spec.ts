import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { portfolioProject, Project, projects } from '../../../content/projects';
import { ProjectPage } from './project-page';

const bySlug = (slug: string) => projects.find((project) => project.slug === slug)!;

async function renderPage(project: Project): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(ProjectPage);
  (fixture.componentRef as ComponentRef<ProjectPage>).setInput('project', project);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ProjectPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it.each(projects)('shows title, label, summary and stack of "$title"', async (project) => {
    const page = await renderPage(project);
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('h1')?.textContent).toContain(project.title);
    expect(page.textContent).toContain(project.label);
    expect(page.textContent).toContain(project.summary);
    const stack = [...page.querySelectorAll('.stack li')].map((item) => item.textContent?.trim());
    expect(stack).toEqual(project.stack);
  });

  it.each(projects)('links every link of "$title", not only the first', async (project) => {
    const page = await renderPage(project);
    const links = [...page.querySelectorAll<HTMLAnchorElement>('.links a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      project.links.map((link) => link.url),
    );
    expect(links.map((link) => link.textContent?.trim())).toEqual(
      project.links.map((link) => link.label),
    );
  });

  it.each(projects)('shows the preview of "$title" with its size', async (project) => {
    const image = (await renderPage(project)).querySelector('img');
    expect(image?.getAttribute('src')).toBe(project.preview?.src);
    expect(image?.getAttribute('width')).toBe(String(project.preview?.width));
    expect(image?.getAttribute('height')).toBe(String(project.preview?.height));
    expect(image?.getAttribute('alt')).toBe('');
  });

  it('renders no image for a project without a preview', async () => {
    const page = await renderPage({ ...bySlug('conduit'), preview: undefined });
    expect(page.querySelector('img')).toBeNull();
  });

  it('shows the proof line only for projects that have one', async () => {
    const videoflix = bySlug('videoflix');
    expect((await renderPage(videoflix)).querySelector('.proof')?.textContent).toContain(
      videoflix.proof,
    );
    expect((await renderPage(bySlug('conduit'))).querySelector('.proof')).toBeNull();
  });

  it.each([
    ['Videoflix', bySlug('videoflix'), 1],
    ['the site itself', portfolioProject, 1],
    ['Conduit', bySlug('conduit'), 0],
  ])('shows an evidence chain only where there is one: %s', async (_name, project, count) => {
    expect((await renderPage(project)).querySelectorAll('app-evidence-chain')).toHaveLength(count);
  });

  it('leads back to the project list', async () => {
    const back = (await renderPage(bySlug('conduit'))).querySelector('a.back');
    expect(back?.getAttribute('href')).toBe('/#projekte');
    expect(back?.textContent?.trim()).toBeTruthy();
  });
});
