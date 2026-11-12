// Pure logic of Software Delivery: turns the plan of a project and its part of the public
// status.json into what cards and project pages show. A step counts as verified only if the data
// proves it and a public link backs it up.
import {
  LinkKind,
  ProjectKey,
  ProjectStatus,
  RepoCodeSignal,
  RepoSupplyChainSignal,
  RequiredProjectKey,
  STATUS_SCHEMA_VERSION,
  StationKey,
  StatusDocument,
  StatusLink,
  WorkflowKind,
  WorkflowSignal,
} from './status';

export type StepState =
  'verified' | 'partial' | 'deviation' | 'unavailable' | 'notSetUp' | 'private';
export type StepSource =
  'code' | 'checks' | 'supplyChain' | 'image' | 'live' | 'deployRun' | 'stability' | 'restore';

export interface DeliveryLink {
  label: string;
  url: string;
}

export interface MeasuredStep {
  name: string;
  arrowToNext?: string;
  /** Staging can combine deployRun and live. */
  sources: StepSource[];
  setUp: boolean;
  sentences: Partial<
    Record<
      | 'verified'
      | 'partial'
      | 'deviation'
      | 'notSetUp'
      | 'unsigned'
      | 'deployRunFailed'
      | 'deployRunOnly',
      string
    >
  >;
}

export interface FixedStep {
  name: string;
  arrowToNext?: string;
  state: 'verified' | 'private';
  sentence: string;
  event?: string;
  links?: DeliveryLink[];
}

export type DeliveryStepPlan = MeasuredStep | FixedStep;

export interface DeliveryPlan {
  /** Absent: fixed content only. */
  statusKey?: ProjectKey;
  runningLabel?: string;
  fixedSignal?: DeliveryView['signal'];
  repoLabels?: Record<string, string>;
  steps: DeliveryStepPlan[];
}

export interface DeliveryStepView {
  name: string;
  arrowToNext: string | null;
  state: StepState;
  sentence: string;
}

export interface DeliveryView {
  /** The state sets icon and color, so a red signal never looks like a green one. */
  signal: { state: StepState; status: string; when: string };
  steps: DeliveryStepView[];
}

/** One project out of status.json, so a page never carries the data of another project. */
export interface ProjectSnapshot {
  generatedAt: string;
  status: ProjectStatus;
}

// true: proven, false: disproven, null: no statement.
type Proof = boolean | null;
type Status = ProjectStatus | null;
type Snapshot = ProjectSnapshot | null;
type Signal = DeliveryView['signal'];

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const REQUIRED_PROJECTS: RequiredProjectKey[] = ['videoflix', 'portfolio'];
const OPTIONAL_PROJECTS: ProjectKey[] = ['vps-plattform', 'neuro-check-in', 'buildorder'];
const STATIONS: StationKey[] = ['code', 'checks', 'supplyChain', 'live', 'stability', 'restore'];
const OPERATING_SOURCES: StepSource[] = ['live', 'stability'];

// DRAFT: all texts of Software Delivery, wording to be approved (PK-23).
export const deliveryTexts = {
  title: 'Software Delivery',
  refreshFailed: 'Der aktuelle Stand ist gerade nicht abrufbar.',
  stale: 'Dieser Stand ist älter als einen Tag.',
  howBuilt: 'Wie es gebaut ist',
  architecture: 'Architektur',
  decision: 'Entscheidung',
  failure: 'Fehler',
  stateLabels: {
    verified: 'Belegt',
    partial: 'Teilweise',
    deviation: 'Abweichung',
    unavailable: 'Nicht abrufbar',
    notSetUp: 'Noch nicht eingerichtet',
    private: 'Code privat',
  } satisfies Record<StepState, string>,
} as const;

// DRAFT: wording to be approved (PK-23).
const UNAVAILABLE_SENTENCE = 'Dieser Beleg ist gerade nicht abrufbar.';

// Fixed time zone, so the prerendered page and the browser render the same text.
const timeZone = 'Europe/Berlin';
export const dayTimeFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
export const dayFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone,
  day: '2-digit',
  month: '2-digit',
});
export const oneDecimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export const shortSha = (sha: string) => sha.slice(0, 7);
export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const unique = <T>(values: T[]) => [...new Set(values)];
export const present = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;
export const percent = (share: number | null) =>
  share === null ? null : `${oneDecimal.format(share * 100)} %`;

