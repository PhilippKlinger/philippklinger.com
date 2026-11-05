import { about, profile } from './profile';

describe('about.points', () => {
  it('pairs each point with its icon in the order of the design template', () => {
    expect(about.points.map((point) => point.icon)).toEqual(['location', 'cognition', 'wrench']);
  });

  it('keeps the approved AI sentence as the second point', () => {
    expect(about.points[1].text).toBe(profile.aiNote);
  });
});
