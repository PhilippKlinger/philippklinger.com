// Everything the status collector asks, as data. Only public sources and public repositories.
// Loaded by scripts/collect-status.mjs via type stripping, so only type imports here.
import type { StatusSources } from './status';

const owner = 'PhilippKlinger';

// The same three workflows in the repositories of Videoflix and of the VPS platform.
const standardChecks = [
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
          workflows: [...standardChecks],
          // CI tags every image with the commit SHA.
          attestation: { kind: 'image', image: 'philippklinger/videoflix-backend' },
        },
        {
          name: `${owner}/videoflix-frontend`,
          ciWorkflow: 'ci.yml',
          workflows: [...standardChecks],
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
    // Configuration only: both repositories pin upstream images and build none, so nothing to
    // attest and no version endpoint. videoflix-deploy already counts for Videoflix.
    'vps-plattform': {
      repos: [
        { name: `${owner}/vps-edge`, ciWorkflow: 'ci.yml', workflows: [...standardChecks] },
        { name: `${owner}/vps-monitoring`, ciWorkflow: 'ci.yml', workflows: [...standardChecks] },
      ],
      versionEndpoints: [],
      // Holds only the monitor "Statusseite" until the go-live (q11).
      uptime: { baseUrl: 'https://status.philipp-klinger.com', slug: 'vps-plattform' },
      restoreTest: null,
    },
    // The website of the Neuro check-in: only reachability counts, the repositories belong to
    // the delivery plan of the project itself.
    'neuro-check-in': {
      repos: [],
      versionEndpoints: [],
      uptime: { baseUrl: 'https://status.philipp-klinger.com', slug: 'neuro-check-in' },
      restoreTest: null,
    },
  },
};
