import { about, profile } from './profile';

describe('about', () => {
  it('walks the path in the order of the CV, from the trade to today', () => {
    expect(about.path).toEqual([
      'Techniker Maschinenbau',
      'Field Service Engineer',
      'Software Engineer',
    ]);
  });

  it('keeps the approved AI sentence inside the one paragraph', () => {
    expect(about.text).toContain(profile.aiNote);
  });

  it('stays short: one paragraph of at most 90 words (research D4)', () => {
    expect(about.text.split(/\s+/).length).toBeLessThanOrEqual(90);
  });
});
