import {
  buildEvidenceChain,
  isStale,
  parseStatusDocument,
  pickProjectSnapshot,
  ProjectSnapshot,
} from './evidence-chain';
import { ProjectStatus, StationKey, StatusDocument } from './status';
import { healthyStatus } from './status.fixture';

function snapshot(change: (status: ProjectStatus) => void = () => undefined): ProjectSnapshot {
  const status = healthyStatus();
  change(status);
  return { generatedAt: '2026-11-06T00:58:11.069Z', status };
}

function stationOf(view: ReturnType<typeof buildEvidenceChain>, key: StationKey) {
  return view.stations.find((station) => station.key === key)!;
}

const stateOf = (change: (status: ProjectStatus) => void, key: StationKey) =>
  stationOf(buildEvidenceChain(snapshot(change), 'videoflix'), key).state;

describe('buildEvidenceChain', () => {
  it('lists the six stations in the order of the chain', () => {
    const view = buildEvidenceChain(snapshot(), 'videoflix');
    expect(view.stations.map((station) => station.key)).toEqual([
      'code',
      'checks',
      'supplyChain',
      'live',
      'stability',
      'restore',
    ]);
  });

  it('counts only verified stations, out of six', () => {
    const view = buildEvidenceChain(
      snapshot((status) => {
        status.stability.reachable = false;
        status.restore.signals.result = 'failed';
      }),
      'videoflix',
    );
    expect(view.verifiedCount).toBe(4);
    expect(view.total).toBe(6);
  });

  it('shows every station as not available when there is no data at all', () => {
    const view = buildEvidenceChain(null, 'videoflix');
    expect(view.stations.map((station) => station.state)).toEqual(Array(6).fill('unavailable'));
    expect(view.verifiedCount).toBe(0);
    expect(view.generatedAt).toBeNull();
  });

  it('names the time of the data in German, in the time zone of the site', () => {
    expect(buildEvidenceChain(snapshot(), 'videoflix').generatedAt).toBe('06.11.2026, 01:58');
  });

  it('offers the oldest visible heartbeat as a lower bound, not as a start of service', () => {
    expect(buildEvidenceChain(snapshot(), 'videoflix').historySince).toBe('05.11.2026');
    const missing = snapshot((status) => {
      status.stability.signals.oldestVisibleHeartbeatAt = null;
    });
    expect(buildEvidenceChain(missing, 'videoflix').historySince).toBeNull();
  });

  describe('station states', () => {
    it('code: an unprotected default branch is a deviation', () => {
      expect(
        stateOf((status) => {
          status.code.signals.repos[0].rulesets![0].enforcement = 'disabled';
        }, 'code'),
      ).toBe('deviation');
    });

    it('code: a ruleset that misses the default branch is a deviation', () => {
      expect(
        stateOf((status) => {
          status.code.signals.repos[0].rulesets![0].appliesToDefaultBranch = false;
        }, 'code'),
      ).toBe('deviation');
    });

    it('code: a private repository is a deviation', () => {
      expect(
        stateOf((status) => {
          status.code.signals.repos[0].isPublic = false;
        }, 'code'),
      ).toBe('deviation');
    });

    it('checks: a failed workflow is a deviation', () => {
      expect(
        stateOf((status) => {
          status.checks.signals.workflows[0].conclusion = 'failure';
        }, 'checks'),
      ).toBe('deviation');
    });

    it('checks: a known failure outranks another unreachable source', () => {
      expect(
        stateOf((status) => {
          status.checks.reachable = false;
          status.checks.signals.workflows[0].conclusion = 'failure';
        }, 'checks'),
      ).toBe('deviation');
    });

    it('supply chain: zero attestations are no proof', () => {
      expect(
        stateOf((status) => {
          status.supplyChain.signals.repos[0].attestation!.provenanceCount = 0;
        }, 'supplyChain'),
      ).toBe('deviation');
    });

    it('supply chain: a repository that builds nothing needs no attestation', () => {
      expect(
        stateOf((status) => {
          status.supplyChain.signals.repos[0].attestation = null;
        }, 'supplyChain'),
      ).toBe('verified');
    });

    it('live: a deployed commit other than the latest green one is a deviation', () => {
      expect(
        stateOf((status) => {
          status.live.signals.components[0].matchesLatestGreen = false;
        }, 'live'),
      ).toBe('deviation');
    });

    it('live: no statement on the comparison is not verified', () => {
      expect(
        stateOf((status) => {
          status.live.signals.components[0].matchesLatestGreen = null;
        }, 'live'),
      ).toBe('unavailable');
    });

    it('stability: a monitor that is down is a deviation', () => {
      expect(
        stateOf((status) => {
          status.stability.signals.monitorsUp = 1;
        }, 'stability'),
      ).toBe('deviation');
    });

    it('stability: no monitors at all is not verified', () => {
      expect(
        stateOf((status) => {
          status.stability.signals.monitorsTotal = 0;
          status.stability.signals.monitorsUp = 0;
        }, 'stability'),
      ).toBe('unavailable');
    });

    it('restore: a failed test is a deviation', () => {
      expect(
        stateOf((status) => {
          status.restore.signals.result = 'failed';
        }, 'restore'),
      ).toBe('deviation');
    });

    it('restore: a date without a result still counts as tested', () => {
      expect(
        stateOf((status) => {
          status.restore.signals.result = null;
        }, 'restore'),
      ).toBe('verified');
    });

    it.each(['code', 'checks', 'supplyChain', 'live', 'stability', 'restore'] as StationKey[])(
      '%s: an unreachable station without a known problem is not available',
      (key) => {
        expect(
          stateOf((status) => {
            status[key].reachable = false;
          }, key),
        ).toBe('unavailable');
      },
    );
  });

  it('marks the restore test of the static site as not planned, with its own wording', () => {
    const videoflix = stationOf(buildEvidenceChain(null, 'videoflix'), 'restore');
    const portfolio = stationOf(buildEvidenceChain(null, 'portfolio'), 'restore');
    expect(videoflix.state).toBe('unavailable');
    expect(portfolio.state).toBe('notPlanned');
    expect(portfolio.sentence).not.toBe(videoflix.sentence);
  });

  it('does not count a station that is not planned', () => {
    const view = buildEvidenceChain(snapshot(), 'portfolio');
    expect(view.verifiedCount).toBe(5);
  });

  describe('facts for technical readers', () => {
    const factsOf = (key: StationKey, change?: (status: ProjectStatus) => void) =>
      stationOf(buildEvidenceChain(snapshot(change), 'videoflix'), key).facts;

    it('code: merged pull requests and protection per repository', () => {
      expect(factsOf('code')).toEqual(['example: 28 gemergte Pull Requests, Hauptzweig geschützt']);
    });

    it('code: says so when a repository is not reachable', () => {
      const facts = factsOf('code', (status) => {
        status.code.signals.repos[0].reachable = false;
      });
      expect(facts).toEqual(['example: nicht abrufbar']);
    });

    it('checks: result, time and short commit per workflow', () => {
      expect(factsOf('checks')).toEqual([
        'example, CI: erfolgreich, 05.11.2026, 20:33, Commit 82dcf43',
      ]);
    });

    it('checks: partial data stays visible next to an unreachable workflow', () => {
      const facts = factsOf('checks', (status) => {
        const [workflow] = status.checks.signals.workflows;
        status.checks.signals.workflows.push({ ...workflow, workflow: 'CodeQL', reachable: false });
      });
      expect(facts).toEqual([
        'example, CI: erfolgreich, 05.11.2026, 20:33, Commit 82dcf43',
        'example, CodeQL: nicht abrufbar',
      ]);
    });

    it('supply chain: attestation, SBOM and score per repository', () => {
      expect(factsOf('supplyChain')).toEqual([
        'example: 1 Herkunftsnachweis, SBOM mit 520 Paketen, Scorecard 6,7',
      ]);
    });

    it('supply chain: reads each source on its own', () => {
      const facts = factsOf('supplyChain', (status) => {
        const [item] = status.supplyChain.signals.repos;
        item.attestation = { reachable: false, subjectDigest: null, provenanceCount: null };
        item.sbom = { reachable: false, spdxVersion: null, packageCount: null };
      });
      expect(facts).toEqual([
        'example: Herkunftsnachweis nicht abrufbar, SBOM nicht abrufbar, Scorecard 6,7',
      ]);
    });

    it('supply chain: leaves out the attestation of a repository that builds nothing', () => {
      const facts = factsOf('supplyChain', (status) => {
        status.supplyChain.signals.repos[0].attestation = null;
      });
      expect(facts).toEqual(['example: SBOM mit 520 Paketen, Scorecard 6,7']);
    });

    it('live: deployed commit, build time and the comparison per component', () => {
      expect(factsOf('live')).toEqual([
        'site: Commit 82dcf43, gebaut 05.11.2026, 20:28, entspricht dem letzten grünen Stand',
      ]);
    });

    it('live: names a deviation from the latest green commit', () => {
      const facts = factsOf('live', (status) => {
        status.live.signals.components[0].matchesLatestGreen = false;
      });
      expect(facts).toEqual([
        'site: Commit 82dcf43, gebaut 05.11.2026, 20:28, weicht vom letzten grünen Stand ab',
      ]);
    });

    it('stability: monitors and availability in percent', () => {
      expect(factsOf('stability')).toEqual([
        '2 von 2 Diensten erreichbar',
        'Verfügbarkeit 24 Stunden: 100 %, 30 Tage: 99,85 %',
      ]);
    });

    it('restore: date and result', () => {
      expect(factsOf('restore')).toEqual(['Getestet am 04.11.2026, Ergebnis: bestanden']);
    });

    it('an empty station says so instead of showing nothing', () => {
      const facts = stationOf(buildEvidenceChain(null, 'videoflix'), 'stability').facts;
      expect(facts).toEqual(['Keine Daten abrufbar']);
    });
  });

  describe('links', () => {
    it('names kind and source of a link', () => {
      const [link] = stationOf(buildEvidenceChain(snapshot(), 'videoflix'), 'code').links;
      expect(link).toEqual({
        label: 'Repository (example)',
        url: 'https://github.com/PhilippKlinger/example',
      });
    });

    it('numbers links that would otherwise read the same', () => {
      const data = snapshot((status) => {
        status.checks.links = [
          {
            kind: 'workflow-run',
            source: 'PhilippKlinger/example',
            url: 'https://github.com/run/1',
          },
          {
            kind: 'workflow-run',
            source: 'PhilippKlinger/example',
            url: 'https://github.com/run/2',
          },
        ];
      });
      const { links } = stationOf(buildEvidenceChain(data, 'videoflix'), 'checks');
      expect(links.map((link) => link.label)).toEqual([
        'Prüflauf 1 (example)',
        'Prüflauf 2 (example)',
      ]);
    });

    it('drops anything but https links', () => {
      const data = snapshot((status) => {
        status.code.links = [
          { kind: 'repository', source: 'PhilippKlinger/example', url: 'javascript:alert(1)' },
        ];
      });
      expect(stationOf(buildEvidenceChain(data, 'videoflix'), 'code').links).toEqual([]);
    });
  });
});

