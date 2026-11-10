import { afterNextRender, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import type { ProjectPreview } from '../../../../../content/projects';
import { RING_ALLOWED, RING_EASING } from '../../../../layout/cursor-cta/cursor-cta';
import { ease } from '../../../../layout/haze/haze-motion';
import type { Point } from '../../../../layout/haze/haze-shader';

// 960px is bp `card` (_breakpoints.scss): below it the rows stack and show their small image.
const FOLLOW_ALLOWED = `${RING_ALLOWED} and (min-width: 960px)`;
// Half the ring (6.5rem) and some air, so the image sits beside the ring, not under it.
const GAP = 68;
const EDGE = 16;

interface Size {
  width: number;
  height: number;
}

export interface Placement {
  pointer: Point;
  size: Size;
  /** Right edge of the row title, which the image must leave free. */
  titleRight: number;
  viewport: Size;
}

/** Top left corner of the image beside the pointer: right of it, on the left where it would not fit. */
export function placePreview({ pointer, size, titleRight, viewport }: Placement): Point {
  const right = Math.max(pointer.x + GAP, titleRight + EDGE);
  const fitsRight = right + size.width <= viewport.width - EDGE;
  const left = Math.max(pointer.x - GAP - size.width, titleRight + EDGE);
  const top = Math.min(pointer.y - size.height / 2, viewport.height - size.height - EDGE);
  return { x: fitsRight ? right : left, y: Math.max(top, EDGE) };
}

/** The one preview image of the list: beside the pointer, or fixed in a row. Decoration only. */
@Component({
  selector: 'app-row-preview',
  templateUrl: './row-preview.html',
  styleUrl: './row-preview.scss',
  host: { 'aria-hidden': 'true' },
})
export class RowPreview {
  protected readonly image = signal<ProjectPreview | null>(null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly lifetime = new AbortController();
  private follow: MediaQueryList | null = null;
  private title: Element | null = null;
  private frameId = 0;
  private pointer: Point = { x: 0, y: 0 };
  private position: Point = { x: 0, y: 0 };

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Only in the browser: the prerender also destroys this component, in Node.
    afterNextRender(() => {
      destroyRef.onDestroy(() => this.stop());
      this.listen();
    });
  }

  show(row: HTMLElement, preview: ProjectPreview | null): void {
    this.image.set(preview);
    this.title = row.querySelector('h3');
    this.host.classList.add('is-on');
    this.follow ??= this.followQuery();
    // Keyboard focus has no pointer to follow, and without the ring nothing should move.
    if (this.follow.matches && !row.matches(':focus-visible')) this.startFollowing();
    else this.anchorIn(row);
  }

  hide(): void {
    this.stopFollowing();
    this.host.classList.remove('is-on');
  }

  private listen(): void {
    const options = { passive: true, signal: this.lifetime.signal };
    // Capture runs before the list hears pointerover, so a new row starts at the pointer.
    for (const type of ['pointerover', 'pointermove'] as const) {
      addEventListener(type, ({ clientX, clientY }) => this.aimAt(clientX, clientY), {
        ...options,
        capture: true,
      });
    }
    // WCAG 1.4.13: content shown on hover or focus can be dismissed without moving.
    addEventListener('keydown', ({ key }) => this.dismissOn(key), options);
    // The back/forward cache restores the page as it was left.
    addEventListener('pagehide', () => this.hide(), options);
  }

  // Like the ring: once motion is switched off, the loop stops at once and does not come back.
  private followQuery(): MediaQueryList {
    const query = matchMedia(FOLLOW_ALLOWED);
    const { signal } = this.lifetime;
    query.addEventListener('change', () => this.hideUnless(query.matches), { signal });
    return query;
  }

  private hideUnless(stillAllowed: boolean): void {
    if (!stillAllowed && this.frameId) this.hide();
  }

  private dismissOn(key: string): void {
    if (key === 'Escape') this.hide();
  }

  private aimAt(x: number, y: number): void {
    this.pointer = { x, y };
  }

  private startFollowing(): void {
    this.host.classList.remove('is-anchored');
    this.host.style.top = '';
    if (this.frameId) return;
    // Starts at the pointer like the ring, so with the same easing both move as one.
    this.position = this.pointer;
    this.moveTo(this.position);
    this.frameId = requestAnimationFrame(this.frame);
  }

  private anchorIn(row: HTMLElement): void {
    this.stopFollowing();
    this.host.classList.add('is-anchored');
    this.host.style.translate = '';
    // Now absolute, so its offset parent is the list that holds the rows. Rects, not offsetTop:
    // equal rows have fractional heights, and a rounded value would sit off the middle.
    const list = this.host.offsetParent?.getBoundingClientRect().top ?? 0;
    const { top, height } = row.getBoundingClientRect();
    this.host.style.top = `${top - list + height / 2}px`;
  }

  private stopFollowing(): void {
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  // Runs only while the image follows; the position stays out of signals, nothing renders per frame.
  private readonly frame = (): void => {
    this.frameId = requestAnimationFrame(this.frame);
    this.position = {
      x: ease(this.position.x, this.pointer.x, RING_EASING),
      y: ease(this.position.y, this.pointer.y, RING_EASING),
    };
    this.moveTo(this.position);
  };

  private moveTo(pointer: Point): void {
    const { x, y } = placePreview({
      pointer,
      size: { width: this.host.offsetWidth, height: this.host.offsetHeight },
      titleRight: this.title?.getBoundingClientRect().right ?? 0,
      viewport: { width: innerWidth, height: innerHeight },
    });
    this.host.style.translate = `${x}px ${y}px`;
  }

  private stop(): void {
    this.hide();
    this.lifetime.abort();
  }
}
