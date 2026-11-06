import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from './layout/footer/footer';
import { Haze } from './layout/haze/haze';
import { Header } from './layout/header/header';

@Component({
  imports: [RouterOutlet, Haze, Header, Footer],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  host: { '(window:pointermove)': 'moveLight($event)' },
})
export class App {
  /** Viewport position of the cursor light; null keeps the resting place from the stylesheet. */
  protected readonly light = signal<string | null>(null);
  private frame = 0;

  // A plain "#main" link would navigate to "/#main" because of <base href="/">.
  protected skipToContent(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }

  // One update per frame at most: pointermove fires far more often than the screen paints.
  protected moveLight(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.frame) return;
    const { clientX, clientY } = event;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.light.set(`${clientX}px ${clientY}px`);
    });
  }
}
