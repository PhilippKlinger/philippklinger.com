// Pure logic of the status collector: asks public sources through an injected fetch and builds
// the public status.json field by field. API responses are never spread into the output.
// Only type imports here, because scripts/collect-status.mjs loads this file via type stripping.

export const STATUS_SCHEMA_VERSION = 1;

export type StationKey = 'code' | 'checks' | 'supplyChain' | 'live' | 'stability' | 'restore';
export type RequiredProjectKey = 'videoflix' | 'portfolio';
export type ProjectKey = RequiredProjectKey | 'vps-plattform';
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type LinkKind =
  | 'repository'
  | 'pull-requests'
  | 'workflow-run'
  | 'attestations'
  | 'sbom'
  | 'scorecard'
  | 'version-endpoint'
  | 'status-page'
  | 'restore-test'
  | 'runbook'
  | 'image';

/** A public page; `source` names the repository or component it belongs to. */
export interface StatusLink {
  kind: LinkKind;
  source: string;
  url: string;
  /** Only on workflow runs: separates CI and deploy runs of one repository. */
  workflow?: string;
}

/** `reachable` is true only if every source of the station delivered usable data. */
export interface Station<Signals> {
  reachable: boolean;
  signals: Signals;
  links: StatusLink[];
}

export interface RulesetSignal {
  enforcement: 'active' | 'evaluate' | 'disabled';
  target: string;
  appliesToDefaultBranch: boolean;
  ruleTypes: string[];
}

export interface RepoCodeSignal {
  repo: string;
  reachable: boolean;
  isPublic: boolean | null;
  defaultBranch: string | null;
  mergedPullRequests: number | null;
  rulesets: RulesetSignal[] | null;
}

export type WorkflowKind = 'tests' | 'scan' | 'deploy';

export interface WorkflowSignal {
  repo: string;
  workflow: string;
  file: string;
  kind: WorkflowKind;
  reachable: boolean;
  conclusion: string | null;
  headSha: string | null;
  completedAt: string | null;
}

export interface AttestationSignal {
  reachable: boolean;
  subjectDigest: string | null;
  provenanceCount: number | null;
  /** Commit the image was built from. headSha does not tell, the latest run may be red. */
  sourceSha?: string | null;
}

export interface SbomSignal {
  reachable: boolean;
  spdxVersion: string | null;
  packageCount: number | null;
}

export interface ScorecardSignal {
  reachable: boolean;
  score: number | null;
  date: string | null;
}

export interface RepoSupplyChainSignal {
  repo: string;
  reachable: boolean;
  /** null: only in older files, the collector now skips repositories without a build. */
  attestation: AttestationSignal | null;
  sbom: SbomSignal;
  scorecard: ScorecardSignal;
}

export interface LiveComponentSignal {
  component: string;
  repo: string;
  reachable: boolean;
  deployedSha: string | null;
  builtAt: string | null;
  latestGreenSha: string | null;
  /** null: one side of the comparison is missing, so there is no statement either way. */
  matchesLatestGreen: boolean | null;
}

export interface StabilitySignals {
  monitorsTotal: number | null;
  monitorsUp: number | null;
  uptime24h: number | null;
  uptime30d: number | null;
  lastHeartbeatAt: string | null;
  /** Oldest heartbeat the public API still shows: a lower bound, not the real start of service. */
  oldestVisibleHeartbeatAt: string | null;
}

export interface RestoreSignals {
  testedAt: string | null;
  result: 'passed' | 'failed' | null;
}

export interface ProjectStatus {
  code: Station<{ repos: RepoCodeSignal[] }>;
  checks: Station<{ workflows: WorkflowSignal[] }>;
  supplyChain: Station<{ repos: RepoSupplyChainSignal[] }>;
  live: Station<{ components: LiveComponentSignal[] }>;
  stability: Station<StabilitySignals>;
  restore: Station<RestoreSignals>;
}

export interface StatusDocument {
  schemaVersion: number;
  generatedAt: string;
  /**
   * vps-plattform is optional: a file written before it existed must stay readable. Such a file
   * may still carry conduit, which no page reads any more.
   */
  projects: Record<RequiredProjectKey, ProjectStatus> & { 'vps-plattform'?: ProjectStatus };
}

export interface WorkflowSource {
  name: string;
  file: string;
  kind: WorkflowKind;
  /** Report this job, not the run: a run stays open while another job waits for approval. */
  job?: string;
}

