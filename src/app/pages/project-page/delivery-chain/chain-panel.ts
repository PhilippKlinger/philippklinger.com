import { Component, input } from '@angular/core';
import { ChainStation, ChainTable } from '../../../../content/delivery-chain';
import { ExternalLink } from '../../../external-link';

// DRAFT: texts of the field, wording to be approved.
const panelTexts = {
  verify: 'Selbst prüfen',
  passing: 'passing',
  failed: 'failed',
};

/** The field of one station: what it proves, its table and, for an attested image, the command. */
@Component({
  imports: [ExternalLink],
  selector: 'app-chain-panel',
  templateUrl: './chain-panel.html',
  styleUrl: './chain-panel.scss',
})
export class ChainPanel {
  readonly station = input.required<ChainStation>();
  readonly index = input.required<number>();
  readonly count = input.required<number>();
  /** Commit under the pointer anywhere in the chain, so the same commit lights up here too. */
  readonly hoveredSha = input<string | null>(null);

  protected readonly texts = panelTexts;

  /** Column name in front of a value when the table stacks; the first column needs none. */
  protected labelOf({ head }: ChainTable, column: number): string | null {
    return column > 0 && head[column] ? head[column] : null;
  }
}
