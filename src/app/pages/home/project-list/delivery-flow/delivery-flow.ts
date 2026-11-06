import { Component, input } from '@angular/core';
import { deliveryTexts, DeliveryView } from '../../../../../content/software-delivery';
import { StateBadge } from '../../../../delivery/state-badge/state-badge';

/** Panel of a project card: the steps from code to production, nothing but the given view. */
@Component({
  selector: 'app-delivery-flow',
  imports: [StateBadge],
  templateUrl: './delivery-flow.html',
  styleUrl: './delivery-flow.scss',
})
export class DeliveryFlow {
  readonly view = input.required<DeliveryView>();
  protected readonly title = deliveryTexts.title;
}
