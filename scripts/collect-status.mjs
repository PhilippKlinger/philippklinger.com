// Writes the public status.json from public signals; runs hourly in .github/workflows/status.yml.
// Node 24 loads the .ts files via type stripping. Usage: node scripts/collect-status.mjs [target]
//
// An unreachable source is a normal result and ends with exit code 0. Exit code 1 means the
// document failed the final validation: then no file is written, so nothing can be uploaded.
import { writeFileSync } from 'node:fs';
import { collectStatus, validateStatus } from '../src/content/status.ts';
import { statusSources } from '../src/content/status-sources.ts';

const target = process.argv[2] ?? 'status.json';

const status = await collectStatus({
  fetch: globalThis.fetch,
  sources: statusSources,
  token: process.env.GITHUB_TOKEN,
  now: () => new Date(),
  onProblem: (source, reason) => console.log(`Not reachable: ${source} (${reason})`),
});

const problems = validateStatus(status, statusSources);
if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::status.json rejected: ${problem}`);
  process.exit(1);
}

writeFileSync(target, `${JSON.stringify(status, null, 2)}\n`);

for (const [project, stations] of Object.entries(status.projects)) {
  const states = Object.entries(stations).map(([key, { reachable }]) => `${key}=${reachable}`);
  console.log(`${project}: ${states.join(' ')}`);
}
