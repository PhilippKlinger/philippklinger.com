import { buildChainView, ChainStation, ChainView } from './delivery-chain';
import { deliveryPlans } from './delivery-plans';
import { DeliveryPlan, FixedStep, isMeasured } from './software-delivery';
import { ProjectStatus, StatusLink, WorkflowSignal } from './status';
import { healthyStatus } from './status.fixture';

const generatedAt = '2026-11-06T00:58:11.069Z';
const github = 'https://github.com/PhilippKlinger';
const backend = 'PhilippKlinger/videoflix-backend';
const frontend = 'PhilippKlinger/videoflix-frontend';
const deploy = 'PhilippKlinger/videoflix-deploy';
const backendSha = 'f4f1b93a1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f';
const frontendSha = '93480881c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7';
const deploySha = 'ced34071c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7';
const backendDigest = 'sha256:346d0a94572ee913c68f3a6b528aeb79d39175beb265489ac390fdcfa72c09de';
const frontendDigest = 'sha256:daf86651c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9';
const backendCiRun = `${github}/videoflix-backend/actions/runs/42482308198`;
const packages = 'https://github.com/users/PhilippKlinger/packages/container/package';

const plan = deliveryPlans['videoflix'];

function withCode(status: ProjectStatus): void {
  const [template] = status.code.signals.repos;
  const merged: [string, number][] = [
    [backend, 42],
    [frontend, 46],
    [deploy, 33],
  ];
  status.code.signals.repos = merged.map(([repo, count]) => ({
    ...template,
    repo,
    mergedPullRequests: count,
  }));
  status.code.links = merged.flatMap(([repo]): StatusLink[] => [
    { kind: 'repository', source: repo, url: `https://github.com/${repo}` },
    {
      kind: 'pull-requests',
      source: repo,
      url: `https://github.com/${repo}/pulls?q=is%3Apr+is%3Amerged`,
    },
  ]);
}

function run(repo: string, workflow: string, sha: string, kind: WorkflowSignal['kind']) {
  const signal: WorkflowSignal = {
    repo,
    workflow,
    file: `${workflow.toLowerCase()}.yml`,
    kind,
    reachable: true,
    conclusion: 'success',
    headSha: sha,
    completedAt: '2026-11-08T12:55:00Z',
  };
  const url = `https://github.com/${repo}/actions/runs/${workflow.toLowerCase()}`;
  const link: StatusLink = { kind: 'workflow-run', source: repo, url, workflow };
  return { signal, link };
}

function withChecks(status: ProjectStatus): void {
  const runs = [
    run(backend, 'CI', backendSha, 'tests'),
    run(backend, 'CodeQL', backendSha, 'scan'),
    run(frontend, 'CI', frontendSha, 'tests'),
    run(frontend, 'CodeQL', frontendSha, 'scan'),
    run(deploy, 'Deploy', deploySha, 'deploy'),
  ];
  runs[0].link.url = backendCiRun;
  status.checks.signals.workflows = runs.map((entry) => entry.signal);
  status.checks.links = runs.map((entry) => entry.link);
}

function image(repo: string, digest: string, sha: string) {
  const [template] = healthyStatus().supplyChain.signals.repos;
  const name = repo.split('/')[1];
  const links: StatusLink[] = [
    { kind: 'attestations', source: repo, url: `https://github.com/${repo}/attestations` },
    { kind: 'image', source: repo, url: `${packages}/${name}` },
    {
      kind: 'scorecard',
      source: repo,
      url: `https://scorecard.dev/viewer/?uri=github.com/${repo}`,
    },
  ];
  const attestation = {
    reachable: true,
    subjectDigest: digest,
    provenanceCount: 1,
    sourceSha: sha,
  };
  return { signal: { ...template, repo, attestation }, links };
}

function withSupplyChain(status: ProjectStatus): void {
  const images = [
    image(backend, backendDigest, backendSha),
    image(frontend, frontendDigest, frontendSha),
  ];
  status.supplyChain.signals.repos = images.map((entry) => entry.signal);
  status.supplyChain.links = images.flatMap((entry) => entry.links);
}

