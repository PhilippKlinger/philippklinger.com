import { TestBed } from '@angular/core/testing';
import { CursorDot } from './cursor-dot';

const CUSTOM_CURSOR = 'has-custom-cursor';

// jsdom has no matchMedia; this stands in for a device with a mouse that allows the dot.
function allowDot(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => undefined,
  }));
}

function createDot(): CursorDot {
  return TestBed.createComponent(CursorDot).componentInstance;
}

function move(dot: CursorDot, pointerType: string): void {
  dot.follow(new PointerEvent('pointermove', { pointerType, clientX: 10, clientY: 20 }));
}

const hasCustomCursor = () => document.documentElement.classList.contains(CUSTOM_CURSOR);

describe('CursorDot', () => {
  beforeEach(allowDot);
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove(CUSTOM_CURSOR);
  });

  // The CI runner sends a real pointerover at (0,0); only a move may take the normal pointer.
  it('keeps the normal pointer until the first move', () => {
    const dot = createDot();
    dot.start(new AbortController().signal);

    expect(hasCustomCursor()).toBe(false);
  });

  it('replaces the normal pointer on the first mouse move', () => {
    const dot = createDot();
    dot.start(new AbortController().signal);
    move(dot, 'mouse');

    expect(hasCustomCursor()).toBe(true);
  });

  it('keeps the normal pointer for touch', () => {
    const dot = createDot();
    dot.start(new AbortController().signal);
    move(dot, 'touch');

    expect(hasCustomCursor()).toBe(false);
  });
});
