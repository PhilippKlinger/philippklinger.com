import { Component, input } from '@angular/core';
import { deliveryTexts, StepState } from '../../../content/software-delivery';

/** A state is never told by color alone: always icon and word (WCAG 1.4.1). */
@Component({
  selector: 'app-state-badge',
  templateUrl: './state-badge.html',
  styleUrl: './state-badge.scss',
})
export class StateBadge {
  readonly state = input.required<StepState>();
  /** Replaces the word of the state, the icon stays. */
  readonly label = input<string>();
  protected readonly labels = deliveryTexts.stateLabels;
}
