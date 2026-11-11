import { vi } from 'vitest';
import { ChainHint } from './chain-hint';

const KEY = 'pk-chain-hint-done';

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('ChainHint', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('[D5] shows 2.5 s after the chain comes into view', () => {
    const hint = new ChainHint(memoryStorage());
    hint.inView(true);
    vi.advanceTimersByTime(2499);
    expect(hint.shown()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(hint.shown()).toBe(true);
    hint.destroy();
  });

  it('[D5] hides after 6 s', () => {
    const hint = new ChainHint(memoryStorage());
    hint.inView(true);
    vi.advanceTimersByTime(2500 + 5999);
    expect(hint.shown()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hint.shown()).toBe(false);
    hint.destroy();
  });

  it('[D5] shows again 10 s after the first showing hid, once', () => {
    const hint = new ChainHint(memoryStorage());
    hint.inView(true);
    vi.advanceTimersByTime(8500);
    expect(hint.shown()).toBe(false);
    vi.advanceTimersByTime(9999);
    expect(hint.shown()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(hint.shown()).toBe(true);
    vi.advanceTimersByTime(6000);
    expect(hint.shown()).toBe(false);
    vi.advanceTimersByTime(60000);
    expect(hint.shown()).toBe(false);
    hint.destroy();
  });

  it('[D5] postpones the second showing by activity while hidden', () => {
    const hint = new ChainHint(memoryStorage());
    hint.inView(true);
    vi.advanceTimersByTime(15000);
    hint.activity();
    vi.advanceTimersByTime(9999);
    expect(hint.shown()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(hint.shown()).toBe(true);
    hint.destroy();
  });

  it('[D5] keeps showing on activity while shown', () => {
    const hint = new ChainHint(memoryStorage());
    hint.inView(true);
    vi.advanceTimersByTime(2500);
    hint.activity();
    expect(hint.shown()).toBe(true);
    vi.advanceTimersByTime(5999);
    expect(hint.shown()).toBe(true);
    hint.destroy();
  });

  it('[D5] arms no timer on activity after destroy', () => {
    const hint = new ChainHint(memoryStorage());
    hint.inView(true);
    vi.advanceTimersByTime(8500);
    hint.destroy();
    hint.activity();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('[D5] never shows after the first choice, also in a new instance with the same storage', () => {
    const storage = memoryStorage();
    const hint = new ChainHint(storage);
    hint.inView(true);
    vi.advanceTimersByTime(2500);
    hint.chosen();
    expect(hint.shown()).toBe(false);
    expect(storage.getItem(KEY)).not.toBeNull();
    vi.advanceTimersByTime(60000);
    expect(hint.shown()).toBe(false);

    const next = new ChainHint(storage);
    next.inView(true);
    vi.advanceTimersByTime(60000);
    expect(next.shown()).toBe(false);
    hint.destroy();
    next.destroy();
  });

  it('[D5] works without storage', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [null, throwing]) {
      const hint = new ChainHint(storage);
      hint.inView(true);
      vi.advanceTimersByTime(2500);
      expect(hint.shown()).toBe(true);
      expect(() => hint.chosen()).not.toThrow();
      expect(hint.shown()).toBe(false);
      hint.destroy();
    }
  });

  it('[D5] hides and cancels timers when the chain leaves the view', () => {
    const hint = new ChainHint(memoryStorage());
    hint.inView(true);
    vi.advanceTimersByTime(2500);
    hint.inView(false);
    expect(hint.shown()).toBe(false);
    vi.advanceTimersByTime(60000);
    expect(hint.shown()).toBe(false);
    hint.destroy();
  });

  it('[D5] keeps the 6 s hide when the chain is reported in view again while shown', () => {
    const hint = new ChainHint(memoryStorage());
    hint.inView(true);
    vi.advanceTimersByTime(2500);
    expect(hint.shown()).toBe(true);
    hint.inView(true);
    vi.advanceTimersByTime(6000);
    expect(hint.shown()).toBe(false);
    hint.destroy();
  });
});
