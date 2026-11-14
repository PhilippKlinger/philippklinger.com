import { TestBed } from '@angular/core/testing';
import { buildChainView } from '../../../../content/delivery-chain';
import { deliveryPlans } from '../../../../content/delivery-plans';
import { DeliveryPlan, deliveryTexts } from '../../../../content/software-delivery';
import { ProjectStatus, StatusDocument } from '../../../../content/status';
import { healthyStatus } from '../../../../content/status.fixture';
import { DeliveryStatus } from '../../../delivery/delivery-status';
import { STATUS_SNAPSHOT } from '../../../delivery/status-snapshot';
import { DeliveryChain } from './delivery-chain';

const HINT_KEY = 'pk-chain-hint-done';
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
  fixture.componentRef.setInput('title', 'Projektname');
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
    return fixture;
  } finally {
    vi.unstubAllGlobals();
  }
}

// No real project keeps its whole chain private or reads no status since Buildorder is public;
// this plan keeps both cases covered.
const PRIVATE_SLUG = 'test-private';
const privatePlan: DeliveryPlan = {
  fixedSignal: { state: 'private', status: 'Code privat', when: '' },
  steps: [
    { name: 'Code', arrowToNext: 'CI', state: 'private', sentence: 'privat' },
    { name: 'CI', state: 'private', sentence: 'privat' },
  ],
};

