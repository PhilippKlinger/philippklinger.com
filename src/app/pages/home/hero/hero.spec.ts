import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { STATUS_SNAPSHOT } from '../../../delivery/status-snapshot';
import { profile } from '../../../../content/profile';
import { Hero } from './hero';

describe('Hero', () => {
  // jsdom has no matchMedia; reduced motion keeps the chain in its end state.
  beforeEach(() =>
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined })),
  );
  afterEach(() => vi.unstubAllGlobals());

  // The phone gives each part of the role its own line. A text pass that drops the separator
  // from profile.role would lose that line break without anything else turning red.
  it('splits the role into its two parts for the line break on the phone', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: STATUS_SNAPSHOT, useValue: null }],
    });
    const fixture = TestBed.createComponent(Hero);
    fixture.detectChanges();
    const role = (fixture.nativeElement as HTMLElement).querySelector('.role')!;
    const parts = [...role.querySelectorAll('span:not(.role-dot)')].map((part) => part.textContent);
    expect(parts).toHaveLength(2);
    expect(parts.join(' · ')).toBe(profile.role);
  });
});
