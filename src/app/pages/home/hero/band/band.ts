import { Component, signal } from '@angular/core';
import { availability } from '../../../../../content/profile';

@Component({
  selector: 'app-band',
  templateUrl: './band.html',
  styleUrl: './band.scss',
  host: { class: 'band', '[class.paused]': 'paused()' },
})
export class Band {
  protected readonly availability = availability;
  /** Two copies make the marquee seamless: it moves by exactly one copy, then restarts. */
  protected readonly copies = [0, 1];
  /** Paused by the visitor (WCAG 2.2.2); hover and focus pause in CSS. */
  protected readonly paused = signal(false);

  protected togglePause(): void {
    this.paused.update((paused) => !paused);
  }
}
