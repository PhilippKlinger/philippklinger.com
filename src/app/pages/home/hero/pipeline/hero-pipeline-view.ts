import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DeliveryStatus } from '../../../../delivery/delivery-status';
import { MotionPause } from '../../../../layout/motion-pause';
import { buildHeroPipeline, HeroPipeline } from '../../../../../content/hero-pipeline';
import {
  heroCycleMs,
  HeroFrame,
  heroFinalFrame,
  heroFrame,
} from '../../../../../content/hero-pipeline-motion';
import { ExternalLink } from '../../../../external-link';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const CAN_HOVER = '(hover: hover)';
// A hidden tab or a long task must not make the run jump.
const MAX_STEP_MS = 100;
// Without data, or when not even the first station is reached, nothing changes from frame to frame.
const runs = (pipeline: HeroPipeline) => !pipeline.still && pipeline.reached >= 0;

@Component({
  imports: [ExternalLink],
  selector: 'app-hero-pipeline',
  templateUrl: './hero-pipeline-view.html',
  styleUrl: './hero-pipeline-view.scss',
})
export class HeroPipelineView {
  private readonly status = inject(DeliveryStatus);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly motion = inject(MotionPause);

  protected readonly paused = this.motion.paused;
  protected readonly pipeline = computed(() =>
    buildHeroPipeline(this.status.snapshot('portfolio', this.destroyRef)()),
  );
  protected readonly final = computed(() => heroFinalFrame(this.pipeline()));
  // Without any data the chain already says it cannot be read; a second sentence adds nothing.
  protected readonly stale = computed(() => (this.pipeline().still ? null : this.status.notice()));
  protected readonly failed = computed(() =>
    this.pipeline().stations.some((station) => station.state === 'failed'),
  );
  // Stays false in the prerender and without JavaScript: both show the end state.
  // The pause control follows this, not the run: the haze also moves when the run stands still.
  protected readonly moving = signal(false);
  protected readonly looping = computed(() => this.moving() && runs(this.pipeline()));
  // Only a change of state goes into the signal; nothing here may render per frame.
  protected readonly frame = signal<HeroFrame | null>(null);

  /** 0 while no frame is requested. */
  private frameId = 0;
  private inView = false;
  private elapsed = 0;
  private previous = 0;
  private shown: HeroPipeline | null = null;
  private holdOn = ':has(:focus-visible)';
  private lifetime: AbortController | null = null;

  constructor() {
    afterNextRender(() => this.start());
    // A run that stands asks for no frames. New data and the pause control wake it to check again.
    effect(() => {
      this.pipeline();
      this.paused();
      untracked(() => this.wake());
    });
  }

  protected togglePause(): void {
    this.motion.toggle();
  }

  private start(): void {
    const reduced = matchMedia(REDUCED_MOTION);
    if (reduced.matches) return;
    // A tap would leave a hover behind that holds the run until the next tap elsewhere.
    if (matchMedia(CAN_HOVER).matches) this.holdOn = ':hover, :has(:focus-visible)';
    const lifetime = new AbortController();
    reduced.addEventListener('change', () => this.stop(), { signal: lifetime.signal });
    this.watchHold(lifetime.signal);
    this.watchView(lifetime.signal);
    this.lifetime = lifetime;
    this.destroyRef.onDestroy(() => this.stopFrames());
    this.moving.set(true);
  }

  // Out of view nothing is to be seen, so no frame is spent on it.
  private watchView(signal: AbortSignal): void {
    // A fast scroll can report out and in at once, so the last entry counts.
    const onScreen = new IntersectionObserver((entries) =>
      this.see(entries.at(-1)!.isIntersecting),
    );
    onScreen.observe(this.host);
    signal.addEventListener('abort', () => onScreen.disconnect());
  }

  // Leaving the stations may end a hold; the next frame checks it.
  private watchHold(signal: AbortSignal): void {
    const box = this.host.querySelector('.box');
    for (const type of ['pointerleave', 'focusout']) {
      box?.addEventListener(type, () => this.wake(), { signal });
    }
  }

  private see(inView: boolean): void {
    this.inView = inView;
    if (inView) this.wake();
    else this.sleep();
  }

  private wake(): void {
    if (!this.inView || this.frameId) return;
    this.previous = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  private sleep(): void {
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  private stopFrames(): void {
    this.lifetime?.abort();
    this.inView = false;
    this.sleep();
  }

  private stop(): void {
    this.stopFrames();
    this.moving.set(false);
    this.showEndState();
  }

  private showEndState(): void {
    this.frame.set(null);
    this.host.style.removeProperty('--p');
    this.host.style.removeProperty('--dot');
  }

  private readonly tick = (now: number): void => {
    this.frameId = 0;
    // The frame time can lie just before the request.
    const step = Math.min(Math.max(now - this.previous, 0), MAX_STEP_MS);
    this.previous = now;
    if (this.advance(step)) this.frameId = requestAnimationFrame(this.tick);
  };

  /** Shows the next frame; false when the run stands and needs no frame until it is woken. */
  private advance(step: number): boolean {
    const pipeline = this.pipeline();
    if (!this.takeNew(pipeline) && this.isHeld()) return false;
    if (!runs(pipeline)) {
      this.showEndState();
      return false;
    }
    this.elapsed = (this.elapsed + step) % heroCycleMs(pipeline);
    this.show(heroFrame(pipeline, this.elapsed));
    return true;
  }

  // Newer data from /status.json: start the run again with it.
  private takeNew(pipeline: HeroPipeline): boolean {
    if (pipeline === this.shown) return false;
    this.shown = pipeline;
    this.elapsed = 0;
    return true;
  }

  // Only the stations hold the run. The pause control must not: after a click it keeps the focus
  // and the pointer, and the run would not continue when it says so.
  private isHeld(): boolean {
    return this.motion.paused() || !!this.host.querySelector('.box')?.matches(this.holdOn);
  }

  private show(next: HeroFrame): void {
    this.host.style.setProperty('--p', String(next.progress));
    this.host.style.setProperty('--dot', String(next.dot));
    const current = this.frame();
    const changed =
      !current ||
      current.resetting !== next.resetting ||
      current.states.some((state, index) => state !== next.states[index]);
    if (changed) this.frame.set(next);
  }
}
