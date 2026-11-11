import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { deliveryPlans } from '../../../../content/delivery-plans';
import { Project, projects } from '../../../../content/projects';
import { reportCard } from '../../../../content/reports';
import { buildDeliveryView, DeliveryView } from '../../../../content/software-delivery';
import { DeliveryStatus } from '../../../delivery/delivery-status';
import { ProjectRow, RowContent } from './project-row/project-row';
import { RowPreview } from './row-preview/row-preview';

// DRAFT: ring texts and the status of the reports row, wording to be approved (PK-23).
const detailsRing = 'Details';

function reportRow(): RowContent {
  return {
    slug: 'projektberichte',
    title: reportCard.title,
    summary: reportCard.text,
    tech: reportCard.chips,
    href: reportCard.cta.url,
    external: true,
    // Counted from the list when shown, so the number cannot drift from the reports.
    signal: { state: 'verified', status: `${reportCard.reports.length} Berichte`, when: '' },
    ring: 'Zum Blog ↗',
  };
}

@Component({
  selector: 'app-project-list',
  imports: [ProjectRow, RowPreview],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList {
  protected readonly status = inject(DeliveryStatus);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly rows = computed<RowContent[]>(() => [
    ...projects.map((project) => this.projectRow(project)),
    reportRow(),
  ]);
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly preview = viewChild.required(RowPreview);

  constructor() {
    // Only in the browser: the prerender has no pointer and no focus.
    afterNextRender(() => this.listen());
  }

  private listen(): void {
    const lifetime = new AbortController();
    this.destroyRef.onDestroy(() => lifetime.abort());
    const options = { passive: true, signal: lifetime.signal };
    const list = this.list().nativeElement;
    list.addEventListener('pointerover', (event) => this.pointAt(event), options);
    list.addEventListener('pointerleave', () => this.preview().hide(), options);
    list.addEventListener('focusin', ({ target }) => this.focusOn(target), options);
    list.addEventListener('focusout', () => this.preview().hide(), options);
  }

  // A touch has no pointer to follow; the row shows its small image instead.
  private pointAt({ target, pointerType }: PointerEvent): void {
    if (pointerType !== 'touch') this.showFor(target);
  }

  // Focus by mouse click is no keyboard focus, the pointer already shows the image.
  private focusOn(target: EventTarget | null): void {
    if (target instanceof Element && target.matches(':focus-visible')) this.showFor(target);
  }

  private showFor(target: EventTarget | null): void {
    const row = target instanceof Element ? target.closest<HTMLElement>('a.row') : null;
    if (!row) return;
    const index = [...this.list().nativeElement.querySelectorAll('a.row')].indexOf(row);
    this.preview().show(row, this.rows()[index]?.preview ?? null);
  }

  private projectRow({ slug, title, summary, chips, preview }: Project): RowContent {
    return {
      slug,
      title,
      summary,
      tech: chips.slice(0, 4),
      // Trailing slash: canonical URL on Apache, no 301.
      href: `/projekte/${slug}/`,
      external: false,
      signal: this.signalOf(slug),
      preview,
      ring: detailsRing,
    };
  }

  private signalOf(slug: string): DeliveryView['signal'] {
    const plan = deliveryPlans[slug];
    const snapshot = plan.statusKey
      ? this.status.snapshot(plan.statusKey, this.destroyRef)()
      : null;
    return buildDeliveryView(plan, snapshot).signal;
  }
}
