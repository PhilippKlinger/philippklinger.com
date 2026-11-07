import { Injectable, signal } from '@angular/core';

/** One control for everything that moves on its own (WCAG 2.2.2). */
@Injectable({ providedIn: 'root' })
export class MotionPause {
  readonly paused = signal(false);

  toggle(): void {
    this.paused.update((paused) => !paused);
  }
}
