import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Home } from './home';
import { profilePageSchema } from './profile-page-schema';

const selector = 'script[type="application/ld+json"]';

describe('Home', () => {
  let head: HTMLHeadElement;

  beforeEach(() => {
    // Only the structured data is under test, not the sections.
    TestBed.overrideComponent(Home, { set: { imports: [], template: '' } });
    head = TestBed.inject(DOCUMENT).head;
  });

  it('adds the ProfilePage as JSON-LD to the head', () => {
    TestBed.createComponent(Home);
    const scripts = head.querySelectorAll(selector);
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].textContent ?? '')).toEqual(profilePageSchema());
  });

  // Hydration finds the prerendered block and must not add a second one.
  it('reuses a block that is already in the head', () => {
    const prerendered = head.appendChild(document.createElement('script'));
    prerendered.type = 'application/ld+json';
    TestBed.createComponent(Home);
    expect(head.querySelectorAll(selector)).toHaveLength(1);
  });

  it('removes the block when leaving the start page', () => {
    TestBed.createComponent(Home).destroy();
    expect(head.querySelector(selector)).toBeNull();
  });
});
