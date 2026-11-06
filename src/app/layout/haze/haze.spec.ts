import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Haze } from './haze';

describe('Haze', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The prerender destroys the component in Node, where this API does not exist.
  it('touches no browser API when destroyed before it rendered, as on the server', () => {
    vi.stubGlobal('cancelAnimationFrame', undefined);
    const fixture = TestBed.createComponent(Haze);

    expect(() => fixture.destroy()).not.toThrow();
  });
});