describe('DeliveryChain', () => {
  // jsdom has no IntersectionObserver. An inert one means: the chain never reports being in view.
  beforeEach(() =>
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = () => undefined;
        disconnect = () => undefined;
      },
    ),
  );
  beforeEach(() => (deliveryPlans[PRIVATE_SLUG] = privatePlan));
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(HINT_KEY);
    delete deliveryPlans[PRIVATE_SLUG];
  });

  it('[D4] renders all stations before hydration', async () => {
    const fixture = await renderPrerendered('videoflix', documentWith(linkedStatus()));
    const element = fixture.nativeElement as HTMLElement;
    const plan = deliveryPlans['videoflix'];

    expect(texts(element.querySelectorAll('.tab .name'))).toEqual(
      plan.steps.map((step) => step.name),
    );
    expect(element.querySelectorAll('.tab .value')).toHaveLength(plan.steps.length);
    expect(shownPanels(element)).toHaveLength(plan.steps.length);
    expect(element.querySelector('[role="tablist"], [role="tab"], [role="tabpanel"]')).toBeNull();
    expect(element.querySelector('[tabindex]')).toBeNull();
    expect(element.querySelector('.hint')).toBeNull();
  });

  // A click before the list has become tabs is no choice of the reader and keeps the click hint.
  it('[D5] takes a click as a choice only once the list has become tabs', async () => {
    const fixture = await renderPrerendered('vps-plattform');
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.tab')[1].click();
    expect(fixture.componentInstance.selected()).toBe(0);
  });

  it('[D5] adds the click hint in the browser, hidden from screen readers and not yet shown', async () => {
    const element = await renderChain('vps-plattform');
    const hint = element.querySelector('.hint');

    expect(hint?.getAttribute('aria-hidden')).toBe('true');
    expect(hint?.classList.contains('on')).toBe(false);
    expect(texts(hint!.querySelectorAll('span'))).toEqual([
      'Klick dich durch die Stationen',
      'Tippe auf eine Station',
    ]);
    expect(element.querySelector('.beckon')).toBeNull();
  });

  it('[D5] remembers the first choice of a station for the next visit', async () => {
    const element = await renderChain('vps-plattform');
    expect(localStorage.getItem(HINT_KEY)).toBeNull();

    tabs(element)[1].click();
    expect(localStorage.getItem(HINT_KEY)).toBe('1');
  });

  it('[D4] turns into tabs with one field after the first render', async () => {
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

  it('[D4] selects the next tab with ArrowRight and wraps', async () => {
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

  // A Tab right after the arrow key must not reach the field that is about to be hidden.
  // No press() here: its TestBed.tick() would render in between and hide the race.
  it('[D4] shows the field of a tab already when the tab takes the focus', async () => {
    const element = await renderChain('vps-plattform');
    const [first, second] = tabs(element);
    first.focus();
    let shownOnFocus: string[] = [];
    second.addEventListener('focus', () => (shownOnFocus = shownPanels(element).map((p) => p.id)));

    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(shownOnFocus).toEqual(['chain-panel-1']);
  });

  it('[D4] labels the panel with the selected tab', async () => {
    const element = await renderChain('videoflix', documentWith(linkedStatus()));
    tabs(element)[1].click();
    TestBed.tick();

    const [panel] = shownPanels(element);
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(panel.getAttribute('tabindex')).toBe('0');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs(element)[1].id);
    expect(tabs(element)[1].getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.querySelector('.kicker')).toBeNull();
    expect(panel.querySelector('h3')).toBeNull();
  });

  // The router keeps the component when only the slug changes; an old index would select nothing.
  it('[D4] starts at the first station when the project changes', async () => {
    const fixture = mount('videoflix', documentWith(linkedStatus()));
    await fixture.whenStable();
    fixture.componentInstance.select(5, true);

    fixture.componentRef.setInput('slug', 'vps-plattform');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(tabs(element).map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(shownPanels(element).map((panel) => panel.id)).toEqual(['chain-panel-0']);
  });

  it('[D2] shows name, value and transition per station from the chain view', async () => {
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

  it('[D2] marks a state with a sign, never with color alone', async () => {
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

  // Without a count the value is the state word itself; a screen reader would hear it twice.
  it('[D2] says the state once when the value already names it', async () => {
    const status = linkedStatus();
    status.supplyChain.signals.repos.forEach((repo) => {
      repo.attestation = { ...repo.attestation!, reachable: false, provenanceCount: null };
    });
    const element = await renderChain('videoflix', documentWith(status));
    const build = tabs(element).find(
      (tab) => tab.querySelector('.name')?.textContent?.trim() === 'Signed Build',
    )!;

    expect(build.getAttribute('data-state')).toBe('partial');
    expect(build.querySelector('.value')?.textContent?.trim()).toBe('teilweise');
    expect(build.querySelector('.visually-hidden')).toBeNull();
  });

  it('[D3] offers the verify command for the attested image', async () => {
    const element = await renderChain('videoflix', documentWith(linkedStatus()));
    tabs(element)[2].click();
    TestBed.tick();
    const verify = shownPanels(element)[0].querySelector('details.verify');

    expect(verify?.querySelector('summary')?.textContent).toContain('Selbst prüfen');
    expect(verify?.querySelector('pre')?.textContent).toContain(
      `gh attestation verify \\\n  oci://ghcr.io/philippklinger/example@${digest}`,
    );
  });

  it('[D6] highlights every equal commit under the pointer, without a tab stop', async () => {
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

  it('[D8] keeps every station without data, with no tick and no table', async () => {
    const element = await renderChain('videoflix');

    expect(tabs(element)).toHaveLength(6);
    expect(element.querySelector('.tick')).toBeNull();
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('details')).toBeNull();
  });

  it('shows one line with a lock for a project without a public chain', async () => {
    const element = await renderChain(PRIVATE_SLUG);

    expect(element.querySelector('.private')?.textContent?.trim()).toBe(
      'Code privat. Die Läufe zeige ich im Gespräch.',
    );
    expect(element.querySelector('.private .node svg')).not.toBeNull();
    expect(element.querySelector('.rail, .panel, .hint')).toBeNull();
  });

  // Neuro: private code, a public release and the website, whose data has not come yet.
  it('keeps a chain for a project with private steps', async () => {
    const element = await renderChain('neuro-check-in');

    expect(tabs(element).map((tab) => tab.getAttribute('data-state'))).toEqual([
      'private',
      'verified',
      'unavailable',
    ]);
    expect(element.querySelector('.private')).toBeNull();
  });

  it('has one h2 and the status line once', async () => {
    const element = await renderChain('videoflix');
    expect(texts(element.querySelectorAll('h2'))).toEqual([deliveryTexts.title]);
    expect(element.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('puts the project name above the h2 as a kicker that is hidden from screen readers', async () => {
    const element = await renderChain('videoflix');
    const kicker = element.querySelector<HTMLElement>('.kicker');
    expect(kicker?.textContent?.trim()).toBe('Projektname');
    expect(kicker?.getAttribute('aria-hidden')).toBe('true');
    const h2 = element.querySelector('h2')!;
    expect(kicker!.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Without a server behind it the real request fails, no mock involved.
  it('[D8] tells about a failed request on a measured page', async () => {
    const element = await renderChain('videoflix');
    await vi.waitFor(() => expect(statusLine(element)).toBe(deliveryTexts.refreshFailed));
  });

  it('keeps the notice of a page that is gone away from fixed content', async () => {
    TestBed.configureTestingModule({});
    const measured = TestBed.createComponent(DeliveryChain);
    measured.componentRef.setInput('slug', 'videoflix');
    measured.componentRef.setInput('title', 'Projektname');
    await measured.whenStable();
    await vi.waitFor(() =>
      expect(statusLine(measured.nativeElement)).toBe(deliveryTexts.refreshFailed),
    );
    measured.destroy();
    const fixed = TestBed.createComponent(DeliveryChain);
    fixed.componentRef.setInput('slug', PRIVATE_SLUG);
    fixed.componentRef.setInput('title', 'Projektname');
    await fixed.whenStable();
    expect(statusLine(fixed.nativeElement)).toBe('');
  });

  it('stops counting its project when the page is gone', async () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(DeliveryChain);
    fixture.componentRef.setInput('slug', 'vps-plattform');
    fixture.componentRef.setInput('title', 'Projektname');
    await fixture.whenStable();
    const status = TestBed.inject(DeliveryStatus);
    await vi.waitFor(() => expect(status.notice()).toBe(deliveryTexts.refreshFailed));
    fixture.destroy();
    expect(status.notice()).toBeNull();
  });
});