export type AttestationSource =
  /** Container image in GHCR, tagged with the commit SHA. */
  | { kind: 'image'; image: string }
  /** Publicly served file that is itself a subject of the attestation. */
  | { kind: 'file'; url: string };

export interface RepoSource {
  name: string;
  /** The workflow that decides which commit counts as "green". */
  ciWorkflow?: string;
  workflows: WorkflowSource[];
  attestation?: AttestationSource;
}

export interface ProjectSource {
  repos: RepoSource[];
  versionEndpoints: { component: string; repo: string; url: string }[];
  uptime: { baseUrl: string; slug: string } | null;
  restoreTest: { repo: string; path: string } | null;
}

export interface StatusSources {
  /** Hosts that may appear in links, besides the configured endpoints. */
  linkHosts: string[];
  projects: Record<ProjectKey, ProjectSource>;
}

export interface CollectOptions {
  fetch: FetchLike;
  sources: StatusSources;
  now: () => Date;
  token?: string;
  timeoutMs?: number;
  /** Receives the source URL and a short reason, never response content. */
  onProblem?: (source: string, reason: string) => void;
}

type JsonObject = Record<string, unknown>;

interface Context {
  fetch: FetchLike;
  token: string | undefined;
  timeoutMs: number;
  problem: (source: string, reason: string) => void;
}

interface LatestRun {
  id: number;
  conclusion: string;
  headSha: string;
  completedAt: string;
}

const GITHUB_API = 'https://api.github.com';
const GITHUB = 'https://github.com';
const DEFAULT_BRANCH = 'main';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_STRING_LENGTH = 300;

const VERSION_SHA = /^[0-9a-f]{7,40}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;
export const DIGEST = /^sha256:[0-9a-f]{64}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const KUMA_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;
const BRANCH_NAME = /^[\w./-]{1,100}$/;
const RULE_TYPE = /^[a-z_]{1,64}$/;
const SPDX_VERSION = /^SPDX-\d+\.\d+$/;
const RELATIVE_PATH = /^[\w-]+(?:[./][\w-]+)*$/;

const CONCLUSIONS = [
  'success',
  'failure',
  'cancelled',
  'skipped',
  'timed_out',
  'neutral',
  'action_required',
  'stale',
  'startup_failure',
] as const;
// A newer push cancels the older run, so these say nothing about the code and are no counter-proof.
const NO_VERDICT: unknown[] = ['cancelled', 'skipped', 'neutral', 'stale', 'action_required'];
const JOB_RUNS_TO_CHECK = 3;
const ENFORCEMENTS = ['active', 'evaluate', 'disabled'] as const;
const RULESET_TARGETS = ['branch', 'tag', 'push', 'repository'] as const;
const RESTORE_RESULTS = ['passed', 'failed'] as const;
const STATION_KEYS: StationKey[] = [
  'code',
  'checks',
  'supplyChain',
  'live',
  'stability',
  'restore',
];

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matching(value: unknown, pattern: RegExp): string | null {
  return typeof value === 'string' && pattern.test(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

function timestamp(value: unknown): string | null {
  const text = matching(value, TIMESTAMP);
  return text !== null && !Number.isNaN(Date.parse(text)) ? text : null;
}

function count(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

function ratio(value: unknown): number | null {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 10_000) / 10_000;
}

function describeError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'TimeoutError' || name === 'AbortError') return 'timeout';
  if (name === 'SyntaxError') return 'invalid JSON';
  return 'network error';
}

/** The only place that talks to the network. Returns null on any kind of failure. */
async function request<T>(
  ctx: Context,
  url: string,
  headers: Record<string, string>,
  read: (response: Response) => Promise<T | null> | T | null,
): Promise<T | null> {
  try {
    const response = await ctx.fetch(url, {
      headers: { 'User-Agent': 'philippklinger-status-collector', ...headers },
      signal: AbortSignal.timeout(ctx.timeoutMs),
    });
    if (!response.ok) {
      ctx.problem(url, `HTTP ${response.status}`);
      return null;
    }
    const result = await read(response);
    if (result === null) ctx.problem(url, 'unexpected content');
    return result;
  } catch (error) {
    ctx.problem(url, describeError(error));
    return null;
  }
}

function getJson<T>(
  ctx: Context,
  url: string,
  parse: (json: unknown) => T | null,
  headers: Record<string, string> = {},
): Promise<T | null> {
  // Parsed from text on purpose: what counts is the content, not the announced type.
  return request(ctx, url, headers, async (response) => parse(JSON.parse(await response.text())));
}

