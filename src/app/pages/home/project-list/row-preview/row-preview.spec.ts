import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { Point } from '../../../../layout/haze/haze-shader';
import { placePreview, RowPreview } from './row-preview';

// A list at 1440 px: the title column ends at 416 px, the image is 22rem wide.
const viewport = { width: 1440, height: 900 };
const size = { width: 352, height: 220 };
const title = { left: 112, right: 416, top: 380, bottom: 420 };
const preview = { src: 'images/projects/videoflix.webp', width: 640, height: 336 };

function covers({ x, y }: Point, box: typeof title): boolean {
  const apart = x >= box.right || x + size.width <= box.left;
  return !apart && y < box.bottom && y + size.height > box.top;
}

describe('placePreview', () => {
  it('sits right of the pointer where it fits', () => {
    const { x } = placePreview({ pointer: { x: 700, y: 400 }, size, titleRight: 416, viewport });
    expect(x).toBeGreaterThan(700);
    expect(x + size.width).toBeLessThanOrEqual(viewport.width);
  });

  it('flips to the left near the right edge', () => {
    const { x } = placePreview({ pointer: { x: 1300, y: 400 }, size, titleRight: 416, viewport });
    expect(x + size.width).toBeLessThan(1300);
    expect(x).toBeGreaterThan(title.right);
  });

  it('never covers the title', () => {
    const narrow = { width: 960, height: 700 };
    const cases = [
      { pointer: { x: 150, y: 400 }, viewport },
      { pointer: { x: 410, y: 390 }, viewport },
      { pointer: { x: 1300, y: 400 }, viewport },
      // Neither side fits: the image may meet the ring, never the title.
      { pointer: { x: 600, y: 400 }, viewport: narrow },
    ];
    for (const { pointer, viewport: view } of cases) {
      const at = placePreview({ pointer, size, titleRight: title.right, viewport: view });
      expect(covers(at, title), `pointer ${pointer.x}, viewport ${view.width}`).toBe(false);
    }
  });

  it('stays inside the viewport at its top and bottom edge', () => {
    for (const y of [0, viewport.height]) {
      const at = placePreview({ pointer: { x: 700, y }, size, titleRight: 416, viewport });
      expect(at.y).toBeGreaterThan(0);
      expect(at.y + size.height).toBeLessThan(viewport.height);
    }
  });
});

describe('RowPreview', () => {
  let followAllowed = false;
  // jsdom has no matchMedia; the media query decides between following and standing in the row.
  beforeEach(() =>
    vi.stubGlobal('matchMedia', () => ({
      matches: followAllowed,
      addEventListener: () => undefined,
    })),
  );
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.querySelectorAll('a.row').forEach((row) => row.remove());
  });

  function render() {
    const fixture = TestBed.createComponent(RowPreview);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const show = (image: typeof preview | null) => {
      fixture.componentInstance.show(rowElement(), image);
      fixture.detectChanges();
    };
    return { fixture, host, show };
  }

  function rowElement(): HTMLElement {
    const row = document.createElement('a');
    row.className = 'row';
    row.innerHTML = '<h3>Videoflix</h3>';
    document.body.append(row);
    return row;
  }

  it('is hidden from screen readers and starts hidden', () => {
    const { host } = render();
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.classList).not.toContain('is-on');
    expect(host.querySelector('img')).toBeNull();
  });

  it('shows the image with its fixed size, as decoration', () => {
    const { host, show } = render();
    show(preview);
    const image = host.querySelector('img')!;
    expect(image.getAttribute('src')).toBe(preview.src);
    expect(image.getAttribute('width')).toBe('640');
    expect(image.getAttribute('height')).toBe('336');
    expect(image.getAttribute('alt')).toBe('');
    expect(host.classList).toContain('is-on');
  });

  it('shows an empty placeholder for a row without an image', () => {
    const { host, show } = render();
    show(preview);
    show(null);
    expect(host.querySelector('img')).toBeNull();
    expect(host.classList).toContain('is-on');
  });

  it('stands in the row without the ring, e.g. with reduced motion', () => {
    const { host, show } = render();
    show(preview);
    expect(host.classList).toContain('is-anchored');
  });

  it('follows the pointer where the ring is allowed', () => {
    followAllowed = true;
    try {
      const { fixture, host, show } = render();
      show(preview);
      expect(host.classList).not.toContain('is-anchored');
      fixture.componentInstance.hide();
    } finally {
      followAllowed = false;
    }
  });

  it('stops following once motion is switched off', () => {
    const query = { matches: true, onChange: () => undefined as void };
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return query.matches;
      },
      addEventListener: (_: string, listener: () => void) => (query.onChange = listener),
    }));
    const { host, show } = render();
    show(preview);
    query.matches = false;
    query.onChange();
    expect(host.classList).not.toContain('is-on');
  });

  it('hides on hide() and on Escape', () => {
    const { fixture, host, show } = render();
    show(preview);
    fixture.componentInstance.hide();
    expect(host.classList).not.toContain('is-on');

    show(preview);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.classList).not.toContain('is-on');
  });
});
