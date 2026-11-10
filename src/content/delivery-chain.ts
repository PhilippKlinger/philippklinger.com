// Pure logic of the chain on the project page: per station a short value and a small table per
// repository or component. Every value comes from the plan or from status.json, every link from
// the links of the same station; state and sentence come from the delivery view.
import {
  buildDeliveryView,
  builtRepos,
  capitalize,
  dayFormat,
  dayTimeFormat,
  DeliveryPlan,
  DeliveryStepPlan,
  DeliveryStepView,
  FixedStep,
  formatTime,
  isMeasured,
  MeasuredStep,
  oneDecimal,
  present,
  ProjectSnapshot,
  runProof,
  runsOf,
  shortSha,
  StepSource,
  StepState,
  unique,
} from './software-delivery';
import {
  DIGEST,
  LinkKind,
  LiveComponentSignal,
  ProjectStatus,
  RepoSupplyChainSignal,
  StationKey,
  StatusLink,
  WorkflowSignal,
} from './status';

export interface ChainCell {
  text: string;
  url?: string;
  sha?: string;
  ok?: boolean;
}

export interface ChainTable {
  head: string[];
  rows: ChainCell[][];
}

export interface ChainStation {
  name: string;
  /** Label of the transition to the next station, from the plan's arrowToNext. */
  toNext: string | null;
  state: StepState;
  /** Short value under the name, e.g. "121 merged PRs". */
  value: string;
  sentence: string;
  table: ChainTable | null;
  /** gh attestation verify command for the first attested image, else null. */
  verify: string | null;
}

export interface ChainView {
  stand: string | null;
  repoCount: number;
  stations: ChainStation[];
}

type Content = Pick<ChainStation, 'value' | 'table' | 'verify'>;

interface Context {
  plan: DeliveryPlan;
  step: MeasuredStep;
}

interface Source {
  value: (status: ProjectStatus) => string | null;
  table: (status: ProjectStatus, context: Context) => ChainTable | null;
}

// DRAFT: all values, cell texts and column heads below, wording to be approved.
const NO_DATA = 'nicht abrufbar';
const VALUE_WITHOUT_DATA: Partial<Record<StepState, string>> = {
  notSetUp: 'noch nicht eingerichtet',
  unavailable: NO_DATA,
  private: 'Code privat',
};
const RESTORE_RESULT = { passed: 'bestanden', failed: 'fehlgeschlagen' } as const;
const EMPTY: ChainCell = { text: '—' };
const IMAGE_NAME = /^[a-z0-9][a-z0-9._-]*$/;
const REPO = /^[\w.-]+\/[\w.-]+$/;

/** Deploy runs and the image belong to the station that shows them. */
const STATION_OF: Record<StepSource, StationKey> = {
  code: 'code',
  checks: 'checks',
  supplyChain: 'supplyChain',
  image: 'supplyChain',
  live: 'live',
  deployRun: 'live',
  stability: 'stability',
  restore: 'restore',
};

const repoName = (repo: string) => repo.split('/').at(-1) ?? repo;
const labelOf = (plan: DeliveryPlan, repo: string) => plan.repoLabels?.[repo] ?? repoName(repo);
const textCell = (text: string | null): ChainCell => (text === null ? EMPTY : { text });
const percent = (ratio: number | null) =>
  ratio === null ? null : `${oneDecimal.format(ratio * 100)} %`;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** No table without rows, so a station never shows an empty frame. */
const tableOf = (head: string[], rows: ChainCell[][]): ChainTable | null =>
  rows.length > 0 ? { head, rows } : null;

function linkOf(links: StatusLink[], kind: LinkKind, source?: string): StatusLink | undefined {
  return links.find(
    (link) =>
      link.kind === kind &&
      (source === undefined || link.source === source) &&
      link.url.startsWith('https://'),
  );
}

function linkCell(link: StatusLink | undefined, label: string): ChainCell {
  return link ? { text: label, url: link.url } : EMPTY;
}

function shaCell(sha: string | null | undefined): ChainCell {
  return sha ? { text: shortSha(sha), sha: shortSha(sha) } : EMPTY;
}