function getGitHub<T>(
  ctx: Context,
  path: string,
  parse: (json: unknown) => T | null,
  accept = 'application/vnd.github+json',
): Promise<T | null> {
  return getJson(ctx, `${GITHUB_API}${path}`, parse, {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    ...(ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {}),
  });
}

/** A version endpoint counts only with valid content, so an HTML fallback never passes. */
export function parseVersionDocument(
  document: unknown,
): { sha: string; builtAt: string | null } | null {
  if (!isObject(document)) return null;
  const sha = matching(document['sha'], VERSION_SHA);
  return sha === null ? null : { sha, builtAt: timestamp(document['builtAt']) };
}

function parseRepository(json: unknown): { isPublic: boolean; defaultBranch: string } | null {
  if (!isObject(json) || typeof json['private'] !== 'boolean') return null;
  const defaultBranch = matching(json['default_branch'], BRANCH_NAME);
  return defaultBranch === null ? null : { isPublic: !json['private'], defaultBranch };
}

function parseRuleset(json: unknown): RulesetSignal | null {
  if (!isObject(json) || !Array.isArray(json['rules'])) return null;
  const enforcement = oneOf(json['enforcement'], ENFORCEMENTS);
  const target = oneOf(json['target'], RULESET_TARGETS);
  if (enforcement === null || target === null) return null;

  const refName = isObject(json['conditions']) ? json['conditions']['ref_name'] : null;
  const list = (key: string): unknown[] => {
    const entries = isObject(refName) ? refName[key] : null;
    return Array.isArray(entries) ? entries : [];
  };
  const coversMain = (entry: unknown) =>
    entry === '~DEFAULT_BRANCH' || entry === '~ALL' || entry === `refs/heads/${DEFAULT_BRANCH}`;

  return {
    enforcement,
    target,
    appliesToDefaultBranch: list('include').some(coversMain) && !list('exclude').some(coversMain),
    ruleTypes: json['rules']
      .map((rule: unknown) => (isObject(rule) ? matching(rule['type'], RULE_TYPE) : null))
      .filter((type): type is string => type !== null),
  };
}

async function fetchRulesets(ctx: Context, repo: string): Promise<RulesetSignal[] | null> {
  const ids = await getGitHub(ctx, `/repos/${repo}/rulesets`, (json) => {
    if (!Array.isArray(json)) return null;
    const list = json.map((entry: unknown) => (isObject(entry) ? count(entry['id']) : null));
    return list.every((id) => id !== null) ? (list as number[]) : null;
  });
  if (ids === null) return null;
  const rulesets = await Promise.all(
    ids.map((id) => getGitHub(ctx, `/repos/${repo}/rulesets/${id}`, parseRuleset)),
  );
  return rulesets.every((ruleset) => ruleset !== null) ? (rulesets as RulesetSignal[]) : null;
}

async function collectCodeRepo(
  ctx: Context,
  repo: string,
): Promise<{ signal: RepoCodeSignal; links: StatusLink[] }> {
  const [info, rulesets, mergedPullRequests] = await Promise.all([
    getGitHub(ctx, `/repos/${repo}`, parseRepository),
    fetchRulesets(ctx, repo),
    getGitHub(ctx, `/search/issues?q=repo:${repo}+is:pr+is:merged&per_page=1`, (json) =>
      isObject(json) ? count(json['total_count']) : null,
    ),
  ]);
  const links: StatusLink[] = [];
  if (info) links.push({ kind: 'repository', source: repo, url: `${GITHUB}/${repo}` });
  if (mergedPullRequests !== null) {
    links.push({
      kind: 'pull-requests',
      source: repo,
      url: `${GITHUB}/${repo}/pulls?q=is%3Apr+is%3Amerged`,
    });
  }
  return {
    links,
    signal: {
      repo,
      reachable: info !== null && rulesets !== null && mergedPullRequests !== null,
      isPublic: info?.isPublic ?? null,
      defaultBranch: info?.defaultBranch ?? null,
      mergedPullRequests,
      rulesets,
    },
  };
}

function isOwnMainRun(run: unknown, repo: string): run is JsonObject {
  if (!isObject(run) || run['head_branch'] !== DEFAULT_BRANCH) return false;
  // The branch filter of the API also matches pull requests from a fork's "main".
  const head = run['head_repository'];
  return run['event'] !== 'pull_request' && isObject(head) && head['full_name'] === repo;
}