export function formatTime(format: Intl.DateTimeFormat, value: string | null): string | null {
  return value === null || Number.isNaN(Date.parse(value)) ? null : format.format(new Date(value));
}

function latestTime(runs: WorkflowSignal[]): string | null {
  const times = runs.map((run) => run.completedAt).filter(present);
  return times.sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;
}

export function runsOf(status: ProjectStatus, wanted: 'check' | 'deploy'): WorkflowSignal[] {
  const isDeploy = (run: WorkflowSignal) => run.kind === 'deploy';
  return status.checks.signals.workflows.filter((run) =>
    wanted === 'deploy' ? isDeploy(run) : !isDeploy(run),
  );
}

/** Older files still list repositories that build nothing; they have nothing to prove here. */
export const builtRepos = (status: ProjectStatus): RepoSupplyChainSignal[] =>
  status.supplyChain.signals.repos.filter((repo) => repo.attestation !== null);

function isProtected(repo: RepoCodeSignal): boolean {
  return (repo.rulesets ?? []).some(
    (ruleset) => ruleset.enforcement === 'active' && ruleset.appliesToDefaultBranch,
  );
}

function codeProof(repo: RepoCodeSignal): Proof {
  return repo.reachable ? repo.isPublic === true && isProtected(repo) : null;
}

export function runProof(run: WorkflowSignal): Proof {
  return run.reachable && run.conclusion !== null ? run.conclusion === 'success' : null;
}

function attestationProof({ attestation }: RepoSupplyChainSignal): Proof {
  const count = attestation?.provenanceCount ?? null;
  return count === null ? null : count > 0;
}

function supplyChainProofs(repo: RepoSupplyChainSignal): Proof[] {
  return [
    attestationProof(repo),
    repo.sbom.reachable ? true : null,
    repo.scorecard.reachable && repo.scorecard.score !== null ? true : null,
  ];
}

function stabilityProofs({ reachable, signals }: ProjectStatus['stability']): Proof[] {
  const { monitorsTotal: total, monitorsUp: up } = signals;
  if (!reachable || !total || up === null) return [null];
  // One entry is enough, the state only asks whether any service is down.
  return [up >= total];
}

function restoreProof({ result }: ProjectStatus['restore']['signals']): Proof {
  if (result === 'failed') return false;
  return result === 'passed' ? true : null;
}

// No components: nothing proves what runs live, so a green deploy run alone is not enough.
function liveProofs({ live }: ProjectStatus): Proof[] {
  const { components } = live.signals;
  return components.length > 0 ? components.map((part) => part.matchesLatestGreen) : [null];
}

const proofsOf: Record<StepSource, (status: ProjectStatus) => Proof[]> = {
  code: (status) => status.code.signals.repos.map(codeProof),
  checks: (status) => runsOf(status, 'check').map(runProof),
  supplyChain: (status) => builtRepos(status).flatMap(supplyChainProofs),
  image: (status) =>
    builtRepos(status).map((repo) => (repo.attestation?.subjectDigest ? true : null)),
  live: liveProofs,
  deployRun: (status) => runsOf(status, 'deploy').map(runProof),
  stability: (status) => stabilityProofs(status.stability),
  restore: (status) => [restoreProof(status.restore.signals)],
};

function stateOf(proofs: Proof[], setUp: boolean): StepState {
  if (proofs.includes(false)) return 'deviation';
  if (proofs.length > 0 && proofs.every((proof) => proof === true)) return 'verified';
  if (proofs.includes(true)) return 'partial';
  return setUp ? 'unavailable' : 'notSetUp';
}

const ofKind = (links: StatusLink[], ...kinds: LinkKind[]) =>
  links.filter((link) => kinds.includes(link.kind));

/** A run link without a workflow name comes from an older file and counts as a check. */
function runKind(link: StatusLink, status: ProjectStatus): WorkflowKind | null {
  if (!link.workflow) return 'tests';
  const { workflows } = status.checks.signals;
  const run = workflows.find(
    (item) => item.repo === link.source && item.workflow === link.workflow,
  );
  return run?.kind ?? null;
}

function runLinks(status: ProjectStatus, kind: WorkflowKind): StatusLink[] {
  const runs = ofKind(status.checks.links, 'workflow-run');
  return runs.filter((link) => runKind(link, status) === kind);
}