function valueOfCode(status: ProjectStatus): string | null {
  const counts = status.code.signals.repos.map((repo) => repo.mergedPullRequests).filter(present);
  return counts.length > 0 ? `${sum(counts)} merged PRs` : null;
}

function tableOfCode(status: ProjectStatus): ChainTable | null {
  const repos = status.code.signals.repos.filter((repo) => repo.mergedPullRequests !== null);
  const rows = repos.map((repo) => [
    { text: repoName(repo.repo) },
    { text: String(repo.mergedPullRequests) },
    linkCell(linkOf(status.code.links, 'pull-requests', repo.repo), 'PRs'),
  ]);
  return tableOf(['Repo', 'Merged PRs', ''], rows);
}

function valueOfChecks(status: ProjectStatus): string | null {
  const proofs = runsOf(status, 'check').map(runProof).filter(present);
  if (proofs.length === 0) return null;
  return `${proofs.filter((proof) => proof).length} von ${proofs.length} passing`;
}

function runLink(links: StatusLink[], run: WorkflowSignal): StatusLink | undefined {
  const runs = links.filter((link) => link.workflow === run.workflow);
  return linkOf(runs, 'workflow-run', run.repo);
}

function runCell(links: StatusLink[], run: WorkflowSignal | undefined): ChainCell {
  const proof = run ? runProof(run) : null;
  const day = run ? formatTime(dayFormat, run.completedAt) : null;
  if (!run || proof === null || day === null) return EMPTY;
  return { text: day, ok: proof, url: runLink(links, run)?.url };
}

/** One cell per workflow, then the commit the runs of this repository ran on. */
function runCells(links: StatusLink[], runs: WorkflowSignal[], workflows: string[]): ChainCell[] {
  return [
    ...workflows.map((name) =>
      runCell(
        links,
        runs.find((run) => run.workflow === name),
      ),
    ),
    shaCell(runs.find((run) => run.headSha)?.headSha),
  ];
}

/** A repository without any verdict has nothing to show, so it gets no row. */
function tableOfChecks(status: ProjectStatus, { plan }: Context): ChainTable | null {
  const runs = runsOf(status, 'check');
  const workflows = unique(runs.map((run) => run.workflow));
  const repos = unique(runs.filter((run) => runProof(run) !== null).map((run) => run.repo));
  const rows = repos.map((repo) => [
    { text: labelOf(plan, repo) },
    ...runCells(
      status.checks.links,
      runs.filter((run) => run.repo === repo),
      workflows,
    ),
  ]);
  return tableOf(['Repo', ...workflows, 'Commit'], rows);
}

function valueOfSupplyChain(status: ProjectStatus): string | null {
  const counts = builtRepos(status).map((repo) => repo.attestation?.provenanceCount ?? null);
  const known = counts.filter(present);
  if (known.length === 0) return null;
  const attested = known.filter((count) => count > 0).length;
  return attested === 1 ? '1 Image attestiert' : `${attested} Images attestiert`;
}

function shortDigest(digest: string): string {
  const [algorithm, hex = ''] = digest.split(':');
  return hex.length > 7 ? `${algorithm}:${hex.slice(0, 7)}…` : digest;
}

function scoreCell(links: StatusLink[], { repo, scorecard }: RepoSupplyChainSignal): ChainCell {
  if (scorecard.score === null) return EMPTY;
  const text = `${oneDecimal.format(scorecard.score)} / 10`;
  return { text, url: linkOf(links, 'scorecard', repo)?.url };
}

function imageRow(status: ProjectStatus, plan: DeliveryPlan, built: RepoSupplyChainSignal) {
  const { links } = status.supplyChain;
  const { repo, attestation, sbom } = built;
  return [
    { text: labelOf(plan, repo) },
    shaCell(attestation?.sourceSha),
    { text: shortDigest(attestation?.subjectDigest ?? ''), url: linkOf(links, 'image', repo)?.url },
    textCell(sbom.packageCount === null ? null : `${sbom.packageCount} Pakete`),
    scoreCell(links, built),
    linkCell(linkOf(links, 'attestations', repo), 'Attestierung'),
  ];
}

