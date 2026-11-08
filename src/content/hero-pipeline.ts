// The delivery chain of this website for the hero. Pure: the status decides every state and every
// value, so the animation can never show a fact the status does not hold.
import { ProjectSnapshot } from './software-delivery';
import { repositoryUrl } from './site';
import { LinkKind, ProjectStatus, StatusLink, WorkflowSignal } from './status';

/** done: proven. failed: disproven. open: not reached. held: stands apart from the run. */
export type HeroStationState = 'done' | 'failed' | 'open' | 'held';

export interface HeroValuePart {
  text: string;
  href?: string;
  failed?: boolean;
}

export interface HeroStation {
  name: string;
  state: HeroStationState;
  value: HeroValuePart[];
}

export interface HeroPipeline {
  stations: HeroStation[];
  /** Index of the last station the run reaches; -1 when it starts nowhere. */
  reached: number;
  note: string | null;
  /** No data at all: no movement and no checks. */
  still: boolean;
}

const NOT_AVAILABLE = 'Dieser Stand ist gerade nicht abrufbar.';
const SEPARATOR: HeroValuePart = { text: ' · ' };
const DASH: HeroValuePart[] = [{ text: '—' }];
const PASSING: HeroValuePart = { text: ' passing' };

type Verdict = 'done' | 'failed' | 'unknown';
interface ChainStation {
  name: string;
  verdict: Verdict;
  value: HeroValuePart[];
}

const shortSha = (sha: string) => sha.slice(0, 7);

function href(status: ProjectStatus, kind: LinkKind, workflow?: string): string | undefined {
  const links: StatusLink[] = [
    ...status.code.links,
    ...status.checks.links,
    ...status.supplyChain.links,
    ...status.live.links,
    ...status.stability.links,
  ];
  return links.find((link) => link.kind === kind && (!workflow || link.workflow === workflow))?.url;
}

const failing = (conclusion: string | null): boolean =>
  conclusion !== null && conclusion !== 'success';

function codeStation(status: ProjectStatus): ChainStation {
  const merged = status.code.signals.repos[0]?.mergedPullRequests ?? null;
  return merged === null
    ? { name: 'Code', verdict: 'unknown', value: DASH }
    : {
        name: 'Code',
        verdict: 'done',
        value: [{ text: `${merged} merged PRs`, href: href(status, 'pull-requests') }],
      };
}

/** A run with its state word only when it is red; passing is said once for both. */
function checkPart(status: ProjectStatus, run: WorkflowSignal): HeroValuePart[] {
  return [
    { text: run.workflow, href: href(status, 'workflow-run', run.workflow) },
    ...(failing(run.conclusion) ? [{ text: ' failing', failed: true }] : []),
  ];
}

const joined = (groups: HeroValuePart[][]): HeroValuePart[] =>
  groups.flatMap((group, index) => (index ? [SEPARATOR, ...group] : group));

const checkRuns = (status: ProjectStatus): (WorkflowSignal | undefined)[] =>
  (['tests', 'scan'] as const).map((kind) =>
    status.checks.signals.workflows.find((run) => run.kind === kind),
  );

// A known red stays visible even when the other check has no result.
function checksStation(status: ProjectStatus): ChainStation {
  const name = 'Tests & Security';
  const runs = checkRuns(status);
  const known = runs.filter((run): run is WorkflowSignal => !!run);
  const red = known.some((run) => failing(run.conclusion));
  const unknown = !red && runs.some((run) => !run?.conclusion);
  if (unknown) return { name, verdict: 'unknown', value: DASH };
  const value = joined(known.map((run) => checkPart(status, run)));
  return { name, verdict: red ? 'failed' : 'done', value: red ? value : [...value, PASSING] };
}

// Same rule as the cards: an SBOM is only named when the collector could read one.
function sbomPart(status: ProjectStatus): HeroValuePart[] {
  const link = href(status, 'sbom');
  const readable = status.supplyChain.signals.repos[0]?.sbom.reachable && link;
  return readable ? [SEPARATOR, { text: 'SBOM', href: link }] : [];
}

function buildStation(status: ProjectStatus): ChainStation {
  const name = 'Signed Build';
  const count = status.supplyChain.signals.repos[0]?.attestation?.provenanceCount ?? null;
  if (count === null) return { name, verdict: 'unknown', value: DASH };
  return {
    name,
    verdict: count > 0 ? 'done' : 'failed',
    value: [
      { text: 'Attestation', href: href(status, 'attestations') },
      ...(count > 0 ? [] : [{ text: ' failing', failed: true }]),
      ...sbomPart(status),
    ],
  };
}

function previewJob(status: ProjectStatus): WorkflowSignal | undefined {
  return status.checks.signals.workflows.find((run) => run.kind === 'deploy');
}

function previewStation(status: ProjectStatus): ChainStation {
  const name = 'Preview';
  const job = previewJob(status);
  if (!job?.conclusion) return { name, verdict: 'unknown', value: DASH };
  const link = href(status, 'workflow-run', job.workflow);
  // The job result does not tell which step failed, so only success names the smoke test.
  return failing(job.conclusion)
    ? { name, verdict: 'failed', value: [{ text: 'Deploy failing', href: link, failed: true }] }
    : { name, verdict: 'done', value: [{ text: 'Smoke test passing', href: link }] };
}

function productionValue(status: ProjectStatus): { sha: string | null; value: HeroValuePart[] } {
  const sha = status.live.signals.components[0]?.deployedSha ?? null;
  return sha
    ? { sha, value: [{ text: shortSha(sha), href: href(status, 'version-endpoint') }] }
    : { sha: null, value: DASH };
}

