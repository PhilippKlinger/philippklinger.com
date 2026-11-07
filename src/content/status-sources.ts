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
        // Compose files, docs and the deploy workflow: no build output to attest.
        {
          name: `${owner}/videoflix-deploy`,
          workflows: [{ name: 'Deploy', file: 'deploy.yml', kind: 'deploy' }],
        },
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
            // The run stays open while production waits for approval, so ask for the job.
            { name: 'Deploy preview', file: 'deploy.yml', kind: 'deploy', job: 'Deploy preview' },
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
    conduit: {
      repos: [
        {
          name: `${owner}/conduit-container`,
          ciWorkflow: 'ci.yml',
          // deployment.yml runs on main only after the rework (EV-13).
          workflows: [{ name: 'CI', file: 'ci.yml', kind: 'tests' }],
          // CI tags every image with the commit SHA.
          attestation: { kind: 'image', image: 'philippklinger/conduit-backend' },
        },
      ],
      versionEndpoints: [],
      uptime: null,
      restoreTest: null,
    },
  },
};
