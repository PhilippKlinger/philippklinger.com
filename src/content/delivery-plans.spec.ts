import { deliveryPlans } from './delivery-plans';
import { portfolioProject, projects } from './projects';
import {
  buildDeliveryView,
  DeliveryStepPlan,
  DeliveryStepView,
  FixedStep,
  MeasuredStep,
  StepSource,
} from './software-delivery';
import { ProjectStatus, WorkflowSignal } from './status';
import { healthyStatus } from './status.fixture';

const isMeasured = (step: DeliveryStepPlan): step is MeasuredStep => 'sources' in step;
const measuredSteps = Object.values(deliveryPlans).flatMap((plan) => plan.steps.filter(isMeasured));
const fixedSteps = Object.values(deliveryPlans)
  .flatMap((plan) => plan.steps)
  .filter((step): step is FixedStep => !isMeasured(step));

// Sources whose single entry per step cannot be proven only in part (spec 6.3).
const WHOLE_SOURCES: StepSource[] = ['image', 'stability', 'restore'];

const RUN_WITHOUT_LIVE =
  'Der letzte Deploy-Lauf war erfolgreich, der laufende Stand ist nicht abrufbar.';
const PART_OF_SERVICES = 'Ein Teil der Dienste läuft nachweislich auf dem geprüften Stand.';

const deployRun = (change: Partial<WorkflowSignal> = {}): WorkflowSignal => ({
  repo: 'PhilippKlinger/videoflix-deploy',
  workflow: 'Deploy',
  file: 'deploy.yml',
  kind: 'deploy',
  reachable: true,
  conclusion: 'success',
  headSha: '82dcf438f80efbfa0c7ab601feb1609b18d0ecad',
  completedAt: '2026-11-06T13:32:00Z',
  ...change,
});

/** A green deploy run and no live proof: what the status of Videoflix says today. */
function runWithoutLive(): ProjectStatus {
  const status = healthyStatus();
  status.checks.signals.workflows.push(deployRun());
  status.live.signals.components = [];
  return status;
}

function deploymentOf(slug: string, status: ProjectStatus): DeliveryStepView {
  const { steps } = buildDeliveryView(deliveryPlans[slug], {
    generatedAt: '2026-11-06T14:00:00Z',
    status,
  });
  return steps.find((item) => item.name.endsWith('Deployment')) as DeliveryStepView;
}

