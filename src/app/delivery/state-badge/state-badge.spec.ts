import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { deliveryTexts, StepState } from '../../../content/software-delivery';
import { StateBadge } from './state-badge';

const stepStates: StepState[] = [
  'verified',
  'partial',
  'deviation',
  'unavailable',
  'notSetUp',
  'private',
];

function render(state: StepState): HTMLElement {
  const fixture = TestBed.createComponent(StateBadge);
  (fixture.componentRef as ComponentRef<StateBadge>).setInput('state', state);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('StateBadge', () => {
  it.each(stepStates)('shows icon and word for %s', (state) => {
    const badge = render(state).querySelector(`span.state.state-${state}`);
    expect(badge?.textContent?.trim()).toBe(deliveryTexts.stateLabels[state]);
    expect(badge?.querySelector('svg')?.children.length).toBeGreaterThan(0);
  });

  it('hides the icon from screen readers', () => {
    for (const state of stepStates) {
      expect(render(state).querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('draws a different icon for every state', () => {
    const icons = stepStates.map((state) => render(state).querySelector('svg')?.innerHTML);
    expect(new Set(icons).size).toBe(stepStates.length);
  });
});
