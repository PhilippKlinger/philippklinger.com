import {
  Component,
  DestroyRef,
  DOCUMENT,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';

/** Rest after the last scroll event before the button comes back (S11). */
const REST_MS = 600;

/**
 * Floating button back to the top of the start page. Shown once the hero is out of view and
 * only while the reader rests, so it never covers content during scrolling (S11).
 */
@Component({
  selector: 'app-back-to-top',
  templateUrl: './back-to-top.html',
  styleUrl: './back-to-top.scss',
})
export class BackToTop {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heroGone = signal(false);
  private readonly scrolling = signal(false);
  private restTimer = 0;
  protected readonly shown = computed(() => this.heroGone() && !this.scrolling());

  constructor() {
    afterNextRender(() => {
      this.showOnceHeroIsGone();
      this.hideWhileScrolling();
    });
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
    const observer = new IntersectionObserver(([entry]) =>
      this.heroGone.set(!entry.isIntersecting),
    );
    observer.observe(hero);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private hideWhileScrolling(): void {
    const stop = new AbortController();
    addEventListener('scroll', () => this.onScroll(), { passive: true, signal: stop.signal });
    this.destroyRef.onDestroy(() => {
      stop.abort();
      clearTimeout(this.restTimer);
    });
  }

  private onScroll(): void {
    this.scrolling.set(true);
    clearTimeout(this.restTimer);
    this.restTimer = window.setTimeout(() => this.scrolling.set(false), REST_MS);
  }
}
