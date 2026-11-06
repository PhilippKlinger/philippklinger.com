import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DeliveryView } from '../../../../../content/software-delivery';
import { DeliveryFlow } from './delivery-flow';

const view: DeliveryView = {
  signal: { status: 'CI grün', when: 'zuletzt 05.11.' },
  counter: '1 von 3 belegt',
  steps: [
    { name: 'Code', arrowToNext: 'CI', state: 'verified', sentence: 'a', event: null, links: [] },
    {
      name: 'Tests',
      arrowToNext: 'Image',
      state: 'deviation',
      sentence: 'b',
      event: null,
      links: [],
    },
    {
      name: 'Restore',
      arrowToNext: null,
      state: 'notSetUp',
      sentence: 'c',
      event: null,
      links: [],
    },
  ],
};

function render(): HTMLElement {
  const fixture = TestBed.createComponent(DeliveryFlow);
  (fixture.componentRef as ComponentRef<DeliveryFlow>).setInput('view', view);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const textsOf = (host: HTMLElement, selector: string) =>
  [...host.querySelectorAll(selector)].map((element) => element.textContent?.trim());

describe('DeliveryFlow', () => {
  it('titles the panel', () => {
    expect(render().querySelector('.flow-title')?.textContent).toBe('Software Delivery');
  });

  it('shows the steps in order with state in words', () => {
    const host = render();
    expect(textsOf(host, '.flow-step strong')).toEqual(['Code', 'Tests', 'Restore']);
    expect(textsOf(host, '.flow-step .state')).toEqual([
      'Belegt',
      'Abweichung',
      'Noch nicht eingerichtet',
    ]);
  });

  it('marks each step with its state for the frame', () => {
    const steps = render().querySelectorAll('.flow-step');
    expect(steps[0].classList).toContain('is-verified');
    expect(steps[1].classList).toContain('is-deviation');
    expect(steps[2].classList).toContain('is-notSetUp');
  });

  it('shows an arrow with label between steps, not after the last', () => {
    const items = [...render().querySelectorAll('ol > li')];
    expect(items.map((item) => item.querySelector('.flow-arrow')?.textContent?.trim())).toEqual([
      'CI',
      'Image',
      undefined,
    ]);
  });

  it('shows the counter in the foot', () => {
    expect(render().querySelector('.flow-foot')?.textContent).toBe('1 von 3 belegt');
  });
});
