import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { navigation, profile } from '../../../content/profile';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly profile = profile;
  protected readonly navigation = navigation;
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
