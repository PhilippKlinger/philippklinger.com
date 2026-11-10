import { Component, DestroyRef, DOCUMENT, afterNextRender, inject, signal } from '@angular/core';

/** Floating button back to the top of the start page, shown once the hero is out of view. */
@Component({
  selector: 'app-back-to-top',
  templateUrl: './back-to-top.html',
  styleUrl: './back-to-top.scss',
})
export class BackToTop {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly shown = signal(false);

  constructor() {
    afterNextRender(() => this.showOnceHeroIsGone());
  }

  protected backToTop(): void {
    const smooth = matchMedia('(prefers-reduced-motion: no-preference)').matches;
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' });
    // Keyboard and screen reader users continue at the top as well, not at the button.
    this.document.getElementById('main')?.focus({ preventScroll: true });
  }

  private showOnceHeroIsGone(): void {
    const hero = this.document.querySelector('.hero');
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => this.shown.set(!entry.isIntersecting));
    observer.observe(hero);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
