import { Component, computed, DestroyRef, inject, InjectionToken, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { deliveryPlans } from '../../../content/delivery-plans';
import { projectPageContent } from '../../../content/project-pages';
import { Project, projectPageTexts } from '../../../content/projects';
import { buildDeliveryView, deliveryTexts } from '../../../content/software-delivery';
import { DeliveryStatus } from '../../delivery/delivery-status';
import { StateBadge } from '../../delivery/state-badge/state-badge';
import { DeliveryChain } from './delivery-chain/delivery-chain';
import { ExternalLink } from '../../external-link';

/** A token, not an input: the router would bind a query parameter of that name to an input. */
export const PROJECT_PAGE_CONTENT = new InjectionToken('content of the project pages', {
  factory: () => projectPageContent,
});

// DRAFT: labels of the cards in "Wie es gebaut ist", wording to be approved (PK-23).
const blockTexts = {
  reason: 'Grund',
  price: 'Preis',
  found: 'Gefunden',
  changed: 'Geändert',
};

@Component({
  selector: 'app-project-page',
  imports: [ExternalLink, DeliveryChain, RouterLink, StateBadge],
  templateUrl: './project-page.html',
  styleUrl: './project-page.scss',
})
export class ProjectPage {
  private readonly status = inject(DeliveryStatus);
  private readonly destroyRef = inject(DestroyRef);
  private readonly content = inject(PROJECT_PAGE_CONTENT);

  readonly project = input.required<Project>();

  protected readonly texts = projectPageTexts;
  protected readonly deliveryTexts = deliveryTexts;
  protected readonly blockTexts = blockTexts;
  protected readonly built = computed(() => this.content[this.project().slug]);
  protected readonly tech = computed(() => this.project().stack.join(' · '));
  /** The same status line as the row of the project list (spec 16.3). */
  protected readonly statusLine = computed(() => {
    const plan = deliveryPlans[this.project().slug];
    const key = plan.statusKey;
    return buildDeliveryView(plan, key ? this.status.snapshot(key, this.destroyRef)() : null)
      .signal;
  });
}
