import {
  afterNextRender,
  computed,
  DestroyRef,
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
  shownTime,
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

/** A project a page shows; without a page it counts for the whole life of the app. */
interface Ask {
  current: Signal<ProjectSnapshot | null>;
  page: DestroyRef | null;
}

/** The status of all cards of a page: one request, one notice. */
@Injectable({ providedIn: 'root' })
export class DeliveryStatus {
  private readonly buildDocument = inject(STATUS_SNAPSHOT);
  private readonly transferState = inject(TransferState);
  private readonly injector = inject(Injector);
  private readonly snapshots = new Map<ProjectKey, WritableSignal<ProjectSnapshot | null>>();
  private readonly asks = signal<readonly Ask[]>([]);
  private readonly refreshed = signal<boolean | null>(null);
  private fetched: StatusDocument | null = null;
  private refreshPlanned = false;

  /** Text for the single role="status" line of the page, null when all is fine. */
  readonly notice: Signal<string | null> = computed(() => {
    const shown = this.asks().map((ask) => ask.current());
    const refreshed = this.refreshed();
    if (refreshed === null || shown.length === 0) return null;
    return statusNotice(refreshed, shownTime(shown), new Date());
  });

  /**
   * Snapshot of one project: from the prerender first, then the newer one from /status.json.
   * With a page the project counts for the notice only until that page is destroyed.
   */
  snapshot(project: ProjectKey, page?: DestroyRef): Signal<ProjectSnapshot | null> {
    this.planRefresh();
    let current = this.snapshots.get(project);
    if (!current) {
      current = signal(this.initialSnapshot(project));
      this.snapshots.set(project, current);
    }
    this.countAsShown(current, page ?? null);
    return current.asReadonly();
  }

  // Cards ask from a computed, and signals must not be written in a reactive context.
  private countAsShown(current: Ask['current'], page: Ask['page']): void {
    untracked(() => {
      if (this.asks().some((ask) => ask.current === current && ask.page === page)) return;
      const shown: Ask = { current, page };
      this.asks.update((asks) => [...asks, shown]);
      page?.onDestroy(() => this.asks.update((asks) => asks.filter((ask) => ask !== shown)));
    });
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
    this.refreshed.set(this.fetched !== null);
  }
}
