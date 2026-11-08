import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  driftTarget,
  ease,
  FRAME_SAMPLES,
  frameTime,
  isTooSlow,
  pointerEnergy,
} from './haze-motion';
import { startPainter, type Painter, type PendingPainter, type Point } from './haze-shader';
import { MotionPause } from '../motion-pause';

const EASING = 0.07;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
// Every call into WebGL that returns something, from getContext on, waits until the GPU process
// has done all work before it. Right after loading it rasters the page, so an early start blocks
// the main thread for as long (TBT). The static layer looks the same until then.
const GPU_BUSY_MS = 1000;

// Starting WebGL takes main thread time, so it waits until the page is idle (LCP, TBT).
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
  private readonly motion = inject(MotionPause);
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
  // Stays 0 without a fine pointer, nothing else moves it.
  private energy = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Only in the browser: the prerender also destroys this component, in Node.
    afterNextRender(() => {
      destroyRef.onDestroy(() => this.stop());
      setTimeout(() => whenIdle(() => this.start()), GPU_BUSY_MS);
    });
    // The pause asks for no frames, so playing again has to request them.
    effect(() => {
      if (!this.motion.paused()) untracked(() => this.resume());
    });
  }

  private resume(): void {
    if (this.lifetime.signal.aborted || this.state() !== 'running' || this.frameId) return;
    this.frameId = requestAnimationFrame(this.frame);
  }

  private start(): void {
    if (this.lifetime.signal.aborted) return;
    const canvas = this.canvas().nativeElement;
    const pending = startPainter(canvas);
    if (!pending) return;
    canvas.addEventListener('webglcontextlost', () => this.halt('off'), {
      signal: this.lifetime.signal,
    });
    // The GPU compiles meanwhile; the result is read in a later task, not in this one.
    whenIdle(() => this.whenCompiled(pending));
  }

  private whenCompiled(pending: PendingPainter): void {
    if (this.lifetime.signal.aborted) return;
    if (!pending.done()) return whenIdle(() => this.whenCompiled(pending));
    this.paint = pending.finish();
    if (this.paint) this.begin();
  }

  private begin(): void {
    this.target = { x: innerWidth * 0.72, y: innerHeight * 0.32 };
    this.light = { ...this.target };
    if (matchMedia(REDUCED_MOTION).matches) this.drawStill();
    else this.run();
  }

  private drawStill(): void {
    this.paint?.(0, this.light, 0);
    this.state.set('still');
  }

  private run(): void {
    const { signal } = this.lifetime;
    // A short tab switch stays below the limit of frameTime, but is no slow frame either.
    document.addEventListener('visibilitychange', () => (this.lastFrame = 0), { signal });
    this.followsPointer = matchMedia(FINE_POINTER).matches;
    if (this.followsPointer) {
      addEventListener('pointermove', (event) => this.aimAt(event), { passive: true, signal });
    }
    matchMedia(REDUCED_MOTION).addEventListener('change', (event) => this.settle(event), {
      signal,
    });
    this.state.set('running');
    this.frameId = requestAnimationFrame(this.frame);
  }

  // Turning motion back on starts nothing again, like the ring.
  private settle({ matches }: MediaQueryListEvent): void {
    if (!matches) return;
    cancelAnimationFrame(this.frameId);
    this.drawStill();
  }

  private aimAt({ clientX, clientY }: PointerEvent): void {
    const moved = Math.hypot(clientX - this.target.x, clientY - this.target.y);
    this.energy = pointerEnergy(this.energy, moved, 0);
    this.target = { x: clientX, y: clientY };
  }

  // Only a change of state goes into a signal; nothing here may render per frame.
  private readonly frame = (now: number): void => {
    this.frameId = 0;
    if (this.motion.paused()) {
      // The time of the pause is no slow frame.
      this.lastFrame = 0;
      return;
    }
    this.frameId = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    this.moveLight(now);
    this.energy = pointerEnergy(this.energy, 0, this.lastFrame ? now - this.lastFrame : 0);
    this.paint?.(now, this.light, this.energy);
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
    const time = this.lastFrame ? frameTime(now, this.lastFrame) : null;
    this.lastFrame = now;
    if (time === null) return;
    this.frameTimes.push(time);
    if (isTooSlow(this.frameTimes)) this.halt('slow');
    else if (this.frameTimes.length === FRAME_SAMPLES) this.frameTimes.shift();
  }

  private halt(state: 'off' | 'slow'): void {
    this.stop();
    // Gives the GPU memory back. The listener is gone, so this does not read as a failure.
    const gl = this.canvas().nativeElement.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.state.set(state);
  }

  private stop(): void {
    cancelAnimationFrame(this.frameId);
    this.lifetime.abort();
  }
}
