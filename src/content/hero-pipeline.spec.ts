import { buildHeroPipeline, HeroPipeline } from './hero-pipeline';
import { ProjectStatus, StatusLink, WorkflowSignal } from './status';
import { healthyStatus } from './status.fixture';

const LIVE_SHA = '82dcf438f80efbfa0c7ab601feb1609b18d0ecad';
const NEWER_SHA = 'ddfaedb5786de39377d4dc470f5f9fa800dda8e2';
const repo = 'PhilippKlinger/example';
const runUrl = (id: number) => `https://github.com/${repo}/actions/runs/${id}`;

const workflow = (overrides: Partial<WorkflowSignal>): WorkflowSignal => ({
  repo,
  workflow: 'CI',
  file: 'ci.yml',
  kind: 'tests',
  reachable: true,
  conclusion: 'success',
  headSha: LIVE_SHA,
  completedAt: '2026-11-05T19:33:18Z',
  ...overrides,
});

const runLink = (name: string, id: number): StatusLink => ({
  kind: 'workflow-run',
  source: repo,
  url: runUrl(id),
  workflow: name,
});

/** All six stations proven, with the links the collector writes for this website. */
function status(change: (draft: ProjectStatus) => void = () => undefined): ProjectStatus {
  const draft = healthyStatus();
  draft.code.links.push({
    kind: 'pull-requests',
    source: repo,
    url: `https://github.com/${repo}/pulls`,
  });
  draft.code.signals.repos[0].mergedPullRequests = 44;
  draft.checks.signals.workflows = [
    workflow({}),
    workflow({ workflow: 'CodeQL', file: 'codeql.yml', kind: 'scan' }),
    workflow({ workflow: 'Deploy preview', file: 'deploy.yml', kind: 'deploy' }),
  ];
  draft.checks.links = [runLink('CI', 1), runLink('CodeQL', 2), runLink('Deploy preview', 3)];
  draft.supplyChain.links = [
    { kind: 'attestations', source: repo, url: `https://github.com/${repo}/attestations` },
    { kind: 'sbom', source: repo, url: `https://github.com/${repo}/network/dependencies` },
  ];
  draft.live.links = [
    { kind: 'version-endpoint', source: 'site', url: 'https://example.com/version.json' },
  ];
  draft.stability.links = [
    {
      kind: 'status-page',
      source: 'portfolio',
      url: 'https://status.example.com/status/portfolio',
    },
  ];
  draft.stability.signals.uptime24h = 0.9985;
  change(draft);
  return draft;
}

const pipeline = (change?: (draft: ProjectStatus) => void): HeroPipeline =>
  buildHeroPipeline({ generatedAt: '2026-11-06T00:58:11.069Z', status: status(change) });

const states = (view: HeroPipeline) => view.stations.map((station) => station.state);
const texts = (view: HeroPipeline) =>
  view.stations.map((station) => station.value.map((part) => part.text).join(''));
const run = (draft: ProjectStatus, name: string) =>
  draft.checks.signals.workflows.find((item) => item.workflow === name)!;