// Pull requests, CodeQL and security checks stay out on purpose (B7).
const linksOf: Record<StepSource, (status: ProjectStatus) => StatusLink[]> = {
  code: (status) => ofKind(status.code.links, 'repository'),
  checks: (status) => runLinks(status, 'tests'),
  supplyChain: (status) => ofKind(status.supplyChain.links, 'attestations', 'sbom', 'scorecard'),
  image: (status) => ofKind(status.supplyChain.links, 'image'),
  live: (status) => ofKind(status.live.links, 'version-endpoint'),
  deployRun: (status) => runLinks(status, 'deploy'),
  stability: (status) => ofKind(status.stability.links, 'status-page'),
  restore: (status) => ofKind(status.restore.links, 'restore-test', 'runbook'),
};

function hasPublicLink(step: MeasuredStep, status: Status): boolean {
  if (status === null) return false;
  const links = step.sources.flatMap((source) => linksOf[source](status));
  return links.some((link) => link.url.startsWith('https://'));
}

/** "Belegt" needs a public link (spec 5). Without a sentence for partial it is not available. */
function settledState(state: StepState, step: MeasuredStep, hasLink: boolean): StepState {
  const claimed = state === 'verified' && !hasLink ? 'partial' : state;
  return claimed === 'partial' && !step.sentences.partial ? 'unavailable' : claimed;
}

function disprovingSources(step: MeasuredStep, status: ProjectStatus): StepSource[] {
  return step.sources.filter((source) => proofsOf[source](status).includes(false));
}

/** "Signature missing" says more than the data unless no image has one and all have an SBOM. */
function isUnsigned(status: ProjectStatus): boolean {
  const repos = builtRepos(status);
  const isMissing = (repo: RepoSupplyChainSignal) =>
    attestationProof(repo) !== true && repo.sbom.reachable;
  return repos.length > 0 && repos.every(isMissing);
}

/** A green deploy run says nothing about what runs, only live can prove a part of the services. */
function isRunWithoutLive(step: MeasuredStep, status: ProjectStatus): boolean {
  return step.sources.includes('deployRun') && !proofsOf.live(status).includes(true);
}

function partialSentence(step: MeasuredStep, status: ProjectStatus): string | undefined {
  const unsigned = isUnsigned(status) ? step.sentences.unsigned : undefined;
  return unsigned ?? (isRunWithoutLive(step, status) ? step.sentences.deployRunOnly : undefined);
}

function specificSentence(
  state: StepState,
  step: MeasuredStep,
  status: Status,
): string | undefined {
  if (status === null) return undefined;
  if (state === 'partial') return partialSentence(step, status);
  const isRedRun = disprovingSources(step, status)[0] === 'deployRun';
  return state === 'deviation' && isRedRun ? step.sentences.deployRunFailed : undefined;
}

function sentenceOf(state: StepState, step: MeasuredStep, status: Status): string {
  if (state === 'unavailable' || state === 'private') return UNAVAILABLE_SENTENCE;
  return specificSentence(state, step, status) ?? step.sentences[state] ?? UNAVAILABLE_SENTENCE;
}

function proofsFor(step: MeasuredStep, status: Status): Proof[] {
  return status ? step.sources.flatMap((source) => proofsOf[source](status)) : [];
}

function measuredView(step: MeasuredStep, status: Status): DeliveryStepView {
  const proven = stateOf(proofsFor(step, status), step.setUp);
  const state = settledState(proven, step, hasPublicLink(step, status));
  return {
    name: step.name,
    arrowToNext: step.arrowToNext ?? null,
    state,
    sentence: sentenceOf(state, step, status),
  };
}

export const isMeasured = (step: DeliveryStepPlan): step is MeasuredStep => 'sources' in step;

function fixedView(step: FixedStep): DeliveryStepView {
  return {
    name: step.name,
    arrowToNext: step.arrowToNext ?? null,
    state: step.state,
    sentence: step.sentence,
  };
}

function statesWith(
  plan: DeliveryPlan,
  steps: DeliveryStepView[],
  sources: StepSource[],
): StepState[] {
  return plan.steps.flatMap((step, index) =>
    isMeasured(step) && step.sources.some((source) => sources.includes(source))
      ? [steps[index].state]
      : [],
  );
}

// DRAFT: signal text, wording to be approved (PK-23).
function lastRun(runs: WorkflowSignal[]): string {
  const day = formatTime(dayFormat, latestTime(runs));
  return day === null ? '' : `zuletzt ${day}`;
}

