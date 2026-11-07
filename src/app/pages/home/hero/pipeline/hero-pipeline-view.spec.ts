import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MotionPause } from '../../../../layout/motion-pause';
import { STATUS_SNAPSHOT } from '../../../../delivery/status-snapshot';
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
    expect(host.querySelector('.pipe')?.classList.contains('loop')).toBe(false);
  });

  it('offers no pause control when nothing moves', () => {
    expect(render(proven()).querySelector('.pause')).toBeNull();
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
