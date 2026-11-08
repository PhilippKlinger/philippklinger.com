import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MotionPause } from '../../../../layout/motion-pause';
import { DeliveryStatus } from '../../../../delivery/delivery-status';
import { STATUS_SNAPSHOT } from '../../../../delivery/status-snapshot';
import { deliveryTexts } from '../../../../../content/software-delivery';
import { healthyStatus } from '../../../../../content/status.fixture';
import { ProjectStatus } from '../../../../../content/status';
import { HeroPipelineView } from './hero-pipeline-view';

const NEWER_SHA = 'ddfaedb5786de39377d4dc470f5f9fa800dda8e2';

/** Every step of the chain proven, on the commit that is online. */
function proven(): ProjectStatus {
  const status = healthyStatus();
  const [ci] = status.checks.signals.workflows;
  status.checks.signals.workflows = [
    ci,
    { ...ci, workflow: 'CodeQL', file: 'codeql.yml', kind: 'scan' },
    { ...ci, workflow: 'Deploy preview', file: 'deploy.yml', kind: 'deploy' },
  ];
  return status;
}

function render(status: ProjectStatus | null): HTMLElement {
  return mount(status).nativeElement as HTMLElement;
}

function mount(status: ProjectStatus | null) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: STATUS_SNAPSHOT,
        useValue: status && {
          schemaVersion: 1,
          generatedAt: '2026-11-06T00:58:11.069Z',
          projects: { videoflix: healthyStatus(), portfolio: status },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(HeroPipelineView);
  fixture.detectChanges();
  return fixture;
}

/** Without a server behind it the real request for /status.json fails, no mock involved. */
async function afterFailedRefresh(status: ProjectStatus | null): Promise<HTMLElement> {
  const fixture = mount(status);
  TestBed.tick();
  await vi.waitFor(() => expect(TestBed.inject(DeliveryStatus).notice()).not.toBeNull());
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

// jsdom has neither API. Motion is allowed, the hero is never reported in view, so no frame runs.
function allowMotion(): void {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = () => undefined;
      disconnect = () => undefined;
    },
  );
}

async function moving(status: ProjectStatus | null): Promise<HTMLElement> {
  allowMotion();
  const fixture = mount(status);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const stateOf = (host: HTMLElement) =>
  [...host.querySelectorAll('.station')].map((item) => item.getAttribute('data-state'));

describe('HeroPipelineView', () => {
  // The test environment has no matchMedia. Reduced motion is the end state of the prerender;
  // the running loop needs real frames and is covered by e2e/hero-pipeline.e2e.ts.
  beforeEach(() =>
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined })),
  );
  afterEach(() => vi.unstubAllGlobals());

  it('renders six stations with the label of the chain', () => {
    const host = render(proven());
    expect(host.querySelectorAll('.station')).toHaveLength(6);
    expect(host.querySelector('.title')?.textContent).toContain('How this site is built and run:');
  });

  it('shows a failed station with its word and an alert next to the label', () => {
    const status = proven();
    status.checks.signals.workflows[0].conclusion = 'failure';
    const host = render(status);
    expect(stateOf(host)[1]).toBe('failed');
    expect(host.querySelector('.note')?.textContent).toContain('Gestoppt bei Tests & Security');
    expect(host.querySelector('.note')?.classList.contains('alert')).toBe(true);
    expect(host.querySelector('.value .fail')?.textContent).toContain('failing');
  });

  it('does not alert while production only waits for its approval', () => {
    const status = proven();
    status.checks.signals.workflows[2].headSha = NEWER_SHA;
    const host = render(status);
    expect(stateOf(host)[4]).toBe('held');
    expect(host.querySelector('.note')?.textContent).toContain('Production wartet auf Freigabe');
    expect(host.querySelector('.note')?.classList.contains('alert')).toBe(false);
  });

  it('stands still without data, with the friendly sentence', () => {
    const host = render(null);
    expect(host.querySelector('.note')?.textContent).toBe(
      'Dieser Stand ist gerade nicht abrufbar.',
    );
  });

  it('says only once that nothing can be read when the refresh fails too', async () => {
    const host = await afterFailedRefresh(null);
    expect(host.querySelector('.title')?.textContent?.trim()).toBe(
      'How this site is built and run: Dieser Stand ist gerade nicht abrufbar.',
    );
  });

  it('keeps the notice of a failed refresh next to the chain of the build', async () => {
    const host = await afterFailedRefresh(proven());
    expect(host.querySelector('.title')?.textContent).toContain(deliveryTexts.refreshFailed);
  });

  it('says so when the data is older than a day', () => {
    TestBed.overrideProvider(DeliveryStatus, {
      useValue: {
        snapshot: () => signal({ generatedAt: '2026-11-01T00:00:00Z', status: proven() }),
        notice: signal(deliveryTexts.stale),
      },
    });
    const host = render(proven());
    expect(host.querySelector('.title')?.textContent).toContain(
      'Dieser Stand ist älter als einen Tag.',
    );
  });

  it('draws the line to the end state for the prerender and reduced motion', () => {
    const status = proven();
    status.checks.signals.workflows[0].conclusion = 'failure';
    const pipe = render(status).querySelector<HTMLElement>('.pipe')!;
    expect(pipe.style.getPropertyValue('--final')).toBe('0.2');
  });

  it('offers no pause control when nothing moves', () => {
    expect(render(proven()).querySelector('.pause')).toBeNull();
  });

  describe('with motion', () => {
    it('loops a chain from the status', async () => {
      const host = await moving(proven());
      expect(host.querySelector('.pipe')?.classList.contains('loop')).toBe(true);
    });

    it('does not loop without data', async () => {
      const host = await moving(null);
      expect(host.querySelector('.pipe')?.classList.contains('loop')).toBe(false);
    });

    it('does not loop when the run starts nowhere', async () => {
      const status = proven();
      status.code.signals.repos[0].mergedPullRequests = null;
      const host = await moving(status);
      expect(host.querySelector('.pipe')?.classList.contains('loop')).toBe(false);
    });

    it('keeps the name of the pause control and only presses it (WAI-ARIA APG)', async () => {
      const host = await moving(proven());
      const pause = host.querySelector<HTMLButtonElement>('.pause')!;
      expect(pause.getAttribute('aria-label')).toBe('Bewegung anhalten');
      expect(pause.getAttribute('aria-pressed')).toBe('false');
      pause.click();
      await TestBed.inject(ApplicationRef).whenStable();
      expect(pause.getAttribute('aria-label')).toBe('Bewegung anhalten');
      expect(pause.getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('only links what has a source', () => {
    const host = render(null);
    const links = [...host.querySelectorAll('.value a')].map((link) => link.textContent);
    expect(links).toEqual(['Repository', 'Workflows', 'Attestation', 'SBOM']);
  });
});

describe('MotionPause', () => {
  it('toggles for everything that moves', () => {
    const pause = TestBed.inject(MotionPause);
    expect(pause.paused()).toBe(false);
    pause.toggle();
    expect(pause.paused()).toBe(true);
    pause.toggle();
    expect(pause.paused()).toBe(false);
  });
});
