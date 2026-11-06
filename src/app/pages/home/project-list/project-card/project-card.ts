import { Component, computed, inject, input } from '@angular/core';
import { deliveryPlans } from '../../../../../content/delivery-plans';
import { Project } from '../../../../../content/projects';
import { buildDeliveryView, DeliveryView } from '../../../../../content/software-delivery';
import { DeliveryStatus } from '../../../../delivery/delivery-status';
import { CardLink } from '../card-link.directive';
import { DeliveryFlow } from '../delivery-flow/delivery-flow';

// DRAFT: wording to be approved (PK-23).
const ctaLabel = 'Projektdetails ansehen';

@Component({
  selector: 'app-project-card',
  imports: [CardLink, DeliveryFlow],
  templateUrl: './project-card.html',
  styleUrl: './project-card.scss',
})
export class ProjectCard {
  private readonly status = inject(DeliveryStatus);

  readonly project = input.required<Project>();
  protected readonly ctaLabel = ctaLabel;
  protected readonly view = computed<DeliveryView>(() => {
    const plan = deliveryPlans[this.project().slug];
    return buildDeliveryView(plan, plan.statusKey ? this.status.snapshot(plan.statusKey)() : null);
  });
}