// DRAFT: signal text, wording to be approved (PK-23).
function operatingSignal(
  plan: DeliveryPlan,
  steps: DeliveryStepView[],
  stand: string,
  uptime24h: number | null,
): Signal | null {
  const states = statesWith(plan, steps, OPERATING_SOURCES);
  const isRunning = states.length > 0 && states.every((state) => state === 'verified');
  const share = percent(uptime24h);
  if (plan.runningLabel && isRunning)
    return {
      state: 'verified',
      status: plan.runningLabel,
      when: share === null ? stand : `${share} (24 h)`,
    };
  return states.includes('deviation')
    ? { state: 'deviation', status: 'Abweichung im Betrieb', when: stand }
    : null;
}

// DRAFT: signal text, wording to be approved (PK-23).
function checksSignal(
  plan: DeliveryPlan,
  steps: DeliveryStepView[],
  status: ProjectStatus,
): Signal | null {
  const states = statesWith(plan, steps, ['checks']);
  const runs = runsOf(status, 'check');
  if (states.includes('deviation'))
    return { state: 'deviation', status: 'Prüfung rot', when: lastRun(runs) };
  if (!states.includes('verified')) return null;
  return {
    state: 'verified',
    status: 'CI grün',
    when: lastRun(runs.filter((run) => run.kind === 'tests')),
  };
}

// DRAFT: signal text, wording to be approved (PK-23).
const NO_SIGNAL: Signal = { state: 'unavailable', status: 'Stand nicht abrufbar', when: '' };

// DRAFT: signal text, wording to be approved (PK-23).
function fallbackSignal(steps: DeliveryStepView[], stand: string): Signal {
  const hasProof = steps.some((step) => step.state === 'verified' || step.state === 'partial');
  return hasProof ? { state: 'partial', status: 'Teilweise belegt', when: stand } : NO_SIGNAL;
}

function signalOf(plan: DeliveryPlan, steps: DeliveryStepView[], snapshot: Snapshot): Signal {
  if (plan.fixedSignal) return plan.fixedSignal;
  if (!snapshot) return NO_SIGNAL;
  const stand = `Stand ${formatTime(dayTimeFormat, snapshot.generatedAt)}`;
  return (
    operatingSignal(plan, steps, stand, snapshot.status.stability.signals.uptime24h) ??
    checksSignal(plan, steps, snapshot.status) ??
    fallbackSignal(steps, stand)
  );
}

export function buildDeliveryView(plan: DeliveryPlan, snapshot: Snapshot): DeliveryView {
  const status = snapshot?.status ?? null;
  const steps = plan.steps.map((step) =>
    isMeasured(step) ? measuredView(step, status) : fixedView(step),
  );
  return { signal: signalOf(plan, steps, snapshot), steps };
}

type Check = (value: unknown) => boolean;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isText: Check = (value) => typeof value === 'string';
const isFlag: Check = (value) => typeof value === 'boolean';
const isNumber: Check = (value) => typeof value === 'number';
const isCount: Check = (value) => Number.isSafeInteger(value) && (value as number) >= 0;
const isRestoreResult: Check = (value) => value === 'passed' || value === 'failed';
const orNull =
  (check: Check): Check =>
  (value) =>
    value === null || check(value);
const optional =
  (check: Check): Check =>
  (value) =>
    value === undefined || check(value);
const listOf =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check);
const shaped =
  (fields: Record<string, Check>): Check =>
  (value) =>
    isObject(value) && Object.entries(fields).every(([key, check]) => check(value[key]));

