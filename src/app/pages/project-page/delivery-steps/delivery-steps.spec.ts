import { TestBed } from '@angular/core/testing';
import { deliveryPlans } from '../../../../content/delivery-plans';
import { buildDeliveryView, deliveryTexts } from '../../../../content/software-delivery';
import { ProjectStatus, StatusDocument } from '../../../../content/status';
import { healthyStatus } from '../../../../content/status.fixture';
import { DeliveryStatus } from '../../../delivery/delivery-status';
import { STATUS_SNAPSHOT } from '../../../delivery/status-snapshot';
import { DeliverySteps } from './delivery-steps';

const generatedAt = '2026-11-06T00:58:11.069Z';
const repo = 'PhilippKlinger/example';
const texts = (nodes: Iterable<Element>) => [...nodes].map((node) => node.textContent?.trim());

/** More links than a step may show, and proof for every source of the plan. */
function linkedStatus(): ProjectStatus {
  const status = healthyStatus();
  status.checks.links = [
    { kind: 'workflow-run', source: repo, url: 'https://github.com/run', workflow: 'CI' },
  ];
  status.supplyChain.links = ['one', 'two', 'three', 'four'].map((name) => ({
    kind: 'attestations',
    source: `${repo}-${name}`,
    url: `https://github.com/${name}`,
  }));
  status.live.links = [{ kind: 'version-endpoint', source: 'site', url: 'https://example.com/v' }];
  status.stability.links = [{ kind: 'status-page', source: 'site', url: 'https://example.com/s' }];
  status.restore.links = [{ kind: 'restore-test', source: repo, url: 'https://github.com/r' }];
  return status;
}

function documentWith(status: ProjectStatus): StatusDocument {
  return { schemaVersion: 1, generatedAt, projects: { videoflix: status, portfolio: status } };
}

async function renderSteps(slug: string, document: StatusDocument | null = null) {
  TestBed.configureTestingModule({
    providers: [{ provide: STATUS_SNAPSHOT, useValue: document }],
  });
  const fixture = TestBed.createComponent(DeliverySteps);
  fixture.componentRef.setInput('slug', slug);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const statusLine = (element: HTMLElement) =>
  element.querySelector('[role="status"]')?.textContent?.trim();

describe('DeliverySteps', () => {
  it('shows every step with h3, state, sentence, event and links', async () => {
    const status = linkedStatus();
    const element = await renderSteps('videoflix', documentWith(status));
    const view = buildDeliveryView(deliveryPlans['videoflix'], { generatedAt, status });
    const steps = [...element.querySelectorAll('.step')];
    expect(steps).toHaveLength(view.steps.length);
    view.steps.forEach((expected, index) => {
      const step = steps[index];
      expect(step.querySelector('h3')?.textContent?.trim()).toBe(expected.name);
      expect(step.querySelector(`.state-${expected.state}`)).not.toBeNull();
      expect(step.textContent).toContain(expected.sentence);
      expect(step.querySelector('.step-event')?.textContent?.trim()).toBe(expected.event);
      const links = [...step.querySelectorAll<HTMLAnchorElement>('.step-links a')];
      expect(links.map((link) => link.getAttribute('href'))).toEqual(
        expected.links.map((link) => link.url),
      );
      expect(texts(links)).toEqual(expected.links.map((link) => link.label));
    });
  });

  it('marks a step that is not set up yet', async () => {
    const element = await renderSteps('conduit');
    const staging = [...element.querySelectorAll('.step')].at(-1);
    expect(staging?.querySelector('.state-notSetUp')).not.toBeNull();
    expect(staging?.classList).toContain('step-open');
    expect(element.querySelectorAll('.step-open')).toHaveLength(1);
  });

  it('leaves out event and links for a step that has none', async () => {
    const [code, , release] = (await renderSteps('neuro-check-in')).querySelectorAll('.step');
    expect(code.querySelector('.step-event')).toBeNull();
    expect(code.querySelector('.step-links')).toBeNull();
    expect(release.querySelector('.step-event')?.textContent?.trim()).toBe('Version 1.11.2');
    expect(release.querySelectorAll('.step-links a')).toHaveLength(1);
  });

  it('keeps at most 3 links per step', async () => {
    const element = await renderSteps('videoflix', documentWith(linkedStatus()));
    const counts = [...element.querySelectorAll('.step')].map(
      (step) => step.querySelectorAll('.step-links a').length,
    );
    expect(Math.max(...counts)).toBe(3);
  });

  it('shows the arrow with its label between the steps, not after the last', async () => {
    const element = await renderSteps('videoflix');
    expect(texts(element.querySelectorAll('.step-arrow'))).toEqual([
      'CI',
      'Image',
      'Deploy',
      'Betrieb',
      'Backup',
    ]);
    expect(element.querySelector('li:last-child .step-arrow')).toBeNull();
  });

  it('has one h2, the intro and an ordered list of steps', async () => {
    const element = await renderSteps('videoflix');
    expect(texts(element.querySelectorAll('h2'))).toEqual([deliveryTexts.title]);
    expect(element.textContent).toContain(deliveryTexts.intro);
    expect(element.querySelectorAll('ol > li .step')).toHaveLength(6);
  });

  it('shows the counter and the time above the steps', async () => {
    const element = await renderSteps('neuro-check-in');
    const signal = element.querySelector('.signal');
    expect(signal?.querySelector('strong')?.textContent).toContain('1 von 3 öffentlich belegt');
    expect(signal?.querySelector('span')?.textContent).toContain('Version 1.11.2');
    const follows = signal!.compareDocumentPosition(element.querySelector('.step')!);
    expect(follows & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves out the time when there is none', async () => {
    const signal = (await renderSteps('videoflix')).querySelector('.signal');
    expect(signal?.querySelector('strong')?.textContent).toContain('0 von 6 belegt');
    expect(signal?.querySelector('span')).toBeNull();
  });

  it('has the status line once', async () => {
    const element = await renderSteps('videoflix');
    expect(element.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  // Without a server behind it the real request fails, no mock involved.
  it('tells about a failed request on a measured page', async () => {
    const element = await renderSteps('videoflix');
    await vi.waitFor(() => expect(statusLine(element)).toBe(deliveryTexts.refreshFailed));
  });

  it('keeps the notice of a page that is gone away from fixed content', async () => {
    TestBed.configureTestingModule({});
    const measured = TestBed.createComponent(DeliverySteps);
    measured.componentRef.setInput('slug', 'videoflix');
    await measured.whenStable();
    await vi.waitFor(() =>
      expect(statusLine(measured.nativeElement)).toBe(deliveryTexts.refreshFailed),
    );
    measured.destroy();
    const fixed = TestBed.createComponent(DeliverySteps);
    fixed.componentRef.setInput('slug', 'developer-workspace-kit');
    await fixed.whenStable();
    expect(statusLine(fixed.nativeElement)).toBe('');
  });

  it('stops counting its project when the page is gone', async () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(DeliverySteps);
    fixture.componentRef.setInput('slug', 'conduit');
    await fixture.whenStable();
    const status = TestBed.inject(DeliveryStatus);
    await vi.waitFor(() => expect(status.notice()).toBe(deliveryTexts.refreshFailed));
    fixture.destroy();
    expect(status.notice()).toBeNull();
  });

  it('shows nothing that reads Nachweiskette', async () => {
    for (const slug of Object.keys(deliveryPlans)) {
      TestBed.resetTestingModule();
      const element = await renderSteps(slug, documentWith(linkedStatus()));
      expect(element.textContent).not.toMatch(/nachweiskette/i);
    }
  });
});
