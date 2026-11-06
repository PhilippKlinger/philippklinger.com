import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CursorCta } from './layout/cursor-cta/cursor-cta';
import { CursorDot } from './layout/cursor-cta/cursor-dot';
import { Footer } from './layout/footer/footer';
import { Haze } from './layout/haze/haze';
import { Header } from './layout/header/header';

@Component({
  imports: [RouterOutlet, Haze, Header, Footer, CursorCta, CursorDot],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  // A plain "#main" link would navigate to "/#main" because of <base href="/">.
  protected skipToContent(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }
}
