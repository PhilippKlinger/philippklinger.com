// The delivery chain of this website for the hero. Pure: the status decides every state and every
// value, so the animation can never show a fact the status does not hold.
import { ProjectSnapshot } from './software-delivery';
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

const REPO_URL = 'https://github.com/PhilippKlinger/philippklinger.com';
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
  const percent = uptime24h === null ? null : Number((uptime24h * 100).toFixed(2));
  return {
    up: true,
    value: [{ text: percent === null ? 'up' : `Uptime ${percent} %`, href: link }],
  };
}

function stillPipeline(): HeroPipeline {
  const held = (name: string, value: HeroValuePart[]): HeroStation => ({
    name,
    state: 'held',
    value,
  });
  return {
    stations: [
      held('Code', [{ text: 'Repository', href: REPO_URL }]),
      held('Tests & Security', [{ text: 'Workflows', href: `${REPO_URL}/actions` }]),
      held('Signed Build', [
        { text: 'Attestation', href: `${REPO_URL}/attestations` },
        SEPARATOR,
        { text: 'SBOM', href: `${REPO_URL}/network/dependencies` },
      ]),
      held('Preview', DASH),
      held('Production', DASH),
      held('Monitoring', DASH),
    ],
    reached: -1,
    note: NOT_AVAILABLE,
    still: true,
  };
}

export function buildHeroPipeline(snapshot: ProjectSnapshot | null): HeroPipeline {
  if (!snapshot) return stillPipeline();
  const { status } = snapshot;

  const chain = [
    codeStation(status),
    checksStation(status),
    buildStation(status),
    previewStation(status),
  ];
  const production = productionValue(status);
  const monitoring = monitoringValue(status);
  const named = (name: string, state: HeroStationState, value: HeroValuePart[]): HeroStation => ({
    name,
    state,
    value,
  });
  const held = [
    named('Production', 'held', production.value),
    named('Monitoring', 'held', monitoring.value),
  ];

  const stop = chain.findIndex((station) => station.verdict !== 'done');
  if (stop >= 0) {
    const failed = chain[stop].verdict === 'failed';
    const stopped = chain[stop].name;
    return {
      stations: [
        ...chain.map((station, index) => {
          if (index < stop) return named(station.name, 'done', station.value);
          if (index === stop && failed) return named(station.name, 'failed', station.value);
          return named(station.name, 'open', DASH);
        }),
        ...held,
      ],
      reached: failed ? stop : stop - 1,
      note: !failed
        ? NOT_AVAILABLE
        : production.sha
          ? `Gestoppt bei ${stopped}, Production bleibt auf ${shortSha(production.sha)}.`
          : `Gestoppt bei ${stopped}.`,
      still: false,
    };
  }

  const done = chain.map((station) => named(station.name, 'done', station.value));
  const previewSha = previewJob(status)?.headSha ?? null;
  const current = Boolean(production.sha && previewSha?.startsWith(production.sha));
  if (!current) {
    return {
      stations: [...done, ...held],
      reached: chain.length - 1,
      note: production.sha
        ? `Production wartet auf Freigabe, online ist ${shortSha(production.sha)}.`
        : NOT_AVAILABLE,
      still: false,
    };
  }

  const productionDone = named('Production', 'done', production.value);
  if (monitoring.up === null) {
    return {
      stations: [...done, productionDone, held[1]],
      reached: chain.length,
      note: null,
      still: false,
    };
  }
  return {
    stations: [
      ...done,
      productionDone,
      named('Monitoring', monitoring.up ? 'done' : 'failed', monitoring.value),
    ],
    reached: chain.length + 1,
    note: monitoring.up ? null : 'Monitoring meldet einen Ausfall.',
    still: false,
  };
}