function pickLatestRun(runs: unknown[], repo: string, status: string): JsonObject | undefined {
  const own = runs.filter((run): run is JsonObject => isOwnMainRun(run, repo));
  if (status !== 'completed') return own[0];
  return own.find((run) => !NO_VERDICT.includes(run['conclusion']));
}

function parseLatestRun(json: unknown, repo: string, status: string): LatestRun | null {
  if (!isObject(json) || !Array.isArray(json['workflow_runs'])) return null;
  const latest = pickLatestRun(json['workflow_runs'], repo, status);
  if (!latest) return null;

  const id = count(latest['id']);
  const conclusion = oneOf(latest['conclusion'], CONCLUSIONS);
  const headSha = matching(latest['head_sha'], FULL_SHA);
  const completedAt = timestamp(latest['updated_at']);
  if (id === null || conclusion === null || headSha === null || completedAt === null) return null;
  if (status === 'success' && conclusion !== 'success') return null;
  return { id, conclusion, headSha, completedAt };
}

function fetchLatestRun(
  ctx: Context,
  repo: string,
  file: string,
  status: 'completed' | 'success',
): Promise<LatestRun | null> {
  return getGitHub(
    ctx,
    `/repos/${repo}/actions/workflows/${file}/runs?branch=${DEFAULT_BRANCH}&status=${status}&per_page=10`,
    (json) => parseLatestRun(json, repo, status),
  );
}

/** null: the answer is unusable. `job: null`: readable, but this job has no verdict in that run. */
function parseFinishedJob(
  json: unknown,
  name: string,
): { job: { conclusion: string; completedAt: string } | null } | null {
  if (!isObject(json) || !Array.isArray(json['jobs'])) return null;
  const job = json['jobs'].find(
    (entry: unknown) =>
      isObject(entry) && entry['name'] === name && !NO_VERDICT.includes(entry['conclusion']),
  );
  if (!isObject(job)) return { job: null };
  const conclusion = oneOf(job['conclusion'], CONCLUSIONS);
  const completedAt = timestamp(job['completed_at']);
  return { job: conclusion && completedAt ? { conclusion, completedAt } : null };
}

/** The newest of the last runs in which this job has a verdict. */
async function fetchLatestJob(
  ctx: Context,
  repo: string,
  file: string,
  name: string,
): Promise<LatestRun | null> {
  const runs = await getGitHub(
    ctx,
    `/repos/${repo}/actions/workflows/${file}/runs?branch=${DEFAULT_BRANCH}&per_page=${JOB_RUNS_TO_CHECK}`,
    (json) =>
      isObject(json) && Array.isArray(json['workflow_runs'])
        ? json['workflow_runs'].filter((run): run is JsonObject => isOwnMainRun(run, repo))
        : null,
  );
  for (const run of runs ?? []) {
    const id = count(run['id']);
    const headSha = matching(run['head_sha'], FULL_SHA);
    if (id === null || headSha === null) continue;
    const answer = await getGitHub(ctx, `/repos/${repo}/actions/runs/${id}/jobs`, (json) =>
      parseFinishedJob(json, name),
    );
    // An older run must not stand in for a newer one that could not be read: it may be green.
    if (!answer) return null;
    if (answer.job) return { id, headSha, ...answer.job };
  }
  return null;
}

async function collectWorkflow(
  ctx: Context,
  repo: string,
  workflow: WorkflowSource,
): Promise<{ signal: WorkflowSignal; link: StatusLink | null; greenSha: string | null }> {
  const [latest, green] = await Promise.all(
    workflow.job
      ? [fetchLatestJob(ctx, repo, workflow.file, workflow.job), null]
      : [
          fetchLatestRun(ctx, repo, workflow.file, 'completed'),
          fetchLatestRun(ctx, repo, workflow.file, 'success'),
        ],
  );
  return {
    greenSha: green?.headSha ?? null,
    link: latest && {
      kind: 'workflow-run',
      source: repo,
      url: `${GITHUB}/${repo}/actions/runs/${latest.id}`,
      workflow: workflow.name,
    },
    signal: {
      repo,
      workflow: workflow.name,
      file: workflow.file,
      kind: workflow.kind,
      reachable: latest !== null,
      conclusion: latest?.conclusion ?? null,
      headSha: latest?.headSha ?? null,
      completedAt: latest?.completedAt ?? null,
    },
  };
}

