import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
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

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const CAN_HOVER = '(hover: hover)';
// A hidden tab or a long task must not make the run jump.
const MAX_STEP_MS = 100;

@Component({
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
  protected readonly stale = this.status.notice;
  protected readonly failed = computed(() =>
    this.pipeline().stations.some((station) => station.state === 'failed'),
  );
  // Stays false in the prerender and without JavaScript: both show the end state.
  // The pause control follows this, not the run: the haze also moves when the run stands still.
  protected readonly moving = signal(false);
  protected readonly looping = computed(() => this.moving() && !this.pipeline().still);
  // Only a change of state goes into the signal; nothing here may render per frame.
  protected readonly frame = signal<HeroFrame | null>(null);

  private frameId = 0;
  private elapsed = 0;
  private previous = 0;
  private shown: HeroPipeline | null = null;
  private holdOn = ':has(:focus-visible)';
  private lifetime: AbortController | null = null;

  constructor() {
    afterNextRender(() => {
      const reduced = matchMedia(REDUCED_MOTION);
      if (reduced.matches) return;
      // A tap would leave a hover behind that holds the run until the next tap elsewhere.
      if (matchMedia(CAN_HOVER).matches) this.holdOn = ':hover, :has(:focus-visible)';
      const controller = new AbortController();
      reduced.addEventListener('change', () => this.stop(), { signal: controller.signal });
      // Out of view nothing is to be seen, so no frame is spent on it.
      const onScreen = new IntersectionObserver(([entry]) => this.run(entry.isIntersecting));
      onScreen.observe(this.host);
      controller.signal.addEventListener('abort', () => onScreen.disconnect());
      this.lifetime = controller;
      this.destroyRef.onDestroy(() => this.stopFrames());
      this.moving.set(true);
    });
  }

  protected togglePause(): void {
    this.motion.toggle();
  }

  private run(inView: boolean): void {
    cancelAnimationFrame(this.frameId);
    if (!inView) return;
    this.previous = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  private stopFrames(): void {
    this.lifetime?.abort();
    cancelAnimationFrame(this.frameId);
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
    this.frameId = requestAnimationFrame(this.tick);
    const step = Math.min(now - this.previous, MAX_STEP_MS);
    this.previous = now;

    const pipeline = this.pipeline();
    if (pipeline !== this.shown) {
      // Newer data from /status.json: start the run again with it.
      this.shown = pipeline;
      this.elapsed = 0;
    } else if (this.isHeld()) {
      return;
    }
    if (pipeline.still) {
      this.showEndState();
      return;
    }

    this.elapsed = (this.elapsed + step) % heroCycleMs(pipeline);
    this.show(heroFrame(pipeline, this.elapsed));
  };

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
