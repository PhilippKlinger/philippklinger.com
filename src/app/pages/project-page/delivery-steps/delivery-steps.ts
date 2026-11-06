import { Component, computed, DestroyRef, inject, input } from '@angular/core';
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
  private readonly status = inject(DeliveryStatus);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = input.required<string>();

  protected readonly texts = deliveryTexts;
  protected readonly view = computed<DeliveryView>(() => {
    const plan = this.plan();
    const key = plan.statusKey;
    return buildDeliveryView(plan, key ? this.status.snapshot(key, this.destroyRef)() : null);
  });
  protected readonly notice = this.status.notice;

  private readonly plan = computed(() => deliveryPlans[this.slug()]);
}
