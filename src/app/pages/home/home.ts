import { Component, DestroyRef, DOCUMENT, inject } from '@angular/core';
import { About } from './about/about';
import { BackToTop } from './back-to-top/back-to-top';
import { Contact } from './contact/contact';
import { FocusAreas } from './focus-areas/focus-areas';
import { Hero } from './hero/hero';
import { profilePageSchema } from './profile-page-schema';
import { ProjectList } from './project-list/project-list';

@Component({
  selector: 'app-home',
  imports: [Hero, About, FocusAreas, ProjectList, Contact, BackToTop],
  templateUrl: './home.html',
  // A block box, so the sticky back-to-top button has the page as its containing block.
  styles: ':host { display: block; }',
})
export class Home {
  private readonly document = inject(DOCUMENT);

  constructor() {
    const script = this.addStructuredData();
    inject(DestroyRef).onDestroy(() => script.remove());
  }

  // Prerendering writes the block into the static HTML; hydration finds it
  // there and reuses it instead of adding a second one.
  private addStructuredData(): HTMLScriptElement {
    const head = this.document.head;
    let script = head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
    if (!script) {
      script = head.appendChild(this.document.createElement('script'));
      script.type = 'application/ld+json';
    }
    // Escaping "<" keeps the JSON from ever closing the script element early.
    script.textContent = JSON.stringify(profilePageSchema()).replace(/</g, '\\u003c');
    return script;
  }
}