/** Only images with a digest get a row: without one no image is known at all. */
function tableOfSupplyChain(status: ProjectStatus, { plan }: Context): ChainTable | null {
  const images = builtRepos(status).filter((repo) => repo.attestation?.subjectDigest);
  return tableOf(
    ['Image', 'gebaut aus', 'Digest', 'SBOM', 'Scorecard', ''],
    images.map((repo) => imageRow(status, plan, repo)),
  );
}

/** Only parts of a known shape go into a command that readers copy into their shell. */
function verifyCommand(repo: string, name = '', digest = ''): string | null {
  if (!REPO.test(repo) || !IMAGE_NAME.test(name) || !DIGEST.test(digest)) return null;
  const image = `oci://ghcr.io/${repo.split('/')[0].toLowerCase()}/${name}@${digest}`;
  // Broken into lines as in a shell, so the command can be copied as it stands.
  return ['gh attestation verify', `  ${image}`, `  --repo ${repo}`].join(' \\\n');
}

function verifyOf(status: ProjectStatus): string | null {
  const { links } = status.supplyChain;
  const imageUrl = (repo: RepoSupplyChainSignal) => linkOf(links, 'image', repo.repo)?.url;
  const built = builtRepos(status).find(
    (repo) => repo.attestation?.subjectDigest && imageUrl(repo),
  );
  if (!built) return null;
  const name = imageUrl(built)?.split('/').at(-1);
  return verifyCommand(built.repo, name, built.attestation?.subjectDigest ?? undefined);
}

function valueOfLive(status: ProjectStatus): string | null {
  const results = status.live.signals.components.map((part) => part.matchesLatestGreen);
  if (results.includes(false)) return 'live ≠ geprüfter Stand';
  const matches = results.length > 0 && results.every((result) => result === true);
  return matches ? 'live = geprüfter Stand' : null;
}

function greenCell(part: LiveComponentSignal): ChainCell {
  const cell = shaCell(part.latestGreenSha);
  return part.latestGreenSha ? { ...cell, ok: part.matchesLatestGreen ?? undefined } : cell;
}

function componentRow(links: StatusLink[], part: LiveComponentSignal): ChainCell[] {
  const endpoint = linkOf(links, 'version-endpoint', part.component);
  const path = endpoint?.url.replace(/^https:\/\/[^/]+/, '') || '/';
  return [
    { text: capitalize(part.component) },
    shaCell(part.deployedSha),
    textCell(formatTime(dayTimeFormat, part.builtAt)),
    greenCell(part),
    linkCell(endpoint, path),
  ];
}

function deployRow(status: ProjectStatus, run: WorkflowSignal): ChainCell[] {
  const ok = runProof(run) === true;
  return [
    { text: 'Deploy-Lauf' },
    shaCell(run.headSha),
    textCell(formatTime(dayTimeFormat, run.completedAt)),
    { text: ok ? 'erfolgreich' : 'nicht erfolgreich', ok },
    linkCell(runLink(status.checks.links, run), 'Lauf'),
  ];
}

/** Components without a running commit and deploy runs without a verdict get no row. */
function tableOfLive(status: ProjectStatus, { step }: Context): ChainTable | null {
  const parts = status.live.signals.components.filter((part) => part.deployedSha !== null);
  const runs = step.sources.includes('deployRun') ? runsOf(status, 'deploy') : [];
  const rows = [
    ...parts.map((part) => componentRow(status.live.links, part)),
    ...runs.filter((run) => runProof(run) !== null).map((run) => deployRow(status, run)),
  ];
  return tableOf(['Komponente', 'läuft live', 'gebaut', 'letzter grüner CI-Lauf', ''], rows);
}

function valueOfStability({ stability }: ProjectStatus): string | null {
  const { monitorsTotal: total, monitorsUp: up } = stability.signals;
  return total && up !== null ? `${up} von ${total} up` : null;
}

