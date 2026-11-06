import {
  buildDeliveryView,
  DeliveryPlan,
  DeliveryStepView,
  deliveryTexts,
  DeliveryView,
  FixedStep,
  isStale,
  MeasuredStep,
  parseStatusDocument,
  pickNewerSnapshot,
  pickProjectSnapshot,
  ProjectSnapshot,
  statusNotice,
  StepSource,
} from './software-delivery';
import { ProjectStatus, StatusDocument, StatusLink, WorkflowSignal } from './status';
import { healthyStatus } from './status.fixture';

const generatedAt = '2026-11-06T00:58:11.069Z';
const repo = 'PhilippKlinger/example';
const backend = 'PhilippKlinger/backend';
const frontend = 'PhilippKlinger/frontend';
const repoLabels = { [backend]: 'Backend', [frontend]: 'Frontend' };

type Change = (status: ProjectStatus) => void;

/** healthyStatus has no links at five stations, here every station has a public one. */
function provenStatus(change: Change = () => undefined): ProjectStatus {
  const status = healthyStatus();
  status.checks.links = [
    { kind: 'workflow-run', source: repo, url: 'https://github.com/run/1', workflow: 'CI' },
  ];
  status.supplyChain.links = [
    { kind: 'attestations', source: repo, url: 'https://github.com/attestations' },
  ];
  status.live.links = [{ kind: 'version-endpoint', source: 'site', url: 'https://example.com/v' }];
  status.stability.links = [{ kind: 'status-page', source: 'site', url: 'https://example.com/s' }];
  status.restore.links = [{ kind: 'restore-test', source: repo, url: 'https://github.com/r' }];
  change(status);
  return status;
}

function step(sources: StepSource[], setUp = true): MeasuredStep {
  return {
    name: 'Schritt',
    sources,
    setUp,
    sentences: { verified: 'v', partial: 'p', deviation: 'd', notSetUp: 'n' },
  };
}

const snapshotOf = (status: ProjectStatus): ProjectSnapshot => ({ generatedAt, status });

function viewOf(plan: Partial<DeliveryPlan>, status: ProjectStatus): DeliveryView {
  return buildDeliveryView({ steps: [], ...plan }, snapshotOf(status));
}

function stepView(measured: MeasuredStep, status: ProjectStatus): DeliveryStepView {
  return viewOf({ steps: [measured] }, status).steps[0];
}

const eventOf = (source: StepSource, change: Change = () => undefined) =>
  stepView(step([source]), provenStatus(change)).event;

const labelsOf = (source: StepSource, status: ProjectStatus, labels?: Record<string, string>) =>
  viewOf({ repoLabels: labels, steps: [step([source])] }, status).steps[0].links.map(
    (link) => link.label,
  );

function workflow(change: Partial<WorkflowSignal>): WorkflowSignal {
  return {
    repo,
    workflow: 'CI',
    file: 'ci.yml',
    kind: 'tests',
    reachable: true,
    conclusion: 'success',
    headSha: 'fe1dd3ec7e31abc970305f4ce68d1cee278d351b',
    completedAt: '2026-11-05T19:32:18Z',
    ...change,
  };
}

const deployRun = workflow({
  workflow: 'Deploy',
  file: 'deploy.yml',
  kind: 'deploy',
  completedAt: '2026-11-06T10:42:00Z',
});
const deployLink: StatusLink = {
  kind: 'workflow-run',
  source: repo,
  url: 'https://github.com/run/9',
  workflow: 'Deploy',
};

function withDeployRun(status: ProjectStatus): void {
  status.checks.signals.workflows.push({ ...deployRun });
  status.checks.links.push(deployLink);
}

const noAttestation: Change = (status) => {
  const { attestation } = status.supplyChain.signals.repos[0];
  Object.assign(attestation!, { reachable: false, provenanceCount: null });
};
const redCheck: Change = (status) => {
  status.checks.signals.workflows[0].conclusion = 'failure';
};
const monitorDown: Change = (status) => {
  status.stability.signals.monitorsUp = 1;
};
const liveAhead: Change = (status) => {
  status.live.signals.components[0].matchesLatestGreen = false;
};
const restoreFailed: Change = (status) => {
  status.restore.signals.result = 'failed';
};
const noCode: Change = (status) => {
  Object.assign(status.code.signals.repos[0], {
    reachable: false,
    isPublic: null,
    rulesets: null,
    mergedPullRequests: null,
  });
};
const noRestore: Change = (status) => {
  status.restore.signals = { testedAt: null, result: null };
};

