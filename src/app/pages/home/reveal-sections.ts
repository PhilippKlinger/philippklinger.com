import { DestroyRef } from '@angular/core';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Fades the sections of the start page in as they come into view (S5). Only this code hides a
 * section, and only one whose content is still below the view: the prerendered page, a page
 * without JavaScript, reduced motion and everything already on screen show at once. Plain
 * classes instead of signals, so the reveal never asks Angular for a frame.
 */
export function revealSectionsOnScroll(root: HTMLElement, destroyRef: DestroyRef): void {
  const sections = [...root.querySelectorAll<HTMLElement>('.section')];
  if (sections.length === 0 || matchMedia(REDUCED_MOTION).matches) return;
  // The empty padding above the content: a section counts as in view once its content is.
  const padding = parseFloat(getComputedStyle(sections[0]).paddingTop);
  const observer = new IntersectionObserver((entries) => showEntered(entries, observer), {
    rootMargin: `0px 0px ${-padding}px 0px`,
  });
  for (const section of sections.filter((each) => contentBelowView(each, padding))) {
    section.classList.add('reveal');
    observer.observe(section);
  }
  destroyRef.onDestroy(() => observer.disconnect());
}

function contentBelowView(section: HTMLElement, padding: number): boolean {
  return section.getBoundingClientRect().top + padding >= innerHeight;
}

function showEntered(entries: IntersectionObserverEntry[], observer: IntersectionObserver): void {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    target.classList.add('in');
    observer.unobserve(target);
  }
}
