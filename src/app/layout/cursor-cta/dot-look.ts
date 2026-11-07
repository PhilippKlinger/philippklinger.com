import { cursorText } from './cursor-text';

/** How the pointer dot shows over this element; off leaves the place to the ring or the normal pointer. */
export function dotLook(target: Element | null): 'dot' | 'circle' | 'off' {
  if (!target) return 'dot';
  if (target.closest('input, textarea') || cursorText(target)) return 'off';
  return target.closest('a, button') ? 'circle' : 'dot';
}