/** Digest of the image CI tagged with this commit, through the anonymous registry API. */
async function imageDigest(ctx: Context, image: string, sha: string): Promise<string | null> {
  const token = await getJson(
    ctx,
    `https://ghcr.io/token?scope=repository:${image}:pull`,
    (json) => (isObject(json) && typeof json['token'] === 'string' ? json['token'] : null),
  );
  if (token === null) return null;
  return request(
    ctx,
    `https://ghcr.io/v2/${image}/manifests/${sha}`,
    {
      Authorization: `Bearer ${token}`,
      Accept: [
        'application/vnd.oci.image.index.v1+json',
        'application/vnd.docker.distribution.manifest.list.v2+json',
        'application/vnd.oci.image.manifest.v1+json',
        'application/vnd.docker.distribution.manifest.v2+json',
      ].join(', '),
    },
    (response) => matching(response.headers.get('docker-content-digest'), DIGEST),
  );
}

async function liveFileDigest(ctx: Context, url: string): Promise<string | null> {
  return request(ctx, url, {}, async (response) => {
    const hash = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
    const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0'));
    return `sha256:${hex.join('')}`;
  });
}

async function attestationDigest(
  ctx: Context,
  source: AttestationSource,
  greenSha: string | null,
): Promise<string | null> {
  if (source.kind === 'file') return liveFileDigest(ctx, source.url);
  return greenSha === null ? null : imageDigest(ctx, source.image, greenSha);
}

function fetchProvenanceCount(ctx: Context, repo: string, digest: string): Promise<number | null> {
  return getGitHub(
    ctx,
    `/repos/${repo}/attestations/${digest}?predicate_type=provenance&per_page=30`,
    (json) =>
      isObject(json) && Array.isArray(json['attestations']) ? json['attestations'].length : null,
  );
}

async function collectAttestation(
  ctx: Context,
  repo: string,
  source: AttestationSource,
  greenSha: string | null,
): Promise<AttestationSignal> {
  const digest = await attestationDigest(ctx, source, greenSha);
  // Without a digest no image is known, so there is no commit it could have been built from.
  const origin = source.kind === 'image' ? { sourceSha: digest ? greenSha : null } : {};
  // The digest alone proves the image exists, so it stays when the attestation is missing.
  const missing = { reachable: false, subjectDigest: digest, provenanceCount: null, ...origin };
  if (digest === null) return missing;

  const provenanceCount = await fetchProvenanceCount(ctx, repo, digest);
  return provenanceCount === null
    ? missing
    : { reachable: true, subjectDigest: digest, provenanceCount, ...origin };
}

function imageLink(source: RepoSource, attestation: AttestationSignal | null): StatusLink | null {
  if (source.attestation?.kind !== 'image' || !attestation?.subjectDigest) return null;
  const owner = source.name.split('/')[0];
  const name = source.attestation.image.split('/').at(-1);
  return {
    kind: 'image',
    source: source.name,
    url: `${GITHUB}/users/${owner}/packages/container/package/${name}`,
  };
}

function parseSbom(json: unknown): SbomSignal | null {
  const sbom = isObject(json) ? json['sbom'] : null;
  if (!isObject(sbom) || !Array.isArray(sbom['packages'])) return null;
  const spdxVersion = matching(sbom['spdxVersion'], SPDX_VERSION);
  return spdxVersion === null
    ? null
    : { reachable: true, spdxVersion, packageCount: sbom['packages'].length };
}

function parseScorecard(json: unknown): ScorecardSignal | null {
  if (!isObject(json)) return null;
  const score = json['score'];
  const date = timestamp(json['date']);
  if (typeof score !== 'number' || score < 0 || score > 10 || date === null) return null;
  return { reachable: true, score, date };
}

async function collectSupplyChainRepo(
  ctx: Context,
  source: RepoSource,
  greenSha: string | null,
): Promise<{ signal: RepoSupplyChainSignal; links: StatusLink[] }> {
  const repo = source.name;
  const [attestation, sbom, scorecard] = await Promise.all([
    source.attestation ? collectAttestation(ctx, repo, source.attestation, greenSha) : null,
    getGitHub(ctx, `/repos/${repo}/dependency-graph/sbom`, parseSbom),
    getJson(ctx, `https://api.securityscorecards.dev/projects/github.com/${repo}`, parseScorecard),
  ]);
  const links: StatusLink[] = [];
  if (attestation?.reachable) {
    links.push({ kind: 'attestations', source: repo, url: `${GITHUB}/${repo}/attestations` });
  }
  const image = imageLink(source, attestation);
  if (image) links.push(image);
  if (sbom) {
    links.push({ kind: 'sbom', source: repo, url: `${GITHUB}/${repo}/network/dependencies` });
  }
  if (scorecard) {
    links.push({
      kind: 'scorecard',
      source: repo,
      url: `https://scorecard.dev/viewer/?uri=github.com/${repo}`,
    });
  }
  return {
    links,
    signal: {
      repo,
      reachable: (attestation?.reachable ?? true) && sbom !== null && scorecard !== null,
      attestation,
      sbom: sbom ?? { reachable: false, spdxVersion: null, packageCount: null },
      scorecard: scorecard ?? { reachable: false, score: null, date: null },
    },
  };
}

