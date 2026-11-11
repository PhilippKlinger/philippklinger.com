/** What the ring at the pointer says over this element, null when it should stay off. */
export function cursorText(target: Element | null): string | null {
  // A row of the project list is one link that carries its ring text; other links keep it off.
  const control = target?.closest('a, button');
  return control?.getAttribute('data-cursor') ?? null;
}
