import { Component, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { availability, profile } from '../../../../content/profile';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
  host: { '(pointermove)': 'moveLight($event)' },
})
export class Hero {
  protected readonly profile = profile;
  protected readonly availability = availability;
  /** Position of the cursor light; null keeps the resting place from the stylesheet. */
  protected readonly light = signal<string | null>(null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected moveLight(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    const box = this.host.nativeElement.getBoundingClientRect();
    this.light.set(`${event.clientX - box.left}px ${event.clientY - box.top}px`);
  }
}
