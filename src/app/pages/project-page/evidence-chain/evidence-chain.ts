import {
  afterNextRender,
  Component,
  computed,
  inject,
  InjectionToken,
  input,
  makeStateKey,
  OnInit,
  signal,
  TransferState,
} from '@angular/core';
import { buildEvidenceChain, evidenceTexts } from '../../../../content/evidence-chain';
import { docsUrl } from '../../../../content/site';
import {
  isStale,
  parseStatusDocument,
  pickProjectSnapshot,
  ProjectSnapshot,
} from '../../../../content/software-delivery';
import { ProjectKey, StatusDocument } from '../../../../content/status';

/** status.json of the build. Only the prerender provides it (app.config.server.ts). */
export const STATUS_SNAPSHOT = new InjectionToken<StatusDocument | null>('status of the build', {
  factory: () => null,
});

export const statusSnapshotKey = makeStateKey<ProjectSnapshot | null>('status-snapshot');

async function fetchStatusDocument(): Promise<StatusDocument | null> {
  try {
    const response = await fetch('/status.json', { cache: 'no-cache' });
    return response.ok ? parseStatusDocument(await response.text()) : null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-evidence-chain',
  templateUrl: './evidence-chain.html',
  styleUrl: './evidence-chain.scss',
})
export class EvidenceChain implements OnInit {
  readonly project = input.required<ProjectKey>();

  protected readonly texts = evidenceTexts;
  protected readonly docsUrl = docsUrl;
  protected readonly notice = signal<string | null>(null);
  protected readonly chain = computed(() => buildEvidenceChain(this.snapshot(), this.project()));

  private readonly snapshot = signal<ProjectSnapshot | null>(null);
  private readonly transferState = inject(TransferState);
  private readonly buildDocument = inject(STATUS_SNAPSHOT);

  constructor() {
    // Browser only and after hydration, so it cannot differ from the prerendered page.
    afterNextRender(() => void this.refresh());
  }

  ngOnInit(): void {
    const fromBuild = pickProjectSnapshot(this.buildDocument, this.project());
    if (fromBuild) this.transferState.set(statusSnapshotKey, fromBuild);
    this.snapshot.set(this.transferState.get(statusSnapshotKey, null));
  }

  private async refresh(): Promise<void> {
    const fresh = pickProjectSnapshot(await fetchStatusDocument(), this.project());
    const current = this.snapshot();
    if (fresh && (!current || Date.parse(fresh.generatedAt) > Date.parse(current.generatedAt))) {
      this.snapshot.set(fresh);
    }
    this.notice.set(this.noticeAfterRefresh(fresh !== null));
  }

  private noticeAfterRefresh(refreshed: boolean): string | null {
    if (!refreshed) return evidenceTexts.refreshFailed;
    const generatedAt = this.snapshot()?.generatedAt;
    return generatedAt && isStale(generatedAt, new Date()) ? evidenceTexts.stale : null;
  }
}