describe('buildDeliveryView', () => {
  describe('states (spec 6.3)', () => {
    it.each<[string, StepSource, Change, boolean, string]>([
      ['alle Einträge bewiesen', 'supplyChain', () => undefined, true, 'verified'],
      ['Attestierung fehlt, SBOM und Scorecard da', 'supplyChain', noAttestation, true, 'partial'],
      ['Prüfung rot', 'checks', redCheck, true, 'deviation'],
      ['Dienst unten', 'stability', monitorDown, true, 'deviation'],
      ['Live weicht ab', 'live', liveAhead, true, 'deviation'],
      ['Restore fehlgeschlagen', 'restore', restoreFailed, true, 'deviation'],
      ['Quelle antwortet nicht, setUp true', 'code', noCode, true, 'unavailable'],
      ['keine Daten, setUp false', 'restore', noRestore, false, 'notSetUp'],
    ])('%s', (_name, source, change, setUp, expected) => {
      expect(stepView(step([source], setUp), provenStatus(change)).state).toBe(expected);
    });

    it('promotes a step with setUp false as soon as the data proves it', () => {
      expect(stepView(step(['restore'], false), provenStatus()).state).toBe('verified');
    });

    it('shows a problem of a step with setUp false as well', () => {
      expect(stepView(step(['restore'], false), provenStatus(restoreFailed)).state).toBe(
        'deviation',
      );
    });

    it('counts zero attestations as a deviation', () => {
      const status = provenStatus((item) => {
        item.supplyChain.signals.repos[0].attestation!.provenanceCount = 0;
      });
      expect(stepView(step(['supplyChain']), status).state).toBe('deviation');
    });

    it('counts a private repository as a deviation', () => {
      const status = provenStatus((item) => {
        item.code.signals.repos[0].isPublic = false;
      });
      expect(stepView(step(['code']), status).state).toBe('deviation');
    });

    it('counts a ruleset that misses the default branch as a deviation', () => {
      const status = provenStatus((item) => {
        item.code.signals.repos[0].rulesets![0].appliesToDefaultBranch = false;
      });
      expect(stepView(step(['code']), status).state).toBe('deviation');
    });

    it('counts a restore test without a result as proven, with its date', () => {
      const status = provenStatus((item) => {
        item.restore.signals.result = null;
      });
      expect(stepView(step(['restore']), status).state).toBe('verified');
    });

    it('never shows verified without a public link', () => {
      const status = provenStatus((item) => {
        item.code.links = [];
      });
      expect(stepView(step(['code']), status).state).toBe('partial');
    });

    it('does not count a link that is not public as proof', () => {
      const status = provenStatus((item) => {
        item.code.links = [{ kind: 'repository', source: repo, url: 'http://example.com' }];
      });
      expect(stepView(step(['code']), status).state).toBe('partial');
    });

    it('falls back to not available when a step has no sentence for partial', () => {
      const monitoring = { ...step(['stability']), sentences: { verified: 'v', deviation: 'd' } };
      const status = provenStatus((item) => {
        item.stability.links = [];
      });
      const view = stepView(monitoring, status);
      expect(view.state).toBe('unavailable');
      expect(view.sentence).toBe('Dieser Beleg ist gerade nicht abrufbar.');
    });

    it('leaves repositories without attestation in an older file out of the supply chain', () => {
      const status = provenStatus((item) => {
        const [built] = item.supplyChain.signals.repos;
        item.supplyChain.signals.repos.push({
          ...built,
          repo: 'PhilippKlinger/deploy',
          attestation: null,
          sbom: { reachable: false, spdxVersion: null, packageCount: null },
        });
      });
      expect(stepView(step(['supplyChain']), status).state).toBe('verified');
    });

    it('ignores deploy workflows in the checks source', () => {
      const status = provenStatus((item) => {
        withDeployRun(item);
        item.checks.signals.workflows.at(-1)!.conclusion = 'failure';
      });
      expect(stepView(step(['checks']), status).state).toBe('verified');
    });

    it('reads the deploy workflow in the deployRun source', () => {
      const status = provenStatus(withDeployRun);
      expect(stepView(step(['deployRun']), status).state).toBe('verified');
      status.checks.signals.workflows.at(-1)!.conclusion = 'failure';
      expect(stepView(step(['deployRun']), status).state).toBe('deviation');
    });

    it('treats an image with digest as proven', () => {
      const status = provenStatus((item) => {
        item.supplyChain.links = [{ kind: 'image', source: repo, url: 'https://github.com/i' }];
        noAttestation(item);
      });
      expect(stepView(step(['image']), status).state).toBe('verified');
    });

    it('has no statement on an image without digest', () => {
      const status = provenStatus((item) => {
        item.supplyChain.links = [{ kind: 'image', source: repo, url: 'https://github.com/i' }];
        item.supplyChain.signals.repos[0].attestation!.subjectDigest = null;
      });
      expect(stepView(step(['image']), status).state).toBe('unavailable');
    });

    it('stays unavailable without a snapshot, and not set up with setUp false', () => {
      const plan = { steps: [step(['code']), step(['restore'], false)] };
      const { steps } = buildDeliveryView(plan, null);
      expect(steps.map((item) => item.state)).toEqual(['unavailable', 'notSetUp']);
    });

    it('has no statement for a source without entries', () => {
      expect(stepView(step(['deployRun', 'live'], false), noLive()).state).toBe('notSetUp');
    });
  });

  describe('sentences', () => {
    it('takes the sentence of the state from the plan', () => {
      expect(stepView(step(['code']), provenStatus()).sentence).toBe('v');
      expect(stepView(step(['checks']), provenStatus(redCheck)).sentence).toBe('d');
      expect(stepView(step(['restore'], false), provenStatus(noRestore)).sentence).toBe('n');
    });

    it('has one sentence for unavailable everywhere', () => {
      expect(stepView(step(['code']), provenStatus(noCode)).sentence).toBe(
        'Dieser Beleg ist gerade nicht abrufbar.',
      );
    });
  });

  describe('events (spec 6.3)', () => {
    it('code: sums up merged pull requests and the protection', () => {
      expect(eventOf('code', twoMoreRepos)).toBe(
        '75 gemergte Pull Requests in 3 Repos, main geschützt',
      );
    });

    it('code: says so when a repository is not protected', () => {
      const event = eventOf('code', (status) => {
        status.code.signals.repos[0].rulesets![0].enforcement = 'disabled';
      });
      expect(event).toBe('28 gemergte Pull Requests in 1 Repo, main nicht durchgängig geschützt');
    });

    it('code: makes no statement on a protection that is not known', () => {
      const event = eventOf('code', (status) => {
        Object.assign(status.code.signals.repos[0], { reachable: false, rulesets: null });
      });
      expect(event).toBe('28 gemergte Pull Requests in 1 Repo');
    });

    it('code: has no event without any repository data', () => {
      expect(eventOf('code', noCode)).toBeNull();
    });

    it('checks: names the workflows and the latest run', () => {
      const event = eventOf('checks', (status) => {
        status.checks.signals.workflows = [
          workflow({ completedAt: '2026-11-05T19:13:01Z' }),
          workflow({ workflow: 'CodeQL', completedAt: '2026-11-05T19:30:20Z' }),
          workflow({ workflow: 'Security Checks', completedAt: '2026-11-05T19:29:26Z' }),
          workflow({ completedAt: '2026-11-05T19:32:49Z' }),
        ];
      });
      expect(event).toBe('CI, CodeQL, Security Checks grün, 05.11., 20:32');
    });

    it('checks: names what is red', () => {
      const event = eventOf('checks', (status) => {
        status.checks.signals.workflows.push(
          workflow({ workflow: 'CodeQL', conclusion: 'failure' }),
        );
      });
      expect(event).toBe('CodeQL rot, 05.11., 20:33');
    });

    it('supply chain: names attestation and SBOM when verified', () => {
      const event = eventOf('supplyChain', (status) => {
        const [built] = status.supplyChain.signals.repos;
        status.supplyChain.signals.repos.push({ ...built });
      });
      expect(event).toBe('Attestierung für beide Images, SBOM vorhanden');
    });

    it('supply chain: names SBOM and real scores when partial', () => {
      const event = eventOf('supplyChain', (status) => {
        noAttestation(status);
        const [built] = status.supplyChain.signals.repos;
        status.supplyChain.signals.repos[0].scorecard.score = 6.9;
        status.supplyChain.signals.repos.push({
          ...built,
          scorecard: { reachable: true, score: 7.1, date: null },
        });
      });
      expect(event).toBe('SBOM vorhanden, OpenSSF Scorecard 6,9 und 7,1 von 10');
    });

    it('supply chain: invents no score', () => {
      const event = eventOf('supplyChain', (status) => {
        noAttestation(status);
        status.supplyChain.signals.repos[0].scorecard = {
          reachable: false,
          score: null,
          date: null,
        };
      });
      expect(event).toBe('SBOM vorhanden');
    });

    it('names the source commit of an image, and works without it', () => {
      expect(eventOf('image')).toBe('Image gebaut für Commit 82dcf43');
      const withoutSource = eventOf('image', (status) => {
        delete status.supplyChain.signals.repos[0].attestation!.sourceSha;
      });
      expect(withoutSource).toBe('Image in GHCR vorhanden');
    });

    it('names no source commit without a digest', () => {
      const event = eventOf('image', (status) => {
        status.supplyChain.signals.repos[0].attestation!.subjectDigest = null;
      });
      expect(event).toBeNull();
    });

    it('live: names each component and the comparison', () => {
      const event = eventOf('live', (status) => {
        const [site] = status.live.signals.components;
        status.live.signals.components = [
          { ...site, component: 'backend', deployedSha: 'fe1dd3ec7e31' },
          { ...site, component: 'frontend', deployedSha: 'abc1234def56' },
        ];
      });
      expect(event).toBe(
        'Live: Backend fe1dd3e, Frontend abc1234, gleicher Stand wie die letzte grüne CI',
      );
    });

    it('live: leaves out the name of a single component', () => {
      expect(eventOf('live')).toBe('Live: Commit 82dcf43, gleicher Stand wie die letzte grüne CI');
    });

    it('live: names a deviation', () => {
      expect(eventOf('live', liveAhead)).toBe(
        'Live: Commit 82dcf43, weicht von der letzten grünen CI ab',
      );
    });

    it('live: stays silent on the comparison when one side is missing', () => {
      const event = eventOf('live', (status) => {
        status.live.signals.components[0].matchesLatestGreen = null;
      });
      expect(event).toBe('Live: Commit 82dcf43');
    });

    it('deploy run: names the result and the time', () => {
      expect(eventOf('deployRun', withDeployRun)).toBe(
        'Letztes Deployment erfolgreich, 06.11., 11:42',
      );
      const red = eventOf('deployRun', (status) => {
        withDeployRun(status);
        status.checks.signals.workflows.at(-1)!.conclusion = 'failure';
      });
      expect(red).toBe('Letztes Deployment nicht erfolgreich, 06.11., 11:42');
    });

    it('stability: names the availability of 30 days', () => {
      const event = eventOf('stability', (status) => {
        status.stability.signals.uptime30d = 0.999;
      });
      expect(event).toBe('Verfügbarkeit 30 Tage: 99,9 %');
    });

    it('stability: counts the services without a value', () => {
      const event = eventOf('stability', (status) => {
        Object.assign(status.stability.signals, {
          uptime30d: null,
          monitorsTotal: 3,
          monitorsUp: 3,
        });
      });
      expect(event).toBe('3 von 3 Diensten erreichbar');
    });

    it('restore: names the result and the date', () => {
      const event = eventOf('restore', (status) => {
        status.restore.signals.testedAt = '2026-11-01T00:00:00Z';
      });
      expect(event).toBe('Letzter Restore-Test erfolgreich, 01.11.2026');
      expect(eventOf('restore', restoreFailed)).toBe(
        'Letzter Restore-Test fehlgeschlagen, 04.11.2026',
      );
    });

    it('formats event times in Europe/Berlin regardless of the machine', () => {
      const event = eventOf('checks', (status) => {
        status.checks.signals.workflows[0].completedAt = '2026-11-05T23:30:00Z';
      });
      expect(event).toBe('CI grün, 06.11., 00:30');
    });
  });

  describe('links (spec 6.5)', () => {
    it('names repositories after their role and drops the pull requests', () => {
      const status = provenStatus((item) => {
        item.code.links = [
          { kind: 'repository', source: backend, url: 'https://github.com/b' },
          { kind: 'pull-requests', source: backend, url: 'https://github.com/b/pulls' },
          { kind: 'repository', source: frontend, url: 'https://github.com/f' },
        ];
      });
      expect(labelsOf('code', status, repoLabels)).toEqual(['Backend', 'Frontend']);
    });

    it('calls a single repository "Repository"', () => {
      const status = provenStatus((item) => {
        item.code.links = [{ kind: 'repository', source: repo, url: 'https://github.com/r' }];
      });
      expect(labelsOf('code', status)).toEqual(['Repository']);
    });

    it('keeps https links only, at most 3 per step, proof kind first', () => {
      const status = provenStatus((item) => {
        item.supplyChain.links = [
          { kind: 'scorecard', source: backend, url: 'https://scorecard.dev/b' },
          { kind: 'sbom', source: backend, url: 'https://github.com/b/sbom' },
          { kind: 'attestations', source: frontend, url: 'javascript:alert(1)' },
          { kind: 'attestations', source: backend, url: 'https://github.com/b/att' },
          { kind: 'sbom', source: frontend, url: 'https://github.com/f/sbom' },
        ];
      });
      const { links } = viewOf({ repoLabels, steps: [step(['supplyChain'])] }, status).steps[0];
      expect(links).toEqual([
        { label: 'Attestierung Backend', url: 'https://github.com/b/att' },
        { label: 'SBOM Backend', url: 'https://github.com/b/sbom' },
        { label: 'SBOM Frontend', url: 'https://github.com/f/sbom' },
      ]);
    });

    it('links only the tests workflow of each repo in the checks source', () => {
      const status = provenStatus((item) => {
        item.checks.signals.workflows = [
          workflow({ repo: backend }),
          workflow({ repo: backend, workflow: 'CodeQL', kind: 'scan' }),
          workflow({ repo: frontend }),
          workflow({ repo: frontend, workflow: 'CodeQL', kind: 'scan' }),
        ];
        item.checks.links = [
          { ...runLink(backend, 'CI'), url: 'https://github.com/run/b' },
          runLink(backend, 'CodeQL'),
          { ...runLink(frontend, 'CI'), url: 'https://github.com/run/f' },
          runLink(frontend, 'CodeQL'),
        ];
      });
      const { links } = viewOf({ repoLabels, steps: [step(['checks'])] }, status).steps[0];
      expect(links).toEqual([
        { label: 'Lauf Backend', url: 'https://github.com/run/b' },
        { label: 'Lauf Frontend', url: 'https://github.com/run/f' },
      ]);
    });

    it('treats a run link without workflow name as a check', () => {
      const status = provenStatus((item) => {
        withDeployRun(item);
        item.checks.links = [{ kind: 'workflow-run', source: repo, url: 'https://github.com/o' }];
      });
      expect(labelsOf('checks', status)).toEqual(['Lauf']);
      expect(labelsOf('deployRun', status)).toEqual([]);
    });

    it('shows one run per repository of an older file', () => {
      const status = provenStatus((item) => {
        const unnamed = (id: number): StatusLink => ({
          kind: 'workflow-run',
          source: backend,
          url: `https://github.com/run/${id}`,
        });
        item.checks.links = [unnamed(1), unnamed(2), unnamed(3)];
      });
      expect(labelsOf('checks', status, repoLabels)).toEqual(['Lauf Backend']);
    });

    it('links the deploy run as "Deploy-Lauf" in the deployRun source', () => {
      const status = provenStatus(withDeployRun);
      const { links } = stepView(step(['deployRun']), status);
      expect(links).toEqual([{ label: 'Deploy-Lauf', url: 'https://github.com/run/9' }]);
      expect(labelsOf('checks', status)).toEqual(['Lauf']);
    });

    it('names attestation and SBOM after their role', () => {
      const status = provenStatus((item) => {
        item.supplyChain.links = [
          { kind: 'attestations', source: backend, url: 'https://github.com/a' },
          { kind: 'sbom', source: backend, url: 'https://github.com/s' },
        ];
      });
      expect(labelsOf('supplyChain', status, repoLabels)).toEqual([
        'Attestierung Backend',
        'SBOM Backend',
      ]);
    });

    it('shows one scorecard link when all lead to the same page, else with the role', () => {
      const scorecard = (source: string, url: string): StatusLink => ({
        kind: 'scorecard',
        source,
        url,
      });
      const same = provenStatus((item) => {
        item.supplyChain.links = [
          scorecard(backend, 'https://scorecard.dev/x'),
          scorecard(frontend, 'https://scorecard.dev/x'),
        ];
      });
      const different = provenStatus((item) => {
        item.supplyChain.links = [
          scorecard(backend, 'https://scorecard.dev/b'),
          scorecard(frontend, 'https://scorecard.dev/f'),
        ];
      });
      expect(labelsOf('supplyChain', same, repoLabels)).toEqual(['Scorecard']);
      expect(labelsOf('supplyChain', different, repoLabels)).toEqual([
        'Scorecard Backend',
        'Scorecard Frontend',
      ]);
    });

    it('links the image in GHCR', () => {
      const status = provenStatus((item) => {
        item.supplyChain.links = [
          { kind: 'sbom', source: repo, url: 'https://github.com/s' },
          { kind: 'image', source: repo, url: 'https://github.com/i' },
        ];
      });
      expect(stepView(step(['image']), status).links).toEqual([
        { label: 'Image in GHCR', url: 'https://github.com/i' },
      ]);
    });

    it('names the component of a version endpoint when there are several', () => {
      const status = provenStatus((item) => {
        const [site] = item.live.signals.components;
        item.live.signals.components = [
          { ...site, component: 'backend' },
          { ...site, component: 'frontend' },
        ];
        item.live.links = [
          { kind: 'version-endpoint', source: 'backend', url: 'https://example.com/b' },
          { kind: 'version-endpoint', source: 'frontend', url: 'https://example.com/f' },
        ];
      });
      expect(labelsOf('live', status)).toEqual([
        'Versions-Endpunkt Backend',
        'Versions-Endpunkt Frontend',
      ]);
      expect(labelsOf('live', provenStatus())).toEqual(['Versions-Endpunkt']);
    });

    it('labels status page, restore test and runbook', () => {
      const status = provenStatus((item) => {
        item.restore.links.push({ kind: 'runbook', source: repo, url: 'https://github.com/b' });
      });
      expect(labelsOf('stability', status)).toEqual(['Statusseite']);
      expect(labelsOf('restore', status)).toEqual(['Restore-Test', 'Runbook']);
    });

    it('joins the entries of several sources and takes the event of the first with data', () => {
      const status = provenStatus(withDeployRun);
      const joined = stepView(step(['deployRun', 'live']), status);
      expect(joined.event).toBe('Letztes Deployment erfolgreich, 06.11., 11:42');
      expect(joined.links.map((link) => link.label)).toEqual(['Deploy-Lauf', 'Versions-Endpunkt']);

      status.live.signals.components[0].matchesLatestGreen = false;
      expect(stepView(step(['deployRun', 'live']), status).state).toBe('deviation');

      const noDeploy = stepView(step(['deployRun', 'live']), provenStatus());
      expect(noDeploy.event).toContain('Live: Commit 82dcf43');
    });
  });

  describe('fixed steps', () => {
    const release: FixedStep = {
      name: 'Release',
      state: 'verified',
      sentence: 'Öffentlich verfügbar.',
      event: 'Version 1.11.2',
      links: [{ label: 'Store', url: 'https://example.com/store' }],
    };
    const hidden: FixedStep = {
      name: 'Code',
      arrowToNext: 'CI',
      state: 'private',
      sentence: 'Privat.',
    };

    it('shows a fixed step exactly as planned', () => {
      const { steps } = buildDeliveryView({ steps: [hidden, release] }, null);
      expect(steps).toEqual([
        {
          name: 'Code',
          arrowToNext: 'CI',
          state: 'private',
          sentence: 'Privat.',
          event: null,
          links: [],
        },
        {
          name: 'Release',
          arrowToNext: null,
          state: 'verified',
          sentence: 'Öffentlich verfügbar.',
          event: 'Version 1.11.2',
          links: [{ label: 'Store', url: 'https://example.com/store' }],
        },
      ]);
    });

    it('shows the private counter with at least one verified step', () => {
      const view = buildDeliveryView({ steps: [hidden, hidden, release] }, null);
      expect(view.counter).toBe('1 von 3 öffentlich belegt, Code privat');
    });

    it('uses the footnote when every step is private', () => {
      const view = buildDeliveryView(
        { steps: [hidden, hidden], footnote: 'Öffentliches Repo folgt' },
        null,
      );
      expect(view.counter).toBe('Öffentliches Repo folgt');
    });

    it('shows the fixed signal', () => {
      const fixedSignal = { status: 'Live im Play Store', when: 'Version 1.11.2' };
      expect(buildDeliveryView({ steps: [release], fixedSignal }, null).signal).toEqual(
        fixedSignal,
      );
    });
  });

  describe('counter (spec 4.4)', () => {
    it('does not count partial in the counter', () => {
      const plan = { steps: [step(['code']), step(['restore']), step(['supplyChain'])] };
      expect(viewOf(plan, provenStatus(noAttestation)).counter).toBe('2 von 3 belegt');
    });

    it('counts all steps of the plan, also without data', () => {
      const plan = { steps: [step(['code']), step(['restore'], false)] };
      expect(buildDeliveryView(plan, null).counter).toBe('0 von 2 belegt');
    });
  });

  describe('signal (spec 4.3)', () => {
    const measuredPlan: DeliveryPlan = {
      statusKey: 'videoflix',
      runningLabel: 'Läuft in Produktion',
      steps: [
        step(['code']),
        step(['checks']),
        step(['live', 'deployRun']),
        step(['stability'], false),
        step(['restore'], false),
      ],
    };
    const signalOf = (change: Change = () => undefined) =>
      buildDeliveryView(measuredPlan, snapshotOf(provenStatus(change))).signal;

    it('shows the running label only when live and stability are verified', () => {
      expect(signalOf()).toEqual({ status: 'Läuft in Produktion', when: 'Stand 06.11., 01:58' });
      const notMonitored = signalOf((status) => {
        status.stability.reachable = false;
      });
      expect(notMonitored.status).not.toBe('Läuft in Produktion');
    });

    it('shows no running label without a step that proves it', () => {
      const plan = { ...measuredPlan, steps: [step(['code']), step(['checks'])] };
      expect(viewOf(plan, provenStatus()).signal.status).toBe('CI grün');
    });

    it('falls back to "CI grün" with the date of the latest CI run', () => {
      const signal = signalOf((status) => {
        status.stability.reachable = false;
        status.checks.signals.workflows = [
          workflow({ completedAt: '2026-11-04T10:00:00Z' }),
          workflow({ completedAt: '2026-11-05T10:00:00Z' }),
          workflow({ workflow: 'CodeQL', kind: 'scan', completedAt: '2026-11-06T02:00:00Z' }),
        ];
      });
      expect(signal).toEqual({ status: 'CI grün', when: 'zuletzt 05.11.' });
    });

    it('shows "Abweichung im Betrieb" before "CI grün" when live or stability deviate', () => {
      const expected = { status: 'Abweichung im Betrieb', when: 'Stand 06.11., 01:58' };
      expect(signalOf(liveAhead)).toEqual(expected);
      expect(signalOf(monitorDown)).toEqual(expected);
    });

    it('shows "Abweichung im Betrieb" before "Prüfung rot"', () => {
      const signal = signalOf((status) => {
        liveAhead(status);
        redCheck(status);
      });
      expect(signal.status).toBe('Abweichung im Betrieb');
    });

    it('shows "Prüfung rot" with the date of the latest run when a check is red', () => {
      const signal = signalOf((status) => {
        status.stability.reachable = false;
        status.checks.signals.workflows = [
          workflow({ completedAt: '2026-11-03T10:00:00Z' }),
          workflow({
            workflow: 'CodeQL',
            kind: 'scan',
            conclusion: 'failure',
            completedAt: '2026-11-05T10:00:00Z',
          }),
        ];
      });
      expect(signal).toEqual({ status: 'Prüfung rot', when: 'zuletzt 05.11.' });
    });

    it('shows "Teilweise belegt" with data but neither running nor green', () => {
      const signal = signalOf((status) => {
        status.stability.reachable = false;
        status.checks.signals.workflows[0].reachable = false;
      });
      expect(signal).toEqual({ status: 'Teilweise belegt', when: 'Stand 06.11., 01:58' });
    });

    it('shows "Stand nicht abrufbar" without a snapshot, with empty when', () => {
      expect(buildDeliveryView(measuredPlan, null).signal).toEqual({
        status: 'Stand nicht abrufbar',
        when: '',
      });
    });
  });

  it('never writes undefined, null or NaN into a text', () => {
    const plan: DeliveryPlan = {
      statusKey: 'videoflix',
      runningLabel: 'Läuft',
      repoLabels,
      steps: [
        step(['code']),
        step(['checks']),
        step(['supplyChain']),
        step(['image']),
        step(['live', 'deployRun']),
        step(['stability']),
        step(['restore']),
      ],
    };
    for (const status of [emptyStatus(), halfEmptyStatus()]) {
      const view = buildDeliveryView(plan, snapshotOf(status));
      expect(textsOf(view).join(' | ')).not.toMatch(/undefined|null|NaN/);
    }
  });

  it('shows the last step without an arrow and the others with theirs', () => {
    const { steps } = buildDeliveryView(
      { steps: [{ ...step(['code']), arrowToNext: 'CI' }, step(['checks'])] },
      null,
    );
    expect(steps.map((item) => item.arrowToNext)).toEqual(['CI', null]);
  });
});

