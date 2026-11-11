import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { about } from '../../../../content/profile';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
// As the click hint of the chain: the path counts as seen when most of it is on screen.
const IN_VIEW = 0.6;

/**
 * State of the line on the path. Without a value it is drawn: prerendered, without JavaScript,
 * with reduced motion and when the path was on screen at hydration. `armed` empties it until the
 * path comes into view, `run` fills it once, as the line of the hero pipeline.
 */
type Line = 'armed' | 'run' | null;

@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  protected readonly about = about;
  protected readonly line = signal<Line>(null);
  private readonly path = viewChild.required<ElementRef<HTMLElement>>('path');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.drawWhenSeen());
  }

  private drawWhenSeen(): void {
    const path = this.path().nativeElement;
    // Already above the fold (or passed): emptying it now would make it flicker.
    if (matchMedia(REDUCED_MOTION).matches || path.getBoundingClientRect().top < innerHeight) {
      return;
    }
    this.line.set('armed');
    this.fillOnceInView(path);
  }

  private fillOnceInView(path: HTMLElement): void {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.at(-1)!.intersectionRatio < IN_VIEW) return;
        observer.disconnect();
        this.line.set('run');
      },
      { threshold: IN_VIEW },
    );
    observer.observe(path);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
