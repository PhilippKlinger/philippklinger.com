import { readFileSync } from 'node:fs';
import { BuildInfo, parseBuildInfo } from '../../../content/build-info';

// Written by the deploy before the build; gitignored. Prerender only, never in the browser bundle.
const BUILD_INFO_FILE = 'build-info.json';

/** Local and PR builds have no file: the footer then links to all runs instead of one. */
export function readBuildInfo(): BuildInfo | null {
  try {
    return parseBuildInfo(readFileSync(BUILD_INFO_FILE, 'utf8'));
  } catch {
    return null;
  }
}
