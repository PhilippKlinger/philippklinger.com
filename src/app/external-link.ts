import { Directive, computed, input } from '@angular/core';
import { siteUrl } from '../content/site';

/** Id of the hidden text "öffnet in neuem Tab" in app.html, read by screen readers. */
export const NEW_TAB_HINT_ID = 'new-tab-hint';

/** Links to other sites open in a new tab, so the portfolio stays open (S9). */
export function isExternal(href: string): boolean {
  // The origin decides, not the prefix: philipp-klinger.com.example.org is another site.
  return /^https?:\/\//.test(href) && new URL(href).origin !== new URL(siteUrl).origin;
}

/**
 * Opens links to other sites in a new tab, without access to this page (noopener), and tells
 * screen readers so. Own pages, relative links and mailto stay in the same tab.
 */
@Directive({
  // An attribute selector without prefix on purpose: it applies to every link where imported.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'a[href]',
  host: {
    '[attr.href]': 'href()',
    '[attr.target]': "external() ? '_blank' : null",
    '[attr.rel]': "external() ? 'noopener' : null",
    '[attr.aria-describedby]': 'external() ? hintId : null',
  },
})
export class ExternalLink {
  readonly href = input.required<string>();
  protected readonly external = computed(() => isExternal(this.href()));
  protected readonly hintId = NEW_TAB_HINT_ID;
}