function runLink(source: string, name: string): StatusLink {
  return { kind: 'workflow-run', source, url: `https://github.com/run/${name}`, workflow: name };
}

function twoMoreRepos(status: ProjectStatus): void {
  const [first] = status.code.signals.repos;
  status.code.signals.repos = [
    { ...first, mergedPullRequests: 40 },
    { ...first, mergedPullRequests: 30 },
    { ...first, mergedPullRequests: 5 },
  ];
}

function noLive(): ProjectStatus {
  const status = provenStatus();
  status.live = { reachable: false, signals: { components: [] }, links: [] };
  return status;
}

function textsOf(view: DeliveryView): (string | null)[] {
  return [
    view.signal.status,
    view.signal.when,
    view.counter,
    ...view.steps.flatMap((item) => [
      item.name,
      item.sentence,
      item.event,
      ...item.links.map((link) => link.label),
    ]),
  ].filter((text) => text !== null);
}

/** Everything the collector can leave open, on reachable and on unreachable entries. */
function emptyStatus(): ProjectStatus {
  const status = provenStatus();
  status.code.signals.repos = [
    {
      repo,
      reachable: false,
      isPublic: null,
      defaultBranch: null,
      mergedPullRequests: null,
      rulesets: null,
    },
  ];
  status.checks.signals.workflows = [
    workflow({ reachable: false, conclusion: null, headSha: null, completedAt: null }),
  ];
  status.supplyChain.signals.repos = [
    {
      repo,
      reachable: false,
      attestation: { reachable: false, subjectDigest: null, provenanceCount: null },
      sbom: { reachable: false, spdxVersion: null, packageCount: null },
      scorecard: { reachable: false, score: null, date: null },
    },
  ];
  status.live.signals.components = [
    {
      component: 'site',
      repo,
      reachable: false,
      deployedSha: null,
      builtAt: null,
      latestGreenSha: null,
      matchesLatestGreen: null,
    },
  ];
  status.stability.reachable = false;
  Object.assign(status.stability.signals, {
    monitorsTotal: null,
    monitorsUp: null,
    uptime30d: null,
  });
  status.restore.signals = { testedAt: null, result: null };
  return status;
}

