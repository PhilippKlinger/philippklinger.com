import { Component, computed, inject, InjectionToken, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { projectPageContent } from '../../../content/project-pages';
import { Project, projectPageTexts } from '../../../content/projects';
import { deliveryTexts } from '../../../content/software-delivery';
import { DeliverySteps } from './delivery-steps/delivery-steps';

/** A token, not an input: the router would bind a query parameter of that name to an input. */
export const PROJECT_PAGE_CONTENT = new InjectionToken('content of the project pages', {
  factory: () => projectPageContent,
});

// DRAFT: labels of the block "Wie es gebaut ist", wording to be approved (PK-23).
const blockTexts = {
  reason: 'Grund',
  price: 'Preis',
  what: 'Was schiefging',
  found: 'Wie er gefunden wurde',
  changed: 'Was sich änderte',
};

@Component({
  selector: 'app-project-page',
  imports: [DeliverySteps, RouterLink],
  templateUrl: './project-page.html',
  styleUrl: './project-page.scss',
})
export class ProjectPage {
  readonly project = input.required<Project>();

  protected readonly texts = projectPageTexts;
  protected readonly deliveryTexts = deliveryTexts;
  protected readonly blockTexts = blockTexts;
  protected readonly built = computed(() => this.content[this.project().slug]);

  private readonly content = inject(PROJECT_PAGE_CONTENT);
}
