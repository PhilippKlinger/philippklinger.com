import { Component, computed, inject, input } from '@angular/core';
import { deliveryPlans } from '../../../../content/delivery-plans';
import {
  buildDeliveryView,
  DeliveryView,
  deliveryTexts,
} from '../../../../content/software-delivery';
import { DeliveryStatus } from '../../../delivery/delivery-status';
import { StateBadge } from '../../../delivery/state-badge/state-badge';

@Component({
  selector: 'app-delivery-steps',
  imports: [StateBadge],
  templateUrl: './delivery-steps.html',
  styleUrl: './delivery-steps.scss',
})
export class DeliverySteps {
  readonly slug = input.required<string>();

  protected readonly texts = deliveryTexts;
  protected readonly view = computed<DeliveryView>(() => {
    const plan = this.plan();
    const snapshot = plan.statusKey ? this.status.snapshot(plan.statusKey)() : null;
    return buildDeliveryView(plan, snapshot);
  });
  // Fixed content reads no status, so a notice left by another page would not apply to it.
  protected readonly notice = computed(() => (this.plan().statusKey ? this.status.notice() : null));

  private readonly status = inject(DeliveryStatus);
  private readonly plan = computed(() => deliveryPlans[this.slug()]);
}