describe('parseStatusDocument', () => {
  function validDocument(): StatusDocument {
    return {
      schemaVersion: 1,
      generatedAt: '2026-11-06T00:58:11.069Z',
      projects: { videoflix: healthyStatus(), portfolio: healthyStatus() },
    };
  }

  it('accepts a complete document', () => {
    const document = validDocument();
    expect(parseStatusDocument(JSON.stringify(document))).toEqual(document);
  });

  it.each([
    ['a truncated upload', '{"schemaVersion":1,"generatedAt":"2026'],
    ['the HTML of the 404 page', '<!doctype html><html></html>'],
    ['null', 'null'],
    ['an empty body', ''],
  ])('rejects %s', (_name, text) => {
    expect(parseStatusDocument(text)).toBeNull();
  });

  it('rejects another schema version', () => {
    expect(
      parseStatusDocument(JSON.stringify({ ...validDocument(), schemaVersion: 2 })),
    ).toBeNull();
  });

  it('rejects an invalid time', () => {
    expect(
      parseStatusDocument(JSON.stringify({ ...validDocument(), generatedAt: 'x' })),
    ).toBeNull();
  });

  it('rejects a missing project', () => {
    const { videoflix } = validDocument().projects;
    const text = JSON.stringify({ ...validDocument(), projects: { videoflix } });
    expect(parseStatusDocument(text)).toBeNull();
  });

  it.each<[string, (status: ProjectStatus) => void]>([
    ['is missing', (status) => delete (status as Partial<ProjectStatus>).restore],
    ['has no links', (status) => Object.assign(status.live, { links: null })],
    ['has no signals', (status) => Object.assign(status.code, { signals: null })],
    ['has no state', (status) => Object.assign(status.code, { reachable: 'yes' })],
  ])('rejects a document in which a station %s', (_name, change) => {
    const document = validDocument();
    change(document.projects.portfolio);
    expect(parseStatusDocument(JSON.stringify(document))).toBeNull();
  });
});

describe('pickProjectSnapshot', () => {
  it('keeps only the project of the page', () => {
    const videoflix = healthyStatus();
    const document: StatusDocument = {
      schemaVersion: 1,
      generatedAt: '2026-11-06T00:58:11.069Z',
      projects: { videoflix, portfolio: healthyStatus() },
    };
    expect(pickProjectSnapshot(document, 'videoflix')).toEqual({
      generatedAt: '2026-11-06T00:58:11.069Z',
      status: videoflix,
    });
  });

  it('stays empty without a document', () => {
    expect(pickProjectSnapshot(null, 'videoflix')).toBeNull();
  });
});

describe('isStale', () => {
  const generatedAt = '2026-11-05T12:00:00Z';

  it('accepts data up to one day old', () => {
    expect(isStale(generatedAt, new Date('2026-11-06T12:00:00Z'))).toBe(false);
  });

  it('flags older data', () => {
    expect(isStale(generatedAt, new Date('2026-11-06T12:00:01Z'))).toBe(true);
  });
});
