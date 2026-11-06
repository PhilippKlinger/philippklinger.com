// Test data shared by the specs of the software delivery; never imported by the app.
import { ProjectStatus } from './status';

const sha = '82dcf438f80efbfa0c7ab601feb1609b18d0ecad';
const repo = 'PhilippKlinger/example';

/** A project in which every station is proven, as the collector writes it. */
export function healthyStatus(): ProjectStatus {
  return {
    code: {
      reachable: true,
      signals: {
        repos: [
          {
            repo,
            reachable: true,
            isPublic: true,
            defaultBranch: 'main',
            mergedPullRequests: 28,
            rulesets: [
              {
                enforcement: 'active',
                target: 'branch',
                appliesToDefaultBranch: true,
                ruleTypes: ['pull_request'],
              },
            ],
          },
        ],
      },
      links: [
        { kind: 'repository', source: repo, url: 'https://github.com/PhilippKlinger/example' },
      ],
    },
    checks: {
      reachable: true,
      signals: {
        workflows: [
          {
            repo,
            workflow: 'CI',
            file: 'ci.yml',
            kind: 'tests',
            reachable: true,
            conclusion: 'success',
            headSha: sha,
            completedAt: '2026-11-05T19:33:18Z',
          },
        ],
      },
      links: [],
    },
    supplyChain: {
      reachable: true,
      signals: {
        repos: [
          {
            repo,
            reachable: true,
            attestation: {
              reachable: true,
              subjectDigest: 'sha256:abc',
              provenanceCount: 1,
              sourceSha: sha,
            },
            sbom: { reachable: true, spdxVersion: 'SPDX-2.3', packageCount: 520 },
            scorecard: { reachable: true, score: 6.7, date: '2026-11-05T19:28:28Z' },
          },
        ],
      },
      links: [],
    },
    live: {
      reachable: true,
      signals: {
        components: [
          {
            component: 'site',
            repo,
            reachable: true,
            deployedSha: sha,
            builtAt: '2026-11-05T19:28:36Z',
            latestGreenSha: sha,
            matchesLatestGreen: true,
          },
        ],
      },
      links: [],
    },
    stability: {
      reachable: true,
      signals: {
        monitorsTotal: 2,
        monitorsUp: 2,
        uptime24h: 1,
        uptime30d: 0.9985,
        lastHeartbeatAt: '2026-11-06T00:50:00Z',
        oldestVisibleHeartbeatAt: '2026-11-05T12:00:00Z',
      },
      links: [],
    },
    restore: {
      reachable: true,
      signals: { testedAt: '2026-11-04T00:00:00Z', result: 'passed' },
      links: [],
    },
  };
}
