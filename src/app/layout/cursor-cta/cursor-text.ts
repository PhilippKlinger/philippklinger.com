/** What the ring at the pointer says over this element, null when it should stay off. */
export function cursorText(target: Element | null): string | null {
  if (!target || target.closest('a, button')) return null;
  const cta = target.closest('[data-card-link]')?.querySelector('[data-cursor]');
  return cta?.getAttribute('data-cursor') ?? null;
}