const isRuleset = shaped({
  enforcement: isText,
  target: isText,
  appliesToDefaultBranch: isFlag,
  ruleTypes: listOf(isText),
});
const isCodeRepo = shaped({
  repo: isText,
  reachable: isFlag,
  isPublic: orNull(isFlag),
  defaultBranch: orNull(isText),
  mergedPullRequests: orNull(isCount),
  rulesets: orNull(listOf(isRuleset)),
});
const isWorkflow = shaped({
  repo: isText,
  workflow: isText,
  file: isText,
  kind: isText,
  reachable: isFlag,
  conclusion: orNull(isText),
  headSha: orNull(isText),
  completedAt: orNull(isText),
});
// sourceSha came with Conduit, so older files do not have it.
const isAttestation = shaped({
  reachable: isFlag,
  subjectDigest: orNull(isText),
  provenanceCount: orNull(isCount),
  sourceSha: optional(orNull(isText)),
});
const isBuiltRepo = shaped({
  repo: isText,
  reachable: isFlag,
  attestation: orNull(isAttestation),
  sbom: shaped({ reachable: isFlag, spdxVersion: orNull(isText), packageCount: orNull(isCount) }),
  scorecard: shaped({ reachable: isFlag, score: orNull(isNumber), date: orNull(isText) }),
});
const isLiveComponent = shaped({
  component: isText,
  repo: isText,
  reachable: isFlag,
  deployedSha: orNull(isText),
  builtAt: orNull(isText),
  latestGreenSha: orNull(isText),
  matchesLatestGreen: orNull(isFlag),
});
// workflow came with the deploy run, so links of older files do not have it.
const isLink = shaped({
  kind: isText,
  source: isText,
  url: isText,
  workflow: optional(isText),
});

// Every field the view reads has its type checked here, so a wrong shape cannot throw on the page.
const isSignalsOf: Record<StationKey, Check> = {
  code: shaped({ repos: listOf(isCodeRepo) }),
  checks: shaped({ workflows: listOf(isWorkflow) }),
  supplyChain: shaped({ repos: listOf(isBuiltRepo) }),
  live: shaped({ components: listOf(isLiveComponent) }),
  stability: shaped({
    monitorsTotal: orNull(isCount),
    monitorsUp: orNull(isCount),
    uptime24h: orNull(isNumber),
    uptime30d: orNull(isNumber),
    lastHeartbeatAt: orNull(isText),
    oldestVisibleHeartbeatAt: orNull(isText),
  }),
  restore: shaped({ testedAt: orNull(isText), result: orNull(isRestoreResult) }),
};

function isValidStation(station: unknown, key: StationKey): boolean {
  return shaped({ reachable: isFlag, signals: isSignalsOf[key], links: listOf(isLink) })(station);
}

function hasAllStations(project: unknown): boolean {
  return isObject(project) && STATIONS.every((key) => isValidStation(project[key], key));
}

/**
 * The optional projects may be missing in an older file, but once there they have to be whole.
 * Keys no page reads, like conduit in a file of the old collector, are ignored.
 */
function hasValidProjects(projects: Record<string, unknown>): boolean {
  const optionalFit = OPTIONAL_PROJECTS.every(
    (key) => !(key in projects) || hasAllStations(projects[key]),
  );
  return optionalFit && REQUIRED_PROJECTS.every((key) => hasAllStations(projects[key]));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The upload is not atomic and the host answers 404 with HTML, so nothing is taken on trust. */
export function parseStatusDocument(text: string): StatusDocument | null {
  const document = parseJson(text);
  if (!isObject(document) || document['schemaVersion'] !== STATUS_SCHEMA_VERSION) return null;
  const time = document['generatedAt'];
  if (typeof time !== 'string' || Number.isNaN(Date.parse(time))) return null;
  const projects = document['projects'];
  return isObject(projects) && hasValidProjects(projects)
    ? (document as unknown as StatusDocument)
    : null;
}

export function pickProjectSnapshot(
  document: StatusDocument | null,
  project: ProjectKey,
): ProjectSnapshot | null {
  const status = document?.projects[project];
  return document && status ? { generatedAt: document.generatedAt, status } : null;
}

export function isStale(generatedAt: string, now: Date): boolean {
  return now.getTime() - Date.parse(generatedAt) > STALE_AFTER_MS;
}

export function pickNewerSnapshot(
  current: ProjectSnapshot | null,
  fresh: ProjectSnapshot | null,
): ProjectSnapshot | null {
  if (!current || !fresh) return current ?? fresh;
  return Date.parse(fresh.generatedAt) > Date.parse(current.generatedAt) ? fresh : current;
}

/** Oldest time on the page. null as soon as an asked project has no snapshot. */
export function shownTime(snapshots: (ProjectSnapshot | null)[]): string | null {
  const times = snapshots.map((snapshot) => snapshot?.generatedAt ?? null);
  if (times.includes(null)) return null;
  return times.filter(present).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
}

export function statusNotice(
  refreshed: boolean,
  generatedAt: string | null,
  now: Date,
): string | null {
  if (!refreshed || generatedAt === null) return deliveryTexts.refreshFailed;
  return isStale(generatedAt, now) ? deliveryTexts.stale : null;
}
