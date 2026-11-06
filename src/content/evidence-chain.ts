// Pure logic and texts of the evidence chain (DECISIONS 2026-11-03): turns the public status.json
// into what the page shows. A station counts as verified only if its data proves it.
import {
  LinkKind,
  ProjectKey,
  ProjectStatus,
  STATUS_SCHEMA_VERSION,
  StationKey,
  StatusDocument,
  StatusLink,
} from './status';

export type StationState = 'verified' | 'deviation' | 'unavailable' | 'notPlanned';

/** One project out of status.json, so a page never carries the data of the other project. */
export interface ProjectSnapshot {
  generatedAt: string;
  status: ProjectStatus;
}

export interface EvidenceLink {
  label: string;
  url: string;
}

export interface EvidenceStation {
  key: StationKey;
  title: string;
  state: StationState;
  sentence: string;
  facts: string[];
  links: EvidenceLink[];
}

export interface EvidenceChainView {
  verifiedCount: number;
  total: number;
  generatedAt: string | null;
  /** Oldest visible heartbeat: a lower bound, so it must never read as "running since". */
  historySince: string | null;
  stations: EvidenceStation[];
}

const STATIONS: StationKey[] = ['code', 'checks', 'supplyChain', 'live', 'stability', 'restore'];
const PROJECTS: ProjectKey[] = ['videoflix', 'portfolio'];
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const NOT_AVAILABLE = 'nicht abrufbar';

// DRAFT: all texts of the evidence chain, wording to be approved.
export const evidenceTexts = {
  title: 'Nachweiskette',
  intro:
    'Was an diesem Projekt öffentlich nachprüfbar ist. Der Stand wird automatisch erhoben und zeigt auch, was gerade fehlt.',
  verifiedOf: 'belegt',
  of: 'von',
  historySince: 'Verlauf sichtbar seit',
  generatedAt: 'Stand',
  unknownTime: 'unbekannt',
  refreshFailed: 'Der aktuelle Stand ist gerade nicht abrufbar.',
  stale: 'Dieser Stand ist älter als einen Tag.',
  docs: 'Hintergründe in der technischen Dokumentation',
  artifacts: 'Öffentliche Nachweise',
  stateLabels: {
    verified: 'Belegt',
    deviation: 'Abweichung',
    unavailable: 'Nicht abrufbar',
    notPlanned: 'Nicht vorgesehen',
  } satisfies Record<StationState, string>,
  stateSymbols: {
    verified: '✓',
    deviation: '!',
    unavailable: '?',
    notPlanned: '–',
  } satisfies Record<StationState, string>,
};

const stationTexts: Record<StationKey, { title: string; verified: string; deviation: string }> = {
  code: {
    title: 'Code',
    verified: 'Änderungen laufen per Pull Request über einen geschützten Hauptzweig.',
    deviation: 'Der Schutz des Hauptzweigs ist nicht durchgängig aktiv.',
  },
  checks: {
    title: 'Geprüft',
    verified: 'Tests und Sicherheitsscans liefen zuletzt erfolgreich.',
    deviation: 'Mindestens eine Prüfung lief zuletzt nicht erfolgreich.',
  },
  supplyChain: {
    title: 'Sicher gebaut',
    verified: 'Herkunft, Abhängigkeiten und Sicherheitsbewertung sind öffentlich nachprüfbar.',
    deviation: 'Für den gebauten Stand fehlt ein Herkunftsnachweis.',
  },
  live: {
    title: 'Live = geprüfter Stand',
    verified: 'Die laufende Version ist der zuletzt erfolgreich geprüfte Commit.',
    deviation: 'Die laufende Version weicht vom zuletzt geprüften Commit ab.',
  },
  stability: {
    title: 'Läuft stabil',
    verified: 'Alle überwachten Dienste sind erreichbar.',
    deviation: 'Mindestens ein überwachter Dienst ist gerade nicht erreichbar.',
  },
  restore: {
    title: 'Wiederherstellung getestet',
    verified: 'Die Wiederherstellung aus dem Backup wurde getestet.',
    deviation: 'Der letzte Wiederherstellungstest ist fehlgeschlagen.',
  },
};

const UNAVAILABLE_SENTENCE = 'Dieser Nachweis ist gerade nicht abrufbar.';
const NO_DATA = 'Keine Daten abrufbar';

/** Stations a project does not have on purpose. They never count as verified. */
const notPlanned: Partial<Record<ProjectKey, Partial<Record<StationKey, string>>>> = {
  portfolio: {
    restore:
      'Statische Seite ohne eigene Daten: Sie entsteht jederzeit neu aus dem Repository, ein Test mit Backup entfällt.',
  },
};