function withLive(status: ProjectStatus): void {
  const [template] = status.live.signals.components;
  status.live.signals.components = [
    { ...template, component: 'backend', repo: backend, deployedSha: backendSha },
    { ...template, component: 'frontend', repo: frontend, deployedSha: frontendSha },
  ].map((part) => ({ ...part, latestGreenSha: part.deployedSha }));
  status.live.links = [
    { kind: 'version-endpoint', source: 'backend', url: 'https://videoflix.example/api/version' },
    { kind: 'version-endpoint', source: 'frontend', url: 'https://videoflix.example/version.json' },
  ];
}

function withOperation(status: ProjectStatus): void {
  status.stability.links = [
    { kind: 'status-page', source: 'videoflix', url: 'https://status.example/status/videoflix' },
  ];
  status.restore.links = [
    { kind: 'restore-test', source: deploy, url: `${github}/videoflix-deploy/blob/main/r.json` },
    { kind: 'runbook', source: deploy, url: `${github}/videoflix-deploy/blob/main/RUNBOOK.md` },
  ];
}

/** Videoflix as the collector writes it: three repos, two images, every station with links. */
function videoflixStatus(change: (status: ProjectStatus) => void = () => undefined) {
  const status = healthyStatus();
  [withCode, withChecks, withSupplyChain, withLive, withOperation, change].forEach((step) =>
    step(status),
  );
  return status;
}

function backendImageLink(status: ProjectStatus): StatusLink {
  const found = status.supplyChain.links.find(
    (link) => link.kind === 'image' && link.source === backend,
  );
  if (!found) throw new Error('no image link');
  return found;
}

function chainOf(status: ProjectStatus, chainPlan: DeliveryPlan = plan): ChainView {
  return buildChainView(chainPlan, { generatedAt, status });
}

function station(status: ProjectStatus, name: string): ChainStation {
  const found = chainOf(status).stations.find((entry) => entry.name === name);
  if (!found) throw new Error(`no station ${name}`);
  return found;
}

