import { Directive, ElementRef, inject } from '@angular/core';

// Double and triple clicks select text, but their first click arrives with nothing selected yet.
const SELECTION_WINDOW_MS = 300;

const hasModifier = (event: MouseEvent) =>
  event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;

const isInteractive = (target: EventTarget | null) =>
  target instanceof Element && target.closest('a, button') !== null;

/** Makes the card surface act like its visible CTA, the CTA stays the real link. */
@Directive({ selector: '[appCardLink]', host: { 'data-card-link': '', '(click)': 'open($event)' } })
export class CardLink {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected open(event: MouseEvent): void {
    if (event.detail > 1 || hasModifier(event) || isInteractive(event.target)) return;
    setTimeout(() => this.forward(), SELECTION_WINDOW_MS);
  }

  private forward(): void {
    if (this.host.ownerDocument.getSelection()?.toString()) return;
    this.host.querySelector<HTMLElement>('[data-card-cta]')?.click();
  }
}
