import {
  afterNextRender,
  inject,
  Injectable,
  Injector,
  makeStateKey,
  signal,
  Signal,
  TransferState,
  untracked,
  WritableSignal,
} from '@angular/core';
import {
  parseStatusDocument,
  pickNewerSnapshot,
  pickProjectSnapshot,
  ProjectSnapshot,
  statusNotice,
} from '../../content/software-delivery';
import { ProjectKey, StatusDocument } from '../../content/status';
import { STATUS_SNAPSHOT } from './status-snapshot';

async function fetchStatusDocument(): Promise<StatusDocument | null> {
  try {
    const response = await fetch('/status.json', { cache: 'no-cache' });
    return response.ok ? parseStatusDocument(await response.text()) : null;
  } catch {
    return null;
  }
}

/** The status of all cards of a page: one request, one notice. */
@Injectable({ providedIn: 'root' })
export class DeliveryStatus {
  private readonly buildDocument = inject(STATUS_SNAPSHOT);
  private readonly transferState = inject(TransferState);
  private readonly injector = inject(Injector);
  private readonly snapshots = new Map<ProjectKey, WritableSignal<ProjectSnapshot | null>>();
  private readonly noticeText = signal<string | null>(null);
  private fetched: StatusDocument | null = null;
  private refreshPlanned = false;

  /** Text for the single role="status" line of the page, null when all is fine. */
  readonly notice: Signal<string | null> = this.noticeText.asReadonly();

  /** Snapshot of one project: from the prerender first, then the newer one from /status.json. */
  snapshot(project: ProjectKey): Signal<ProjectSnapshot | null> {
    this.planRefresh();
    let current = this.snapshots.get(project);
    if (!current) {
      current = signal(this.initialSnapshot(project));
      this.snapshots.set(project, current);
    }
    return current.asReadonly();
  }

  private initialSnapshot(project: ProjectKey): ProjectSnapshot | null {
    const key = makeStateKey<ProjectSnapshot | null>(`status-snapshot-${project}`);
    const fromBuild = pickProjectSnapshot(this.buildDocument, project);
    if (fromBuild) this.transferState.set(key, fromBuild);
    const handedOver = this.transferState.get(key, null);
    return pickNewerSnapshot(handedOver, pickProjectSnapshot(this.fetched, project));
  }

  // Cards ask from a computed, and render hooks must not be registered in a reactive context.
  private planRefresh(): void {
    if (this.refreshPlanned) return;
    this.refreshPlanned = true;
    // Browser only and after hydration, so it cannot differ from the prerendered page.
    untracked(() => afterNextRender(() => void this.refresh(), { injector: this.injector }));
  }

  private async refresh(): Promise<void> {
    this.fetched = await fetchStatusDocument();
    for (const [project, current] of this.snapshots) {
      current.set(pickNewerSnapshot(current(), pickProjectSnapshot(this.fetched, project)));
    }
    this.noticeText.set(statusNotice(this.fetched !== null, this.oldestShown(), new Date()));
  }

  private oldestShown(): string | null {
    const times = [...this.snapshots.values()].flatMap((current) => current()?.generatedAt ?? []);
    return times.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  }
}
