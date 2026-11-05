// Everything the status collector asks, as data. Only public sources and public repositories.
// Loaded by scripts/collect-status.mjs via type stripping, so only type imports here.
import type { StatusSources } from './status';

const owner = 'PhilippKlinger';

const videoflixChecks = [
  { name: 'CI', file: 'ci.yml', kind: 'tests' },
  { name: 'CodeQL', file: 'codeql.yml', kind: 'scan' },
  { name: 'Security Checks', file: 'security.yml', kind: 'scan' },
] as const;

export const statusSources: StatusSources = {
  linkHosts: ['github.com', 'scorecard.dev'],
  projects: {
    videoflix: {
      repos: [
        {
          name: `${owner}/videoflix-backend`,
          ciWorkflow: 'ci.yml',
          workflows: [...videoflixChecks],
          // CI tags every image with the commit SHA.
          attestation: { kind: 'image', image: 'philippklinger/videoflix-backend' },
        },
        {
          name: `${owner}/videoflix-frontend`,
          ciWorkflow: 'ci.yml',
          workflows: [...videoflixChecks],
          attestation: { kind: 'image', image: 'philippklinger/videoflix-frontend' },
        },
        // Only compose files and docs: no workflows, no build output to attest.
        { name: `${owner}/videoflix-deploy`, workflows: [] },
      ],
      versionEndpoints: [
        {
          component: 'backend',
          repo: `${owner}/videoflix-backend`,
          url: 'https://videoflix.philipp-klinger.com/api/version',
        },
        {
          component: 'frontend',
          repo: `${owner}/videoflix-frontend`,
          url: 'https://videoflix.philipp-klinger.com/version.json',
        },
      ],
      uptime: { baseUrl: 'https://status.philipp-klinger.com', slug: 'videoflix' },
      restoreTest: { repo: `${owner}/videoflix-deploy`, path: 'restore-test.json' },
    },
    portfolio: {
      repos: [
        {
          name: `${owner}/philippklinger.com`,
          ciWorkflow: 'ci.yml',
          workflows: [
            { name: 'CI', file: 'ci.yml', kind: 'tests' },
            { name: 'CodeQL', file: 'codeql.yml', kind: 'scan' },
          ],
          // The deploy attests the built files, so the live file itself proves its origin.
          attestation: { kind: 'file', url: 'https://preview.philipp-klinger.com/version.json' },
        },
      ],
      versionEndpoints: [
        {
          component: 'site',
          repo: `${owner}/philippklinger.com`,
          url: 'https://preview.philipp-klinger.com/version.json',
        },
      ],
      uptime: { baseUrl: 'https://status.philipp-klinger.com', slug: 'portfolio' },
      // No restore test exists for the static site: stays "not reachable" until one does.
      restoreTest: null,
    },
  },
};
