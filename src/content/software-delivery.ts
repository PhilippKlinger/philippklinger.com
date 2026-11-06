// Pure logic of Software Delivery: turns the plan of a project and its part of the public
// status.json into what cards and project pages show. A step counts as verified only if the data
// proves it and a public link backs it up.
import {
  LinkKind,
  LiveComponentSignal,
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
  sentences: Partial<Record<'verified' | 'partial' | 'deviation' | 'notSetUp', string>>;
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
  fixedSignal?: { status: string; when: string };
  /** Overrides the counter. */
  footnote?: string;
  repoLabels?: Record<string, string>;
  steps: DeliveryStepPlan[];
}

export interface DeliveryStepView {
  name: string;
  arrowToNext: string | null;
  state: StepState;
  sentence: string;
  event: string | null;
  /** At most 3. */
  links: DeliveryLink[];
}

export interface DeliveryView {
  signal: { status: string; when: string };
  steps: DeliveryStepView[];
  counter: string;
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

const LINK_LIMIT = 3;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const REQUIRED_PROJECTS: RequiredProjectKey[] = ['videoflix', 'portfolio'];
const STATIONS: StationKey[] = ['code', 'checks', 'supplyChain', 'live', 'stability', 'restore'];
const OPERATING_SOURCES: StepSource[] = ['live', 'stability'];

// DRAFT: all texts of Software Delivery, wording to be approved (PK-23).
export const deliveryTexts = {
  title: 'Software Delivery',
  intro:
    'Vom Code bis in die Produktion, Schritt für Schritt, jeweils mit dem letzten Ereignis und dem Beleg.',
  refreshFailed: 'Der aktuelle Stand ist gerade nicht abrufbar.',
  stale: 'Dieser Stand ist älter als einen Tag.',
  howBuilt: 'Wie es gebaut ist',
  architecture: 'Architektur',
  decisions: 'Entscheidungen',
  failure: 'Ein echter Fehler',
  stateLabels: {
    verified: 'Belegt',
    partial: 'Teilweise',
    deviation: 'Abweichung',
    unavailable: 'Nicht abrufbar',
    notSetUp: 'Noch nicht eingerichtet',
    private: 'Code privat',
  } satisfies Record<StepState, string>,
} as const;

const UNAVAILABLE_SENTENCE = 'Dieser Beleg ist gerade nicht abrufbar.';

// Fixed time zone, so the prerendered page and the browser render the same text.
const timeZone = 'Europe/Berlin';
const dayTimeFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const dayFormat = new Intl.DateTimeFormat('de-DE', { timeZone, day: '2-digit', month: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const oneDecimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

const shortSha = (sha: string) => sha.slice(0, 7);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const unique = <T>(values: T[]) => [...new Set(values)];
const present = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;
const joinParts = (parts: (string | null)[]) => parts.filter(present).join(', ');

function formatTime(format: Intl.DateTimeFormat, value: string | null): string | null {
  return value === null || Number.isNaN(Date.parse(value)) ? null : format.format(new Date(value));
}

function latestTime(runs: WorkflowSignal[]): string | null {
  const times = runs.map((run) => run.completedAt).filter(present);
  return times.sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;
}

function runsOf(status: ProjectStatus, wanted: 'check' | 'deploy'): WorkflowSignal[] {
  const isDeploy = (run: WorkflowSignal) => run.kind === 'deploy';
  return status.checks.signals.workflows.filter((run) =>
    wanted === 'deploy' ? isDeploy(run) : !isDeploy(run),
  );
}

/** Older files still list repositories that build nothing; they have nothing to prove here. */
const builtRepos = (status: ProjectStatus): RepoSupplyChainSignal[] =>
  status.supplyChain.signals.repos.filter((repo) => repo.attestation !== null);

function isProtected(repo: RepoCodeSignal): boolean {
  return (repo.rulesets ?? []).some(
    (ruleset) => ruleset.enforcement === 'active' && ruleset.appliesToDefaultBranch,
  );
}

function codeProof(repo: RepoCodeSignal): Proof {
  return repo.reachable ? repo.isPublic === true && isProtected(repo) : null;
}

function runProof(run: WorkflowSignal): Proof {
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
  return Array.from({ length: total }, (_, index) => index < up);
}

function restoreProof({ testedAt, result }: ProjectStatus['restore']['signals']): Proof {
  if (result === 'failed') return false;
  return result === 'passed' || testedAt !== null ? true : null;
}

const proofsOf: Record<StepSource, (status: ProjectStatus) => Proof[]> = {
  code: (status) => status.code.signals.repos.map(codeProof),
  checks: (status) => runsOf(status, 'check').map(runProof),
  supplyChain: (status) => builtRepos(status).flatMap(supplyChainProofs),
  image: (status) =>
    builtRepos(status).map((repo) => (repo.attestation?.subjectDigest ? true : null)),
  live: (status) => status.live.signals.components.map((part) => part.matchesLatestGreen),
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

function protectionPhrase(status: ProjectStatus): string | null {
  const proofs = proofsOf.code(status);
  if (proofs.includes(false)) return 'main nicht durchgängig geschützt';
  return proofs.includes(null) ? null : 'main geschützt';
}

function codeEvent(status: ProjectStatus): string | null {
  const repos = status.code.signals.repos.filter((repo) => repo.mergedPullRequests !== null);
  if (repos.length === 0) return null;
  const merged = repos.reduce((sum, repo) => sum + (repo.mergedPullRequests ?? 0), 0);
  const where = repos.length === 1 ? '1 Repo' : `${repos.length} Repos`;
  return joinParts([`${merged} gemergte Pull Requests in ${where}`, protectionPhrase(status)]);
}

function checksEvent(status: ProjectStatus): string | null {
  const known = runsOf(status, 'check').filter((run) => runProof(run) !== null);
  if (known.length === 0) return null;
  const red = known.filter((run) => runProof(run) === false);
  const names = unique((red.length > 0 ? red : known).map((run) => run.workflow)).join(', ');
  const result = `${names} ${red.length > 0 ? 'rot' : 'grün'}`;
  return joinParts([result, formatTime(dayTimeFormat, latestTime(known))]);
}

function deployEvent(status: ProjectStatus): string | null {
  const known = runsOf(status, 'deploy').filter((run) => runProof(run) !== null);
  if (known.length === 0) return null;
  const result = known.every((run) => runProof(run)) ? 'erfolgreich' : 'nicht erfolgreich';
  return joinParts([`Letztes Deployment ${result}`, formatTime(dayTimeFormat, latestTime(known))]);
}

function attestationPhrase(repos: RepoSupplyChainSignal[]): string | null {
  const attested = repos.filter((repo) => attestationProof(repo) === true).length;
  if (attested === 0) return null;
  if (attested < repos.length) return `Attestierung für ${attested} von ${repos.length} Images`;
  return repos.length === 2 ? 'Attestierung für beide Images' : 'Attestierung vorhanden';
}

function scorecardPhrase(repos: RepoSupplyChainSignal[]): string | null {
  const scores = repos.map((repo) => repo.scorecard.score).filter(present);
  if (scores.length === 0) return null;
  return `OpenSSF Scorecard ${scores.map((score) => oneDecimal.format(score)).join(' und ')} von 10`;
}

function supplyChainEvent(status: ProjectStatus): string | null {
  const repos = builtRepos(status);
  const sbom = repos.some((repo) => repo.sbom.reachable) ? 'SBOM vorhanden' : null;
  const attestation = attestationPhrase(repos);
  const proven = proofsOf.supplyChain(status).every((proof) => proof === true);
  const parts = proven ? [attestation, sbom] : [attestation, sbom, scorecardPhrase(repos)];
  return joinParts(parts) || null;
}

/** sourceSha counts only next to a digest: without one no image is known at all. */
function imageEvent(status: ProjectStatus): string | null {
  const image = builtRepos(status).find((repo) => repo.attestation?.subjectDigest);
  if (!image) return null;
  const sha = image.attestation?.sourceSha;
  return sha ? `Image gebaut für Commit ${shortSha(sha)}` : 'Image in GHCR vorhanden';
}

function liveComparison(components: LiveComponentSignal[]): string | null {
  const results = components.map((part) => part.matchesLatestGreen);
  if (results.includes(false)) return 'weicht von der letzten grünen CI ab';
  return results.every((result) => result === true)
    ? 'gleicher Stand wie die letzte grüne CI'
    : null;
}

function liveEvent(status: ProjectStatus): string | null {
  const { components } = status.live.signals;
  const known = components.filter((part) => part.deployedSha !== null);
  if (known.length === 0) return null;
  const name = (part: LiveComponentSignal) =>
    components.length > 1 ? capitalize(part.component) : 'Commit';
  const shas = known.map((part) => `${name(part)} ${shortSha(part.deployedSha ?? '')}`);
  return `Live: ${joinParts([...shas, liveComparison(components)])}`;
}

function stabilityEvent({ reachable, signals }: ProjectStatus['stability']): string | null {
  if (!reachable) return null;
  const { uptime30d, monitorsTotal, monitorsUp } = signals;
  if (uptime30d !== null) return `Verfügbarkeit 30 Tage: ${oneDecimal.format(uptime30d * 100)} %`;
  if (monitorsTotal === null || monitorsUp === null) return null;
  return `${monitorsUp} von ${monitorsTotal} Diensten erreichbar`;
}

function restoreEvent({ testedAt, result }: ProjectStatus['restore']['signals']): string | null {
  const date = formatTime(dateFormat, testedAt);
  if (date === null) return null;
  return `Letzter Restore-Test ${result === 'failed' ? 'fehlgeschlagen' : 'erfolgreich'}, ${date}`;
}

const eventOf: Record<StepSource, (status: ProjectStatus) => string | null> = {
  code: codeEvent,
  checks: checksEvent,
  supplyChain: supplyChainEvent,
  image: imageEvent,
  live: liveEvent,
  deployRun: deployEvent,
  stability: (status) => stabilityEvent(status.stability),
  restore: (status) => restoreEvent(status.restore.signals),
};

const ofKind = (links: StatusLink[], kind: LinkKind) => links.filter((link) => link.kind === kind);

function toLinks(links: StatusLink[], label: (link: StatusLink) => string): DeliveryLink[] {
  return links.map((link) => ({ label: label(link), url: link.url }));
}

function withRole(text: string, plan: DeliveryPlan, link: StatusLink): string {
  const role = plan.repoLabels?.[link.source];
  return role ? `${text} ${role}` : text;
}

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
  const matching = runs.filter((link) => runKind(link, status) === kind);
  return matching.filter(
    (link, index) => matching.findIndex((other) => other.source === link.source) === index,
  );
}

function scorecardLinks(status: ProjectStatus, plan: DeliveryPlan): DeliveryLink[] {
  const links = ofKind(status.supplyChain.links, 'scorecard');
  const sameTarget = unique(links.map((link) => link.url)).length === 1;
  return sameTarget
    ? toLinks(links.slice(0, 1), () => 'Scorecard')
    : toLinks(links, (link) => withRole('Scorecard', plan, link));
}

function supplyChainLinks(status: ProjectStatus, plan: DeliveryPlan): DeliveryLink[] {
  const links = status.supplyChain.links;
  return [
    ...toLinks(ofKind(links, 'attestations'), (link) => withRole('Attestierung', plan, link)),
    ...toLinks(ofKind(links, 'sbom'), (link) => withRole('SBOM', plan, link)),
    ...scorecardLinks(status, plan),
  ];
}

function liveLinks(status: ProjectStatus): DeliveryLink[] {
  const several = status.live.signals.components.length > 1;
  return toLinks(ofKind(status.live.links, 'version-endpoint'), (link) =>
    several ? `Versions-Endpunkt ${capitalize(link.source)}` : 'Versions-Endpunkt',
  );
}

function restoreLinks(status: ProjectStatus): DeliveryLink[] {
  return [
    ...toLinks(ofKind(status.restore.links, 'restore-test'), () => 'Restore-Test'),
    ...toLinks(ofKind(status.restore.links, 'runbook'), () => 'Runbook'),
  ];
}

// Pull requests, CodeQL and security checks stay out on purpose: the event names them (B7).
const linksOf: Record<StepSource, (status: ProjectStatus, plan: DeliveryPlan) => DeliveryLink[]> = {
  code: (status, plan) =>
    toLinks(
      ofKind(status.code.links, 'repository'),
      (link) => plan.repoLabels?.[link.source] ?? 'Repository',
    ),
  checks: (status, plan) =>
    toLinks(runLinks(status, 'tests'), (link) => withRole('Lauf', plan, link)),
  supplyChain: supplyChainLinks,
  image: (status) => toLinks(ofKind(status.supplyChain.links, 'image'), () => 'Image in GHCR'),
  live: liveLinks,
  deployRun: (status) => toLinks(runLinks(status, 'deploy'), () => 'Deploy-Lauf'),
  stability: (status) =>
    toLinks(ofKind(status.stability.links, 'status-page'), () => 'Statusseite'),
  restore: restoreLinks,
};

function publicLinks(step: MeasuredStep, status: Status, plan: DeliveryPlan): DeliveryLink[] {
  if (status === null) return [];
  const links = step.sources.flatMap((source) => linksOf[source](status, plan));
  return links.filter((link) => link.url.startsWith('https://')).slice(0, LINK_LIMIT);
}

/** "Belegt" needs a public link (spec 5). Without a sentence for partial it is not available. */
function settledState(state: StepState, step: MeasuredStep, hasLink: boolean): StepState {
  const claimed = state === 'verified' && !hasLink ? 'partial' : state;
  return claimed === 'partial' && !step.sentences.partial ? 'unavailable' : claimed;
}

function sentenceOf(state: StepState, step: MeasuredStep): string {
  if (state === 'unavailable' || state === 'private') return UNAVAILABLE_SENTENCE;
  return step.sentences[state] ?? UNAVAILABLE_SENTENCE;
}

function proofsFor(step: MeasuredStep, status: Status): Proof[] {
  return status ? step.sources.flatMap((source) => proofsOf[source](status)) : [];
}

function eventFor(step: MeasuredStep, status: Status): string | null {
  const events = status ? step.sources.map((source) => eventOf[source](status)) : [];
  return events.find(present) ?? null;
}

function measuredView(step: MeasuredStep, status: Status, plan: DeliveryPlan): DeliveryStepView {
  const links = publicLinks(step, status, plan);
  const state = settledState(stateOf(proofsFor(step, status), step.setUp), step, links.length > 0);
  return {
    name: step.name,
    arrowToNext: step.arrowToNext ?? null,
    state,
    sentence: sentenceOf(state, step),
    event: eventFor(step, status),
    links,
  };
}

const isMeasured = (step: DeliveryStepPlan): step is MeasuredStep => 'sources' in step;

function fixedView(step: FixedStep): DeliveryStepView {
  return {
    name: step.name,
    arrowToNext: step.arrowToNext ?? null,
    state: step.state,
    sentence: step.sentence,
    event: step.event ?? null,
    links: step.links ?? [],
  };
}

function counterOf(plan: DeliveryPlan, steps: DeliveryStepView[]): string {
  if (plan.footnote) return plan.footnote;
  const verified = steps.filter((step) => step.state === 'verified').length;
  const hasPrivate = steps.some((step) => step.state === 'private');
  const suffix = hasPrivate ? 'öffentlich belegt, Code privat' : 'belegt';
  return `${verified} von ${steps.length} ${suffix}`;
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

function lastRun(runs: WorkflowSignal[]): string {
  const day = formatTime(dayFormat, latestTime(runs));
  return day === null ? '' : `zuletzt ${day}`;
}

function operatingSignal(
  plan: DeliveryPlan,
  steps: DeliveryStepView[],
  stand: string,
): Signal | null {
  const states = statesWith(plan, steps, OPERATING_SOURCES);
  const isRunning = states.length > 0 && states.every((state) => state === 'verified');
  if (plan.runningLabel && isRunning) return { status: plan.runningLabel, when: stand };
  return states.includes('deviation') ? { status: 'Abweichung im Betrieb', when: stand } : null;
}

function checksSignal(
  plan: DeliveryPlan,
  steps: DeliveryStepView[],
  status: ProjectStatus,
): Signal | null {
  const states = statesWith(plan, steps, ['checks']);
  const runs = runsOf(status, 'check');
  if (states.includes('deviation')) return { status: 'Prüfung rot', when: lastRun(runs) };
  if (!states.includes('verified')) return null;
  return { status: 'CI grün', when: lastRun(runs.filter((run) => run.kind === 'tests')) };
}

function signalOf(plan: DeliveryPlan, steps: DeliveryStepView[], snapshot: Snapshot): Signal {
  if (plan.fixedSignal) return plan.fixedSignal;
  if (!snapshot) return { status: 'Stand nicht abrufbar', when: '' };
  const stand = `Stand ${formatTime(dayTimeFormat, snapshot.generatedAt)}`;
  return (
    operatingSignal(plan, steps, stand) ??
    checksSignal(plan, steps, snapshot.status) ?? { status: 'Teilweise belegt', when: stand }
  );
}

export function buildDeliveryView(plan: DeliveryPlan, snapshot: Snapshot): DeliveryView {
  const status = snapshot?.status ?? null;
  const steps = plan.steps.map((step) =>
    isMeasured(step) ? measuredView(step, status, plan) : fixedView(step),
  );
  return { signal: signalOf(plan, steps, snapshot), steps, counter: counterOf(plan, steps) };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isObjectList(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isObject);
}

// The entries each station walks through, so a wrong shape cannot throw on the page.
const ENTRY_LISTS: Partial<Record<StationKey, string>> = {
  code: 'repos',
  checks: 'workflows',
  supplyChain: 'repos',
  live: 'components',
};

function hasValidEntries(signals: Record<string, unknown>, key: StationKey): boolean {
  const list = ENTRY_LISTS[key];
  if (!list) return true;
  const entries = signals[list];
  if (!isObjectList(entries)) return false;
  return (
    key !== 'supplyChain' ||
    entries.every((repo) => isObject(repo['sbom']) && isObject(repo['scorecard']))
  );
}

function hasValidLinks(links: unknown): boolean {
  return isObjectList(links) && links.every((link) => typeof link['url'] === 'string');
}

function isValidStation(station: unknown, key: StationKey): boolean {
  return (
    isObject(station) &&
    typeof station['reachable'] === 'boolean' &&
    isObject(station['signals']) &&
    hasValidEntries(station['signals'], key) &&
    hasValidLinks(station['links'])
  );
}

function hasAllStations(project: unknown): boolean {
  return isObject(project) && STATIONS.every((key) => isValidStation(project[key], key));
}

/** conduit may be missing in an older file, but once it is there it has to be whole. */
function hasValidProjects(projects: Record<string, unknown>): boolean {
  const conduitFits = !('conduit' in projects) || hasAllStations(projects['conduit']);
  return conduitFits && REQUIRED_PROJECTS.every((key) => hasAllStations(projects[key]));
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
  if (Number.isNaN(Date.parse(String(document['generatedAt'])))) return null;
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

export function statusNotice(
  refreshed: boolean,
  generatedAt: string | null,
  now: Date,
): string | null {
  if (!refreshed) return deliveryTexts.refreshFailed;
  return generatedAt && isStale(generatedAt, now) ? deliveryTexts.stale : null;
}
