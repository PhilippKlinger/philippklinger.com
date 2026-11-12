import {
  collectStatus,
  parseVersionDocument,
  STATUS_SCHEMA_VERSION,
  validateStatus,
  type FetchLike,
  type ProjectSource,
  type ProjectStatus,
  type StationKey,
  type StatusDocument,
  type StatusSources,
} from './status';
import { statusSources } from './status-sources';

const GREEN_SHA = 'a'.repeat(40);
const OLD_SHA = 'b'.repeat(40);
const DIGEST = `sha256:${'c'.repeat(64)}`;
const STATIONS: StationKey[] = ['code', 'checks', 'supplyChain', 'live', 'stability', 'restore'];

// Values that must never reach the public file, hidden in every fake API response.
const INTERNAL_VALUES = [
  '10.0.0.5',
  '192.168.1.20',
  'db.internal',
  'postgres:5432',
  'videoflix-db-1',
  'DJANGO_SECRET_KEY',
  'ghs_internaltokenvalue',
  'kuma-internal-monitor',
];
const internal = {
  host: 'db.internal',
  ip: '10.0.0.5',
  lan: 'http://192.168.1.20:8080/',
  port: 'postgres:5432',
  container: 'videoflix-db-1',
  env: { DJANGO_SECRET_KEY: 'x' },
  token: 'ghs_internaltokenvalue',
};

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function html(status = 200): Response {
  return new Response('<!doctype html><html><body>App shell</body></html>', {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
}

function run(repo: string, overrides: Record<string, unknown> = {}) {
  return {
    ...internal,
    id: 123,
    name: 'db.internal',
    head_branch: 'main',
    head_sha: GREEN_SHA,
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    updated_at: '2026-11-05T10:00:00Z',
    html_url: 'https://10.0.0.5/internal-run',
    head_repository: { full_name: repo },
    ...overrides,
  };
}

const heartbeat = (status: number, time: string) => ({
  status,
  time,
  msg: 'connect ECONNREFUSED 10.0.0.5:5432 db.internal',
  ping: 12,
});

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

// Answers like the real services on a good day.
const healthyRoutes: [RegExp, Handler][] = [
  [/\/search\/issues/, () => json({ ...internal, total_count: 30, incomplete_results: false })],
  [
    /\/repos\/[^/]+\/[^/]+\/rulesets\/\d+$/,
    () =>
      json({
        ...internal,
        id: 1,
        name: 'db.internal',
        target: 'branch',
        enforcement: 'active',
        conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
        rules: [{ type: 'pull_request' }, { type: 'non_fast_forward' }, { type: 'db.internal:1' }],
      }),
  ],
  [/\/repos\/[^/]+\/[^/]+\/rulesets/, () => json([{ ...internal, id: 1 }])],
  [
    /\/repos\/([^/]+\/[^/]+)\/actions\/workflows\/[^/]+\/runs/,
    (url) => {
      const repo = /\/repos\/([^/]+\/[^/]+)\/actions/.exec(url)?.[1] ?? '';
      return json({ total_count: 1, workflow_runs: [run(repo)] });
    },
  ],
  [
    /\/actions\/runs\/\d+\/jobs/,
    () =>
      json({
        jobs: [
          {
            ...internal,
            name: 'Deploy preview',
            conclusion: 'success',
            completed_at: '2026-11-05T10:05:00Z',
          },
        ],
      }),
  ],
  [/\/attestations\/sha256:/, () => json({ attestations: [{ ...internal, bundle: {} }] })],
  [
    /\/dependency-graph\/sbom/,
    () =>
      json({ sbom: { ...internal, spdxVersion: 'SPDX-2.3', packages: [{ name: 'db.internal' }] } }),
  ],
  [
    /\/repos\/[^/]+\/[^/]+\/contents\//,
    () =>
      json({ ...internal, testedAt: '2026-10-01', result: 'passed', runbook: 'docs/runbook.md' }),
  ],
  [
    /api\.github\.com\/repos\/[^/]+\/[^/]+$/,
    () => json({ ...internal, private: false, default_branch: 'main' }),
  ],
  [/ghcr\.io\/token/, () => json({ token: 'ghcr-anonymous-token' })],
  [/ghcr\.io\/v2\//, () => new Response('{}', { headers: { 'Docker-Content-Digest': DIGEST } })],
  [/securityscorecards/, () => json({ ...internal, score: 7.4, date: '2026-11-01' })],
  [
    /\/api\/status-page\/heartbeat\//,
    () =>
      json({
        heartbeatList: {
          '1': [heartbeat(1, '2026-10-30 10:00:00.000'), heartbeat(1, '2026-11-05 10:00:00.000')],
          '2': [heartbeat(0, '2026-11-05 10:00:00.000')],
          '99': [heartbeat(1, '2026-11-05 10:00:00.000')],
        },
        uptimeList: { '1_24': 1, '2_24': 0.5, '1_720': 0.9, '2_720': 0.7 },
      }),
  ],
  [
    /\/api\/status-page\//,
    () =>
      json({
        config: { title: 'kuma-internal-monitor', ...internal },
        incident: null,
        publicGroupList: [
          {
            name: 'kuma-internal-monitor',
            monitorList: [{ id: 1, name: 'db.internal', ...internal }, { id: 2 }],
          },
        ],
      }),
  ],
  [/version/, () => json({ ...internal, sha: GREEN_SHA, builtAt: '2026-11-05T09:00:00Z' })],
];

function fakeFetch(overrides: [RegExp, Handler][] = []) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const route = [...overrides, ...healthyRoutes].find(([pattern]) => pattern.test(url));
    if (!route) return new Response('not found', { status: 404 });
    return route[1](url, init);
  };
  return { fetch, calls };
}

function collect(fetch: FetchLike, sources: StatusSources = statusSources, timeoutMs = 50) {
  return collectStatus({
    fetch,
    sources,
    token: 'test-github-token',
    timeoutMs,
    now: () => new Date('2026-11-05T12:00:00Z'),
  });
}

const imageSource: ProjectSource = {
  repos: [
    {
      name: 'PhilippKlinger/example-container',
      ciWorkflow: 'ci.yml',
      workflows: [{ name: 'CI', file: 'ci.yml', kind: 'tests' }],
      attestation: { kind: 'image', image: 'philippklinger/example-backend' },
    },
  ],
  versionEndpoints: [],
  uptime: null,
  restoreTest: null,
};
const noSource: ProjectSource = {
  repos: [],
  versionEndpoints: [],
  uptime: null,
  restoreTest: null,
};

// The other projects stay silent, so a call can only come from the project under test.
function onlyProject(source: ProjectSource): StatusSources {
  return {
    linkHosts: statusSources.linkHosts,
    projects: {
      videoflix: noSource,
      portfolio: noSource,
      'vps-plattform': source,
      'neuro-check-in': noSource,
      buildorder: noSource,
    },
  };
}

async function collectOnly(fetch: FetchLike, source = imageSource): Promise<ProjectStatus> {
  const { projects } = await collect(fetch, onlyProject(source));
  return projects['vps-plattform']!;
}

// Never answers on its own: rejects like the native fetch once the signal fires.
const hang: Handler = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  });