// Rounded down: an outage within the day must never read as a full 100 %. The inner rounding
// only removes the float error, so 0.29 stays 29 and does not become 28.99.
const uptimePercent = (share: number): number => Math.floor(Math.round(share * 1e6) / 100) / 100;

function monitoringValue(status: ProjectStatus): { up: boolean | null; value: HeroValuePart[] } {
  const { monitorsTotal, monitorsUp, uptime24h } = status.stability.signals;
  // No monitor counted is no measurement, as in stabilityProofs of the cards.
  if (!status.stability.reachable || !monitorsTotal || monitorsUp === null) {
    return { up: null, value: DASH };
  }
  const link = href(status, 'status-page');
  if (monitorsUp < monitorsTotal) {
    return { up: false, value: [{ text: 'down', href: link, failed: true }] };
  }
  // DRAFT: "up" stands where Kuma has no uptime yet.
  const text = uptime24h === null ? 'up' : `Uptime ${uptimePercent(uptime24h)} %`;
  return { up: true, value: [{ text, href: link }] };
}

const station = (name: string, state: HeroStationState, value: HeroValuePart[]): HeroStation => ({
  name,
  state,
  value,
});

const STILL_STATIONS: HeroStation[] = [
  station('Code', 'held', [{ text: 'Repository', href: repositoryUrl }]),
  // DRAFT: "Workflows" links the runs while no result can be read.
  station('Tests & Security', 'held', [{ text: 'Workflows', href: `${repositoryUrl}/actions` }]),
  station('Signed Build', 'held', [
    { text: 'Attestation', href: `${repositoryUrl}/attestations` },
    SEPARATOR,
    { text: 'SBOM', href: `${repositoryUrl}/network/dependencies` },
  ]),
  station('Preview', 'held', DASH),
  station('Production', 'held', DASH),
  station('Monitoring', 'held', DASH),
];

/** No status at all: the stations only link where the proofs live. */
function stillPipeline(): HeroPipeline {
  return { stations: STILL_STATIONS, reached: -1, note: NOT_AVAILABLE, still: true };
}

/** Everything the status says about the six stations, read once. */
interface Facts {
  status: ProjectStatus;
  chain: ChainStation[];
  production: ReturnType<typeof productionValue>;
  monitoring: ReturnType<typeof monitoringValue>;
}

function readFacts(status: ProjectStatus): Facts {
  const chain = [codeStation(status), checksStation(status), buildStation(status)];
  return {
    status,
    chain: [...chain, previewStation(status)],
    production: productionValue(status),
    monitoring: monitoringValue(status),
  };
}

/** Production and Monitoring stand apart from the run until it reaches them. */
const heldTail = ({ production, monitoring }: Facts): HeroStation[] => [
  station('Production', 'held', production.value),
  station('Monitoring', 'held', monitoring.value),
];

const doneChain = ({ chain }: Facts): HeroStation[] =>
  chain.map((item) => station(item.name, 'done', item.value));

function stoppedStation(item: ChainStation, index: number, stop: number): HeroStation {
  if (index < stop) return station(item.name, 'done', item.value);
  if (index === stop && item.verdict === 'failed') return station(item.name, 'failed', item.value);
  return station(item.name, 'open', DASH);
}

function stopNote(stopped: ChainStation, sha: string | null): string {
  if (stopped.verdict !== 'failed') return NOT_AVAILABLE;
  if (sha) return `Gestoppt bei ${stopped.name}, Production bleibt auf ${shortSha(sha)}.`;
  // DRAFT: the stop without a version that can be read online.
  return `Gestoppt bei ${stopped.name}.`;
}

/** A station is red or cannot be read: the run stops there, the rest is not reached. */
function stoppedPipeline(facts: Facts, stop: number): HeroPipeline {
  const stopped = facts.chain[stop];
  const chain = facts.chain.map((item, index) => stoppedStation(item, index, stop));
  return {
    stations: [...chain, ...heldTail(facts)],
    reached: stopped.verdict === 'failed' ? stop : stop - 1,
    note: stopNote(stopped, facts.production.sha),
    still: false,
  };
}

/** Preview is proven, Production does not run its commit yet. Nothing is red. */
function waitingPipeline(facts: Facts): HeroPipeline {
  const { sha } = facts.production;
  return {
    stations: [...doneChain(facts), ...heldTail(facts)],
    reached: facts.chain.length - 1,
    note: sha ? `Production wartet auf Freigabe, online ist ${shortSha(sha)}.` : NOT_AVAILABLE,
    still: false,
  };
}

const monitoringState = (up: boolean | null): HeroStationState =>
  up === null ? 'held' : up ? 'done' : 'failed';

/** Production runs the proven commit; Monitoring decides how the run ends. */
function finishedPipeline(facts: Facts): HeroPipeline {
  const { up, value } = facts.monitoring;
  const production = station('Production', 'done', facts.production.value);
  return {
    stations: [...doneChain(facts), production, station('Monitoring', monitoringState(up), value)],
    reached: facts.chain.length + (up === null ? 0 : 1),
    note: up === false ? 'Monitoring meldet einen Ausfall.' : null,
    still: false,
  };
}

function runsPreview({ status, production }: Facts): boolean {
  const previewSha = previewJob(status)?.headSha ?? null;
  return Boolean(production.sha && previewSha?.startsWith(production.sha));
}

export function buildHeroPipeline(snapshot: ProjectSnapshot | null): HeroPipeline {
  if (!snapshot) return stillPipeline();
  const facts = readFacts(snapshot.status);
  const stop = facts.chain.findIndex((item) => item.verdict !== 'done');
  if (stop >= 0) return stoppedPipeline(facts, stop);
  return runsPreview(facts) ? finishedPipeline(facts) : waitingPipeline(facts);
}
