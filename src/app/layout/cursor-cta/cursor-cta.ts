import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ease } from '../haze/haze-motion';
import type { Point } from '../haze/haze-shader';
import type { CursorDot } from './cursor-dot';
import { cursorText } from './cursor-text';

const EASING = 0.22;
const RING_ALLOWED =
  '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

/** Optional label at the pointer over a card. The visible CTA stays the real call to action. */
@Component({
  selector: 'app-cursor-cta',
  templateUrl: './cursor-cta.html',
  styleUrl: './cursor-cta.scss',
  host: { 'aria-hidden': 'true', '[class.is-on]': 'visible()' },
})
export class CursorCta {
  readonly dot = input.required<CursorDot>();
  protected readonly text = signal('');
  protected readonly visible = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly lifetime = new AbortController();
  private frameId = 0;
  private target: Point = { x: 0, y: 0 };
  private position: Point = { x: 0, y: 0 };

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Only in the browser: the prerender also destroys this component, in Node.
    afterNextRender(() => {
      destroyRef.onDestroy(() => this.stop());
      const allowed = matchMedia(RING_ALLOWED);
      if (allowed.matches) this.listen(allowed);
    });
  }

  private listen(allowed: MediaQueryList): void {
    const options = { passive: true, signal: this.lifetime.signal };
    this.dot().start(this.lifetime.signal);
    addEventListener('pointermove', (event) => this.move(event, allowed), options);
    addEventListener('pointerover', (event) => this.update(event, allowed), options);
    this.hideWhenOutOfReach(allowed);
  }

  // No pointerover reports any of these, the ring would stay and its loop keep running.
  private hideWhenOutOfReach(allowed: MediaQueryList): void {
    const { signal } = this.lifetime;
    document.documentElement.addEventListener('pointerleave', () => this.leave(), { signal });
    // The back/forward cache restores the page as it was left.
    addEventListener('pagehide', () => this.leave(), { signal });
    allowed.addEventListener('change', () => this.hideUnless(allowed.matches), { signal });
  }

  private leave(): void {
    this.hide();
    this.dot().hide();
  }

  private hideUnless(stillAllowed: boolean): void {
    if (!stillAllowed) this.hide();
  }

  // Decides the ring too: a pointer already inside an element gets no pointerover, and the dot
  // alone would leave nothing visible over a card.
  private move(event: PointerEvent, allowed: MediaQueryList): void {
    this.aimAt(event);
    this.update(event, allowed);
  }

  private aimAt({ clientX, clientY }: PointerEvent): void {
    this.target = { x: clientX, y: clientY };
  }

  private update(event: PointerEvent, allowed: MediaQueryList): void {
    // A touchscreen on a device that also has a mouse must not bring the ring up.
    const over =
      allowed.matches && event.target instanceof Element && event.pointerType !== 'touch';
    const text = over ? cursorText(event.target) : null;
    if (text) this.show(text, event);
    else this.hide();
    this.dot().follow(event);
  }

  private show(text: string, event: PointerEvent): void {
    this.text.set(text);
    if (this.visible()) return;
    // Starts at the pointer instead of flying in from where it last went out.
    this.aimAt(event);
    this.position = this.target;
    this.visible.set(true);
    this.frameId = requestAnimationFrame(this.frame);
  }

  private hide(): void {
    cancelAnimationFrame(this.frameId);
    this.visible.set(false);
  }

  // Runs only while the ring shows; the position stays out of signals, nothing renders per frame.
  private readonly frame = (): void => {
    this.frameId = requestAnimationFrame(this.frame);
    this.position = {
      x: ease(this.position.x, this.target.x, EASING),
      y: ease(this.position.y, this.target.y, EASING),
    };
    this.host.style.translate = `${this.position.x}px ${this.position.y}px`;
  };

  private stop(): void {
    this.leave();
    this.lifetime.abort();
  }
}
