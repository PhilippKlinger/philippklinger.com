import { afterNextRender, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { ease } from '../haze/haze-motion';
import type { Point } from '../haze/haze-shader';
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
      if (matchMedia(RING_ALLOWED).matches) this.listen();
    });
  }

  private listen(): void {
    const { signal } = this.lifetime;
    addEventListener('pointermove', (event) => this.aimAt(event), { passive: true, signal });
    addEventListener('pointerover', (event) => this.update(event), { passive: true, signal });
    // Nothing else reports that the pointer left the window, the ring would stay and keep running.
    document.documentElement.addEventListener('pointerleave', () => this.hide(), { signal });
  }

  private aimAt({ clientX, clientY }: PointerEvent): void {
    this.target = { x: clientX, y: clientY };
  }

  private update(event: PointerEvent): void {
    // A touchscreen on a device that also has a mouse must not bring the ring up.
    const over = event.target instanceof Element && event.pointerType !== 'touch';
    const text = over ? cursorText(event.target) : null;
    if (text) this.show(text, event);
    else this.hide();
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
    cancelAnimationFrame(this.frameId);
    this.lifetime.abort();
  }
}
