import { Component, ElementRef, inject } from '@angular/core';
import { dotLook } from './dot-look';

const DOT_ALLOWED =
  '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)';
const CUSTOM_CURSOR = 'has-custom-cursor';

/** Stands in for the normal pointer. The ring feeds it, so the page has one set of listeners. */
@Component({
  selector: 'app-cursor-dot',
  template: '',
  styleUrl: './cursor-dot.scss',
  host: { 'aria-hidden': 'true' },
})
export class CursorDot {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private allowed: MediaQueryList | null = null;

  start(signal: AbortSignal): void {
    this.allowed = matchMedia(DOT_ALLOWED);
    this.allowed.addEventListener('change', () => this.hideUnlessAllowed(), { signal });
  }

  // The normal pointer goes only here, in the same step that shows the dot: before the first
  // move, or if anything up to here failed, it simply stays.
  follow(event: PointerEvent): void {
    // A touchscreen on a device that also has a mouse has no pointer to replace.
    if (!this.allowed?.matches || event.pointerType === 'touch') return this.hide();
    const look = dotLook(event.target instanceof Element ? event.target : null);
    document.documentElement.classList.add(CUSTOM_CURSOR);
    this.host.classList.toggle('is-on', look !== 'off');
    this.host.classList.toggle('is-circle', look === 'circle');
    this.host.style.translate = `${event.clientX}px ${event.clientY}px`;
  }

  hide(): void {
    document.documentElement.classList.remove(CUSTOM_CURSOR);
    this.host.classList.remove('is-on');
  }

  private hideUnlessAllowed(): void {
    if (!this.allowed?.matches) this.hide();
  }
}