function halfEmptyStatus(): ProjectStatus {
  const status = provenStatus();
  status.code.signals.repos[0].mergedPullRequests = null;
  status.checks.signals.workflows = [
    workflow({ completedAt: null }),
    { ...deployRun, completedAt: null },
  ];
  status.supplyChain.signals.repos[0].attestation!.sourceSha = null;
  status.supplyChain.signals.repos[0].scorecard = { reachable: true, score: null, date: null };
  status.live.signals.components[0].deployedSha = null;
  status.stability.signals.uptime30d = null;
  status.restore.signals = { testedAt: null, result: 'failed' };
  return status;
}

describe('parseStatusDocument', () => {
  function validDocument(): StatusDocument {
    return {
      schemaVersion: 1,
      generatedAt,
      projects: { videoflix: healthyStatus(), portfolio: healthyStatus() },
    };
  }

  it('accepts a complete document', () => {
    const document = validDocument();
    expect(parseStatusDocument(JSON.stringify(document))).toEqual(document);
  });

  it('accepts a document with conduit', () => {
    const document = validDocument();
    document.projects.conduit = healthyStatus();
    expect(parseStatusDocument(JSON.stringify(document))).toEqual(document);
  });

  it('accepts an old document without conduit', () => {
    const parsed = parseStatusDocument(JSON.stringify(validDocument()));
    expect(parsed).not.toBeNull();
    expect(pickProjectSnapshot(parsed, 'conduit')).toBeNull();
  });

  it('accepts a project with empty lists, as the collector writes for Conduit', () => {
    const document = validDocument();
    document.projects.conduit = healthyStatus();
    document.projects.conduit.live = { reachable: false, signals: { components: [] }, links: [] };
    expect(parseStatusDocument(JSON.stringify(document))).toEqual(document);
  });

  it.each<[string, unknown]>([
    ['is null', null],
    ['is not an object', 'kaputt'],
    ['is empty', {}],
    ['has a broken station', { ...healthyStatus(), restore: { reachable: 'yes' } }],
    ['misses a station', { ...healthyStatus(), stability: undefined }],
  ])('rejects a document whose conduit block is broken: it %s', (_name, conduit) => {
    const text = JSON.stringify({
      ...validDocument(),
      projects: { ...validDocument().projects, conduit },
    });
    expect(parseStatusDocument(text)).toBeNull();
  });

  it.each([
    ['a truncated upload', '{"schemaVersion":1,"generatedAt":"2026'],
    ['the HTML of the 404 page', '<!doctype html><html></html>'],
    ['null', 'null'],
    ['an empty body', ''],
  ])('rejects %s', (_name, text) => {
    expect(parseStatusDocument(text)).toBeNull();
  });

  it('rejects a document with another schema version', () => {
    expect(
      parseStatusDocument(JSON.stringify({ ...validDocument(), schemaVersion: 2 })),
    ).toBeNull();
  });

  it('rejects an invalid time', () => {
    expect(
      parseStatusDocument(JSON.stringify({ ...validDocument(), generatedAt: 'x' })),
    ).toBeNull();
  });

  it('rejects a missing project', () => {
    const { videoflix } = validDocument().projects;
    const text = JSON.stringify({ ...validDocument(), projects: { videoflix } });
    expect(parseStatusDocument(text)).toBeNull();
  });

  it.each<[string, Change]>([
    ['is missing', (status) => delete (status as Partial<ProjectStatus>).restore],
    ['has no links', (status) => Object.assign(status.live, { links: null })],
    ['has no signals', (status) => Object.assign(status.code, { signals: null })],
    ['has no state', (status) => Object.assign(status.code, { reachable: 'yes' })],
    ['has no list of entries', (status) => Object.assign(status.code.signals, { repos: null })],
    [
      'has an entry that is no object',
      (status) => Object.assign(status.live.signals, { components: [null] }),
    ],
    [
      'has a link without url',
      (status) => Object.assign(status.code, { links: [{ kind: 'sbom' }] }),
    ],
    [
      'has a repository without SBOM',
      (status) => Object.assign(status.supplyChain.signals.repos[0], { sbom: null }),
    ],
  ])('rejects a document in which a station %s', (_name, change) => {
    const document = validDocument();
    change(document.projects.portfolio);
    expect(parseStatusDocument(JSON.stringify(document))).toBeNull();
  });
});

