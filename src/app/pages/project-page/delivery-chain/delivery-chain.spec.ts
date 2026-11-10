import { TestBed } from '@angular/core/testing';
import { buildChainView } from '../../../../content/delivery-chain';
import { deliveryPlans } from '../../../../content/delivery-plans';
import { deliveryTexts } from '../../../../content/software-delivery';
import { ProjectStatus, StatusDocument } from '../../../../content/status';
import { healthyStatus } from '../../../../content/status.fixture';
import { DeliveryStatus } from '../../../delivery/delivery-status';
import { STATUS_SNAPSHOT } from '../../../delivery/status-snapshot';
import { DeliveryChain } from './delivery-chain';

const generatedAt = '2026-11-06T00:58:11.069Z';
const repo = 'PhilippKlinger/example';
const digest = 'sha256:346d0a94572ee913c68f3a6b528aeb79d39175beb265489ac390fdcfa72c09de';
const texts = (nodes: Iterable<Element>) => [...nodes].map((node) => node.textContent?.trim());

/** Every station proven and linked, the image with a digest, so the verify command exists. */
function linkedStatus(): ProjectStatus {
  const status = healthyStatus();
  status.code.links.push({ kind: 'pull-requests', source: repo, url: 'https://github.com/prs' });
  status.checks.links = [
    { kind: 'workflow-run', source: repo, url: 'https://github.com/run', workflow: 'CI' },
  ];
  const [built] = status.supplyChain.signals.repos;
  built.attestation = { ...built.attestation!, subjectDigest: digest };
  status.supplyChain.links = [
    { kind: 'image', source: repo, url: 'https://github.com/packages/example' },
    { kind: 'attestations', source: repo, url: 'https://github.com/attestations' },
  ];
  status.live.links = [{ kind: 'version-endpoint', source: 'site', url: 'https://example.com/v' }];
  status.stability.links = [{ kind: 'status-page', source: 'site', url: 'https://example.com/s' }];
  status.restore.links = [{ kind: 'restore-test', source: repo, url: 'https://github.com/r' }];
  return status;
}

function documentWith(status: ProjectStatus): StatusDocument {
  return { schemaVersion: 1, generatedAt, projects: { videoflix: status, portfolio: status } };
}

function mount(slug: string, document: StatusDocument | null = null) {
  TestBed.configureTestingModule({
    providers: [{ provide: STATUS_SNAPSHOT, useValue: document }],
  });
  const fixture = TestBed.createComponent(DeliveryChain);
  fixture.componentRef.setInput('slug', slug);
  return fixture;
}

/** After the first render in the browser: the chain is a tab list. */
async function renderChain(slug: string, document: StatusDocument | null = null) {
  const fixture = mount(slug, document);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const tabs = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('[role="tab"]')];
const shownPanels = (element: HTMLElement) =>
  [...element.querySelectorAll<HTMLElement>('.panel')].filter((panel) => !panel.hidden);
const statusLine = (element: HTMLElement) =>
  element.querySelector('[role="status"]')?.textContent?.trim();

function press(tab: HTMLElement, key: string): void {
  tab.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  TestBed.tick();
}

