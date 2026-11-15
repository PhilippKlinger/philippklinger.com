import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Images under public/ keep their name and are cached for 30 days (public/.htaccess). A changed
// image therefore needs a new name, or returning visitors keep the old one. The lock file holds the
// content of every name ever published, retired names included, so no name is reused.
const PUBLIC_DIR = 'public';
const LOCK_FILE = 'public-images.lock.json';
const CACHED_IMAGE = /\.(webp|png|svg|ico)$/;

function publicImages(): string[] {
  return readdirSync(PUBLIC_DIR, { recursive: true, encoding: 'utf8' })
    .filter((path) => CACHED_IMAGE.test(path))
    .map((path) => relative(PUBLIC_DIR, join(PUBLIC_DIR, path)).split(sep).join('/'))
    .sort();
}

function sha256(path: string): string {
  return createHash('sha256')
    .update(readFileSync(join(PUBLIC_DIR, path)))
    .digest('hex');
}

describe('public images', () => {
  const lock: Record<string, string> = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));

  it('finds the cached images', () => {
    expect(publicImages()).toContain('images/portrait.webp');
  });

  it.each(publicImages())('%s is in the lock file', (path) => {
    expect(lock[path], `add ${path} to ${LOCK_FILE}`).toBeDefined();
  });

  it.each(publicImages())('%s keeps the content published under its name', (path) => {
    expect(sha256(path), `${path} changed: give it a new name`).toBe(lock[path]);
  });
});
