import { ComponentRef, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { docsUrl } from '../../../../content/site';
import { ProjectKey, StatusDocument } from '../../../../content/status';
import { healthyStatus } from '../../../../content/status.fixture';
import { EvidenceChain, STATUS_SNAPSHOT, statusSnapshotKey } from './evidence-chain';

function statusDocument(): StatusDocument {
  const videoflix = healthyStatus();
  videoflix.stability.reachable = false;
  return {
    schemaVersion: 1,
    generatedAt: '2026-11-06T00:58:11.069Z',
    projects: { videoflix, portfolio: healthyStatus() },
  };
}

function render(project: ProjectKey): HTMLElement {
  const fixture = TestBed.createComponent(EvidenceChain);
  (fixture.componentRef as ComponentRef<EvidenceChain>).setInput('project', project);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();

describe('EvidenceChain', () => {
  describe('with the status of the build', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: STATUS_SNAPSHOT, useValue: statusDocument() }],
      });
    });

    it('sums up the chain for a quick reader', () => {
      const summary = text(render('videoflix').querySelector('.summary'));
      expect(summary).toContain('5 von 6 belegt');
      expect(summary).toContain('Stand 06.11.2026, 01:58');
    });

    it('shows each station with title, sentence and a state in words', () => {
      const stations = render('videoflix').querySelectorAll('.stations > li');
      expect(stations).toHaveLength(6);
      expect(text(stations[0])).toContain('Code');
      expect(text(stations[0])).toContain('Belegt');
      expect(text(stations[0])).toContain('geschützten Hauptzweig');
      expect(text(stations[4])).toContain('Läuft stabil');
      expect(text(stations[4])).toContain('Nicht abrufbar');
    });

    it('keeps the details of each station in a native disclosure', () => {
      const first = render('videoflix').querySelector('.stations > li details');
      expect(first?.querySelector('summary')).not.toBeNull();
      expect(first?.hasAttribute('open')).toBe(false);
      expect(text(first!.querySelector('.facts'))).toContain('28 gemergte Pull Requests');
      expect(first!.querySelector('.artifacts a')?.getAttribute('href')).toBe(
        'https://github.com/PhilippKlinger/example',
      );
    });

    it('never says "running since", only how far the history reaches', () => {
      const element = render('videoflix');
      expect(text(element.querySelector('.summary'))).toContain('Verlauf sichtbar seit 05.11.2026');
      expect(element.textContent).not.toMatch(/läuft seit/i);
    });

    it('passes the status on to the browser without the other project', () => {
      render('videoflix');
      const state = TestBed.inject(TransferState).get(statusSnapshotKey, null);
      expect(state?.generatedAt).toBe('2026-11-06T00:58:11.069Z');
      expect(state).not.toHaveProperty('projects');
    });

    it('explains a station that is not planned instead of showing it as missing', () => {
      const station = render('portfolio').querySelectorAll('.stations > li')[5];
      expect(text(station)).toContain('Nicht vorgesehen');
      expect(text(station)).toContain('Statische Seite');
    });

    it('links to the technical documentation', () => {
      const link = render('videoflix').querySelector<HTMLAnchorElement>('a.docs');
      expect(link?.getAttribute('href')).toBe(docsUrl);
    });
  });

  it('renders from the state the prerendered page handed over', () => {
    TestBed.inject(TransferState).set(statusSnapshotKey, {
      generatedAt: '2026-11-06T00:58:11.069Z',
      status: healthyStatus(),
    });
    expect(text(render('videoflix').querySelector('.summary'))).toContain('6 von 6 belegt');
  });

  it('stays complete and honest without any data', () => {
    const element = render('videoflix');
    expect(text(element.querySelector('.summary'))).toContain('0 von 6 belegt');
    expect(text(element.querySelector('.summary'))).toContain('Stand unbekannt');
    expect(element.querySelectorAll('.stations > li')).toHaveLength(6);
    expect(text(element.querySelector('.stations'))).toContain('Nicht abrufbar');
  });
});
