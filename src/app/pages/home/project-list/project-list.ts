import { Component, computed, DestroyRef, inject } from '@angular/core';
import { deliveryPlans } from '../../../../content/delivery-plans';
import { Project, projects } from '../../../../content/projects';
import { reportCard } from '../../../../content/reports';
import { buildDeliveryView, DeliveryView } from '../../../../content/software-delivery';
import { DeliveryStatus } from '../../../delivery/delivery-status';
import { ProjectRow, RowContent } from './project-row/project-row';

// DRAFT: ring texts and the status of the reports row, wording to be approved (PK-23).
const detailsRing = 'Details';
const reportRow: RowContent = {
  slug: 'projektberichte',
  title: reportCard.title,
  summary: reportCard.text,
  tech: reportCard.chips,
  href: reportCard.cta.url,
  external: true,
  // Counted from the list, so the number cannot drift from the reports.
  signal: { state: 'verified', status: `${reportCard.reports.length} Berichte`, when: '' },
  ring: 'Zum Blog ↗',
};

@Component({
  selector: 'app-project-list',
  imports: [ProjectRow],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList {
  protected readonly status = inject(DeliveryStatus);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly rows = computed<RowContent[]>(() => [
    ...projects.map((project) => this.projectRow(project)),
    reportRow,
  ]);

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