async function collectLiveComponent(
  ctx: Context,
  endpoint: ProjectSource['versionEndpoints'][number],
  latestGreenSha: string | null,
): Promise<{ signal: LiveComponentSignal; link: StatusLink | null }> {
  const version = await getJson(ctx, endpoint.url, parseVersionDocument);
  return {
    link: version && { kind: 'version-endpoint', source: endpoint.component, url: endpoint.url },
    signal: {
      component: endpoint.component,
      repo: endpoint.repo,
      reachable: version !== null,
      deployedSha: version?.sha ?? null,
      builtAt: version?.builtAt ?? null,
      latestGreenSha,
      matchesLatestGreen:
        version !== null && latestGreenSha !== null ? latestGreenSha.startsWith(version.sha) : null,
    },
  };
}

function parseMonitorIds(json: unknown): number[] | null {
  if (!isObject(json) || !Array.isArray(json['publicGroupList'])) return null;
  const ids = json['publicGroupList'].flatMap((group: unknown) => {
    const monitors = isObject(group) ? group['monitorList'] : null;
    return Array.isArray(monitors)
      ? monitors.map((monitor: unknown) => (isObject(monitor) ? count(monitor['id']) : null))
      : [];
  });
  const valid = ids.filter((id): id is number => id !== null);
  return valid.length > 0 ? valid : null;
}

function heartbeatTime(value: unknown): string | null {
  // Uptime Kuma sends UTC without a zone marker.
  const kuma = matching(value, KUMA_TIME);
  const time = kuma === null ? timestamp(value) : `${kuma.replace(' ', 'T')}Z`;
  return time === null ? null : new Date(time).toISOString();
}

function parseStability(json: unknown, monitorIds: number[]): StabilitySignals | null {
  if (!isObject(json) || !isObject(json['heartbeatList'])) return null;
  const heartbeatList = json['heartbeatList'];
  const uptimeList = json['uptimeList'];

  const beats = monitorIds.map((id) => {
    const list = heartbeatList[String(id)];
    return (Array.isArray(list) ? list : [])
      .map((beat: unknown) =>
        isObject(beat) ? { status: beat['status'], time: heartbeatTime(beat['time']) } : null,
      )
      .filter((beat): beat is { status: unknown; time: string } => beat?.time != null)
      .sort((a, b) => a.time.localeCompare(b.time));
  });
  const times = beats
    .flat()
    .map((beat) => beat.time)
    .sort();
  if (times.length === 0) return null;

  const uptime = (window: string) =>
    mean(
      monitorIds
        .map((id) => (isObject(uptimeList) ? ratio(uptimeList[`${id}_${window}`]) : null))
        .filter((value): value is number => value !== null),
    );

  return {
    monitorsTotal: monitorIds.length,
    // Status 1 is "up" in Uptime Kuma; a monitor without heartbeats does not count as up.
    monitorsUp: beats.filter((list) => list.at(-1)?.status === 1).length,
    uptime24h: uptime('24'),
    uptime30d: uptime('720'),
    lastHeartbeatAt: times[times.length - 1],
    oldestVisibleHeartbeatAt: times[0],
  };
}

const NO_STABILITY_SIGNALS: StabilitySignals = {
  monitorsTotal: null,
  monitorsUp: null,
  uptime24h: null,
  uptime30d: null,
  lastHeartbeatAt: null,
  oldestVisibleHeartbeatAt: null,
};

async function fetchStability(
  ctx: Context,
  { baseUrl, slug }: NonNullable<ProjectSource['uptime']>,
): Promise<StabilitySignals | null> {
  const monitorIds = await getJson(ctx, `${baseUrl}/api/status-page/${slug}`, parseMonitorIds);
  return (
    monitorIds &&
    getJson(ctx, `${baseUrl}/api/status-page/heartbeat/${slug}`, (json) =>
      parseStability(json, monitorIds),
    )
  );
}