const linkLabels: Record<LinkKind, string> = {
  repository: 'Repository',
  'pull-requests': 'Pull Requests',
  'workflow-run': 'Prüflauf',
  attestations: 'Herkunftsnachweise',
  sbom: 'SBOM',
  scorecard: 'Scorecard',
  'version-endpoint': 'Versionsdatei',
  'status-page': 'Statusseite',
  'restore-test': 'Wiederherstellungstest',
  runbook: 'Runbook',
};

// Fixed time zone, so the prerendered page and the browser render the same text.
const timeFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

const formatTime = (value: string) => timeFormat.format(new Date(value));
const formatDate = (value: string) => dateFormat.format(new Date(value));
const shortName = (source: string) => source.split('/').pop() ?? source;
const shortSha = (sha: string | null) => sha?.slice(0, 7) ?? NOT_AVAILABLE;
const percent = (value: number | null) =>
  value === null ? NOT_AVAILABLE : `${numberFormat.format(value * 100)} %`;

// A problem that is proven by the data, even if another source of the station is missing.
const deviations: Record<StationKey, (status: ProjectStatus) => boolean> = {
  code: ({ code }) =>
    code.signals.repos.some(
      (repo) =>
        repo.reachable &&
        (repo.isPublic === false || (repo.rulesets !== null && !isProtected(repo.rulesets))),
    ),
  checks: ({ checks }) =>
    checks.signals.workflows.some(
      (workflow) =>
        workflow.reachable && workflow.conclusion !== null && workflow.conclusion !== 'success',
    ),
  supplyChain: ({ supplyChain }) =>
    supplyChain.signals.repos.some((repo) => repo.attestation?.provenanceCount === 0),
  live: ({ live }) =>
    live.signals.components.some((component) => component.matchesLatestGreen === false),
  stability: ({ stability: { signals } }) =>
    signals.monitorsUp !== null &&
    signals.monitorsTotal !== null &&
    signals.monitorsUp < signals.monitorsTotal,
  restore: ({ restore }) => restore.signals.result === 'failed',
};

// What "reachable" alone does not prove.
const proofs: Partial<Record<StationKey, (status: ProjectStatus) => boolean>> = {
  live: ({ live }) =>
    live.signals.components.every((component) => component.matchesLatestGreen === true),
  stability: ({ stability }) => (stability.signals.monitorsTotal ?? 0) > 0,
  restore: ({ restore }) => restore.signals.testedAt !== null,
};

function isProtected(rulesets: ProjectStatus['code']['signals']['repos'][number]['rulesets']) {
  return (rulesets ?? []).some(
    (ruleset) => ruleset.enforcement === 'active' && ruleset.appliesToDefaultBranch,
  );
}

const factBuilders: Record<StationKey, (status: ProjectStatus) => string[]> = {
  code: ({ code }) => code.signals.repos.map(codeFact),
  checks: ({ checks }) => checks.signals.workflows.map(checkFact),
  supplyChain: ({ supplyChain }) => supplyChain.signals.repos.map(supplyChainFact),
  live: ({ live }) => live.signals.components.map(liveFact),
  stability: ({ stability }) => (stability.reachable ? stabilityFacts(stability.signals) : []),
  restore: ({ restore }) => restoreFacts(restore.signals),
};

function codeFact(repo: ProjectStatus['code']['signals']['repos'][number]): string {
  const name = shortName(repo.repo);
  if (!repo.reachable) return `${name}: ${NOT_AVAILABLE}`;
  const protection = isProtected(repo.rulesets) ? 'geschützt' : 'nicht geschützt';
  return `${name}: ${repo.mergedPullRequests} gemergte Pull Requests, Hauptzweig ${protection}`;
}

function checkFact(workflow: ProjectStatus['checks']['signals']['workflows'][number]): string {
  const name = `${shortName(workflow.repo)}, ${workflow.workflow}`;
  if (!workflow.reachable) return `${name}: ${NOT_AVAILABLE}`;
  const result = workflow.conclusion === 'success' ? 'erfolgreich' : 'nicht erfolgreich';
  const time = workflow.completedAt ? formatTime(workflow.completedAt) : NOT_AVAILABLE;
  return `${name}: ${result}, ${time}, Commit ${shortSha(workflow.headSha)}`;
}

function attestationFact(
  attestation: ProjectStatus['supplyChain']['signals']['repos'][number]['attestation'],
): string[] {
  if (attestation === null) return [];
  if (!attestation.reachable) return [`Herkunftsnachweis ${NOT_AVAILABLE}`];
  const count = attestation.provenanceCount;
  return [count === 1 ? '1 Herkunftsnachweis' : `${count} Herkunftsnachweise`];
}

function supplyChainFact(repo: ProjectStatus['supplyChain']['signals']['repos'][number]): string {
  const { attestation, sbom, scorecard } = repo;
  const parts = [
    ...attestationFact(attestation),
    sbom.reachable ? `SBOM mit ${sbom.packageCount} Paketen` : `SBOM ${NOT_AVAILABLE}`,
    scorecard.reachable && scorecard.score !== null
      ? `Scorecard ${numberFormat.format(scorecard.score)}`
      : `Scorecard ${NOT_AVAILABLE}`,
  ];
  return `${shortName(repo.repo)}: ${parts.join(', ')}`;
}