describe('parseStatusDocument: entries of a station', () => {
  function documentWith(change: Change): StatusDocument {
    const document: StatusDocument = {
      schemaVersion: 1,
      generatedAt,
      projects: { videoflix: provenStatus(), portfolio: provenStatus(), conduit: provenStatus() },
    };
    change(document.projects.videoflix);
    return document;
  }
  const parsedWith = (change: Change) => parseStatusDocument(JSON.stringify(documentWith(change)));

  const firstRepo = (status: ProjectStatus) => status.code.signals.repos[0];
  const firstBuilt = (status: ProjectStatus) => status.supplyChain.signals.repos[0];

  it.each<[string, Change]>([
    ['components without fields', (s) => Object.assign(s.live.signals, { components: [{}, {}] })],
    [
      'a deployed commit as number',
      (s) => Object.assign(s.live.signals.components[0], { deployedSha: 123 }),
    ],
    [
      'a comparison as text',
      (s) => Object.assign(s.live.signals.components[0], { matchesLatestGreen: 'yes' }),
    ],
    ['rulesets that are no list', (s) => Object.assign(firstRepo(s), { rulesets: {} })],
    ['a ruleset without fields', (s) => Object.assign(firstRepo(s), { rulesets: [{}] })],
    ['a repository without its name', (s) => Object.assign(firstRepo(s), { repo: undefined })],
    [
      'a pull request count as text',
      (s) => Object.assign(firstRepo(s), { mergedPullRequests: '28' }),
    ],
    ['a negative count', (s) => Object.assign(firstRepo(s), { mergedPullRequests: -1 })],
    [
      'a link without source',
      (s) =>
        Object.assign(s.code, { links: [{ kind: 'repository', url: 'https://github.com/x' }] }),
    ],
    [
      'a link without kind',
      (s) => Object.assign(s.code, { links: [{ source: repo, url: 'https://github.com/x' }] }),
    ],
    [
      'a workflow name as number on a link',
      (s) => Object.assign(s.checks.links[0], { workflow: 1 }),
    ],
    ['empty stability signals', (s) => Object.assign(s.stability, { signals: {} })],
    [
      'half stability signals',
      (s) => Object.assign(s.stability, { signals: { monitorsTotal: 3, uptime30d: null } }),
    ],
    ['a monitor count as text', (s) => Object.assign(s.stability.signals, { monitorsTotal: '3' })],
    ['empty restore signals with a restore link', (s) => Object.assign(s.restore, { signals: {} })],
    ['an unknown restore result', (s) => Object.assign(s.restore.signals, { result: 'maybe' })],
    [
      'a workflow with nothing but a state',
      (s) => Object.assign(s.checks.signals, { workflows: [{ reachable: true }] }),
    ],
    [
      'a workflow without a conclusion field',
      (s) => Object.assign(s.checks.signals.workflows[0], { conclusion: undefined }),
    ],
    ['an attestation as text', (s) => Object.assign(firstBuilt(s), { attestation: 'signed' })],
    ['an attestation without fields', (s) => Object.assign(firstBuilt(s), { attestation: {} })],
    [
      'a source commit as number',
      (s) => Object.assign(firstBuilt(s).attestation!, { sourceSha: 1 }),
    ],
    ['an SBOM without fields', (s) => Object.assign(firstBuilt(s), { sbom: {} })],
    ['a score as text', (s) => Object.assign(firstBuilt(s).scorecard, { score: '6,7' })],
  ])('rejects %s', (_name, change) => {
    expect(parsedWith(change)).toBeNull();
  });

  it('rejects a broken entry in the conduit block as well', () => {
    const document = documentWith(() => undefined);
    Object.assign(document.projects.conduit!.live.signals, { components: [{}] });
    expect(parseStatusDocument(JSON.stringify(document))).toBeNull();
  });

  it('rejects a time that is no text', () => {
    const text = JSON.stringify({ ...documentWith(() => undefined), generatedAt: 1762390691 });
    expect(parseStatusDocument(text)).toBeNull();
  });

  it.each<[string, Change]>([
    ['an image without sourceSha', (s) => delete firstBuilt(s).attestation!.sourceSha],
    ['a run link without workflow', (s) => delete s.checks.links[0].workflow],
    [
      'a repository without attestation',
      (s) => Object.assign(firstBuilt(s), { attestation: null }),
    ],
    ['everything the collector can leave open', (s) => Object.assign(s, emptyStatus())],
  ])('accepts %s', (_name, change) => {
    expect(parsedWith(change)).not.toBeNull();
  });

  it('accepts a file without conduit', () => {
    const document = documentWith(() => undefined);
    delete document.projects.conduit;
    expect(parseStatusDocument(JSON.stringify(document))).not.toBeNull();
  });

  it('does not build a list per service, so a huge count cannot throw', () => {
    const parsed = parsedWith((s) =>
      Object.assign(s.stability.signals, { monitorsTotal: 2 ** 40, monitorsUp: 2 ** 40 }),
    );
    expect(stepView(step(['stability']), parsed!.projects.videoflix).state).toBe('verified');
  });

  // Whatever replaces a field: the parser refuses it, or the view can live with it.
  it('never lets a wrong field through to a view that throws', () => {
    const plan: DeliveryPlan = {
      runningLabel: 'Läuft',
      repoLabels,
      steps: [
        step(['code']),
        step(['checks']),
        step(['supplyChain']),
        step(['image']),
        step(['live', 'deployRun']),
        step(['stability']),
        step(['restore']),
      ],
    };
    const original = documentWith(withDeployRun);
    for (const path of fieldPaths(original.projects.videoflix)) {
      for (const wrong of [null, 123, 1.5, -1, 'x', true, {}, [], [null], [{}]]) {
        const parsed = parseStatusDocument(JSON.stringify(replaced(original, path, wrong)));
        if (!parsed) continue;
        const snapshot = pickProjectSnapshot(parsed, 'videoflix');
        expect(() => buildDeliveryView(plan, snapshot), path.join('.')).not.toThrow();
      }
    }
  });
});