async function collectStability(
  ctx: Context,
  source: ProjectSource['uptime'],
): Promise<ProjectStatus['stability']> {
  const signals = source && (await fetchStability(ctx, source));
  if (!source || !signals) return { reachable: false, signals: NO_STABILITY_SIGNALS, links: [] };
  const url = `${source.baseUrl}/status/${source.slug}`;
  return { reachable: true, signals, links: [{ kind: 'status-page', source: source.slug, url }] };
}

async function collectRestore(
  ctx: Context,
  source: ProjectSource['restoreTest'],
): Promise<ProjectStatus['restore']> {
  const missing: ProjectStatus['restore'] = {
    reachable: false,
    signals: { testedAt: null, result: null },
    links: [],
  };
  if (source === null) return missing;

  const { repo, path } = source;
  const restoreTest = await getGitHub(
    ctx,
    `/repos/${repo}/contents/${path}`,
    (json) => {
      if (!isObject(json)) return null;
      const testedAt = timestamp(json['testedAt']);
      return testedAt === null
        ? null
        : {
            testedAt,
            result: oneOf(json['result'], RESTORE_RESULTS),
            runbook: matching(json['runbook'], RELATIVE_PATH),
          };
    },
    'application/vnd.github.raw+json',
  );
  if (restoreTest === null) return missing;

  const blob = (file: string) => `${GITHUB}/${repo}/blob/${DEFAULT_BRANCH}/${file}`;
  const links: StatusLink[] = [{ kind: 'restore-test', source: repo, url: blob(path) }];
  if (restoreTest.runbook !== null) {
    links.push({ kind: 'runbook', source: repo, url: blob(restoreTest.runbook) });
  }
  return {
    reachable: true,
    signals: { testedAt: restoreTest.testedAt, result: restoreTest.result },
    links,
  };
}

function station<Signals>(
  items: { reachable: boolean }[],
  signals: Signals,
  links: (StatusLink | null)[],
): Station<Signals> {
  return {
    reachable: items.length > 0 && items.every((item) => item.reachable),
    signals,
    links: links.filter((link): link is StatusLink => link !== null),
  };
}

async function collectProject(ctx: Context, source: ProjectSource): Promise<ProjectStatus> {
  const workflows = await Promise.all(
    source.repos.flatMap((repo) =>
      repo.workflows.map(async (workflow) => ({
        repo: repo.name,
        file: workflow.file,
        result: await collectWorkflow(ctx, repo.name, workflow),
      })),
    ),
  );
  const greenSha = (repoName: string): string | null => {
    const ciWorkflow = source.repos.find((repo) => repo.name === repoName)?.ciWorkflow;
    const entry = workflows.find((w) => w.repo === repoName && w.file === ciWorkflow);
    return entry?.result.greenSha ?? null;
  };

  const [code, supplyChain, live, stability, restore] = await Promise.all([
    Promise.all(source.repos.map((repo) => collectCodeRepo(ctx, repo.name))),
    Promise.all(
      source.repos
        .filter((repo) => repo.attestation)
        .map((repo) => collectSupplyChainRepo(ctx, repo, greenSha(repo.name))),
    ),
    Promise.all(
      source.versionEndpoints.map((endpoint) =>
        collectLiveComponent(ctx, endpoint, greenSha(endpoint.repo)),
      ),
    ),
    collectStability(ctx, source.uptime),
    collectRestore(ctx, source.restoreTest),
  ]);

  const codeSignals = code.map((repo) => repo.signal);
  const workflowSignals = workflows.map((workflow) => workflow.result.signal);
  const supplyChainSignals = supplyChain.map((repo) => repo.signal);
  const liveSignals = live.map((component) => component.signal);
  return {
    code: station(
      codeSignals,
      { repos: codeSignals },
      code.flatMap((repo) => repo.links),
    ),
    checks: station(
      workflowSignals,
      { workflows: workflowSignals },
      workflows.map((workflow) => workflow.result.link),
    ),
    supplyChain: station(
      supplyChainSignals,
      { repos: supplyChainSignals },
      supplyChain.flatMap((repo) => repo.links),
    ),
    live: station(
      liveSignals,
      { components: liveSignals },
      live.map((component) => component.link),
    ),
    stability,
    restore,
  };
}