describe('buildChainView', () => {
  it('sums merged pull requests over all repos', () => {
    const code = station(videoflixStatus(), 'Code');

    expect(code.value).toBe('121 merged PRs');
    expect(code.table?.head).toEqual(['Repo', 'Merged PRs', '']);
    expect(code.table?.rows[0]).toEqual([
      { text: 'Backend' },
      { text: '42' },
      { text: 'PRs', url: `${github}/videoflix-backend/pulls?q=is%3Apr+is%3Amerged` },
    ]);
  });

  it('dates the chain and counts the repos of the code station', () => {
    const chain = chainOf(videoflixStatus());

    expect(chain.stand).toBe('Stand 06.11., 01:58');
    expect(chain.repoCount).toBe(3);
  });

  it('shows one short value per station', () => {
    const values = chainOf(videoflixStatus()).stations.map((entry) => entry.value);

    expect(values).toEqual([
      '121 merged PRs',
      '4 von 4 passing',
      '2 Images attestiert',
      'live = geprüfter Stand',
      '2 von 2 up',
      'bestanden · 04.11.',
    ]);
  });

  it('takes state, sentence and transition from the delivery view', () => {
    const code = station(videoflixStatus(), 'Code');

    expect(code.state).toBe('verified');
    expect(code.sentence).toBe('Jede Änderung ist versioniert und nachvollziehbar.');
    expect(code.toNext).toBe('CI');
  });

  it('lists one row per repo with a run link per workflow', () => {
    const checks = station(videoflixStatus(), 'Tests & Security-Checks');

    expect(checks.table?.head).toEqual(['Repo', 'CI', 'CodeQL', 'Commit']);
    expect(checks.table?.rows.length).toBe(2);
    expect(checks.table?.rows[0][0]).toEqual({ text: 'Backend' });
    expect(checks.table?.rows[0][1]).toEqual({ text: '08.11.', ok: true, url: backendCiRun });
    expect(checks.table?.rows[0][3]).toEqual({ text: 'f4f1b93', sha: 'f4f1b93' });
  });

  // A run link of an older file names no workflow, so no cell can tell which run it is.
  it('[D3] links no run from a link without a workflow name', () => {
    const checks = station(
      videoflixStatus((status) => {
        status.checks.links.forEach((link) => delete link.workflow);
      }),
      'Tests & Security-Checks',
    );

    expect(checks.table?.rows[0][1]).toEqual({ text: '08.11.', ok: true });
  });

  it('shows image, origin, digest, SBOM and scorecard per built repo', () => {
    const build = station(videoflixStatus(), 'Signed Build');

    expect(build.table?.rows[0]).toEqual([
      { text: 'Backend' },
      { text: 'f4f1b93', sha: 'f4f1b93' },
      { text: 'sha256:346d0a9…', url: `${packages}/videoflix-backend` },
      { text: '520 Pakete' },
      { text: '6,7 / 10', url: 'https://scorecard.dev/viewer/?uri=github.com/' + backend },
      { text: 'Attestierung', url: `${github}/videoflix-backend/attestations` },
    ]);
  });

  it('derives the verify command from digest and image link', () => {
    const build = station(videoflixStatus(), 'Signed Build');

    expect(build.verify).toBe(
      'gh attestation verify \\\n' +
        `  oci://ghcr.io/philippklinger/videoflix-backend@${backendDigest} \\\n` +
        `  --repo ${backend}`,
    );
    expect(station(videoflixStatus(), 'Code').verify).toBeNull();
  });

  // The digest stays when the attestation is missing or out of reach (spec 6.2), the command
  // would fail.
  it('builds no verify command for an image without attestation', () => {
    const counts = [0, null];

    for (const provenanceCount of counts) {
      const build = station(
        videoflixStatus((status) => {
          status.supplyChain.signals.repos.forEach((repo) => {
            repo.attestation = { ...repo.attestation!, provenanceCount };
          });
        }),
        'Signed Build',
      );
      expect(build.verify).toBeNull();
    }
  });

  it('takes the first image that has an attestation for the verify command', () => {
    const build = station(
      videoflixStatus((status) => {
        const [first] = status.supplyChain.signals.repos;
        first.attestation = { ...first.attestation!, provenanceCount: 0 };
      }),
      'Signed Build',
    );

    expect(build.verify).toContain(`videoflix-frontend@${frontendDigest}`);
  });

  it('builds no verify command from a malformed digest, image name or repo', () => {
    const changes: ((status: ProjectStatus) => void)[] = [
      (status) => {
        const [first] = status.supplyChain.signals.repos;
        first.attestation = { ...first.attestation!, subjectDigest: 'sha256:abc; rm -rf ~' };
      },
      (status) => {
        backendImageLink(status).url = `${packages}/videoflix backend$(id)`;
      },
      (status) => {
        const repo = `${backend} --x`;
        status.supplyChain.signals.repos[0].repo = repo;
        backendImageLink(status).source = repo;
      },
    ];

    for (const change of changes) {
      expect(station(videoflixStatus(change), 'Signed Build').verify).toBeNull();
    }
  });

  it('marks live as matching only with matchesLatestGreen', () => {
    const otherSha = '0123456789abcdef0123456789abcdef01234567';
    const deployment = station(
      videoflixStatus((status) => {
        const [part] = status.live.signals.components;
        Object.assign(part, { latestGreenSha: otherSha, matchesLatestGreen: false });
      }),
      'Deployment',
    );

    expect(deployment.value).toBe('live ≠ geprüfter Stand');
    expect(deployment.state).not.toBe('verified');
    expect(deployment.table?.rows[0][3]).toEqual({ text: '0123456', sha: '0123456', ok: false });
  });

  it('lists the components and the deploy run in the deployment table', () => {
    const deployment = station(videoflixStatus(), 'Deployment');

    expect(deployment.table?.rows).toEqual([
      [
        { text: 'Backend' },
        { text: 'f4f1b93', sha: 'f4f1b93' },
        { text: '05.11., 20:28' },
        { text: 'f4f1b93', sha: 'f4f1b93', ok: true },
        { text: '/api/version', url: 'https://videoflix.example/api/version' },
      ],
      expect.arrayContaining([{ text: 'Frontend' }]),
      [
        { text: 'Deploy-Lauf' },
        { text: 'ced3407', sha: 'ced3407' },
        { text: '08.11., 13:55' },
        { text: 'erfolgreich', ok: true },
        expect.objectContaining({ text: 'Lauf' }),
      ],
    ]);
  });

  it('says "noch zu kurz gemessen" without a 30-day uptime', () => {
    const monitoring = station(
      videoflixStatus((status) => (status.stability.signals.uptime30d = null)),
      'Monitoring',
    );

    expect(monitoring.table?.rows).toEqual([
      [
        { text: '2 von 2 up' },
        { text: '100 %' },
        { text: 'noch zu kurz gemessen' },
        { text: '06.11., 01:50' },
        { text: 'Statusseite', url: 'https://status.example/status/videoflix' },
      ],
    ]);
  });

  it('shows the restore test with its protocol and runbook', () => {
    const restore = station(videoflixStatus(), 'Restore-Test');

    expect(restore.table?.rows[0]).toEqual([
      { text: '04.11.' },
      { text: 'bestanden', ok: true },
      { text: 'Protokoll', url: `${github}/videoflix-deploy/blob/main/r.json` },
      { text: 'Runbook', url: `${github}/videoflix-deploy/blob/main/RUNBOOK.md` },
    ]);
  });

  it('shows no table and no tick for an unreachable station', () => {
    const build = station(
      videoflixStatus((status) => {
        status.supplyChain.reachable = false;
        status.supplyChain.signals.repos.forEach((repo) => {
          repo.reachable = false;
          repo.attestation = { reachable: false, subjectDigest: null, provenanceCount: null };
          repo.sbom = { reachable: false, spdxVersion: null, packageCount: null };
          repo.scorecard = { reachable: false, score: null, date: null };
        });
      }),
      'Signed Build',
    );

    expect(build.state).toBe('unavailable');
    expect(build.value).toBe('nicht abrufbar');
    expect(build.table).toBeNull();
    expect(build.verify).toBeNull();
  });

  // SBOM and scorecard prove a part, the attestation is out of reach: no count to show.
  it('[D2] names a half-proven station "teilweise" when no value can be derived', () => {
    const build = station(
      videoflixStatus((status) => {
        status.supplyChain.signals.repos.forEach((repo) => {
          repo.attestation = { ...repo.attestation!, reachable: false, provenanceCount: null };
        });
      }),
      'Signed Build',
    );

    expect(build.state).toBe('partial');
    expect(build.value).toBe('teilweise');
  });

  it('drops rows whose source is missing instead of inventing values', () => {
    const build = station(
      videoflixStatus((status) => {
        const [, front] = status.supplyChain.signals.repos;
        front.attestation = { reachable: false, subjectDigest: null, provenanceCount: null };
      }),
      'Signed Build',
    );

    expect(build.table?.rows.map((row) => row[0].text)).toEqual(['Backend']);
    expect(build.value).toBe('1 Image attestiert');
  });

  it('takes every link from status.json', () => {
    const status = videoflixStatus();
    const known = Object.values(status).flatMap((entry) =>
      entry.links.map((link: StatusLink) => link.url),
    );
    const shown = chainOf(status).stations.flatMap(
      (entry) => entry.table?.rows.flat().map((cell) => cell.url) ?? [],
    );

    expect(shown.filter(Boolean).length).toBeGreaterThan(10);
    expect(shown.filter((url) => url && !known.includes(url))).toEqual([]);
  });

  it('shows the event and the links of a fixed step', () => {
    const fixed: FixedStep = {
      name: 'Release',
      state: 'verified',
      sentence: 'Öffentlich verfügbar.',
      links: [{ label: 'Ansehen', url: 'https://example.com/app' }],
    };
    const [plain] = buildChainView({ steps: [fixed] }, null).stations;
    const [dated] = buildChainView({ steps: [{ ...fixed, event: 'Ereignis' }] }, null).stations;

    expect(plain.value).toBe('öffentlich');
    expect(plain.table).toEqual({
      head: [''],
      rows: [[{ text: 'Ansehen', url: fixed.links?.[0].url }]],
    });
    expect(dated.value).toBe('Ereignis');
  });

  it('says "Code privat" without a table for a private step', () => {
    const [kit] = buildChainView(deliveryPlans['developer-workspace-kit'], null).stations;

    expect(kit.value).toBe('Code privat');
    expect(kit.table).toBeNull();
  });

  it('keeps the old file readable', () => {
    for (const each of Object.values(deliveryPlans)) {
      const chain = buildChainView(each, null);
      const measured = chain.stations.filter((_, index) => isMeasured(each.steps[index]));

      expect(chain.stand).toBeNull();
      expect(chain.repoCount).toBe(0);
      expect(measured.every((entry) => entry.state !== 'verified')).toBe(true);
      expect(measured.every((entry) => entry.table === null && entry.verify === null)).toBe(true);
    }
    const values = buildChainView(plan, null).stations.map((entry) => entry.value);
    expect(values).toContain('nicht abrufbar');
    expect(values).toContain('noch nicht eingerichtet');
  });
});