describe('buildHeroPipeline', () => {
  it('names the six stations in the order of the real chain', () => {
    expect(pipeline().stations.map((station) => station.name)).toEqual([
      'Code',
      'Tests & Security',
      'Signed Build',
      'Preview',
      'Production',
      'Monitoring',
    ]);
  });

  describe('everything proven', () => {
    it('runs to Monitoring without a note', () => {
      const view = pipeline();
      expect(states(view)).toEqual(['done', 'done', 'done', 'done', 'done', 'done']);
      expect(view.reached).toBe(5);
      expect(view.note).toBeNull();
      expect(view.still).toBe(false);
    });

    it('shows only values the status delivers', () => {
      expect(texts(pipeline())).toEqual([
        '44 merged PRs',
        'CI · CodeQL passing',
        'Attestation · SBOM',
        'Smoke test passing',
        LIVE_SHA.slice(0, 7),
        'Uptime 99.85 %',
      ]);
    });

    it('links every proof to its source', () => {
      const hrefs = pipeline().stations.map((station) =>
        station.value.flatMap((part) => (part.href ? [part.href] : [])),
      );
      expect(hrefs).toEqual([
        [`https://github.com/${repo}/pulls`],
        [runUrl(1), runUrl(2)],
        [
          `https://github.com/${repo}/attestations`,
          `https://github.com/${repo}/network/dependencies`,
        ],
        [runUrl(3)],
        ['https://example.com/version.json'],
        ['https://status.example.com/status/portfolio'],
      ]);
    });
  });

  describe('a red station stops the run', () => {
    it('stops at a failing CI and keeps what is online', () => {
      const view = pipeline((draft) => {
        run(draft, 'CI').conclusion = 'failure';
      });
      expect(states(view)).toEqual(['done', 'failed', 'open', 'open', 'held', 'held']);
      expect(view.reached).toBe(1);
      expect(texts(view)).toEqual([
        '44 merged PRs',
        'CI failing · CodeQL',
        '—',
        '—',
        LIVE_SHA.slice(0, 7),
        'Uptime 99.85 %',
      ]);
      expect(view.note).toBe(
        `Gestoppt bei Tests & Security, Production bleibt auf ${LIVE_SHA.slice(0, 7)}.`,
      );
    });

    it('marks only the failing word as failed', () => {
      const view = pipeline((draft) => {
        run(draft, 'CodeQL').conclusion = 'failure';
      });
      expect(texts(view)[1]).toBe('CI · CodeQL failing');
      expect(view.stations[1].value.filter((part) => part.failed).map((part) => part.text)).toEqual(
        [' failing'],
      );
    });

    it('stops at Signed Build when the live files have no attestation', () => {
      const view = pipeline((draft) => {
        draft.supplyChain.signals.repos[0].attestation!.provenanceCount = 0;
      });
      expect(states(view)).toEqual(['done', 'done', 'failed', 'open', 'held', 'held']);
      expect(texts(view)[2]).toBe('Attestation failing · SBOM');
    });

    it('claims no SBOM when the collector could not read one', () => {
      const view = pipeline((draft) => {
        draft.supplyChain.signals.repos[0].sbom.reachable = false;
        draft.supplyChain.links = draft.supplyChain.links.filter((link) => link.kind !== 'sbom');
      });
      expect(states(view)[2]).toBe('done');
      expect(texts(view)[2]).toBe('Attestation');
    });

    it('stops at Preview when the job fails, the job does not tell which step', () => {
      const view = pipeline((draft) => {
        run(draft, 'Deploy preview').conclusion = 'failure';
      });
      expect(states(view)).toEqual(['done', 'done', 'done', 'failed', 'held', 'held']);
      expect(view.reached).toBe(3);
      expect(texts(view)[3]).toBe('Deploy failing');
      expect(view.note).toContain('Gestoppt bei Preview');
    });
  });

  describe('Preview is newer than Production', () => {
    const waiting = () =>
      pipeline((draft) => {
        run(draft, 'Deploy preview').headSha = NEWER_SHA;
      });

    it('runs to Preview and holds what is online, nothing is red', () => {
      const view = waiting();
      expect(states(view)).toEqual(['done', 'done', 'done', 'done', 'held', 'held']);
      expect(view.reached).toBe(3);
      expect(view.note).toBe(`Production wartet auf Freigabe, online ist ${LIVE_SHA.slice(0, 7)}.`);
    });
  });

  describe('Monitoring', () => {
    it('fails when a monitor is down, the stations before stay green', () => {
      const view = pipeline((draft) => {
        draft.stability.signals.monitorsUp = 1;
      });
      expect(states(view)).toEqual(['done', 'done', 'done', 'done', 'done', 'failed']);
      expect(view.reached).toBe(5);
      expect(texts(view)[5]).toBe('down');
      expect(view.note).toBe('Monitoring meldet einen Ausfall.');
    });

    it('claims nothing when Kuma counts no monitor', () => {
      const view = pipeline((draft) => {
        draft.stability.signals.monitorsTotal = 0;
        draft.stability.signals.monitorsUp = 0;
      });
      expect(states(view)[5]).toBe('held');
      expect(texts(view)[5]).toBe('—');
      expect(view.note).toBeNull();
    });

    it('stands open with a dash and no note while Kuma delivers nothing', () => {
      const view = pipeline((draft) => {
        draft.stability.reachable = false;
        draft.stability.links = [];
      });
      expect(states(view)).toEqual(['done', 'done', 'done', 'done', 'done', 'held']);
      expect(view.reached).toBe(4);
      expect(texts(view)[5]).toBe('—');
      expect(view.note).toBeNull();
    });
  });

  describe('missing data', () => {
    it('stands still without a status, with no state word and no check', () => {
      const view = buildHeroPipeline(null);
      expect(view.still).toBe(true);
      expect(states(view)).toEqual(['held', 'held', 'held', 'held', 'held', 'held']);
      expect(view.note).toBe('Dieser Stand ist gerade nicht abrufbar.');
      expect(texts(view).join(' ')).not.toMatch(/passing|failing/);
    });

    it('stops without a red mark when one station cannot be read', () => {
      const view = pipeline((draft) => {
        draft.checks.signals.workflows = draft.checks.signals.workflows.filter(
          (item) => item.workflow !== 'CodeQL',
        );
      });
      expect(states(view)).toEqual(['done', 'open', 'open', 'open', 'held', 'held']);
      expect(view.reached).toBe(0);
      expect(texts(view)[1]).toBe('—');
      expect(view.note).toBe('Dieser Stand ist gerade nicht abrufbar.');
    });

    it('keeps a dash on Production when no version can be read', () => {
      const view = pipeline((draft) => {
        draft.live.signals.components[0].deployedSha = null;
      });
      expect(states(view).slice(4)).toEqual(['held', 'held']);
      expect(texts(view)[4]).toBe('—');
      expect(view.reached).toBe(3);
    });
  });
});