function liveFact(component: ProjectStatus['live']['signals']['components'][number]): string {
  if (!component.reachable) return `${component.component}: ${NOT_AVAILABLE}`;
  const built = component.builtAt ? formatTime(component.builtAt) : NOT_AVAILABLE;
  const comparison =
    component.matchesLatestGreen === null
      ? 'kein Abgleich möglich'
      : component.matchesLatestGreen
        ? 'entspricht dem letzten grünen Stand'
        : 'weicht vom letzten grünen Stand ab';
  return `${component.component}: Commit ${shortSha(component.deployedSha)}, gebaut ${built}, ${comparison}`;
}

function stabilityFacts(signals: ProjectStatus['stability']['signals']): string[] {
  return [
    `${signals.monitorsUp} von ${signals.monitorsTotal} Diensten erreichbar`,
    `Verfügbarkeit 24 Stunden: ${percent(signals.uptime24h)}, 30 Tage: ${percent(signals.uptime30d)}`,
  ];
}

function restoreFacts({ testedAt, result }: ProjectStatus['restore']['signals']): string[] {
  if (testedAt === null) return [];
  const labels = { passed: 'bestanden', failed: 'fehlgeschlagen' };
  return [`Getestet am ${formatDate(testedAt)}, Ergebnis: ${result ? labels[result] : 'offen'}`];
}

function stationState(status: ProjectStatus, key: StationKey): StationState {
  if (deviations[key](status)) return 'deviation';
  const proven = proofs[key]?.(status) ?? true;
  return status[key].reachable && proven ? 'verified' : 'unavailable';
}

function toEvidenceLinks(links: StatusLink[]): EvidenceLink[] {
  const safe = links.filter((link) => link.url.startsWith('https://'));
  const sameKind = (link: StatusLink) =>
    safe.filter((other) => other.kind === link.kind && other.source === link.source);
  return safe.map((link) => {
    const siblings = sameKind(link);
    const number = siblings.length > 1 ? ` ${siblings.indexOf(link) + 1}` : '';
    return {
      label: `${linkLabels[link.kind]}${number} (${shortName(link.source)})`,
      url: link.url,
    };
  });
}

function measuredStation(status: ProjectStatus | null, key: StationKey): EvidenceStation {
  const { title, verified, deviation } = stationTexts[key];
  const state = status ? stationState(status, key) : 'unavailable';
  const sentences = { verified, deviation, unavailable: UNAVAILABLE_SENTENCE, notPlanned: '' };
  const facts = status ? factBuilders[key](status) : [];
  return {
    key,
    title,
    state,
    sentence: sentences[state],
    facts: facts.length > 0 ? facts : [NO_DATA],
    links: status ? toEvidenceLinks(status[key].links) : [],
  };
}

function buildStation(
  status: ProjectStatus | null,
  project: ProjectKey,
  key: StationKey,
): EvidenceStation {
  const planned = notPlanned[project]?.[key];
  return planned
    ? {
        key,
        title: stationTexts[key].title,
        state: 'notPlanned',
        sentence: planned,
        facts: [],
        links: [],
      }
    : measuredStation(status, key);
}

export function buildEvidenceChain(
  snapshot: ProjectSnapshot | null,
  project: ProjectKey,
): EvidenceChainView {
  const status = snapshot?.status ?? null;
  const stations = STATIONS.map((key) => buildStation(status, project, key));
  const oldest = status?.stability.signals.oldestVisibleHeartbeatAt ?? null;
  return {
    verifiedCount: stations.filter((station) => station.state === 'verified').length,
    total: STATIONS.length,
    generatedAt: snapshot ? formatTime(snapshot.generatedAt) : null,
    historySince: oldest ? formatDate(oldest) : null,
    stations,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidStation(station: unknown): boolean {
  return (
    isObject(station) &&
    typeof station['reachable'] === 'boolean' &&
    isObject(station['signals']) &&
    Array.isArray(station['links'])
  );
}

function hasAllStations(project: unknown): boolean {
  return isObject(project) && STATIONS.every((key) => isValidStation(project[key]));
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
  if (!isObject(projects)) return null;
  return PROJECTS.every((key) => hasAllStations(projects[key]))
    ? (document as unknown as StatusDocument)
    : null;
}

export function pickProjectSnapshot(
  document: StatusDocument | null,
  project: ProjectKey,
): ProjectSnapshot | null {
  return document && { generatedAt: document.generatedAt, status: document.projects[project] };
}

export function isStale(generatedAt: string, now: Date): boolean {
  return now.getTime() - Date.parse(generatedAt) > STALE_AFTER_MS;
}
