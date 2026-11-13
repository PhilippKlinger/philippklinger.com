import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { navigation, profile } from '../../../content/profile';

// Below the tablet breakpoint, where the menu button replaces the navigation.
const MOBILE = '(max-width: 767.98px)';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  host: {
    '[class.away]': 'away()',
    '[class.over-content]': 'overContent()',
    '[class.menu-open]': 'menuOpen()',
    '(focusin)': 'away.set(false)',
    '(document:keydown.escape)': 'closeMenuWithKeyboard()',
  },
})
export class Header {
  protected readonly profile = profile;
  protected readonly navigation = navigation;
  protected readonly menuOpen = signal(false);
  /** Slid out above the viewport (mobile only, FB-13). */
  protected readonly away = signal(false);
  /** The page has left the top, so the header needs a background over the content. */
  protected readonly overContent = signal(false);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly destroyRef = inject(DestroyRef);
  private lastY = 0;

  constructor() {
    afterNextRender(() => this.followScroll());
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  // Escape closes the open menu and returns focus to its button (WCAG 2.1.2).
  protected closeMenuWithKeyboard(): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    this.menuButton().nativeElement.focus();
  }

  private followScroll(): void {
    const mobile = matchMedia(MOBILE);
    const stop = new AbortController();
    this.destroyRef.onDestroy(() => stop.abort());
    // A page opened further down, e.g. with a fragment, starts without the header in the way.
    this.lastY = scrollY;
    this.overContent.set(scrollY > 0);
    this.away.set(mobile.matches && scrollY > 0);
    const onScroll = () => this.onScroll(mobile.matches);
    addEventListener('scroll', onScroll, { passive: true, signal: stop.signal });
  }

  private onScroll(mobile: boolean): void {
    const delta = scrollY - this.lastY;
    this.lastY = scrollY;
    this.overContent.set(scrollY > 0);
    this.away.set(this.shouldLeave(mobile, delta));
  }

  // On mobile the header leaves on the way down and comes back on the way up. A jump of more
  // than half a screen is no reader scrolling: it leaves as well, so it never covers the target.
  private shouldLeave(mobile: boolean, delta: number): boolean {
    if (!mobile || scrollY <= 0 || this.menuOpen()) return false;
    if (delta === 0) return this.away();
    return delta > 0 || Math.abs(delta) > innerHeight / 2;
  }
}
