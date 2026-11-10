import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Project, projects } from '../../../../../content/projects';
import { healthyStatus } from '../../../../../content/status.fixture';
import { DeliveryStatus } from '../../../../delivery/delivery-status';
import { STATUS_SNAPSHOT } from '../../../../delivery/status-snapshot';
import { ProjectCard } from './project-card';

function bySlug(slug: string): Project {
  return projects.find((project) => project.slug === slug)!;
}

function render(slug: string): HTMLElement {
  const fixture = TestBed.createComponent(ProjectCard);
  (fixture.componentRef as ComponentRef<ProjectCard>).setInput('project', bySlug(slug));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const textsOf = (host: HTMLElement, selector: string) =>
  [...host.querySelectorAll(selector)].map((element) => element.textContent?.trim());

describe('ProjectCard', () => {
  it('has a CTA to the project page with trailing slash and the title in its label', () => {
    const cta = render('vps-plattform').querySelector('a[data-card-cta]');
    expect(cta?.getAttribute('href')).toBe('/projekte/vps-plattform/');
    expect(cta?.getAttribute('aria-label')).toBe('Projektdetails ansehen: VPS-Plattform');
    expect(cta?.getAttribute('data-cursor')).toBe('Projekt ansehen');
    expect(cta?.textContent?.trim()).toBe('Projektdetails ansehen');
  });

  it('makes the surface a card link', () => {
    expect(render('vps-plattform').querySelector('article.card[data-card-link]')).not.toBeNull();
  });

  it('shows title and text', () => {
    const host = render('vps-plattform');
    expect(host.querySelector('.card h3')?.textContent).toBe('VPS-Plattform');
    expect(host.querySelector('.card-main p')?.textContent).toBe(bySlug('vps-plattform').summary);
  });

  it('shows the quiet links', () => {
    const links = [...render('videoflix').querySelectorAll('a.cta-quiet')];
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Live ansehen', 'https://videoflix.philipp-klinger.com'],
      ['Code auf GitHub', 'https://github.com/PhilippKlinger/videoflix-backend'],
    ]);
  });

  it('shows the Kit without quiet links', () => {
    const host = render('developer-workspace-kit');
    expect(host.querySelectorAll('a.cta-quiet')).toHaveLength(0);
    expect(host.querySelectorAll('.actions a')).toHaveLength(1);
  });

  it('shows chips as a list', () => {
    expect(textsOf(render('vps-plattform'), 'ul.chips > li')).toEqual([
      'Docker Compose',
      'Caddy',
      'Uptime Kuma',
      'GitHub Actions',
      'Trivy',
    ]);
  });

  it('shows the fixed signal of Neuro Check-in without a status request', () => {
    const snapshot = vi.spyOn(TestBed.inject(DeliveryStatus), 'snapshot');
    const host = render('neuro-check-in');
    expect(host.querySelector('.signal .state')?.textContent?.trim()).toBe('Live im Play Store');
    expect(host.querySelector('.signal-when')?.textContent).toBe('Version 1.11.2');
    expect(snapshot).not.toHaveBeenCalled();
  });

  it('shows no empty time without data', () => {
    const host = render('videoflix');
    expect(host.querySelector('.signal .state')?.textContent?.trim()).toBe('Stand nicht abrufbar');
    expect(host.querySelector('.signal-when')).toBeNull();
  });

  it('builds signal and steps from the snapshot of its project', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: STATUS_SNAPSHOT,
          useValue: {
            schemaVersion: 1,
            generatedAt: '2026-11-06T00:58:11.069Z',
            projects: { videoflix: healthyStatus(), portfolio: healthyStatus() },
          },
        },
      ],
    });
    const host = render('videoflix');
    expect(host.querySelector('.signal .state')?.textContent?.trim()).not.toBe(
      'Stand nicht abrufbar',
    );
    expect(host.querySelector('.flow-step .state')?.textContent?.trim()).toBe('Belegt');
    expect(host.querySelectorAll('.flow-step')).toHaveLength(6);
  });

  it('shows a red check with the state of a deviation, not of a green signal', () => {
    const status = healthyStatus();
    status.checks.signals.workflows[0].conclusion = 'failure';
    TestBed.configureTestingModule({
      providers: [
        {
          provide: STATUS_SNAPSHOT,
          useValue: {
            schemaVersion: 1,
            generatedAt: '2026-11-06T00:58:11.069Z',
            projects: { videoflix: status, portfolio: healthyStatus() },
          },
        },
      ],
    });
    const host = render('videoflix');
    expect(host.querySelector('.signal .state-deviation')).not.toBeNull();
    expect(host.querySelector('.signal .state-verified')).toBeNull();
  });

  // Rollout: a file of the old collector still carries conduit and no vps-plattform.
  it('keeps the VPS platform readable when the status has no entry for it', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: STATUS_SNAPSHOT,
          useValue: {
            schemaVersion: 1,
            generatedAt: '2026-11-06T00:58:11.069Z',
            projects: {
              videoflix: healthyStatus(),
              portfolio: healthyStatus(),
              conduit: healthyStatus(),
            },
          },
        },
      ],
    });
    const host = render('vps-plattform');
    expect(host.querySelector('.signal .state')?.textContent?.trim()).toBe('Stand nicht abrufbar');
    expect(textsOf(host, '.flow-step strong')).toEqual(['Code', 'CI & Security-Checks', 'Betrieb']);
    expect(textsOf(host, '.flow-step .state')).toEqual([
      'Nicht abrufbar',
      'Nicht abrufbar',
      'Noch nicht eingerichtet',
    ]);
  });
});
