import { Term, findForbiddenTerm, sha256 } from './forbidden-terms';

describe('findForbiddenTerm', () => {
  let stem: Term;

  beforeAll(async () => {
    stem = { length: 5, digest: await sha256('rotte') };
  });

  it('finds the stem at the start of a word', async () => {
    expect(await findForbiddenTerm('Das ist Rotterdam.', [stem])).toBe(true);
  });

  it('finds the stem inside a word, like a regex without boundaries', async () => {
    expect(await findForbiddenTerm('Zukunftsrotten', [stem])).toBe(true);
  });

  it('is case-insensitive and works on JSON text', async () => {
    expect(await findForbiddenTerm('{"a":"ROTTE"}', [stem])).toBe(true);
  });

  it('passes text without the stem', async () => {
    expect(await findForbiddenTerm('Portfolio mit Angular und Tests', [stem])).toBe(false);
  });

  it('does not match a stem that is split across two words', async () => {
    expect(await findForbiddenTerm('rot te', [stem])).toBe(false);
  });
});
