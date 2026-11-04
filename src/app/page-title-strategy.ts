import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { shareImage, siteUrl } from '../content/site';

// Sets title, meta description, canonical URL, Open Graph and Twitter tags from the
// route config. Runs during prerendering too, so every static page ships them.
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot) ?? this.title.getTitle();
    const route = deepestChild(snapshot.root);
    const description = route.data['description'] as string | undefined;
    const canonical = route.data['canonical'] === false ? null : canonicalUrl(snapshot.url);

    this.title.setTitle(title);
    this.setMeta('name', 'description', description);
    this.setMeta('property', 'og:title', title);
    this.setMeta('property', 'og:description', description);
    this.setMeta('property', 'og:type', 'website');
    this.setMeta('property', 'og:locale', 'de_DE');
    this.setMeta('property', 'og:url', canonical ?? undefined);
    this.setShareImage();
    this.setCanonical(canonical);
  }

  // Same image on every page; crawlers need an absolute URL and the size up front.
  private setShareImage(): void {
    this.setMeta('property', 'og:image', `${siteUrl}/${shareImage.src}`);
    this.setMeta('property', 'og:image:width', String(shareImage.width));
    this.setMeta('property', 'og:image:height', String(shareImage.height));
    this.setMeta('property', 'og:image:alt', shareImage.alt);
    this.setMeta('name', 'twitter:card', 'summary_large_image');
  }

  private setMeta(attribute: 'name' | 'property', key: string, content?: string): void {
    if (content) {
      this.meta.updateTag({ [attribute]: key, content });
    } else {
      this.meta.removeTag(`${attribute}="${key}"`);
    }
  }

  // Angular has no service for <link>, so the element is managed directly.
  private setCanonical(href: string | null): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!href) {
      link?.remove();
      return;
    }
    link ??= this.document.head.appendChild(this.document.createElement('link'));
    link.rel = 'canonical';
    link.href = href;
  }
}

function deepestChild(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return route.firstChild ? deepestChild(route.firstChild) : route;
}

/** Absolute URL without query or fragment, with the trailing slash Apache uses. */
function canonicalUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  return siteUrl + (path.endsWith('/') ? path : `${path}/`);
}