/** Asks all sources. A failing source never throws: it shows up as `reachable: false`. */
export async function collectStatus(options: CollectOptions): Promise<StatusDocument> {
  const ctx: Context = {
    fetch: options.fetch,
    token: options.token,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    problem: options.onProblem ?? (() => undefined),
  };
  const entries = await Promise.all(
    Object.entries(options.sources.projects).map(
      async ([key, source]) => [key, await collectProject(ctx, source)] as const,
    ),
  );
  return {
    schemaVersion: STATUS_SCHEMA_VERSION,
    generatedAt: options.now().toISOString(),
    // Cast: the keys come from the sources, whose type already requires every project.
    projects: Object.fromEntries(entries) as StatusDocument['projects'],
  };
}

// The closed vocabulary of the document: every other field name fails the validation.
// Checked only before writing, so a new project key belongs here before its first run.
const SCHEMA_KEYS = new Set(
  `schemaVersion generatedAt projects videoflix portfolio vps-plattform
   code checks supplyChain live stability restore reachable signals links kind source url
   repos repo isPublic defaultBranch mergedPullRequests rulesets
   enforcement target appliesToDefaultBranch ruleTypes
   workflows workflow file conclusion headSha completedAt
   attestation subjectDigest provenanceCount sourceSha sbom spdxVersion packageCount scorecard score date
   components component deployedSha builtAt latestGreenSha matchesLatestGreen
   monitorsTotal monitorsUp uptime24h uptime30d lastHeartbeatAt oldestVisibleHeartbeatAt
   testedAt result`.split(/\s+/),
);

const FORBIDDEN_TEXT: [RegExp, string][] = [
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/, 'IP address'],
  [/\b(?:gh[pousr]_|github_pat_)\w+/, 'token'],
  [/\bbearer\s/i, 'token'],
  [/[\w-]\.(?:internal|local|lan|intranet)\b/i, 'internal host'],
  [/\blocalhost\b/i, 'internal host'],
  [/^[A-Z][A-Z0-9_]{2,}=/, 'environment variable'],
];

function allowedLinkHosts(sources: StatusSources): Set<string> {
  const urls = Object.values(sources.projects).flatMap((project) => [
    ...project.versionEndpoints.map((endpoint) => endpoint.url),
    ...(project.uptime ? [project.uptime.baseUrl] : []),
  ]);
  return new Set([...sources.linkHosts, ...urls.map((url) => new URL(url).hostname)]);
}

function textProblem(text: string, hosts: Set<string>): string | null {
  if (text.length > MAX_STRING_LENGTH) return 'overlong text';
  for (const [pattern, label] of FORBIDDEN_TEXT) {
    if (pattern.test(text)) return label;
  }
  if (text.includes('://')) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return 'malformed URL';
    }
    const allowed = url.protocol === 'https:' && url.port === '' && hosts.has(url.hostname);
    return allowed ? null : 'link outside of the public hosts';
  }
  // Timestamps and digests contain colons, everything else must not look like host:port.
  if (timestamp(text) === null && !DIGEST.test(text) && /[\w.-]+:\d{2,5}\b/.test(text)) {
    return 'host and port';
  }
  return null;
}

/**
 * Last gate before the upload, independent of how the document was built. Returns the problems
 * found, without quoting values, so its messages are safe for the public run log.
 */
export function validateStatus(document: unknown, sources: StatusSources): string[] {
  if (!isObject(document)) return ['document is not an object'];
  const problems: string[] = [];
  if (document['schemaVersion'] !== STATUS_SCHEMA_VERSION) problems.push('wrong schemaVersion');
  if (timestamp(document['generatedAt']) === null) problems.push('invalid generatedAt');

  const projects = isObject(document['projects']) ? document['projects'] : {};
  for (const projectKey of Object.keys(sources.projects)) {
    const project = projects[projectKey];
    for (const stationKey of STATION_KEYS) {
      const station = isObject(project) ? project[stationKey] : null;
      const path = `${projectKey}.${stationKey}`;
      if (!isObject(station)) {
        problems.push(`${path} is missing`);
        continue;
      }
      if (typeof station['reachable'] !== 'boolean') problems.push(`${path}.reachable invalid`);
      if (!isObject(station['signals'])) problems.push(`${path}.signals invalid`);
      if (!Array.isArray(station['links'])) problems.push(`${path}.links invalid`);
    }
  }

  const hosts = allowedLinkHosts(sources);
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      const problem = textProblem(value, hosts);
      if (problem) problems.push(`${path}: ${problem}`);
    } else if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
    } else if (isObject(value)) {
      for (const [key, entry] of Object.entries(value)) {
        if (SCHEMA_KEYS.has(key)) walk(entry, `${path}.${key}`);
        else problems.push(`${path}: field outside of the schema`);
      }
    }
  };
  walk(document, '$');
  return problems;
}
