// Writes /llms.txt into the static build from the same data as the pages.
// Part of "npm run build". Node 24 loads the .ts content files via type stripping.
import { writeFileSync } from 'node:fs';
import { focusAreas } from '../src/content/focus-areas.ts';
import { formatLlmsTxt } from '../src/content/llms.ts';
import { profile } from '../src/content/profile.ts';
import { projects } from '../src/content/projects.ts';
import { contact, docsUrl, repositoryUrl, siteUrl } from '../src/content/site.ts';

const target = new URL('../dist/philippklinger/browser/llms.txt', import.meta.url);

writeFileSync(
  target,
  formatLlmsTxt({ profile, focusAreas, projects, contact, siteUrl, repositoryUrl, docsUrl }),
);