const failures: [string, Handler][] = [
  ['timeout', hang],
  [
    'DNS error',
    () => {
      throw new TypeError('fetch failed getaddrinfo ENOTFOUND db.internal 10.0.0.5');
    },
  ],
  ['HTTP 404', () => new Response('db.internal', { status: 404 })],
  ['HTTP 500', () => json(internal, { status: 500 })],
  ['invalid JSON', () => new Response('{"sha": "', { status: 200 })],
  ['HTML fallback with HTTP 200', () => html()],
  ['JSON null', () => json(null)],
  ['JSON of the wrong shape', () => json([1, 'x', null])],
];

function expectNoPositiveSignal(project: ProjectStatus): void {
  for (const station of STATIONS) {
    expect(project[station].reachable).toBe(false);
    expect(project[station].links).toEqual([]);
  }
  expect(project.live.signals.components.every((c) => c.matchesLatestGreen === null)).toBe(true);
  expect(project.live.signals.components.every((c) => c.deployedSha === null)).toBe(true);
  expect(project.checks.signals.workflows.every((w) => w.conclusion === null)).toBe(true);
  expect(project.code.signals.repos.every((r) => r.rulesets === null)).toBe(true);
  expect(project.stability.signals.monitorsUp).toBeNull();
  expect(project.restore.signals.testedAt).toBeNull();
}

