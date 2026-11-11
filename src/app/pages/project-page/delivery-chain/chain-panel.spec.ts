import { TestBed } from '@angular/core/testing';
import { ChainStation } from '../../../../content/delivery-chain';
import { ChainPanel } from './chain-panel';

const command = 'gh attestation verify \\\n  oci://ghcr.io/philippklinger/example@sha256:346d0a9';
const texts = (nodes: Iterable<Element>) => [...nodes].map((node) => node.textContent?.trim());

function station(fields: Partial<ChainStation> = {}): ChainStation {
  return {
    name: 'Tests & Security-Checks',
    toNext: null,
    state: 'verified',
    value: '1 von 1 passing',
    sentence: 'Jeder Commit läuft durch die Pipeline.',
    table: {
      head: ['Repo', 'CI', 'Commit'],
      rows: [
        [
          { text: 'Backend' },
          { text: '06.11.', ok: true, url: 'https://github.com/run' },
          { text: '82dcf43', sha: '82dcf43' },
        ],
      ],
    },
    verify: null,
    ...fields,
  };
}

function render(shown: ChainStation, hoveredSha: string | null = null): HTMLElement {
  const fixture = TestBed.createComponent(ChainPanel);
  fixture.componentRef.setInput('station', shown);
  fixture.componentRef.setInput('index', 1);
  fixture.componentRef.setInput('count', 6);
  fixture.componentRef.setInput('hoveredSha', hoveredSha);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ChainPanel', () => {
  it('says where the station stands in the chain and what it proves', () => {
    const panel = render(station());
    expect(panel.querySelector('.kicker')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '2 / 6 · Tests & Security-Checks',
    );
    expect(panel.querySelector('.what')?.textContent?.trim()).toBe(
      'Jeder Commit läuft durch die Pipeline.',
    );
  });

  it('shows the table with its heads, a label per stacked value and the links in their row', () => {
    const panel = render(station());

    expect(texts(panel.querySelectorAll('th'))).toEqual(['Repo', 'CI', 'Commit']);
    const cells = [...panel.querySelectorAll('tbody tr:first-child td')];
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([null, 'CI', 'Commit']);
    expect(cells[1].querySelector('a')?.getAttribute('href')).toBe('https://github.com/run');
    expect(cells[1].querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('passing');
    expect(cells[2].querySelector('[data-sha]')?.getAttribute('data-sha')).toBe('82dcf43');
  });

  it('marks the commit under the pointer', () => {
    expect(render(station()).querySelector('[data-match]')).toBeNull();
    TestBed.resetTestingModule();
    expect(render(station(), '82dcf43').querySelector('[data-sha][data-match]')).not.toBeNull();
  });

  it('offers the verify command only when the station has one', () => {
    expect(render(station()).querySelector('details')).toBeNull();
    TestBed.resetTestingModule();
    const verify = render(station({ verify: command })).querySelector('details.verify');

    expect(verify?.querySelector('summary')?.textContent).toContain('Selbst prüfen');
    expect(verify?.querySelector('pre')?.textContent).toBe(command);
  });
});
