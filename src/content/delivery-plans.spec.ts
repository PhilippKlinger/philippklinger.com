import { deliveryPlans } from './delivery-plans';
import { TOPIC_A, TOPIC_B, findForbiddenTerm } from './testing/forbidden-terms';
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
        ['Website', undefined],
      ],
    ],
    [
      'vps-plattform',
      [
        ['Code', 'CI'],
        ['CI & Security-Checks', 'Betrieb'],
        ['Betrieb', undefined],
      ],
    ],
    [
      'buildorder',
      [
        ['Code', 'CI'],
        ['Tests & Security-Checks', 'Release'],
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
    ['vps-plattform', [['code'], ['checks'], ['stability']]],
    ['neuro-check-in', [['stability']]],
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

  it('has no private topics', async () => {
    expect(await findForbiddenTerm(JSON.stringify(deliveryPlans), [TOPIC_A, TOPIC_B])).toBe(false);
  });

  // Plan VPS platform E5: the Kuma slug exists since 12.11., so operation counts as set up.
  it('the VPS platform measures its operation as set up', () => {
    const operation = deliveryPlans['vps-plattform'].steps.at(-1) as MeasuredStep;
    expect(operation.setUp).toBe(true);
    expect(operation.sources).toEqual(['stability']);
  });

  // AK18: at the go-live no measured step waits for its source; only the Kit stays private.
  it('[AK18] every measured step is set up', () => {
    expect(measuredSteps.filter((step) => !step.setUp).map((step) => step.name)).toEqual([]);
  });

  it('shows the operation of the VPS platform as unavailable while the data is silent', () => {
    const { steps } = buildDeliveryView(deliveryPlans['vps-plattform'], null);
    expect(steps.map((item) => item.state)).toEqual(['unavailable', 'unavailable', 'unavailable']);
  });

  // PK-42: Uptime Kuma delivers for both slugs and the first restore test passed on 12.11.,
  // so a silent source is a fault, not a gap.
  it.each([
    ['videoflix', 'Monitoring'],
    ['videoflix', 'Restore-Test'],
    ['portfolio', 'Monitoring'],
  ])('"%s" measures "%s" as set up', (slug, name) => {
    const step = deliveryPlans[slug].steps.find((item) => item.name === name) as MeasuredStep;
    expect(step.setUp).toBe(true);
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

  it('says what the CI of the VPS platform really does: start and scan, no tests', () => {
    const ci = deliveryPlans['vps-plattform'].steps.find(
      (item) => item.name === 'CI & Security-Checks',
    ) as MeasuredStep;
    expect(ci.sentences.verified).toBe(
      'Jede Änderung startet die echte Konfiguration und wird auf Schwachstellen geprüft.',
    );
    expect(JSON.stringify(deliveryPlans['vps-plattform'])).not.toMatch(/getestet/);
    expect(ci.sentences.partial).toBeTruthy();
    expect(ci.sentences.deviation).toBeTruthy();
  });

  it('has no plan for Conduit any more', () => {
    expect(deliveryPlans).not.toHaveProperty('conduit');
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
    expect(readers).toHaveLength(1);
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
    expect(deliveryPlans['vps-plattform'].runningLabel).toBe('Läuft in Produktion');
  });

  it('reads the measured projects from their status key, the others from the content', () => {
    expect(deliveryPlans['videoflix'].statusKey).toBe('videoflix');
    expect(deliveryPlans['vps-plattform'].statusKey).toBe('vps-plattform');
    expect(deliveryPlans['portfolio'].statusKey).toBe('portfolio');
    expect(deliveryPlans['neuro-check-in'].statusKey).toBe('neuro-check-in');
    expect(deliveryPlans['buildorder'].statusKey).toBe('buildorder');
  });

  it('names the repositories of Videoflix after their role', () => {
    expect(deliveryPlans['videoflix'].repoLabels).toEqual({
      'PhilippKlinger/videoflix-backend': 'Backend',
      'PhilippKlinger/videoflix-frontend': 'Frontend',
      'PhilippKlinger/videoflix-deploy': 'Deploy',
    });
  });

  it('names the repositories of the VPS platform after their role', () => {
    expect(deliveryPlans['vps-plattform'].repoLabels).toEqual({
      'PhilippKlinger/vps-edge': 'Edge-Proxy',
      'PhilippKlinger/vps-monitoring': 'Monitoring',
    });
  });

  it('keeps the Play Store link of Neuro Check-in without a fixed event', () => {
    const release = deliveryPlans['neuro-check-in'].steps.find(
      (step) => step.name === 'Release im Play Store',
    ) as FixedStep;
    expect(release.state).toBe('verified');
    expect(release.sentence).toBe('Die App ist öffentlich im Play Store verfügbar.');
    expect(release.event).toBeUndefined();
    expect(release.links?.[0].url).toBe(
      'https://play.google.com/store/apps/details?id=com.philippklinger.neurocheckin',
    );
  });

  it('shows the website uptime as the signal of neuro check-in', () => {
    const status = healthyStatus();
    status.stability.links = [
      { kind: 'status-page', source: 'site', url: 'https://example.com/s' },
    ];
    const view = buildDeliveryView(deliveryPlans['neuro-check-in'], {
      generatedAt: '2026-11-06T00:58:11.069Z',
      status,
    });
    expect(view.signal).toEqual({
      state: 'verified',
      status: 'Website erreichbar',
      when: '100 % (24 h)',
    });
  });

  it('shows a neutral signal for neuro without its key in status.json', () => {
    const view = buildDeliveryView(deliveryPlans['neuro-check-in'], null);
    expect(view.signal.status).toBe('Stand nicht abrufbar');
  });

  it('keeps no fixed version in the plans', () => {
    expect(JSON.stringify(deliveryPlans)).not.toMatch(/Version \d/);
  });

  it('keeps the code of Neuro Check-in private', () => {
    const steps = deliveryPlans['neuro-check-in'].steps as FixedStep[];
    const hidden = steps.filter((step) => step.state === 'private');
    expect(hidden).toHaveLength(2);
    for (const step of hidden) {
      expect(step.sentence).toBe('Der Code ist privat, Läufe zeige ich im Gespräch.');
    }
  });

  // Buildorder is public: CI and code are measured, no fixed "Code privat" any more.
  it('measures the signal of Buildorder from its CI', () => {
    const plan = deliveryPlans['buildorder'];
    expect(plan.fixedSignal).toBeUndefined();
    const status = healthyStatus();
    // "Belegt" needs the public link to the run, as the collector writes it (spec 5).
    const [run] = status.checks.signals.workflows;
    status.checks.links = [
      {
        kind: 'workflow-run',
        source: run.repo,
        url: 'https://github.com/run/1',
        workflow: run.workflow,
      },
    ];
    const view = buildDeliveryView(plan, { generatedAt: '2026-11-06T00:58:11.069Z', status });
    expect(view.signal.state).toBe('verified');
    expect(view.signal.status).toBe('CI grün');
  });

  // No version in the text: the release page stays current by itself.
  it('links the public releases of Buildorder', () => {
    const release = deliveryPlans['buildorder'].steps.find(
      (step) => step.name === 'Release',
    ) as FixedStep;
    expect(release.state).toBe('verified');
    expect(release.sentence).toBe('Releases sind öffentlich auf GitHub veröffentlicht.');
    expect(release.links).toEqual([
      {
        label: 'Releases ansehen',
        url: 'https://github.com/PhilippKlinger/buildorder/releases',
      },
    ]);
  });
});
