import { readFileSync } from 'node:fs';
import { parseStatusDocument } from '../../../../content/evidence-chain';
import { StatusDocument } from '../../../../content/status';

// Written by the deploy before the build; gitignored. Prerender only, never in the browser bundle.
const SNAPSHOT_FILE = 'status-snapshot.json';

/** Without the file the page still renders: every station then reads "not available". */
export function readStatusSnapshot(): StatusDocument | null {
  try {
    return parseStatusDocument(readFileSync(SNAPSHOT_FILE, 'utf8'));
  } catch {
    return null;
  }
}
