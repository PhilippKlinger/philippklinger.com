import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the real static build (npm run build), served by
// e2e/server.mjs with the same redirect and 404 behaviour as Apache on the host.
// One project per breakpoint of the template (spec 3.4) plus a widescreen check.
const port = 4300;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never' }], ['./e2e/support/summary-reporter.ts']]
    : [['list'], ['./e2e/support/summary-reporter.ts']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // A software GPU would run the haze shader on every page and slow the suite down
    // about sevenfold. Only e2e/haze-webgl.e2e.ts brings a GPU setup of its own.
    launchOptions: { args: ['--disable-3d-apis'] },
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'wide',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: {
    command: `node e2e/server.mjs`,
    env: { PORT: String(port) },
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
});