function fieldPaths(value: unknown, path: string[] = []): string[][] {
  if (typeof value !== 'object' || value === null) return [path];
  const children = Object.entries(value).flatMap(([key, child]) =>
    fieldPaths(child, [...path, key]),
  );
  return path.length > 0 ? [path, ...children] : children;
}

function replaced(document: StatusDocument, path: string[], value: unknown): StatusDocument {
  const copy = JSON.parse(JSON.stringify(document)) as StatusDocument;
  const parent = path
    .slice(0, -1)
    .reduce<Record<string, unknown>>(
      (node, key) => node[key] as Record<string, unknown>,
      copy.projects.videoflix as unknown as Record<string, unknown>,
    );
  parent[path[path.length - 1]] = value;
  return copy;
}

describe('pickProjectSnapshot', () => {
  it('keeps only the project of the page', () => {
    const videoflix = healthyStatus();
    const document: StatusDocument = {
      schemaVersion: 1,
      generatedAt,
      projects: { videoflix, portfolio: healthyStatus() },
    };
    expect(pickProjectSnapshot(document, 'videoflix')).toEqual({ generatedAt, status: videoflix });
  });

  it('returns null for a project the document does not contain yet', () => {
    const document: StatusDocument = {
      schemaVersion: 1,
      generatedAt,
      projects: { videoflix: healthyStatus(), portfolio: healthyStatus() },
    };
    expect(pickProjectSnapshot(document, 'conduit')).toBeNull();
  });

  it('stays empty without a document', () => {
    expect(pickProjectSnapshot(null, 'videoflix')).toBeNull();
  });
});