/** Renders as the prerender does: Angular's server flag skips every render hook. */
async function renderPrerendered(slug: string, document: StatusDocument | null = null) {
  vi.stubGlobal('ngServerMode', true);
  try {
    const fixture = mount(slug, document);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('DeliveryChain', () => {
  it('renders all stations before hydration', async () => {
    const element = await renderPrerendered('videoflix', documentWith(linkedStatus()));
    const plan = deliveryPlans['videoflix'];

    expect(texts(element.querySelectorAll('.tab .name'))).toEqual(
      plan.steps.map((step) => step.name),
    );
    expect(element.querySelectorAll('.tab .value')).toHaveLength(plan.steps.length);
    expect(shownPanels(element)).toHaveLength(plan.steps.length);
    expect(element.querySelector('[role="tablist"], [role="tab"], [role="tabpanel"]')).toBeNull();
    expect(element.querySelector('[tabindex]')).toBeNull();
  });

  it('turns into tabs with one field after the first render', async () => {
    const element = await renderChain('videoflix', documentWith(linkedStatus()));

    expect(element.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs(element)).toHaveLength(6);
    expect(tabs(element).map((tab) => tab.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1',
    ]);
    expect(shownPanels(element)).toHaveLength(1);
  });

  it('selects the next tab with ArrowRight and wraps', async () => {
    const element = await renderChain('vps-plattform');
    const [first, second, last] = tabs(element);
    first.focus();

    press(first, 'ArrowRight');
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(second.getAttribute('tabindex')).toBe('0');
    expect(first.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(second);

    press(second, 'End');
    expect(document.activeElement).toBe(last);
    press(last, 'ArrowRight');
    expect(document.activeElement).toBe(first);
    press(first, 'ArrowLeft');
    expect(document.activeElement).toBe(last);
    press(last, 'Home');
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(tabs(element).filter((tab) => tab.getAttribute('aria-selected') === 'true')).toEqual([
      first,
    ]);
  });

  it('labels the panel with the selected tab', async () => {
    const element = await renderChain('videoflix', documentWith(linkedStatus()));
    tabs(element)[1].click();
    TestBed.tick();

    const [panel] = shownPanels(element);
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(panel.getAttribute('tabindex')).toBe('0');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs(element)[1].id);
    expect(tabs(element)[1].getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.querySelector('.kicker')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '2 / 6 · Tests & Security-Checks',
    );
  });

  it('shows name, value and transition per station from the chain view', async () => {
    const status = linkedStatus();
    const element = await renderChain('videoflix', documentWith(status));
    const view = buildChainView(deliveryPlans['videoflix'], { generatedAt, status });

    tabs(element).forEach((tab, index) => {
      const station = view.stations[index];
      expect(tab.querySelector('.name')?.textContent?.trim()).toBe(station.name);
      expect(tab.querySelector('.value')?.textContent?.trim()).toBe(station.value);
      expect(tab.getAttribute('data-state')).toBe(station.state);
      const via = tab.querySelector('.via');
      expect(via?.textContent?.replace('→', '').trim() ?? null).toBe(station.toNext);
      expect(via?.getAttribute('aria-hidden') ?? 'true').toBe('true');
    });
  });

  it('marks a state with a sign, never with color alone', async () => {
    const status = linkedStatus();
    status.live.signals.components[0].matchesLatestGreen = false;
    const element = await renderChain('videoflix', documentWith(status));
    const byName = (name: string) =>
      tabs(element).find((tab) => tab.querySelector('.name')?.textContent?.trim() === name)!;

    expect(byName('Code').querySelector('.node .tick')).not.toBeNull();
    expect(byName('Deployment').querySelector('.node .cross')).not.toBeNull();
    expect(byName('Deployment').querySelector('.value')?.textContent).toContain('≠');
    expect(byName('Code').querySelector('.visually-hidden')?.textContent).toContain('Belegt');
  });

  it('shows the table with its heads, a label per stacked value and the links in their row', async () => {
    const element = await renderChain('videoflix', documentWith(linkedStatus()));
    tabs(element)[1].click();
    TestBed.tick();
    const [panel] = shownPanels(element);

    expect(texts(panel.querySelectorAll('th'))).toEqual(['Repo', 'CI', 'Commit']);
    const cells = [...panel.querySelectorAll('tbody tr:first-child td')];
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([null, 'CI', 'Commit']);
    expect(cells[1].querySelector('a')?.getAttribute('href')).toBe('https://github.com/run');
    expect(cells[1].querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('passing');
    expect(cells[2].querySelector('[data-sha]')?.getAttribute('data-sha')).toBe('82dcf43');
  });

  it('offers the verify command for the attested image', async () => {
    const element = await renderChain('videoflix', documentWith(linkedStatus()));
    tabs(element)[2].click();
    TestBed.tick();
    const verify = shownPanels(element)[0].querySelector('details.verify');

    expect(verify?.querySelector('summary')?.textContent).toContain('Selbst prüfen');
    expect(verify?.querySelector('pre')?.textContent).toContain(
      `gh attestation verify \\\n  oci://ghcr.io/philippklinger/example@${digest}`,
    );
  });

  it('highlights every equal commit under the pointer, without a tab stop', async () => {
    const element = await renderChain('videoflix', documentWith(linkedStatus()));
    tabs(element)[3].click();
    TestBed.tick();
    const shas = [...shownPanels(element)[0].querySelectorAll('[data-sha]')];
    expect(shas.length).toBeGreaterThan(1);

    shas[0].dispatchEvent(new Event('pointerover', { bubbles: true }));
    TestBed.tick();
    expect(shas.every((sha) => sha.hasAttribute('data-match'))).toBe(true);
    expect(shas.some((sha) => sha.hasAttribute('tabindex') || sha.closest('a'))).toBe(false);

    element.querySelector('.kicker')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    TestBed.tick();
    expect(shas.some((sha) => sha.hasAttribute('data-match'))).toBe(false);
  });

  it('shows the stand with the number of repos only when there are repos', async () => {
    const element = await renderChain('videoflix', documentWith(linkedStatus()));
    expect(element.querySelector('.stand')?.textContent?.trim()).toBe(
      'Stand 06.11., 01:58 · 1 Repo',
    );

    TestBed.resetTestingModule();
    const status = linkedStatus();
    status.code.signals.repos = [];
    const withoutRepos = await renderChain('videoflix', documentWith(status));
    expect(withoutRepos.querySelector('.stand')?.textContent?.trim()).toBe('Stand 06.11., 01:58');

    TestBed.resetTestingModule();
    expect((await renderChain('videoflix')).querySelector('.stand')).toBeNull();
  });

  it('keeps every station without data, with no tick and no table', async () => {
    const element = await renderChain('videoflix');

    expect(tabs(element)).toHaveLength(6);
    expect(element.querySelector('.tick')).toBeNull();
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('details')).toBeNull();
  });

  it('shows one line with a lock for a project without a public chain', async () => {
    const element = await renderChain('developer-workspace-kit');

    expect(element.querySelector('.private')?.textContent?.trim()).toBe(
      'Code privat. Die Läufe zeige ich im Gespräch.',
    );
    expect(element.querySelector('.private .node svg')).not.toBeNull();
    expect(element.querySelector('.rail, .panel')).toBeNull();
  });

  it('keeps a chain for fixed content with one public step', async () => {
    const element = await renderChain('neuro-check-in');

    expect(tabs(element).map((tab) => tab.getAttribute('data-state'))).toEqual([
      'private',
      'private',
      'verified',
    ]);
    expect(element.querySelector('.private')).toBeNull();
  });

  it('has one h2 and the status line once', async () => {
    const element = await renderChain('videoflix');
    expect(texts(element.querySelectorAll('h2'))).toEqual([deliveryTexts.title]);
    expect(element.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  // Without a server behind it the real request fails, no mock involved.
  it('tells about a failed request on a measured page', async () => {
    const element = await renderChain('videoflix');
    await vi.waitFor(() => expect(statusLine(element)).toBe(deliveryTexts.refreshFailed));
  });

  it('keeps the notice of a page that is gone away from fixed content', async () => {
    TestBed.configureTestingModule({});
    const measured = TestBed.createComponent(DeliveryChain);
    measured.componentRef.setInput('slug', 'videoflix');
    await measured.whenStable();
    await vi.waitFor(() =>
      expect(statusLine(measured.nativeElement)).toBe(deliveryTexts.refreshFailed),
    );
    measured.destroy();
    const fixed = TestBed.createComponent(DeliveryChain);
    fixed.componentRef.setInput('slug', 'developer-workspace-kit');
    await fixed.whenStable();
    expect(statusLine(fixed.nativeElement)).toBe('');
  });

  it('stops counting its project when the page is gone', async () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(DeliveryChain);
    fixture.componentRef.setInput('slug', 'vps-plattform');
    await fixture.whenStable();
    const status = TestBed.inject(DeliveryStatus);
    await vi.waitFor(() => expect(status.notice()).toBe(deliveryTexts.refreshFailed));
    fixture.destroy();
    expect(status.notice()).toBeNull();
  });
});
