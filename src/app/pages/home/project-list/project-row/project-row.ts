import { Component, computed, input } from '@angular/core';
import type { ProjectPreview } from '../../../../../content/projects';
import type { DeliveryView } from '../../../../../content/software-delivery';
import { StateBadge } from '../../../../delivery/state-badge/state-badge';

/** What one row of the project list shows (spec 16.1). */
export interface RowContent {
  slug: string;
  title: string;
  summary: string;
  tech: string[];
  href: string;
  /** Leads off the site, so it opens in a new tab. */
  external: boolean;
  signal: DeliveryView['signal'];
  /** Image beside the pointer, shown from the next step on. */
  preview?: ProjectPreview;
  /** Text of the ring at the pointer. */
  ring: string;
}

// DRAFT: CTA texts, wording to be approved (PK-23). The only external row is the reports row.
const ctas = {
  details: { text: 'Details ansehen', arrow: '→' },
  external: { text: 'Alle Berichte ansehen', arrow: '↗' },
};

/** The whole row is one link, with no other link inside. */
@Component({
  selector: 'app-project-row',
  imports: [StateBadge],
  templateUrl: './project-row.html',
  styleUrl: './project-row.scss',
})
export class ProjectRow {
  readonly row = input.required<RowContent>();
  protected readonly cta = computed(() => (this.row().external ? ctas.external : ctas.details));
  protected readonly tech = computed(() => this.row().tech.join(' · '));
}