describe('deliveryPlans', () => {
  it('has a plan for every project and for the site', () => {
    const slugs = [...projects, portfolioProject].map((project) => project.slug).sort();
    expect(Object.keys(deliveryPlans).sort()).toEqual(slugs);
  });

  it.each<[string, [string, string | undefined][]]>([
    [
      'videoflix',
      [
        ['Code', 'CI'],
        ['Tests & Security-Checks', 'Image'],
        ['Signed Build', 'Deploy'],
        ['Deployment', 'Betrieb'],
        ['Monitoring', 'Backup'],
        ['Restore-Test', undefined],
      ],
    ],
    [
      'neuro-check-in',
      [
        ['Code', 'CI'],
        ['Unit- & E2E-Tests', 'Release'],
        ['Release im Play Store', undefined],
      ],
    ],
    [
      'conduit',
      [
        ['Code', 'CI'],
        ['CI', 'Image'],
        ['Image in GHCR', 'Deploy'],
        ['Staging-Deployment', undefined],
      ],
    ],
    [
      'developer-workspace-kit',
      [
        ['Code', 'CI'],
        ['CI', 'Release'],
        ['Release', undefined],
      ],
    ],
    [
      'portfolio',
      [
        ['Code', 'CI'],
        ['Tests & Security-Checks', 'Build'],
        ['Signed Build', 'Deploy'],
        ['Deployment', 'Betrieb'],
        ['Monitoring', undefined],
      ],
    ],
  ])('"%s" lists exactly the steps of the spec', (slug, expected) => {
    const steps = deliveryPlans[slug].steps;
    expect(steps.map((step) => [step.name, step.arrowToNext])).toEqual(expected);
  });

  it.each<[string, StepSource[][]]>([
    [
      'videoflix',
      [['code'], ['checks'], ['supplyChain'], ['live', 'deployRun'], ['stability'], ['restore']],
    ],
    ['conduit', [['code'], ['checks'], ['image'], ['deployRun', 'live']]],
    ['portfolio', [['code'], ['checks'], ['supplyChain'], ['live'], ['stability']]],
  ])('"%s" reads each step from the sources of the spec', (slug, expected) => {
    const steps = deliveryPlans[slug].steps.filter(isMeasured);
    expect(steps.map((step) => step.sources)).toEqual(expected);
  });

  it('the last step of a plan has no arrow', () => {
    for (const plan of Object.values(deliveryPlans)) {
      expect(plan.steps.at(-1)?.arrowToNext).toBeUndefined();
    }
  });

  it('has no health topics', () => {
    expect(JSON.stringify(deliveryPlans)).not.toMatch(/neurodiv|gesund/i);
  });

  it('conduit starts its deployment as not set up', () => {
    const deployment = deliveryPlans['conduit'].steps.at(-1) as MeasuredStep;
    expect(deployment.setUp).toBe(false);
    expect(deployment.sources).toEqual(['deployRun', 'live']);
  });

  it.each([
    ['videoflix', 'Monitoring'],
    ['videoflix', 'Restore-Test'],
    ['portfolio', 'Monitoring'],
  ])('"%s" starts "%s" as not set up', (slug, name) => {
    const step = deliveryPlans[slug].steps.find((item) => item.name === name) as MeasuredStep;
    expect(step.setUp).toBe(false);
  });

  it('every fixed verified step has a public link', () => {
    const verified = fixedSteps.filter((step) => step.state === 'verified');
    expect(verified.length).toBeGreaterThan(0);
    for (const step of verified) {
      expect(step.links?.length).toBeGreaterThan(0);
      for (const link of step.links ?? []) {
        expect(link.url).toMatch(/^https:\/\//);
      }
    }
  });

  it('every step has a sentence for every state it can reach', () => {
    for (const step of measuredSteps) {
      const whole = step.sources.every((source) => WHOLE_SOURCES.includes(source));
      const provable = step.sources.some((source) => source !== 'image');
      expect(step.sentences.verified, step.name).toBeTruthy();
      if (!whole) expect(step.sentences.partial, step.name).toBeTruthy();
      if (provable) expect(step.sentences.deviation, step.name).toBeTruthy();
      if (!step.setUp) expect(step.sentences.notSetUp, step.name).toBeTruthy();
    }
    for (const step of fixedSteps) {
      expect(step.sentence, step.name).toBeTruthy();
    }
  });

  it('claims neither tests nor a scan for Conduit, its CI has none', () => {
    expect(JSON.stringify(deliveryPlans['conduit'])).not.toMatch(/getestet|Schwachstellen/);
    const ci = deliveryPlans['conduit'].steps.find((item) => item.name === 'CI') as MeasuredStep;
    expect(ci.sentences.verified).toBe('Jede Änderung wird automatisch gebaut und validiert.');
    expect(ci.sentences.partial).toBeTruthy();
    expect(ci.sentences.deviation).toBeTruthy();
  });

  it.each(['videoflix', 'portfolio'])('"%s" is neutral on a partial signed build', (slug) => {
    const build = deliveryPlans[slug].steps.find(
      (item) => item.name === 'Signed Build',
    ) as MeasuredStep;
    expect(build.sentences.partial).toBe('Ein Teil der Nachweise liegt vor.');
    expect(build.sentences.unsigned).toBe(
      'Die Bestandteile sind aufgelistet, die Signatur fehlt noch.',
    );
  });

  it('has an own sentence for a red deploy run wherever one is read', () => {
    const readers = measuredSteps.filter((item) => item.sources.includes('deployRun'));
    expect(readers).toHaveLength(2);
    for (const reader of readers) {
      expect(reader.sentences.deployRunFailed).toBe(
        'Der letzte Deploy-Lauf war nicht erfolgreich.',
      );
    }
  });

  describe('deployment with a green deploy run', () => {
    it('videoflix names the run when live proves nothing', () => {
      const view = deploymentOf('videoflix', runWithoutLive());
      expect(view.state).toBe('partial');
      expect(view.sentence).toBe(RUN_WITHOUT_LIVE);
    });

    it('videoflix names the run while its images are unsigned, as they are today', () => {
      const status = runWithoutLive();
      const { attestation } = status.supplyChain.signals.repos[0];
      Object.assign(attestation!, { reachable: false, provenanceCount: null });
      expect(deploymentOf('videoflix', status).sentence).toBe(RUN_WITHOUT_LIVE);
    });

    it('conduit names the run in the same way', () => {
      expect(deploymentOf('conduit', runWithoutLive()).sentence).toBe(RUN_WITHOUT_LIVE);
    });

    it('names the run when live has components, but none of them is proven', () => {
      const status = runWithoutLive();
      const [part] = healthyStatus().live.signals.components;
      status.live.signals.components = [{ ...part, matchesLatestGreen: null }];
      expect(deploymentOf('videoflix', status).sentence).toBe(RUN_WITHOUT_LIVE);
    });

    it('never claims a part of the services when a second run is unknown', () => {
      const status = runWithoutLive();
      status.checks.signals.workflows.push(deployRun({ reachable: false, conclusion: null }));
      const view = deploymentOf('videoflix', status);
      expect(view.state).toBe('partial');
      expect(view.sentence).toBe(RUN_WITHOUT_LIVE);
    });

    it('keeps the part of the services when live really proves one', () => {
      const status = runWithoutLive();
      const [part] = healthyStatus().live.signals.components;
      status.live.signals.components = [
        { ...part, component: 'backend', matchesLatestGreen: true },
        { ...part, component: 'frontend', matchesLatestGreen: null },
      ];
      const view = deploymentOf('videoflix', status);
      expect(view.state).toBe('partial');
      expect(view.sentence).toBe(PART_OF_SERVICES);
    });
  });

  it('shows the running label of the spec', () => {
    expect(deliveryPlans['videoflix'].runningLabel).toBe('Läuft in Produktion');
    expect(deliveryPlans['portfolio'].runningLabel).toBe('Läuft in Produktion');
    expect(deliveryPlans['conduit'].runningLabel).toBe('Läuft auf Staging');
  });

  it('reads the measured projects from their status key, the others from the content', () => {
    expect(deliveryPlans['videoflix'].statusKey).toBe('videoflix');
    expect(deliveryPlans['conduit'].statusKey).toBe('conduit');
    expect(deliveryPlans['portfolio'].statusKey).toBe('portfolio');
    expect(deliveryPlans['neuro-check-in'].statusKey).toBeUndefined();
    expect(deliveryPlans['developer-workspace-kit'].statusKey).toBeUndefined();
  });

  it('names the repositories of Videoflix after their role', () => {
    expect(deliveryPlans['videoflix'].repoLabels).toEqual({
      'PhilippKlinger/videoflix-backend': 'Backend',
      'PhilippKlinger/videoflix-frontend': 'Frontend',
      'PhilippKlinger/videoflix-deploy': 'Deploy',
    });
  });

  it('fixes signal and event of Neuro Check-in', () => {
    const plan = deliveryPlans['neuro-check-in'];
    expect(plan.fixedSignal).toEqual({
      state: 'verified',
      status: 'Live im Play Store',
      when: 'Version 1.11.2',
    });
    const release = plan.steps.at(-1) as FixedStep;
    expect(release.state).toBe('verified');
    expect(release.sentence).toBe('Die App ist öffentlich im Play Store verfügbar.');
    expect(release.event).toBe('Version 1.11.2');
    expect(release.links?.[0].url).toBe(
      'https://play.google.com/store/apps/details?id=com.philippklinger.neurocheckin',
    );
  });

  it('keeps the code of Neuro Check-in and the Kit private', () => {
    const steps = ['neuro-check-in', 'developer-workspace-kit'].flatMap(
      (slug) => deliveryPlans[slug].steps as FixedStep[],
    );
    const hidden = steps.filter((step) => step.state === 'private');
    expect(hidden).toHaveLength(5);
    for (const step of hidden) {
      expect(step.sentence).toBe('Der Code ist privat, Läufe zeige ich im Gespräch.');
    }
  });

  it('fixes signal and footnote of the Kit', () => {
    const plan = deliveryPlans['developer-workspace-kit'];
    expect(plan.fixedSignal).toEqual({
      state: 'private',
      status: 'Code privat',
      when: 'Version 0.5.0',
    });
    expect(plan.footnote).toBe('Öffentliches Repo folgt');
  });
});