describe('isStale', () => {
  const time = '2026-11-05T12:00:00Z';

  it('accepts data up to one day old', () => {
    expect(isStale(time, new Date('2026-11-06T12:00:00Z'))).toBe(false);
  });

  it('flags older data', () => {
    expect(isStale(time, new Date('2026-11-06T12:00:01Z'))).toBe(true);
  });
});

describe('pickNewerSnapshot', () => {
  const older: ProjectSnapshot = { generatedAt: '2026-11-05T12:00:00Z', status: healthyStatus() };
  const newer: ProjectSnapshot = { generatedAt: '2026-11-06T12:00:00Z', status: healthyStatus() };

  it('takes the newer status and keeps the current one otherwise', () => {
    expect(pickNewerSnapshot(older, newer)).toBe(newer);
    expect(pickNewerSnapshot(newer, older)).toBe(newer);
    expect(pickNewerSnapshot(older, older)).toBe(older);
  });

  it('takes what is there when one side is missing', () => {
    expect(pickNewerSnapshot(null, newer)).toBe(newer);
    expect(pickNewerSnapshot(older, null)).toBe(older);
    expect(pickNewerSnapshot(null, null)).toBeNull();
  });
});

describe('statusNotice', () => {
  const now = new Date('2026-11-06T12:00:00Z');

  it('reports refreshFailed when nothing was refreshed', () => {
    expect(statusNotice(false, '2026-11-06T11:00:00Z', now)).toBe(deliveryTexts.refreshFailed);
    expect(statusNotice(false, null, now)).toBe(deliveryTexts.refreshFailed);
  });

  it('reports stale when the status is older than a day', () => {
    expect(statusNotice(true, '2026-11-01T00:00:00Z', now)).toBe(deliveryTexts.stale);
  });

  it('stays null for a fresh status', () => {
    expect(statusNotice(true, '2026-11-06T11:00:00Z', now)).toBeNull();
  });

  it('stays null when a refresh brought no time', () => {
    expect(statusNotice(true, null, now)).toBeNull();
  });
});

describe('deliveryTexts', () => {
  it('has the wording of the spec', () => {
    expect(deliveryTexts.refreshFailed).toBe('Der aktuelle Stand ist gerade nicht abrufbar.');
    expect(deliveryTexts.stale).toBe('Dieser Stand ist älter als einen Tag.');
    expect(deliveryTexts.stateLabels).toEqual({
      verified: 'Belegt',
      partial: 'Teilweise',
      deviation: 'Abweichung',
      unavailable: 'Nicht abrufbar',
      notSetUp: 'Noch nicht eingerichtet',
      private: 'Code privat',
    });
  });
});
