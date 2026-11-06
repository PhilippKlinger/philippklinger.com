import { makeStateKey, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BuildInfo } from '../../../content/build-info';
import { BUILD_INFO } from './build-info-token';
import { Footer } from './footer';

const info: BuildInfo = {
  sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  runId: '25123456789',
};
const actionsUrl = 'https://github.com/PhilippKlinger/philippklinger.com/actions';
const line = 'Diese Seite: getestet und deployt per GitHub Actions';
const stateKey = makeStateKey<BuildInfo | null>('build-info');

async function renderFooter(
  build: BuildInfo | null,
  handedOver: BuildInfo | null = null,
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: BUILD_INFO, useValue: build }],
  });
  if (handedOver) TestBed.inject(TransferState).set(stateKey, handedOver);
  const fixture = TestBed.createComponent(Footer);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const textOf = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();

function linkNamed(footer: HTMLElement, name: string): HTMLAnchorElement | undefined {
  const links = Array.from(footer.querySelectorAll<HTMLAnchorElement>('.built a'));
  return links.find((link) => textOf(link) === name);
}

describe('Footer build line', () => {
  it('shows line, short sha and link to the run with build info', async () => {
    const footer = await renderFooter(info);
    expect(textOf(footer.querySelector('.built'))).toBe(
      `${line}, Build a1b2c3d · So ist diese Seite gebaut`,
    );
    expect(linkNamed(footer, 'Build a1b2c3d')?.getAttribute('href')).toBe(
      `${actionsUrl}/runs/25123456789`,
    );
  });

  it('shows the line with a link to all runs without build info', async () => {
    const footer = await renderFooter(null);
    expect(textOf(footer.querySelector('.built'))).toBe(`${line} · So ist diese Seite gebaut`);
    expect(linkNamed(footer, line)?.getAttribute('href')).toBe(actionsUrl);
  });

  it.each([
    ['with', info],
    ['without', null],
  ])('never shows undefined %s build info', async (_case, build) => {
    const footer = await renderFooter(build);
    expect(footer.textContent).not.toContain('undefined');
    for (const link of Array.from(footer.querySelectorAll('a'))) {
      expect(link.getAttribute('href')).not.toContain('undefined');
    }
  });

  it.each([
    ['with', info],
    ['without', null],
  ])('keeps the link to the site page %s build info', async (_case, build) => {
    const footer = await renderFooter(build);
    expect(linkNamed(footer, 'So ist diese Seite gebaut')?.getAttribute('href')).toBe(
      '/projekte/portfolio/',
    );
  });

  it('hands the build info to the browser', async () => {
    await renderFooter(info);
    expect(TestBed.inject(TransferState).get(stateKey, null)).toEqual(info);
  });

  // The browser has no file to read: without this the hydrated page would lose the build.
  it('shows the handed over build info in the browser', async () => {
    const footer = await renderFooter(null, info);
    expect(linkNamed(footer, 'Build a1b2c3d')).toBeDefined();
  });
});