function tableOfStability(status: ProjectStatus): ChainTable | null {
  const { signals, links } = status.stability;
  const row = [
    textCell(valueOfStability(status)),
    textCell(percent(signals.uptime24h)),
    { text: percent(signals.uptime30d) ?? 'noch zu kurz gemessen' },
    textCell(formatTime(dayTimeFormat, signals.lastHeartbeatAt)),
    linkCell(linkOf(links, 'status-page'), 'Statusseite'),
  ];
  return tableOf(['Monitore', '24 h', '30 Tage', 'letzter Heartbeat', ''], [row]);
}

function valueOfRestore({ restore }: ProjectStatus): string | null {
  const { result, testedAt } = restore.signals;
  const day = formatTime(dayFormat, testedAt);
  return result === null || day === null ? null : `${RESTORE_RESULT[result]} · ${day}`;
}

function tableOfRestore(status: ProjectStatus): ChainTable | null {
  const { signals, links } = status.restore;
  const { result } = signals;
  const row = [
    textCell(formatTime(dayFormat, signals.testedAt)),
    result === null ? EMPTY : { text: RESTORE_RESULT[result], ok: result === 'passed' },
    linkCell(linkOf(links, 'restore-test'), 'Protokoll'),
    linkCell(linkOf(links, 'runbook'), 'Runbook'),
  ];
  return tableOf(['zuletzt getestet', 'Ergebnis', '', ''], [row]);
}

const SOURCES: Record<StationKey, Source> = {
  code: { value: valueOfCode, table: tableOfCode },
  checks: { value: valueOfChecks, table: tableOfChecks },
  supplyChain: { value: valueOfSupplyChain, table: tableOfSupplyChain },
  live: { value: valueOfLive, table: tableOfLive },
  stability: { value: valueOfStability, table: tableOfStability },
  restore: { value: valueOfRestore, table: tableOfRestore },
};

function measuredContent(step: MeasuredStep, status: ProjectStatus, plan: DeliveryPlan): Content {
  const key = STATION_OF[step.sources[0]];
  return {
    value: SOURCES[key].value(status) ?? NO_DATA,
    table: SOURCES[key].table(status, { plan, step }),
    verify: key === 'supplyChain' ? verifyOf(status) : null,
  };
}

function fixedContent(step: FixedStep): Content {
  const row = (step.links ?? []).map((link) => ({ text: link.label, url: link.url }));
  const table = tableOf(
    row.map(() => ''),
    row.length > 0 ? [row] : [],
  );
  return { value: step.event ?? 'öffentlich', table, verify: null };
}

const noTable = (value: string): Content => ({ value, table: null, verify: null });

/** Without data a station shows its state in words, never a table or a command. */
function contentOf(
  step: DeliveryStepPlan,
  state: StepState,
  status: ProjectStatus | null,
  plan: DeliveryPlan,
): Content {
  const withoutData = VALUE_WITHOUT_DATA[state];
  if (withoutData) return noTable(withoutData);
  if (!isMeasured(step)) return fixedContent(step);
  return status ? measuredContent(step, status, plan) : noTable(NO_DATA);
}

function stationOf(
  step: DeliveryStepPlan,
  view: DeliveryStepView,
  status: ProjectStatus | null,
  plan: DeliveryPlan,
): ChainStation {
  const { name, arrowToNext: toNext, state, sentence } = view;
  return { name, toNext, state, sentence, ...contentOf(step, state, status, plan) };
}

function standOf(snapshot: ProjectSnapshot | null): string | null {
  const time = snapshot && formatTime(dayTimeFormat, snapshot.generatedAt);
  return time ? `Stand ${time}` : null;
}

export function buildChainView(plan: DeliveryPlan, snapshot: ProjectSnapshot | null): ChainView {
  const status = snapshot?.status ?? null;
  const { steps } = buildDeliveryView(plan, snapshot);
  return {
    stand: standOf(snapshot),
    repoCount: status?.code.signals.repos.length ?? 0,
    stations: plan.steps.map((step, index) => stationOf(step, steps[index], status, plan)),
  };
}
