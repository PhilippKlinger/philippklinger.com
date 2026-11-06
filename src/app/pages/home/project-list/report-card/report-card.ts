import { Component } from '@angular/core';
import { reportCard } from '../../../../../content/reports';
import { CardLink } from '../card-link.directive';

/** Fifth card: separate reports, so its panel has no arrows. */
@Component({
  selector: 'app-report-card',
  imports: [CardLink],
  templateUrl: './report-card.html',
  styleUrl: './report-card.scss',
})
export class ReportCard {
  protected readonly content = reportCard;
}
