import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { driftTarget, ease, FRAME_SAMPLES, frameTime, isTooSlow } from './haze-motion';
import { createPainter, type Painter, type Point } from './haze-shader';

const EASING = 0.045;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

// Compiling the shader blocks the main thread, so it waits until the page is idle (LCP, TBT).
function whenIdle(start: () => void): void {
  if ('requestIdleCallback' in window) requestIdleCallback(start);
  else setTimeout(start, 200);
}

@Component({
  selector: 'app-haze',
  templateUrl: './haze.html',
  styleUrl: './haze.scss',
  host: { 'aria-hidden': 'true', '[attr.data-haze-state]': 'state()' },
})
export class Haze {
  protected readonly state = signal<'off' | 'still' | 'running' | 'slow'>('off');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  // Ends the listeners and an idle start that has not happened yet.
  private readonly lifetime = new AbortController();
  private readonly frameTimes: number[] = [];
  private paint: Painter | null = null;
  private frameId = 0;
  private lastFrame = 0;
  private followsPointer = false;
  private target: Point = { x: 0, y: 0 };
  private light: Point = { x: 0, y: 0 };

  constructor() {
    afterNextRender(() => whenIdle(() => this.start()));
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private start(): void {
    if (this.lifetime.signal.aborted) return;
    const canvas = this.canvas().nativeElement;
    this.paint = createPainter(canvas);
    if (!this.paint) return;
    const { signal } = this.lifetime;
    canvas.addEventListener('webglcontextlost', () => this.halt('off'), { signal });
    this.target = { x: innerWidth * 0.72, y: innerHeight * 0.32 };
    this.light = { ...this.target };
    if (matchMedia(REDUCED_MOTION).matches) this.drawStill();
    else this.run();
  }

  private drawStill(): void {
    this.paint?.(0, this.light);
    this.state.set('still');
  }

  private run(): void {
    this.followsPointer = matchMedia(FINE_POINTER).matches;
    if (this.followsPointer) {
      const options = { passive: true, signal: this.lifetime.signal };
      addEventListener('pointermove', (event) => this.aimAt(event), options);
    }
    this.state.set('running');
    this.frameId = requestAnimationFrame(this.frame);
  }

  private aimAt({ clientX, clientY }: PointerEvent): void {
    this.target = { x: clientX, y: clientY };
  }

  // Only a change of state goes into a signal; nothing here may render per frame.
  private readonly frame = (now: number): void => {
    this.frameId = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    this.moveLight(now);
    this.paint?.(now, this.light);
    this.measure(now);
  };

  private moveLight(now: number): void {
    if (!this.followsPointer) this.target = driftTarget(now, innerWidth, innerHeight);
    this.light = {
      x: ease(this.light.x, this.target.x, EASING),
      y: ease(this.light.y, this.target.y, EASING),
    };
  }

  private measure(now: number): void {
    if (this.lastFrame) this.frameTimes.push(frameTime(now, this.lastFrame));
    this.lastFrame = now;
    if (isTooSlow(this.frameTimes)) this.halt('slow');
    else if (this.frameTimes.length === FRAME_SAMPLES) this.frameTimes.shift();
  }

  private halt(state: 'off' | 'slow'): void {
    this.stop();
    this.state.set(state);
  }

  private stop(): void {
    cancelAnimationFrame(this.frameId);
    this.lifetime.abort();
  }
}