describe('collectStatus', () => {
  it('reports every station with its signals when all sources answer', async () => {
    const { fetch } = fakeFetch();
    const status = await collect(fetch);

    expect(status.schemaVersion).toBe(STATUS_SCHEMA_VERSION);
    expect(status.generatedAt).toBe('2026-11-05T12:00:00.000Z');
    expect(Object.keys(status.projects).sort()).toEqual([
      'buildorder',
      'neuro-check-in',
      'portfolio',
      'videoflix',
      'vps-plattform',
    ]);

    const { videoflix, portfolio } = status.projects;
    for (const station of STATIONS) {
      expect(videoflix[station].reachable).toBe(true);
    }
    expect(videoflix.code.signals.repos[0]).toEqual({
      repo: 'PhilippKlinger/videoflix-backend',
      reachable: true,
      isPublic: true,
      defaultBranch: 'main',
      mergedPullRequests: 30,
      rulesets: [
        {
          enforcement: 'active',
          target: 'branch',
          appliesToDefaultBranch: true,
          ruleTypes: ['pull_request', 'non_fast_forward'],
        },
      ],
    });
    expect(videoflix.checks.signals.workflows[0]).toEqual({
      repo: 'PhilippKlinger/videoflix-backend',
      workflow: 'CI',
      file: 'ci.yml',
      kind: 'tests',
      reachable: true,
      conclusion: 'success',
      headSha: GREEN_SHA,
      completedAt: '2026-11-05T10:00:00Z',
    });
    expect(videoflix.supplyChain.signals.repos[0]).toEqual({
      repo: 'PhilippKlinger/videoflix-backend',
      reachable: true,
      attestation: {
        reachable: true,
        subjectDigest: DIGEST,
        provenanceCount: 1,
        sourceSha: GREEN_SHA,
      },
      sbom: { reachable: true, spdxVersion: 'SPDX-2.3', packageCount: 1 },
      scorecard: { reachable: true, score: 7.4, date: '2026-11-01' },
    });
    expect(videoflix.supplyChain.signals.repos).toHaveLength(2);
    expect(videoflix.live.signals.components[0]).toEqual({
      component: 'backend',
      repo: 'PhilippKlinger/videoflix-backend',
      reachable: true,
      deployedSha: GREEN_SHA,
      builtAt: '2026-11-05T09:00:00Z',
      latestGreenSha: GREEN_SHA,
      matchesLatestGreen: true,
    });
    expect(videoflix.stability.signals).toEqual({
      monitorsTotal: 2,
      monitorsUp: 1,
      uptime24h: 0.75,
      uptime30d: 0.8,
      lastHeartbeatAt: '2026-11-05T10:00:00.000Z',
      oldestVisibleHeartbeatAt: '2026-10-30T10:00:00.000Z',
    });
    expect(videoflix.restore.signals).toEqual({ testedAt: '2026-10-01', result: 'passed' });
    expect(videoflix.restore.links).toContainEqual({
      kind: 'runbook',
      source: 'PhilippKlinger/videoflix-deploy',
      url: 'https://github.com/PhilippKlinger/videoflix-deploy/blob/main/docs/runbook.md',
    });
    expect(videoflix.checks.links).toContainEqual({
      kind: 'workflow-run',
      source: 'PhilippKlinger/videoflix-backend',
      url: 'https://github.com/PhilippKlinger/videoflix-backend/actions/runs/123',
      workflow: 'CI',
    });

    expect(portfolio.live.reachable).toBe(true);
    expect(portfolio.restore.reachable).toBe(false);
  });

  it('hashes the live file to look up the attestation of a static site', async () => {
    const { fetch, calls } = fakeFetch([
      [/preview\.philipp-klinger\.com\/version\.json/, () => new Response('abc')],
    ]);
    await collect(fetch);
    // SHA-256 of "abc".
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(calls.map((c) => c.url)).toContainEqual(
      expect.stringContaining(
        `/repos/PhilippKlinger/philippklinger.com/attestations/sha256:${expected}`,
      ),
    );
  });

  it('asks only for provenance attestations of the image built from the green commit', async () => {
    const { fetch, calls } = fakeFetch();
    await collect(fetch);
    const urls = calls.map((c) => c.url);
    expect(urls).toContain(
      `https://ghcr.io/v2/philippklinger/videoflix-backend/manifests/${GREEN_SHA}`,
    );
    expect(urls).toContain(
      `https://api.github.com/repos/PhilippKlinger/videoflix-backend/attestations/${DIGEST}?predicate_type=provenance&per_page=30`,
    );
  });

  it('sends the GitHub token to the GitHub API only', async () => {
    const { fetch, calls } = fakeFetch();
    await collect(fetch);
    const withToken = calls.filter((c) => JSON.stringify(c.headers).includes('test-github-token'));
    expect(withToken.length).toBeGreaterThan(0);
    expect(withToken.every((c) => new URL(c.url).hostname === 'api.github.com')).toBe(true);
  });

  describe('no internal values in the output', () => {
    it('keeps internal values of every response out of the file', async () => {
      const { fetch } = fakeFetch();
      const output = JSON.stringify(await collect(fetch));
      for (const value of INTERNAL_VALUES) {
        expect(output).not.toContain(value);
      }
      expect(output).not.toContain('test-github-token');
      expect(output).not.toContain('ghcr-anonymous-token');
      expect(output).not.toContain('ECONNREFUSED');
    });

    it('does not leak internal values through fields it normally copies', async () => {
      const { fetch } = fakeFetch([
        [/version/, () => json({ sha: GREEN_SHA, builtAt: 'db.internal' })],
        [/securityscorecards/, () => json({ score: 7, date: '10.0.0.5' })],
        [/sbom/, () => json({ sbom: { spdxVersion: 'db.internal', packages: [] } })],
        [
          /\/contents\//,
          () =>
            json({
              testedAt: '2026-10-01',
              result: 'db.internal',
              runbook: '../../db.internal:22',
            }),
        ],
        [
          /api\.github\.com\/repos\/[^/]+\/[^/]+$/,
          () => json({ private: false, default_branch: 'postgres:5432' }),
        ],
      ]);
      const output = JSON.stringify(await collect(fetch));
      for (const value of INTERNAL_VALUES) {
        expect(output).not.toContain(value);
      }
    });

    it('does not leak error details of failing sources', async () => {
      const { fetch } = fakeFetch([[/./, failures[1][1]]]);
      const output = JSON.stringify(await collect(fetch));
      expect(output).not.toContain('ENOTFOUND');
      expect(output).not.toContain('db.internal');
    });
  });

  describe('unreachable sources', () => {
    it.each(failures)(
      'reports "%s" as not reachable instead of aborting',
      async (_name, handler) => {
        const { fetch } = fakeFetch([[/./, handler]]);
        const status = await collect(fetch);
        expectNoPositiveSignal(status.projects.videoflix);
        expectNoPositiveSignal(status.projects.portfolio);
        expect(validateStatus(status, statusSources)).toEqual([]);
      },
    );

    it('keeps the other sources of a station when one fails', async () => {
      const { fetch } = fakeFetch([
        [/videoflix-frontend\/dependency-graph/, () => json({}, { status: 503 })],
      ]);
      const { supplyChain } = (await collect(fetch)).projects.videoflix;
      expect(supplyChain.reachable).toBe(false);
      expect(supplyChain.signals.repos[0].reachable).toBe(true);
      expect(supplyChain.signals.repos[1].reachable).toBe(false);
      expect(supplyChain.signals.repos[1].sbom).toEqual({
        reachable: false,
        spdxVersion: null,
        packageCount: null,
      });
      expect(supplyChain.signals.repos[1].scorecard.reachable).toBe(true);
    });

    it('reports a missing restore test as not reachable, never invented', async () => {
      const { fetch } = fakeFetch([
        [/\/contents\//, () => json({ message: 'Not Found' }, { status: 404 })],
      ]);
      const { restore } = (await collect(fetch)).projects.videoflix;
      expect(restore).toEqual({
        reachable: false,
        signals: { testedAt: null, result: null },
        links: [],
      });
    });

    it('reports a restore file without a valid date as not reachable', async () => {
      const { fetch } = fakeFetch([
        [/\/contents\//, () => json({ testedAt: 'gestern', result: 'passed' })],
      ]);
      expect((await collect(fetch)).projects.videoflix.restore.reachable).toBe(false);
    });

    it('reports a project without restore source as not reachable', async () => {
      const { fetch } = fakeFetch();
      const { restore } = (await collect(fetch)).projects.portfolio;
      expect(restore).toEqual({
        reachable: false,
        signals: { testedAt: null, result: null },
        links: [],
      });
    });

    it('reports a status page without monitors as not reachable', async () => {
      const { fetch } = fakeFetch([
        [/\/api\/status-page\/heartbeat\//, () => json({ heartbeatList: {}, uptimeList: {} })],
      ]);
      const { stability } = (await collect(fetch)).projects.videoflix;
      expect(stability.reachable).toBe(false);
      expect(stability.signals.monitorsUp).toBeNull();
    });

    it('tells the caller what went wrong, without response content', async () => {
      const problems: string[] = [];
      const { fetch } = fakeFetch([
        [/securityscorecards/, () => new Response('db.internal', { status: 404 })],
      ]);
      await collectStatus({
        fetch,
        sources: statusSources,
        now: () => new Date(),
        onProblem: (source, reason) => problems.push(`${source} ${reason}`),
      });
      expect(problems).toContainEqual(expect.stringContaining('HTTP 404'));
      expect(problems.join()).not.toContain('db.internal');
    });
  });

  describe('HTML fallback is not a success', () => {
    it('does not count a version endpoint answering 200 with the SPA shell', async () => {
      const { fetch } = fakeFetch([
        [/videoflix\.philipp-klinger\.com\/version\.json/, () => html()],
      ]);
      const { live } = (await collect(fetch)).projects.videoflix;

      const frontend = live.signals.components.find((c) => c.component === 'frontend');
      expect(frontend).toEqual({
        component: 'frontend',
        repo: 'PhilippKlinger/videoflix-frontend',
        reachable: false,
        deployedSha: null,
        builtAt: null,
        latestGreenSha: GREEN_SHA,
        matchesLatestGreen: null,
      });
      expect(live.reachable).toBe(false);
      expect(live.links.map((l) => l.source)).not.toContain('frontend');
      // The backend endpoint answered properly and stays visible.
      expect(live.signals.components.find((c) => c.component === 'backend')?.reachable).toBe(true);
    });

    it.each([
      ['no SHA', { builtAt: '2026-11-05T09:00:00Z' }],
      ['too short', { sha: 'abc123' }],
      ['too long', { sha: 'a'.repeat(41) }],
      ['upper case', { sha: 'ABCDEF1' }],
      ['not hex', { sha: 'latest' }],
      ['not a string', { sha: 1234567 }],
      ['with trailing newline', { sha: 'abcdef1\n' }],
    ])('rejects a version document with %s', (_name, document) => {
      expect(parseVersionDocument(document)).toBeNull();
    });

    it('accepts short and full SHAs and drops everything else', () => {
      expect(parseVersionDocument({ sha: 'abcdef1' })).toEqual({ sha: 'abcdef1', builtAt: null });
      expect(
        parseVersionDocument({
          sha: GREEN_SHA,
          builtAt: '2026-11-05T09:00:00Z',
          host: 'db.internal',
        }),
      ).toEqual({ sha: GREEN_SHA, builtAt: '2026-11-05T09:00:00Z' });
    });
  });

  describe('real state is shown, positive only with proof', () => {
    it('reports a live SHA behind the latest green commit as no match', async () => {
      const { fetch } = fakeFetch([[/version/, () => json({ sha: OLD_SHA })]]);
      const { live } = (await collect(fetch)).projects.videoflix;
      expect(live.reachable).toBe(true);
      expect(live.signals.components[0].matchesLatestGreen).toBe(false);
    });

    it('matches a short deployed SHA by prefix', async () => {
      const { fetch } = fakeFetch([[/version/, () => json({ sha: GREEN_SHA.slice(0, 7) })]]);
      const { live } = (await collect(fetch)).projects.videoflix;
      expect(live.signals.components[0].matchesLatestGreen).toBe(true);
    });

    it('does not claim a match without a green commit to compare with', async () => {
      const { fetch } = fakeFetch([[/status=success/, () => json({ workflow_runs: [] })]]);
      const { live } = (await collect(fetch)).projects.videoflix;
      expect(live.signals.components[0].latestGreenSha).toBeNull();
      expect(live.signals.components[0].matchesLatestGreen).toBeNull();
    });

    it('shows a red run as red', async () => {
      const { fetch } = fakeFetch([
        [
          /videoflix-backend.actions.*status=completed/,
          () =>
            json({
              workflow_runs: [
                run('PhilippKlinger/videoflix-backend', {
                  conclusion: 'failure',
                  head_sha: OLD_SHA,
                }),
              ],
            }),
        ],
      ]);
      const { checks } = (await collect(fetch)).projects.videoflix;
      expect(checks.reachable).toBe(true);
      expect(checks.signals.workflows[0].conclusion).toBe('failure');
      expect(checks.signals.workflows[0].headSha).toBe(OLD_SHA);
    });

    describe('runs without a verdict', () => {
      const backendRuns = (conclusions: string[]) =>
        fakeFetch([
          [
            /videoflix-backend.actions.*status=completed/,
            () =>
              json({
                workflow_runs: conclusions.map((conclusion, index) =>
                  run('PhilippKlinger/videoflix-backend', {
                    conclusion,
                    id: 200 + index,
                    updated_at: `2026-11-0${5 - index}T10:00:00Z`,
                  }),
                ),
              }),
          ],
        ]).fetch;

      it.each([
        [['cancelled', 'success'], 'success'],
        [['cancelled', 'failure'], 'failure'],
        [['skipped', 'timed_out'], 'timed_out'],
        [['neutral', 'startup_failure'], 'startup_failure'],
        [['stale', 'action_required', 'failure'], 'failure'],
      ])('reads %j as %s', async (conclusions, expected) => {
        const { checks } = (await collect(backendRuns(conclusions))).projects.videoflix;
        expect(checks.signals.workflows[0].conclusion).toBe(expected);
      });

      it('takes link and time from the chosen run', async () => {
        const { checks } = (await collect(backendRuns(['cancelled', 'success']))).projects
          .videoflix;
        expect(checks.signals.workflows[0].completedAt).toBe('2026-11-04T10:00:00Z');
        expect(checks.links.find((link) => link.kind === 'workflow-run')?.url).toBe(
          'https://github.com/PhilippKlinger/videoflix-backend/actions/runs/201',
        );
      });

      it('reports no run when none of them has a verdict', async () => {
        const { checks } = (await collect(backendRuns(['cancelled', 'cancelled']))).projects
          .videoflix;
        expect(checks.signals.workflows[0].reachable).toBe(false);
        expect(checks.signals.workflows[0].conclusion).toBeNull();
        expect(checks.signals.workflows[0].completedAt).toBeNull();
      });

      it('does not skip anything when looking for the latest green run', async () => {
        const { fetch } = fakeFetch([
          [
            /videoflix-backend.actions.*status=success/,
            () =>
              json({
                workflow_runs: [
                  run('PhilippKlinger/videoflix-backend', { conclusion: 'cancelled' }),
                  run('PhilippKlinger/videoflix-backend', { head_sha: OLD_SHA }),
                ],
              }),
          ],
        ]);
        const { live } = (await collect(fetch)).projects.videoflix;
        expect(live.signals.components[0].latestGreenSha).toBeNull();
      });
    });

    it('ignores runs of pull requests from a fork branch named main', async () => {
      const { fetch } = fakeFetch([
        [
          /videoflix-backend\/actions\/workflows\/ci\.yml\/runs/,
          () =>
            json({
              workflow_runs: [
                run('someone/videoflix-backend', { event: 'pull_request', head_sha: OLD_SHA }),
                run('someone/videoflix-backend', { event: 'push', head_sha: OLD_SHA }),
                run('PhilippKlinger/videoflix-backend'),
              ],
            }),
        ],
      ]);
      const { checks } = (await collect(fetch)).projects.videoflix;
      expect(checks.signals.workflows[0].headSha).toBe(GREEN_SHA);
    });

    it('does not accept an unknown conclusion or a malformed SHA', async () => {
      const { fetch } = fakeFetch([
        [
          /videoflix-backend\/actions\/workflows\/ci\.yml\/runs/,
          () =>
            json({
              workflow_runs: [
                run('PhilippKlinger/videoflix-backend', { conclusion: 'probably fine' }),
              ],
            }),
        ],
        [
          /videoflix-frontend\/actions\/workflows\/ci\.yml\/runs/,
          () =>
            json({
              workflow_runs: [run('PhilippKlinger/videoflix-frontend', { head_sha: 'main' })],
            }),
        ],
      ]);
      const { workflows } = (await collect(fetch)).projects.videoflix.checks.signals;
      expect(workflows[0].reachable).toBe(false);
      expect(workflows[0].conclusion).toBeNull();
      const frontendCi = workflows.find(
        (w) => w.repo === 'PhilippKlinger/videoflix-frontend' && w.file === 'ci.yml',
      );
      expect(frontendCi?.reachable).toBe(false);
    });

    it('does not treat a disabled ruleset as active', async () => {
      const { fetch } = fakeFetch([
        [
          /\/rulesets\/\d+$/,
          () =>
            json({
              target: 'branch',
              enforcement: 'disabled',
              conditions: { ref_name: { include: ['refs/heads/dev'] } },
              rules: [],
            }),
        ],
      ]);
      const { repos } = (await collect(fetch)).projects.videoflix.code.signals;
      expect(repos[0].rulesets).toEqual([
        { enforcement: 'disabled', target: 'branch', appliesToDefaultBranch: false, ruleTypes: [] },
      ]);
    });

    it('does not report a score outside of the scale', async () => {
      const { fetch } = fakeFetch([
        [/securityscorecards/, () => json({ score: 11, date: '2026-11-01' })],
      ]);
      const { repos } = (await collect(fetch)).projects.videoflix.supplyChain.signals;
      expect(repos[0].scorecard).toEqual({ reachable: false, score: null, date: null });
    });

    it('does not ask for attestations without an image for the green commit', async () => {
      const { fetch, calls } = fakeFetch([
        [/ghcr\.io\/v2\//, () => new Response('', { status: 404 })],
      ]);
      const { repos } = (await collect(fetch)).projects.videoflix.supplyChain.signals;
      expect(repos[0].attestation).toEqual({
        reachable: false,
        subjectDigest: null,
        provenanceCount: null,
        sourceSha: null,
      });
      expect(calls.some((c) => c.url.includes('videoflix-backend/attestations'))).toBe(false);
    });

    it('reports an answer without attestations as zero, not as provenance', async () => {
      const { fetch } = fakeFetch([[/attestations.sha256:/, () => json({ attestations: [] })]]);
      const { repos } = (await collect(fetch)).projects.videoflix.supplyChain.signals;
      expect(repos[0].attestation).toEqual({
        reachable: true,
        subjectDigest: DIGEST,
        provenanceCount: 0,
        sourceSha: GREEN_SHA,
      });
    });

    it('reports no attestation found as not reachable', async () => {
      const { fetch } = fakeFetch([
        [/\/attestations\/sha256:/, () => json({ message: 'Not Found' }, { status: 404 })],
      ]);
      const { repos } = (await collect(fetch)).projects.videoflix.supplyChain.signals;
      expect(repos[0].attestation?.reachable).toBe(false);
      expect(repos[0].attestation?.provenanceCount).toBeNull();
    });
  });
});

describe('collectStatus for a built image and the deploy run', () => {
  const attestationNotFound: [RegExp, Handler] = [
    /\/attestations\/sha256:/,
    () => json({ message: 'Not Found' }, { status: 404 }),
  ];
  const noImage: [RegExp, Handler] = [/ghcr\.io\/v2\//, () => new Response('', { status: 404 })];
  const ghcrLink = {
    kind: 'image',
    source: 'PhilippKlinger/example-container',
    url: 'https://github.com/users/PhilippKlinger/packages/container/package/example-backend',
  };

  it('collects every project of the sources, not a fixed list', async () => {
    const sources = onlyProject(imageSource);
    const withLater = { ...sources, projects: { ...sources.projects, later: noSource } };
    const { projects } = await collect(fakeFetch().fetch, withLater);
    expect(Object.keys(projects).sort()).toEqual([
      'buildorder',
      'later',
      'neuro-check-in',
      'portfolio',
      'videoflix',
      'vps-plattform',
    ]);
  });

  it('treats a project without uptime source as not reachable, without a request', async () => {
    const { fetch, calls } = fakeFetch();
    const { stability } = await collectOnly(fetch);
    expect(stability).toEqual({
      reachable: false,
      signals: {
        monitorsTotal: null,
        monitorsUp: null,
        uptime24h: null,
        uptime30d: null,
        lastHeartbeatAt: null,
        oldestVisibleHeartbeatAt: null,
      },
      links: [],
    });
    expect(calls.some((call) => call.url.includes('status-page'))).toBe(false);
  });

  it('leaves repositories without attestation source out of the supply chain', async () => {
    const withoutAttestation = { name: 'PhilippKlinger/compose-only', workflows: [] };
    const source = { ...imageSource, repos: [...imageSource.repos, withoutAttestation] };
    const { supplyChain, code } = await collectOnly(fakeFetch().fetch, source);
    expect(supplyChain.signals.repos.map(({ repo }) => repo)).toEqual([
      'PhilippKlinger/example-container',
    ]);
    expect(supplyChain.reachable).toBe(true);
    expect(code.signals.repos).toHaveLength(2);
  });

  it('keeps the digest of an image whose attestation is missing', async () => {
    const { fetch } = fakeFetch([attestationNotFound]);
    const { supplyChain } = await collectOnly(fetch);
    expect(supplyChain.signals.repos[0].attestation).toMatchObject({
      reachable: false,
      subjectDigest: DIGEST,
      provenanceCount: null,
    });
  });

  it('links the GHCR package once the digest is known', async () => {
    const { supplyChain } = await collectOnly(fakeFetch([attestationNotFound]).fetch);
    expect(supplyChain.links).toContainEqual(ghcrLink);
    expect(supplyChain.links.map(({ kind }) => kind)).not.toContain('attestations');
  });

  it('does not link the GHCR package without a digest', async () => {
    const { supplyChain } = await collectOnly(fakeFetch([noImage]).fetch);
    expect(supplyChain.links.map(({ kind }) => kind)).not.toContain('image');
  });

  it('does not link a GHCR package for an attested file', async () => {
    const { projects } = await collect(fakeFetch().fetch);
    expect(projects.portfolio.supplyChain.links.map(({ kind }) => kind)).not.toContain('image');
  });

  // The writer checks every key, so without this the first run after the merge would fail.
  it('accepts vps-plattform in the closed vocabulary of the document', async () => {
    const sources = onlyProject(imageSource);
    const status = await collect(fakeFetch().fetch, sources);
    expect(status.projects['vps-plattform']?.supplyChain.signals.repos).toHaveLength(1);
    expect(validateStatus(status, sources)).toEqual([]);
  });

  it('collects neuro-check-in from Kuma only', async () => {
    const source: ProjectSource = {
      repos: [],
      versionEndpoints: [],
      uptime: { baseUrl: 'https://status.philipp-klinger.com', slug: 'neuro-check-in' },
      restoreTest: null,
    };
    const sources = onlyProject(noSource);
    sources.projects['neuro-check-in'] = source;
    const status = await collect(fakeFetch().fetch, sources);
    expect(status.projects['neuro-check-in']?.stability.reachable).toBe(true);
    expect(validateStatus(status, sources)).toEqual([]);
  });

  it('marks deploy workflows with their own kind', async () => {
    const { checks } = (await collect(fakeFetch().fetch)).projects.videoflix;
    const deploy = checks.signals.workflows.find((w) => w.repo.endsWith('/videoflix-deploy'));
    expect(deploy).toMatchObject({ workflow: 'Deploy', file: 'deploy.yml', kind: 'deploy' });
  });

  describe('records the commit an image was built from', () => {
    // The latest run is red on another commit: only the green one built the image.
    const redLatestRun: [RegExp, Handler] = [
      /status=completed/,
      () =>
        json({
          workflow_runs: [
            run('PhilippKlinger/example-container', { conclusion: 'failure', head_sha: OLD_SHA }),
          ],
        }),
    ];

    it('takes the green commit, not the head of the latest run', async () => {
      const { supplyChain } = await collectOnly(fakeFetch([redLatestRun]).fetch);
      expect(supplyChain.signals.repos[0].attestation?.sourceSha).toBe(GREEN_SHA);
    });

    it('keeps it when the attestation is missing', async () => {
      const { supplyChain } = await collectOnly(fakeFetch([attestationNotFound]).fetch);
      expect(supplyChain.signals.repos[0].attestation?.sourceSha).toBe(GREEN_SHA);
    });

    it('stays away from an attested file', async () => {
      const { projects } = await collect(fakeFetch().fetch);
      const { attestation } = projects.portfolio.supplyChain.signals.repos[0];
      expect(attestation?.reachable).toBe(true);
      expect(attestation).not.toHaveProperty('sourceSha');
    });
  });

  it('names the workflow on a workflow run link', async () => {
    const { checks } = (await collect(fakeFetch().fetch)).projects.videoflix;
    const runsOf = (repo: string) =>
      checks.links.filter((link) => link.source === repo).map((link) => link.workflow);
    expect(runsOf('PhilippKlinger/videoflix-backend')).toEqual(['CI', 'CodeQL', 'Security Checks']);
    expect(runsOf('PhilippKlinger/videoflix-deploy')).toEqual(['Deploy']);
  });
});

describe('collectStatus for a single job of a workflow', () => {
  const repo = 'PhilippKlinger/site';
  const JOB_FINISHED = '2026-11-05T11:00:00Z';
  const source: ProjectSource = {
    ...noSource,
    repos: [
      {
        name: repo,
        workflows: [{ name: 'Preview', file: 'deploy.yml', kind: 'deploy', job: 'Deploy preview' }],
      },
    ],
  };
  const finished = (conclusion: string) => ({
    name: 'Deploy preview',
    status: 'completed',
    conclusion,
    completed_at: JOB_FINISHED,
  });
  const waitingProduction = { name: 'Deploy production', status: 'waiting', conclusion: null };

  function jobsByRun(jobs: Record<number, unknown[]>): [RegExp, Handler][] {
    return [
      [
        /\/actions\/workflows\/deploy\.yml\/runs/,
        () =>
          json({
            workflow_runs: Object.keys(jobs)
              .map(Number)
              .sort((a, b) => b - a)
              .map((id) => run(repo, { id, status: 'waiting', conclusion: null })),
          }),
      ],
      [
        /\/actions\/runs\/(\d+)\/jobs/,
        (url) => json({ jobs: jobs[Number(/runs\/(\d+)\/jobs/.exec(url)?.[1])] }),
      ],
    ];
  }
  const signalOf = async (routes: [RegExp, Handler][]) =>
    (await collectOnly(fakeFetch(routes).fetch, source)).checks;

  it('reads the job while the run still waits for the approval of another job', async () => {
    const checks = await signalOf(jobsByRun({ 7: [finished('success'), waitingProduction] }));
    expect(checks.signals.workflows[0]).toEqual({
      repo,
      workflow: 'Preview',
      file: 'deploy.yml',
      kind: 'deploy',
      reachable: true,
      conclusion: 'success',
      headSha: GREEN_SHA,
      completedAt: JOB_FINISHED,
    });
    expect(checks.links).toContainEqual({
      kind: 'workflow-run',
      source: repo,
      url: `https://github.com/${repo}/actions/runs/7`,
      workflow: 'Preview',
    });
  });

  it('reports a failed job', async () => {
    const checks = await signalOf(jobsByRun({ 7: [finished('failure')] }));
    expect(checks.signals.workflows[0].conclusion).toBe('failure');
  });

  it('falls back to the last run whose job has a verdict', async () => {
    const running = { name: 'Deploy preview', status: 'in_progress', conclusion: null };
    const checks = await signalOf(jobsByRun({ 8: [running], 7: [finished('success')] }));
    expect(checks.links[0].url).toBe(`https://github.com/${repo}/actions/runs/7`);
    expect(checks.signals.workflows[0].conclusion).toBe('success');
  });

  it('reports the preview job of this website', async () => {
    const { portfolio } = (await collect(fakeFetch().fetch)).projects;
    const preview = portfolio.checks.signals.workflows.find((w) => w.kind === 'deploy');
    expect(preview).toMatchObject({ workflow: 'Deploy preview', conclusion: 'success' });
  });

  it('does not fall back to an older run when the jobs of the newest cannot be read', async () => {
    const unreadable: [RegExp, Handler] = [
      /\/actions\/runs\/8\/jobs/,
      () => json({}, { status: 500 }),
    ];
    const newestUnreadable: Record<number, unknown[]> = { 8: [], 7: [finished('success')] };
    const checks = await signalOf([unreadable, ...jobsByRun(newestUnreadable)]);
    expect(checks.signals.workflows[0]).toMatchObject({ reachable: false, conclusion: null });
    expect(checks.links).toEqual([]);
  });

  it('is not reachable when no run has that job', async () => {
    const checks = await signalOf(jobsByRun({ 7: [waitingProduction] }));
    expect(checks.signals.workflows[0]).toMatchObject({ reachable: false, conclusion: null });
    expect(checks.links).toEqual([]);
  });
});

describe('validateStatus', () => {
  async function validStatus(): Promise<StatusDocument> {
    return collect(fakeFetch().fetch);
  }

  it('accepts a collected document', async () => {
    expect(validateStatus(await validStatus(), statusSources)).toEqual([]);
  });

  it.each([
    ['null', null],
    ['an empty object', {}],
    ['a wrong version', { schemaVersion: 99, generatedAt: '2026-11-05T12:00:00Z', projects: {} }],
    ['a missing date', { schemaVersion: 1, generatedAt: 'gestern', projects: {} }],
  ])('rejects %s', (_name, document) => {
    expect(validateStatus(document, statusSources)).not.toEqual([]);
  });

  it('rejects a missing project or station', async () => {
    const withoutProject = await validStatus();
    delete (withoutProject.projects as Partial<StatusDocument['projects']>).portfolio;
    expect(validateStatus(withoutProject, statusSources)).not.toEqual([]);

    const withoutStation = await validStatus();
    delete (withoutStation.projects.videoflix as Partial<ProjectStatus>).live;
    expect(validateStatus(withoutStation, statusSources)).not.toEqual([]);
  });

  it('rejects a station without a boolean reachable', async () => {
    const status = await validStatus();
    (status.projects.videoflix.code as { reachable: unknown }).reachable = 'yes';
    expect(validateStatus(status, statusSources)).not.toEqual([]);
  });

  it.each([
    ['an internal IP', '10.0.0.5'],
    ['an IP inside a URL', 'https://10.0.0.5/'],
    ['a foreign host', 'https://db.internal/run'],
    ['a public URL with a port', 'https://github.com:8443/x'],
    ['a plain HTTP link', 'http://github.com/x'],
    ['a host and port', 'postgres:5432'],
    ['a GitHub token', 'ghs_abcdefghijklmnopqrstuvwxyz'],
  ])('rejects %s anywhere in the document', async (_name, value) => {
    const status = await validStatus();
    status.projects.portfolio.code.links.push({
      kind: 'repository',
      source: 'x',
      url: value,
    });
    expect(validateStatus(status, statusSources)).not.toEqual([]);
  });

  it('rejects a field that is not part of the schema', async () => {
    const status = await validStatus();
    (status.projects.videoflix.code.signals as unknown as Record<string, unknown>)['hostname'] =
      'x';
    expect(validateStatus(status, statusSources)).not.toEqual([]);
  });
});

describe('statusSources', () => {
  const platformChecks = [
    { name: 'CI', file: 'ci.yml', kind: 'tests' },
    { name: 'CodeQL', file: 'codeql.yml', kind: 'scan' },
    { name: 'Security Checks', file: 'security.yml', kind: 'scan' },
  ];

  it('measures Videoflix, the site and the VPS platform, no longer Conduit', () => {
    expect(Object.keys(statusSources.projects)).toEqual([
      'videoflix',
      'portfolio',
      'vps-plattform',
      'neuro-check-in',
      'buildorder',
    ]);
  });

  // The plugin builds no image and runs nowhere: its repository, CI and Scorecard are the proof.
  it('measures Buildorder in its repository, with CI and Scorecard', () => {
    expect(statusSources.projects.buildorder).toEqual({
      repos: [
        {
          name: 'PhilippKlinger/buildorder',
          ciWorkflow: 'ci.yml',
          workflows: [
            { name: 'CI', file: 'ci.yml', kind: 'tests' },
            { name: 'Scorecard', file: 'scorecard.yml', kind: 'scan' },
          ],
        },
      ],
      versionEndpoints: [],
      uptime: null,
      restoreTest: null,
    });
  });

  // Plan VPS platform E3 to E5: videoflix-deploy already counts for Videoflix, nothing is built.
  // Its own status page holds only the monitor "Statusseite" until the go-live (q11).
  it('measures the VPS platform in both of its repositories and on its status page', () => {
    expect(statusSources.projects['vps-plattform']).toEqual({
      repos: [
        { name: 'PhilippKlinger/vps-edge', ciWorkflow: 'ci.yml', workflows: platformChecks },
        { name: 'PhilippKlinger/vps-monitoring', ciWorkflow: 'ci.yml', workflows: platformChecks },
      ],
      versionEndpoints: [],
      uptime: { baseUrl: 'https://status.philipp-klinger.com', slug: 'vps-plattform' },
      restoreTest: null,
    });
  });

  it('writes a valid document for every project of the real sources', async () => {
    const status = await collect(fakeFetch().fetch);
    expect(status.projects['vps-plattform']?.code.signals.repos).toHaveLength(2);
    expect(status.projects['vps-plattform']?.supplyChain).toEqual({
      reachable: false,
      signals: { repos: [] },
      links: [],
    });
    expect(validateStatus(status, statusSources)).toEqual([]);
  });
});
